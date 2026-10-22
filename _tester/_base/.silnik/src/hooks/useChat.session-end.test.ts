import { renderHook, act } from '@testing-library/react';
import { TextEncoder, TextDecoder } from 'util';
import type { Character } from '@/lib/types';
import { storeCampaignMemoryScope } from '@/core/memory/campaign-scope';
import { useChat } from './useChat';

if (typeof global.TextEncoder === 'undefined') {
  Object.defineProperty(global, 'TextEncoder', { value: TextEncoder });
}
if (typeof global.TextDecoder === 'undefined') {
  Object.defineProperty(global, 'TextDecoder', { value: TextDecoder });
}

// Mock dependencies
jest.mock('@/lib/ai-settings', () => ({
  loadAISettings: jest.fn(() => ({})),
  getGameMasterPrompt: jest.fn(() => ''),
}));

jest.mock('@/lib/telemetry', () => ({
  logApiEvent: jest.fn().mockResolvedValue(undefined),
  trackEvent: jest.fn(),
}));

jest.mock('@/lib/api-keys-service', () => ({
  fetchWithApiKeys: (url: string, init?: RequestInit) => global.fetch(url, init),
  hasRequiredKeys: jest.fn(() => true),
  isPureTextMode: jest.fn(() => false),
  getApiKeyHeaders: jest.fn(() => ({})),
}));

jest.mock('@/lib/time-manager', () => ({
  timeManager: {
    getTime: jest.fn(() => ({ year: 1920, month: 9, day: 1, hour: 20, minute: 0 })),
    getSnapshot: jest.fn(() => ({
      time: { year: 1920, month: 9, day: 1, hour: 20, minute: 0 },
      weather: '',
      deadline: null,
      deadlineTotalHours: 0,
    })),
  },
}));

