/**
 * @file ChatWindowProps - typy propsów dla głównego komponentu czatu (IND-144 Wariant C, sesja 131).
 *
 * Extracted z `ChatWindow.tsx` jako pierwszy mikrokomit splittu 438→<200 lin.
 * Plik leaf module bez `'use client'` (czysty TS, brak JSX).
 *
 * Sesja 132 (D9 follow-up): drop 11 dead propsów (activeGameState, voiceEnabled,
 * setVoiceEnabled, isGeneratingVoice, isNarratorOnly, setIsNarratorOnly,
 * queueStatus, setIsTTSEnabled, voiceFeatureAvailable, onCharacterChange,
 * handleKeyPress) - destructured w refaktorze 1:1 ale nigdy używane w JSX.
 */

import type {
  HotSeatConfig,
  Message,
  Character,
  AdventureContext,
} from '@/lib/types';
import type { GameStartError } from '@/hooks/useGameStart';
import type { DiceRoll } from '@/lib/dice-utils';
import type { SkillRollResolution } from '@/lib/parsers/types';
import type { ResolvedEraContext } from '@/lib/era';
import type { ChaseState } from '@/lib/chase/chase-engine';
import type {
  CombatResolution,
  PendingMeleeAttack,
  DefenseChoice,
  ManeuverType,
} from '@/lib/combat/combat-resolver';
import type { CombatDefenseWeaponOption } from '@/lib/combat/weapon-context';

export interface ChatWindowProps {
  // Messages + input
  dossierProtocolFailure?: { code: 'DOSSIER_PROTOCOL_REJECTED'; declaration: string } | null;
  pendingDossierSkillRollRetry?: { testIds: string[] } | null;
  retryDossierSkillRoll?: () => Promise<boolean>;
  messages: Message[];
  newMessage: string;
  setNewMessage: (message: string) => void;
  handleSendMessage: (
    message: string,
    mechanicsContext?: {
      chase?: ChaseState;
      combat?: { resolutions: CombatResolution[] };
      skillRolls?: SkillRollResolution[];
    }
  ) => void;
  pendingCombatAttack?: PendingMeleeAttack | null;
  pendingCombatDefensesUsed?: number;
  combatDefenseWeapons?: CombatDefenseWeaponOption[];
  onCombatDefense?: (
    attack: PendingMeleeAttack,
    choice: DefenseChoice,
    weapon?: CombatDefenseWeaponOption,
    maneuverType?: ManeuverType
  ) => void;

  // TTS state + controls (subset faktycznie używany w MessageCard)
  currentAudio: HTMLAudioElement | null;
  stopCurrentAudio: () => void;
  toggleAudioPause?: () => void;
  isAudioPaused?: boolean;
  isTTSEnabled: boolean;

  // Character
  activeCharacter: Character | null;
  characters?: Character[];
  /** D1: zapisuje rzut Tacki ([TEST:]) do dziennika postaci (most appendRollToJournal). */
  onJournalRoll?: (
    roll: DiceRoll,
    justification?: string,
    characterId?: string
  ) => void;
  /** D1: odejmuje wydane pkt Szczęścia z karty postaci (CoC 7e Faza 5B). */
  onSpendLuck?: (amount: number, characterId?: string) => void;

  // Onboarding callbacks + state flags
  onUploadRules?: () => void;
  onSelectAdventure?: () => void;
  onSessionZero?: () => void;
  onCreateCharacter?: (playerName?: string) => void;
  onPickPredefinedCharacter?: (playerName?: string) => void;
  /** C1 (Hot Seat): otwiera katalog dotychczasowych postaci ("Wybierz z katalogu"). */
  onPickCharacter?: (playerName?: string) => void;
  onStartGame?: () => void;
  /** #7: otwiera setup Hot Seat (Solo / 2 osoby) z onboardingu. */
  onChoosePlayMode?: () => void;
  /** Nowy handler do szybkiego startu (Etap 0.5) */
  onQuickStart?: (
    adventureId: string,
    characterId: string,
    mode?: 'solo' | 'hot-seat',
    player2CharacterId?: string
  ) => void;
  onLoadSave?: () => void;
  onOpenApiKeys?: () => void;
  onOpenHelp?: () => void;
  onOpenBetaStatus?: () => void;
  onOpenBetaFeedback?: () => void;
  onColdStart?: () => void;
  hasRules?: boolean;
  hasAdventure?: boolean;
  adventureTitle?: string;
  adventureDescription?: string;
  /** 3H: region przygody (`adventureContext.location`) - lewa część pineski "region · miejsce". */
  region?: string;
  /** IND-267: bieżące MIEJSCE bohatera (pineska 📍 w headerze obok tytułu/zegara). */
  currentLocation?: string;
  hasSessionZero?: boolean;
  hasStartedGame?: boolean;
  /** Kontekst kanoniczny epoki sceny dla reguł i detekcji anachronizmów. */
  eraContext?: ResolvedEraContext | null;

