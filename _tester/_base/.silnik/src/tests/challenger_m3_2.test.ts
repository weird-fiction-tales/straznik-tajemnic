/**
 * @file challenger_m3_2.test.ts
 * Challenger M3-2 Empirical Adversarial Test Harness (Milestone M3).
 *
 * Focus areas:
 * 1. Spoofing & Tag Escape Security:
 *    - [HANDOUT:__proto__], [HANDOUT:constructor], [HANDOUT:<script>alert(1)</script>]
 *    - Inline injection, nested brackets, unclosed tags, malformed slugs.
 * 2. Syntax Isolation & Non-Leakage:
 *    - Ensure cleanupContent does NOT leak or modify bracketed syntax:
 *      [RZUT: 1k100], [TEST: Spostrzegawczość], [NOTATKA_BADACZA: ...],
 *      [STICKY_NOTE: ...], [INVESTIGATOR_NOTE: ...], [Co robisz?].
 *    - Clean removal of GM protocol tags without residue.
 * 3. Resolver Robustness & Prototype Pollution Resistance:
 *    - resolveHandoutBySlug against prototype properties, non-string inputs, malformed contexts.
 *    - Regex special characters, extreme lengths, ReDoS resistance.
 * 4. Backward Compatibility with Legacy Messages:
 *    - Multi-line ASCII art borders, legacy raw text handouts without slugs.
 *    - Sticky notes with legacy handouts, audio and image tags, formatNarrative integration.
 *
 * Typography invariant: Strictly standard hyphens (-) only, zero em-dashes or en-dashes.
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { cleanupContent } from '@/components/chat/narrative/cleanup';
import { parseIntoSections, detectHandoutType } from '@/components/chat/narrative/parse-sections';
import { renderHandout, getHandoutStyles } from '@/components/chat/narrative/render-handout';
import { formatNarrative } from '@/components/chat/narrative/formatter';
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

describe('Challenger M3-2 Empirical Adversarial Test Harness', () => {
  const mockContext: AdventureContext = {
    id: 'test-scenario-m3-2',
    title: 'Adversarial Test Scenario M3-2',
    era: 'classic',
    eraLabel: 'Lata 20.',
    yearRange: '1920-1925',
    location: 'Warszawa',
    country: 'Polska',
    tone: 'noir',
    themes: ['Mroczna tajemnica'],
    suggestedOccupations: ['Detektyw'],
    suggestedArchetypes: ['investigator'],
    hook: 'Zlecenie',
    description: 'Opis',
    estimatedSessions: '1',
    playerCount: '1-4',
    difficulty: 'normal',
    handouts: [
      {
        slug: 'tajny-list-mecenasa',
        aliases: ['mecenasa'],
        title: 'Poufny list mecenasa',
        image: '/handouts/list.webp',
        textContent: 'Oryginalna treść listu adwokata z 1932 roku.',
        handoutType: 'letter',
      },
      {
        slug: 'clue-mapa-piwnic',
        title: 'Plan piwnic kamienicy',
        image: '/handouts/plan.webp',
        textContent: 'Rysunek techniczny kondygnacji podziemnej.',
        handoutType: 'map',
      },
      {
        slug: 'audio-zeznanie-swiadka',
        title: 'Zeznanie na tasmie',
        image: '/handouts/tasma.webp',
        audioUrl: '/audio/handouts/zeznanie.mp3',
        textContent: 'Transkrypcja przesłuchania świadka.',
        handoutType: 'report',
      },
    ],
  };

  // ==========================================================================
  // SUITE 1: SPOOFING & TAG ESCAPE SECURITY
  // ==========================================================================
  describe('1. Spoofing & Tag Escape Security', () => {
    it('1.1: [HANDOUT:__proto__] does not cause prototype pollution or crash', () => {
      const input = 'Odnaleziono podejrzany rekwizyt:\n[HANDOUT:__proto__]\nCo robicie dalej?';

      // 1. cleanupContent preserves the tag without crashing
      const cleaned = cleanupContent(input);
      expect(cleaned).toContain('[HANDOUT:__proto__]');

      // 2. parseIntoSections parses it cleanly as a handout section
      const sections = parseIntoSections(cleaned);
      const handoutSec = sections.find((s) => s.type === 'handout');
      expect(handoutSec).toBeDefined();
      expect(handoutSec?.handoutSlug).toBe('__proto__');

      // 3. resolveHandoutBySlug returns null and does NOT pollute Object.prototype
      const resolved = resolveHandoutBySlug('__proto__', mockContext);
      expect(resolved).toBeNull();
      expect((Object.prototype as unknown as Record<string, unknown>).polluted).toBeUndefined();

      // 4. React component renders without crash
      expect(() => {
        render(renderHandout(handoutSec!, 1, mockContext) as React.ReactElement);
      }).not.toThrow();
    });

    it('1.2: [HANDOUT:constructor] does not invoke constructor or crash resolver', () => {
      const input = 'W bibliotece lezy tom:\n[HANDOUT:constructor]\nCo robicie?';

      const cleaned = cleanupContent(input);
      expect(cleaned).toContain('[HANDOUT:constructor]');

      const sections = parseIntoSections(cleaned);
      const handoutSec = sections.find((s) => s.type === 'handout');
      expect(handoutSec).toBeDefined();
      expect(handoutSec?.handoutSlug).toBe('constructor');

      // Resolver must return null and not return the Function constructor
      const resolved = resolveHandoutBySlug('constructor', mockContext);
      expect(resolved).toBeNull();

      expect(() => {
        render(renderHandout(handoutSec!, 2, mockContext) as React.ReactElement);
      }).not.toThrow();
    });

    it('1.3: [HANDOUT:<script>alert(1)</script>] is safe against XSS and injection', () => {
      const input = 'Uwaga na zlosliwy tag:\n[HANDOUT:<script>alert(1)</script>]\nSprawdz reakcje.';

      const cleaned = cleanupContent(input);
      expect(cleaned).toContain('[HANDOUT:<script>alert(1)</script>]');

      const sections = parseIntoSections(cleaned);
      const handoutSec = sections.find((s) => s.type === 'handout');
      expect(handoutSec).toBeDefined();
      expect(handoutSec?.handoutSlug).toBe('<script>alert(1)</script>');

      const resolved = resolveHandoutBySlug('<script>alert(1)</script>', mockContext);
      expect(resolved).toBeNull();

      const { container } = render(renderHandout(handoutSec!, 3, mockContext) as React.ReactElement);
      // Verify that no script tag was injected into DOM
      const scriptElements = container.querySelectorAll('script');
      expect(scriptElements.length).toBe(0);
      expect(container.textContent).toContain('<script>alert(1)</script>');
    });

    it('1.4: Handles advanced injection payloads safely', () => {
      const maliciousPayloads = [
        'javascript:alert(1)',
        'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
        'onload="alert(1)"',
        '"><img src=x onerror=alert(1)>',
        '../../../../etc/passwd',
        '${process.mainModule.require("child_process").execSync("id")}',
      ];

      for (const payload of maliciousPayloads) {
        const raw = `Badacz oglada dokument:\n[HANDOUT:${payload}]\nCo robisz?`;
        expect(() => {
          const cleaned = cleanupContent(raw);
          const sections = parseIntoSections(cleaned);
          const handout = sections.find((s) => s.type === 'handout');
          expect(handout).toBeDefined();

          const resolved = resolveHandoutBySlug(payload, mockContext);
          expect(resolved).toBeNull();

          const { container } = render(renderHandout(handout!, 4, mockContext) as React.ReactElement);
          expect(container.querySelectorAll('script, img[onerror]').length).toBe(0);
        }).not.toThrow();
      }
    });

    it('1.5: Handles nested brackets, malformed tags, and unclosed tags without crashing', () => {
      const malformedCases = [
        '[HANDOUT:[NESTED_TAG]]',
        '[HANDOUT:slug]]',
        '[[HANDOUT:slug]]',
        '[HANDOUT:unclosed-tag',
        'HANDOUT:unopened-tag]',
        '[HANDOUT:]',
        '[HANDOUT:   ]',
        '[HANDOUT]',
        '[handout:lowercase-slug]',
        '[HandOut:Mixed-Case-Slug]',
      ];

      for (const malformed of malformedCases) {
        expect(() => {
          const cleaned = cleanupContent(`Tekst testowy:\n${malformed}\nKoniec tekstu.`);
          const sections = parseIntoSections(cleaned);
          for (let idx = 0; idx < sections.length; idx++) {
            render(renderHandout(sections[idx], idx, mockContext) as React.ReactElement);
          }
        }).not.toThrow();
      }
    });

    it('1.6: Multiple inline HANDOUT tags on a single line are isolated properly', () => {
      const raw = 'Oto dwa dokumenty: [HANDOUT:tajny-list-mecenasa] oraz [HANDOUT:clue-mapa-piwnic] lezace obok.';
      const cleaned = cleanupContent(raw);
      const sections = parseIntoSections(cleaned);

      const handoutSections = sections.filter((s) => s.type === 'handout');
      expect(handoutSections.length).toBe(2);
      expect(handoutSections[0].handoutSlug).toBe('tajny-list-mecenasa');
      expect(handoutSections[1].handoutSlug).toBe('clue-mapa-piwnic');
    });
  });

  // ==========================================================================
  // SUITE 2: SYNTAX ISOLATION & NON-LEAKAGE
  // ==========================================================================
  describe('2. Syntax Isolation & Non-Leakage', () => {
    it('2.1: cleanupContent preserves investigator and handout tags intact', () => {
      const input = [
        'Na biurku proboszcza odnajdujecie dowody.',
        '[NOTATKA_BADACZA: Kto: Dr Henry Armitage | Dotyczy: Rękopis | Trop: Klucz w sejfie]',
        '[STICKY_NOTE: Who: Inspector Legrasse | About: Cult raid | Clue: Black stone idol]',
        '[INVESTIGATOR_NOTE: Who: Albert Wilmarth | About: Letters from Vermont | Clue: Whispering in darkness]',
        '[HANDOUT:teczka-sb-klin]',
        'Co robicie dalej?',
      ].join('\n');

      const cleaned = cleanupContent(input);

      // All 4 key tags must be preserved verbatim
      expect(cleaned).toContain('[NOTATKA_BADACZA: Kto: Dr Henry Armitage | Dotyczy: Rękopis | Trop: Klucz w sejfie]');
      expect(cleaned).toContain('[STICKY_NOTE: Who: Inspector Legrasse | About: Cult raid | Clue: Black stone idol]');
      expect(cleaned).toContain('[INVESTIGATOR_NOTE: Who: Albert Wilmarth | About: Letters from Vermont | Clue: Whispering in darkness]');
      expect(cleaned).toContain('[HANDOUT:teczka-sb-klin]');
    });

    it('2.2: cleanupContent removes mechanical and GM protocol tags cleanly without residue', () => {
      const input = [
        'Inspektor wchodzi do pokoju.',
        '[MYŚLI_MG: Zasadzka w dokach o północy]',
        '[CEL_NARRACYJNY: Zastrasz graczy]',
        '[NASTRÓJ: klaustrofobiczny mrok]',
        '[RZUT: 1k100]',
        '[RZUT: 1k100 <= 50 -> Sukces]',
        '[TEST: Spostrzegawczość]',
        '[TEST: Spostrzegawczość (50%) -> Sukces]',
        '[WYNIK: Sukces]',
        '[SAN_LOSS: 1D4]',
        '[DZIENNIK: trop: ślady stóp w błocie]',
        '[JOURNAL: clue: muddy footprints]',
        'Na podłodze widoczne są ślady krwi.',
        '[Co robisz?]',
      ].join('\n');

      const cleaned = cleanupContent(input);

      // None of the stripped tags or their contents should leak into cleaned prose
      expect(cleaned).not.toContain('MYŚLI_MG');
      expect(cleaned).not.toContain('Zasadzka w dokach');
      expect(cleaned).not.toContain('CEL_NARRACYJNY');
      expect(cleaned).not.toContain('Zastrasz graczy');
      expect(cleaned).not.toContain('NASTRÓJ');
      expect(cleaned).not.toContain('klaustrofobiczny mrok');
      expect(cleaned).not.toContain('SAN_LOSS');
      expect(cleaned).not.toContain('1D4');
      expect(cleaned).not.toContain('DZIENNIK');
      expect(cleaned).not.toContain('JOURNAL');

      // Check clean removal without leaving orphaned brackets or colons
      expect(cleaned).not.toMatch(/\[RZUT:[^\]]*\]/);
      expect(cleaned).not.toMatch(/\[TEST:[^\]]*\]/);
      expect(cleaned).not.toMatch(/\[WYNIK:[^\]]*\]/);

      // Valid narrative and whisper must remain untouched
      expect(cleaned).toContain('Inspektor wchodzi do pokoju.');
      expect(cleaned).toContain('Na podłodze widoczne są ślady krwi.');
      expect(cleaned).toContain('[Co robisz?]');
    });

    it('2.3: cleanupContent preserves user prose with brackets, citations, and links', () => {
      const input = [
        'W roku 1925 [1] odkryto starożytny grobowiec.',
        'W kronice miejskiej [1924] odnotowano serię zaginięć.',
        'Zobacz szczegółowy [raport archeologiczny](https://miskatonic.edu/raport) na stole.',
        'Profesor zapytał cicho: „Co o tym sądzicie?”',
        '[What do you do?]',
      ].join('\n');

      const cleaned = cleanupContent(input);

      expect(cleaned).toContain('[1]');
      expect(cleaned).toContain('[1924]');
      expect(cleaned).toContain('[raport archeologiczny](https://miskatonic.edu/raport)');
      expect(cleaned).toContain('[What do you do?]');
    });

    it('2.4: Complex mixed turn is cleanly parsed into dedicated sections', () => {
      const turnInput = [
        '[MYŚLI_MG: Kultysci obserwuja budynek]',
        'Przekraczacie prog zrujnowanej kaplicy.',
        '[TEST: Spostrzegawczość]',
        '[NOTATKA_BADACZA: Kto: Brat Tadeusz | Dotyczy: Plan ucieczki | Trop: Tajne przejscie pod oltarzem]',
        '[HANDOUT:clue-mapa-piwnic]',
        'W powietrzu czuc zapach kadzidla i stechlizny.',
        '[Co robisz?]',
      ].join('\n');

      const cleaned = cleanupContent(turnInput);
      expect(cleaned).not.toContain('MYŚLI_MG');
      expect(cleaned).not.toContain('[TEST:');

      const sections = parseIntoSections(cleaned);
      expect(sections.length).toBeGreaterThanOrEqual(3);

      const handoutSection = sections.find((s) => s.type === 'handout');
      expect(handoutSection).toBeDefined();
      expect(handoutSection?.handoutSlug).toBe('clue-mapa-piwnic');

      // Sticky note parsed cleanly
      expect(handoutSection?.stickyNote).toBeDefined();
      expect(handoutSection?.stickyNote?.who).toBe('Brat Tadeusz');
      expect(handoutSection?.stickyNote?.about).toBe('Plan ucieczki');
      expect(handoutSection?.stickyNote?.clue).toBe('Tajne przejscie pod oltarzem');

      const whisperSection = sections.find((s) => s.type === 'whisper');
      expect(whisperSection).toBeDefined();
      expect(whisperSection?.content).toBe('Co robisz?');
    });
  });

  // ==========================================================================
  // SUITE 3: RESOLVER ROBUSTNESS & PROTOTYPE POLLUTION RESISTANCE
  // ==========================================================================
  describe('3. Resolver Robustness & Prototype Pollution Resistance', () => {
    it('3.1: resolveHandoutBySlug resists all prototype pollution properties', () => {
      const prototypeKeys = [
        '__proto__',
        'constructor',
        'prototype',
        'toString',
        'valueOf',
        'hasOwnProperty',
        'isPrototypeOf',
        'propertyIsEnumerable',
        'toLocaleString',
        '__defineGetter__',
        '__defineSetter__',
        '__lookupGetter__',
        '__lookupSetter__',
      ];

      for (const key of prototypeKeys) {
        const result = resolveHandoutBySlug(key, mockContext);
        expect(result).toBeNull();
      }

      // Check Object.prototype integrity
      expect((Object.prototype as unknown as Record<string, unknown>).slug).toBeUndefined();
      expect((Object.prototype as unknown as Record<string, unknown>).title).toBeUndefined();
    });

    it('3.2: resolveHandoutBySlug safely handles non-string and malformed inputs', () => {
      const nonStringInputs: unknown[] = [
        null,
        undefined,
        0,
        1,
        42,
        -100,
        NaN,
        Infinity,
        true,
        false,
        {},
        [],
        new Date(),
        /regex/,
        () => {},
        Symbol('slug'),
      ];

      for (const input of nonStringInputs) {
        expect(() => {
          const res = resolveHandoutBySlug(input as string, mockContext);
          expect(res).toBeNull();
        }).not.toThrow();
      }
    });

    it('3.3: resolveHandoutBySlug safely handles malformed adventureContext structures', () => {
      const malformedContexts: unknown[] = [
        null,
        undefined,
        {},
        { id: '__proto__' },
        { id: 'constructor' },
        { id: 'nonexistent-scenario-999' },
        { handouts: [] },
        { handouts: null },
        { handouts: undefined },
        Object.create(null),
        { handouts: [{ slug: '', title: '', image: '' }] },
        { handouts: [{ slug: 'other-slug', title: 'Other', image: '' }] },
      ];

      for (const ctx of malformedContexts) {
        expect(() => {
          const res = resolveHandoutBySlug('tajny-list-mecenasa', ctx as AdventureContext);
          // If context is empty/null, it may fall back to built-ins or return null
          expect(res === null || typeof res === 'object').toBe(true);
        }).not.toThrow();
      }
    });

    it('3.4: resolveHandoutBySlug is resilient to regex special chars and extreme lengths', () => {
      const edgeSlugs = [
        'a',
        'ab',
        'abc',
        '.*',
        '(a|b)+',
        '[a-z]',
        '\\d+',
        '^$',
        '?+*{}',
        'a'.repeat(5000),
      ];

      for (const slug of edgeSlugs) {
        expect(() => {
          const res = resolveHandoutBySlug(slug, mockContext);
          // Extreme non-existent slugs return null
          if (slug.length > 50) {
            expect(res).toBeNull();
          }
        }).not.toThrow();
      }
    });

    it('3.5: resolveHandoutBySlug matches valid items across tolerance tiers', () => {
      // Tier 1: Exact match
      const exact = resolveHandoutBySlug('tajny-list-mecenasa', mockContext);
      expect(exact?.title).toBe('Poufny list mecenasa');

      // Tier 2: Case-insensitive
      const upper = resolveHandoutBySlug('TAJNY-LIST-MECENASA', mockContext);
      expect(upper?.title).toBe('Poufny list mecenasa');

      // Tier 3: Normalized underscores and punctuation
      const norm = resolveHandoutBySlug('tajny_list_mecenasa', mockContext);
      expect(norm?.title).toBe('Poufny list mecenasa');

      // Tier 4: Stripped category prefix (clue-)
      const stripped = resolveHandoutBySlug('mapa-piwnic', mockContext);
      expect(stripped?.title).toBe('Plan piwnic kamienicy');

      // Tier 5: Declared full aliases preserve legacy references without substring guessing
      const sub = resolveHandoutBySlug('mecenasa', mockContext);
      expect(sub?.title).toBe('Poufny list mecenasa');
      expect(resolveHandoutBySlug('mecenas', mockContext)).toBeNull();
    });
  });

  // ==========================================================================
  // SUITE 4: BACKWARD COMPATIBILITY WITH LEGACY MESSAGES
  // ==========================================================================
  describe('4. Backward Compatibility with Legacy Messages', () => {
    it('4.1: Legacy ASCII newspaper handout renders smoothly without slug', () => {
      const legacyMessage = [
        'Na schodach lezy porzucona gazeta.',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '📰 KURIER WARSZAWSKI - WYDANIE NADZWYCZAJNE',
        'Dziś w nocy w kamienicy przy Wilczej odnaleziono tajemnicze zwoje.',
        'Policja bada sprawę nieznanego kultu.',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '[Co robicie?]',
      ].join('\n');

      const cleaned = cleanupContent(legacyMessage);
      const sections = parseIntoSections(cleaned);

      expect(sections.length).toBe(3);
      expect(sections[0].type).toBe('narrative');

      const handout = sections[1];
      expect(handout.type).toBe('handout');
      expect(handout.handoutSlug).toBeUndefined();
      expect(handout.handoutType).toBe('newspaper');
      expect(handout.content).toContain('Dziś w nocy w kamienicy przy Wilczej');

      expect(sections[2].type).toBe('whisper');

      // Verify rendering
      const { container } = render(renderHandout(handout, 1, mockContext) as React.ReactElement);
      expect(container.textContent).toContain('Dziś w nocy w kamienicy przy Wilczej');
      expect(container.textContent).toContain('WYCINEK PRASOWY');
    });

    it('4.2: Legacy ASCII letter renders smoothly without slug', () => {
      const legacyLetter = [
        '----------------------------------------',
        '✉️ POUFNY LIST DO PROFESORA',
        'Drogi Henryku, nie otwieraj trumny przed wschodem slonca.',
        'Twój oddany przyjaciel, George.',
        '----------------------------------------',
      ].join('\n');

      const sections = parseIntoSections(legacyLetter);
      expect(sections.length).toBe(1);
      const handout = sections[0];
      expect(handout.type).toBe('handout');
      expect(handout.handoutType).toBe('letter');
      expect(handout.content).toContain('Drogi Henryku');

      const { container } = render(renderHandout(handout, 2, mockContext) as React.ReactElement);
      expect(container.textContent).toContain('Drogi Henryku');
      expect(container.textContent).toContain('LIST');
    });

    it('4.3: Legacy ASCII telegram renders smoothly without slug', () => {
      const legacyTelegram = [
        '========================================',
        '📧 TELEGRAM: WESTERN UNION',
        'STOP PRZYBYWAJCIE PILNIE DO BOSTONU STOP DZIWNE ZDARZENIA STOP',
        '========================================',
      ].join('\n');

      const sections = parseIntoSections(legacyTelegram);
      expect(sections.length).toBe(1);
      const handout = sections[0];
      expect(handout.type).toBe('handout');
      expect(handout.handoutType).toBe('telegram');
      expect(handout.content).toContain('STOP PRZYBYWAJCIE PILNIE');

      const { container } = render(renderHandout(handout, 3, mockContext) as React.ReactElement);
      expect(container.textContent).toContain('TELEGRAM');
    });

    it('4.4: Legacy raw text handout without borders is identified and rendered', () => {
      const rawHandout = [
        '📰 DZIENNIK PORANNY: NAPAD NA BANK W ARKHAM',
        'Wczoraj w nocy doszło do zuchwałego włamania do skarbca.',
        'Skradziono jedynie starożytny mezopotamski cylinder.',
      ].join('\n');

      const sections = parseIntoSections(rawHandout);
      expect(sections.length).toBe(1);
      expect(sections[0].type).toBe('handout');
      expect(sections[0].handoutType).toBe('newspaper');
      expect(sections[0].content).toContain('Skradziono jedynie starożytny');
    });

    it('4.5: Legacy handout with [OBRAZ: ...] and [AUDIO: ...] extracts multimedia correctly', () => {
      const mediaHandout = [
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '📋 RAPORT Z PROSEKTORIUM',
        'Sekcja zwłok wykazała anomalie tkankowe.',
        '[OBRAZ: /handouts/prosektorium-skan.webp]',
        '[AUDIO: /audio/handouts/dyktafon-doktora.mp3]',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ].join('\n');

      const sections = parseIntoSections(mediaHandout);
      expect(sections.length).toBe(1);
      const handout = sections[0];
      expect(handout.type).toBe('handout');
      expect(handout.imageUrl).toBe('/handouts/prosektorium-skan.webp');
      expect(handout.audioUrl).toBe('/audio/handouts/dyktafon-doktora.mp3');
      expect(handout.content).not.toContain('[OBRAZ:');
      expect(handout.content).not.toContain('[AUDIO:');
    });

    it('4.6: Legacy message with sticky note and without slug renders and toggles', () => {
      const stickyHandout = [
        '[NOTATKA_BADACZA: Kto: Dozorca | Dotyczy: Klucz do wiezy | Trop: Ukryty za obrazem]',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '📜 ZAPISKI NA PERGAMINIE',
        'Kto posiada wiedze, ten strzeze klucza.',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ].join('\n');

      const sections = parseIntoSections(stickyHandout);
      expect(sections.length).toBe(1);
      const handout = sections[0];
      expect(handout.stickyNote).toBeDefined();
      expect(handout.stickyNote?.who).toBe('Dozorca');
      expect(handout.content).toContain('Kto posiada wiedze');

      const { container } = render(renderHandout(handout, 5, mockContext) as React.ReactElement);
      expect(container.textContent).toContain('Dozorca');
      expect(container.textContent).toContain('Klucz do wiezy');
    });

    it('4.7: Messages without handouts parse cleanly into narrative, dialogue, and whisper', () => {
      const standardTurn = [
        'Wchodzicie do zakurzonego gabinetu.',
        'Profesor Armitage: „Nie dotykajcie tych ksiąg!”',
        '@Janusz: Rozglądam się uważnie po kątach.',
        '[Co robisz?]',
      ].join('\n');

      const cleaned = cleanupContent(standardTurn);
      const sections = parseIntoSections(cleaned);

      expect(sections.length).toBe(4);
      expect(sections[0].type).toBe('narrative');
      expect(sections[0].content).toContain('Wchodzicie do zakurzonego gabinetu.');

      expect(sections[1].type).toBe('dialogue');
      expect(sections[1].speaker).toBe('Profesor Armitage');
      expect(sections[1].content).toBe('Nie dotykajcie tych ksiąg!');

      expect(sections[2].type).toBe('perspective');
      expect(sections[2].characterName).toBe('Janusz');

      expect(sections[3].type).toBe('whisper');
      expect(sections[3].content).toBe('Co robisz?');
    });

    it('4.8: Full pipeline formatNarrative executes end-to-end without errors', () => {
      const complexDialogueAndHandout = [
        'Wchodzicie do piwnicy.',
        'Doktor: „Spójrzcie na ten stół.”',
        '[HANDOUT:tajny-list-mecenasa]',
        'Na podłodze leży również stary wycinek:',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '📰 ARKHAM GAZETTE',
        'STRANGE LIGHTS OBSERVED OVER INNSMOUTH',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '[Co robisz?]',
      ].join('\n');

      expect(() => {
        const nodes = formatNarrative(
          complexDialogueAndHandout,
          undefined,
          undefined,
          false,
          mockContext
        );
        expect(nodes.length).toBeGreaterThanOrEqual(4);
        render(React.createElement('div', null, ...(nodes as React.ReactNode[])));
      }).not.toThrow();
    });
  });
});
