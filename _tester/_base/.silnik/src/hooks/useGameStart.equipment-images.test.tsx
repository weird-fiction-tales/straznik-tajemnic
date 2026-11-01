import { act, renderHook } from '@testing-library/react';
import type { Character, EquipmentItem } from '@/lib/types';
import { fetchWithApiKeys } from '@/lib/api-keys-service';
import { parseSSEStream } from '@/lib/sse-parser';
import { defaultAISettings } from '@/lib/ai-settings/defaults';
import { useEquipmentThumbnails } from './useEquipmentThumbnails';
import { useGameStart } from './useGameStart';

jest.mock('@/lib/api-keys-service', () => ({
  fetchWithApiKeys: jest.fn(),
  getApiKeyHeaders: () => ({}),
  isPureTextMode: () => true,
}));
jest.mock('@/lib/sse-parser', () => ({
  parseSSEStream: jest.fn(),
  createSseParseErrorHandler: () => jest.fn(),
}));
jest.mock('@/lib/posthog', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/ai-settings/cost-control', () => ({
  resetSessionTokens: jest.fn(),
}));
jest.mock('@/lib/character-cloud-sync', () => ({
  persistCharacters: jest.fn(),
}));
jest.mock('@/lib/time-manager', () => ({
  timeManager: {
    getTime: () => ({ year: 1973, month: 9, day: 18, hour: 19, minute: 30 }),
    resetForAdventure: jest.fn(),
  },
}));
jest.mock('./useEquipmentThumbnails', () => ({
  useEquipmentThumbnails: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  jest.mocked(fetchWithApiKeys).mockResolvedValue({ ok: true } as Response);
  jest.mocked(parseSSEStream).mockResolvedValue('Ciche otwarcie.');
});

test('nowy start zachowuje gotowy obraz startowego ekwipunku, a czyści obrazy fabularnych zdobyczy', async () => {
  const starting: EquipmentItem = {
    id: 'starting-flashlight',
    name: 'Latarka',
    category: 'tool',
    source: 'starting',
    visualSource: 'generated',
    imageUrl: 'data:image/webp;base64,ready',
    imagePrompt: 'A period flashlight',
  };
  const previousLoot: EquipmentItem = {
    id: 'previous-photo',
    name: 'Fotografia z poprzedniej sprawy',
    category: 'document',
    source: 'found',
    visualSource: 'generated',
    imageUrl: '/handouts/previous-case.webp',
    imagePrompt: 'A previous clue',
  };
  const character = {
    id: 'pc',
    name: 'Jan',
    occupation: 'Dziennikarz',
    equipment: [starting, previousLoot],
    background: '',
    skills: {},
    hp: 10,
    san: 50,
    mp: 10,
    luck: 50,
  } as Character;
  const thumbnails = jest.fn();
  jest
    .mocked(useEquipmentThumbnails)
    .mockReturnValue({ generateThumbnailsInBackground: thumbnails });
  const props: Parameters<typeof useGameStart>[0] = {
    setHasStartedGame: jest.fn(),
    activeCharacter: character,
    characters: [character],
    setActiveCharacter: jest.fn(),
    setCharacters: jest.fn(),
    pdfMemory: {},
    adventureContext: {
      id: 'cien-nad-prabutami',
      title: 'Cień nad Prabutami',
      yearRange: '1973-1974',
      country: 'Polska',
      location: 'Warszawa',
    },
    hotSeatConfig: { enabled: false, players: [] },
    setMessages: jest.fn(),
    tts: {
      voiceEnabled: false,
      isTTSEnabled: false,
      generateVoiceForMessage: jest.fn(async () => {}),
      addToQueue: jest.fn(),
      startInitialBuffering: jest.fn(),
      stopCurrentAudio: jest.fn(),
    },
    aiSettings: { ...defaultAISettings, imageGenerationEnabled: false },
  };
  const { result } = renderHook(() => useGameStart(props));

  await act(async () => {
    await result.current.handleStartGame();
  });

  expect(thumbnails).toHaveBeenCalledWith(
    expect.objectContaining({
      equipment: [
        starting,
        { ...previousLoot, imageUrl: undefined, imagePrompt: undefined },
      ],
    })
  );
});
