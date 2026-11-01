import {isShowcaseServer} from '@/lib/adventure-dossier/authored-scenarios';
/**
 * GET /api/health/gemini - self-check zdrowia klucza i modeli Gemini (IND-273 T2).
 *
 * Read-only health: woła `ai.models.list()`, waliduje klucz (200 = OK, 400/403 =
 * zły/wygasły, sieć/timeout = nieznany) i krzyżuje żywą listę modeli z rejestrem
 * (`model-registry.ts`). Łapie deprecację modeli PROAKTYWNIE (np. gemini-2.0-flash
 * zniknął 1.06.2026 → 502 w środku gry, IND-222) zanim gracz trafi na błąd.
 *
 * HTTP zawsze 200 - stan raportowany w body (upraszcza klienta useHealthCheck).
 * Tylko niespodziewany crash → 500.
 *
 * Klucz: nagłówek `X-Gemini-Api-Key` (BYOK) ma precedencję nad `process.env`
 * (wzór z run-chat-pipeline.ts - wersja lokalna zew-app-local).
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { isSameOriginLocalDossierRequest } from '@/lib/adventure-dossier/local-request';
import {
  DEFAULT_CHAT_MODEL,
  PRESET_MODELS,
  EMBEDDING_MODEL,
} from '@/lib/model-registry';

export type HealthStatus = 'ok' | 'invalid_key' | 'network_error' | 'no_key';
export type ModelPingState = 'available' | 'overloaded' | 'unavailable';
export type ModelPingReason =
  | 'ok'
  | 'high_demand'
  | 'rate_limited'
  | 'invalid_key'
  | 'not_found'
  | 'error';

export interface ModelPingResult {
  model: string;
  state: ModelPingState;
  latencyMs: number | null;
  reason: ModelPingReason;
  message?: string;
}

export interface GeminiHealth {
  status: HealthStatus;
  /** true = klucz ważny, false = zły/wygasły, null = nieznany (sieć/brak klucza). */
  keyValid: boolean | null;
  /** Explicit local playtest transport; never contains the server credential. */
  serverConfigured?: boolean;
  /** Chat-capable ID z żywej listy (puste gdy klucz nie OK). */
  availableModels: string[];
  registry: {
    chatModelsPresent: string[];
    chatModelsMissing: string[];
    embeddingPresent: boolean;
  };
  checkedAt: string;
  /** Opcjonalny wynik 1-tokenowego pingu wybranego modelu (?model=..., #521). */
  modelPing?: ModelPingResult;
}

/** Klucz: nagłówek BYOK > serwerowy env (wzór run-chat-pipeline.ts:42). */
function resolveGeminiApiKey(request: NextRequest): string | null {
  const key = request.headers.get('X-Gemini-Api-Key')?.trim();
  return key || process.env.GEMINI_API_KEY?.trim() || null;
}

/** Odczytuje parametr ?model=... z zapytania (kompatybilne z NextRequest i Request w testach). */
function extractModelParam(request: NextRequest): string | null {
  try {
    const searchParams =
      request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
    const model = searchParams.get('model')?.trim();
    return model ? model : null;
  } catch {
    return null;
  }
}

/**
 * Czy błąd oznacza ZŁY/wygasły klucz (vs problem sieci). Detekcja po status/message,
 * NIE instanceof (mock-safe, lekcja IND-191). 400 INVALID_ARGUMENT / 403
 * PERMISSION_DENIED = klucz zły. Inne (timeout/DNS/5xx) = stan nieznany.
 */
function isInvalidKeyError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: number; code?: number; message?: string };
  const status = e.status ?? e.code;
  if (status === 400 || status === 403) return true;
  return /INVALID_ARGUMENT|PERMISSION_DENIED|API[_ ]key not valid|API_KEY_INVALID/i.test(
    e.message ?? ''
  );
}

/**
 * Klasyfikuje błąd pingu wybranego modelu (#521) na 3 stany:
 * - overloaded (żółty): 503 High Demand / UNAVAILABLE / 429 RESOURCE_EXHAUSTED
 * - unavailable (czerwony): zły klucz (400/403), brak modelu (404) lub błąd połączenia
 */
function classifyModelPingError(err: unknown): {
  state: ModelPingState;
  reason: ModelPingReason;
  message?: string;
} {
  if (err && typeof err === 'object') {
    const e = err as { status?: number; code?: number; message?: string };
    const status = e.status ?? e.code;
    const msg = e.message ?? '';
    if (
      status === 404 ||
      (/404|NOT_FOUND|not found|not supported|unknown model|invalid model/i.test(
        msg
      ) &&
        !/API[_ ]key|PERMISSION_DENIED/i.test(msg))
    ) {
      return {
        state: 'unavailable',
        reason: 'not_found',
        message: msg || '404 Model Not Found',
      };
    }
    if (isInvalidKeyError(err)) {
      return {
        state: 'unavailable',
        reason: 'invalid_key',
        message: msg || undefined,
      };
    }
    if (
      status === 503 ||
      /503|UNAVAILABLE|high[_ ]demand|overloaded|model is overloaded/i.test(msg)
    ) {
      return {
        state: 'overloaded',
        reason: 'high_demand',
        message: msg || '503 High Demand / UNAVAILABLE',
      };
    }
    if (
      status === 429 ||
      /429|RESOURCE_EXHAUSTED|quota|rate[_ ]limit|too many requests/i.test(msg)
    ) {
      return {
        state: 'overloaded',
        reason: 'rate_limited',
        message: msg || '429 Rate Limit / Quota Exhausted',
      };
    }
    return {
      state: 'unavailable',
      reason: 'error',
      message: msg || undefined,
    };
  }
  return {
    state: 'unavailable',
    reason: 'error',
  };
}

