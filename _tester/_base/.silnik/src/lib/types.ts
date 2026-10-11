import { InvestigatorBoardState } from '@/types/investigator-board';
import type { InvestigatorDossier } from './journal/dossier-types';
import type { ChaseState } from './chase/chase-engine';
import type {
  CombatResolution,
  PendingMeleeAttack,
} from './combat/combat-resolver';
export type {
  CombatResolution,
  PendingMeleeAttack,
};
import type { CharacterMagicState } from './magic/types';
import type { DiceRollTrace } from './dice-roll-trace';
import type {
  InvestigatorRequirements,
  AdventurePuzzle,
  AdventureHandout,
} from '@/lib/adventures-data';
export type {
  InvestigatorRequirements,
  AdventurePuzzle,
  AdventureHandout,
};

export interface DiceRollEventData {
  id: string;
  formula: string;
  trace: DiceRollTrace;
  characterName?: string;
  label?: string;
  timestamp?: string;
}

// === WIADOMOŚĆ CZATU ===
// Przeniesiona z page.tsx dla centralizacji typów
// SkillTestData zdefiniowane lokalnie niżej (~lin 597) - używane przez Message.skillTests.

// === SYSTEM CZASU I PODRÓŻY (Campaign Clock & Chrono-Travel) ===

/** Faza księżyca - istotne dla rytuałów i atmosfery */
export type MoonPhase =
  | 'new'
  | 'waxing_crescent'
  | 'first_quarter'
  | 'waxing_gibbous'
  | 'full'
  | 'waning_gibbous'
  | 'last_quarter'
  | 'waning_crescent';

/** Czas w grze - deterministyczny zegar kampanii */
export interface GameTime {
  year: number;
  month: number; // 0-11
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
}

/** Epoka gry - wpływa na dostępne środki transportu i komunikacji */
export type GameEra =
  | '1890s'
  | '1920s'
  | '1940s'
  | 'prl-1970s'
  | '1990s'
  | '2000s'
  | 'modern'
  | 'future'
  | '1920s-poland';

/** Ustawienia epoki - definiują realia technologiczne świata */
export interface EraSettings {
  id: GameEra;
  name: string;
  description: string;
  transport: {
    flight: {
      available: 'none' | 'rare' | 'common';
      risk: 'low' | 'medium' | 'high';
      avgSpeedKmh: number;
    };
    train: {
      available: 'none' | 'rare' | 'common';
      risk: 'low' | 'medium' | 'high';
      avgSpeedKmh: number;
    };
    ship: {
      available: 'none' | 'rare' | 'common';
      risk: 'low' | 'medium' | 'high';
      avgSpeedKmh: number;
    };
    car: {
      available: 'none' | 'rare' | 'common';
      risk: 'low' | 'medium' | 'high';
      avgSpeedKmh: number;
    };
    horse: {
      available: 'none' | 'rare' | 'common';
      risk: 'low' | 'medium' | 'high';
      avgSpeedKmh: number;
    };
  };
  communication: 'instant' | 'hours' | 'days' | 'weeks';
  worldRules: string; // Tekstowy prompt wstrzykiwany do AI
}

// === SYSTEM PAMIĘCI RAG (Eternal Memory) ===

/** Wpis indeksu pamięci - przechowywany w GCS dla wyszukiwania semantycznego */
export interface MemoryIndexEntry {
  chunkId: string;
  embedding: number[]; // Wektor 768-wymiarowy (Gemini Embedding-001)
  summary: string; // Krótkie streszczenie chunka
  gameTimestamp: string; // Czas w grze (np. "14 Stycznia 1925, 22:45")
  realTimestamp: string; // ISO timestamp zapisu
  tags: string[]; // ['NPC:Jackson', 'LOC:London', 'PLOT:Ritual']
  messageRange: { start: number; end: number };
  text?: string;
}

/** Pełny indeks pamięci - ładowany do pamięci serwera przy starcie sesji */
export interface MemoryIndex {
  version: string;
  sessionId: string;
  entries: MemoryIndexEntry[];
  lastUpdated: string;
}

export interface IllustrationElement {
  type: 'character' | 'location' | 'item' | 'creature';
  name: string;
  description: string;
  context: string;
  importance: 'high' | 'medium' | 'low';
  style: 'realistic' | 'artistic' | 'horror' | 'vintage';
}

export interface MessageIllustration {
  element: IllustrationElement;
  imageUrl: string;
  prompt: string;
  timestamp: Date;
}

/** Propozycja ekwipunku wykryta w narracji, zanim gracz potwierdzi jej zabranie. */
export interface AcquiredItemProposal {
  id: string;
  name: string;
  description: string;
  /** Postać wskazana przez MG w tagu; brak = aktualnie aktywny badacz. */
  recipientName?: string;
  category?: EquipmentCategory;
  visualTreatment: EquipmentVisualTreatment;
  status: 'pending' | 'accepted' | 'dismissed';
  audioUrl?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  gameTime?: GameTime; // Czas w grze w momencie wysłania wiadomości
  illustrations?: MessageIllustration[];
  generatedImages?: string[]; // URL-e wygenerowanych obrazów (base64 w sesji; stripowane z localStorage przez sanitizer)
  generatedImageTypes?: (
    | 'portrait'
    | 'scene'
    | 'location'
    | 'item'
    | 'monster'
    | 'vision'
  )[]; // Typy wygenerowanych obrazów (odpowiada indeksom w generatedImages)
  finishReason?: string;
  continuationRequested?: boolean;
  /** Niewidoczny dla gracza, deterministyczny stan mechaniki przekazywany MG. */
  mechanicsContext?: {
    chase?: ChaseState;
    combat?: { resolutions: CombatResolution[] };
  };
  // IND-262: klucze obrazów w IndexedDB (persistentMediaCache, store chat-images).
  // Lekkie - przeżywają localStorage (sanitizer wycina tylko base64). Po reloadzie
  // hydrują generatedImages z cache → obrazy "wracają na miejsce".
  generatedImageCacheIds?: string[];
  skillTests?: SkillTestData[]; // Tacka testów [TEST:...] (skillValue dociągnięte z karty postaci)
  diceRollEvents?: DiceRollEventData[]; // Bezpośrednie rzuty kośćmi [DICE:...] z fizyczną animacją 3D
  hazardEvents?: HazardEventData[]; // Zagrożenia środowiskowe CoC 7e RAW [ZAGROŻENIE:...]
  spellCastEvents?: SpellCastEventData[]; // Rzucanie czarów CoC 7e RAW [CZAR:...]
  opposedMagicEvents?: OpposedMagicEventData[]; // Obrona przed wrogą magią CoC 7e RAW [OBRONA_MAGIA:...]
  opposedMeleeEvents?: OpposedMeleeEventData[]; // Obrona przed atakiem wręcz CoC 7e RAW [WALKA_ATAK:...] / [OBRONA_WALKA:...]
  firearmsAttackEvents?: FirearmsAttackEventData[]; // Atak bronią palną i reakcja Dive for Cover CoC 7e RAW [WALKA_STRZAŁ:...]
  gameOverEvents?: GameOverEventData[]; // Ostateczny kres postaci i epilog CoC 7e RAW [GAME_OVER:...]
  refereeVetoEvents?: RefereeVetoEventData[]; // Twarde weto sędziego i guardrails [WETO_SEDZIEGO:...]
  tomeStudyEvents?: TomeStudyEventData[]; // Badanie tomów Mitów CoC 7e RAW [TOM:...]
  chaseState?: ChaseState; // Pościg i tor przeszkód CoC 7e RAW [POŚCIG:...]
  dreamVisionEvent?: DreamVisionEventData; // Oniryczna wizja senna CoC 7e RAW [SEN:...]
  pendingMeleeAttacks?: PendingMeleeAttack[];
  acquiredItems?: AcquiredItemProposal[];
  costData?: Record<string, unknown>;
  cliffhanger?: {
    question: string;
    type: 'dramatic_question' | 'external_event' | 'dilemma';
    options?: string[];
  };
}

