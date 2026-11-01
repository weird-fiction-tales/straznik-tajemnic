import { retainPublishedJournalVisual } from './published-visuals';
import {
  applyPublishedJournalVisuals,
  buildPublicJournal,
} from './public-journal';
import { persistentMediaCache, STORES } from '@/lib/persistent-media-cache';
import { makePublicJournalFixture } from '@/tests/fixtures/public-journal';

jest.mock('@/lib/persistent-media-cache', () => ({
  STORES: { CHARACTER_IMAGES: 'character-images' },
  persistentMediaCache: { set: jest.fn(async () => true) },
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(persistentMediaCache.set).mockResolvedValue(true);
});

it('retains disclosed bytes outside the expiring chat cache without placing base64 in the journal', async () => {
  const fixture = makePublicJournalFixture('pl');
  const publication = await retainPublishedJournalVisual({
    kind: 'person',
    name: fixture.labels.person,
    imageUrl: 'data:image/png;base64,cHVibGlj',
    messageId: 'portrait',
    context: { scope: fixture.chapter, binding: fixture.binding },
  });
  expect(persistentMediaCache.set).toHaveBeenCalledWith(
    STORES.CHARACTER_IMAGES,
    expect.stringContaining('journal:journal-run:'),
    'data:image/png;base64,cHVibGlj',
    { messageId: 'portrait' }
  );
  const characters = JSON.parse(
    JSON.stringify(
      applyPublishedJournalVisuals(fixture.characters, [publication!])
    )
  );
  const model = buildPublicJournal({
    characters,
    chapter: fixture.chapter,
    binding: fixture.binding,
    locale: 'pl',
  });
  expect(
    model.cards.find((card) => card.title === fixture.labels.person)
      ?.imageCacheKey
  ).toBe(publication?.visual.cacheKey);
  expect(JSON.stringify(characters)).not.toContain('data:image');
  expect(
    applyPublishedJournalVisuals(characters, [
      {
        ...publication!,
        binding: { ...fixture.binding, editionFingerprint: 'foreign' },
      },
    ])
  ).toBe(characters);
});

it('does not persist a dangling image reference when retaining its bytes fails or its URL is temporary', async () => {
  jest.mocked(persistentMediaCache.set).mockResolvedValue(false);
  const input = {
    kind: 'person' as const,
    name: 'Dozorca',
    messageId: 'a',
    context: {},
  };
  expect(
    await retainPublishedJournalVisual({
      ...input,
      imageUrl: 'data:image/png;base64,cHVibGlj',
    })
  ).toBeNull();
  expect(
    await retainPublishedJournalVisual({ ...input, imageUrl: 'blob:temporary' })
  ).toBeNull();
});