/** Lekki 1-tokenowy ping sprawdzający realną dostępność i opóźnienie wybranego modelu (#521). */
async function probeModelAvailability(
  ai: GoogleGenAI,
  model: string
): Promise<ModelPingResult> {
  const startMs = Date.now();
  try {
    await ai.models.generateContent({
      model,
      contents: 'ping',
      config: {
        maxOutputTokens: 1,
        temperature: 0,
      },
    });
    const latencyMs = Math.max(1, Math.round(Date.now() - startMs));
    return {
      model,
      state: 'available',
      latencyMs,
      reason: 'ok',
    };
  } catch (err) {
    const classified = classifyModelPingError(err);
    return {
      model,
      state: classified.state,
      latencyMs: null,
      reason: classified.reason,
      ...(classified.message ? { message: classified.message } : {}),
    };
  }
}

/** Aktywne modele chat rejestru (default + 4 presety, unikalne). Bez legacy bare. */
function activeChatModels(): string[] {
  return Array.from(
    new Set([
      DEFAULT_CHAT_MODEL,
      ...Object.values(PRESET_MODELS).map((p) => p.chatModel),
    ])
  );
}

export async function GET(request: NextRequest): Promise<Response> {
  const checkedAt = new Date().toISOString();
  const requestedModel = extractModelParam(request);
  const emptyRegistry = {
    chatModelsPresent: [],
    chatModelsMissing: [],
    embeddingPresent: false,
  };

  const apiKey = resolveGeminiApiKey(request);
  if (!apiKey) {
    return NextResponse.json<GeminiHealth>({
      status: 'no_key',
      keyValid: null,
      availableModels: [],
      registry: emptyRegistry,
      checkedAt,
      ...(requestedModel
        ? {
            modelPing: {
              model: requestedModel,
              state: 'unavailable',
              latencyMs: null,
              reason: 'invalid_key',
            },
          }
        : {}),
    });
  }

  const ai = new GoogleGenAI({ apiKey });
  const pingPromise = requestedModel
    ? probeModelAvailability(ai, requestedModel)
    : Promise.resolve(undefined);

  try {
    const [pager, modelPing] = await Promise.all([
      ai.models.list(),
      pingPromise,
    ]);

    const chatModels = new Set<string>();
    const embeddingModels = new Set<string>();
    for await (const m of pager) {
      const id = (m.name ?? '').replace(/^models\//, '');
      if (!id) continue;
      const actions = m.supportedActions ?? [];
      if (actions.includes('generateContent')) chatModels.add(id);
      if (actions.includes('embedContent')) embeddingModels.add(id);
    }

    const active = activeChatModels();
    const chatModelsPresent = active.filter((id) => chatModels.has(id));
    const chatModelsMissing = active.filter((id) => !chatModels.has(id));

    return NextResponse.json<GeminiHealth>({
      status: 'ok',
      keyValid: true,
      ...(isShowcaseServer() &&
        !!process.env.GEMINI_API_KEY?.trim() &&
        !request.headers.get('X-Gemini-Api-Key')?.trim() &&
        isSameOriginLocalDossierRequest(request)
        ? { serverConfigured: true } : {}),
      availableModels: Array.from(chatModels).sort(),
      registry: {
        chatModelsPresent,
        chatModelsMissing,
        embeddingPresent: embeddingModels.has(EMBEDDING_MODEL),
      },
      checkedAt,
      ...(modelPing ? { modelPing } : {}),
    });
  } catch (err) {
    // Zły klucz vs problem sieci - tylko pierwszy oznacza keyValid:false.
    const invalidKey = isInvalidKeyError(err);
    const modelPing = requestedModel
      ? await pingPromise.catch(() => {
          const classified = classifyModelPingError(err);
          return {
            model: requestedModel,
            state: classified.state,
            latencyMs: null,
            reason: classified.reason,
          } satisfies ModelPingResult;
        })
      : undefined;

    return NextResponse.json<GeminiHealth>({
      status: invalidKey ? 'invalid_key' : 'network_error',
      keyValid: invalidKey ? false : null,
      availableModels: [],
      registry: emptyRegistry,
      checkedAt,
      ...(modelPing
        ? {
            modelPing:
              invalidKey && modelPing.state !== 'unavailable'
                ? {
                    ...modelPing,
                    state: 'unavailable',
                    latencyMs: null,
                    reason: 'invalid_key',
                  }
                : modelPing,
          }
        : {}),
    });
  }
}

