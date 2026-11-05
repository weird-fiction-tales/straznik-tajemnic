import { act, renderHook } from '@testing-library/react';
import { useGameStart } from './useGameStart';
import { fetchWithApiKeys, getApiKeyHeaders } from '@/lib/api-keys-service';
import { parseSSEStream } from '@/lib/sse-parser';
import type { Message } from '@/lib/types';
import { defaultAISettings } from '@/lib/ai-settings/defaults';

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
      year: 1973,
      month: 1,
      day: 14,
      hour: 10,
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

describe('useGameStart - Error Handling & Retry Gates (Issue #520)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('w razie błędu 503 (High Demand) nie aktywuje hasStartedGame, ustawia startError z diagnozą i nie zostawia pustego dymka', async () => {
    const setHasStartedGame = jest.fn();
    let messages: Message[] = [];
    const setMessages: Parameters<typeof useGameStart>[0]['setMessages'] = (
      update
    ) => {
      messages = typeof update === 'function' ? update(messages) : update;
    };

    // Preflight (jeśli nastąpi) zwraca 200, a /api/chat zwraca 503 UNAVAILABLE
    jest.mocked(fetchWithApiKeys).mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({
        error:
          'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.',
      }),
    } as Response);

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

    // 1. Twarda bramka: gra NIE może wystartować
    expect(setHasStartedGame).not.toHaveBeenCalledWith(true);

    // 2. Stan błędu musi być udostępniony dla ekranu ładowania
    expect(result.current.startError).not.toBeNull();
    expect(result.current.startError?.statusCode).toBe(503);
    expect(result.current.startError?.category).toBe('server_overloaded');
    expect(result.current.startError?.userAdvice).toBeDefined();

    // 3. Żaden pusty dymek asystenta nie może zostać w czacie
    const emptyMessages = messages.filter((m) => !m.content || m.content.trim() === '');
    expect(emptyMessages).toHaveLength(0);

    // 4. Możliwość anulowania i powrotu do ekranu startowego
    act(() => {
      result.current.cancelStartGame();
    });
    expect(result.current.startError).toBeNull();
    expect(result.current.startProgress).toBe(0);
  });

  it('w razie przerwania strumienia (failed to pipe response / network blip) poprawnie klasyfikuje błąd i umożliwia ponowienie', async () => {
    const setHasStartedGame = jest.fn();
    let messages: Message[] = [];
    const setMessages: Parameters<typeof useGameStart>[0]['setMessages'] = (
      update
    ) => {
      messages = typeof update === 'function' ? update(messages) : update;
    };

    // fetch zwraca 200, ale parseSSEStream rzuca błąd przerwanego potoku
    jest.mocked(fetchWithApiKeys).mockResolvedValueOnce({
      ok: true,
      status: 200,
    } as Response);
    jest.mocked(parseSSEStream).mockRejectedValueOnce(
      new TypeError('Failed to fetch: network stream aborted unexpectedly')
    );

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

    expect(setHasStartedGame).not.toHaveBeenCalledWith(true);
    expect(result.current.startError).not.toBeNull();
    expect(result.current.startError?.category).toBe('network_error');

    // Ponowienie (retry)
    jest.mocked(fetchWithApiKeys).mockResolvedValueOnce({
      ok: true,
      status: 200,
    } as Response);
    jest.mocked(parseSSEStream).mockImplementationOnce(async (_res, callbacks) => {
      callbacks?.onText?.('Pomyślne otwarcie kroniki po retry.');
      callbacks?.onMetadata?.({ type: 'metadata', finishReason: 'STOP' });
      return 'Pomyślne otwarcie kroniki po retry.';
    });

    await act(async () => {
      await result.current.retryStartGame();
    });

    expect(result.current.startError).toBeNull();
  });
});
