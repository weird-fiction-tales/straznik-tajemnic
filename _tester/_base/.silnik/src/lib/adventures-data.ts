/**
 * Adventures Data - Wbudowane przygody i kontekst dla kreatora postaci
 * Scenariusze z Podręcznika Strażnika CoC 7ed
 */

import { ADVENTURE_CATALOG } from './adventures-catalog.generated';
import { AMERICAN_COLD_CASES_ADVENTURES } from './american-cold-cases-data';
import type { AdventureGraph } from './types';
import type {
  DocumentType,
  LorebookData,
  SourcebookReference,
} from '@/types/adventure';

export { AMERICAN_COLD_CASES_ADVENTURES };

// ============================================================================
// TYPY
// ============================================================================



/**
 * Realny handout przygody (mapa/dokument z legalnie posiadanych materiałów
 * użytkownika). Obraz w public/handouts/ (gitignored, generowany skryptem
 * scripts/extract-handouts.mjs). MG „wręcza" go graczom wstawiając w narracji
 * gotowy markdown `![title](image)` - patrz build-handouts-context.ts.
 */
export interface AdventureHandout {
  /** Stabilny identyfikator handoutu w obrębie przygody (np. 'mapa-walimia'). */
  slug: string;
  /** ID rekordu `handout_locator` przypisanego po inspekcji dokładnego wydania PDF-u. */
  dossierRecordId?: string;
  /** Jawne, pełne aliasy dla starszych identyfikatorów; resolver nie zgaduje po fragmencie. */
  aliases?: string[];
  /** Tytuł widoczny dla gracza (alt obrazu). */
  title: string;
  /** Ścieżka publiczna obrazu, np. '/handouts/cienie-tatr/pociag_do_szalenstwa-mapa-walimia.png'. */
  image: string;
  /** Opcjonalna ścieżka do nagrania audio lektora/rekwizytu (np. '/audio/handouts/cien-nad-prabutami/tasma-sb-elblag.mp3'). */
  audioUrl?: string;
  /** Opcjonalna dedykowana ścieżka do wersji polskiej nagrania audio */
  audioUrlPl?: string;
  /** Opcjonalna dedykowana ścieżka do wersji angielskiej nagrania audio */
  audioUrlEn?: string;
  /** Opcjonalny wariant diegetycznego odtwarzacza audio */
  reelType?: 'reel_to_reel' | 'cassette' | 'gramophone' | 'radio';
  /** Opcjonalny typ handoutu dla renderera tekstu w czacie */
  handoutType?: 'newspaper' | 'letter' | 'telegram' | 'report' | 'diary' | 'book' | 'map';
  /** Opcjonalna transkrypcja lub nienaruszony tekst RAW z podręcznika */
  textContent?: string;
  /** Flaga widoczności dla gracza (domyślnie true) */
  isPlayerFacing?: boolean;
  /** Flaga materiałów Strażnika / planów taktycznych (blokada wręczania graczom, domyślnie false) */
  keeperOnly?: boolean;
  /** Identyfikator powiązanego rozdziału lub aktu */
  chapterId?: string;
  /** Identyfikator powiązanego węzła grafu śledztwa */
  nodeId?: string;
  /** Identyfikator powiązanej lokacji */
  locationId?: string;
}

/** Gotowa postać (pregen) wyekstrahowana ze scenariusza */
export interface PregenCharacterConcept {
  id: string;
  name: string;
  gender?: 'male' | 'female' | 'other';
  age?: number;
  occupation?: string;
  background?: string;
  skills?: string[];
  stats?: Record<string, number>;
}

/** Ograniczenia i wytyczne dotyczące Badaczy dla danej przygody */
export interface InvestigatorRequirements {
  minAge?: number;
  maxAge?: number;
  requiredOccupations?: string[];
  summary?: string;
  pregenCharacters?: PregenCharacterConcept[];
}

/** Zagadka logiczna / dedukcyjna w scenariuszu */
export interface AdventurePuzzle {
  id: string;
  title: string;
  description: string;
  handoutSlugs?: string[];
  solutionSummary: string;
  clues?: string[];
  ideaRollPrompt?: string;
}

export interface AdventureContext {
  id: string;
  title: string;
  locale?: 'pl' | 'en';
  era: 'classic' | 'gaslight' | 'noir' | 'prl' | 'modern' | 'custom';
  eraLabel: string;
  yearRange: string;
  activeSceneYear?: number;
  /** Dokładna lub tekstowa data startowa scenariusza (np. ISO string lub obiekt GameTime) */
  startDate?: string | Partial<import('./types').GameTime>;
  /** Początkowe warunki pogodowe scenariusza */
  initialWeather?: string;
  location: string;
  country: string;
  tone: 'purist' | 'pulp' | 'noir';
  rulesetVariant?: 'classic' | 'pulp';
  themes: string[];
  suggestedOccupations: string[];
  suggestedArchetypes: string[];
  hook: string;
  description: string;
  /** Bezspoilerowe wprowadzenie dla Badacza (na ekran przygotowania sesji / ładowania) */
  investigatorIntro?: string;
  /** Ciekawostki i reguły świata z epoki dla Badacza (kontekst historyczno-społeczny) */
  settingTrivia?: string[];
  estimatedSessions: string;
  playerCount: string;
  difficulty: 'easy' | 'normal' | 'hard';
  /** Poziom trudności w gwiazdkach 1-5 (zgodnie z oficjalną legendą Black Monk CoC 7e) */
  difficultyStars?: number;
  /** Wymagania dotyczące badaczy (wiek, dozwolone profesje, gotowe postacie) */
  investigatorRequirements?: InvestigatorRequirements;
  /** Zagadki logiczne w scenariuszu powiązane z rekwizytami i Testem Pomysłu (Idea Roll) */
  puzzles?: AdventurePuzzle[];
  isCustom?: boolean;
  pdfUrl?: string;
  customDescription?: string; // Opis założeń przygody od użytkownika (dla AI)
  graph?: AdventureGraph; // Zintegrowana mapa myśli (analiza AI)
  /** Typ dokumentu: scenariusz vs kampania vs przewodnik regionalny vs kompendium reguł/almanach */
  documentType?: DocumentType;
  /** Flaga oznaczająca czy przygoda jest kampanią (wieloczęściową z ciągłością Badaczy) */
  isCampaign?: boolean;
  /** Dedykowany patron kampanii (np. 'Caduceus', 'Uniwersytet Miskatonic'), który nadpisuje ogólne stowarzyszenia */
  campaignPatron?: string;
  /** Ustrukturyzowane dane dla Lorebooka / Kompendium */
  lorebookData?: LorebookData;
  /** Identyfikatory wgranych lorebooków / kompendiów podpiętych do tego scenariusza */
  attachedLorebookIds?: string[];
  /** Metadane podpiętych ksiąg tła (dla szybkiego odpytywania promptu MG) */
  attachedLorebooks?: SourcebookReference[];
  // --- Źródło pochodzenia (katalog z metką zbioru) ---
  /** Nazwa zbioru źródłowego do wyświetlenia (np. nazwa antologii lub podręcznika). */
  source?: string;
  /** Kategoria źródła do grupowania w UI. */
  sourceCategory?: 'core' | 'anthology' | 'oneshot' | 'custom' | 'starter';
  /**
   * Slug książki źródłowej. MUSI pokrywać się z tagiem `source:<slug>` zapisanym
   * przez reindex (scripts/reindex-pdfs.ts) - dzięki temu MG przy aktywnej
   * przygodzie czyta z RAG tylko fragmenty jej książki (retrieval-service
   * adventureSource). Przygody z podręcznika ('ksiega-straznika') czerpią treść
   * z namespace 'rules', nie 'adventures'.
   */
  sourceBookId?: string;
  /** Przygoda wprowadzająca dla początkujących (badge "⭐ Dobra na start"). */
  recommendedForBeginners?: boolean;
  /** Strona startu scenariusza w książce źródłowej (informacyjnie). */
  pageStart?: number | null;
  /** Opcjonalne zewnętrzne linki do mediów / źródeł (np. Wikipedia, Filmweb, Player.pl). */
  externalLinks?: Array<{ label: string; url: string }>;
  /** Czy scenariusz jest częścią autorskiej serii Strefa 11 */
  isStrefa11?: boolean;
  /** Czy scenariusz należy do serii American Mythos Cold Cases (Quick Setup EN) */
  isAmericanColdCase?: boolean;
  /** Predefiniowane handouty fabularne (dokumenty, mapy, taśmy audio) */
  handouts?: AdventureHandout[];
  /** Aktywny rozdział lub akt scenariusza */
  activeChapterId?: string | number;
  /** Aktywna lokacja */
  activeLocationId?: string;
  /** Aktywny węzeł grafu śledztwa */
  activeNodeId?: string;
  /** Diegetyczne granice sprawy (Closed Circle Mystery - Seth Skorkowsky) (Issue #648 Faza 2 R2) */
  boundarySummary?: string;
  /** Pula sekretów Mike'a Shea z 3 bezpiecznikami anty-pleasing (Issue #648 Faza 2 R1) */
  secretsPool?: Array<string | { id?: string; text?: string; description?: string; isDiscovered?: boolean }>;
  secrets?: Array<string | { id?: string; text?: string; description?: string; isDiscovered?: boolean }>;
  /** Niezmienna prawda śledztwa (Sealed Envelope Enforcement) */
  truthAnchor?: {
    culprit?: string;
    motive?: string;
    murderWeapon?: string;
    keyAlibi?: string;
    immutableFacts?: string[];
  };
  /** Konfiguracja Zegara Zagłady (Doom Clock) dla scenariusza */
  doomClock?: {
    deadline?: Partial<import('./types').GameTime>;
    totalHours?: number;
    stages?: Array<{
      phase: 0 | 1 | 2 | 3;
      title: string;
      description: string;
    }>;
  };
  /** Senne Wezwania i oniryczne wizje CoC 7e RAW (Issue #787: brak w ekwipunku) */
  dreamCalls?: import('./adventures/dreams/ancient-trees-dreams').DreamCallVariant[];
}

// ============================================================================
// AUTORSKIE PRZYGODY INSPROWANE PROGRAMEM STREFA 11 (TVN / NIE DO WIARY)
// ============================================================================

