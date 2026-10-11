'use client';
import { notifyMemoryCommit } from '@/core/memory/commit-client';
import { beginChronicleTurn, closeChronicleSession, stampChronicleEntries } from '@/lib/journal/chronicle-chapters';

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  Message,
  Character,
  GameTime,
  AdventureContext,
  HotSeatConfig,
  HotSeatPlayer,
  JournalEntry,
  NPC,
  OpposedMeleeEventData,
  GuardrailState,
} from '@/lib/types';
import {
  createChaseState,
  createInitialChaseFromTag,
  advanceChaseOnSkillRoll,
  speedRollOutcomeFromCheck,
  type ChaseState,
} from '@/lib/chase/chase-engine';
import { evaluateSkillCheck, rollD100 } from '@/lib/dice-utils';
import {
  resolveTestValue,
  resolveSkillBaseValue,
  UNKNOWN_SKILL_BASE,
} from '@/lib/skill-test-resolver';
import {
  sanitizeCharacterForApi,
  sanitizeHistoryForApi,
} from '@/lib/chat-history-sanitizer';
import type { SkillTestData } from '@/lib/parsers/types';
import type { SkillTestResult } from '@/lib/response-parser';
import {
  extractHazardEvents,
  extractSkillResults,
  extractSpellCastEvents,
  extractTomeStudyEvents,
  extractOpposedMagicEvents,
  extractOpposedMeleeEvents,
  extractFirearmsAttackEvents,
  extractRefereeVetoEvents,
  extractGameOverEvents,
  stripMeleeAttackTags,
} from '@/lib/parsers/mechanics-parser';
import { updateGuardrailState } from '@/lib/concordia/event-resolution';
import {
  extractLatestTagLocation,
  isVisualPromptLeak,
  sanitizeLocationName,
  extractChaseTag,
  extractChaseEndTag,
  extractDreamVisionTag,
} from '@/lib/parsers/event-parser';
import {
  fetchWithApiKeys,
  hasRequiredKeys,
  isPureTextMode,
} from '@/lib/api-keys-service';
import { timeManager } from '@/lib/time-manager';
import {
  generateSessionEndSaveName,
  performFullGameSave,
} from '@/lib/save/auto-save-service';
import { parseSSEStream, createSseParseErrorHandler } from '@/lib/sse-parser';
import { trackEvent } from '@/lib/posthog';
import type { AISettings } from '@/lib/ai-settings/types';
import {
  imageCooldownMsForLevel,
  MAX_IMAGES_PER_SCENE,
} from '@/lib/constants/chat';
import { resolveImageLevel } from '@/lib/prompts/image-instructions';
import { VisualBeliefGraph } from '@/lib/images/visual-belief-graph';
import { directSceneIllustrations } from '@/lib/images/proactive-scene-director';
import {
  appendJournalToParty,
  appendSceneChronicleSummaryToParty,
  buildSceneChronicleTranscript,
} from '@/lib/journal/apply-journal-tags';
import { extractNpcTags } from '@/lib/parsers/journal-parser';
import { applyStatChangesToParty } from '@/lib/character/apply-stat-changes';
import { applyEquipmentEventsToParty } from '@/lib/character/apply-equipment-events';
import { toast } from '@/components/ui/use-toast';
import { resolveCharacterByName } from '@/lib/character/match-by-name';
import { persistCharacters } from '@/lib/character-cloud-sync';
import { persistentMediaCache } from '@/lib/persistent-media-cache';
import { createEquipmentItem } from '@/lib/equipment-data';
import {
  createAcquiredEquipmentSeed,
  extractAcquiredItemProposals,
} from '@/lib/acquired-equipment';
import {
  buildEquipmentImagePrompt,
  isCharacterBoundEquipment,
} from '@/lib/equipment-prompt-builder';
import { resolveEraVisualProfile } from '@/lib/era-visual-style';
import { isCheatCommand, executeCheatCommand } from '@/lib/cheats/cheat-engine';
import { getGlobalLightDirector } from '@/lib/hardware/hue/light-director-service';
import { playSFX } from '@/lib/audio/sfx-catalog';
import type {
  CombatResolution,
  PendingMeleeAttack,
  DefenseChoice,
  ManeuverType,
} from '@/lib/combat/combat-resolver';
import {
  createCombatRoundJournal,
  loadCombatJournal,
  resolveCombatJournalEvent,
  saveCombatJournal,
  type CombatRoundJournal,
} from '@/lib/combat/combat-transaction';
import { ANCIENT_TREES_DREAM_VARIANTS } from '@/lib/adventures/dreams/ancient-trees-dreams';
import {
  getCombatDefenseWeapons,
  type CombatDefenseWeaponOption,
} from '@/lib/combat/weapon-context';
import { loadCampaignMemoryScope } from '@/core/memory/campaign-scope';
import {
  deriveSceneSensoryMemoryFromMessages,
  extractMacroLocation,
  isSameMacroLocation,
} from '@/lib/world-engine';

const MESSAGES_STORAGE_KEY = 'zew_chat_messages';
const ACTIVE_CHASE_STORAGE_KEY = 'zew_active_chase_state';

type MechanicsContext = {
  chase?: ChaseState;
  combat?: { resolutions: CombatResolution[] };
};

function loadNpcSnapshot(): NPC[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem('gm_npcs') || '[]');
    return Array.isArray(parsed) ? (parsed as NPC[]) : [];
  } catch {
    return [];
  }
}

/**
 * Zadanie 6 (hardening demo-safe): chwilowy blip sieci ≠ crash gry.
 *
 * `fetch` rzuca `TypeError` ("Failed to fetch" w Chrome, "NetworkError" w Firefox)
 * przy zerwaniu połączenia - to inny przypadek niż odpowiedź serwera z błędem
 * (np. 500), którą zwraca normalnie jako `Response`. Tu ponawiamy WYŁĄCZNIE błędy
 * sieciowe (1-2 próby, krótki backoff). HTTP 4xx/5xx idą dalej do callera bez
 * retry (to nie jest blip - ponawianie nic nie da). Minimal-touch: opakowuje
 * istniejące `fetchWithApiKeys`, nie zmienia reszty przepływu.
 */
function isNetworkBlip(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  // Niektóre środowiska rzucają zwykły Error z komunikatem sieciowym.
  const msg = error instanceof Error ? error.message : String(error);
  return /failed to fetch|networkerror|network request failed/i.test(msg);
}

async function fetchWithRetry(
  url: string,
  options: Parameters<typeof fetchWithApiKeys>[1],
  retries = 2,
  backoffMs = 300
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchWithApiKeys(url, options);
    } catch (error) {
      lastError = error;
      if (options?.signal?.aborted) throw error;
      // Ponawiamy tylko chwilowe błędy sieci; reszta (np. przerwany abort, bugi
      // kodu) leci od razu do callera.
      if (!isNetworkBlip(error) || attempt === retries) throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, backoffMs * (attempt + 1))
      );
    }
  }
  throw lastError;
}

/**
 * IND-142: manual type guard dla persistowanego Message (localStorage JSON parse).
 * Single-instance + best-effort: niezgodne wpisy pomijamy, korumpowane localStorage = reset.
 */
function isPersistedMessage(raw: unknown): raw is {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string | number;
} {
  if (!raw || typeof raw !== 'object') return false;
  const m = raw as Record<string, unknown>;
  if (typeof m.id !== 'string') return false;
  if (m.role !== 'user' && m.role !== 'assistant') return false;
  if (typeof m.content !== 'string') return false;
  if (typeof m.timestamp !== 'string' && typeof m.timestamp !== 'number')
    return false;
  return true;
}

/**
 * Parser zwraca skillTests ze skillValue=0 ("uzupełnione z karty postaci").
 * Dociągamy wartość przez `resolveTestValue` (IND-229), który obsługuje:
 *  - Poczytalność/SAN → character.san,
 *  - testy cech (Siła/Inteligencja/Moc…) → charakterystyki,
 *  - warianty/synonimy nazw umiejętności (np. "Komputerologia" → "Komputery").
 * Wcześniej resolver szukał tylko w `character.skills`, więc SAN i cechy zawsze były 0%.
 * Snapshot w momencie żądania (Hot Seat: wartość należy do gracza aktywnego przy teście).
 */
export function resolveSkillTestValues(
  tests: SkillTestData[],
  character: Character | null,
  characters: Character[] = []
): SkillTestData[] {
  if (!character) return tests;
  const roster = characters.length > 0 ? characters : [character];
  return tests.map((test) => {
    const target = resolveCharacterByName(
      roster,
      test.characterName,
      character
    );
    let combined = test.combined;
    let resolvedSkillValue: number;

    if (combined && combined.skills.length > 0) {
      const resolvedSkills = combined.skills.map((sub) => ({
        skillName: sub.skillName,
        skillValue:
          resolveTestValue(sub.skillName, target) ??
          resolveSkillBaseValue(sub.skillName) ??
          UNKNOWN_SKILL_BASE,
      }));
      combined = {
        ...combined,
        skills: resolvedSkills,
      };
      // Próg reprezentatywny dla widoku ogólnego:
      // OR: maksymalna wartość (wystarczy jeden sukces)
      // AND: minimalna wartość (wymagane oba sukcesy)
      resolvedSkillValue =
        combined.operator === 'OR'
          ? Math.max(...resolvedSkills.map((s) => s.skillValue))
          : Math.min(...resolvedSkills.map((s) => s.skillValue));
    } else {
      resolvedSkillValue =
        resolveTestValue(test.skillName, target) ??
        resolveSkillBaseValue(test.skillName) ??
        UNKNOWN_SKILL_BASE;
    }

    return {
      ...test,
      characterId: target.id,
      characterName: target.name,
      // Degradacja: karta postaci → bazowa tabela CoC 7e (BASE_SKILLS) → stała.
      // NIGDY 0% (próg ≤0 = absurdalny test gwarantowanej porażki).
      skillValue: resolvedSkillValue,
      combined,
    };
  });
}

/**
 * Faza 3 Hot Seat: rozwiązuje characterId → characterName dla każdego gracza,
 * by serwerowy blok duetu (build-context.ts) mógł adresować postacie po imieniu
 * (`@ImięPostaci:`). `HotSeatPlayer` w configu trzyma tylko `characterId` -
 * build-context czyta `characterName`, więc bez tego mapowania adresowanie duetu
 * nigdy nie ruszy.
 *
 * Forward-compatible: gdy `characterId` nie wskazuje istniejącej postaci (binding
 * jeszcze nie istnieje), `characterName` zostaje `undefined` → JSON.stringify je
 * pomija → blok duetu się nie wstrzykuje (poprawnie, brak halucynowanych imion).
 *
 * @returns kopia configu z wzbogaconymi graczami; `null/undefined` przechodzi 1:1.
 */
function resolveHotSeatCharacterNames(
  config: HotSeatConfig | null | undefined,
  characters: Character[]
):
  | (HotSeatConfig & {
      players: (HotSeatPlayer & { characterName?: string })[];
    })
  | null
  | undefined {
  if (!config) return config;
  return {
    ...config,
    players: config.players.map((player) => ({
      ...player,
      characterName: characters.find((c) => c.id === player.characterId)?.name,
    })),
  };
}

export interface ImageToGenerate {
  prompt: string;
  style?:
    | 'horror'
    | 'vintage'
    | 'realistic'
    | 'artistic'
    | 'portrait'
    | 'item'
    | 'location';
  priority?: 'high' | 'normal';
  isMythos?: boolean;
  type?: 'portrait' | 'scene' | 'location' | 'item' | 'monster' | 'vision';
  aspectRatio?: string;
  portraitName?: string;
  itemName?: string;
  locationName?: string;
}

/**
 * C4 (duet): pojedyncza deklaracja gracza w buforze tury. Enter w trybie dla
 * dwojga DOKŁADA deklarację (nie wysyła) - dopiero "Wyślij turę" składa je w
 * jedną wiadomość do MG z atrybucją gracza/postaci.
 */
export interface PendingDeclaration {
  playerId: string;
  playerName: string;
  /** Imię postaci gracza (gdy przypisana) - do adresowania `@ImięPostaci`. */
  characterName?: string;
  text: string;
}

export function isTurnReady(
  declarations: PendingDeclaration[],
  players: HotSeatPlayer[]
): boolean {
  return (
    players.length >= 2 &&
    players.every((player) =>
      declarations.some((declaration) => declaration.playerId === player.id)
    )
  );
}

/**
 * C4 (duet): składa zebrane deklaracje w JEDNĄ wiadomość do MG. Format z
 * atrybucją gracza i postaci, np.:
 *   "Gracz 1 (@Eleonora): otwieram drzwi ; Gracz 2 (@Tomasz): zaglądam pod łóżko"
 * `@ImięPostaci` jest zgodne z konwencją adresowania duetu (OPT-22 / build-context).
 */
export function composeTurnFromDeclarations(
  declarations: PendingDeclaration[]
): string {
  return declarations
    .map((d, i) => {
      const who = d.characterName
        ? `${d.playerName} (@${d.characterName})`
        : d.playerName || `Gracz ${i + 1}`;
      return `${who}: ${d.text}`;
    })
    .join(' ; ');
}

export interface PdfMemory {
  rulesUrl?: string;
  rulesTextUrl?: string;
  rulesGeminiFileUri?: string;
  adventureUrl?: string;
  adventureTextUrl?: string;
  adventureGeminiFileUri?: string;
  lastUpdated?: string;
}

export type SessionEndStatus = 'idle' | 'awaiting_player_closure' | 'ended';

