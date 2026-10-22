import { act, renderHook, cleanup } from '@testing-library/react';
import { useChat } from './useChat';
import { fetchWithApiKeys, hasRequiredKeys } from '@/lib/api-keys-service';
import { parseSSEStream } from '@/lib/sse-parser';
import { defaultAISettings } from '@/lib/ai-settings/defaults';
let mockConfigured = true;
let mockRules = true;
jest.mock('@/lib/local-playtest-transport', () => ({ hasLocalPlaytestTransport: () => mockConfigured, hasLocalPlaytestRules: () => mockConfigured && mockRules, checkLocalPlaytestTransport: async () => ({serverConfigured:mockConfigured,serverHasBaseRules:mockRules,loading:false}) }));
jest.mock('@/lib/api-keys-service', () => ({ fetchWithApiKeys: jest.fn(), hasRequiredKeys: jest.fn(() => false) }));
jest.mock('@/lib/sse-parser', () => ({ parseSSEStream: jest.fn(), createSseParseErrorHandler: jest.fn(() => jest.fn()) }));
jest.mock('@/lib/posthog', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/persistent-media-cache', () => ({ persistentMediaCache: { isAvailable: () => false } }));
const options: Parameters<typeof useChat>[0] = {
  pdfMemory: {}, activeCharacter: null, characters: [], setCharacters: jest.fn(), setActiveCharacter: jest.fn(),
  voiceEnabled: false, isTTSEnabled: false, generateVoiceForMessage: jest.fn(), addToQueue: jest.fn(),
  aiSettings: { ...defaultAISettings, imageGenerationEnabled: false },
};
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear(); mockConfigured = true; mockRules = true;
  // Exercise the production guard rather than its pre-existing test-only rules shortcut.
  jest.replaceProperty(process, 'env', { ...process.env, NODE_ENV: 'production' });
  jest.mocked(fetchWithApiKeys).mockResolvedValue({ ok: true } as Response);
  jest.mocked(parseSSEStream).mockImplementation(async (_response, callbacks) => {
    callbacks?.onText?.('Narration'); return 'Narration';
  });
});
afterEach(() => { cleanup(); jest.restoreAllMocks(); localStorage.clear(); });
it('allows a real message through the separate server transport with confirmed server rules and no client key', async () => {
  const { result } = renderHook(() => useChat(options));
  await act(async () => { await result.current.handleSendMessage('Rozglądam się.'); });
  expect(fetchWithApiKeys).toHaveBeenCalledWith('/api/chat', expect.any(Object));
  expect(result.current.messages.some(message => message.content === 'Narration')).toBe(true);
  expect(hasRequiredKeys()).toBe(false);
  expect(localStorage.getItem('zew-app-api-keys')).toBeNull();
  expect(localStorage.getItem('rules_onboarding_completed')).toBeNull();
  expect(localStorage.getItem('coc7_rulebook_profile')).toBeNull();
});
it.each(['transport', 'rules'])('keeps the production runtime block without verified %s', async missing => {
  if (missing === 'transport') mockConfigured = false;
  else mockRules = false;
  const { result } = renderHook(() => useChat(options));
  await act(async () => { await result.current.handleSendMessage('Rozglądam się.'); });
  expect(fetchWithApiKeys).not.toHaveBeenCalled();
  expect(parseSSEStream).not.toHaveBeenCalled();
});
