import { isAcceptedLocationLength, resolveCanonicalAdventureLocation, extractLatestCanonicalLocationTag } from '../canonical-adventure-location';
import type { Character, NPC } from '@/lib/types';
import type { ResolvedEraContext } from '@/lib/era';
import { WorldEngineDirector } from './index';
import type { WorldEngineId } from './dispatcher';
import {
  formatSceneDirective,
  type SceneTechniqueSelection,
} from '../narrative-engine/scene-director';
import { pickLovecraftianSensoryTheme } from './lovecraft-lexicon';
export * from './dispatcher';
import type {
  NPCEntity,
  SensoryContext,
  GeographyContext,
  OccultContext,
  SettingFriction,
  ClueNode,
  SceneFramingContext,
} from './types';

interface AdapterAdventureConflictFaction {
  name?: string;
  goal?: string;
}

interface AdapterAdventureConflict {
  tensionType?: 'class' | 'belief' | 'institutional';
  description?: string;
  resource?: string;
  stakes?: string;
  factions?: AdapterAdventureConflictFaction[];
}

interface AdapterAdventurePuzzle {
  id?: string;
  title?: string;
  description?: string;
  solution?: string;
  solutionSummary?: string;
}

interface AdapterGraphNode {
  id?: string;
  label?: string;
  name?: string;
  type?: string;
  isBottleneck?: boolean;
}

interface AdapterAdventureGraph {
  nodes?: AdapterGraphNode[];
  locations?: Array<{ name?: string }>;
}

export interface SecretItem {
  id?: string;
  name?: string;
  title?: string;
  text?: string;
  secret?: string;
  description?: string;
  carrier?: string;
  requiredSkill?: string;
  isDiscovered?: boolean;
  discovered?: boolean;
  clueType?: 'core' | 'flavor';
}

export type SecretInput = string | SecretItem;

export interface WorldEngineAdapterParams {
  locale?: 'pl' | 'en';
  adventureContext?: {
    title?: string;
    location?: string;
    themes?: string[];
    conflicts?: AdapterAdventureConflict[];
    setupAsymmetry?: {
      rumors?: string[];
    };
    puzzles?: AdapterAdventurePuzzle[];
    graph?: AdapterAdventureGraph;
    truthAnchor?: {
      culprit?: string;
      immutableFacts?: string[];
    };
    boundarySummary?: string;
    secretsPool?: SecretInput[] | null;
    secrets?: SecretInput[] | null;
  } | null;
  currentLocation?: string | null;
  npcs?: NPC[] | null;
  character?: Character | null;
  characters?: Character[] | null;
  eraContext?: Partial<ResolvedEraContext> | { countryCode?: string; effectiveYear?: number } | null;
  playerMessage?: string | null;
  activeEngines?: Partial<Record<WorldEngineId, boolean>> | null;
  sceneTechniqueSelection?: SceneTechniqueSelection | null;
  turnsInCurrentLocation?: number;
  messagesCount?: number;
  visitedMacroLocations?: string[];
  isNewMacroLocation?: boolean;
  heat?: number;
  messages?: Array<{ role?: string; content?: string }> | null;
  boundarySummary?: string;
  secretsPool?: SecretInput[] | null;
  secrets?: SecretInput[] | null;
  deadlockDetected?: boolean;
  valueChargeHint?: '+' | '-' | 'neutral' | string;
}

const FACILITY_GROUPS: Array<{ id: string; pattern: RegExp }> = [
  { id: 'hospital', pattern: /\b(szpital[a-ząćęłńóśźż]*|klinik[a-ząćęłńóśźż]*|lazaret[a-ząćęłńóśźż]*|hospital|clinic|infirmary)\b/i },
  { id: 'asylum', pattern: /\b(sanatori[a-ząćęłńóśźż]*|azyl[a-ząćęłńóśźż]*|psychiatryczn[a-ząćęłńóśźż]*|asylum|sanitarium)\b/i },
  { id: 'manor', pattern: /\b(rezydencj[a-ząćęłńóśźż]*|posiadłoś[a-ząćęłńóśźż]*|posiadlos[a-ząćęłńóśźż]*|dwór|dwor[a-ząćęłńóśźż]*|pałac[a-ząćęłńóśźż]*|palac[a-ząćęłńóśźż]*|will[aieąęy]|manor|mansion|estate)\b/i },
  { id: 'university', pattern: /\b(uniwersytet[a-ząćęłńóśźż]*|uczelni[a-ząćęłńóśźż]*|kampus[a-ząćęłńóśźż]*|university|campus|college)\b/i },
  { id: 'police', pattern: /\b(posterun[a-ząćęłńóśźż]*|komisariat[a-ząćęłńóśźż]*|areszt[a-ząćęłńóśźż]*|więzien[a-ząćęłńóśźż]*|wiezien[a-ząćęłńóśźż]*|police|precinct|jail|prison)\b/i },
  { id: 'church', pattern: /\b(kościół|kościoł[a-ząćęłńóśźż]*|kościach|kościele|kosciol[a-ząćęłńóśźż]*|kosciel[a-ząćęłńóśźż]*|parafi[a-ząćęłńóśźż]*|katedr[a-ząćęłńóśźż]*|świątyn[a-ząćęłńóśźż]*|swiatyn[a-ząćęłńóśźż]*|church|cathedral|parish|temple)\b/i },
  { id: 'hotel', pattern: /\b(hotel[a-ząćęłńóśźż]*|pensjonat[a-ząćęłńóśźż]*|zajazd[a-ząćęłńóśźż]*|gospod[a-ząćęłńóśźż]*|karczm[a-ząćęłńóśźż]*|inn|boarding\s+house)\b/i },
  { id: 'museum', pattern: /\b(muzeum|muzealn[a-ząćęłńóśźż]*|museum)\b/i },
  { id: 'cemetery', pattern: /\b(cmentarz[a-ząćęłńóśźż]*|nekropoli[a-ząćęłńóśźż]*|cemetery|graveyard)\b/i },
  { id: 'lighthouse', pattern: /\b(latarni[a-ząćęłńóśźż]*|lighthouse)\b/i },
  { id: 'tenement', pattern: /\b(kamienic[a-ząćęłńóśźż]*|czynszów[a-ząćęłńóśźż]*|tenement)\b/i },
  { id: 'docks', pattern: /\b(port[a-ząćęłńóśźż]*|dok(?:ach|ami|[iyów])?|przystań|przystani[a-ząćęłńóśźż]*|stoczni[a-ząćęłńóśźż]*|harbor|docks?|shipyard)\b/i },
];

const ROOM_PREFIX_REGEX =
  /^(sala(?:\s+chorych|\s+operacyjna|\s+sekcyjna|\s+wykładowa)?|gabinet(?:\s+ordynatora|\s+dyrektora|\s+dziekana|\s+lekarski)?|kostnica|prosektorium|piwnica|podziemia|strych|poddasze|korytarz|hol|recepcja|poczekalnia|archiwum|czytelnia|kaplica|kuchnia|jadalnia|sypialnia|cela|pokój(?:\s+gościnny|\s+przesłuchań|\s+nr\s*\d+)?|pokoj(?:\s+nr\s*\d+)?|biuro|magazyn(?:\s+nr\s*\d+)?|laboratorium|kotłownia|kotlownia|izolatka|dyżurka|dyzurka|szatnia|ward|morgue|office|cellar|basement|attic|corridor|hallway|reception|archive|reading\s+room|chapel|kitchen|dining\s+room|bedroom|cell|room|storage|laboratory|boiler\s+room)\s+(?:w\s+|we\s+|na\s+|pod\s+|w\s+gmachu\s+|in\s+the\s+|in\s+|at\s+the\s+|at\s+|of\s+the\s+|of\s+)?(.+)$/i;