/** Dane diegetycznej wizji sennej prezentowanej w oknie czatu (Issue #787) */
export interface DreamVisionEventData {
  id: string;
  variantId: string; // np. 'restless-night' | 'dark-cabin' | 'forest-path' | 'thing-in-lake'
  number: number;
  title: string;
  narrative: string;
  investigatorName?: string;
  nightNumber: number;
  status: 'active' | 'awakened';
  mechanicalEffect?: {
    sanityCheckRequired: boolean;
    sanityLossFormula?: string;
    conPenaltyDice?: boolean;
    subsequentTriggerLocation?: string;
  };
}

// Typy wydarzeń dziennika sesji
export type JournalEventType =
  | 'combat' // ⚔️ Walka
  | 'discovery' // 🔍 Odkrycie
  | 'npc' // 👤 NPC
  | 'sanity' // 🧠 Poczytalność
  | 'clue' // 📜 Trop
  | 'location' // 📍 Lokacja
  | 'ritual' // 🕯️ Rytuał
  | 'death' // 💀 Śmierć
  | 'bookmark' // ⭐ Zakładka
  | 'note' // 📝 Notatka
  | 'item'
  | 'quest'
  | 'journal'
  | 'case'
  | 'scene'
  | 'act_report'; // 📑 Raport Aktu / Mini-podsumowanie etapowe (Mechanika 8)

// Mini-podsumowanie etapowe i Raport Aktu (Mechanika 8 / Issue #481)
export interface ActReport {
  id: string;
  actNumber: number;
  title: string;
  inGameDate?: string;
  timestamp?: string | Date;
  status?: 'in_progress' | 'completed';
  confirmedFacts: string[]; // Co wiemy na pewno (fakty bezsprzeczne)
  suspects: string[]; // Kto budzi największe podejrzenia
  unresolvedQuestions: string[]; // Luki i białe plamy
  leadHypothesis?: string; // Wiodąca robocza hipoteza śledcza
}

// Karta Akt Śledczych po zamknięciu sceny (Issue #402)
export interface ChronicleChapter {
  playthroughId: string;
  campaignDefinitionId: string;
  adventureId: string;
  adventureTitle?: string;
  sessionId: string;
  sessionNumber: number;
}

export interface ChronicleSession extends ChronicleChapter {
  closedByMessageId?: string;
}

export interface SceneCaseCard {
  chronicleChapter?: ChronicleChapter;
  id: string;
  sceneNumber: number;
  location: string;
  title: string;
  inGameDate?: string;
  timestamp: string;
  people: string[]; // 👥 Osoby (Kogo spotkano)
  findings: string[]; // 🔍 Co zdobyto (poszlaki/przedmioty z miniaturami)
  keyTakeaways: string[]; // 📜 Kluczowe ustalenia (1-2 zdania syntezy)
  /** Neutralna kronika sceny dla obu języków interfejsu. */
  chronicleSummaryByLocale?: Partial<Record<'pl' | 'en', string>>;
  /** False only when a legacy scene has no recoverable transcript boundary. */
  chronicleBoundaryKnown?: boolean;
  startMessageId?: string;
  endMessageId?: string;
  nextStep?: string; // 🎯 Cel i kolejny krok śledztwa
  isSealed: boolean;
  isLocationExhausted?: boolean; // Czy lokacja została wyczerpana z poszlak (bramkowanie)
}

// Stan aktywnej, niezamkniętej sceny (zbierany na żywo w trakcie rozgrywki)
export interface ActiveSceneState {
  chronicleChapter?: ChronicleChapter;
  chronicleBoundaryKnown?: boolean;
  sceneNumber: number;
  location: string;
  title?: string;
  inGameDate?: string;
  startedAt: string;
  startMessageId?: string;
  people: string[];
  findings: string[];
  notes: string[];
  isLocationExhausted?: boolean; // Czy lokacja została wyczerpana z poszlak (bramkowanie)
}

// Wpis dziennika sesji
export interface JournalEntry {
  chronicleChapter?: ChronicleChapter;
  id: string;
  timestamp: Date; // Rzeczywisty czas
  date?: string; // Opcjonalna strunowa data (ISO / formatted) dla kompatybilności
  updatedAt?: Date; // Ostatnia ręczna zmiana wpisu
  adventureJournalId?: string; // Konkretny przebieg przygody, nie sam scenariusz
  inGameDate?: string; // Data w grze (np. "11 grudnia 1925, 14:32")
  type: JournalEventType;
  title: string;
  content: string;
  tags: string[];
  isBookmarked: boolean;
  /** Dane ustrukturyzowanej Karty Akt Śledczych (dla type: 'scene') */
  sceneData?: SceneCaseCard;
  /** Dane ustrukturyzowanego Raportu Aktu (dla type: 'act_report') */
  actReportData?: ActReport;
  /** Wniosek Badacza / Dedukcja postaci (np. z rzutu na INT / Pomysł lub sukcesu śledczego) */
  investigatorInsight?: string;
  metadata?: {
    hpChange?: number; // Zmiana HP (np. -4)
    sanChange?: number; // Zmiana SAN
    mpChange?: number; // Zmiana MP
    npcName?: string; // Nazwa NPC
    locationName?: string; // Nazwa lokacji
    skillUsed?: string; // Użyta umiejętność
    rollResult?: number; // Wynik rzutu
    imageUrl?: string; // Wygenerowany URL obrazu/portretu
  };
  /** Powiązane identyfikatory innych wpisów z dziennika (relacje na Tablicy Dowodów) */
  linkedEntryIds?: string[];
  /** Status weryfikacji hipotezy lub dowodu */
  hypothesisStatus?: 'unverified' | 'confirmed' | 'disproven';
  /** Opcjonalny adres URL obrazka / ilustracji wpisu */
  imageUrl?: string;
  imagePrompt?: string;
  imageStatus?: 'pending' | 'completed' | 'failed' | 'idle';
  /** Epistemiczna proweniencja poszlaki / wpisu śledczego (obserwacja, zeznanie, dedukcja, handout) */
  provenance?: import('./journal/dossier-types').ClueProvenance;
}

