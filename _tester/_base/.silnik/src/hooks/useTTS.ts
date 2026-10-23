'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from '@/components/ui/use-toast';
import type { Message } from '@/lib/types';
import { loadAISettings, saveAISettings } from '@/lib/ai-settings';
import { settingsEmitter } from '@/lib/settings-event-emitter';

// M6 sesja 146: import DialogueLine + generateMultiVoice DROPPED per D3 (drop multi-voice).
// Sesja 147 Faza 2: multi-voice WRACA dla preset=ultra (słuchowisko radiowe).
// 2026-07-22: rozszerzone na HIGH (multi-voice NPC + parser `Imię: „dialog”`
// obok legacy `@Imię:`). MID/LOW wciąż jednym głosem narratora.
import {
  loadNpcVoiceMap,
  resolveNpcObject,
  resolveDynamicNpcVoice,
} from '@/lib/npc-voice-mapping';
import {
  buildAudioDirection,
  extractMoodFromText,
  extractSanLossFromText,
  getActiveCharacterSan,
  hasCombatOrChaseTag,
} from '@/lib/audio/sound-director';
import { SFX_PATTERNS } from '@/lib/parsers/patterns';
import { playSFX, SFX_ENABLED } from '@/lib/audio/sfx-catalog';
import { persistentMediaCache } from '@/lib/persistent-media-cache';

interface QueueItem {
  text: string;
  voiceId?: string; // override z multi-voice; undefined → settings.voiceSettings.voiceId
  audioDirection?: string; // Issue #162: instrukcja reżyserska dla Gemini TTS
  speedMultiplier?: number; // Issue #200: adaptacyjne przyspieszenie tempa akcji (np. 1.25x dla starć/pościgów)
  sfxPresetId?: string; // Wykryty efekt SFX do odtworzenia wraz z narracją
}

export interface TTSState {
  voiceEnabled: boolean;
  isGeneratingVoice: boolean;
  currentAudio: HTMLAudioElement | null;
  isNarratorOnly: boolean;
  isTTSEnabled: boolean;
  isAudioPaused: boolean;
  queueStatus: {
    queueLength: number;
    totalCharacters: number;
    processing: boolean;
  };
  isInitialBuffering: boolean;
}

export interface UseTTSReturn extends TTSState {
  setVoiceEnabled: (value: boolean) => void;
  setIsNarratorOnly: (value: boolean) => void;
  setIsTTSEnabled: (value: boolean) => void;
  generateVoiceForMessage: (
    message: Message,
    messages: Message[]
  ) => Promise<void>;
  // M6 sesja 146: generateMultiVoice DROPPED per D3.
  stopCurrentAudio: () => void;
  toggleAudioPause: () => void;
  addToQueue: (text: string, messageId?: string, flush?: boolean) => void;
  startInitialBuffering: () => void;
  waitForInitialBuffer: (timeoutMs?: number) => Promise<void>;
  /** Issue #157: Zdejmuje blokadę oczekiwania na akcept gracza i rozpoczyna odtwarzanie lektora z bufora */
  playInitialNarration?: () => void;
  /** Anuluje buforowanie i zdejmuje blokadę lektora przy błędzie lub resecie */
  cancelInitialBuffering?: () => void;
}

/**
 * Usuwa didaskalia, tagi systemowe i formatowanie z tekstu przed TTS
 */
import {
  cleanResponseText,
  stripMultilineArtifacts,
  extractEmotionTag,
} from '@/lib/parsers/text-cleaner';
import { getApiKeyHeaders, isPureTextMode } from '@/lib/api-keys-service';

/**
 * IND-196: model Gemini TTS dobierany wg ROLI mówcy, nie długości zdania.
 * Eliminuje przeskoki w obrębie jednej narracji - poprzedni auto-route per-zdanie
 * (>300 znaków, sesja 146 M1) fragmentował wypowiedź MG między modele = "dwa głosy".
 *
 * Demo HIGH 2026-06-23: narrator → Flash (był Pro). Demo gra na presecie HIGH gdzie
 * szybkość lektora ma priorytet - A/B odsłuch Charon Pro vs Flash potwierdził
 * akceptowalną barwę, a Flash ~2x szybszy (lektor rusza ~15s wcześniej). Oba modele
 * Flash = zero przeskoków (sedno IND-196 zachowane). Powrót na Pro = zmień stałą niżej.
 */
const TTS_MODEL_NARRATOR = 'gemini-3.1-flash-tts-preview';
const TTS_MODEL_NPC = 'gemini-3.1-flash-tts-preview';

/**
 * IND-191: parametry odporności kolejki TTS na rate-limit / błędy transient.
 * Kolejka jest już SEKWENCYJNA (worker `await fetch` jeden segment na raz) - to bazowy
 * throttle. Retry honorujący `Retry-After` rozkłada rate reaktywnie (po 429 czekamy
 * `retryDelay` nim ponowimy → RPM sam spada pod limit). Po 429 kolejka kończy buforowanie bez dalszych żądań przed pełnym terminem.
 */
const MAX_TTS_RETRIES = 2; // próby ponowienia segmentu (poza pierwszą)
const TRANSIENT_RETRY_WAIT_MS = 400; // backoff dla 500/503/network

/**
 * E1 (start lektora): minimalna długość wczesnego pierwszego segmentu na niskich
 * presetach. Pierwszy KOMPLETNY akapit intra to często jeden, długo rosnący akapit -
 * bez wczesnego startu audio rusza dopiero po flush (~koniec streamu, odczuwalna luka
 * ~1,5 min). Gdy pierwszy akapit ma już >= tylu znaków kompletnych zdań, oddajemy je
 * do TTS od razu (audio rusza w trakcie streamu). Mały próg = krótkie pierwsze audio
 * szybko; reszta akapitu dociąga normalnym batchem (spójna prozodia dalej).
 * Próg ~jedno krótkie zdanie - chroni przed mikro-blipem audio ("Wchodzisz.").
 */
const EARLY_FIRST_SEGMENT_MIN_CHARS = 25;

/**
 * Issue #142: buforowanie lektora przy starcie przygody.
 * Zbuforowanie 3 segmentów (lub wszystkich przy krótkim intro) gwarantuje
 * ciągłość lektora przed wejściem gracza do sceny, eliminując przerwę po 1. zdaniu.
 */
const INITIAL_BUFFER_TARGET_SEGMENTS = 3;
const STREAMING_SEGMENT_TARGET_CHARS = 100;

/**
 * IND-191: fetch TTS z ponowieniem. Zwraca `audioUrl` albo `null` (segment niemy -
 * świadoma degradacja zamiast bezpowrotnej utraty audio bez próby ratunku).
 *
 * - 429 → honoruj `Retry-After` → zatrzymaj syntezę kolejki do pełnego terminu.
 * - !ok (500/503) → krótki backoff → ponów.
 * - network throw → backoff → ponów.
 * - sukces → `result.success && result.audioUrl`.
 *
 * Czysta (poza hookiem) - worker ma deps `[]`, więc parametry przez stałe modułowe.
 */
/**
 * Zwalnia deterministycznie zasoby elementu HTMLAudioElement (pause, src = '', load).
 */
export function releaseAudioElement(audio: HTMLAudioElement | null): void {
  if (!audio) return;
  try {
    audio.onended = null;
    audio.onerror = null;
    audio.onplay = null;
    audio.onpause = null;
    audio.pause();
    audio.src = '';
    audio.load();
  } catch {
    // Graceful degradation w środowiskach bez pełnej implementacji Audio (jsdom)
  }
}

/**
 * IND-191: fetch TTS z ponowieniem. Zwraca `audioUrl` albo `null` (segment niemy -
 * świadoma degradacja zamiast bezpowrotnej utraty audio bez próby ratunku).
 *
 * - 429 → honoruj `Retry-After` → zatrzymaj syntezę kolejki do pełnego terminu.
 * - !ok (500/503) → krótki backoff → ponów.
 * - network throw → backoff → ponów.
 * - sukces → `result.success && result.audioUrl`.
 *
 * Czysta (poza hookiem) - worker ma deps `[]`, więc parametry przez stałe modułowe.
 */
async function fetchTtsWithRetry(
  url: string,
  payload: Record<string, unknown>,
  options?: {
    signal?: AbortSignal;
    onRateLimited?: (retryAfterSec: number) => void;
  }
): Promise<{ audioUrl: string; provider: string; voice?: string } | null> {
  const { signal, onRateLimited } = options || {};
  for (let attempt = 0; attempt <= MAX_TTS_RETRIES; attempt++) {
    if (signal?.aborted) return null;
    try {
      const response = await fetch(url, {
        method: 'POST',
        // IND-206 BYOK: dołącz klucz Gemini testera (X-Gemini-Api-Key z localStorage).
        // Bez tego /api/tts/gemini zwraca 401 po przejściu na header-only (Faza A).
        headers: { 'Content-Type': 'application/json', ...getApiKeyHeaders() },
        body: JSON.stringify(payload),
        signal,
      });

      if (signal?.aborted) return null;

      // A quota applies to the whole queue, not just this segment.
      if (response.status === 429) {
        const header = response.headers?.get?.('Retry-After') || '';
        const seconds = Number(header);
        const retryAfter = header && Number.isFinite(seconds)
          ? seconds : Math.max(0, (Date.parse(header) - Date.now()) / 1000);
        onRateLimited?.(Number.isFinite(retryAfter) ? Math.max(1, retryAfter) : 30);
        return null;
      }

      // Inny błąd HTTP (500/503): krótki backoff i ponów.
      if (response.ok === false) {
        // Issue #544: Jeśli błąd dotyczy braku audio w odpowiedzi (text-instead-of-audio / isTtsNoAudio),
        // nie wykonuj seryjnych ponowień klienta, które drenują limit 15 RPM.
        let isNoAudioErr = false;
        try {
          const errData = await response.clone().json();
          if (errData?.retryable === false) {
            onRateLimited?.(30);
            return null;
          }
          if (
            errData?.details?.includes('inlineData') ||
            errData?.details?.includes('text-instead-of-audio') ||
            errData?.error?.includes('Brak danych audio')
          ) {
            isNoAudioErr = true;
          }
        } catch {
          // ignore
        }
        if (isNoAudioErr) {
          console.warn('⚠️ TTS: Gemini zwrócił brak inlineData audio. Pomijam retry (ochrona 15 RPM).');
          return null;
        }

        if (attempt < MAX_TTS_RETRIES) {
          await new Promise((r) => {
            let onAbort: (() => void) | undefined;
            const timer = setTimeout(() => {
              if (signal && onAbort) signal.removeEventListener('abort', onAbort);
              r(null);
            }, TRANSIENT_RETRY_WAIT_MS);
            if (signal) {
              onAbort = () => {
                clearTimeout(timer);
                r(null);
              };
              signal.addEventListener('abort', onAbort, { once: true });
            }
          });
          if (signal?.aborted) return null;
          continue;
        }
        console.warn(
          `⚠️ TTS: błąd HTTP ${response.status}. Pomiń segment.`
        );
        return null;
      }

      const result = await response.json();
      if (result.success && typeof result.audioUrl === 'string') return {
        audioUrl: result.audioUrl,
        provider: ['macos-zosia', 'macos-samantha'].includes(result.provider) ? result.provider : 'gemini',
        voice: typeof result.voice === 'string' ? result.voice : undefined,
      };
      return null;
    } catch (e: unknown) {
      if (signal?.aborted || (e instanceof Error && e.name === 'AbortError')) {
        return null;
      }
      if (attempt < MAX_TTS_RETRIES) {
        await new Promise((r) => {
          let onAbort: (() => void) | undefined;
          const timer = setTimeout(() => {
            if (signal && onAbort) signal.removeEventListener('abort', onAbort);
            r(null);
          }, TRANSIENT_RETRY_WAIT_MS);
          if (signal) {
            onAbort = () => {
              clearTimeout(timer);
              r(null);
            };
            signal.addEventListener('abort', onAbort, { once: true });
          }
        });
        if (signal?.aborted) return null;
        continue;
      }
      console.warn('🔇 TTS: błąd sieci - segment pominięty', e);
      return null;
    }
  }
  return null;
}