  // Hot Seat
  hotSeatConfig?: HotSeatConfig;
  /** Przełącza aktywnego gracza Hot Seat (index w tablicy players). */
  onSwitchPlayer?: (playerIndex: number) => void;
  /** Wyłącza tryb Hot Seat. */
  onDisableHotSeat?: () => void;

  /** @deprecated Issue #590: Ręczne podsumowanie sceny zastąpione przez automatyczne [KARTA_SCENY] i [RAPORT_AKTU]. */
  onSummarizeScene?: () => Promise<void>;
  /** @deprecated Issue #590: Nieużywane w MessageInput. */
  isSummarizingScene?: boolean;

  // Loading
  isLoading?: boolean;
  /** Issue #571: Callback przerwania generowania odpowiedzi AI (Stop button) */
  onStopGeneration?: () => void;
  isInitialBuffering?: boolean;
  isStarting?: boolean;
  startProgress?: number;
  startStatus?: string;
  /** Issue #157: Gotowość do wejścia do gry (100% zbuforowane, oczekiwanie na kliknięcie CTA) */
  isReadyToEnter?: boolean;
  /** Issue #157: Callback zatwierdzenia wejścia do gry po kliknięciu CTA */
  onConfirmEnterGame?: () => void;
  /** Issue #157: Pełny kontekst wybranej przygody dla dynamicznej karty Art Déco */
  adventureContext?: AdventureContext | null;
  /** Issue #520: Stan błędu startu gry dla TTSHardLoadingScreen */
  startError?: GameStartError | null;
  /** Issue #520: Ponowienie próby startu gry */
  onRetryStartGame?: () => void;
  /** Issue #520: Anulowanie startu gry i powrót do ekranu wyboru */
  onCancelStartGame?: () => void;

  // === C4 (duet): bufor deklaracji + wysyłka tury ===
  /** Czy tryb dla dwojga (Hot Seat 2 graczy) - Enter dokłada deklarację zamiast wysyłać. */
  isDuet?: boolean;
  pendingDeclarations?: {
    playerId: string;
    playerName: string;
    characterName?: string;
    text: string;
  }[];
  playersAwaitingDeclaration?: { id: string; name: string }[];
  onAddDeclaration?: (text: string) => void;
  onPassDeclaration?: () => void;
  currentPlayerName?: string;
  isTurnReady?: boolean;
  onSendTurn?: () => void;
  onOpenCharacterSheet?: (character: Character) => void;
  /** Potwierdza lub odrzuca kartę [ZDOBYTY_PRZEDMIOT] w narracji MG. */
  onConfirmAcquiredItem?: (
    messageId: string,
    proposalId: string,
    characterId?: string
  ) => void;
  onDismissAcquiredItem?: (messageId: string, proposalId: string) => void;
  isSessionEnded?: boolean;
  sessionEndStatus?: 'idle' | 'awaiting_player_closure' | 'ended';
  sessionSaveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  onRetrySessionSave?: () => void;
  onCharacterUpdate?: (char: Character) => void;
  /** Kontynuacja uciętej narracji MG - deklaruje caller; pole opcjonalne dla
   *  zgodności z page.tsx (przekazywane dalej tylko gdy podane). */
  onContinueNarration?: (messageId?: string) => void;
  // Retro Cheats - wsparcie modali walki i pościgu
  cheatCombatModal?: {
    attackerName: string;
    attackerWeapon?: string;
    dodgeSkill: number;
    brawlSkill: number;
    playerBuild?: number;
    attackerBuild?: number;
  } | null;
  onCloseCheatCombat?: () => void;
  cheatChaseModal?: boolean;
  onCloseCheatChase?: () => void;
  activeChaseState?: ChaseState | null;
  onChaseStateChange?: (state: ChaseState) => void;
  /** Flaga aktywności cytatu WelcomeScreen (dźwięk maszyny i pisanie). */
  quoteActive?: boolean;
}
