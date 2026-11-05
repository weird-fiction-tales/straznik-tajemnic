import * as sfxCatalog from '@/lib/audio/sfx-catalog';
import { renderHook, act } from '@testing-library/react';
import { isPureTextMode } from '@/lib/api-keys-service';
import { hasLocalPlaytestTransport } from '@/lib/local-playtest-transport';
import { useTTS } from '@/hooks/useTTS';

const mockSaveAISettings = jest.fn();
let currentMockSettings = {
  qualityPreset: 'high',
  voiceSettings: {
    voiceId: 'Kore',
    volume: 75,
    provider: 'gemini',
    narratorOnly: false,
    speed: undefined as number | undefined,
  },
};

jest.mock('@/lib/ai-settings', () => ({
  loadAISettings: jest.fn(() => currentMockSettings),
  saveAISettings: jest.fn((newSettings) => {
    currentMockSettings = newSettings;
    mockSaveAISettings(newSettings);
  }),
}));

jest.mock('@/lib/local-playtest-transport', () => ({
  hasLocalPlaytestTransport: jest.fn(() => false),
}));

jest.mock('@/lib/api-keys-service', () => ({
  getApiKeyHeaders: jest.fn(() => ({})),
  isPureTextMode: jest.fn(() => false),
}));

describe('useTTS First-Chunk Streaming & Buffering', () => {
  let originalFetch: typeof global.fetch;
  let originalAudio: typeof global.Audio;
  let createdAudio: Array<{
    playbackRate: number;
    onplaying?: (() => void) | null;
    onended?: (() => void) | null;
  }>;

  beforeEach(() => {
    jest.mocked(isPureTextMode).mockReturnValue(false);
    jest.mocked(hasLocalPlaytestTransport).mockReturnValue(false);
    currentMockSettings = {
      qualityPreset: 'high',
      voiceSettings: {
        voiceId: 'Kore',
        volume: 75,
        provider: 'gemini',
        narratorOnly: false,
        speed: undefined,
      },
    };
    originalFetch = global.fetch;
    originalAudio = global.Audio;
    createdAudio = [];

    class MockAudio extends EventTarget {
      readyState = 4;
      load = jest.fn();
      src = '';
      volume = 1;
      currentTime = 0;
      paused = true;
      playbackRate = 1;
      play = jest.fn().mockResolvedValue(undefined);
      pause = jest.fn();
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(src?: string) {
        super();
        if (src) this.src = src;
        createdAudio.push(this);
      }
    }
    global.Audio = MockAudio as unknown as typeof Audio;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        audioUrl: 'blob:mock-audio-chunk-1',
      }),
    } as Response);
  });

  it.each([undefined, 0.9, 1.0, 1.3])(
    'uses natural playback speed unless saved speed is %s',
    async (speed) => {
      currentMockSettings.voiceSettings.speed = speed;
      const { result } = renderHook(() => useTTS('pl'));
      await act(async () => {
        result.current.addToQueue(
          'Deszcz za oknem cichnie, gdy redaktorka zamyka teczkę z dokumentami.',
          'speed-check',
          true
        );
      });
      expect(createdAudio).not.toHaveLength(0);
      expect(
        createdAudio.every((audio) => audio.playbackRate === (speed ?? 1.0))
      ).toBe(true);
    }
  );

  it('separates directed recordings from old plain-text TTS cache entries', async () => {
    const { persistentMediaCache } =
      await import('@/lib/persistent-media-cache');
    const keySpy = jest.spyOn(persistentMediaCache, 'generateTtsCacheKey');
    const { result } = renderHook(() => useTTS('pl'));
    await act(async () => {
      result.current.addToQueue(
        'Na stole leży zamknięta teczka, a redaktorka czeka na twoją odpowiedź.',
        'cache-version',
        true
      );
    });
    expect(keySpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('directed-speech-v1')
    );
    keySpy.mockRestore();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.Audio = originalAudio;
    jest.clearAllMocks();
  });

  it('uses the current Ultra settings immediately after switching from narrator-only High', async () => {
    currentMockSettings.voiceSettings.narratorOnly = true;
    const { result } = renderHook(() => useTTS('pl'));
    currentMockSettings = {
      ...currentMockSettings,
      qualityPreset: 'ultra',
      voiceSettings: {
        ...currentMockSettings.voiceSettings,
        narratorOnly: false,
      },
    };
    await act(async () => {
      result.current.addToQueue(
        'Helena: „Proszę przeczytać raport. Potem porozmawiamy.”',
        'ultra-switch',
        true
      );
    });
    const payloads = jest
      .mocked(fetch)
      .mock.calls.filter(([, init]) => init?.method === 'POST')
      .map(
        ([, init]) =>
          JSON.parse(String(init?.body)) as { text: string; voice: string }
      );
    expect(payloads.length).toBeGreaterThan(0);
    expect(payloads.every((payload) => payload.voice !== 'Kore')).toBe(true);
  });

  it.each(['pl', 'en'] as const)(
    'shares inline signed dialogue boundaries with the chat (%s)',
    async (locale) => {
      currentMockSettings.qualityPreset = 'ultra';
      const { result } = renderHook(() => useTTS(locale));
      const line =
        locale === 'pl'
          ? 'W gabinecie Helena: „Zaczekaj. Przeczytaj raport.” Za oknem pada deszcz.'
          : 'In the office Helena: "Wait. Read the report." Rain falls outside.';
      await act(async () => {
        result.current.addToQueue(line, 'inline-speaker-' + locale, true);
      });
      const payloads = jest
        .mocked(fetch)
        .mock.calls.filter(([, init]) => init?.method === 'POST')
        .map(
          ([, init]) =>
            JSON.parse(String(init?.body)) as { text: string; voice: string }
        );
      const speech = payloads.filter((payload) =>
        /Zaczekaj|Przeczytaj|Wait|Read the report/.test(payload.text)
      );
      expect(speech.length).toBeGreaterThan(0);
      expect(speech.every((payload) => payload.voice !== 'Kore')).toBe(true);
      const tail = payloads.find((payload) =>
        /Za oknem|Rain falls/.test(payload.text)
      );
      expect(tail?.voice).toBe('Kore');
      const introduction = payloads.find((payload) =>
        /W gabinecie|In the office/.test(payload.text)
      );
      expect(introduction?.voice).toBe('Kore');
      expect(introduction?.text).not.toContain('Helena');
    }
  );

  it.each(['dr Jarosław Skrzyński', 'Dr. Skrzyński'])(
    'preserves the doctor identity and narrator boundaries while streaming %s', async speaker => {
      currentMockSettings.qualityPreset = 'ultra';
      const { result } = renderHook(() => useTTS('pl'));
      const first = `W gabinecie ${speaker}: „Zaczekaj. `;
      await act(async () => { result.current.addToQueue(first, 'doctor-stream', false); });
      await act(async () => { result.current.addToQueue(first + 'Raport jest gotowy.” Za oknem pada deszcz.', 'doctor-stream', true); });
      const payloads = jest.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'POST')
        .map(([, init]) => JSON.parse(String(init?.body)) as { text: string; voice: string });
      expect(payloads.filter(payload => /Zaczekaj|Raport jest/.test(payload.text)).every(payload => payload.voice === 'Puck')).toBe(true);
      expect(payloads.find(payload => /W gabinecie/.test(payload.text))?.voice).toBe('Kore');
      expect(payloads.find(payload => /Za oknem/.test(payload.text))?.voice).toBe('Kore');
      expect(payloads.map(payload => payload.text).join(' ').match(/Zaczekaj/g)).toHaveLength(1);
    }
  );

  it.each(Array.from({ length: 'Dr. Skrzyński: „'.length + 1 }, (_, index) => index))('preserves the first sentence when streaming splits doctor label at %s', async split => {
    currentMockSettings.qualityPreset = 'ultra';
    const { result } = renderHook(() => useTTS('pl'));
    await act(async () => { result.current.addToQueue('W gabinecie zapada cisza. ' + 'Dr. Skrzyński: „'.slice(0, split), 'split-title', false); });
    await act(async () => { result.current.addToQueue('W gabinecie zapada cisza. Dr. Skrzyński: „Zaczekaj. Raport jest gotowy.” Za oknem pada deszcz.', 'split-title', true); });
    const payloads = jest.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'POST')
      .map(([, init]) => JSON.parse(String(init?.body)) as { text: string; voice: string });
    expect(payloads.map(payload => payload.text).join(' ').match(/Zaczekaj/g)).toHaveLength(1);
    expect(payloads.find(payload => /Zaczekaj/.test(payload.text))?.voice).toBe('Puck');
    expect(payloads.find(payload => /Raport jest/.test(payload.text))?.voice).toBe('Puck');
    expect(payloads.some(payload => payload.text === 'Dr.')).toBe(false);
  });

  it('starts scene ambience only on real playback and releases it after the final speech segment', async () => {
    const { sceneSoundscape } = await import('@/lib/audio/scene-soundscape');
    const { immersion } = await import('@/lib/hardware/hue/immersion');
    const play = jest.spyOn(sceneSoundscape, 'play').mockImplementation(() => {});
    const stop = jest.spyOn(sceneSoundscape, 'stop');
    const snapshot = jest.spyOn(immersion, 'snapshot').mockReturnValue({ sceneId: 'scene-warszawa-redakcja' });
    localStorage.setItem('adventure_context', JSON.stringify({ id: 'cien-nad-prabutami' }));
    currentMockSettings.qualityPreset = 'ultra';
    try {
      const { result } = renderHook(() => useTTS('pl'));
      await act(async () => { result.current.addToQueue('Helena: „Proszę przeczytać raport.”', 'ambience-playback', true); });
      expect(play).not.toHaveBeenCalled();
      await act(async () => { createdAudio[0]?.onplaying?.(); });
      expect(play).toHaveBeenCalledWith('cien-nad-prabutami', 'scene-warszawa-redakcja');
      const stops = stop.mock.calls.length;
      await act(async () => { createdAudio[0]?.onended?.(); });
      expect(stop.mock.calls.length).toBeGreaterThan(stops);
    } finally {
      localStorage.removeItem('adventure_context');
      play.mockRestore(); stop.mockRestore(); snapshot.mockRestore();
    }
  });

  it.each([true, false])(
    'allows cloud narration for confirmed local server credentials=%s while preserving text-only profiles',
    async (configured) => {
      jest.mocked(isPureTextMode).mockReturnValue(true);
      jest.mocked(hasLocalPlaytestTransport).mockReturnValue(configured);
      global.fetch = jest.fn(
        async (_url, init) =>
          ({
            ok: true,
            status: 200,
            json: async () =>
              init?.method === 'GET'
                ? { provider: 'gemini' }
                : { success: true, audioUrl: 'blob:voice' },
          }) as Response
      );
      const { result } = renderHook(() => useTTS('pl'));
      await act(async () => {
        result.current.addToQueue(
          'Helena kładzie na biurku zamkniętą teczkę i odsuwa się od okna.',
          'local-server-voice',
          true
        );
      });
      const posts = jest
        .mocked(fetch)
        .mock.calls.filter(([, init]) => init?.method === 'POST');
      expect(posts).toHaveLength(configured ? 1 : 0);
    }
  );

  it('wypycha pierwsze zdanie narracji natychmiast na presecie HIGH bez czekania na flush', async () => {
    const { result } = renderHook(() => useTTS('pl'));

    act(() => {
      result.current.setVoiceEnabled(true);
      result.current.setIsTTSEnabled(true);
    });

    const firstSentence =
      'Deszcz bębnił bezlitośnie o dach czarnego packarda zaparkowanego na przedmieściach.';

    await act(async () => {
      // Symulacja nadejścia pierwszego pełnego zdania podczas strumieniowania (flush = false)
      result.current.addToQueue(firstSentence, 'msg-intro-1', false);
    });

    // Powinno natychmiast wywołać fetch dla pierwszego zdania
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const fetchArgs = (global.fetch as jest.Mock).mock.calls[0];
    expect(fetchArgs[0]).toBe('/api/tts/gemini');
    const payload = JSON.parse(fetchArgs[1].body);
    expect(payload.text).toContain('Deszcz bębnił bezlitośnie');
  });

  it('czeka na wszystkie segmenty i zamknięcie pełnego tekstu otwarcia', async () => {
    const { result } = renderHook(() => useTTS('pl'));

    act(() => {
      result.current.setVoiceEnabled(true);
      result.current.setIsTTSEnabled(true);
    });

    act(() => {
      result.current.startInitialBuffering();
    });

    expect(result.current.isInitialBuffering).toBe(true);

    // 1. zdanie: segment 0
    const sentence1 =
      'Wchodzisz do zamglonego holu starego uniwersytetu Miskatonic w Arkham.';
    await act(async () => {
      result.current.addToQueue(sentence1, 'msg-intro-2', false);
    });

    // Po 1. zdaniu w trakcie streamingu (flush = false) buforowanie wciąż trwa (target = 3)
    expect(result.current.isInitialBuffering).toBe(true);

    // 2. zdanie: przekracza STREAMING_SEGMENT_TARGET_CHARS (100 znaków) -> segment 1
    const sentence2 = `${sentence1} Ciężkie dębowe drzwi zatrzasnęły się za tobą z głuchym, niepokojącym łomotem echującym w pustych korytarzach biblioteki.`;
    await act(async () => {
      result.current.addToQueue(sentence2, 'msg-intro-2', false);
    });

    // Wciąż mamy tylko 2 segmenty, więc buforowanie nadal trwa
    expect(result.current.isInitialBuffering).toBe(true);

    // 3. zdanie: segment 2 (osiągamy 3 segmenty w buforze)
    const sentence3 = `${sentence2} Na marmurowej posadzce dostrzegasz zaschnięte ślady stóp prowadzące w stronę zakazanego działu rzadkich ksiąg.`;
    await act(async () => {
      result.current.addToQueue(sentence3, 'msg-intro-2', false);
    });

    // Three ready segments do not establish that the opening has ended.
    expect(result.current.isInitialBuffering).toBe(true);
    await act(async () => { result.current.addToQueue(sentence3, 'msg-intro-2', true); });
    expect(result.current.isInitialBuffering).toBe(false);
  });

  it('waitForInitialBuffer rozwiązuje obietnicę po zbuforowaniu segmentów lub zakończeniu strumienia (flush)', async () => {
    const { result } = renderHook(() => useTTS('pl'));

    act(() => {
      result.current.setVoiceEnabled(true);
      result.current.setIsTTSEnabled(true);
    });

    act(() => {
      result.current.startInitialBuffering();
    });

    let bufferResolved = false;
    const waitPromise = act(async () => {
      await result.current.waitForInitialBuffer(5000);
      bufferResolved = true;
    });

    expect(bufferResolved).toBe(false);

    // Krótkie intro: tylko 1 zdanie, ale natychmiastowy flush (koniec odpowiedzi)
    const shortIntro = 'Zapada zmrok nad portowym miastem Innsmouth.';
    await act(async () => {
      result.current.addToQueue(shortIntro, 'msg-intro-short', true);
    });

    await waitPromise;
    expect(bufferResolved).toBe(true);
    expect(result.current.isInitialBuffering).toBe(false);
  });

  it('przekazuje audioDirection lektora do /api/tts/gemini w zależności od SAN i nastroju', async () => {
    const { result } = renderHook(() => useTTS('pl'));

    act(() => {
      result.current.setVoiceEnabled(true);
      result.current.setIsTTSEnabled(true);
    });

    const traumaSentence =
      '[SANITY: -6: potworny widok]\n[NASTRÓJ: klaustrofobiczny]\nCiemność zdaje się zacieśniać wokół twojej głowy.';

    await act(async () => {
      result.current.addToQueue(traumaSentence, 'msg-trauma-1', true);
    });

    expect(global.fetch).toHaveBeenCalled();
    const fetchArgs = (global.fetch as jest.Mock).mock.calls[0];
    const payload = JSON.parse(fetchArgs[1].body);

    expect(payload.audioDirection).toBeDefined();
    expect(payload.audioDirection).toContain('paranoid whisper');
    expect(payload.audioDirection).toContain('cosmic dread');
  });

  it('obsługuje wielogłosowe słuchowisko: NPC otrzymuje dedykowaną reżyserię aktorską', async () => {
    const { result } = renderHook(() => useTTS('pl'));

    act(() => {
      result.current.setVoiceEnabled(true);
      result.current.setIsTTSEnabled(true);
    });

    const dialogue =
      '@Walter Gilman: „Słyszycie ten nieustanny chrobot w ścianach starego domu?”';

    await act(async () => {
      result.current.addToQueue(dialogue, 'msg-dialogue-1', true);
    });

    expect(global.fetch).toHaveBeenCalled();
    const fetchArgs = (global.fetch as jest.Mock).mock.calls[0];
    const payload = JSON.parse(fetchArgs[1].body);

    expect(payload.audioDirection).toBeDefined();
    expect(payload.audioDirection).toContain(
      'natural, character-driven dramatic'
    );
    expect(payload.text).toContain('Słyszycie ten nieustanny chrobot');
  });

  it('wstrzymuje odtwarzanie audio (playFromBuffer) do momentu wywołania playInitialNarration (bramka CTA)', async () => {
    const { result } = renderHook(() => useTTS('pl'));

    act(() => {
      result.current.setVoiceEnabled(true);
      result.current.setIsTTSEnabled(true);
    });

    // Inicjuj buforowanie początkowe (stan oczekiwania na CTA)
    act(() => {
      result.current.startInitialBuffering();
    });

    // Dodaj 3 segmenty (osiągnięcie progu buforowania)
    const introPart1 =
      'Cień kładzie się na starych dachach portowego miasteczka. Wiatr niesie zapach soli i zgnilizny.';
    await act(async () => {
      result.current.addToQueue(introPart1, 'msg-intro-cta', true);
    });

    // Mimo zakończenia buforowania lektor nie odtwarza audio automatycznie
    expect(result.current.currentAudio).toBeNull();

    // Wywołaj stopCurrentAudio (np. wewnętrzny cleanup) - bramka CTA nie może zostać zdjęta
    act(() => {
      result.current.stopCurrentAudio();
    });

    // Dodaj kolejną treść
    await act(async () => {
      result.current.addToQueue(
        'Kolejne zdanie w trakcie oczekiwania.',
        'msg-intro-cta-2',
        true
      );
    });

    // Audio nadal nie może grać bez CTA
    expect(result.current.currentAudio).toBeNull();

    // Dopiero kliknięcie CTA wywołuje playInitialNarration i odblokowuje odtwarzacz
    act(() => {
      result.current.playInitialNarration?.();
    });

    // Sprawdź czy po odblokowaniu audio ruszyło
    expect(result.current.playInitialNarration).toBeDefined();
  });

  it('Issue #172: zachowuje głos NPC dla wielozdaniowej kwestii dialogowej i wraca do lektora po nowej linii', async () => {
    const { result } = renderHook(() => useTTS('pl'));

    act(() => {
      result.current.setVoiceEnabled(true);
      result.current.setIsTTSEnabled(true);
    });

    const fullScene =
      'Walter Gilman: „Nie schodź tam! To czyste szaleństwo. Coś tam czeka w mroku!”\n\nNagle rozlega się zgrzyt klucza w zamku.';

    await act(async () => {
      result.current.addToQueue(fullScene, 'msg-multi-npc-1', true);
    });

    // Powinny być dokładnie 2 wywołania fetch: 1 scalony segment NPC + 1 segment Narratora
    expect(global.fetch).toHaveBeenCalledTimes(2);

    const firstCallPayload = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body
    );
    const secondCallPayload = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[1][1].body
    );

    // Segment 1: Walter Gilman (cały 3-zdaniowy dialog aktorski scalony w jeden segment)
    expect(firstCallPayload.voice).toBe('Puck');
    expect(firstCallPayload.text).toContain('Nie schodź tam!');
    expect(firstCallPayload.text).toContain('To czyste szaleństwo.');
    expect(firstCallPayload.text).toContain('Coś tam czeka w mroku!');
    expect(firstCallPayload.audioDirection).toContain(
      'natural, character-driven dramatic'
    );

    // Segment 2: Narrator (powrót do lektora po nowej linii \n\n)
    expect(secondCallPayload.voice).toBe('Kore');
    expect(secondCallPayload.text).toBe(
      'Nagle rozlega się zgrzyt klucza w zamku.'
    );
    expect(secondCallPayload.audioDirection).not.toContain('character-driven');
  });

  it('Issue #172: tryb narratorOnly wymusza głos lektora dla dialogów postaci', async () => {
    const { result } = renderHook(() => useTTS('pl'));

    act(() => {
      result.current.setVoiceEnabled(true);
      result.current.setIsTTSEnabled(true);
      result.current.setIsNarratorOnly(true);
    });

    expect(result.current.isNarratorOnly).toBe(true);

    const dialogue = 'Walter Gilman: „Nie schodź tam! To czyste szaleństwo.”';
    await act(async () => {
      result.current.addToQueue(dialogue, 'msg-narrator-only', true);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body
    );
    expect(payload.voice).toBe('Kore');
    expect(payload.text).toContain('Nie schodź tam!');
  });

  it('Issue #172: reaktywny przełącznik setIsNarratorOnly zapisuje konfigurację', async () => {
    const { result } = renderHook(() => useTTS('pl'));

    act(() => {
      result.current.setIsNarratorOnly(true);
    });

    expect(result.current.isNarratorOnly).toBe(true);
    expect(mockSaveAISettings).toHaveBeenCalledWith(
      expect.objectContaining({
        voiceSettings: expect.objectContaining({
          narratorOnly: true,
        }),
      })
    );
  });

  it('Issue #172: podtrzymuje głos NPC w strumieniowanych kolejno zdaniach dialogu', async () => {
    const { result } = renderHook(() => useTTS('pl'));

    act(() => {
      result.current.setVoiceEnabled(true);
      result.current.setIsTTSEnabled(true);
    });

    // Chunk 1: pierwsze zdanie z markerem NPC
    const chunk1 = 'Walter Gilman: „Nie schodź tam! ';
    await act(async () => {
      result.current.addToQueue(chunk1, 'msg-stream-npc', false);
    });

    // Chunk 2: drugie zdanie w tej samej linii
    const chunk2 = `${chunk1}To czyste szaleństwo. `;
    await act(async () => {
      result.current.addToQueue(chunk2, 'msg-stream-npc', false);
    });

    // Chunk 3: domknięcie dialogu nową linią i zdanie narracji lektora
    const chunk3 = `${chunk2}Coś tam czeka w mroku!”\n\nNagle rozlega się zgrzyt klucza w zamku.`;
    await act(async () => {
      result.current.addToQueue(chunk3, 'msg-stream-npc', true);
    });

    // Oczekujemy 3 wywołań: segment 0 (Puck, wczesny start), segment 1 (Puck, domknięcie dialogu), segment 2 (Kore, narrator)
    expect(global.fetch).toHaveBeenCalledTimes(3);
    const call0Payload = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body
    );
    const call1Payload = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[1][1].body
    );
    const call2Payload = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[2][1].body
    );

    // Segmenty dialogu NPC - oba mają głos Waltera Gilmana (Puck)
    expect(call0Payload.voice).toBe('Puck');
    expect(call0Payload.text).toContain('Nie schodź tam!');
    expect(call0Payload.text).toContain('To czyste szaleństwo.');

    expect(call1Payload.voice).toBe('Puck');
    expect(call1Payload.text).toContain('Coś tam czeka w mroku!');

    // Segment narracji - powrót do głosu lektora (Kore)
    expect(call2Payload.voice).toBe('Kore');
    expect(call2Payload.text).toBe('Nagle rozlega się zgrzyt klucza w zamku.');
  });

  it('Issue #200: stosuje adaptacyjne tempo narracji w dynamicznych scenach akcji i walki', async () => {
    const { result } = renderHook(() => useTTS('pl'));

    act(() => {
      result.current.setVoiceEnabled(true);
      result.current.setIsTTSEnabled(true);
    });

    const actionScene =
      '[NASTRÓJ: panika i pościg]\nKultyści wypadają zza rogu z obnażonymi nożami!';

    await act(async () => {
      result.current.addToQueue(actionScene, 'msg-action-1', true);
    });

    expect(global.fetch).toHaveBeenCalled();
    const fetchArgs = (global.fetch as jest.Mock).mock.calls[0];
    const payload = JSON.parse(fetchArgs[1].body);

    expect(payload.audioDirection).toBeDefined();
    expect(payload.audioDirection).toContain('intense, thrilling cadence');
    expect(payload.audioDirection).toContain('dynamic momentum');
  });

  it('Issue #78: potwierdza dostawcę i odzyskuje audio z cache bez POST syntezy (Cache Hit)', async () => {
    const { persistentMediaCache } =
      await import('@/lib/persistent-media-cache');
    const isAvailableSpy = jest
      .spyOn(persistentMediaCache, 'isAvailable')
      .mockReturnValue(true);
    const getTtsAudioSpy = jest
      .spyOn(persistentMediaCache, 'getTtsAudio')
      .mockResolvedValue('data:audio/wav;base64,mock-cached-audio');

    const { result } = renderHook(() => useTTS('pl'));

    act(() => {
      result.current.setVoiceEnabled(true);
      result.current.setIsTTSEnabled(true);
    });

    await act(async () => {
      result.current.addToQueue(
        'Zapach stęchłego papieru unosi się w bibliotece.',
        'msg-cache-hit',
        true
      );
    });

    expect(getTtsAudioSpy).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/tts/gemini?languageCode=pl-PL',
      expect.objectContaining({ method: 'GET' })
    );
    expect(
      (global.fetch as jest.Mock).mock.calls.filter(
        ([, init]) => init?.method === 'POST'
      )
    ).toHaveLength(0);

    isAvailableSpy.mockRestore();
    getTtsAudioSpy.mockRestore();
  });

  it('Issue #561: łączy 2-3 zdania narracji ze słowami "mrok", "chłód", "dusi", "wstrzymujesz oddech" w jeden spójny run TTS bez szarpania tempa', async () => {
    const { result } = renderHook(() => useTTS('pl'));

    act(() => {
      result.current.setVoiceEnabled(true);
      result.current.setIsTTSEnabled(true);
    });

    const paragraph =
      '[NASTRÓJ: spokojny wieczór]\nWchodzisz do starego pokoju, gdzie panuje mrok i chłód. Wstrzymujesz oddech na palcach, a gęsty kurz niemal dusi cię w gardle. Na dębowym biurku leżą bezwładne zwłoki oraz otwarty rejestr.';

    await act(async () => {
      result.current.addToQueue(paragraph, 'msg-561-smooth', true);
    });

    // Wszystkie 3 zdania narracji mają ten sam wygładzony ton sceny i trafiają jako 1 wspólny run TTS
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body
    );
    expect(payload.voice).toBe('Kore');
    expect(payload.text).toContain('Wchodzisz do starego pokoju');
    expect(payload.text).toContain('Wstrzymujesz oddech na palcach');
    expect(payload.text).toContain('Na dębowym biurku leżą bezwładne zwłoki');
    expect(payload.audioDirection).not.toContain('paranoid whisper');
  });

  it('Issue #562: natychmiast resetuje głos NPC po znaku zamykającym cudzysłów (”, ", ») nawet gdy narracja jest w tej samej linii bez \\n', async () => {
    const { result } = renderHook(() => useTTS('pl'));

    act(() => {
      result.current.setVoiceEnabled(true);
      result.current.setIsTTSEnabled(true);
    });

    // Kwestia NPC (wielozdaniowa) oraz dalsza proza narratora w JEDNEJ linii bez \n
    const sameLineScene =
      'Walter Gilman: „Nie schodź tam! To czyste szaleństwo.” Nagle rozlega się zgrzyt klucza w zamku i ciężkie kroki na schodach.';

    await act(async () => {
      result.current.addToQueue(sameLineScene, 'msg-562-inline-1', true);
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const npcPayload = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body
    );
    const narratorPayload = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[1][1].body
    );

    expect(npcPayload.voice).toBe('Puck');
    expect(npcPayload.text).toBe('Nie schodź tam! To czyste szaleństwo.');

    expect(narratorPayload.voice).toBe('Kore');
    expect(narratorPayload.text).toBe(
      'Nagle rozlega się zgrzyt klucza w zamku i ciężkie kroki na schodach.'
    );
  });

  it('Issue #562: rozdziela głos NPC i narratora także gdy po zamknięciu cudzysłowu nie ma kropki przed narracją w tym samym zdaniu', async () => {
    const { result } = renderHook(() => useTTS('pl'));

    act(() => {
      result.current.setVoiceEnabled(true);
      result.current.setIsTTSEnabled(true);
    });

    const inlineCommaScene =
      'Walter Gilman: „Nie schodź tam”, po czym odwraca wzrok w stronę ciemnego okna.';

    await act(async () => {
      result.current.addToQueue(inlineCommaScene, 'msg-562-inline-comma', true);
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const npcPayload = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body
    );
    const narratorPayload = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[1][1].body
    );

    expect(npcPayload.voice).toBe('Puck');
    expect(npcPayload.text).toBe('Nie schodź tam');

    expect(narratorPayload.voice).toBe('Kore');
    expect(narratorPayload.text).toBe(
      'po czym odwraca wzrok w stronę ciemnego okna.'
    );
  });

  it('Issue #562: ekstrahuje polskie i angielskie tagi emocji ([szept], [panika]) do audioDirection i całkowicie wycina je z tekstu TTS', async () => {
    const { result } = renderHook(() => useTTS('pl'));

    act(() => {
      result.current.setVoiceEnabled(true);
      result.current.setIsTTSEnabled(true);
    });

    const taggedMessage = 'Walter Gilman: [szept] „Ktoś stoi za drzwiami.”';

    await act(async () => {
      result.current.addToQueue(taggedMessage, 'msg-562-emotion', true);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body
    );

    expect(payload.voice).toBe('Puck');
    expect(payload.text).toBe('Ktoś stoi za drzwiami.');
    expect(payload.text).not.toContain('szept');
    expect(payload.text).not.toContain('[');
    expect(payload.audioDirection).toContain('whisper');
  });

  it('Issue #562: obsługuje cudzysłowy ASCII (") oraz francuskie («...») i izoluje tagi emocji między kwestią NPC a ogonem narratora', async () => {
    const { result } = renderHook(() => useTTS('pl'));

    act(() => {
      result.current.setVoiceEnabled(true);
      result.current.setIsTTSEnabled(true);
    });

    const mixedQuoteScene =
      'Walter Gilman: "Uważaj na schody! [szept] Ktoś tam stoi", [panika] po czym cofa się gwałtownie w cień.';

    await act(async () => {
      result.current.addToQueue(mixedQuoteScene, 'msg-562-ascii-quotes', true);
    });

    expect(global.fetch).toHaveBeenCalledTimes(3);
    const npcNormalPayload = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body
    );
    const npcWhisperPayload = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[1][1].body
    );
    const narratorPayload = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[2][1].body
    );

    expect(npcNormalPayload.voice).toBe('Puck');
    expect(npcNormalPayload.text).toBe('Uważaj na schody!');

    expect(npcWhisperPayload.voice).toBe('Puck');
    expect(npcWhisperPayload.text).toBe('Ktoś tam stoi');
    expect(npcWhisperPayload.text).not.toContain('[');
    expect(npcWhisperPayload.audioDirection).toContain('whisper');
    expect(npcWhisperPayload.audioDirection).not.toContain('panicked');

    expect(narratorPayload.voice).toBe('Kore');
    expect(narratorPayload.text).toBe('po czym cofa się gwałtownie w cień.');
    expect(narratorPayload.text).not.toContain('[');
    expect(narratorPayload.audioDirection).toContain('panicked');
  });

  it('Issue #562: obsługuje cudzysłowy francuskie («...»), tag [SFX: ...] przed imieniem NPC oraz tag emocji bezpośrednio przed zamknięciem cudzysłowu bez duplikacji ogona narratora', async () => {
    const { result } = renderHook(() => useTTS('pl'));

    act(() => {
      result.current.setVoiceEnabled(true);
      result.current.setIsTTSEnabled(true);
    });

    const sfxAndGuillemetScene =
      '[SFX: door_slam] Walter Gilman: «Nie schodź tam! [szept]» Odwraca wzrok w stronę okna.';

    await act(async () => {
      result.current.addToQueue(
        sfxAndGuillemetScene,
        'msg-562-sfx-guillemet',
        true
      );
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const npcPayload = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body
    );
    const narratorPayload = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[1][1].body
    );

    expect(npcPayload.voice).toBe('Puck');
    expect(npcPayload.text).toBe('Nie schodź tam!');
    expect(npcPayload.text).not.toContain('door_slam');
    expect(npcPayload.text).not.toContain('Walter Gilman');
    expect(npcPayload.audioDirection).toContain('whisper');

    expect(narratorPayload.voice).toBe('Kore');
    expect(narratorPayload.text).toBe('Odwraca wzrok w stronę okna.');
    expect(narratorPayload.audioDirection).not.toContain('whisper');
  });

  it('Issue #562: rozróżnia zakres tagu emocji przed otwarciem cudzysłowu NPC od tagu emocji po zamknięciu cudzysłowu dla narratora', async () => {
    const { result } = renderHook(() => useTTS('pl'));

    act(() => {
      result.current.setVoiceEnabled(true);
      result.current.setIsTTSEnabled(true);
    });

    // Wariant A: tag [szept] po zamknięciu cudzysłowu należy wyłącznie do ogona narratora
    const tagAfterQuote =
      'Walter Gilman: „Nie schodź tam!” [szept] Odwraca wzrok.';
    await act(async () => {
      result.current.addToQueue(tagAfterQuote, 'msg-562-tag-after-quote', true);
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const npcPayloadA = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body
    );
    const narratorPayloadA = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[1][1].body
    );

    expect(npcPayloadA.voice).toBe('Puck');
    expect(npcPayloadA.text).toBe('Nie schodź tam!');
    expect(npcPayloadA.audioDirection).not.toContain('whisper');

    expect(narratorPayloadA.voice).toBe('Kore');
    expect(narratorPayloadA.text).toBe('Odwraca wzrok.');
    expect(narratorPayloadA.audioDirection).toContain('whisper');

    // Wariant B: tag [szept] przed cudzysłowem należy wyłącznie do kwestii NPC
    const tagBeforeQuote =
      'Walter Gilman: [szept] „Nie schodź tam!” Odwraca wzrok.';
    await act(async () => {
      result.current.addToQueue(
        tagBeforeQuote,
        'msg-562-tag-before-quote',
        true
      );
    });

    expect(global.fetch).toHaveBeenCalledTimes(4);
    const npcPayloadB = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[2][1].body
    );
    const narratorPayloadB = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[3][1].body
    );

    expect(npcPayloadB.voice).toBe('Puck');
    expect(npcPayloadB.text).toBe('Nie schodź tam!');
    expect(npcPayloadB.audioDirection).toContain('whisper');

    expect(narratorPayloadB.voice).toBe('Kore');
    expect(narratorPayloadB.text).toBe('Odwraca wzrok.');
    expect(narratorPayloadB.audioDirection).not.toContain('whisper');
  });

  it('Issue #562: poprawnie przełącza głos z NPC na narratora przy strumieniowaniu (flush=false), gdy znak zamykający cudzysłów ” spływa dopiero w kolejnym chunku wraz z narracją', async () => {
    const { result } = renderHook(() => useTTS('pl'));

    act(() => {
      result.current.setVoiceEnabled(true);
      result.current.setIsTTSEnabled(true);
    });

    // Chunk 1: wypowiedź NPC ucięta dokładnie po kropce, ale przed znakiem zamykającym cudzysłów ”
    const chunk1 = 'Walter Gilman: „Nie schodź tam! To czyste szaleństwo.';
    await act(async () => {
      result.current.addToQueue(chunk1, 'msg-562-stream-split-quote', false);
    });

    // Chunk 2: spływa znak zamykający cudzysłów ” oraz zdanie narratora w tej samej linii
    const chunk2 = `${chunk1}” Nagle rozlega się zgrzyt klucza w zamku.`;
    await act(async () => {
      result.current.addToQueue(chunk2, 'msg-562-stream-split-quote', true);
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const npcPayload = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body
    );
    const narratorPayload = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[1][1].body
    );

    expect(npcPayload.voice).toBe('Puck');
    expect(npcPayload.text).toContain('Nie schodź tam!');
    expect(npcPayload.text).toContain('To czyste szaleństwo.');

    expect(narratorPayload.voice).toBe('Kore');
    expect(narratorPayload.text).toBe(
      'Nagle rozlega się zgrzyt klucza w zamku.'
    );
  });

  it('Issue #561: aktywuje tryb action dla jawnego tagu [WALKA_ATAK: ...] oraz tryb whisper dla [SANITY: -1d10: ...] przed ich wycięciem przez stripMultilineArtifacts', async () => {
    const { result } = renderHook(() => useTTS('pl'));

    act(() => {
      result.current.setVoiceEnabled(true);
      result.current.setIsTTSEnabled(true);
    });

    const combatTurn =
      '[NASTRÓJ: tajemniczy]\n[WALKA_ATAK: @Badacz: napastnik=Kultysta]\nKultysta rzuca się z nożem! Ostrze błyszczy w ciemności.';
    await act(async () => {
      result.current.addToQueue(combatTurn, 'msg-561-combat-tag', true);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const combatPayload = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body
    );
    expect(combatPayload.audioDirection).toContain(
      'intense, thrilling cadence'
    );
    expect(combatPayload.text).toBe(
      'Kultysta rzuca się z nożem! Ostrze błyszczy w ciemności.'
    );

    const sanityDiceTurn =
      '[NASTRÓJ: tajemniczy]\n[SANITY: -1d10: manifestacja Przedwiecznego]\nZasłona rzeczywistości pęka na twoich oczach.';
    await act(async () => {
      result.current.addToQueue(sanityDiceTurn, 'msg-561-sanity-dice', true);
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const sanityPayload = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[1][1].body
    );
    expect(sanityPayload.audioDirection).toContain(
      'urgent, tense, and paranoid whisper'
    );
  });

  it('Issue #562: zachowuje tag emocji przed zamknięciem cudzysłowu, gdy tag spływa rozcięty na granicy chunków SSE ([szep + t]”)', async () => {
    const { result } = renderHook(() => useTTS('pl'));

    act(() => {
      result.current.setVoiceEnabled(true);
      result.current.setIsTTSEnabled(true);
    });

    // Chunk 1: zdanie NPC przekraczające próg EARLY_FIRST_SEGMENT_MIN_CHARS, ucięte w połowie tagu [szep
    const chunk1 =
      'Walter Gilman: „Nie schodź tam, bo w ciemności czeka zguba! [szep';
    await act(async () => {
      result.current.addToQueue(chunk1, 'msg-562-split-tag-sse', false);
    });

    // Chunk 2: dokończenie tagu t]” oraz zdanie narratora w tej samej linii
    const chunk2 = `${chunk1}t]” Odwraca wzrok w stronę okna.`;
    await act(async () => {
      result.current.addToQueue(chunk2, 'msg-562-split-tag-sse', true);
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const npcPayload = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body
    );
    const narratorPayload = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[1][1].body
    );

    expect(npcPayload.voice).toBe('Puck');
    expect(npcPayload.text).toBe('Nie schodź tam, bo w ciemności czeka zguba!');
    expect(npcPayload.audioDirection).toContain('whisper');

    expect(narratorPayload.voice).toBe('Kore');
    expect(narratorPayload.text).toBe('Odwraca wzrok w stronę okna.');
    expect(narratorPayload.audioDirection).not.toContain('whisper');
  });

  it('Issue #562: nie kradnie otwierającego cudzysłowu ASCII " ani tagu emocji kolejnego zdania (np. . [szept] "Kto tam jest?") i przenosi osobny wiersz [szept]\\n na następne zdanie', async () => {
    const { result } = renderHook(() => useTTS('pl'));

    act(() => {
      result.current.setVoiceEnabled(true);
      result.current.setIsTTSEnabled(true);
    });

    const asciiOpeningAfterTag =
      'Detektyw patrzy w mrok. [szept] "Kto tam jest?"';
    await act(async () => {
      result.current.addToQueue(
        asciiOpeningAfterTag,
        'msg-562-ascii-open-after-tag',
        true
      );
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const firstSentencePayload = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body
    );
    const secondSentencePayload = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[1][1].body
    );

    expect(firstSentencePayload.text).toBe('Detektyw patrzy w mrok.');
    expect(firstSentencePayload.audioDirection).not.toContain('whisper');

    expect(secondSentencePayload.text).toBe('Kto tam jest?');
    expect(secondSentencePayload.audioDirection).toContain('whisper');

    // Osobny wiersz [szept]\n po zamknięciu kwestii NPC zasila kolejne zdanie narratora
    const standaloneNewlineTag =
      'Walter Gilman: „Nie schodź tam!” [szept]\nOdwraca wzrok w stronę okna.';
    await act(async () => {
      result.current.addToQueue(
        standaloneNewlineTag,
        'msg-562-standalone-newline-tag',
        true
      );
    });

    expect(global.fetch).toHaveBeenCalledTimes(4);
    const npcPayload = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[2][1].body
    );
    const narratorPayload = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[3][1].body
    );

    expect(npcPayload.voice).toBe('Puck');
    expect(npcPayload.text).toBe('Nie schodź tam!');
    expect(npcPayload.audioDirection).not.toContain('whisper');

    expect(narratorPayload.voice).toBe('Kore');
    expect(narratorPayload.text).toBe('Odwraca wzrok w stronę okna.');
    expect(narratorPayload.audioDirection).toContain('whisper');
  });

  it('Issue #693: resetuje mówcę po kwestii NPC bez cudzysłowu dialogowego i nie rozlewa głosu ani szeptu na kolejne zdanie narracji', async () => {
    const { result } = renderHook(() => useTTS('pl'));

    act(() => {
      result.current.setVoiceEnabled(true);
      result.current.setIsTTSEnabled(true);
    });

    // Sytuacja z sesji gracza: kwestia Abigail Vance bez cudzysłowu, po której następuje opis narratora
    const text =
      'Abigail Vance: [szept] Panie Sterling, rejestry są zabezpieczone.\nZanim pada odpowiedź, mosiężny dzwonek nad drzwiami odzywa się gwałtownie.';

    await act(async () => {
      result.current.addToQueue(text, 'msg-693-unquoted-npc', true);
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const npcPayload = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body
    );
    const narratorPayload = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[1][1].body
    );

    // Kwestia Abigail Vance: głos żeński (Aoede/Leda), szept
    expect(['Aoede', 'Leda', 'Gacrux']).toContain(npcPayload.voice);
    expect(npcPayload.voice).not.toBe('Puck');
    expect(npcPayload.text).toContain(
      'Panie Sterling, rejestry są zabezpieczone.'
    );
    expect(npcPayload.audioDirection).toContain('whisper');

    // Narracja o dzwonku: głos lektora (Kore), zerowany mówca, brak szeptu
    expect(narratorPayload.voice).toBe('Kore');
    expect(narratorPayload.text).toContain(
      'Zanim pada odpowiedź, mosiężny dzwonek'
    );
    expect(narratorPayload.audioDirection).not.toContain('whisper');
  });

  it('Issue #735: poprawnie przypisuje żeński głos dla kwestii NPC oddzielonej nową linią od etykiety (np. Rosalia:\\n„...”) i nie czyta samej etykiety', async () => {
    const { result } = renderHook(() => useTTS('pl'));

    act(() => {
      result.current.setVoiceEnabled(true);
      result.current.setIsTTSEnabled(true);
    });

    const text =
      'Rosalia:\n„Czego tu po nocy szukacie? Wracajcie do swoich domów!”';

    await act(async () => {
      result.current.addToQueue(text, 'msg-735-rosalia-newline', true);
    });

    // Dokładnie 1 wywołanie TTS z kwestią Rosalii - sama etykieta "Rosalia:" nie może być czytana na głos
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body
    );

    expect(['Aoede', 'Leda', 'Gacrux']).toContain(payload.voice);
    expect(payload.voice).not.toBe('Kore');
    expect(payload.voice).not.toBe('Algenib');
    expect(payload.voice).not.toBe('Puck');
    expect(payload.text).toBe(
      'Czego tu po nocy szukacie? Wracajcie do swoich domów!'
    );
    expect(payload.audioDirection).toContain('female');
  });

  it('Issue #735: poprawnie rozpoznaje żeńską postać przy polskiej atrybucji po myślniku z żeńskim czasownikiem (– rzekła Rosalia)', async () => {
    const { result } = renderHook(() => useTTS('pl'));

    act(() => {
      result.current.setVoiceEnabled(true);
      result.current.setIsTTSEnabled(true);
    });

    const text =
      '„Kto tam stoi za drzwiami?” – rzekła Rosalia, cofając się w głąb korytarza.';

    await act(async () => {
      result.current.addToQueue(text, 'msg-735-trailing-rosalia', true);
    });

    // Powinno zakolejkować kwestię głosem Rosalii
    expect(global.fetch).toHaveBeenCalled();
    const payload = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body
    );

    expect(['Aoede', 'Leda', 'Gacrux']).toContain(payload.voice);
    expect(payload.voice).not.toBe('Puck');
    expect(payload.voice).not.toBe('Kore');
  });
  it('does not turn mentions of a church, clock and whispers into sound effects', async () => {
    const effect = jest
      .spyOn(sfxCatalog, 'playSFX')
      .mockImplementation(() => {});
    const { result } = renderHook(() => useTTS('pl'));
    try {
      await act(async () => {
        result.current.addToQueue(
          'Kościół widnieje na starej fotografii. Zegar leży w szufladzie. Helena wspomina szept z dawnego nagrania.',
          'mentioned-props',
          true
        );
      });
      await act(async () => {
        createdAudio[0]?.onplaying?.();
      });
      expect(createdAudio.length).toBeGreaterThan(0);
      expect(effect).not.toHaveBeenCalled();
    } finally {
      effect.mockRestore();
    }
  });
  it('keeps separate playback segments for two explicit cues in one narrator paragraph', async () => {
    const { result } = renderHook(() => useTTS('pl'));
    await act(async () => {
      result.current.addToQueue(
        '[SFX: paper_dossier_turn] Otwierasz teczkę na stole. [SFX: tape_mechanism] Naciskasz przycisk magnetofonu.',
        'authored-cues',
        true
      );
    });
    const texts = jest
      .mocked(fetch)
      .mock.calls.filter(([, options]) => options?.method === 'POST')
      .map(([, options]) => JSON.parse(String(options?.body)).text as string);
    expect(texts).toHaveLength(2);
    expect(texts[0]).toContain('Otwierasz teczkę');
    expect(texts[1]).toContain('Naciskasz przycisk');
  });
});
