import { AISettings, normalizeSessionZeroSettings } from './types';
import { defaultAISettings } from './defaults';
import { applyPreset } from '../ai-presets';

// Funkcje pomocnicze
export const saveAISettings = (settings: AISettings) => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('ai_settings', JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to save AI settings to localStorage:', e);
    }

    // === REACTIVE SETTINGS: Emituj event dla wszystkich subskrybentów ===
    // Import dynamiczny aby uniknąć circular dependency
    import('../settings-event-emitter').then(({ settingsEmitter }) => {
      settingsEmitter.emit(settings);
    });
  }
};

/**
 * Czysty seam dla przełącznika „Narracja bez lektora" (IND-258).
 * Zwraca kopię ustawień z ustawionym `voiceSettings.enabled`, zachowując pozostałe
 * pola (`provider`, `narratorOnly`, voiceId itd.). Łączony z `saveAISettings` daje
 * trwały, niezależny od presetu mute TTS - ten sam mechanizm co checkbox „Włącz lektora".
 */
export const withVoiceEnabled = (
  settings: AISettings,
  enabled: boolean
): AISettings => ({
  ...settings,
  voiceSettings: { ...settings.voiceSettings, enabled },
});

export const loadAISettings = (): AISettings => {
  if (typeof window !== 'undefined') {
    try {
      // IND-103: jednorazowy cleanup sierot localStorage po drop dead code
      // (voice-matcher/npc-voice-service/initiative-tracker-manager - 0 callerów).
      // Idempotent guard zapobiega multiple-run przy każdym loadAISettings().
      const IND103_MIGRATION_KEY = 'ind103_migration_done';
      if (!localStorage.getItem(IND103_MIGRATION_KEY)) {
        localStorage.removeItem('npc_voices_unified');
        localStorage.removeItem('npc_voice_assignments');
        localStorage.removeItem('initiative_tracker_state');
        localStorage.setItem(IND103_MIGRATION_KEY, '1');
      }

      const saved = localStorage.getItem('ai_settings');
      if (saved) {
        const parsedSettings = JSON.parse(saved);
        // Migracja ustawień - upewnij się, że wszystkie nowe pola są obecne.
        // IND-46: tolerant parse - extra fields w localStorage (legacy
        // openRouterSettings/openRouterApiKey/activeAIProvider) są ignorowane
        // bo AISettings drop'nął je w IND-46 - TS pozwala spread bez crash.
        // IND-91: tolerant migration `replicateEnabled` → `imageGenerationEnabled`.
        // Legacy `replicateEnabled=false` mapuje na nowy `imageGenerationEnabled=false`
        // żeby user który wyłączył obrazy w v3.x dalej miał je wyłączone.
        return {
          ...defaultAISettings,
          ...parsedSettings,
          imageGenerationEnabled:
            parsedSettings.imageGenerationEnabled ??
            parsedSettings.replicateEnabled ??
            defaultAISettings.imageGenerationEnabled,
          geminiSettings: {
            ...defaultAISettings.geminiSettings,
            ...parsedSettings.geminiSettings,
          },
          voiceSettings: {
            ...defaultAISettings.voiceSettings,
            ...parsedSettings.voiceSettings,
            // Migracja legacy providerów chmurowych (google/azure/openai) na gemini
            ...(parsedSettings.voiceSettings?.provider === 'azure' ||
            parsedSettings.voiceSettings?.provider === 'google' ||
            parsedSettings.voiceSettings?.provider === 'openai'
              ? { provider: 'gemini' as const }
              : {}),
            // Migracja legacy głosów Google Cloud (pl-PL-Wavenet) na Gemini Charon
            ...(!parsedSettings.voiceSettings?.voiceId ||
            parsedSettings.voiceSettings?.voiceId.startsWith('pl-PL-Wavenet')
              ? { voiceId: 'Charon' }
              : {}),
          },
          replicateSettings: {
            ...defaultAISettings.replicateSettings,
            ...parsedSettings.replicateSettings,
          },
          gameMasterNarration: {
            ...defaultAISettings.gameMasterNarration,
            ...parsedSettings.gameMasterNarration,
            prompts: {
              ...defaultAISettings.gameMasterNarration.prompts,
              ...parsedSettings.gameMasterNarration?.prompts,
            },
            style: {
              ...defaultAISettings.gameMasterNarration.style,
              ...parsedSettings.gameMasterNarration?.style,
            },
            behavior: {
              ...defaultAISettings.gameMasterNarration.behavior,
              ...parsedSettings.gameMasterNarration?.behavior,
            },
          },
          costControl: {
            ...defaultAISettings.costControl,
            ...parsedSettings.costControl,
          },
          pdfMemory: {
            ...defaultAISettings.pdfMemory,
            ...parsedSettings.pdfMemory,
          },
          gmTools: {
            ...defaultAISettings.gmTools,
            ...parsedSettings.gmTools,
          },
          sessionZero: normalizeSessionZeroSettings(parsedSettings.sessionZero),
          customCommands:
            parsedSettings.customCommands || defaultAISettings.customCommands,
        };
      }
    } catch (e) {
      console.error('Error loading AI settings:', e);
    }
  }
  return applyPreset('ultra', defaultAISettings);
};

export const resetAISettings = (): AISettings => {
  const settings = applyPreset('ultra', defaultAISettings);
  saveAISettings(settings);
  return settings;
};

// Sprawdzanie czy funkcje AI są dostępne
export const isAIFeatureAvailable = (feature: keyof AISettings): boolean => {
  const settings = loadAISettings();

  switch (feature) {
    case 'geminiEnabled':
      return settings.geminiEnabled && !!settings.geminiApiKey;
    case 'imageGenerationEnabled':
      // IND-91: provider-agnostic - master switch dla wszystkich 3 providerów
      // (Vertex/Replicate/Gemini). Vertex używa serwerowych env vars, więc client-side
      // nie sprawdzamy klucza per-provider - orchestrator `/api/imagen` zwróci 500
      // z `providerErrors[]` gdy żaden z 3 nie skonfigurowany. Wcześniej helper
      // wymagał TYLKO replicateApiKey, co blokowało funkcję dla userów z innym providerem.
      return settings.imageGenerationEnabled;
    case 'voiceSettings':
      // IND-86: googleTTSEnabled DROPPED - voiceSettings.provider determines provider
      return settings.voiceSettings.enabled;
    case 'gameMasterNarration':
      return settings.gameMasterNarration.enabled;
    default:
      return false;
  }
};
