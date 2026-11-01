/**
 * runRAGAndSummary - async helper dla sekcji 7 route.ts (IND-71 micro 2/3).
 *
 * Uruchamia 2 operacje równolegle (OPT-09):
 *   1. RAG retrieval (retrievalService.retrieve) - semantic search z sessions/{id}
 *      + adventures/{id} + rules namespaces, graceful fallback przy błędzie.
 *   2. CampaignContextEngine - budowa aktywnej historii, kompresja zależna od
 *      limitu modelu i retrieval trwałej pamięci kampanii.
 *
 * Side effects (controlled):
 *   - embeddingService.initialize(geminiKey) gdy geminiKey present
 *   - console.warn dla RAG failure
 *   - console.log dla RAG success metrics
 *
 * Dependencies (mockowalne przez jest): retrievalService, CampaignContextEngine,
 * embeddingService.
 */

import { embeddingService } from '@/lib/embedding-service';
import { retrievalService } from '@/lib/vector-db/retrieval-service';
import type { Message } from '@/lib/types';
import { getCampaignContextEngine } from '@/core/memory/context-engine';
import type { CampaignMemoryScope } from '@/core/memory/types';
import { drainMemoryIndex } from '@/core/memory/index-queue';

export interface RunRAGAndSummaryOpts {
  message: string;
  messages?: Message[];
  sessionId?: string;
  apiKey: string;
  geminiKey: string | null | undefined;
  /**
   * Slug książki źródłowej aktywnej przygody (sourceBookId). Przekazany dalej do
   * retrievalService.retrieve → zawęża wyniki z namespace 'adventures' do tej książki.
   */
  adventureSource?: string;
  /**
   * ID aktywnej przygody (dla izolacji namespace'u adventures/{id}).
   */
  adventureId?: string;
  /** Język promptu RAG (domyślnie 'pl') */
  locale?: 'pl' | 'en';
  modelId: string;
  memoryScope: CampaignMemoryScope | null;
  recipientIds?:string[];
  sceneEntityIds?:string[];
  allowedNamespaces?:string[];
  availableContextTokens?: number;
  adaptiveTokenThreshold?: number;
  adaptiveTurnThreshold?: number;
}

/**
 * Telemetry metadata o RAG retrieval (spawn task ai_request_completed).
 *
 * Pola pochodzą z RetrievalResponse + per-hit RetrievalResult.namespace
 * (publiczne pole na każdym hicie, lib/vector-db/retrieval-service.ts:31).
 * Namespace extraction: realne hit-namespaces (nie default list) - lepsza
 * jakość danych w PostHog.
 */
export interface RagMeta {
  /** Ilość hits zwróconych z retrieval (po RRF merge + filter minScore) */
  hits: number;
  /** Źródło retrieval: 'hybrid' | 'semantic' | 'local' | 'mixed' | 'none' */
  source: string;
  /** Czas retrieval w ms (subset całego durationMs requestu) */
  durationMs: number;
  /** CSV znormalizowanych namespace typów hit-ów: 'rules,adventures,sessions' */
  namespaces: string;
  /** Liczba unikalnych typów namespaces (po normalize): 3 dla powyższego CSV */
  namespaceCount: number;
}

export interface RunRAGAndSummaryResult {
  ragSection: string;
  summarySection: string | null;
  ragMeta: RagMeta | null;
  contextMessages: Message[];
  campaignMemorySection: string;
}

export async function runRAGAndSummary(
  opts: RunRAGAndSummaryOpts
): Promise<RunRAGAndSummaryResult> {
  const {
    message,
    messages,
    sessionId,
    apiKey,
    geminiKey,
    adventureSource,
    adventureId,
    locale,
    modelId,
    memoryScope,
  } = opts;

  // OPT-09: embedding service init (idempotent, no-op gdy już zainicjalizowany)
  if (geminiKey) {
    embeddingService.initialize(geminiKey);
  }

  const queryEmbedding = await embeddingService.generateEmbedding(message,'RETRIEVAL_QUERY').catch(()=>null);
  if(memoryScope) void drainMemoryIndex(memoryScope).catch(()=>{});
  const ragPromise = retrievalService
    .retrieve({
      query: message,
      sessionId,
      adventureSource,
      adventureId,
      locale,
      memoryScope:memoryScope??undefined,queryEmbedding,
      namespaces: opts.allowedNamespaces,
    })
    .catch((ragErr) => {
      console.warn('⚠️ RAG retrieval failed:', ragErr);
      return null;
    });

  const contextPromise = getCampaignContextEngine().prepareContext({
    messages,
    query: message,
    modelId,
    apiKey,
    scope: memoryScope,
    locale: locale ?? 'pl',
    queryEmbedding,recipientIds:opts.recipientIds,sceneEntityIds:opts.sceneEntityIds,
    availableContextTokens: opts.availableContextTokens,
    adaptiveTokenThreshold: opts.adaptiveTokenThreshold,
    adaptiveTurnThreshold: opts.adaptiveTurnThreshold,
  });

  const [retrieval, campaignContext] = await Promise.all([
    ragPromise,
    contextPromise,
  ]);

  let ragSection = '';
  let ragMeta: RagMeta | null = null;

  if (retrieval) {
    if (retrieval.promptSection) {
      ragSection = retrieval.promptSection;
      console.log(
        `🔍 RAG retrieval: ${retrieval.results.length} results from ${retrieval.source} (${retrieval.durationMs}ms)`
      );
    }

    // Extract realne hit-namespaces z per-result.namespace (publiczne pole).
    // Normalize: 'sessions/abc' → 'sessions', dedupe via Set, sort, join CSV.
    const namespaceTypes = Array.from(
      new Set(retrieval.results.map((r) => r.namespace.split('/')[0]))
    ).sort();
    const namespaces = namespaceTypes.join(',');

    ragMeta = {
      hits: retrieval.results.length,
      source: retrieval.source,
      durationMs: retrieval.durationMs,
      namespaces,
      namespaceCount: namespaceTypes.length,
    };
  }

  return {
    ragSection,
    summarySection: campaignContext.summarySection,
    ragMeta,
    contextMessages: campaignContext.messages,
    campaignMemorySection: campaignContext.memorySection,
  };
}
