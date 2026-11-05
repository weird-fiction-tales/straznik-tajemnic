import { formatChatTurn } from './context-budget';
/**
 * GeminiChatProvider - wrapper nad Google Generative AI SDK
 * Przenosi logikę z chat/route.ts do reużywalnej klasy
 *
 * IND-12 PR-B Faza 2: pełne mapowanie GeminiExtraOptions na parametry SDK:
 * - generationConfig: topK, candidateCount, stopSequences, seed, penalties, mimeType, schema
 * - safetySettings: array obiektów {category, threshold} z enums SDK
 * - tools: JSON parser + walidacja kształtu + wrap w functionDeclarations
 * IND-13: aktywacja Gemini Context Caching przez resolvedCachedContent + cachedContent w config
 * IND-19: migracja SDK @google/generative-ai (EOL) → @google/genai
 */

import {
  GoogleGenAI,
  HarmCategory,
  HarmBlockThreshold,
  ThinkingLevel,
  type Part,
  type SafetySetting,
  type Content,
  type CachedContent,
  type GenerateContentResponse,
} from '@google/genai';
import type {
  IChatProvider,
  ChatCompletionRequest,
  StreamingChatResult,
  ChatResult,
  CompletionUsage,
} from './types';
import { DEFAULT_GEMINI_MODEL, DEFAULT_GEMINI_MODEL_FALLBACK } from './constants';
import * as Sentry from '@sentry/nextjs';
import { assertDocumentModelUseAllowed } from '@/lib/document-model-policy';

/** Mapowanie string-owych progów bezpieczeństwa (z UI) na enum SDK Gemini */
const HARM_THRESHOLD_MAP: Record<string, HarmBlockThreshold> = {
  BLOCK_NONE: HarmBlockThreshold.BLOCK_NONE,
  BLOCK_ONLY_HIGH: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  BLOCK_MEDIUM_AND_ABOVE: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  BLOCK_LOW_AND_ABOVE: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
};

/**
 * Budżet myślenia dla gemini-2.5-* = 0 (myślenie WYŁĄCZONE). Dwa powody:
 *
 * 1. IND-199: domyślne AUTOMATIC thinking (budget -1) przy dużym prompcie zżera
 *    maxOutputTokens → finishReason MAX_TOKENS z pustym text (cichy HTTP 200,
 *    pusty dymek MG). Mniej myślenia = niższe ryzyko.
 * 2. Duplikacja narracji (pre-flight 2026-06-24): gemini-2.5-flash z budżetem
 *    myślenia > 0 emituje CAŁĄ treść myślenia jako PIERWSZY chunk strumienia z
 *    `part.thought === false` (NIE flagowany jako thought, rozmiar ~= budżet).
 *    Getter SDK `.text` pomija tylko `part.thought === true`, więc to
 *    "myślenie-jako-tekst" trafia do fullText, a potem właściwa odpowiedź dochodzi
 *    jako delty → CAŁA narracja (MYŚLI_MG + proza + [Co robisz?]) renderowana
 *    DWA RAZY. `includeThoughts: true` NIE przeflagowuje (zweryfikowane: chunk#0
 *    dalej thought:false). Budget 0 → brak chunku myślenia → brak duplikacji.
 *
 * Dotyczy TYLKO presetu HIGH (jedyny chat na gemini-2.5; LOW/MID/ULTRA =
 * gemini-3.x → thinkingLevel, osobny tor - do osobnego sprawdzenia czy też cieknie).
 */
const THINKING_BUDGET_GEMINI_25 = 0;

/** IND-199: budżet myślenia dla retry po pustej odpowiedzi - 0 wyłącza myślenie (flash). */
const THINKING_BUDGET_RETRY = 0;

const MODEL_ATTEMPT_TIMEOUT_MS = 15_000;
const PROVIDER_TIMEOUT_MS = 60_000;