export const STREFA_11_ADVENTURES: AdventureContext[] = [
  {
    id: 'cien-nad-prabutami',
    title: 'Cień nad Prabutami: Widzenie Ojca Klimuszki',
    era: 'prl',
    eraLabel: 'PRL - lata 70.',
    yearRange: '1973-1974',
    activeSceneYear: 1973,
    startDate: '1973-10-18T19:30',
    initialWeather: 'Zimna mżawka i chłodny wiatr od Zalewu Wiślanego',
    location: 'Warszawa - Elbląg - Prabuty',
    country: 'Polska',
    tone: 'noir',
    themes: ['Jasnowidzenie', 'Służba Bezpieczeństwa', 'Trauma wojenna', 'Cztery wymiary'],
    suggestedOccupations: ['Dziennikarz', 'Parapsycholog', 'Egzorcysta', 'Milicjant'],
    suggestedArchetypes: ['investigator', 'scholar', 'mystic', 'action'],
    hook: 'Weryfikacja fenomenów ojca Klimuszki doprowadza badaczy do tajnych teczek SB i anomalii wymiarowej w Prabutach.',
    description: 'Badacze zostają zaangażowani przez redaktorkę Helenę Krawczyk z programu „Sygnały Nieznanego” po Międzynarodowym Kongresie Psychotronicznym w Pradze. Ich zadaniem jest naukowa weryfikacja niezwykłych fenomenów ojca Klimuszki - franciszkanina z Elbląga, który odnajduje zaginionych na podstawie fotografii. Śledztwo szybko uderza w tajne operacje Służby Bezpieczeństwa oraz ujawnia przerażającą prawdę o wojennej traumie z 1941 roku i czwartym wymiarze czasu.',
    investigatorIntro: 'Badacze zostają zaangażowani przez redaktorkę Helenę Krawczyk z programu „Sygnały Nieznanego” po Międzynarodowym Kongresie Psychotronicznym w Pradze. Ich zadaniem jest naukowa weryfikacja niezwykłych fenomenów ojca Klimuszki - franciszkanina z Elbląga, który odnajduje zaginionych na podstawie fotografii. Śledztwo szybko uderza w tajne operacje Służby Bezpieczeństwa oraz niewyjaśnione zdarzenia w ruinach kościoła w Prabutach.',
    settingTrivia: [
      'W PRL lat 70. każde nieoficjalne zgromadzenie i badania nad parapsychologią znajdowały się pod ścisłą obserwacją Departamentu IV MSW i Służby Bezpieczeństwa.',
      'Obywatele i Badacze poruszający się po kraju musieli posiadać dowód tożsamości, a telefony stacjonarne były rzadkością i podlegały kontroli podsłuchowej.',
      'Prasa i telewizja (np. program „Sygnały Nieznanego”) działały pod nadzorem Głównego Urzędu Kontroli Prasy, Publikacji i Widowisk (cenzury).',
    ],
    estimatedSessions: '1-2',
    playerCount: '1-4',
    difficulty: 'easy',
    source: 'Strefa 11 / Nie do wiary',
    sourceCategory: 'oneshot',
    recommendedForBeginners: true,
    isStrefa11: true,
    documentType: 'scenario',
    isCampaign: false,
    activeNodeId: 'node-warszawa-redakcja',
    boundarySummary:
      'Obszar operacyjny obejmuje oś Warszawa - Elbląg - Prabuty. Próba samowolnego opuszczenia rejonu Żuław i Powiśla przed wyjaśnieniem sprawy skutkuje blokadą drogową Milicji Obywatelskiej, zatrzymaniem pod zarzutem szpiegostwa przemysłowego przez funkcjonariuszy Departamentu IV MSW lub odebraniem przepustek prasowych RTV i natychmiastową konfiskatą zebranych materiałów przez Służbę Bezpieczeństwa.',
    truthAnchor: {
      culprit:
        'Generał Edward Majewski (Departament IV MSW) oraz ponadwymiarowy byt czasoprzestrzenny (Echo z Prabut / Pomiot Yog-Sothotha)',
      motive:
        'Departament IV MSW pod kryptonimem KLIN próbuje militarnie wymusić na ojcu Klimuszce otwarcie trwałej szczeliny retrospektywnej w ruinach kościoła w Prabutach do inwigilacji przeszłości i przyszłości.',
      murderWeapon:
        'Przeciążenie astralno-elektromagnetyczne wywołujące wylew wewnętrzny i wypalenie synaps u świadków widzenia bez osłony ziołowej (Receptura nr 152).',
      keyAlibi:
        'Oficjalnie generał Majewski przebywa na naradzie partyjnej w Warszawie, podczas gdy jego grupa operacyjna SB w wozie transmisyjnym pod Prabutami rozstawia generatory rezonansowe.',
      immutableFacts: [
        'Ojciec Andrzej Czesław Klimuszko nie jest sprawcą anomalii - jego dar jasnowidzenia to skutek uboczny porażenia energią szczeliny w 1945 roku.',
        'Receptura ziołowa nr 152 realnie tłumi fale czwartego wymiaru i chroni układ nerwowy przed paraliżem w krypcie w Prabutach.',
        'Pod ołtarzem zrujnowanego kościoła w Prabutach spoczywa stopiony relikwiarz z 1945 roku, który działa jak soczewka czasoprzestrzenna.',
        'Operacja MSW o kryptonimie KLIN dąży do przejęcia artefaktu w Prabutach przed północą 19 października 1973 roku.',
      ],
    },
    doomClock: {
      deadline: {
        year: 1973,
        month: 9,
        day: 19,
        hour: 23,
        minute: 59,
      },
      totalHours: 28,
      stages: [
        {
          phase: 0,
          title: 'Faza 0: Cisza (Weryfikacja prasowa)',
          description:
            'Badacze swobodnie analizują materiały w redakcji RTV i wyruszają w teren. Czarna Wołga SB obserwuje ich z daleka bez otwartej ingerencji.',
        },
        {
          phase: 1,
          title: 'Faza 1: Narastająca presja (Podsłuchy i cenzura)',
          description:
            'W telefonach słychać trzaski podsłuchu SB. Wokół klasztoru w Elblągu kręcą się wywiadowcy w cywilu, a świadkowie oglądają się za siebie ze strachem.',
        },
        {
          phase: 2,
          title: 'Faza 2: Bezpośrednie zagrożenie (Kordon operacyjny KLIN)',
          description:
            'Grupa operacyjna SB zamyka drogi dojazdowe do Prabut. W powietrzu czuć ozon, a wskazówki kompasów i zegarków zaczynają wariować.',
        },
        {
          phase: 3,
          title: 'Faza 3: Punkt kulminacyjny (Otwarcie Szczeliny Czasu)',
          description:
            'Generatory SB w ruinach kościoła w Prabutach osiągają pełną moc. Granica między rokiem 1945 a 1973 pęka, budząc drapieżne echo czwartego wymiaru.',
        },
      ],
    },
    secretsPool: [
      {
        id: 'sec-prabuty-1',
        text: 'Klisze fotograficzne przechowywane w pobliżu relikwiarza z Prabut rejestrują sylwetki żołnierzy i zakonników z 1945 roku nałożone na współczesne tło.',
        isDiscovered: false,
      },
      {
        id: 'sec-prabuty-2',
        text: 'W aktach personalnych dr. Jarosława Skrzyńskiego znajduje się zobowiązanie do współpracy z Departamentem IV MSW podpisane pod przymusem po Kongresie w Pradze.',
        isDiscovered: false,
      },
      {
        id: 'sec-prabuty-3',
        text: 'Mieszanka ziołowa nr 152 zawiera wysuszone kłącze rośliny rosnącej wyłącznie na zgliszczach krypty w Prabutach, skażonej popiołem bursztynowym.',
        isDiscovered: false,
      },
      {
        id: 'sec-prabuty-4',
        text: 'Kościelny Tadeusz Polak ukrywa w piwnicy starej plebanii niemiecki dziennik ewakuacyjny z 1945 roku, opisujący skrzynię z bursztynową soczewką.',
        isDiscovered: false,
      },
      {
        id: 'sec-prabuty-5',
        text: 'Na taśmie szpulowej ZK-140 w paśmie poniżej słyszalnego progu zarejestrowano metaliczny pogłos bijącego dzwonu kościelnego, który spłonął w 1945 roku.',
        isDiscovered: false,
      },
      {
        id: 'sec-prabuty-6',
        text: 'Ojciec Klimuszko podczas najgłębszych transów widzi dokładną datę własnej śmierci oraz twarze ludzi, którzy dopiero za kilkadziesiąt lat wejdą do krypty.',
        isDiscovered: false,
      },
    ],
    graph: {
      nodes: [
        {
          id: 'node-warszawa-redakcja',
          name: "Redakcja 'Sygnałów Nieznanego' (RTV Warszawa)",
          type: 'intro',
          description:
            "Zimny, socrealistyczny gabinet redaktorki Heleny Krawczyk przy ul. Woronicza. Wokół kłęby dymu z papierosów 'Sport', taśmy montażowe i worki listów od telewidzów poruszonych fenomenem jasnowidza z Elbląga.",
          atmosphere:
            'Stukot maszyn do pisania, dym tytoniowy, zapach taniej kawy zbożowej i nerwowe spojrzenia w stronę korytarza.',
          locationId: 'loc-warszawa-redakcja',
          npcIds: ['npc-helena-krawczyk', 'npc-jaroslaw-skrzynski'],
          leadInClueIds: [],
          leadOutClueIds: [
            'clue-photo-prabuty',
            'clue-prague-delegation-list',
            'clue-skrzynski-psychotronic-report',
          ],
        },
        {
          id: 'node-elblag-klasztor',
          name: 'Klasztor św. Pawła w Elblągu (Cela o. Klimuszki)',
          type: 'location',
          isBottleneck: true,
          description:
            'Skromna cela franciszkanina pachnąca suszonymi ziołami, miętą i starym papierem. Za oknem słychać mroźny wiatr od Zalewu Wiślanego, a pod ścianą stoi niepozorna czarna Wołga SB.',
          atmosphere:
            'Zapach suszonego dziurawca i waleriany, tykanie ściennego zegara, półmrok rozświetlany świecą i narastające napięcie elektromagnetyczne.',
          secret:
            'Cela jest całodobowo podsłuchiwana przez SB, a sam o. Klimuszko używa mieszanki nr 152, by powstrzymać wizje rozrywające jego umysł.',
          locationId: 'loc-elblag-klasztor',
          npcIds: ['npc-klimuszko'],
          leadInClueIds: [
            'clue-photo-prabuty',
            'clue-polak-testimony-monk',
            'clue-sb-wiretap-elblag-log',
          ],
          leadOutClueIds: [
            'clue-herbal-recipe-152',
            'clue-wiretap-bug-elblag',
            'clue-klimuszko-vision-crypt',
          ],
        },
        {
          id: 'node-prabuty-wykopaliska',
          name: 'Stara Plebania i Cmentarz w Prabutach',
          type: 'location',
          isBottleneck: true,
          description:
            'Mglista, poniemiecka miejscowość na Powiślu, w której Klimuszko tuż po wojnie odnajdywał ukryte w ziemi starodruki i srebra. Lokalni mieszkańcy wciąż szepczą o nocnych błyskach światła wśród nagrobków.',
          atmosphere:
            'Gęsta mgła znad jeziora Liwieniec, krakanie wron, zapach wilgotnego torfu i dziwne mrowienie na skórze.',
          secret:
            'W ziemi wokół starej plebanii zalega radioaktywno-luminescencyjny popiół bursztynowy z 1945 roku, wskazujący podziemny korytarz do krypty.',
          locationId: 'loc-prabuty-wykopaliska',
          npcIds: ['npc-tadeusz-polak'],
          leadInClueIds: [
            'clue-skrzynski-psychotronic-report',
            'clue-herbal-recipe-152',
            'clue-msw-excavation-order',
          ],
          leadOutClueIds: [
            'clue-amber-ashes',
            'clue-polak-testimony-monk',
            'clue-military-tire-tracks',
          ],
        },
        {
          id: 'node-msw-warszawa',
          name: 'Archiwum Operacyjne i Gabinet Gen. Majewskiego (MSW)',
          type: 'location',
          isBottleneck: true,
          description:
            'Ciężkie dębowe meble, godło państwowe na ścianie, pancerne szafy na akta i cichy szum dalekopisów. Centrum dowodzenia operacją psychotroniczną KLIN.',
          atmosphere:
            'Chłód instytucjonalnego terroru, szczęk zamków szyfrowych, brzęczenie jarzeniówek i zapach pasty do podłóg.',
          secret:
            'Generał Majewski ukrywa przed Komitetem Centralnym fakt, że poprzedni eksperyment w Prabutach zakończył się śmiercią dwóch techników SB.',
          locationId: 'loc-msw-warszawa',
          npcIds: ['npc-edward-majewski'],
          leadInClueIds: [
            'clue-prague-delegation-list',
            'clue-wiretap-bug-elblag',
            'clue-military-tire-tracks',
          ],
          leadOutClueIds: [
            'clue-sb-file-klin',
            'clue-sb-wiretap-elblag-log',
            'clue-msw-excavation-order',
          ],
        },
        {
          id: 'node-prabuty-krypta-climax',
          name: 'Zawalona Krypta pod Ruinami Kościoła w Prabutach (Finał)',
          type: 'climax',
          isBottleneck: true,
          isClimax: true,
          description:
            'Podziemna komora pod spalonym w 1945 roku ołtarzem w Prabutach. Kable z wojskowego generatora SB oplatają popękane gotyckie kolumny, a w centrum unosi się pulsująca soczewka zakrzywionego czasu.',
          atmosphere:
            'Ogłuszający pisk aparatury pomiarowej, zapach ozonu i spalonego bursztynu, nakładające się na siebie obrazy z 1941, 1945 i 1973 roku.',
          secret:
            'Zniszczenie bursztynowej soczewki lub odcięcie zasilania generatorów SB przed północą zamyka szczelinę czwartego wymiaru, ratując umysł o. Klimuszki.',
          locationId: 'loc-prabuty-krypta',
          npcIds: ['npc-edward-majewski', 'npc-klimuszko'],
          leadInClueIds: [
            'clue-klimuszko-vision-crypt',
            'clue-amber-ashes',
            'clue-sb-file-klin',
          ],
          leadOutClueIds: [],
        },
      ],
      clues: [
        {
          id: 'clue-photo-prabuty',
          name: 'Zdjęcie z klinowym pismem (1947)',
          description:
            'Czarno-biała fotografia ruin w Prabutach z 1947 r. Z tyłu widnieje adnotacja ojca Klimuszki wskazująca klasztor w Elblągu jako miejsce przechowywania jego dzienników wizji. Pod lupą tło zdjęcia zdaje się minimalnie falować.',
          sourceType: 'document',
          clueType: 'core',
          sourceNodeId: 'node-warszawa-redakcja',
          targetNodeId: 'node-elblag-klasztor',
          requiredSkill: 'Spostrzegawczość',
        },
        {
          id: 'clue-prague-delegation-list',
          name: 'Lista delegatów Kongresu w Pradze z pieczęcią MSW',
          description:
            'Kopia listy wyjazdowej z biurka redaktor Krawczyk. Przy nazwisku o. Klimuszki widnieje czerwona pieczęć Departamentu IV MSW w Warszawie i kryptonim operacyjny KLIN.',
          sourceType: 'document',
          clueType: 'core',
          sourceNodeId: 'node-warszawa-redakcja',
          targetNodeId: 'node-msw-warszawa',
          requiredSkill: 'Biblioteka',
        },
        {
          id: 'clue-skrzynski-psychotronic-report',
          name: 'Wstępny raport dr. Skrzyńskiego o anomalii w Prabutach',
          description:
            'Relacja eksperta z redakcji RTV opisująca niewytłumaczalne poparzenia radiacyjne i świetliste smugi nad starą plebanią i cmentarzem w Prabutach.',
          sourceType: 'testimony',
          clueType: 'core',
          sourceNodeId: 'node-warszawa-redakcja',
          targetNodeId: 'node-prabuty-wykopaliska',
          requiredSkill: 'Perswazja',
        },
        {
          id: 'clue-herbal-recipe-152',
          name: 'Rękopis Mieszanki Ziołowej Nr 152',
          description:
            'Niepublikowana receptura ojca Klimuszki zawierająca rzadkie zioła zbierane wyłącznie przy ruinach cmentarza w Prabutach, tłumiące percepcję strachu i odbiór szumów astralnych.',
          sourceType: 'material',
          clueType: 'core',
          sourceNodeId: 'node-elblag-klasztor',
          targetNodeId: 'node-prabuty-wykopaliska',
          requiredSkill: 'Nauka (Botanika / Farmacja)',
        },
        {
          id: 'clue-wiretap-bug-elblag',
          name: 'Pluskwa podsłuchowa WUSW w celi klasztornej',
          description:
            'Ukryty w kratce wentylacyjnej celi mikrofon dynamiczny z wybitym numerem ewidencyjnym gabinetu generała Majewskiego w warszawskim MSW.',
          sourceType: 'material',
          clueType: 'core',
          sourceNodeId: 'node-elblag-klasztor',
          targetNodeId: 'node-msw-warszawa',
          requiredSkill: 'Spostrzegawczość',
        },
        {
          id: 'clue-klimuszko-vision-crypt',
          name: 'Prorocze widzenie o. Klimuszki o krypcie pod ołtarzem',
          description:
            'Bezpośrednie świadectwo zakonnika wygłoszone w półśnie: pod zapadniętym ołtarzem kościoła w Prabutach pulsuje otwarta rana w czasie, której nie wolno dotknąć bez osłony ziołowej.',
          sourceType: 'testimony',
          clueType: 'core',
          sourceNodeId: 'node-elblag-klasztor',
          targetNodeId: 'node-prabuty-krypta-climax',
          requiredSkill: 'Psychologia',
        },
        {
          id: 'clue-amber-ashes',
          name: 'Luminescencyjny Popiół ze Skrzyni Skarbów (1945)',
          description:
            'Próbka spalonej żywicy bursztynowej z wykopalisk przy plebanii w Prabutach. Wydziela silny zapach ozonu, a jej smuga prowadzi bezpośrednio do zasypanego wejścia krypty pod ołtarzem.',
          sourceType: 'anomaly',
          clueType: 'core',
          sourceNodeId: 'node-prabuty-wykopaliska',
          targetNodeId: 'node-prabuty-krypta-climax',
          requiredSkill: 'Spostrzegawczość',
        },
        {
          id: 'clue-polak-testimony-monk',
          name: 'Zeznanie kościelnego Tadeusza Polaka o ucieczce zakonnika',
          description:
            'Stary kościelny wspomina, jak w 1945 r. młody Klimuszko wybiegł z podziemi kościoła z posiwiałymi skroniami i wyjechał do klasztoru św. Pawła w Elblągu.',
          sourceType: 'testimony',
          clueType: 'core',
          sourceNodeId: 'node-prabuty-wykopaliska',
          targetNodeId: 'node-elblag-klasztor',
          requiredSkill: 'Urok Osobisty',
        },
        {
          id: 'clue-military-tire-tracks',
          name: 'Ślady opon wozu pelengacyjnego MSW i zgubiona przepustka',
          description:
            'Świeże koleiny ciężarówki wojskowej Star przy cmentarzu w Prabutach oraz upuszczony blankiet rozkazu wyjazdu podpisany w gabinecie generała Majewskiego w MSW.',
          sourceType: 'anomaly',
          clueType: 'core',
          sourceNodeId: 'node-prabuty-wykopaliska',
          targetNodeId: 'node-msw-warszawa',
          requiredSkill: 'Tropienie',
        },
        {
          id: 'clue-sb-file-klin',
          name: "Tajna Teczka MSW 'Kryptonim KLIN'",
          description:
            'Ściśle tajna dokumentacja Departamentu IV MSW zawierająca plan geodezyjny krypty pod ołtarzem w Prabutach oraz rozkaz uruchomienia generatorów w punkcie anomalii.',
          sourceType: 'document',
          clueType: 'core',
          sourceNodeId: 'node-msw-warszawa',
          targetNodeId: 'node-prabuty-krypta-climax',
          requiredSkill: 'Biblioteka',
        },
        {
          id: 'clue-sb-wiretap-elblag-log',
          name: 'Taśma szpulowa ZK-140 z podsłuchu celi w Elblągu',
          description:
            'Zapis audio z archiwum MSW dokumentujący manifestację drugiego, nieludzkiego głosu w celi o. Klimuszki w klasztorze w Elblągu.',
          sourceType: 'anomaly',
          clueType: 'core',
          sourceNodeId: 'node-msw-warszawa',
          targetNodeId: 'node-elblag-klasztor',
          requiredSkill: 'Nasłuchiwanie',
        },
        {
          id: 'clue-msw-excavation-order',
          name: 'Rozkaz zabezpieczenia wykopalisk przy plebanii w Prabutach',
          description:
            'Szyfrogram MSW nakazujący milicji odgrodzenie terenu starego cmentarza i plebanii w Prabutach pod pretekstem niewypałów z II wojny światowej.',
          sourceType: 'document',
          clueType: 'core',
          sourceNodeId: 'node-msw-warszawa',
          targetNodeId: 'node-prabuty-wykopaliska',
          requiredSkill: 'Prawo',
        },
      ],
      connections: [
        {
          fromId: 'node-warszawa-redakcja',
          toId: 'node-elblag-klasztor',
          clueId: 'clue-photo-prabuty',
          description:
            'Adnotacja o. Klimuszki na odwrocie fotografii ruin prowadzi bezpośrednio do jego celi w klasztorze w Elblągu.',
        },
        {
          fromId: 'node-warszawa-redakcja',
          toId: 'node-msw-warszawa',
          clueId: 'clue-prague-delegation-list',
          description:
            'Pieczęć Departamentu IV MSW i kryptonim KLIN na liście delegatów kierują trop do gabinetu gen. Majewskiego.',
        },
        {
          fromId: 'node-warszawa-redakcja',
          toId: 'node-prabuty-wykopaliska',
          clueId: 'clue-skrzynski-psychotronic-report',
          description:
            'Wstępny raport dr. Skrzyńskiego wskazuje na anomalie świetlne przy starej plebanii i cmentarzu w Prabutach.',
        },
        {
          fromId: 'node-elblag-klasztor',
          toId: 'node-prabuty-wykopaliska',
          clueId: 'clue-herbal-recipe-152',
          description:
            'Składniki receptury ziołowej nr 152 prowadzą na zgliszcza i cmentarz przy plebanii w Prabutach.',
        },
        {
          fromId: 'node-elblag-klasztor',
          toId: 'node-msw-warszawa',
          clueId: 'clue-wiretap-bug-elblag',
          description:
            'Odnaleziona w celi pluskwa podsłuchowa zdradza bezpośredni nadzór archiwum operacyjnego MSW.',
        },
        {
          fromId: 'node-elblag-klasztor',
          toId: 'node-prabuty-krypta-climax',
          clueId: 'clue-klimuszko-vision-crypt',
          description:
            'Prorocza wizja o. Klimuszki wskazuje zawaloną kryptę pod ołtarzem w Prabutach jako epicentrum czwartego wymiaru.',
        },
        {
          fromId: 'node-prabuty-wykopaliska',
          toId: 'node-prabuty-krypta-climax',
          clueId: 'clue-amber-ashes',
          description:
            'Ślad luminescencyjnego popiołu bursztynowego prowadzi z wykopalisk wprost do podziemnej krypty pod kościołem.',
        },
        {
          fromId: 'node-prabuty-wykopaliska',
          toId: 'node-elblag-klasztor',
          clueId: 'clue-polak-testimony-monk',
          description:
            'Zeznanie kościelnego Tadeusza Polaka opisuje ucieczkę porażonego zakonnika do klasztoru w Elblągu.',
        },
        {
          fromId: 'node-prabuty-wykopaliska',
          toId: 'node-msw-warszawa',
          clueId: 'clue-military-tire-tracks',
          description:
            'Ślady wozu pelengacyjnego i upuszczony rozkaz wyjazdu prowadzą do centrali Departamentu IV MSW.',
        },
        {
          fromId: 'node-msw-warszawa',
          toId: 'node-prabuty-krypta-climax',
          clueId: 'clue-sb-file-klin',
          description:
            'Plany geodezyjne w teczce KLIN wskazują kryptę pod ołtarzem w Prabutach jako cel finałowej operacji SB.',
        },
        {
          fromId: 'node-msw-warszawa',
          toId: 'node-elblag-klasztor',
          clueId: 'clue-sb-wiretap-elblag-log',
          description:
            'Taśma szpulowa ZK-140 z podsłuchu kieruje śledztwo do celi o. Klimuszki w Elblągu.',
        },
        {
          fromId: 'node-msw-warszawa',
          toId: 'node-prabuty-wykopaliska',
          clueId: 'clue-msw-excavation-order',
          description:
            'Szyfrogram o kordonie wokół plebanii kieruje badaczy na teren wykopalisk w Prabutach.',
        },
      ],
      npcs: [
        {
          id: 'npc-helena-krawczyk',
          name: 'Helena Krawczyk',
          description:
            "Ambitna redaktorka programu 'Sygnały Nieznanego' w Telewizji Polskiej, szukająca twardych dowodów na zjawiska psychotroniczne.",
          secret: 'Obawia się zamknięcia redakcji przez cenzurę po interwencji MSW.',
        },
        {
          id: 'npc-jaroslaw-skrzynski',
          name: 'dr Jarosław Skrzyński',
          description:
            'Konsultant naukowy ds. bioelektroniki i psychotroniki, uczestnik Kongresu w Pradze.',
          secret: 'Szantażowany przez SB, potajemnie przekazuje raporty do gabinetu gen. Majewskiego.',
        },
        {
          id: 'npc-klimuszko',
          name: 'Ojciec Andrzej Czesław Klimuszko',
          description:
            'Franciszkanin i zielarz z Elbląga obdarzony darem jasnowidzenia fotometrycznego.',
          secret:
            'W 1945 roku w krypcie w Prabutach spojrzał w głąb szczeliny czwartego wymiaru, co na zawsze połączyło jego umysł z anomalią.',
        },
        {
          id: 'npc-tadeusz-polak',
          name: 'Tadeusz Polak',
          description:
            'Sędziwy kościelny i grabarz z Prabut, świadek powojennych wykopalisk i pożaru kościoła w 1945 roku.',
          secret: 'Przechowuje na strychu plebanii ocalałe fragmenty stopionego bursztynu z krypty.',
        },
        {
          id: 'npc-edward-majewski',
          name: 'Generał Edward Majewski',
          description:
            'Wysoki oficer Departamentu IV MSW nadzorujący tajny program psychotroniczny KLIN.',
          secret:
            'Zamierza osobiście przejąć kontrolę nad szczeliną czasową w Prabutach, by zyskać absolutną przewagę polityczną w bloku wschodnim.',
        },
      ],
      locations: [
        {
          id: 'loc-warszawa-redakcja',
          name: "Redakcja 'Sygnałów Nieznanego' (RTV Warszawa)",
          description: 'Gabinet i montażownia w gmachu TVP przy ul. Woronicza w Warszawie.',
          atmosphere: 'Zadymione korytarze, szum przewijanych taśm i atmosfera cichej inwigilacji.',
        },
        {
          id: 'loc-elblag-klasztor',
          name: 'Klasztor św. Pawła w Elblągu',
          description:
            'Franciszkański klasztor w Elblągu, miejsce pracy zielarskiej i odosobnienia o. Klimuszki.',
          atmosphere:
            'Woń suszonych ziół, chłód kamiennych murów i dyskretna obecność wywiadowców SB.',
        },
        {
          id: 'loc-prabuty-wykopaliska',
          name: 'Stara Plebania i Cmentarz w Prabutach',
          description: 'Powojenne cmentarzysko i opuszczona plebania w Prabutach na Powiślu.',
          atmosphere:
            'Wilgotna mgła, zapach ozonu i świeże ślady opon wojskowych ciężarówek.',
        },
        {
          id: 'loc-msw-warszawa',
          name: 'Gabinet Generała Majewskiego (MSW Warszawa)',
          description:
            'Zabezpieczone skrzydło Departamentu IV MSW przy ul. Rakowieckiej w Warszawie.',
          atmosphere: 'Pancerne szafy, dalekopisy i bezwzględny rygor tajnych służb PRL.',
        },
        {
          id: 'loc-prabuty-krypta',
          name: 'Zawalona Krypta pod Ruinami Kościoła w Prabutach',
          description:
            'Podziemna krypta pod gotyckimi ruinami, epicentrum anomalii czasoprzestrzennej z 1945 roku.',
          atmosphere:
            'Błękitne wyładowania, falujące powietrze i przenikające się szepty z różnych dekad.',
        },
      ],
    },
    externalLinks: [
      { label: 'Wikipedia (Nie do wiary)', url: 'https://pl.wikipedia.org/wiki/Nie_do_wiary' },
      { label: 'Filmweb (Serial Nie do wiary)', url: 'https://www.filmweb.pl/serial/Nie+do+wiary-1996-161405' },
      { label: 'Oficjalny Player.pl TVN', url: 'https://player.pl' },
    ],
    handouts: [
      {
        slug: 'clue-photo-prabuty-1947',
        title: 'Fotografia z ruin w Prabutach (1947)',
        image: '/handouts/cien-nad-prabutami/playtest/photo-1947.png',
        handoutType: 'newspaper',
        nodeId: 'node-warszawa-redakcja',
        textContent: 'Fotografia ruin kościoła w Prabutach z 1947 roku. Na odwrocie adnotacja ojca Klimuszki kieruje do klasztoru w Elblągu i przechowywanych tam dzienników wizji.',
      },
      {
        slug: 'clue-sb-file-klin',
        title: 'Teczka SB: Kryptonim KLIN',
        image: '/handouts/cien-nad-prabutami/playtest/klin-report-v2.png',
        handoutType: 'report',
        nodeId: 'node-msw-warszawa',
        textContent: 'Ściśle tajny meldunek Departamentu IV MSW z 1973 r. dotyczący inwigilacji franciszkanina z Elbląga i anomalnych zjawisk elektromagnetycznych w celi klasztornej.',
      },
      {
        slug: 'clue-herbal-recipe-152',
        title: 'Rękopis receptury ziołowej nr 152',
        image: '/handouts/cien-nad-prabutami/playtest/recipe-152-v2.png',
        handoutType: 'letter',
        nodeId: 'node-elblag-klasztor',
        textContent: 'Zapis proporcji ziół z dopiskiem: „Pić przed snem, by uciszyć głosy czwartego wymiaru”.',
      },
      {
        slug: 'audio-sb-wiretap-elblag',
        title: 'Taśma ZK-140: Meldunek z obserwacji celi w Elblągu',
        image: '/handouts/cien-nad-prabutami/playtest/tape-zk140-v2.png',
        audioUrl: '/audio/handouts/cien-nad-prabutami/tasma-sb-elblag.mp3',
        handoutType: 'report',
        nodeId: 'node-msw-warszawa',
        textContent: 'Meldunek oficera z 12 października 1973 roku. Relacjonuje szept modlitewny, pisk aparatury, skok pola elektromagnetycznego i drżenie szyb. Twierdzi, że słyszał drugi głos; mikrofon go nie zarejestrował. Jest to relacja oficera, a nie dowód obecności drugiej osoby.',
      },
    ],
  },
  {
    id: 'tajemnica-pendnika-lagiewki',
    title: 'Tajemnica Pędnika: Genialny Wynalazca z Kowar',
    era: 'custom',
    eraLabel: 'Lata 90.',
    yearRange: '1995-1999',
    activeSceneYear: 1996,
    startDate: '1996-05-12T14:15',
    initialWeather: 'Ciepłe majowe popołudnie, rześki wiatr z Karkonoszy',
    location: 'Kowary - Karkonosze',
    country: 'Polska',
    tone: 'pulp',
    themes: ['Genialny wynalazek', 'Pochłaniacz kinetyczny', 'Tajne służby AOR', 'Technologia Mi-Go'],
    suggestedOccupations: ['Inżynier', 'Dziennikarz Śledczy', 'Kierowca Testowy', 'Fizyk'],
    suggestedArchetypes: ['scholar', 'investigator', 'action'],
    hook: 'Zderzak Łągiewki eliminuje przeciążenia zderzeń, lecz jego Pędnik łamie prawa fizyki, czerpiąc z zakazanej technologii Mi-Go.',
    description: 'Badacze trafiają na ślad niekonwencjonalnych odkryć Lucjana Łągiewki - konstruktora z Kowar, którego zderzaki kinetyczne i pochłaniacze wirnikowe eliminują przeciążenia podczas kolizji. Kiedy wynalazca tworzy „Pędnik” - silnik łamiący znane prawa fizyki i działający bez przyczepności w próżni - w warsztacie zjawiają się tajni agenci AOR. Odkrycie Łągiewki to próba okiełznania kinetycznej technologii Mi-Go z Gór Szaleństwa.',
    investigatorIntro: 'Badacze trafiają na ślad niekonwencjonalnych odkryć Lucjana Łągiewki - konstruktora z Kowar, którego zderzaki kinetyczne i pochłaniacze wirnikowe eliminują przeciążenia podczas kolizji. Kiedy wynalazca tworzy prototyp silnika działającego bez przyczepności w próżni, w warsztacie zjawiają się tajemniczy agenci, a demonstracje zostają nagle wstrzymane.',
    settingTrivia: [
      'W Polsce lat 90. rodzący się wolny rynek sprzyjał powstawaniu prywatnych warsztatów prototypowych z dala od wielkich instytutów badawczych.',
      'Po transformacji ustrojowej nowo utworzony Urząd Ochrony Państwa (UOP) przejął nadzór nad strategicznymi technologiami podwójnego zastosowania.',
      'Telefonia komórkowa dopiero raczkowała (Centertel), a podstawą łączności w terenie były budki telefoniczne na karty magnetyczne i CB-radio.',
    ],
    estimatedSessions: '2-3',
    playerCount: '1-4',
    difficulty: 'normal',
    source: 'Strefa 11 / Nie do wiary',
    sourceCategory: 'oneshot',
    recommendedForBeginners: true,
    isStrefa11: true,
    documentType: 'scenario',
    isCampaign: false,
    "boundarySummary": "Obszar śledztwa obejmuje kotlinę kowarską, sztolnie pod Przełęczą Okraj oraz instytut badawczy we Wrocławiu. Próba wywiezienia prototypu Pędnika lub dokumentacji poza Sudety skutkuje blokadą dróg przez nieoznakowane radiowozy Urzędu Ochrony Państwa / AOR pod pretekstem skażenia promieniotwórczego z dawnych kopalni uranu oraz natychmiastowym zatrzymaniem pod zarzutem kradzieży technologii obronnej.",
    "truthAnchor": {
      "culprit": "Komórka operacyjna AOR (pułkownik Cezary Karski) oraz rój Mi-Go (Grzyby z Yuggoth) gnieżdżący się w zalanych sztolniach uranowych w Kowarach",
      "motive": "Mi-Go chcą odzyskać swój pozaziemski rezonator wektorowy wykopany w sztolni nr 19, a agenci AOR chcą przejąć Pędnik do budowy napędu grawimetrycznego bez względu na ryzyko implozji czasoprzestrzeni.",
      "murderWeapon": "Odwrócenie wektora bezwładności (ujemna masa bezwładna) zgniatające narządy wewnętrzne bez zewnętrznych śladów uderzenia lub porażenie bio-elektryczną mgłą Mi-Go.",
      "keyAlibi": "Oficjalnie pokaz na stadionie w Kowarach został odwołany z powodu awarii hamulców w testowym Fiacie 126p, podczas gdy nocą sprzęt wywieziono do Sztolni nr 19.",
      "immutableFacts": [
        "Wirnik Łągiewki nie rozprasza energii w ciepło - odgina wektor pędu do czwartego wymiaru geometrycznego za pomocą stopu berylu ze sztolni uranowych.",
        "Główny cylinder wzorcowy został odnaleziony przez Łągiewkę w zasypanym chodniku poniemieckiej kopalni uranu pod Kowarami.",
        "Agenci AOR zawarli tajny układ z prof. Adamskim we Wrocławiu, by przetestować pełną moc Pędnika w podziemnej komorze Sztolni nr 19.",
        "Przekroczenie krytycznych obrotów wirnika o północy 13 maja otworzy tunel rezonansowy dla roju Mi-Go z Karkonoszy."
      ]
    },
    "doomClock": {
      "deadline": {
        "year": 1996,
        "month": 4,
        "day": 13,
        "hour": 23,
        "minute": 59
      },
      "totalHours": 33,
      "stages": [
        {
          "phase": 0,
          "title": "Faza 0: Cisza (Warsztat i próby zderzeniowe)",
          "description": "Badacze swobodnie oglądają modele zderzaków w warsztacie w Kowarach. W eterze CB-radia słychać jedynie krótkie zakłócenia impulsowe."
        },
        {
          "phase": 1,
          "title": "Faza 1: Narastająca presja (Czarne limuzyny AOR)",
          "description": "Pod warsztatem i stadionem pojawiają się ciemne Polonezy Caro i agenci w garniturach. Świadkowie milkną, a telefony stacjonarne zostają odcięte."
        },
        {
          "phase": 2,
          "title": "Faza 2: Bezpośrednie zagrożenie (Anomalie grawimetryczne)",
          "description": "Zbliża się noc testu w sztolniach. Nad Przełęczą Okraj widać fioletowe wyładowania, a drobne przedmioty w Kowarach tracą bezwładność i unoszą się nad stołami."
        },
        {
          "phase": 3,
          "title": "Faza 3: Punkt kulminacyjny (Rozruch Pędnika w Sztolni nr 19)",
          "description": "Prototyp osiąga obroty nadkrytyczne w podziemiach kopalni uranu. Ściany sztolni drżą, a z głębi korytarzy nadciąga bzyczący chór Mi-Go."
        }
      ]
    },
    "secretsPool": [
      {
        "id": "sec-kowary-1",
        "text": "Zegarki kwarcowe i liczniki kilometrów we Fiacie 126p po zderzeniu z betonową barierą cofnęły się dokładnie o 17 minut.",
        "isDiscovered": false
      },
      {
        "id": "sec-kowary-2",
        "text": "Rdzeń prototypowego wirnika odlano z nieludzkiego stopu berylu i telluru wydobytego z zasypanego niemieckiego szybu R-1 w Kowarach.",
        "isDiscovered": false
      },
      {
        "id": "sec-kowary-3",
        "text": "Profesor Henryk Adamski z Wrocławia ukrywa w sejfie fotografię skamieniałego, skorupiakowatego odnóża znalezionego obok cylindra w sztolni.",
        "isDiscovered": false
      },
      {
        "id": "sec-kowary-4",
        "text": "Kierowca testowy Marek Nowak od dnia próby zderzeniowej nie rzuca cienia w świetle lamp halogenowych i słyszy we śnie geometryczne równania.",
        "isDiscovered": false
      },
      {
        "id": "sec-kowary-5",
        "text": "Agenci AOR nie działają z rozkazu rządu RP - ich przełożony płk Karski otrzymuje instrukcje z prywatnego konsorcjum badającego artefakty z Antarktydy.",
        "isDiscovered": false
      },
      {
        "id": "sec-kowary-6",
        "text": "Odwrócenie biegunowości hamulca elektromagnetycznego na wirniku powoduje natychmiastowe wygaszenie pola ujemnej bezwładności.",
        "isDiscovered": false
      }
    ],
    "graph": {
      "nodes": [
        {
          "id": "node-kowary-workshop",
          "name": "Pracownia Wynalazcy w Kowarach",
          "type": "intro",
          "description": "Cichy dom z przylegającym warsztatem u stóp Karkonoszy. Pełno tu modeli, tokarek, kieliszków testowych oraz zapachu oleju maszynowego i ozonu.",
          "atmosphere": "Metaliczny szczęk przekładni, brzęczenie tokarki, zapach smaru i nienaturalny chłód bijący od wirujących dysków.",
          "npcIds": [
            "npc-lucjan-lagiewka"
          ],
          "locationId": "loc-kowary-workshop",
          "leadInClueIds": [],
          "leadOutClueIds": [
            "clue-kinetic-absorber-model",
            "clue-mi-go-cylinder-notes",
            "clue-workshop-aor-subpoena"
          ]
        },
        {
          "id": "node-stadium-kowary",
          "name": "Miejski Stadion w Kowarach (Rampa Zderzeniowa)",
          "type": "location",
          "isBottleneck": true,
          "description": "Opustoszała płyta stadionu z betonowym murem noszącym ślady uderzeń testowych pojazdów bez pasów i hamulców. Pod plandeką stoi nietknięty Fiat 126p.",
          "atmosphere": "Szum wiatru w zardzewiałych trybunach, zapach spalonej gumy i dziwne zakrzywienie światła wokół betonowego bloku.",
          "secret": "W miejscu uderzenia na stadionie grawitacja jest lokalnie osłabiona, a w betonowym murze tkwią mikroskopijne odłamki berylu Mi-Go.",
          "npcIds": [
            "npc-marek-nowak"
          ],
          "locationId": "loc-stadium-kowary",
          "leadInClueIds": [
            "clue-kinetic-absorber-model",
            "clue-wroclaw-crash-telemetry",
            "clue-aor-surveillance-photos-stadium"
          ],
          "leadOutClueIds": [
            "clue-broken-brakes-log",
            "clue-stadium-black-polonez-plate",
            "clue-stadium-radiation-trail"
          ]
        },
        {
          "id": "node-wroclaw-physicist",
          "name": "Gabinet prof. Adamskiego w Instytucie (Wrocław)",
          "type": "location",
          "isBottleneck": true,
          "description": "Zagracony książkami i aparaturą pomiarową gabinet prof. Henryka Adamskiego, który jako jedyny naukowiec potrafi matematycznie opisać anomalię przenoszenia pędu.",
          "atmosphere": "Zielony blask ekranów oscyloskopów, stosy zapisanego papieru milimetrowego i nerwowe stukanie palcami o blat.",
          "secret": "Profesor odkrył, że wzory przekładni Łągiewki odpowiadają nieeuklidesowej geometrii cylindrów Mi-Go.",
          "npcIds": [
            "npc-henryk-adamski"
          ],
          "locationId": "loc-wroclaw-physicist",
          "leadInClueIds": [
            "clue-mi-go-cylinder-notes",
            "clue-broken-brakes-log",
            "clue-aor-wiretap-adamski"
          ],
          "leadOutClueIds": [
            "clue-wroclaw-crash-telemetry",
            "clue-adamski-aor-funding",
            "clue-adamski-mine-spectroscopy"
          ]
        },
        {
          "id": "node-warszawa-aor-office",
          "name": "Tajna Placówka Operacyjna AOR",
          "type": "location",
          "isBottleneck": true,
          "description": "Zabezpieczony obiekt Agencji Ochrony Rządu, gdzie specjaliści wojskowi analizują rysunki Pędnika pod kątem zastosowań w napędach bezwładnościowych.",
          "atmosphere": "Szum serwerów z połowy lat 90., pancerne drzwi, zapach mocnej kawy i zimny profesjonalizm agentów służb specjalnych.",
          "secret": "Pułkownik Karski wydał już rozkaz nocnego przetransportowania pełnoskalowego Pędnika do Sztolni nr 19 w Kowarach.",
          "npcIds": [
            "npc-cezary-karski"
          ],
          "locationId": "loc-warszawa-aor-office",
          "leadInClueIds": [
            "clue-workshop-aor-subpoena",
            "clue-stadium-black-polonez-plate",
            "clue-adamski-aor-funding"
          ],
          "leadOutClueIds": [
            "clue-aor-classified-file",
            "clue-aor-surveillance-photos-stadium",
            "clue-aor-wiretap-adamski"
          ]
        },
        {
          "id": "node-kowary-uranium-mine-climax",
          "name": "Sztolnia Uranowa nr 19 pod Przełęczą Okraj (Finał)",
          "type": "climax",
          "isBottleneck": true,
          "isClimax": true,
          "description": "Zalana, poniemiecka komora wydobywcza w głębi góry. Na stalowym rusztowaniu wiruje pełnoskalowy Pędnik podłączony do agregatów AOR, a wokół niego powietrze gęstnieje w próżnię.",
          "atmosphere": "Niskie, wibrujące buczenie łamiące prawa bezwładności, trzask liczników Geigera, fioletowa luminescencja na ścianach i metaliczny szept Mi-Go w ciemności.",
          "secret": "Zablokowanie przekładni hamulcem zwrotnym lub przebicie cewki berylowej przed osiągnięciem rezonansu zamyka okno wymiarowe i niszczy przekaźnik Mi-Go.",
          "npcIds": [
            "npc-cezary-karski",
            "npc-lucjan-lagiewka"
          ],
          "locationId": "loc-kowary-uranium-mine",
          "leadInClueIds": [
            "clue-stadium-radiation-trail",
            "clue-adamski-mine-spectroscopy",
            "clue-aor-classified-file"
          ],
          "leadOutClueIds": []
        }
      ],
      "clues": [
        {
          "id": "clue-kinetic-absorber-model",
          "name": "Model Wirnika Kinetycznego i dziennik prób",
          "description": "Miniaturowy pochłaniacz wirnikowy z notatką Łągiewki wskazującą Miejski Stadion w Kowarach jako miejsce ukrycia wraku Malucha z głównej próby.",
          "sourceType": "material",
          "clueType": "core",
          "sourceNodeId": "node-kowary-workshop",
          "targetNodeId": "node-stadium-kowary",
          "requiredSkill": "Mechanika"
        },
        {
          "id": "clue-mi-go-cylinder-notes",
          "name": "Szkice Przekładni Kosmicznej i list do Wrocławia",
          "description": "Ręczne rysunki stożkowych zębatek z adnotacją o przesłaniu wyników pomiarów grawimetrycznych do gabinetu prof. Henryka Adamskiego we Wrocławiu.",
          "sourceType": "document",
          "clueType": "core",
          "sourceNodeId": "node-kowary-workshop",
          "targetNodeId": "node-wroclaw-physicist",
          "requiredSkill": "Nauka (Fizyka)"
        },
        {
          "id": "clue-workshop-aor-subpoena",
          "name": "Wezwanie i wizytówka operacyjna AOR",
          "description": "Pozostawiony na stole warsztatowym nakaz konfiskaty patentu z adresem tajnej placówki Agencji Ochrony Rządu oraz śladem popiołu z cygar płk. Karskiego.",
          "sourceType": "document",
          "clueType": "core",
          "sourceNodeId": "node-kowary-workshop",
          "targetNodeId": "node-warszawa-aor-office",
          "requiredSkill": "Spostrzegawczość"
        },
        {
          "id": "clue-broken-brakes-log",
          "name": "Taśma z próby zderzeniowej i zeznanie kierowcy",
          "description": "Nagranie z uderzenia Fiata 126p oraz relacja Marka Nowaka, który widział, jak prof. Adamski zabiera wymontowany czujnik bezwładnościowy do instytutu we Wrocławiu.",
          "sourceType": "testimony",
          "clueType": "core",
          "sourceNodeId": "node-stadium-kowary",
          "targetNodeId": "node-wroclaw-physicist",
          "requiredSkill": "Perswazja"
        },
        {
          "id": "clue-stadium-black-polonez-plate",
          "name": "Zapis numerów rejestracyjnych i odznaka AOR ze stadionu",
          "description": "Zgubiona przy betonowej barierze stadionu przepustka operacyjna AOR oraz relacja dozorcy o czarnych Polonezach odjeżdżających do placówki służb.",
          "sourceType": "material",
          "clueType": "core",
          "sourceNodeId": "node-stadium-kowary",
          "targetNodeId": "node-warszawa-aor-office",
          "requiredSkill": "Tropienie"
        },
        {
          "id": "clue-stadium-radiation-trail",
          "name": "Ślad luminescencyjnego smaru berylowego z rampy",
          "description": "Anomalny, świecący w ultrafiolecie wyciek z rozbitego Malucha na stadionie, którego skład izotopowy wskazuje bezpośrednio na Sztolnię Uranową nr 19 w Kowarach.",
          "sourceType": "anomaly",
          "clueType": "core",
          "sourceNodeId": "node-stadium-kowary",
          "targetNodeId": "node-kowary-uranium-mine-climax",
          "requiredSkill": "Spostrzegawczość"
        },
        {
          "id": "clue-wroclaw-crash-telemetry",
          "name": "Wydruk telemetrii zderzenia ze stadionu w Kowarach",
          "description": "Wykresy oscyloskopowe w gabinecie prof. Adamskiego pokazujące skok ujemnej masy dokładnie w punkcie uderzenia na płycie Miejskiego Stadionu w Kowarach.",
          "sourceType": "anomaly",
          "clueType": "core",
          "sourceNodeId": "node-wroclaw-physicist",
          "targetNodeId": "node-stadium-kowary",
          "requiredSkill": "Elektryka"
        },
        {
          "id": "clue-adamski-aor-funding",
          "name": "Tajna umowa finansowania badań przez AOR",
          "description": "Ukryty w biurku profesora kontrakt z Agencją Ochrony Rządu, zdradzający lokalizację ich tajnej placówki operacyjnej i harmonogram przejęcia Pędnika.",
          "sourceType": "testimony",
          "clueType": "core",
          "sourceNodeId": "node-wroclaw-physicist",
          "targetNodeId": "node-warszawa-aor-office",
          "requiredSkill": "Psychologia"
        },
        {
          "id": "clue-adamski-mine-spectroscopy",
          "name": "Mapa spektrometryczna Sztolni nr 19 w Kowarach",
          "description": "Analiza geologiczna prof. Adamskiego dowodząca, że źródło anomalii kinetycznej i gniazdo Mi-Go znajdują się w zalanej komorze Sztolni Uranowej nr 19.",
          "sourceType": "material",
          "clueType": "core",
          "sourceNodeId": "node-wroclaw-physicist",
          "targetNodeId": "node-kowary-uranium-mine-climax",
          "requiredSkill": "Nauka (Geologia / Fizyka)"
        },
        {
          "id": "clue-aor-classified-file",
          "name": "Poufny Raport AOR: Operacja 'Wektor Zero'",
          "description": "Tajna dyrektywa AOR nakazująca wywiezienie głównego prototypu Pędnika do podziemnej hali w Sztolni Uranowej nr 19 w Kowarach celem nocnego rozruchu.",
          "sourceType": "document",
          "clueType": "core",
          "sourceNodeId": "node-warszawa-aor-office",
          "targetNodeId": "node-kowary-uranium-mine-climax",
          "requiredSkill": "Biblioteka"
        },
        {
          "id": "clue-aor-surveillance-photos-stadium",
          "name": "Fotografie operacyjne AOR z prób na stadionie",
          "description": "Zestaw zdjęć z ukrytej kamery AOR dokumentujących przebieg kolizji na Miejskim Stadionie w Kowarach oraz ukrytą pod rampą aparaturę pomiarową.",
          "sourceType": "document",
          "clueType": "core",
          "sourceNodeId": "node-warszawa-aor-office",
          "targetNodeId": "node-stadium-kowary",
          "requiredSkill": "Spostrzegawczość"
        },
        {
          "id": "clue-aor-wiretap-adamski",
          "name": "Nagranie rozmowy płk. Karskiego z prof. Adamskim",
          "description": "Kaseta z podsłuchu w placówce AOR, na której prof. Adamski z Wrocławia ostrzega przed przebudzeniem istot w sztolni przy pełnych obrotach wirnika.",
          "sourceType": "anomaly",
          "clueType": "core",
          "sourceNodeId": "node-warszawa-aor-office",
          "targetNodeId": "node-wroclaw-physicist",
          "requiredSkill": "Nasłuchiwanie"
        }
      ],
      "connections": [
        {
          "fromId": "node-kowary-workshop",
          "toId": "node-stadium-kowary",
          "clueId": "clue-kinetic-absorber-model",
          "description": "Notatki przy modelu wirnika kierują na płytę Miejskiego Stadionu w Kowarach."
        },
        {
          "fromId": "node-kowary-workshop",
          "toId": "node-wroclaw-physicist",
          "clueId": "clue-mi-go-cylinder-notes",
          "description": "Szkice przekładni i korespondencja naukowa prowadzą do gabinetu prof. Adamskiego we Wrocławiu."
        },
        {
          "fromId": "node-kowary-workshop",
          "toId": "node-warszawa-aor-office",
          "clueId": "clue-workshop-aor-subpoena",
          "description": "Nakaz konfiskaty patentu wskazuje na tajną placówkę operacyjną AOR."
        },
        {
          "fromId": "node-stadium-kowary",
          "toId": "node-wroclaw-physicist",
          "clueId": "clue-broken-brakes-log",
          "description": "Zeznanie kierowcy testowego i zapis zderzenia kierują do prof. Adamskiego badającego czujnik."
        },
        {
          "fromId": "node-stadium-kowary",
          "toId": "node-warszawa-aor-office",
          "clueId": "clue-stadium-black-polonez-plate",
          "description": "Zgubiona przepustka i numery czarnych Polonezów prowadzą do placówki AOR."
        },
        {
          "fromId": "node-stadium-kowary",
          "toId": "node-kowary-uranium-mine-climax",
          "clueId": "clue-stadium-radiation-trail",
          "description": "Ślad luminescencyjnego smaru berylowego prowadzi prosto do Sztolni Uranowej nr 19."
        },
        {
          "fromId": "node-wroclaw-physicist",
          "toId": "node-stadium-kowary",
          "clueId": "clue-wroclaw-crash-telemetry",
          "description": "Wydruk telemetrii ujemnej masy wskazuje dokładny punkt uderzenia na stadionie w Kowarach."
        },
        {
          "fromId": "node-wroclaw-physicist",
          "toId": "node-warszawa-aor-office",
          "clueId": "clue-adamski-aor-funding",
          "description": "Kontrakt w sejfie profesora ujawnia współpracę i adres placówki AOR."
        },
        {
          "fromId": "node-wroclaw-physicist",
          "toId": "node-kowary-uranium-mine-climax",
          "clueId": "clue-adamski-mine-spectroscopy",
          "description": "Mapa spektrometryczna prof. Adamskiego wskazuje Sztolnię nr 19 jako źródło berylu i gniazdo Mi-Go."
        },
        {
          "fromId": "node-warszawa-aor-office",
          "toId": "node-kowary-uranium-mine-climax",
          "clueId": "clue-aor-classified-file",
          "description": "Raport 'Wektor Zero' ujawnia rozkaz nocnego rozruchu Pędnika w Sztolni Uranowej nr 19."
        },
        {
          "fromId": "node-warszawa-aor-office",
          "toId": "node-stadium-kowary",
          "clueId": "clue-aor-surveillance-photos-stadium",
          "description": "Zdjęcia operacyjne AOR pokazują ukrytą aparaturę pod rampą na stadionie w Kowarach."
        },
        {
          "fromId": "node-warszawa-aor-office",
          "toId": "node-wroclaw-physicist",
          "clueId": "clue-aor-wiretap-adamski",
          "description": "Taśma z podsłuchu rozmowy płk. Karskiego kieruje do gabinetu prof. Adamskiego we Wrocławiu."
        }
      ],
      "npcs": [
        {
          "id": "npc-lucjan-lagiewka",
          "name": "Lucjan Łągiewka",
          "description": "Genialny konstruktor-samouk z Kowar, twórca zderzaka kinetycznego i prototypu Pędnika.",
          "secret": "Wzorował geometrię wirnika na obcym cylindrze znalezionym w zawalonej sztolni uranowej."
        },
        {
          "id": "npc-marek-nowak",
          "name": "Marek Nowak (Kierowca Testowy)",
          "description": "Śmiałek testujący Fiata 126p podczas czołowych zderzeń z betonową barierą bez pasów bezpieczeństwa.",
          "secret": "Od czasu zderzenia przy pełnej mocy wirnika cierpi na zaburzenia percepcji czasu i słyszy bzyczenie z gór."
        },
        {
          "id": "npc-henryk-adamski",
          "name": "prof. Henryk Adamski",
          "description": "Fizyk teoretyczny z Wrocławia badający anomalie bezwładnościowe i nieliniowy transfer pędu.",
          "secret": "Przyjął tajny grant od AOR w zamian za dostęp do próbek pozaziemskiego metalu ze Sztolni nr 19."
        },
        {
          "id": "npc-cezary-karski",
          "name": "płk Cezary Karski (AOR)",
          "description": "Dowódca specgrupy Agencji Ochrony Rządu nadzorujący operację przejęcia technologii Łągiewki.",
          "secret": "Dąży do uruchomienia Pędnika na pełnej mocy w sztolni bez względu na ostrzeżenia o katastrofie wymiarowej."
        }
      ],
      "locations": [
        {
          "id": "loc-kowary-workshop",
          "name": "Pracownia Wynalazcy w Kowarach",
          "description": "Przydomowy warsztat mechaniczny u podnóża Karkonoszy pełen tokarek i prototypów.",
          "atmosphere": "Zapach smaru, metaliczny szum wirników i podejrzane spojrzenia zza firanek."
        },
        {
          "id": "loc-stadium-kowary",
          "name": "Miejski Stadion w Kowarach",
          "description": "Płyta stadionu z rampą najazdową i betonowym blokiem do prób zderzeniowych.",
          "atmosphere": "Puste trybuny, górski wiatr i ślady opon prowadzące wprost w lity beton."
        },
        {
          "id": "loc-wroclaw-physicist",
          "name": "Gabinet prof. Adamskiego (Wrocław)",
          "description": "Pracownia fizyki teoretycznej i laboratorium pomiarowe we Wrocławiu.",
          "atmosphere": "Szum aparatury, stosy wyliczeń tensorowych i nerwowa atmosfera tajemnicy państwowej."
        },
        {
          "id": "loc-warszawa-aor-office",
          "name": "Tajna Placówka Operacyjna AOR",
          "description": "Zakonspirowany ośrodek Agencji Ochrony Rządu analizujący technologie podwójnego zastosowania.",
          "atmosphere": "Stalowe szafy, magnetofony szpulowe i bezwzględny nadzór służb specjalnych lat 90."
        },
        {
          "id": "loc-kowary-uranium-mine",
          "name": "Sztolnia Uranowa nr 19 w Kowarach",
          "description": "Opuszczona poniemiecka kopalnia uranu pod Przełęczą Okraj, miejsce finałowego testu Pędnika.",
          "atmosphere": "Kapiąca woda, promieniowanie tła, fioletowe wyładowania i obecność istot spoza Ziemi."
        }
      ]
    },
    "handouts": [
      {
        "slug": "clue-mi-go-cylinder-notes",
        "title": "Kalka techniczna: Nieliniowe przekładnie wirnika",
        "image": "/handouts/tajemnica-pendnika-lagiewki/clue-mi-go-cylinder-notes.webp",
        "handoutType": "report",
        "nodeId": "node-kowary-workshop",
        "textContent": "Rysunek techniczny mechanizmu pędnika ze schematem rotacji mas, w którym linie zbiegają się w punkcie poza trójwymiarową przestrzenią."
      },
      {
        "slug": "clue-aor-classified-file",
        "title": "Raport AOR: Poufna notatka wstrzymania pokazów",
        "image": "/handouts/tajemnica-pendnika-lagiewki/clue-aor-classified-file.webp",
        "handoutType": "report",
        "nodeId": "node-warszawa-aor-office",
        "textContent": "Poufne pismo Urzędu Ochrony Państwa / AOR nakazujące natychmiastowe zamrożenie publicznych testów zderzeniowych Fiata 126p w Kowarach."
      },
      {
        "slug": "audio-broken-brakes-log",
        "title": "Nagranie magnetofonowe: Próba zderzeniowa Kowary 1996",
        "image": "/handouts/tajemnica-pendnika-lagiewki/clue-aor-classified-file.webp",
        "audioUrl": "/audio/handouts/tajemnica-pendnika-lagiewki/proba-zderzeniowa-kowary.mp3",
        "handoutType": "report",
        "nodeId": "node-stadium-kowary",
        "textContent": "Dźwięk silnika Malucha rozpędzanego na rampie, potężne uderzenie w barierę i nienaturalny, głuchy rezonans wirnika pochłaniającego wektor pędu."
      }
    ]
  },
  {
    id: 'tajemnica-dzieci-z-traszyna',
    title: 'Tajemnica Dzieci z Traszyna: Klucz i Odwrócony Krzyż',
    era: 'custom',
    eraLabel: 'Lata 90. (Y2K)',
    yearRange: '1983-1999',
    activeSceneYear: 1999,
    startDate: '1999-08-28T21:00',
    initialWeather: 'Duszna, parna noc zwiastująca gwałtowną burzę',
    location: 'Traszyn k. Lublina',
    country: 'Polska',
    tone: 'purist',
    themes: ['Seans z książką i kluczem', 'Nocne paraliże', 'Poltergeist', 'Egzorcyzmy'],
    suggestedOccupations: ['Psycholog', 'Etnograf', 'Radiesteta / Bioenergoterapeuta', 'Leśnik'],
    suggestedArchetypes: ['mystic', 'healer', 'investigator'],
    hook: 'W 1983 roku troje dzieci w stodole wywołało ducha. Po 16 latach byt powraca z uderzeniem pioruna i wypalonym odwróconym krzyżem.',
    description: 'Badacze zostają wezwani przez lokalnego parapsychologa i bioenergoterapeutę Tomasza Nowickiego do odciętej od świata wsi Traszyn na Lubelszczyźnie. W 1983 roku troje dzieci przeprowadziło w starej stodole seans z książką i kluczem. Po 16 latach nieznany byt powraca, wywołując nocne paraliże, manifestacje zjaw i zjawisko suchego odwróconego krzyża na deskach stodoły po uderzeniu pioruna. Badacze stają w obliczu pradawnego bytu z krain podziemi.',
    investigatorIntro: 'Badacze zostają wezwani przez bioenergoterapeutę Tomasza Nowickiego do odciętej od świata wsi Traszyn na Lubelszczyźnie. W 1983 roku troje dzieci przeprowadziło w starej stodole seans z książką i kluczem. Po 16 latach nieznany byt powraca, wywołując nocne paraliże, manifestacje zjaw i zjawisko suchego odwróconego krzyża na deskach stodoły po uderzeniu pioruna.',
    settingTrivia: [
      'Na polskiej wsi końca lat 90. lokalne wierzenia, relacje z proboszczem i wiejska solidarność były silniejsze niż zaufanie do instytucji państwowych.',
      'Zjawiska paranormalne w latach 90. badały nieliczne kluby ufologiczne i radiesteci, cieszący się wówczas dużą uwagą mediów i prasy tematycznej.',
    ],
    estimatedSessions: '2',
    playerCount: '1-4',
    difficulty: 'normal',
    source: 'Strefa 11 / Nie do wiary',
    sourceCategory: 'oneshot',
    recommendedForBeginners: false,
    isStrefa11: true,
    documentType: 'scenario',
    isCampaign: false,
    "boundarySummary": "Wieś Traszyn zostaje odcięta od świata przez gwałtowną nawałnicę z piorunami kulistymi, która zrywa linię telefoniczną i podmywa jedyny drewniany most nad wezbraną rzeką Wieprz. Próba przedarcia się samochodem przez zalane groble przed świtem grozi utonięciem w torfowisku lub uderzeniem pioruna przyciąganego przez anomalię magnetyczną wokół gospodarstwa Dąbrowskich.",
    "truthAnchor": {
      "culprit": "Pradawny byt podziemny z krainy K'n-yan / Noth-Yiddith (Cień spod Powały), wybudzony dziecięcym seansem w 1983 r. i podtrzymywany obsesyjnymi rytuałami Tomasza Nowickiego",
      "motive": "Byt żywi się terrorem nocnych paraliży dorosłego już rodzeństwa Dąbrowskich, dążąc do pełnej materializacji poprzez powtórzony o północy seans z kluczem i modlitewnikiem.",
      "murderWeapon": "Zatrzymanie akcji serca przez paraliż senny i lodowatą asfiksję cieniową (duszenie czarną mazią skapującą z belek stodoły).",
      "keyAlibi": "Bioenergoterapeuta Tomasz Nowicki twierdzi, że chce oczyścić dom egzorcyzmem o północy, lecz w rzeczywistości jego seans odwoławczy otworzy bytowi ostatnią bramę.",
      "immutableFacts": [
        "Seans trójki dzieci z 1983 roku nie przywołał ducha historycznego dyktatora - mosiężny klucz zadziałał jak antena rezonansowa dla bytu śpiącego w kurhanie pod stodołą.",
        "Odwrócony krzyż wypalony piorunem na ścianie stodoły to pęknięcie starej pieczęci ochronnej wzniesionej przez XIX-wiecznego szeptuna.",
        "Najmłodszy uczestnik seansu z 1983 r. (7-letni Szymek) stracił głos po tym, jak byt spojrzał na niego spod powały.",
        "Aby odesłać byt, należy przed północą odwrócić obrót klucza w modlitewniku nad fundamentem stodoły i zamknąć krąg solą oraz żelazem, zamiast powtarzać inkantację Nowickiego."
      ]
    },
    "doomClock": {
      "deadline": {
        "year": 1999,
        "month": 7,
        "day": 29,
        "hour": 0,
        "minute": 0
      },
      "totalHours": 3,
      "stages": [
        {
          "phase": 0,
          "title": "Faza 0: Cisza przed burzą (Przyjazd do Traszyna)",
          "description": "Duszny wieczór. W domu Dąbrowskich słychać pojedyncze głuche stuki w ściany, a zwierzęta gospodarskie wyrywają się z obory."
        },
        {
          "phase": 1,
          "title": "Faza 1: Narastająca presja (Nawałnica i paraliże)",
          "description": "Nad wsią pęka niebo. Pioruny biją w pola, gaśnie prąd, a u Adama Dąbrowskiego zaczyna się atak paraliżu sennego i spadek temperatury."
        },
        {
          "phase": 2,
          "title": "Faza 2: Bezpośrednie zagrożenie (Krwawy pot na deskach)",
          "description": "Odwrócony krzyż na ścianie stodoły staje się parząco gorący mimo ulewy. Meble w domu przesuwają się same, a z powały kapie czarna maź."
        },
        {
          "phase": 3,
          "title": "Faza 3: Punkt kulminacyjny (Seans Północy w Stodole)",
          "description": "Wybija północ. Mosiężny klucz w modlitewniku zaczyna wirować z piskiem, a pod dachem stodoły formuje się wieloręki cień z podziemi."
        }
      ]
    },
    "secretsPool": [
      {
        "id": "sec-traszyn-1",
        "text": "Mosiężny klucz użyty przez dzieci w 1983 roku został wykopany ze starego kurhanu pod fundamentem stodoły i nosi wyryte od wewnątrz znaki pisma klinowego.",
        "isDiscovered": false
      },
      {
        "id": "sec-traszyn-2",
        "text": "Drewno w obrysie odwróconego krzyża na stodole wykazuje ujemną wilgotność i odpycha krople deszczu nawet podczas oberwania chmury.",
        "isDiscovered": false
      },
      {
        "id": "sec-traszyn-3",
        "text": "Na kasecie Stilon C-60 z 1983 roku, tuż po szlochu siedmioletniego dziecka, słychać niski głos wymawiający po łacinie imiona wszystkich trzech uczestników seansu.",
        "isDiscovered": false
      },
      {
        "id": "sec-traszyn-4",
        "text": "Tomasz Nowicki podczas wcześniejszego próbnego seansu doprowadził do eksplozji wszystkich żarówek i poparzenia dłoni Krzysztofa Dąbrowskiego.",
        "isDiscovered": false
      },
      {
        "id": "sec-traszyn-5",
        "text": "W archiwum parafialnym w Traszynie widnieje wpis z 1894 roku o obłożeniu klątwą pola pod stodołą po odkryciu tam bezgłowego posągu z czarnego bazaltu.",
        "isDiscovered": false
      },
      {
        "id": "sec-traszyn-6",
        "text": "Przebicie modlitewnika żelaznym gwoździem kowalskim podczas wirowania klucza natychmiast przerywa więź bytu ze światem materialnym.",
        "isDiscovered": false
      }
    ],
    "graph": {
      "nodes": [
        {
          "id": "node-traszyn-house",
          "name": "Dom Rodziny Dąbrowskich w Traszynie",
          "type": "intro",
          "description": "Stary, murowany dom na skraju wsi. Od kilku nocy panuje tu obezwładniająca psychoza strachu, słychać samoistne stukanie w ściany, a meble i kołdry przesuwają się bez niczyjego udziału.",
          "atmosphere": "Migoczące światło świec, zapach waleriany i mokrego psa, głuche uderzenia w sufit i przerażone szepty domowników.",
          "npcIds": [
            "npc-adam-dabrowski",
            "npc-teresa-dabrowska",
            "npc-katarzyna-dabrowska"
          ],
          "locationId": "loc-traszyn-house",
          "leadInClueIds": [],
          "leadOutClueIds": [
            "clue-key-book-apparatus",
            "clue-paralysis-log",
            "clue-mother-testimony-parish"
          ]
        },
        {
          "id": "node-traszyn-barn",
          "name": "Stara Stodoła z Odwróconym Krzyżem",
          "type": "location",
          "isBottleneck": true,
          "description": "Drewniana stodoła 50 metrów od domu, miejsce dziecięcego seansu z 1983 r. Zewnętrzna ściana nosi ślad uderzenia pioruna w kształcie suchego, gorącego odwróconego krzyża.",
          "atmosphere": "Świst burzowego wiatru w szparach desek, duszący odór siarki i ozonu, nagłe spadki temperatury poniżej zera.",
          "secret": "Pod ubitą gliną klepiska znajduje się zapadnięty strop komory kurhanowej, z której sączy się czarny szlam.",
          "npcIds": [
            "npc-krzysztof-dabrowski"
          ],
          "locationId": "loc-traszyn-barn",
          "leadInClueIds": [
            "clue-key-book-apparatus",
            "clue-stilon-c60-child-tape",
            "clue-parish-confession-1983"
          ],
          "leadOutClueIds": [
            "clue-dry-cross-barn",
            "clue-barn-chalk-pendulum",
            "clue-krzysztof-testimony-priest"
          ]
        },
        {
          "id": "node-exorcist-shrine",
          "name": "Pracownia Radiestezyjna Tomasza Nowickiego",
          "type": "location",
          "isBottleneck": true,
          "description": "Polowa pracownia i gabinet egzorcysty-ezoteryka wypełniony wahadełkami, wykresami biopola, magnetofonem kasetowym i relikwiarzami.",
          "atmosphere": "Dym z kadzideł szałwiowych, szum przewijanej taśmy Stilon C-60 i gorączkowy fanatyzm badacza nieznanego.",
          "secret": "Nowicki nie rozumie, że jego rytuał powtórzenia seansu o północy zadziała jak zaproszenie dla bytu z Noth-Yiddith.",
          "npcIds": [
            "npc-tomasz-nowicki"
          ],
          "locationId": "loc-exorcist-shrine",
          "leadInClueIds": [
            "clue-paralysis-log",
            "clue-barn-chalk-pendulum",
            "clue-parish-baptism-anomaly"
          ],
          "leadOutClueIds": [
            "clue-exorcist-notes",
            "clue-stilon-c60-child-tape",
            "clue-nowicki-stolen-chronicle"
          ]
        },
        {
          "id": "node-traszyn-parish-archive",
          "name": "Stara Plebania i Archiwum Parafialne w Traszynie",
          "type": "location",
          "isBottleneck": true,
          "description": "Wilgotna kancelaria parafialna przy wiejskim kościele, przechowująca księgi z XIX wieku oraz żelazne wota ochronne używane przez dawnych szeptunów.",
          "atmosphere": "Zapach butwiejącego papieru i wosku pszczelego, dudnienie grzmotów za witrażem i skrzypienie starych szaf.",
          "secret": "W dębowej skrzyni spoczywa wykuty z meteorytowego żelaza gwóźdź, którym w 1894 roku przyszpilono pierwszy rytuał na tym polu.",
          "npcIds": [
            "npc-zofia-sadowska"
          ],
          "locationId": "loc-traszyn-parish",
          "leadInClueIds": [
            "clue-mother-testimony-parish",
            "clue-krzysztof-testimony-priest",
            "clue-nowicki-stolen-chronicle"
          ],
          "leadOutClueIds": [
            "clue-parish-1894-seal-map",
            "clue-parish-confession-1983",
            "clue-parish-baptism-anomaly"
          ]
        },
        {
          "id": "node-traszyn-cellar-climax",
          "name": "Rozpadlina pod Klepiskiem Stodoły - Ołtarz Cienia (Finał)",
          "type": "climax",
          "isBottleneck": true,
          "isClimax": true,
          "description": "Podziemna jama pod stodołą odsłonięta po uderzeniu pioruna. Pośrodku tkwi bazaltowy monolit ociekający czarną mazią, a pod powałą zbiera się wieloręki kształt z żywego mroku.",
          "atmosphere": "Lodowate powietrze odbierające dech, samoczynnie wirujący klucz, chóralny szept spod ziemi i błyski piorunów wpadające przez szczeliny.",
          "secret": "Przebicie modlitewnika żelaznym gwoździem i odwrócenie klucza w lewo przed końcem bicia zegara o północy zapada jamę i więzi byt pod ziemią.",
          "npcIds": [
            "npc-tomasz-nowicki",
            "npc-adam-dabrowski"
          ],
          "locationId": "loc-traszyn-cellar",
          "leadInClueIds": [
            "clue-dry-cross-barn",
            "clue-exorcist-notes",
            "clue-parish-1894-seal-map"
          ],
          "leadOutClueIds": []
        }
      ],
      "clues": [
        {
          "id": "clue-key-book-apparatus",
          "name": "Modlitewnik spięty mosiężnym kluczem",
          "description": "Stara książeczka do nabożeństwa przewiązana sznurkiem z ciężkim kluczem. Ślady wypaleń na stronach prowadzą bezpośrednio do miejsca seansu w Starej Stodole.",
          "sourceType": "material",
          "clueType": "core",
          "sourceNodeId": "node-traszyn-house",
          "targetNodeId": "node-traszyn-barn",
          "requiredSkill": "Okultyzm"
        },
        {
          "id": "clue-paralysis-log",
          "name": "Notatki z Nocnych Paraliży Adama Dąbrowskiego",
          "description": "Zapiski najstarszego brata opisujące wizje o 1:00 w nocy oraz adres pracowni bioenergoterapeuty Tomasza Nowickiego, któremu przekazano kasetę z 1983 roku.",
          "sourceType": "document",
          "clueType": "core",
          "sourceNodeId": "node-traszyn-house",
          "targetNodeId": "node-exorcist-shrine",
          "requiredSkill": "Psychologia"
        },
        {
          "id": "clue-mother-testimony-parish",
          "name": "Wyznanie matki Teresy Dąbrowskiej o klątwie gruntu",
          "description": "Przerażona matka wyznaje, że po tragedii z 1983 r. stary proboszcz sprawdzał XIX-wieczne księgi na plebanii w Traszynie i kazał nigdy nie kopać pod klepiskiem stodoły.",
          "sourceType": "testimony",
          "clueType": "core",
          "sourceNodeId": "node-traszyn-house",
          "targetNodeId": "node-traszyn-parish-archive",
          "requiredSkill": "Perswazja"
        },
        {
          "id": "clue-dry-cross-barn",
          "name": "Wypalony Odwrócony Krzyż na Ścianie Stodoły",
          "description": "Anomalny, gorący w dotyku ślad po uderzeniu pioruna na deskach stodoły. Linie zwęglenia zbiegają się dokładnie nad zapadniętym klepiskiem i wejściem do podziemnej jamy.",
          "sourceType": "anomaly",
          "clueType": "core",
          "sourceNodeId": "node-traszyn-barn",
          "targetNodeId": "node-traszyn-cellar-climax",
          "requiredSkill": "Spostrzegawczość"
        },
        {
          "id": "clue-barn-chalk-pendulum",
          "name": "Porzucone wahadełko radiestezyjne i szkic Nowickiego",
          "description": "Znalezione w sianie pęknięte wahadełko z mosiądzu oraz kartka z adresem pracowni egzorcysty Tomasza Nowickiego i wyliczeniem godziny zero.",
          "sourceType": "material",
          "clueType": "core",
          "sourceNodeId": "node-traszyn-barn",
          "targetNodeId": "node-exorcist-shrine",
          "requiredSkill": "Spostrzegawczość"
        },
        {
          "id": "clue-krzysztof-testimony-priest",
          "name": "Relacja brata Krzysztofa o żelaznym gwoździu z plebanii",
          "description": "Krzysztof Dąbrowski zeznaje, że w 1983 roku widział pod podwaliną stodoły starą kościelną pieczęć z archiwum parafialnego w Traszynie.",
          "sourceType": "material",
          "clueType": "core",
          "sourceNodeId": "node-traszyn-barn",
          "targetNodeId": "node-traszyn-parish-archive",
          "requiredSkill": "Urok Osobisty"
        },
        {
          "id": "clue-exorcist-notes",
          "name": "Dziennik Egzorcysty Tomasza Nowickiego",
          "description": "Notatnik opisujący dwa węzły ujemnej energii przecinające się bezpośrednio w zasypanym kurhanie pod klepiskiem stodoły w Traszynie.",
          "sourceType": "testimony",
          "clueType": "core",
          "sourceNodeId": "node-exorcist-shrine",
          "targetNodeId": "node-traszyn-cellar-climax",
          "requiredSkill": "Okultyzm"
        },
        {
          "id": "clue-stilon-c60-child-tape",
          "name": "Kaseta Stilon C-60 z wywiadem z dzieckiem (1983)",
          "description": "Przechowywane w pracowni Nowickiego nagranie 7-letniego chłopca opisującego czarną maź kapiącą z belek w Starej Stodole w Traszynie.",
          "sourceType": "anomaly",
          "clueType": "core",
          "sourceNodeId": "node-exorcist-shrine",
          "targetNodeId": "node-traszyn-barn",
          "requiredSkill": "Nasłuchiwanie"
        },
        {
          "id": "clue-nowicki-stolen-chronicle",
          "name": "Wypis z kroniki parafialnej z 1894 roku",
          "description": "Kserokopia z biurka Nowickiego odsyłająca do pełnych ksiąg metrykalnych i relikwiarza z żelaznymi gwoździami na starej plebanii w Traszynie.",
          "sourceType": "document",
          "clueType": "core",
          "sourceNodeId": "node-exorcist-shrine",
          "targetNodeId": "node-traszyn-parish-archive",
          "requiredSkill": "Biblioteka"
        },
        {
          "id": "clue-parish-1894-seal-map",
          "name": "Mapa kurhanu i rytuału zamknięcia z 1894 r.",
          "description": "Rękopis z archiwum parafialnego pokazujący podziemną komorę pod klepiskiem stodoły Dąbrowskich oraz sposób przebicia księgi żelazem.",
          "sourceType": "document",
          "clueType": "core",
          "sourceNodeId": "node-traszyn-parish-archive",
          "targetNodeId": "node-traszyn-cellar-climax",
          "requiredSkill": "Historia"
        },
        {
          "id": "clue-parish-confession-1983",
          "name": "Zapiski proboszcza po nocnym seansie dzieci w 1983 r.",
          "description": "Relacja duchownego opisująca stan dzieci znalezionych o świcie pod ścianą Starej Stodoły z wypalonym znakiem krzyża.",
          "sourceType": "testimony",
          "clueType": "core",
          "sourceNodeId": "node-traszyn-parish-archive",
          "targetNodeId": "node-traszyn-barn",
          "requiredSkill": "Biblioteka"
        },
        {
          "id": "clue-parish-baptism-anomaly",
          "name": "Skreślony akt chrztu i ostrzeżenie przed Nowickim",
          "description": "List biskupi na plebanii ostrzegający przed praktykami radiestezyjnymi w pracowni Tomasza Nowickiego, które budzą byty ziemi.",
          "sourceType": "anomaly",
          "clueType": "core",
          "sourceNodeId": "node-traszyn-parish-archive",
          "targetNodeId": "node-exorcist-shrine",
          "requiredSkill": "Prawo"
        }
      ],
      "connections": [
        {
          "fromId": "node-traszyn-house",
          "toId": "node-traszyn-barn",
          "clueId": "clue-key-book-apparatus",
          "description": "Modlitewnik spięty kluczem prowadzi badaczy bezpośrednio do miejsca seansu w Starej Stodole."
        },
        {
          "fromId": "node-traszyn-house",
          "toId": "node-exorcist-shrine",
          "clueId": "clue-paralysis-log",
          "description": "Notatki Adama Dąbrowskiego odsyłają do pracowni bioenergoterapeuty Tomasza Nowickiego."
        },
        {
          "fromId": "node-traszyn-house",
          "toId": "node-traszyn-parish-archive",
          "clueId": "clue-mother-testimony-parish",
          "description": "Wyznanie matki o klątwie gruntu kieruje do XIX-wiecznych ksiąg w archiwum parafialnym."
        },
        {
          "fromId": "node-traszyn-barn",
          "toId": "node-traszyn-cellar-climax",
          "clueId": "clue-dry-cross-barn",
          "description": "Linie wypalonego odwróconego krzyża wskazują podziemną jamę pod klepiskiem stodoły."
        },
        {
          "fromId": "node-traszyn-barn",
          "toId": "node-exorcist-shrine",
          "clueId": "clue-barn-chalk-pendulum",
          "description": "Porzucone w sianie wahadełko i szkic prowadzą do pracowni Tomasza Nowickiego."
        },
        {
          "fromId": "node-traszyn-barn",
          "toId": "node-traszyn-parish-archive",
          "clueId": "clue-krzysztof-testimony-priest",
          "description": "Relacja Krzysztofa o starej pieczęci pod podwaliną kieruje na plebanię w Traszynie."
        },
        {
          "fromId": "node-exorcist-shrine",
          "toId": "node-traszyn-cellar-climax",
          "clueId": "clue-exorcist-notes",
          "description": "Wykresy radiestezyjne w dzienniku Nowickiego wskazują kurhan pod klepiskiem stodoły."
        },
        {
          "fromId": "node-exorcist-shrine",
          "toId": "node-traszyn-barn",
          "clueId": "clue-stilon-c60-child-tape",
          "description": "Nagranie przerażonego dziecka na kasecie Stilon C-60 kieruje pod powałę Starej Stodoły."
        },
        {
          "fromId": "node-exorcist-shrine",
          "toId": "node-traszyn-parish-archive",
          "clueId": "clue-nowicki-stolen-chronicle",
          "description": "Wypis z kroniki z 1894 r. prowadzi do archiwum parafialnego w Traszynie."
        },
        {
          "fromId": "node-traszyn-parish-archive",
          "toId": "node-traszyn-cellar-climax",
          "clueId": "clue-parish-1894-seal-map",
          "description": "Mapa z 1894 roku ujawnia komorę pod stodołą i sposób zamknięcia bytu żelazem."
        },
        {
          "fromId": "node-traszyn-parish-archive",
          "toId": "node-traszyn-barn",
          "clueId": "clue-parish-confession-1983",
          "description": "Zapiski proboszcza z 1983 r. opisują znalezienie dzieci pod ścianą stodoły."
        },
        {
          "fromId": "node-traszyn-parish-archive",
          "toId": "node-exorcist-shrine",
          "clueId": "clue-parish-baptism-anomaly",
          "description": "Ostrzeżenie przed radiestezją kieruje badaczy do pracowni Tomasza Nowickiego."
        }
      ],
      "npcs": [
        {
          "id": "npc-adam-dabrowski",
          "name": "Adam Dąbrowski",
          "description": "Najstarszy z rodzeństwa biorącego udział w seansie w 1983 r., nękany przez nocne paraliże i lodowaty oddech.",
          "secret": "W 1983 roku to on zadał kluczowi pytanie o imię ducha spoczywającego pod ziemią."
        },
        {
          "id": "npc-teresa-dabrowska",
          "name": "Teresa Dąbrowska (Matka)",
          "description": "Gospodyni z Traszyna wyczerpana nocnymi manifestacjami w domu.",
          "secret": "Ukryła modlitewnik z kluczem w bieliźniarce, bojąc się gniewu księdza."
        },
        {
          "id": "npc-katarzyna-dabrowska",
          "name": "Katarzyna Dąbrowska (Siostra)",
          "description": "Siostra Adama, która podczas seansu w 1983 r. podtrzymywała drugi koniec mosiężnego klucza.",
          "secret": "Na jej nadgarstku po każdym uderzeniu pioruna pojawia się sine znamię w kształcie klucza."
        },
        {
          "id": "npc-krzysztof-dabrowski",
          "name": "Krzysztof Dąbrowski (Brat)",
          "description": "Młodszy brat pilnujący obejścia i stodoły przed obcymi.",
          "secret": "Pomagał Nowickiemu w nieudanym seansie próbnym, podczas którego poparzył dłonie."
        },
        {
          "id": "npc-tomasz-nowicki",
          "name": "Tomasz Nowicki (Egzorcysta)",
          "description": "Lubelski bioenergoterapeuta i radiesteta zafascynowany anomalią w Traszynie.",
          "secret": "Chce za wszelką cenę nagrać manifestację bytu o północy, nieświadomie otwierając mu przejście."
        },
        {
          "id": "npc-zofia-sadowska",
          "name": "Zofia Sadowska (Kronikarka / Bibliotekarka)",
          "description": "Opiekunka lokalnego archiwum i znawczyni ludowych obrzędów ochronnych Lubelszczyzny.",
          "secret": "Zna starą formułę szeptunów wymagającą przebicia księgi kutym żelazem."
        }
      ],
      "locations": [
        {
          "id": "loc-traszyn-house",
          "name": "Dom Rodziny Dąbrowskich",
          "description": "Murowany dom gospodarski w Traszynie objęty zjawiskami poltergeista.",
          "atmosphere": "Drżące szyby, głuche stuki w ścianach i paraliżujący chłód o północy."
        },
        {
          "id": "loc-traszyn-barn",
          "name": "Stara Stodoła w Traszynie",
          "description": "Drewniana stodoła z wypalonym piorunem odwróconym krzyżem na deskach.",
          "atmosphere": "Zapach ozonu i siarki, skrzypienie belek i czarna maź skapująca ze stropu."
        },
        {
          "id": "loc-exorcist-shrine",
          "name": "Pracownia Tomasza Nowickiego",
          "description": "Gabinet radiestety pełen wahadełek, map energetycznych i taśm magnetofonowych.",
          "atmosphere": "Dym z ziół, szum kasety Stilon C-60 i napięcie przed północnym rytuałem."
        },
        {
          "id": "loc-traszyn-parish",
          "name": "Archiwum Parafialne w Traszynie",
          "description": "Stara kancelaria przy kościele skrywająca kroniki z XIX wieku.",
          "atmosphere": "Półmrok, zapach starych ksiąg i dudniąca za oknem burza."
        },
        {
          "id": "loc-traszyn-cellar",
          "name": "Rozpadlina pod Klepiskiem Stodoły",
          "description": "Podziemna jama kurhanowa pod stodołą z bazaltowym monolitem.",
          "atmosphere": "Gęsty mrok, ujemna temperatura i obecność pradawnego bytu z podziemi."
        }
      ]
    },
    "handouts": [
      {
        "slug": "clue-dry-cross-barn",
        "title": "Polaroid: Odwrócony krzyż na ścianie stodoły (1983)",
        "image": "/handouts/tajemnica-dzieci-z-traszyna/clue-dry-cross-barn.webp",
        "handoutType": "newspaper",
        "nodeId": "node-traszyn-barn",
        "textContent": "Wyblakła fotografia polaroidowa z nadpalonym od pioruna zarysem odwróconego krzyża na deskach traszyńskiej stodoły."
      },
      {
        "slug": "clue-key-book-apparatus",
        "title": "Szkic aparatu: Modlitewnik spięty kluczem",
        "image": "/handouts/tajemnica-dzieci-z-traszyna/clue-key-book-apparatus.webp",
        "handoutType": "diary",
        "nodeId": "node-traszyn-house",
        "textContent": "Rysunek dziecięcego seansu: stary klucz włożony między karty Ewangelii, podtrzymywany palcami dwóch osób."
      },
      {
        "slug": "audio-stilon-c60-interview",
        "title": "Kaseta Stilon C-60: Wywiad z przerażonym dzieckiem (1983)",
        "image": "/handouts/tajemnica-dzieci-z-traszyna/clue-key-book-apparatus.webp",
        "audioUrl": "/audio/handouts/tajemnica-dzieci-z-traszyna/wywiad-dziecko-1983.mp3",
        "handoutType": "diary",
        "nodeId": "node-exorcist-shrine",
        "textContent": "Zaszumione nagranie z polskiej kasety Stilon C-60: drżący dziecięcy głos opisujący cień unoszący się pod powałą stodoły."
      }
    ]
  },
  {
    id: 'przybysz-z-matriksa-glogow',
    title: 'Przybysz z Matriksa: Przepowiednie i Zjawisko z Głogowa',
    era: 'modern',
    eraLabel: 'Przełom Tysiącleci',
    yearRange: '2001',
    activeSceneYear: 2001,
    location: 'Głogów - Legnica',
    country: 'Polska',
    tone: 'noir',
    themes: ['Sygnał z VHS', 'Anomalia czasowa', 'Audycje z przyszłości', 'Podziemia twierdzy'],
    suggestedOccupations: ['Programistka Y2K', 'Dziennikarka TV', 'Radioamator', 'Detektyw'],
    suggestedArchetypes: ['scholar', 'investigator', 'action', 'mystic'],
    hook: 'Nagrania VHS radioamatora wykazują audycje z przyszłości i zakłócenia sygnału z nocy 14 listopada. Byt z podziemi manipuluje czasem.',
    description: 'Badacze trafiają do Głogowa po serii niewytłumaczalnych zjawisk rejestrowanych na kasetach VHS przez lokalnego radioamatora. Świadkowie zgłaszają nocne błyski światła, zaniki pamięci oraz audycje telewizyjne nadawane z przyszłości. Śledztwo prowadzi przez próby przejęcia taśm przez służby specjalne aż do opuszczonych podziemi Twierdzy Głogów, gdzie pradawny byt manipuluje falami czasu.',
    investigatorIntro: 'Badacze trafiają do Głogowa po serii niewytłumaczalnych zjawisk rejestrowanych na kasetach VHS przez lokalnego radioamatora. Świadkowie zgłaszają nocne błyski światła, zaniki pamięci oraz audycje telewizyjne nadawane z przyszłości. Śledztwo prowadzi przez próby zabezpieczenia taśm aż do opuszczonych korytarzy Twierdzy Głogów.',
    settingTrivia: [
      'Na przełomie tysiącleci nośniki magnetyczne VHS i magnetowidy były podstawowym domowym archiwum wideo, podatnym na rozmagnesowanie i zakłócenia radiowe.',
      'Krótkofalowcy i radioamatorzy prowadzili niezależne nasłuchy pasm eterowych, nierzadko rejestrując anomalie techniczne szybciej niż instytucje państwowe.',
      'Opuszczone poradzieckie koszary i twierdze na Ziemiach Zachodnich po 1993 roku często nie posiadały aktualnych planów inżynieryjnych.',
    ],
    estimatedSessions: '2-3',
    playerCount: '1-4',
    difficulty: 'hard',
    source: 'Strefa 11 / Nie do wiary',
    sourceCategory: 'oneshot',
    recommendedForBeginners: false,
    isStrefa11: true,
    documentType: 'scenario',
    isCampaign: false,
    "startDate": "2001-11-14T20:00",
    "initialWeather": "Zimny, listopadowy deszcz ze śniegiem i gęsty smog nad Odrą",
    "boundarySummary": "Głogów jest objęty blokadą kwarantannową i komunikacyjną po rzekomej awarii sieci energetycznej oraz skażeniu w pobliżu huty miedzi. Mosty na Odrze i drogi wyjazdowe są obstawione przez patrole Policji i Żandarmerii Wojskowej, a w całym mieście występują lokalne pętle czasowe cofające uciekające pojazdy z powrotem na rogatki Osiedla Kopernika.",
    "truthAnchor": {
      "culprit": "Chrono-Anomalia z Sektoru X-11 (Pradawny Byt Czasoprzestrzenny / Tindalos-Noth-Yiddith) sprzężona z wojskowym przekaźnikiem troposferycznym pod Twierdzą Głogów",
      "motive": "Byt uwięziony w zalanym kazamacie pod dnem Odry wykorzystuje sieć telewizji kablowej i anteny zbiorcze na Osiedlu Kopernika jako matrycę synchronizacyjną do zapadnięcia lokalnej pętli czasu.",
      "murderWeapon": "Desynchronizacja chronologiczna układu nerwowego (nagłe postarzenie tkanek lub zatrzymanie impulsów mózgowych w zamrożonej sekundzie czasu) podczas emisji sygnału z kanału 37.",
      "keyAlibi": "Służby specjalne i technicy kablówki zrzucają winę na przebicia prądu z huty i pirackie nadajniki radioamatorów, ukrywając podziemny kabel koncentryczny biegnący do Twierdzy Głogów.",
      "immutableFacts": [
        "Audycje na kasetach VHS nie są mistyfikacją - to rzeczywiste odbicia sygnału z przyszłych iteracji pętli czasowej, w których Głogów uległ wygaszeniu.",
        "Kanał 37 jest retransmitowany przez niemiecki kabel podmorski z 1944 roku prowadzący z węzła na Osiedlu Kopernika wprost do Sektoru X-11 pod Twierdzą Głogów.",
        "Zegarki elektroniczne w zasięgu anomalii odliczają czas wstecz do godziny 03:33 w nocy 15 listopada 2001 roku.",
        "Fizyczne przecięcie magistrali koncentrycznej i zalanie rezonatora w Sektorze X-11 wodami Odry przerywa pętlę czasową i przywraca normalny bieg czasu."
      ]
    },
    "doomClock": {
      "deadline": {
        "year": 2001,
        "month": 10,
        "day": 15,
        "hour": 3,
        "minute": 33
      },
      "totalHours": 7.5,
      "stages": [
        {
          "phase": 0,
          "title": "Faza 0: Cisza w eterze (Analiza taśm VHS)",
          "description": "W studiu telewizji lokalnej badacze przeglądają zrzuty klatek CRT. Na zewnątrz mrugają latarnie uliczne, a w głośnikach słychać cichy przydźwięk."
        },
        {
          "phase": 1,
          "title": "Faza 1: Narastająca presja (Zaniki pamięci i Deja Vu)",
          "description": "Mieszkańcy Osiedla Kopernika powtarzają te same zdania co 11 minut. Zegarki elektroniczne zaczynają tykać wstecz, a w blokach wariują magnetowidy."
        },
        {
          "phase": 2,
          "title": "Faza 2: Bezpośrednie zagrożenie (Suchy piorun i patrole)",
          "description": "Nad Twierdzą Głogów biją bezgłośne, fioletowe błyskawice. Nieoznakowane furgonetki służb konfiskują kasety VHS, a telewizory same włączają się na kanał 37."
        },
        {
          "phase": 3,
          "title": "Faza 3: Punkt kulminacyjny (Zapadnięcie Pętli w Sektorze X-11)",
          "description": "Zbliża się 03:33. Przekaźnik w podziemiach pod Odrą osiąga pełną synchronizację, a sylwetka Przybysza z Matriksa zaczyna wychodzić z ekranów i ścian."
        }
      ]
    },
    "secretsPool": [
      {
        "id": "sec-glogow-1",
        "text": "Klatka wideo z godziny 03:33 na taśmie VHS przedstawia twarz jednego z badaczy stojącego w zalanym korytarzu Sektoru X-11.",
        "isDiscovered": false
      },
      {
        "id": "sec-glogow-2",
        "text": "Wszystkie zegarki Casio w promieniu kilometra od Osiedla Kopernika zatrzymują się lub odliczają wstecz dokładnie o 11 minut co pełną godzinę.",
        "isDiscovered": false
      },
      {
        "id": "sec-glogow-3",
        "text": "Pod skrzynką rozdzielczą telewizji kablowej w bloku przy ul. Gwiaździstej podpięty jest pancerny kabel wojskowy z oznaczeniami Festung Glogau 1944.",
        "isDiscovered": false
      },
      {
        "id": "sec-glogow-4",
        "text": "Świadkowie, którzy oglądali audycję na kanale 37 dłużej niż trzy minuty, pamiętają wydarzenia z jutra, ale zapominają własne nazwiska.",
        "isDiscovered": false
      },
      {
        "id": "sec-glogow-5",
        "text": "Woda w zalanym tunelu Sektoru X-11 pod dnem Odry nie zamarza mimo temperatury -15 stopni Celsjusza, a krople unoszą się w powietrzu.",
        "isDiscovered": false
      },
      {
        "id": "sec-glogow-6",
        "text": "Zwarcie głowicy nadawczej w Sektorze X-11 za pomocą impulsu rozmagnesowującego (degaussera) z redakcji TV niszczy matrycę sygnału.",
        "isDiscovered": false
      }
    ],
    "graph": {
      "nodes": [
        {
          "id": "node-glogow-tv-studio",
          "name": "Redakcja Telewizji Lokalnej i Studio Montażowe VHS",
          "type": "intro",
          "description": "Ciasne studio pełne magnetowidów Panasonic SVHS, monitorów kineskopowych Sony Trinitron i zapachu nagrzanego plastiku. Miejsce analizy pierwszego nagrania.",
          "atmosphere": "Pisk transformatorów odchylania poziomego, migotanie śniegu na ekranach CRT i nerwowe przewijanie taśmy klatka po klatce.",
          "npcIds": [
            "npc-joanna-majewska",
            "npc-piotr-kaminski"
          ],
          "locationId": "loc-glogow-tv-studio",
          "leadInClueIds": [],
          "leadOutClueIds": [
            "clue-vhs-tape-glogow",
            "clue-newspaper-clipping-2001",
            "clue-studio-spectrum-trace"
          ]
        },
        {
          "id": "node-kopernik-apartment",
          "name": "Mieszkanie Radioamatora na Osiedlu Kopernika",
          "type": "location",
          "isBottleneck": true,
          "description": "Mieszkanie na dziesiątym piętrze bloku z wielkiej płyty. W salonie czuć ostry zapach ozonu, a telewizor i magnetowid włączają się mimo wyjęcia wtyczek z gniazdka.",
          "atmosphere": "Zimny poblask kineskopu, tykające wstecz zegarki elektroniczne i cichy szept dobiegający z głośników.",
          "secret": "Przez pion wentylacyjny mieszkania przechodzi nielegalny odcinek wojskowego kabla koncentrycznego działającego jak antena czasowa.",
          "npcIds": [
            "npc-kamil-pawlak"
          ],
          "locationId": "loc-kopernik-apartment",
          "leadInClueIds": [
            "clue-vhs-tape-glogow",
            "clue-cable-hub-logbook",
            "clue-bunker-vhs-cache"
          ],
          "leadOutClueIds": [
            "clue-clock-anomaly",
            "clue-apartment-coax-splicing",
            "clue-witness-future-prophecy"
          ]
        },
        {
          "id": "node-glogow-cable-hub",
          "name": "Rozdzielnia i Węzeł Telewizji Kablowej Głogów",
          "type": "location",
          "isBottleneck": true,
          "description": "Podziemna stacja wzmacniaków i serwerownia operatora kablowego na styku Osiedla Kopernika i starego miasta.",
          "atmosphere": "Szum wentylatorów, pisk modemów dial-up, zielone diody przełączników i elektryzujące powietrze stawiające włosy dęba.",
          "secret": "W najniższej studzience telekomunikacyjnej współczesna magistrala łączy się z poniemieckim kablem prowadzącym do Twierdzy Głogów.",
          "npcIds": [
            "npc-dominika-szymanska"
          ],
          "locationId": "loc-glogow-cable-hub",
          "leadInClueIds": [
            "clue-newspaper-clipping-2001",
            "clue-clock-anomaly",
            "clue-bunker-field-generator-wire"
          ],
          "leadOutClueIds": [
            "clue-cable-hub-logbook",
            "clue-cable-hub-german-conduit",
            "clue-audio-vhs-broadcast-decode"
          ]
        },
        {
          "id": "node-glogow-fortress-bunker",
          "name": "Opuszczony Bunkier Łączności pod Twierdzą Głogów",
          "type": "location",
          "isBottleneck": true,
          "description": "Ciemne, wilgotne kazamaty pod XIX-wieczną twierdzą nad Odrą. Ściany pokrywa gruby szron w temperaturze dodatniej, a powietrze drży od poddźwięków.",
          "atmosphere": "Kapiąca woda, chłód zamarzającego oddechu, echo kroków które słychać sekundę przed postawieniem stopy.",
          "secret": "Za pancerną grodzią znajduje się zejście do zalanego Sektoru X-11 bezpośrednio pod korytem Odry.",
          "npcIds": [
            "npc-kamil-pawlak",
            "npc-piotr-kaminski"
          ],
          "locationId": "loc-glogow-fortress-bunker",
          "leadInClueIds": [
            "clue-studio-spectrum-trace",
            "clue-apartment-coax-splicing",
            "clue-cable-hub-german-conduit"
          ],
          "leadOutClueIds": [
            "clue-military-bunker-map",
            "clue-bunker-vhs-cache",
            "clue-bunker-field-generator-wire"
          ]
        },
        {
          "id": "node-glogow-sector-x11-climax",
          "name": "Zalany Sektor X-11 pod Dnem Odry - Rdzeń Matriksa (Finał)",
          "type": "climax",
          "isBottleneck": true,
          "isClimax": true,
          "description": "Zalana po kolana komora pod korytem Odry. Z pękniętej kopuły ze szkła kwarcowego i niemieckich lamp elektronowych bije oślepiający śnieg telewizyjny, w którym formuje się postać Przybysza.",
          "atmosphere": "Krople wody zawieszone nieruchomo w powietrzu, ogłuszający pisk modemu, nakładające się głosy z przeszłości i przyszłości.",
          "secret": "Przecięcie głównej magistrali koncentrycznej i uderzenie impulsem degaussera w kopułę przed godziną 03:33 niszczy pętlę czasową.",
          "npcIds": [
            "npc-dominika-szymanska",
            "npc-joanna-majewska"
          ],
          "locationId": "loc-glogow-sector-x11",
          "leadInClueIds": [
            "clue-witness-future-prophecy",
            "clue-audio-vhs-broadcast-decode",
            "clue-military-bunker-map"
          ],
          "leadOutClueIds": []
        }
      ],
      "clues": [
        {
          "id": "clue-vhs-tape-glogow",
          "name": "Taśma VHS z Nagraniem Sygnału 14.11 (Kanał 37)",
          "description": "Kaseta SVHS z nagranym zakłóceniem z nocy 14 listopada. Analiza kodu czasowego wskazuje źródło nagrania w mieszkaniu radioamatora na Osiedlu Kopernika.",
          "sourceType": "anomaly",
          "clueType": "core",
          "sourceNodeId": "node-glogow-tv-studio",
          "targetNodeId": "node-kopernik-apartment",
          "requiredSkill": "Elektryka"
        },
        {
          "id": "clue-newspaper-clipping-2001",
          "name": "Wycinek z 'Głosu Głogowskiego' o suchym piorunie",
          "description": "Artykuł i relacja fotoreportera o fioletowym wyładowaniu, które uderzyło bezpośrednio w maszt przekaźnikowy na dachu Węzła Kablowego przy Twierdzy.",
          "sourceType": "testimony",
          "clueType": "core",
          "sourceNodeId": "node-glogow-tv-studio",
          "targetNodeId": "node-glogow-cable-hub",
          "requiredSkill": "Biblioteka"
        },
        {
          "id": "clue-studio-spectrum-trace",
          "name": "Wykres widma falowego z analizatora w studiu TV",
          "description": "Pomiar inżyniera Piotra Kamińskiego pokazujący, że nośna dźwięku z kasety VHS pulsuje z częstotliwością geodezyjną podziemi Twierdzy Głogów.",
          "sourceType": "anomaly",
          "clueType": "core",
          "sourceNodeId": "node-glogow-tv-studio",
          "targetNodeId": "node-glogow-fortress-bunker",
          "requiredSkill": "Nauka (Fizyka / Elektronika)"
        },
        {
          "id": "clue-clock-anomaly",
          "name": "Zegarek Casio ze Wstecznym Odliczaniem",
          "description": "Zegarek znaleziony w mieszkaniu świadka na Osiedlu Kopernika. Jego układ kwarcowy wskazuje kierunek najsilniejszego pola magnetycznego w Węźle Kablowym.",
          "sourceType": "anomaly",
          "clueType": "core",
          "sourceNodeId": "node-kopernik-apartment",
          "targetNodeId": "node-glogow-cable-hub",
          "requiredSkill": "Spostrzegawczość"
        },
        {
          "id": "clue-apartment-coax-splicing",
          "name": "Nielegalne wpięcie w pion instalacyjny w bloku",
          "description": "Gruby, czarny przewód koncentryczny ukryty w szybie windowym na Osiedlu Kopernika, prowadzący pod ziemią w stronę kazamatów Twierdzy Głogów.",
          "sourceType": "material",
          "clueType": "core",
          "sourceNodeId": "node-kopernik-apartment",
          "targetNodeId": "node-glogow-fortress-bunker",
          "requiredSkill": "Mechanika"
        },
        {
          "id": "clue-witness-future-prophecy",
          "name": "Zapis majaczeń świadka o zalanym Sektorze X-11",
          "description": "Pogrążony w transie mieszkaniec Osiedla Kopernika recytuje z pamięci współrzędne zalanego tunelu pod dnem Odry, które widział na ekranie telewizora.",
          "sourceType": "testimony",
          "clueType": "core",
          "sourceNodeId": "node-kopernik-apartment",
          "targetNodeId": "node-glogow-sector-x11-climax",
          "requiredSkill": "Psychologia"
        },
        {
          "id": "clue-cable-hub-logbook",
          "name": "Dziennik awarii Węzła Kablowego Osiedla Kopernika",
          "description": "Rejestr techniczny wykazujący, że zwrotne przepięcia o godzinie 03:33 zaczęły się w mieszkaniu nr 44 na Osiedlu Kopernika.",
          "sourceType": "document",
          "clueType": "core",
          "sourceNodeId": "node-glogow-cable-hub",
          "targetNodeId": "node-kopernik-apartment",
          "requiredSkill": "Korzystanie z komputerów"
        },
        {
          "id": "clue-cable-hub-german-conduit",
          "name": "Poniemiecka mufa kablowa 'Festung Glogau 1944'",
          "description": "Odkryta w piwnicy węzła telekomunikacyjnego pancerna mufa łącząca współczesną sieć światłowodową z wejściem do Bunkra pod Twierdzą Głogów.",
          "sourceType": "document",
          "clueType": "core",
          "sourceNodeId": "node-glogow-cable-hub",
          "targetNodeId": "node-glogow-fortress-bunker",
          "requiredSkill": "Historia"
        },
        {
          "id": "clue-audio-vhs-broadcast-decode",
          "name": "Zdekodowany sygnał modemowy z pasma VHS",
          "description": "Ciąg współrzędnych binarnych wyodrębniony w Węźle Kablowym z nagrania audio, wskazujący dokładnie komorę rezonansową w zalanym Sektorze X-11.",
          "sourceType": "anomaly",
          "clueType": "core",
          "sourceNodeId": "node-glogow-cable-hub",
          "targetNodeId": "node-glogow-sector-x11-climax",
          "requiredSkill": "Korzystanie z komputerów"
        },
        {
          "id": "clue-military-bunker-map",
          "name": "Plan Podziemi Twierdzy Głogów (Sektor X-11)",
          "description": "Wojskowa mapa sztabowa z bunkra pod twierdzą z naniesionym czerwonym ołówkiem zalanym tunelem prowadzącym pod dno Odry do Sektoru X-11.",
          "sourceType": "document",
          "clueType": "core",
          "sourceNodeId": "node-glogow-fortress-bunker",
          "targetNodeId": "node-glogow-sector-x11-climax",
          "requiredSkill": "Nawigacja"
        },
        {
          "id": "clue-bunker-vhs-cache",
          "name": "Skrzynia ze skonfiskowanymi kasetami VHS z Kopernika",
          "description": "Znalezione w przedsionku bunkra pudełko z kasetami opisanymi adresami mieszkań na Osiedlu Kopernika, gdzie rejestrowano najczystszy obraz.",
          "sourceType": "material",
          "clueType": "core",
          "sourceNodeId": "node-glogow-fortress-bunker",
          "targetNodeId": "node-kopernik-apartment",
          "requiredSkill": "Spostrzegawczość"
        },
        {
          "id": "clue-bunker-field-generator-wire",
          "name": "Zasilacz impulsowy podpięty pod Węzeł Kablowy",
          "description": "Wojskowa przetwornica w bunkrze wysyłająca pakiety synchronizacyjne bezpośrednio do rozdzielni Węzła Kablowego.",
          "sourceType": "material",
          "clueType": "core",
          "sourceNodeId": "node-glogow-fortress-bunker",
          "targetNodeId": "node-glogow-cable-hub",
          "requiredSkill": "Elektryka"
        }
      ],
      "connections": [
        {
          "fromId": "node-glogow-tv-studio",
          "toId": "node-kopernik-apartment",
          "clueId": "clue-vhs-tape-glogow",
          "description": "Kod czasowy na kasecie VHS prowadzi do mieszkania radioamatora na Osiedlu Kopernika."
        },
        {
          "fromId": "node-glogow-tv-studio",
          "toId": "node-glogow-cable-hub",
          "clueId": "clue-newspaper-clipping-2001",
          "description": "Relacja o suchym piorunie kieruje do masztu na dachu Węzła Kablowego."
        },
        {
          "fromId": "node-glogow-tv-studio",
          "toId": "node-glogow-fortress-bunker",
          "clueId": "clue-studio-spectrum-trace",
          "description": "Widmo falowe sygnału wskazuje na podziemia Twierdzy Głogów."
        },
        {
          "fromId": "node-kopernik-apartment",
          "toId": "node-glogow-cable-hub",
          "clueId": "clue-clock-anomaly",
          "description": "Anomalia magnetyczna zegarka Casio prowadzi do rozdzielni Węzła Kablowego."
        },
        {
          "fromId": "node-kopernik-apartment",
          "toId": "node-glogow-fortress-bunker",
          "clueId": "clue-apartment-coax-splicing",
          "description": "Wojskowy kabel koncentryczny w szybie bloku biegnie do bunkra pod Twierdzą Głogów."
        },
        {
          "fromId": "node-kopernik-apartment",
          "toId": "node-glogow-sector-x11-climax",
          "clueId": "clue-witness-future-prophecy",
          "description": "Współrzędne wyrecytowane przez świadka wskazują zalany Sektor X-11 pod Odrą."
        },
        {
          "fromId": "node-glogow-cable-hub",
          "toId": "node-kopernik-apartment",
          "clueId": "clue-cable-hub-logbook",
          "description": "Dziennik przepięć w węźle kablowym wskazuje mieszkanie na Osiedlu Kopernika."
        },
        {
          "fromId": "node-glogow-cable-hub",
          "toId": "node-glogow-fortress-bunker",
          "clueId": "clue-cable-hub-german-conduit",
          "description": "Poniemiecka mufa kablowa z 1944 r. prowadzi do kazamatów Twierdzy Głogów."
        },
        {
          "fromId": "node-glogow-cable-hub",
          "toId": "node-glogow-sector-x11-climax",
          "clueId": "clue-audio-vhs-broadcast-decode",
          "description": "Zdekodowany sygnał modemowy z pasma VHS wskazuje komorę w Sektorze X-11."
        },
        {
          "fromId": "node-glogow-fortress-bunker",
          "toId": "node-glogow-sector-x11-climax",
          "clueId": "clue-military-bunker-map",
          "description": "Wojskowa mapa podziemi prowadzi zalanym tunelem wprost do Sektoru X-11."
        },
        {
          "fromId": "node-glogow-fortress-bunker",
          "toId": "node-kopernik-apartment",
          "clueId": "clue-bunker-vhs-cache",
          "description": "Skonfiskowane kasety VHS w bunkrze wskazują mieszkanie na Osiedlu Kopernika."
        },
        {
          "fromId": "node-glogow-fortress-bunker",
          "toId": "node-glogow-cable-hub",
          "clueId": "clue-bunker-field-generator-wire",
          "description": "Przewód zasilacza impulsowego prowadzi z bunkra do Węzła Kablowego."
        }
      ],
      "npcs": [
        {
          "id": "npc-joanna-majewska",
          "name": "Joanna Majewska (Dziennikarka)",
          "description": "Reporterka głogowskiej telewizji kablowej badająca nagrania z nocy 14 listopada.",
          "secret": "Rozpoznała na zatrzymanej klatce VHS z przyszłości panoramę Głogowa spowitą czarnym szronem."
        },
        {
          "id": "npc-piotr-kaminski",
          "name": "Piotr Kamiński (Inżynier)",
          "description": "Montażysta i elektronik analizujący ścieżkę dźwiękową i synchronizację kaset VHS.",
          "secret": "Zbudował przenośny degausser zdolny do wygenerowania silnego impulsu elektromagnetycznego."
        },
        {
          "id": "npc-kamil-pawlak",
          "name": "Kamil Pawlak (Detektyw)",
          "description": "Prywatny detektyw wynajęty do odnalezienia zaginionego radioamatora z Osiedla Kopernika.",
          "secret": "Przeżył już tę samą noc dwa razy i ma w kieszeni dwa identyczne zegarki z różnym czasem."
        },
        {
          "id": "npc-dominika-szymanska",
          "name": "Dominika Szymańska (Programistka)",
          "description": "Specjalistka od sieci teleinformatycznych i zabezpieczeń Y2K pracująca w węźle kablowym.",
          "secret": "Zdekodowała w pisku modemu z kanału 37 ostrzeżenie wysłane przez samą siebie z 2012 roku."
        }
      ],
      "locations": [
        {
          "id": "loc-glogow-tv-studio",
          "name": "Studio Telewizji Lokalnej w Głogowie",
          "description": "Montażownia wideo pełna magnetowidów SVHS i monitorów kineskopowych.",
          "atmosphere": "Błękitna poświata ekranów CRT, szum głowic wideo i napięcie odkrycia."
        },
        {
          "id": "loc-kopernik-apartment",
          "name": "Mieszkanie na Osiedlu Kopernika",
          "description": "Lokal w bloku z wielkiej płyty, w którym zarejestrowano audycję z przyszłości.",
          "atmosphere": "Zapach ozonu, tykające wstecz zegary i martwa cisza na klatce schodowej."
        },
        {
          "id": "loc-glogow-cable-hub",
          "name": "Węzeł Telewizji Kablowej Głogów",
          "description": "Podziemna rozdzielnia sygnału telewizyjnego i internetowego.",
          "atmosphere": "Pisk modemów, plątanina kabli koncentrycznych i wyładowania elektrostatyczne."
        },
        {
          "id": "loc-glogow-fortress-bunker",
          "name": "Bunkier pod Twierdzą Głogów",
          "description": "Poniemieckie kazamaty łączności nad Odrą pokryte nienaturalnym szronem.",
          "atmosphere": "Przejmujący mróz, echo kroków z przyszłości i wojskowe mapy na ścianach."
        },
        {
          "id": "loc-glogow-sector-x11",
          "name": "Zalany Sektor X-11 pod Dnem Odry",
          "description": "Najgłębsza komora pod korytem rzeki z kwarcowym rezonatorem czasu.",
          "atmosphere": "Zawieszone w powietrzu krople wody, biały szum telewizyjny i zakrzywienie czasu."
        }
      ]
    },
    "handouts": [
      {
        "slug": "clue-vhs-tape-glogow",
        "title": "Zrzut klatki CRT: Sygnał z nocy 14 listopada",
        "image": "/handouts/przybysz-z-matriksa-glogow/clue-vhs-tape-glogow.webp",
        "handoutType": "report",
        "nodeId": "node-glogow-tv-studio",
        "textContent": "Paski zakłóceń kineskopu i zamglona postać z przyszłości mówiąca o wygaszeniu sygnału w Twierdzy Głogów."
      },
      {
        "slug": "clue-military-bunker-map",
        "title": "Plan podziemi Twierdzy Głogów (Sektor X-11)",
        "image": "/handouts/przybysz-z-matriksa-glogow/clue-military-bunker-map.webp",
        "handoutType": "report",
        "nodeId": "node-glogow-fortress-bunker",
        "textContent": "Wojskowa mapa kazamatów z naniesionym czerwonym ołówkiem zalanym tunelem prowadzącym pod dno Odry."
      },
      {
        "slug": "audio-vhs-broadcast-anomaly",
        "title": "Taśma VHS: Przechwycona audycja z przyszłości",
        "image": "/handouts/przybysz-z-matriksa-glogow/clue-vhs-tape-glogow.webp",
        "audioUrl": "/audio/handouts/przybysz-z-matriksa-glogow/sygnal-vhs-glogow.mp3",
        "handoutType": "report",
        "nodeId": "node-glogow-cable-hub",
        "textContent": "Trzask włączanego pasma telewizyjnego, pisk modemu i syntetyczny, obcy głos nadający ciągi współrzędnych czasowych."
      }
    ]
  },
];

