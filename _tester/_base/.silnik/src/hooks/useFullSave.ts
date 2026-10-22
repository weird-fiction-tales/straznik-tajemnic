'use client';

import { useState, useCallback, useRef } from 'react';
import type { Message, Character, Campaign, HotSeatConfig, AdventureContext } from '@/lib/types';
import { getAdventureById } from '@/lib/adventures-data';
import type { FullGameSave } from '@/lib/full-game-save-manager';
import { normalizePdfMemory, type PdfMemory } from './usePdfMemory';
import type { ActiveGameState } from '@/lib/types';
import type { AISettings } from '@/lib/ai-settings/types';
import { persistCharacters } from '@/lib/character-cloud-sync';
import { migrateEquipmentCatalog } from '@/lib/equipment-catalog';
import type { EquipmentVisualEra } from '@/lib/types';
import { clearStoredWorldSetup, storeWorldSetup } from '@/lib/world-setup';
import { ensureCharacterDossier } from '@/lib/journal/dossier-migration';
import { toast } from '@/components/ui/use-toast';
import { timeManager, isCampaignClockSnapshot, isGameTime } from '@/lib/time-manager';
import { isDossierInventoryState, storeDossierInventory, emptyDossierInventory } from '@/lib/adventure-dossier/inventory-state';
import { isDossierWorldState, storeDossierWorldState } from '@/lib/adventure-dossier/world-object-state';
import {
  clearCampaignMemoryScope,
  isCampaignMemoryScope,
  storeCampaignMemoryScope,
} from '@/core/memory/campaign-scope';

/**
 * Hook do zarządzania zapisem i wczytywaniem gry
 * Wyodrębniony z page.tsx dla zgodności z GEMINI.md (max 200 linii/plik)
 */

/**
 * Zapis do localStorage odporny na `QuotaExceededError`. Save'y gry niosą inline
 * base64 (portrety, ilustracje) - pojedynczy `setItem` mógł przekroczyć quota i
 * wyjątkiem wywrócić CAŁE wczytywanie. Stan w React jest ustawiany niezależnie,
 * więc cicha degradacja persystencji jest akceptowalna (gra działa w tej sesji).
 */
function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn(`⚠️ Nie udało się zapisać '${key}' do localStorage:`, e);
  }
}

export interface UseFullSaveReturn {
  showFullSaveModal: boolean;
  setShowFullSaveModal: React.Dispatch<React.SetStateAction<boolean>>;
  saveModalMode: 'save' | 'load';
  setSaveModalMode: React.Dispatch<React.SetStateAction<'save' | 'load'>>;
  sessionStartTime: string;
  handleLoadFullSave: (save: FullGameSave) => Promise<boolean>;
  handleStartNewGame: () => void;
}

export interface FullSaveRouterLike {
  replace: (pathname: string, options?: { locale?: 'pl' | 'en' }) => void;
}

export interface UseFullSaveOptions {
  equipmentVisualEra?: EquipmentVisualEra;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setHasStartedGame?: (started: boolean) => void;
  setAdventureContext?: (adventure: AdventureContext | null) => void;
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
  setActiveCharacter: React.Dispatch<React.SetStateAction<Character | null>>;
  setCampaigns: React.Dispatch<React.SetStateAction<Campaign[]>>;
  setPdfMemory: React.Dispatch<React.SetStateAction<PdfMemory>>;
  setActiveGameState: React.Dispatch<React.SetStateAction<ActiveGameState>>;
  setAiSettings: React.Dispatch<React.SetStateAction<AISettings | null>>;
  stopCurrentAudio: () => void;
  restoreHotSeatConfig?: (
    config: HotSeatConfig | undefined,
    characters: Character[]
  ) => boolean;
  clearDeclarations?: () => void;
  resetSessionEndState?: () => void;
  currentLocale?: 'pl' | 'en';
  router?: FullSaveRouterLike;
  pathname?: string;
}