function detectFacilityGroup(location: string): string | undefined {
  if (!location) return undefined;
  for (const group of FACILITY_GROUPS) {
    if (group.pattern.test(location)) {
      return group.id;
    }
  }
  return undefined;
}

/**
 * Wyodrębnia nadrzędną strefę / obiekt (makrolokację) z nazwy lokacji.
 * Rozpoznaje prefiksy przed myślnikami, dwukropkami, ukośnikami, przecinkami, nawiasami
 * oraz konstrukcje typu "Kostnica w Szpitalu Miejskim" / "Kostnica Szpitala Miejskiego".
 */
export function extractMacroLocation(location: string): string {
  if (!location) return '';
  const trimmed = location.trim();
  const splitMatch = trimmed.match(/^(.+?)\s*(?:[-–—:/]|,)\s*(.+)$/);
  if (splitMatch && splitMatch[1].trim().length >= 3) {
    return splitMatch[1].trim();
  }
  const parenMatch = trimmed.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (parenMatch && parenMatch[1].trim().length >= 3) {
    return parenMatch[1].trim();
  }
  const roomMatch = trimmed.match(ROOM_PREFIX_REGEX);
  if (roomMatch && roomMatch[2].trim().length >= 4 && detectFacilityGroup(roomMatch[2])) {
    return roomMatch[2].trim();
  }
  return trimmed;
}

/**
 * Wyodrębnia podlokację / nazwę pokoju.
 */
export function extractSubLocation(location: string): string | undefined {
  if (!location) return undefined;
  const trimmed = location.trim();
  const splitMatch = trimmed.match(/^.+?\s*(?:[-–—:/]|,)\s*(.+)$/);
  if (splitMatch && splitMatch[1].trim()) {
    return splitMatch[1].trim();
  }
  const parenMatch = trimmed.match(/^.+?\s*\(([^)]+)\)\s*$/);
  if (parenMatch && parenMatch[1].trim()) {
    return parenMatch[1].trim();
  }
  const roomMatch = trimmed.match(ROOM_PREFIX_REGEX);
  if (roomMatch && roomMatch[1].trim() && detectFacilityGroup(roomMatch[2])) {
    return roomMatch[1].trim();
  }
  return undefined;
}

/**
 * Sprawdza czy dwie lokacje należą do tej samej nadrzędnej strefy / makrolokacji.
 * Obsługuje zarówno jawne separatory ("Szpital - Sala" vs "Szpital - Kostnica"),
 * jak i odmianę fleksyjną tego samego obiektu ("Szpital Miejski" vs "Kostnica Szpitala Miejskiego").
 */
export function isSameMacroLocation(locA: string, locB: string): boolean {
  if (!locA || !locB) return false;
  const macroA = extractMacroLocation(locA).toLowerCase().trim();
  const macroB = extractMacroLocation(locB).toLowerCase().trim();
  if (!macroA || !macroB) return false;
  if (macroA === macroB) return true;

  const groupA = detectFacilityGroup(locA);
  const groupB = detectFacilityGroup(locB);
  if (groupA && groupB) {
    return groupA === groupB;
  }

  return false;
}

export interface DerivedSceneSensoryMemory {
  currentLocation: string;
  turnsInCurrentLocation: number;
  visitedMacroLocations: string[];
}

function addVisitedMacro(list: string[], locationName: string): void {
  const macro = extractMacroLocation(locationName);
  if (!macro) return;
  const alreadyPresent = list.some(
    (existing) =>
      existing.toLowerCase().trim() === macro.toLowerCase().trim() ||
      isSameMacroLocation(existing, macro)
  );
  if (!alreadyPresent) {
    list.push(macro);
  }
}

function extractLastLocationTagFromContent(content: string, adventureId?: string, canonicalOnly = false): string | undefined {
  if (!content) return undefined;
  if (canonicalOnly) return extractLatestCanonicalLocationTag(content, adventureId)?.name;
  const regex = /\[(?:LOKACJA|LOCATION):\s*([^:|\]\n]+)/gi;
  let lastMatch: string | undefined;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const candidate = match[1]?.trim();
    if (candidate && isAcceptedLocationLength(candidate, adventureId)) {
      lastMatch = canonicalOnly ? resolveCanonicalAdventureLocation(adventureId,candidate)?.name ?? lastMatch : candidate;
    }
  }
  return lastMatch;
}

/**
 * Odtwarza deterministycznie stan pamięci sensorycznej sceny (bieżącą lokację,
 * liczbę tur spędzonych w bieżącej lokacji oraz listę odwiedzonych makrolokacji)
 * na podstawie historii wiadomości i opcjonalnej lokacji bieżącej.
 */
export function deriveSceneSensoryMemoryFromMessages(
  messages?: Array<{ role?: string; content?: string }> | null,
  fallbackLocation?: string | null,
  adventureId?: string,
  canonicalOnly = false
): DerivedSceneSensoryMemory {
  const visitedMacroLocations: string[] = [];
  let activeLocation = '';
  let turnsInCurrentLocation = 0;

  if (Array.isArray(messages)) {
    for (const msg of messages) {
      if (!msg || msg.role !== 'assistant' || typeof msg.content !== 'string') {
        continue;
      }
      const tagLoc = extractLastLocationTagFromContent(msg.content, adventureId, canonicalOnly);
      if (tagLoc) {
        if (!activeLocation || activeLocation.toLowerCase() === tagLoc.toLowerCase()) {
          activeLocation = tagLoc;
          turnsInCurrentLocation += 1;
          addVisitedMacro(visitedMacroLocations, tagLoc);
        } else {
          addVisitedMacro(visitedMacroLocations, activeLocation);
          activeLocation = tagLoc;
          turnsInCurrentLocation = 0;
          if (isSameMacroLocation(visitedMacroLocations[visitedMacroLocations.length - 1] || '', tagLoc)) {
            addVisitedMacro(visitedMacroLocations, tagLoc);
          }
        }
      } else {
        const effectiveLoc = activeLocation || fallbackLocation?.trim() || '';
        if (effectiveLoc) {
          activeLocation = effectiveLoc;
          turnsInCurrentLocation += 1;
          addVisitedMacro(visitedMacroLocations, effectiveLoc);
        }
      }
    }
  }

  const trimmedFallback = fallbackLocation?.trim() || '';
  if (trimmedFallback) {
    if (!activeLocation) {
      activeLocation = trimmedFallback;
    } else if (activeLocation.toLowerCase() !== trimmedFallback.toLowerCase()) {
      addVisitedMacro(visitedMacroLocations, activeLocation);
      activeLocation = trimmedFallback;
      turnsInCurrentLocation = 0;
    }
  }

  return {
    currentLocation: activeLocation,
    turnsInCurrentLocation,
    visitedMacroLocations,
  };
}

/**
 * Wyrażenia regularne klasyfikacji hałasu / rozgłosu działań gracza (Issue #648 Faza 1 R2).
 */