// Własna przygoda lub lorebook wgrany z PDF
export interface CustomAdventure extends AdventureContext {
  pdfUrl: string; // URL pliku PDF w GCS
  geminiFileUri: string; // URI dla Gemini API
  fileName: string; // Oryginalna nazwa pliku
  uploadedAt: string; // ISO timestamp
  isAnalyzed: boolean; // Czy AI przeanalizowało
  analysisError?: string; // Błąd analizy (opcjonalnie)
  documentType?: DocumentType; // scenario | setting | compendium
  lorebookData?: LorebookData;
  attachedLorebookIds?: string[];
  attachedLorebooks?: SourcebookReference[];
}

// ============================================================================
// ARCHETYPY POSTACI (dla kroku "Koncepcja postaci")
// ============================================================================

export interface CharacterArchetype {
  id: string;
  name: string;
  icon: string;
  description: string;
  suggestedOccupations: string[];
  suggestedTraits: string[];
  suggestedMotivations: string[];
}

export const CHARACTER_ARCHETYPES: CharacterArchetype[] = [
  {
    id: 'investigator',
    name: 'Śledczy',
    icon: '🔍',
    description:
      'Szukasz prawdy za wszelką cenę. Dociekliwość jest Twoją bronią, a każda zagadka wzywa do rozwiązania.',
    suggestedOccupations: [
      'private_investigator',
      'police_detective',
      'journalist',
    ],
    suggestedTraits: ['dociekliwy', 'uparty', 'sceptyczny'],
    suggestedMotivations: ['odkrycie prawdy', 'sprawiedliwość', 'ciekawość'],
  },
  {
    id: 'scholar',
    name: 'Uczony',
    icon: '📚',
    description:
      'Wiedza jest Twoją bronią. Książki i dokumenty mówią więcej niż ludzie. Rozumiesz, że niektóre prawdy lepiej pozostawić nieodkryte.',
    suggestedOccupations: [
      'professor',
      'librarian',
      'antiquarian',
      'scientist',
    ],
    suggestedTraits: ['ciekawy świata', 'metodyczny', 'zamyślony'],
    suggestedMotivations: [
      'zdobycie wiedzy',
      'ochrona przed zapomnianymi tajemnicami',
      'akademicka sława',
    ],
  },
  {
    id: 'action',
    name: 'Człowiek czynu',
    icon: '💪',
    description:
      'Działasz, nie myślisz. Kiedy inni analizują, Ty już jesteś w środku akcji. Fizyczna siła i odwaga wyróżniają Cię z tłumu.',
    suggestedOccupations: [
      'soldier',
      'athlete',
      'sailor',
      'police_officer',
      'military',
    ],
    suggestedTraits: ['odważny', 'impulsywny', 'lojalny'],
    suggestedMotivations: ['ochrona bliskich', 'przygoda', 'honor'],
  },
  {
    id: 'trickster',
    name: 'Oszust',
    icon: '🎭',
    description:
      'Kłamstwo to Twoje narzędzie, a manipulacja - sztuka. Potrafisz wejść wszędzie i przekonać każdego do wszystkiego.',
    suggestedOccupations: ['criminal', 'entertainer', 'spy', 'dilettante'],
    suggestedTraits: ['przebiegły', 'czarujący', 'wyrachowany'],
    suggestedMotivations: ['zysk', 'emocje', 'ucieczka przed przeszłością'],
  },
  {
    id: 'mystic',
    name: 'Mistyk',
    icon: '🌙',
    description:
      'Czujesz coś więcej niż inni. Granica między światem materialnym a tym, co za nim, zawsze była dla Ciebie cienka.',
    suggestedOccupations: [
      'parapsychologist',
      'clergy',
      'artist',
      'tribe_member',
    ],
    suggestedTraits: ['intuicyjny', 'tajemniczy', 'wrażliwy'],
    suggestedMotivations: [
      'zrozumienie tego, co niewidzialne',
      'ochrona przed złem',
      'odkrycie swojego przeznaczenia',
    ],
  },
  {
    id: 'healer',
    name: 'Uzdrowiciel',
    icon: '⚕️',
    description:
      'Twoje powołanie to niesienie pomocy. Czy to ciału, czy umysłowi - potrafisz leczyć rany, które inni nawet nie widzą.',
    suggestedOccupations: ['doctor', 'nurse', 'clergy'],
    suggestedTraits: ['empatyczny', 'opanowany', 'cierpliwy'],
    suggestedMotivations: [
      'ratowanie życia',
      'zrozumienie ludzkiej natury',
      'pokuta za przeszłość',
    ],
  },
  {
    id: 'custom',
    name: 'Własna koncepcja',
    icon: '✍️',
    description:
      'Masz własną wizję postaci, która nie pasuje do żadnego z powyższych archetypów.',
    suggestedOccupations: [],
    suggestedTraits: [],
    suggestedMotivations: [],
  },
];

