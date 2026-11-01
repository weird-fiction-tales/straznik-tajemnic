'use client';

import { SafeImage } from '@/components/ui/safe-image';
/**
 * @file MessageCard - 1 wiadomość czatu z Avatar + TTS controls + Body + Images (IND-144 Wariant C, sesja 131).
 *
 * Extracted z ChatWindow.tsx (Card per message ~122 lin) jako micro 6/8 HOT.
 * Największy sub-moduł Wariantu C - TTS coupling + image onClick callback +
 * NarrativeFormatter integration + cleanMarkdown vs NarrativeFormatter branch
 * per role.
 *
 * Image onClick: propaguje przez callback `onImageClick(imgUrl, allImages)` -
 * parent (orchestrator) zarządza state lightbox.
 */

import { Dices, Loader2, Pause, Play, RefreshCw, Square } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '../../../ui/button';
import { Card, CardContent } from '../../../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../../../ui/avatar';
import { NarrativeFormatter } from '../../NarrativeFormatter';
import { SkillTestCard } from './skill-test-card';
import { DiceRollCard } from './dice-roll-card';
import { HazardCard } from './hazard-card';
import { extractHazardEvents } from '@/lib/parsers/mechanics-parser';
import { SpellCard } from './spell-card';
import { TomeCard } from './tome-card';
import { OpposedMagicCard } from './opposed-magic-card';
import { AcquiredItemCard } from './acquired-item-card';
import { DreamCard } from './dream-card';
import { StatChangeCard } from './stat-change-card';
import { DevelopmentPhaseCard } from './DevelopmentPhaseCard';
import { cleanMarkdown } from '@/lib/utils';
import { getEraImageFilter } from '@/lib/era-visual-style';
import { ChaseCard } from './chase-card';
import { CombatCard } from './combat-card';
import { OpposedMeleeCard } from './opposed-melee-card';
import { FirearmsCard } from './firearms-card';
import { GameOverCard } from './game-over-card';
import { RefereeVetoCard } from './referee-veto-card';
import type { Character, Message } from '@/lib/types';
import type { AnyAdventureContext } from '@/lib/handout-resolver';
import type { ChaseManeuverType, ChaseState } from '@/lib/chase/chase-engine';
import type { PendingMeleeAttack, DefenseChoice, ManeuverType } from '@/lib/combat/combat-resolver';
import type { CombatDefenseWeaponOption } from '@/lib/combat/weapon-context';
import type { SkillTestData } from '@/lib/parsers/types';
import {
  getMessageStyle,
  getAuthorColor,
  getAuthorName,
  getAuthorInitials,
} from '../utils/message-helpers';

interface MessageCardProps {
  message: Message;
  adventureContext?: AnyAdventureContext | null;
  activeCharacter: Character | null;
  /** Portret gracza dociągnięty przez useResolvedPortrait (fallback z IndexedDB
   *  gdy activeCharacter.portraitUrl pusty). Liczony raz w ChatWindow. */
  playerPortraitUrl?: string | null;
  era?: string;
  isTTSEnabled: boolean;
  currentAudio: HTMLAudioElement | null;
  toggleAudioPause?: () => void;
  isAudioPaused?: boolean;
  stopCurrentAudio: () => void;
  playerColors: Map<string, string>;
  onImageClick: (imgUrl: string, allImages: string[]) => void;
  onRollTest?: (test: SkillTestData) => void;
  completedTestIds?: ReadonlySet<string>;
  onConfirmAcquiredItem?: (messageId: string, proposalId: string, characterId?: string) => void;
  onDismissAcquiredItem?: (messageId: string, proposalId: string) => void;
  isSessionEnded?: boolean;
  isLastMessage?: boolean;
  onCharacterUpdate?: (char: Character) => void;
  onSendHazardResult?: (message: string) => void;
  resolvedHazardIds?: ReadonlySet<string>;
  onSendSpellResult?: (message: string) => void;
  resolvedSpellIds?: ReadonlySet<string>;
  onSendTomeResult?: (message: string) => void;
  resolvedTomeIds?: ReadonlySet<string>;
  onSendOpposedMagicResult?: (message: string) => void;
  resolvedOpposedMagicIds?: ReadonlySet<string>;
  onSendCombatResult?: (message: string) => void;
  resolvedCombatIds?: ReadonlySet<string>;
  onCombatDefense?: (
    attack: PendingMeleeAttack,
    choice: DefenseChoice,
    weapon?: CombatDefenseWeaponOption,
    maneuverType?: ManeuverType
  ) => void;
  onChaseManeuver?: (
    maneuverType: ChaseManeuverType,
    chaseState: ChaseState,
    narrativeDeclaration: string
  ) => void;
  /** Kontynuacja uciętej narracji (MAX_TOKENS) - deklaruje caller; pole
   *  opcjonalne dla zgodności z testami i chat-window types. */
  onContinueNarration?: (messageId?: string) => void;
  isDuet?: boolean;
  characters?: Character[];
  isDirectorMode?: boolean;
  sessionSaveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  onRetrySessionSave?: () => void;
}