export * from './journal/dossier-types';

export type JournalEntryType =
  | 'board'
  | 'clue'
  | 'quest'
  | 'journal'
  | 'encyclopedia_location'
  | 'encyclopedia_character'
  | 'encyclopedia_item'
  | 'note';

export interface ExtendedJournalEntry extends Omit<
  JournalEntry,
  'type' | 'isBookmarked' | 'timestamp'
> {
  timestamp?: Date;
  type: JournalEntryType | JournalEventType;
  category?: string;
  isAutoGenerated?: boolean;
  isBookmarked?: boolean;
  gameDay?: number;
  gameHour?: number;
  imageUrl?: string;
}

// === SYSTEM EKWIPUNKU (CoC 7e) ===

export type EquipmentCategory =
  | 'weapon' // Broń (pistolety, noże, maczety)
  | 'armor' // Ochrona (kamizelki, hełmy)
  | 'tool' // Narzędzia (latarka, lina, wytrych)
  | 'document' // Dokumenty (listy, mapy, dzienniki)
  | 'artifact' // Artefakty mythos (amulety, księgi)
  | 'personal' // Przedmioty osobiste (zegarek, obrączka)
  | 'medical' // Medyczne (apteczka, morfina)
  | 'occult' // Okultystyczne (świece, kreda, kadzidło)
  | 'story'; // Przedmioty fabularne śledztwa (rekwizyty, dowody, tropy materialne)

/** Profil wizualny, według którego wybieramy lokalny render katalogowy. */
export type EquipmentVisualEra =
  | '1890s'
  | '1920s'
  | '1930s'
  | '1940s'
  | '1950s'
  | 'prl-1970s'
  | '1980s'
  | '1990s'
  | '2000s'
  | 'modern';

/** Pochodzenie grafiki przypisanej do konkretnego egzemplarza przedmiotu. */
export type EquipmentVisualSource = 'catalog' | 'generated' | 'fallback';

/** Zwykły przedmiot nie może dostać estetyki Mythos tylko przez klimat sesji. */
export type EquipmentVisualTreatment = 'mundane' | 'supernatural';

/**
 * Niezmienny wzorzec katalogowy. `EquipmentItem.id` dalej identyfikuje fizyczny
 * egzemplarz należący do postaci, a `id` szablonu opisuje jego typ i assety.
 */
export interface EquipmentTemplate {
  id: string;
  name: string;
  aliases: string[];
  category: EquipmentCategory;
  description?: string;
  visualTreatment: EquipmentVisualTreatment;
  availableIn: EquipmentVisualEra[];
  assetPaths?: Partial<Record<EquipmentVisualEra | 'shared', string>>;
  modifiers?: EquipmentModifiers;
  combatProfile?: EquipmentCombatProfile;
  value?: number;
  weight?: number;
}

/**
 * Wzorzec przedmiotu w konkretnej epoce historycznej z izolowanym ID i dedykowanym assetem (Issue #503).
 */
export interface EraEquipmentTemplate {
  id: string; // np. 'light.flashlight-1920s'
  baseTemplateId: string; // np. 'light.flashlight'
  era: EquipmentVisualEra;
  name: string;
  aliases: string[];
  category: EquipmentCategory;
  description?: string;
  visualTreatment: EquipmentVisualTreatment;
  assetPath?: string; // Konkretna ścieżka WebP danej epoki lub undefined
  modifiers?: EquipmentModifiers;
  combatProfile?: EquipmentCombatProfile;
  value?: number;
  weight?: number;
}

export type CombatDamageClass = 'impaling' | 'non_impaling';

export type EquipmentCombatProfile =
  | {
      schemaVersion: 1;
      kind: 'melee_weapon';
      combatSkillId: string;
      damageFormula: string;
      damageClass: CombatDamageClass;
    }
  | {
      schemaVersion: 1;
      kind: 'armor';
      armorValue: number;
      coverage: 'full';
      protectsAgainst: 'all' | 'melee';
    };

export interface EquipmentModifiers {
  skill?: string; // Umiejętność na którą wpływa (np. "First Aid")
  bonus?: number; // Bonus do testu (np. +20)
  damage?: string; // Obrażenia broni (np. "1d6+2")
  range?: string; // Zasięg broni (np. "50 yards")
  malfunction?: number; // Awaria na (np. 100 = jam on 100)
  sanLoss?: string; // Strata SAN przy czytaniu (np. "1d4/1d8")
  attacks?: string | number; // Liczba ataków na rundę (np. 1 lub "1(3)")
  capacity?: string | number; // Pojemność magazynka / bębenka (np. 6)
  priceZl?: number; // Cena w złotych II RP (s. 214-216 Podręcznika Badacza)
  availability?: string; // Dostępność prawna i rynkowa w II RP
}

export type DocumentSubType =
  | 'press_pass' // Legitymacja prasowa
  | 'id_card' // Dowód tożsamości / legitymacja służbowa
  | 'evidence_envelope' // Koperta / teczka na dowody policyjne
  | 'letter' // List osobisty / telegram
  | 'newspaper' // Artykuł / wycinek z prasowy
  | 'official_document' // Oficjalne pismo rządowe / urzędowe
  | 'ticket' // Bilet pasażerski, przepustka z biletomatu
  | 'journal_page'; // Pamiętnik / notatka ręczna

export interface EquipmentItem {
  id: string;
  /** Stabilny identyfikator wzorca katalogowego, jeśli ten egzemplarz go ma. */
  templateId?: string;
  /** Opcjonalny wariant epokowy wzorca (np. light.flashlight-1920s) dla izolacji grafik epoki (Issue #503). */
  eraVariantId?: string;
  name: string;
  category: EquipmentCategory;
  description?: string;

  // Mechanika CoC
  modifiers?: EquipmentModifiers;

  // Metadane
  weight?: number; // Waga w funtach
  value?: number; // Wartość w dolarach 1920s
  condition?: 'new' | 'used' | 'damaged' | 'broken' | 'working' | 'depleted';
  source?: 'starting' | 'acquired' | 'found';
  acquiredFrom?: 'starting' | 'acquired' | 'found';
  obtainedAt?: Date;
  quantity?: number; // Liczba sztuk / dawek dla przedmiotów zużywalnych
  maxQuantity?: number; // Pojemność maksymalna (np. 5 dawek)
  isConsumable?: boolean; // Czy przedmiot zużywa się przy użyciu

