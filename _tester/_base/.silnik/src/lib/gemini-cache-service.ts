import { CACHE_ACKNOWLEDGEMENT } from '@/lib/ai-providers/context-budget';
/**
 * OPT-26 / OPT-C04: Gemini Context Caching Service
 *
 * Zarządza cache'owaniem stabilnych części promptu (system prompt, era rules,
 * GM protocol) w Gemini API. Cached tokeny kosztują 75-90% mniej niż standard.
 *
 * Strategia:
 * - systemInstruction: pełny system prompt GM (stabilny per sesja dzięki OPT-04)
 * - contents: era rules + GM protocol (stabilne per sesja/próg tur)
 * - TTL: maksymalnie 15 minut; aktywna gra odnawia ważny cache
 * - Dynamiczne odnawianie (sliding window / touchGeminiCache przez ai.caches.update)
 * - Hash-based invalidation: md5(systemPrompt + stableInstructions + model)
 * - Pętla czyszczenia i automatyczne usuwanie wygasłych wpisów w pamięci procesu
 * - Graceful fallback: jeśli cache/update nie zadziała → kontynuacja bez regresji
 *
 * IND-19: migracja SDK @google/generative-ai (EOL) → @google/genai.
 * Zmiany: GoogleAICacheManager → ai.caches, ttlSeconds: N → ttl: "Ns" (string Duration),
 * model bez prefiksu "models/" (nowe SDK nie wymaga), managerPool → aiPool (GoogleGenAI).
 */

import { GoogleGenAI, type CachedContent } from '@google/genai';
import crypto from 'crypto';
import { getGeminiPricing } from './pricing/pricing-data';
import { generateTraceId, logApiEvent } from './telemetry';
// IND-275 T1: CACHEABLE_MODELS / MIN_CACHE_TOKENS scentralizowane w model-registry.
import {
  CACHEABLE_MODELS,
  MIN_CACHE_TOKENS,
  DEFAULT_MIN_CACHE_TOKENS,
} from './model-registry';

// ─── Configuration ───────────────────────────────────────────────────

/** Maksymalny czas przechowywania nieużywanego cache: 15 minut */
export const CACHE_TTL_SECONDS = 900;
export const DEFAULT_CACHE_TTL_SECONDS = CACHE_TTL_SECONDS;

// ─── Internal state ──────────────────────────────────────────────────

export interface CacheEntry {
  modelName: string;
  tokens: number;
  tokenSource: string;
  cachedContent: CachedContent;
  contentHash: string;
  createdAt: number;
  lastAccessedAt: number;
  ttlSeconds: number;
  expiresAt: number;
  lastRefreshFailedAt?: number;
}

/** Cache reference store: cacheKey → CacheEntry */
const cacheStore = new Map<string, CacheEntry>();

/** GoogleGenAI pool: apiKey → instance */
const aiPool = new Map<string, GoogleGenAI>();

/** In-flight creations to deduplicate concurrent requests for the same cacheKey */
const inFlightCreations = new Map<string, Promise<CachedContent | null>>();

/** In-flight refreshes to deduplicate concurrent sliding window updates */
const inFlightRefreshes = new Map<string, Promise<CachedContent | null>>();

// ─── Pruning & Cleanup Loop (OPT-C04) ────────────────────────────────

/**
 * Usuwa wygasłe wpisy z pamięci procesu (OPT-C04).
 * Wpisy są uznawane za wygasłe, gdy do końca ich TTL zostało <= 60s (margines bezpieczeństwa).
 */
export function pruneExpiredGeminiCache(now: number = Date.now()): number {
  let pruned = 0;
  for (const [key, entry] of cacheStore.entries()) {
    if (entry.expiresAt - now <= 60_000) {
      cacheStore.delete(key);
      pruned++;
    }
  }
  return pruned;
}

let cleanupInterval: NodeJS.Timeout | null = null;

export function startGeminiCacheCleanup(
  intervalMs: number = 5 * 60 * 1000
): void {
  if (cleanupInterval) return;
  if (typeof setInterval !== 'undefined') {
    cleanupInterval = setInterval(() => {
      pruneExpiredGeminiCache();
    }, intervalMs);
    if (cleanupInterval && typeof cleanupInterval.unref === 'function') {
      cleanupInterval.unref();
    }
  }
}