export interface UseChatReturn {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  newMessage: string;
  setNewMessage: React.Dispatch<React.SetStateAction<string>>;
  handleSendMessage: (
    message: string,
    mechanicsContext?: MechanicsContext
  ) => Promise<boolean>;
  pendingCombatAttack: PendingMeleeAttack | null;
  pendingCombatDefensesUsed: number;
  combatDefenseWeapons: CombatDefenseWeaponOption[];
  handleCombatDefense: (
    attack: PendingMeleeAttack,
    choice: DefenseChoice,
    weapon?: CombatDefenseWeaponOption,
    maneuverType?: ManeuverType
  ) => Promise<void>;
  handleKeyPress: (e: React.KeyboardEvent) => void;
  generateImages: (
    illustrations: ImageToGenerate[],
    messageId: string
  ) => Promise<void>;
  isLoading: boolean;
  handleContinueNarration?: (messageId?: string) => Promise<void>;

  /** IND-267: bieżąca lokacja bohatera z najnowszego [LOKACJA:] (pineska 📍 w headerze). */
  currentLocation: string;
  // === C4 (duet): bufor deklaracji + wysyłka tury ===
  /** Czy aktywny tryb dla dwojga (Hot Seat 2 graczy) - decyduje o buforowaniu. */
  isDuet: boolean;
  /** Zebrane deklaracje bieżącej tury (puste w solo). */
  pendingDeclarations: PendingDeclaration[];
  /** Gracze, którzy jeszcze nie zadeklarowali w tej turze (do podpowiedzi w UI). */
  playersAwaitingDeclaration: { id: string; name: string }[];
  /** Dokłada deklarację AKTUALNEGO gracza do bufora (Enter w duecie). */
  addDeclaration: (text: string) => void;
  /** Zapisuje jawną deklarację braku działania dla aktualnego gracza. */
  passDeclaration: () => void;
  /** Gracz, którego deklarację aktualnie wpisujemy. */
  currentPlayerName?: string;
  /** Komplet deklaracji wymagany do wysłania tury. */
  isTurnReady: boolean;
  /** Czyści bufor deklaracji bieżącej tury. */
  clearDeclarations: () => void;
  /** Składa bufor w jedną wiadomość i wysyła do MG (przycisk "Wyślij turę"). */
  sendTurn: () => void;
  confirmAcquiredItem: (
    messageId: string,
    proposalId: string,
    characterId?: string
  ) => Promise<void>;
  dismissAcquiredItem: (messageId: string, proposalId: string) => void;
  /** Stan informujący o zakończeniu sesji gier po tagu [KONIEC_SESJI:POTWIERDZENIE] */
  isSessionEnded: boolean;
  /** Dwuetapowy stan końca sesji (idle | awaiting_player_closure | ended) */
  sessionEndStatus: SessionEndStatus;
  /** Stan autozapisu kroniki po zakończeniu sesji: 'idle' | 'saving' | 'saved' | 'error' */
  sessionSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
  /** Funkcja ponowienia autozapisu kroniki po błędzie */
  retrySessionSave: () => Promise<void>;
  /** Resetuje stan zakończenia sesji i odblokowuje czat (Issue #643) */
  resetSessionEndState: () => void;
  // Retro Cheats
  cheatCombatModal: {
    attackerName: string;
    attackerWeapon?: string;
    dodgeSkill: number;
    brawlSkill: number;
    playerBuild?: number;
    attackerBuild?: number;
  } | null;
  setCheatCombatModal: React.Dispatch<
    React.SetStateAction<{
      attackerName: string;
      attackerWeapon?: string;
      dodgeSkill: number;
      brawlSkill: number;
      playerBuild?: number;
      attackerBuild?: number;
    } | null>
  >;
  cheatChaseModal: boolean;
  setCheatChaseModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeChaseState: ChaseState | null;
  setActiveChaseState: React.Dispatch<React.SetStateAction<ChaseState | null>>;
  /** Issue #571: Przerywa aktywne generowanie odpowiedzi AI (AbortController) i cofa ostatnią turę */
  stopGeneration: () => void;
}

function resolveEquipmentVisualEra(context?: AdventureContext | null): string {
  return resolveEraVisualProfile(
    context?.yearRange || context?.eraLabel || context?.era || '1920s'
  );
}

interface UseChatOptions {
  locale?: 'pl' | 'en';
  pdfMemory: PdfMemory;
  activeCharacter: Character | null;
  characters: Character[];
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
  setActiveCharacter: React.Dispatch<React.SetStateAction<Character | null>>;
  voiceEnabled: boolean;
  isTTSEnabled: boolean;
  generateVoiceForMessage: (
    message: Message,
    messages: Message[]
  ) => Promise<void>;
  // M6 sesja 146: generateMultiVoice DROPPED per D3.
  addToQueue: (text: string, messageId?: string) => void;
  /** Issue #79: Natychmiastowe ucięcie lektora TTS przy wysłaniu nowej akcji gracza */
  stopCurrentAudio?: () => void;
  onSkillResults?: (results: SkillTestResult[]) => void;
  adventureContext?: AdventureContext | null;
  aiSettings?: AISettings | null;
  // IND-246: konfiguracja Hot Seat (2 graczy) - wysyłana do /api/chat, by
  // serwerowy HOT SEAT FIX (build-context.ts) wstrzyknął listę obu postaci
  // do promptu AI (AI rozpoznaje i adresuje obu graczy, nie tylko aktywnego).
  hotSeatConfig?: HotSeatConfig | null;
  /** Wydarzenie z generatora fabularnego zrzucone z UI */
  pendingDirectorEvent?:
    | import('@/lib/random-event-generator').RandomEvent
    | null;
  /** Czyszczenie wydarzenia po wysłaniu do LLM */
  clearPendingDirectorEvent?: () => void;
  /** Po zapisaniu deklaracji przełącza UI na kolejnego oczekującego gracza. */
  onSwitchHotSeatPlayer?: (playerIndex: number) => void;
}

