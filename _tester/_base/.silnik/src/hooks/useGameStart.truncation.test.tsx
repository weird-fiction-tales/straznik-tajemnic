import { act, renderHook } from '@testing-library/react';
import { useGameStart } from './useGameStart';
import { fetchWithApiKeys, getApiKeyHeaders } from '@/lib/api-keys-service';
import { parseSSEStream } from '@/lib/sse-parser';
import type { Message } from '@/lib/types';
import { defaultAISettings } from '@/lib/ai-settings/defaults';
import type { WorldSetupBundleV1 } from '@/lib/world-setup';

jest.mock('@/lib/api-keys-service', () => ({
  fetchWithApiKeys: jest.fn(),
  getApiKeyHeaders: jest.fn(() => ({})),
}));

jest.mock('@/lib/sse-parser', () => ({
  parseSSEStream: jest.fn(),
  createSseParseErrorHandler: jest.fn(() => jest.fn()),
}));

jest.mock('@/lib/posthog', () => ({
  trackEvent: jest.fn(),
}));

jest.mock('@/lib/ai-settings/cost-control', () => ({
  resetSessionTokens: jest.fn(),
}));

jest.mock('@/lib/time-manager', () => ({
  timeManager: {
    getTime: jest.fn(() => ({
      year: 1920,
      month: 10,
      day: 1,
      hour: 20,
      minute: 0,
    })),
    resetForAdventure: jest.fn(),
  },
}));

jest.mock('./useEquipmentThumbnails', () => ({
  useEquipmentThumbnails: jest.fn(() => ({
    generateThumbnailsInBackground: jest.fn(),
  })),
}));

