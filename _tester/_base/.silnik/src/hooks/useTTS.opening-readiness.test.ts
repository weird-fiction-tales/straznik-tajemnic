import { act, renderHook } from '@testing-library/react';
import { useTTS } from './useTTS';

jest.mock('@/lib/ai-settings', () => ({
  loadAISettings: () => ({ qualityPreset: 'high', voiceSettings: { voiceId: 'Algenib', volume: 75, speed: 1 } }),
  saveAISettings: jest.fn(),
}));
jest.mock('@/lib/api-keys-service', () => ({ getApiKeyHeaders: () => ({}), isPureTextMode: () => false }));
jest.mock('@/lib/persistent-media-cache', () => ({ persistentMediaCache: {
  isAvailable: () => false, generateTtsCacheKey: (text: string) => text,
} }));

const originalFetch = global.fetch;
const originalAudio = global.Audio;
let audios: HTMLAudioElement[];
const first = 'Deszcz stuka w parapet redakcji. ';
const opening = first + '\n\nHelena odkłada teczkę i czeka na pytania.';

beforeEach(() => {
  jest.useFakeTimers();
  audios = [];
  global.Audio = jest.fn((src?: string) => {
    const audio = document.createElement('audio');
    if (src) audio.src = src;
    audio.load = jest.fn();
    audio.pause = jest.fn();
    audio.play = jest.fn().mockResolvedValue(undefined);
    audios.push(audio);
    return audio;
  }) as unknown as typeof Audio;
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200,
    json: async () => ({ success: true, audioUrl: 'data:audio/wav;base64,UklGRg==' }),
  });
});
afterEach(() => { global.fetch = originalFetch; global.Audio = originalAudio; jest.useRealTimers(); });

it('requires the final segment to be generated and playable, without autoplay before confirmation', async () => {
  const { result, unmount } = renderHook(() => useTTS('pl'));
  await act(async () => { result.current.startInitialBuffering(); result.current.addToQueue(first, 'intro'); });
  expect(audios).toHaveLength(1);
  await act(async () => { audios[0].dispatchEvent(new Event('canplaythrough')); });
  expect(result.current.isInitialBuffering).toBe(true);
  let ready = false;
  let pending!: Promise<void>;
  await act(async () => {
    result.current.addToQueue(opening, 'intro', true);
    pending = result.current.waitForInitialBuffer(60000).then(() => { ready = true; });
  });
  expect(audios).toHaveLength(2);
  expect(ready).toBe(false);
  await act(async () => { audios[1].dispatchEvent(new Event('canplaythrough')); await pending; });
  expect(ready).toBe(true);
  expect(result.current.isInitialBuffering).toBe(false);
  expect(audios.every(audio => jest.mocked(audio.play).mock.calls.length === 0)).toBe(true);
  unmount();
});

it('rejects a preparation timeout rather than reporting a successful empty buffer', async () => {
  const { result, unmount } = renderHook(() => useTTS('pl'));
  act(() => result.current.startInitialBuffering());
  const failed = expect(result.current.waitForInitialBuffer(20000)).rejects.toThrow('OPENING_AUDIO_TIMEOUT');
  await act(async () => { await jest.advanceTimersByTimeAsync(20000); });
  await failed;
  unmount();
});

it('rejects failed audio instead of counting a skipped segment as buffered', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429,
    headers: new Headers({ 'Retry-After': '60' }), json: async () => ({ retryable: false }),
  });
  const { result, unmount } = renderHook(() => useTTS('en'));
  act(() => result.current.startInitialBuffering());
  const failed = expect(result.current.waitForInitialBuffer()).rejects.toThrow('OPENING_AUDIO_UNAVAILABLE');
  await act(async () => { result.current.addToQueue(opening, 'failed', true); });
  await failed;
  expect(audios).toHaveLength(0);
  unmount();
});

it('settles a cancelled wait and permits a clean retry', async () => {
  const { result, unmount } = renderHook(() => useTTS('pl'));
  act(() => result.current.startInitialBuffering());
  const cancelled = expect(result.current.waitForInitialBuffer()).rejects.toThrow('OPENING_AUDIO_CANCELLED');
  act(() => result.current.cancelInitialBuffering?.());
  await cancelled;
  await act(async () => { result.current.startInitialBuffering(); result.current.addToQueue(first, 'retry', true); });
  let pending!: Promise<void>;
  act(() => { pending = result.current.waitForInitialBuffer(); });
  await act(async () => { audios[0].dispatchEvent(new Event('canplaythrough')); await pending; });
  expect(result.current.isInitialBuffering).toBe(false);
  unmount();
});


it('isolates a cancelled in-flight decode from an immediate retry', async () => {
  const { result, unmount } = renderHook(() => useTTS('pl'));
  await act(async () => { result.current.startInitialBuffering(); result.current.addToQueue(first, 'old-intro', true); });
  expect(audios).toHaveLength(1);
  const cancelled = expect(result.current.waitForInitialBuffer()).rejects.toThrow('OPENING_AUDIO_CANCELLED');
  await act(async () => {
    result.current.cancelInitialBuffering?.();
    result.current.stopCurrentAudio();
    result.current.startInitialBuffering();
    result.current.addToQueue(first, 'new-intro', true);
  });
  await cancelled;
  expect(audios).toHaveLength(2);
  expect(audios[0].getAttribute('src')).toBe('');
  let pending!: Promise<void>;
  act(() => { pending = result.current.waitForInitialBuffer(); });
  await act(async () => { audios[1].dispatchEvent(new Event('canplaythrough')); await pending; });
  expect(result.current.isInitialBuffering).toBe(false);
  expect(global.fetch).toHaveBeenCalledTimes(2);
  unmount();
});