function isTransportFailure(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' ||
    (error instanceof TypeError && /fetch failed|network/i.test(error.message)));
}

/** Keep the deadline alive through stream consumption, including an SDK that ignores abort. */
function geminiRequestGuard(timeoutMs: number, parent?: AbortSignal) {
  const controller = new AbortController();
  const timeout = new Error('GEMINI_REQUEST_TIMEOUT');
  timeout.name = 'TimeoutError';
  let rejectAbort: (reason: unknown) => void = () => {};
  const aborted = new Promise<never>((_resolve, reject) => { rejectAbort = reject; });
  void aborted.catch(() => {});
  const stop = (reason: unknown) => { controller.abort(reason); rejectAbort(reason); };
  const cancel = () => stop(parent?.reason ?? new DOMException('Request cancelled', 'AbortError'));
  let timer = setTimeout(() => stop(timeout), Math.max(0, timeoutMs));
  if (typeof timer === 'object' && 'unref' in timer) timer.unref();
  parent?.addEventListener('abort', cancel, {once:true});
  if (parent?.aborted) cancel();
  if (timeoutMs <= 0) stop(timeout);
  return {
    signal: controller.signal,
    stop,
    extend(remainingMs: number) {
      clearTimeout(timer);
      timer = setTimeout(() => stop(timeout), Math.max(0, remainingMs));
      if (typeof timer === 'object' && 'unref' in timer) timer.unref();
    },
    wait<T>(promise: Promise<T>): Promise<T> {
      return controller.signal.aborted ? Promise.reject(controller.signal.reason) : Promise.race([promise, aborted]);
    },
    dispose() { clearTimeout(timer); parent?.removeEventListener('abort', cancel); },
  };
}

/**
 * IND-199: in-character fallback gdy model zwraca pustkę nawet po retry. Zamiast
 * cichego pustego dymka - jawny komunikat, by gracz wiedział że ma powtórzyć akcję.
 */
const EMPTY_RESPONSE_FALLBACK =
  'Mgła spowija na chwilę umysł Mistrza Gry, a wątek narracji się rwie. (Wyślij swoją akcję ponownie.)';

/**
 * IND-203: mapowanie poziomu myślenia z UI ('minimal'/'low'/'medium'/'high') na enum SDK
 * (ThinkingLevel.MINIMAL/LOW/MEDIUM/HIGH). 'auto' celowo pominięte - oznacza "model decyduje",
 * więc thinkingConfig.thinkingLevel nie jest wtedy ustawiany.
 */
const THINKING_LEVEL_MAP: Record<'minimal' | 'low' | 'medium' | 'high', ThinkingLevel> = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

/**
 * Sprawdza, czy dany model należy do nowoczesnej rodziny modeli Gemini (Gemini 3.x+ / Flash latest / Pro latest),
 * w których parametry samplingu (temperature, top_p, top_k) są wycofane przez Google API,
 * a kontrola myślenia odbywa się wyłącznie przez thinkingLevel.
 */
export function isModernGeminiModel(modelId: string): boolean {
  return (
    modelId.includes('gemini-3') ||
    modelId.includes('flash-latest') ||
    modelId.includes('flash-lite-latest') ||
    modelId.includes('pro-latest')
  );
}

/**
 * Zwraca bezpieczną konfigurację thinkingConfig dla ponowienia po pustej odpowiedzi:
 * Dla nowoczesnych modeli (Gemini 3.x+) wymusza poziom minimalny (MINIMAL),
 * natomiast dla starszych (np. gemini-2.5) zachowuje thinkingBudget = 0.
 */
export function resolveRetryThinkingConfig(modelId: string): Record<string, unknown> {
  if (isModernGeminiModel(modelId)) {
    return { thinkingLevel: ThinkingLevel.MINIMAL };
  }
  return { thinkingBudget: THINKING_BUDGET_RETRY };
}