export function useFullSave(options: UseFullSaveOptions): UseFullSaveReturn {
  const {
    setMessages,
    setHasStartedGame,
    setAdventureContext,
    setCharacters,
    setActiveCharacter,
    setCampaigns,
    setPdfMemory,
    setActiveGameState,
    setAiSettings,
    stopCurrentAudio,
    restoreHotSeatConfig,
    clearDeclarations,
    resetSessionEndState,
    equipmentVisualEra,
    currentLocale,
    router,
    pathname,
  } = options;

  const [showFullSaveModal, setShowFullSaveModal] = useState(false);
  const [saveModalMode, setSaveModalMode] = useState<'save' | 'load'>('save');
  const [sessionStartTime] = useState<string>(new Date().toISOString());
  const restoreRequest = useRef<{ save: FullGameSave; requestId: string } | null>(null);
  const loading = useRef(false);

  const handleLoadFullSave = useCallback(
    async (save: FullGameSave): Promise<boolean> => {
      if (loading.current) return false;
      loading.current = true;
      try {
        if (save.clockState !== undefined && !isCampaignClockSnapshot(save.clockState)) {
          throw new Error(currentLocale === 'en' ? 'The saved game clock is invalid.' : 'Zapis zegara gry jest nieprawidłowy.');
        }
        if (save.dossierInventory && (!isDossierInventoryState(save.dossierInventory) ||
          save.dossierInventory.editionFingerprint !== (save.pdfMemory as PdfMemory)?.adventureDossierFingerprint ||
          save.dossierInventory.adventureId !== (save.pdfMemory as PdfMemory)?.adventureId)) {
          throw new Error(currentLocale === 'en' ? 'The saved item state does not match this adventure.' : 'Zapis przedmiotów nie odpowiada tej przygodzie.');
        }
        if (save.dossierWorldState && (!isDossierWorldState(save.dossierWorldState) ||
          save.dossierWorldState.editionFingerprint !== (save.pdfMemory as PdfMemory)?.adventureDossierFingerprint ||
          save.dossierWorldState.adventureId !== (save.pdfMemory as PdfMemory)?.adventureId)) {
          throw new Error(currentLocale === 'en' ? 'The saved world state does not match this adventure.' : 'Zapis stanu świata nie odpowiada tej przygodzie.');
        }
        // A save's source identity, never its prose/name or the current profile,
        // binds the restored title and dossier handouts to their exact adventure.
        const savedPdf = save.pdfMemory as PdfMemory | undefined;
        const savedAdventureId = savedPdf?.adventureId ?? save.campaignMemory?.adventureId;
        const savedAdventure = savedAdventureId ? getAdventureById(savedAdventureId) ?? null : null;
        const hasDossier = Boolean(savedPdf?.adventureDossierFingerprint || save.dossierInventory ||
          save.dossierWorldState || save.messages.some(message => message.dossierHandoutBinding));
        if ((savedPdf?.adventureId && save.campaignMemory?.adventureId &&
          savedPdf.adventureId !== save.campaignMemory.adventureId) ||
          (hasDossier && (!savedAdventure || !savedPdf?.adventureId || !savedPdf.adventureDossierFingerprint)) ||
          save.messages.some(message => message.dossierHandoutBinding &&
            (message.dossierHandoutBinding.adventureId !== savedAdventureId ||
              message.dossierHandoutBinding.editionFingerprint !== savedPdf?.adventureDossierFingerprint))) {
          throw new Error(currentLocale === 'en' ? 'The save does not identify a matching adventure edition.' : 'Zapis nie wskazuje zgodnej przygody i edycji.');
        }
        if (restoreRequest.current?.save !== save) {
          restoreRequest.current = { save, requestId: crypto.randomUUID() };
        }
        const response = await fetch('/api/memory/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId: restoreRequest.current.requestId,
            snapshot: save.memorySnapshot,
            scope: save.campaignMemory,
            messages: save.messages,
            characters: save.characters,
            activeCharacterId: save.activeCharacterId,
            id: save.id,
            name: save.name,
          }),
        });
        const restored = await response.json();
        if (!response.ok || !isCampaignMemoryScope(restored.scope)) {
          throw new Error(restored.error || 'Nie udało się odtworzyć pamięci');
        }
        const campaignMemory = restored.scope;
        if (savedAdventureId && campaignMemory.adventureId !== savedAdventureId) {
          throw new Error(currentLocale === 'en' ? 'The restored memory belongs to another adventure.' : 'Odtworzona pamięć należy do innej przygody.');
        }
        clearDeclarations?.();
        resetSessionEndState?.();
        // Wczytaj wiadomości
        const loadedMessages: Message[] = save.messages.map((msg, idx) => ({
          id: msg.id || `loaded_${idx}`,
          role: msg.role,
          content: msg.content
            ? msg.content.replace(/\[KONIEC_SESJI:POTWIERDZENIE\]/gi, '').trimEnd()
            : msg.content,
          timestamp: new Date(msg.timestamp),
          gameTime: isGameTime(msg.gameTime) ? msg.gameTime : undefined,
          dossierHandoutRecordIds: msg.dossierHandoutRecordIds,
          dossierHandoutBinding: msg.dossierHandoutBinding,
          dossierInventoryWritesAllowed: msg.dossierInventoryWritesAllowed,
          illustrations: msg.illustrations || [],
          // Obrazy scen żyją w generatedImages (nie illustrations) - bez tego
          // wczytany save tracił ilustracje scen.
          generatedImages: msg.generatedImages || [],
          generatedImageTypes: msg.generatedImageTypes,
          generatedImageCacheIds: msg.generatedImageCacheIds,
          skillTests: msg.skillTests,
          // Status urwanej narracji (MAX_TOKENS + zamówiona kontynuacja) musi
          // przeżyć pełny load, inaczej przycisk "Kontynuuj narrację" znikał.
          finishReason: msg.finishReason,
          continuationRequested: msg.continuationRequested,
          mechanicsContext: msg.mechanicsContext && {
            ...msg.mechanicsContext,
            ...(msg.mechanicsContext.skillRollScope && save.campaignMemory &&
              msg.mechanicsContext.skillRollScope.playthroughId === save.campaignMemory.playthroughId &&
              msg.mechanicsContext.skillRollScope.adventureId === save.campaignMemory.adventureId &&
              campaignMemory.adventureId === save.campaignMemory.adventureId
              ? { skillRollScope: { playthroughId: campaignMemory.playthroughId, adventureId: campaignMemory.adventureId } }
              : {}),
          },
        }));
        setMessages(loadedMessages);

        // Wczytaj ustawienia AI
        if (save.gameSettings?.aiSettings) {
          const loadedSettings = {
            ...save.gameSettings.aiSettings,
            sessionId: campaignMemory.playthroughId,
            costControl: save.gameSettings.aiSettings.costControl
              ? { ...save.gameSettings.aiSettings.costControl } : undefined,
          } as AISettings & { sessionId: string };
          // Guard: stare/puste save'y (zapisane bez ustawień AI) mogą nie mieć
          // `costControl` - bez tego przypisanie .sessionCost rzucało wyjątkiem.
          if (
            loadedSettings.costControl &&
            save.sessionMetadata?.sessionCost !== undefined
          ) {
            loadedSettings.costControl.sessionCost =
              save.sessionMetadata.sessionCost;
          }

          setAiSettings(loadedSettings);
          safeSetItem('ai_settings', JSON.stringify(loadedSettings));
        }

        // Wczytaj postacie
        const saveEquipmentEra = save.equipmentVisualEra ?? equipmentVisualEra;
        const migratedCharacters = save.characters.map((character) =>
          ensureCharacterDossier({
            ...character,
            equipment: migrateEquipmentCatalog(
              character.equipment,
              saveEquipmentEra
            ),
            investigatorBoard: character.investigatorBoard || save.investigatorBoard,
          })
        );
        setCharacters(migratedCharacters);
        setActiveCharacter(migratedCharacters.find((c) => c.id === save.activeCharacterId) ?? null);
        // Postacie niosą portrety inline (~MB base64). Pisanie ich wprost do
        // localStorage przekraczało quota i wywalało CAŁE wczytywanie. Przez
        // `persistCharacters`: obrazy wycinane do IndexedDB, roster lekki,
        // hydracja przy następnym renderze (page.tsx hydrateCharacterImages).
        persistCharacters(migratedCharacters);

        // Stare save'y bez tego pola pozostają zgodne i nie uruchamiają
        // automatycznego zgadywania przypisania postaci.
        restoreHotSeatConfig?.(save.hotSeatConfig, migratedCharacters);

        // Wczytaj kampanie
        setCampaigns(save.campaigns);
        safeSetItem('campaigns', JSON.stringify(save.campaigns));

        // Restore both in one React batch: usePdfMemory must not see the new
        // edition paired with the previous adventure and archive it as foreign.
        setAdventureContext?.(savedAdventure);
        safeSetItem('adventure_context', JSON.stringify(savedAdventure));

        // Wczytaj PDF Memory
        if (save.pdfMemory) {
          const migratedPdfMemory = normalizePdfMemory(save.pdfMemory);
          setPdfMemory(migratedPdfMemory);
          safeSetItem('pdf_memory', JSON.stringify(migratedPdfMemory));
        }

        if (save.worldSetup) {
          storeWorldSetup(save.worldSetup);
        } else {
          clearStoredWorldSetup();
        }

        storeCampaignMemoryScope(campaignMemory);
        if (save.clockState) {
          timeManager.restoreSnapshot(save.clockState);
        } else {
          // Old saves may retain a timestamp in the last message. Do not parse
          // narration or carry a deadline over from another loaded campaign.
          const lastTime = [...loadedMessages].reverse().find(msg => isGameTime(msg.gameTime))?.gameTime;
          timeManager.setDeadline(null);
          if (lastTime) timeManager.setTime(lastTime);
        }
        if (save.dossierInventory) {
          storeDossierInventory({ ...save.dossierInventory, playthroughId: campaignMemory.playthroughId });
        } else if ((save.pdfMemory as PdfMemory)?.adventureDossierFingerprint && (save.pdfMemory as PdfMemory)?.adventureId) {
          storeDossierInventory(emptyDossierInventory({ playthroughId: campaignMemory.playthroughId,
            adventureId: (save.pdfMemory as PdfMemory).adventureId!, editionFingerprint: (save.pdfMemory as PdfMemory).adventureDossierFingerprint! }));
        }
        if (save.dossierWorldState) {
          storeDossierWorldState({ ...save.dossierWorldState, playthroughId: campaignMemory.playthroughId });
        }

        // Przywróć listę NPC oraz lokacji z pliku zapisu do pamięci podręcznej
        if (Array.isArray(save.npcs)) {
          // A memory restore forks the saved playthrough. Move only its exact
          // actors, retaining every played fact; foreign/unscoped actors stay foreign.
          const savedNpcSession = hasDossier && save.campaignMemory?.adventureId === campaignMemory.adventureId
            ? save.campaignMemory?.playthroughId : undefined;
          const restoredNpcs = savedNpcSession ? save.npcs.map(npc => npc.sessionId === savedNpcSession
            ? { ...npc, sessionId: campaignMemory.playthroughId } : npc) : save.npcs;
          if (savedNpcSession && restoredNpcs.some(npc => npc.sessionId === campaignMemory.playthroughId)) {
            safeSetItem(`dossier_npcs_session:${encodeURIComponent(campaignMemory.playthroughId)}`, JSON.stringify({
              schemaVersion: 1, sessionId: campaignMemory.playthroughId,
              adventureId: campaignMemory.adventureId, editionFingerprint: savedPdf!.adventureDossierFingerprint,
              npcs: restoredNpcs,
            }));
          }
          safeSetItem('gm_npcs', JSON.stringify(restoredNpcs));
        }
        if (Array.isArray(save.locations)) {
          safeSetItem('gm_locations', JSON.stringify(save.locations));
        }

        // Aktualizuj activeGameState
        setActiveGameState({
          currentCharacter: save.activeCharacterId
            ? migratedCharacters.find((c) => c.id === save.activeCharacterId) ||
              null
            : null,
          campaign: save.activeCampaignId
            ? save.campaigns.find((c) => c.id === save.activeCampaignId) || null
            : null,
          session: null,
          players: [],
        });

        // Resume only a saved playable session. Persist the same lifecycle flag
        // as useGameStart before locale navigation can remount either page.
        const hasPlayableSession = migratedCharacters.some(character => character.id === save.activeCharacterId) &&
          loadedMessages.some(message => (message.role === 'assistant' || message.role === 'user') && Boolean(message.content?.trim()));
        safeSetItem('has_started_game', String(hasPlayableSession));
        setHasStartedGame?.(hasPlayableSession);

        // Auto-synchronizacja języka przy wczytywaniu zapisu (Issue #490)
        const activeLocale: 'pl' | 'en' =
          currentLocale === 'en' || currentLocale === 'pl'
            ? currentLocale
            : typeof window !== 'undefined' &&
              localStorage.getItem('language_selected') === 'en'
            ? 'en'
            : 'pl';

        if (
          (save.locale === 'pl' || save.locale === 'en') &&
          save.locale !== activeLocale
        ) {
          safeSetItem('language_selected', save.locale);
          if (typeof document !== 'undefined') {
            document.cookie = `NEXT_LOCALE=${save.locale};path=/;max-age=31536000;SameSite=Lax`;
          }
          if (router) {
            router.replace(pathname || '/', { locale: save.locale });
          }
        }

        console.log(`✅ Wczytano save: ${save.name}`);
        toast({
          title: `Wczytano: ${save.name}`,
          description: `Wiadomości: ${save.messages.length} · Postacie: ${save.characters.length} · Kampanie: ${save.campaigns.length}`,
        });
        restoreRequest.current = null;
        return true;
      } catch (error) {
        console.error("Błąd podczas wczytywania save'u:", error);
        toast({
          title: "Błąd wczytywania save'u",
          description: error instanceof Error ? error.message : "Wystąpił błąd podczas wczytywania save'u",
          variant: 'destructive',
        });
        return false;
      } finally {
        loading.current = false;
      }
    },
    [
      setMessages,
      setHasStartedGame,
      setAdventureContext,
      setCharacters,
      setActiveCharacter,
      setCampaigns,
      setPdfMemory,
      setActiveGameState,
      setAiSettings,
      restoreHotSeatConfig,
      clearDeclarations,
      resetSessionEndState,
      equipmentVisualEra,
      currentLocale,
      router,
      pathname,
    ]
  );

  const handleStartNewGame = useCallback(() => {
    if (
      confirm(
        'Czy na pewno chcesz rozpocząć nową grę? Wszystkie niezapisane dane zostaną utracone.'
      )
    ) {
      clearDeclarations?.();
      resetSessionEndState?.();
      safeSetItem('has_started_game', 'false');
      setHasStartedGame?.(false);
      // Wyczyść wiadomości
      setMessages([]);

      // Wyczyść pamięć PDF
      setPdfMemory({});
      clearStoredWorldSetup();
      clearCampaignMemoryScope();

      // Zatrzymaj aktualny audio
      stopCurrentAudio();

      // Wyczyść stan gry
      setActiveGameState({
        currentCharacter: null,
        campaign: null,
        session: null,
        players: [],
      });

      // Wyczyść pamięć PDF w API
      fetch('/api/pdf-memory', { method: 'DELETE' }).catch(console.error);

      // Dodaj wiadomość powitalną
      const welcomeMessage: Message = {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content:
          '🎲 Witaj w nowej przygodzie! Przygotuj swoją postać i rozpocznij eksplorację tajemnic. Co chcesz zrobić?',
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, [
    clearDeclarations,
    resetSessionEndState,
    setMessages,
    setHasStartedGame,
    setPdfMemory,
    setActiveGameState,
    stopCurrentAudio,
  ]);

  return {
    showFullSaveModal,
    setShowFullSaveModal,
    saveModalMode,
    setSaveModalMode,
    sessionStartTime,
    handleLoadFullSave,
    handleStartNewGame,
  };
}
