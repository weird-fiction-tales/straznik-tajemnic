/**
 * Uniwersalny parser Server-Sent Events (SSE) dla strumieni API.
 * Eliminuje duplikację kodu parsowania SSE w hookach i komponentach.
 *
 * @module sse-parser
 */

import * as Sentry from '@sentry/nextjs';

/** Dane tekstowe ze strumienia */
export interface SSETextEvent {
  type: 'text';
  content: string;
}

/** Metadane zwracane na końcu strumienia (ilustracje, koszty, dialogi) */
export interface SSEMetadataEvent {
  type: 'metadata';
  dossierClueRecordIds?: string[];
  dossierHandoutRecordIds?: string[];
  dossierInventoryWritesAllowed?: boolean;
  illustrations?: Array<{ prompt: string; style?: string }>;
  costData?: Record<string, unknown>;
  dialogues?: Array<{ speaker: string; text: string; emotion?: string }>;
  skillResults?: Array<Record<string, unknown>>;
  skillTests?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export type SSEEvent = SSETextEvent | SSEMetadataEvent;

/** Callbacki do obsługi zdarzeń strumienia */
export interface SSECallbacks {
  /** Wywoływany przy każdym fragmencie tekstu. Otrzymuje pełny dotychczasowy tekst. */
  onText?: (fullText: string) => void;
  /** Wywoływany po odebraniu metadanych (koniec strumienia). */
  onMetadata?: (metadata: SSEMetadataEvent) => void;
  /** Wywoływany w razie błędu parsowania pojedynczego zdarzenia. */
  onParseError?: (error: Error, rawLine: string) => void;
}

/**
 * Parsuje strumień SSE z odpowiedzi fetch i wywołuje odpowiednie callbacki.
 * Zwraca pełny zebrany tekst po zakończeniu strumienia.
 *
 * @example
 * ```ts
 * const fullText = await parseSSEStream(response, {
 *   onText: (text) => setContent(text),
 *   onMetadata: (meta) => handleMetadata(meta),
 * });
 * ```
 */
export async function parseSSEStream(
  response: Response,
  callbacks: SSECallbacks = {}
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Nie udało się utworzyć czytnika strumienia.');
  }

  const decoder = new TextDecoder();
  let fullText = '';
  // Bufor przenoszący niedokończoną linię między porcjami `reader.read()`.
  // Duża linia metadanych (obrazy + skillTests + czas + dialogi) potrafi pęknąć
  // na granicy chunku TCP - bez bufora `JSON.parse` rzucał SyntaxError i metadane
  // przepadały po cichu (połykane jako "częściowy chunk"). Ten sam wzorzec co IND-256.
  let buffer = '';

  const processLine = (line: string) => {
    if (!line.startsWith('data: ')) return;

    try {
      const data = JSON.parse(line.slice(6));

      if (data.type === 'text' || typeof data.text === 'string') {
        const textContent = (data.content ?? data.text ?? '') as string;
        fullText += textContent;
        callbacks.onText?.(fullText);
      } else if (data.type === 'metadata') {
        callbacks.onMetadata?.(data as SSEMetadataEvent);
      }
    } catch (e) {
      // Częściowy chunk JSON - normalne przy strumieniowaniu
      callbacks.onParseError?.(e as Error, line);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Ostatnia pozycja to potencjalnie niedokończona linia - zachowaj na
      // następną iterację. Wszystkie wcześniejsze są kompletne.
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        processLine(line);
      }
    }

    // Flush: po zakończeniu strumienia przetwórz resztkę bufora (ostatnia linia
    // bez końcowego `\n`).
    if (buffer.length > 0) {
      processLine(buffer);
    }
  } finally {
    reader.releaseLock();
  }

  return fullText;
}

/**
 * Uproszczona wersja - zbiera tylko tekst ze strumienia SSE.
 * Przydatne gdy nie potrzebujemy callbacków w trakcie strumienia.
 *
 * @example
 * ```ts
 * const text = await collectSSEText(response);
 * const parsed = JSON.parse(text);
 * ```
 */
export async function collectSSEText(response: Response): Promise<string> {
  return parseSSEStream(response);
}

/**
 * Tworzy handler `onParseError` dla {@link parseSSEStream}, który eskaluje
 * PRAWDZIWE błędy callbacków (`onText`/`onMetadata`) do Sentry + `console.error`,
 * a pomija `SyntaxError` z niekompletnych chunków JSON (normalne przy
 * strumieniowaniu na granicy bufora).
 *
 * Defensive-in-depth po IND-256: TDZ `ReferenceError` rzucony w `onMetadata` był
 * cicho połykany przez try/catch parsera (konsument nie przekazywał
 * `onParseError`), przez co obrazy scen po prostu się nie generowały - zero
 * śladu w konsoli ani w Sentry. Ten handler sprawia, że przyszłe błędy w
 * callbackach strumienia są widoczne zamiast gubione.
 *
 * @param ctx kontekst do logu: `endpoint` API + `hook` konsumujący strumień
 */
export function createSseParseErrorHandler(ctx: {
  endpoint: string;
  hook: string;
}): (error: Error, rawLine: string) => void {
  return (error, rawLine) => {
    // Częściowy chunk JSON na granicy bufora strumienia (SyntaxError z
    // JSON.parse) to oczekiwane zachowanie - NIE eskalujemy do Sentry.
    if (error instanceof SyntaxError) return;

    const safeLine = rawLine.slice(0, 200);
    console.error(
      `[${ctx.hook}] Błąd w callbacku SSE (${ctx.endpoint}):`,
      error,
      { rawLine: safeLine }
    );
    Sentry.captureException(error, {
      tags: { feature: 'chat-sse', hook: ctx.hook },
      extra: { endpoint: ctx.endpoint, rawLine: safeLine },
    });
  };
}
