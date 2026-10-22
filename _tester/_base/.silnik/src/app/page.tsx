'use client';

import { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Campaign, AdventureContext, Message, Character } from '@/lib/types';
import {
  loadAISettings,
  saveAISettings,
  withVoiceEnabled,
  initializeDefaultPrompt,
} from '@/lib/ai-settings';
import type { AISettings } from '@/lib/ai-settings/types';
import { settingsEmitter } from '@/lib/settings-event-emitter';
import { appendRollToJournal } from '@/lib/journal/build-roll-entry';
import { CthulhuSidebar } from '@/components/sidebar/CthulhuSidebar';
import { APIUsageCounter } from '@/components/ui/api-usage-counter';
import { useHotSeat } from '@/components/ui/player-switcher';
import { HotSeatSetup } from '@/components/ui/hot-seat-setup';
import { ChatLayout } from '@/components/chat/ChatLayout';
import { CutscenePlayer } from '@/components/ui/cutscene-player';
import { CharacterWizardV2 } from '@/components/ui/character-wizard';

// === HOOKI ===
import { useTTS } from '@/hooks/useTTS';
import {resetActiveAdventure} from '@/lib/new-adventure-reset';
import { usePdfMemory } from '@/hooks/usePdfMemory';
import { useCharacterManagement } from '@/hooks/useCharacterManagement';
import { useFullSave } from '@/hooks/useFullSave';
import { useChat } from '@/hooks/useChat';
import { useCustomAdventures } from '@/hooks/useCustomAdventures';
import { useCutscene } from '@/hooks/useCutscene';
import { useSceneSummary } from '@/hooks/useSceneSummary';
import { useGameStart } from '@/hooks/useGameStart';
import { useHealthCheck } from '@/hooks/useHealthCheck';
import { useLocalPlaytestTransport } from '@/hooks/useLocalPlaytestTransport';
import { sanitizeHistoryForApi } from '@/lib/chat-history-sanitizer';
import { hasLocalPlaytestTransport } from '@/lib/local-playtest-transport';
import { getApiKeyHeaders, hasRequiredKeys } from '@/lib/api-keys-service';
import { hydrateCharacterImages } from '@/lib/character-image-store';
import { persistCharacters } from '@/lib/character-cloud-sync';
import { normalizeStoredCharacters } from '@/lib/character-storage-normalizer';
import { useSkillMarking } from '@/hooks/useSkillMarking';
import { useFullReset } from '@/hooks/useFullReset';
import { toast } from '@/components/ui/use-toast';
import { BUILT_IN_ADVENTURES, STREFA_11_ADVENTURES, AMERICAN_COLD_CASES_ADVENTURES, getAdventureById } from '@/lib/adventures-data';
import { PREDEFINED_CHARACTERS } from '@/lib/immersion/predefined-characters';
import { getStrefa11CharactersForAdventure } from '@/lib/immersion/strefa-11-characters';
import { buildPredefinedEquipment } from '@/lib/immersion/predefined-equipment';
import { resolveGameEraContext } from '@/lib/era';
import { resolveEraVisualProfile } from '@/lib/era-visual-style';
import type { RandomEvent } from '@/lib/random-event-generator';
import {
  getSessionCharacters,
  findPlayerIndexForCharacter,
} from '@/lib/hot-seat/session-party';

// Dynamic imports dla ciężkich komponentów
const ChatWindow = dynamic(
  () =>
    import('@/components/chat/ChatWindow').then((mod) => ({
      default: mod.ChatWindow,
    })),
  {
    loading: () => (
      <div className="animate-pulse bg-muted/40 rounded-lg h-96" />
    ),
    ssr: false,
  }
);

const FullGameSaveModal = dynamic(
  () =>
    import('@/components/ui/full-game-save-modal').then((mod) => ({
      default: mod.FullGameSaveModal,
    })),
  {
    ssr: false,
  }
);

const GMToolsModal = dynamic(
  () =>
    import('@/components/ui/gm-tools-modal').then((mod) => ({
      default: mod.GMToolsModal,
    })),
  {
    ssr: false,
  }
);

const DevelopmentPhaseModal = dynamic(
  () =>
    import('@/components/dialogs/DevelopmentPhaseModal').then((mod) => ({
      default: mod.DevelopmentPhaseModal,
    })),
  { ssr: false }
);

const ApiKeysModal = dynamic(
  () =>
    import('@/components/dialogs/ApiKeysModal').then((mod) => ({
      default: mod.ApiKeysModal,
    })),
  {
    ssr: false,
  }
);

const PredefinedCharactersSelector = dynamic(
  () =>
    import('@/components/ui/predefined-characters-selector').then((mod) => ({
      default: mod.PredefinedCharactersSelector,
    })),
  {
    ssr: false,
  }
);

/**
 * Główny komponent strony
 * Zrefaktoryzowany z użyciem dedykowanych hooków i layoutu
 */