  // Mechanika zużycia i amunicji (CoC 7e RAW)
  currentAmmo?: number; // Aktualna amunicja w komorze / bębenku
  maxAmmo?: number; // Maksymalna pojemność magazynka
  charges?: number; // Aktualne ładunki (np. apteczka, zapałki)
  maxCharges?: number; // Maksymalna liczba ładunków
  isJammed?: boolean; // Czy broń uległa zacięciu
  actionDeclaration?: string; // Gotowa deklaracja Quote-to-Input dla czatu
  suggestedAction?: 'shoot' | 'reload' | 'first_aid' | 'read' | 'study' | 'use_in_scene';

  // Obraz i Multimedia
  imageUrl?: string;
  imagePrompt?: string; // Zachowany wzbogacony prompt do regeneracji
  visualSource?: EquipmentVisualSource;
  visualTreatment?: EquipmentVisualTreatment;
  audioUrl?: string; // Opcjonalny URL nagrania audio / pliku .mp3
  mapUrl?: string; // Opcjonalny URL pliku z mapą
  isMap?: boolean; // Czy przedmiot jest mapą
  // Czytelne przedmioty fabularne
  isReadable?: boolean; // Czy przedmiot posiada tekst do przeczytania (np. list, pamietnik)
  readableContent?: string; // Wygenerowana lub predefiniowana tresc diegetyczna dokumentu
  readableContentStatus?: 'none' | 'generating' | 'ready' | 'error'; // Status asynchronicznego generowania
  documentType?: DocumentSubType; // Dedykowany podtyp rekwizytu diegetycznego
  isStoryItem?: boolean; // Czy przedmiot jest kluczowym rekwizytem fabularnym śledztwa (Story Item)
}

// === SYSTEM ROZWOJU POSTACI (CoC 7e) ===

/**
 * Dane umiejętności z obsługą oznaczania do rozwoju
 * Zgodne z zasadami Call of Cthulhu 7th Edition
 */
export interface SkillData {
  value: number; // Wartość procentowa (0-99)
  markedForImprovement: boolean; // Czy oznaczona do rozwoju (udany test bez Luck)
  lastUsedSuccessfully?: Date; // Kiedy ostatnio udany test
  improvementHistory?: {
    // Historia rozwoju tej umiejętności
    date: Date;
    oldValue: number;
    newValue: number;
    method: 'development_phase' | 'training' | 'study' | 'special';
    rollValue?: number; // Wynik rzutu D100 (dla development_phase)
    improvementRoll?: number; // Wynik rzutu D10 (ile punktów dodano)
  }[];
}

/**
 * Typ umiejętności - wspiera zarówno stary format (number) jak i nowy (SkillData)
 * Dla wstecznej kompatybilności z istniejącymi postaciami
 */
export type SkillValue = number | SkillData;

/**
 * Helper do pobierania wartości umiejętności niezależnie od formatu
 */
export function getSkillValue(skill: SkillValue | undefined): number {
  if (skill === undefined) return 0;
  if (typeof skill === 'number') return skill;
  return skill.value;
}

/**
 * Helper do sprawdzenia czy umiejętność jest oznaczona do rozwoju
 */
export function isSkillMarked(skill: SkillValue | undefined): boolean {
  if (skill === undefined) return false;
  if (typeof skill === 'number') return false;
  return skill.markedForImprovement;
}

export type InsanityState = 'none' | 'temporary' | 'indefinite' | 'permanent';

export interface ActiveBoutOfMadness {
  id: string;
  type: string;
  title: string;
  description: string;
  unit: 'rounds' | 'hours';
  duration: number;
  startedAtTimestamp?: string;
}

export interface Character {
  id: string;
  /** Identyfikator wzorca, jeśli postać powstała z gotowego badacza. */
  sourcePresetId?: string;
  name: string;
  // Cechy podstawowe (według CoC7)
  str: number; // Siła
  dex: number; // Zręczność
  con: number; // Kondycja
  app: number; // Wygląd
  pow: number; // Siła Woli
  edu: number; // Wykształcenie
  siz: number; // Budowa Ciała
  int: number; // Inteligencja
  luck: number; // Szczęście

  // Cechy pochodne (obliczane automatycznie)
  hp: number; // Punkty Życia
  san: number; // Punkty Rozsądku
  mp: number; // Punkty Magii
  armor?: number; // Pancerz / ochrona (redukcja obrażeń RAW)

  // Umiejętności zawodowe (według CoC7)
  // Wspiera zarówno stary format (number) jak i nowy (SkillData) dla wstecznej kompatybilności
  skills: { [key: string]: SkillValue };

  // Dodatkowe informacje
  occupation: string;
  age: number;
  background: string;
  tacticalNotes?: string;

  // Informacje o graczu (dla lokalnej gry przy stole)
  playerName: string; // Imię gracza
  campaignId?: string; // ID kampanii do której należy postać
  isActive: boolean; // Czy postać jest aktualnie aktywna w grze
  lastUsed: Date; // Kiedy ostatnio używana
  notes: string; // Notatki gracza o postaci

  // System levelowania
  experience: {
    totalXP: number; // Całkowite doświadczenie
    availableXP: number; // Dostępne do wydania
    earnedThisSession: number; // Zdobyte w tej sesji
    maxEarnedThisSession: number; // Limit na sesję
  };

  // Śledzenie Luck zużytego w sesji (dla systemu oznaczania umiejętności)
  // Sukces z użyciem Luck NIE oznacza umiejętności do rozwoju
  luckSpentThisSession?: number;

  // Czas rozpoczęcia aktualnej sesji
  sessionStartTime?: Date;

  // Historia rozwoju
  developmentHistory: {
    id: string;
    timestamp: Date;
    type: 'skill' | 'attribute' | 'new_skill' | 'special';
    target: string; // Nazwa umiejętności/cechy
    oldValue: number;
    newValue: number;
    xpCost: number;
    description: string;
  }[];

  // Ekwipunek postaci
  equipment?: EquipmentItem[];

