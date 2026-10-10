import { getAdventureById, getQuickSetupAdventures } from '@/lib/adventures-data';
import { extractLatestTagLocation } from '@/lib/parsers/event-parser';
import {
  buildHandoutsContext,
  type BuildHandoutsContextOptions,
} from '../build-handouts-context';
import type { AdventureHandout, AdventurePuzzle } from '@/lib/adventures-data';

describe('buildHandoutsContext (Milestone M1: Scoping & Deterministic Serving)', () => {
  const sampleHandouts: AdventureHandout[] = [
    {
      slug: 'global-newspaper-clipping',
      title: 'Wycinek z Gazety Toruńskiej',
      image: '/handouts/gazeta.png',
      handoutType: 'newspaper',
      textContent: 'Wczoraj w nocy w tajemniczych okolicznościach zaginął kustosz muzeum.',
      isPlayerFacing: true,
      keeperOnly: false,
    },
    {
      slug: 'ch1-diary-page',
      title: 'Dziennik Profesora - Karta 12',
      image: '/handouts/dziennik.png',
      handoutType: 'diary',
      textContent: 'Odkrycie w piwnicy przekracza ludzkie pojęcie...',
      isPlayerFacing: true,
      keeperOnly: false,
      chapterId: 'rozdzial-1',
    },
    {
      slug: 'ch1-loc-library-letter',
      title: 'List z Miskatonic',
      image: '/handouts/list.png',
      handoutType: 'letter',
      textContent: 'Drogi Kolego, strzeż się księgi z żelaznym okuciem.',
      isPlayerFacing: true,
      keeperOnly: false,
      chapterId: 'rozdzial-1',
      locationId: 'biblioteka-miejska',
      nodeId: 'node-biblioteka',
    },
    {
      slug: 'ch1-loc-cellar-sketch',
      title: 'Szkic Symbolu z Piwnicy',
      image: '/handouts/szkic.png',
      handoutType: 'report',
      textContent: 'Odręczny szkic dziwnego trójkątnego symbolu.',
      isPlayerFacing: true,
      keeperOnly: false,
      chapterId: 'rozdzial-1',
      locationId: 'piwnica-posiadlosci',
      nodeId: 'node-piwnica',
    },
    {
      slug: 'ch2-telegram-arkham',
      title: 'Telegram z Arkham',
      image: '/handouts/telegram.png',
      handoutType: 'telegram',
      textContent: 'PRZYBYWAJCIE NATYCHMIAST STOP SPRAWA PILNA STOP',
      isPlayerFacing: true,
      keeperOnly: false,
      chapterId: 'rozdzial-2',
      locationId: 'dworzec-kolejowy',
    },
    {
      slug: 'keeper-mansion-tactical-map',
      title: 'Plan Taktyczny Rezydencji (Rzut Kondygnacji)',
      image: '/handouts/plan-rezydencji.png',
      handoutType: 'map',
      textContent: 'Korytarz wschodni ma ukrytą zapadnię. W salonie ukrywa się kultysta.',
      isPlayerFacing: false,
      keeperOnly: true,
      chapterId: 'rozdzial-1',
    },
    {
      slug: 'keeper-global-secret-notes',
      title: 'Tajemnice Mistrza Gry - Rytuał Zaćmienia',
      image: '/handouts/tajemnice.png',
      handoutType: 'book',
      textContent: 'Rytuał dopełni się o północy. Złożenie ofiary z kustosza otwiera bramę.',
      keeperOnly: true,
    },
  ];

  const samplePuzzles: AdventurePuzzle[] = [
    {
      id: 'puzzle-iron-box',
      title: 'Żelazna Kasetka z Runami',
      description: 'Zamek kasetki wymaga ułożenia trzech run według gwiazdozbioru.',
      solutionSummary: 'Ułożenie run Byk, Orion, Plejady otwiera podwójne dno.',
      clues: ['Notatka w bibliotece wspomina o zimowym niebie', 'Zegar w salonie wskazuje godzinę 21:00'],
      ideaRollPrompt: 'Test INT pozwala powiązać układ run na kasecie z mapą nieba z gabinetu.',
    },
  ];

  describe('Purity and Empty Handling', () => {
    it('returns empty string when no handouts and no puzzles are provided', () => {
      expect(buildHandoutsContext()).toBe('');
      expect(buildHandoutsContext(null, null)).toBe('');
      expect(buildHandoutsContext([], [])).toBe('');
    });

    it('returns only puzzles section when handouts array is empty but puzzles exist', () => {
      const result = buildHandoutsContext([], samplePuzzles);
      expect(result).not.toContain('## DOSTĘPNE HANDOUTY');
      expect(result).not.toContain('## MATERIAŁY I PLANY STRAŻNIKA');
      expect(result).toContain('## ZAGADKI LOGICZNE I ŁAMIGŁÓWKI ŚLEDZTWA (RAW)');
      expect(result).toContain('Żelazna Kasetka z Runami');
    });

    it('returns only player handouts when no puzzles exist', () => {
      const handoutsOnly: AdventureHandout[] = [sampleHandouts[0]];
      const result = buildHandoutsContext(handoutsOnly, null);
      expect(result).toContain('## DOSTĘPNE HANDOUTY');
      expect(result).not.toContain('## ZAGADKI LOGICZNE');
      expect(result).not.toContain('## MATERIAŁY I PLANY STRAŻNIKA');
    });
  });

  describe('Backward Compatibility', () => {
    it('includes all player-facing handouts when called without options', () => {
      const result = buildHandoutsContext(sampleHandouts, null);

      expect(result).toContain('## DOSTĘPNE HANDOUTY (realne dokumenty tej przygody)');
      expect(result).toContain('Wycinek z Gazety Toruńskiej');
      expect(result).toContain('Dziennik Profesora - Karta 12');
      expect(result).toContain('List z Miskatonic');
      expect(result).toContain('Szkic Symbolu z Piwnicy');
      expect(result).toContain('Telegram z Arkham');

      // Keeper-only materials must not be in player handouts
      expect(result).toContain('## MATERIAŁY I PLANY STRAŻNIKA (KEEPER-ONLY - ZAKAZ WRĘCZANIA GRACZOM)');
    });
  });

  describe('Tag Instruction Generation', () => {
    it('instructs GM to emit EXACTLY [HANDOUT:<slug>] on a separate line', () => {
      const result = buildHandoutsContext([sampleHandouts[0]], null);

      expect(result).toContain(
        'wstaw dokładnie tag: [HANDOUT:<slug>] w osobnej linii po opisie sceny. Nie parafrazuj ani nie zmyślaj treści dokumentu w narracji.'
      );
      expect(result).toContain('- Wycinek z Gazety Toruńskiej → wstaw dokładnie: [HANDOUT:global-newspaper-clipping]');
    });

    it('does not instruct old markdown image syntax in player list', () => {
      const result = buildHandoutsContext([sampleHandouts[0]], null);
      expect(result).not.toContain('`![Wycinek z Gazety Toruńskiej](/handouts/gazeta.png)`');
    });
  });

  describe('Keeper-Only & isPlayerFacing: false Isolation', () => {
    it('strictly excludes keeperOnly: true and isPlayerFacing: false from player handouts list', () => {
      const result = buildHandoutsContext(sampleHandouts, null);

      // Extract the player handouts section
      const playerSection = result.split('## MATERIAŁY I PLANY STRAŻNIKA')[0];

      expect(playerSection).not.toContain('Plan Taktyczny Rezydencji');
      expect(playerSection).not.toContain('[HANDOUT:keeper-mansion-tactical-map]');
      expect(playerSection).not.toContain('Tajemnice Mistrza Gry');
      expect(playerSection).not.toContain('[HANDOUT:keeper-global-secret-notes]');
    });

    it('creates segregated Keeper reference section with strict prohibitions', () => {
      const result = buildHandoutsContext(sampleHandouts, null);

      expect(result).toContain('## MATERIAŁY I PLANY STRAŻNIKA (KEEPER-ONLY - ZAKAZ WRĘCZANIA GRACZOM)');
      expect(result).toContain('BEZWZGLĘDNY ZAKAZ: Nigdy nie emituj tagu [HANDOUT:...] dla tych materiałów!');
      expect(result).toContain('ZAKAZ bezpośredniego wręczania, pokazywania lub cytowania 1:1 tych materiałów graczom.');
      expect(result).toContain('Plan Taktyczny Rezydencji (Rzut Kondygnacji) (slug: keeper-mansion-tactical-map)');
      expect(result).toContain('Korytarz wschodni ma ukrytą zapadnię');
      expect(result).toContain('Tajemnice Mistrza Gry - Rytuał Zaćmienia (slug: keeper-global-secret-notes)');
      expect(result).toContain('Rytuał dopełni się o północy');

      // Crucial: Keeper section MUST NOT contain instructions like "[HANDOUT:keeper-..."
      expect(result).not.toContain('[HANDOUT:keeper-mansion-tactical-map]');
      expect(result).not.toContain('[HANDOUT:keeper-global-secret-notes]');
    });

    it('renders only Keeper section when all handouts are keeperOnly', () => {
      const keeperOnlyHandouts: AdventureHandout[] = [
        sampleHandouts[5], // keeper-mansion-tactical-map
        sampleHandouts[6], // keeper-global-secret-notes
      ];

      const result = buildHandoutsContext(keeperOnlyHandouts, null);

      expect(result).not.toContain('## DOSTĘPNE HANDOUTY');
      expect(result).toContain('## MATERIAŁY I PLANY STRAŻNIKA (KEEPER-ONLY - ZAKAZ WRĘCZANIA GRACZOM)');
      expect(result).toContain('Plan Taktyczny Rezydencji');
    });

    it('omits Keeper section completely when no keeper-only materials exist', () => {
      const playerOnlyHandouts: AdventureHandout[] = [sampleHandouts[0], sampleHandouts[1]];

      const result = buildHandoutsContext(playerOnlyHandouts, null);

      expect(result).toContain('## DOSTĘPNE HANDOUTY');
      expect(result).not.toContain('## MATERIAŁY I PLANY STRAŻNIKA');
    });
  });

  describe('Chapter Scoping (Isolation per Chapter / Act)', () => {
    it('includes chapter-matching handouts and global handouts, excluding other chapters', () => {
      const options: BuildHandoutsContextOptions = {
        activeChapterId: 'rozdzial-1',
      };

      const result = buildHandoutsContext(sampleHandouts, null, options);

      // Included: global handout and chapter 1 handouts
      expect(result).toContain('Wycinek z Gazety Toruńskiej'); // Global
      expect(result).toContain('Dziennik Profesora - Karta 12'); // Chapter 1
      expect(result).toContain('List z Miskatonic'); // Chapter 1
      expect(result).toContain('Szkic Symbolu z Piwnicy'); // Chapter 1

      // Excluded: chapter 2 handout
      expect(result).not.toContain('Telegram z Arkham');
      expect(result).not.toContain('ch2-telegram-arkham');
    });

    it('supports numeric activeChapterId matching string chapter IDs', () => {
      const options: BuildHandoutsContextOptions = {
        activeChapterId: 2,
      };

      const result = buildHandoutsContext(sampleHandouts, null, options);

      // Chapter 2 matches
      expect(result).toContain('Telegram z Arkham');
      // Global matches
      expect(result).toContain('Wycinek z Gazety Toruńskiej');
      // Chapter 1 excluded
      expect(result).not.toContain('Dziennik Profesora - Karta 12');
      expect(result).not.toContain('List z Miskatonic');
    });

    it('scopes keeper materials by chapter when chapterId is present on keeper item', () => {
      const options: BuildHandoutsContextOptions = {
        activeChapterId: 'rozdzial-2',
      };

      const result = buildHandoutsContext(sampleHandouts, null, options);

      // Global keeper notes remain
      expect(result).toContain('Tajemnice Mistrza Gry - Rytuał Zaćmienia');
      // Chapter 1 keeper tactical map is excluded
      expect(result).not.toContain('Plan Taktyczny Rezydencji');
    });
  });

  describe('Location & Node Scoping (Isolation per Scene / Location)', () => {
    it('filters player handouts matching currentLocation, keeping global handouts', () => {
      const options: BuildHandoutsContextOptions = {
        activeChapterId: 'rozdzial-1',
        currentLocation: 'biblioteka-miejska',
      };

      const result = buildHandoutsContext(sampleHandouts, null, options);

      // Matched: Library letter
      expect(result).toContain('List z Miskatonic');
      expect(result).toContain('[HANDOUT:ch1-loc-library-letter]');

      // Matched: Global handout and chapter-global handout
      expect(result).toContain('Wycinek z Gazety Toruńskiej');
      expect(result).toContain('Dziennik Profesora - Karta 12');

      // Excluded: Cellar sketch (location does not match)
      expect(result).not.toContain('Szkic Symbolu z Piwnicy');
      expect(result).not.toContain('ch1-loc-cellar-sketch');

      // Excluded: Chapter 2 telegram
      expect(result).not.toContain('Telegram z Arkham');
    });

    it('filters player handouts matching activeNodeId', () => {
      const options: BuildHandoutsContextOptions = {
        activeChapterId: 'rozdzial-1',
        activeNodeId: 'node-piwnica',
      };

      const result = buildHandoutsContext(sampleHandouts, null, options);

      // Matched: Cellar sketch via nodeId
      expect(result).toContain('Szkic Symbolu z Piwnicy');
      expect(result).toContain('[HANDOUT:ch1-loc-cellar-sketch]');

      // Excluded: Library letter (nodeId does not match)
      expect(result).not.toContain('List z Miskatonic');
    });

    it('supports partial case-insensitive location matching', () => {
      const options: BuildHandoutsContextOptions = {
        activeChapterId: 'rozdzial-1',
        currentLocation: 'Biblioteka', // Partial match against 'biblioteka-miejska'
      };

      const result = buildHandoutsContext(sampleHandouts, null, options);

      expect(result).toContain('List z Miskatonic');
      expect(result).not.toContain('Szkic Symbolu z Piwnicy');
    });

    it('includes all chapter location handouts when no location option is provided', () => {
      const options: BuildHandoutsContextOptions = {
        activeChapterId: 'rozdzial-1',
      };

      const result = buildHandoutsContext(sampleHandouts, null, options);

      // Both library and cellar are included because no location filter was passed
      expect(result).toContain('List z Miskatonic');
      expect(result).toContain('Szkic Symbolu z Piwnicy');
    });
  });

  describe('Full Scoping Integration with Puzzles', () => {
    it('generates complete prompt section containing scoped handouts, keeper notes, and logic puzzles', () => {
      const options: BuildHandoutsContextOptions = {
        activeChapterId: 'rozdzial-1',
        currentLocation: 'biblioteka-miejska',
      };

      const result = buildHandoutsContext(sampleHandouts, samplePuzzles, options);

      // Player handouts section
      expect(result).toContain('## DOSTĘPNE HANDOUTY (realne dokumenty tej przygody)');
      expect(result).toContain('[HANDOUT:ch1-loc-library-letter]');

      // Keeper-only section
      expect(result).toContain('## MATERIAŁY I PLANY STRAŻNIKA (KEEPER-ONLY - ZAKAZ WRĘCZANIA GRACZOM)');
      expect(result).toContain('Tajemnice Mistrza Gry');

      // Puzzles section
      expect(result).toContain('## ZAGADKI LOGICZNE I ŁAMIGŁÓWKI ŚLEDZTWA (RAW)');
      expect(result).toContain('Żelazna Kasetka z Runami');
      expect(result).toContain('ZASADA IDEA ROLL');
      expect(result).toContain('ZASADA FAIL-FORWARD');
    });
  });
});


