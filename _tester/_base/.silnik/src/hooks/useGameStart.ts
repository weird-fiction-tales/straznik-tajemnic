import { isAuthoredAdventureId } from '@/lib/adventure-dossier/authored-scenarios';
import { isRuntimeAuthorizedDossierRecord } from '@/lib/adventure-dossier/runtime-authorization';
import { createDossierOpeningCommit } from '@/lib/adventure-dossier/commit-opening';
import { loadRuntimeDossierPayload } from '@/lib/adventure-dossier/client-activation';
import type { SSECallbacks } from '@/lib/sse-parser';
import { offloadCharacterImages } from '@/lib/character-image-store';
import { loadNpcSnapshot } from '@/lib/adventure-dossier/actor-initialization';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Character,
  Message,
  PdfMemory,
  AdventureContext,
  HotSeatPlayer,
} from '@/lib/types';
import type { AISettings } from '@/lib/ai-settings/types';
import {
  fetchWithApiKeys,
  getApiKeyHeaders,
  isPureTextMode,
} from '@/lib/api-keys-service';
import { toast } from '@/components/ui/use-toast';
import { parseSSEStream, createSseParseErrorHandler } from '@/lib/sse-parser';
import { timeManager } from '@/lib/time-manager';
// M6 sesja 146: DialogueLine import DROPPED per D3 (multi-voice odchodzi).
import { trackEvent } from '@/lib/posthog';
import { resetSessionTokens } from '@/lib/ai-settings/cost-control';
import { appendJournalToParty } from '@/lib/journal/apply-journal-tags';
import { notifyMemoryCommit } from '@/core/memory/commit-client';
import { persistCharacters } from '@/lib/character-cloud-sync';
import { persistentMediaCache } from '@/lib/persistent-media-cache';
import { useEquipmentThumbnails } from './useEquipmentThumbnails';
import { sanitizeCharacterForApi } from '@/lib/chat-history-sanitizer';
import { getEraVehicleVisualDescription } from '@/lib/era-visual-style';
import { resolveGameEraContext, findEraManifest, type ResolvedEraContext } from '@/lib/era';
import { getLocalizedOccupationName } from '@/lib/data/character';
import {
  hasBlockingSetupFailure,
  isWorldSetupBundle,
  loadStoredWorldSetup,
  storeWorldSetup,
  type WorldSetupBundleV1,
} from '@/lib/world-setup';
import { initializeAdventureNpcVoices } from '@/lib/npc-voice-mapping';
import {
  createCampaignMemoryScope,
  loadCampaignMemoryScope,
  storeCampaignMemoryScope,
} from '@/core/memory/campaign-scope';
import { isDocumentModelUseBlocked } from '@/lib/document-model-policy';
import { localizeAdventure } from '@/lib/immersion/strefa-11-localization';

/**
 * Zadanie 6 (hardening demo-safe): chwilowy blip sieci ≠ crash startu gry.
 * Ponawia WYŁĄCZNIE błędy sieciowe (`fetch` rzuca `TypeError`: "Failed to fetch" /
 * "NetworkError") - 1-2 próby, krótki backoff. Odpowiedzi HTTP (np. 500) idą do
 * callera bez retry. Minimal-touch: opakowuje istniejące `fetchWithApiKeys`.
 */
function isNetworkBlip(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  const msg = error instanceof Error ? error.message : String(error);
  return /failed to fetch|networkerror|network request failed/i.test(msg);
}

function isRetryableHttpStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

async function fetchWithRetry(
  url: string,
  options: Parameters<typeof fetchWithApiKeys>[1],
  retries = 3,
  backoffMs = 1500,
  onRetry?: (attempt: number, reason: string) => void
): Promise<Response> {
  const isTest = process.env.NODE_ENV === 'test';
  let lastError: unknown;
  let lastResponse: Response | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithApiKeys(url, options);
      if (res) {
        lastResponse = res;
        if (!res.ok && isRetryableHttpStatus(res.status) && attempt < retries) {
          onRetry?.(attempt + 1, `HTTP ${res.status}`);
          const delay = isTest ? 10 : backoffMs * Math.pow(1.5, attempt) + Math.random() * 200;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        return res;
      }
      if (lastResponse) return lastResponse;
      throw new Error('No response received');
    } catch (error) {
      lastError = error;
      if (!isNetworkBlip(error) || attempt === retries) throw error;
      onRetry?.(attempt + 1, 'Network blip');
      const delay = isTest ? 10 : backoffMs * (attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  if (lastResponse) return lastResponse;
  throw lastError;
}

function createPresetWorldSetup(
  adventure: AdventureContext,
  eraContext: ResolvedEraContext
): WorldSetupBundleV1 {
  const createdAt = new Date().toISOString();
  const conflicts = (adventure.conflicts ?? []).map((conflict) => ({
    ...conflict,
    factions: conflict.factions.map((faction) => ({ ...faction })),
  }));

  const manifest = findEraManifest(
    eraContext.effectiveYear,
    eraContext.countryCode,
    eraContext.regionProfile
  );
  const isApproved = manifest?.approvalStatus === 'approved';

  return {
    schemaVersion: 1,
    id: `preset_${adventure.id ?? 'adventure'}_${Date.now()}`,
    scenarioId: adventure.id ?? 'preset-adventure',
    adventureTitle: adventure.title,
    createdAt,
    canonRevision: 1,
    eraContext,
    eraManifestId: manifest?.id ?? null,
    adventureGraph: {
      source: 'preset',
      conflicts,
      setupAsymmetry: adventure.setupAsymmetry ?? {},
      graph: adventure.graph ?? null,
    },
    factions: conflicts.flatMap((conflict) => conflict.factions),
    npcs: (adventure.graph?.npcs ?? []).map((n) => ({
      id: n.id,
      name: n.name,
      description: n.description,
      secret: n.secret,
      statsSummary: n.statsSummary,
    })),
    locations: [
      ...((adventure.graph?.locations ?? []).map((l) => ({
        id: l.id,
        name: l.name,
        description: l.description,
        atmosphere: l.atmosphere,
      }))),
      ...(adventure.location &&
      !(adventure.graph?.locations ?? []).some((l) => l.name === adventure.location)
        ? [{ name: adventure.location }]
        : []),
    ],
    items: (adventure.graph?.clues ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      isRedHerring: c.isRedHerring,
    })),
    events: [],
    openingScene: { location: adventure.location ?? '' },
    nearestBranches: conflicts,
    adventureContent: JSON.stringify({
      hook: adventure.hook,
      description: adventure.description,
      conflicts,
      graph: adventure.graph,
    }),
    supplementalInformation: [],
    sources: manifest?.sources ?? [],
    knowledgeGaps: isApproved
      ? []
      : [
          'Szybka przygoda używa lokalnego kanonu. Opcjonalny research historyczny nie blokuje startu.',
        ],
    exceptions: [],
    phaseResults: [
      {
        phase: 'era',
        status: isApproved ? 'passed' : 'degraded',
        critical: true,
        retryable: false,
        durationMs: 0,
        estimatedCostUsd: 0,
        completedAt: createdAt,
        message: isApproved
          ? undefined
          : 'Gotowy scenariusz używa kanonu bazowego; brak w pełni zatwierdzonego manifestu szczegółowego.',
      },
      {
        phase: 'adventure-graph',
        status: conflicts.length > 0 ? 'passed' : 'degraded',
        critical: false,
        retryable: true,
        durationMs: 0,
        estimatedCostUsd: 0,
        message:
          conflicts.length > 0
            ? undefined
            : 'Preset nie zawiera gotowego grafu konfliktu.',
        completedAt: createdAt,
      },
      {
        phase: 'historical-research',
        status: 'degraded',
        critical: false,
        retryable: true,
        durationMs: 0,
        estimatedCostUsd: 0,
        message: 'Research online jest pomijany przy szybkim starcie.',
        completedAt: createdAt,
      },
    ],
  };
}

