import { act, renderHook } from '@testing-library/react';
import { useChat } from './useChat';
import { defaultAISettings } from '@/lib/ai-settings/defaults';

jest.mock('@/lib/posthog', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/persistent-media-cache', () => ({ persistentMediaCache: { isAvailable: () => false } }));

it('hydrates the canonical location when its tag arrives after a partial opening chunk', () => {
  localStorage.clear();
  const { result } = renderHook(() => useChat({
    pdfMemory: {}, activeCharacter: null, characters: [], setCharacters: jest.fn(), setActiveCharacter: jest.fn(),
    voiceEnabled: false, isTTSEnabled: false, generateVoiceForMessage: jest.fn(), addToQueue: jest.fn(),
    aiSettings: { ...defaultAISettings, imageGenerationEnabled: false },
    adventureContext: { id: 'cien-nad-prabutami', title: 'Cień nad Prabutami', location: 'Warszawa - Elbląg - Prabuty' },
  }));
  const message = { id: 'gm-intro-chunked', role: 'assistant' as const, timestamp: new Date(), content: 'W gabinecie słychać maszyny.' };
  act(() => result.current.setMessages([message]));
  act(() => result.current.setMessages([{ ...message, content: message.content + ' [LOKACJA: Redakcja' }]));
  act(() => result.current.setMessages([{ ...message, content: message.content + " [LOKACJA: Redakcja 'Sygnałów Nieznanego' (RTV Warszawa) | Dym.]" }]));
  expect(result.current.currentLocation).toBe("Redakcja 'Sygnałów Nieznanego' (RTV Warszawa)");
});