  // Ekonomia CoC 7e (RAW) - zamożność wynika z umiejętności "Majętność" (Credit Rating).
  // Spending Level/Cash/Assets wyliczane z CR przez lib/economy/credit-rating.ts;
  // poniższe pola to opcjonalne override'y wpisane ręcznie na karcie lub wyliczone z presetu.
  creditRating?: number; // Wartość Majętności (Credit Rating 0-99)
  cash?: number; // Gotówka pod ręką ($ / zł)
  spendingLevel?: number; // Dzienny limit wydatków bez księgowania (CoC 7e RAW)
  assets?: string; // Opisowy majątek (np. "Dom w Arkham, samochód")
  currency?: 'USD' | 'PLN' | 'GBP' | 'PLZ' | string; // Waluta postaci (np. zł dla II RP / Współczesnej Polski, $ dla USA, £ dla Gaslight, PLZ dla PRL)
  era?: string; // Era ekonomiczna (np. '1920s-us', '1920s-pl', 'prl-1970s', '1890s-uk', 'modern-pl', 'modern-us')

  journal?: JournalEntry[];
  sceneCards?: SceneCaseCard[]; // Karty Akt Śledczych zamkniętych scen (Issue #402)
  chronicleSession?: ChronicleSession;
  actReports?: ActReport[]; // Mini-podsumowania etapowe i raporty aktów (Mechanika 8 / Issue #481)
  activeScene?: ActiveSceneState; // Stan bieżącej, trwającej sceny (Issue #402)
  investigatorBoard?: InvestigatorBoardState;
  investigatorDossier?: InvestigatorDossier;

  // === KONWENCJA PULP CTHULHU (RAW) ===
  archetype?: string; // Wybrany archetyp pulpowy (np. 'investigator', 'hard_boiled', 'mystic')
  pulpTalents?: string[]; // 2-4 pulpowe talenty postaci
  insaneTalents?: string[]; // Szalone talenty nabyte w trakcie ataku szaleństwa (Pulp Sanity RAW)
  rulesetVariant?: 'classic' | 'pulp'; // Wariant zasad na karcie postaci

  // Stowarzyszenia Badaczy (Rozdział 6 CoC 7e RAW, s. 117-139)
  organizationId?: string; // Identyfikator Stowarzyszenia Badaczy (np. 'the-cleaners', 'wraths-circus')
  investigatorSociety?: string; // Opcjonalny alias organizacji Badacza

  // Pochodne - maksymalne wartości
  maxHp?: number;
  maxSan?: number;
  maxMp?: number;

  // === MECHANIKA POCZYTALNOŚCI I SZALEŃSTWA (CoC 7e RAW) ===
  dayStartSan?: number; // Wartość SAN na początku doby gry (do kalkulacji progu 1/5)
  dailySanLoss?: number; // Skumulowana utrata SAN w bieżącej dobie gry
  insanityState?: InsanityState; // Stan psychiczny badacza ('none' | 'temporary' | 'indefinite' | 'permanent')
  underlyingInsanity?: boolean; // Ukryta niepoczytalność (każda strata SAN odpala atak szaleństwa)
  activeBoutOfMadness?: ActiveBoutOfMadness | null; // Aktywny atak szaleństwa
  mythosExceedsSanity?: boolean; // Gdy Mity Cthulhu > SAN (redukcja strat SAN o 50%)
  creatureSanLoss?: Record<string, number>; // Skumulowana utrata SAN per typ potwora (max cap)
  usedDowntimeRecovery?: boolean; // Czy w bieżącej przerwie śledczej wykorzystano próbę ukojenia (CoC 7e RAW)
  edgeOfTheAbyss?: boolean; // Czy postać jest na krawędzi otchłani (wykorzystany bufor ocalenia przy 0 SAN)
  lastFrenzySanBoost?: number; // Wartość otrzymanego zastrzyku SAN przy obłąkańczym transie

  // === MECHANIKA ZDROWIA I CIĘŻKICH RAN (CoC 7e RAW s. 119-123) ===
  hasMajorWound?: boolean; // Czy postać ma aktywną Ciężką Ranę (utrata >= 1/2 maxHP w jednym ataku)
  isDying?: boolean; // Czy postać umiera (0 HP z Ciężką Raną)
  isUnconscious?: boolean; // Czy postać jest nieprzytomna (0 HP lub porażka CON po Ciężkiej Ranie)
  isDead?: boolean; // Śmierć natychmiastowa; hp=0 bez tej flagi oznacza unconscious/dying.
  deathSavesUsed?: number; // Liczba wykorzystanych ocalen narracyjnych (np. uwięzienie / niewola)
  scars?: string[]; // Trwałe blizny i pamiątki po Ciężkich Ranach (tabela trafień CoC 7e / Seth Skorkowsky)
  healthRecoveryState?: {
    daysElapsed: number; // Suma dni spędzonych na rekonwalescencji
    weeksElapsed: number; // Liczba zakończonych tygodni
    facility: 'home' | 'public_hospital' | 'private_clinic' | 'poor_conditions';
    hasInfection: boolean; // Czy wdało się zakażenie/gorączka (fumble)
    lastCheckDate?: string;
  };
  move?: number;
  damageBonus?: string;
  build?: number;
  isProne?: boolean; // Czy postać leży na ziemi (np. po manewrze Padnij za osłonę / Dive for Cover CoC 7e RAW)

  // === MAGIA I TOMISKA MITÓW (CoC 7e RAW & Wielki Grymuar) ===
  magic?: CharacterMagicState;

  // Dane dodatkowe dla karty postaci
  portraitUrl?: string;
  gender?: 'male' | 'female';
  residence?: string;
  birthplace?: string;
  occupationalSkills?: string[];

  // Historia postaci (z kreatora)
  ideology?: string;
  significantPerson?: string;
  meaningfulLocation?: string;
  treasuredPossession?: string;
  traits?: string[];
  backstory?: string;
  appearance?: string; // Wygląd postaci (Visual DNA)
  description?: string; // Krótki opis postaci (wygląd, osobowość)
  characterConcept?: string; // Koncept postaci z kreatora (archetyp, motywacja)

  // === ROZSZERZONE SEKCJE (TODO.md: Widok Karty Postaci) ===

  // Ważne osoby (z avatarami) - NPC/postacie z życia postaci
  importantPeople?: Array<{
    id: string;
    name: string;
    relationship: string; // "matka", "mentor", "wróg", "przyjaciel"
    description?: string;
    status: 'alive' | 'dead' | 'unknown' | 'missing';
    avatarUrl?: string;
    notes?: string;
    isKeyConnection?: boolean; // Kluczowa kotwica życiowa (daje kość premii w samopomocy CoC 7e RAW)
    damaged?: boolean; // Nadszarpnięta relacja po porażce testu SAN
    lost?: boolean; // Bezpowrotnie utracona więź
  }>;

  // Znaczące miejsca z historii postaci
  significantPlaces?: Array<{
    id: string;
    name: string;
    type: 'birthplace' | 'home' | 'work' | 'memory' | 'trauma' | 'other';
    description?: string;
    imageUrl?: string;
    visited?: boolean;
  }>;