// ============================================================================
// WBUDOWANE PRZYGODY
// ============================================================================

// Katalog ładowany z osobnego modułu. Publiczny/testerski build dostaje PUSTY
// katalog (zero treści chronionych); prywatny build autora ma pełny katalog
// przez adventures-catalog.private.ts. Generator: scripts/gen-adventure-catalog.mjs
export const BUILT_IN_ADVENTURES: AdventureContext[] = ADVENTURE_CATALOG;

// ============================================================================
// PRZYGODA CUSTOM (dla własnych PDF)
// ============================================================================

export const CUSTOM_ADVENTURE_TEMPLATE: AdventureContext = {
  id: 'custom',
  title: 'Własna Przygoda',
  era: 'custom',
  eraLabel: 'Określ sam',
  yearRange: '',
  location: '',
  country: '',
  tone: 'purist',
  themes: [],
  suggestedOccupations: [],
  suggestedArchetypes: [],
  hook: 'Załaduj własny scenariusz lub opisz swoją przygodę.',
  description:
    'Wgraj plik PDF ze scenariuszem lub opisz fabułę manualnie. AI dostosuje generowanie postaci do Twojego kontekstu.',
  estimatedSessions: '',
  playerCount: '1-4',
  difficulty: 'normal',
  isCustom: true,
  source: 'Własna przygoda',
  sourceCategory: 'custom',
  sourceBookId: 'custom',
};