const HEAT_LOUD_PATTERNS: RegExp[] = [
  /(?:^|[^\p{L}\p{N}])(strzał[a-ząćęłńóśźż]*|strzel[a-ząćęłńóśźż]*|wystrzał[a-ząćęłńóśźż]*|rewolwer[a-ząćęłńóśźż]*|pistolet[a-ząćęłńóśźż]*|strzelb[a-ząćęłńóśźż]*|karabin[a-ząćęłńóśźż]*|gunshot|shoot|firearm)(?:[^\p{L}\p{N}]|$)/iu,
  /(?:^|[^\p{L}\p{N}])(wyważ[a-ząćęłńóśźż]*|rozbij[a-ząćęłńóśźż]*|wybij[a-ząćęłńóśźż]*|łom[a-ząćęłńóśźż]*|taranuj[a-ząćęłńóśźż]*|włam[a-ząćęłńóśźż]*|force|break|crowbar|smash)(?:[^\p{L}\p{N}]|$)/iu,
  /(?:^|[^\p{L}\p{N}])(awantur[a-ząćęłńóśźż]*|krzycz[a-ząćęłńóśźż]*|wrzask[a-ząćęłńóśźż]*|bójk[a-ząćęłńóśźż]*|bijatyk[a-ząćęłńóśźż]*|alarm[a-ząćęłńóśźż]*|eksplozj[a-ząćęłńóśźż]*|wybuch[a-ząćęłńóśźż]*|brawl|shout|scream|explosion)(?:[^\p{L}\p{N}]|$)/iu,
];

const HEAT_QUIET_PATTERNS: RegExp[] = [
  /(?:^|[^\p{L}\p{N}])(odpocz[a-ząćęłńóśźż]*|śpię|spać|sen|drzem[a-ząćęłńóśźż]*|hotel[a-ząćęłńóśźż]*|nocleg[a-ząćęłńóśźż]*|spędz[a-ząćęłńóśźż]*\s+noc[a-ząćęłńóśźż]*|rest|sleep|wait|camp)(?:[^\p{L}\p{N}]|$)/iu,
  /(?:^|[^\p{L}\p{N}])(dyskretn[a-ząćęłńóśźż]*|skrad[a-ząćęłńóśźż]*|ukry[a-ząćęłńóśźż]*|cich[a-ząćęłńóśźż]*|szept[a-ząćęłńóśźż]*|szepcz[a-ząćęłńóśźż]*|w cieniu|zacieram ślady|ostrożn[a-ząćęłńóśźż]*|stealth|sneak|hide|quietly|discreet)(?:[^\p{L}\p{N}]|$)/iu,
];

/**
 * Deterministycznie wylicza poziom rozgłosu (heat) na podstawie historii wiadomości (Issue #648 Faza 1 R2).
 * - Zakres: 0 do 5 (clamped)
 * - Głośne akcje (strzały, wyważenia, awantury) zwiększają heat o 1
 * - Dyskrecja i odpoczynek (skradanie, sen, dyskrecja) redukują heat o 1 (min 0)
 */
export function deriveHeatFromMessages(
  messages?: Array<{ role?: string; content?: string }> | null
): number {
  if (!Array.isArray(messages) || messages.length === 0) {
    return 0;
  }

  let heat = 0;
  for (const msg of messages) {
    if (!msg || typeof msg.content !== 'string') continue;
    // Sprawdzamy akcje gracza (rola 'user', 'player' lub brak jawnej roli).
    // Odpowiedzi 'assistant' czy 'system' pomijamy.
    const role = msg.role?.toLowerCase();
    if (role === 'assistant' || role === 'system') continue;

    const content = msg.content;
    const isLoud = HEAT_LOUD_PATTERNS.some((pat) => pat.test(content));
    if (isLoud) {
      heat = Math.min(5, heat + 1);
      continue;
    }

    const isQuiet = HEAT_QUIET_PATTERNS.some((pat) => pat.test(content));
    if (isQuiet) {
      heat = Math.max(0, heat - 1);
    }
  }

  return heat;
}

/**
 * Ekstrahuje i filtruje nieodkryte sekrety z puli (Mike Shea - Secrets & Clues Pool).
 * Pomija sekrety już oznaczone jako odkryte (isDiscovered / discovered) lub pasujące do tytułów poszlak w dossier.
 * Zabezpieczone przed duplikatami i pustymi wpisami.
 */
export function extractUndiscoveredSecrets(
  secrets?: SecretInput[] | null,
  discoveredTitles?: string[]
): string[] {
  if (!Array.isArray(secrets) || secrets.length === 0) {
    return [];
  }

  const normalizedDiscovered = new Set(
    (discoveredTitles || [])
      .map((t) => (typeof t === 'string' ? t : String(t ?? '')).toLowerCase().trim())
      .filter(Boolean)
  );

  const result: string[] = [];
  const seenTexts = new Set<string>();

  for (const item of secrets) {
    if (!item) continue;
    let text = '';
    let isDiscovered = false;
    let itemId = '';

    if (typeof item === 'string') {
      text = item.trim();
    } else if (typeof item === 'object') {
      const rawText = item.text ?? item.description ?? item.secret ?? item.title ?? item.name ?? '';
      text = String(rawText).trim();
      const rawObj = item as Record<string, unknown>;
      isDiscovered = Boolean(
        item.isDiscovered ||
        item.discovered ||
        rawObj.discoveryStatus === 'discovered' ||
        rawObj.discoveryStatus === 'verified' ||
        rawObj.status === 'discovered'
      );
      itemId = item.id !== undefined && item.id !== null ? String(item.id).toLowerCase().trim() : '';
    }

    if (!text) continue;
    const lower = text.toLowerCase();
    if (isDiscovered) continue;
    if (normalizedDiscovered.has(lower)) continue;
    if (itemId && normalizedDiscovered.has(itemId)) continue;

    // Dopasowanie podciągów z poszlakami z dossier:
    // Wymaga wyraźnej frazy wielowyrazowej (min. 2 słowa i min. 10 znaków) lub min. 15 znaków,
    // aby pojedyncze słowa pospolite (np. 'piwnica', 'szpital') nie odfiltrowywały obcych sekretów.
    const isMatchedByDiscovered = Array.from(normalizedDiscovered).some((disc) => {
      const isSubstantialDisc = disc.length >= 15 || (disc.length >= 10 && disc.split(/\s+/).length >= 2);
      if (isSubstantialDisc && lower.includes(disc)) {
        return true;
      }
      const isSubstantialSecret = lower.length >= 15 || (lower.length >= 10 && lower.split(/\s+/).length >= 2);
      if (isSubstantialSecret && disc.includes(lower)) {
        return true;
      }
      return false;
    });
    if (isMatchedByDiscovered) continue;

    if (seenTexts.has(lower)) continue;

    seenTexts.add(lower);
    result.push(text);
  }

  return result;
}

/**
 * Formatuje dyrektywę puli sekretów Mike'a Shea z 3 żelaznymi bezpiecznikami anty-pleasing (Issue #648 Faza 2 R1).
 */