  // Cenne przedmioty (z głębszym znaczeniem niż zwykły ekwipunek)
  valuableItems?: Array<{
    id: string;
    name: string;
    significance: string; // Dlaczego jest ważny
    origin?: string; // Skąd pochodzi
    imageUrl?: string;
  }>;

  // Cechy charakteru (do wykorzystania w narracji szaleństwa)
  characterTraits?: {
    phobias: string[]; // Fobie (mogą być eksploatowane przy utracie poczytalności)
    manias: string[]; // Manie
    beliefs: string[]; // Głębokie przekonania
    habits: string[]; // Nawyki
    quirks: string[]; // Dziwactwa
    secrets: string[]; // Sekrety (tylko dla gracza/MG)
  };
}

// System kampanii dla lokalnej gry przy stole
export interface Campaign {
  id: string;
  name: string;
  description: string;
  scenario: string;
  status: 'active' | 'paused' | 'completed';
  createdAt: Date;
  characters: string[]; // ID postaci w kampanii
  currentSession: string; // ID aktualnej sesji
  gmNotes: string; // Notatki mistrza gry
}

// Stan aktywnej gry
export interface ActiveGameState {
  currentCharacter: Character | null;
  campaign: Campaign | null;
  session: GameSession | null;
  players: {
    characterId: string;
    playerName: string;
    isPresent: boolean;
  }[];
}

// Sesja gry (rozszerzenie istniejącego)
export interface GameSession {
  id: string;
  name: string;
  date: Date;
  character: Character;
  messages: Message[];
  adventureText: string;
  notes: string;
  status: 'active' | 'paused' | 'completed';
  campaignId?: string; // NOWE: ID kampanii
  participants: string[]; // NOWE: Lista graczy w sesji
  guardrailState?: GuardrailState; // Stan guardrails immersji i strike counter (Issue #380)
}

// NPC dla menedżera GM
export interface NPC {
  id: string;
  name: string;
  type: 'friendly' | 'neutral' | 'hostile' | 'monster';
  occupation: string;

  // Statystyki CoC7
  str: number;
  dex: number;
  con: number;
  app: number;
  pow: number;
  edu: number;
  siz: number;
  int: number;
  luck: number;

  // Cechy pochodne
  hp: number;
  maxHp: number;
  san: number;
  maxSan: number;
  mp: number;
  maxMp: number;

  // Umiejętności
  skills: { [key: string]: number };
  combatProfile?: NPCCombatProfile;

  // Dodatkowe informacje
  description: string;
  appearance: string;
  personality: string;
  motivations: string;
  relationshipWithPlayer: string;
  location: string;
  locationId?: string; // ID lokacji z menedżera lokacji

  // Profil trójwymiarowy według Lajosa Egriego (The Art of Dramatic Writing)
  physiologicalDetail?: string; // Wygląd, postawa, manieryzm fizyczny
  sociologicalStatus?: string; // Klasa, pozycja społeczna, dynamika siły
  psychologicalAgenda?: string; // Ukryty cel, lęk, skaza moralna
  /** Jawna agenda NPC (Arcanum Benchmark 2026: NPC Pushback) */
  agenda?: string;
  /** Nastawienie psychologiczne do badacza (blokada uległości) */
  disposition?: 'friendly' | 'neutral' | 'suspicious' | 'hostile' | 'fanatical';

  // Status i efekty
  status: 'alive' | 'dead' | 'unknown';
  statusEffects: Array<{
    id: string;
    name: string;
    type: 'injury' | 'disease' | 'madness' | 'other';
    description: string;
    timestamp: Date;
  }>;

  // Portret
  portraitUrl?: string;
  portraitGenerated?: boolean;
  portraitCacheId?: string; // ID w IndexedDB cache (persistentMediaCache)

  // Głos NPC (persystentna konfiguracja)
  voiceConfig?: {
    voiceId: string; // ID głosu Google TTS
    voiceName?: string; // Nazwa dla UI
    pitch?: number; // Pitch (-20 to 20)
    rate?: number; // Speed (0.25 to 4.0)
    languageCode?: string; // np. 'pl-PL'
  };

  // Tagi i kategorie
  tags: string[]; // np. "Świadek", "Sprzymierzeniec", "Antagonista"

  // Notatki GM
  gmNotes: string;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastUsed?: Date;
  sessionId?: string; // ID sesji w której był użyty

  // Historia zmian
  changeHistory: Array<{
    id: string;
    timestamp: Date;
    type: 'stat' | 'status' | 'skill' | 'other';
    field: string;
    oldValue: unknown;
    newValue: unknown;
    reason: string;
  }>;
}

export interface NPCCombatEquipmentAttack {
  kind: 'equipment';
  attackOptionId: string;
  equipmentTemplateId: string;
  combatSkillId: string;
}

export interface NPCCombatNaturalAttack {
  kind: 'natural';
  attackOptionId: string;
  name: string;
  combatSkillId: string;
  skillValue: number;
  damageFormula: string;
  damageClass: CombatDamageClass;
}

export interface NPCCombatProfile {
  schemaVersion: 1;
  attacksPerRound: number;
  attackOptions: Array<NPCCombatEquipmentAttack | NPCCombatNaturalAttack>;
  armorTemplateIds?: string[];
}

// Lokacja dla menedżera GM
export interface Location {
  id: string;
  name: string;
  type: 'city' | 'building' | 'wilderness' | 'laboratory' | 'temple' | 'other';
  era: '1920s' | '1930s' | 'modern' | 'other';

  // Opis
  description: string;
  appearance: string;
  atmosphere: string;

  // Lokalizacja geograficzna
  address?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };

  // Powiązania
  connectedLocations: string[]; // ID innych lokacji
  npcs: string[]; // ID NPC przypisanych do lokacji
  items: Array<{
    id: string;
    name: string;
    description: string;
    hidden: boolean; // Czy przedmiot jest ukryty
  }>;

  // Tajemnice
  secrets: Array<{
    id: string;
    title: string;
    description: string;
    discovered: boolean;
    requirements?: string; // Co jest potrzebne do odkrycia
  }>;

  // Mapa/ilustracja
  mapUrl?: string;
  mapGenerated?: boolean;
  imageCacheId?: string; // ID w IndexedDB cache (persistentMediaCache)

  // Dźwięki otoczenia (cache SFX)
  ambientSfx?: Array<{
    id: string;
    prompt: string; // Opis dźwięku do wygenerowania
    cacheId?: string; // ID w IndexedDB cache
    volume?: number; // Głośność (0-100)
    loop?: boolean; // Czy zapętlać
  }>;

  // Notatki GM
  gmNotes: string;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastVisited?: Date;
  visitedByPlayer: boolean;
  discoveryRequirements?: string; // Warunki odkrycia lokacji
}

// === HOT SEAT MULTIPLAYER ===