export function stopGeminiCacheCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// Uruchomienie domyślnej pętli czyszczenia co 5 minut (pomijane w testach)
if (typeof setInterval !== 'undefined' && process.env.NODE_ENV !== 'test') {
  startGeminiCacheCleanup();
}

// ─── Helpers ─────────────────────────────────────────────────────────

function getAI(apiKey: string): GoogleGenAI {
  let ai = aiPool.get(apiKey);
  if (!ai) {
    ai = new GoogleGenAI({ apiKey });
    aiPool.set(apiKey, ai);
  }
  return ai;
}

function hashContent(...parts: string[]): string {
  return crypto.createHash('md5').update(parts.join('|||')).digest('hex');
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Lease costs are estimates of the full retained interval, not a Google invoice.
function recordCacheLease(model: string, tokens: number, seconds: number, creation: boolean, tokenSource: string) {
  const pricing = getGeminiPricing()[model];
  const storageCost = pricing?.cacheStorage == null ? undefined : tokens * pricing.cacheStorage * seconds / 3_600_000_000;
  const inputCost = creation && pricing ? tokens * pricing.input / 1_000_000 : 0;
  logApiEvent({ traceId: generateTraceId(), endpoint: creation ? '/api/cache/create' : '/api/cache/extend', provider: 'gemini', model,
    status: 200, durationMs: 0, result: 'success', costUsd: storageCost == null ? undefined : inputCost + storageCost,
    meta: { tokens, leaseSeconds: seconds, tokenSource, estimated: true, storageCostUsd: storageCost ?? null, inputCostUsd: inputCost, storageRateKnown: storageCost != null },
  }).catch(() => {});
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Dynamiczne odnowienie TTL cache w Gemini API (OPT-C04).
 * Wydłuża TTL aktywnego cache o zadany czas (domyślnie 15 minut).
 */
export async function touchGeminiCache(
  apiKey: string,
  cacheKeyOrName: string,
  ttlSeconds: number = CACHE_TTL_SECONDS
): Promise<CachedContent | null> {
  const effectiveTTL = Number.isFinite(ttlSeconds) && ttlSeconds > 0
    ? Math.min(CACHE_TTL_SECONDS, Math.max(1, Math.floor(ttlSeconds)))
    : CACHE_TTL_SECONDS;
  let targetEntry: CacheEntry | undefined;
  let targetKey: string | undefined;

  for (const [key, entry] of cacheStore.entries()) {
    if (key.startsWith(`${crypto.createHash('sha256').update(apiKey).digest('hex')}_`) && (key === cacheKeyOrName || entry.cachedContent.name === cacheKeyOrName)) {
      targetEntry = entry;
      targetKey = key;
      break;
    }
  }

  // Jeśli brak w pamięci RAM, wymagamy jawnej nazwy zasobu Gemini (cachedContents/...)
  const cacheName = targetEntry
    ? targetEntry.cachedContent.name
    : cacheKeyOrName.startsWith('cachedContents/')
      ? cacheKeyOrName
      : undefined;

  if (!cacheName) {
    return null;
  }

  try {
    const ai = getAI(apiKey);
    if (!ai.caches?.update) {
      return null;
    }
    const updated = await ai.caches.update({
      name: cacheName,
      config: { ttl: `${effectiveTTL}s` },
    });

    const now = Date.now();
    if (targetEntry && targetKey) {
      targetEntry.cachedContent = updated
        ? { ...targetEntry.cachedContent, ...updated }
        : targetEntry.cachedContent;
      recordCacheLease(targetEntry.modelName, targetEntry.tokens, Math.max(0, (now + effectiveTTL * 1000 - targetEntry.expiresAt) / 1000), false, targetEntry.tokenSource);
      targetEntry.createdAt = now;
      targetEntry.lastAccessedAt = now;
      targetEntry.ttlSeconds = effectiveTTL;
      targetEntry.expiresAt = now + effectiveTTL * 1000;
      delete targetEntry.lastRefreshFailedAt;
    }

    return updated ?? targetEntry?.cachedContent ?? null;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️ OPT-C04: Touch cache failed for ${cacheName}: ${msg}`);
    if ((msg.includes('NOT_FOUND') || msg.includes('404')) && targetKey) {
      cacheStore.delete(targetKey);
    }
    return null;
  }
}

/**
 * Pobierz lub utwórz Gemini context cache dla stabilnych części promptu.
 *
 * @param apiKey       Klucz API Gemini
 * @param modelName    Nazwa modelu (np. 'gemini-2.5-flash')
 * @param systemPrompt Pełny system prompt GM (jako systemInstruction)
 * @param stableInstructions Połączone era rules + GM protocol
 * @param ttlSeconds   TTL cache w sekundach (domyślnie CACHE_TTL_SECONDS = 900)
 * @returns CachedContent do użycia przez config.cachedContent w gemini-provider (IND-19),
 *          lub null jeśli cache nie jest możliwy/opłacalny
 */
export async function getOrCreateGeminiCache(
  apiKey: string,
  modelName: string,
  systemPrompt: string,
  stableInstructions: string,
  ttlSeconds?: number
): Promise<CachedContent | null> {
  // Prune any stale entries from memory
  pruneExpiredGeminiCache();

  // ── Guard: model supports caching? ──
  if (!CACHEABLE_MODELS.has(modelName)) {
    return null;
  }

  // ── Guard: enough tokens to cache? ──
  const totalTokens =
    estimateTokens(systemPrompt) + estimateTokens(stableInstructions);
  const minTokens = MIN_CACHE_TOKENS[modelName] || DEFAULT_MIN_CACHE_TOKENS;
  if (totalTokens < minTokens) {
    console.log(
      `📦 OPT-26: Skipping cache - ${totalTokens} est. tokens < ${minTokens} minimum for ${modelName}`
    );
    return null;
  }

  const effectiveTTL =
    typeof ttlSeconds === 'number' && Number.isFinite(ttlSeconds) && ttlSeconds > 0
      ? Math.min(CACHE_TTL_SECONDS, Math.max(1, Math.floor(ttlSeconds)))
      : CACHE_TTL_SECONDS;
  const contentHash = hashContent(systemPrompt, stableInstructions, modelName);
  const cacheKey = `${crypto.createHash('sha256').update(apiKey).digest('hex')}_${contentHash}`;

  const existing = cacheStore.get(cacheKey);
  if (existing) {
    const now = Date.now();
    const remainingSeconds = (existing.expiresAt - now) / 1000;
    const ageSeconds = (now - existing.createdAt) / 1000;

    // Use cache if it's not expired (with 60s safety margin)
    if (remainingSeconds > 60) {
      existing.lastAccessedAt = now;

      // OPT-C04: Sliding window renewal - if less than half TTL remains, extend TTL via ai.caches.update
      const shouldRefresh = remainingSeconds < existing.ttlSeconds / 2;
      const retryCooldownExpired =
        !existing.lastRefreshFailedAt ||
        now - existing.lastRefreshFailedAt >= 30_000;

      if (shouldRefresh && retryCooldownExpired) {
        if (inFlightRefreshes.has(cacheKey)) {
          // Await existing concurrent refresh to avoid duplicate ai.caches.update
          await inFlightRefreshes.get(cacheKey);
        } else {
          const refreshPromise = (async () => {
            try {
              const ai = getAI(apiKey);
              if (existing.cachedContent.name && ai.caches?.update) {
                const updated = await ai.caches.update({
                  name: existing.cachedContent.name,
                  config: { ttl: `${effectiveTTL}s` },
                });
                if (updated) {
                  existing.cachedContent = {
                    ...existing.cachedContent,
                    ...updated,
                  };
                }
                recordCacheLease(modelName, existing.cachedContent.usageMetadata?.totalTokenCount ?? totalTokens, Math.max(0, (Date.now() + effectiveTTL * 1000 - existing.expiresAt) / 1000), false, existing.cachedContent.usageMetadata ? 'provider' : 'estimated');
                existing.createdAt = Date.now();
                existing.ttlSeconds = effectiveTTL;
                existing.expiresAt = Date.now() + effectiveTTL * 1000;
                delete existing.lastRefreshFailedAt;
                console.log(
                  `🔄 OPT-C04: Cache TTL refreshed via sliding window: ${existing.cachedContent.name} (+${effectiveTTL}s)`
                );
                return existing.cachedContent;
              }
              return null;
            } catch (refreshErr) {
              const errMsg =
                refreshErr instanceof Error
                  ? refreshErr.message
                  : String(refreshErr);
              if (errMsg.includes('NOT_FOUND') || errMsg.includes('404')) {
                // Remote cache expired or deleted on Google side - evict and recreate
                cacheStore.delete(cacheKey);
              } else {
                existing.lastRefreshFailedAt = Date.now();
                console.warn(
                  `⚠️ OPT-C04: Failed to refresh cache TTL for ${existing.cachedContent.name}: ${errMsg}`
                );
              }
              return null;
            } finally {
              inFlightRefreshes.delete(cacheKey);
            }
          })();

          inFlightRefreshes.set(cacheKey, refreshPromise);
          await refreshPromise;
        }
      }

      if (cacheStore.has(cacheKey)) {
        console.log(
          `✅ OPT-26: Cache hit: ${existing.cachedContent.name} (age: ${Math.floor(ageSeconds)}s, ~${totalTokens} tok cached, rem: ${Math.floor((existing.expiresAt - Date.now()) / 1000)}s)`
        );
        return existing.cachedContent;
      }
    } else {
      // Expired - remove stale entry
      cacheStore.delete(cacheKey);
      console.log(
        `🔄 OPT-26: Cache expired (${Math.floor(ageSeconds)}s), creating new...`
      );
    }
  }

  // ── Concurrent creation deduplication ──
  if (inFlightCreations.has(cacheKey)) {
    return await inFlightCreations.get(cacheKey)!;
  }

  // ── Create new cache via Gemini API ──
  const createPromise = (async () => {
    try {
      const ai = getAI(apiKey);

      const cachedContent = await ai.caches.create({
        model: modelName,
        config: {
          systemInstruction: systemPrompt,
          contents: [
            {
              role: 'user',
              parts: [{ text: stableInstructions }],
            },
            {
              role: 'model',
              parts: [
                {
                  text: CACHE_ACKNOWLEDGEMENT,
                },
              ],
            },
          ],
          ttl: `${effectiveTTL}s`,
          displayName: `zew-gm-${modelName}-${Date.now()}`,
        },
      });

      if (!cachedContent || !cachedContent.name) {
        console.warn(
          `⚠️ OPT-26: Cache creation returned invalid content (no name)`
        );
        return null;
      }

      recordCacheLease(modelName, cachedContent.usageMetadata?.totalTokenCount ?? totalTokens, effectiveTTL, true, cachedContent.usageMetadata ? 'provider' : 'estimated');
      const now = Date.now();
      // Store in local cache
      cacheStore.set(cacheKey, {
        cachedContent,
        modelName,
        tokens: cachedContent.usageMetadata?.totalTokenCount ?? totalTokens,
        tokenSource: cachedContent.usageMetadata ? 'provider' : 'estimated',
        contentHash,
        createdAt: now,
        lastAccessedAt: now,
        ttlSeconds: effectiveTTL,
        expiresAt: now + effectiveTTL * 1000,
      });

      console.log(
        `🆕 OPT-26: Cache created: ${cachedContent.name} (~${totalTokens} tok, TTL ${effectiveTTL}s, model: ${modelName})`
      );
      return cachedContent;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ OPT-26: Cache creation failed for ${modelName}: ${msg}`);
      // Graceful fallback - caller proceeds without cache
      return null;
    } finally {
      inFlightCreations.delete(cacheKey);
    }
  })();

  inFlightCreations.set(cacheKey, createPromise);
  return await createPromise;
}

/**
 * Wyczyść lokalny cache store (np. przy zmianie sesji)
 */
export function clearGeminiCacheStore(): void {
  cacheStore.clear();
  aiPool.clear();
  inFlightCreations.clear();
  inFlightRefreshes.clear();
  console.log('🗑️ OPT-26: Cache store cleared');
}

/**
 * Status cache'a do diagnostyki
 */
export function getGeminiCacheStatus(): {
  entries: number;
  caches: Array<{
    key: string;
    name?: string;
    ageSeconds: number;
    ttlSeconds: number;
    remainingSeconds: number;
    hash: string;
  }>;
} {
  const now = Date.now();
  return {
    entries: cacheStore.size,
    caches: Array.from(cacheStore.entries()).map(([key, entry]) => ({
      key,
      name: entry.cachedContent.name,
      ageSeconds: Math.floor((now - entry.createdAt) / 1000),
      ttlSeconds: entry.ttlSeconds,
      remainingSeconds: Math.max(0, Math.floor((entry.expiresAt - now) / 1000)),
      hash: entry.contentHash.slice(0, 8),
    })),
  };
}