export function useChat(options: UseChatOptions): UseChatReturn {
  const {
    pdfMemory,
    activeCharacter,
    characters,
    setCharacters,
    setActiveCharacter,
    voiceEnabled,
    isTTSEnabled,
    generateVoiceForMessage,
    stopCurrentAudio,
    onSkillResults,
    adventureContext,
    hotSeatConfig,
    onSwitchHotSeatPlayer,
    locale = 'pl',
  } = options;

  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(MESSAGES_STORAGE_KEY);
        if (saved) {
          const parsed: unknown = JSON.parse(saved);
          if (!Array.isArray(parsed)) {
            console.warn(
              'IND-142: korumpowane localStorage messages (nie tablica), resetuję'
            );
            localStorage.removeItem(MESSAGES_STORAGE_KEY);
            return [];
          }
          const valid: Message[] = [];
          for (const raw of parsed) {
            if (!isPersistedMessage(raw)) continue;
            valid.push({
              ...raw,
              timestamp: new Date(raw.timestamp),
            } as Message);
          }
          return valid;
        }
      } catch (e) {
        console.warn('IND-142: Failed to load messages:', e);
        try {
          localStorage.removeItem(MESSAGES_STORAGE_KEY);
        } catch {
          /* ignore */
        }
      }
    }
    return [];
  });
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionEnded, setIsSessionEnded] = useState(false);
  // Retro Cheats - stany modali wyzwalanych kodami [COMBAT] i [CHASE]
  const [cheatCombatModal, setCheatCombatModal] = useState<{
    attackerName: string;
    attackerWeapon?: string;
    dodgeSkill: number;
    brawlSkill: number;
    playerBuild?: number;
    attackerBuild?: number;
  } | null>(null);
  const [cheatChaseModal, setCheatChaseModal] = useState<boolean>(false);
  const combatJournalRef = useRef<CombatRoundJournal | null>(
    typeof window === 'undefined' ? null : loadCombatJournal(localStorage)
  );
  const shouldRecoverCombatCommitRef = useRef(
    combatJournalRef.current?.phase === 'committing'
  );
  const [pendingCombatAttack, setPendingCombatAttack] =
    useState<PendingMeleeAttack | null>(() => {
      const journal = combatJournalRef.current;
      return (
        journal?.attacks.find(
          (attack) =>
            !journal.resolutions.some(
              (resolution) => resolution.eventId === attack.eventId
            )
        ) ?? null
      );
    });
  const [activeChaseState, setActiveChaseState] = useState<ChaseState | null>(
    () => {
      if (typeof window === 'undefined') return null;
      try {
        const active = localStorage.getItem(ACTIVE_CHASE_STORAGE_KEY);
        if (active) return JSON.parse(active) as ChaseState;
        const stored = JSON.parse(
          localStorage.getItem(MESSAGES_STORAGE_KEY) || '[]'
        ) as Message[];
        return (
          [...stored].reverse().find((item) => item.mechanicsContext?.chase)
            ?.mechanicsContext?.chase ?? null
        );
      } catch {
        return null;
      }
    }
  );

  const [sessionEndStatus, setSessionEndStatus] =
    useState<SessionEndStatus>('idle');
  const [sessionSaveStatus, setSessionSaveStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const [lastImageTime, setLastImageTime] = useState(0);

  const activeChaseStateRef = useRef<ChaseState | null>(activeChaseState);
  const guardrailStateRef = useRef<GuardrailState>({
    strikeCount: 0,
    turnsSinceLastViolation: 0,
  });

  // Issue #571: AbortController oraz śledzenie wiadomości bieżącej tury do bezpiecznego cofnięcia (Stop)
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastSentUserMessageRef = useRef<string | null>(null);
  const currentAssistantMessageIdRef = useRef<string | null>(null);
  const currentUserMessageIdRef = useRef<string | null>(null);
  const lastHueLocationChangeTimeRef = useRef<number>(0);
  const hasTriggeredSanShockThisTurnRef = useRef<boolean>(false);
  const sceneSFXBudgetRef = useRef<{
    hasPlayedGunshot: boolean;
    hasPlayedThunder: boolean;
    hasPlayedSanShock: boolean;
  }>({
    hasPlayedGunshot: false,
    hasPlayedThunder: false,
    hasPlayedSanShock: false,
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const director = getGlobalLightDirector();
      director.onSessionStart().catch(() => {});
    }
  }, []);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    if (stopCurrentAudio) {
      stopCurrentAudio();
    }

    const assistantId = currentAssistantMessageIdRef.current;
    const userId = currentUserMessageIdRef.current;
    const userText = lastSentUserMessageRef.current;

    if (assistantId || userId) {
      setMessages((prev) =>
        prev.filter((msg) => msg.id !== assistantId && msg.id !== userId)
      );
    }
    if (userText) {
      setNewMessage(userText);
    }

    currentAssistantMessageIdRef.current = null;
    currentUserMessageIdRef.current = null;
    lastSentUserMessageRef.current = null;
  }, [setNewMessage, stopCurrentAudio]);

  const messagesRef = useRef<Message[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const activeCharacterRef = useRef<Character | null>(activeCharacter);
  useEffect(() => {
    activeCharacterRef.current = activeCharacter;
  }, [activeCharacter]);

  const charactersRef = useRef<Character[]>(characters);
  useEffect(() => {
    charactersRef.current = characters;
  }, [characters]);

  useEffect(() => {
    activeChaseStateRef.current = activeChaseState;
    if (typeof window === 'undefined') return;
    if (activeChaseState) {
      localStorage.setItem(
        ACTIVE_CHASE_STORAGE_KEY,
        JSON.stringify(activeChaseState)
      );
    } else {
      localStorage.removeItem(ACTIVE_CHASE_STORAGE_KEY);
    }
  }, [activeChaseState]);

  useEffect(() => {
    if (messages.length === 0) {
      setIsSessionEnded(false);
      setSessionEndStatus('idle');
      setSessionSaveStatus('idle');
      guardrailStateRef.current = { strikeCount: 0, turnsSinceLastViolation: 0 };
      lastIllustratedLocationRef.current = '';
      lastTrackedSceneRef.current = '';
      sceneImageCountRef.current = 0;
      turnsInCurrentLocationRef.current = 0;
      visitedMacroLocationsRef.current = [];
    }
  }, [messages.length]);

  const isSavingSessionRef = useRef<boolean>(false);
  const executeSessionAutoSave = useCallback(
    async (
      messagesOverride?: Message[],
      characterOverride?: Character | null,
      charactersOverride?: Character[]
    ) => {
      if (isSavingSessionRef.current) return;
      isSavingSessionRef.current = true;
      setSessionSaveStatus('saving');
      try {
        const msgs =
          messagesOverride ||
          (messagesRef.current.length > 0 ? messagesRef.current : messages);
        const activeChar =
          characterOverride !== undefined
            ? characterOverride
            : (activeCharacter || activeCharacterRef.current);
        const allChars =
          charactersOverride ||
          (characters.length > 0 ? characters : charactersRef.current);
        const currentGameTime = timeManager?.getTime ? timeManager.getTime() : null;
        const autoSaveName = generateSessionEndSaveName(
          activeChar?.name,
          currentGameTime
        );

        await performFullGameSave({
          saveName: autoSaveName,
          saveNotes: 'Autozapis po zakończeniu sesji',
          saveImages: true,
          saveSettings: true,
          currentLocale: locale,
          data: {
            messages: msgs,
            locale,
            aiSettings: options.aiSettings,
            equipmentVisualEra: resolveEquipmentVisualEra(adventureContext),
            characters: allChars,
            activeCharacterId: activeChar?.id,
            hotSeatConfig: hotSeatConfig,
            investigatorBoard: activeChar?.investigatorBoard,
            pdfMemory: pdfMemory,
            currentLocationId: currentLocationRef.current || undefined,
          },
        });
        setSessionSaveStatus('saved');
      } catch (err) {
        console.error('Błąd automatycznego zapisu kroniki:', err);
        setSessionSaveStatus('error');
      } finally {
        isSavingSessionRef.current = false;
      }
    },
    [
      locale,
      options.aiSettings,
      adventureContext,
      hotSeatConfig,
      pdfMemory,
      activeCharacter,
      characters,
      messages,
    ]
  );

  const retrySessionSave = useCallback(async () => {
    await executeSessionAutoSave();
  }, [executeSessionAutoSave]);

  const resetSessionEndState = useCallback(() => {
    setIsSessionEnded(false);
    setSessionEndStatus('idle');
    setSessionSaveStatus('idle');
    isSavingSessionRef.current = false;
  }, []);
  // C4 (duet): bufor deklaracji per gracz (pusty w solo, zerowany po wysłaniu tury).
  const [pendingDeclarations, setPendingDeclarations] = useState<
    PendingDeclaration[]
  >([]);
  // IND-267: bieżąca lokacja bohatera z najnowszego [LOKACJA:]. `currentLocation` zasila
  // pineskę 📍 w headerze; `currentLocationRef` lustruje wartość, by `handleSendMessage`
  // wysłał ją do promptu (build-context.ts) BEZ wpisywania jej w tablicę zależności callbacka.
  const [currentLocation, setCurrentLocation] = useState('');
  const currentLocationRef = useRef('');
  // Issue #563: Scene Sensory Memory & Dwupoziomowa Pamięć Strefowa
  const turnsInCurrentLocationRef = useRef(0);
  const visitedMacroLocationsRef = useRef<string[]>([]);
  // 2026-06-28: licznik obrazów per scena (scena = lokacja). Cap MAX_IMAGES_PER_SCENE
  // OGRANICZA serię obrazów w jednej lokacji; resetuje się przy zmianie lokacji.
  // `lastTrackedSceneRef` pamięta lokację, dla której liczymy, by wykryć zmianę sceny.
  // `lastIllustratedLocationRef` zapobiega generowaniu duplikatów kadrów tej samej lokacji.
  const sceneImageCountRef = useRef(0);
  const lastTrackedSceneRef = useRef('');
  const lastIllustratedLocationRef = useRef('');
  // Visual Belief Graph (DeepMind Proactive T2I)
  const visualBeliefGraphRef = useRef<VisualBeliefGraph>(new VisualBeliefGraph());

  useEffect(() => {
    if (typeof window !== 'undefined' && messages.length > 0) {
      // IND-142: persistuj historię BEZ ciężkich base64 obrazów (reuse sanitizera
      // IND-237). Obrazy data: URL (~2MB każdy, generatedImages + intro inline w
      // content) przepełniały localStorage (~5MB) → QuotaExceededError crashował
      // całą apkę przez error boundary. Strip + try/catch = graceful (analog ścieżki
      // odczytu). Stan/UI renderuje z oryginału, więc obrazy nadal widać w sesji.
      try {
        localStorage.setItem(
          MESSAGES_STORAGE_KEY,
          JSON.stringify(sanitizeHistoryForApi(messages))
        );
      } catch (e) {
        console.warn('IND-142: nie udało się zapisać historii (quota?):', e);
      }
    }
  }, [messages]);

  // IND-262: hydracja obrazów scen czatu z IndexedDB na mount. Po reloadzie/crashu
  // generatedImages jest stripowane z localStorage (sanitizer), ale lekkie
  // generatedImageCacheIds przeżywają. Wczytujemy obrazy z persistentMediaCache i
  // populujemy generatedImages → obrazy "wracają na miejsce". Iterujemy po cacheIds
  // (getChatImage per indeks), NIE getAllChatImagesForMessage (urywa się na 1. luce
  // gdy zapis pośredniego indeksu padł). Persist potem znów stripuje base64 do
  // KOPII (in-memory zostaje) → localStorage nigdy nie trzyma base64, brak pętli.
  useEffect(() => {
    if (!persistentMediaCache.isAvailable()) return;
    let cancelled = false;
    void (async () => {
      const toHydrate = messages.filter(
        (m) =>
          (m.generatedImageCacheIds?.length ?? 0) > 0 &&
          (m.generatedImages?.length ?? 0) === 0
      );
      if (toHydrate.length === 0) return;
      const hydrated = new Map<string, string[]>();
      for (const m of toHydrate) {
        const ids = m.generatedImageCacheIds ?? [];
        const urls: string[] = [];
        for (let idx = 0; idx < ids.length; idx++) {
          const url = await persistentMediaCache.getChatImage(m.id, idx);
          if (url) urls.push(url);
        }
        if (urls.length > 0) hydrated.set(m.id, urls);
      }
      // cancelled guard pokrywa StrictMode double-mount: 1. run zostaje anulowany
      // przez cleanup → skip setMessages, 2. run aplikuje.
      if (cancelled || hydrated.size === 0) return;
      setMessages((prev) =>
        prev.map((m) =>
          hydrated.has(m.id) ? { ...m, generatedImages: hydrated.get(m.id) } : m
        )
      );
    })();
    return () => {
      cancelled = true;
    };
    // Run-once na mount: czyta snapshot wiadomości z initializera (localStorage).
    // Nowe wiadomości w sesji mają base64 in-memory → guard pustego generatedImages.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pineska lokacji: zasiej `currentLocation` lokacją przygody, dopóki AI nie wyemituje
  // pierwszego [LOKACJA:]. Bez tego stare sesje (gdzie tag rzadko padał) miały pustą
  // pineskę. Warunek `!currentLocationRef.current` chroni przed nadpisaniem bieżącej
  // lokacji po ruchu gracza; tag [LOKACJA:] z AI (niżej) dalej aktualizuje wartość.
  useEffect(() => {
    const loc = adventureContext?.location?.trim();
    if (loc && !currentLocationRef.current) {
      currentLocationRef.current = loc;
      setCurrentLocation(loc);
    }
  }, [adventureContext?.location]);

  // Issue #563: Odtwórz stan pamięci sensorycznej z historii messages (np. po F5, wczytaniu zapisu lub starcie przez useGameStart)
  useEffect(() => {
    if (
      messages.length > 0 &&
      turnsInCurrentLocationRef.current === 0 &&
      visitedMacroLocationsRef.current.length === 0 &&
      messages.some((m) => m.role === 'assistant' && m.content)
    ) {
      const derived = deriveSceneSensoryMemoryFromMessages(
        messages,
        currentLocationRef.current || adventureContext?.location
      );
      if (derived.currentLocation) {
        currentLocationRef.current = derived.currentLocation;
        setCurrentLocation(derived.currentLocation);
      }
      turnsInCurrentLocationRef.current = derived.turnsInCurrentLocation;
      visitedMacroLocationsRef.current = derived.visitedMacroLocations;
    }
  }, [messages, adventureContext?.location]);

  // Visual Belief Graph: synchronizuj profil Badacza, NPC z Dossier i epokę
  useEffect(() => {
    const era =
      adventureContext?.yearRange ||
      adventureContext?.eraLabel ||
      adventureContext?.era ||
      '1920s';
    visualBeliefGraphRef.current.setEffectiveYear(era);
    if (activeCharacter) {
      visualBeliefGraphRef.current.registerPlayer(activeCharacter, era);
      if (activeCharacter.investigatorDossier?.npcs) {
        for (const npc of activeCharacter.investigatorDossier.npcs) {
          visualBeliefGraphRef.current.registerNPC(npc, era);
        }
      }
      if (activeCharacter.journal) {
        for (const entry of activeCharacter.journal) {
          if (entry.type === 'npc' && entry.title) {
            visualBeliefGraphRef.current.registerNPC(
              {
                id: entry.title.toLowerCase().trim(),
                name: entry.title.trim(),
                description: entry.content || '',
              },
              era
            );
          }
        }
      }
    }
    if (characters && characters.length > 0) {
      characters.forEach((c) => {
        if (c.id !== activeCharacter?.id) {
          visualBeliefGraphRef.current.registerPlayer(c, era);
        }
      });
    }
  }, [activeCharacter, characters, adventureContext?.era, adventureContext?.eraLabel, adventureContext?.yearRange]);

  const generateImages = useCallback(
    async (illustrations: ImageToGenerate[], messageId: string) => {
      if (isPureTextMode()) {
        return;
      }
      const generatedUrls: string[] = [];
      const generatedTypes: (
        | 'portrait'
        | 'scene'
        | 'location'
        | 'item'
        | 'monster'
        | 'vision'
      )[] = [];
      const activeEra =
        adventureContext?.yearRange ||
        adventureContext?.eraLabel ||
        adventureContext?.era ||
        '1920s';

      for (const img of illustrations) {
        const isLocation = img.type === 'location';
        const loc =
          img.locationName?.trim() || currentLocationRef.current?.trim();

        // Sprawdź persistent cache lokacji przed wywołaniem API - WYŁĄCZNIE dla ujęć lokacji (establishing shot),
        // NIGDY dla dynamicznych scen akcji, potworów ani wizji!
        if (isLocation && loc) {
          try {
            const cachedLocImage =
              await persistentMediaCache.getLocationImage(loc);
            if (cachedLocImage) {
              generatedUrls.push(cachedLocImage);
              generatedTypes.push('location');
              continue;
            }
          } catch {
            // Ignoruj błąd odczytu cache lokacji
          }
        }

        const isMythosEffective = Boolean(
          img.isMythos || img.type === 'monster' || img.type === 'vision'
        );

        const defaultStyle =
          img.style ||
          (img.type === 'portrait'
            ? 'portrait'
            : img.type === 'item'
              ? 'item'
              : img.type === 'location'
                ? 'location'
                : 'horror');

        const defaultAspectRatio =
          img.aspectRatio ||
          (img.type === 'portrait'
            ? '3:4'
            : '16:9');

        try {
          const response = await fetchWithRetry('/api/imagen', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: img.prompt,
              style: defaultStyle,
              isMythos: isMythosEffective,
              era: activeEra,
              aspectRatio: defaultAspectRatio,
              preferredProvider:
                options.aiSettings?.replicateSettings?.imageProvider || 'auto',
            }),
          });
          const result = await response.json();
          if (result.imageUrl) {
            generatedUrls.push(result.imageUrl);
            generatedTypes.push(img.type || 'scene');

            // Zapisz wygenerowany kadr lokacji do cache na przyszłe wizyty (TYLKO dla typu location!)
            if (isLocation && loc) {
              void persistentMediaCache
                .setLocationImage(loc, result.imageUrl)
                .catch(() => {});
            }
          }
        } catch (error) {
          console.error('Image Error:', error);
        }
      }

      if (generatedUrls.length > 0) {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id !== messageId) return msg;
            // IND-262: zapis obrazów do IndexedDB (persistentMediaCache, store
            // chat-images) + lekkie klucze cache w wiadomości. base64 zostaje w
            // generatedImages dla natychmiastowego renderu w sesji; po reloadzie
            // generatedImages stripowane z localStorage, więc hydrują z cache.
            const startIdx = msg.generatedImages?.length ?? 0;
            const newCacheIds = generatedUrls.map((url, i) => {
              const idx = startIdx + i;
              // fire-and-forget: błąd zapisu cache NIE blokuje renderu base64.
              // setChatImage jest idempotentny (klucz messageId_idx) → StrictMode
              // double-invoke updatera nieszkodliwy.
              void persistentMediaCache
                .setChatImage(messageId, idx, url)
                .catch(() => {});
              return `${messageId}_${idx}`;
            });
            return {
              ...msg,
              generatedImages: [
                ...(msg.generatedImages || []),
                ...generatedUrls,
              ],
              generatedImageTypes: [
                ...(msg.generatedImageTypes || []),
                ...generatedTypes,
              ],
              generatedImageCacheIds: [
                ...(msg.generatedImageCacheIds || []),
                ...newCacheIds,
              ],
            };
          })
        );

        // Synchronizacja portretów NPC z Dziennikiem oraz pamięcią persistentMediaCache
        const portraitUpdates = illustrations
          .map((img, idx) => ({ img, url: generatedUrls[idx] }))
          .filter(
            (update): update is { img: ImageToGenerate; url: string } =>
              update.img.type === 'portrait' &&
              Boolean(update.img.portraitName) &&
              Boolean(update.url)
          );

        if (portraitUpdates.length > 0) {
          portraitUpdates.forEach(({ img, url }) => {
            if (img.portraitName && url) {
              void persistentMediaCache
                .setNpcPortrait(img.portraitName, url)
                .catch(() => {});
              visualBeliefGraphRef.current.setPortrait(img.portraitName, url);
            }
          });

          setCharacters((prevChars) => {
            let changed = false;
            const newChars = prevChars.map((char) => {
              if (!char.journal) return char;
              let charChanged = false;
              const newJournal = char.journal.map((entry) => {
                if (entry.type === 'npc') {
                  const update = portraitUpdates.find(
                    (pu) =>
                      pu.img.portraitName!.toLowerCase() ===
                      entry.title.toLowerCase()
                  );
                  if (update && entry.imageUrl !== update.url) {
                    charChanged = true;
                    return { ...entry, imageUrl: update.url };
                  }
                }
                return entry;
              });
              if (charChanged) {
                changed = true;
                return { ...char, journal: newJournal };
              }
              return char;
            });

            if (changed) {
              setTimeout(() => {
                if (typeof window !== 'undefined') persistCharacters(newChars);
              }, 0);

              setActiveCharacter((prevActive) => {
                if (!prevActive) return prevActive;
                const updatedActive = newChars.find(
                  (c) => c.id === prevActive.id
                );
                return updatedActive || prevActive;
              });
            }
            return changed ? newChars : prevChars;
          });
        }

        // Synchronizacja ilustracji przedmiotów ze stanem ekwipunku i dziennika
        const itemUpdates = illustrations
          .map((img, idx) => ({ img, url: generatedUrls[idx] }))
          .filter(
            (update) =>
              update.img.type === 'item' && update.img.itemName && update.url
          );

        if (itemUpdates.length > 0) {
          setCharacters((prevChars) => {
            let changed = false;
            const newChars = prevChars.map((char) => {
              let charChanged = false;
              const newEq = (char.equipment || []).map((eq) => {
                const match = itemUpdates.find(
                  (iu) =>
                    iu.img.itemName!.toLowerCase() === eq.name.toLowerCase()
                );
                if (match && !eq.imageUrl) {
                  charChanged = true;
                  return {
                    ...eq,
                    imageUrl: match.url,
                    visualSource: 'generated' as const,
                  };
                }
                return eq;
              });
              const newJournal = (char.journal || []).map((entry) => {
                if (entry.type === 'item') {
                  const match = itemUpdates.find(
                    (iu) =>
                      iu.img.itemName!.toLowerCase() ===
                      entry.title.toLowerCase()
                  );
                  if (match && entry.imageUrl !== match.url) {
                    charChanged = true;
                    return { ...entry, imageUrl: match.url };
                  }
                }
                return entry;
              });
              if (charChanged) {
                changed = true;
                return { ...char, equipment: newEq, journal: newJournal };
              }
              return char;
            });

            if (changed) {
              setTimeout(() => {
                if (typeof window !== 'undefined') persistCharacters(newChars);
              }, 0);

              setActiveCharacter((prevActive) => {
                if (!prevActive) return prevActive;
                const updatedActive = newChars.find(
                  (c) => c.id === prevActive.id
                );
                return updatedActive || prevActive;
              });
            }
            return changed ? newChars : prevChars;
          });
        }
      }
    },
    [setCharacters, setActiveCharacter]
  );

  const handleSendMessage = useCallback(
    async (
      message: string,
      mechanicsContext?: MechanicsContext,
      runtimeOverride?: {
        characters: Character[];
        activeCharacter: Character | null;
      }
    ) => {
      // Issue #79 (Decyzja 1A): Natychmiast ucisz lektora i przerwij wiszące odtwarzanie TTS
      stopCurrentAudio?.();

      // Retro Cheat Interceptor (0 ms, 0 tokenów, wykonanie lokalne)
      if (isCheatCommand(message)) {
        const currentGameTime = timeManager.getTime();
        const userMsg: Message = {
          id: crypto.randomUUID(),
          role: 'user',
          content: message,
          timestamp: new Date(),
          gameTime: currentGameTime,
        };
        setMessages((prev) => [...prev, userMsg]);

        const locale =
          typeof window !== 'undefined' &&
          window.location.pathname.startsWith('/en')
            ? 'en'
            : 'pl';
        const execRes = executeCheatCommand(message, activeCharacter, locale);

        if (execRes.characterUpdates && activeCharacter) {
          const updatedChar: Character = {
            ...activeCharacter,
            ...execRes.characterUpdates,
          };
          setActiveCharacter(updatedChar);
          setCharacters((prev) =>
            prev.map((c) => (c.id === updatedChar.id ? updatedChar : c))
          );
          if (typeof window !== 'undefined') {
            persistCharacters(
              characters.map((c) => (c.id === updatedChar.id ? updatedChar : c))
            );
          }
        }

        if (execRes.openCombatModal) {
          setCheatCombatModal(execRes.openCombatModal);
        }
        if (execRes.openChaseModal) {
          const defaultPursuer = {
            id: 'pursuer_1',
            name: locale === 'en' ? 'The pursuer' : 'Ścigający',
            isPlayer: false,
            mov: 7,
            dex: 40,
            speedCheckValue: 50,
            skillValues: {
              Wspinaczka: 40,
              Zręczność: 40,
              Skakanie: 30,
            },
            segmentIndex: 0,
          };
          const chaseState =
            activeChaseState?.status === 'ongoing'
              ? activeChaseState
              : createChaseState({
                  fleeing: {
                    id: activeCharacter?.id || 'char_player',
                    name:
                      activeCharacter?.name ||
                      (locale === 'en' ? 'Investigator' : 'Badacz'),
                    isPlayer: true,
                    mov: activeCharacter?.move ?? 8,
                    dex: activeCharacter?.dex ?? 0,
                    segmentIndex: 2,
                  },
                  pursuers: [defaultPursuer],
                  ...(typeof activeCharacter?.con === 'number'
                    ? {
                        fleeingSpeedRoll: speedRollOutcomeFromCheck(
                          evaluateSkillCheck(rollD100(), activeCharacter.con)
                        ),
                      }
                    : {}),
                  pursuerSpeedRolls: {
                    pursuer_1: speedRollOutcomeFromCheck(
                      evaluateSkillCheck(
                        rollD100(),
                        defaultPursuer.speedCheckValue
                      )
                    ),
                  },
                });
          setActiveChaseState(chaseState);
          activeChaseStateRef.current = chaseState;
        }
        if (execRes.toastMessage) {
          toast({
            title: 'Cheat Engine',
            description: execRes.toastMessage,
          });
        }

        if (execRes.assistantMessage) {
          const assistantMsg: Message = {
            id: execRes.assistantMessage.id || crypto.randomUUID(),
            role: 'assistant',
            content: execRes.assistantMessage.content || '',
            timestamp: new Date(),
            gameTime: currentGameTime,
            chaseState: (execRes.rawCommand?.includes('CHASE') || execRes.rawCommand?.includes('POŚCIG'))
              ? activeChaseStateRef.current ?? undefined
              : undefined,
            skillTests: execRes.assistantMessage.skillTests,
            hazardEvents: execRes.assistantMessage.hazardEvents,
            spellCastEvents: execRes.assistantMessage.spellCastEvents,
            tomeStudyEvents: execRes.assistantMessage.tomeStudyEvents,
            acquiredItems: execRes.assistantMessage.acquiredItems,
            generatedImages: execRes.assistantMessage.generatedImages,
            pendingMeleeAttacks: execRes.assistantMessage.pendingMeleeAttacks,
            diceRollEvents: execRes.assistantMessage.diceRollEvents,
          };
          setMessages((prev) => [...prev, assistantMsg]);
        }
        return true;
      }

      // IND-174: race condition guard. Chroni przed concurrent calls (double-click,
      // szybkie Enter, rapid programmatic invocation), które bez tego prowadziły do
      // przeplatania content streams w setMessages.map callbackach onText/onMetadata
      // dla różnych assistantMessageId. Send button w ChatWindow NIE jest disabled
      // na isLoading (lin 403: disabled={!newMessage.trim()}), więc guard tutaj jest
      // jedyną linią obrony.
      if (isLoading) return false;

      const requestCharacters = runtimeOverride?.characters ?? characters;
      const requestCharacter = runtimeOverride?.activeCharacter ?? activeCharacter;

      if (message.includes('[KONIEC_SESJI]')) {
        setSessionEndStatus('awaiting_player_closure');
      }

      let outgoingApiMessage = message;
      if (
        sessionEndStatus === 'awaiting_player_closure' &&
        !message.includes('[KONIEC_SESJI]')
      ) {
        outgoingApiMessage = `${message}\n[KONIEC_SESJI:FINAL]`;
      }

      const currentGameTime = timeManager.getTime();

      // Reducer pościgu CoC 7e RAW: jeśli trwa pościg i gracz przesyła wynik testu kości
      if (
        activeChaseStateRef.current?.status === 'ongoing' &&
        (message.includes('[DICE_ROLL]') || message.includes('🎲') || message.includes('Test:'))
      ) {
        const upper = message.toUpperCase();
        let rollOutcome: 'critical' | 'extreme' | 'hard' | 'regular' | 'fail' | 'fumble' | null = null;
        if (upper.includes('CRITICAL') || upper.includes('KRYTYCZNY')) rollOutcome = 'critical';
        else if (upper.includes('EXTREME') || upper.includes('EKSTREMALNY')) rollOutcome = 'extreme';
        else if (upper.includes('HARD') || upper.includes('TRUDNY')) rollOutcome = 'hard';
        else if (upper.includes('FUMBLE') || upper.includes('PECH') || upper.includes('FARSA')) rollOutcome = 'fumble';
        else if (upper.includes('FAIL') || upper.includes('PORAŻKA') || upper.includes('PORAZKA')) rollOutcome = 'fail';
        else if (upper.includes('REGULAR') || upper.includes('ZWYKŁY') || upper.includes('ZWYKLY') || upper.includes('SUKCES')) rollOutcome = 'regular';

        if (rollOutcome) {
          const updatedChase = advanceChaseOnSkillRoll(activeChaseStateRef.current, rollOutcome);
          setActiveChaseState(updatedChase);
          activeChaseStateRef.current = updatedChase;
        }
      }

      const effectiveMechanicsContext = {
        ...mechanicsContext,
        ...(activeChaseStateRef.current?.status === 'ongoing' && !mechanicsContext?.chase
          ? { chase: activeChaseStateRef.current }
          : {}),
      };
      const resolvedMechanicsContext =
        Object.keys(effectiveMechanicsContext).length > 0
          ? effectiveMechanicsContext
          : undefined;

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: message,
        timestamp: new Date(),
        gameTime: currentGameTime,
        mechanicsContext: resolvedMechanicsContext,
      };
      if (resolvedMechanicsContext?.chase) {
        setActiveChaseState(resolvedMechanicsContext.chase);
        activeChaseStateRef.current = resolvedMechanicsContext.chase;
      }
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      hasTriggeredSanShockThisTurnRef.current = false;

      const sessionStartedAt =
        typeof window !== 'undefined'
          ? parseInt(localStorage.getItem('session_started_at') ?? '0', 10)
          : 0;
      trackEvent('chat_message_sent', {
        messageNumber: messages.length + 1,
        messageLength: message.length,
        sessionDurationMin: sessionStartedAt
          ? Math.round((Date.now() - sessionStartedAt) / 60000)
          : 0,
        voiceEnabled,
        hasCharacter: !!requestCharacter,
      });

      const assistantMessageId = crypto.randomUUID();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        gameTime: currentGameTime,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      lastSentUserMessageRef.current = message;
      currentAssistantMessageIdRef.current = assistantMessageId;
      currentUserMessageIdRef.current = userMessage.id;

      try {
        // Doktryna Czystego Emulatora BYOB - Dwuskładnikowy Bloker Sesji (Runtime Hard Guard)
        const hasKey = typeof hasRequiredKeys === 'function' ? hasRequiredKeys() : true;
        const isTestEnv = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
        const hasRules =
          isTestEnv ||
          (typeof window !== 'undefined' &&
            (localStorage.getItem('rules_onboarding_completed') === 'true' ||
             !!localStorage.getItem('coc7_rulebook_profile')));

        if (!hasKey || !hasRules) {
          const locale =
            typeof window !== 'undefined' &&
            window.location.pathname.startsWith('/en')
              ? 'en'
              : 'pl';

          const warningContent = !hasKey
            ? (locale === 'en'
                ? '⚠️ API Key required. Please configure your API key to start the investigation.'
                : '⚠️ Wymagany klucz API. Skonfiguruj klucz API, aby rozpocząć śledztwo.')
            : (locale === 'en'
                ? '⚠️ CoC 7e Rulebook required (BYOB Clean Emulator). Upload your Quick-Start Rules or Keeper Rulebook to enable the Game Master.'
                : '⚠️ Wymagana Księga Zasad CoC 7e (Doktryna Czystego Emulatora BYOB). Wgraj Zasady Skrócone lub Księgę Strażnika, aby aktywować Mistrza Gry.');

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: warningContent }
                : msg
            )
          );
          setIsLoading(false);

          if (typeof window !== 'undefined') {
            if (!hasKey) {
              window.dispatchEvent(new CustomEvent('open-api-keys-modal'));
            } else {
              window.dispatchEvent(new CustomEvent('open-rulebook-modal'));
            }
          }
          return false;
        }

        if (
          turnsInCurrentLocationRef.current === 0 &&
          visitedMacroLocationsRef.current.length === 0 &&
          messages.some((m) => m.role === 'assistant' && m.content)
        ) {
          const derived = deriveSceneSensoryMemoryFromMessages(
            messages,
            currentLocationRef.current || adventureContext?.location
          );
          if (derived.currentLocation) {
            currentLocationRef.current = derived.currentLocation;
            setCurrentLocation(derived.currentLocation);
          }
          turnsInCurrentLocationRef.current = derived.turnsInCurrentLocation;
          visitedMacroLocationsRef.current = derived.visitedMacroLocations;
        }

        const prevLocationBeforeTurn = currentLocationRef.current;
        const hadVisitedAnyMacroBeforeTurn = visitedMacroLocationsRef.current.length > 0;

        const response = await fetchWithRetry('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortController.signal,
          body: JSON.stringify({
            message: outgoingApiMessage,
            messages: sanitizeHistoryForApi([...messages, userMessage]),
            pdfMemory,
            character: sanitizeCharacterForApi(requestCharacter),
            characters: (requestCharacters || []).map(
              (c) => sanitizeCharacterForApi(c) as Character
            ),
            npcs: loadNpcSnapshot(),
            assistantMessageId,
            userMessageId: userMessage.id,
            adventureContext,
            memoryScope: loadCampaignMemoryScope(),
            gameTime: timeManager.getTime(),
            currentLocation: currentLocationRef.current,
            turnsInCurrentLocation: turnsInCurrentLocationRef.current,
            visitedMacroLocations: visitedMacroLocationsRef.current,
            aiSettings: options.aiSettings,
            locale,
            hotSeatConfig: resolveHotSeatCharacterNames(
              hotSeatConfig,
              requestCharacters
            ),
            directorEvent: options.pendingDirectorEvent
              ? {
                  title: options.pendingDirectorEvent.title,
                  description: options.pendingDirectorEvent.description,
                }
              : undefined,
            mechanicsContext: resolvedMechanicsContext,
            guardrailState: guardrailStateRef.current,
          }),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          const serverMsg =
            (errorBody as Record<string, string>)?.error || response.statusText;
          throw new Error(`Chat API ${response.status}: ${serverMsg}`);
        }

        // Udane wysłanie - wyczyść oczekujące zdarzenie w UI (Faza 2 planu)
        if (options.clearPendingDirectorEvent) {
          options.clearPendingDirectorEvent();
        }

        let isGuardrailResponse = false;
        let streamedFullText = '';
        let hasSessionEndConfirmation = false;
        let lastFinishReason: string | undefined;
        let lastCostData: Message['costData'];
        const fullText = await parseSSEStream(response, {
          onText: (text) => {
            let cleanText = stripMeleeAttackTags(text);
            if (text.includes('[KONIEC_SESJI:POTWIERDZENIE]')) {
              cleanText = text
                .replace('[KONIEC_SESJI:POTWIERDZENIE]', '')
                .trimEnd();
              setSessionEndStatus('ended');
              setIsSessionEnded(true);
              setSessionSaveStatus('saving');
              hasSessionEndConfirmation = true;
              if (typeof window !== 'undefined') {
                const director = getGlobalLightDirector();
                director.onSessionEnd().catch(() => {});
              }
            }

            // Reżyseria oświetlenia Philips Hue w locie (Q1 -> A)
            if (typeof window !== 'undefined') {
              const locMatch = extractLatestTagLocation(text);
              if (
                locMatch &&
                locMatch.name.length <= 45 &&
                !isVisualPromptLeak(locMatch.name)
              ) {
                const now = Date.now();
                if (now - lastHueLocationChangeTimeRef.current >= 10000) {
                  lastHueLocationChangeTimeRef.current = now;
                  const director = getGlobalLightDirector();
                  const mood = director.evaluateEnvironmentMood({
                    locationText: locMatch.name,
                    hour: typeof currentGameTime?.hour === 'number' ? currentGameTime.hour : undefined,
                  });
                  director.applyPreset(mood).catch(() => {});
                }
              }

              // Reset budżetu sceny przy cięciu reżyserskim [ZMIANA_SCENY] (Issue #789)
              if (/\[(?:ZMIANA_SCENY|SCENE_CHANGE)\b/i.test(text)) {
                sceneSFXBudgetRef.current = {
                  hasPlayedGunshot: false,
                  hasPlayedThunder: false,
                  hasPlayedSanShock: false,
                };
              }

              // 1. Szok SAN (Somatyczny mrok + szept utraty poczytalności)
              if (
                !sceneSFXBudgetRef.current.hasPlayedSanShock &&
                /\[SANITY:\s*(?:@[^:]+:\s*)?-\d+/i.test(text)
              ) {
                sceneSFXBudgetRef.current.hasPlayedSanShock = true;
                hasTriggeredSanShockThisTurnRef.current = true;
                playSFX('sanity_loss_whisper');
                const director = getGlobalLightDirector();
                director.triggerSanityShock().catch(() => {});
              }

              // 2. Wystrzał w scenie (Kinowy akcent One-Shot per Scene z rozbłyskiem Hue)
              if (!sceneSFXBudgetRef.current.hasPlayedGunshot) {
                const isGunshotEvent =
                  /\[\s*(?:WALKA_ATAK|ATAK_WALKA|OPPOSED_MELEE|WALKA|COMBAT|BROŃ|WEAPON)\s*:[^\]]*(?:pistolet|rewolwer|strzelb|karabin|shotgun|tommy|gun|shot|paln)\b/i.test(text) ||
                  /\[TEST:\s*(?:Broń palna|Strzelectwo|Pistolet|Strzelba|Karabin|Firearms)\b/i.test(text);

                if (isGunshotEvent) {
                  sceneSFXBudgetRef.current.hasPlayedGunshot = true;
                  let sfxId = 'gunshot';
                  if (/strzelb|shotgun|obrzyn/i.test(text)) sfxId = 'shotgun_blast';
                  else if (/tommy|automat|seri/i.test(text)) sfxId = 'tommy_gun_burst';
                  else if (/karabin|rifle/i.test(text)) sfxId = 'rifle_shot_bolt';
                  else if (/derringer/i.test(text)) sfxId = 'derringer_pocket_shot';

                  playSFX(sfxId);
                  const director = getGlobalLightDirector();
                  director.triggerGunshotFlash().catch(() => {});
                }
              }

              // 3. Piorun w burzowej scenie (Fizyka diegetyczna: błysk natychmiast, grzmot po 300 ms)
              if (!sceneSFXBudgetRef.current.hasPlayedThunder) {
                const isThunderEvent =
                  /\[POGODA:[^\]]*(?:burz|piorun|nawałnic|storm|thunder)\b/i.test(text) ||
                  /\b(?:piorun\s+uderzył|zagrzmiało|błyskawica\s+rozcięła|huk\s+grzmotu)\b/i.test(text);

                if (isThunderEvent) {
                  sceneSFXBudgetRef.current.hasPlayedThunder = true;
                  const director = getGlobalLightDirector();
                  director.triggerLightningFlash().catch(() => {});
                  setTimeout(() => {
                    playSFX('thunder');
                  }, 300);
                }
              }
            }
            streamedFullText = cleanText;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: cleanText }
                  : msg
              )
            );
            if (voiceEnabled && isTTSEnabled && !isGuardrailResponse) {
              options.addToQueue(cleanText, assistantMessageId);
            }
          },
          onMetadata: (metadata) => {
            if (metadata.guardrail) {
              isGuardrailResponse = true;
            }
            notifyMemoryCommit(metadata, locale);
            if (
              Array.isArray(metadata.pendingMeleeAttacks) &&
              metadata.pendingMeleeAttacks.length > 0 &&
              typeof window !== 'undefined'
            ) {
              const attacks = metadata.pendingMeleeAttacks as PendingMeleeAttack[];
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, pendingMeleeAttacks: attacks }
                    : msg
                )
              );
              const existing = combatJournalRef.current;
              const journal =
                existing?.roundId === attacks[0].roundId
                  ? existing
                  : createCombatRoundJournal({
                      attacks,
                      roster: requestCharacters,
                      roundSeed: crypto.randomUUID(),
                    });
              combatJournalRef.current = journal;
              saveCombatJournal(localStorage, journal);
              setPendingCombatAttack(
                journal.attacks.find(
                  (attack) =>
                    !journal.resolutions.some(
                      (resolution) => resolution.eventId === attack.eventId
                    )
                ) ?? null
              );
            }
            if (
              Array.isArray(metadata.opposedMeleeEvents) &&
              metadata.opposedMeleeEvents.length > 0
            ) {
              const opposedMelee = metadata.opposedMeleeEvents as OpposedMeleeEventData[];
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, opposedMeleeEvents: opposedMelee }
                    : msg
                )
              );
            }
            // finishReason z metadanych (MAX_TOKENS/STOP) trafia na wiadomość -
            // steruje przyciskiem "Kontynuuj narrację" i logiką urwanych scen.
            if (metadata.finishReason) {
              lastFinishReason = String(metadata.finishReason);
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, finishReason: String(metadata.finishReason) }
                    : msg
                )
              );
            }

            // Telemetry: PostHog ai_request_completed (spawn task 2026-05-22).
            // Server (create-sse-stream) pisze `telemetry` namespace, klient emituje.
            // PostHog jest browser-only (posthog-js), więc emit MUSI być client-side.
            if (metadata.telemetry) {
              const t = metadata.telemetry as Record<
                string,
                string | number | boolean | null
              >;
              trackEvent('ai_request_completed', {
                endpoint: '/api/chat',
                provider: 'gemini',
                ...t,
              });
            }

            // Metadane costData zapisz do wiadomości
            if (metadata.costData) {
              lastCostData = metadata.costData;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, costData: metadata.costData }
                    : msg
                )
              );
            }

            // Detekcja nowego czasu w grze z odpowiedzi AI
            if (metadata.timeUpdate) {
              const newTime = metadata.timeUpdate as GameTime;
              timeManager.setTime(newTime);
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, gameTime: newTime }
                    : msg
                )
              );
            }

            // Bug 2: tacka testów [TEST:...] - dociągnij skillValue z karty postaci
            // i dopisz do wiadomości (render w MessageCard przez SkillTestCard).
            if (
              Array.isArray(metadata.skillTests) &&
              metadata.skillTests.length > 0
            ) {
              const resolvedTests = resolveSkillTestValues(
                metadata.skillTests as unknown as SkillTestData[],
                requestCharacter,
                requestCharacters
              );
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, skillTests: resolvedTests }
                    : msg
                )
              );
            }

            if (voiceEnabled && isTTSEnabled && !isGuardrailResponse) {
              // M6 sesja 146: drop multi-voice branch per D3. Wszystkie wiadomości
              // (włącznie z scenami NPC dialogów) idą przez generateVoiceForMessage
              // sekwencyjnie, używając ustawionego ttsVoice.
              generateVoiceForMessage(
                { ...assistantMessage, content: streamedFullText },
                [...messages, userMessage]
              );
            }

            const era =
              adventureContext?.yearRange ||
              adventureContext?.eraLabel ||
              adventureContext?.era ||
              '1920s';

            // 1. Najpierw synchronizuj zdarzenia lokacji i nowo spotkanych NPC z parsedEvents
            // do VisualBeliefGraph i stanu currentLocationRef, aby reżyser sceny (directSceneIllustrations)
            // dysponował kompletnym grafem przekonań wizualnych na bieżącą turę.
            const parsed = metadata.parsedEvents;
            if (Array.isArray(parsed)) {
              for (const e of parsed) {
                if (e && typeof e === 'object') {
                  const ev = e as { type?: string; title?: string; description?: string };
                  if (ev.type === 'npc' && ev.title) {
                    const rawName = ev.title.replace(/^Spotkano:\s*/i, '').trim();
                    if (rawName) {
                      visualBeliefGraphRef.current.registerNPC(
                        {
                          id: rawName.toLowerCase(),
                          name: rawName,
                          description: ev.description || '',
                        },
                        era
                      );
                    }
                  } else if (ev.type === 'location' && ev.title) {
                    const name = sanitizeLocationName(ev.title);
                    if (name && name.length <= 45 && !isVisualPromptLeak(name)) {
                      visualBeliefGraphRef.current.updateLocation(name, {
                        atmosphere: ev.description || undefined,
                      });
                    }
                  }
                }
              }

              const locEvent = [...parsed]
                .reverse()
                .find(
                  (e) =>
                    !!e &&
                    typeof e === 'object' &&
                    (e as { type?: string }).type === 'location'
                ) as { title?: string; description?: string } | undefined;
              const rawTitle = locEvent?.title;
              if (typeof rawTitle === 'string' && rawTitle.trim()) {
                const name = sanitizeLocationName(rawTitle);
                if (name && name.length <= 45 && !isVisualPromptLeak(name)) {
                  currentLocationRef.current = name;
                  setCurrentLocation(name);
                  visualBeliefGraphRef.current.updateLocation(name, {
                    atmosphere: locEvent?.description || undefined,
                  });
                }
              }
            }

            // 2. Proaktywny reżyser kadrów i generowanie obrazów (z zaktualizowanym grafem)
            if (
              options.aiSettings?.imageGenerationEnabled !== false &&
              metadata.illustrations &&
              metadata.illustrations.length > 0
            ) {
              const now = Date.now();
              // IND-259: throttle zależny od trybu narracji + suwaka częstotliwości
              // (ten sam poziom co prompt). Mniej narracji = krótsza przerwa.
              const imageCooldown = imageCooldownMsForLevel(
                resolveImageLevel(
                  options.aiSettings?.sessionZero?.narrativeMode,
                  options.aiSettings?.replicateSettings?.imageFrequency
                )
              );
              // Reset licznika obrazów przy zmianie sceny (lokacji).
              const sceneKey = currentLocationRef.current;
              if (sceneKey !== lastTrackedSceneRef.current) {
                lastTrackedSceneRef.current = sceneKey;
                sceneImageCountRef.current = 0;
                lastIllustratedLocationRef.current = '';
              }
              const illustrationsList =
                metadata.illustrations as unknown as ImageToGenerate[];
              const hasHighPriority = illustrationsList.some(
                (img) =>
                  img.priority === 'high' ||
                  img.isMythos ||
                  img.type === 'monster' ||
                  img.type === 'vision'
              );

              if (
                hasHighPriority ||
                (now - lastImageTime >= imageCooldown &&
                  sceneImageCountRef.current < MAX_IMAGES_PER_SCENE)
              ) {
                setLastImageTime(now);
                if (!hasHighPriority) {
                  sceneImageCountRef.current += 1;
                }
                // DeepMind Proactive T2I Scene Director:
                // Zamiast naiwnego slice(0, 1), proaktywny reżyser ocenia wagę dramaturgiczną,
                // dobiera 1-3 zbalansowane kadry (lokacja / NPC / poszlaka / Mity)
                // i wzbogaca je o Visual Belief Graph.
                const maxAllowed = options.aiSettings?.replicateSettings?.maxImagesPerMessage ?? 1;
                const freq = options.aiSettings?.replicateSettings?.imageFrequency || 'normal';

                const directorResult = directSceneIllustrations(illustrationsList as unknown as import('@/lib/parsers/types').ImageRequest[], {
                  maxImagesPerMessage: maxAllowed,
                  imageFrequency: freq,
                  effectiveEraOrYear: era,
                  beliefGraph: visualBeliefGraphRef.current,
                });

                // Zapobieganie powielaniu kadrów tej samej lokacji w kolejnych wiadomościach
                const filteredShots = directorResult.shots.filter((s) => {
                  const isLoc = s.role === 'establishing_location' || s.request.type === 'location';
                  if (!isLoc) return true;
                  const locName = (s.request.locationName || currentLocationRef.current || sceneKey || '').trim().toLowerCase();
                  if (locName && lastIllustratedLocationRef.current && locName === lastIllustratedLocationRef.current) {
                    return false;
                  }
                  return true;
                });

                if (filteredShots.length > 0) {
                  filteredShots.forEach((s) => {
                    const isLoc = s.role === 'establishing_location' || s.request.type === 'location';
                    if (isLoc) {
                      const locName = (s.request.locationName || currentLocationRef.current || sceneKey || '').trim().toLowerCase();
                      if (locName) {
                        lastIllustratedLocationRef.current = locName;
                      }
                    }
                  });

                  const curatedImages: ImageToGenerate[] = filteredShots.map((s) => ({
                    ...s.request,
                    prompt: s.enrichedPrompt,
                    aspectRatio: s.aspectRatio,
                  }));
                  generateImages(curatedImages, assistantMessageId);
                }
              }
            }
          },
          // Defensive-in-depth (po IND-256): bez tego callbacku KAŻDY wyjątek
          // rzucony w onText/onMetadata był cicho połykany przez try/catch
          // parsera. Teraz prawdziwe błędy trafiają do Sentry + console.error
          // (partial-chunki JSON / SyntaxError są pomijane).
          onParseError: createSseParseErrorHandler({
            endpoint: '/api/chat',
            hook: 'useChat',
          }),
        });

        // IND-201: auto-dziennik. Po pełnym streamie dopisz wpisy [DZIENNIK:] z
        // surowej narracji MG do character.journal (modal sesji). fullText jest
        // surowy (tagi czyszczone dopiero w renderze), więc niesie [DZIENNIK:].
        // appendJournalFromText jest idempotentne (dedup po messageId).
        let finalActiveChar = activeCharacter;
        let finalCharacters = characters;
        if (activeCharacter) {
          const currentEra =
            adventureContext?.yearRange ||
            adventureContext?.eraLabel ||
            adventureContext?.era ||
            '1920s';

          // Rejestracja nowo napotkanych NPC z tagów [NPC:] / [DZIENNIK:npc:] w VisualBeliefGraph
          const extractedNpcs = extractNpcTags(fullText);
          for (const npcTag of extractedNpcs) {
            visualBeliefGraphRef.current.registerNPC(
              {
                id: npcTag.name.toLowerCase(),
                name: npcTag.name,
                description: npcTag.description,
              },
              currentEra
            );
          }

          // Duet/Hot Seat: kieruj wpisy [DZIENNIK:] i zmiany SAN/HP do postaci
          // wskazanej prefiksem @Imię w tagu (fallback: aktywna postać). Najpierw
          // dziennik, potem staty - oba na tej samej liście postaci, jeden persist.
          // No-op (changed=false) gdy brak tagów → tani skip zapisu.
          const scope = loadCampaignMemoryScope();
          const participantIds = hotSeatConfig?.enabled
            ? hotSeatConfig.players.map((player) => player.characterId).filter((id): id is string => Boolean(id))
            : [activeCharacter.id];
          const prepared = scope ? beginChronicleTurn(characters, activeCharacter, {
            scope,
            adventureTitle: adventureContext?.title,
            participantIds,
            startMessageId: userMessage.id,
            location: currentLocationRef.current || adventureContext?.location,
          }) : { characters, activeCharacter, changed: false };
          const partyCharacters = scope ? prepared.characters.filter((character) => character.id === activeCharacter.id || participantIds.includes(character.id)) : prepared.characters;
          if (scope && !partyCharacters.some((character) => character.id === activeCharacter.id)) partyCharacters.push(prepared.activeCharacter);
          let j = appendJournalToParty(
            partyCharacters,
            prepared.activeCharacter,
            fullText,
            assistantMessageId
          );
          const sessionEnded = hasSessionEndConfirmation || fullText.includes('[KONIEC_SESJI:POTWIERDZENIE]');
          const updateChronicle = (character: Character): Character => {
            if (!scope || (character.id !== activeCharacter.id && !participantIds.includes(character.id))) return character;
            const previous = characters.find((candidate) => candidate.id === character.id) ?? activeCharacter;
            const stamped = stampChronicleEntries(character, previous);
            return sessionEnded && stamped.chronicleSession?.sessionId === prepared.activeCharacter.chronicleSession?.sessionId
              ? closeChronicleSession(stamped, assistantMessageId, fullText) : stamped;
          };
          const chapterCharacters = j.characters.map(updateChronicle);
          j = {
            characters: chapterCharacters,
            activeCharacter: chapterCharacters.find((character) => character.id === activeCharacter.id) ?? updateChronicle(j.activeCharacter),
            changed: j.changed || prepared.changed || (sessionEnded && Boolean(prepared.activeCharacter.chronicleSession)),
          };
          if (j.activeCharacter.investigatorDossier?.npcs) {
            for (const npc of j.activeCharacter.investigatorDossier.npcs) {
              visualBeliefGraphRef.current.registerNPC(npc, currentEra);
            }
          }
          const s = applyStatChangesToParty(
            j.characters,
            j.activeCharacter,
            fullText,
            (ev) => {
              if (ev.type === 'int_check_required') {
                toast({
                  title:
                    locale === 'pl'
                      ? 'Wymagany Test Inteligencji (≥ 5 SAN)'
                      : 'Intelligence Test Required (≥ 5 SAN)',
                  description: ev.message[locale === 'pl' ? 'pl' : 'en'],
                });
              } else if (ev.type === 'indefinite_insanity') {
                toast({
                  title:
                    locale === 'pl'
                      ? 'Czasowa Niepoczytalność (1/5 SAN)'
                      : 'Indefinite Insanity (1/5 SAN)',
                  description: ev.message[locale === 'pl' ? 'pl' : 'en'],
                });
              } else if (ev.type === 'bout_of_madness') {
                toast({
                  title:
                    locale === 'pl' ? 'Atak Szaleństwa' : 'Bout of Madness',
                  description: ev.message[locale === 'pl' ? 'pl' : 'en'],
                });
              } else if (ev.type === 'permanent_insanity') {
                toast({
                  title:
                    locale === 'pl'
                      ? 'Nieodwracalny Obłęd (0 SAN)'
                      : 'Permanent Insanity (0 SAN)',
                  description: ev.message[locale === 'pl' ? 'pl' : 'en'],
                });
              }
            }
          );
          const eq = applyEquipmentEventsToParty(
            s.characters,
            s.activeCharacter,
            fullText,
            (notif) => {
              if (notif.type === 'use') {
                toast({
                  title: locale === 'pl' ? 'Zużyto ekwipunek' : 'Item Used',
                  description:
                    locale === 'pl'
                      ? `${notif.characterName}: ${notif.itemName} (pozostało: ${notif.remaining})`
                      : `${notif.characterName}: ${notif.itemName} (${notif.remaining} left)`,
                });
              } else if (notif.type === 'remove') {
                toast({
                  title:
                    locale === 'pl'
                      ? 'Przedmiot wyczerpany / utracony'
                      : 'Item Depleted / Lost',
                  description:
                    locale === 'pl'
                      ? `${notif.characterName}: ${notif.itemName}`
                      : `${notif.characterName}: ${notif.itemName}`,
                });
              } else if (notif.type === 'add') {
                toast({
                  title:
                    locale === 'pl' ? 'Nowy przedmiot' : 'New Item Acquired',
                  description:
                    locale === 'pl'
                      ? `${notif.characterName}: ${notif.itemName}`
                      : `${notif.characterName}: ${notif.itemName}`,
                });
              }
            }
          );
          let updatedActiveCharacter = eq.activeCharacter;
          let updatedCharacters = eq.characters;
          // A missing recap remains eligible on the next turn after a transient error.
          const pendingScenes = (j.activeCharacter.sceneCards ?? []).filter(
            (scene) => scene.isSealed && scene.endMessageId && scene.chronicleBoundaryKnown !== false &&
              !(scene.chronicleSummaryByLocale?.pl && scene.chronicleSummaryByLocale.en)
          );

          for (const pendingScene of pendingScenes) {
            const transcript = buildSceneChronicleTranscript([
              ...messages,
              userMessage,
              { id: assistantMessageId, role: 'assistant', content: fullText },
            ], pendingScene);
            if (transcript.length === 0) continue;

            try {
              const summaryResponse = await fetchWithApiKeys(
                '/api/summarize-scene',
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    messages: transcript,
                    sceneLocation: pendingScene.location,
                    locale,
                  }),
                }
              );
              const summaryData = await summaryResponse.json();
              const summaries = summaryData.summaries as
                | Partial<Record<'pl' | 'en', string>>
                | undefined;
              if (
                summaryResponse.ok &&
                summaryData.success &&
                summaries?.pl &&
                summaries.en
              ) {
                const summaryUpdate = appendSceneChronicleSummaryToParty(
                  updatedCharacters,
                  updatedActiveCharacter,
                  pendingScene.id,
                  summaries
                );
                updatedCharacters = summaryUpdate.characters;
                updatedActiveCharacter = summaryUpdate.activeCharacter;
              } else {
                console.warn('Scene chronicle summary was not saved.');
              }
            } catch (error) {
              console.warn('Scene chronicle summary request failed:', error);
            }
          }

          if (j.changed || s.changed || eq.changed || pendingScenes.length > 0) {
            if (scope) {
              const updates = new Map(updatedCharacters.map((character) => [character.id, character]));
              updatedCharacters = prepared.characters.map((character) => updates.get(character.id) ?? character);
              if (!updatedCharacters.some((character) => character.id === activeCharacter.id)) updatedCharacters.push(updatedActiveCharacter);
            }
            setActiveCharacter(updatedActiveCharacter);
            setCharacters(updatedCharacters);
            finalActiveChar = updatedActiveCharacter;
            finalCharacters = updatedCharacters;
            if (typeof window !== 'undefined') {
              persistCharacters(updatedCharacters);
            }
          }
        }

        // [PRZEDMIOT] pozostaje encyklopedią. Tylko osobny, świadomy tag tworzy
        // kartę "Dodaj do ekwipunku" - nigdy nie zgadujemy z zwykłej prozy MG.
        const acquiredItems = extractAcquiredItemProposals(
          fullText,
          assistantMessageId
        );
        if (acquiredItems.length > 0) {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantMessageId
                ? { ...message, acquiredItems }
                : message
            )
          );
        }

        // Zagrożenia środowiskowe CoC 7e RAW (Issue #60), czary i tomy (Issue #252), obrona (Faza 4), pościgi, weto sędziego (Issue #380) i kres postaci
        const hazardEvents = extractHazardEvents(fullText);
        const spellCastEvents = extractSpellCastEvents(fullText);
        const tomeStudyEvents = extractTomeStudyEvents(fullText);
        const opposedMagicEvents = extractOpposedMagicEvents(fullText);
        const opposedMeleeEvents = extractOpposedMeleeEvents(fullText);
        const firearmsAttackEvents = extractFirearmsAttackEvents(fullText);
        const refereeVetoEvents = extractRefereeVetoEvents(fullText);
        const gameOverEvents = extractGameOverEvents(fullText);

        const chaseStartTag = extractChaseTag(fullText);
        const chaseEndTag = extractChaseEndTag(fullText);

        if (chaseEndTag) {
          setActiveChaseState(null);
          activeChaseStateRef.current = null;
        } else if (
          chaseStartTag &&
          (!activeChaseStateRef.current || activeChaseStateRef.current.status !== 'ongoing')
        ) {
          const newChase = createInitialChaseFromTag({
            activeCharacter: finalActiveChar ?? activeCharacter,
            type: chaseStartTag.type,
            initialDistance: chaseStartTag.distance,
            opponentName: chaseStartTag.opponent,
            opponentMov: chaseStartTag.opponentMov,
            role: chaseStartTag.role,
            isShort: chaseStartTag.isShort,
            locale,
          });
          setActiveChaseState(newChase);
          activeChaseStateRef.current = newChase;
        }

        const currentChase = activeChaseStateRef.current;

        // Senne Wezwania CoC 7e RAW (Issue #787: diegetyczne okno snu w czacie)
        const dreamTag = extractDreamVisionTag(fullText);
        let dreamVisionEvent: import('@/lib/types').DreamVisionEventData | undefined;
        if (dreamTag) {
          const variant =
            ANCIENT_TREES_DREAM_VARIANTS[dreamTag.variantId] ||
            ANCIENT_TREES_DREAM_VARIANTS['restless-night'];
          const targetChar =
            (dreamTag.investigatorName
              ? characters.find(
                  (c) =>
                    c.name.toLowerCase().trim() ===
                    dreamTag.investigatorName?.toLowerCase().trim()
                )
              : null) || (finalActiveChar ?? activeCharacter);

          dreamVisionEvent = {
            id: `dream_${assistantMessageId}_${variant.id}`,
            variantId: variant.id,
            number: variant.number,
            title: locale === 'en' ? variant.titleEn : variant.titlePl,
            narrative: locale === 'en' ? variant.narrativeEn : variant.narrativePl,
            investigatorName: targetChar?.name,
            nightNumber: dreamTag.nightNumber || 1,
            status: 'active',
            mechanicalEffect: {
              sanityCheckRequired: variant.mechanicalResolution.sanityCheckRequired,
              sanityLossFormula: variant.mechanicalResolution.sanityLossFormula,
              conPenaltyDice: variant.mechanicalResolution.conPenaltyDice,
              subsequentTriggerLocation: variant.mechanicalResolution.subsequentTriggerLocation,
            },
          };
        }

        if (
          hazardEvents.length > 0 ||
          spellCastEvents.length > 0 ||
          tomeStudyEvents.length > 0 ||
          opposedMagicEvents.length > 0 ||
          opposedMeleeEvents.length > 0 ||
          firearmsAttackEvents.length > 0 ||
          refereeVetoEvents.length > 0 ||
          gameOverEvents.length > 0 ||
          currentChase ||
          dreamVisionEvent
        ) {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantMessageId
                ? {
                    ...message,
                    ...(hazardEvents.length > 0 ? { hazardEvents } : {}),
                    ...(spellCastEvents.length > 0 ? { spellCastEvents } : {}),
                    ...(tomeStudyEvents.length > 0 ? { tomeStudyEvents } : {}),
                    ...(opposedMagicEvents.length > 0 ? { opposedMagicEvents } : {}),
                    ...(opposedMeleeEvents.length > 0 ? { opposedMeleeEvents } : {}),
                    ...(firearmsAttackEvents.length > 0 ? { firearmsAttackEvents } : {}),
                    ...(refereeVetoEvents.length > 0 ? { refereeVetoEvents } : {}),
                    ...(gameOverEvents.length > 0 ? { gameOverEvents } : {}),
                    ...(currentChase ? { chaseState: currentChase } : {}),
                    ...(dreamVisionEvent ? { dreamVisionEvent } : {}),
                  }
                : message
            )
          );
          if (currentChase && currentChase.status !== 'ongoing') {
            setActiveChaseState(null);
            activeChaseStateRef.current = null;
          }
        }

        // Aktualizacja stanu guardrails i strike countera (Issue #380)
        if (refereeVetoEvents.length > 0) {
          guardrailStateRef.current = updateGuardrailState(
            guardrailStateRef.current,
            true,
            refereeVetoEvents[0].type
          );
        } else if (
          gameOverEvents.some(
            (e) =>
              e.reason?.includes('Serious Sam') ||
              e.newspaperSnippet?.headline?.includes('ROZERWANA TKANKA')
          )
        ) {
          guardrailStateRef.current = {
            strikeCount: 3,
            turnsSinceLastViolation: 0,
            lastViolationType: 'impossible',
          };
        } else {
          guardrailStateRef.current = updateGuardrailState(
            guardrailStateRef.current,
            false
          );
        }

        // IND-267: śledzenie lokacji. Najnowszy [LOKACJA:] z narracji MG zasila pineskę 📍
        // w headerze (currentLocation) i jest odsyłany do promptu w kolejnej turze
        // (currentLocationRef). Wpis dziennika typu `location` powstaje już w
        // appendJournalFromText - ten sam tor [LOKACJA:].
        const pushMacroIfAbsent = (locName: string) => {
          const macro = extractMacroLocation(locName);
          if (
            macro &&
            !visitedMacroLocationsRef.current.some(
              (existing) =>
                existing.toLowerCase().trim() === macro.toLowerCase().trim() ||
                isSameMacroLocation(existing, macro)
            )
          ) {
            visitedMacroLocationsRef.current.push(macro);
          }
        };

        const latestLocation = extractLatestTagLocation(fullText);
        if (latestLocation && latestLocation.name.length <= 45 && !isVisualPromptLeak(latestLocation.name)) {
          const prevLoc = prevLocationBeforeTurn.trim().toLowerCase();
          const nextLoc = latestLocation.name.trim().toLowerCase();
          if (!prevLoc || !hadVisitedAnyMacroBeforeTurn || prevLoc === nextLoc) {
            turnsInCurrentLocationRef.current += 1;
            pushMacroIfAbsent(latestLocation.name);
          } else {
            pushMacroIfAbsent(prevLocationBeforeTurn);
            turnsInCurrentLocationRef.current = 0;
            if (isSameMacroLocation(prevLocationBeforeTurn, latestLocation.name)) {
              pushMacroIfAbsent(latestLocation.name);
            }
          }
          currentLocationRef.current = latestLocation.name;
          setCurrentLocation(latestLocation.name);
          visualBeliefGraphRef.current.updateLocation(latestLocation.name, {
            atmosphere: latestLocation.description || undefined,
          });
        } else {
          // Brak nowego tagu [LOKACJA:] - tura upłynęła w tej samej lokacji
          turnsInCurrentLocationRef.current += 1;
          if (currentLocationRef.current) {
            pushMacroIfAbsent(currentLocationRef.current);
          }
        }

        // IND-230: Faza Rozwoju CoC. Po pełnym streamie wyłuskaj wyniki testów
        // [WYNIK:] z narracji MG (SKILL_RESULT_INSTRUCTIONS każe je emitować po
        // każdym teście) i przekaż do oznaczania umiejętności. Sukces bez Szczęścia
        // oznacza umiejętność do rozwoju (logika w extractSkillResults). Oznaczenia
        // konsumuje useSkillMarking w page.tsx -> Faza Rozwoju.
        if (onSkillResults) {
          const skillResults = extractSkillResults(fullText);
          if (skillResults.length > 0) {
            onSkillResults(skillResults);
          }
        }

        if (
          hasSessionEndConfirmation ||
          fullText.includes('[KONIEC_SESJI:POTWIERDZENIE]')
        ) {
          setSessionEndStatus('ended');
          setIsSessionEnded(true);
          const finalAssistantMsg: Message = {
            ...assistantMessage,
            content: streamedFullText,
            ...(lastFinishReason ? { finishReason: lastFinishReason } : {}),
            ...(lastCostData ? { costData: lastCostData } : {}),
            ...(acquiredItems.length > 0 ? { acquiredItems } : {}),
            ...(hazardEvents.length > 0 ? { hazardEvents } : {}),
            ...(spellCastEvents.length > 0 ? { spellCastEvents } : {}),
            ...(tomeStudyEvents.length > 0 ? { tomeStudyEvents } : {}),
            ...(opposedMagicEvents.length > 0 ? { opposedMagicEvents } : {}),
            ...(opposedMeleeEvents.length > 0 ? { opposedMeleeEvents } : {}),
            ...(refereeVetoEvents.length > 0 ? { refereeVetoEvents } : {}),
            ...(gameOverEvents.length > 0 ? { gameOverEvents } : {}),
          };
          const messagesToSave: Message[] = [
            ...messages,
            userMessage,
            finalAssistantMsg,
          ];
          messagesRef.current = messagesToSave;
          activeCharacterRef.current = finalActiveChar;
          charactersRef.current = finalCharacters;

          await executeSessionAutoSave(
            messagesToSave,
            finalActiveChar,
            finalCharacters
          );
        }

        if (currentAssistantMessageIdRef.current === assistantMessageId) {
          currentAssistantMessageIdRef.current = null;
          currentUserMessageIdRef.current = null;
          lastSentUserMessageRef.current = null;
        }

        return true;
      } catch (error) {
        const isAborted =
          abortController.signal.aborted ||
          (error instanceof DOMException && error.name === 'AbortError') ||
          (error instanceof Error &&
            (error.name === 'AbortError' || error.message.includes('aborted')));

        if (isAborted) {
          return false;
        }

        console.error('Błąd:', error);
        trackEvent('ai_error', {
          endpoint: '/api/chat',
          errorType:
            error instanceof Error ? error.constructor.name : 'Unknown',
          errorMessage: error instanceof Error ? error.message : String(error),
          messageNumber: messages.length + 1,
        });
        const errorStr = error instanceof Error ? error.message : String(error);
        const isAuthError =
          errorStr.includes('401') ||
          errorStr.includes('BYOK_KEY') ||
          errorStr.includes('API key');

        if (isAuthError && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('open-api-keys-modal'));
        }

        // Zadanie 6: po wyczerpaniu retry rozróżnij błąd autoryzacji i blip sieci od innego błędu.
        const friendly = isAuthError
          ? locale === 'en'
            ? '⚠️ The Gemini API key is invalid or expired. Enter a valid key in Settings (key icon in menu) and try again.'
            : '⚠️ Klucz Gemini API jest nieprawidłowy lub wygasł. Wklej poprawny klucz w Ustawieniach (ikona klucza w menu) i spróbuj ponownie.'
          : isNetworkBlip(error)
            ? locale === 'en'
              ? '⚠️ A temporary connection problem occurred - try sending your message again.'
              : '⚠️ Chwilowy problem z połączeniem - spróbuj wysłać wiadomość jeszcze raz.'
            : locale === 'en'
              ? 'I am sorry, an error occurred.'
              : 'Przepraszam, wystąpił błąd.';
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId ? { ...msg, content: friendly } : msg
          )
        );
        return false;
      } finally {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
        setIsLoading(false);
      }
    },
    [
      isLoading,
      messages,
      pdfMemory,
      activeCharacter,
      characters,
      setActiveCharacter,
      setCharacters,
      adventureContext,
      voiceEnabled,
      isTTSEnabled,
      generateVoiceForMessage,
      generateImages,
      lastImageTime,
      onSkillResults,
      hotSeatConfig,
      sessionEndStatus,
      activeChaseState,
      locale,
    ]
  );

  const pendingCombatDefensesUsed = pendingCombatAttack
    ? combatJournalRef.current?.resolutions.filter(
        (resolution) =>
          resolution.defenderId === pendingCombatAttack.target.characterId
      ).length ?? 0
    : 0;
  const combatDefender = pendingCombatAttack
    ? characters.find(
        (character) => character.id === pendingCombatAttack.target.characterId
      ) ?? null
    : null;
  const combatDefenseWeapons = getCombatDefenseWeapons(combatDefender);

  const handleCombatDefense = useCallback(
    async (
      attack: PendingMeleeAttack,
      choice: DefenseChoice,
      weapon?: CombatDefenseWeaponOption,
      maneuverType?: ManeuverType
    ) => {
      if (typeof window === 'undefined') return;
      const current = combatJournalRef.current;
      if (!current || current.roundId !== attack.roundId) return;

      const choiceJournal: CombatRoundJournal = {
        ...current,
        choices: {
          ...current.choices,
          [attack.eventId]: {
            choice,
            defenderWeaponId: weapon?.id,
            maneuverType,
          },
        },
      };
      saveCombatJournal(localStorage, choiceJournal);

      const resolved = resolveCombatJournalEvent({
        journal: choiceJournal,
        eventId: attack.eventId,
        choice,
        defenderWeapon: weapon,
        maneuverType,
      });
      combatJournalRef.current = resolved;
      saveCombatJournal(localStorage, resolved);

      const persisted = persistCharacters(resolved.nextRoster);
      if (!persisted.ok) {
        toast({
          title: locale === 'en' ? 'Combat not saved' : 'Nie zapisano walki',
          description:
            locale === 'en'
              ? 'Free browser storage and try the defense again.'
              : 'Zwolnij miejsce w pamięci przeglądarki i ponów obronę.',
          variant: 'destructive',
        });
        return;
      }

      setCharacters(resolved.nextRoster);
      setActiveCharacter((previous) =>
        previous
          ? resolved.nextRoster.find((character) => character.id === previous.id) ??
            previous
          : previous
      );

      const nextAttack = resolved.attacks.find(
        (candidate) =>
          !resolved.resolutions.some(
            (resolution) => resolution.eventId === candidate.eventId
          )
      );
      if (nextAttack) {
        setPendingCombatAttack(nextAttack);
        return;
      }

      const committing: CombatRoundJournal = {
        ...resolved,
        phase: 'committing',
      };
      combatJournalRef.current = committing;
      saveCombatJournal(localStorage, committing);
      setPendingCombatAttack(null);

      const nextActive = activeCharacter
        ? committing.nextRoster.find(
            (character) => character.id === activeCharacter.id
          ) ?? activeCharacter
        : null;
      const committedSuccessfully = await handleSendMessage(
        locale === 'en'
          ? 'Continue the scene from the resolved exchange of blows.'
          : 'Kontynuuj scenę od rozstrzygniętej wymiany ciosów.',
        { combat: { resolutions: committing.resolutions } },
        { characters: committing.nextRoster, activeCharacter: nextActive }
      );
      if (!committedSuccessfully) {
        setPendingCombatAttack(attack);
        toast({
          title: locale === 'en' ? 'Narration interrupted' : 'Przerwano narrację',
          description:
            locale === 'en'
              ? 'Choose the defense once more to retry without rolling again.'
              : 'Wybierz obronę ponownie. Aplikacja użyje tego samego wyniku rzutu.',
          variant: 'destructive',
        });
        return;
      }
      const committed: CombatRoundJournal = { ...committing, phase: 'committed' };
      combatJournalRef.current = committed;
      saveCombatJournal(localStorage, committed);
      localStorage.removeItem('combat_round_journal_v1');
      combatJournalRef.current = null;
    },
    [
      activeCharacter,
      handleSendMessage,
      locale,
      setActiveCharacter,
      setCharacters,
    ]
  );

  useEffect(() => {
    const journal = combatJournalRef.current;
    if (
      !shouldRecoverCombatCommitRef.current ||
      journal?.phase !== 'committing' ||
      journal.resolutions.length !== journal.attacks.length
    ) return;
    const lastAttack = journal.attacks.at(-1);
    if (!lastAttack) return;
    const storedChoice = journal.choices[lastAttack.eventId];
    if (!storedChoice) return;
    shouldRecoverCombatCommitRef.current = false;
    const weapon = combatDefenseWeapons.find(
      (candidate) => candidate.id === storedChoice.defenderWeaponId
    );
    void handleCombatDefense(
      lastAttack,
      storedChoice.choice,
      weapon,
      storedChoice.maneuverType
    );
  }, [combatDefenseWeapons, handleCombatDefense]);

  // === Ręczna kontynuacja urwanej narracji (finishReason=MAX_TOKENS) ===
  // Single-flight: równoległe wywołania (double-click, Promise.all w testach)
  // muszą dać DOKŁADNIE jedno żądanie - stąd ref zamiast stanu (synchroniczny).
  const continuationInFlightRef = useRef(false);

  const handleContinueNarration = useCallback(
    async (messageId?: string) => {
      if (continuationInFlightRef.current || isLoading) return;

      // Cel: wskazana wiadomość albo najnowsza asystenta urwana na MAX_TOKENS.
      const target = messageId
        ? messages.find(
            (m) =>
              m.id === messageId &&
              m.role === 'assistant' &&
              m.finishReason === 'MAX_TOKENS'
          )
        : [...messages]
            .reverse()
            .find(
              (m) => m.role === 'assistant' && m.finishReason === 'MAX_TOKENS'
            );
      if (!target) return;

      continuationInFlightRef.current = true;
      // Zamówienie oznaczamy PRZED wysyłką - UI natychmiast blokuje przycisk.
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === target.id ? { ...msg, continuationRequested: true } : msg
        )
      );

      setIsLoading(true);
      const assistantMessageId = crypto.randomUUID();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };
      // Kontynuacja NIE tworzy dymku gracza - instrukcja leci tylko w payloadzie.
      setMessages((prev) => [...prev, assistantMessage]);

      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      currentAssistantMessageIdRef.current = assistantMessageId;
      currentUserMessageIdRef.current = null;
      lastSentUserMessageRef.current = null;

      const markedTarget: Message = { ...target, continuationRequested: true };

      try {
        const response = await fetchWithRetry('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortController.signal,
          body: JSON.stringify({
            message:
              locale === 'en'
                ? "Continue the Game Master's previous truncated response exactly where it ended. Do not repeat it and do not comment on the interruption."
                : 'Dokończ poprzednią, urwaną wypowiedź Mistrza Gry dokładnie od miejsca, w którym się skończyła. Nie powtarzaj jej i nie komentuj przerwania.',
            messages: sanitizeHistoryForApi([markedTarget]),
            pdfMemory,
            character: sanitizeCharacterForApi(activeCharacter),
            adventureContext,
            memoryScope: loadCampaignMemoryScope(),
            gameTime: timeManager.getTime(),
            currentLocation: currentLocationRef.current,
            turnsInCurrentLocation: turnsInCurrentLocationRef.current,
            visitedMacroLocations: visitedMacroLocationsRef.current,
            aiSettings: options.aiSettings,
            locale,
            guardrailState: guardrailStateRef.current,
          }),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          const serverMsg =
            (errorBody as Record<string, string>)?.error || response.statusText;
          throw new Error(`Chat API ${response.status}: ${serverMsg}`);
        }

        let streamedFullText = '';
        const fullText = await parseSSEStream(response, {
          onText: (text) => {
            streamedFullText = text;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId ? { ...msg, content: text } : msg
              )
            );
            if (voiceEnabled && isTTSEnabled) {
              options.addToQueue(text, assistantMessageId);
            }
          },
          onMetadata: (metadata) => {
            notifyMemoryCommit(metadata, locale);
            if (metadata.finishReason) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, finishReason: String(metadata.finishReason) }
                    : msg
                )
              );
            }
            if (voiceEnabled && isTTSEnabled) {
              generateVoiceForMessage(
                { ...assistantMessage, content: streamedFullText },
                [...messages, markedTarget]
              );
            }
          },
          onParseError: createSseParseErrorHandler({
            endpoint: '/api/chat',
            hook: 'useChat:continueNarration',
          }),
        });

        void fullText;
      } catch (error) {
        const isAborted =
          abortController.signal.aborted ||
          (error instanceof DOMException && error.name === 'AbortError') ||
          (error instanceof Error &&
            (error.name === 'AbortError' || error.message.includes('aborted')));

        if (!isAborted) {
          console.error('Błąd kontynuacji narracji:', error);
        }
        setMessages((prev) =>
          prev.filter((msg) => msg.id !== assistantMessageId)
        );
      } finally {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
        continuationInFlightRef.current = false;
        setIsLoading(false);
      }
    },
    [
      isLoading,
      messages,
      pdfMemory,
      activeCharacter,
      adventureContext,
      voiceEnabled,
      isTTSEnabled,
      generateVoiceForMessage,
      stopCurrentAudio,
    ]
  );

  // === C4 (duet): bufor deklaracji + wysyłka tury ===
  // Tryb dla dwojga = Hot Seat z 2+ graczami. Tylko wtedy buforujemy; solo
  // wysyła natychmiast (Enter w MessageInput → handleSendMessage bez zmian).
  const isDuet =
    !!hotSeatConfig?.enabled && (hotSeatConfig?.players?.length ?? 0) >= 2;

  const declarationSessionKey = hotSeatConfig?.enabled
    ? `${hotSeatConfig.adventureJournalId ?? 'legacy'}:${hotSeatConfig.players
        .map((player) => player.id)
        .join('|')}`
    : 'solo';

  // Deklaracje należą wyłącznie do bieżącego składu i przebiegu przygody.
  // Zmiana save'u, pary albo wyłączenie Hot Seat usuwa niedokończoną turę.
  useEffect(() => {
    setPendingDeclarations([]);
  }, [declarationSessionKey]);

  // Aktualny gracz (czyja kolej deklarować) = aktywny indeks Hot Seat.
  const currentPlayer = isDuet
    ? (hotSeatConfig!.players[hotSeatConfig!.activePlayerIndex] ?? null)
    : null;

  // Dokłada/aktualizuje deklarację AKTUALNEGO gracza (Enter w duecie). Re-wpis
  // tego samego gracza nadpisuje jego poprzednią deklarację (1 gracz = 1 wpis/turę).
  const addDeclaration = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !currentPlayer) return;
      const characterName = characters.find(
        (c) => c.id === currentPlayer.characterId
      )?.name;
      const nextDeclarations = [
        ...pendingDeclarations.filter((d) => d.playerId !== currentPlayer.id),
        {
          playerId: currentPlayer.id,
          playerName: currentPlayer.name,
          characterName,
          text: trimmed,
        },
      ];
      setPendingDeclarations(nextDeclarations);

      const players = hotSeatConfig?.players ?? [];
      const nextPlayerIndex = players.findIndex(
        (player) =>
          player.id !== currentPlayer.id &&
          !nextDeclarations.some(
            (declaration) => declaration.playerId === player.id
          )
      );
      if (nextPlayerIndex >= 0) {
        onSwitchHotSeatPlayer?.(nextPlayerIndex);
      }
    },
    [
      currentPlayer,
      characters,
      pendingDeclarations,
      hotSeatConfig,
      onSwitchHotSeatPlayer,
    ]
  );

  const passDeclaration = useCallback(() => {
    addDeclaration('Pasuję.');
  }, [addDeclaration]);

  const clearDeclarations = useCallback(() => {
    setPendingDeclarations([]);
  }, []);

  // Składa zebrane deklaracje w jedną wiadomość i wysyła przez istniejący
  // handleSendMessage (zachowuje sanitizer/cap obrazów/resolveSkillTestValues/
  // addToQueue - bufor NIE dotyka ścieżki wysyłki). Zerowanie po starcie.
  const sendTurn = useCallback(() => {
    const players = hotSeatConfig?.players ?? [];
    if (!isTurnReady(pendingDeclarations, players)) return;
    const composed = composeTurnFromDeclarations(pendingDeclarations);
    setPendingDeclarations([]);
    void handleSendMessage(composed);
  }, [pendingDeclarations, handleSendMessage, hotSeatConfig?.players]);

  // Gracze, którzy jeszcze nie zadeklarowali w tej turze (podpowiedź w UI).
  const playersAwaitingDeclaration = isDuet
    ? options
        .hotSeatConfig!.players.filter(
          (p) => !pendingDeclarations.some((d) => d.playerId === p.id)
        )
        .map((p) => ({ id: p.id, name: p.name }))
    : [];
  const turnReady = isDuet
    ? isTurnReady(pendingDeclarations, hotSeatConfig?.players ?? [])
    : false;

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (newMessage.trim()) {
          if (isDuet) addDeclaration(newMessage.trim());
          else handleSendMessage(newMessage.trim());
          setNewMessage('');
        }
      }
    },
    [newMessage, handleSendMessage, isDuet, addDeclaration]
  );

  const dismissAcquiredItem = useCallback(
    (messageId: string, proposalId: string) => {
      setMessages((prev) =>
        prev.map((message) => {
          if (message.id !== messageId) return message;
          return {
            ...message,
            acquiredItems: message.acquiredItems?.map((proposal) =>
              proposal.id === proposalId && proposal.status === 'pending'
                ? { ...proposal, status: 'dismissed' }
                : proposal
            ),
          };
        })
      );
    },
    []
  );

  const confirmAcquiredItem = useCallback(
    async (messageId: string, proposalId: string, characterId?: string) => {
      const message = messages.find((candidate) => candidate.id === messageId);
      const proposal = message?.acquiredItems?.find(
        (candidate) => candidate.id === proposalId
      );
      if (!proposal || proposal.status !== 'pending' || !activeCharacter)
        return;

      // Stan karty najpierw - podwójny klik nie może dodać dwóch egzemplarzy.
      setMessages((prev) =>
        prev.map((candidate) =>
          candidate.id === messageId
            ? {
                ...candidate,
                acquiredItems: candidate.acquiredItems?.map((item) =>
                  item.id === proposalId
                    ? { ...item, status: 'accepted' }
                    : item
                ),
              }
            : candidate
        )
      );

      let recipient = activeCharacter;
      if (characterId) {
        const explicitTarget = characters.find((c) => c.id === characterId);
        if (explicitTarget) recipient = explicitTarget;
      } else {
        recipient = resolveCharacterByName(
          characters,
          proposal.recipientName,
          activeCharacter
        );
      }
      const item = {
        ...createEquipmentItem(
          createAcquiredEquipmentSeed(proposal),
          'acquired'
        ),
        acquiredFrom: 'acquired' as const,
        // Znalezisko z sesji jest unikalnym egzemplarzem, nawet jeżeli jego nazwa
        // odpowiada katalogowi. Katalog pozostaje zarezerwowany dla stałej bazy.
        visualSource: 'generated' as const,
        visualTreatment: proposal.visualTreatment,
        imageUrl: undefined,
      };

      const journalEntry: JournalEntry = {
        id: `journal-${item.id}`,
        timestamp: new Date(),
        type: 'item',
        title: item.name,
        content: item.description || 'Brak opisu przedmiotu.',
        tags: [],
        isBookmarked: false,
      };

      const appendItemToCharacter = (character: Character): Character =>
        character.id === recipient.id
          ? {
              ...character,
              equipment: [...(character.equipment ?? []), item],
              journal: [...(character.journal ?? []), journalEntry],
            }
          : character;

      setCharacters((prevList) => {
        const baseList = prevList.length > 0 ? prevList : characters;
        const updatedList = baseList.map(appendItemToCharacter);
        if (typeof window !== 'undefined') persistCharacters(updatedList);
        return updatedList;
      });
      setActiveCharacter((prevActive) => {
        const baseActive = prevActive ?? activeCharacter;
        return baseActive ? appendItemToCharacter(baseActive) : baseActive;
      });

      if (
        isPureTextMode() ||
        options.aiSettings?.imageGenerationEnabled === false
      ) {
        return;
      }

      const applyFallbackSource = () => {
        const markFallback = (character: Character): Character =>
          character.id !== recipient.id
            ? character
            : {
                ...character,
                equipment: (character.equipment ?? []).map((candidate) =>
                  candidate.id === item.id
                    ? { ...candidate, visualSource: 'fallback' as const }
                    : candidate
                ),
              };
        setCharacters((prevList) => {
          const baseList = prevList.length > 0 ? prevList : characters;
          const updatedList = baseList.map(markFallback);
          if (typeof window !== 'undefined') persistCharacters(updatedList);
          return updatedList;
        });
        setActiveCharacter((prevActive) => {
          const baseActive = prevActive ?? activeCharacter;
          return baseActive ? markFallback(baseActive) : baseActive;
        });
      };

      // Obraz nie blokuje kliknięcia ani gry. Nieudana generacja zostawia ważny
      // egzemplarz z fallbackiem - można go później wygenerować z modalu ekwipunku.
      try {
        const era = resolveEquipmentVisualEra(adventureContext);
        const prompt = buildEquipmentImagePrompt(
          item,
          era,
          adventureContext?.title,
          recipient
        );
        const usePortraitReference = Boolean(
          recipient.portraitUrl && isCharacterBoundEquipment(item)
        );
        const response = await fetchWithRetry(
          usePortraitReference ? '/api/flux-kontext' : '/api/imagen',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt,
              style: usePortraitReference
                ? 'realistic'
                : proposal.visualTreatment === 'supernatural' ||
                    item.category === 'artifact'
                  ? 'horror'
                  : 'item',
              era,
              aspectRatio: '1:1',
              seed: `${recipient.id}-${item.id}`,
              ...(usePortraitReference
                ? { inputImageUrl: recipient.portraitUrl }
                : {}),
            }),
          }
        );
        if (!response.ok) {
          applyFallbackSource();
          return;
        }
        const data = (await response.json()) as { imageUrl?: string };
        if (!data.imageUrl) {
          applyFallbackSource();
          return;
        }

        const applyGeneratedImage = (character: Character): Character =>
          character.id !== recipient.id
            ? character
            : {
                ...character,
                equipment: (character.equipment ?? []).map((candidate) =>
                  candidate.id === item.id
                    ? {
                        ...candidate,
                        imageUrl: data.imageUrl,
                        imagePrompt: prompt,
                        visualSource: 'generated' as const,
                      }
                    : candidate
                ),
                journal: (character.journal ?? []).map((entry) =>
                  entry.id === journalEntry.id
                    ? { ...entry, imageUrl: data.imageUrl }
                    : entry
                ),
              };

        setCharacters((prevList) => {
          const baseList = prevList.length > 0 ? prevList : characters;
          const updatedList = baseList.map(applyGeneratedImage);
          if (typeof window !== 'undefined') persistCharacters(updatedList);
          return updatedList;
        });
        setActiveCharacter((prevActive) => {
          const baseActive = prevActive ?? activeCharacter;
          return baseActive ? applyGeneratedImage(baseActive) : baseActive;
        });
      } catch (error) {
        console.warn(
          'Nie udało się wygenerować renderu zdobytego przedmiotu:',
          error
        );
        applyFallbackSource();
      }
    },
    [
      activeCharacter,
      adventureContext,
      characters,
      messages,
      options.aiSettings?.imageGenerationEnabled,
      setActiveCharacter,
      setCharacters,
    ]
  );

  return {
    messages,
    setMessages,
    newMessage,
    setNewMessage,
    handleSendMessage,
    pendingCombatAttack,
    pendingCombatDefensesUsed,
    combatDefenseWeapons,
    handleCombatDefense,
    handleContinueNarration,
    handleKeyPress,
    generateImages,
    isLoading,
    currentLocation,
    // C4 (duet)
    isDuet,
    pendingDeclarations,
    playersAwaitingDeclaration,
    addDeclaration,
    passDeclaration,
    currentPlayerName: currentPlayer?.name,
    isTurnReady: turnReady,
    clearDeclarations,
    sendTurn,
    confirmAcquiredItem,
    dismissAcquiredItem,
    isSessionEnded,
    sessionEndStatus,
    sessionSaveStatus,
    retrySessionSave,
    resetSessionEndState,
    cheatCombatModal,
    setCheatCombatModal,
    cheatChaseModal,
    setCheatChaseModal,
    activeChaseState,
    setActiveChaseState,
    stopGeneration,
  };
}
