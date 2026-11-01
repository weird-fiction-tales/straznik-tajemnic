import { act, renderHook, waitFor } from '@testing-library/react';
import { useChat } from './useChat';
import { fetchWithApiKeys } from '@/lib/api-keys-service';
import { parseSSEStream } from '@/lib/sse-parser';
import type { GameTime } from '@/lib/types';
import { createChaseState } from '@/lib/chase/chase-engine';
import { toast } from '@/components/ui/use-toast';
import { defaultAISettings } from '@/lib/ai-settings/defaults';

jest.mock('@/lib/api-keys-service', () => ({
  fetchWithApiKeys: jest.fn(),
}));

jest.mock('@/lib/sse-parser', () => ({
  parseSSEStream: jest.fn(),
  createSseParseErrorHandler: jest.fn(() => jest.fn()),
}));

jest.mock('@/lib/posthog', () => ({
  trackEvent: jest.fn(),
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
    setTime: jest.fn(),
  },
}));

jest.mock('@/lib/persistent-media-cache', () => ({
  persistentMediaCache: {
    isAvailable: jest.fn(() => false),
  },
}));

const partialGameTime: GameTime = {
  year: 1920,
  month: 10,
  day: 1,
  hour: 20,
  minute: 5,
};

const defaultOptions: Parameters<typeof useChat>[0] = {
  pdfMemory: {},
  activeCharacter: null,
  characters: [],
  setCharacters: jest.fn(),
  setActiveCharacter: jest.fn(),
  voiceEnabled: false,
  isTTSEnabled: false,
  generateVoiceForMessage: jest.fn().mockResolvedValue(undefined),
  addToQueue: jest.fn(),
  aiSettings: { ...defaultAISettings, imageGenerationEnabled: false },
};

const mockDismissNotice = jest.fn();
jest.mock('@/components/ui/use-toast', () => ({
  toast: jest.fn(() => ({ dismiss: mockDismissNotice })),
}));

describe('useChat context budget failure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem(
      'zew_chat_messages',
      JSON.stringify([
        {
          id: 'past',
          role: 'assistant',
          content: 'Earlier scene.',
          timestamp: new Date(0),
          finishReason: 'MAX_TOKENS',
        },
      ])
    );
    jest.mocked(fetchWithApiKeys).mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        code: 'CAMPAIGN_CONTEXT_BUDGET_EXCEEDED',
        error: 'budget',
      }),
    } as Response);
  });

  it.each(['pl', 'en'] as const)(
    'restores the draft (%s) without persisting an error as GM narration or closing the session',
    async (locale) => {
      process.env.NEXT_INTL_TEST_LOCALE = locale;
      const { result } = renderHook(() =>
        useChat({ ...defaultOptions, locale })
      );
      await act(async () => {
        expect(await result.current.handleSendMessage('[KONIEC_SESJI]')).toBe(
          false
        );
      });
      expect(result.current.messages.map((m) => m.id)).toEqual(['past']);
      expect(result.current.newMessage).toBe('[KONIEC_SESJI]');
      expect(result.current.sessionEndStatus).toBe('idle');
      expect(result.current.isLoading).toBe(false);
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: locale === 'pl' ? 'Tura zatrzymana' : 'Turn paused',
        })
      );
      expect(parseSSEStream).not.toHaveBeenCalled();
      expect(fetchWithApiKeys).toHaveBeenCalledTimes(1);
    }
  );

  it('unlocks a failed continuation for manual retry', async () => {
    const { result } = renderHook(() => useChat(defaultOptions));
    await act(async () => {
      await result.current.handleContinueNarration?.('past');
    });
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].continuationRequested).not.toBe(true);
    expect(toast).toHaveBeenCalled();
    await act(async () => {
      await result.current.handleContinueNarration?.('past');
    });
    expect(fetchWithApiKeys).toHaveBeenCalledTimes(2);
    expect(mockDismissNotice).toHaveBeenCalledTimes(1);
  });
  afterEach(() => {
    delete process.env.NEXT_INTL_TEST_LOCALE;
  });

  it('reuses resolved chase mechanics when retrying the same action', async () => {
    const chase = createChaseState({
      fleeing: { id: 'alice', name: 'Alice', mov: 8, isPlayer: true },
      pursuers: [{ id: 'pursuer', name: 'Pursuer', mov: 8, isPlayer: false }],
      trackLength: 20,
      escapeDistanceThreshold: 10,
    });
    localStorage.setItem('zew_active_chase_state', JSON.stringify(chase));
    const { result } = renderHook(() => useChat(defaultOptions));
    const action = '[DICE_ROLL] Test: REGULAR';
    await act(async () => {
      await result.current.handleSendMessage(action);
    });
    const first = JSON.parse(
      String(jest.mocked(fetchWithApiKeys).mock.calls[0][1]?.body)
    );
    expect(first.mechanicsContext.chase).not.toEqual(chase);
    await act(async () => {
      await result.current.handleSendMessage(action);
    });
    const second = JSON.parse(
      String(jest.mocked(fetchWithApiKeys).mock.calls[1][1]?.body)
    );
    expect(second.mechanicsContext).toEqual(first.mechanicsContext);
    expect(mockDismissNotice).toHaveBeenCalledTimes(1);
  });
});
