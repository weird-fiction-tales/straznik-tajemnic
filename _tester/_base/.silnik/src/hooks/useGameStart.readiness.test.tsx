import { act, renderHook, waitFor } from '@testing-library/react';
import { useGameStart } from './useGameStart';
import { fetchWithApiKeys } from '@/lib/api-keys-service';
import { parseSSEStream } from '@/lib/sse-parser';
import { STREFA_11_ADVENTURES } from '@/lib/adventures-data';
import { defaultAISettings } from '@/lib/ai-settings/defaults';

jest.mock('@/lib/api-keys-service', () => ({ fetchWithApiKeys: jest.fn(), getApiKeyHeaders: () => ({}) }));
jest.mock('@/lib/sse-parser', () => ({ parseSSEStream: jest.fn(), createSseParseErrorHandler: () => jest.fn() }));
jest.mock('@/lib/posthog', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/ai-settings/cost-control', () => ({ resetSessionTokens: jest.fn() }));
jest.mock('./useEquipmentThumbnails', () => ({ useEquipmentThumbnails: () => ({ generateThumbnailsInBackground: jest.fn() }) }));

function props(voiceEnabled = false): Parameters<typeof useGameStart>[0] {
  return { adventureContext: STREFA_11_ADVENTURES.find(a => a.id === 'cien-nad-prabutami')!,
    activeCharacter: null, characters: [], pdfMemory: {}, hotSeatConfig: { enabled: false, players: [] },
    setHasStartedGame: jest.fn(), setActiveCharacter: jest.fn(), setCharacters: jest.fn(), setMessages: jest.fn(),
    requirePlayerConfirmation: true,
    aiSettings: { ...defaultAISettings, imageGenerationEnabled: false },
    tts: { voiceEnabled, isTTSEnabled: voiceEnabled, generateVoiceForMessage: jest.fn().mockResolvedValue(undefined),
      addToQueue: jest.fn(), startInitialBuffering: jest.fn(), stopCurrentAudio: jest.fn(),
      waitForInitialBuffer: jest.fn().mockResolvedValue(undefined), cancelInitialBuffering: jest.fn(), playInitialNarration: jest.fn() },
  };
}
beforeEach(() => { localStorage.clear(); jest.clearAllMocks(); jest.mocked(fetchWithApiKeys).mockResolvedValue({ ok: true } as Response); });

it.each(['MAX_TOKENS', undefined])('keeps the gate closed for incomplete finishReason=%s', async finishReason => {
  const input = props();
  jest.mocked(parseSSEStream).mockImplementation(async (_response, callbacks) => {
    callbacks?.onText?.('Początek sceny.');
    if (finishReason) callbacks?.onMetadata?.({ type: 'metadata', finishReason });
    return 'Początek sceny.';
  });
  const { result, unmount } = renderHook(() => useGameStart(input));
  await act(async () => { void result.current.handleStartGame(); });
  expect(result.current.isReadyToEnter).toBe(false);
  expect(result.current.startProgress).toBeLessThan(100);
  expect(result.current.startError).not.toBeNull();
  expect(input.setHasStartedGame).not.toHaveBeenCalledWith(true);
  unmount();
});

it('waits for all opening audio, and starts playback only after the player confirms', async () => {
  const input = props(true);
  let resolveAudio!: () => void;
  jest.mocked(input.tts.waitForInitialBuffer!).mockReturnValue(new Promise(resolve => { resolveAudio = resolve; }));
  jest.mocked(parseSSEStream).mockImplementation(async (_response, callbacks) => {
    callbacks?.onText?.('Cała scena otwarcia.');
    callbacks?.onMetadata?.({ type: 'metadata', finishReason: 'STOP' });
    return 'Cała scena otwarcia.';
  });
  const { result, unmount } = renderHook(() => useGameStart(input));
  let pending!: Promise<void>;
  await act(async () => { pending = result.current.handleStartGame(); });
  expect(result.current.isReadyToEnter).toBe(false);
  expect(result.current.startProgress).toBeLessThan(100);
  expect(input.tts.playInitialNarration).not.toHaveBeenCalled();
  await act(async () => { resolveAudio(); });
  await waitFor(() => expect(result.current.isReadyToEnter).toBe(true));
  await act(async () => { window.dispatchEvent(new CustomEvent('zew:confirm-enter-game')); await pending; });
  expect(input.tts.playInitialNarration).toHaveBeenCalledTimes(1);
  expect(input.setHasStartedGame).toHaveBeenCalledWith(true);
  unmount();
});

it('keeps entry blocked when narrator preparation fails', async () => {
  const input = props(true);
  jest.mocked(input.tts.waitForInitialBuffer!).mockRejectedValue(new Error('OPENING_AUDIO_TIMEOUT'));
  jest.mocked(parseSSEStream).mockImplementation(async (_response, callbacks) => {
    callbacks?.onText?.('Cała scena otwarcia.'); callbacks?.onMetadata?.({ type: 'metadata', finishReason: 'STOP' });
    return 'Cała scena otwarcia.';
  });
  const { result, unmount } = renderHook(() => useGameStart(input));
  await act(async () => { await result.current.handleStartGame(); });
  expect(result.current.isReadyToEnter).toBe(false);
  expect(result.current.startError).not.toBeNull();
  expect(input.tts.playInitialNarration).not.toHaveBeenCalled();
  unmount();
});