export function MessageCard({
  message,
  activeCharacter,
  playerPortraitUrl,
  era,
  isTTSEnabled,
  currentAudio,
  toggleAudioPause,
  isAudioPaused = false,
  stopCurrentAudio,
  playerColors,
  onImageClick,
  onRollTest,
  completedTestIds,
  onConfirmAcquiredItem,
  onDismissAcquiredItem,
  isSessionEnded = false,
  isLastMessage = false,
  onCharacterUpdate,
  onSendHazardResult,
  resolvedHazardIds,
  onSendSpellResult,
  resolvedSpellIds,
  onSendTomeResult,
  resolvedTomeIds,
  onSendOpposedMagicResult,
  resolvedOpposedMagicIds,
  onSendCombatResult,
  resolvedCombatIds,
  onCombatDefense,
  onChaseManeuver,
  onContinueNarration,
  isDuet = false,
  characters = [],
  isDirectorMode = false,
  sessionSaveStatus = 'idle',
  onRetrySessionSave,
  adventureContext,
}: MessageCardProps) {
  const t = useTranslations('MessageCard');
  const locale = useLocale();
  const intlLocale = locale === 'en' ? 'en-US' : 'pl-PL';
  const currentEra = era || activeCharacter?.era || '1920s';
  // Older saves may contain the former 0 m -> 3 m parser fallback. Keep event
  // IDs and completed results, but never offer damage unsupported by its source.
  const sourceHazards = /\[(?:ZAGROŻENIE|ZAGROZENIE|HAZARD):/i.test(message.content)
    ? extractHazardEvents(message.content) : null;
  const hazardEvents = message.hazardEvents?.filter(event => event.type !== 'falling' || sourceHazards === null ||
    sourceHazards.some(source => source.type === 'falling' && source.fallHeightMeters === event.fallHeightMeters &&
      source.characterName === event.characterName && source.description === event.description));


  return (
    <Card
      className={`${getMessageStyle(message.role)} relative overflow-hidden`}
    >
      <CardContent className="py-3 overflow-hidden">
        <div className="flex items-start gap-3">
          <Avatar className="w-12 h-16 rounded-sm border border-brass/40 shadow-md shrink-0 mt-0.5">
            {message.role === 'assistant' ? (
              /* MG - ikona kostki K10 */
              <AvatarFallback className="bg-primary/15 text-primary border border-primary/50 rounded-none w-full h-full">
                <Dices className="w-5 h-5" />
              </AvatarFallback>
            ) : (
              /* Gracz - portret postaci retro prostokątny. */
              <>
                {(playerPortraitUrl ?? activeCharacter?.portraitUrl) && (
                  <AvatarImage
                    src={playerPortraitUrl ?? activeCharacter?.portraitUrl}
                    alt={activeCharacter?.name || t('playerPortraitAlt')}
                    className="object-cover object-top rounded-none w-full h-full"
                  />
                )}
                <AvatarFallback className="text-xs rounded-none">
                  {getAuthorInitials(message, activeCharacter, locale === 'en' ? 'en' : 'pl')}
                </AvatarFallback>
              </>
            )}
          </Avatar>
          <div className="flex-1 space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`font-medium text-base ${getAuthorColor(message.role)}`}
              >
                {getAuthorName(message, activeCharacter, locale === 'en' ? 'en' : 'pl')}
              </span>
              <span className="text-sm text-muted-foreground">
                {message.gameTime
                  ? `${message.gameTime.hour.toString().padStart(2, '0')}:${message.gameTime.minute.toString().padStart(2, '0')}`
                  : message.timestamp.toLocaleTimeString(intlLocale, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
              </span>
              {/* Przycisk Play/Pause/Stop TTS dla wiadomości asystenta */}
              {message.role === 'assistant' && isTTSEnabled && (
                <div className="ml-auto flex items-center gap-1">
                  {/* Toggle Play/Pause */}
                  {currentAudio && toggleAudioPause && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAudioPause();
                      }}
                      className="p-1 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
                      title={
                        isAudioPaused
                          ? t('resumeReading')
                          : t('pauseReading')
                      }
                    >
                      {isAudioPaused ? (
                        <Play className="w-3.5 h-3.5" />
                      ) : (
                        <Pause className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                  {/* Stop - zatrzymuje i czyści */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      stopCurrentAudio();
                    }}
                    className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                    title={t('stopReadingTitle')}
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                  </button>
                </div>
              )}
            </div>

            {/* Wygenerowane obrazy - ZAWSZE na szczycie wiadomości przed tekstem */}
            {message.generatedImages && message.generatedImages.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-4 items-start">
                {message.generatedImages.map((imgUrl, idx) => {
                  const imgType = message.generatedImageTypes?.[idx];
                  const isPortrait = imgType === 'portrait';
                  const isItem = imgType === 'item';
                  const isCompact = isPortrait;
                  return (
                  <div
                    key={idx}
                    className={`relative rounded-lg overflow-hidden border border-brass/30 shadow-lg ${
                      isCompact ? 'w-48 sm:w-56 flex-shrink-0' : 'w-full'
                    }`}
                    style={{
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                    }}
                  >
                    <SafeImage
                      src={imgUrl}
                      alt={
                        isPortrait
                          ? t('portraitAlt', { value: idx + 1 })
                          : isItem
                            ? t('itemAlt', { value: idx + 1 })
                            : imgType === 'monster'
                              ? t('monsterAlt', { value: idx + 1 })
                              : imgType === 'vision'
                                ? t('visionAlt', { value: idx + 1 })
                                : t('sceneAlt', { value: idx + 1 })
                      }
                      className={`w-full cursor-pointer hover:opacity-90 transition-opacity ${
                        isPortrait
                          ? 'aspect-[3/4] object-cover object-top'
                          : 'h-auto max-h-[70vh] object-contain bg-black/30'
                      }`}
                      style={{
                        filter: getEraImageFilter(currentEra),
                      }}
                      loading="lazy"
                      onClick={() =>
                        onImageClick(imgUrl, message.generatedImages || [])
                      }
                    />
                  </div>
                )})}
              </div>
            )}

            {/* Formatowanie wiadomości - różne dla MG vs gracza */}
            {message.role === 'assistant' ? (
              <>
                <NarrativeFormatter
                  content={message.content}
                  className="text-[18px] leading-relaxed font-special-elite"
                  playerColors={playerColors}
                  onImageClick={onImageClick}
                  isDirectorMode={isDirectorMode}
                  adventureContext={adventureContext}
                  allowedDossierHandoutRecordIds={message.dossierHandoutRecordIds}
                  dossierHandoutBinding={message.dossierHandoutBinding}
                />
                {(message.content.includes('[KONIEC_SESJI:POTWIERDZENIE]') || (isSessionEnded && isLastMessage)) && (
                  <>
                    {sessionSaveStatus === 'saving' && (
                      <div className="mt-6 p-4 rounded-lg border border-brass/30 bg-card text-card-foreground font-special-elite text-sm text-center tracking-wider animate-pulse shadow-md flex items-center justify-center gap-2.5">
                        <Loader2 className="w-4 h-4 animate-spin text-brass" />
                        <p className="italic">{t('chronicleSaving')}</p>
                      </div>
                    )}

                    {sessionSaveStatus === 'error' && (
                      <>
                        <div className="mt-6 p-4 rounded-lg border border-red-800 bg-red-950/40 text-red-200/90 font-special-elite text-sm text-center tracking-wider shadow-md">
                          <p className="font-semibold text-red-400 mb-3">{t('chronicleSaveError')}</p>
                          {onRetrySessionSave && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={onRetrySessionSave}
                              className="border-red-800 bg-red-950/60 hover:bg-red-900/60 text-red-200 hover:text-red-100 font-special-elite"
                            >
                              <RefreshCw className="w-3.5 h-3.5 mr-2" />
                              {t('chronicleSaveRetry')}
                            </Button>
                          )}
                        </div>

                        {activeCharacter && onCharacterUpdate && (
                          <DevelopmentPhaseCard
                            character={activeCharacter}
                            onCharacterUpdate={onCharacterUpdate}
                          />
                        )}
                      </>
                    )}

                    {(sessionSaveStatus === 'saved' || (sessionSaveStatus === 'idle' && isSessionEnded)) && (
                      <>
                        <div className="mt-6 p-4 rounded-lg border border-red-950 bg-red-950/20 text-red-200/90 font-special-elite text-sm text-center tracking-wider animate-pulse shadow-md">
                          <p className="font-semibold text-red-400 mb-1">{t('chronicleSavedTitle')}</p>
                          <p className="italic">{t('chronicleSavedMessage')}</p>
                        </div>

                        {activeCharacter && onCharacterUpdate && (
                          <DevelopmentPhaseCard
                            character={activeCharacter}
                            onCharacterUpdate={onCharacterUpdate}
                          />
                        )}
                      </>
                    )}
                  </>
                )}
              </>
            ) : (
              <p className="text-[18px] leading-relaxed font-special-elite break-words overflow-wrap-anywhere whitespace-pre-wrap chat-message">
                {cleanMarkdown(message.content)}
              </p>
            )}

            {/* Ręczna kontynuacja urwanej narracji (finishReason=MAX_TOKENS).
                Tylko ostatnia wiadomość MG; po zamówieniu przycisk się blokuje. */}
            {message.role === 'assistant' &&
              isLastMessage &&
              onContinueNarration &&
              message.finishReason === 'MAX_TOKENS' && (
                <div className="mt-3 flex justify-center print:hidden">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={message.continuationRequested === true}
                    onClick={() => onContinueNarration(message.id)}
                  >
                    {message.continuationRequested
                      ? t('continuationRequested')
                      : t('continueNarration')}
                  </Button>
                </div>
              )}

            {/* Tacka testów umiejętności [TEST:...] (Bug 2, sesja 2026-06-17) */}
            {message.skillTests && message.skillTests.length > 0 && (
              <div className="mt-3">
                {message.skillTests.map((test) => (
                  <SkillTestCard
                    key={test.id}
                    {...test}
                    onRoll={onRollTest}
                    completed={completedTestIds?.has(test.id)}
                  />
                ))}
              </div>
            )}

            {/* Bezpośredni rzut kośćmi 3D [DICE:...] */}
            {message.diceRollEvents && message.diceRollEvents.length > 0 && (
              <div className="mt-3 space-y-2">
                {message.diceRollEvents.map((diceEvent) => (
                  <DiceRollCard key={diceEvent.id} event={diceEvent} />
                ))}
              </div>
            )}

            {/* Zagrożenia środowiskowe i trucizny CoC 7e RAW (Issue #60) */}
            {hazardEvents && hazardEvents.length > 0 && (
              <div className="mt-3 space-y-2">
                {hazardEvents.map((hazard) => {
                  const normalizeName = (value: string) =>
                    value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
                  const characterPool = activeCharacter
                    ? [activeCharacter, ...characters.filter((character) => character.id !== activeCharacter.id)]
                    : characters;
                  const targetCharacter = hazard.characterId
                    ? characterPool.find((character) => character.id === hazard.characterId)
                    : hazard.characterName
                      ? characterPool.find(
                          (character) => normalizeName(character.name) === normalizeName(hazard.characterName || '')
                        )
                      : activeCharacter;
                  return (
                  <HazardCard
                    key={hazard.id}
                    hazard={hazard}
                    playerCon={targetCharacter?.con || 50}
                    playerHp={targetCharacter?.hp}
                    playerJump={
                      typeof targetCharacter?.skills?.['Skakanie'] === 'number'
                        ? targetCharacter.skills['Skakanie']
                        : typeof targetCharacter?.skills?.['Jump'] === 'number'
                        ? targetCharacter.skills['Jump']
                        : 20
                    }
                    playerDodge={
                      typeof targetCharacter?.skills?.['Unik'] === 'number'
                        ? targetCharacter.skills['Unik']
                        : typeof targetCharacter?.skills?.['Dodge'] === 'number'
                        ? targetCharacter.skills['Dodge']
                        : targetCharacter?.dex
                        ? Math.floor(targetCharacter.dex / 2)
                        : 25
                    }
                    playerName={targetCharacter?.name || hazard.characterName}
                    completed={resolvedHazardIds?.has(hazard.id)}
                    canApply={Boolean(targetCharacter)}
                    onApplyDamage={(damage) => {
                      if (targetCharacter && onCharacterUpdate && !resolvedHazardIds?.has(hazard.id)) {
                        const newHp = Math.max(0, targetCharacter.hp - damage);
                        onCharacterUpdate({
                          ...targetCharacter,
                          hp: newHp,
                        });
                      }
                    }}
                    onSendChat={onSendHazardResult}
                  />
                  );
                })}
              </div>
            )}

            {/* Rzucanie czarów i rytuałów CoC 7e RAW (Issue #252) */}
            {message.spellCastEvents && message.spellCastEvents.length > 0 && (
              <div className="mt-3 space-y-2">
                {message.spellCastEvents.map((spellEvent) => (
                  <SpellCard
                    key={spellEvent.id}
                    spellEvent={spellEvent}
                    activeCharacter={activeCharacter}
                    characters={characters}
                    completed={resolvedSpellIds?.has(spellEvent.id)}
                    onCharacterUpdate={onCharacterUpdate}
                    onSendChat={onSendSpellResult}
                  />
                ))}
              </div>
            )}

            {/* Badanie tomów Mitów CoC 7e RAW (Issue #252) */}
            {message.tomeStudyEvents && message.tomeStudyEvents.length > 0 && (
              <div className="mt-3 space-y-2">
                {message.tomeStudyEvents.map((tomeEvent) => (
                  <TomeCard
                    key={tomeEvent.id}
                    tomeEvent={tomeEvent}
                    activeCharacter={activeCharacter}
                    characters={characters}
                    completed={resolvedTomeIds?.has(tomeEvent.id)}
                    onCharacterUpdate={onCharacterUpdate}
                    onSendChat={onSendTomeResult}
                  />
                ))}
              </div>
            )}

            {/* Obrona przed wrogą magią CoC 7e RAW (Issue #318) */}
            {message.opposedMagicEvents && message.opposedMagicEvents.length > 0 && (
              <div className="mt-3 space-y-2">
                {message.opposedMagicEvents.map((opposedEvent) => (
                  <OpposedMagicCard
                    key={opposedEvent.id}
                    opposedEvent={opposedEvent}
                    activeCharacter={activeCharacter}
                    characters={characters}
                    completed={resolvedOpposedMagicIds?.has(opposedEvent.id)}
                    onCharacterUpdate={onCharacterUpdate}
                    onSendChat={onSendOpposedMagicResult}
                  />
                ))}
              </div>
            )}

            {message.acquiredItems && message.acquiredItems.length > 0 && (
              <div>
                {message.acquiredItems.map((proposal) => (
                  <AcquiredItemCard
                    key={proposal.id}
                    proposal={proposal}
                    onConfirm={(characterId?: string) =>
                      void onConfirmAcquiredItem?.(message.id, proposal.id, characterId)
                    }
                    onDismiss={() =>
                      onDismissAcquiredItem?.(message.id, proposal.id)
                    }
                    isDuet={isDuet}
                    characters={characters}
                  />
                ))}
              </div>
            )}

            {/* Diegetyczne okno wizji sennej CoC 7e RAW (Issue #787) */}
            {message.dreamVisionEvent && (
              <DreamCard
                dreamEvent={message.dreamVisionEvent}
                completed={!isLastMessage || message.dreamVisionEvent.status === 'awakened'}
              />
            )}

            {/* Zmiany statystyk Badacza (HP, SAN, Szczęście) CoC 7e RAW (Issue #763) */}
            {message.statChangeEvents && message.statChangeEvents.length > 0 && (
              <div className="mt-3 space-y-2">
                {message.statChangeEvents.map((statEvent) => (
                  <StatChangeCard
                    key={statEvent.id}
                    statEvent={statEvent}
                    activeCharacter={activeCharacter}
                    characters={characters}
                    onRollTest={onRollTest}
                    completed={!isLastMessage}
                  />
                ))}
              </div>
            )}

            {/* Pościg i tor przeszkód CoC 7e RAW (Fiction First w czacie) */}
            {message.chaseState && (
              <div className="mt-3">
                <ChaseCard
                  chaseState={message.chaseState}
                  activeCharacter={activeCharacter}
                  characters={characters}
                  completed={!isLastMessage || message.chaseState.status !== 'ongoing'}
                  onManeuverSelect={onChaseManeuver}
                  onRollTest={onRollTest}
                />
              </div>
            )}

            {/* Obrona przed atakiem wręcz CoC 7e RAW (Faza 4 - OpposedMeleeCard) */}
            {message.opposedMeleeEvents && message.opposedMeleeEvents.length > 0 && (() => {
              const defensesCountByTarget: Record<string, number> = {};
              return (
                <div className="mt-3 space-y-2">
                  {message.opposedMeleeEvents.map((opposedMelee) => {
                    const targetKey = (opposedMelee.characterId || opposedMelee.characterName || 'active').toLowerCase();
                    const defensesUsed = defensesCountByTarget[targetKey] ?? 0;
                    defensesCountByTarget[targetKey] = defensesUsed + 1;

                    return (
                      <OpposedMeleeCard
                        key={opposedMelee.id}
                        opposedEvent={opposedMelee}
                        activeCharacter={activeCharacter}
                        characters={characters}
                        completed={resolvedCombatIds?.has(opposedMelee.id)}
                        defensesUsedThisRound={defensesUsed}
                        onCharacterUpdate={onCharacterUpdate}
                        onSendChat={onSendCombatResult}
                      />
                    );
                  })}
                </div>
              );
            })()}

            {/* Atak bronią palną i reakcja Dive for Cover CoC 7e RAW (TASK-RAW-02) */}
            {message.firearmsAttackEvents && message.firearmsAttackEvents.length > 0 && (
              <div className="mt-3 space-y-2">
                {message.firearmsAttackEvents.map((firearm) => (
                  <FirearmsCard
                    key={firearm.id}
                    firearmEvent={firearm}
                    activeCharacter={activeCharacter}
                    completed={resolvedCombatIds?.has(firearm.id)}
                    onCharacterUpdate={onCharacterUpdate}
                    onSendChat={onSendCombatResult}
                  />
                ))}
              </div>
            )}

            {/* Bliskie starcie wręcz CoC 7e RAW (Issue #302 - Fiction First w czacie) */}
            {message.pendingMeleeAttacks && message.pendingMeleeAttacks.length > 0 && (
              <div className="mt-3 space-y-2">
                {message.pendingMeleeAttacks.map((attack) => (
                  <CombatCard
                    key={attack.eventId}
                    attack={attack}
                    activeCharacter={activeCharacter}
                    characters={characters}
                    completed={resolvedCombatIds?.has(attack.eventId)}
                    onCharacterUpdate={onCharacterUpdate}
                    onSendChat={onSendCombatResult}
                  />
                ))}
              </div>
            )}

            {/* Twarde weto sędziego i guardrails CoC 7e RAW (Issue #380) */}
            {message.refereeVetoEvents && message.refereeVetoEvents.length > 0 && (
              <div className="mt-3 space-y-3">
                {message.refereeVetoEvents.map((veto) => (
                  <RefereeVetoCard
                    key={veto.id}
                    veto={veto}
                  />
                ))}
              </div>
            )}

            {/* Ostateczny kres postaci i diegetyczny epilog CoC 7e RAW (Issue #372) */}
            {message.gameOverEvents && message.gameOverEvents.length > 0 && (
              <div className="mt-3 space-y-3">
                {message.gameOverEvents.map((gameOver) => (
                  <GameOverCard
                    key={gameOver.id}
                    gameOverEvent={gameOver}
                    activeCharacter={activeCharacter}
                    characters={characters}
                    onSendChat={onSendCombatResult}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
