/**
 * Testy jednostkowe dla deterministycznego resolvera handoutow (Issue #649 - Milestone M3).
 *
 * Przestrzega inwariantu typograficznego: wylacznie standardowy znak myslnika (-).
 */

import { resolveHandoutBySlug } from './handout-resolver';
import { getQuickSetupAdventures, type AdventureHandout, type AdventureContext } from './adventures-data';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('resolveHandoutBySlug (Issue #649)', () => {
  const mockContext: AdventureContext = {
    id: 'test-scenario',
    title: 'Testowy Scenariusz',
    era: 'noir',
    eraLabel: 'Lata 30.',
    yearRange: '1930-1935',
    location: 'Warszawa',
    country: 'Polska',
    tone: 'noir',
    themes: ['Tajemnica'],
    suggestedOccupations: ['Detektyw'],
    suggestedArchetypes: ['investigator'],
    hook: 'Zlecenie',
    description: 'Opis',
    estimatedSessions: '1',
    playerCount: '1-4',
    difficulty: 'easy',
    handouts: [
      {
        slug: 'tajny-list-mecenasa',
        title: 'Poufny list mecenasa',
        image: '/handouts/list.webp',
        textContent: 'Tresc listu adwokata z 1932 roku.',
        handoutType: 'letter',
      },
      {
        slug: 'clue-mapa-piwnic',
        title: 'Plan piwnic kamienicy',
        image: '/handouts/plan.webp',
        handoutType: 'map',
      },
    ],
  };

  it('zwraca handout na podstawie dokladnego sluga z biezacego adventureContext', () => {
    const result = resolveHandoutBySlug('tajny-list-mecenasa', mockContext);
    expect(result).toBeDefined();
    expect(result?.title).toBe('Poufny list mecenasa');
    expect(result?.textContent).toContain('Tresc listu adwokata');
  });

  it('obsluguje case-insensitive slug', () => {
    const result = resolveHandoutBySlug('TAJNY-LIST-MECENASA', mockContext);
    expect(result).toBeDefined();
    expect(result?.title).toBe('Poufny list mecenasa');
  });

  it('obsluguje dopasowanie bez prefiksu clue-/map-', () => {
    const result = resolveHandoutBySlug('mapa-piwnic', mockContext);
    expect(result).toBeDefined();
    expect(result?.title).toBe('Plan piwnic kamienicy');
    expect(result?.handoutType).toBe('map');
  });

  it('rozwiazuje znane handouty z STREFA_11_ADVENTURES gdy brak w kontekscie', () => {
    const result = resolveHandoutBySlug('clue-photo-prabuty-1947', null);
    expect(result).toBeDefined();
    expect(result?.title).toContain('Prabutach');
  });

  it('rozwiazuje audio handout z STREFA_11_ADVENTURES', () => {
    const result = resolveHandoutBySlug('audio-sb-wiretap-elblag', null);
    expect(result).toBeDefined();
    expect(result?.audioUrl).toBeTruthy();
  });

  it('rozwiazuje fizyczne dowody ze Startera Nawiedzony Dom (Issue #661 / #700)', () => {
    const keys = resolveHandoutBySlug('clue-01-knott-keys', null);
    expect(keys).toBeDefined();
    expect(keys?.title).toContain('Knotta');
    expect(keys?.image).toBe('/adventure-packs/case-s11-01/clue-01-knott-keys.webp');

    const globe = resolveHandoutBySlug('boston-globe-1918', null);
    expect(globe).toBeDefined();
    expect(globe?.title).toContain('Boston Globe');
    expect(globe?.handoutType).toBe('newspaper');
  });

  it('zwraca null dla nieistniejacego sluga bez bledu krytycznego', () => {
    const result = resolveHandoutBySlug('nieistniejacy-rekvizyt-404', mockContext);
    expect(result).toBeNull();
  });

  it('zwraca null dla pustego, null lub undefined wejscia', () => {
    expect(resolveHandoutBySlug('', mockContext)).toBeNull();
    expect(resolveHandoutBySlug('   ', mockContext)).toBeNull();
    expect(resolveHandoutBySlug(null as unknown as string, mockContext)).toBeNull();
    expect(resolveHandoutBySlug(undefined as unknown as string, mockContext)).toBeNull();
  });
});


describe('audio handouts #665', () => {
  it.each([
    ['audio-sb-wiretap-elblag', 'reel_to_reel'],
    ['audio-broken-brakes-log', 'cassette'],
    ['audio-stilon-c60-interview', 'cassette'],
    ['audio-vhs-broadcast-anomaly', 'radio'],
  ])('resolves both languages and the carrier for %s', (slug, reelType) => {
    const handout = resolveHandoutBySlug(slug);
    expect(handout?.audioUrlPl).toMatch(/\.mp3$/);
    expect(handout?.audioUrlEn).toMatch(/-en\.mp3$/);
    expect(handout?.reelType).toBe(reelType);
  });
});

 it('does not borrow an audio recording from another active adventure', () => {
   expect(resolveHandoutBySlug('audio-sb-wiretap-elblag', { id: 'other', handouts: [] } as unknown as AdventureContext)).toBeNull();
 });

it.each([
 ['audio-edison-wax-cylinder', 'gramophone'],
 ['audio-crowe-interrogation-disc', 'gramophone'],
 ['audio-gillespie-1977-wiretap', 'cassette'],
 ['audio-voicemail-in-a-field', 'radio'],
])('resolves both languages for English Quick Setup %s', (slug, reelType) => {
 const handout = resolveHandoutBySlug(slug);
 expect(handout?.audioUrlPl).toMatch(/-pl\.mp3$/);
 expect(handout?.audioUrlEn).toBe(handout?.audioUrl);
 expect(handout?.reelType).toBe(reelType);
});

it('restores Starter evidence from its own abbreviated context', () => {
 expect(resolveHandoutBySlug('clue-01-knott-keys', { id: 'nawiedzony-dom' } as AdventureContext)?.slug).toBe('clue-01-knott-keys');
});


it.each(['pl', 'en'])('ships both language assets for every %s Quick Setup in both public roots', (locale) => {
  for (const adventure of getQuickSetupAdventures(locale)) {
    const recordings = adventure.handouts?.filter(handout => handout.audioUrl) || [];
    expect(recordings.length).toBeGreaterThan(0);
    for (const recording of recordings) {
      const handout = resolveHandoutBySlug(recording.slug, adventure);
      expect(handout?.nodeId).toBe(recording.nodeId);
      expect(adventure.graph?.nodes?.some(node => node.id === handout?.nodeId)).toBe(true);
      for (const url of [handout?.audioUrlPl, handout?.audioUrlEn]) {
        expect(url).toMatch(/^\/audio\/handouts\/.+\.mp3$/);
        const runtime = readFileSync(resolve(process.cwd(), `public${url}`));
        const mirror = readFileSync(resolve(process.cwd(), `../../../public${url}`));
        expect(runtime.length).toBeGreaterThan(0);
        expect(runtime.length).toBeLessThanOrEqual(1500000);
        expect(runtime.equals(mirror)).toBe(true);
      }
    }
  }
});