interface UseGameStartProps {
  locale?: 'pl' | 'en';
  setHasStartedGame: (started: boolean) => void;
  activeCharacter: Character | null;
  characters: Character[];
  setActiveCharacter: React.Dispatch<React.SetStateAction<Character | null>>;
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
  pdfMemory: PdfMemory;
  activateDossierForSession?: (sessionId: string, adventureId: string) => Promise<{
    ok: boolean;
    reason?: string;
    adventureDossierFingerprint?: string;
    adventureDossierStatus?: 'ready';
  }>;
  adventureContext: AdventureContext | null;
  hotSeatConfig: { enabled: boolean; players: HotSeatPlayer[] };
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  tts: {
    voiceEnabled: boolean;
    isTTSEnabled: boolean;
    generateVoiceForMessage: (
      message: Message,
      context: Message[]
    ) => Promise<void>;
    // M6 sesja 146: generateMultiVoice DROPPED per D3.
    addToQueue: (text: string, messageId?: string) => void;
    startInitialBuffering: () => void;
    waitForInitialBuffer?: (timeoutMs?: number) => Promise<void>;
    /** Issue #157: Zdejmuje blokadę oczekiwania na akcept gracza i rozpoczyna odtwarzanie lektora */
    playInitialNarration?: () => void;
    /** Anuluje buforowanie i zdejmuje blokadę lektora przy błędzie lub resecie */
    cancelInitialBuffering?: () => void;
    stopCurrentAudio: () => void;
  };
  aiSettings?: AISettings | null;
  /** IND-273 T3: self-check klucza/modeli przy starcie gry (fire-and-forget, TTL dławi). */
  runHealthCheck?: () => void;
  /** Issue #157: Wymuszenie oczekiwania na akcept gracza nawet w środowisku testowym */
  requirePlayerConfirmation?: boolean;
}

/**
 * Hook odpowiedzialny za logikę startu gry:
 * - Budowanie prompta wprowadzającego
 * - Równoległe generowanie obrazu intro
 * - Strumieniowanie odpowiedzi AI z obsługą TTS
 */
export interface GameStartError {
  statusCode?: number;
  category: 'server_overloaded' | 'quota_exceeded' | 'auth_error' | 'network_error' | 'general_error';
  title: string;
  userAdvice: string;
  technicalDetails?: string;
}

