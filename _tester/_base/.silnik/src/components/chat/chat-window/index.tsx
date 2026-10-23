'use client';

/**
 * @file ChatWindow - orchestrator głównego widoku czatu (IND-144 Wariant C, sesja 131).
 *
 * Implementacja po splicie 438→<20 lin (barrel re-export w ChatWindow.tsx).
 * Composition 5 sub-komponentów z `./components/` + 1 hook + state lightbox.
 *
 * Sesja 132 (D9 follow-up): drop 11 dead propsów - patrz `./types.ts`.
 */

import type { FC } from 'react';
import { useRef, useEffect, useMemo, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ScrollArea } from '../../ui/scroll-area';
import { ImageLightbox } from '../../ui/image-lightbox';
import { RollTestModal, type RollTestData } from '../../dialogs/RollTestModal';
import { WelcomeScreen } from '../WelcomeScreen';
import type { ChatWindowProps } from './types';
import type { SkillTestData, SkillRollResolution } from '@/lib/parsers/types';
import { usePlayerColors } from './hooks/use-player-colors';
import { useResolvedPortrait } from '@/hooks/useResolvedPortrait';
import {
  collectTestGroupResult,
  type CollectedTestResult,
} from '@/lib/hot-seat/test-groups';
import { ChatHeader } from './components/chat-header';
import { ChaseHeaderTracker } from './components/chase-header-tracker';
import { LoadingIndicator } from './components/loading-indicator';
import { MessageCard } from './components/message-card';
import { MessageInput } from './components/message-input';
import { TTSHardLoadingScreen } from './components/tts-hard-loading-screen';
import { CombatDexRibbon } from '@/components/combat/CombatDexRibbon';
import { getSkillValue } from '@/lib/types';
import { resolveTestValue } from '@/lib/skill-test-resolver';
import { loadCampaignMemoryScope } from '@/core/memory/campaign-scope';
import { completedSkillTestsFromHistory } from './utils/completed-skill-tests';