// ============================================================================
// HELPERY
// ============================================================================

export function getQuickSetupAdventures(locale?: string): AdventureContext[] {
  return locale === 'en' ? AMERICAN_COLD_CASES_ADVENTURES : STREFA_11_ADVENTURES;
}

export function getAdventureById(id: string): AdventureContext | undefined {
  if (id === 'custom') return CUSTOM_ADVENTURE_TEMPLATE;
  const strefa11 = STREFA_11_ADVENTURES.find((a) => a.id === id);
  if (strefa11) return strefa11;
  const coldCase = AMERICAN_COLD_CASES_ADVENTURES.find((a) => a.id === id);
  if (coldCase) return coldCase;
  return BUILT_IN_ADVENTURES.find((a) => a.id === id);
}

/** Grupa przygód jednej książki źródłowej (do grupowania w selektorze). */
export interface AdventureSourceGroup {
  source: string;
  category: AdventureContext['sourceCategory'];
  items: AdventureContext[];
}

/**
 * Grupuje wbudowane przygody wg książki źródłowej. Kolejność grup = pierwsze
 * wystąpienie w BUILT_IN_ADVENTURES (podręcznik → antologie → one-shoty).
 */
export function getAdventuresGroupedBySource(): AdventureSourceGroup[] {
  const groups: AdventureSourceGroup[] = [];
  for (const adv of BUILT_IN_ADVENTURES) {
    const source = adv.source || 'Pozostałe scenariusze';
    let group = groups.find((g) => g.source === source);
    if (!group) {
      group = { source, category: adv.sourceCategory, items: [] };
      groups.push(group);
    }
    group.items.push(adv);
  }
  return groups;
}

