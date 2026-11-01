'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import equal from 'fast-deep-equal';
import {
  AISettings,
  saveAISettings,
  loadAISettings,
  resetAISettings,
  loadDefaultPrompt,
} from '@/lib/ai-settings';
import { applyPreset } from '@/lib/ai-presets';

/**
 * Hook zarządzający lifecycle ustawień modalu Settings.
 *
 * Odpowiedzialności:
 *  - State `settings` + setter
 *  - Init useEffect na otwarcie modalu (loadAISettings + voiceId default + auto-load
 *    domyślnego promptu + emit `onSettingsLoaded` gdy `elevenLabsApiKey`)
 *  - Drift detector useEffect (IND-33) - flip `qualityPreset` na 'custom' przy edycji
 *    pól pasujących do innego presetu
 *  - Refresh interval 3 min - odświeża `setSettings(loadAISettings())`. PATCH K2:
 *    `setCostStats(getStats())` USUNIĘTE z intervalu - costEmitter event-driven
 *    daje stats updates przez subscribe (patrz `useUsageStats`).
 *  - Handlery `handleSave` (saveAISettings + alert + close po setTimeout) i
 *    `handleReset` (confirm + resetAISettings)
 *
 * Wyodrębniony z `useSettingsModal.ts` (linie 90, 158-167, 170-260) jako część IND-31.
 */

export interface UseSettingsInitOptions {
  open?: boolean;
  onClose: () => void;
  onOpenChange?: (open: boolean) => void;
  /**
   * Wywoływany po załadowaniu settings GDY `elevenLabsApiKey` obecny.
   * Orkiestrator może triggerować `loadElevenVoices()` z `useVoiceLoaders`.
   */
  onSettingsLoaded?: (settings: AISettings) => void;
}

export interface UseSettingsInitReturn {
  settings: AISettings;
  setSettings: React.Dispatch<React.SetStateAction<AISettings>>;
  handleSave: () => Promise<void>;
  handleReset: () => void;
  showResetConfirm: boolean;
  openResetConfirm: () => void;
  closeResetConfirm: () => void;
  confirmReset: () => void;
  saveStatus: 'idle' | 'saved' | 'error';
}

export function useSettingsInit(
  options: UseSettingsInitOptions
): UseSettingsInitReturn {
  const { open, onClose, onOpenChange, onSettingsLoaded } = options;

  const [settings, setSettings] = useState<AISettings>(loadAISettings);

  // IND-33: drift detector - wykrywa silent drift (HIGH wybrane → temperature edytowane → label "HIGH" zostaje fałszywie).
  // useRef zapobiega nieskończonej pętli: jeśli settings nie zmienił się względem ostatniego sprawdzenia → return.
  const lastChecked = useRef<AISettings | null>(null);

  // IND-33: drift detector. Po każdej zmianie settings sprawdza czy aktualne wartości
  // pasują do wybranego presetu (rebuild target przez applyPreset). Jeśli nie - flip
  // qualityPreset → 'custom' (zachowuje wszystkie inne pola, tylko zmienia label).
  // Anty-pętla: lastChecked.current przechowuje ostatnio sprawdzony settings - jeśli
  // identyczny przy kolejnym renderze, early return (po flip detector triggeruje ponownie
  // ALE qualityPreset === 'custom' early-returns).
  useEffect(() => {
    if (settings.qualityPreset === 'custom') return;
    if (lastChecked.current && equal(lastChecked.current, settings)) return;

    const target = applyPreset(settings.qualityPreset, settings);
    if (!equal(settings, target)) {
      setSettings((s) => ({ ...s, qualityPreset: 'custom' }));
    }
    lastChecked.current = settings;
  }, [settings]);

  // Init useEffect - loadAISettings + voiceId default + default prompt + emit callback.
  // PATCH K2: setInterval co 3 min ZACHOWANY ale tylko refresh setSettings - costEmitter
  // event-driven daje stats updates real-time przez subscribe (patrz useUsageStats).
  useEffect(() => {
    const initSettings = async () => {
      const savedSettings = loadAISettings();
      // Ustaw domyślny głos jeśli nie jest wybrany lub pozostał z Google Cloud
      if (
        !savedSettings.voiceSettings.voiceId ||
        savedSettings.voiceSettings.voiceId.startsWith('pl-PL-Wavenet')
      ) {
        savedSettings.voiceSettings.voiceId = 'Charon';
        saveAISettings(savedSettings);
      }

      // ZAWSZE ładuj domyślny prompt jeśli pole jest puste i nie ma własnego pliku
      const hasCustomFile =
        savedSettings.gameMasterNarration.prompts.gmInstructionsFileName &&
        !savedSettings.gameMasterNarration.prompts.gmInstructionsFileName.includes(
          'domyślny'
        );
      const hasPrompt =
        savedSettings.gameMasterNarration.prompts.mainPrompt?.trim();

      if (!hasPrompt && !hasCustomFile) {
        // Załaduj domyślny prompt automatycznie
        const defaultPrompt = await loadDefaultPrompt();
        if (defaultPrompt) {
          savedSettings.gameMasterNarration.prompts.mainPrompt = defaultPrompt;
          savedSettings.gameMasterNarration.prompts.isDefaultPrompt = true;
          savedSettings.gameMasterNarration.prompts.gmInstructionsFileName =
            'Strażnik Tajemnic (domyślny)';
          saveAISettings(savedSettings);
          console.log('✅ Default prompt auto-loaded in settings modal');
        }
      }

      setSettings(savedSettings);

      // M3 sesja 146: ElevenLabs callback DROPPED per D2. Provider odchodzi.
      onSettingsLoaded?.(savedSettings);
    };

    initSettings();

    // PATCH K2: refresh interval co 3 min - TYLKO setSettings.
    // setCostStats(getStats()) usunięte z intervalu - costEmitter event-driven
    // (subscribe + emit on record). Polling redundant. Zostaje tylko setSettings refresh
    // (zewnętrzne komponenty mogą zmienić settings w localStorage między renderami).
    const refreshInterval = setInterval(
      () => {
        setSettings(loadAISettings());
      },
      3 * 60 * 1000
    );

    return () => {
      clearInterval(refreshInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const handleSave = useCallback(async () => {
    try {
      saveAISettings(settings);
      setSaveStatus('saved');
      onClose();
      if (onOpenChange) onOpenChange(false);
    } catch (error) {
      console.error('❌ Error saving settings:', error);
      setSaveStatus('error');
    }
  }, [settings, onClose, onOpenChange]);

  const openResetConfirm = useCallback(() => {
    setShowResetConfirm(true);
  }, []);

  const closeResetConfirm = useCallback(() => {
    setShowResetConfirm(false);
  }, []);

  const confirmReset = useCallback(() => {
    const resetSettings = resetAISettings();
    setSettings(resetSettings);
    setShowResetConfirm(false);
  }, []);

  return {
    settings,
    setSettings,
    handleSave,
    handleReset: openResetConfirm,
    showResetConfirm,
    openResetConfirm,
    closeResetConfirm,
    confirmReset,
    saveStatus,
  };
}

