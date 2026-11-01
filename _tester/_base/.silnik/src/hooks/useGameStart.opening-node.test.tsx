import { act, renderHook } from '@testing-library/react';
import { useGameStart } from './useGameStart';
import { fetchWithApiKeys } from '@/lib/api-keys-service';
import { STREFA_11_ADVENTURES } from '@/lib/adventures-data';
import { defaultAISettings } from '@/lib/ai-settings/defaults';

jest.mock('@/lib/api-keys-service', () => ({
  fetchWithApiKeys: jest.fn(), getApiKeyHeaders: () => ({}),
}));
jest.mock('@/lib/posthog', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/ai-settings/cost-control', () => ({ resetSessionTokens: jest.fn() }));
jest.mock('./useEquipmentThumbnails', () => ({
  useEquipmentThumbnails: () => ({ generateThumbnailsInBackground: jest.fn() }),
}));

describe('new game uses the dossier opening node', () => {
  beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); });

  it.each(['pl', 'en'] as const)('%s: resets a stale active node and anchors the request and setup', async (locale) => {
    const original = STREFA_11_ADVENTURES.find(a => a.id === 'cien-nad-prabutami')!;
    const adventure = { ...original, activeNodeId: 'node-elblag-klasztor', activeLocationId: 'loc-elblag-klasztor' };
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.mocked(fetchWithApiKeys).mockResolvedValue({
      ok: false, status: 422, statusText: 'Opening rejected',
      json: async () => ({ error: 'Test stops after inspecting the real start request' }),
    } as Response);
    const { result } = renderHook(() => useGameStart({
      locale, adventureContext: adventure,
      activeCharacter: null, characters: [], pdfMemory: {},
      setHasStartedGame: jest.fn(), setActiveCharacter: jest.fn(),
      setCharacters: jest.fn(), setMessages: jest.fn(),
      hotSeatConfig: { enabled: false, players: [] },
      aiSettings: { ...defaultAISettings, imageGenerationEnabled: false },
      tts: { voiceEnabled: false, isTTSEnabled: false,
        generateVoiceForMessage: jest.fn(), addToQueue: jest.fn(),
        startInitialBuffering: jest.fn(), stopCurrentAudio: jest.fn() },
    }));
    try {
      await act(async () => result.current.handleStartGame());
      const chat = jest.mocked(fetchWithApiKeys).mock.calls.find(([url]) => url === '/api/chat');
      expect(chat).toBeDefined();
      const body = JSON.parse(String(chat![1]?.body));
      expect(body.adventureContext.activeNodeId).toBe('node-warszawa-redakcja');
      expect(body.adventureContext.activeLocationId).toBe('loc-warszawa-redakcja');
      expect(body.message).toContain("Redakcja 'Sygnałów Nieznanego' (RTV Warszawa)");
      expect(body.message).toContain('Helena Krawczyk');
      expect(body.message).toContain(locale === 'en' ? 'MANDATORY OPENING SCENE' : 'OBOWIĄZKOWA SCENA OTWARCIA');
      expect(JSON.parse(localStorage.getItem('world_setup_v1')!)).toMatchObject({
        openingScene: { nodeId: 'node-warszawa-redakcja', locationId: 'loc-warszawa-redakcja',
          location: "Redakcja 'Sygnałów Nieznanego' (RTV Warszawa)" },
      });
      expect(adventure.activeNodeId).toBe('node-elblag-klasztor');
    } finally { consoleError.mockRestore(); }
  });
});
