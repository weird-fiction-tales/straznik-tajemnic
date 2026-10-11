import fs from 'fs';
import path from 'path';
import {
  buildHandoutsContext,
  type BuildHandoutsContextOptions,
} from '../build-handouts-context';
import type { AdventureHandout, AdventurePuzzle } from '@/lib/adventures-data';

describe('Empirical Challenger 2: M1 Backward Compatibility & Boundary Testing', () => {
  const predefinedDir = path.resolve(process.cwd(), '../../../data/adventures/predefined');

  const predefinedFiles = [
    'cien-nad-prabutami.json',
    'tajemnica-pendnika-lagiewki.json',
    'tajemnica-dzieci-z-traszyna.json',
    'przybysz-z-matriksa-glogow.json',
  ];

  describe('1. Real Predefined Scenarios (Legacy Calls Without Options)', () => {
    predefinedFiles.forEach((file) => {
      it(`loads and processes ${file} without options`, () => {
        const filePath = path.join(predefinedDir, file);
        expect(fs.existsSync(filePath)).toBe(true);

        const rawData = fs.readFileSync(filePath, 'utf-8');
        const scenario = JSON.parse(rawData);

        expect(Array.isArray(scenario.handouts)).toBe(true);
        expect(scenario.handouts.length).toBeGreaterThan(0);

        // Call without options (legacy call)
        const result = buildHandoutsContext(scenario.handouts, scenario.puzzles);

        expect(result).toBeDefined();
        expect(typeof result).toBe('string');

        // Paper handouts retain legacy visibility; audio needs a known physical node.
        expect(result).toContain('## DOSTĘPNE HANDOUTY (realne dokumenty tej przygody)');
        expect(result).not.toContain('## MATERIAŁY I PLANY STRAŻNIKA');

        // Preserve paper evidence and forbid premature audio discovery.
        scenario.handouts.forEach((h: AdventureHandout) => {
          if (h.audioUrl) {
            expect(result).not.toContain(`[HANDOUT:${h.slug}]`);
            expect(result).not.toContain(h.title);
            return;
          }
          expect(result).toContain(h.title);
          expect(result).toContain(`[HANDOUT:${h.slug}]`);
          expect(result).toContain(`- ${h.title} → wstaw dokładnie: [HANDOUT:${h.slug}]`);
        });

        // Ensure instruction rules are intact
        expect(result).toContain('Nie parafrazuj ani nie zmyślaj treści dokumentu w narracji.');
        expect(result).toContain('Silnik gry automatycznie wyświetli graczom oryginalny, autentyczny dokument');
      });

      it(`processes ${file} with null, undefined, and empty object options`, () => {
        const filePath = path.join(predefinedDir, file);
        const scenario = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        const resUndefined = buildHandoutsContext(scenario.handouts, scenario.puzzles, undefined);
        const resNull = buildHandoutsContext(scenario.handouts, scenario.puzzles, null as unknown as BuildHandoutsContextOptions);
        const resEmpty = buildHandoutsContext(scenario.handouts, scenario.puzzles, {});

        expect(resUndefined).toBe(resEmpty);
        expect(resNull).toBe(resEmpty);

        scenario.handouts.forEach((h: AdventureHandout) => {
          if (h.audioUrl) {
            expect(resEmpty).not.toContain(`[HANDOUT:${h.slug}]`);
          } else {
            expect(resEmpty).toContain(`[HANDOUT:${h.slug}]`);
          }
        });
      });

      it(`preserves legacy handouts across scoped chapters when handouts lack chapterId`, () => {
        const filePath = path.join(predefinedDir, file);
        const scenario = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        // Chapters alone keep paper evidence visible but cannot discover audio.
        const resCh1 = buildHandoutsContext(scenario.handouts, null, { activeChapterId: 'rozdzial-1' });
        const resCh5 = buildHandoutsContext(scenario.handouts, null, { activeChapterId: 5 });

        expect(resCh1).toContain('## DOSTĘPNE HANDOUTY');
        expect(resCh5).toContain('## DOSTĘPNE HANDOUTY');

        scenario.handouts.forEach((h: AdventureHandout) => {
          if (h.audioUrl) {
            expect(resCh1).not.toContain(`[HANDOUT:${h.slug}]`);
            expect(resCh5).not.toContain(`[HANDOUT:${h.slug}]`);
          } else {
            expect(resCh1).toContain(`[HANDOUT:${h.slug}]`);
            expect(resCh5).toContain(`[HANDOUT:${h.slug}]`);
          }
        });
      });
    });
  });

  describe('2. Strict Keeper-Only and Active Chapter/Location Combination', () => {
    it('strictly isolates keeperOnly: true matching both active chapter and location from player list', () => {
      const handouts: AdventureHandout[] = [
        {
          slug: 'keeper-ritual-map',
          title: 'Plan Rytuału w Piwnicy',
          image: '/handouts/plan.png',
          textContent: 'Ołtarz z kości pod podłogą, kultysta czeka w ukryciu.',
          keeperOnly: true,
          chapterId: 'rozdzial-1',
          locationId: 'piwnica',
          nodeId: 'node-piwnica',
        },
        {
          slug: 'player-diary-note',
          title: 'Kartka z Pamiętnika',
          image: '/handouts/kartka.png',
          textContent: 'Widziałem coś dziwnego w piwnicy.',
          isPlayerFacing: true,
          keeperOnly: false,
          chapterId: 'rozdzial-1',
          locationId: 'piwnica',
          nodeId: 'node-piwnica',
        },
      ];

      const options: BuildHandoutsContextOptions = {
        activeChapterId: 'rozdzial-1',
        currentLocation: 'piwnica',
        activeLocationId: 'piwnica',
        activeNodeId: 'node-piwnica',
      };

      const result = buildHandoutsContext(handouts, null, options);

      // 1. Player section must contain ONLY the player note
      expect(result).toContain('## DOSTĘPNE HANDOUTY (realne dokumenty tej przygody)');
      expect(result).toContain('- Kartka z Pamiętnika → wstaw dokładnie: [HANDOUT:player-diary-note]');

      // 2. Player section MUST NOT contain the keeper map or [HANDOUT:keeper-ritual-map]
      const playerPart = result.split('## MATERIAŁY I PLANY STRAŻNIKA')[0];
      expect(playerPart).not.toContain('Plan Rytuału w Piwnicy');
      expect(playerPart).not.toContain('keeper-ritual-map');
      expect(playerPart).not.toContain('[HANDOUT:keeper-ritual-map]');

      // 3. Keeper section must contain the plan with warnings and textContent
      const keeperPart = result.split('## MATERIAŁY I PLANY STRAŻNIKA')[1];
      expect(keeperPart).toBeDefined();
      expect(keeperPart).toContain('Plan Rytuału w Piwnicy (slug: keeper-ritual-map)');
      expect(keeperPart).toContain('Informacje dla MG: Ołtarz z kości pod podłogą, kultysta czeka w ukryciu.');
      expect(keeperPart).toContain('BEZWZGLĘDNY ZAKAZ: Nigdy nie emituj tagu [HANDOUT:...] dla tych materiałów!');

      // 4. CRITICAL: Keeper section must NEVER contain the [HANDOUT:keeper-ritual-map] tag instruction!
      expect(result).not.toContain('[HANDOUT:keeper-ritual-map]');
    });

    it('enforces keeper segregation across all permutations of keeperOnly and isPlayerFacing', () => {
      const permutations: AdventureHandout[] = [
        {
          slug: 'h-keeper-true-player-false',
          title: 'Tajne 1',
          image: '/h.png',
          keeperOnly: true,
          isPlayerFacing: false,
        },
        {
          slug: 'h-keeper-true-player-true',
          title: 'Tajne 2 (keeperOnly beats isPlayerFacing)',
          image: '/h.png',
          keeperOnly: true,
          isPlayerFacing: true,
        },
        {
          slug: 'h-keeper-false-player-false',
          title: 'Tajne 3 (isPlayerFacing: false beats keeperOnly: false)',
          image: '/h.png',
          keeperOnly: false,
          isPlayerFacing: false,
        },
        {
          slug: 'h-keeper-undef-player-false',
          title: 'Tajne 4',
          image: '/h.png',
          isPlayerFacing: false,
        },
        {
          slug: 'h-player-clean',
          title: 'Gracz Czysty',
          image: '/h.png',
          keeperOnly: false,
          isPlayerFacing: true,
        },
      ];

      const result = buildHandoutsContext(permutations, null);

      const playerPart = result.split('## MATERIAŁY I PLANY STRAŻNIKA')[0];
      const keeperPart = result.split('## MATERIAŁY I PLANY STRAŻNIKA')[1];

      // Only 'Gracz Czysty' in player section
      expect(playerPart).toContain('Gracz Czysty');
      expect(playerPart).toContain('[HANDOUT:h-player-clean]');
      expect(playerPart).not.toContain('Tajne 1');
      expect(playerPart).not.toContain('Tajne 2');
      expect(playerPart).not.toContain('Tajne 3');
      expect(playerPart).not.toContain('Tajne 4');

      // All 4 secret items in keeper section
      expect(keeperPart).toContain('Tajne 1');
      expect(keeperPart).toContain('Tajne 2');
      expect(keeperPart).toContain('Tajne 3');
      expect(keeperPart).toContain('Tajne 4');

      // ZERO [HANDOUT:h-keeper-...] instructions anywhere
      expect(result).not.toContain('[HANDOUT:h-keeper-true-player-false]');
      expect(result).not.toContain('[HANDOUT:h-keeper-true-player-true]');
      expect(result).not.toContain('[HANDOUT:h-keeper-false-player-false]');
      expect(result).not.toContain('[HANDOUT:h-keeper-undef-player-false]');
    });
  });

  describe('3. Edge Cases & Boundary Conditions', () => {
    it('handles empty titles, newlines in titles, and extreme unicode', () => {
      const weirdHandouts: AdventureHandout[] = [
        {
          slug: 'empty-title-handout',
          title: '',
          image: '/h.png',
          isPlayerFacing: true,
        },
        {
          slug: 'multiline-title-handout',
          title: 'Tytuł w pierwszej linii\nTytuł w drugiej linii\r\nTytuł w trzeciej linii',
          image: '/h.png',
          isPlayerFacing: true,
        },
        {
          slug: 'unicode-chaos-handout',
          title: '📜 Rękopis Necronomiconu 💀 \u0000 \uFEFF \u200B 𓀀𓀁 (العربية / 中文 / 日本語 / עברית)',
          image: '/h.png',
          isPlayerFacing: true,
        },
      ];

      expect(() => {
        const result = buildHandoutsContext(weirdHandouts, null);
        expect(result).toContain('[HANDOUT:empty-title-handout]');
        expect(result).toContain('[HANDOUT:multiline-title-handout]');
        expect(result).toContain('[HANDOUT:unicode-chaos-handout]');
        expect(result).toContain('📜 Rękopis Necronomiconu 💀');
      }).not.toThrow();
    });

    it('handles extreme and degenerate options values (null, undefined, NaN, Infinity, whitespace)', () => {
      const handouts: AdventureHandout[] = [
        {
          slug: 'h-global',
          title: 'Dokument Globalny',
          image: '/h.png',
        },
        {
          slug: 'h-ch1',
          title: 'Dokument Rozdziału 1',
          image: '/h.png',
          chapterId: '1',
        },
      ];

      // activeChapterId as NaN
      expect(() => {
        const res = buildHandoutsContext(handouts, null, {
          activeChapterId: NaN,
        });
        expect(res).toBeDefined();
      }).not.toThrow();

      // activeChapterId as Infinity
      expect(() => {
        const res = buildHandoutsContext(handouts, null, {
          activeChapterId: Infinity,
        });
        expect(res).toBeDefined();
      }).not.toThrow();

      // activeChapterId as empty string or whitespace
      const resWhitespace = buildHandoutsContext(handouts, null, {
        activeChapterId: '   ',
        currentLocation: '   ',
        activeLocationId: '   ',
        activeNodeId: '   ',
      });
      // Should treat whitespace as empty -> return all handouts
      expect(resWhitespace).toContain('Dokument Globalny');
      expect(resWhitespace).toContain('Dokument Rozdziału 1');

      // activeChapterId as 0 (valid falsy number)
      const resZero = buildHandoutsContext(
        [
          { slug: 'h-zero', title: 'Rozdział Zero', image: '/h.png', chapterId: '0' },
          { slug: 'h-one', title: 'Rozdział Jeden', image: '/h.png', chapterId: '1' },
        ],
        null,
        { activeChapterId: 0 }
      );
      expect(resZero).toContain('Rozdział Zero');
      expect(resZero).not.toContain('Rozdział Jeden');
    });

    it('probes chapter matching for false-positive substring leaks (e.g. Chapter 10 vs Chapter 1)', () => {
      const handouts: AdventureHandout[] = [
        {
          slug: 'h-ch1',
          title: 'Dokument Rozdział 1',
          image: '/h.png',
          chapterId: 'rozdzial-1',
        },
        {
          slug: 'h-ch10',
          title: 'Dokument Rozdział 10',
          image: '/h.png',
          chapterId: 'rozdzial-10',
        },
        {
          slug: 'h-ch11',
          title: 'Dokument Rozdział 11',
          image: '/h.png',
          chapterId: 'rozdzial-11',
        },
      ];

      // When player is in Chapter 1:
      // Does Chapter 10 or Chapter 11 leak because "rozdzial-10".includes("1") or "rozdzial-10".includes("rozdzial-1")?
      const resNumeric1 = buildHandoutsContext(handouts, null, { activeChapterId: 1 });
      const resString1 = buildHandoutsContext(handouts, null, { activeChapterId: '1' });
      const resFullRozdzial1 = buildHandoutsContext(handouts, null, { activeChapterId: 'rozdzial-1' });

      console.log('--- Substring Probing Results ---');
      console.log('Numeric 1 contains ch10?', resNumeric1.includes('h-ch10'));
      console.log('String "1" contains ch10?', resString1.includes('h-ch10'));
      console.log('Full "rozdzial-1" contains ch10?', resFullRozdzial1.includes('h-ch10'));
    });

    it('probes location matching for false-positive substring leaks (e.g. "las" vs "klasa")', () => {
      const handouts: AdventureHandout[] = [
        {
          slug: 'h-las',
          title: 'Mapa Lasu',
          image: '/h.png',
          locationId: 'las',
        },
        {
          slug: 'h-klasa',
          title: 'Dziennik Lekcyjny',
          image: '/h.png',
          locationId: 'klasa',
        },
      ];

      const resKlasa = buildHandoutsContext(handouts, null, { currentLocation: 'klasa' });
      console.log('Current location "klasa" contains "h-las"?', resKlasa.includes('h-las'));

      const resLas = buildHandoutsContext(handouts, null, { currentLocation: 'las' });
      console.log('Current location "las" contains "h-klasa"?', resLas.includes('h-klasa'));
    });
  });
});
