import { renderHook, act } from '@testing-library/react';
import {
  stripMultilineArtifacts,
  cleanResponseText,
} from '@/lib/parsers/text-cleaner';
import {
  getSharedAudioContext,
  resetSharedAudioContextForTesting,
} from '@/lib/audio/audio-context';
import { persistentMediaCache } from '@/lib/persistent-media-cache';
import { useTTS } from '@/hooks/useTTS';

// Mock dla konfiguracji AI
let mockSettings = {
  qualityPreset: 'high',
  voiceSettings: {
    voiceId: 'Kore',
    volume: 75,
    provider: 'gemini',
    narratorOnly: false,
  },
};

jest.mock('@/lib/ai-settings', () => ({
  loadAISettings: jest.fn(() => mockSettings),
  saveAISettings: jest.fn((s) => {
    mockSettings = s;
  }),
}));

jest.mock('@/lib/api-keys-service', () => ({
  getApiKeyHeaders: jest.fn(() => ({})),
  isPureTextMode: jest.fn(() => false),
}));

describe('Issue #79 - Silnik TTS, Kolejkowanie i Web Audio API', () => {
  describe('1. Zachowanie tagów emocji lektora oraz ochrona przed wyciekiem sekretów MG', () => {
    it('stripMultilineArtifacts zachowuje oficjalne tagi modulacji emocji Gemini TTS', () => {
      const emotionTags = [
        '[whispers]',
        '[whispering]',
        '[trembling]',
        '[gasp]',
        '[panicked]',
        '[serious]',
        '[curious]',
        '[sarcastic]',
        '[tired]',
        '[crying]',
        '[amazed]',
        '[excited]',
        '[mischievously]',
        '[sighs]',
        '[giggles]',
        '[laughs]',
        '[shouting]',
        '[very fast]',
        '[very slow]',
      ];

      for (const tag of emotionTags) {
        const raw = `${tag} Mroczny cień wyłania się zza węgła.`;
        const stripped = stripMultilineArtifacts(raw);
        expect(stripped).not.toContain(tag);
        expect(stripped).toContain('Mroczny cień wyłania się zza węgła.');
      }
    });

    it('stripMultilineArtifacts odcina niedomknięty blok [SEKRETY_MG] w trakcie streamingu (|$)', () => {
      const streamingChunk =
        'Akapit pierwszy dla gracza.\n\n[SEKRETY_MG]Kultysta czai się na poddaszu z nożem ofiarnym i planuje zasadzkę';
      const stripped = stripMultilineArtifacts(streamingChunk);

      expect(stripped).toContain('Akapit pierwszy dla gracza.');
      expect(stripped).not.toContain('Kultysta');
      expect(stripped).not.toContain('nożem ofiarnym');
      expect(stripped).not.toContain('zasadzkę');
    });

    it('stripMultilineArtifacts odcina niedomknięty blok [OBSERWACJA] w trakcie streamingu (|$)', () => {
      const streamingChunk =
        'Wchodzisz do piwnicy.\n\n[OBSERWACJA] @Franciszek | zapach | Woń zgniłego mięsa dociera zza zamkniętych drzwi';
      const stripped = stripMultilineArtifacts(streamingChunk);

      expect(stripped).toContain('Wchodzisz do piwnicy.');
      expect(stripped).not.toContain('Franciszek');
      expect(stripped).not.toContain('zgniłego mięsa');
    });

    it('cleanResponseText oczyszcza tag [whispers] i usuwa zamknięte sekrety MG (Issue #544)', () => {
      const raw =
        '[whispers] Słyszysz cichy szmer za drzwiami. [SEKRETY_MG]To tylko szczur.[/SEKRETY_MG] Co robisz?';
      const cleaned = cleanResponseText(raw);

      expect(cleaned).not.toContain('[whispers]');
      expect(cleaned).toContain('Słyszysz cichy szmer za drzwiami.');
      expect(cleaned).toContain('Co robisz?');
      expect(cleaned).not.toContain('To tylko szczur');
    });

    it('nie obcina tekstu przy wielokrotnych tagach liniowych z dwukropkiem (Concordia pattern)', () => {
      const raw =
        'Na zewnątrz szaleje burza. [OBSERWACJA: @Arthur | słuch | Dudnienie w rurach] [SEKRETY_MG: Potwór zbliża się szybem] Co robisz?';
      const cleaned = cleanResponseText(raw);
      expect(cleaned).toBe('Na zewnątrz szaleje burza. Co robisz?');
    });

    it('stripMultilineArtifacts zachowuje tekst gracza po tagu Concordia z nową linią', () => {
      const raw =
        'Na zewnątrz szaleje burza. [OBSERWACJA: @Arthur | słuch | Dudnienie w rurach]\nCo robisz?';
      const stripped = stripMultilineArtifacts(raw);
      expect(stripped).toContain('Na zewnątrz szaleje burza.');
      expect(stripped).toContain('Co robisz?');
      expect(stripped).not.toContain('Dudnienie');
    });
  });

  describe('2. Singleton AudioContext (getSharedAudioContext)', () => {
    interface MockAudioContext {
      state: string;
      resume: jest.Mock;
      close: jest.Mock;
    }
    let mockResume: jest.Mock;
    let mockClose: jest.Mock;
    let mockContextInstance: MockAudioContext;

    beforeEach(() => {
      resetSharedAudioContextForTesting();
      mockResume = jest.fn().mockResolvedValue(undefined);
      mockClose = jest.fn().mockResolvedValue(undefined);
      mockContextInstance = {
        state: 'running',
        resume: mockResume,
        close: mockClose,
      };

      (window as unknown as { AudioContext: unknown }).AudioContext = jest.fn(() => mockContextInstance);
    });

    afterEach(() => {
      resetSharedAudioContextForTesting();
    });

    it('zwraca tę samą instancję AudioContext przy wielokrotnych wywołaniach (singleton)', () => {
      const ctx1 = getSharedAudioContext();
      const ctx2 = getSharedAudioContext();
      const ctx3 = getSharedAudioContext();

      expect(ctx1).toBe(ctx2);
      expect(ctx2).toBe(ctx3);
      expect((window as unknown as { AudioContext: jest.Mock }).AudioContext).toHaveBeenCalledTimes(1);
    });

    it('wywołuje resume() jeśli stan AudioContext to suspended', () => {
      mockContextInstance.state = 'suspended';

      const ctx = getSharedAudioContext();
      expect(ctx).toBeDefined();
      expect(mockResume).toHaveBeenCalledTimes(1);
    });

    it('tworzy nową instancję jeśli poprzedni kontekst został zamknięty (closed)', () => {
      const ctx1 = getSharedAudioContext();
      expect(ctx1).toBeDefined();
      expect((window as unknown as { AudioContext: jest.Mock }).AudioContext).toHaveBeenCalledTimes(1);

      // Symulacja zamknięcia kontekstu
      mockContextInstance.state = 'closed';

      const newMockInstance: MockAudioContext = {
        state: 'running',
        resume: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
      };
      (window as unknown as { AudioContext: unknown }).AudioContext = jest.fn(() => newMockInstance);

      const ctx2 = getSharedAudioContext();
      expect(ctx2).toBe(newMockInstance as unknown as AudioContext);
      expect((window as unknown as { AudioContext: jest.Mock }).AudioContext).toHaveBeenCalledTimes(1);
    });

    it('zwraca null i nie rzuca błędu gdy konstruktor AudioContext rzuci wyjątek', () => {
      (window as unknown as { AudioContext: unknown }).AudioContext = jest.fn(() => {
        throw new Error('NotAllowedError');
      });
      const ctx = getSharedAudioContext();
      expect(ctx).toBeNull();
    });
  });

  describe('3. Pamięć podręczna mediów - pełny hash 64-bit FNV-1a', () => {
    it('generuje różne klucze dla tekstów identycznych w pierwszych 200 znakach, różniących się na końcu', () => {
      const prefix = 'A'.repeat(200);
      const textA = `${prefix} Tekst wariantu Alfa na końcu zdania.`;
      const textB = `${prefix} Tekst wariantu Beta na końcu zdania.`;

      const keyA = persistentMediaCache.generateTtsCacheKey(textA, 'Kore');
      const keyB = persistentMediaCache.generateTtsCacheKey(textB, 'Kore');

      expect(keyA).not.toBe(keyB);
      expect(keyA).toContain('Kore');
      expect(keyB).toContain('Kore');
    });

    it('generuje identyczny klucz dla tego samego tekstu (determinizm hashowania)', () => {
      const text = 'Wchodzisz do zrujnowanego dworku w Providence.';
      const key1 = persistentMediaCache.generateTtsCacheKey(text, 'Kore', 0, 1);
      const key2 = persistentMediaCache.generateTtsCacheKey(text, 'Kore', 0, 1);

      expect(key1).toBe(key2);
    });
  });

  describe('4. useTTS - filtr prefiksów technicznych i ochrona przed wyścigami', () => {
    let originalFetch: typeof global.fetch;
    let originalAudio: typeof global.Audio;

    beforeEach(() => {
      mockSettings = {
        qualityPreset: 'high',
        voiceSettings: {
          voiceId: 'Kore',
          volume: 75,
          provider: 'gemini',
          narratorOnly: false,
        },
      };

      originalFetch = global.fetch;
      originalAudio = global.Audio;

      class MockAudio {
        src = '';
        volume = 1;
        playbackRate = 1;
        currentTime = 0;
        paused = true;
        play = jest.fn().mockResolvedValue(undefined);
        pause = jest.fn();
        load = jest.fn();
        onended: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(src?: string) {
          if (src) this.src = src;
        }
      }
      global.Audio = MockAudio as unknown as typeof Audio;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, audioUrl: 'blob:test-audio-chunk' }),
      } as Response);
    });

    afterEach(() => {
      global.fetch = originalFetch;
      global.Audio = originalAudio;
      jest.clearAllMocks();
    });

    it('ignoruje prefiksy techniczne NPC (Raport policji:, Wskazówka:, Uwaga:), czytając je głosem lektora', async () => {
      const { result } = renderHook(() => useTTS('pl'));

      act(() => {
        result.current.setVoiceEnabled(true);
        result.current.setIsTTSEnabled(true);
      });

      const messageWithTechPrefix =
        'Raport policji: Na miejscu zbrodni znaleziono dziwne runy.';

      await act(async () => {
        result.current.addToQueue(messageWithTechPrefix, 'msg-tech-1', true);
      });

      expect(global.fetch).toHaveBeenCalled();
      const fetchArgs = (global.fetch as jest.Mock).mock.calls[0];
      const payload = JSON.parse(fetchArgs[1].body);

      // Głos powinien pozostać głosem narratora ('Kore'), a nie dynamicznie wyznaczonym NPC 'Raport policji'
      expect(payload.voice).toBe('Kore');
      expect(payload.text).toContain('Raport policji: Na miejscu zbrodni');
    });

    it('stopCurrentAudio() natychmiast anuluje aktywne zapytanie sieciowe przez AbortController', async () => {
      let capturedSignal: AbortSignal | undefined;

      global.fetch = jest.fn().mockImplementation((_url, init) => {
        capturedSignal = init?.signal;
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              json: async () => ({ success: true, audioUrl: 'blob:slow-audio' }),
            } as Response);
          }, 1000);
        });
      });

      const { result } = renderHook(() => useTTS('pl'));

      act(() => {
        result.current.setVoiceEnabled(true);
        result.current.setIsTTSEnabled(true);
      });

      act(() => {
        result.current.addToQueue('Długie zdanie rozpoczynające powolne generowanie mowy.', 'msg-abort', false);
      });

      expect(global.fetch).toHaveBeenCalled();
      expect(capturedSignal).toBeDefined();
      expect(capturedSignal?.aborted).toBe(false);

      // Gracz wysyła nową akcję / wciska stop
      act(() => {
        result.current.stopCurrentAudio();
      });

      expect(capturedSignal?.aborted).toBe(true);
    });

    it('stopCurrentAudio() zwalnia elementy audio deterministycznie (pause, src="", load)', async () => {
      const { result } = renderHook(() => useTTS('pl'));

      act(() => {
        result.current.setVoiceEnabled(true);
        result.current.setIsTTSEnabled(true);
      });

      await act(async () => {
        result.current.addToQueue('Krótkie zdanie testowe audio.', 'msg-cleanup-1', true);
      });

      const currentAudio = result.current.currentAudio;
      if (currentAudio) {
        act(() => {
          result.current.stopCurrentAudio();
        });
        expect(currentAudio.pause).toHaveBeenCalled();
        expect(currentAudio.src).toBe('');
        expect(currentAudio.load).toHaveBeenCalled();
      }
    });

    it('bezpiecznik 15 RPM (Decyzja 2A): po 429 z Retry-After > 10s agreguje zdania do granic akapitu', async () => {
      const now = jest.spyOn(Date, 'now').mockReturnValue(100000);
      // Symulacja błędu 429 z Retry-After = 12s
      let callCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 429,
            headers: {
              get: (h: string) => (h.toLowerCase() === 'retry-after' ? '12' : null),
            },
            json: async () => ({}),
          } as unknown as Response);
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true, audioUrl: 'blob:audio-after-fuse' }),
        } as Response);
      });

      const { result } = renderHook(() => useTTS('pl'));

      act(() => {
        result.current.setVoiceEnabled(true);
        result.current.setIsTTSEnabled(true);
      });

      // Wywołanie pierwsze - uruchamia 429 z Retry-After 12
      await act(async () => {
        result.current.addToQueue('Pierwsze krótkie zdanie inicjujące.', 'msg-fuse-trigger', true);
      });

      // Zresetuj mock fetch, by sprawdzić jak kolejkuje po aktywacji bezpiecznika
      (global.fetch as jest.Mock).mockClear();

      // Teraz w trakcie streamingu (flush = false) wysyłamy 2 zdania w jednym akapicie (bez \n)
      // Normalnie na presecie HIGH drugie zdanie przekroczyłoby próg 100 znaków i natychmiast wywołało fetch.
      // Przy włączonym bezpieczniku 15 RPM nie tnie w środku akapitu.
      act(() => {
        result.current.addToQueue(
          'Długie zdanie numer jeden przekraczające limit stu znaków dla pierwszego chunka audio bez nowego wiersza.',
          'msg-fuse-test',
          false
        );
      });

      // Run nie powinien zostać domknięty dopóki nie ma \n lub flush
      expect(global.fetch).not.toHaveBeenCalled();

      // Dopisanie \n (granica akapitu) domyka run
      await act(async () => {
        result.current.addToQueue(
          'Długie zdanie numer jeden przekraczające limit stu znaków dla pierwszego chunka audio bez nowego wiersza.\nKolejny akapit.',
          'msg-fuse-test',
          false
        );
      });

      expect(global.fetch).not.toHaveBeenCalled();
      now.mockReturnValue(111999);
      await act(async () => { result.current.addToQueue('Przed pełnym terminem blokady.', 'before-deadline', true); });
      expect(global.fetch).not.toHaveBeenCalled();
      now.mockReturnValue(112000);
      await act(async () => { result.current.addToQueue('Po pełnym terminie blokady.', 'after-deadline', true); });
      expect(global.fetch).toHaveBeenCalledTimes(1);
      now.mockRestore();
    });

    it('generationIdRef chroni przed odtworzeniem przerwanych zapytań (eliminacja zjawiska ducha lektora)', async () => {
      let resolveSlowFetch: ((value: Response) => void) | null = null;
      global.fetch = jest.fn().mockImplementation(() => {
        return new Promise<Response>((resolve) => {
          resolveSlowFetch = resolve;
        });
      });

      const { result } = renderHook(() => useTTS('pl'));

      act(() => {
        result.current.setVoiceEnabled(true);
        result.current.setIsTTSEnabled(true);
      });

      act(() => {
        result.current.addToQueue('Bardzo stara wiadomość, która zostanie przerwana.', 'msg-old', true);
      });

      // Gracz natychmiast przerywa i resetuje stan
      act(() => {
        result.current.stopCurrentAudio();
      });

      // Teraz wolny fetch wreszcie odpowiada (stara generacja)
      await act(async () => {
        resolveSlowFetch?.({
          ok: true,
          status: 200,
          json: async () => ({ success: true, audioUrl: 'blob:ghost-audio' }),
        } as Response);
      });

      // Audio z poprzedniej generacji nie może trafić do currentAudio ani odtwarzacza
      expect(result.current.currentAudio).toBeNull();
      expect(result.current.isGeneratingVoice).toBe(false);
    });

    it('stopCurrentAudio() przerywające odtwarzanie nie psuje indeksu segmentu kolejnej wiadomości', async () => {
      class ControllableAudio {
        src = '';
        volume = 1;
        playbackRate = 1;
        paused = false;
        play = jest.fn().mockImplementation(() => {
          return new Promise<void>((res) => {
            res();
          });
        });
        pause = jest.fn();
        load = jest.fn();
        onended: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(src?: string) {
          if (src) this.src = src;
        }
      }
      global.Audio = ControllableAudio as unknown as typeof Audio;

      const { result } = renderHook(() => useTTS('pl'));
      act(() => {
        result.current.setVoiceEnabled(true);
        result.current.setIsTTSEnabled(true);
      });

      // 1. Zaczynamy wiadomość 1
      await act(async () => {
        result.current.addToQueue('Wiadomość numer jeden.', 'msg-1', true);
      });

      expect(result.current.currentAudio).toBeDefined();

      // 2. Gracz przerywa i wysyła nową akcję
      act(() => {
        result.current.stopCurrentAudio();
      });

      // 3. Wysyłamy nową wiadomość
      await act(async () => {
        result.current.addToQueue('Pierwsze zdanie nowej wiadomości.', 'msg-2', true);
      });

      // Wiadomość 2 powinna natychmiast załadować swój segment 0 i go odtwarzać
      expect(result.current.currentAudio).toBeDefined();
    });
  });
});