/**
 * Detekcja błędów kwalifikujących się do natychmiastowego retry z exponential backoff:
 * - 429 Too Many Requests / RESOURCE_EXHAUSTED / Quota exceeded
 * - 502 Bad Gateway / 503 Service Unavailable / 504 Gateway Timeout / UNAVAILABLE / high demand
 */
function isDailyQuotaError(err:unknown):boolean {
  const message=err instanceof Error?err.message:String(err);
  return /429|RESOURCE_EXHAUSTED/i.test(message)&&/RequestsPerDay|per[_ -]?day|daily quota/i.test(message);
}

export function isRetryableGeminiError(err: unknown): boolean {
  if (!err || isDailyQuotaError(err)) return false;
  const errMsg = err instanceof Error ? err.message : String(err);
  return (
    errMsg.includes('429') ||
    errMsg.includes('RESOURCE_EXHAUSTED') ||
    errMsg.includes('quota') ||
    errMsg.includes('Quota exceeded') ||
    errMsg.includes('too many requests') ||
    errMsg.includes('502') ||
    errMsg.includes('503') ||
    errMsg.includes('504') ||
    errMsg.includes('high demand') ||
    errMsg.includes('UNAVAILABLE') ||
    errMsg.includes('overloaded') ||
    errMsg.includes('Service Unavailable')
  );
}

/**
 * Wykonuje operację z automatycznym ponawianiem (exponential backoff + jitter).
 * Domyślnie: 3 próby (baseDelay = 1000ms: ~1s, ~2s z jitterem).
 * W środowisku testowym (process.env.NODE_ENV === 'test') delay jest skrócony do symbolicznych wartości.
 */