/**
 * Usuwa didaskalia, tagi systemowe i formatowanie z tekstu przed TTS
 * @deprecated Use cleanResponseText from parsers/text-cleaner instead
 */
export function removeDidaskalia(text: string): string {
  return cleanResponseText(text);
}

/**
 * Oczyszcza tekst i wycina wszelkie pozostałe znaczniki [...] oraz nawiasy kwadratowe
 * przed wysyłką do bufora audio TTS (Issue #544 + Issue #562).
 */
function cleanForTtsBuffer(text: string): string {
  return cleanResponseText(text)
    .replace(/\[[\s\S]*?\]/g, '')
    .replace(/[\[\]]/g, '')
    .trim();
}

/**
 * Systemowe wykrywanie znaku zamykającego wypowiedź postaci (Issue #737).
 * Obsługuje hierarchię typograficzną: cudzysłowy dialogowe („...”, "...", “...”, «...»)
 * oraz zagnieżdżone cytaty/tytuły wewnątrz kwestii (»The Boston Globe«, 'cytat'),
 * zapobiegając ucinaniu głosu NPC i fałszywemu przełączaniu na lektora w połowie zdania.
 */
export function findDialogueClosingQuote(
  text: string,
  openedWith?: string
): { index: number; closingChar: string } | null {
  if (!text) return null;

  // Jeśli brak otwierającego cudzysłowu dla wypowiedzi postaci, nie szukamy sztucznego zamknięcia wewnątrz zdania
  // (np. tytuł w »The Boston Globe« nie powinien zamykać wypowiedzi)
  if (!openedWith) {
    return null;
  }

  // Określ docelowy znak zamykający na podstawie znaku otwierającego
  let targetClosingChars: string[];
  if (openedWith === '„' || openedWith === '“') {
    targetClosingChars = ['”', '"'];
  } else if (openedWith === '"') {
    targetClosingChars = ['"', '”'];
  } else if (openedWith === '«') {
    targetClosingChars = ['»'];
  } else if (openedWith === '»') {
    targetClosingChars = ['«', '»'];
  } else {
    targetClosingChars = ['”', '"', '»'];
  }

  // Skanujemy tekst ze śledzeniem zagnieżdżonych cudzysłowów (np. »...« wewnątrz „...”)
  let nestedGuillemetOpen = false;
  let nestedSingleQuoteOpen = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // Obsługa zagnieżdżonych ostrokątnych »...« lub «...» wewnątrz cudzysłowu głównego
    if (openedWith !== '«' && openedWith !== '»') {
      if (char === '»' || char === '«') {
        nestedGuillemetOpen = !nestedGuillemetOpen;
        continue;
      }
      if (char === "'" || char === '‘' || char === '’') {
        nestedSingleQuoteOpen = !nestedSingleQuoteOpen;
        continue;
      }
    }

    // Jeśli jesteśmy wewnątrz zagnieżdżonego cudzysłowu (np. tytuł gazety), ignorujemy
    if (nestedGuillemetOpen) {
      continue;
    }

    if (targetClosingChars.includes(char)) {
      return { index: i, closingChar: char };
    }
  }

  return null;
}

