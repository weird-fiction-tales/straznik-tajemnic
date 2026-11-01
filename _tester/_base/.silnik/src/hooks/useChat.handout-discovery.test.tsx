import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { useChat } from './useChat';
import { defaultAISettings } from '@/lib/ai-settings/defaults';
import type { Character, Message } from '@/lib/types';
import { getAdventureById } from '@/lib/adventures-data';
import { makePublicJournalFixture } from '@/tests/fixtures/public-journal';
import { buildPublicJournal } from '@/lib/journal/public-journal';
import { storeCampaignMemoryScope } from '@/core/memory/campaign-scope';

jest.mock('@/lib/api-keys-service', () => ({ isPureTextMode: () => false }));
jest.mock('@/lib/posthog', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/persistent-media-cache', () => ({
  STORES: { CHARACTER_IMAGES: 'character-images' },
  persistentMediaCache: { isAvailable: () => false, setChatImage: jest.fn(async () => true), set: jest.fn(async () => true),
    getNpcPortrait: jest.fn(async () => 'data:image/png;base64,cHVibGlj'), setNpcPortrait: jest.fn(async () => true) },
}));

afterEach(() => { cleanup(); localStorage.clear(); });
const opening = '/adventure-packs/cien-nad-prabutami/opening-warszawa-redakcja.png';
const options: Parameters<typeof useChat>[0] = {
  pdfMemory: {}, activeCharacter: null, characters: [], setCharacters: jest.fn(), setActiveCharacter: jest.fn(),
  voiceEnabled: false, isTTSEnabled: false, generateVoiceForMessage: jest.fn(async () => {}), addToQueue: jest.fn(),
  aiSettings: { ...defaultAISettings, imageGenerationEnabled: true },
  adventureContext: { id: 'cien-nad-prabutami', title: 'Cień nad Prabutami', location: 'loc-warszawa-redakcja', era: 'prl' },
};

test('restored opening history suppresses the same prepared location asset', async () => {
  const history: Message[] = [
    { id: 'intro', role: 'assistant', content: 'Helena podaje teczkę.', timestamp: new Date(), generatedImages: [opening], generatedImageTypes: ['scene'] },
    { id: 'next', role: 'assistant', content: 'Zaglądasz do środka.', timestamp: new Date() },
  ];
  localStorage.setItem('zew_chat_messages', JSON.stringify(history));
  const { result } = renderHook(() => useChat(options));
  await waitFor(() => expect(result.current.messages).toHaveLength(2));
  await act(async () => result.current.generateImages([
    { prompt: 'redakcja', type: 'location', locationName: 'redakcja warszawa' },
  ], 'next'));
  expect(result.current.messages.flatMap(message => message.generatedImages ?? [])).toEqual([opening]);
});

test('attaches an actually published portrait to shared public knowledge and retains it independently of chat history', async () => {
  const fixture = makePublicJournalFixture('pl');
  storeCampaignMemoryScope({ ...fixture.chapter, schemaVersion: 1, kind: 'scenario' });
  localStorage.setItem('zew_chat_messages', JSON.stringify(fixture.messages));
  const { result } = renderHook(() => {
    const [characters, setCharacters] = useState(fixture.characters);
    const [activeCharacter, setActiveCharacter] = useState<Character | null>(fixture.characters[0]);
    const chat = useChat({ ...options, characters, setCharacters, activeCharacter, setActiveCharacter,
      adventureContext: { id: fixture.chapter.adventureId, title: 'Archive', location: fixture.labels.place, era: 'classic' },
      pdfMemory: { adventureDossierFingerprint: fixture.binding.editionFingerprint } });
    return { chat, characters };
  });
  await act(async () => result.current.chat.generateImages([{ prompt: 'Public portrait', type: 'portrait', portraitName: fixture.labels.person }], 'journal-source-a'));
  await waitFor(() => {
    const model = buildPublicJournal({ characters: result.current.characters, chapter: fixture.chapter, binding: fixture.binding, locale: 'pl' });
    expect(model.cards.find(card => card.title === fixture.labels.person)?.imageCacheKey).toContain('journal:journal-run:');
  });
  const saved = JSON.parse(JSON.stringify(result.current.characters));
  const model = buildPublicJournal({ characters: saved, chapter: fixture.chapter, binding: fixture.binding, messages: [], locale: 'pl' });
  expect(model.cards.find(card => card.title === fixture.labels.person)?.imageCacheKey).toBeTruthy();
  expect(model.cards.find(card => card.title === 'Leon')?.imageCacheKey).toBeUndefined();
  expect(JSON.stringify(saved.flatMap((character: import('@/lib/types').Character) => character.journal?.map(entry => entry.publicKnowledge)))).not.toContain('data:image');
});

test.each(['cien-nad-prabutami', 'englewood-murder-castle-1893'])(
  '%s item illustrations cannot bypass the active dossier handout discovery gate', async adventureId => {
  localStorage.setItem('zew_chat_messages', JSON.stringify([
    { id: 'intro', role: 'assistant', content: 'Zamknięta teczka.', timestamp: new Date() },
  ]));
  const adventure = getAdventureById(adventureId)!;
  const { result } = renderHook(() => useChat({ ...options, adventureContext: adventure, pdfMemory: { adventureDossierFingerprint: `sha256:${'0'.repeat(64)}` } }));
  await act(async () => result.current.generateImages([
    { prompt: 'detailed evidence', type: 'item', itemName: adventure.handouts![0].title },
  ], 'intro'));
  expect(result.current.messages[0].generatedImages ?? []).toEqual([]);
});
