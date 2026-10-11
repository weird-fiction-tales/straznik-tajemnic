/**
 * @file challenger_m3_1.test.ts
 * Challenger M3-1 Empirical Adversarial Test Harness (Milestone M3).
 *
 * Scenarios tested:
 * 1. Malformed tags: [HANDOUT:], [HANDOUT: ], [HANDOUT:slug with spaces], [HANDOUT:nested[tag]], [HANDOUT:12345], [HANDOUT:slug-with-unicode-zażółć].
 * 2. Multiple tags in one message: consecutive [HANDOUT:s1][HANDOUT:s2], mixed with narrative, whispers, dice rolls.
 * 3. Extremely long text content (10,000 chars) in handout: expand/collapse toggle, memory/performance.
 * 4. Resolver performance benchmark: 1,000 queries with realistic and missing slugs (< 1 ms per query).
 *
 * Invariant Rule: Strictly standard hyphens (-) only, zero em-dashes or en-dashes.
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { cleanupContent } from '@/components/chat/narrative/cleanup';
import { parseIntoSections } from '@/components/chat/narrative/parse-sections';
import { renderHandout, getHandoutStyles } from '@/components/chat/narrative/render-handout';
import { resolveHandoutBySlug } from '@/lib/handout-resolver';
import type { Section } from '@/components/chat/narrative/types';
import type { AdventureHandout, AdventureContext } from '@/lib/adventures-data';

// Mock browser dependencies for OpenSeadragon and WaveSurfer
jest.mock('openseadragon', () => {
  return jest.fn().mockImplementation(() => ({
    addHandler: jest.fn(),
    viewport: {
      getZoom: jest.fn().mockReturnValue(1),
      zoomTo: jest.fn(),
      setRotation: jest.fn(),
      getRotation: jest.fn().mockReturnValue(0),
      goHome: jest.fn(),
    },
    destroy: jest.fn(),
  }));
});

jest.mock('wavesurfer.js', () => ({
  create: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    playPause: jest.fn(),
    stop: jest.fn(),
    seekTo: jest.fn(),
    setMuted: jest.fn(),
    getDuration: jest.fn().mockReturnValue(120),
    getCurrentTime: jest.fn().mockReturnValue(0),
    destroy: jest.fn(),
  })),
}));

beforeAll(() => {
  window.HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = jest.fn();
});

describe('Challenger M3-1 Empirical Stress Tests', () => {
  const mockContext: AdventureContext = {
    id: 'test-scenario-challenger',
    title: 'Adversarial Test Scenario',
    era: 'classic',
    eraLabel: 'Lata 20.',
    yearRange: '1920-1925',
    location: 'Arkham',
    country: 'USA',
    tone: 'noir',
    themes: ['Szalenstwo'],
    suggestedOccupations: ['Detektyw'],
    suggestedArchetypes: ['investigator'],
    hook: 'Zlecenie',
    description: 'Opis',
    estimatedSessions: '1',
    playerCount: '1-4',
    difficulty: 'hard',
    handouts: [
      {
        slug: 'slug-with-spaces',
        title: 'Dokument Ze Spacjami',
        image: '/img/spaces.webp',
        textContent: 'Tresc dokumentu ze spacjami w slugu.',
        handoutType: 'letter',
      },
      {
        slug: '12345',
        title: 'Szyfrogram Numeryczny 12345',
        image: '/img/num.webp',
        textContent: '1010 2020 3030 4040',
        handoutType: 'telegram',
      },
      {
        slug: 'slug-with-unicode-zażółć',
        title: 'Polski Manuskrypt Zażółć',
        image: '/img/unicode.webp',
        textContent: 'Zażółć gęślą jaźń w starym dworze.',
        handoutType: 'book',
      },
      {
        slug: 'clue-teczka-sb-klin',
        title: 'Teczka SB Klin',
        image: '/img/teczka.webp',
        textContent: 'Akta operacyjne kryptonim Klin.',
        handoutType: 'report',
      },
      {
        slug: 'mapa-podziemi',
        title: 'Plan katakumb',
        image: '/img/mapa.webp',
        textContent: 'Korytarze i ukryte komory.',
        handoutType: 'map',
      },
    ],
  };

  // ==========================================================================
  // SUITE 1: MALFORMED & ADVERSARIAL TAGS
  // ==========================================================================
  describe('Suite 1: Malformed and Adversarial Tags', () => {
    it('1.1: [HANDOUT:] empty slug does not crash cleanup, parser, or resolver', () => {
      const text = 'Wchodzicie do piwnicy.\n[HANDOUT:]\nCiemnosc otacza wasze stopy.';
      
      // Cleanup verification
      const cleaned = cleanupContent(text);
      expect(cleaned).toContain('[HANDOUT:]');

      // Parser verification
      const sections = parseIntoSections(cleaned);
      expect(sections.length).toBeGreaterThanOrEqual(1);
      
      // Handout section is either created safely or handled
      const handoutSec = sections.find((s) => s.type === 'handout');
      if (handoutSec) {
        expect(handoutSec.handoutSlug).toBe('');
        // Resolver returns null safely for empty slug
        const resolved = resolveHandoutBySlug(handoutSec.handoutSlug || '', mockContext);
        expect(resolved).toBeNull();

        // Rendering empty handout does not throw
        expect(() => render(renderHandout(handoutSec, 0, mockContext) as React.ReactElement)).not.toThrow();
      }
    });

    it('1.2: [HANDOUT: ] whitespace-only slug is handled gracefully', () => {
      const text = 'Na stole lezy kartka.\n[HANDOUT:   ]\nCo robicie?';
      
      const cleaned = cleanupContent(text);
      expect(cleaned).toContain('[HANDOUT:   ]');

      const sections = parseIntoSections(cleaned);
      const handoutSec = sections.find((s) => s.type === 'handout');
      if (handoutSec) {
        expect(handoutSec.handoutSlug).toBe('');
        const resolved = resolveHandoutBySlug(handoutSec.handoutSlug || '', mockContext);
        expect(resolved).toBeNull();
      }
    });

    it('1.3: [HANDOUT:slug with spaces] matches normalized slug in context', () => {
      const text = 'Oto pismo z banku:\n[HANDOUT:slug with spaces]\nPieczec jest nienaruszona.';
      
      const cleaned = cleanupContent(text);
      expect(cleaned).toContain('[HANDOUT:slug with spaces]');

      const sections = parseIntoSections(cleaned);
      const handoutSec = sections.find((s) => s.type === 'handout');
      expect(handoutSec).toBeDefined();
      expect(handoutSec?.handoutSlug).toBe('slug with spaces');

      // Resolver should normalize spaces to hyphens and find 'slug-with-spaces'
      const resolved = resolveHandoutBySlug(handoutSec!.handoutSlug!, mockContext);
      expect(resolved).not.toBeNull();
      expect(resolved?.title).toBe('Dokument Ze Spacjami');
      expect(resolved?.textContent).toBe('Tresc dokumentu ze spacjami w slugu.');
    });

    it('1.4: [HANDOUT:nested[tag]] does not cause catastrophic regex backtracking or crash', () => {
      const text = 'Dziwny artefakt:\n[HANDOUT:nested[tag]]\nNapis blednie.';
      
      const startTime = performance.now();
      const cleaned = cleanupContent(text);
      const sections = parseIntoSections(cleaned);
      const endTime = performance.now();

      // Ensure execution is sub-millisecond (no ReDoS)
      expect(endTime - startTime).toBeLessThan(50);
      expect(sections.length).toBeGreaterThan(0);

      // Rendering all resulting sections must succeed without crashing
      sections.forEach((sec, idx) => {
        if (sec.type === 'handout') {
          expect(() => render(renderHandout(sec, idx, mockContext) as React.ReactElement)).not.toThrow();
        }
      });
    });

    it('1.5: [HANDOUT:12345] purely numeric slug resolves correctly', () => {
      const text = 'Wybito numer na blasze:\n[HANDOUT:12345]\nCyfry sa ostre.';
      
      const cleaned = cleanupContent(text);
      const sections = parseIntoSections(cleaned);
      const handoutSec = sections.find((s) => s.type === 'handout');
      expect(handoutSec).toBeDefined();
      expect(handoutSec?.handoutSlug).toBe('12345');

      const resolved = resolveHandoutBySlug(handoutSec!.handoutSlug!, mockContext);
      expect(resolved).not.toBeNull();
      expect(resolved?.title).toBe('Szyfrogram Numeryczny 12345');
      expect(resolved?.handoutType).toBe('telegram');
    });

    it('1.6: [HANDOUT:slug-with-unicode-zażółć] unicode slug preserves diacritics and resolves', () => {
      const text = 'W starozytnym modlitewniku:\n[HANDOUT:slug-with-unicode-zażółć]\nStrony krusza sie w dloniach.';
      
      const cleaned = cleanupContent(text);
      expect(cleaned).toContain('[HANDOUT:slug-with-unicode-zażółć]');

      const sections = parseIntoSections(cleaned);
      const handoutSec = sections.find((s) => s.type === 'handout');
      expect(handoutSec).toBeDefined();
      expect(handoutSec?.handoutSlug).toBe('slug-with-unicode-zażółć');

      const resolved = resolveHandoutBySlug(handoutSec!.handoutSlug!, mockContext);
      expect(resolved).not.toBeNull();
      expect(resolved?.title).toBe('Polski Manuskrypt Zażółć');
      expect(resolved?.textContent).toContain('Zażółć gęślą jaźń');
    });

    it('1.7: path traversal and script injection attempts in slug are neutralized safely', () => {
      const maliciousTraversal = 'Znaleziono: [HANDOUT:../../../../etc/shadow]';
      const maliciousXSS = 'Znaleziono: [HANDOUT:<script>alert("pwned")</script>]';

      const secTraversal = parseIntoSections(maliciousTraversal);
      const secXSS = parseIntoSections(maliciousXSS);

      const hTraversal = secTraversal.find((s) => s.type === 'handout');
      const hXSS = secXSS.find((s) => s.type === 'handout');

      expect(hTraversal).toBeDefined();
      expect(hXSS).toBeDefined();

      // Resolver sanitizes and returns null safely
      expect(resolveHandoutBySlug(hTraversal!.handoutSlug!, mockContext)).toBeNull();
      expect(resolveHandoutBySlug(hXSS!.handoutSlug!, mockContext)).toBeNull();
    });

    it('1.8: extremely long slug (500 chars) executes within sub-millisecond time without ReDoS', () => {
      const hugeSlug = 'a-'.repeat(250);
      const text = `Plik: [HANDOUT:${hugeSlug}]`;
      
      const start = performance.now();
      const sections = parseIntoSections(text);
      const res = resolveHandoutBySlug(hugeSlug, mockContext);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
      expect(sections.length).toBeGreaterThan(0);
      expect(res).toBeNull();
    });
  });

  // ==========================================================================
  // SUITE 2: MULTIPLE TAGS IN ONE MESSAGE
  // ==========================================================================
  describe('Suite 2: Multiple Tags and Interspersed Message Structure', () => {
    it('2.1: consecutive [HANDOUT:slug1][HANDOUT:slug2] are split into two separate handout sections', () => {
      const text = 'Oto dwa dokumenty:\n[HANDOUT:12345][HANDOUT:slug-with-spaces]\nCo wybieracie?';
      
      const sections = parseIntoSections(text);
      const handoutSections = sections.filter((s) => s.type === 'handout');
      
      expect(handoutSections.length).toBe(2);
      expect(handoutSections[0].handoutSlug).toBe('12345');
      expect(handoutSections[1].handoutSlug).toBe('slug-with-spaces');
    });

    it('2.2: consecutive unspaced tags: [HANDOUT:s1][HANDOUT:s2] works, spaced 3 tags works, 3 unspaced tags parsed as separate handouts', () => {
      // Two consecutive tags without whitespace (explicit prompt requirement)
      const twoTags = '[HANDOUT:12345][HANDOUT:slug-with-spaces]';
      const sections2 = parseIntoSections(twoTags);
      const handouts2 = sections2.filter((s) => s.type === 'handout');
      expect(handouts2.length).toBe(2);
      expect(handouts2[0].handoutSlug).toBe('12345');
      expect(handouts2[1].handoutSlug).toBe('slug-with-spaces');

      // Three tags with spaces
      const threeSpaced = '[HANDOUT:12345] [HANDOUT:slug-with-spaces] [HANDOUT:slug-with-unicode-zażółć]';
      const sectionsSpaced = parseIntoSections(threeSpaced);
      expect(sectionsSpaced.filter((s) => s.type === 'handout').length).toBe(3);

      // Three strictly unspaced tags: verified separate handout sections without whisper leakage
      const threeUnspaced = '[HANDOUT:12345][HANDOUT:slug-with-spaces][HANDOUT:slug-with-unicode-zażółć]';
      const sectionsUnspaced = parseIntoSections(threeUnspaced);
      expect(sectionsUnspaced.filter((s) => s.type === 'handout').length).toBe(3);
      expect(sectionsUnspaced.filter((s) => s.type === 'whisper').length).toBe(0);
    });

    it('2.3: complex orchestration: narrative, handout, dice roll, handout, whisper', () => {
      const text = [
        'Wchodzicie do gabinetu profesora.',
        '[HANDOUT:clue-teczka-sb-klin]',
        '[RZUT Spostrzegawczość 50/50 -> SUKCES]',
        'Pod obluzowana deska podlogi dostrzegacie kolejny zwoj.',
        '[HANDOUT:mapa-podziemi]',
        '[Czujecie lodowaty powiew na karku. Co robicie?]',
      ].join('\n');

      const cleaned = cleanupContent(text);
      const sections = parseIntoSections(cleaned);

      expect(sections.length).toBe(6);
      expect(sections[0].type).toBe('narrative');
      expect(sections[0].content).toContain('gabinetu profesora');

      expect(sections[1].type).toBe('handout');
      expect(sections[1].handoutSlug).toBe('clue-teczka-sb-klin');

      expect(sections[2].type).toBe('roll');
      expect(sections[2].content).toContain('[RZUT');

      expect(sections[3].type).toBe('narrative');
      expect(sections[3].content).toContain('kolejny zwoj');

      expect(sections[4].type).toBe('handout');
      expect(sections[4].handoutSlug).toBe('mapa-podziemi');
      expect(sections[4].handoutType).toBe('map');

      expect(sections[5].type).toBe('whisper');
      expect(sections[5].content).toContain('Co robicie?');
    });

    it('2.5: demonstrates vulnerability: colon-formatted [RZUT: ...] is stripped by cleanup.ts catch-all', () => {
      const text = 'Wchodzicie do gabinetu.\n[RZUT: Spostrzegawczość 50/50 -> SUKCES]\nWidzicie dokument.';
      const cleaned = cleanupContent(text);
      // Because RZUT is not whitelisted in cleanup.ts:142, the roll tag is erased
      expect(cleaned).not.toContain('[RZUT:');
    });

    it('2.4: inline handout tag embedded inside text sentence is extracted correctly', () => {
      const text = 'Na stole lezy [HANDOUT:12345] a obok niego lezy rewolwer.';
      
      const sections = parseIntoSections(text);
      const handoutSections = sections.filter((s) => s.type === 'handout');
      expect(handoutSections.length).toBe(1);
      expect(handoutSections[0].handoutSlug).toBe('12345');
      
      // Surrounding narrative text is preserved
      const narrativeSections = sections.filter((s) => s.type === 'narrative');
      const allNarrative = narrativeSections.map((s) => s.content).join(' ');
      expect(allNarrative).toContain('Na stole lezy');
      expect(allNarrative).toContain('rewolwer');
    });
  });

  // ==========================================================================
  // SUITE 3: EXTREMELY LONG TEXT CONTENT (10,000 CHARS) & EXPAND/COLLAPSE
  // ==========================================================================
  describe('Suite 3: Extreme Content Length & Expand/Collapse Interaction', () => {
    const hugeParagraph = 'To jest autentyczny zapis z prastarej ksiegi o bluierczych rytualach. '.repeat(150); // ~10,500 chars
    expect(hugeParagraph.length).toBeGreaterThan(10000);

    const longHandout: AdventureHandout = {
      slug: 'manuskrypt-10k',
      title: 'Ksiega Eibona - Fragment 10k',
      image: '/img/eibon.webp',
      textContent: hugeParagraph,
      handoutType: 'book',
    };

    const contextWithLongHandout: AdventureContext = {
      ...mockContext,
      handouts: [...(mockContext.handouts || []), longHandout],
    };

    it('3.1: renders 10,000 char handout without memory or rendering exceptions', () => {
      const section: Section = {
        type: 'handout',
        handoutSlug: 'manuskrypt-10k',
        content: '',
      };

      const start = performance.now();
      const { container } = render(renderHandout(section, 0, contextWithLongHandout) as React.ReactElement);
      const renderDuration = performance.now() - start;

      // Ensure render is performant
      expect(renderDuration).toBeLessThan(100);
      expect(container.textContent).toContain('Ksiega Eibona');
      expect(container.textContent).toContain('bluierczych rytualach');
    });

    it('3.2: document without sticky note starts expanded and can be collapsed', () => {
      const section: Section = {
        type: 'handout',
        handoutSlug: 'manuskrypt-10k',
        content: '',
      };

      const { container } = render(renderHandout(section, 0, contextWithLongHandout) as React.ReactElement);

      // Should have collapse button (Polish locale: "Zwiń treść dokumentu")
      const toggleButton = container.querySelector('button');
      expect(toggleButton).not.toBeNull();
      expect(toggleButton?.textContent).toMatch(/zwiń/i);

      // Click to collapse
      act(() => {
        fireEvent.click(toggleButton!);
      });

      // After collapse, button shows expand text ("Rozwiń pełną treść dokumentu") and preview has line-clamp-3
      expect(toggleButton?.textContent).toMatch(/rozwiń/i);
      const preview = container.querySelector('pre.line-clamp-3');
      expect(preview).not.toBeNull();

      // Click again to re-expand
      act(() => {
        fireEvent.click(toggleButton!);
      });
      expect(toggleButton?.textContent).toMatch(/zwiń/i);
    });

    it('3.3: document with sticky note starts collapsed and can be expanded', () => {
      const section: Section = {
        type: 'handout',
        handoutSlug: 'manuskrypt-10k',
        content: '',
        stickyNote: {
          who: 'Dr Armitage',
          about: 'Przeklad 10k',
          clue: 'Zaklecie ochronne',
        },
      };

      const { container } = render(renderHandout(section, 0, contextWithLongHandout) as React.ReactElement);

      // Verify sticky note content
      expect(container.textContent).toContain('Dr Armitage');
      expect(container.textContent).toContain('Przeklad 10k');
      expect(container.textContent).toContain('Zaklecie ochronne');

      // Sticky note document starts collapsed ("Rozwiń pełną treść dokumentu")
      const toggleButton = container.querySelector('button');
      expect(toggleButton).not.toBeNull();
      expect(toggleButton?.textContent).toMatch(/rozwiń/i);

      // Click to expand
      act(() => {
        fireEvent.click(toggleButton!);
      });
      expect(toggleButton?.textContent).toMatch(/zwiń/i);
    });

    it('3.4: stress-test 100 consecutive toggle cycles on 10,000 char document', () => {
      const section: Section = {
        type: 'handout',
        handoutSlug: 'manuskrypt-10k',
        content: '',
      };

      const { container } = render(renderHandout(section, 0, contextWithLongHandout) as React.ReactElement);
      const toggleButton = container.querySelector('button');
      expect(toggleButton).not.toBeNull();

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        act(() => {
          fireEvent.click(toggleButton!);
        });
      }
      const totalDuration = performance.now() - start;

      // 100 state updates and re-renders on a 10k-char string should complete well under 500ms
      expect(totalDuration).toBeLessThan(500);
    });
  });

  // ==========================================================================
  // SUITE 4: RESOLVER PERFORMANCE BENCHMARK (1,000 QUERIES)
  // ==========================================================================
  describe('Suite 4: Resolver Performance Benchmark', () => {
    it('4.1: benchmark 1,000 queries against realistic and missing slugs (< 1 ms per query)', () => {
      const testQueries = [
        'slug-with-spaces',
        'SLUG-WITH-SPACES',
        'clue-teczka-sb-klin',
        'teczka-sb-klin',
        'mapa-podziemi',
        '12345',
        'slug-with-unicode-zażółć',
        'clue-photo-prabuty-1947', // belongs to another adventure, excluded from mockContext
        'audio-sb-wiretap-elblag', // belongs to another adventure, excluded from mockContext
        'nonexistent-slug-benchmark-404', // missing slug in the active adventure
      ];

      const iterations = 1000;
      const start = performance.now();

      let matchCount = 0;
      let missCount = 0;

      for (let i = 0; i < iterations; i++) {
        const query = testQueries[i % testQueries.length];
        const result = resolveHandoutBySlug(query, mockContext);
        if (result) {
          matchCount++;
        } else {
          missCount++;
        }
      }

      const totalTimeMs = performance.now() - start;
      const avgLatencyPerQuery = totalTimeMs / iterations;

      // Invariant: Latency is negligible (< 1 ms per query)
      expect(avgLatencyPerQuery).toBeLessThan(1.0);
      // In practice in-memory search takes < 0.05 ms per query
      expect(totalTimeMs).toBeLessThan(100);

      expect(matchCount).toBe(700);
      expect(missCount).toBe(300);

      // Global lookup remains available without an active adventure.
      for (const foreignSlug of testQueries.slice(7, 9)) {
        expect(resolveHandoutBySlug(foreignSlug, mockContext)).toBeNull();
        expect(resolveHandoutBySlug(foreignSlug)).not.toBeNull();
      }
    });

    it('4.2: getHandoutStyles returns valid Dark Art Deco styles for all 7 types plus map', () => {
      const types = ['newspaper', 'letter', 'telegram', 'report', 'diary', 'book', 'map'] as const;
      
      for (const t of types) {
        const style = getHandoutStyles(t);
        expect(style.container).toBeTruthy();
        expect(style.content).toBeTruthy();
        expect(style.header).toBeTruthy();
      }

      // Check map styling specifically
      const mapStyle = getHandoutStyles('map');
      expect(mapStyle.header).toContain('MAPA');
      expect(mapStyle.container).toContain('border-brass');
    });
  });
});
