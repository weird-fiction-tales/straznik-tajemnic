import {
  buildLocalCustomAdventures,
  parseScenariosFromAnthologyText,
  cleanRawHandoutText,
  isKeeperOrTacticalHandout,
  evaluateGmSafety,
  extractHandoutsFromScenarioText,
} from './adventure-local-builder';
import { detectRulebookProfile } from './rulebook-fingerprint';
import type { OverlayDescriptor } from './semantic-overlay-engine';
import type { AdventureNodeType } from '@/lib/types';
import { buildHandoutsContext } from '@/app/api/chat/_helpers/build-handouts-context';

describe('adventure-local-builder', () => {
  const dummyOverlay: OverlayDescriptor = {
    id: 'overlay-test',
    title: 'Test Overlay',
    fileName: 'test.pdf',
    profile: 'one_shot',
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    tags: ['NPC', 'CZARY'],
    features: {
      hasCombatRules: false,
      hasSanityRules: false,
      hasChaseRules: false,
      hasMagicRules: true,
      hasCreatures: false,
      hasSpells: true,
      hasHandouts: true,
      hasScenarios: true,
    },
    stats: {
      npcCount: 1,
      creatureCount: 0,
      spellCount: 1,
      ruleCount: 0,
      handoutCount: 1,
      adventureCount: 1,
    },
    entities: {
      npcs: [{ id: 'npc-1', name: 'Jan Kowalski', role: 'Świadek' }],
      creatures: [],
      spells: [{ id: 'spell-1', name: 'Znak Starszych Bogów', description: 'Rytuał ochronny', magicCost: '10 PO' }],
      rules: [],
      handouts: [{ id: 'h-1', title: 'Stary pamiętnik', content: 'Zapiski' }],
      adventures: [
        {
          id: 'adv-1',
          title: 'Główna przygoda',
          type: 'one_shot',
          synopsis: 'Zarys',
          nodes: [{ id: 'node-1', title: 'Dwór Corbitta', description: 'Stary dom', type: 'location' as const }],
        },
      ],
    },
  };

  describe('parseScenariosFromAnthologyText', () => {
    it('parses Horror nad Warta table of contents correctly', () => {
      const sampleToc = `
SPIS TREŚCI
ROZDZIAŁ 1
WSTĘP 5
ROZDZIAŁ 2
KRÓL ZIMY 12
Scenariusz osadzony w Poznaniu w latach 20.
ROZDZIAŁ 3
KROPLA KRWI 35
Mroczna sprawa w Gorcach.
ROZDZIAŁ 4
GŁOS Z GŁĘBIN 72
ROZDZIAŁ 5
CZARNY ŚWIT 105
ROZDZIAŁ 6
OSTATNI REJS 130
DODATEK 150
      `;

      const scenarios = parseScenariosFromAnthologyText(
        sampleToc,
        'Horror nad Wartą'
      );

      expect(scenarios.length).toBe(5);
      expect(scenarios[0].title).toBe('Król Zimy');
      expect(scenarios[1].title).toBe('Kropla Krwi');
      expect(scenarios[4].title).toBe('Ostatni Rejs');
    });

    it('parses Cienie Tatr table of contents correctly', () => {
      const sampleToc = `
Spis treści
Wstęp .................................................... 4
Giewont we mgle .......................................... 10
Cień nad Zakopanem ....................................... 28
Dolina Kościeliska ....................................... 52
Zimowa zawierucha ........................................ 78
Mgły nad Morskim Okiem ................................... 104
Świt na Rysach ........................................... 132
Pomocnicze tabele ........................................ 155
      `;

      const scenarios = parseScenariosFromAnthologyText(
        sampleToc,
        'Cienie Tatr'
      );

      expect(scenarios.length).toBe(6);
      expect(scenarios[0].title).toBe('Giewont We Mgle');
      expect(scenarios[5].title).toBe('Świt Na Rysach');
    });
  });

  describe('buildLocalCustomAdventures', () => {
    it('decomposes anthology into N individual CustomAdventure objects', () => {
      const text = `
Spis treści
ROZDZIAŁ 1
PIERWSZA TAJEMNICA 10
ROZDZIAŁ 2
DRUGA TAJEMNICA 40
      `;
      const profile = detectRulebookProfile(text, 'ZewCthulhu_HorrornadWarta_v.1.2.pdf');
      const adventures = buildLocalCustomAdventures(
        text,
        profile,
        dummyOverlay,
        'ZewCthulhu_HorrornadWarta_v.1.2.pdf',
        120
      );

      expect(adventures.length).toBe(2);
      expect(adventures[0].title).toBe('Pierwsza Tajemnica');
      expect(adventures[0].source).toBe('Horror nad Wartą');
      expect(adventures[0].sourceCategory).toBe('anthology');
      expect(adventures[0].documentType).toBe('scenario');
      expect(adventures[1].title).toBe('Druga Tajemnica');
      expect(adventures[1].source).toBe('Horror nad Wartą');
    });

    it('extracts starter scenario "Nawiedzony dom" instead of generic d100 title', () => {
      const text = `
ZEW CTHULHU SKRÓCONE ZASADY GRY
SPIS TREŚCI
Zasady d100 ... 5
Tworzenie Badacza ... 12
Nawiedzony dom ... 32
Księga sekretów ... 50
      `;
      const profile = detectRulebookProfile(text, 'Zew_Cthulhu_Starter.pdf');
      const adventures = buildLocalCustomAdventures(
        text,
        profile,
        dummyOverlay,
        'Zew_Cthulhu_Starter.pdf',
        55
      );

      expect(adventures.length).toBe(1);
      expect(adventures[0].title).toBe('Nawiedzony dom');
      expect(adventures[0].source).toBe('Starter d100');
      expect(adventures[0].sourceCategory).toBe('starter');
      expect(adventures[0].documentType).toBe('scenario');
    });

    it('identifies Lorebook / Grimoire as compendium without forcing scenario type', () => {
      const text = `
Wielki Grymuar Magii Mitów Cthulhu.
Almanach zaklęć, rytuałów i formuł czarnoksięskich.
Księga dla Strażnika Tajemnic.
Zaklęcia, inkantacje, runy i portale.
      `;
      const profile = detectRulebookProfile(text, 'Wielki_Grymuar_Magii.pdf');
      const adventures = buildLocalCustomAdventures(
        text,
        profile,
        dummyOverlay,
        'Wielki_Grymuar_Magii.pdf',
        200
      );

      expect(adventures.length).toBe(1);
      expect(adventures[0].documentType).toBe('compendium');
      expect(adventures[0].title).toBe('Wielki Grymuar Magii Mitów Cthulhu');
      expect(adventures[0].lorebookData).toBeDefined();
    });

    it('formats locations and eras cleanly without duplicates', () => {
      const text = `
Akcja rozgrywa się w Poznaniu w roku 1925. Tajemnicze morderstwo.
      `;
      const profile = detectRulebookProfile(text, 'Poznan_1925.pdf');
      const adventures = buildLocalCustomAdventures(
        text,
        profile,
        dummyOverlay,
        'Poznan_1925.pdf',
        30
      );

      expect(adventures[0].location).toBe('Poznań');
      expect(adventures[0].country).toBe('Polska');
      expect(adventures[0].yearRange).toBe('1925');
      expect(adventures[0].eraLabel).toBe('Klasyczne lata 20.');
    });

    it('extracts difficulty stars, circled sessions, investigator requirements, puzzles, and handouts from scenario body', () => {
      const text = `
ROZDZIAŁ 1
JAK DOROŚLI WE MGLE

LEGENDA OZNACZENIA SCENARIUSZY
Stopień trudności: Trudny 
Liczba sesji: ➍

CZAS I MIEJSCE AKCJI
Listopad 1938 roku, okolice Zakopanego.

TWORZENIE BADACZY
W tym scenariuszu gracze wcielają się w postacie dzieci w wieku 10-15 lat.
Zaleca się, aby byli to uczniowie miejscowej szkoły.

ZAGADKA Z MAPĄ
Zlokalizowanie miejsca ukrycia ofiar porwań poprzez triangulację promieni od punktów zaginięć.

POMOC DLA GRACZY #1 - Mapa rejonu Tatr
POMOC DLA GRACZY #2 - Wycinek z Gazety Podhalańskiej
      `;

      const profile = detectRulebookProfile(text, 'Cienie_Tatr.pdf');
      const adventures = buildLocalCustomAdventures(
        text,
        profile,
        dummyOverlay,
        'Cienie_Tatr.pdf',
        45
      );

      expect(adventures.length).toBe(1);
      const adv = adventures[0];
      expect(adv.difficultyStars).toBe(4);
      expect(adv.difficulty).toBe('hard');
      expect(adv.estimatedSessions).toBe('4');
      expect(adv.yearRange).toBe('1938');
      expect(adv.activeSceneYear).toBe(1938);
      expect(adv.eraLabel).toBe('Lata 30.');
      expect(adv.investigatorRequirements).toBeDefined();
      expect(adv.investigatorRequirements?.minAge).toBe(10);
      expect(adv.investigatorRequirements?.maxAge).toBe(15);
      expect(adv.puzzles).toBeDefined();
      expect(adv.puzzles?.length).toBe(1);
      expect(adv.puzzles?.[0].title).toBe('Zagadka z mapą');
      expect(adv.handouts).toBeDefined();
      expect(adv.handouts?.length).toBeGreaterThanOrEqual(2);
    });

    it('parses uppercase scenario headers in TOC without crashing on unclosed parentheses in body lines', () => {
      const text = `
Zbiór scenariuszy
LEGENDA OZNACZENIA SCENARIUSZY
PISK, WIZG
Przygotowanie do gry ...........................................................5
Przedmowa ...........................................................................5
Dramatis Personae ................................................................9
ODŁAMEK
Wstęp ..............................................................................35
Dramatis Personae .........................................................35
${'Opis tła fabularnego w Muscoby. '.repeat(200)}
PISK, WIZG
Tom Gurteen, siostrzeniec Shirley (jego rodzice zginęli, gdy miał 10
lat podczas wypadku kolejowego).
ODŁAMEK
Odprawa w Klubie Niebieska Piramida w Londynie w 1926 roku.
      `;

      const scenarios = parseScenariosFromAnthologyText(text, 'ZC_Pisk-wizg-i-Odlamek.pdf');
      expect(scenarios).toHaveLength(2);
      expect(scenarios[0].title).toBe('Pisk, Wizg');
      expect(scenarios[1].title).toBe('Odłamek');
    });

    it('uses cleaned fileName instead of generic category label and creates distinct IDs per file', () => {
      const text1 = `
Zew Cthulhu Starter. Zasady skrócone Quick-Start d100.
Tworzenie Badacza, test umiejętności k100. Scenariusz: Nawiedzony dom i posiadłość Corbitta.
      `;
      const fp1 = detectRulebookProfile(text1, 'Starter_Edycja_1.pdf');
      const fp2 = detectRulebookProfile(text1, 'Starter_Edycja_2.pdf');

      const adv1 = buildLocalCustomAdventures(text1, fp1, dummyOverlay, 'Starter_Edycja_1.pdf', 32);
      const adv2 = buildLocalCustomAdventures(text1, fp2, dummyOverlay, 'Starter_Edycja_2.pdf', 32);
      expect(adv1[0].id).not.toBe(adv2[0].id);

      const customOneShotText = `
Krótki scenariusz do gry d100 w Arkham w 1924 roku. Badacze odkrywają tajemniczy dziennik w piwnicy.
      `;
      const fpCustom = detectRulebookProfile(customOneShotText, 'Tajemnica_Domu_Wiedźmy.pdf');
      const customAdvs = buildLocalCustomAdventures(
        customOneShotText,
        fpCustom,
        dummyOverlay,
        'Tajemnica_Domu_Wiedźmy.pdf',
        18
      );
      expect(customAdvs[0].title).toBe('Tajemnica Domu Wiedźmy');
    });

    it('extracts built-in scenarios from core-d100 (Keeper Rulebook / Księga Strażnika) and returns [] for short rules snippets without scenarios', () => {
      const coreRulesOnlySnippet = `
        Zew Cthulhu 7. edycja - Księga Strażnika.
        Rozdział 3: Tworzenie Badaczy. Rozdział 6: Walka. Rozdział 7: Pościgi. Rozdział 8: Poczytalność. Rozdział 9: Magia k100.
      `;
      const fpShort = detectRulebookProfile(
        coreRulesOnlySnippet,
        'ZewCthulhu_KsiegaStraznika_v.1.3.pdf'
      );
      expect(fpShort.profile).toBe('core-d100');
      const shortAdvs = buildLocalCustomAdventures(
        coreRulesOnlySnippet,
        fpShort,
        dummyOverlay,
        'ZewCthulhu_KsiegaStraznika_v.1.3.pdf',
        484
      );
      expect(shortAdvs).toEqual([]);

      const coreFullTocPl = `
        Zew Cthulhu Księga Strażnika. Edycja polska.
        ROZDZIAŁ 3 TWORZENIE BADACZY
        ROZDZIAŁ 7 POŚCIGI
        ROZDZIAŁ 8 POCZYTALNOŚĆ
        ROZDZIAŁ 15.1 - SCENARIUSZE
        POŚRÓD PRADAWNYCH DRZEW 394
        ROZDZIAŁ 15.2 - SCENARIUSZE
        SZKARŁATNE LITERY 414
      `;
      const fpPl = detectRulebookProfile(
        coreFullTocPl,
        'ZewCthulhu_KsiegaStraznika_v.1.3.pdf'
      );
      const advsPl = buildLocalCustomAdventures(
        coreFullTocPl,
        fpPl,
        dummyOverlay,
        'ZewCthulhu_KsiegaStraznika_v.1.3.pdf',
        484
      );
      expect(advsPl).toHaveLength(2);
      expect(advsPl[0].title).toBe('Pośród pradawnych drzew');
      expect(advsPl[0].sourceCategory).toBe('core');
      expect(advsPl[0].documentType).toBe('scenario');
      expect(advsPl[0].graph?.npcs?.map((n) => n.name)).toContain('Lucas Strong');
      expect(advsPl[0].graph?.npcs?.map((n) => n.name)).not.toContain('Bryce Fallon');
      // Issue #787: Sny Wezwania nie są handoutami w ekwipunku, lecz dedykowanymi rekordami narracyjnymi
      expect(advsPl[0].dreamCalls?.length).toBe(4);
      expect(advsPl[1].title).toBe('Szkarłatne litery');
      expect(advsPl[1].sourceCategory).toBe('core');
      expect(advsPl[1].documentType).toBe('scenario');
      expect(advsPl[1].graph?.npcs?.map((n) => n.name)).toContain('Bryce Fallon');
      expect(advsPl[1].graph?.npcs?.map((n) => n.name)).not.toContain('Lucas Strong');
      expect(advsPl[1].handouts?.length).toBeGreaterThanOrEqual(2);

      const coreVariantPl = `
        Zew Cthulhu Księga Strażnika. Walka, Pościgi, Poczytalność k100.
        Rozdział 17: Scenariusze - Wśród prastarych drzew oraz Szkarłatne litery.
      `;
      const fpVar = detectRulebookProfile(coreVariantPl, 'Ksiega_Straznika.pdf');
      const advsVar = buildLocalCustomAdventures(
        coreVariantPl,
        fpVar,
        dummyOverlay,
        'Ksiega_Straznika.pdf',
        450
      );
      expect(advsVar.map((a) => a.title)).toEqual([
        'Wśród prastarych drzew',
        'Szkarłatne litery',
      ]);
    });

    it('extracts the 4 built-in scenarios from pulp-d100 (Pulp Cthulhu) and returns [] for short pulp rules snippets', () => {
      const pulpRulesOnly = `
        Pulp Cthulhu. Two-Fisted Action And Adventure Against The Mythos.
        Pulp Archetypes, Pulp Talents, Sanity, Weird Science, and Luck d100.
      `;
      const fpShort = detectRulebookProfile(pulpRulesOnly, 'Pulp_Cthulhu.pdf');
      expect(fpShort.profile).toBe('pulp-d100');
      expect(
        buildLocalCustomAdventures(pulpRulesOnly, fpShort, dummyOverlay, 'Pulp_Cthulhu.pdf', 272)
      ).toEqual([]);

      const pulpFullToc = `
        PULP CTHULHU - Two-Fisted Action And Adventure Against The Mythos.
        Creating Pulp Heroes, Pulp Archetypes, Pulp Talents, Weird Science, Sanity.
        CHAPTER 10: THE DISINTEGRATOR, SCENARIO 135
        CHAPTER 11: WAITING FOR THE HURRICANE, SCENARIO 158
        CHAPTER 12: PANDORA’S BOX, SCENARIO 176
        CHAPTER 13: SLOW BOAT TO CHINA, SCENARIO 205
      `;
      const fpPulp = detectRulebookProfile(pulpFullToc, 'Call_of_Cthulhu_Pulp_Cthulhu.pdf');
      expect(fpPulp.profile).toBe('pulp-d100');
      const advsPulp = buildLocalCustomAdventures(
        pulpFullToc,
        fpPulp,
        dummyOverlay,
        'Call_of_Cthulhu_Pulp_Cthulhu.pdf',
        274
      );
      expect(advsPulp).toHaveLength(4);
      expect(advsPulp.map((a) => a.title)).toEqual([
        'The Disintegrator',
        'Waiting for the Hurricane',
        "Pandora's Box",
        'Slow Boat to China',
      ]);
      expect(advsPulp.every((a) => a.tone === 'pulp' && a.documentType === 'scenario')).toBe(true);
      expect(advsPulp.every((a) => (a.handouts?.length ?? 0) >= 1 && (a.graph?.locations?.length ?? 0) >= 2)).toBe(true);
      expect(advsPulp[0].graph?.npcs?.[0]?.name).not.toBe(advsPulp[1].graph?.npcs?.[0]?.name);
    });
  });

  describe('Node-Based Scenario Graph & Three Clue Rule RAW Integration (Milestone M3)', () => {
    it('gwarantuje calkowity brak atrap NPC ("Glowny Informator", "Kluczowa Postac") i atrap poszlak przy pustym overlayu', () => {
      const text = `
Scenariusz Jednorazowy: Cienie nad Innsmouth
Wprowadzenie: Agent federalny przybywa do portowego miasteczka Innsmouth w 1927 roku.
Śledztwo w rafinerii Marsha ujawnia mroczny kult Dagona.
      `;
      const fp = detectRulebookProfile(text, 'Cienie_nad_Innsmouth.pdf');
      const emptyOverlay: OverlayDescriptor = {
        ...dummyOverlay,
        entities: {
          npcs: [],
          creatures: [],
          spells: [],
          rules: [],
          handouts: [],
          adventures: [],
        },
      };

      const advs = buildLocalCustomAdventures(text, fp, emptyOverlay, 'Cienie_nad_Innsmouth.pdf', 30);
      expect(advs.length).toBeGreaterThanOrEqual(1);
      const adv = advs[0];
      const graph = adv.graph;
      expect(graph).toBeDefined();

      // a) Brak atrap w kolekcji npcs
      const dummyNpcNames = ['Główny Informator', 'Kluczowa Postać', 'Glowny Informator', 'Kluczowa Postac'];
      const actualNpcNames = graph?.npcs?.map((n) => n.name) || [];
      for (const dummy of dummyNpcNames) {
        expect(actualNpcNames).not.toContain(dummy);
      }

      // b) Brak atrap w wezlach nodes
      const actualNodeNames = graph?.nodes?.map((n) => n.name) || [];
      for (const dummy of dummyNpcNames) {
        expect(actualNodeNames).not.toContain(dummy);
      }

      // c) Brak atrap poszlak
      const dummyClueNames = [
        'Wstępny Trop / List Zlecający',
        'Tajemnicze Notatki',
        'Wstepny Trop / List Zlecajacy',
      ];
      const actualClueNames = graph?.clues?.map((c) => c.name) || [];
      for (const dummy of dummyClueNames) {
        expect(actualClueNames).not.toContain(dummy);
      }
    });

    it('generuje autentyczne wezly AdventureNode z prawidlowymi typami (intro, location, npc, event, climax)', () => {
      const coreFullTocPl = `
        Zew Cthulhu Księga Strażnika. Edycja polska.
        ROZDZIAŁ 15.1 - SCENARIUSZE
        POŚRÓD PRADAWNYCH DRZEW 394
        ROZDZIAŁ 15.2 - SCENARIUSZE
        SZKARŁATNE LITERY 414
      `;
      const fpPl = detectRulebookProfile(coreFullTocPl, 'ZewCthulhu_KsiegaStraznika_v.1.3.pdf');
      const advs = buildLocalCustomAdventures(coreFullTocPl, fpPl, dummyOverlay, 'ZewCthulhu_KsiegaStraznika_v.1.3.pdf', 484);

      expect(advs).toHaveLength(2);
      for (const adv of advs) {
        const nodes = adv.graph?.nodes;
        expect(Array.isArray(nodes)).toBe(true);
        expect(nodes!.length).toBeGreaterThanOrEqual(3);

        const allowedTypes: AdventureNodeType[] = ['intro', 'location', 'npc', 'event', 'climax'];
        for (const node of nodes!) {
          expect(allowedTypes).toContain(node.type);
          expect(typeof node.id).toBe('string');
          expect(node.id.length).toBeGreaterThan(0);
          expect(typeof node.name).toBe('string');
          expect(node.name.length).toBeGreaterThan(0);
          expect(Array.isArray(node.leadInClueIds)).toBe(true);
          expect(Array.isArray(node.leadOutClueIds)).toBe(true);
        }

        // Wezel wstepny oraz kulminacyjny musza wystapic w kompletnym grafie
        const introNodes = nodes!.filter((n) => n.type === 'intro');
        expect(introNodes.length).toBeGreaterThanOrEqual(1);

        const climaxNodes = nodes!.filter((n) => n.type === 'climax' || n.isClimax === true);
        expect(climaxNodes.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('automatycznie wywoluje ThreeClueRuleValidator i zapewnia minimum 3 poszlaki wejsciowe ze zroznicowanych zrodel dla waskich gardel', () => {
      const coreFullTocPl = `
        Zew Cthulhu Księga Strażnika. Edycja polska.
        ROZDZIAŁ 15.1 - SCENARIUSZE
        POŚRÓD PRADAWNYCH DRZEW 394
        ROZDZIAŁ 15.2 - SCENARIUSZE
        SZKARŁATNE LITERY 414
      `;
      const fpPl = detectRulebookProfile(coreFullTocPl, 'ZewCthulhu_KsiegaStraznika_v.1.3.pdf');
      const advs = buildLocalCustomAdventures(coreFullTocPl, fpPl, dummyOverlay, 'ZewCthulhu_KsiegaStraznika_v.1.3.pdf', 484);

      for (const adv of advs) {
        const graph = adv.graph!;
        expect(graph.nodes).toBeDefined();
        const bottlenecks = graph.nodes!.filter((n) => n.isBottleneck || n.isClimax || n.type === 'climax');
        expect(bottlenecks.length).toBeGreaterThanOrEqual(1);

        for (const bn of bottlenecks) {
          const leadInClues = graph.clues.filter((c) => {
            const isTargetMatch = c.targetNodeId === bn.id;
            const isLeadInMatch = bn.leadInClueIds.includes(c.id);
            const isConnMatch = graph.connections.some(
              (conn) => conn.toId === bn.id && conn.clueId === c.id
            );
            return (isTargetMatch || isLeadInMatch || isConnMatch) && !c.isRedHerring;
          });

          // Wymog 1: Minimum 3 wloty poszlak do waskiego gardla
          expect(leadInClues.length).toBeGreaterThanOrEqual(3);

          // Wymog 2: Dywersyfikacja zrodel dowodowych (min. 2 rozne kategorie sourceType)
          const sources = new Set(leadInClues.map((c) => c.sourceType).filter(Boolean));
          expect(sources.size).toBeGreaterThanOrEqual(2);
        }
      }
    });

    it('zapewnia scisla spojnosc referencyjna i topologiczna grafu (brak wiszacych krawedzi i osieroconych poszlak)', () => {
      const coreFullTocPl = `
        Zew Cthulhu Księga Strażnika. Edycja polska.
        ROZDZIAŁ 15.1 - SCENARIUSZE
        POŚRÓD PRADAWNYCH DRZEW 394
      `;
      const fpPl = detectRulebookProfile(coreFullTocPl, 'ZewCthulhu_KsiegaStraznika_v.1.3.pdf');
      const advs = buildLocalCustomAdventures(coreFullTocPl, fpPl, dummyOverlay, 'ZewCthulhu_KsiegaStraznika_v.1.3.pdf', 484);
      const adv = advs[0];
      const graph = adv.graph!;

      const nodeIds = new Set(graph.nodes!.map((n) => n.id));
      const clueIds = new Set(graph.clues.map((c) => c.id));

      for (const node of graph.nodes!) {
        for (const cId of node.leadInClueIds) {
          expect(clueIds.has(cId)).toBe(true);
        }
        for (const cId of node.leadOutClueIds) {
          expect(clueIds.has(cId)).toBe(true);
        }
      }

      for (const clue of graph.clues) {
        if (clue.targetNodeId) {
          expect(nodeIds.has(clue.targetNodeId)).toBe(true);
        }
      }

      for (const conn of graph.connections) {
        expect(conn.fromId).toBeDefined();
        expect(conn.toId).toBeDefined();
        if (conn.clueId) {
          expect(clueIds.has(conn.clueId)).toBe(true);
        }
      }
    });

    it('poprawnie wypelnia graf wezlowy dla wszystkich 4 scenariuszy Pulp Cthulhu', () => {
      const pulpFullToc = `
        PULP CTHULHU - Two-Fisted Action And Adventure Against The Mythos.
        CHAPTER 10: THE DISINTEGRATOR, SCENARIO 135
        CHAPTER 11: WAITING FOR THE HURRICANE, SCENARIO 158
        CHAPTER 12: PANDORA’S BOX, SCENARIO 176
        CHAPTER 13: SLOW BOAT TO CHINA, SCENARIO 205
      `;
      const fpPulp = detectRulebookProfile(pulpFullToc, 'Call_of_Cthulhu_Pulp_Cthulhu.pdf');
      const advsPulp = buildLocalCustomAdventures(pulpFullToc, fpPulp, dummyOverlay, 'Call_of_Cthulhu_Pulp_Cthulhu.pdf', 274);

      expect(advsPulp).toHaveLength(4);
      for (const adv of advsPulp) {
        expect(adv.graph?.nodes).toBeDefined();
        expect(adv.graph!.nodes!.length).toBeGreaterThanOrEqual(3);
        const climax = adv.graph!.nodes!.find((n) => n.isClimax || n.type === 'climax');
        expect(climax).toBeDefined();
        expect(climax!.leadInClueIds.length).toBeGreaterThanOrEqual(3);
      }
    });

    it('zachowuje pelna kolekcje npcs i locations dla wstecznej kompatybilnosci z UI i trybem offline', () => {
      const coreFullTocPl = `
        Zew Cthulhu Księga Strażnika. Edycja polska.
        ROZDZIAŁ 15.1 - SCENARIUSZE
        POŚRÓD PRADAWNYCH DRZEW 394
      `;
      const fpPl = detectRulebookProfile(coreFullTocPl, 'ZewCthulhu_KsiegaStraznika_v.1.3.pdf');
      const advs = buildLocalCustomAdventures(coreFullTocPl, fpPl, dummyOverlay, 'ZewCthulhu_KsiegaStraznika_v.1.3.pdf', 484);
      const adv = advs[0];

      expect(Array.isArray(adv.graph?.npcs)).toBe(true);
      expect(adv.graph!.npcs.length).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(adv.graph?.locations)).toBe(true);
      expect(adv.graph!.locations.length).toBeGreaterThanOrEqual(1);
    });

    it('gwarantuje absolutny brak znakow em-dash i en-dash w strukturach grafu', () => {
      const coreFullTocPl = `
        Zew Cthulhu Księga Strażnika. Edycja polska.
        ROZDZIAŁ 15.1 - SCENARIUSZE
        POŚRÓD PRADAWNYCH DRZEW 394
        ROZDZIAŁ 15.2 - SCENARIUSZE
        SZKARŁATNE LITERY 414
      `;
      const fpPl = detectRulebookProfile(coreFullTocPl, 'ZewCthulhu_KsiegaStraznika_v.1.3.pdf');
      const advs = buildLocalCustomAdventures(coreFullTocPl, fpPl, dummyOverlay, 'ZewCthulhu_KsiegaStraznika_v.1.3.pdf', 484);

      for (const adv of advs) {
        const serialized = JSON.stringify(adv.graph);
        expect(serialized).not.toMatch(/[\u2014\u2013]/);
      }
    });
  });

  describe('PDF Importer 100% RAW Extraction & GM Safety (Milestone M2)', () => {
    describe('cleanRawHandoutText', () => {
      it('cleans HTML comments, form feeds, normalizes dashes, and preserves paragraphs', () => {
        const raw =
          'Pierwszy akapit tekstu.\n<!-- Strona 42 -->\n<!-- Komentarz techniczny -->\n\fDrugi akapit z pauza \u2014 i polpauza \u2013 w srodku.\n\n\n\nTrzeci akapit.';
        const cleaned = cleanRawHandoutText(raw);

        expect(cleaned).not.toContain('<!-- Strona 42 -->');
        expect(cleaned).not.toContain('<!-- Komentarz techniczny -->');
        expect(cleaned).not.toContain('\f');
        expect(cleaned).not.toMatch(/[\u2013\u2014]/);
        expect(cleaned).toContain('Drugi akapit z pauza - i polpauza - w srodku.');
        expect(cleaned).toContain('Pierwszy akapit tekstu.\n\nDrugi akapit');
        expect(cleaned).toContain('\n\nTrzeci akapit.');
      });
    });

    describe('GM Safety Filter (isKeeperOrTacticalHandout & evaluateGmSafety)', () => {
      it('correctly classifies tactical floorplans as keeperOnly: true and isPlayerFacing: false', () => {
        const floorplan = evaluateGmSafety('Plan kondygnacji rezydencji Corbitta');
        expect(floorplan.keeperOnly).toBe(true);
        expect(floorplan.isPlayerFacing).toBe(false);

        const cellar = evaluateGmSafety('Rzut piwnic z oznaczeniem krypty');
        expect(cellar.keeperOnly).toBe(true);
        expect(cellar.isPlayerFacing).toBe(false);

        const tactical = evaluateGmSafety('Tactical Floor Plan of the Asylum');
        expect(tactical.keeperOnly).toBe(true);
        expect(tactical.isPlayerFacing).toBe(false);
      });

      it('correctly classifies explicit Keeper sections as keeperOnly: true', () => {
        const keeperSecret = evaluateGmSafety('DODATEK 2: Sekrety Strażnika - Prawda o rytuale');
        expect(keeperSecret.keeperOnly).toBe(true);
        expect(keeperSecret.isPlayerFacing).toBe(false);

        const gmOnly = evaluateGmSafety('Informacje dla Strażnika Tajemnic');
        expect(gmOnly.keeperOnly).toBe(true);
        expect(gmOnly.isPlayerFacing).toBe(false);

        const englishKeeper = evaluateGmSafety("Handout 5: Keeper's Map of Catacombs");
        expect(englishKeeper.keeperOnly).toBe(true);
        expect(englishKeeper.isPlayerFacing).toBe(false);

        const gmNotes = evaluateGmSafety('Pomoc dla MG: Informacje poufne');
        expect(gmNotes.keeperOnly).toBe(true);
        expect(gmNotes.isPlayerFacing).toBe(false);
      });

      it('retains isPlayerFacing: true for legitimate player handouts', () => {
        const map = evaluateGmSafety('POMOC DLA GRACZY #1 - Mapa rejonu Tatr');
        expect(map.keeperOnly).toBe(false);
        expect(map.isPlayerFacing).toBe(true);

        const newspaper = evaluateGmSafety('POMOC DLA GRACZY #2 - Wycinek z Gazety Podhalańskiej');
        expect(newspaper.keeperOnly).toBe(false);
        expect(newspaper.isPlayerFacing).toBe(true);

        const letter = evaluateGmSafety('DODATEK 3: List od profesora Smitha');
        expect(letter.keeperOnly).toBe(false);
        expect(letter.isPlayerFacing).toBe(true);
      });

      it('prioritizes explicit Keeper directives over player handout headers', () => {
        const conflicted = evaluateGmSafety('POMOC DLA GRACZY #4 - Plan lochów (Tylko dla Strażnika)');
        expect(conflicted.keeperOnly).toBe(true);
        expect(conflicted.isPlayerFacing).toBe(false);
      });

      it('inspects RAW content snippet when title is generic', () => {
        const contentTriggered = evaluateGmSafety(
          'DODATEK 7',
          'TYLKO DLA STRAŻNIKA: Ten dokument zawiera rozwiązanie zagadki i nie może być udostępniony badaczom.'
        );
        expect(contentTriggered.keeperOnly).toBe(true);
        expect(contentTriggered.isPlayerFacing).toBe(false);
      });

      it('protects diegetic guards from false positive trigger (lighthouse keeper, prison guard)', () => {
        const lighthouse = evaluateGmSafety('DODATEK 4: Zapiski strażnika latarni morskiej');
        expect(lighthouse.keeperOnly).toBe(false);
        expect(lighthouse.isPlayerFacing).toBe(true);

        const prisonGuard = evaluateGmSafety('POMOC 5: Zeznanie strażnika więziennego');
        expect(prisonGuard.keeperOnly).toBe(false);
        expect(prisonGuard.isPlayerFacing).toBe(true);

        const enLighthouse = evaluateGmSafety('Handout 2: Journal of the lighthouse keeper');
        expect(enLighthouse.keeperOnly).toBe(false);
        expect(enLighthouse.isPlayerFacing).toBe(true);
      });
    });

    describe('extractHandoutsFromScenarioText & Multilingual Headers', () => {
      it('extracts diverse Polish handout headers with correct types, titles, and slugs', () => {
        const text = `
ROZDZIAŁ 1
POMOC DLA GRACZY 1 - Mapa portu w Gdyni
POMOC 2: List od komisarza
ZAŁĄCZNIK 3: Raport z sekcji zwłok
ZAŁĄCZNIK A: Zapiski spirytysty
DODATEK 4: Wycinek z Kuriera Warszawskiego
REKWIZYT 5: Telegram ze Lwowa
        `;

        const handouts = extractHandoutsFromScenarioText(text, 'Tajemnica Gdyni', 'pl');
        expect(handouts.length).toBe(6);

        expect(handouts[0].handoutType).toBe('map');
        expect(handouts[0].title).toBe('Mapa portu w Gdyni');
        expect(handouts[0].slug).toBe('tajemnica-gdyni-pomoc-1');
        expect(handouts[0].chapterId).toBe('rozdzial-1');

        expect(handouts[1].handoutType).toBe('letter');
        expect(handouts[1].title).toBe('List od komisarza');
        expect(handouts[1].slug).toBe('tajemnica-gdyni-pomoc-2');

        expect(handouts[2].handoutType).toBe('report');
        expect(handouts[2].title).toBe('Raport z sekcji zwłok');
        expect(handouts[2].slug).toBe('tajemnica-gdyni-pomoc-3');

        expect(handouts[3].handoutType).toBe('diary');
        expect(handouts[3].title).toBe('Zapiski spirytysty');
        expect(handouts[3].slug).toBe('tajemnica-gdyni-pomoc-a');

        expect(handouts[4].handoutType).toBe('newspaper');
        expect(handouts[4].title).toBe('Wycinek z Kuriera Warszawskiego');
        expect(handouts[4].slug).toBe('tajemnica-gdyni-pomoc-4');

        expect(handouts[5].handoutType).toBe('telegram');
        expect(handouts[5].title).toBe('Telegram ze Lwowa');
        expect(handouts[5].slug).toBe('tajemnica-gdyni-pomoc-5');
      });

      it('extracts English handout headers with proper types and chapterIds', () => {
        const text = `
CHAPTER 2
Handout 1: The Arkham Witch-Trial Papers
Player Handout 2: Police Dossier
Appendix A: Floor Plan of the Sanitarium
Exhibit 1: The Telegraph Wire
        `;

        const handouts = extractHandoutsFromScenarioText(text, 'Shadows over Arkham', 'en');
        expect(handouts.length).toBe(4);

        expect(handouts[0].title).toBe('The Arkham Witch-Trial Papers');
        expect(handouts[0].slug).toBe('shadows-over-arkham-handout-1');
        expect(handouts[0].chapterId).toBe('chapter-2');

        expect(handouts[1].handoutType).toBe('report');
        expect(handouts[1].title).toBe('Police Dossier');
        expect(handouts[1].slug).toBe('shadows-over-arkham-handout-2');

        expect(handouts[2].handoutType).toBe('map');
        expect(handouts[2].keeperOnly).toBe(true);
        expect(handouts[2].isPlayerFacing).toBe(false);

        expect(handouts[3].handoutType).toBe('telegram');
      });

      it('extracts chapterId from header line prefix or preceding chapter context', () => {
        const text = `
Rozdział 2: Pomoc 1 - Szkic sytuacyjny
Chapter 3: Handout 2 - Intercepted Letter
Akt 1 - Załącznik A - Manifest loży
        `;

        const handouts = extractHandoutsFromScenarioText(text, 'Test Kampanii', 'unknown');
        expect(handouts.length).toBe(3);
        expect(handouts[0].chapterId).toBe('rozdzial-2');
        expect(handouts[1].chapterId).toBe('chapter-3');
        expect(handouts[2].chapterId).toBe('akt-1');
      });
    });

    describe('100% RAW Text Extraction', () => {
      it('extracts intact RAW body text with paragraphs and excludes synthetic placeholder', () => {
        const text = `
ROZDZIAŁ 1
LIST PROFESORA

POMOC DLA GRACZY #1 - List profesora Webba
Drogi Przyjacielu,

<!-- Strona 14 -->
Pisze do Ciebie w pospiechu, poniewaz odkrylem cos niepokojacego w archiwach Miskatonic.
Nie ufaj nikomu w departamencie archeologii.

Z powazaniem,
Profesor Webb

POMOC DLA GRACZY #2 - Notatka z prosektorium
Denat mial na piersi naciety symbol oka.
        `;

        const handouts = extractHandoutsFromScenarioText(text, 'List Profesora', 'pl');
        expect(handouts.length).toBe(2);

        const h1 = handouts[0];
        expect(h1.textContent).toBeDefined();
        expect(h1.textContent).toContain('Drogi Przyjacielu,');
        expect(h1.textContent).toContain('Pisze do Ciebie w pospiechu');
        expect(h1.textContent).toContain('Z powazaniem,\nProfesor Webb');
        expect(h1.textContent).not.toContain('<!-- Strona 14 -->');
        expect(h1.textContent).not.toContain('Załącznik śledczy powiązany');

        const h2 = handouts[1];
        expect(h2.textContent).toBe('Denat mial na piersi naciety symbol oka.');
      });
    });

    describe('Uncapped Handouts Count (> 10 items)', () => {
      it('extracts all handouts when scenario contains 15 items without 10-item truncation', () => {
        const items = Array.from({ length: 15 }, (_, i) => `POMOC DLA GRACZY #${i + 1} - Dokument dowodowy numer ${i + 1}`).join('\n');
        const text = `
ROZDZIAŁ 1
ARCHIWUM TAJEMNIC
${items}
        `;

        const handouts = extractHandoutsFromScenarioText(text, 'Archiwum Tajemnic', 'pl');
        expect(handouts.length).toBe(15);
        expect(handouts[10].title).toBe('Dokument dowodowy numer 11');
        expect(handouts[14].title).toBe('Dokument dowodowy numer 15');
      });
    });

    describe('Slug Collision Safety', () => {
      it('generates unique non-colliding slugs for long scenario titles', () => {
        const text = `
POMOC DLA GRACZY #1 - Pierwsza czesc zeznania
POMOC DLA GRACZY #1 - Druga czesc zeznania
POMOC DLA GRACZY #2 - List komisarza
        `;

        const longTitle = 'Nawiedzony dwor w dolinie mgliscie zarosnietych wzgorz';
        const handouts = extractHandoutsFromScenarioText(text, longTitle, 'pl');

        expect(handouts.length).toBe(3);
        const slugs = handouts.map((h) => h.slug);
        const uniqueSlugs = new Set(slugs);
        expect(uniqueSlugs.size).toBe(3);
        for (const slug of slugs) {
          expect(slug.length).toBeLessThanOrEqual(40);
        }
      });
    });

    describe('End-to-end Integration with buildLocalCustomAdventures & buildHandoutsContext', () => {
      it('segregates player and keeper handouts in scenario build and feeds buildHandoutsContext safely', () => {
        const text = `
ROZDZIAŁ 1
TAJEMNICA SANATORIUM

LEGENDA OZNACZENIA SCENARIUSZY
Stopień trudności: Średni 
Liczba sesji: ➋

POMOC DLA GRACZY #1 - Mapa okolic Zakopanego
Dojazd do sanatorium jest mozliwy wylacznie przez Przelecz pod Koza.

POMOC DLA GRACZY #2 - Wycinek z gazety
Tajemnicze znikniecie pacjenta z Sanatorium Czerwony Dwor.

DODATEK 3: Plan kondygnacji sanatorium (Tylko dla Strażnika)
Piwnica zawiera cele i tajne laboratorium dr. Von Kissa.

DODATEK 4: Rzut piwnic z rozmieszczeniem kultystów
W zachodnim skrzydle czuwa trzech wartownikow.
        `;

        const profile = detectRulebookProfile(text, 'Test_Sanatorium.pdf');
        const adventures = buildLocalCustomAdventures(
          text,
          profile,
          dummyOverlay,
          'Test_Sanatorium.pdf',
          30
        );

        expect(adventures.length).toBe(1);
        const adv = adventures[0];
        expect(adv.handouts).toBeDefined();
        expect(adv.handouts?.length).toBe(4);

        const playerFacing = adv.handouts?.filter((h) => !h.keeperOnly && h.isPlayerFacing !== false);
        const keeperOnly = adv.handouts?.filter((h) => h.keeperOnly === true || h.isPlayerFacing === false);

        expect(playerFacing?.length).toBe(2);
        expect(keeperOnly?.length).toBe(2);

        expect(playerFacing?.[0].title).toContain('Mapa okolic Zakopanego');
        expect(playerFacing?.[1].title).toContain('Wycinek z gazety');
        expect(keeperOnly?.[0].title).toContain('Plan kondygnacji');
        expect(keeperOnly?.[1].title).toContain('Rzut piwnic');

        // Weryfikacja z buildHandoutsContext:
        const promptContext = buildHandoutsContext(adv.handouts, adv.puzzles, {
          activeChapterId: 'rozdzial-1',
        });

        // 1. Jawne handouty graczy musza miec instrukcje uzycia tagu [HANDOUT:<slug>]
        expect(promptContext).toContain('DOSTĘPNE HANDOUTY');
        expect(promptContext).toContain(`[HANDOUT:${playerFacing?.[0].slug}]`);
        expect(promptContext).toContain(`[HANDOUT:${playerFacing?.[1].slug}]`);

        // 2. Plany taktyczne Straznika musza trafic wylacznie do sekcji Straznika z zakazem wreczania
        expect(promptContext).toContain('MATERIAŁY I PLANY STRAŻNIKA (KEEPER-ONLY - ZAKAZ WRĘCZANIA GRACZOM)');
        expect(promptContext).toContain('Plan kondygnacji');
        expect(promptContext).toContain('Rzut piwnic');

        // 3. Plany taktyczne NIGDY nie moga miec instrukcji wreczania tagiem do gracza
        expect(promptContext).not.toContain(`[HANDOUT:${keeperOnly?.[0].slug}]`);
        expect(promptContext).not.toContain(`[HANDOUT:${keeperOnly?.[1].slug}]`);
      });

      it('guarantees zero em-dash and en-dash in all extracted handouts', () => {
        const text = `
ROZDZIAŁ 1 - TEST MYSLNIKOW
POMOC DLA GRACZY #1 \u2014 Mapa terenu \u2013 poludniowy sektor
Dokument zawiera wycinek \u2014 z kroniki \u2013 miejskiej.
        `;

        const handouts = extractHandoutsFromScenarioText(text, 'Test Myslnikow', 'pl');
        expect(handouts.length).toBe(1);
        const h = handouts[0];
        expect(h.title).not.toMatch(/[\u2013\u2014]/);
        expect(h.slug).not.toMatch(/[\u2013\u2014]/);
        expect(h.textContent).not.toMatch(/[\u2013\u2014]/);
      });
    });
  });
});
