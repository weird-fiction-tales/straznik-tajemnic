/**
 * IND-222: detekcja błędu "model nie istnieje" (404 NOT_FOUND) z SDK Gemini.
 *
 * Wydzielone z run-chat-pipeline.ts jako czysta funkcja bez zależności od
 * `next/server`, by dało się testować w izolacji (import run-chat-pipeline
 * ciągnie cały łańcuch next/server + 17 deps).
 *
 * Detekcja po status/message, NIE instanceof (mock-safe, lekcja IND-191
 * classifyTtsError - mock klasy ApiError w Jest = inna referencja, instanceof pęka).
 */
export function isModelNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: number; message?: string };
  if (e.status === 404) return true;
  return /not found|NOT_FOUND/i.test(e.message ?? '');
}

/**
 * Only authentication evidence should open the API-key dialog. Generic Gemini
 * INVALID_ARGUMENT (400) and PERMISSION_DENIED (403) also describe valid-key
 * configuration/model-access failures and must retain their original handling.
 */
export function isInvalidKeyError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: number | string; code?: number | string; message?: unknown };
  const status = e.status ?? e.code;
  if (status === 401 || status === 'UNAUTHENTICATED') return true;
  const message = typeof e.message === 'string' ? e.message : '';
  return /\b(?:API_KEY_(?:INVALID|EXPIRED)|UNAUTHENTICATED)\b|\bAPI[_ ]key\s+(?:(?:is|has)\s+)?(?:not valid|invalid|expired)\b|\b(?:invalid|expired)\s+API[_ ]key\b/i.test(message);
}

/**
 * Detekcja błędu wyczerpania środków przedpłaconych (prepayment credits) w Google AI Studio (HTTP 402).
 */
export function isPrepaymentCreditsError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { status?: number; code?: number; message?: string };
  const msg = typeof err === 'string' ? err : e.message ?? '';
  const status = e.status ?? e.code;
  if (status === 402) return true;
  return /"code":\s*402|prepayment credits are depleted/i.test(msg);
}

/**
 * Detekcja błędu limitów lub wyczerpania środków (402 Prepayment / 429 RESOURCE_EXHAUSTED / Quota).
 */
export function isQuotaOrCreditsError(err: unknown): boolean {
  if (!err) return false;
  if (isPrepaymentCreditsError(err)) return true;
  const e = err as { status?: number; code?: number; message?: string };
  const msg = typeof err === 'string' ? err : e.message ?? '';
  const status = e.status ?? e.code;
  if (status === 429) return true;
  return /RESOURCE_EXHAUSTED|quota|rate[_ ]limit|too many requests|Quota exceeded/i.test(msg);
}