export function useTTS(locale: 'pl' | 'en' = 'pl'): UseTTSReturn {
  const t = useTranslations('TTSSettings');
  const blockedUntilRef = useRef(0);
  const providerRef = useRef<{ provider: string; voice?: string } | null>(null);
  const localNoticeRef = useRef('');
  const quotaNoticeRef = useRef(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [currentAudio, setCurrentAudioState] = useState<HTMLAudioElement | null>(
    null
  );
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const setCurrentAudio = useCallback((audio: HTMLAudioElement | null) => {
    currentAudioRef.current = audio;
    setCurrentAudioState(audio);
  }, []);
  const [isTTSEnabled, setIsTTSEnabled] = useState(true);
  const [isAudioPaused, setIsAudioPaused] = useState(false);
  const [isInitialBuffering, setIsInitialBuffering] = useState(false);
  // Reaktywny stan isNarratorOnly (Issue #172: przełącznik trybu lektora / słuchowiska)
  const [isNarratorOnly, setIsNarratorOnlyState] = useState(() => {
    if (typeof window !== 'undefined') {
      return loadAISettings().voiceSettings?.narratorOnly ?? false;
    }
    return false;
  });

  useEffect(() => {
    const unsubscribe = settingsEmitter.subscribe((newSettings) => {
      if (newSettings?.voiceSettings?.narratorOnly !== undefined) {
        setIsNarratorOnlyState(!!newSettings.voiceSettings.narratorOnly);
      }
    });
    return unsubscribe;
  }, []);

  const setIsNarratorOnly = useCallback((value: boolean) => {
    setIsNarratorOnlyState(value);
    const current = loadAISettings();
    saveAISettings({
      ...current,
      voiceSettings: {
        ...current.voiceSettings,
        narratorOnly: value,
      },
    });
  }, []);

  const [queueStatus, setQueueStatus] = useState({
    queueLength: 0,
    totalCharacters: 0,
    processing: false,
  });

  // Refs do zarządzania kolejkowaniem i wyścigami asynchronicznymi
  const generationIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentPlayResolverRef = useRef<(() => void) | null>(null);
  const isFreeTierThrottledRef = useRef(false);
  const throttledUntilRef = useRef<number>(0);

  const queueRef = useRef<string[]>([]);
  // Faza 2 sesji 147: queue trzyma `{text, voiceId?}` zamiast string.
  // voiceId override pochodzi z multi-voice parser (ULTRA preset).
  // undefined → worker używa settings.voiceSettings.voiceId (current single-voice flow).
  const pendingQueueRef = useRef<QueueItem[]>([]);
  // Wartość null = TOMBSTONE: segment wyczerpał retry (500/429 → audioUrl null).
  // Player rozróżnia "brak wpisu" (undefined, czekaj) od tombstone (null, pomiń),
  // by nie blokować się na zawsze na nieudanym segmencie (urwanie lektora).
  const preloadedAudioRef = useRef<Map<number, HTMLAudioElement | null>>(
    new Map()
  );
  const sfxQueueRef = useRef<Map<number, string>>(new Map());
  const isProcessingQueueRef = useRef(false);
  const isPlayingQueueRef = useRef(false);
  const currentMessageIdRef = useRef<string | null>(null);
  const rawProcessedPosRef = useRef(0); // IND-193: ostatnia długość raw (early-return skip)
  const processedSentenceCountRef = useRef(0); // IND-193: liczba zakolejkowanych pełnych zdań
  const processingIndexRef = useRef(0); // Indeks aktualnie przetwarzanego zdania w ramach wiadomości
  // IND-193 guard: pojedyncze flush per messageId. generateVoiceForMessage woła
  // addToQueue(content, id, true) na koniec każdej odpowiedzi - bez tej flagi
  // dwukrotne wywołanie zduplikowałoby resztkę bez terminatora (warunek flush
  // przelicza lastEnd/stripped od zera). Reset przy zmianie messageId i stopie.
  const flushedRef = useRef(false);
  // IND-200: idempotentny guard per-message. Po pełnym flush wiadomość jest
  // "zamknięta" - kolejne addToQueue dla tego samego id (spóźniony streaming async
  // lub ponowny finalize) wraca natychmiast, eliminując re-kolejkowanie całości
  // (objaw: lektor czytał narrację 2×). Komplementarny do flushedRef. Czyszczony
  // w stopCurrentAudio (wołanym też przy ID-change → nowa wiadomość startuje świeżo).
  const completedMessageIdsRef = useRef<Set<string>>(new Set());
  // Dynamiczny cache głosów i reżyserii NPC w trakcie sesji (gwarantuje spójność wokalną postaci)
  const dynamicNpcVoiceMapRef = useRef<Map<string, { voiceId: string; audioDirection: string }>>(new Map());
  // Śledzi aktywnego mówcę NPC w obrębie bieżącej linii dialogowej (Issue #172: wielozdaniowe wypowiedzi postaci)
  const activeNpcSpeakerRef = useRef<string | null>(null);
  // Śledzi znak otwierający aktywny dialog (Issue #737: hierarchia cytatów wewnętrznych)
  const activeDialogueOpenedQuoteCharRef = useRef<string | null>(null);
  // Pozycja końca ostatnio przetworzonego zdania w stripped dla bieżącej wiadomości (Issue #172)
  const prevSentenceEndRef = useRef(0);
  // demo 2026-06-22: ULTRA scala kolejne zdania o tym SAMYM voiceId w jeden segment TTS
  // (jeden spójny głos zamiast resetu prozodii per zdanie - objaw "lektor brzmi jak 3 osoby").
  // Run trzymany MIĘDZY wywołaniami addToQueue (streaming), zamykany przy zmianie mówcy lub
  // flush. Reset przy ID-change, by nie przeciekał między wiadomościami.
  const openRunRef = useRef<{
    voiceId: string | undefined;
    audioDirection?: string;
    sfxPresetId?: string;
    texts: string[];
  } | null>(null);
  // E1 (start lektora): liczba znaków PIERWSZEGO akapitu już oddanych do TTS "na
  // wcześnie" - zanim akapit się domknął (`\n\n`). Na niskich presetach (LOW/MID/HIGH)
  // intro to często jeden, długo rosnący akapit; bez tego pierwsze audio czekałoby do
  // flush (~koniec streamu). Wcześnie wypychamy KOMPLETNE zdania pierwszego akapitu, a
  // pętla akapitów docina już wypowiedzianą część (slice o tę liczbę). Reset przy
  // ID-change/stop (jak openRunRef), by nie przeciekał między wiadomościami.
  const earlySpokenCharsRef = useRef(0);
  const hasDispatchedFirstSegmentRef = useRef(false);
  const isInitialBufferingRef = useRef(false);
  // Issue #157: Bramka CTA - lektor zbuforowany, ale czeka na kliknięcie gracza
  const isAwaitingInitialPlayRef = useRef(false);
  const initialBufferResolversRef = useRef<(() => void)[]>([]);
  const finishInitialBufferingRef = useRef<() => void>(() => {});
  const bufferTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKnownMoodRef = useRef<string | undefined>(undefined);
  const lastKnownSanLossRef = useRef<number | undefined>(undefined);
  const lastKnownCombatTagRef = useRef<boolean>(false);
  const pendingStandaloneMoodRef = useRef<string | undefined>(undefined);

  const stopCurrentAudio = useCallback(
    (preserveBuffering = false) => {
      console.log('🔊 TTS: STOP called. Resetting state.');
      generationIdRef.current++;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      if (currentPlayResolverRef.current) {
        currentPlayResolverRef.current();
        currentPlayResolverRef.current = null;
      }

      if (currentAudioRef.current) {
        releaseAudioElement(currentAudioRef.current);
        currentAudioRef.current = null;
        setCurrentAudioState(null);
      }
      // Zatrzymaj i zwolnij wszystkie prekładowane audio
      preloadedAudioRef.current.forEach((audio) => {
        if (!audio) return; // tombstone (null) - brak audio do zatrzymania
        releaseAudioElement(audio);
      });
      preloadedAudioRef.current.clear();
      queueRef.current = [];
      pendingQueueRef.current = [];
      isProcessingQueueRef.current = false;
      isPlayingQueueRef.current = false;
      currentMessageIdRef.current = null;
      rawProcessedPosRef.current = 0;
      processedSentenceCountRef.current = 0;
      processingIndexRef.current = 0;
      playbackIndexRef.current = 0; // IND-204: bez tego po Stop bez ID-change worker generuje od 0, a player czeka na ostatni N → cisza
      flushedRef.current = false;
      openRunRef.current = null; // demo 2026-06-22: nie przenoś niedokończonego runu narratora między wiadomościami
      activeNpcSpeakerRef.current = null; // Issue #172: wyczyść aktywnego mówcę dialogu przy stopie
      prevSentenceEndRef.current = 0; // Issue #172: wyzeruj kursor zdań w stripped
      earlySpokenCharsRef.current = 0; // E1: świeży kursor wczesnego startu dla nowej wiadomości
      hasDispatchedFirstSegmentRef.current = false;
      completedMessageIdsRef.current.clear(); // IND-200
      lastKnownSanLossRef.current = undefined;
      lastKnownCombatTagRef.current = false;
      pendingStandaloneMoodRef.current = undefined;

      if (!preserveBuffering) {
        if (bufferTimeoutRef.current) {
          clearTimeout(bufferTimeoutRef.current);
          bufferTimeoutRef.current = null;
        }
        if (initialBufferResolversRef.current.length > 0) {
          const resolvers = [...initialBufferResolversRef.current];
          initialBufferResolversRef.current = [];
          resolvers.forEach((resolve) => resolve());
        }
        isInitialBufferingRef.current = false;
        // Issue #157: Nie resetuj isAwaitingInitialPlayRef.current tutaj!
        // Bramka oczekiwania na akcept gracza (CTA) jest znoszona wyłącznie przez
        // playInitialNarration() po kliknięciu lub jawne cancelInitialBuffering().
        setIsInitialBuffering(false);
      }

      setIsAudioPaused(false);
      setQueueStatus({ queueLength: 0, totalCharacters: 0, processing: false });
    },
    []
  );

  useEffect(() => {
    console.log('🔊 TTS: Hook MOUNTED');
    return () => {
      console.log('🔊 TTS: Hook UNMOUNTED');
      stopCurrentAudio();
    };
  }, [stopCurrentAudio]);

  // Reaktywne wyciszenie przy wyłączeniu lektora w runtime
  useEffect(() => {
    if (!voiceEnabled || !isTTSEnabled) {
      stopCurrentAudio();
    }
  }, [voiceEnabled, isTTSEnabled, stopCurrentAudio]);

  // Zatrzymanie lektora narracji, gdy gracz odtwarza diegetyczny handout audio (Issue #703 / Q6)
  useEffect(() => {
    const handlePauseTTS = () => {
      console.log('🔇 [TTS] Zatrzymano narrację MG na rzecz odtwarzanego handoutu audio');
      stopCurrentAudio();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('straznik:pause-tts', handlePauseTTS);
      return () => {
        window.removeEventListener('straznik:pause-tts', handlePauseTTS);
      };
    }
  }, [stopCurrentAudio]);

  const toggleAudioPause = useCallback(() => {
    const audio = currentAudioRef.current;
    if (audio) {
      if (audio.paused) {
        audio.play().catch(console.error);
        setIsAudioPaused(false);
      } else {
        audio.pause();
        setIsAudioPaused(true);
      }
    }
  }, []);

  useEffect(() => {
    providerRef.current = null;
    stopCurrentAudio();
  }, [locale, stopCurrentAudio]);

  // Worker przetwarzający kolejkę
  const runQueueWorker = useCallback(async () => {
    if (isProcessingQueueRef.current) return;
    isProcessingQueueRef.current = true;
    const currentSettings = loadAISettings();

    try {
      // Resolve the provider before cache lookup, including after a locale change.
      if (!providerRef.current && (isPureTextMode() || persistentMediaCache.isAvailable())) {
        if (Date.now() < blockedUntilRef.current) {
          pendingQueueRef.current = [];
          finishInitialBufferingRef.current();
          return;
        }
        const generation = generationIdRef.current;
        if (!abortControllerRef.current || abortControllerRef.current.signal.aborted) abortControllerRef.current = new AbortController();
        const controller = abortControllerRef.current;
        const timeout = setTimeout(() => controller.abort(), 10000);
        try {
          const response = await fetch(`/api/tts/gemini?languageCode=${locale === 'en' ? 'en-US' : 'pl-PL'}`, { method: 'GET', signal: controller.signal });
          if (generation !== generationIdRef.current) return;
          if (!response.ok) throw new Error('TTS_CAPABILITIES_UNAVAILABLE');
          const profile = await response.json();
          if (generation !== generationIdRef.current) return;
          providerRef.current = {
            provider: ['macos-zosia', 'macos-samantha'].includes(profile.provider) ? profile.provider : 'gemini',
            voice: profile.voice,
          };
        } catch {
          if (generation !== generationIdRef.current) return;
          blockedUntilRef.current = Date.now() + 30000;
          pendingQueueRef.current = [];
          finishInitialBufferingRef.current();
          if (!quotaNoticeRef.current) {
            quotaNoticeRef.current = true;
            toast({ title: t('unavailableNotice') });
          }
          return;
        } finally { clearTimeout(timeout); }
      }
      if (isPureTextMode() && !providerRef.current?.provider.startsWith('macos-')) {
        pendingQueueRef.current = [];
        finishInitialBufferingRef.current();
        return;
      }
      while (pendingQueueRef.current.length > 0) {
        const currentGen = generationIdRef.current;
        // Przenieś z pending do głównej kolejki przetwarzania
        const item = pendingQueueRef.current.shift();
        if (!item) continue;
        const { text, voiceId: overrideVoiceId, audioDirection, speedMultiplier, sfxPresetId } = item;
        if (!text) continue;

        const index = processingIndexRef.current++;
        console.log(
          `🔊 TTS Worker: Processing segment ${index}${overrideVoiceId ? ` [voice=${overrideVoiceId}]` : ''}: "${text.substring(0, 30)}..."`
        );
        setIsGeneratingVoice(true);

        try {
          let audioUrl: string | null = null;
          // Faza 2 sesji 147: voiceId z multi-voice parsera ma priorytet nad settings.
          const effectiveVoice =
            overrideVoiceId || currentSettings.voiceSettings?.voiceId || 'Sadaltager';

          // Gemini TTS: wyłączny silnik audio (offline-first / BYOK)
          const geminiModel = overrideVoiceId
            ? TTS_MODEL_NPC
            : TTS_MODEL_NARRATOR;
          // Issue #78: Sprawdź pamięć podręczną IndexedDB przed wywołaniem API sieciowego
          let profile = providerRef.current || { provider: 'gemini', voice: effectiveVoice };
          const cacheVoice = () => profile.provider === 'gemini' ? effectiveVoice : profile.voice || effectiveVoice;
          const cacheKey = () => persistentMediaCache.generateTtsCacheKey(
            text,
            `${profile.provider}_${profile.provider === 'gemini' ? geminiModel : ''}_${cacheVoice()}_${locale}_${profile.provider === 'gemini' ? audioDirection || '' : ''}`
          );
          let ttsCacheKey = cacheKey();

          if (persistentMediaCache.isAvailable()) {
            try {
              audioUrl = await persistentMediaCache.getTtsAudio(ttsCacheKey);
              if (audioUrl) {
                console.log(`⚡ TTS Worker: Cache HIT dla segmentu ${index}`);
              }
            } catch {
              audioUrl = null;
            }
          }

          if (generationIdRef.current !== currentGen) {
            console.log(`🔊 TTS Worker: Segment ${index} unieważniony (stara generacja)`);
            break;
          }

          if (!audioUrl && Date.now() >= blockedUntilRef.current) {
            if (!abortControllerRef.current || abortControllerRef.current.signal.aborted) {
              abortControllerRef.current = new AbortController();
            }
            const signal = abortControllerRef.current.signal;

            // IND-191: fetch z retry (429 honoruje Retry-After, transient backoff).
            // Issue #162 + #200: przekazujemy audioDirection jako instrukcję reżyserską dla Gemini TTS
            const generated = await fetchTtsWithRetry(
              '/api/tts/gemini',
              {
                text,
                voice: effectiveVoice,
                model: geminiModel,
                languageCode: locale === 'en' ? 'en-US' : 'pl-PL',
                audioDirection,
              },
              {
                signal,
                onRateLimited: (retryAfterSec) => {
                  blockedUntilRef.current = Date.now() + retryAfterSec * 1000;
                  if (!quotaNoticeRef.current) {
                    quotaNoticeRef.current = true;
                    toast({ title: t('unavailableNotice') });
                  }
                  if (retryAfterSec > 10) {
                    console.warn(
                      `⚠️ [TTS] Wykryto rate-limit 429 z Retry-After=${retryAfterSec}s > 10s. Aktywacja bezpiecznika 15 RPM (agregacja akapitowa).`
                    );
                    isFreeTierThrottledRef.current = true;
                    throttledUntilRef.current =
                      Date.now() + Math.max(retryAfterSec, 30) * 1000;
                  }
                },
              }
            );

            audioUrl = generated?.audioUrl || null;
            if (generated) {
              profile = { provider: generated.provider, voice: generated.voice || effectiveVoice };
              providerRef.current = profile;
              ttsCacheKey = cacheKey();
            }

            if (generationIdRef.current !== currentGen || signal.aborted) {
              console.log(`🔊 TTS Worker: Segment ${index} odrzucony po fetch (stara generacja lub anulowano)`);
              break;
            }

            if (audioUrl && persistentMediaCache.isAvailable()) {
              persistentMediaCache
                .setTtsAudio(ttsCacheKey, audioUrl, {
                  text,
                  voiceId: cacheVoice(),
                  languageCode: locale === 'en' ? 'en-US' : 'pl-PL',
                })
                .catch(() => {});
            }
          }

          if (generationIdRef.current !== currentGen) {
            break;
          }

          if (audioUrl) {
            if (profile.provider.startsWith('macos-') && localNoticeRef.current !== profile.provider) {
              localNoticeRef.current = profile.provider;
              toast({ title: t('localVoiceNotice', { voice: profile.voice || (locale === 'en' ? 'Samantha' : 'Zosia') }) });
            }
            const audio = new Audio(audioUrl);
            audio.volume = (currentSettings.voiceSettings?.volume || 75) / 100;
            const baseSpeed = currentSettings.voiceSettings?.speed || 0.92;
            audio.playbackRate = baseSpeed;
            if ('preservesPitch' in audio) {
              (audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
            }
            preloadedAudioRef.current.set(index, audio);
            if (sfxPresetId) {
              sfxQueueRef.current.set(index, sfxPresetId);
            }
            console.log(`✅ TTS Worker: Ready segment ${index} (speed=${baseSpeed.toFixed(2)}x)`);

            if (isInitialBufferingRef.current) {
              const bufferedCount = preloadedAudioRef.current.size;
              const isTargetReached =
                bufferedCount >= INITIAL_BUFFER_TARGET_SEGMENTS;
              const isQueueDepleted =
                flushedRef.current && pendingQueueRef.current.length === 0;

              if (isTargetReached || isQueueDepleted) {
                console.log(
                  `✅ TTS: Initial buffer filled (${bufferedCount} segments). Unlocking playback.`
                );
                finishInitialBufferingRef.current();
              }
            } else if (!isAwaitingInitialPlayRef.current) {
              // Spróbuj odtworzyć (jeśli to pierwszy segment lub poprzednie się skończyły)
              playFromBuffer();
            }
          } else {
            // Segment wyczerpał retry (500/429 → fetchTtsWithRetry zwrócił null).
            // Zapisz TOMBSTONE (null), by player pominął ten indeks zamiast czekać
            // na zawsze - inaczej cała reszta narracji nie zostanie odtworzona.
            console.warn(
              `🔇 TTS Worker: segment ${index} nieudany (null) - tombstone, player pomija`
            );
            preloadedAudioRef.current.set(index, null);

            if (isInitialBufferingRef.current) {
              const bufferedCount = preloadedAudioRef.current.size;
              const isTargetReached =
                bufferedCount >= INITIAL_BUFFER_TARGET_SEGMENTS;
              const isQueueDepleted =
                flushedRef.current && pendingQueueRef.current.length === 0;

              if (isTargetReached || isQueueDepleted) {
                finishInitialBufferingRef.current();
              }
            } else if (!isAwaitingInitialPlayRef.current) {
              playFromBuffer();
            }
          }
        } catch (e) {
          console.error(`❌ TTS Worker: Failed segment ${index}`, e);
          if (isInitialBufferingRef.current) {
            const bufferedCount = preloadedAudioRef.current.size;
            const isQueueDepleted =
              flushedRef.current && pendingQueueRef.current.length === 0;
            if (
              bufferedCount >= INITIAL_BUFFER_TARGET_SEGMENTS ||
              isQueueDepleted
            ) {
              finishInitialBufferingRef.current();
            }
          }
        }
      }
    } finally {
      isProcessingQueueRef.current = false;
      setIsGeneratingVoice(false);

      // Jeśli w międzyczasie coś doszło, uruchom ponownie
      if (pendingQueueRef.current.length > 0) {
        runQueueWorker();
      } else if (isInitialBufferingRef.current && flushedRef.current) {
        finishInitialBufferingRef.current();
      }
    }
  }, [locale, t]);

  const playbackIndexRef = useRef(0);

  // Odtwarzaj audio z bufora bez opóźnień
  const playFromBuffer = useCallback(async () => {
    if (
      isPlayingQueueRef.current ||
      isInitialBufferingRef.current ||
      isAwaitingInitialPlayRef.current
    )
      return;
    isPlayingQueueRef.current = true;
    const currentGen = generationIdRef.current;

    try {
      while (true) {
        if (isAwaitingInitialPlayRef.current || generationIdRef.current !== currentGen) {
          console.log(
            '🔇 TTS Player: Awaiting initial play or aborted. Halting playback.'
          );
          break;
        }

        const currentIndex = playbackIndexRef.current;
        const hasEntry = preloadedAudioRef.current.has(currentIndex);
        const audio = preloadedAudioRef.current.get(currentIndex);

        // TOMBSTONE: wpis istnieje, ale audio === null (segment nieudany). Pomiń ten
        // indeks i przejdź do następnego, zamiast blokować się na brakującym audio.
        if (hasEntry && audio == null) {
          preloadedAudioRef.current.delete(currentIndex);
          playbackIndexRef.current++;
          continue;
        }

        if (!audio) {
          // Brak WPISU dla tego indeksu (jeszcze niegotowy) - jeśli worker skończył
          // i nie ma tego w pending, to koniec. Inaczej worker wciąż nad tym pracuje.
          if (
            !isProcessingQueueRef.current &&
            pendingQueueRef.current.length === 0 &&
            !preloadedAudioRef.current.has(currentIndex)
          ) {
            break; // Koniec wszystkiego
          }

          // Czekamy na worker
          await new Promise((r) => setTimeout(r, 100));
          if (generationIdRef.current !== currentGen) break;
          continue;
        }

        if (isAwaitingInitialPlayRef.current || generationIdRef.current !== currentGen) {
          break;
        }

        console.log(`▶️ TTS Player: Playing segment ${currentIndex}`);
        const currentSettings = loadAISettings();
        if (!audio.playbackRate || audio.playbackRate === 1) {
          const currentSpeed = currentSettings.voiceSettings?.speed || 0.92;
          audio.playbackRate = currentSpeed;
        }
        if ('preservesPitch' in audio) {
          (audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
        }
        // SFX trigger dla bieżącego segmentu lektora (Issue #504: wyłączone)
        const sfxId = sfxQueueRef.current.get(currentIndex);
        if (sfxId) {
          sfxQueueRef.current.delete(currentIndex);
          if (SFX_ENABLED) {
            playSFX(sfxId);
          }
        }
        setCurrentAudio(audio);

        await new Promise<void>((resolve) => {
          let resolved = false;
          const safeResolve = () => {
            if (resolved) return;
            resolved = true;
            currentPlayResolverRef.current = null;
            resolve();
          };
          currentPlayResolverRef.current = safeResolve;
          audio.onended = safeResolve;
          audio.onerror = safeResolve;
          audio.play().catch(safeResolve);
        });

        // Jeśli odtwarzanie zostało przerwane (nowa akcja gracza / zmiana generacji),
        // nie modyfikuj playbackIndexRef ani preloadedAudioRef nowego pokolenia
        if (generationIdRef.current !== currentGen) {
          releaseAudioElement(audio);
          break;
        }

        // Posprzątaj bieżący audio po odtworzeniu
        releaseAudioElement(audio);
        if (currentAudioRef.current === audio) {
          setCurrentAudio(null);
        }

        preloadedAudioRef.current.delete(currentIndex);
        playbackIndexRef.current++;
      }
    } finally {
      if (generationIdRef.current === currentGen) {
        isPlayingQueueRef.current = false;
        if (currentAudioRef.current) {
          releaseAudioElement(currentAudioRef.current);
          setCurrentAudio(null);
        }
      }
      console.log('🏁 TTS Player: Sequence finished');
    }
  }, [setCurrentAudio]);

  const finishInitialBuffering = useCallback(() => {
    if (bufferTimeoutRef.current) {
      clearTimeout(bufferTimeoutRef.current);
      bufferTimeoutRef.current = null;
    }
    isInitialBufferingRef.current = false;
    setIsInitialBuffering(false);
    if (initialBufferResolversRef.current.length > 0) {
      const resolvers = [...initialBufferResolversRef.current];
      initialBufferResolversRef.current = [];
      resolvers.forEach((resolve) => resolve());
    }
    // Issue #157: Nie odtwarzaj automatycznie, jeśli trwa oczekiwanie na akcept gracza (bramka CTA)
    if (!isAwaitingInitialPlayRef.current) {
      playFromBuffer();
    }
  }, [playFromBuffer]);

  finishInitialBufferingRef.current = finishInitialBuffering;

  const addToQueue = useCallback(
    (fullRawText: string, messageId?: string, flush: boolean = false) => {
      if (!voiceEnabled || !isTTSEnabled || !fullRawText) return;

      // Jeśli to zupełnie nowa wiadomość (inny ID), zresetuj postęp i audio
      if (messageId && currentMessageIdRef.current !== messageId) {
        console.log(
          `🔊 TTS ID Change: ${currentMessageIdRef.current} -> ${messageId}`
        );
        stopCurrentAudio(isInitialBufferingRef.current);
        currentMessageIdRef.current = messageId;
        rawProcessedPosRef.current = 0;
        processedSentenceCountRef.current = 0;
        processingIndexRef.current = 0;
        playbackIndexRef.current = 0;
        flushedRef.current = false;
        openRunRef.current = null; // demo 2026-06-22: nowy run scalania od zera dla nowej wiadomości
        activeNpcSpeakerRef.current = null; // Issue #172: wyczyść aktywnego mówcę dialogu dla nowej wiadomości
        prevSentenceEndRef.current = 0; // Issue #172: wyzeruj kursor zdań w stripped dla nowej wiadomości
        earlySpokenCharsRef.current = 0; // E1: nowy kursor wczesnego startu dla nowej wiadomości
        hasDispatchedFirstSegmentRef.current = false;
        pendingStandaloneMoodRef.current = undefined;
      }

      // IND-200: wiadomość już w pełni zakolejkowana (po flush). Spóźniony streaming
      // lub ponowny finalize dla tego samego id → return (bez re-kolejkowania całości).
      // PO ID-change check: nowy id resetuje przez stopCurrentAudio (clear Setu).
      if (messageId && completedMessageIdsRef.current.has(messageId)) {
        return;
      }

      // Jeśli ID jest to samo, a tekst się nie wydłużył - nic nie rób (chyba że flush)
      if (fullRawText.length <= rawProcessedPosRef.current && !flush) {
        return;
      }
      rawProcessedPosRef.current = fullRawText.length;

      if (flush) {
        console.log(
          `🔊 TTS FLUSH for ID: ${messageId}. Raw text length: ${fullRawText.length}`
        );
      }

      // Ekstrakcja nastroju, strat SAN oraz tagów walki/pościgu ze strumienia odpowiedzi MG
      const moodInChunk = extractMoodFromText(fullRawText);
      if (moodInChunk) {
        lastKnownMoodRef.current = moodInChunk;
      }
      const sanLossInChunk = extractSanLossFromText(fullRawText);
      if (sanLossInChunk) {
        lastKnownSanLossRef.current = sanLossInChunk;
      }
      if (hasCombatOrChaseTag(fullRawText)) {
        lastKnownCombatTagRef.current = true;
      }
      const currentMood = lastKnownMoodRef.current;
      const currentSanLoss = lastKnownSanLossRef.current;
      const currentHasCombat = lastKnownCombatTagRef.current;

      // IND-193 (A'): usuń bloki WIELOLINIOWE (tagi/JSON/fence/DZIENNIK) ZACHOWUJĄC `\n`,
      // utnij niezamknięty blok z ogona (streaming), DOPIERO POTEM tnij na zdania i czyść
      // per-zdanie. Bloki nie są już rozcinane na fragmenty, więc nie przeżywają w audio.
      // `\n` zachowany → split jak dotąd → multi-voice marker @Imię: działa.
      // Issue #562: zachowaj tagi emocji ([whispers], [szept], [panika] itp.) na etapie stripMultilineArtifacts,
      // aby per-zdanie extractEmotionTag(raw) mógł odczytać emocję przed twardym wycięciem [...] w cleanResponseText.
      let stripped = stripMultilineArtifacts(fullRawText, {
        preserveEmotionTags: true,
      });
      // Issue #551: Odcięcie niedomkniętych bloków code fences, nawiasów tagów oraz nagłówków GM Protocol z końca strumienia
      stripped = stripped.replace(/```[^`]*$/g, '');
      const hasUnclosedTrailingBracket = !flush && /\[[^\]]*$/.test(stripped);
      stripped = stripped
        .replace(/\[[^\]]*$/, '')
        .replace(/\{[^}]*$/, '')
        .replace(/(?:^|\n)\s*(?:MYŚLI_MG|MYSLI_MG|THOUGHTS|CEL_NARRACYJNY|NARRATIVE_GOAL|NASTRÓJ|NASTROJ|MOOD|REŻYSER_SCENY|SCENE_DIRECTOR|TECHNIKA_MG|MG_TECHNIQUE|RAPORT_AKTU|ACT_REPORT)\s*:[^\n]*$/gi, '');

      // Issue #735: Połączenie etykiety mówcy NPC z następującą po nowej linii kwestią dialogową
      // np. "Rosalia:\n„Czego tu...”" -> "Rosalia: „Czego tu...”"
      stripped = stripped.replace(
        /(^|\n)\s*[*_]*([A-ZŁŻŚĆŃÓĄĘ][\wŁżśćńóąęŻŚĆŃÓĄĘłż ]+?)[*_]*\s*:\s*\n+\s*([„"«—–-])/g,
        '$1$2: $3'
      );
      stripped = stripped.replace(
        /(^|\n)\s*[*_]*([A-ZŁŻŚĆŃÓĄĘ][\wŁżśćńóąęŻŚĆŃÓĄĘłż ]{2,30})[*_]*\s*\n+\s*([„"«])/g,
        '$1$2: $3'
      );

      // Issue #735: Normalizacja polskiego stylu dialogu z atrybucją po myślniku do formatu mówcy:
      // np. „Kto tam stoi?” – rzekła Rosalia, cofając się... -> Rosalia: „Kto tam stoi?”, cofając się...
      const SPEECH_VERBS =
        'mówi|rzekł|rzekła|odparł|odparła|krzyknął|krzyknęła|szepnął|szepnęła|pyta|pytała|zapytał|zapytała|powiedział|powiedziała|zawołał|zawołała|dodał|dodała|warknął|warknęła|syknął|syknęła|jęknął|jęknęła|pisnął|pisnęła|fuknął|fuknęła|westchnął|westchnęła|mruknął|mruknęła';
      stripped = stripped.replace(
        new RegExp(
          `(^|\\n)\\s*([„"«][^"”»\\n]+[”"»])\\s*[—–-]\\s*(?:${SPEECH_VERBS})\\s+([A-ZŁŻŚĆŃÓĄĘ][\\wŁżśćńóąęŻŚĆŃÓĄĘłż ]+?)(?=[,.;!?:\\s—–-]|$)`,
          'gi'
        ),
        '$1$3: $2'
      );

      // IND-211: kolejkujemy w JEDNOSTKACH. MID/LOW → cały AKAPIT jednym wywołaniem
      // TTS - model widzi pełny kontekst akapitu, więc prozodia jest spójna.
      // HIGH i ULTRA → per-zdanie z parserem mówców (multi-voice NPC). Marker
      // `Imię: „dialog”` i legacy `@Imię:` rozdziela mówców. Preset jest stały w
      // obrębie wiadomości, więc processedSentenceCountRef liczy spójnie.
      const settingsForQueue = loadAISettings();
      const isUltraOrHigh =
        settingsForQueue.qualityPreset === 'ultra' ||
        settingsForQueue.qualityPreset === 'high';

      const pendingItems: QueueItem[] = [];

      if (isUltraOrHigh) {
        // --- HIGH/ULTRA: per-zdanie + multi-voice marker @Imię: / Imię: „dialog” ---
        interface SentenceItem {
          raw: string;
          clean: string;
          startIndex: number;
          endIndex: number;
        }

        const rawSentences: SentenceItem[] = [];
        let lastEnd = 0;
        // Issue #172 + Issue #562: sentenceRegex wchłania terminatory [.!?] wraz z opcjonalnymi tagami [...]
        // przed cudzysłowami zamykającymi oraz \n, zapobiegając ucinaniu cudzysłowów i tagów emocji w osobne tokeny,
        // ale nie kradnąc otwierającego cudzysłowu ASCII " kolejnego zdania (np. `. [szept] "Kto tam?"`).
        const sentenceRegex =
          /[^.!?\n]+(?:[.!?]+(?:(?:\s*\[[^\].!?\n]+\])+\s*(?:[”»]+|["']+(?=\s|[,.;:!?—–-]|$))["”'»\s]*|(?:["”'»]+|\s+[”»]+)*\s*)|[\n]+)/g;
        let match;
        while ((match = sentenceRegex.exec(stripped)) !== null) {
          const raw = match[0];
          const startIndex = match.index;
          const endIndex = startIndex + raw.length;
          const clean = removeDidaskalia(raw).trim();
          rawSentences.push({
            raw,
            clean,
            startIndex,
            endIndex,
          });
          lastEnd = endIndex;
        }

        // Nowe pełne zdania ponad już zakolejkowane (append-only → prefiks stabilny).
        const newSentences: SentenceItem[] = [];
        for (
          let i = processedSentenceCountRef.current;
          i < rawSentences.length;
          i++
        ) {
          const item = rawSentences[i];
          if (
            (item.clean && /[\p{L}\p{N}]/u.test(item.clean)) ||
            extractEmotionTag(item.raw)
          ) {
            newSentences.push(item);
          }
        }
        processedSentenceCountRef.current = rawSentences.length;

        // flush: resztka po ostatnim pełnym zdaniu (bez terminatora kończącego).
        if (flush && !flushedRef.current) {
          flushedRef.current = true;
          if (lastEnd < stripped.length) {
            const rawRemainder = stripped.slice(lastEnd);
            const cleanRemainder = removeDidaskalia(rawRemainder).trim();
            if (
              (cleanRemainder && /[\p{L}\p{N}]/u.test(cleanRemainder)) ||
              extractEmotionTag(rawRemainder)
            ) {
              newSentences.push({
                raw: rawRemainder,
                clean: cleanRemainder,
                startIndex: lastEnd,
                endIndex: stripped.length,
              });
            }
          }
        }

        const npcVoiceMap = loadNpcVoiceMap();
        const { san, maxSan } = getActiveCharacterSan();

        const resolveNpcSegmentVoice = (
          npcName: string,
          segmentMoodDirection?: string
        ): { voiceId: string; audioDirection: string } => {
          const npcObj = resolveNpcObject(npcName);
          const dynamicVoice = resolveDynamicNpcVoice(
            npcName,
            npcVoiceMap,
            dynamicNpcVoiceMapRef.current,
            {
              occupation: npcObj?.occupation,
              description: npcObj?.description,
              personality: npcObj?.personality,
              type: npcObj?.type,
              mood: currentMood,
            }
          );
          return {
            voiceId: dynamicVoice.voiceId,
            audioDirection: segmentMoodDirection
              ? dynamicVoice.audioDirection
                ? `${dynamicVoice.audioDirection} ${segmentMoodDirection}`
                : segmentMoodDirection
              : dynamicVoice.audioDirection,
          };
        };

        // demo 2026-06-22: scalamy kolejne zdania o tym SAMYM voiceId i audioDirection w jeden segment
        // TTS = jeden spójny głos (koniec resetu prozodii per zdanie). Run trzymany w
        // openRunRef MIĘDZY wywołaniami (streaming), zamykany przy zmianie mówcy / flush.
        const closeRun = () => {
          const run = openRunRef.current;
          if (run && run.texts.length > 0) {
            // Issue #505: brak sztucznego przyspieszania HTML5 playbackRate - tempo moduluje wyłącznie prompt audio
            const speedMultiplier = 1.0;
            pendingItems.push({
              text: run.texts.join(' '),
              voiceId: run.voiceId,
              audioDirection: run.audioDirection,
              speedMultiplier,
              sfxPresetId: run.sfxPresetId,
            });
          }
          openRunRef.current = null;
        };

        const processBetweenGap = (
          between: string,
          isCurrentlyThrottled: boolean
        ) => {
          if (!between) return;
          const quoteMatchInBetween = between.match(/[”"»]/);
          const beforeQuote =
            quoteMatchInBetween && quoteMatchInBetween.index !== undefined
              ? between.slice(0, quoteMatchInBetween.index)
              : between;
          const betweenEmotion =
            extractEmotionTag(beforeQuote)?.audioDirection;
          if (betweenEmotion && openRunRef.current) {
            const currentDir = openRunRef.current.audioDirection || '';
            if (!currentDir.includes(betweenEmotion)) {
              openRunRef.current.audioDirection = currentDir
                ? `${currentDir} ${betweenEmotion}`
                : betweenEmotion;
            }
          }
          if (between.includes('\n') || /[”"»]/.test(between)) {
            activeNpcSpeakerRef.current = null;
            if (isCurrentlyThrottled && between.includes('\n')) {
              closeRun();
            }
          }
        };

        if (newSentences.length === 0 && lastEnd > prevSentenceEndRef.current) {
          const isCurrentlyThrottled =
            isFreeTierThrottledRef.current &&
            Date.now() < throttledUntilRef.current;
          processBetweenGap(
            stripped.slice(prevSentenceEndRef.current, lastEnd),
            isCurrentlyThrottled
          );
          prevSentenceEndRef.current = lastEnd;
        }

        for (const sentenceItem of newSentences) {
          const { raw, clean, startIndex, endIndex } = sentenceItem;
          // Detekcja SFX dla bieżącego zdania: najpierw jawny tag [SFX: id], potem wzorce słowne
          let sentenceSfxId: string | undefined;
          const explicitSfxMatch = raw.match(/\[(?:SFX|DŹWIĘK|DZWIEK):\s*([a-zA-Z0-9_-]+)\]/i);
          if (explicitSfxMatch) {
            sentenceSfxId = explicitSfxMatch[1].toLowerCase();
          } else {
            for (const sfxEntry of SFX_PATTERNS) {
              const rx = new RegExp(sfxEntry.pattern.source, sfxEntry.pattern.flags);
              if (rx.test(clean)) {
                sentenceSfxId = sfxEntry.presetId;
                break;
              }
            }
          }

          // Issue #544: Cooldown dla dławienia 15 RPM (automatyczny powrót po upływie okna)
          const isCurrentlyThrottled =
            isFreeTierThrottledRef.current &&
            Date.now() < throttledUntilRef.current;
          if (
            isFreeTierThrottledRef.current &&
            Date.now() >= throttledUntilRef.current
          ) {
            isFreeTierThrottledRef.current = false;
          }

          // Issue #172 + Issue #562: Jeśli pomiędzy poprzednim przetworzonym zdaniem a bieżącym nastąpił
          // znak nowej linii, zamknięcie cudzysłowu lub domknięty w kolejnym chunku tag emocji.
          const between = stripped.slice(prevSentenceEndRef.current, startIndex);
          processBetweenGap(between, isCurrentlyThrottled);

          // Marker: legacy `@Imię: dialog` lub `Imię: „dialog”` (gm-protocol).
          // trimStart() bo sentence regex może zwrócić zdanie z wiodącą spacją.
          // cleanResponseText kasuje „” przed regexem - cytaty tu nie są potrzebne.
          // Wymagamy wielkiej litery na początku imienia (anty-false-match: 1920s:, próg: itp).
          let markerMatch = clean
            .trimStart()
            .match(
              /^(@)?([A-ZŁŻŚĆŃÓĄĘ][\wŁżśćńóąęŻŚĆŃÓĄĘłż ]+?):\s*([\s\S]*?)$/
            );
          let isTrailingSpeakerAttribution = false;

          // Alternatywna detekcja dla polskiego stylu dialogu: „kwestia” – mówi Imię / – kwestia – rzekł/rzekła Imię
          if (!markerMatch) {
            const trailingSpeakerMatch = raw.match(
              /(?:^|[\s—–-])[„"«—–-]([^"”»—–-]+)[”"»—–-]?\s*[—–-]\s*(?:mówi|rzekł|rzekła|odparł|odparła|krzyknął|krzyknęła|szepnął|szepnęła|pyta|pytała|zapytał|zapytała|powiedział|powiedziała|zawołał|zawołała|dodał|dodała|warknął|warknęła|syknął|syknęła|jęknął|jęknęła|pisnął|pisnęła|fuknął|fuknęła|westchnął|westchnęła|mruknął|mruknęła)\s+([A-ZŁŻŚĆŃÓĄĘ][\wŁżśćńóąęŻŚĆŃÓĄĘłż ]+)/i
            );
            if (trailingSpeakerMatch) {
              isTrailingSpeakerAttribution = true;
              markerMatch = [
                raw,
                '',
                trailingSpeakerMatch[2].trim(),
                trailingSpeakerMatch[1].trim(),
              ] as unknown as RegExpMatchArray;
            }
          }

          // Filtr prefiksów technicznych NPC (Raport policji:, Wskazówka:, Uwaga:)
          const TECHNICAL_NPC_PREFIXES =
            /^(?:Raport policji|Wskazówka|Wskazowka|Uwaga|Notatka|System|Komentarz|Status|Wskazówki|Wskazowki)\b/i;
          if (markerMatch && TECHNICAL_NPC_PREFIXES.test(markerMatch[2].trim())) {
            markerMatch = null;
            isTrailingSpeakerAttribution = false;
          }

          let voiceId: string | undefined;
          let audioDirection: string | undefined;
          let textForQueue = clean;
          let shouldResetNpcAfterSentence = false;
          let inlineNarratorTail = '';
          let inlineNarratorMoodDirection: string | undefined;
          let hasExplicitInsideQuoteOverride = false;

          const isNarratorOnlyMode =
            isNarratorOnly || !!settingsForQueue.voiceSettings?.narratorOnly;

          // Issue #544 + Issue #562: Ekstrakcja nastroju/emocji z surowego tekstu przed czyszczeniem
          const priorPendingMood = pendingStandaloneMoodRef.current;
          pendingStandaloneMoodRef.current = undefined;
          let emotionMood = extractEmotionTag(raw);
          let moodDirection = emotionMood?.audioDirection || priorPendingMood;

          if (
            (markerMatch || activeNpcSpeakerRef.current) &&
            !isNarratorOnlyMode
          ) {
            if (isTrailingSpeakerAttribution) {
              shouldResetNpcAfterSentence = true;
            } else {
              // Issue #562: Wykryj znak zamykający cudzysłów dialogowy (”, ", ») po otwarciu kwestii.
              // Pozwala to utrzymać głos NPC przez wielozdaniowy dialog wewnątrz „...”, ale natychmiast
              // zresetować mówcę na zamknięciu cudzysłowu oraz oddzielić ewentualną prozę narratora w tej samej linii.
              let rawSpokenBody = raw;
              let rawPrefixBeforeBody = '';
              let hasOpeningQuoteInMarker = false;
              if (markerMatch) {
                const speakerPrefixMatch = raw.match(
                  /^(?:[\s*_-]*\[[^\]]*\][\s*_-]*)*\s*@?[A-ZŁŻŚĆŃÓĄĘ][\wŁżśćńóąęŻŚĆŃÓĄĘłż ]+?:/
                );
                if (speakerPrefixMatch) {
                  const prefixEndIdx = speakerPrefixMatch[0].length;
                  rawPrefixBeforeBody = raw.slice(0, prefixEndIdx);
                  rawSpokenBody = raw.slice(prefixEndIdx);
                } else {
                  const colonIdx = raw.indexOf(':');
                  rawPrefixBeforeBody =
                    colonIdx !== -1 ? raw.slice(0, colonIdx + 1) : '';
                  rawSpokenBody =
                    colonIdx !== -1 ? raw.slice(colonIdx + 1) : raw;
                }
                let openedWithQuoteChar: string | undefined;
                const openQuoteMatch = rawSpokenBody.match(
                  /^(?:[\s*_-]*\[[^\]]*\][\s*_-]*)*\s*([„"“«»])\s*/
                );
                if (openQuoteMatch) {
                  hasOpeningQuoteInMarker = true;
                  openedWithQuoteChar = openQuoteMatch[1];
                  activeDialogueOpenedQuoteCharRef.current = openedWithQuoteChar;
                  rawPrefixBeforeBody += openQuoteMatch[0];
                  rawSpokenBody = rawSpokenBody.slice(openQuoteMatch[0].length);
                } else if (!markerMatch && activeDialogueOpenedQuoteCharRef.current) {
                  openedWithQuoteChar = activeDialogueOpenedQuoteCharRef.current;
                }
              }
              const closingQuoteMatch = findDialogueClosingQuote(
                rawSpokenBody,
                markerMatch ? (hasOpeningQuoteInMarker ? (activeDialogueOpenedQuoteCharRef.current || '„') : undefined) : (activeDialogueOpenedQuoteCharRef.current || '„')
              );
              if (closingQuoteMatch && closingQuoteMatch.index !== undefined) {
                shouldResetNpcAfterSentence = true;
                activeDialogueOpenedQuoteCharRef.current = null;
                const rawInsideQuote = rawSpokenBody.slice(
                  0,
                  closingQuoteMatch.index
                );
                const rawAfterQuote = rawSpokenBody.slice(
                  closingQuoteMatch.index + 1
                );
                emotionMood = extractEmotionTag(
                  `${rawPrefixBeforeBody}${rawInsideQuote}`
                );
                moodDirection =
                  emotionMood?.audioDirection || priorPendingMood;
                inlineNarratorMoodDirection =
                  extractEmotionTag(rawAfterQuote)?.audioDirection;
                const cleanAfterQuote = cleanForTtsBuffer(rawAfterQuote)
                  .replace(/^[\s,.;:–—-]+/, '')
                  .trim();
                if (
                  cleanAfterQuote &&
                  /[\p{L}\p{N}]/u.test(cleanAfterQuote)
                ) {
                  inlineNarratorTail = cleanAfterQuote;
                  hasExplicitInsideQuoteOverride = true;
                  const cleanInsideQuote = cleanForTtsBuffer(rawInsideQuote);
                  const hasInsideWords = /[\p{L}\p{N}]/u.test(cleanInsideQuote);
                  if (markerMatch) {
                    markerMatch[3] = hasInsideWords ? cleanInsideQuote : '';
                  } else {
                    textForQueue = hasInsideWords ? cleanInsideQuote : '';
                  }
                }
              } else if (markerMatch && !hasOpeningQuoteInMarker) {
                // Bezpiecznik Issue #693: jeśli kwestia 'Imię: Dialog' nie została objęta cudzysłowem dialogowym,
                // zresetuj mówcę natychmiast po tym zdaniu, aby kolejne zdania narracji nie wyciekały głosem NPC.
                shouldResetNpcAfterSentence = true;
              }
            }
          }

          if (markerMatch && !isNarratorOnlyMode) {
            const npcName = markerMatch[2].trim();
            activeNpcSpeakerRef.current = npcName;
            ({ voiceId, audioDirection } = resolveNpcSegmentVoice(
              npcName,
              moodDirection
            ));
            textForQueue = hasExplicitInsideQuoteOverride
              ? markerMatch[3].trim()
              : (markerMatch[3] !== undefined && markerMatch[3] !== null)
              ? markerMatch[3].trim()
              : clean;
          } else if (activeNpcSpeakerRef.current && !isNarratorOnlyMode) {
            // Issue #172: Kontynuacja dialogu tej samej postaci w obrębie tej samej linii/akapitu
            ({ voiceId, audioDirection } = resolveNpcSegmentVoice(
              activeNpcSpeakerRef.current,
              moodDirection
            ));
          } else {
            // Kwestia Narratora (lub wymuszony tryb Audiobook / narratorOnly) - modulacja SAN i nastrojem
            voiceId = settingsForQueue.voiceSettings?.voiceId || 'Kore';
            textForQueue = markerMatch ? markerMatch[3].trim() || clean : clean;
            const narratorBaseDirection = buildAudioDirection({
              isNpc: false,
              san,
              maxSan,
              mood: currentMood,
              recentSanLoss: currentSanLoss,
              sentenceText: textForQueue,
              hasActiveCombat: currentHasCombat,
            });
            audioDirection = moodDirection
              ? `${narratorBaseDirection} ${moodDirection}`
              : narratorBaseDirection;
          }

          // Issue #544 + Issue #562: Twardy filtr usuwający wszelkie [...] przed wysyłką tekstu do bufora audio
          textForQueue = cleanForTtsBuffer(textForQueue);
          const hasSpokenWords =
            !!textForQueue && /[\p{L}\p{N}]/u.test(textForQueue);
          if (!hasSpokenWords && moodDirection) {
            if (
              shouldResetNpcAfterSentence &&
              openRunRef.current &&
              openRunRef.current.voiceId === voiceId
            ) {
              const currentDir = openRunRef.current.audioDirection || '';
              if (!currentDir.includes(moodDirection)) {
                openRunRef.current.audioDirection = currentDir
                  ? `${currentDir} ${moodDirection}`
                  : moodDirection;
              }
            } else {
              pendingStandaloneMoodRef.current = moodDirection;
            }
          }
          if (!hasSpokenWords && !inlineNarratorTail) {
            const isBareSpeakerLabel = !!markerMatch && !markerMatch[3].trim();
            if (!isBareSpeakerLabel && (shouldResetNpcAfterSentence || raw.includes('\n'))) {
              activeNpcSpeakerRef.current = null;
            }
            prevSentenceEndRef.current = endIndex;
            continue;
          }

          if (hasSpokenWords) {
            // Zmiana mówcy lub zmiana dyrektywy zamyka bieżący run; ten sam voiceId + direction
            // dokleja się do otwartego runu = jedno wywołanie TTS.
            if (
              openRunRef.current &&
              (openRunRef.current.voiceId !== voiceId ||
                openRunRef.current.audioDirection !== audioDirection)
            ) {
              closeRun();
            }
            if (!openRunRef.current) {
              openRunRef.current = {
                voiceId,
                audioDirection,
                texts: [],
                sfxPresetId: sentenceSfxId,
              };
            }
            openRunRef.current.texts.push(textForQueue);
          }

          // Issue #562: Jeśli po zamknięciu cudzysłowu w tym samym zdaniu nastąpiła narracja,
          // zamknij run NPC i dodaj ogon narracyjny głosem lektora.
          if (inlineNarratorTail) {
            closeRun();
            activeNpcSpeakerRef.current = null;
            const narratorVoiceId =
              settingsForQueue.voiceSettings?.voiceId || 'Kore';
            const narratorTailBaseDirection = buildAudioDirection({
              isNpc: false,
              san,
              maxSan,
              mood: currentMood,
              recentSanLoss: currentSanLoss,
              sentenceText: inlineNarratorTail,
              hasActiveCombat: currentHasCombat,
            });
            const narratorTailDirection = inlineNarratorMoodDirection
              ? `${narratorTailBaseDirection} ${inlineNarratorMoodDirection}`
              : narratorTailBaseDirection;
            openRunRef.current = {
              voiceId: narratorVoiceId,
              audioDirection: narratorTailDirection,
              texts: [inlineNarratorTail],
              sfxPresetId: !hasSpokenWords ? sentenceSfxId : undefined,
            };
          }

          // E1 / IND-104 + Issue #142 (Streaming audio chunks):
          // Pierwsze zdanie narracji wypychamy wcześnie (>= EARLY_FIRST_SEGMENT_MIN_CHARS).
          // Kolejne segmenty zamykamy sukcesywnie po osiągnięciu >= STREAMING_SEGMENT_TARGET_CHARS,
          // dzięki czemu worker TTS generuje kolejne zdania w tle podczas pisania tekstu przez AI.
          // Bezpiecznik 15 RPM (Decyzja 2A): przy dławieniu scalaj zdania w pełne akapity (zamykaj na \n)
          const isLastSentenceWithUnclosedBracket =
            hasUnclosedTrailingBracket && endIndex === stripped.length;
          if (
            !flush &&
            openRunRef.current &&
            !isLastSentenceWithUnclosedBracket
          ) {
            if (!isCurrentlyThrottled) {
              const currentRunLength = openRunRef.current.texts.join(' ').length;
              const threshold = !hasDispatchedFirstSegmentRef.current
                ? EARLY_FIRST_SEGMENT_MIN_CHARS
                : STREAMING_SEGMENT_TARGET_CHARS;

              if (currentRunLength >= threshold) {
                closeRun();
                hasDispatchedFirstSegmentRef.current = true;
              }
            } else {
              // Bezpiecznik 15 RPM: zamykaj run dopiero na granicy akapitu (\n)
              if (raw.includes('\n')) {
                closeRun();
              }
            }
          }

          // Issue #172 + Issue #562: Zresetuj mówcę NPC natychmiast po znaku zamykającym cudzysłów (”, ", ») lub nowej linii (\n)
          if (shouldResetNpcAfterSentence || raw.includes('\n')) {
            activeNpcSpeakerRef.current = null;
          }
          prevSentenceEndRef.current = endIndex;
        }

        // flush domyka ostatni (otwarty) run - resztę narracji oddajemy jako jeden segment.
        if (flush) {
          closeRun();
        }
      } else {
        // --- MID/LOW: batch po AKAPICIE (spójna prozodia narratora, jeden głos) ---
        // Akapit jest "kompletny" gdy NIE jest ostatni (po nim w streamie pojawił się
        // już `\n\n`) albo przy flush (koniec wiadomości). Ostatni akapit czeka na
        // kolejny `\n\n` lub flush, więc trafia do TTS w całości = jeden spójny głos.
        // Brak `\n\n` w narracji → cała wypowiedź to jeden akapit (maksymalna spójność,
        // odtwarzana po flush). processedSentenceCountRef = liczba zakolejkowanych akapitów.
        const paragraphs = stripped.split(/\n{2,}/);
        const { san, maxSan } = getActiveCharacterSan();
        const narratorAudioDirection = buildAudioDirection({
          isNpc: false,
          san,
          maxSan,
          mood: currentMood,
          recentSanLoss: currentSanLoss,
          hasActiveCombat: currentHasCombat,
        });

        // E1 (start lektora): zanim akapity się domkną, oddaj wcześnie KOMPLETNE zdania
        // pierwszego (jeszcze rosnącego) akapitu - audio rusza w trakcie streamu zamiast
        // dopiero po flush. Tylko gdy: nie ma jeszcze żadnego skompletowanego akapitu w
        // kolejce (processedSentenceCountRef===0), nie flush, i akapit 0 jest wciąż
        // ostatnim (paragraphs.length===1). Wypychamy NOWE pełne zdania ponad już
        // wypowiedziane (earlySpokenCharsRef), gdy ich łączna długość >= progu.
        // IND-196 ujednolicił model+głos narratora (zero "dwóch głosów"), więc cięcie na
        // zdania w pierwszym akapicie kosztuje co najwyżej drobną gładkość na złączeniu.
        if (
          !flush &&
          paragraphs.length === 1 &&
          processedSentenceCountRef.current === 0
        ) {
          const firstPara = paragraphs[0];
          // Koniec ostatniego pełnego zdania lub klauzuli pierwszego akapitu (terminator . ! ? , : ;).
          const sentenceEndRegex = /[.!?,:;](?=\s|$)/g;
          let lastSentenceEnd = 0;
          let m;
          while ((m = sentenceEndRegex.exec(firstPara)) !== null) {
            lastSentenceEnd = m.index + 1;
          }
          if (lastSentenceEnd > earlySpokenCharsRef.current) {
            const newSpan = firstPara.slice(
              earlySpokenCharsRef.current,
              lastSentenceEnd
            );
            const spanEmotionDirection = extractEmotionTag(newSpan)?.audioDirection;
            const cleanSpan = cleanForTtsBuffer(newSpan);
            // Pierwszy segment musi mieć sensowną długość (próg), kolejne wczesne
            // segmenty domykają zdania bez limitu (płynna kontynuacja audio).
            const isFirstEarly = earlySpokenCharsRef.current === 0;
            const longEnough =
              !isFirstEarly ||
              cleanSpan.length >= EARLY_FIRST_SEGMENT_MIN_CHARS;
            if (cleanSpan && /[\p{L}\p{N}]/u.test(cleanSpan) && longEnough) {
              pendingItems.push({
                text: cleanSpan,
                audioDirection: spanEmotionDirection
                  ? `${narratorAudioDirection} ${spanEmotionDirection}`
                  : narratorAudioDirection,
              });
              earlySpokenCharsRef.current = lastSentenceEnd;
            }
          }
        }

        const completeCount = flush
          ? paragraphs.length
          : Math.max(0, paragraphs.length - 1);
        // Issue #505: brak sztucznego przyspieszania HTML5 playbackRate
        const paragraphSpeedMultiplier = 1.0;

        for (
          let i = processedSentenceCountRef.current;
          i < completeCount;
          i++
        ) {
          // E1: akapit 0 mógł mieć już część zdań wypowiedzianych wcześnie - dotnij ją,
          // by nie czytać 2× (slice o earlySpokenCharsRef). Pozostałe akapity bez zmian.
          const rawParagraph =
            i === 0 && earlySpokenCharsRef.current > 0
              ? paragraphs[0].slice(earlySpokenCharsRef.current)
              : paragraphs[i];
          const paraEmotionDirection = extractEmotionTag(rawParagraph)?.audioDirection;
          const cleanParagraph = cleanForTtsBuffer(rawParagraph);
          let paraSfxId: string | undefined;
          const explicitParaSfxMatch = rawParagraph.match(/\[(?:SFX|DŹWIĘK|DZWIEK):\s*([a-zA-Z0-9_-]+)\]/i);
          if (explicitParaSfxMatch) {
            paraSfxId = explicitParaSfxMatch[1].toLowerCase();
          } else {
            for (const sfxEntry of SFX_PATTERNS) {
              const rx = new RegExp(sfxEntry.pattern.source, sfxEntry.pattern.flags);
              if (rx.test(cleanParagraph)) {
                paraSfxId = sfxEntry.presetId;
                break;
              }
            }
          }
          if (cleanParagraph && /[\p{L}\p{N}]/u.test(cleanParagraph)) {
            const paragraphBaseDirection = buildAudioDirection({
              isNpc: false,
              san,
              maxSan,
              mood: currentMood,
              recentSanLoss: currentSanLoss,
              sentenceText: cleanParagraph,
              hasActiveCombat: currentHasCombat,
            });
            const paragraphAudioDirection = paraEmotionDirection
              ? `${paragraphBaseDirection} ${paraEmotionDirection}`
              : paragraphBaseDirection;
            pendingItems.push({
              text: cleanParagraph,
              audioDirection: paragraphAudioDirection,
              speedMultiplier: paragraphSpeedMultiplier,
              sfxPresetId: paraSfxId,
            });
          }
        }
        processedSentenceCountRef.current = completeCount;
        if (flush) flushedRef.current = true;
      }

      if (pendingItems.length > 0) {
        pendingQueueRef.current.push(...pendingItems);

        // Uruchom worker jeśli nie działa
        runQueueWorker();

        // Uruchom odtwarzacz jeśli nie działa (i mamy coś w buforze, worker to obsłuży)
        if (
          preloadedAudioRef.current.size > 0 &&
          !isPlayingQueueRef.current &&
          !isInitialBufferingRef.current &&
          !isAwaitingInitialPlayRef.current
        ) {
          playFromBuffer();
        }
      }

      // IND-200: flush zamyka wiadomość → oznacz ukończoną (idempotencja per-message).
      // Poza if(pendingItems) - zamykamy nawet gdy nowych jednostek już nie było.
      if (flush && messageId) {
        completedMessageIdsRef.current.add(messageId);
      }
    },
    [
      voiceEnabled,
      isTTSEnabled,
      stopCurrentAudio,
      runQueueWorker,
      playFromBuffer,
    ]
  );

  const startInitialBuffering = useCallback(() => {
    if (!voiceEnabled || !isTTSEnabled) {
      setIsInitialBuffering(false);
      isInitialBufferingRef.current = false;
      isAwaitingInitialPlayRef.current = false;
      return;
    }
    isInitialBufferingRef.current = true;
    isAwaitingInitialPlayRef.current = true;
    setIsInitialBuffering(true);
    if (bufferTimeoutRef.current) {
      clearTimeout(bufferTimeoutRef.current);
    }
    // Timeout bezpieczeństwa na wypadek absolutnej awarii API lub wycieku pętli powtórzeń (cap na retryDelay)
    bufferTimeoutRef.current = setTimeout(() => {
      if (isInitialBufferingRef.current) {
        console.warn('🔇 TTS: Timeout buforowania. Zrzucam Hard-loading screen.');
        finishInitialBufferingRef.current();
      }
    }, 15000);
  }, [voiceEnabled, isTTSEnabled]);

  const waitForInitialBuffer = useCallback(
    (timeoutMs = 8000): Promise<void> => {
      if (!voiceEnabled || !isTTSEnabled || !isInitialBufferingRef.current) {
        return Promise.resolve();
      }
      // Jeśli mamy już przynajmniej 1 gotowy segment i kolejka została wyczerpana po flush:
      if (
        preloadedAudioRef.current.size >= 1 &&
        pendingQueueRef.current.length === 0 &&
        flushedRef.current
      ) {
        finishInitialBufferingRef.current();
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        let timer: ReturnType<typeof setTimeout> | null = null;
        const onResolve = () => {
          if (timer) clearTimeout(timer);
          resolve();
        };
        timer = setTimeout(() => {
          console.warn('🔇 TTS: waitForInitialBuffer timeout osiągnięty.');
          finishInitialBufferingRef.current();
          resolve();
        }, timeoutMs);
        initialBufferResolversRef.current.push(onResolve);
      });
    },
    [voiceEnabled, isTTSEnabled]
  );

  /**
   * Issue #157: Zdejmuje blokadę oczekiwania na akcept gracza i natychmiast
   * rozpoczyna odtwarzanie przygotowanego audio lektora z bufora.
   */
  const playInitialNarration = useCallback(() => {
    console.log('▶️ TTS: playInitialNarration called after CTA click.');
    isAwaitingInitialPlayRef.current = false;
    playFromBuffer();
  }, [playFromBuffer]);

  /**
   * Anuluje buforowanie i zdejmuje blokadę lektora przy błędzie lub resecie.
   */
  const cancelInitialBuffering = useCallback(() => {
    isInitialBufferingRef.current = false;
    isAwaitingInitialPlayRef.current = false;
    setIsInitialBuffering(false);
    if (bufferTimeoutRef.current) {
      clearTimeout(bufferTimeoutRef.current);
      bufferTimeoutRef.current = null;
    }
    initialBufferResolversRef.current = [];
  }, []);

  const generateVoiceForMessage = useCallback(
    async (message: Message) => {
      if (!voiceEnabled || !isTTSEnabled || message.role !== 'assistant')
        return;
      addToQueue(message.content, message.id, true);
    },
    [voiceEnabled, isTTSEnabled, addToQueue]
  );

  // M6 sesja 146: drop generateMultiVoice (martwy kod, wywoływany z useGameStart
  // przed D3 z sesji 145). Czysty interfejs 1:1 z architekturą useChat/useTTS.
  // NPC dialogi idą sekwencyjnie przez generateVoiceForMessage (parser cleanResponseText
  // złoży scenę w jednolity tekst). NPC voice auto-mapping per role - follow-up ticket.

  return {
    voiceEnabled,
    isGeneratingVoice,
    currentAudio,
    isTTSEnabled,
    isAudioPaused,
    queueStatus,
    isNarratorOnly,
    setVoiceEnabled,
    setIsTTSEnabled,
    setIsNarratorOnly,
    generateVoiceForMessage,
    stopCurrentAudio,
    toggleAudioPause,
    addToQueue,
    isInitialBuffering,
    startInitialBuffering,
    waitForInitialBuffer,
    playInitialNarration,
    cancelInitialBuffering,
  };
}