export function getArchetypeById(id: string): CharacterArchetype | undefined {
  return CHARACTER_ARCHETYPES.find((a) => a.id === id);
}

/**
 * Zwraca opis kontekstu przygody dla promptu AI
 */
export function getAdventureContextPrompt(adventure: AdventureContext): string {
  let prompt = `KONTEKST PRZYGODY:
- Tytuł: ${adventure.title}
- Era: ${adventure.eraLabel} (${adventure.yearRange})
- Lokalizacja: ${adventure.location}, ${adventure.country}
- Ton: ${adventure.tone === 'purist' ? 'Mroczny, klasyczny horror' : adventure.tone === 'pulp' ? 'Heroiczna akcja' : 'Noir, śledztwo'}
- Motywy: ${adventure.themes.join(', ')}${adventure.source ? `\n- Źródło: ${adventure.source}` : ''}`;

  if (adventure.attachedLorebooks && adventure.attachedLorebooks.length > 0) {
    prompt += `\n- Podpięte księgi tła i kompendia: ${adventure.attachedLorebooks.map(l => l.title).join(', ')}`;
  }

  if (adventure.lorebookData) {
    prompt += `\n\n[LOREBOOK_CONTEXT - REGION I ŚWIAT]:
- Obszar/Temat: ${adventure.lorebookData.regionOrTheme}
- Synteza: ${adventure.lorebookData.summary}`;
  }

  prompt += `\n\nWYMOGI DLA POSTACI:
- Postać MUSI pasować do lokalizacji: ${adventure.location}
- Postać MUSI mieć powód do przebywania w ${adventure.location} w roku ${adventure.yearRange}
- Zawód MUSI istnieć w epoce ${adventure.eraLabel}
- Styl postaci MUSI pasować do tonu "${adventure.tone}"

SUGEROWANE ZAWODY: ${adventure.suggestedOccupations.join(', ') || 'dowolne pasujące do ery'}`;

  return prompt;
}


/**
 * Filtruje zawody według ery przygody
 */
export function filterOccupationsByEra(
  era: 'classic' | 'gaslight' | 'noir' | 'prl' | 'modern' | 'custom'
): string[] {
  // Zawody niedostępne w różnych erach
  const MODERN_ONLY = ['hacker'];
  const EXCLUDE_IN_GASLIGHT = ['hacker', 'pilot']; // samoloty dopiero po 1903

  if (era === 'gaslight') {
    return EXCLUDE_IN_GASLIGHT;
  }
  if (era === 'classic') {
    return MODERN_ONLY;
  }
  if (era === 'noir' || era === 'prl') {
    return MODERN_ONLY;
  }
  return []; // modern - wszystko dostępne
}