export function formatSecretsDirective(
  secrets: SecretInput[],
  options?: { locale?: 'pl' | 'en'; maxSecrets?: number; discoveredTitles?: string[] }
): string {
  const locale = options?.locale ?? 'pl';
  const undiscovered = extractUndiscoveredSecrets(secrets, options?.discoveredTitles);
  if (undiscovered.length === 0) return '';

  const max = options?.maxSecrets !== undefined && options.maxSecrets > 0 ? options.maxSecrets : 10;
  const limited = undiscovered.slice(0, max);
  const secretsList = limited.map((s, idx) => `${idx + 1}. ${s}`).join(' | ');

  if (locale === 'en') {
    return `[SEKRETY_DO_ODKRYCIA: (Secrets & Clues Pool - Mike Shea): ${secretsList}. 3 ANTI-PLEASING SAFETY FUSES: 1. Location Independence: secrets migrate to wherever investigator actions logically lead. 2. Carrier & Skill Test Requirement: secrets never drop for free in dialogue; must be revealed via a physical carrier (letter, ledger, hidden drawer) or successful skill test. 3. Anti-Pleasing & No Deduction Hijacking: do not spoon-feed conclusions or solve the mystery for the player. MANDATORY IN [MYŚLI_MG]: note planned secret and its physical carrier.]`;
  }

  return `[SEKRETY_DO_ODKRYCIA: (Pula Sekretów Mike'a Shea): ${secretsList}. 3 ŻELAZNE BEZPIECZNIKI ANTY-PLEASING: 1. Niezależność od lokacji: sekrety nie są zablokowane na sztywno w jednym pokoju, mogą pojawić się tam, gdzie logicznie pasuje działanie gracza. 2. Wymóg nośnika i testu: sekret nie może paść za darmo w czacie; musi zostać odkryty przez logiczny nośnik fizyczny (dokument, skrytka) lub udany test umiejętności. 3. Zakaz autopilota i darmowego wykładania kart: MG nie streszcza prawdy za badacza ani nie wyprzedza dedukcji gracza. OBOWIĄZKOWO W [MYŚLI_MG]: zaplanuj sekret i jego nośnik fizyczny.]`;
}

/**
 * Formatuje dyrektywę granic śledztwa (Closed Circle Mystery - Seth Skorkowsky) (Issue #648 Faza 2 R2).
 */
export function formatClosedCircleDirective(
  boundarySummary?: string | null,
  locale: 'pl' | 'en' = 'pl'
): string {
  if (!boundarySummary || typeof boundarySummary !== 'string' || !boundarySummary.trim()) return '';
  const trimmed = boundarySummary.trim();

  if (locale === 'en') {
    return `[GRANICE_SPRAWY: (Closed Circle Mystery): ${trimmed}. If player attempts to leave canonical investigation area or flee, the world offers ONLY DIEGETIC RESISTANCE (cancelled trains, blizzard, lack of fare, urgent telegram, moral duty, police checkpoint). FORBID artificial UI invisible walls or out-of-character meta warnings ("wrong direction")]`;
  }

  return `[GRANICE_SPRAWY: (Zamknięty Krąg Śledztwa / Closed Circle): ${trimmed}. Gdy gracz deklaruje ucieczkę, wyjazd lub porzucenie sprawy poza kanoniczny obszar, świat stawia WYŁĄCZNIE OPÓR DIEGETYCZNY (brak pociągów/strajk/śnieżyca, brak gotówki, telegram od klienta z groźbą/zaliczką, obowiązek moralny, kordon policji). BEZWZGLĘDNY ZAKAZ sztucznych ścian w UI i komunikatów o "złym kierunku"]`;
}

/**
 * Wykrywa stan impasu śledczego na podstawie deklaracji gracza i/lub historii wiadomości (Issue #648 Faza 3 R3).
 */
export function detectInvestigativeDeadlock(
  playerMessage?: string | null,
  options?: { turnsInCurrentLocation?: number }
): boolean {
  if (!playerMessage || typeof playerMessage !== 'string') return false;
  const raw = playerMessage.trim().toLowerCase();
  if (!raw) return false;

  const deadlockPatterns: RegExp[] = [
    /\b(utkn[a-ząćęłńóśźż]*|utknąłem|utknęliśmy|nie wiem co|nie mam pojęcia|co dalej|co teraz|brak tropu|brak pomysłu|brak poszlak|ślepy zaułek|martwy punkt)\b/iu,
    /\b(stuck|dead end|deadlock|no idea|clueless|what now|where to go|no clues left|lost lead)\b/iu,
    /\b(przeglądam jeszcze raz wszystko|zastanawiam się nad faktami|łączę fakty w głowie|zbieram myśli|próbuję powiązać|recall facts|connect the dots)\b/iu,
  ];

  if (deadlockPatterns.some((p) => p.test(raw))) {
    return true;
  }

  // Jeśli gracz spędził w tej samej lokacji 4+ tur i zadaje bezradne pytania bez deklaracji badania
  if ((options?.turnsInCurrentLocation ?? 0) >= 4 && /^(co\?|gdzie\?|i co\?|nic tu nie ma\?|what\?|where\?)$/i.test(raw)) {
    return true;
  }

  return false;
}

/**
 * Formatuje dyrektywę Protokołu Impasu z testem Pomysłowości (Idea Roll CoC 7e RAW s. 101) (Issue #648 Faza 3 R3).
 */
export function formatDeadlockDirective(
  isDeadlock: boolean,
  locale: 'pl' | 'en' = 'pl'
): string {
  if (!isDeadlock) return '';

  if (locale === 'en') {
    return `[PROTOKÓŁ_IMPASU: (Deadlock Protocol & Idea Roll Handshake - CoC 7e RAW p. 101): Investigator is stalling or has reached a dead end. STRICT PROHIBITION against solving the mystery for them in prose (Anti-Spooning / No Deduction Hijacking). In your narrative, diegetically highlight an investigative pause/confusion and explicitly suggest focusing thoughts via an official Idea Roll: [Test Pomysłowości (Idea Roll INT)]. SUCCESS: grants an associative breakthrough linking known facts. FAILURE: delivers the next step at the cost of a complication (lost time, raised alarm, unwanted attention) under RAW Fail-Forward rules.]`;
  }

  return `[PROTOKÓŁ_IMPASU: (Protokół Impasu i Idea Roll Handshake - CoC 7e RAW s. 101): Badacz utknął w martwym punkcie lub błądzi. BEZWZGLĘDNY ZAKAZ podawania rozwiązania na tacy w narracji (Anti-Spooning / No Deduction Hijacking). Zasygnalizuj diegetycznie moment zawieszenia/nawału myśli i zasugeruj Badaczowi wykonanie oficjalnego Testu Pomysłowości: [Test Pomysłowości (Idea Roll INT)]. SUKCES: przynosi skojarzenie znanych faktów i kierunkową wskazówkę. PORAŻKA: posuwa śledztwo za cenę komplikacji (upływ czasu, alarm, uwaga wroga) wg reguł Fail-Forward.]`;
}

/**
 * Formatuje dyrektywę Zwrotu Wektora Sceny (Value Charge Shift +/- / McKee) (Issue #648 Faza 3 R1).
 */