async function executeWithRetry<T>(
  fn: () => Promise<T>,
  modelName: string,
  maxRetries = 2,
  baseDelayMs = 1000
): Promise<T> {
  const isTest = process.env.NODE_ENV === 'test';
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: unknown) {
      if (attempt >= maxRetries || !isRetryableGeminiError(err)) {
        throw err;
      }
      attempt++;
      const jitter = Math.random() * 200;
      const delay = isTest ? 10 : Math.min(8000, baseDelayMs * Math.pow(2, attempt - 1) + jitter);
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(
        `⚠️ Model "${modelName}" zgłosił błąd przeciążenia/limitu (${errMsg}). Ponawiam (próba ${attempt}/${maxRetries}) za ${Math.round(delay)}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export class GeminiChatProvider implements IChatProvider {
  readonly type = 'gemini' as const;
  private ai: GoogleGenAI;
  private modelId: string;

  constructor(apiKey: string, modelId?: string) {
    this.ai = new GoogleGenAI({ apiKey });
    this.modelId = modelId || DEFAULT_GEMINI_MODEL;
  }

  private buildRequestPayload(request: ChatCompletionRequest, modelId = this.modelId): {
    config: Record<string, unknown>;
    contents: Content[];
  } {
    // IND-12 PR-B Faza 2: czytaj z geminiOptions z fallbackiem na deprecated top-level alias
    const opts = request.geminiOptions;
    const thinkingLevel = opts?.thinkingLevel ?? request.thinkingLevel;
    const fileAttachments = opts?.fileAttachments ?? request.fileAttachments;
    if (fileAttachments?.length) assertDocumentModelUseAllowed();
    const additionalContext =
      opts?.additionalContext ?? request.additionalContext;

    const isModern = isModernGeminiModel(modelId);

    // === config - wszystkie pola generacji bezpośrednio (IND-19: nie ma sub-obiektu generationConfig) ===
    const config: Record<string, unknown> = {
      maxOutputTokens: request.maxOutputTokens,
    };

    // Google API Deprecation (2026): modele Gemini 3.x+ wycofują parametry samplingu.
    // Przesłanie temperature, topP, topK powoduje błąd HTTP 400 INVALID_ARGUMENT.
    // Parametry te dołączamy TYLKO dla modeli starszych generacji (np. gemini-2.5).
    if (!isModern) {
      if (request.temperature !== undefined) config.temperature = request.temperature;
      if (request.topP !== undefined) config.topP = request.topP;
      if (opts?.topK !== undefined) config.topK = opts.topK;
    }

    if (opts?.candidateCount !== undefined)
      config.candidateCount = opts.candidateCount;
    if (opts?.stopSequences?.length) config.stopSequences = opts.stopSequences;
    if (opts?.seed !== undefined) config.seed = opts.seed;
    if (opts?.presencePenalty !== undefined)
      config.presencePenalty = opts.presencePenalty;
    if (opts?.frequencyPenalty !== undefined)
      config.frequencyPenalty = opts.frequencyPenalty;
    if (opts?.responseMimeType !== undefined)
      config.responseMimeType = opts.responseMimeType;
    if (opts?.responseSchema !== undefined)
      config.responseSchema = opts.responseSchema;

    // Thinking configuration dla modeli nowoczesnych (Gemini 3.x, flash-latest, pro-latest) oraz 2.5:
    // SDK oczekuje go WEWNĄTRZ config.thinkingConfig.
    // 'auto' oznacza "model decyduje", więc thinkingConfig.thinkingLevel nie jest wtedy ustawiany.
    const explicitBudget = opts?.thinkingBudget;
    if (isModern) {
      const thinkingConfigObj: Record<string, unknown> = {};
      if (thinkingLevel && thinkingLevel !== 'auto' && thinkingLevel in THINKING_LEVEL_MAP) {
        thinkingConfigObj.thinkingLevel = THINKING_LEVEL_MAP[thinkingLevel];
      }
      if (explicitBudget !== undefined) {
        thinkingConfigObj.thinkingBudget = explicitBudget;
      }
      if (Object.keys(thinkingConfigObj).length > 0) {
        config.thinkingConfig = thinkingConfigObj;
      }
    } else {
      // gemini-2.5-* (flash/pro): myślenie domyślnie wyłączone (budget 0), chyba że jawnie podano inny budżet.
      if (modelId.includes('gemini-2.5')) {
        config.thinkingConfig = {
          thinkingBudget: explicitBudget !== undefined ? explicitBudget : THINKING_BUDGET_GEMINI_25,
        };
      }
    }

    // === safetySettings - mapuj string UI → enum SDK ===
    if (opts?.safetySettings) {
      const s = opts.safetySettings;
      const safetySettings: SafetySetting[] = [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold:
            HARM_THRESHOLD_MAP[s.harassment] ??
            HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold:
            HARM_THRESHOLD_MAP[s.hateSpeech] ??
            HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold:
            HARM_THRESHOLD_MAP[s.sexuallyExplicit] ??
            HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold:
            HARM_THRESHOLD_MAP[s.dangerousContent] ??
            HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ];
      config.safetySettings = safetySettings;
    }

    // === tools - parser JSON + walidacja kształtu (array of {name, ...}) ===
    if (opts?.tools) {
      try {
        const rawTools = opts.tools;
        const toolArray = Array.isArray(rawTools) ? rawTools : [];
        const declarations = toolArray.filter(
          (item): item is Record<string, unknown> =>
            typeof item === 'object' && item !== null && 'name' in item
        );
        if (declarations.length > 0) {
          config.tools = [{ functionDeclarations: declarations }];
        } else {
          console.warn(
            '⚠️ Gemini tools: brak poprawnych deklaracji funkcji (oczekiwano [{name, parameters}]), ignoruję.'
          );
        }
      } catch (e) {
        console.warn('⚠️ Gemini tools error, ignoruję:', e);
      }
    }

    // === OPT-26: GEMINI CONTEXT CACHING (IND-13 / IND-19) ===
    // resolvedCachedContent jest obiektem CachedContent z getOrCreateGeminiCache() w route.ts.
    // Gdy ustawiony: cachedContent w config = cache.name (systemPrompt jest już w cache).
    const resolvedCache: CachedContent | undefined =
      modelId === this.modelId ? opts?.resolvedCachedContent : undefined;
    const hasCachedContent = !!resolvedCache;

    if (hasCachedContent) {
      config.cachedContent = resolvedCache!.name;
      console.log(
        `✅ OPT-26: Provider używa cached content: ${resolvedCache!.name}`
      );
    } else {
      // systemInstruction - tylko gdy cache NIE aktywny
      config.systemInstruction = request.systemPrompt;
    }

    // === Buduj content parts (bez systemPrompt - idzie do config.systemInstruction) ===
    const userParts: Part[] = [];

    // Dodatkowe sekcje kontekstu (czas, RAG memory, era) - tablica stringów
    if (additionalContext) {
      for (const ctx of additionalContext) {
        userParts.push({ text: ctx });
      }
    }

    // Pliki PDF (Gemini File API URIs)
    if (fileAttachments) {
      for (const file of fileAttachments) {
        userParts.push({
          fileData: { fileUri: file.fileUri, mimeType: file.mimeType },
        });
      }
    }

    // Historia + aktualna wiadomość
    userParts.push({ text: formatChatTurn(request) });

    const contents: Content[] = [{ role: 'user', parts: userParts }];

    return { config, contents };
  }

  async streamChat(
    request: ChatCompletionRequest
  ): Promise<StreamingChatResult> {
    const { contents } = this.buildRequestPayload(request);

    // === Wywołanie SDK (IND-19: ai.models.generateContentStream zamiast model.generateContentStream) ===
    // Capture `ai`/`model` do zmiennych - generator (async function*) nie ma dostępu do `this`.
    const ai = this.ai;
    let activeModel = this.modelId;
    const deadlineAt = Date.now() + (request.timeoutMs ?? PROVIDER_TIMEOUT_MS);
    const configForModel = (model: string) => this.buildRequestPayload(request, model).config;
    const streamOnce = async (modelToUse: string, cfg = configForModel(modelToUse)) => {
      const guard = geminiRequestGuard(Math.min(MODEL_ATTEMPT_TIMEOUT_MS, deadlineAt - Date.now()), request.signal);
      try {
        if (guard.signal.aborted) throw guard.signal.reason;
        const response = await guard.wait(ai.models.generateContentStream({model:modelToUse,contents,
          config:{...cfg,abortSignal:guard.signal,httpOptions:{timeout:Math.max(1, deadlineAt - Date.now())}}}));
        const iterator = response[Symbol.asyncIterator]();
        let completed = false;
        // Wait for the first chunk inside the model cascade, before any prose is published.
        let first: IteratorResult<GenerateContentResponse>;
        try { first = await guard.wait(iterator.next()); }
        catch (error) {
          guard.stop(error);
          void Promise.resolve(iterator.return?.(undefined)).catch(() => {});
          throw error;
        }
        // The short budget only protects connection/first-chunk acquisition.
        // Once generation starts, the shared deadline bounds the entire narration.
        guard.extend(deadlineAt - Date.now());
        return (async function* () {
          try {
            let next = first;
            while (!next.done) {
              yield next.value;
              next = await guard.wait(iterator.next());
            }
            completed = true;
          } finally {
            if (!completed) {
              guard.stop(new DOMException('Stream consumer closed', 'AbortError'));
              void Promise.resolve(iterator.return?.(undefined)).catch(() => {});
            }
            guard.dispose();
          }
        })();
      } catch (error) { guard.dispose(); throw error; }
    };

    // Capture usage + finishReason z ostatniego chunku (dostępne po zakończeniu streamu)
    let lastUsage: GenerateContentResponse['usageMetadata'] = undefined;
    let lastFinishReason: string | undefined;

    // pump - wspólna konsumpcja jednego streamu: yielduje text, zbiera usage/finishReason,
    // pomija safety-blocked chunki (chunk.text może rzucić). Reużywane przez pierwsze
    // wywołanie i retry, żeby nie duplikować pętli.
    async function* pump(
      response: Awaited<ReturnType<typeof streamOnce>>
    ): AsyncGenerator<string> {
        for await (const chunk of response) {
          try {
            if (chunk.usageMetadata) lastUsage = chunk.usageMetadata;
            const fr = chunk.candidates?.[0]?.finishReason;
            if (fr) lastFinishReason = fr;
            const text = chunk.text;
            if (text) {
              yield text;
            }
          } catch (e) {
            // Safety-blocked chunk, pomiń
            console.warn('⚠️ Gemini stream chunk error (safety?):', e);
            continue;
          }
        }
    }

    // Kaskada fallbacku (activeModel -> 3.6 -> 3.1-flash-lite -> flash-lite-latest)
    const fallbackChain = Array.from(
      new Set([
        activeModel,
        DEFAULT_GEMINI_MODEL_FALLBACK,
        'gemini-3.1-flash-lite',
        'gemini-flash-lite-latest',
      ])
    );

    let firstResponse: Awaited<ReturnType<typeof streamOnce>> | undefined;
    let lastError: unknown;

    for (const candidate of fallbackChain) {
      try {
        if (candidate !== activeModel) {
          console.warn(
            `⚠️ Przełączam model na sprawdzony fallback "${candidate}"...`
          );
        }
        activeModel = candidate;
        firstResponse = await executeWithRetry(
          () => streamOnce(activeModel),
          activeModel
        );
        break;
      } catch (err: unknown) {
        lastError = err;
        if (request.signal?.aborted || Date.now() >= deadlineAt) throw err;
        const errMsg = err instanceof Error ? err.message : String(err);
        if (/Incomplete JSON segment at the end/i.test(errMsg)) {
          firstResponse = (async function* () { throw err; })();
          break;
        }
        const isRateLimit =
          errMsg.includes('429') ||
          errMsg.includes('RESOURCE_EXHAUSTED') ||
          errMsg.includes('quota') ||
          errMsg.includes('Quota exceeded');

        const isUnavailable =
          errMsg.includes('404') ||
          errMsg.includes('not found') ||
          errMsg.includes('no longer available') ||
          errMsg.includes('503') ||
          errMsg.includes('high demand') ||
          errMsg.includes('UNAVAILABLE') ||
          isRateLimit || isTransportFailure(err);

        if (!isUnavailable) {
          throw err;
        }

        if (isDailyQuotaError(err)) {
          console.warn(`Daily quota exhausted for ${candidate}; trying the next configured fallback without retry.`);
        } else if (isRateLimit) {
          console.warn(
            `⚠️ Model "${candidate}" wyczerpał ponowienia rate-limit 429 (${errMsg}). Oczekiwanie 1500ms i próba alternatywnego modelu w kaskadzie...`
          );
          await new Promise((r) => setTimeout(r, 1500));
        } else {
          console.warn(
            `⚠️ Model "${candidate}" niedostępny po ponowieniach (${errMsg}). Sprawdzam kolejny model w kaskadzie...`
          );
        }
      }
    }

    if (!firstResponse) {
      throw lastError || new Error('Wszystkie modele w kaskadzie awaryjnej zawiodły');
    }

    // IND-199: guard pustej odpowiedzi. gemini-2.5-flash potrafi wyczerpać budżet na
    // myśleniu → finishReason MAX_TOKENS z pustym text (out:0, cichy 200). Gdy CAŁY
    // pierwszy stream nic nie wyemitował → retry RAZ z wyłączonym myśleniem (budget 0).
    // UWAGA: retry tylko dla PEŁNEJ pustki (emitted===false). Częściowy emit (trochę
    // tekstu, potem urwanie na MAX_TOKENS) NIE jest retry'owany - to byłaby duplikacja
    // narracji; urywanie długiej odpowiedzi to osobny problem (IND-73), nie IND-199.
    const stream = (async function* () {
      let emitted = false;
      try {
        for await (const text of pump(firstResponse)) {
          emitted = true;
          yield { text };
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const isIncompleteJson = /Incomplete JSON segment at the end/i.test(errMsg);
        if (isIncompleteJson && !emitted) {
          console.warn(
            '⚠️ Pierwsze zapytanie Gemini zakończone błędem Incomplete JSON przed emisją danych. Przechodzę do retry...'
          );
        } else {
          throw err;
        }
      }

      if (!emitted) {
        Sentry.addBreadcrumb({
          category: 'gemini',
          level: 'warning',
          message: 'Pusta odpowiedź Gemini - retry bez myślenia',
          data: { model: activeModel, finishReason: lastFinishReason ?? 'unknown' },
        });
        const retryConfig = {
          ...configForModel(activeModel),
          thinkingConfig: resolveRetryThinkingConfig(activeModel),
        };
        try {
          for await (const text of pump(await streamOnce(activeModel, retryConfig))) {
            emitted = true;
            yield { text };
          }
        } catch (retryErr: unknown) {
          if (request.signal?.aborted || isTransportFailure(retryErr) ||
              (retryErr instanceof Error && retryErr.name === 'AbortError') || emitted) throw retryErr;
          console.warn('⚠️ Gemini stream retry error:', retryErr);
        }

        // Nadal pusto → jawny komunikat zamiast cichego pustego dymka + Sentry (była ślepa plamka).
        if (!emitted) {
          Sentry.captureException(
            new Error(
              'Gemini: pusta odpowiedź po retry (możliwy MAX_TOKENS/safety/Incomplete JSON)'
            ),
            {
              tags: { feature: 'chat', provider: 'gemini' },
              extra: { model: activeModel, finishReason: lastFinishReason ?? 'unknown' },
            }
          );
          yield { text: EMPTY_RESPONSE_FALLBACK };
        }
      }
    })();

    const getUsage = async (): Promise<CompletionUsage | null> => {
      if (lastUsage) {
        return {
          totalTokens: lastUsage.totalTokenCount || 0,
          promptTokens: lastUsage.promptTokenCount,
          completionTokens: lastUsage.candidatesTokenCount,
          thinkingTokens: lastUsage.thoughtsTokenCount ?? 0,
          // OPT-26: tokeny obsłużone z cache promptu (mapowanie gubiło to pole →
          // telemetria/koszt pokazywały cached=0 mimo działającego cache).
          cachedTokens: lastUsage.cachedContentTokenCount ?? 0,
          model: activeModel,
        };
      }
      return null;
    };

    // `finishReason` jest ustawiany podczas konsumpcji streamu, więc caller
    // może go odczytać dopiero po zakończeniu `for await`.
    const getFinishReason = (): string | undefined => lastFinishReason;

    return { stream, getUsage, getFinishReason };
  }

  async chat(request: ChatCompletionRequest): Promise<ChatResult> {
    const { contents } = this.buildRequestPayload(request);
    const ai = this.ai;
    let activeModel = this.modelId;
    const deadlineAt = Date.now() + (request.timeoutMs ?? PROVIDER_TIMEOUT_MS);

    const fallbackChain = Array.from(
      new Set([
        activeModel,
        DEFAULT_GEMINI_MODEL_FALLBACK,
        'gemini-3.1-flash-lite',
        'gemini-flash-lite-latest',
      ])
    );

    let response: GenerateContentResponse | undefined;
    let lastError: unknown;

    for (const candidate of fallbackChain) {
      try {
        if (candidate !== activeModel) {
          console.warn(
            `⚠️ Przełączam model na sprawdzony fallback "${candidate}"...`
          );
        }
        activeModel = candidate;
        response = await executeWithRetry(
          async () => {
            const guard = geminiRequestGuard(Math.min(MODEL_ATTEMPT_TIMEOUT_MS, deadlineAt - Date.now()), request.signal);
            try {
              if (guard.signal.aborted) throw guard.signal.reason;
              return await guard.wait(ai.models.generateContent({
              model: activeModel,
              contents,
              config: {...this.buildRequestPayload(request, activeModel).config,abortSignal:guard.signal,
                httpOptions:{timeout:MODEL_ATTEMPT_TIMEOUT_MS}},
              }));
            } finally { guard.dispose(); }
          },
          activeModel
        );
        break;
      } catch (err: unknown) {
        lastError = err;
        if (request.signal?.aborted || Date.now() >= deadlineAt) throw err;
        const errMsg = err instanceof Error ? err.message : String(err);
        const isRateLimit =
          errMsg.includes('429') ||
          errMsg.includes('RESOURCE_EXHAUSTED') ||
          errMsg.includes('quota') ||
          errMsg.includes('Quota exceeded');

        const isUnavailable =
          errMsg.includes('404') ||
          errMsg.includes('not found') ||
          errMsg.includes('no longer available') ||
          errMsg.includes('503') ||
          errMsg.includes('high demand') ||
          errMsg.includes('UNAVAILABLE') ||
          isRateLimit || isTransportFailure(err);

        if (!isUnavailable) {
          throw err;
        }

        if (isDailyQuotaError(err)) {
          console.warn(`Daily quota exhausted for ${candidate}; trying the next configured fallback without retry.`);
        } else if (isRateLimit) {
          console.warn(
            `⚠️ Model "${candidate}" wyczerpał ponowienia rate-limit 429 (${errMsg}). Oczekiwanie 1500ms i próba alternatywnego modelu w kaskadzie...`
          );
          await new Promise((r) => setTimeout(r, 1500));
        } else {
          console.warn(
            `⚠️ Model "${candidate}" niedostępny po ponowieniach (${errMsg}). Sprawdzam kolejny model w kaskadzie...`
          );
        }
      }
    }

    if (!response) {
      throw lastError || new Error('Wszystkie modele w kaskadzie awaryjnej zawiodły');
    }

    const text = response.text || '';
    const lastUsage = response.usageMetadata;
    const usage: CompletionUsage | null = lastUsage
      ? {
          totalTokens: lastUsage.totalTokenCount || 0,
          promptTokens: lastUsage.promptTokenCount,
          completionTokens: lastUsage.candidatesTokenCount,
          thinkingTokens: lastUsage.thoughtsTokenCount ?? 0,
          cachedTokens: lastUsage.cachedContentTokenCount ?? 0,
          model: activeModel,
        }
      : null;

    return { text, usage };
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.ai.models.generateContent({
        model: this.modelId,
        contents: 'Hello',
      });
      // Weryfikacja odpowiedzi - text jest właściwością w nowym SDK
      void response.text;
      return { success: true };
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      // Jeśli wybrany model został wycofany (404), sprawdź czy fallback działa i poinformuj gracza
      if (
        (errMsg.includes('404') ||
          errMsg.includes('not found') ||
          errMsg.includes('no longer available')) &&
        this.modelId !== DEFAULT_GEMINI_MODEL_FALLBACK
      ) {
        try {
          const fallbackRes = await this.ai.models.generateContent({
            model: DEFAULT_GEMINI_MODEL_FALLBACK,
            contents: 'Hello',
          });
          void fallbackRes.text;
          return {
            success: true,
            error: `Model "${this.modelId}" został wycofany przez Google (404). Zastąpiono automatycznie sprawdzonym modelem "${DEFAULT_GEMINI_MODEL_FALLBACK}".`,
          };
        } catch {
          // zwróć oryginalny błąd
        }
      }
      return {
        success: false,
        error: errMsg,
      };
    }
  }
}