export default function Home() {
  const localTransport = useLocalPlaytestTransport();
  // === CORE HOOKS ===
  const tts = useTTS('pl');
  const charMgmt = useCharacterManagement();

  // Wybrany kontekst przygody
  const [adventureContext, setAdventureContext] =
    useState<AdventureContext | null>(() => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('adventure_context');
        return saved ? (JSON.parse(saved) as AdventureContext) : null;
      }
      return null;
    });

  const [aiSettings, setAiSettings] = useState<AISettings | null>(null);

  const pdf = usePdfMemory({
    setMessages: (fn) => chat.setMessages(fn),
    adventureId: adventureContext?.id,
  });

  // IND-230: Faza Rozwoju CoC. Wynik testu [WYNIK:] z narracji MG ->
  // useChat.onSkillResults -> processSkillResults oznacza udane testy (bez Szczęścia,
  // z wykluczeniem Credit Rating/Mythos). handleUpdateCharacter persystuje postać.
  const skillMarking = useSkillMarking(
    charMgmt.activeCharacter,
    charMgmt.handleUpdateCharacter,
    charMgmt.characters,
    charMgmt.handleCharactersChange
  );
  const [showDevelopmentModal, setShowDevelopmentModal] = useState(false);
  const [pendingDirectorEvent, setPendingDirectorEvent] = useState<RandomEvent | null>(null);

  const [hasStartedGame, setHasStartedGame] = useState(false);
  const hotSeat = useHotSeat(charMgmt.characters);

  const sessionCharacters = useMemo(
    () =>
      getSessionCharacters(
        charMgmt.characters,
        hotSeat.config,
        hasStartedGame,
        charMgmt.activeCharacter
      ),
    [
      charMgmt.characters,
      hotSeat.config,
      hasStartedGame,
      charMgmt.activeCharacter,
    ]
  );

  const chat = useChat({
    pdfMemory: pdf.pdfMemory,
    activeCharacter: charMgmt.activeCharacter,
    characters: sessionCharacters,
    setCharacters: charMgmt.setCharacters,
    setActiveCharacter: charMgmt.setActiveCharacter,
    voiceEnabled: tts.voiceEnabled,
    isTTSEnabled: tts.isTTSEnabled,
    generateVoiceForMessage: tts.generateVoiceForMessage,
    // M6 sesja 146: generateMultiVoice DROPPED per D3.
    addToQueue: tts.addToQueue,
    stopCurrentAudio: tts.stopCurrentAudio,
    adventureContext,
    aiSettings,
    onSkillResults: skillMarking.processSkillResults,
    hotSeatConfig: hotSeat.config,
    pendingDirectorEvent,
    clearPendingDirectorEvent: () => setPendingDirectorEvent(null),
    locale: 'pl',
  });

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [voiceFeatureAvailable, setVoiceFeatureAvailable] = useState(false);

  const save = useFullSave({
    setMessages: chat.setMessages,
    setHasStartedGame,
    setCharacters: charMgmt.setCharacters,
    setActiveCharacter: charMgmt.setActiveCharacter,
    setCampaigns,
    setAdventureContext,
    setPdfMemory: pdf.setPdfMemory,
    setActiveGameState: charMgmt.setActiveGameState,
    setAiSettings,
    stopCurrentAudio: tts.stopCurrentAudio,
    resetSessionEndState: chat.resetSessionEndState,
    currentLocale: 'pl',
  });

  // UI STATE
  const [showGMTools, setShowGMTools] = useState(false);
  const [activeGMTool, setActiveGMTool] = useState<string | null>(null);
  const [showHotSeatSetup, setShowHotSeatSetup] = useState(false);
  const [showApiKeysModal, setShowApiKeysModal] = useState(false);
  // "Nowa przygoda" z opcją zapisu: gdy true, po udanym zapisie resetujemy do kreatora
  const [pendingNewAdventure, setPendingNewAdventure] = useState(false);

  // Refs
  const openSessionZeroRef = useRef<(() => void) | null>(null);
  const openAdventureSelectorRef = useRef<(() => void) | null>(null);

  const [sessionZeroCompleted, setSessionZeroCompleted] = useState(false);
  const [pendingGameStart, setPendingGameStart] = useState(false);

  const customAdventures = useCustomAdventures();
  const cutsceneManager = useCutscene();
  const fullReset = useFullReset();

  const resolvedEraContext = adventureContext
    ? resolveGameEraContext({ adventure: adventureContext })
    : null;

  // === NOWE HOOKI (REFAKTORYZACJA) ===

  const { handleSummarizeScene, isSummarizingScene } = useSceneSummary({
    messages: chat.messages,
    activeCharacter: charMgmt.activeCharacter,
    adventureTitle: adventureContext?.title,
    setActiveCharacter: charMgmt.setActiveCharacter,
    setCharacters: charMgmt.setCharacters,
    characters: sessionCharacters,
  });

  // IND-273 T3: proaktywny self-check klucza/modeli Gemini. onInvalidKey
  // stabilizowany useCallback (setShowApiKeysModal stałe) → runHealthCheck stały
  // → mount effect odpala raz.
  const handleInvalidKey = useCallback(() => setShowApiKeysModal(true), []);
  const { runHealthCheck } = useHealthCheck({ onInvalidKey: handleInvalidKey });

  const {
    handleStartGame,
    isStarting,
    startProgress,
    startStatus,
    isReadyToEnter,
    confirmEnterGame,
    startError,
    retryStartGame,
    cancelStartGame,
  } = useGameStart({
    setHasStartedGame,
    runHealthCheck,
    activeCharacter: charMgmt.activeCharacter,
    characters: sessionCharacters,
    setActiveCharacter: charMgmt.setActiveCharacter,
    setCharacters: charMgmt.setCharacters,
    pdfMemory: pdf.pdfMemory,
    activateDossierForSession: pdf.activateDossierForSession,
    adventureContext,
    hotSeatConfig: hotSeat.config,
    setMessages: chat.setMessages,
    tts: {
      voiceEnabled: tts.voiceEnabled,
      isTTSEnabled: tts.isTTSEnabled,
      generateVoiceForMessage: tts.generateVoiceForMessage,
      addToQueue: tts.addToQueue,
      startInitialBuffering: tts.startInitialBuffering,
      waitForInitialBuffer: tts.waitForInitialBuffer,
      playInitialNarration: tts.playInitialNarration,
      cancelInitialBuffering: tts.cancelInitialBuffering,
      stopCurrentAudio: tts.stopCurrentAudio,
    },
    aiSettings,
    locale: 'pl',
  });

  // Faza 2 + C2: gdy duet aktywny, stwórz/wybierz postać zapamiętuje (kanał
  // localStorage) dla którego gracza ją przypisujemy. Dzięki temu /characters/new
  // (tworzenie) oraz /characters (wybór z katalogu) ostemplują `playerName`,
  // a guard C2 może wymagać jawnego przypisania 2 RÓŻNYCH postaci po imieniu.
  // Solo: zachowanie bez zmian (zero setItem).
  const [showCharacterWizard, setShowCharacterWizard] = useState(false);
  const [duetCreatingPlayerName, setDuetCreatingPlayerName] = useState<string | null>(null);

  const stampDuetTargetPlayer = useCallback(
    (explicitPlayerName?: string) => {
      if (explicitPlayerName) {
        try {
          localStorage.setItem('hotSeatCreatingPlayerName', explicitPlayerName);
        } catch {
          /* ignore */
        }
        return explicitPlayerName;
      }
      if (hotSeat.config.enabled && hotSeat.config.players.length >= 2) {
        const nextUnbound = hotSeat.config.players.find(
          (p) =>
            !charMgmt.characters.some((c) => c.playerName === p.name) &&
            !p.characterId
        );
        const target = nextUnbound?.name ?? hotSeat.config.players[0]?.name;
        if (target) {
          try {
            localStorage.setItem('hotSeatCreatingPlayerName', target);
          } catch {
            /* ignore */
          }
          return target;
        }
      }
      return null;
    },
    [hotSeat.config, charMgmt.characters]
  );

  const handleCreateCharacterForDuet = useCallback(
    (playerName?: string) => {
      const target = stampDuetTargetPlayer(playerName);
      setDuetCreatingPlayerName(target);
      setShowCharacterWizard(true);
    },
    [stampDuetTargetPlayer]
  );

  const handleCharacterWizardCreated = useCallback(
    (character: Character) => {
      const targetPlayer =
        duetCreatingPlayerName ||
        (typeof window !== 'undefined'
          ? localStorage.getItem('hotSeatCreatingPlayerName')
          : null);
      if (targetPlayer) {
        character.playerName = targetPlayer;
        try {
          localStorage.removeItem('hotSeatCreatingPlayerName');
        } catch {
          /* ignore */
        }
      }
      setDuetCreatingPlayerName(null);

      const updated = charMgmt.characters.map((c) => ({ ...c, isActive: false }));
      const newChar: Character = { ...character, isActive: true, lastUsed: new Date() };
      const updatedList = [...updated, newChar];

      charMgmt.setCharacters(updatedList);
      charMgmt.setActiveCharacter(newChar);
      persistCharacters(updatedList);

      setShowCharacterWizard(false);
    },
    [duetCreatingPlayerName, charMgmt]
  );

  const handlePickCharacterForDuet = useCallback(() => {
    stampDuetTargetPlayer();
    charMgmt.handleCharacterManage();
  }, [stampDuetTargetPlayer, charMgmt]);

  const [showPredefinedSelector, setShowPredefinedSelector] = useState(false);

  const handleSelectPredefinedCharacter = useCallback((character: Character) => {
    const stamped: Character = {
      ...character,
      id: `${character.id}_${Date.now()}`,
      sourcePresetId: character.sourcePresetId || character.id,
    };
    
    // Obsługa Hot Seat
    const targetPlayer = localStorage.getItem('hotSeatCreatingPlayerName');
    if (targetPlayer) {
      stamped.playerName = targetPlayer;
      localStorage.removeItem('hotSeatCreatingPlayerName');
    }

    const withoutPreset = charMgmt.characters.filter(
      (c) =>
        c.sourcePresetId !== character.id &&
        c.sourcePresetId !== character.sourcePresetId &&
        c.id !== character.id
    );
    const existingCharacters = [...withoutPreset, stamped];
    
    // Zapisz przez charMgmt i zaktualizuj aktywnego badacza
    charMgmt.setCharacters(existingCharacters);
    charMgmt.setActiveCharacter(stamped);
    
    // Persystencja
    void import('@/lib/character-cloud-sync').then(({ persistCharacters }) =>
      persistCharacters(existingCharacters)
    );
    
    setShowPredefinedSelector(false);
  }, [charMgmt]);

  // Faza 4 + C2: guard startu duetu. TWARDY wymóg - każdy gracz musi mieć
  // WŁASNĄ, jawnie przypisaną postać (po imieniu gracza), i muszą to być 2
  // RÓŻNE postacie. Bez tego NIE startujemy (zamiast cichego pozycyjnego
  // fallbacku z bindCharactersByPlayerName, który po cichu przydzielał pierwszą
  // wolną postać). Solo: przepuszczamy prosto do handleStartGame.
  const handleStartGameGuarded = useCallback(() => {
    if (!(hasRequiredKeys() || hasLocalPlaytestTransport())) {
      setShowApiKeysModal(true);
      return;
    }
    if (hotSeat.config.enabled) {
      const players = hotSeat.config.players;

      // Mapowanie po imieniu gracza: każdy gracz -> jego postać (playerName).
      const boundIds = players.map((p) => {
        const own = charMgmt.characters.find((c) => c.playerName === p.name);
        return own?.id;
      });

      const everyoneHasOwn = boundIds.every((id) => !!id);
      const allDistinct = new Set(boundIds).size === boundIds.length;

      if (!everyoneHasOwn || !allDistinct) {
        const missing = players
          .filter((_, i) => !boundIds[i])
          .map((p) => p.name);
        const description = !everyoneHasOwn
          ? `Każdy gracz musi mieć własną postać. Brakuje postaci dla: ${missing.join(', ')}. ` +
            'Użyj "Stwórz nową postać" lub "Wybierz z katalogu" dla każdego gracza.'
          : 'Obaj gracze nie mogą grać tą samą postacią - przypisz dwie różne postacie.';
        toast({
          title: 'Tryb dla dwojga niegotowy',
          description,
          variant: 'destructive',
        });
        return;
      }

      // Komplet po imionach potwierdzony - utrwal przypisanie w configu Hot Seat.
      hotSeat.bindCharactersByPlayerName(charMgmt.characters);
    }
    handleStartGame();
  }, [hotSeat, charMgmt.characters, handleStartGame]);

  // C3: przełączenie gracza (przełącznik osadzony w sidebarze). Przełącza
  // aktywnego gracza Hot Seat + ustawia jego postać jako aktywną w UI.
  const handleSwitchPlayer = useCallback(
    (index: number) => {
      hotSeat.switchPlayer(index);
      const player = hotSeat.config.players[index];
      if (player) {
        const char = charMgmt.characters.find(
          (c) => c.id === player.characterId
        );
        if (char) charMgmt.setActiveCharacter(char);
      }
    },
    [hotSeat, charMgmt]
  );

  const handleCharacterSwitch = useCallback(
    (character: Character) => {
      if (hotSeat.config.enabled) {
        const playerIndex = findPlayerIndexForCharacter(
          hotSeat.config,
          character.id
        );
        if (playerIndex !== -1) {
          handleSwitchPlayer(playerIndex);
          return;
        }
      }
      charMgmt.handleCharacterSwitch(character);
    },
    [hotSeat.config, handleSwitchPlayer, charMgmt]
  );

  // === EFFECTS ===
  // IND-150: split 52-lin useEffect (7 odpowiedzialności) na 4 useEffects per SRP.
  // Każdy mount-only (deps []), nie pogarsza pre-existing react-hooks/exhaustive-deps.

  // 1. Init default GM prompt (async one-shot)
  useEffect(() => {
    initializeDefaultPrompt('pl').then((initialized) => {
      if (initialized) console.log('✅ Default GM prompt initialized');
    });
  }, []);

  // 1a. IND-273 T3: self-check zdrowia klucza/modeli przy starcie (TTL 24h dławi).
  // Zły klucz → modal BYOK (handleInvalidKey), brak modelu → toast + fallback.
  useEffect(() => {
    runHealthCheck();
  }, [runHealthCheck]);

  useEffect(() => {
    if (!localTransport.loading && !(hasRequiredKeys() || hasLocalPlaytestTransport())) setShowApiKeysModal(true);

    const handleOpenModal = () => setShowApiKeysModal(true);
    window.addEventListener('open-api-keys-modal', handleOpenModal);
    return () => window.removeEventListener('open-api-keys-modal', handleOpenModal);
  }, [localTransport.loading, localTransport.serverConfigured]);

  // 1a-bis. IND-273 T5b: auto-odświeżenie cennika Gemini (TTL 24h po stronie
  // serwera). Fire-and-forget; tanie gdy cache świeży (bez LLM). Po sukcesie serwer
  // nakłada overlay i licznik kosztów liczy świeższymi stawkami. Błąd = cisza (bundled).
  useEffect(() => {
    fetch('/api/pricing/refresh', { headers: getApiKeyHeaders() }).catch(
      () => {}
    );
  }, []);

  const [pendingQuickStart, setPendingQuickStart] = useState(false);
  useEffect(() => {
    if (pendingQuickStart && charMgmt.characters.length > 0) {
      setPendingQuickStart(false);
      handleStartGameGuarded();
    }
  }, [pendingQuickStart, charMgmt.characters, handleStartGameGuarded]);

  const handleQuickStartOnboarding = useCallback(
    async (adventureId: string, characterId: string, mode?: 'solo' | 'hot-seat', player2CharacterId?: string) => {
      // 1. Ustaw przygodę i postać z presetów
      let adv = getAdventureById(adventureId);
      const allCharacters = adv?.isStrefa11 || adv?.isAmericanColdCase
        ? getStrefa11CharactersForAdventure(adv.id)
        : PREDEFINED_CHARACTERS;
      const preset = allCharacters.find((c) => c.id === characterId);

      if (adv && preset?.startingNodeId) {
        adv = {
          ...adv,
          activeNodeId: preset.startingNodeId,
          ...(preset.openingHook ? { hook: preset.openingHook } : {}),
        };
      }

      if (adv) {
        setAdventureContext(adv);
        if (typeof window !== 'undefined') {
          localStorage.setItem('adventure_context', JSON.stringify(adv));
        }
      }
      if (preset) {
        const targetEra = adv
          ? resolveEraVisualProfile(resolveGameEraContext({ adventure: adv }))
          : undefined;
        const stamped: Character = {
          ...preset,
          ...(targetEra
            ? { equipment: buildPredefinedEquipment(preset, targetEra) }
            : {}),
          id: `char_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          sourcePresetId: preset.id,
          isActive: true,
        };
        if (mode === 'hot-seat') {
          stamped.playerName = 'Gracz 1';
        }
        // Deduplikacja: zastąp wcześniejszy klon tego samego presetu zamiast mnożyć wpisy
        const withoutPreset1 = charMgmt.characters.filter(
          (c) => c.sourcePresetId !== preset.id && c.id !== preset.id
        );
        const updatedList = [...withoutPreset1, stamped];

        if (mode === 'hot-seat') {
          // dobierz drugą postać (płci przeciwnej do wybranej lub przekazaną)
          let preset2 = player2CharacterId ? allCharacters.find((c) => c.id === player2CharacterId) : undefined;
          if (!preset2) {
            preset2 = allCharacters.find((c) => c.gender !== preset.gender) || allCharacters[1];
          }
          
          if (preset2) {
            const stamped2: Character = {
              ...preset2,
              ...(targetEra
                ? { equipment: buildPredefinedEquipment(preset2, targetEra) }
                : {}),
              id: `char_${Date.now() + 1}_${Math.random().toString(36).substr(2, 4)}`,
              sourcePresetId: preset2.id,
              playerName: 'Gracz 2',
            };
            const finalWithoutPreset2 = updatedList.filter(
              (c) => c.sourcePresetId !== preset2?.id && c.id !== preset2?.id
            );
            finalWithoutPreset2.push(stamped2);
            charMgmt.setCharacters(finalWithoutPreset2);
            charMgmt.setActiveCharacter(stamped);
            
            hotSeat.restoreConfig({
              enabled: true,
              players: [
                { id: `p1_${Date.now()}`, name: 'Gracz 1', color: '#4ade80', characterId: stamped.id, isActive: true, turnCount: 0 },
                { id: `p2_${Date.now()}`, name: 'Gracz 2', color: '#f472b6', characterId: stamped2.id, isActive: false, turnCount: 0 },
              ],
              activePlayerIndex: 0,
              allowInterruptions: true,
              showPlayerIndicator: true,
            }, finalWithoutPreset2);
          }
        } else {
          charMgmt.setCharacters(updatedList);
          charMgmt.setActiveCharacter(stamped);
          hotSeat.restoreConfig({
            enabled: false,
            players: [],
            activePlayerIndex: 0,
            allowInterruptions: true,
            showPlayerIndicator: false,
          }, updatedList);
        }

        try {
          const { persistCharacters } = await import('@/lib/character-cloud-sync');
          persistCharacters(updatedList);
        } catch {
          // fallback lokalny
        }
      }
      setPendingQuickStart(true);
    },
    [charMgmt, hotSeat, handleStartGameGuarded]
  );

  // 1c. Hydration-safe: dociągnij flagi stanu gry z localStorage PO mount.
  // useState startuje na false (= SSR), tu ustawiamy realną wartość, więc
  // pierwszy render klienta zgadza się z serwerem (brak hydration mismatch).
  useEffect(() => {
    if (localStorage.getItem('has_started_game') === 'true') {
      setHasStartedGame(true);
    }
    if (localStorage.getItem('session_zero_completed') === 'true') {
      setSessionZeroCompleted(true);
    }
  }, []);

  // 1d. DUET (Hot Seat): activePlayerIndex jest ŹRÓDŁEM PRAWDY aktywnej postaci.
  // Wymuszamy charMgmt.activeCharacter na postać aktywnego gracza za każdym razem,
  // gdy zmieni się indeks lub przypisanie postaci (switch / load / bind postaci po
  // imieniu). Bez tej synchronizacji activeCharacter (panele, Faza Rozwoju, atrybucja
  // tagów [SANITY:]/[HP:]/[DZIENNIK:]) rozjeżdżał się z etykietą przełącznika 🔄 -
  // panele czytały Marcusa, gdy przełącznik wskazywał Eleanor.
  useEffect(() => {
    if (!hotSeat.config.enabled) return;
    const player = hotSeat.config.players[hotSeat.config.activePlayerIndex];
    if (!player?.characterId) return;
    const target = charMgmt.characters.find((c) => c.id === player.characterId);
    if (target && target.id !== charMgmt.activeCharacter?.id) {
      charMgmt.setActiveCharacter(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hotSeat.config,
    charMgmt.characters,
    charMgmt.activeCharacter,
    charMgmt.setActiveCharacter,
  ]);

  // 2. Load localStorage data (chat / characters / campaigns / pdf)
  useEffect(() => {
    // useChat owns the complete history. Legacy is a fallback only, never an overwrite.
    const savedChat = localStorage.getItem('zew_chat_messages') === null
      ? localStorage.getItem('chat-messages') : null;
    if (savedChat) {
      try {
        const loadedMessages = (
          JSON.parse(savedChat) as (Message & { timestamp: string })[]
        )
          .map((msg) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          }))
          .filter(
            (msg) => !msg.content.match(/^!\[[^\]]*\]\(\[IMG_BASE64\]\)$/)
          );
        chat.setMessages(sanitizeHistoryForApi(loadedMessages));
      } catch (e) {
        console.error('Error loading chat:', e);
      }
    }

    const savedChars = localStorage.getItem('characters');
    if (savedChars) {
      try {
        const chars = normalizeStoredCharacters(JSON.parse(savedChars));
        charMgmt.setCharacters(chars);
        const activeChar =
          chars.find((c) => c.isActive) ||
          (chars.length > 0 ? chars[chars.length - 1] : null);
        if (activeChar) charMgmt.setActiveCharacter(activeChar);
        // Utrwal naprawioną strukturę, aby kolejny start nie czytał ponownie
        // wadliwej wartości `equipment` z wcześniejszej wersji aplikacji.
        persistCharacters(chars);
        // IND-262: portret + miniatury ekwipunku żyją w IndexedDB (wycięte z
        // localStorage przez quota). Dociągnij je do rosteru po załadowaniu.
        hydrateCharacterImages(chars)
          .then((hydrated) => {
            charMgmt.setCharacters(hydrated);
            const activeHydrated =
              hydrated.find((c) => c.isActive) ||
              (hydrated.length > 0 ? hydrated[hydrated.length - 1] : null);
            if (activeHydrated) charMgmt.setActiveCharacter(activeHydrated);
          })
          .catch(() => {});
      } catch (e) {
        console.error('Error loading chars:', e);
      }
    }

    const savedCampaigns = localStorage.getItem('campaigns');
    if (savedCampaigns) {
      try {
        setCampaigns(JSON.parse(savedCampaigns));
      } catch (e) {
        console.error('Error loading campaigns:', e);
      }
    }

    const savedPdf = localStorage.getItem('pdf_memory');
    if (savedPdf) {
      try {
        pdf.setPdfMemory(JSON.parse(savedPdf));
      } catch (e) {
        console.error('Error loading pdf_memory:', e);
      }
    }
  }, []);

  // 3. Load AISettings + initialize TTS state
  useEffect(() => {
    const settings = loadAISettings();
    setAiSettings(settings);
    setVoiceFeatureAvailable(true);
    // IND-86: googleTTSEnabled DROPPED - voiceSettings.enabled = single source of truth
    const ttsEnabled = settings.voiceSettings?.enabled !== false;
    tts.setVoiceEnabled(ttsEnabled);
    tts.setIsTTSEnabled(ttsEnabled);
  }, []);

  // 4. Subscribe to reactive settings changes (settingsEmitter)
  useEffect(() => {
    const unsubscribeSettings = settingsEmitter.subscribe((newSettings) => {
      setAiSettings(newSettings);
      const newTtsEnabled = newSettings.voiceSettings?.enabled !== false;
      tts.setVoiceEnabled(newTtsEnabled);
      tts.setIsTTSEnabled(newTtsEnabled);
    });

    return () => {
      unsubscribeSettings();
    };
  }, []);

  useEffect(() => {
    if (chat.messages.length > 0) {
      const messagesToSave = sanitizeHistoryForApi(chat.messages.slice(-500));
      localStorage.setItem('chat-messages', JSON.stringify(messagesToSave));
    }
  }, [chat.messages]);

  // IND-258: przełącznik „Narracja bez lektora" w sidebarze. Pisze trwałe
  // voiceSettings.enabled przez saveAISettings → settingsEmitter → subskrypcja
  // (3. useEffect) ustawia runtime flagi TTS. Niezależny od presetu, sticky.
  const handleToggleNarrator = (enabled: boolean) => {
    saveAISettings(withVoiceEnabled(aiSettings ?? loadAISettings(), enabled));
  };

  // "Nowa przygoda": pełny reset scenariusza → powrót do ekranu głównego (kreatora).
  // Czyści czat + wybraną przygodę + Sesję Zero, ale ZACHOWUJE postacie (roster) i
  // zasady (pdf_memory). Kontynuacja sesji z sejwu jest niezależna (handleLoadFullSave).
  const handleNewAdventure = () => {
    chat.stopGeneration();
    chat.setMessages([]);
    chat.setActiveChaseState(null);
    chat.resetSessionEndState();
    localStorage.removeItem('chat-messages');
    tts.stopCurrentAudio();
    // Muzyka tła (YouTube) gra tylko w trakcie gry - przy powrocie do menu cichnie.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('zew:stop-music'));
    }
    charMgmt.setActiveGameState({
      currentCharacter: null,
      campaign: null,
      session: null,
      players: [],
    });
    setHasStartedGame(false);
    localStorage.setItem('has_started_game', 'false');
    setSessionZeroCompleted(false);
    localStorage.setItem('session_zero_completed', 'false');
    setAdventureContext(null);
    localStorage.removeItem('adventure_context');
    // #7: tryb gry (Solo / duet) jest per-przygoda - nowa przygoda wraca do Solo.
    hotSeat.disableHotSeat();
    resetActiveAdventure(localStorage);
    // Reload disposes every hook/ref, pending voice queue and old campaign callback.
    window.location.reload();
  };

  // #7: wybór trybu Solo - wyłącza Hot Seat i (jeśli jest aktywna postać)
  // zapisuje imię gracza na jej karcie. Binding postaci do graczy to osobna faza.
  const handleChooseSolo = useCallback(
    (player1Name: string) => {
      hotSeat.disableHotSeat();
      const active = charMgmt.activeCharacter;
      if (active && player1Name) {
        charMgmt.handleUpdateCharacter({ ...active, playerName: player1Name });
      }
    },
    [hotSeat, charMgmt]
  );

  return (
    <ChatLayout
      sidebar={
        <CthulhuSidebar
          adventureContext={adventureContext}
          hideSidebarPanel={!hasStartedGame}
          activeCharacter={charMgmt.activeCharacter || undefined}
          characters={sessionCharacters}
          onCharacterSwitch={handleCharacterSwitch}
          onCharacterCreate={handleCreateCharacterForDuet}
          onCharacterManage={charMgmt.handleCharacterManage}
          onUpdateCharacter={charMgmt.handleUpdateCharacter}
          handleSendMessage={chat.handleSendMessage}
          activeGameState={charMgmt.activeGameState}
          voiceFeatureAvailable={voiceFeatureAvailable}
          voiceEnabled={tts.voiceEnabled}
          setVoiceEnabled={tts.setVoiceEnabled}
          isTTSEnabled={tts.isTTSEnabled}
          setIsTTSEnabled={tts.setIsTTSEnabled}
          onToggleNarrator={handleToggleNarrator}
          queueStatus={tts.queueStatus}
          onStartNewGame={save.handleStartNewGame}
          onNewAdventure={handleNewAdventure}
          onSaveAndNewAdventure={() => {
            setPendingNewAdventure(true);
            save.setSaveModalMode('save');
            save.setShowFullSaveModal(true);
          }}
          onOpenGameSession={() => {
            // #4: "Wczytaj" otwiera katalog lokalnych sejwów (FullGameSaveModal),
            // a NIE legacy GameSession (chmura + "zapisz w trybie load").
            save.setSaveModalMode('load');
            save.setShowFullSaveModal(true);
          }}
          onOpenGMTools={(tool) => {
            setShowGMTools(true);
            setActiveGMTool(tool);
          }}
          onOpenDevelopmentPhase={() => setShowDevelopmentModal(true)}
          markedSkillsCount={skillMarking.markedCount}
          onSaveGame={() => {
            save.setSaveModalMode('save');
            save.setShowFullSaveModal(true);
          }}
          onOpenHotSeat={() => setShowHotSeatSetup(true)}
          onSessionZeroComplete={() => {
            setSessionZeroCompleted(true);
            localStorage.setItem('session_zero_completed', 'true');
          }}
          registerOpenSessionZero={(fn) => {
            openSessionZeroRef.current = fn;
          }}
          registerOpenAdventureSelector={(fn) => {
            openAdventureSelectorRef.current = fn;
          }}
          onAdventureSelect={setAdventureContext}
          customAdventures={customAdventures.customAdventures}
          onUploadAdventure={customAdventures.uploadAdventure}
          onDeleteAdventure={customAdventures.deleteAdventure}
          onToggleAttachLorebook={customAdventures.toggleAttachLorebook}
          isUploadingAdventure={customAdventures.isLoading}
          uploadProgressAdventure={customAdventures.uploadProgress}
          loadingStatusAdventure={customAdventures.loadingStatus}
          uploadErrorAdventure={customAdventures.uploadError}
          onClearUploadErrorAdventure={customAdventures.clearUploadError}

          hotSeatConfig={hotSeat.config}
          onSwitchPlayer={handleSwitchPlayer}
          onDisableHotSeat={hotSeat.disableHotSeat}
          aiSettings={aiSettings || undefined}
          onUpdateAISettings={(updated) => {
            setAiSettings(updated);
          }}
          isSessionEnded={chat.isSessionEnded}
          sessionEndStatus={chat.sessionEndStatus}
        />
      }
      modals={
        <>
          {save.showFullSaveModal && (
            <FullGameSaveModal
              isOpen={save.showFullSaveModal}
              onClose={() => {
                save.setShowFullSaveModal(false);
                // Anulowanie zapisu NIE resetuje gry - kasujemy oczekujący reset
                setPendingNewAdventure(false);
              }}
              onSaved={() => {
                if (pendingNewAdventure) handleNewAdventure();
              }}
              mode={save.saveModalMode}
              currentData={
                save.saveModalMode === 'save'
                  ? {
                      messages: chat.messages,
                      locale: 'pl',
                      aiSettings: aiSettings || loadAISettings(),
                      equipmentVisualEra: resolveEraVisualProfile(resolvedEraContext || '1920s'),
                      characters: charMgmt.characters,
                      activeCharacterId: charMgmt.activeCharacter?.id,
                      hotSeatConfig: hotSeat.config,
                      investigatorBoard: charMgmt.activeCharacter?.investigatorBoard,
                      campaigns: campaigns,
                      activeCampaignId: charMgmt.activeGameState.campaign?.id,
                      npcs: (() => {
                        if (typeof window === 'undefined') return [];
                        try {
                          return JSON.parse(localStorage.getItem('gm_npcs') || '[]');
                        } catch {
                          return [];
                        }
                      })(),
                      locations: (() => {
                        if (typeof window === 'undefined') return [];
                        try {
                          return JSON.parse(localStorage.getItem('gm_locations') || '[]');
                        } catch {
                          return [];
                        }
                      })(),
                      currentLocationId: undefined,
                      pdfMemory: pdf.pdfMemory,
                      notes: '',
                      sessionStartTime: save.sessionStartTime,
                    }
                  : undefined
              }
              onLoad={save.handleLoadFullSave}
            />
          )}

          {showGMTools && activeGMTool && (
            <GMToolsModal
              tool={activeGMTool}
              onClose={() => {
                setShowGMTools(false);
                setActiveGMTool(null);
              }}
              activeCharacter={charMgmt.activeCharacter}
              currentLocation={chat.currentLocation}
              sessionId={charMgmt.activeGameState?.session?.id}
              onEventGenerated={(event) => {
                setPendingDirectorEvent(event);
                toast({
                  title: 'Wydarzenie dodane do bufora',
                  description: 'Zostanie wplecione w kolejną odpowiedź AI.',
                });
                setShowGMTools(false);
                setActiveGMTool(null);
              }}
            />
          )}

          <ApiKeysModal
            open={showApiKeysModal}
            onOpenChange={setShowApiKeysModal}
          />

          {/* IND-230: Faza Rozwoju CoC - rzuty na poprawę oznaczonych umiejętności */}
          {showDevelopmentModal && charMgmt.activeCharacter && (
            <DevelopmentPhaseModal
              isOpen={showDevelopmentModal}
              onClose={() => setShowDevelopmentModal(false)}
              character={charMgmt.activeCharacter}
              onCharacterUpdate={charMgmt.handleUpdateCharacter}
            />
          )}

          <APIUsageCounter />

          <HotSeatSetup
            open={showHotSeatSetup}
            onClose={() => setShowHotSeatSetup(false)}
            onStartHotSeat={hotSeat.initHotSeat}
            onChooseSolo={handleChooseSolo}
          />

          {/* C3: przełącznik graczy przeniesiony do CthulhuSidebar (osadzony
              między panelem postaci a przyciskami akcji). */}

          {cutsceneManager.isActive && (
            <CutscenePlayer
              cutscene={cutsceneManager.cutscene}
              onSegmentComplete={cutsceneManager.nextSegment}
              onSkip={cutsceneManager.skipCutscene}
              onPause={cutsceneManager.pause}
              onResume={cutsceneManager.resume}
              onMute={cutsceneManager.toggleMute}
              onClose={cutsceneManager.skipCutscene}
            />
          )}
          {showCharacterWizard && (
            <CharacterWizardV2
              onClose={() => {
                setShowCharacterWizard(false);
                setDuetCreatingPlayerName(null);
              }}
              onCharacterCreated={handleCharacterWizardCreated}
              adventureContext={adventureContext || undefined}
            />
          )}
        </>
      }
    >
      <ChatWindow
        messages={chat.messages}
        newMessage={chat.newMessage}
        setNewMessage={chat.setNewMessage}
        handleSendMessage={chat.handleSendMessage}
        currentAudio={tts.currentAudio}
        stopCurrentAudio={tts.stopCurrentAudio}
        toggleAudioPause={tts.toggleAudioPause}
        isAudioPaused={tts.isAudioPaused}
        isTTSEnabled={tts.isTTSEnabled}
        activeCharacter={charMgmt.activeCharacter}
        characters={sessionCharacters}
        onJournalRoll={(roll, justification) => {
          const c = charMgmt.activeCharacter;
          if (!c) return;
          const updated = appendRollToJournal(c, roll, justification);
          if (updated !== c) charMgmt.handleUpdateCharacter(updated);
        }}
        onSpendLuck={(amount) => {
          const c = charMgmt.activeCharacter;
          if (!c) return;
          charMgmt.handleUpdateCharacter({
            ...c,
            luck: Math.max(0, c.luck - amount),
          });
        }}
        onUploadRules={() => document.getElementById('rules-upload')?.click()}
        onSelectAdventure={() => openAdventureSelectorRef.current?.()}
        onSessionZero={() => openSessionZeroRef.current?.()}
        hasAdventure={!!adventureContext}
        adventureTitle={adventureContext?.title}
        adventureDescription={adventureContext?.description}
        region={adventureContext?.location}
        currentLocation={chat.currentLocation}
        eraContext={resolvedEraContext}
        onCreateCharacter={handleCreateCharacterForDuet}
        onPickPredefinedCharacter={() => {
          stampDuetTargetPlayer();
          setShowPredefinedSelector(true);
        }}
        onPickCharacter={handlePickCharacterForDuet}
        onSummarizeScene={handleSummarizeScene}
        isSummarizingScene={isSummarizingScene}
        isLoading={chat.isLoading}
        onStopGeneration={chat.stopGeneration}
        isInitialBuffering={tts.isInitialBuffering}
        isDuet={chat.isDuet}
        pendingDeclarations={chat.pendingDeclarations}
        playersAwaitingDeclaration={chat.playersAwaitingDeclaration}
        onAddDeclaration={chat.addDeclaration}
        onPassDeclaration={chat.passDeclaration}
        currentPlayerName={chat.currentPlayerName}
        isTurnReady={chat.isTurnReady}
        onSendTurn={chat.sendTurn}
        onSwitchPlayer={hotSeat.switchPlayer}
        onDisableHotSeat={hotSeat.disableHotSeat}
        onStartGame={handleStartGameGuarded}
        onQuickStart={handleQuickStartOnboarding}
        onChoosePlayMode={() => setShowHotSeatSetup(true)}
        onLoadSave={() => {
          save.setSaveModalMode('load');
          save.setShowFullSaveModal(true);
        }}
        onColdStart={fullReset.handleFullReset}
        hasRules={!!pdf.pdfMemory.rulesUrl || (localTransport.serverConfigured && localTransport.serverHasBaseRules)}
        hasSessionZero={sessionZeroCompleted}
        hasStartedGame={hasStartedGame}
        onOpenApiKeys={() => setShowApiKeysModal(true)}
        quoteActive={
          !showApiKeysModal &&
          !showHotSeatSetup &&
          !showPredefinedSelector &&
          !save.showFullSaveModal
        }
        hotSeatConfig={hotSeat.config}
        isSessionEnded={chat.isSessionEnded}
        sessionEndStatus={chat.sessionEndStatus}
        sessionSaveStatus={chat.sessionSaveStatus}
        onRetrySessionSave={chat.retrySessionSave}
        dossierProtocolFailure={chat.dossierProtocolFailure}
          pendingDossierSkillRollRetry={chat.pendingDossierSkillRollRetry}
          retryDossierSkillRoll={chat.retryDossierSkillRoll}
        onConfirmAcquiredItem={chat.confirmAcquiredItem}
        onDismissAcquiredItem={chat.dismissAcquiredItem}
        onCharacterUpdate={charMgmt.handleUpdateCharacter}
        onContinueNarration={chat.handleContinueNarration}
        isStarting={isStarting}
        startProgress={startProgress}
        startStatus={startStatus}
        isReadyToEnter={isReadyToEnter}
        onConfirmEnterGame={confirmEnterGame}
        startError={startError}
        onRetryStartGame={retryStartGame}
        onCancelStartGame={cancelStartGame}
        adventureContext={adventureContext}
        pendingCombatAttack={chat.pendingCombatAttack}
        pendingCombatDefensesUsed={chat.pendingCombatDefensesUsed}
        combatDefenseWeapons={chat.combatDefenseWeapons}
        onCombatDefense={chat.handleCombatDefense}
        cheatCombatModal={chat.cheatCombatModal}
        onCloseCheatCombat={() => chat.setCheatCombatModal(null)}
        cheatChaseModal={chat.cheatChaseModal}
        onCloseCheatChase={() => chat.setCheatChaseModal(false)}
        activeChaseState={chat.activeChaseState}
        onChaseStateChange={chat.setActiveChaseState}
      />
      {showPredefinedSelector && (
        <PredefinedCharactersSelector
          isOpen={showPredefinedSelector}
          onClose={() => setShowPredefinedSelector(false)}
          onSelectCharacter={handleSelectPredefinedCharacter}
          characters={
            adventureContext?.id &&
            (STREFA_11_ADVENTURES.some((adventure) => adventure.id === adventureContext.id) ||
              AMERICAN_COLD_CASES_ADVENTURES.some((adventure) => adventure.id === adventureContext.id))
              ? getStrefa11CharactersForAdventure(adventureContext.id)
              : PREDEFINED_CHARACTERS
          }
          currentEra={adventureContext?.era || 'classic'}
          filterByEra={
            !adventureContext?.id ||
            (!STREFA_11_ADVENTURES.some((adventure) => adventure.id === adventureContext.id) &&
              !AMERICAN_COLD_CASES_ADVENTURES.some((adventure) => adventure.id === adventureContext.id))
          }
        />
      )}
    </ChatLayout>
  );
}