export const ChatWindow: FC<ChatWindowProps> = ({
  messages,
  newMessage,
  setNewMessage,
  handleSendMessage,
  dossierProtocolFailure,
  pendingDossierSkillRollRetry,
  retryDossierSkillRoll,
  pendingCombatAttack,
  pendingCombatDefensesUsed = 0,
  combatDefenseWeapons = [],
  onCombatDefense,
  currentAudio,
  stopCurrentAudio,
  toggleAudioPause,
  isAudioPaused = false,
  isTTSEnabled,
  activeCharacter,
  characters = [],
  onJournalRoll,
  onSpendLuck,
  onUploadRules,
  onSelectAdventure,
  onSessionZero,
  onCreateCharacter,
  onPickCharacter,
  onStartGame,
  onChoosePlayMode,
  onQuickStart,
  onLoadSave,
  onOpenApiKeys,
  onOpenHelp,
  onOpenBetaStatus,
  onOpenBetaFeedback,
  onColdStart,
  onPickPredefinedCharacter, // NOWE: gotowa postać
  hasRules = false,
  hasAdventure = false,
  adventureTitle,
  region,
  currentLocation,
  hasSessionZero = false,
  hasStartedGame = false,
  hotSeatConfig,
  onSwitchPlayer,
  onDisableHotSeat,
  isLoading = false,
  onStopGeneration,
  isInitialBuffering = false,
  isStarting = false,
  startProgress = 0,
  startStatus = '',
  isReadyToEnter = false,
  onConfirmEnterGame,
  adventureContext,
  adventureDescription,
  startError,
  onRetryStartGame,
  onCancelStartGame,
  isDuet = false,
  pendingDeclarations,
  playersAwaitingDeclaration,
  onAddDeclaration,
  onPassDeclaration,
  currentPlayerName,
  isTurnReady,
  onSendTurn,
  onOpenCharacterSheet,
  onConfirmAcquiredItem,
  onDismissAcquiredItem,
  isSessionEnded,
  sessionEndStatus,
  sessionSaveStatus,
  onRetrySessionSave,
  onCharacterUpdate,
  onContinueNarration,
  cheatCombatModal,
  onCloseCheatCombat,
  cheatChaseModal,
  onCloseCheatChase,
  activeChaseState,
  onChaseStateChange,
  quoteActive,

  eraContext,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const skillRollRetryInFlightRef = useRef(false);
  const [isRetryingSkillRoll, setIsRetryingSkillRoll] = useState(false);
  const retrySavedSkillRoll = async () => {
    if (!pendingDossierSkillRollRetry || !retryDossierSkillRoll || isLoading || skillRollRetryInFlightRef.current) return;
    skillRollRetryInFlightRef.current = true;
    setIsRetryingSkillRoll(true);
    try { await retryDossierSkillRoll(); }
    finally {
      skillRollRetryInFlightRef.current = false;
      setIsRetryingSkillRoll(false);
    }
  };

  // Tryb reżyserski (Kulisy MG / BOP) - domyślnie wyłączony z zapamiętywaniem w localStorage
  const [isDirectorMode, setIsDirectorMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('straznik_director_mode') === 'true';
    } catch {
      return false;
    }
  });

  const toggleDirectorMode = () => {
    setIsDirectorMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('straznik_director_mode', String(next));
        window.dispatchEvent(new CustomEvent('director-mode-changed', { detail: { isDirectorMode: next } }));
      } catch {
        // ignore localStorage errors (e.g. Safari private mode)
      }
      return next;
    });
  };

  useEffect(() => {
    const handleDirectorModeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ isDirectorMode?: boolean }>;
      if (typeof customEvent.detail?.isDirectorMode === 'boolean') {
        setIsDirectorMode(customEvent.detail.isDirectorMode);
      } else {
        try {
          setIsDirectorMode(localStorage.getItem('straznik_director_mode') === 'true');
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('director-mode-changed', handleDirectorModeChange);
    return () => window.removeEventListener('director-mode-changed', handleDirectorModeChange);
  }, []);

  // Inteligentny autoscroll
  const [isAtBottom, setIsAtBottom] = useState<boolean>(true);
  const isAtBottomRef = useRef<boolean>(true);

  const handleViewportScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const distanceToBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight;
    // Tolerancja 120px dla uznania, że gracz jest na dole
    const atBottom = distanceToBottom <= 120;
    setIsAtBottom(atBottom);
    isAtBottomRef.current = atBottom;
  };

  const scrollToBottom = (smooth = true) => {
    if (typeof viewportRef.current?.scrollTo === 'function') {
      viewportRef.current.scrollTo({
        top: viewportRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    } else {
      messagesEndRef.current?.scrollIntoView?.({
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
    setIsAtBottom(true);
    isAtBottomRef.current = true;
  };

  // Lightbox state
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);

  // D1: tacka testu sterowana WYŁĄCZNIE tagiem [TEST:] - "Rzuć" otwiera mały modal
  // RollTestModal (podsumowanie → animacja → wynik do czatu + dziennika).
  // Trudność (½/⅕) i bilans kości premii/kary egzekwuje silnik dice-utils.
  const [activeSkillTest, setActiveSkillTest] = useState<SkillTestData | null>(
    null
  );
  const rollScope = loadCampaignMemoryScope();
  const rollScopeKey = JSON.stringify([rollScope?.playthroughId ?? null, rollScope?.adventureId ?? adventureContext?.id ?? null]);
  const [localCompletedTests, setLocalCompletedTests] = useState<{scopeKey:string;tests:Map<string,SkillTestData>}>(
    () => ({scopeKey:rollScopeKey,tests:new Map()})
  );
  const completedTestIds = completedSkillTestsFromHistory(messages, rollScope);
  if (localCompletedTests.scopeKey === rollScopeKey) {
    for (const [id, sourceTest] of localCompletedTests.tests) {
      if (messages.some(message => message.skillTests?.includes(sourceTest))) completedTestIds.add(id);
    }
  }
  for (const id of pendingDossierSkillRollRetry?.testIds ?? []) completedTestIds.add(id);
  const activeRollScopeRef = useRef(rollScopeKey);

  const combatRoundAttacks = pendingCombatAttack
    ? messages.flatMap((message) => message.pendingMeleeAttacks ?? []).filter(
        (attack) => attack.roundId === pendingCombatAttack.roundId
      )
    : [];
  const groupResultsRef = useRef(new Map<string, CollectedTestResult[]>());
  useEffect(() => {
    setActiveSkillTest(null);
    groupResultsRef.current.clear();
  }, [rollScopeKey]);

  const resolvedHazardIds = useMemo(() => {
    const ids = new Set<string>();
    const pattern = /\[WYNIK_ZAGROŻENIA:\s*id=([^|\]]+)/gi;
    for (const message of messages) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(message.content)) !== null)
        ids.add(match[1].trim());
      pattern.lastIndex = 0;
    }
    return ids;
  }, [messages]);
  const resolvedSpellIds = useMemo(() => {
    const ids = new Set<string>();
    const pattern = /\[WYNIK_CZARU:\s*id=([^|\]]+)/gi;
    for (const message of messages) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(message.content)) !== null)
        ids.add(match[1].trim());
      pattern.lastIndex = 0;
    }
    return ids;
  }, [messages]);
  const resolvedTomeIds = useMemo(() => {
    const ids = new Set<string>();
    const pattern = /\[WYNIK_TOMU:\s*id=([^|\]]+)/gi;
    for (const message of messages) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(message.content)) !== null)
        ids.add(match[1].trim());
      pattern.lastIndex = 0;
    }
    return ids;
  }, [messages]);
  const resolvedCombatIds = useMemo(() => {
    const ids = new Set<string>();
    const pattern = /\[WYNIK_WALKI:\s*id=([^|\]]+)/gi;
    for (const message of messages) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(message.content)) !== null)
        ids.add(match[1].trim());
      pattern.lastIndex = 0;
    }
    return ids;
  }, [messages]);

  const diceTest: RollTestData | null = useMemo(
    () =>
      activeSkillTest
        ? {
            testId: activeSkillTest.id,
            groupId: activeSkillTest.groupId,
            characterId: activeSkillTest.characterId,
            targetNpcId: activeSkillTest.targetNpcId,
            isCombat: activeSkillTest.isCombat,
            skill: activeSkillTest.skillName,
            value: activeSkillTest.skillValue,
            difficulty: activeSkillTest.difficulty,
            bonusDice: activeSkillTest.modifiers.reduce(
              (balance, mod) =>
                balance + (mod.type === 'bonus' ? mod.count : -mod.count),
              0
            ),
            justification: activeSkillTest.justification,
            combined: activeSkillTest.combined,
          }
        : null,
    [activeSkillTest]
  );

  const handleRollTest = (test: SkillTestData) => {
    if (pendingDossierSkillRollRetry || completedTestIds.has(test.id)) return;
    activeRollScopeRef.current = rollScopeKey;
    setActiveSkillTest(test);
  };

  const handleRollResult = (
    chatMessage: string,
    systemContext: string,
    mechanicsContext?: { skillRolls: SkillRollResolution[] },
  ) => {
    if (!activeSkillTest || activeRollScopeRef.current !== rollScopeKey || completedTestIds.has(activeSkillTest.id)) return;
    const result: CollectedTestResult = {
      testId: activeSkillTest.id,
      chatMessage,
      systemContext,
      skillRolls: mechanicsContext?.skillRolls,
    };
    const sourceTest = messages.flatMap(message => message.role === 'assistant' ? message.skillTests ?? [] : [])
      .find(test => test.id === activeSkillTest.id);
    if (sourceTest) setLocalCompletedTests(current => ({scopeKey:rollScopeKey,
      tests:new Map([...(current.scopeKey === rollScopeKey ? current.tests : []),[activeSkillTest.id,sourceTest]])}));

    if (!activeSkillTest.groupId) {
      handleSendMessage(chatMessage, mechanicsContext);
      return;
    }

    const groupTests = messages
      .flatMap((message) => message.skillTests ?? [])
      .filter((test) => test.groupId === activeSkillTest.groupId);
    const currentResults =
      groupResultsRef.current.get(activeSkillTest.groupId) ?? [];
    const progress = collectTestGroupResult(
      groupTests as SkillTestData[],
      currentResults,
      result
    );
    groupResultsRef.current.set(activeSkillTest.groupId, progress.results);

    // Pierwszy wynik zostaje wyłącznie lokalnie. Drugiego nie ścigamy osobnym
    // requestem - dopiero komplet trafia do MG jako jedna wiadomość.
    if (progress.complete && progress.combinedMessage) {
      groupResultsRef.current.delete(activeSkillTest.groupId);
      const skillRolls = progress.results.flatMap((item) => item.skillRolls ?? []);
      handleSendMessage(
        progress.combinedMessage,
        skillRolls.length > 0 ? { skillRolls } : undefined,
      );
    }
  };

  // Mapa kolorów graczy dla Hot Seat (imię postaci -> kolor)
  const playerColors = usePlayerColors(hotSeatConfig, characters);

  // Portret gracza dla awatarów wiadomości - dociągany z IndexedDB gdy portraitUrl
  // pusty (wyścig hydratacji). Liczony RAZ tu, nie per-wiadomość. Patrz #2b.
  const playerPortraitUrl = useResolvedPortrait(activeCharacter);

  const duetCharacterSlots = hotSeatConfig?.enabled
    ? hotSeatConfig.players.map((player) => {
        const character = characters.find(
          (candidate) =>
            candidate.id === player.characterId ||
            candidate.playerName === player.name
        );
        return {
          playerId: player.id,
          playerName: player.name,
          character: character
            ? {
                id: character.id,
                name: character.name,
                occupation: character.occupation,
                portraitUrl: character.portraitUrl,
              }
            : undefined,
        };
      })
    : [];
  const duetReady =
    duetCharacterSlots.length === 2 &&
    duetCharacterSlots.every((slot) => slot.character) &&
    new Set(duetCharacterSlots.map((slot) => slot.character?.id)).size === 2;

  const tChatHeader = useTranslations('ChatHeader');
  const tMessageInput = useTranslations('MessageInput');
  const recoveryWouldOverwrite = Boolean(newMessage.trim() && newMessage !== dossierProtocolFailure?.declaration);

  // Auto-scroll do dołu czatu: tylko gdy użytkownik nie przewinął w górę
  useEffect(() => {
    if (isAtBottomRef.current) {
      if (typeof viewportRef.current?.scrollTo === 'function') {
        viewportRef.current.scrollTo({
          top: viewportRef.current.scrollHeight,
          behavior: 'auto',
        });
      } else {
        messagesEndRef.current?.scrollIntoView?.({ behavior: 'auto' });
      }
    }
  }, [messages, isLoading]);

  return (
    <div className="relative flex-1 flex flex-col h-full bg-background bg-[radial-gradient(1200px_700px_at_50%_0%,rgba(20,184,166,0.06),transparent_55%),radial-gradient(600px_400px_at_100%_100%,rgba(201,169,74,0.04),transparent_60%)]">
      <TTSHardLoadingScreen
        isBuffering={isInitialBuffering}
        isStarting={isStarting}
        isReadyToEnter={isReadyToEnter}
        startProgress={startProgress}
        startStatus={startStatus}
        onConfirmEnterGame={onConfirmEnterGame}
        adventureTitle={adventureTitle}
        adventureDescription={adventureDescription}
        region={region}
        eraContext={eraContext}
        adventureContext={adventureContext}
        activeCharacter={activeCharacter}
        characters={characters}
        startError={startError}
        onRetry={onRetryStartGame}
        onCancel={onCancelStartGame}
      />
      <ChatHeader
        title={adventureTitle}
        region={region}
        currentLocation={currentLocation}
        isLocationExhausted={activeCharacter?.activeScene?.isLocationExhausted}
      />
      {activeChaseState && activeChaseState.status === 'ongoing' && (
        <ChaseHeaderTracker chaseState={activeChaseState} />
      )}
      {!hasStartedGame ? (
        <div className="flex-1 w-full h-full min-h-0 relative overflow-hidden">
          <WelcomeScreen
            onUploadRules={onUploadRules || (() => {})}
            onSelectAdventure={onSelectAdventure || (() => {})}
            onSessionZero={onSessionZero}
            onCreateCharacter={onCreateCharacter || (() => {})}
            onPickPredefinedCharacter={onPickPredefinedCharacter}
            onPickCharacter={onPickCharacter}
            onStartGame={onStartGame || (() => {})}
            onQuickStart={onQuickStart}
            onChoosePlayMode={onChoosePlayMode}
            onLoadSave={onLoadSave}
            onOpenApiKeys={onOpenApiKeys}
            onOpenHelp={onOpenHelp}
            onOpenBetaStatus={onOpenBetaStatus}
            onOpenBetaFeedback={onOpenBetaFeedback}
            onColdStart={onColdStart}
            hasRules={hasRules}
            hasAdventure={hasAdventure}
            adventureTitle={adventureTitle}
            hasSessionZero={hasSessionZero}
            hasCharacter={
              hotSeatConfig?.enabled ? duetReady : !!activeCharacter
            }
            activeCharacter={activeCharacter}
            hasSavedCharacters={characters.length > 0}
            isDuet={!!hotSeatConfig?.enabled}
            duetCharacterSlots={duetCharacterSlots}
            onOpenCharacterSheet={onOpenCharacterSheet}
            characters={characters}
            isStarting={isStarting}
            startProgress={startProgress}
            startStatus={startStatus}
            quoteActive={quoteActive}
          />
        </div>
      ) : (
        <>
          <CombatDexRibbon
            combatActive={Boolean(pendingCombatAttack) || undefined}
            messages={messages}
            activeCharacter={activeCharacter}
            characters={characters}
            pendingCombatAttack={pendingCombatAttack}
          />
          {/* Chat Messages */}
          <div className="relative flex-1 min-h-0">
            <ScrollArea
              className="h-full w-full p-4 md:p-8"
              viewportRef={viewportRef}
              onViewportScroll={handleViewportScroll}
            >
              <div className="space-y-4 max-w-4xl mx-auto w-full">
                {messages.map((message, index) =>
                  message.role === 'user' && message.mechanicsContext?.combat ? null : (
                  <MessageCard
                    key={message.id}
                    message={message}
                    adventureContext={adventureContext}
                    activeCharacter={activeCharacter}
                    playerPortraitUrl={playerPortraitUrl}
                    era={eraContext?.effectiveYear ? String(eraContext.effectiveYear) : (activeCharacter?.era || '1920s')}
                    isTTSEnabled={isTTSEnabled}
                    currentAudio={currentAudio}
                    toggleAudioPause={toggleAudioPause}
                    isAudioPaused={isAudioPaused}
                    stopCurrentAudio={stopCurrentAudio}
                    playerColors={playerColors}
                    completedTestIds={completedTestIds}
                    onImageClick={(imgUrl, allImages) => {
                      setLightboxImages(allImages);
                      setLightboxImage(imgUrl);
                    }}
                    onRollTest={handleRollTest}
                    onConfirmAcquiredItem={onConfirmAcquiredItem}
                    onDismissAcquiredItem={onDismissAcquiredItem}
                    isSessionEnded={isSessionEnded}
                    sessionSaveStatus={sessionSaveStatus}
                    onRetrySessionSave={onRetrySessionSave}
                    isLastMessage={index === messages.length - 1}
                    onCharacterUpdate={onCharacterUpdate}
                    onSendHazardResult={handleSendMessage}
                    resolvedHazardIds={resolvedHazardIds}
                    onSendSpellResult={handleSendMessage}
                    resolvedSpellIds={resolvedSpellIds}
                    onSendTomeResult={handleSendMessage}
                    resolvedTomeIds={resolvedTomeIds}
                    onSendCombatResult={handleSendMessage}
                    resolvedCombatIds={resolvedCombatIds}
                    onCombatDefense={onCombatDefense}
                    onChaseManeuver={(maneuverType, nextState, decl) => {
                      onChaseStateChange?.(nextState);
                      handleSendMessage(decl, { chase: nextState });
                    }}
                    isDuet={isDuet}
                    characters={characters}
                    onContinueNarration={onContinueNarration}
                    isDirectorMode={isDirectorMode}
                  />
                ))}
                {/* Loading indicator - animowane kropki */}
                {isLoading && <LoadingIndicator />}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Pływający przycisk przewijania na dół gdy gracz przegląda wcześniejsze wiadomości */}
            {!isAtBottom && (
              <button
                type="button"
                onClick={() => scrollToBottom(true)}
                className="absolute bottom-4 right-6 z-20 flex items-center gap-1.5 px-3 py-1.5 text-xs font-special-elite bg-card/95 border border-brass/60 text-brass hover:text-gold hover:border-brass rounded-full shadow-lg backdrop-blur transition-all duration-200 cursor-pointer animate-fade-in"
                title={tChatHeader('scrollToBottom')}
              >
                <ChevronDown className="w-3.5 h-3.5 text-brass" />
                <span>{tChatHeader('scrollToBottom')}</span>
              </button>
            )}
          </div>
          {/* Pasek wpisywania tylko w grze - ekran powitalny ma być czysty ("tylko ekran powitalny") */}
          {dossierProtocolFailure?.code === 'DOSSIER_PROTOCOL_REJECTED' && (
            <div role="alert" className="mx-4 my-2 border border-brass/50 bg-card px-4 py-3 text-foreground">
              <p className="font-special-elite font-semibold text-brass">{tMessageInput('dossierProtocolFailureTitle')}</p>
              <p className="mt-1 text-sm">{tMessageInput('dossierProtocolFailureDescription')}</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">{dossierProtocolFailure.declaration}</p>
              <button type="button"
                disabled={isLoading || Boolean(pendingDossierSkillRollRetry) || recoveryWouldOverwrite}
                onClick={() => setNewMessage(dossierProtocolFailure.declaration)}
                className="mt-3 min-h-[44px] border border-brass/50 px-4 text-sm text-brass hover:bg-brass/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50">
                {tMessageInput('restoreDeclaration')}
              </button>
              {recoveryWouldOverwrite && <p className="mt-1 text-sm text-muted-foreground">{tMessageInput('restoreDeclarationOccupied')}</p>}
            </div>
          )}
          {pendingDossierSkillRollRetry && (
            <div role="alert" className="mx-4 my-2 border border-brass/50 bg-card px-4 py-3 text-foreground">
              <p className="text-sm font-special-elite text-brass">{tMessageInput('dossierSkillRollRetryDescription')}</p>
              <button type="button"
                disabled={isLoading || isRetryingSkillRoll || !retryDossierSkillRoll}
                onClick={() => { void retrySavedSkillRoll(); }}
                className="mt-3 min-h-[44px] border border-brass/50 px-4 text-sm text-brass hover:bg-brass/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50">
                {tMessageInput('retryDossierSkillRoll')}
              </button>
            </div>
          )}
          <fieldset disabled={Boolean(pendingDossierSkillRollRetry)} className="m-0 min-w-0 border-0 p-0">
          <MessageInput
            newMessage={newMessage}
            setNewMessage={setNewMessage}
            handleSendMessage={handleSendMessage}
            messagesCount={messages.length}
            isDuet={isDuet}
            pendingDeclarations={pendingDeclarations}
            playersAwaitingDeclaration={playersAwaitingDeclaration}
            onAddDeclaration={onAddDeclaration}
            onPassDeclaration={onPassDeclaration}
            currentPlayerName={currentPlayerName}
            isTurnReady={isTurnReady}
            onSendTurn={onSendTurn}
            isLoading={isLoading}
            onStopGeneration={onStopGeneration}
            onSwitchPlayer={onSwitchPlayer}
            onDisableHotSeat={onDisableHotSeat}
            hotSeatPlayers={hotSeatConfig?.players?.map((p, i) => ({
              id: p.id,
              name: p.name,
              index: i,
            }))}
            isSessionEnded={isSessionEnded}
            sessionEndStatus={sessionEndStatus}
            eraContext={eraContext}
          />
          </fieldset>
        </>
      )}
      {/* Image Lightbox */}
      {lightboxImage && (
        <ImageLightbox
          src={lightboxImage}
          images={lightboxImages}
          onClose={() => setLightboxImage(null)}
        />
      )}
      {/* D1: tacka testu ([TEST:]) odpala mały modal - rzut, ew. Szczęście, ręczna wysyłka */}
      <RollTestModal
        open={!!diceTest}
        onOpenChange={(open) => {
          if (!open) setActiveSkillTest(null);
        }}
        test={diceTest}
        activeCharacter={
          characters.find(
            (character) => character.id === activeSkillTest?.characterId
          ) ??
          activeCharacter ??
          undefined
        }
        onRollSendToChat={handleRollResult}
        onJournalRoll={onJournalRoll}
        onSpendLuck={onSpendLuck}
      />
    </div>
  );
};