// Gracz w trybie Hot Seat
export interface HotSeatPlayer {
  id: string;
  name: string;
  color: string; // Kolor UI dla odróżnienia graczy (np. '#4ade80', '#f472b6')
  characterId: string; // ID powiązanej postaci
  isActive: boolean; // Czy to aktywny gracz
  turnCount: number; // Liczba wykonanych tur
}

// Konfiguracja trybu Hot Seat
export interface HotSeatConfig {
  enabled: boolean;
  adventureJournalId?: string; // Stabilny identyfikator dziennika tego przebiegu
  players: HotSeatPlayer[];
  activePlayerIndex: number;
  allowInterruptions: boolean; // Czy gracze mogą się przerywać
  showPlayerIndicator: boolean; // Pokaż kto obecnie gra
}

// Stan Hot Seat w sesji
export interface HotSeatState {
  config: HotSeatConfig;
  sessionStartTime: Date;
  switchCount: number; // Ile razy zmieniono gracza
}

// === SKILL TEST CARD SYSTEM ===

// Modyfikator testu (kość bonusowa/karna)
export interface SkillTestModifier {
  type: 'bonus' | 'penalty';
  reason: string;
  count: number; // liczba kości (1 lub 2)
}

// Dane testu umiejętności (parsowane z odpowiedzi AI)
export interface SkillTestData {
  id: string;
  skillName: string;
  skillValue: number; // wartość z karty postaci
  difficulty: 'zwykly' | 'trudny' | 'ekstremalny';
  modifiers: SkillTestModifier[];
  justification: string; // fabularny opis sytuacji
  stake?: string; // stawka testu (konsekwencje sukcesu/porażki) wyodrębniona z tagu [STAWKA: ...] (Issue #737)
  characterName?: string; // adresat testu w duecie
  characterId?: string; // ID rozwiązane z rosteru sesji
  groupId?: string; // testy z jednej odpowiedzi MG
}

// Aktywny test oczekujący na wynik gracza
export interface ActiveSkillTest {
  id: string;
  skillName: string;
  skillValue: number;
  threshold: number; // Obliczony próg (np. 22 dla trudnego przy 45%)
  bonusDice: number; // Bilans kości (-2 do +2)
  difficulty: 'zwykly' | 'trudny' | 'ekstremalny';
  createdAt: Date;
}

// === CUTSCENE SYSTEM (Auto-GM) ===

// Segment cutscenki (jeden akapit narracji)
export interface CutsceneSegment {
  id: string;
  text: string; // Tekst narracji
  imagePrompt?: string; // Prompt do generowania obrazu
  imageUrl?: string; // Wygenerowany obraz
  duration?: number; // Czas wyświetlania (ms) - auto jeśli TTS
  voiceUrl?: string; // URL audio TTS
}

// Stan aktywnej cutscenki
export interface CutsceneState {
  isActive: boolean;
  segments: CutsceneSegment[];
  currentIndex: number;
  isPaused: boolean;
  isMuted: boolean;
}

// === PDF MEMORY & ADVENTURE CONTEXT ===

export interface PdfMemory {
  rulesUrl?: string;
  adventureUrl?: string;
  rulesFileName?: string;
  adventureFileName?: string;
  isProcessing?: boolean;
}

export interface AdventureContext {
  id?: string;
  title: string;
  isCustom?: boolean;
  locale?: 'pl' | 'en';

  // Metadata
  era?: 'classic' | 'gaslight' | 'noir' | 'prl' | 'modern' | 'custom';
  eraLabel?: string;
  yearRange?: string;
  /** Jawny rok bieżącej akcji (nadrzędny wobec yearRange przy ustalaniu daty sceny) */
  activeSceneYear?: number;
  /** Dokładna lub tekstowa data startowa scenariusza (np. ISO string lub obiekt GameTime) */
  startDate?: string | Partial<GameTime>;
  /** Początkowe warunki pogodowe scenariusza */
  initialWeather?: string;
  location?: string;
  country?: string;
  tone?: 'purist' | 'pulp' | 'noir';
  rulesetVariant?: 'classic' | 'pulp';
  themes?: string[];

  // Content
  hook?: string;
  description?: string;
  /** Bezspoilerowe wprowadzenie dla Badacza (na ekran przygotowania sesji / ładowania) */
  investigatorIntro?: string;
  /** Ciekawostki i reguły świata z epoki dla Badacza (kontekst historyczno-społeczny) */
  settingTrivia?: string[];
  difficulty?: 'easy' | 'normal' | 'hard';
  difficultyStars?: number;
  estimatedSessions?: string;
  suggestedOccupations?: string[];
  investigatorRequirements?: InvestigatorRequirements;
  puzzles?: AdventurePuzzle[];
  handouts?: AdventureHandout[];
  activeChapterId?: string | number;
  activeLocationId?: string;
  activeNodeId?: string;

  // Files
  geminiFileUri?: string;
  fileUrl?: string;

  // Dynamic Setup & Conflicts (Bunkry Nieliniowości z poradników)
  conflicts?: AdventureConflict[];
  setupAsymmetry?: {
    rumors: string[]; // Lista sprzecznych plotek rozdawanych postaciom
    characterHooks: Array<{ characterId: string; personalHook: string }>;
  };

  // Zintegrowana mapa myśli, wygenerowana z PDF przez Gemini 3.1 Pro (Preview)
  graph?: AdventureGraph;

  /** Niezmienna prawda śledztwa (Arcanum Benchmark 2026: Sealed Envelope Enforcement) */
  truthAnchor?: {
    culprit?: string;
    motive?: string;
    murderWeapon?: string;
    keyAlibi?: string;
    immutableFacts?: string[];
  };

  /** Diegetyczne granice sprawy (Closed Circle Mystery) */
  boundarySummary?: string;

  /** Pula sekretów Mike'a Shea */
  secretsPool?: Array<string | { id?: string; text?: string; description?: string; isDiscovered?: boolean }>;
  secrets?: Array<string | { id?: string; text?: string; description?: string; isDiscovered?: boolean }>;

  /** Konfiguracja Zegara Zagłady (Doom Clock) dla scenariusza */
  doomClock?: {
    deadline?: Partial<GameTime>;
    totalHours?: number;
    stages?: Array<{
      phase: 0 | 1 | 2 | 3;
      title: string;
      description: string;
    }>;
  };
  /** Czy scenariusz należy do serii American Mythos Cold Cases (Quick Setup EN) */
  isAmericanColdCase?: boolean;
  /** Czy scenariusz jest częścią autorskiej serii Strefa 11 */
  isStrefa11?: boolean;
}

export interface ConflictFaction {
  id: string;
  name: string;
  description: string;
  goal: string; // Czego pożąda w konflikcie
  motivation: string; // Dlaczego (motywacja)
}