export function formatValueChargeDirective(
  hint?: '+' | '-' | 'neutral' | string,
  locale: 'pl' | 'en' = 'pl'
): string {
  const norm = (hint || '').trim().toLowerCase();
  const isShiftToMinus = norm === '-' || norm === 'negative' || norm === 'ujemny';
  const isShiftToPlus = norm === '+' || norm === 'positive' || norm === 'dodatni';

  if (locale === 'en') {
    if (isShiftToMinus) {
      return `[ZWROT_SCENY: (Value Charge Shift +/-): Shift ending value charge to (-) NEGATIVE: confront investigator's expectation/hope with an unforeseen complication, obstacle, or grim revelation before closing the scene.]`;
    }
    if (isShiftToPlus) {
      return `[ZWROT_SCENY: (Value Charge Shift +/-): Shift ending value charge to (+) POSITIVE: grant an unexpected breakthrough, tactical foothold, or spark of hope amidst tension before closing the scene.]`;
    }
    return `[ZWROT_SCENY: (Value Charge Shift +/-): Alter emotional/cognitive value charge (+/-) before closing this scene (Robert McKee principle). If investigator begins in hope, introduce a setback/cost (-); if in fear/deadlock, provide a breakthrough/opening (+). Avoid emotionally flat scenes.]`;
  }

  if (isShiftToMinus) {
    return `[ZWROT_SCENY: (Zwrot Wektora Sceny +/-): Zmień ładunek sceny na (-) UJEMNY: skonfrontuj nadzieję lub plan badacza z nieprzewidzianą komplikacją, kosztem lub złowróżbnym odkryciem przed zamknięciem sceny.]`;
  }
  if (isShiftToPlus) {
    return `[ZWROT_SCENY: (Zwrot Wektora Sceny +/-): Zmień ładunek sceny na (+) DODATNI: zaoferuj nieoczekiwany punkt zaczepienia, przełom w śledztwie lub promień nadziei pośród grozy przed zamknięciem sceny.]`;
  }
  return `[ZWROT_SCENY: (Zwrot Wektora Sceny +/-): Przełam ładunek emocjonalny sceny przed jej zamknięciem (zasada Roberta McKee +/-). Jeśli badacz zaczyna z nadzieją, napotka komplikację (-); jeśli w lęku/impasie, zyska punkt zaczepienia (+). Zakaz płaskich scen o stałym nastroju.]`;
}

/**
 * Detekcja słów kluczowych podziemi w nazwie lub opisie lokacji
 */
function detectUndergroundOrigin(location: string): 'cellars' | 'sewers' | 'catacombs' | 'mines' | undefined {
  const loc = location.toLowerCase();
  if (/piwnic|cellar|basement/.test(loc)) return 'cellars';
  if (/kanał|sewer/.test(loc)) return 'sewers';
  if (/katakumb|grobow|krypt|crypt|catacomb/.test(loc)) return 'catacombs';
  if (/jaskini|kopaln|mine|cave/.test(loc)) return 'mines';
  return undefined;
}

/**
 * Detekcja słów kluczowych hydrologii (woda, rzeka, port, morze)
 */
function detectWaterway(location: string, locale: 'pl' | 'en'): string | undefined {
  const loc = location.toLowerCase();
  if (/rzek|port|dok|morz|jezior|wybrzeż|kanał|przystań|river|harbor|dock|sea|lake|coast|pier|bay/.test(loc)) {
    return locale === 'en'
      ? 'Natural downstream flow and logistical dependence on waterways and tides'
      : 'Naturalny spływ wód i logistyczna zależność transportu od żeglugi oraz pływów';
  }
  return undefined;
}

/**
 * Sprawdzenie czy w scenie zachodzi kontekst okultystyczny / nadprzyrodzony
 */
function isOccultContextActive(params: WorldEngineAdapterParams): boolean {
  const { adventureContext, character, playerMessage, currentLocation } = params;

  // 1. Motywy przygody
  const themesStr = (adventureContext?.themes || []).join(' ').toLowerCase();
  if (/occult|mit|cthulhu|magia|rytuał|horror|kosm|alien|bóstw|nadnatural|supernatural/.test(themesStr)) {
    return true;
  }

  // 2. Gracz posiada czary lub tomy wiedzy tajemnej
  const knownSpells = character?.magic?.knownSpells ? Object.keys(character.magic.knownSpells) : [];
  const tomeStudies = character?.magic?.tomeStudies ? Object.keys(character.magic.tomeStudies) : [];
  if (knownSpells.length > 0 || tomeStudies.length > 0) {
    return true;
  }

  // 3. Treść wypowiedzi gracza lub bieżąca lokacja
  const combinedText = `${playerMessage || ''} ${currentLocation || ''}`.toLowerCase();
  if (/czar|zaklęci|rytuał|ofiara|potwór|mit|okultyzm|obłęd|szaleństwo|spell|ritual|sacrifice|monster|mythos|tome|grimoire|insanity/.test(combinedText)) {
    return true;
  }

  return false;
}

/**
 * Główny adapter budujący zintegrowane dyrektywy 7 silników świata w locie (runtime).
 */