describe('audio node scoping #665', () => {
  const handout: AdventureHandout = {
    slug: 'audio-sb-wiretap-elblag', title: 'Tape', image: '',
    audioUrl: '/audio/handouts/cien-nad-prabutami/tasma-sb-elblag.mp3',
    nodeId: 'node-msw-warszawa',
  };
  it.each([undefined, {}, { activeNodeId: 'node-msw' },
    { currentLocation: 'node-msw-warszawa' },
    { activeNodeId: 'node-msw-warszawa-annex' }])(
    'does not offer audio without an exact active node: %j', (options) => {
      expect(buildHandoutsContext([handout], [], options)).not.toContain('[HANDOUT:audio-sb-wiretap-elblag]');
    });
  it('offers the tape at its exact node only after examining the carrier', () => {
    const context = buildHandoutsContext([handout], [], { activeNodeId: handout.nodeId });
    expect(context).toContain('[HANDOUT:audio-sb-wiretap-elblag]');
    expect(context).toContain('nośnik');
  });
});

it('discovers audio after travel using the exact graph node name, not the stale starting node', () => {
 const adventure = getAdventureById('cien-nad-prabutami');
 const tape = adventure.handouts.find((h: AdventureHandout) => h.audioUrl);
 const node = adventure.graph.nodes.find((n: { id: string }) => n.id === tape.nodeId);
 expect(buildHandoutsContext([tape], [], {
   adventureId: adventure.id, activeNodeId: 'node-warszawa-redakcja', currentLocation: node.name,
 })).toContain(`[HANDOUT:${tape.slug}]`);
 expect(buildHandoutsContext([tape], [], {
   adventureId: adventure.id, activeNodeId: tape.nodeId, currentLocation: 'Elsewhere',
 })).not.toContain(`[HANDOUT:${tape.slug}]`);
});


it.each(['pl', 'en'])('discovers audio after the actual location parser in %s Quick Setup', locale => {
 for (const adventure of getQuickSetupAdventures(locale)) {
   for (const tape of adventure.handouts?.filter(handout => handout.audioUrl) || []) {
     const options = { adventureId: adventure.id, activeNodeId: 'old-node', currentLocation: 'Elsewhere' };
     const before = buildHandoutsContext([tape], [], options);
     expect(before).not.toContain(`[HANDOUT:${tape.slug}]`);
     const tag = before.match(/\[LOKACJA:[^\]]+\]/)?.[0];
     expect(tag).toBeDefined();
     const location = extractLatestTagLocation(tag || '');
     expect(location).not.toBeNull();
     expect(buildHandoutsContext([tape], [], { ...options, currentLocation: location?.name })).toContain(`[HANDOUT:${tape.slug}]`);
   }
 }
});