export interface AdventureConflict {
  factions: ConflictFaction[]; // Min. 2 sprzeczne strony
  resource: string; // Wspólny punkt zderzenia (np. las, przedmiot, wiedza)
}

// === GRAPH (ADVENTURE PREP ENGINE: THE ALEXANDRIAN CANON) ===

export type AdventureNodeType = 'intro' | 'location' | 'npc' | 'event' | 'climax';
export type ClueSourceType = 'material' | 'testimony' | 'document' | 'anomaly';
export type ClueType = 'core' | 'flavor';

export interface AdventureNode {
  id: string;
  name: string;
  type: AdventureNodeType;
  description: string;
  leadInClueIds: string[];
  leadOutClueIds: string[];
  isBottleneck?: boolean;
  isClimax?: boolean;
  atmosphere?: string;
  secret?: string;
  statsSummary?: string;
  locationId?: string;
  npcIds?: string[];
}

export interface AdventureClue {
  id: string;
  name: string;
  description: string;
  sourceType?: ClueSourceType;
  clueType?: ClueType;
  targetNodeId?: string;
  sourceNodeId?: string;
  requiredSkill?: string;
  isRedHerring?: boolean;
  isSynthesized?: boolean;
}

export interface GraphConnection {
  fromId: string;
  toId: string;
  description: string;
  clueId?: string;
}

export interface AdventureNPC {
  id: string;
  name: string;
  description: string;
  secret?: string; // Mroczny sekret, jeśli istnieje
  statsSummary?: string; // Ekstrakcja statystyk z podręcznika
}

export interface AdventureLocation {
  id: string;
  name: string;
  description: string;
  atmosphere?: string; // Sensoryczny opis
}

export interface AdventureGraph {
  nodes?: AdventureNode[];
  clues: AdventureClue[];
  connections: GraphConnection[];
  npcs: AdventureNPC[];
  locations: AdventureLocation[];
}



// === ZAGROŻENIA ŚRODOWISKOWE I TRUCIZNY CoC 7e RAW (Issue #60) ===
export type HazardType =
  | 'falling'
  | 'fire'
  | 'acid'
  | 'suffocation'
  | 'drowning'
  | 'poison';

export interface HazardEventData {
  id: string;
  type: HazardType;
  description: string;
  characterName?: string;
  characterId?: string;
  fallHeightMeters?: number;
  surface?: 'hard' | 'normal' | 'soft' | 'water';
  fireIntensity?: 'minor' | 'moderate' | 'major' | 'inferno';
  fireRounds?: number;
  acidPotency?: 'splash' | 'immersion';
  roundWithoutAir?: number;
  airlessKind?: 'smoke' | 'water' | 'vacuum';
  conFailed?: boolean;
  poisonId?: string;
  poisonName?: string;
  poisonPotency?: number;
  poisonSeverity?: 'mild' | 'strong' | 'lethal';
  defensiveSkill?: string;
  difficulty?: 'zwykly' | 'trudny' | 'ekstremalny';
}

export interface SpellCastEventData {
  id: string;
  spellId: string;
  characterName?: string;
  characterId?: string;
  alias?: string;
  targetName?: string;
  targetPow?: number;
  description?: string;
}

export interface OpposedMagicEventData {
  id: string;
  attackerName: string;
  attackerPow: number;
  spellId?: string;
  spellName?: string;
  characterName?: string;
  characterId?: string;
  description?: string;
}

export interface OpposedMeleeEventData {
  id: string;
  attackerName: string;
  attackerSkill: number;
  attackerBuild?: number;
  weaponName?: string;
  damageFormula?: string;
  damageBonus?: string;
  damageClass?: 'impaling' | 'non_impaling';
  characterName?: string;
  characterId?: string;
  description?: string;
  intent?: string;
  isOutnumbered?: boolean;
}

export interface FirearmsAttackEventData {
  id: string;
  shooterName: string;
  shooterSkill: number;
  weaponName: string;
  damageFormula: string;
  distanceCategory?: 'point_blank' | 'normal' | 'long' | 'extreme';
  bulletsFired?: number;
  burstCount?: number;
  malfunction?: number;
  characterName?: string;
  characterId?: string;
  description?: string;
}

export interface TomeStudyEventData {
  id: string;
  tomeId: string;
  characterName?: string;
  characterId?: string;
  action?: 'skimming' | 'study' | 'reference';
  topic?: string;
  title?: string;
  description?: string;
}

// === SYSTEM MIAR (Issue #191) ===
export type MeasurementSystem = 'metric' | 'imperial';

// === SYSTEM GAME OVER I EPILOGU CoC 7e RAW (Issue #372) ===
export type GameOverType = 'death' | 'permanent_insanity';

export interface GameOverEventData {
  id: string;
  type: GameOverType;
  characterName: string;
  characterId?: string;
  reason: string;
  location?: string;
  date?: string;
  newspaperSnippet?: {
    headline: string;
    body: string;
  };
  sanitariumRecord?: {
    admissionNo: string;
    physicianName: string;
    diagnosis: string;
    lastWords: string;
  };
}

// === GUARDRAILS & PROTOKÓŁ SERIOUS SAM (Issue #380) ===
export interface GuardrailState {
  strikeCount: number; // 0, 1, 2, 3
  turnsSinceLastViolation: number; // licznik do decay (>=3 resetuje strike o 1)
  lastViolationType?: 'anachronism' | 'obscene' | 'injection' | 'impossible';
}

export interface RefereeVetoEventData {
  id: string;
  type?: 'anachronism' | 'obscene' | 'injection' | 'impossible';
  reason: string;
  suggestedAlternatives?: string[];
}

// === KONWENCJA PULP CTHULHU (RAW & Pulpometr) ===
export type PulpLevel = 'low' | 'medium' | 'high' | 'apex';

export interface PulpArchetypeDefinition {
  id: string;
  name: {
    pl: string;
    en: string;
  };
  description: {
    pl: string;
    en: string;
  };
  /** Cechy kluczowe do wyboru premii +20 (np. ['dex', 'app'] lub ['str']) */
  coreCharacteristics: string[];
  coreCharacteristicBonus: number; // Zwykle 20
  bonusSkills: string[]; // Lista umiejętności, na które rozdziela się 100 pkt
  bonusSkillPoints: number; // Zwykle 100
  suggestedOccupations?: string[];
  suggestedTalents?: string[];
  suggestedTraits?: string[];
}

export type PulpTalentCategory = 'physical' | 'mental' | 'combat' | 'miscellaneous';

export interface PulpTalentDefinition {
  id: string;
  name: {
    pl: string;
    en: string;
  };
  category: PulpTalentCategory;
  description: {
    pl: string;
    en: string;
  };
  benefitSummary?: {
    pl: string;
    en: string;
  };
}

