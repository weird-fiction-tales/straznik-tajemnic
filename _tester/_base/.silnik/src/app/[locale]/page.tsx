'use client';

import { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
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
import { LanguageSelectionModal } from '@/components/onboarding/language-selection-modal';
import { usePathname, useRouter } from '@/i18n/routing';
import { CharacterWizardV2 } from '@/components/ui/character-wizard';
import { persistCharacters } from '@/lib/character-cloud-sync';


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
import { hasLocalPlaytestTransport, hasLocalPlaytestRules } from '@/lib/local-playtest-transport';
import { getApiKeyHeaders, hasRequiredKeys } from '@/lib/api-keys-service';
import { useRulesStatus } from '@/hooks/useRulesStatus';
import { hydrateCharacterImages } from '@/lib/character-image-store';
import { useSkillMarking } from '@/hooks/useSkillMarking';
import { useFullReset } from '@/hooks/useFullReset';
import { toast } from '@/components/ui/use-toast';
import {
  BUILT_IN_ADVENTURES,
  STREFA_11_ADVENTURES,
  AMERICAN_COLD_CASES_ADVENTURES,
  getAdventureById,
} from '@/lib/adventures-data';
import { PREDEFINED_CHARACTERS } from '@/lib/immersion/predefined-characters';
import { getStrefa11CharactersForAdventure } from '@/lib/immersion/strefa-11-characters';
import { buildPredefinedEquipment } from '@/lib/immersion/predefined-equipment';
import {
  localizeStrefa11Adventure,
  localizeStrefa11Character,
} from '@/lib/immersion/strefa-11-localization';
import type { RandomEvent } from '@/lib/random-event-generator';
import { resolveGameEraContext } from '@/lib/era';
import { resolveEraVisualProfile } from '@/lib/era-visual-style';
import { timeManager } from '@/lib/time-manager';
import {
  getSessionCharacters,
  findPlayerIndexForCharacter,
} from '@/lib/hot-seat/session-party';
import { FullGameSaveManager } from '@/lib/full-game-save-manager';
import {
  determineStartupLocale,
  resolveAdventureLocale,
  syncLocaleStorageAndCookie,
} from '@/lib/i18n/session-locale';


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

const RulebookModal = dynamic(
  () =>
    import('@/components/dialogs/RulebookModal').then((mod) => ({
      default: mod.RulebookModal,
    })),
  {
    ssr: false,
  }
);
const CompendiumModal = dynamic(
  () =>
    import('@/components/compendium-modal/CompendiumModal').then((mod) => ({
      default: mod.CompendiumModal,
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
const BetaWelcomeModal = dynamic(
  () =>
    import('@/components/dialogs/BetaWelcomeModal').then((mod) => ({
      default: mod.BetaWelcomeModal,
    })),
  {
    ssr: false,
  }
);
const BetaFeedbackModal = dynamic(
  () =>
    import('@/components/dialogs/BetaFeedbackModal').then((mod) => ({
      default: mod.BetaFeedbackModal,
    })),
  {
    ssr: false,
  }
);


export default function Home() {
  const localTransport = useLocalPlaytestTransport();
  const t = useTranslations('Page');
  
  const locale = useLocale();
  const gameLocale: 'pl' | 'en' = locale === 'en' ? 'en' : 'pl';
  const router = useRouter();
  const pathname = usePathname();
  
  const tts = useTTS(gameLocale);
  const charMgmt = useCharacterManagement();

  
  const [adventureContext, setAdventureContext] =
    useState<AdventureContext | null>(() => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('adventure_context');
        return saved ? (JSON.parse(saved) as AdventureContext) : null;
      }
      return null;
    });

  const handleAdventureSelect = useCallback(
    (adv: AdventureContext | null) => {
      setAdventureContext(adv);
      if (typeof window !== 'undefined') {
        if (adv) {
          localStorage.setItem('adventure_context', JSON.stringify(adv));
          // Issue #733: Synchronizacja języka UI przy wyborze przygody o innym locale
          const targetLocale = resolveAdventureLocale(adv);
          if (targetLocale && targetLocale !== gameLocale) {
            syncLocaleStorageAndCookie(targetLocale);
            router.replace(pathname, { locale: targetLocale });
          }
        } else {
          localStorage.removeItem('adventure_context');
        }
      }
    },
    [gameLocale, pathname, router]
  );

  const [aiSettings, setAiSettings] = useState<AISettings | null>(null);

  const pdf = usePdfMemory({
    setMessages: (fn) => chat.setMessages(fn),
    adventureId: adventureContext?.id,
  });

  
  
  
  const skillMarking = useSkillMarking(
    charMgmt.activeCharacter,
    charMgmt.handleUpdateCharacter,
    charMgmt.characters,
    charMgmt.handleCharactersChange
  );
  const [showDevelopmentModal, setShowDevelopmentModal] = useState(false);
  const [pendingDirectorEvent, setPendingDirectorEvent] =
    useState<RandomEvent | null>(null);

  
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
    
    addToQueue: tts.addToQueue,
    stopCurrentAudio: tts.stopCurrentAudio,
    adventureContext,
    aiSettings,
    onSkillResults: skillMarking.processSkillResults,
    hotSeatConfig: hotSeat.config,
    pendingDirectorEvent,
    clearPendingDirectorEvent: () => setPendingDirectorEvent(null),
    locale: gameLocale,
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
    currentLocale: gameLocale,
    router,
    pathname,
  });

  
  const [showGMTools, setShowGMTools] = useState(false);
  const [activeGMTool, setActiveGMTool] = useState<string | null>(null);
  const [showHotSeatSetup, setShowHotSeatSetup] = useState(false);
  const [showApiKeysModal, setShowApiKeysModal] = useState(false);
  const [showRulebookModal, setShowRulebookModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showBetaWelcomeModal, setShowBetaWelcomeModal] = useState(false);
  const [showBetaFeedbackModal, setShowBetaFeedbackModal] = useState(false);
  const rulesStatus = useRulesStatus();
  
  const [languageSelectionRequired, setLanguageSelectionRequired] = useState<boolean | null>(null);

  // Beta Welcome Modal: auto-open na starcie po przejściu bramek (Język -> Klucz API -> Podręcznik),
  // jeśli gracz nie zaznaczył "Nie pokazuj ponownie"
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      languageSelectionRequired === false &&
      (hasRequiredKeys() || hasLocalPlaytestTransport()) &&
      !rulesStatus.loading &&
      rulesStatus.hasRules &&
      !showApiKeysModal &&
      !showRulebookModal
    ) {
      const dismissed = localStorage.getItem('straznik_beta_welcome_dismissed');
      if (dismissed !== 'true') {
        setShowBetaWelcomeModal(true);
      }
    }
  }, [
    languageSelectionRequired,
    rulesStatus.loading,
    rulesStatus.hasRules,
    showApiKeysModal,
    showRulebookModal,
  ]);
  const [rulesOnboardingCompleted, setRulesOnboardingCompleted] = useState<boolean | null>(null);
  
  const [pendingNewAdventure, setPendingNewAdventure] = useState(false);

  
  const openSessionZeroRef = useRef<(() => void) | null>(null);
  const openAdventureSelectorRef = useRef<(() => void) | null>(null);

  
  
  
  
  
  
  const [sessionZeroCompleted, setSessionZeroCompleted] = useState(false);
  const [pendingGameStart, setPendingGameStart] = useState(false);

  const customAdventures = useCustomAdventures();
  const resolvedEraContext = adventureContext
    ? resolveGameEraContext({
        gameTime: hasStartedGame ? timeManager.getTime() : null,
        adventure: adventureContext,
      })
    : null;
  const cutsceneManager = useCutscene();
  
  const fullReset = useFullReset();

  

  const { handleSummarizeScene, isSummarizingScene } = useSceneSummary({
    messages: chat.messages,
    activeCharacter: charMgmt.activeCharacter,
    adventureContext: adventureContext?.title,
    setActiveCharacter: charMgmt.setActiveCharacter,
    setCharacters: charMgmt.setCharacters,
    characters: sessionCharacters,
  });

  
  
  
  const handleInvalidKey = useCallback(() => {
    if (
      languageSelectionRequired === false &&
      localStorage.getItem('language_selected') !== null
    ) {
      setShowApiKeysModal(true);
    }
  }, [languageSelectionRequired]);
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
    locale: gameLocale,
  });

  
  
  
  
  
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

  const handleSelectPredefinedCharacter = useCallback(
    (character: Character) => {
      const stamped: Character = {
        ...character,
        id: `${character.id}_${Date.now()}`,
        sourcePresetId: character.sourcePresetId || character.id,
      };

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

      charMgmt.setCharacters(existingCharacters);
      charMgmt.setActiveCharacter(stamped);

      
      void import('@/lib/character-cloud-sync').then(({ persistCharacters }) =>
        persistCharacters(existingCharacters)
      );

      setShowPredefinedSelector(false);
    },
    [charMgmt]
  );

  
  
  
  
  
  const handleStartGameGuarded = useCallback(() => {
    if (!(hasRequiredKeys() || hasLocalPlaytestTransport())) {
      setShowApiKeysModal(true);
      return;
    }
    if (!rulesStatus.hasRules && !hasLocalPlaytestRules()) {
      setShowRulebookModal(true);
      return;
    }
    if (!adventureContext) {
      toast({
        title: locale === 'en' ? 'Select an Adventure' : 'Wybierz scenariusz',
        description:
          locale === 'en'
            ? 'Please select an adventure before starting the game.'
            : 'Przed rozpoczęciem gry musisz wybrać scenariusz przygody.',
        variant: 'destructive',
      });
      return;
    }
    if (hotSeat.config.enabled) {
      const players = hotSeat.config.players;

      
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
          ? t('hotSeatMissingCharacters', { players: missing.join(', ') })
          : t('hotSeatDuplicateCharacter');
        toast({
          title: t('hotSeatNotReady'),
          description,
        variant: 'destructive',
      });
      return;
    }

      
      hotSeat.bindCharactersByPlayerName(charMgmt.characters);
    } else {
      if (!charMgmt.activeCharacter) {
        toast({
          title: locale === 'en' ? 'Select an Investigator' : 'Wybierz badacza',
          description:
            locale === 'en'
              ? 'Please create or select an investigator before starting the game.'
              : 'Przed rozpoczęciem gry musisz wybrać lub stworzyć badacza.',
          variant: 'destructive',
        });
        return;
      }
    }
    handleStartGame();
  }, [hotSeat, charMgmt.characters, charMgmt.activeCharacter, handleStartGame, t, rulesStatus.hasRules, adventureContext, locale]);

  
  
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

  
  
  

  
  useEffect(() => {
    initializeDefaultPrompt(gameLocale).then((initialized) => {
      if (initialized) console.log('✅ Default GM prompt initialized');
    });
  }, [gameLocale]);

  
  
  useEffect(() => {
    if (languageSelectionRequired === false) runHealthCheck();
  }, [languageSelectionRequired, runHealthCheck]);

  
  
  
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
    async (
      adventureId: string,
      characterId: string,
      mode?: 'solo' | 'hot-seat',
      player2CharacterId?: string
    ) => {
      if (!(hasRequiredKeys() || hasLocalPlaytestTransport())) {
        setShowApiKeysModal(true);
        return;
      }
      
      let adv = getAdventureById(adventureId);
      if (adv?.isStrefa11) {
        adv = localizeStrefa11Adventure(adv, locale);
      }

      const allCharacters = adv?.isStrefa11 || adv?.isAmericanColdCase
        ? getStrefa11CharactersForAdventure(adv.id)
        : PREDEFINED_CHARACTERS;
      const foundPreset = allCharacters.find((c) => c.id === characterId);
      const preset = foundPreset
        ? localizeStrefa11Character(foundPreset, locale)
        : undefined;

      if (adv && foundPreset?.startingNodeId) {
        adv = {
          ...adv,
          activeNodeId: foundPreset.startingNodeId,
          ...(foundPreset.openingHook ? { hook: foundPreset.openingHook } : {}),
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
          sourcePresetId: foundPreset?.id,
          isActive: true,
        };
        if (mode === 'hot-seat') {
          stamped.playerName = t('player1Name');
        }
        // Deduplikacja: zastąp wcześniejszy klon tego samego presetu zamiast mnożyć wpisy
        const withoutPreset1 = charMgmt.characters.filter(
          (c) => c.sourcePresetId !== foundPreset?.id && c.id !== foundPreset?.id
        );
        const updatedList = [...withoutPreset1, stamped];

        if (mode === 'hot-seat') {
          
          let preset2 = player2CharacterId
            ? allCharacters.find((c) => c.id === player2CharacterId)
            : undefined;
          if (!preset2) {
            preset2 =
              allCharacters.find((c) => c.gender !== preset.gender) ||
              allCharacters[1];
          }

          if (preset2) {
            const localizedPreset2 = localizeStrefa11Character(preset2, locale);
            const stamped2: Character = {
              ...localizedPreset2,
              ...(targetEra
                ? { equipment: buildPredefinedEquipment(localizedPreset2, targetEra) }
                : {}),
              id: `char_${Date.now() + 1}_${Math.random().toString(36).substr(2, 4)}`,
              sourcePresetId: preset2.id,
              playerName: t('player2Name'),
            };
            const finalWithoutPreset2 = updatedList.filter(
              (c) => c.sourcePresetId !== preset2?.id && c.id !== preset2?.id
            );
            finalWithoutPreset2.push(stamped2);
            charMgmt.setCharacters(finalWithoutPreset2);
            charMgmt.setActiveCharacter(stamped);

            hotSeat.restoreConfig(
              {
                enabled: true,
                players: [
                  {
                    id: `p1_${Date.now()}`,
                    name: t('player1Name'),
                    color: '#4ade80',
                    characterId: stamped.id,
                    isActive: true,
                    turnCount: 0,
                  },
                  {
                    id: `p2_${Date.now()}`,
                    name: t('player2Name'),
                    color: '#f472b6',
                    characterId: stamped2.id,
                    isActive: false,
                    turnCount: 0,
                  },
                ],
                activePlayerIndex: 0,
                allowInterruptions: true,
                showPlayerIndicator: true,
              },
              finalWithoutPreset2
            );
          }
        } else {
          charMgmt.setCharacters(updatedList);
          charMgmt.setActiveCharacter(stamped);
          hotSeat.restoreConfig(
            {
              enabled: false,
              players: [],
              activePlayerIndex: 0,
              allowInterruptions: true,
              showPlayerIndicator: false,
            },
            updatedList
          );
        }

        try {
          const { persistCharacters } = await import('@/lib/character-cloud-sync');
          persistCharacters(updatedList);
        } catch {
          
        }
      }
      setPendingQuickStart(true);
    },
    [charMgmt, hotSeat, handleStartGameGuarded, t, rulesStatus.hasRules]
  );

  const handleApiKeysChange = useCallback(
    (open: boolean) => {
      setShowApiKeysModal(open);
      if (!open && (hasRequiredKeys() || hasLocalPlaytestTransport())) {
        if (!hasLocalPlaytestRules() && (rulesOnboardingCompleted === false || !rulesStatus.hasRules)) {
          setShowRulebookModal(true);
        }
      }
    },
    [rulesOnboardingCompleted, rulesStatus.hasRules]
  );

  const handleRulebookUploaded = useCallback(async () => {
    try {
      localStorage.setItem('rules_onboarding_completed', 'true');
    } catch {}
    setRulesOnboardingCompleted(true);
    await rulesStatus.refresh();
    setShowRulebookModal(false);
  }, [rulesStatus]);

  const handleRulebookChange = useCallback(
    (open: boolean) => {
      setShowRulebookModal(open);
      if (!open && rulesStatus.hasRules) {
        try {
          localStorage.setItem('rules_onboarding_completed', 'true');
        } catch {}
        setRulesOnboardingCompleted(true);
      }
    },
    [rulesStatus.hasRules]
  );

  // Sekwencja pierwszego startu: Język -> Klucz API -> Podręcznik Zasad CoC 7e -> Ekran Główny
  useEffect(() => {
    if (languageSelectionRequired === false && !localTransport.loading) {
      if (!(hasRequiredKeys() || hasLocalPlaytestTransport())) {
        setShowApiKeysModal(true);
      } else if (
        !hasLocalPlaytestRules() && (rulesOnboardingCompleted === false ||
        (!rulesStatus.loading && !rulesStatus.hasRules))
      ) {
        setShowRulebookModal(true);
      }
    }
  }, [
    languageSelectionRequired,
    rulesOnboardingCompleted,
    rulesStatus.loading,
    rulesStatus.hasRules,
    localTransport.loading,
    localTransport.serverConfigured,
    localTransport.serverHasBaseRules,
  ]);

  useEffect(() => {
    setLanguageSelectionRequired(
      localStorage.getItem('language_selected') === null
    );
    setRulesOnboardingCompleted(
      localStorage.getItem('rules_onboarding_completed') === 'true'
    );

    const handleOpenModal = () => setShowApiKeysModal(true);
    const handleOpenRules = () => setShowRulebookModal(true);
    window.addEventListener('open-api-keys-modal', handleOpenModal);
    window.addEventListener('open-rulebook-modal', handleOpenRules);
    return () => {
      window.removeEventListener('open-api-keys-modal', handleOpenModal);
      window.removeEventListener('open-rulebook-modal', handleOpenRules);
    };
  }, []);

  // Issue #733: Auto-synchronizacja języka UI z przywróconą sesją / przygodą / sejfem po restarcie
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let adv: AdventureContext | null = adventureContext;
    if (!adv) {
      try {
        const rawAdv = localStorage.getItem('adventure_context');
        if (rawAdv) adv = JSON.parse(rawAdv) as AdventureContext;
      } catch {}
    }

    const savedLang = localStorage.getItem('language_selected');
    let latestSaveLocale: 'pl' | 'en' | null = null;
    try {
      const saves = FullGameSaveManager.getSavesList();
      if (saves && saves.length > 0 && saves[0].locale) {
        latestSaveLocale = saves[0].locale;
      }
    } catch {}

    const expectedLocale = determineStartupLocale({
      currentLocale: gameLocale,
      adventure: adv,
      savedLanguage: savedLang,
      latestSaveLocale,
    });

    if (expectedLocale !== gameLocale) {
      syncLocaleStorageAndCookie(expectedLocale);
      router.replace(pathname, { locale: expectedLocale });
    } else {
      syncLocaleStorageAndCookie(gameLocale);
    }
  }, [gameLocale, pathname, router, adventureContext]);

  useEffect(() => {
    const handleCustomAdventuresChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{
        deletedIds?: string[];
        deletedFileName?: string | null;
      }>;
      const deletedIds = customEvent.detail?.deletedIds || [];
      if (adventureContext?.id && deletedIds.includes(adventureContext.id)) {
        setAdventureContext(null);
        try {
          localStorage.removeItem('adventure_context');
        } catch {}
      }
    };

    window.addEventListener('custom-adventures-changed', handleCustomAdventuresChanged);
    return () => {
      window.removeEventListener('custom-adventures-changed', handleCustomAdventuresChanged);
    };
  }, [adventureContext?.id]);

  
  
  
  useEffect(() => {
    if (localStorage.getItem('has_started_game') === 'true') {
      setHasStartedGame(true);
    }
    if (localStorage.getItem('session_zero_completed') === 'true') {
      setSessionZeroCompleted(true);
    }
  }, []);

  
  
  
  
  
  
  useEffect(() => {
    if (!hotSeat.config.enabled) return;
    const player = hotSeat.config.players[hotSeat.config.activePlayerIndex];
    if (!player?.characterId) return;
    const target = charMgmt.characters.find((c) => c.id === player.characterId);
    if (target && target.id !== charMgmt.activeCharacter?.id) {
      charMgmt.setActiveCharacter(target);
    }
    
  }, [
    hotSeat.config,
    charMgmt.characters,
    charMgmt.activeCharacter,
    charMgmt.setActiveCharacter,
  ]);

  
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
        const chars = JSON.parse(savedChars) as Character[];
        charMgmt.setCharacters(chars);
        const activeChar =
          chars.find((c) => c.isActive) ||
          (chars.length > 0 ? chars[chars.length - 1] : null);
        if (activeChar) charMgmt.setActiveCharacter(activeChar);

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

  
  useEffect(() => {
    const settings = loadAISettings();
    setAiSettings(settings);
    setVoiceFeatureAvailable(true);
    
    const ttsEnabled = settings.voiceSettings?.enabled !== false;
    tts.setVoiceEnabled(ttsEnabled);
    tts.setIsTTSEnabled(ttsEnabled);
  }, []);

  
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

  
  
  
  const handleToggleNarrator = (enabled: boolean) => {
    saveAISettings(withVoiceEnabled(aiSettings ?? loadAISettings(), enabled));
  };

  
  
  
  const handleNewAdventure = () => {
    chat.stopGeneration();
    chat.setMessages([]);
    chat.setActiveChaseState(null);
    chat.resetSessionEndState();
    localStorage.removeItem('chat-messages');
    tts.stopCurrentAudio();
    
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
    
    hotSeat.disableHotSeat();
    resetActiveAdventure(localStorage);
    // Reload disposes every hook/ref, pending voice queue and old campaign callback.
    window.location.reload();
  };

  
  
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
          onOpenHelp={() => setShowHelpModal(true)}
          onOpenBetaStatus={() => setShowBetaWelcomeModal(true)}
          onOpenBetaFeedback={() => setShowBetaFeedbackModal(true)}
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
          isTTSPlaying={Boolean(tts.currentAudio && !tts.isAudioPaused)}
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
          onAdventureSelect={handleAdventureSelect}
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
                      locale: gameLocale,
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

          {showGMTools && activeGMTool && resolvedEraContext && (
            <GMToolsModal
              tool={activeGMTool}
              onClose={() => {
                setShowGMTools(false);
                setActiveGMTool(null);
              }}
              activeCharacter={charMgmt.activeCharacter}
              currentLocation={chat.currentLocation}
              sessionId={charMgmt.activeGameState?.session?.id}
              eraContext={resolvedEraContext}
              onEventGenerated={(event) => {
                setPendingDirectorEvent(event);
                toast({
                  title: t('eventBufferedTitle'),
                  description: t('eventBufferedDescription'),
                });
                setShowGMTools(false);
                setActiveGMTool(null);
              }}
            />
          )}

          {languageSelectionRequired === false && (
            <>
              <ApiKeysModal
                open={showApiKeysModal}
                onOpenChange={handleApiKeysChange}
              />
              <RulebookModal
                open={showRulebookModal}
                onOpenChange={handleRulebookChange}
                gated={!rulesStatus.hasRules}
                onUploaded={handleRulebookUploaded}
                rulesCount={rulesStatus.rulesCount}
              />
              <CompendiumModal
                isOpen={showHelpModal}
                onClose={() => setShowHelpModal(false)}
              />
              <BetaWelcomeModal
                open={showBetaWelcomeModal}
                onOpenChange={setShowBetaWelcomeModal}
                onOpenFeedback={() => {
                  setShowBetaWelcomeModal(false);
                  setShowBetaFeedbackModal(true);
                }}
              />
              <BetaFeedbackModal
                open={showBetaFeedbackModal}
                onOpenChange={setShowBetaFeedbackModal}
                scenarioTitle={adventureContext?.title}
                characterName={charMgmt.activeCharacter?.name}
                eraLabel={adventureContext?.eraLabel}
                messageCount={chat.messages.length}
              />
            </>
          )}

          {}
          <LanguageSelectionModal
            open={languageSelectionRequired === true}
            onSelected={() => setLanguageSelectionRequired(false)}
          />

          {}
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

          {}

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
      {languageSelectionRequired !== false ? (
        <div className="flex-1 w-full h-full bg-background relative z-10" />
      ) : (
        <ChatWindow
          messages={chat.messages}
          newMessage={chat.newMessage}
          setNewMessage={chat.setNewMessage}
          handleSendMessage={chat.handleSendMessage}
          onContinueNarration={chat.handleContinueNarration}
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
          onUploadRules={() => setShowRulebookModal(true)}
          onOpenHelp={() => setShowHelpModal(true)}
          onOpenBetaStatus={() => setShowBetaWelcomeModal(true)}
          onOpenBetaFeedback={() => setShowBetaFeedbackModal(true)}
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
          hasRules={rulesStatus.hasRules || (localTransport.serverConfigured && localTransport.serverHasBaseRules)}
          hasSessionZero={sessionZeroCompleted}
          hasStartedGame={hasStartedGame}
          onOpenApiKeys={() => setShowApiKeysModal(true)}
          quoteActive={
            languageSelectionRequired === false &&
            !showApiKeysModal &&
            !showRulebookModal &&
            !showBetaWelcomeModal &&
            !showHelpModal &&
            !showBetaFeedbackModal &&
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
      )}
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
          eraContext={resolvedEraContext}
        />
      )}
    </ChatLayout>
  );
}