describe('useChat - sessionEndStatus (LOG-01)', () => {
  const defaultOptions = {
    pdfMemory: { rulesUrl: undefined, moduleUrl: undefined },
    activeCharacter: { id: 'char-1', name: 'Edward Carnby', skills: {} } as Character,
    characters: [],
    setCharacters: jest.fn(),
    setActiveCharacter: jest.fn(),
    voiceEnabled: false,
    isTTSEnabled: false,
    generateVoiceForMessage: jest.fn().mockResolvedValue(undefined),
    addToQueue: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
  });

  it('inicjalizuje stan w trybie idle', () => {
    const { result } = renderHook(() => useChat(defaultOptions));
    expect(result.current.sessionEndStatus).toBe('idle');
    expect(result.current.isSessionEnded).toBe(false);
  });

  function createMockStreamResponse(content: string) {
    const encoder = new TextEncoder();
    let done = false;
    return {
      ok: true,
      body: {
        getReader: () => ({
          read: () => {
            if (done) return Promise.resolve({ done: true, value: undefined });
            done = true;
            return Promise.resolve({
              done: false,
              value: encoder.encode(`data: {"type":"text","content":${JSON.stringify(content)}}\n\n`),
            });
          },
          releaseLock: () => {},
        }),
      },
    } as unknown as Response;
  }

  it('przechodzi do stanu awaiting_player_closure po wysłaniu sygnału [KONIEC_SESJI]', async () => {
    global.fetch = jest.fn().mockResolvedValue(createMockStreamResponse('Zamykasz historię...'));

    const { result } = renderHook(() => useChat(defaultOptions));

    await act(async () => {
      await result.current.handleSendMessage('[KONIEC_SESJI]');
    });

    expect(result.current.sessionEndStatus).toBe('awaiting_player_closure');
    expect(result.current.isSessionEnded).toBe(false);
  });

  it('resetuje stan do idle po wyczyszczeniu wiadomości', () => {
    const { result } = renderHook(() => useChat(defaultOptions));

    act(() => {
      result.current.setMessages([]);
    });

    expect(result.current.sessionEndStatus).toBe('idle');
    expect(result.current.isSessionEnded).toBe(false);
    expect(result.current.sessionSaveStatus).toBe('idle');
  });

  it('inicjalizuje sessionSaveStatus w trybie idle', () => {
    const { result } = renderHook(() => useChat(defaultOptions));
    expect(result.current.sessionSaveStatus).toBe('idle');
  });

  it('odbiera [KONIEC_SESJI:POTWIERDZENIE], wywołuje autozapis do /api/game-save i ustawia status saved', async () => {
    const mockSaveResult = {
      success: true,
      saveId: 'save_session_end_1',
      saveName: 'Koniec sesji - Edward Carnby - 1920-10-01 20:00',
      size: 2048,
      formattedSize: '2 KB',
      messageCount: 2,
      imageCount: 0,
    };

    global.fetch = jest.fn((url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/api/chat')) {
        return Promise.resolve(createMockStreamResponse('Mrok ogarnia Arkham... [KONIEC_SESJI:POTWIERDZENIE]'));
      }

      if (urlStr.includes('/api/game-save')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSaveResult),
        } as unknown as Response);
      }

      return Promise.reject(new Error(`Unhandled URL: ${urlStr}`));
    });

    const { result } = renderHook(() => useChat(defaultOptions));

    await act(async () => {
      await result.current.handleSendMessage('Tak, kończymy sesję.');
    });

    expect(result.current.sessionEndStatus).toBe('ended');
    expect(result.current.isSessionEnded).toBe(true);
    expect(result.current.sessionSaveStatus).toBe('saved');

    // Weryfikacja zapytania do /api/game-save
    const gameSaveCalls = (global.fetch as jest.Mock).mock.calls.filter(
      (c) => typeof c[0] === 'string' && c[0].includes('/api/game-save')
    );
    expect(gameSaveCalls.length).toBeGreaterThanOrEqual(1);

    const saveBody = JSON.parse(gameSaveCalls[0][1].body);
    expect(saveBody.name).toBe('Koniec sesji - Edward Carnby - 1920-10-01 20:00');
    expect(saveBody.activeCharacterId).toBe('char-1');
  });

  it('w razie błędu sieci przy autozapisie przechodzi do error i retrySessionSave pozwala ponowić', async () => {
    let failGameSave = true;

    global.fetch = jest.fn((url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/api/chat')) {
        return Promise.resolve(createMockStreamResponse('Koniec... [KONIEC_SESJI:POTWIERDZENIE]'));
      }

      if (urlStr.includes('/api/game-save')) {
        if (failGameSave) {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ error: 'Błąd zapisu na dysku' }),
          } as unknown as Response);
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              saveId: 'save_retry_1',
              saveName: 'Koniec sesji - Edward Carnby - 1920-10-01 20:00',
              size: 2048,
              formattedSize: '2 KB',
              messageCount: 2,
              imageCount: 0,
            }),
        } as unknown as Response);
      }

      return Promise.reject(new Error(`Unhandled URL: ${urlStr}`));
    });

    const { result } = renderHook(() => useChat(defaultOptions));

    await act(async () => {
      await result.current.handleSendMessage('Koniec.');
    });

    expect(result.current.sessionEndStatus).toBe('ended');
    expect(result.current.isSessionEnded).toBe(true);
    expect(result.current.sessionSaveStatus).toBe('error');

    // Ponowienie próby
    failGameSave = false;
    await act(async () => {
      await result.current.retrySessionSave();
    });

    expect(result.current.sessionSaveStatus).toBe('saved');
  });

  it('zapisuje domkniętą scenę i trwałą granicę sesji przed autozapisem', async () => {
    storeCampaignMemoryScope({ schemaVersion: 1, campaignDefinitionId: 'scenario:archive', playthroughId: 'run-chapters', adventureId: 'archive', kind: 'scenario' });
    const anna = { ...defaultOptions.activeCharacter, journal: [], sceneCards: [] };
    const outsider = { ...anna, id: 'outsider', name: 'Jan' };
    const setCharacters = jest.fn();
    global.fetch = jest.fn((url: string | URL | Request) => {
      const path = String(url);
      if (path.includes('/api/chat')) return Promise.resolve(createMockStreamResponse('Stanisław twierdził, że list wysłano z doków. [ZMIANA_SCENY: Doki] [KONIEC_SESJI:POTWIERDZENIE]'));
      if (path.includes('/api/summarize-scene')) return Promise.resolve({ ok: true, json: async () => ({ success: true, summaries: { pl: 'Stanisław twierdził, że list wysłano z doków.', en: 'Stanisław claimed the letter came from the docks.' } }) } as Response);
      if (path.includes('/api/game-save')) return Promise.resolve({ ok: true, json: async () => ({ success: true, saveId: 'chapter-save' }) } as Response);
      return Promise.reject(new Error(`Unhandled URL: ${path}`));
    });
    const { result } = renderHook(() => useChat({ ...defaultOptions, activeCharacter: anna, characters: [anna, outsider], setCharacters, adventureContext: { title: 'Archiwum', location: 'Archiwum' } }));
    await act(async () => { await result.current.handleSendMessage('Kończymy rozmowę.'); });
    const call = (global.fetch as jest.Mock).mock.calls.find((entry) => String(entry[0]).includes('/api/game-save'));
    const saved = JSON.parse(call[1].body);
    expect(saved.characters[0].chronicleSession).toMatchObject({ sessionNumber: 1, playthroughId: 'run-chapters', closedByMessageId: expect.any(String) });
    expect(saved.characters[0].sceneCards[0]).toMatchObject({ chronicleChapter: { adventureTitle: 'Archiwum', sessionNumber: 1 }, chronicleSummaryByLocale: { pl: 'Stanisław twierdził, że list wysłano z doków.' } });
    expect(saved.characters[0].activeScene).toBeUndefined();
    expect(saved.characters[0].sceneCards).toHaveLength(1);
    expect(saved.characters[1]).toMatchObject(outsider);
    expect(setCharacters.mock.calls.at(-1)[0][1]).toBe(outsider);
    expect(setCharacters).toHaveBeenCalled();
  });

  it('blokuje współbieżne ponawianie zapisu (mutex / lock zapobiega duplikatom)', async () => {
    let resolveSave: (val: unknown) => void = () => {};
    let saveCallCount = 0;

    global.fetch = jest.fn((url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/api/chat')) {
        return Promise.resolve(createMockStreamResponse('Koniec... [KONIEC_SESJI:POTWIERDZENIE]'));
      }

      if (urlStr.includes('/api/game-save')) {
        saveCallCount++;
        return new Promise((resolve) => {
          resolveSave = () =>
            resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  success: true,
                  saveId: 'save_lock_1',
                  saveName: 'Koniec sesji - Edward Carnby - 1920-10-01 20:00',
                  size: 1024,
                  formattedSize: '1 KB',
                  messageCount: 2,
                  imageCount: 0,
                }),
            } as unknown as Response);
        });
      }

      return Promise.reject(new Error(`Unhandled URL: ${urlStr}`));
    });

    const { result } = renderHook(() => useChat(defaultOptions));

    // Uruchomienie pierwszego zapisu
    let firstPromise: Promise<void> | undefined;
    act(() => {
      firstPromise = result.current.retrySessionSave();
    });

    // W trakcie trwania zapisu sessionSaveStatus to saving
    expect(result.current.sessionSaveStatus).toBe('saving');

    // Równoległe wywołanie retrySessionSave w trakcie trwania pierwszego zapisu
    await act(async () => {
      await result.current.retrySessionSave();
    });

    // Mutex zablokował drugie wywołanie /api/game-save
    expect(saveCallCount).toBe(1);

    // Dokończenie pierwszego zapisu
    await act(async () => {
      resolveSave(null);
      await firstPromise;
    });

    expect(result.current.sessionSaveStatus).toBe('saved');
    expect(saveCallCount).toBe(1);
  });

  it('resetSessionEndState odblokowuje czat i przywraca stany idle (Issue #643)', async () => {
    global.fetch = jest.fn((url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/api/chat')) {
        return Promise.resolve(
          createMockStreamResponse('Koniec przygody. [KONIEC_SESJI:POTWIERDZENIE]')
        );
      }
      if (urlStr.includes('/api/game-save')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              saveId: 's1',
              saveName: 'Koniec sesji',
              size: 1024,
              formattedSize: '1 KB',
              messageCount: 1,
              imageCount: 0,
            }),
        } as unknown as Response);
      }
      return Promise.reject(new Error(`Unhandled URL: ${urlStr}`));
    });

    const { result } = renderHook(() => useChat(defaultOptions));

    await act(async () => {
      await result.current.handleSendMessage('Kończymy.');
    });

    expect(result.current.sessionEndStatus).toBe('ended');
    expect(result.current.isSessionEnded).toBe(true);
    expect(result.current.sessionSaveStatus).toBe('saved');

    act(() => {
      result.current.resetSessionEndState();
    });

    expect(result.current.sessionEndStatus).toBe('idle');
    expect(result.current.isSessionEnded).toBe(false);
    expect(result.current.sessionSaveStatus).toBe('idle');

    // Gracz kontynuuje grę - wysyła nową turę
    let lastSentBody: Record<string, unknown> | null = null;
    (global.fetch as jest.Mock).mockImplementation((url: string | URL | Request, init?: RequestInit) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/api/chat')) {
        if (init?.body) {
          lastSentBody = JSON.parse(init.body as string);
        }
        return Promise.resolve(
          createMockStreamResponse('Rozglądasz się po mrocznym korytarzu...')
        );
      }
      return Promise.reject(new Error(`Unhandled URL: ${urlStr}`));
    });

    await act(async () => {
      await result.current.handleSendMessage('Idziemy dalej badać piwnicę.');
    });

    expect(lastSentBody).not.toBeNull();
    expect((lastSentBody as unknown as { message: string }).message).toBe('Idziemy dalej badać piwnicę.');
    expect((lastSentBody as unknown as { message: string }).message).not.toContain('[KONIEC_SESJI:FINAL]');
    expect(result.current.sessionEndStatus).toBe('idle');
    expect(result.current.isSessionEnded).toBe(false);
  });
});