export function useGameStart({
  setHasStartedGame,
  activeCharacter,
  characters,
  setActiveCharacter,
  setCharacters,
  pdfMemory,
  activateDossierForSession,
  adventureContext,
  hotSeatConfig,
  setMessages,
  tts,
  aiSettings,
  runHealthCheck,
  requirePlayerConfirmation,
  locale = 'pl',
}: UseGameStartProps) {
  const currentAdventureId=useRef(adventureContext?.id);
  currentAdventureId.current=adventureContext?.id;
  const [isStarting, setIsStarting] = useState(false);
  const [startProgress, setStartProgress] = useState(0);
  const [startStatus, setStartStatus] = useState('');
  const [isReadyToEnter, setIsReadyToEnter] = useState(false);
  const [startError, setStartError] = useState<GameStartError | null>(null);

  const waitForPlayerConfirmation = useCallback((): Promise<void> => {
    // W środowisku testowym domyślnie przechodzimy bez blokowania, chyba że test jawnie tego żąda
    if (process.env.NODE_ENV === 'test' && !requirePlayerConfirmation) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      const handleConfirm = () => {
        if (typeof window !== 'undefined') {
          window.removeEventListener('zew:confirm-enter-game', handleConfirm);
        }
        resolve();
      };
      if (typeof window !== 'undefined') {
        window.addEventListener('zew:confirm-enter-game', handleConfirm);
      } else {
        resolve();
      }
    });
  }, [requirePlayerConfirmation]);

  const confirmEnterGame = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('zew:confirm-enter-game'));
    }
  }, []);

  // Cichy pre-warmup endpointu zdrowia Gemini podczas menu głównego.
  // /api/chat-test przyjmuje wyłącznie POST z testem klucza; GET zwraca 405.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const warmupTimer = setTimeout(() => {
      fetch('/api/health/gemini', { method: 'GET' }).catch(() => {});
    }, 1200);
    return () => clearTimeout(warmupTimer);
  }, []);

  // IND-271: kolejka auto-generacji miniatur ekwipunku w tle (fire-and-forget
  // po starcie gry, NIE blokuje startu; cache-aware - pomija itemy z imageUrl).
  const { generateThumbnailsInBackground } = useEquipmentThumbnails({
    activeCharacter,
    adventureContext,
    imageGenerationEnabled: aiSettings?.imageGenerationEnabled ?? false,
    setActiveCharacter,
    setCharacters,
  });

  /**
   * Buduje prompt wprowadzający na podstawie kontekstu postaci i przygody.
   *
   * IND-261: pierwsza tura to rozszerzone wprowadzenie (onboarding nowicjusza,
   * 3-5 akapitów) - jawny wyjątek od limitu długości tur (IND-213). Nadpisanie
   * limitu żyje w samej wiadomości użytkownika, więc obejmuje TYLKO tę turę.
   */
  const buildIntroPrompt = useCallback((): string => {
    const isHotSeat = hotSeatConfig.enabled && hotSeatConfig.players.length > 1;
    const allPlayerCharacters = isHotSeat
      ? hotSeatConfig.players
          .map((p: HotSeatPlayer) =>
            characters.find(
              (c) => c.id === p.characterId || c.playerName === p.name
            )
          )
          .filter((c): c is Character => !!c)
      : activeCharacter
        ? [activeCharacter]
        : [];

    const english = locale === 'en';
    let prompt = english
      ? 'We are beginning the adventure!\n\n'
      : 'Zaczynamy przygodę!\n\n';

    if (english && allPlayerCharacters.length > 1) {
      prompt += `**IMPORTANT: This is a Hot Seat game for ${allPlayerCharacters.length} players.**\n\n--- CHARACTER CONTEXT ---\n`;
      allPlayerCharacters.forEach((char, index) => {
        const occ = getLocalizedOccupationName(char.occupation, 'en') || 'unknown';
        prompt += `\n**Player ${index + 1} - ${char.name}:**\n- Occupation: ${occ}\n- Age: ${char.age || 'unknown'}\n`;
        if (char.characterConcept)
          prompt += `- Concept: ${char.characterConcept}\n`;
        if (char.background) prompt += `- Background: ${char.background}\n`;
      });
      prompt +=
        '--- END CHARACTER CONTEXT ---\n\nWrite an organic opening for every player. Do not repeat their sheet data.\n\n';
    } else if (!english && allPlayerCharacters.length > 1) {
      prompt += `**UWAGA: Gra toczy się dla ${allPlayerCharacters.length} graczy (Hot Seat mode)!**\n\n`;
      prompt += `--- KONTEKST POSTACI ---\n`;
      allPlayerCharacters.forEach((char, index) => {
        const occ = getLocalizedOccupationName(char.occupation, 'pl') || 'nieznany';
        prompt += `\n**Gracz ${index + 1} - ${char.name}:**\n`;
        prompt += `- Zawód: ${occ}\n`;
        prompt += `- Wiek: ${char.age || 'nieznany'}\n`;
        if (char.characterConcept)
          prompt += `- Koncept: ${char.characterConcept}\n`;
        if (char.background) prompt += `- Historia: ${char.background}\n`;
      });
      prompt += `--- KONIEC KONTEKSTU ---\n`;
      prompt +=
        '\n**WAŻNE:** Wprowadzenie MUSI uwzględnić WSZYSTKIE postacie graczy! NIE powtarzaj statystyk ani statycznych opisów postaci z bloku KONTEKST POSTACI w swojej narracji. Wpleć ewentualne nawiązania naturalnie w fabułę.\n\n';
    } else if (english && activeCharacter) {
      const occ = getLocalizedOccupationName(activeCharacter.occupation, 'en') || 'unknown';
      prompt += `--- CHARACTER CONTEXT ---\n**My character:**\n- Name: ${activeCharacter.name}\n- Occupation: ${occ}\n- Age: ${activeCharacter.age || 'unknown'}\n`;
      if (activeCharacter.characterConcept)
        prompt += `- Concept: ${activeCharacter.characterConcept}\n`;
      if (activeCharacter.background)
        prompt += `- Background: ${activeCharacter.background}\n`;
      prompt +=
        '--- END CHARACTER CONTEXT ---\n\nUse this context only in the background. Do not quote or repeat it.\n\n';
    } else if (activeCharacter) {
      const occ = getLocalizedOccupationName(activeCharacter.occupation, 'pl') || 'nieznany';
      prompt += `--- KONTEKST POSTACI ---\n**Moja postać:**\n`;
      prompt += `- Imię: ${activeCharacter.name}\n- Zawód: ${occ}\n- Wiek: ${activeCharacter.age || 'nieznany'}\n`;
      if (activeCharacter.characterConcept)
        prompt += `- Koncept: ${activeCharacter.characterConcept}\n`;
      if (activeCharacter.background)
        prompt += `- Historia: ${activeCharacter.background}\n`;
      prompt += `--- KONIEC KONTEKSTU ---\n\n**WAŻNE:** NIE CYTUJ i NIE POWTARZAJ powyższych informacji o mojej postaci na początku odpowiedzi. Użyj ich TYLKO "w tle" (jako swojej wiedzy Strażnika Tajemnic), aby poprowadzić narrację.\n\n`;
    }

    const effectiveAdv = adventureContext
      ? localizeAdventure(adventureContext, english ? 'en' : 'pl')
      : null;
    if (effectiveAdv) {
      const startDateTimeFormatted =
        typeof timeManager?.formatDateTime === 'function'
          ? timeManager.formatDateTime(english ? 'en' : 'pl')
          : '';
      const startWeather =
        typeof timeManager?.getWeather === 'function'
          ? timeManager.getWeather()
          : '';
      prompt += english
        ? `**ADVENTURE CONTEXT:**\n- Title: ${effectiveAdv.title}\n- Location: ${effectiveAdv.location}, ${effectiveAdv.country}${startDateTimeFormatted ? `\n- Starting Time: ${startDateTimeFormatted}` : ''}${startWeather ? `\n- Weather: ${startWeather}` : ''}\n- Hook: ${effectiveAdv.hook}\n\n`
        : `**KONTEKST PRZYGODY:**\n- Tytuł: ${effectiveAdv.title}\n- Lokalizacja: ${effectiveAdv.location}, ${effectiveAdv.country}${startDateTimeFormatted ? `\n- Czas rozpoczęcia: ${startDateTimeFormatted}` : ''}${startWeather ? `\n- Pogoda: ${startWeather}` : ''}\n- Hook: ${effectiveAdv.hook}\n\n`;
    }

    // IND-261: TURA WPROWADZAJĄCA = wyjątek od limitu długości (IND-213). Onboarding
    // dla kogoś, kto nie zna Lovecrafta ani CoC - świat + miejsce + czas, potem hook.
    // Działa wyłącznie na tę jedną turę (wiadomość użytkownika nadpisuje protokół MG);
    // kolejne tury wracają do zwięzłej długości narzuconej przez gm-protocol.
    if (english && allPlayerCharacters.length > 1) {
      prompt +=
        'This is the OPENING TURN for the party (Hot Seat mode).\n\n' +
        'PARTY INTRODUCTION - ORGANIC PLOT START:\n' +
        '1. NARRATION & FORM: Address the investigators in the plural ("You see...", "You enter...") or smoothly alternate perspectives between characters.\n' +
        '2. ORGANIC OPENING SCENE: DO NOT throw the players into a violent quest or direct threat immediately. Begin in an ordinary, period-appropriate social situation (e.g. dinner together at a restaurant, conversation in a study, a train journey, or casual chatter with an NPC).\n' +
        '3. EXPOSITION & ATMOSPHERE: Allow the players to take in the time, place, and period atmosphere. Let them experience the world through environmental descriptions or NPC interaction (NEVER force players to debate among themselves in chat). Only after establishing the surroundings should you sow the first subtle note of dread and introduce the adventure HOOK.\n' +
        '4. TURN CONCLUSION: Conclude the turn with an open question directed to the whole party: [What do you all do?] on its own separate line.\n\n' +
        'DO NOT play for the player characters. Mark the starting location with the tag [LOCATION: Place Name | Atmosphere & Visual Prompt]. ' +
        'Add an opening journal entry: [JOURNAL:case:Beginning the investigation]1-2 sentences about what brings our party to this place.[/JOURNAL] ' +
        'Conclude with [What do you all do?] on its own separate line.\n';
    } else if (!english && allPlayerCharacters.length > 1) {
      prompt +=
        'To jest TURA WPROWADZAJĄCA do gry DLA DRUŻYNY (Hot Seat mode).\n\n' +
        'WPROWADZENIE DLA DRUŻYNY - ORGANICZNY START FABUŁY:\n' +
        '1. NARRACJA I FORMA: Zwracaj się do postaci naraz w liczbie mnogiej ("Widzicie...", "Wkraczacie...") lub płynnie rozdzielaj ujęcia między bohaterów.\n' +
        '2. ORGANICZNA SCENA OTWARCIA: NIE RZUCAJ graczy od razu w gwałtowny quest ani bezpośrednie zagrożenie. Rozpocznij w naturalnej, zwyczajnej sytuacji obyczajowej (np. wspólna kolacja w restauracji, rozmowa w gabinecie, podróż pociągiem, luźna pogawędka z NPC-em).\n' +
        '3. EKSPOZYCJA I KLIMAT: Pozwól graczom zorientować się w miejscu, czasie i klimacie epoki. Pozwól im poznać świat poprzez opis otoczenia lub interakcję z NPC-em (NIGDY nie zmuszaj graczy do dyskusji między sobą na czacie). Dopiero po przedstawieniu otoczenia zasiej pierwszy delikatny sygnał niepokoju i wprowadź hak fabularny (HOOK przygody).\n' +
        '4. ZAKOŃCZENIE TURY: Zakończ turę otwartym pytaniem do drużyny: [Co robicie?]\n\n' +
        'NIE graj za postacie graczy. Oznacz miejsce startu znacznikiem [LOKACJA: Nazwa miejsca: krótka atmosfera]. ' +
        'Dodaj wpis otwierający do dziennika: [DZIENNIK:sprawa:Początek śledztwa]1-2 zdania: co sprowadza naszą drużynę w to miejsce.[/DZIENNIK]\n';
    } else if (english) {
      prompt +=
        'This is the OPENING TURN of the game.\n\n' +
        'ORGANIC WORLD INTRODUCTION - INSTRUCTIONS:\n' +
        '1. OPENING SCENE: DO NOT throw the player into deep water and DO NOT thrust the quest hook in the very first sentence. Begin with an ordinary, period-appropriate situation (e.g. the investigator is drinking morning coffee, discussing mundane matters with a familiar NPC, browsing the daily press, or having dinner).\n' +
        '2. SENSORY WORLD DISCOVERY: Build the period atmosphere and setting naturally. Immerse the investigator in the acoustics, smells, and lighting of the scene, or through casual conversation with an NPC, so the player can first sense where they are and who they are before any threat arises.\n' +
        '3. GRADUAL PLOT HOOK INTRODUCTION: Only after establishing the setting and mundane routine, sow the first subtle unease beneath the surface of everyday life and weave the adventure HOOK in as a natural call-to-action.\n' +
        '4. LITERARY STYLE & AGENCY: Write in second person ("You see...", "You smell..."), cultivate slow-burn dread without cheap monster jumpscares, and strictly respect the investigator\'s physical immunity.\n\n' +
        'DO NOT play for the player character. Mark the starting location with the tag [LOCATION: Place Name | Atmosphere & Visual Prompt]. ' +
        'Add an opening journal entry: [JOURNAL:case:Beginning the investigation]1-2 sentences about where I am and what brings me here.[/JOURNAL] ' +
        'Conclude with the open question [What do you do?] on its own separate line.\n';
    } else {
      prompt +=
        'To jest TURA WPROWADZAJĄCA do gry.\n\n' +
        'ORGANICZNE WPROWADZENIE W ŚWIAT - INSTRUKCJE:\n' +
        '1. SCENA OTWARCIA: NIE RZUCAJ gracza od razu na głęboką wodę i NIE wrzucaj questa bezpośrednio w pierwszej linii. Rozpocznij od naturalnej, osadzonej w realiach sytuacji (np. postać pije poranną kawę, rozmawia o codziennych sprawach z znajomym NPC-em, przegląda prasę lub je kolację).\n' +
        '2. POZNAWANIE ŚWIATA: Buduj klimat epoki i lokacji naturalnie. Użyj rozmowy z obecnym NPC-em lub klimatycznego opisu otoczenia, by gracz mógł najpierw wyczuć gdzie jest i kim jest jego postać.\n' +
        '3. STOPNIOWE ZAWIĄZANIE AKCJI: Dopiero po zbudowaniu nastroju i wstępnej sytuacji zasiej pierwszy niepokój pod powierzchnią codzienności i wpleć HOOK przygody jako punkt zaczepienia do działania.\n' +
        '4. STYL: Pisz w drugiej osobie ("Widzisz...", "Czujesz..."), buduj atmosferę slow-burn horroru bez epatowania tanimi potworami.\n\n' +
        'NIE graj za postać gracza. Oznacz miejsce startu znacznikiem [LOKACJA: Nazwa miejsca: krótka atmosfera]. ' +
        'Dodaj też wpis otwierający do dziennika: ' +
        '[DZIENNIK:sprawa:Początek śledztwa]1-2 zdania: gdzie jestem i co mnie tu sprowadza.[/DZIENNIK] ' +
        'Zakończ otwartym pytaniem [Co robisz?] w OSOBNEJ linii.\n';
    }
    return prompt;
  }, [activeCharacter, characters, hotSeatConfig, adventureContext, locale]);

  /**
   * Generuje obraz intro równolegle ze strumieniowaniem tekstu.
   *
   * IND-148: fire-and-forget (NIE await w handleStartGame), ale błędy są teraz
   * user-visible - catch dodaje system message do chat ze wskazówką "sprawdź
   * klucze API w Settings". Wcześniej catch tylko `console.warn`, więc user
   * widział pusty obraz bez ostrzeżenia (5 scenariuszy errors silently swallowed:
   * replicateEnabled=false, 401, 429, network, provider chain exhausted).
   */
  const generateIntroImage = useCallback(
    async (messageId: string, sceneDescription?: string) => {
      if (aiSettings?.imageGenerationEnabled === false || isPureTextMode()) return;
      try {
        if (!adventureContext) {
          throw new Error('Brak kontekstu przygody dla obrazu intro.');
        }
        const eraContext = resolveGameEraContext({
          adventure: adventureContext,
        });
        const rawEra = String(eraContext.effectiveYear);
        // Wyciągnij porę roku i aurę z aktualnego czasu gry i pogody
        const gameTime = typeof window !== 'undefined' ? timeManager.getTime() : null;
        const weather = typeof window !== 'undefined' ? timeManager.getWeather() : '';

        const month = gameTime?.month ?? 0;
        const seasonAtmosphere =
          month === 11 || month === 0 || month === 1
            ? 'winter season, cold winter atmosphere, bare trees'
            : month >= 2 && month <= 4
              ? 'spring season, cool damp atmosphere'
              : month >= 5 && month <= 7
                ? 'summer season, hazy daylight'
                : 'autumn season, chilly autumn atmosphere, fallen leaves';

        let weatherAtmosphere = 'moody natural lighting';
        if (/mgła|mgly|fog|haze/i.test(weather)) {
          weatherAtmosphere = 'misty morning fog, thick haze, eerie gloom';
        } else if (/deszcz|rain/i.test(weather)) {
          weatherAtmosphere = 'cold rain, wet glistening ground, dark overcast sky';
        } else if (/śnieg|snow|mróz|frost/i.test(weather)) {
          weatherAtmosphere = 'frost and snow dusting, freezing cold mist';
        }

        let imagePrompt = '';
        if (sceneDescription && sceneDescription.trim().length > 20) {
          const cleanDesc = sceneDescription
            .replace(/\[[A-Z_]+:[^\]]*\]/g, '')
            .replace(/[#*`_]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 300);
          imagePrompt = `Opening scene illustration: ${cleanDesc}, ${seasonAtmosphere}, ${weatherAtmosphere}, ${rawEra} period-accurate, atmospheric, cinematic, realistic, moody lighting.`;
        } else {
          const locationContext =
            adventureContext?.location || 'mysterious New England town';
          // Pojazd tylko gdy scena/lokacja wyraźnie dotyczy podróży lub drogi
          const isVehicleScene =
            /\b(car|automobile|vehicle|drive|driving|road|highway|szosa|droga|parking)\b/i.test(
              locationContext
            );
          const vehicleGuidance = isVehicleScene
            ? `, ${getEraVehicleVisualDescription(rawEra)}`
            : '';

          imagePrompt = `Atmospheric establishing shot, ${locationContext}, ${seasonAtmosphere}, ${weatherAtmosphere}, ${rawEra} period-accurate${vehicleGuidance}, realistic, cinematic, moody lighting.`;
        }

        const response = await fetchWithRetry('/api/imagen', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getApiKeyHeaders(),
          },
          body: JSON.stringify({
            prompt: imagePrompt,
            style: 'location',
            era: rawEra,
            aspectRatio: '16:9',
          }),
        });

        if (!response.ok) {
          throw new Error(
            `Image API ${response.status}: ${response.statusText}`
          );
        }

        const imageData = await response.json();
        if (!imageData.imageUrl) {
          throw new Error('Brak imageUrl w odpowiedzi API');
        }

        setMessages((prev) =>
          prev.map((message) => {
            if (message.id !== messageId) return message;
            const imageIndex = message.generatedImages?.length ?? 0;
            void persistentMediaCache
              .setChatImage(messageId, imageIndex, imageData.imageUrl)
              .catch(() => {});
            if (adventureContext?.location) {
              void persistentMediaCache
                .setLocationImage(adventureContext.location.trim(), imageData.imageUrl)
                .catch(() => {});
            }
            return {
              ...message,
              generatedImages: [
                ...(message.generatedImages ?? []),
                imageData.imageUrl,
              ],
              generatedImageTypes: [
                ...(message.generatedImageTypes ?? []),
                'scene',
              ],
              generatedImageCacheIds: [
                ...(message.generatedImageCacheIds ?? []),
                `${messageId}_${imageIndex}`,
              ],
            };
          })
        );
      } catch (e) {
        console.warn('Intro image generation failed:', e);
        setMessages((prev) => [
          ...prev,
          {
            id: `gm-intro-image-error-${crypto.randomUUID()}`,
            role: 'assistant',
            content:
              locale === 'en'
                ? '⚠️ The intro image could not be generated. Check the Gemini API key in Settings.'
                : '⚠️ Nie udało się wygenerować obrazu intro. Sprawdź klucz Gemini API Key w Ustawieniach.',
            timestamp: new Date(),
          },
        ]);
      }
    },
    [adventureContext, aiSettings?.imageGenerationEnabled, locale, setMessages]
  );

  // IND-174 (port): guard przeciw podwójnemu startowi gry (double-click
  // "Rozpocznij", re-fire). Bez tego współbieżne wywołania handleStartGame
  // generują DWA openingi - setMessages([]) nie chroni, bo oba appendują przez
  // różne assistantMessageId. useRef zamiast state: synchroniczny, bez okna race.
  const isStartingRef = useRef(false);

  const handleStartGame = useCallback(async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setStartError(null);
    setIsStarting(true);
    setStartProgress(15);
    setStartStatus(
      locale === 'en'
        ? 'Breaking the seals of the chronicle...'
        : 'Otwieranie pieczęci kroniki...'
    );

    // Autostart muzyki w tle (YouTubePlayer nasłuchuje 'zew:start-music').
    // MUSI paść synchronicznie w obrębie gestu kliknięcia „Rozpocznij",
    // PRZED pierwszym await - inaczej przeglądarka zablokuje odtwarzanie dźwięku.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('zew:start-music'));
    }

    if (!adventureContext) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('zew:stop-music'));
      }
      isStartingRef.current = false;
      setIsStarting(false);
      setStartProgress(0);
      setStartStatus('');
      const title =
        locale === 'en' ? 'Select an Adventure' : 'Wybierz scenariusz';
      const description =
        locale === 'en'
          ? 'Please select an adventure before starting the game.'
          : 'Przed rozpoczęciem gry musisz wybrać scenariusz przygody.';
      toast({
        variant: 'destructive',
        title,
        description,
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('zew:toast', {
            detail: {
              variant: 'destructive',
              title,
              description,
            },
          })
        );
      }
      return;
    }

    setStartProgress(30);
    setStartStatus(
      locale === 'en'
        ? "Consulting the era's maps and archives..."
        : 'Sprawdzanie map i archiwów epoki...'
    );

    const eraContext = resolveGameEraContext({ adventure: adventureContext });
    // Inicjalizacja profili Tone of Voice postaci z przygody na etapie setupu
    initializeAdventureNpcVoices(adventureContext);
    const hasStructuredGraph = Boolean(
      adventureContext.graph &&
      ((adventureContext.graph.npcs && adventureContext.graph.npcs.length > 0) ||
       (adventureContext.graph.locations && adventureContext.graph.locations.length > 0))
    );

    if (!adventureContext.isCustom || hasStructuredGraph) {
      // Gotowe przygody oraz scenariusze wyekstrahowane lokalnie (posiadające graf postaci i lokacji)
      // mają lokalny kanon. Nie mogą wymagać odpowiedzi AI ani dodatkowego kosztu/bramki online,
      // a także nie mogą naruszać document-model-policy (Clean Room).
      storeWorldSetup(createPresetWorldSetup(adventureContext, eraContext));
    } else {
      setStartProgress(40);
      setStartStatus(
        locale === 'en'
          ? 'Analyzing scenario and historical coherence...'
          : 'Analiza scenariusza i spójności historycznej...'
      );
      try {
        const preflightSource = JSON.stringify({
          title: adventureContext.title,
          description: adventureContext.description,
          hook: adventureContext.hook,
          conflicts: adventureContext.conflicts,
          setupAsymmetry: adventureContext.setupAsymmetry,
          graph: adventureContext.graph,
        });
        const preflightResponse = await fetchWithRetry('/api/adventure/setup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getApiKeyHeaders(),
          },
          body: JSON.stringify({
            adventureText: preflightSource,
            scenarioId: adventureContext.id,
            adventureTitle: adventureContext.title,
            isCustomScenario: Boolean(adventureContext.isCustom),
            scenarioYearRange: adventureContext.yearRange,
            eraContext,
            characters: (characters.length > 0
              ? characters
              : activeCharacter
                ? [activeCharacter]
                : []
            ).map((character) => ({
              id: character.id,
              name: character.name,
              occupation: getLocalizedOccupationName(character.occupation, locale) || '',
              background: character.background || '',
            })),
          }),
        });

        if (!preflightResponse.ok) {
          const errorBody = await preflightResponse.json().catch(() => ({}));
          const errorCode = (errorBody as { code?: string }).code;
          if (errorCode === 'DOCUMENT_MODEL_USE_BLOCKED') {
            // Bezpieczny fallback Clean Room: gdy polityka blokuje wysyłkę do AI,
            // używamy lokalnego setupu świata zamiast uniemożliwiać grę.
            storeWorldSetup(createPresetWorldSetup(adventureContext, eraContext));
          } else {
            const serverMessage =
              (errorBody as { error?: string }).error ||
              preflightResponse.statusText;
            throw new Error(
              `Preflight ${preflightResponse.status}: ${serverMessage}`
            );
          }
        } else {
          const preflightPayload = (await preflightResponse.json()) as {
            worldSetup?: unknown;
          };
          if (!isWorldSetupBundle(preflightPayload.worldSetup)) {
            throw new Error(
              'Preflight nie zwrócił poprawnego WorldSetupBundleV1.'
            );
          }
          if (hasBlockingSetupFailure(preflightPayload.worldSetup.phaseResults)) {
            throw new Error('Preflight wykrył krytyczny błąd setupu.');
          }
          storeWorldSetup(preflightPayload.worldSetup);
        }
      } catch (error) {
        console.error('World preflight failed:', error);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('zew:stop-music'));
        }
        setIsStarting(false);
        setStartProgress(0);
        setStartStatus('');
        setHasStartedGame(false);

        const errorStr = error instanceof Error ? error.message : String(error);
        const isAuthError =
          errorStr.includes('401') ||
          errorStr.includes('BYOK_KEY') ||
          errorStr.includes('API key');

        if (isAuthError && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('open-api-keys-modal'));
        }

        const toastTitle = isAuthError
          ? locale === 'en'
            ? 'Gemini API Key Required'
            : 'Wymagany klucz Gemini API'
          : locale === 'en'
            ? 'World Setup Failed'
            : 'Błąd konfiguracji świata';

        const toastDescription = isAuthError
          ? locale === 'en'
            ? 'The Gemini API key is missing or invalid. Please enter a valid key in settings.'
            : 'Brak klucza Gemini API lub klucz jest nieprawidłowy. Wprowadź poprawny klucz w ustawieniach.'
          : locale === 'en'
            ? 'The adventure cannot start because world preparation failed. Check your settings and try again.'
            : 'Nie można rozpocząć przygody, ponieważ przygotowanie świata nie powiodło się. Sprawdź ustawienia i spróbuj ponownie.';

        toast({
          variant: 'destructive',
          title: toastTitle,
          description: toastDescription,
        });

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('zew:toast', {
              detail: {
                variant: 'destructive',
                title: toastTitle,
                description: toastDescription,
              },
            })
          );
        }

        setMessages([
          {
            id: `world-preflight-error-${crypto.randomUUID()}`,
            role: 'assistant',
            content:
              locale === 'en'
                ? 'The adventure cannot start because world preparation failed. Check the exact year, country, selected characters and API key, then try again.'
                : 'Nie można rozpocząć przygody, ponieważ przygotowanie świata nie przeszło bramki. Sprawdź dokładny rok, kraj, wybrane postacie i klucz API, a potem spróbuj ponownie.',
            timestamp: new Date(),
          },
        ]);
        isStartingRef.current = false;
        return;
      }
    }

    // IND-273 T3: self-check klucza/modeli (fire-and-forget, TTL dławi, nie blokuje startu).
    runHealthCheck?.();

    // Buforowanie TTS w tle
    tts.startInitialBuffering();

    setStartProgress(55);
    setStartStatus(
      locale === 'en'
        ? "Inspecting the investigator's gear and resolve..."
        : 'Weryfikacja ekwipunku i stanu umysłu badacza...'
    );

    // IND-57: zeruj licznik tokenów bieżącej sesji (totalTokens zostaje - career counter)
    resetSessionTokens();

    trackEvent('game_started', {
      adventure: adventureContext?.title ?? 'none',
      era: adventureContext?.eraLabel ?? 'unknown',
      tone: adventureContext?.tone ?? 'unknown',
      preset: aiSettings?.qualityPreset ?? 'unknown',
      hotSeat: hotSeatConfig?.enabled ?? false,
      playersCount: hotSeatConfig?.players?.length ?? 0,
      hasCharacter: !!activeCharacter,
    });

    // Ustaw zegar kampanii na dynamiczną datę startową i pogodę przygody PRZED budowaniem introPromptu.
    // Świeży start nadpisuje stary czas z localStorage; reload zapisanej gry tu nie trafia (osobna ścieżka).
    const effectiveAdv = adventureContext
      ? localizeAdventure(adventureContext, locale === 'en' ? 'en' : 'pl')
      : null;
    timeManager.resetForAdventure(effectiveAdv || adventureContext, locale === 'en' ? 'en' : 'pl');
    setMessages([]); // Wyczyść czat przed startem przygody

    const introPrompt = buildIntroPrompt();
    const assistantMessageId = `gm-intro-${crypto.randomUUID()}`;
    const memoryScope = adventureContext
      ? createCampaignMemoryScope(adventureContext)
      : null;
    if (memoryScope) storeCampaignMemoryScope(memoryScope);

    // Wyczyść wyłącznie obrazy generowane dla egzemplarzy fabularnych. Katalogowe
    // assety są lokalne i muszą przetrwać start bez kosztu ani żądania do API.
    let thumbnailCharacter = activeCharacter;
    if (activeCharacter) {
      const resetEquipment = (activeCharacter.equipment ?? []).map((item) => ({
        ...item,
        ...(item.imageUrl &&
        item.imageUrl.includes('/equipment/catalog/') &&
        item.imageUrl.endsWith('.webp')
          ? {}
          : { imageUrl: undefined, imagePrompt: undefined }),
      }));
      const updatedCharacter = {
        ...activeCharacter,
        equipment: resetEquipment,
      };
      thumbnailCharacter = updatedCharacter;

      // Zaktualizuj stan lokalny i chmurę
      setCharacters((prevList) => {
        const updatedList = prevList.map((c) =>
          c.id === activeCharacter.id ? updatedCharacter : c
        );
        persistCharacters(updatedList);
        return updatedList;
      });
      setActiveCharacter(updatedCharacter);
    }

    // IND-271: miniatury ekwipunku w tle (fire-and-forget, nie blokuje startu).
    generateThumbnailsInBackground(thumbnailCharacter ?? undefined);

    try {
      const activePdfMemory = pdfMemory.adventureId && pdfMemory.adventureId !== adventureContext.id
        ? Object.fromEntries(Object.entries(pdfMemory).filter(([key]) => !key.startsWith('adventure'))) as PdfMemory
        : pdfMemory;
      if (activePdfMemory.adventureDossierStatus === 'unavailable') {
        throw new Error(locale === 'en' ? 'This edition has no ready adventure dossier.' : 'To wydanie nie ma jeszcze gotowej teczki przygody.');
      }
      let startPdfMemory = activePdfMemory;
      if (activePdfMemory.adventureDossierFingerprint || (isAuthoredAdventureId(adventureContext.id) && activateDossierForSession)) {
        if (!memoryScope || !adventureContext?.id || !activateDossierForSession) {
          throw new Error('DOSSIER_SESSION_ACTIVATION_UNAVAILABLE');
        }
        setStartProgress(65);
        setStartStatus(
          locale === 'en'
            ? 'Unlocking the exact adventure dossier locally...'
            : 'Lokalne odblokowanie teczki dokładnego wydania...'
        );
        const activation = await activateDossierForSession(
          memoryScope.playthroughId,
          adventureContext.id,
        );
        if (!activation.ok) {
          throw new Error(activation.reason || 'DOSSIER_SESSION_ACTIVATION_FAILED');
        }
        if (activation.adventureDossierFingerprint) {
          startPdfMemory = { ...activePdfMemory, adventureDossierFingerprint: activation.adventureDossierFingerprint, adventureDossierStatus: 'ready' };
        }
      }

      const openingPayload = startPdfMemory.adventureDossierFingerprint && adventureContext?.id
        ? await loadRuntimeDossierPayload(adventureContext.id,startPdfMemory.adventureDossierFingerprint) : undefined;
      const openingSceneImage = locale === 'pl' && openingPayload?.adventure_id === 'cien-nad-prabutami' &&
        openingPayload.records.some(record=>record.evidence.approval==='pending' && isRuntimeAuthorizedDossierRecord(record))
          ? '/handouts/cien-nad-prabutami/playtest/newsroom-1973.png' : undefined;
      const dossierOpening = openingPayload && startPdfMemory.adventureDossierFingerprint && memoryScope && adventureContext?.id
        ? createDossierOpeningCommit({
            payload: openingPayload,
            playthroughId:memoryScope.playthroughId,adventureId:adventureContext.id,
            editionFingerprint:startPdfMemory.adventureDossierFingerprint,turnId:assistantMessageId,
            location:adventureContext.activeLocationId || adventureContext.location || '',
            now:new Date(),gameTime:timeManager.getTime(),era:adventureContext.yearRange || adventureContext.era || '1920s',
            characters:characters.map(character=>character.id===thumbnailCharacter?.id?thumbnailCharacter:character),
            activeCharacter:thumbnailCharacter ?? activeCharacter,skillTests:[],skillRolls:[],
            isCurrent:()=>loadCampaignMemoryScope()?.playthroughId===memoryScope.playthroughId && currentAdventureId.current===adventureContext.id,
          }, openingSceneImage) : undefined;

      const resolvedHotSeat = hotSeatConfig?.enabled
        ? {
            ...hotSeatConfig,
            players: (hotSeatConfig.players || []).map((player) => {
              const matchedChar = characters.find(
                (c) =>
                  c.id === player.characterId || c.playerName === player.name
              );
              return {
                ...player,
                characterId: matchedChar?.id || player.characterId,
                characterName: matchedChar?.name,
              };
            }),
          }
        : hotSeatConfig;

      // Zadanie 6: retry na chwilowy blip sieci przy starcie gry (1-2 próby).
      setStartProgress(75);
      setStartStatus(
        locale === 'en'
          ? 'Tuning into the ether (contacting the Keeper)...'
          : 'Słuchanie szumów z eteru (kontakt ze Strażnikiem)...'
      );
      const response = await fetchWithRetry(
        '/api/chat',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getApiKeyHeaders(),
          },
          body: JSON.stringify({
            message: introPrompt,
            messages: [],
            pdfMemory: startPdfMemory,
            // Sanityzuj postać (portret + miniatury ekwipunku = base64 ~MB) by nie
            // przekroczyć limitu payloadu /api/chat (regresja B2 28.06).
            character: sanitizeCharacterForApi(activeCharacter),
            characters: (characters || []).map((c) => sanitizeCharacterForApi(c)),
            hotSeatConfig: resolvedHotSeat,
            adventureContext: adventureContext,
            memoryScope,
            assistantMessageId,
            eraContext: loadStoredWorldSetup()?.eraContext,
            locale,
            npcs: loadNpcSnapshot(),
            isGameStart: true,
            aiSettings: aiSettings,
            gameTime: timeManager.getTime(),
          }),
        },
        3,
        1500,
        (attempt) => {
          setStartStatus(
            locale === 'en'
              ? `Astral waves are turbulent (Gemini high demand, retry ${attempt}/3)...`
              : `Astralne fale są wzburzone (przeciążenie serwera Gemini, próba ${attempt}/3)...`
          );
        }
      );

      // Walidacja HTTP przed strumieniowaniem SSE. Bez tego serwer zwracający
      // JSON z błędem (np. 401 BYOK_KEY_MISSING) jest cicho ignorowany przez
      // parseSSEStream - żaden wiersz nie zaczyna się od "data: ", parser
      // kończy z fullText="" i blok catch się nie wykonuje, zostawiając
      // osieroconą pustą wiadomość asystenta na ekranie.
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const serverMsg =
          (errorBody as Record<string, string>)?.error || response.statusText;
        throw new Error(`Chat API ${response.status}: ${serverMsg}`);
      }

      setStartProgress(75);
      setStartStatus(
        locale === 'en'
          ? 'Crossing the threshold of the unknown (chronicling the scene)...'
          : 'Przekraczanie progu nieznanego (spisywanie sceny)...'
      );

      // Dodaj pustą wiadomość asystenta do strumieniowania
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        },
      ]);
      let hasTransitionedToGame = false;
      const transitionToGame = (immediate = false): Promise<void> => {
        if (hasTransitionedToGame) return Promise.resolve();
        hasTransitionedToGame = true;
        setStartProgress(100);
        setStartStatus(
          locale === 'en' ? 'Beginning the adventure!' : 'Zaczynamy przygodę!'
        );
        const finalize = () => {
          setHasStartedGame(true);
          if (typeof window !== 'undefined') {
            localStorage.setItem('has_started_game', 'true');
            localStorage.setItem('session_started_at', String(Date.now()));
          }
          setIsStarting(false);
        };
        if (immediate) {
          finalize();
          return Promise.resolve();
        }
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            finalize();
            resolve();
          }, 350);
        });
      };

      // Użyj uniwersalnego parsera SSE.
      // IND-256 (bliźniak useChat): `streamedFullText` akumuluje pełny tekst z
      // onText, by onMetadata mógł go użyć BEZ czytania zewnętrznego `fullText`.
      // `const fullText` jest przypisywany dopiero po ZAKOŃCZENIU parseSSEStream,
      // a onMetadata jest wywoływane WEWNĄTRZ parsera (przed przypisaniem) →
      // czytanie `fullText` w onMetadata rzucało TDZ ReferenceError (cicho
      // połykany przez try/catch parsera, surfaced przez onParseError → Sentry
      // na każdym starcie gry). Ten sam fix co useChat.ts:293.
      let streamedFullText = '';
      let introImageTriggered = Boolean(openingSceneImage);
      const parseOpeningStream = dossierOpening ? async (stream:Response, callbacks:SSECallbacks) => {
        const accepted=await dossierOpening(stream);
        if(accepted.rosterChanged) {
          setCharacters(accepted.characters);setActiveCharacter(accepted.activeCharacter);
          void offloadCharacterImages(accepted.characters);
        }
        setMessages([accepted.message]);
        if(accepted.memory) notifyMemoryCommit(accepted.memory,locale);
        callbacks.onText?.(accepted.text);
        callbacks.onMetadata?.(accepted.metadata);
        return accepted.text;
      } : parseSSEStream;
      const fullText = await parseOpeningStream(response, {
        onText: (text) => {
          streamedFullText = text;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId ? { ...msg, content: text } : msg
            )
          );
          // Płynny mikro-postęp 75% -> 95% podczas dopisywania tekstu wstępu przez AI
          const dynamicProgress = Math.min(95, 75 + Math.floor(text.length / 40));
          setStartProgress((prev) => Math.max(prev, dynamicProgress));
          setStartStatus(
            locale === 'en'
              ? 'Spelling out the opening chronicle...'
              : 'Spisywanie kroniki otwarcia...'
          );

          // Inkrementalny TTS
          if (tts.voiceEnabled && tts.isTTSEnabled) {
            tts.addToQueue(text, assistantMessageId);
          }
        },
        onMetadata: (metadata) => {
          if (!dossierOpening) notifyMemoryCommit(metadata,locale);
          // Generowanie obrazu intro na podstawie opisu pierwszej sceny lub wyemitowanego promptu
          if (!introImageTriggered && aiSettings?.imageGenerationEnabled !== false && !isPureTextMode()) {
            introImageTriggered = true;
            const illustrations = Array.isArray(metadata.illustrations)
              ? (metadata.illustrations as Array<{ prompt?: string }>)
              : undefined;
            const firstPrompt = illustrations?.[0]?.prompt;
            const sceneDesc = firstPrompt || streamedFullText;
            void generateIntroImage(assistantMessageId, sceneDesc);
          }

          // finishReason z metadanych (MAX_TOKENS = urwane intro) musi trafić
          // na wiadomość - bez tego przycisk "Kontynuuj narrację" nie wie, że
          // intro jest częściowe.
          if (metadata.finishReason) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, finishReason: String(metadata.finishReason) }
                  : msg
              )
            );
          }

          // Metadane costData zapisz do wiadomości
          if (metadata.costData) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, costData: metadata.costData }
                  : msg
              )
            );
          }

          if (tts.voiceEnabled && tts.isTTSEnabled) {
            // M6 sesja 146: drop multi-voice branch per D3.
            tts.generateVoiceForMessage(
              {
                id: assistantMessageId,
                role: 'assistant',
                content: streamedFullText,
                timestamp: new Date(),
              },
              []
            );
          }
        },
        // Defensive-in-depth (po IND-256): eskaluje prawdziwe błędy z
        // onText/onMetadata (np. generowanie obrazu intro) do Sentry + konsoli
        // zamiast cichego połknięcia przez parser. SyntaxError partial-chunków
        // jest pomijany.
        onParseError: createSseParseErrorHandler({
          endpoint: '/api/chat',
          hook: 'useGameStart',
        }),
      });

      if (!introImageTriggered && aiSettings?.imageGenerationEnabled !== false && !isPureTextMode()) {
        introImageTriggered = true;
        void generateIntroImage(assistantMessageId, fullText || streamedFullText);
      }

      // Oczekiwanie na zbuforowanie głosu lektora przed wejściem gracza do sceny (Issue #142)
      if (tts.voiceEnabled && tts.isTTSEnabled && tts.waitForInitialBuffer) {
        setStartProgress(95);
        setStartStatus(
          locale === 'en'
            ? 'Buffering narrator voice...'
            : 'Buforowanie głosu lektora...'
        );
        await tts.waitForInitialBuffer(15000);
      }

      // Issue #157: Zakończono generowanie pełnego otwarcia i buforowanie głosu lektora (100%)
      setStartProgress(100);
      setStartStatus(
        locale === 'en'
          ? 'The chronicle is ready. Enter when you are prepared.'
          : 'Kronika spisana. Wejdź, gdy będziesz gotów.'
      );
      setIsReadyToEnter(true);

      // Czekaj na kliknięcie przycisku CTA przez gracza (bramka akceptacji)
      await waitForPlayerConfirmation();

      setIsReadyToEnter(false);

      // Odblokuj i uruchom przygotowane pierwsze zdania głosu lektora
      if (tts.playInitialNarration) {
        tts.playInitialNarration();
      }

      // Zakończono generowanie pełnego otwarcia: odsłoń czat z gotową sceną (Issue #123)
      await transitionToGame();

      // IND-201 / Issue #153: auto-dziennik dla openingu (opening idzie tym samym /api/chat
      // z gm-protocol, może nieść [DZIENNIK:] z prefiksem @Imię). Idempotentne (dedup po messageId).
      if (activeCharacter && !dossierOpening) {
        const j = appendJournalToParty(
          characters,
          activeCharacter,
          fullText,
          assistantMessageId
        );
        if (j.changed) {
          setActiveCharacter(j.activeCharacter);
          setCharacters(j.characters);
          if (typeof window !== 'undefined') {
            persistCharacters(j.characters);
          }
        }
      }
    } catch (error) {
      console.error('Game start intro failed:', error);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('zew:stop-music'));
      }
      tts.cancelInitialBuffering?.();
      setIsStarting(false);
      setIsReadyToEnter(false);
      setStartProgress(0);
      setStartStatus('');
      tts.stopCurrentAudio();

      const errorStr = error instanceof Error ? error.message : String(error);

      let statusCode: number | undefined;
      const statusMatch = errorStr.match(/\b(400|401|403|429|500|502|503|504)\b/);
      if (statusMatch) {
        statusCode = parseInt(statusMatch[1], 10);
      }

      const is503 = statusCode === 503 || /503|high demand|overloaded|unavailable/i.test(errorStr);
      const is429 = statusCode === 429 || /429|quota|resource_exhausted|rate limit/i.test(errorStr);
      const isAuthError = statusCode === 401 || /401|byok_key|api key|unauthorized/i.test(errorStr);
      const isNetwork = isNetworkBlip(error) || /network|failed to fetch|aborted|econnreset|enotfound/i.test(errorStr);

      let category: GameStartError['category'] = 'general_error';
      if (is503) {
        category = 'server_overloaded';
      } else if (is429) {
        category = 'quota_exceeded';
      } else if (isAuthError) {
        category = 'auth_error';
      } else if (isNetwork) {
        category = 'network_error';
      }

      const errorTitle = locale === 'en'
        ? category === 'server_overloaded'
          ? 'Gemini Servers Overloaded [Error 503]'
          : category === 'quota_exceeded'
          ? 'API Quota Exceeded [Error 429]'
          : category === 'auth_error'
          ? 'Gemini API Key Required [Error 401]'
          : category === 'network_error'
          ? 'Network Connection Problem'
          : 'Game Start Error'
        : category === 'server_overloaded'
          ? 'Przeciążenie darmowych serwerów Gemini [Błąd 503]'
          : category === 'quota_exceeded'
          ? 'Wyczerpano limit zapytań Gemini API [Błąd 429]'
          : category === 'auth_error'
          ? 'Wymagany poprawny klucz Gemini API [Błąd 401]'
          : category === 'network_error'
          ? 'Problem z połączeniem sieciowym'
          : 'Błąd uruchamiania gry';

      const userAdvice = locale === 'en'
        ? category === 'server_overloaded'
          ? 'Google Gemini servers are currently experiencing high demand on the free tier. Wait a minute and click "Try Again", or configure a Pay-as-you-go key in Settings.'
          : category === 'quota_exceeded'
          ? 'Your Gemini API quota has been exhausted. Wait for your quota to reset or provide a different API key in Settings.'
          : category === 'auth_error'
          ? 'The Gemini API key is missing, invalid or expired. Open API Settings to paste a valid key and try again.'
          : category === 'network_error'
          ? 'A network issue interrupted the connection to the Keeper. Check your internet connection and click "Try Again".'
          : 'An unexpected issue occurred while chronicling the opening scene. Try again or check your API key.'
        : category === 'server_overloaded'
          ? 'Serwery Google Gemini przeżywają chwilowe przeciążenie na darmowym planie Free Tier. Odczekaj minutę i kliknij „Spróbuj ponownie” lub podepnij płatny klucz Pay-as-you-go w Ustawieniach.'
          : category === 'quota_exceeded'
          ? 'Limit zapytań dla Twojego klucza Gemini został wyczerpany. Odczekaj do odnowienia limitu lub podaj inny klucz w Ustawieniach.'
          : category === 'auth_error'
          ? 'Klucz Gemini API jest nieprawidłowy, wygasł lub nie został skonfigurowany. Otwórz Ustawienia API, wklej poprawny klucz i spróbuj ponownie.'
          : category === 'network_error'
          ? 'Przerwano połączenie ze Strażnikiem Tajemnic. Sprawdź połączenie z internetem i kliknij „Spróbuj ponownie”.'
          : 'Wystąpił nieoczekiwany problem przy spisywaniu kroniki otwarcia. Spróbuj ponownie lub sprawdź swój klucz API.';

      setStartError({
        statusCode,
        category,
        title: errorTitle,
        userAdvice,
        technicalDetails: errorStr,
      });

      if (isAuthError && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('open-api-keys-modal'));
      }

      // Usuń wszelkie puste lub częściowe dymki asystenta z czatu
      setMessages((prev) => prev.filter((msg) => msg.id !== assistantMessageId));
    } finally {
      isStartingRef.current = false;
      setIsStarting(false);
    }
  }, [
    setHasStartedGame,
    activeCharacter,
    characters,
    setActiveCharacter,
    setCharacters,
    pdfMemory,
    activateDossierForSession,
    adventureContext,
    hotSeatConfig,
    setMessages,
    tts,
    buildIntroPrompt,
    generateIntroImage,
    generateThumbnailsInBackground,
    aiSettings,
    runHealthCheck,
    waitForPlayerConfirmation,
    locale,
  ]);

  const retryStartGame = useCallback(async () => {
    setStartError(null);
    await handleStartGame();
  }, [handleStartGame]);

  const cancelStartGame = useCallback(() => {
    setStartError(null);
    setIsStarting(false);
    setIsReadyToEnter(false);
    setStartProgress(0);
    setStartStatus('');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('zew:stop-music'));
    }
  }, []);

  return {
    handleStartGame,
    isStarting,
    startProgress,
    startStatus,
    isReadyToEnter,
    confirmEnterGame,
    startError,
    retryStartGame,
    cancelStartGame,
  };
}