export function buildWorldEngineDirectives(params: WorldEngineAdapterParams): string {
  const director = new WorldEngineDirector();
  const locale = params.locale ?? 'pl';
  const currentLocation = params.currentLocation?.trim() || '';

  const isDialogueScene =
    params.sceneTechniqueSelection?.sceneState === 'dialogue' ||
    (Boolean(params.npcs && params.npcs.length > 0) &&
      Boolean(
        params.playerMessage &&
          /(\?|mówi|pyta|dzień dobry|proszę|pan|pani|kto|gdzie|dlaczego|co|czy|powiedz|odpowiedz)/i.test(
            params.playerMessage
          )
      ));
  const turnsInCurrentLocation = params.turnsInCurrentLocation ?? 0;
  const isSubsequentTurn = turnsInCurrentLocation > 0;
  const rawMacroLocation = currentLocation ? extractMacroLocation(currentLocation) : undefined;

  const matchedVisitedMacro =
    rawMacroLocation && params.visitedMacroLocations
      ? params.visitedMacroLocations.find(
          (v) =>
            v.toLowerCase().trim() === rawMacroLocation.toLowerCase().trim() ||
            isSameMacroLocation(v, currentLocation)
        )
      : undefined;

  const macroLocation =
    matchedVisitedMacro && rawMacroLocation === currentLocation
      ? matchedVisitedMacro
      : rawMacroLocation;

  let isNewMacroLocation = true;
  if (params.isNewMacroLocation !== undefined) {
    isNewMacroLocation = params.isNewMacroLocation;
  } else if (macroLocation && params.visitedMacroLocations) {
    isNewMacroLocation = !matchedVisitedMacro;
  } else if (isSubsequentTurn) {
    isNewMacroLocation = false;
  }

  // 1. SensoryEngine (02) - mikrosensoryka z pamięcią sceny i korpusem Lovecrafta
  const isDesertedOrSpooky =
    !isSubsequentTurn &&
    isNewMacroLocation &&
    !isDialogueScene &&
    /cmentarz|ruin|strych|piwnic|opuszcz|mgł|las|noc|krypt|cemetery|ruins|attic|abandoned|fog|crypt/.test(
      currentLocation.toLowerCase()
    );

  const lovecraftMotif = pickLovecraftianSensoryTheme({
    turnCount: params.messagesCount || 0,
    locationName: currentLocation,
    isSpooky: isDesertedOrSpooky,
  });

  const cadenceGear: 1 | 2 = isDialogueScene ? 1 : 2;

  const sensory: SensoryContext = {
    primarySense: isDialogueScene
      ? 'auditory'
      : isSubsequentTurn || !isNewMacroLocation
      ? 'tactile'
      : (lovecraftMotif.senses.primary || 'olfactory'),
    secondarySense: isDialogueScene
      ? 'tactile'
      : isSubsequentTurn
      ? 'visual'
      : !isNewMacroLocation
      ? 'auditory'
      : (lovecraftMotif.senses.secondary || 'auditory'),
    cadenceGear,
    lovecraftTheme: isDialogueScene
      ? undefined
      : (locale === 'en' ? lovecraftMotif.promptFragmentEn : lovecraftMotif.promptFragmentPl),
    gritDetails: isDialogueScene
      ? [
          locale === 'en'
            ? 'Nervous micro-gestures, facial tension, and subtle physical reactions of the speaker'
            : 'Subtelne mikrogesty, napięcie mimiki i fizyczna reakcja rozmówcy na słowa gracza',
        ]
      : isSubsequentTurn
      ? [
          locale === 'en'
            ? 'Inspected objects, tangible props, and physical evidence in the hands of the investigator'
            : 'Badane obiekty, rekwizyty i namacalne ślady w dłoniach badacza',
        ]
      : !isNewMacroLocation
      ? [
          locale === 'en'
            ? `Unique furnishings, objects, and distinctive props specific to this room only: ${currentLocation}`
            : `Unikalne wyposażenie, przedmioty i detale właściwe wyłącznie dla tego pomieszczenia: ${currentLocation}`,
        ]
      : [
          currentLocation
            ? (locale === 'en' ? `Atmosphere and age of the place: ${currentLocation}` : `Ślady zużycia i atmosfera miejsca: ${currentLocation}`)
            : (locale === 'en' ? 'Patina of time and period retro-grain' : 'Patina czasu i retro-ziarno epoki'),
        ],
    voidVariable: isDialogueScene
      ? undefined
      : isDesertedOrSpooky
      ? (locale === 'en' ? 'Unsettling silence or absence of natural human bustle' : 'Złowroga cisza lub brak zwyczajnego ludzkiego gwaru')
      : (locale === 'en' ? lovecraftMotif.voidVariableEn : lovecraftMotif.voidVariablePl),
  };

  // 2. NPCEngine (01) - pierwszy obecny NPC
  let activeNPC: NPCEntity | undefined;
  const firstNpc = params.npcs && params.npcs.length > 0 ? params.npcs[0] : undefined;
  if (firstNpc) {
    activeNPC = {
      id: firstNpc.id,
      name: firstNpc.name,
      facade: firstNpc.description?.slice(0, 120) || firstNpc.occupation || (locale === 'en' ? 'Mysterious stranger' : 'Tajemniczy nieznajomy'),
      flaw: (firstNpc as unknown as { flaw?: string }).flaw || (locale === 'en' ? 'Habitual distrust of outsiders' : 'Nawykowa podejrzliwość wobec obcych'),
      hiddenAgenda: firstNpc.agenda || (locale === 'en' ? 'Guards personal interests and secrets' : 'Chroni swoje interesy i sekrety'),
      resistanceLevel: firstNpc.disposition === 'hostile' ? 'hostile' : firstNpc.disposition === 'suspicious' ? 'suspicious' : 'guarded',
      fearOrLeverage: (firstNpc as unknown as { fearOrLeverage?: string }).fearOrLeverage || (locale === 'en' ? 'Threat of scandal or exposure' : 'Groźba skandalu lub zdemaskowania'),
    };
  }

  // 3. NarrativeGraphEngine (03) - zbieżność gałęzi i wąskie gardła
  const puzzles = params.adventureContext?.puzzles;
  const truthAnchor = params.adventureContext?.truthAnchor;

  let graphDirectiveParam: {
    branch: string;
    bottleneck: string;
    framing?: SceneFramingContext;
  } | undefined;
  const graph = params.adventureContext?.graph;
  if (graph) {
    const currentBranch = currentLocation || (locale === 'en' ? 'Active Investigation' : 'Bieżący trop');
    let bottleneckTarget = params.adventureContext?.title || (locale === 'en' ? 'Climax Scene' : 'Punkt kulminacyjny');

    if (Array.isArray(graph.nodes) && graph.nodes.length > 0) {
      const bottleneckNode = graph.nodes.find(
        (n) => n.isBottleneck || n.type === 'bottleneck' || n.type === 'climax'
      );
      if (bottleneckNode?.label || bottleneckNode?.name) {
        bottleneckTarget = bottleneckNode.label || bottleneckNode.name || bottleneckTarget;
      }
    } else if (Array.isArray(graph.locations) && graph.locations.length > 0) {
      bottleneckTarget = graph.locations[graph.locations.length - 1]?.name || bottleneckTarget;
    }

    const knownAnchors: string[] = [];
    if (currentLocation) knownAnchors.push(currentLocation);
    if (truthAnchor?.immutableFacts && truthAnchor.immutableFacts.length > 0) {
      knownAnchors.push(truthAnchor.immutableFacts[0]);
    } else if (puzzles && puzzles.length > 0 && puzzles[0].title) {
      knownAnchors.push(puzzles[0].title);
    }
    const investigativeQuestion = puzzles && puzzles.length > 0
      ? (locale === 'en' ? `What is the significance of ${puzzles[0].title}?` : `Jakie jest znaczenie: ${puzzles[0].title}?`)
      : (truthAnchor?.culprit ? (locale === 'en' ? `Who is connected to ${truthAnchor.culprit}?` : `Kto jest powiązany ze sprawą?`) : undefined);

    graphDirectiveParam = {
      branch: currentBranch,
      bottleneck: bottleneckTarget,
      framing: knownAnchors.length >= 2 ? { knownAnchors, investigativeQuestion } : undefined,
    };
  }

  // 4. PlotFrictionEngine (04) - tarcia społeczne i plotki
  let frictionParam: SettingFriction | undefined;
  const conflicts = params.adventureContext?.conflicts;
  const rumors = params.adventureContext?.setupAsymmetry?.rumors;

  if (conflicts && conflicts.length > 0) {
    const primaryConflict = conflicts[0];
    const factionsStr = Array.isArray(primaryConflict.factions)
      ? primaryConflict.factions.map((f) => f.name || f.goal).filter(Boolean).join(' vs ')
      : '';
    const desc = primaryConflict.description || primaryConflict.resource || factionsStr || 'Napięcie w społeczności';

    frictionParam = {
      tensionType: primaryConflict.tensionType || 'class',
      description: desc,
      activeRumor: rumors && rumors.length > 0 ? rumors[0] : (locale === 'en' ? 'Locals whisper about strange occurrences' : 'Miejscowi szepczą o dziwnych zajściach'),
      ambientDetail: primaryConflict.stakes || primaryConflict.resource || (locale === 'en' ? 'Tense glances and guarded remarks' : 'Napięte spojrzenia i ostrożne półsłówka'),
    };
  } else if (rumors && rumors.length > 0) {
    frictionParam = {
      tensionType: 'belief',
      description: locale === 'en' ? 'Local superstition and gossip' : 'Lokalne zabobony i plotki',
      activeRumor: rumors[0],
      ambientDetail: locale === 'en' ? 'Whispers behind closed shutters' : 'Szepty za zamkniętymi okiennicami',
    };
  }

  // 5. MysteryClueEngine (05) - reguła 3 poszlak, fail-forward i bramkowanie lokacji
  let clueParam: ClueNode | undefined;

  const isLocExhausted = Boolean(
    params.character?.activeScene?.isLocationExhausted ||
    (currentLocation && params.character?.investigatorDossier?.locations?.some(
      (l: { name?: string; searchStatus?: string }) => l.name?.toLowerCase() === currentLocation.toLowerCase() && l.searchStatus === 'thoroughly_searched'
    ))
  );

  if (puzzles && puzzles.length > 0) {
    const firstPuzzle = puzzles[0];
    clueParam = {
      id: firstPuzzle.id || 'puzzle-clue',
      summary: firstPuzzle.title || firstPuzzle.description || (locale === 'en' ? 'Investigative enigma' : 'Zagadka śledcza'),
      targetRevelationId: firstPuzzle.solutionSummary || firstPuzzle.solution || (locale === 'en' ? 'Truth discovery' : 'Odkrycie prawdy'),
      sources: ['observation', 'deduction'],
      failForwardCost: 'time',
      isLocationExhausted: isLocExhausted,
      locationName: currentLocation || undefined,
    };
  } else if (truthAnchor?.immutableFacts && truthAnchor.immutableFacts.length > 0) {
    clueParam = {
      id: 'truth-clue',
      summary: truthAnchor.immutableFacts[0],
      targetRevelationId: truthAnchor.culprit || (locale === 'en' ? 'Culprit Identity' : 'Tożsamość sprawcy'),
      sources: ['observation', 'testimony'],
      failForwardCost: 'danger',
      isLocationExhausted: isLocExhausted,
      locationName: currentLocation || undefined,
    };
  }

  // 6. GeographyEngine (06) - uwarunkowania terenu, ekonomii, podziemi i wód
  const region = params.adventureContext?.location || (locale === 'en' ? 'Investigative District' : 'Dystrykt śledztwa');
  const chokepoint = currentLocation ? `${currentLocation} (${region})` : region;
  const countryCode = params.eraContext?.countryCode || 'US';
  const economicConstraint = countryCode === 'US'
    ? (locale === 'en' ? 'Railroad access, fuel monopoly and Prohibition supply bottlenecks' : 'Monopol naftowy, kolejowe węzły przeładunkowe i ograniczenia Prohibicji')
    : (locale === 'en' ? 'Strict police permits and transport checkpoints' : 'Kordon policyjny, reglamentacja i koszty przemieszczania się');

  const geographyParam: GeographyContext = {
    terrainOrChokepoint: chokepoint,
    economicConstraint,
    undergroundOrigin: detectUndergroundOrigin(currentLocation),
    waterwayLogic: detectWaterway(currentLocation, locale),
  };

  // 7. OccultEngine (07) - warunkowe dawkownie horroru i somatyki magii
  let occultParam: OccultContext | undefined;
  if (isOccultContextActive(params)) {
    occultParam = {
      magicType: 'soft_weird',
      somaticCost: locale === 'en'
        ? 'Nosebleed, sensory nausea, muscle tremors and bone-deep chill upon touching the unnameable'
        : 'Krwawienie z nosa, mdłości sensoryczne, drżenie mięśni i chłód kości przy kontakcie z nienazwanym',
      cultTier: 'inner_initiated',
      cosmicTaboo: locale === 'en'
        ? 'Non-Euclidean geometry and cosmic entities cannot be perceived without sanity erosion'
        : 'Pojmowanie pozaziemskich zjawisk nieuchronnie niszczy ludzką poczytalność',
    };
  }

  const isEngineEnabled = (id: WorldEngineId): boolean => {
    if (!params.activeEngines) return true;
    return Boolean(params.activeEngines[id]);
  };

  const headerPl = '## DYREKTYWY SILNIKA ŚWIATA (SYSTEMY RUNTIME)';
  const headerEn = '## WORLD ENGINE DIRECTIVES (IN-FLIGHT RUNTIME)';
  const activeHeader = locale === 'en' ? headerEn : headerPl;

  const finalLines: string[] = [];

  // 1. Sensory Directive (PO Decision 1: Anti-Habituation on subsequent turns & Cadence Gears)
  if (isEngineEnabled('sensory')) {
    if (cadenceGear === 1) {
      finalLines.push(
        locale === 'en'
          ? `[SENSORY_DIRECTIVE: Cadence Gear 1 (Dialogue/Action) - Concise 1-2 sentences. Prioritize NPC dialogue and facial tension; omit heavy environmental sensory cues]`
          : `[SENSORY_DYREKTYWA: Bieg 1 (Dialog/Szybka akcja) - Zwięzłe 1-2 zdania. Priorytet ma wypowiedź NPC i mikrogesty; pomiń ciężkie opisy zmysłowe otoczenia]`
      );
    } else {
      const senses = [sensory.primarySense, sensory.secondarySense].filter(Boolean).join('+');
      if (isSubsequentTurn) {
        finalLines.push(
          locale === 'en'
            ? `[SENSORY_DIRECTIVE: ANTI-HABITUATION (Turn in current location: ${turnsInCurrentLocation + 1} | Dynamic senses rotation: ${senses}). STRICTLY FORBID repeating static ambient backdrop, persistent smells or baseline cold/weather (sensory habituation: carbolic acid, cold, dead silence, tiled stoves are already established). Describe ONLY dynamic environmental shifts (e.g. flickering candle, sudden sound) or focus 100% on examined details]`
            : `[SENSORY_DYREKTYWA: ANTY-HABITUACJA (Tura w tej samej lokacji: ${turnsInCurrentLocation + 1} | Rotacja na zmysły dynamiczne: dotyk+wzrok (${senses})). ZAKAZ powtarzania stałego tła, zapachu i chłodu/mrozu lokacji (habituacja zmysłów: karbol, mróz, cisza, piece kaflowe zostały już zarejestrowane). Opisuj WYŁĄCZNIE dynamiczne zmiany otoczenia (np. dopalająca się świeca, nagły dźwięk) lub skup się w 100% na badanych detalach]`
        );
      } else {
        const voidPart = sensory.voidVariable ? ` | Void: ${sensory.voidVariable}` : '';
        const gritPart = sensory.gritDetails.length > 0 ? ` | Grit: ${sensory.gritDetails[0]}` : '';
        const lovecraftPart = sensory.lovecraftTheme ? ` | Motyw Lovecrafta: ${sensory.lovecraftTheme}` : '';
        finalLines.push(
          locale === 'en'
            ? `[SENSORY_DIRECTIVE: Focus senses (${senses})${voidPart}${gritPart}${sensory.lovecraftTheme ? ` | Lovecraftian Motif: ${sensory.lovecraftTheme}` : ''} | Avoid generic visuals, describe somatic body response]`
            : `[SENSORY_DYREKTYWA: Oprzyj kadr na zmysłach (${senses})${voidPart}${gritPart}${lovecraftPart} | Zero etykiet emocji, opisz somatykę ciała]`
        );
      }
    }
  }

  // 2. Two-Level Zone / Macro-Location Memory (PO Decision 2)
  if (macroLocation) {
    if (isNewMacroLocation) {
      finalLines.push(
        locale === 'en'
          ? `[ZONE_MEMORY: Entering new facility "${macroLocation}". You may introduce the overall building scent and static backdrop once]`
          : `[PAMIĘĆ_STREFY: Wejście do nowego obiektu "${macroLocation}". Możesz jednorazowo zarysować ogólny zapach i stałe tło całego budynku]`
      );
    } else {
      finalLines.push(
        locale === 'en'
          ? `[ZONE_MEMORY: Known zone "${macroLocation}" (subsequent room / continuation). Building smell and static backdrop are already introduced - forbid repeating whole-building traits or scent. In this room focus solely on unique room props and details]`
          : `[PAMIĘĆ_STREFY: Znana strefa "${macroLocation}" (kolejny pokój / kontynuacja). Zapach i stałe tło budynku zostały już opisane - nie powtarzaj zapachu ani cech całego budynku (np. karbolu). W tym pokoju skup się wyłącznie na jego unikalnym wyposażeniu i detalach]`
      );
    }
  }

  // 3. Investigation-First / Fiction-First Directive (PO Decision 3)
  if (isSubsequentTurn) {
    finalLines.push(
      locale === 'en'
        ? `[INVESTIGATION_DIRECTIVE: FICTION-FIRST / NO FILLER. Zero repeated exposition. Focus 100% on examined details, tactile object interactions, NPC micro-reactions, and progressing the investigation]`
        : `[AKCJA_ŚLEDCZA: FICTION-FIRST / NO FILLER. Zero powtarzania ekspozycji. Skup się w 100% na badanych detalach, fizycznych interakcjach z obiektami, mimice/reakcjach NPC i posuwaniu śledztwa]`
    );
  }

  // 4. Heat Counter & Adversary Reaction (Issue #648 Faza 1 R2)
  const effectiveHeat = typeof params.heat === 'number'
    ? params.heat
    : deriveHeatFromMessages(params.messages);
  const clampedHeat = Math.max(0, Math.min(5, effectiveHeat));

  if (clampedHeat >= 3) {
    finalLines.push(
      locale === 'en'
        ? `[REAKCJA_WROGA: HEAT ALERT ${clampedHeat}/5 (Direct adversary reaction). Investigator visibility reached critical level. Adversaries/cult make a proactive move (ambush, raid, thugs, stakeout, or cut off escape). MANDATORY: include REAKCJA_WROGA inside [MYŚLI_MG] and proactive adversary reaction in narration]`
        : `[REAKCJA_WROGA: ALARM ROZGŁOSU ${clampedHeat}/5 (Bezpośrednia reakcja adwersarzy). Rozgłos badacza osiągnął stan krytyczny. Antagoniści/kult wykonują proaktywny ruch (zasadzka, nalot, zbiry, obserwacja kryjówki lub zablokowanie ucieczki). OBOWIĄZKOWO uwzględnij człon REAKCJA_WROGA wewnątrz znacznika [MYŚLI_MG] oraz natychmiastową proaktywną odpowiedź świata w narracji]`
    );
  } else if (clampedHeat >= 1) {
    finalLines.push(
      locale === 'en'
        ? `[ECHO_AKCJI: HEAT LEVEL ${clampedHeat}/5 (Suspicion and vigilance). Rumors about investigator actions are circulating. Law enforcement and witnesses are suspicious, and the cult is more alert. Reflect this in ambient reactions and inside [MYŚLI_MG]]`
        : `[ECHO_AKCJI: POZIOM ROZGŁOSU ${clampedHeat}/5 (Podejrzenia i czujność). W okolicy krążą plotki o działaniach badacza. Stróże prawa i świadkowie są podejrzliwi, a kult baczniej obserwuje otoczenie. Uwzględnij to w reakcjach otoczenia i w tagu [MYŚLI_MG]]`
    );
  }

  // 5. Closed Circle Mystery / Granice Sprawy (Issue #648 Faza 2 R2)
  const boundarySummary =
    (typeof params.boundarySummary === 'string' && params.boundarySummary.trim())
      ? params.boundarySummary
      : (typeof params.adventureContext?.boundarySummary === 'string' && params.adventureContext.boundarySummary.trim())
      ? params.adventureContext.boundarySummary
      : undefined;
  if (boundarySummary) {
    const closedCircleDirective = formatClosedCircleDirective(boundarySummary, locale);
    if (closedCircleDirective) {
      finalLines.push(closedCircleDirective);
    }
  }

  // 6. Secrets & Clues Pool / Pula Sekretów Mike'a Shea z 3 bezpiecznikami anty-pleasing (Issue #648 Faza 2 R1)
  const rawSecrets =
    (Array.isArray(params.secretsPool) && params.secretsPool.length > 0 ? params.secretsPool : null) ||
    (Array.isArray(params.secrets) && params.secrets.length > 0 ? params.secrets : null) ||
    (Array.isArray(params.adventureContext?.secretsPool) && params.adventureContext.secretsPool.length > 0 ? params.adventureContext.secretsPool : null) ||
    (Array.isArray(params.adventureContext?.secrets) && params.adventureContext.secrets.length > 0 ? params.adventureContext.secrets : null);

  if (Array.isArray(rawSecrets) && rawSecrets.length > 0) {
    const isDiscoveredClue = (c: unknown): boolean => {
      if (!c || typeof c !== 'object') return false;
      const entry = c as unknown as Record<string, unknown>;
      // W architekturze Concordia mgła wojny przechowuje nieodkryte poszlaki jako 'unrevealed' lub 'keeper_truth'.
      // Tylko poszlaki faktycznie odkryte przez badacza powinny usuwać sekrety z puli MG.
      if (entry.discoveryStatus === 'unrevealed' || entry.epistemicLayer === 'keeper_truth') {
        return false;
      }
      return true;
    };

    const allClues = [
      ...(params.character?.investigatorDossier?.clues || []),
      ...((params.characters || []).flatMap((c) => c?.investigatorDossier?.clues || [])),
    ].filter(isDiscoveredClue);

    const discoveredTitles = allClues.flatMap((c) => {
      if (!c || typeof c !== 'object') return [];
      const entry = c as unknown as Record<string, unknown>;
      return [entry.title, entry.id].filter((val): val is string => typeof val === 'string' && val.length > 0);
    });

    const secretsDirective = formatSecretsDirective(rawSecrets, { locale, discoveredTitles });
    if (secretsDirective) {
      finalLines.push(secretsDirective);
    }
  }

  // 7. Protokół Impasu i Idea Roll Handshake (Issue #648 Faza 3 R3)
  const isDeadlock =
    params.deadlockDetected ??
    detectInvestigativeDeadlock(params.playerMessage, {
      turnsInCurrentLocation: params.turnsInCurrentLocation,
    });
  if (isDeadlock) {
    const deadlockDirective = formatDeadlockDirective(true, locale);
    if (deadlockDirective) {
      finalLines.push(deadlockDirective);
    }
  }

  // 8. Zwrot Wektora Sceny (Value Charge Shift +/-) (Issue #648 Faza 3 R1)
  if (params.valueChargeHint) {
    const valueChargeDirective = formatValueChargeDirective(params.valueChargeHint, locale);
    if (valueChargeDirective) {
      finalLines.push(valueChargeDirective);
    }
  }

  // Pozostałe silniki świata (NPC, Graph, Friction, Clue, Geography, Occult)
  const otherDirectivesRaw = director.compileDirectives({
    locale,
    sensory: undefined, // obsłużone wyżej z Anti-Habituation
    activeNPC: isEngineEnabled('npc') ? activeNPC : undefined,
    graph: isEngineEnabled('graph') ? graphDirectiveParam : undefined,
    friction: isEngineEnabled('friction') ? frictionParam : undefined,
    clue: isEngineEnabled('clue') ? clueParam : undefined,
    geography: isEngineEnabled('geography') ? geographyParam : undefined,
    occult: isEngineEnabled('occult') ? occultParam : undefined,
  });

  if (otherDirectivesRaw) {
    const rawLines = otherDirectivesRaw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('##'));
    finalLines.push(...rawLines);
  }

  const baseDirectives = finalLines.length > 0 ? `\n\n${activeHeader}\n${finalLines.join('\n')}\n` : '';

  if (params.sceneTechniqueSelection) {
    const sceneDirective = formatSceneDirective(params.sceneTechniqueSelection, locale);
    return baseDirectives ? `${baseDirectives}\n\n${sceneDirective}` : sceneDirective;
  }

  return baseDirectives;
}