describe('useGameStart - finishReason intra', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('odrzuca częściowe intro MAX_TOKENS i blokuje wejście', async () => {
    const worldSetup: WorldSetupBundleV1 = {
      schemaVersion: 1,
      id: 'world-prabuty',
      scenarioId: 'cien-nad-prabutami',
      adventureTitle: 'Cień nad Prabutami',
      createdAt: '2026-09-01T10:00:00.000Z',
      canonRevision: 1,
      eraContext: {
        schemaVersion: 1,
        sceneDate: null,
        effectiveYear: 1973,
        countryCode: 'PL',
        regionProfile: 'PL',
        source: 'scenario-range',
        rulesVersion: '1.0.0',
      },
      eraManifestId: 'pl-1973-1974',
      adventureGraph: {},
      factions: [],
      npcs: [],
      locations: [],
      items: [],
      events: [],
      openingScene: {},
      nearestBranches: [],
      adventureContent: 'Treść',
      supplementalInformation: [],
      sources: [],
      knowledgeGaps: [],
      exceptions: [],
      phaseResults: [
        {
          phase: 'era',
          status: 'passed',
          critical: true,
          retryable: false,
          durationMs: 0,
          estimatedCostUsd: 0,
        },
      ],
    };
    jest
      .mocked(fetchWithApiKeys)
      .mockResolvedValueOnce({ ok: true } as Response);
    jest
      .mocked(parseSSEStream)
      .mockImplementation(async (_response, callbacks) => {
        callbacks?.onText?.('Mgła przesuwa się nad portem...');
        callbacks?.onMetadata?.({
          type: 'metadata',
          finishReason: 'MAX_TOKENS',
        });
        return 'Mgła przesuwa się nad portem...';
      });

    let messages: Message[] = [];
    const setMessages: Parameters<typeof useGameStart>[0]['setMessages'] = (
      update
    ) => {
      messages = typeof update === 'function' ? update(messages) : update;
    };

    const props: Parameters<typeof useGameStart>[0] = {
      setHasStartedGame: jest.fn(),
      activeCharacter: null,
      characters: [],
      setActiveCharacter: jest.fn(),
      setCharacters: jest.fn(),
      pdfMemory: {},
      adventureContext: {
        id: 'cien-nad-prabutami',
        title: 'Cień nad Prabutami',
        yearRange: '1973-1974',
        country: 'Polska',
      },
      hotSeatConfig: { enabled: false, players: [] },
      setMessages,
      tts: {
        voiceEnabled: false,
        isTTSEnabled: false,
        generateVoiceForMessage: jest.fn().mockResolvedValue(undefined),
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

    expect(messages).toHaveLength(0);
    expect(result.current.isReadyToEnter).toBe(false);
    expect(result.current.startError?.category).toBe('opening_incomplete');
    expect(fetchWithApiKeys).toHaveBeenCalledTimes(1);
    expect(fetchWithApiKeys).toHaveBeenCalledWith(
      '/api/chat',
      expect.any(Object)
    );
    expect(
      JSON.parse(localStorage.getItem('world_setup_v1') || '{}')
    ).toMatchObject({
      scenarioId: 'cien-nad-prabutami',
      eraContext: { effectiveYear: 1973, countryCode: 'PL' },
    });
  });

  it('nie wywołuje czatu, gdy preflight nie przechodzi', async () => {
    jest.mocked(fetchWithApiKeys).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({
        error: 'Własny scenariusz wymaga dokładnego kraju.',
      }),
    } as Response);

    let messages: Message[] = [];
    const setMessages: Parameters<typeof useGameStart>[0]['setMessages'] = (
      update
    ) => {
      messages = typeof update === 'function' ? update(messages) : update;
    };
    const setHasStartedGame = jest.fn();
    const props: Parameters<typeof useGameStart>[0] = {
      setHasStartedGame,
      activeCharacter: null,
      characters: [],
      setActiveCharacter: jest.fn(),
      setCharacters: jest.fn(),
      pdfMemory: {},
      adventureContext: {
        id: 'custom',
        title: 'Własna przygoda',
        isCustom: true,
        yearRange: '1973',
      },
      hotSeatConfig: { enabled: false, players: [] },
      setMessages,
      tts: {
        voiceEnabled: false,
        isTTSEnabled: false,
        generateVoiceForMessage: jest.fn().mockResolvedValue(undefined),
        addToQueue: jest.fn(),
        startInitialBuffering: jest.fn(),
        stopCurrentAudio: jest.fn(),
      },
      aiSettings: { ...defaultAISettings, imageGenerationEnabled: false },
    };

    const { result } = renderHook(() => useGameStart(props));
    await act(async () => result.current.handleStartGame());

    expect(fetchWithApiKeys).toHaveBeenCalledTimes(1);
    expect(setHasStartedGame).toHaveBeenCalledWith(false);
    expect(messages[0]?.content).toContain('nie przeszło bramki');
    expect(localStorage.getItem('has_started_game')).toBeNull();
  });

  it('przekazuje nagłówki klucza API do preflightu i w razie błędu 401 emituje open-api-keys-modal oraz zew:stop-music', async () => {
    jest.mocked(getApiKeyHeaders).mockReturnValueOnce({
      'X-Gemini-Api-Key': 'test-gemini-key',
    });

    jest.mocked(fetchWithApiKeys).mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({
        error: 'Wklej swój klucz Google AI Studio w ustawieniach',
        code: 'BYOK_KEY_MISSING',
      }),
    } as Response);

    const openModalListener = jest.fn();
    const stopMusicListener = jest.fn();
    window.addEventListener('open-api-keys-modal', openModalListener);
    window.addEventListener('zew:stop-music', stopMusicListener);

    let messages: Message[] = [];
    const setMessages: Parameters<typeof useGameStart>[0]['setMessages'] = (
      update
    ) => {
      messages = typeof update === 'function' ? update(messages) : update;
    };
    const setHasStartedGame = jest.fn();
    const props: Parameters<typeof useGameStart>[0] = {
      setHasStartedGame,
      activeCharacter: null,
      characters: [],
      setActiveCharacter: jest.fn(),
      setCharacters: jest.fn(),
      pdfMemory: {},
      adventureContext: {
        id: 'custom',
        title: 'Własna przygoda',
        isCustom: true,
        yearRange: '1973',
      },
      hotSeatConfig: { enabled: false, players: [] },
      setMessages,
      tts: {
        voiceEnabled: false,
        isTTSEnabled: false,
        generateVoiceForMessage: jest.fn().mockResolvedValue(undefined),
        addToQueue: jest.fn(),
        startInitialBuffering: jest.fn(),
        stopCurrentAudio: jest.fn(),
      },
      aiSettings: { ...defaultAISettings, imageGenerationEnabled: false },
    };

    const { result } = renderHook(() => useGameStart(props));
    await act(async () => result.current.handleStartGame());

    expect(fetchWithApiKeys).toHaveBeenCalledWith(
      '/api/adventure/setup',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Gemini-Api-Key': 'test-gemini-key',
        }),
      })
    );
    expect(openModalListener).toHaveBeenCalled();
    expect(stopMusicListener).toHaveBeenCalled();
    expect(setHasStartedGame).toHaveBeenCalledWith(false);

    window.removeEventListener('open-api-keys-modal', openModalListener);
    window.removeEventListener('zew:stop-music', stopMusicListener);
  });

  it('wstrzymuje wejście do gry aż do zakończenia całego strumienia SSE (Issue #123)', async () => {
    let hasStartedDuringStream = false;
    const setHasStartedGame = jest.fn((val: boolean) => {
      if (val === true) hasStartedDuringStream = true;
    });

    jest
      .mocked(fetchWithApiKeys)
      .mockResolvedValueOnce({ ok: true } as Response);
    jest
      .mocked(parseSSEStream)
      .mockImplementation(async (_response, callbacks) => {
        // Pierwszy chunk tekstu
        callbacks?.onText?.('Mgła unosi się nad rzeką.');
        expect(hasStartedDuringStream).toBe(false);

        // Kolejny chunk tekstu
        callbacks?.onText?.('Mgła unosi się nad rzeką. Cienie przemykają w zaułkach.');
        expect(hasStartedDuringStream).toBe(false);

        callbacks?.onMetadata?.({ type: 'metadata', finishReason: 'STOP' });
        return 'Mgła unosi się nad rzeką. Cienie przemykają w zaułkach.';
      });

    let messages: Message[] = [];
    const setMessages: Parameters<typeof useGameStart>[0]['setMessages'] = (
      update
    ) => {
      messages = typeof update === 'function' ? update(messages) : update;
    };

    const props: Parameters<typeof useGameStart>[0] = {
      setHasStartedGame,
      activeCharacter: null,
      characters: [],
      setActiveCharacter: jest.fn(),
      setCharacters: jest.fn(),
      pdfMemory: {},
      adventureContext: {
        id: 'cien-nad-prabutami',
        title: 'Cień nad Prabutami',
        yearRange: '1973-1974',
        country: 'Polska',
      },
      hotSeatConfig: { enabled: false, players: [] },
      setMessages,
      tts: {
        voiceEnabled: false,
        isTTSEnabled: false,
        generateVoiceForMessage: jest.fn().mockResolvedValue(undefined),
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

    // Po zakończeniu pełnego strumienia gra przechodzi do czatu
    expect(setHasStartedGame).toHaveBeenCalledWith(true);
    expect(localStorage.getItem('has_started_game')).toBe('true');
  });

  it('buforuje głos lektora przed wejściem do gry gdy TTS jest aktywny (Issue #142)', async () => {
    jest
      .mocked(fetchWithApiKeys)
      .mockResolvedValueOnce({ ok: true } as Response);
    jest
      .mocked(parseSSEStream)
      .mockImplementationOnce(async (_response, callbacks) => {
        callbacks?.onText?.('Mgła przesuwa się nad portem...');
        callbacks?.onMetadata?.({ type: 'metadata', finishReason: 'STOP' });
        return 'Mgła przesuwa się nad portem...';
      });

    const setHasStartedGame = jest.fn();
    const waitForInitialBuffer = jest.fn().mockResolvedValue(undefined);
    let messages: Message[] = [];
    const setMessages: Parameters<typeof useGameStart>[0]['setMessages'] = (
      update
    ) => {
      messages = typeof update === 'function' ? update(messages) : update;
    };

    const props: Parameters<typeof useGameStart>[0] = {
      setHasStartedGame,
      activeCharacter: null,
      characters: [],
      setActiveCharacter: jest.fn(),
      setCharacters: jest.fn(),
      pdfMemory: {},
      adventureContext: {
        id: 'cien-nad-prabutami',
        title: 'Cień nad Prabutami',
        yearRange: '1973-1974',
        country: 'Polska',
      },
      hotSeatConfig: { enabled: false, players: [] },
      setMessages,
      tts: {
        voiceEnabled: true,
        isTTSEnabled: true,
        generateVoiceForMessage: jest.fn().mockResolvedValue(undefined),
        addToQueue: jest.fn(),
        startInitialBuffering: jest.fn(),
        waitForInitialBuffer,
        stopCurrentAudio: jest.fn(),
      },
      aiSettings: { ...defaultAISettings, imageGenerationEnabled: false },
    };

    const { result } = renderHook(() => useGameStart(props));

    await act(async () => {
      await result.current.handleStartGame();
    });

    // Full opening audio has its own bounded preparation deadline.
    expect(waitForInitialBuffer).toHaveBeenCalledWith(60000);
    expect(setHasStartedGame).toHaveBeenCalledWith(true);
  });

  it('wstrzymuje wejście do gry i mowę lektora do momentu potwierdzenia gracza zew:confirm-enter-game (Issue #157)', async () => {
    jest
      .mocked(fetchWithApiKeys)
      .mockResolvedValueOnce({ ok: true } as Response);
    jest
      .mocked(parseSSEStream)
      .mockImplementationOnce(async (_response, callbacks) => {
        callbacks?.onText?.('Mgła przesuwa się nad portem...');
        callbacks?.onMetadata?.({ type: 'metadata', finishReason: 'STOP' });
        return 'Mgła przesuwa się nad portem...';
      });

    const setHasStartedGame = jest.fn();
    const playInitialNarration = jest.fn();
    const waitForInitialBuffer = jest.fn().mockResolvedValue(undefined);
    let messages: Message[] = [];
    const setMessages: Parameters<typeof useGameStart>[0]['setMessages'] = (
      update
    ) => {
      messages = typeof update === 'function' ? update(messages) : update;
    };

    const props: Parameters<typeof useGameStart>[0] = {
      setHasStartedGame,
      activeCharacter: null,
      characters: [],
      setActiveCharacter: jest.fn(),
      setCharacters: jest.fn(),
      pdfMemory: {},
      adventureContext: {
        id: 'cien-nad-prabutami',
        title: 'Cień nad Prabutami',
        yearRange: '1973-1974',
        country: 'Polska',
      },
      hotSeatConfig: { enabled: false, players: [] },
      setMessages,
      tts: {
        voiceEnabled: true,
        isTTSEnabled: true,
        generateVoiceForMessage: jest.fn().mockResolvedValue(undefined),
        addToQueue: jest.fn(),
        startInitialBuffering: jest.fn(),
        waitForInitialBuffer,
        playInitialNarration,
        stopCurrentAudio: jest.fn(),
      },
      aiSettings: { ...defaultAISettings, imageGenerationEnabled: false },
      requirePlayerConfirmation: true,
    };

    const { result } = renderHook(() => useGameStart(props));

    // Uruchom start gry (obietnica czeka na potwierdzenie)
    let startPromise: Promise<void>;
    act(() => {
      startPromise = result.current.handleStartGame();
    });

    // Czekamy chwilę na zakończenie streamingu i buforowania
    await act(async () => {
      await Promise.resolve();
    });

    // Stan powinien być: 100%, isReadyToEnter: true, ale lektor NIE gra i gra NIE jest wystartowana
    expect(result.current.startProgress).toBe(100);
    expect(result.current.isReadyToEnter).toBe(true);
    expect(playInitialNarration).not.toHaveBeenCalled();
    expect(setHasStartedGame).not.toHaveBeenCalled();

    // Gracz klika przycisk CTA (wysyła zdarzenie)
    await act(async () => {
      window.dispatchEvent(new CustomEvent('zew:confirm-enter-game'));
      await startPromise;
    });

    // Po akceptacji: lektor zostaje uruchomiony i następuje przejście do gry
    expect(playInitialNarration).toHaveBeenCalledTimes(1);
    expect(setHasStartedGame).toHaveBeenCalledWith(true);
    expect(result.current.isReadyToEnter).toBe(false);
  });

  it('uruchamia scenariusz custom z gotowym grafem lokalnie przez createPresetWorldSetup bez wywoływania API preflightu', async () => {
    let messages: Message[] = [];
    const setMessages: Parameters<typeof useGameStart>[0]['setMessages'] = (
      update
    ) => {
      messages = typeof update === 'function' ? update(messages) : update;
    };
    const setHasStartedGame = jest.fn();
    const props: Parameters<typeof useGameStart>[0] = {
      setHasStartedGame,
      activeCharacter: null,
      characters: [],
      setActiveCharacter: jest.fn(),
      setCharacters: jest.fn(),
      pdfMemory: {},
      adventureContext: {
        id: 'custom-czarny-jak-wegiel',
        title: 'Czarny Jak Węgiel',
        isCustom: true,
        yearRange: '1925',
        graph: {
          npcs: [
            {
              id: 'npc-1',
              name: 'Główny Informator',
              description: 'Świadek',
            },
          ],
          locations: [
            {
              id: 'loc-1',
              name: 'Zakopane',
              description: 'Tatry',
            },
          ],
          clues: [],
          connections: [],
        },
      },
      hotSeatConfig: { enabled: false, players: [] },
      setMessages,
      tts: {
        voiceEnabled: false,
        isTTSEnabled: false,
        generateVoiceForMessage: jest.fn().mockResolvedValue(undefined),
        addToQueue: jest.fn(),
        startInitialBuffering: jest.fn(),
        stopCurrentAudio: jest.fn(),
      },
      aiSettings: { ...defaultAISettings, imageGenerationEnabled: false },
    };

    jest
      .mocked(fetchWithApiKeys)
      .mockResolvedValueOnce({ ok: true } as Response);
    jest
      .mocked(parseSSEStream)
      .mockImplementation(async (_response, callbacks) => {
        callbacks?.onText?.('Mgła nad Tatrami...');
        return 'Mgła nad Tatrami...';
      });

    const { result } = renderHook(() => useGameStart(props));
    await act(async () => result.current.handleStartGame());

    // Wywołano wyłącznie /api/chat (pominięto preflight /api/adventure/setup)
    expect(fetchWithApiKeys).toHaveBeenCalledTimes(1);
    expect(fetchWithApiKeys).toHaveBeenCalledWith(
      '/api/chat',
      expect.anything()
    );
    const stored = JSON.parse(localStorage.getItem('world_setup_v1') || '{}');
    expect(stored.scenarioId).toBe('custom-czarny-jak-wegiel');
    expect(stored.adventureTitle).toBe('Czarny Jak Węgiel');
    expect(stored.npcs).toHaveLength(1);
    expect(stored.locations).toHaveLength(1);
  });

  it('bezpiecznie przełącza na lokalny setup świata, gdy preflight zwraca DOCUMENT_MODEL_USE_BLOCKED', async () => {
    // Pierwsze wywołanie: preflight /api/adventure/setup
    jest.mocked(fetchWithApiKeys).mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({
        success: false,
        code: 'DOCUMENT_MODEL_USE_BLOCKED',
        error: 'Dokumenty nie są wysyłane do AI.',
      }),
    } as Response);

    // Drugie wywołanie: /api/chat po przełączeniu na preset
    jest.mocked(fetchWithApiKeys).mockResolvedValueOnce({
      ok: true,
    } as Response);
    jest
      .mocked(parseSSEStream)
      .mockImplementation(async (_response, callbacks) => {
        callbacks?.onText?.('Wprowadzenie...');
        return 'Wprowadzenie...';
      });

    let messages: Message[] = [];
    const setMessages: Parameters<typeof useGameStart>[0]['setMessages'] = (
      update
    ) => {
      messages = typeof update === 'function' ? update(messages) : update;
    };
    const setHasStartedGame = jest.fn();
    const props: Parameters<typeof useGameStart>[0] = {
      setHasStartedGame,
      activeCharacter: null,
      characters: [],
      setActiveCharacter: jest.fn(),
      setCharacters: jest.fn(),
      pdfMemory: {},
      adventureContext: {
        id: 'custom-bare',
        title: 'Własny scenariusz bez grafu',
        isCustom: true,
        yearRange: '1920',
      },
      hotSeatConfig: { enabled: false, players: [] },
      setMessages,
      tts: {
        voiceEnabled: false,
        isTTSEnabled: false,
        generateVoiceForMessage: jest.fn().mockResolvedValue(undefined),
        addToQueue: jest.fn(),
        startInitialBuffering: jest.fn(),
        stopCurrentAudio: jest.fn(),
      },
      aiSettings: { ...defaultAISettings, imageGenerationEnabled: false },
    };

    const { result } = renderHook(() => useGameStart(props));
    await act(async () => result.current.handleStartGame());

    // Wywołano preflight (1), a po 403 DOCUMENT_MODEL_USE_BLOCKED nastąpił fallback i przejście do /api/chat (2)
    expect(fetchWithApiKeys).toHaveBeenCalledTimes(2);
    expect(fetchWithApiKeys).toHaveBeenNthCalledWith(
      1,
      '/api/adventure/setup',
      expect.anything()
    );
    expect(fetchWithApiKeys).toHaveBeenNthCalledWith(
      2,
      '/api/chat',
      expect.anything()
    );
    const stored = JSON.parse(localStorage.getItem('world_setup_v1') || '{}');
    expect(stored.scenarioId).toBe('custom-bare');
    expect(stored.adventureTitle).toBe('Własny scenariusz bez grafu');
  });
});
