/**
 * Embedding Service
 *
 * Obsługa embeddingów dla systemu pamięci RAG.
 * Używa Google Gemini Embedding API do generowania wektorów
 * i wyszukiwania semantycznego w archiwalnych chunkach.
 *
 * v4.0: Upgrade do gemini-embedding-001 (#1 MTEB Multilingual).
 * IND-164 (sesja 78): Dual-version support - V1 (default) = 768 dim (MRL truncated),
 * V2 (opt-in via RAG_VERSION=v2) = 3072 dim (native). Helper getEmbeddingDimensions().
 */

import { MemoryIndexEntry, MemoryIndex } from './types';
import { getGeminiClient } from './gemini-client-pool';
// IND-275 T1: model embeddingu + wymiary scentralizowane w model-registry.
import {
  LOCAL_EMBEDDING_MODEL,
  EMBEDDING_DIM_LOCAL,
  EMBEDDING_MODEL,
  EMBEDDING_DIM_V1,
  EMBEDDING_DIM_V2,
} from './model-registry';

// ============================================================================
// CONSTANTS
// ============================================================================

const SIMILARITY_THRESHOLD = 0.7; // Minimum similarity to consider relevant
const MAX_RESULTS = 5;

// ============================================================================
// RAG_VERSION & LOCAL EMBEDDINGS SUPPORT
// ============================================================================

const RAG_VERSION_V1_DIM = EMBEDDING_DIM_V1;
const RAG_VERSION_V2_DIM = EMBEDDING_DIM_V2;

type FeatureExtractorOutput = {
  data: Float32Array;
  dims?: number[];
};

type FeatureExtractorFn = (
  text: string | string[],
  options?: Record<string, unknown>
) => Promise<FeatureExtractorOutput>;

let _cachedDimensions: number | null = null;
let _localPipelinePromise: Promise<FeatureExtractorFn> | null = null;

/**
 * Zwraca instancję lokalnego pipeline ONNX (@xenova/transformers).
 * Ładowana leniwie (singleton w pamięci procesu Node.js).
 */
async function getLocalPipeline(): Promise<FeatureExtractorFn> {
  if (!_localPipelinePromise) {
    _localPipelinePromise = (async () => {
      try {
        const { pipeline, env } = await import('@xenova/transformers');
        // Unikaj zbędnych warningów i konfiguruj lokalny cache
        if (env) {
          env.allowLocalModels = true;
          env.useBrowserCache = false;
        }
        console.log(`🧠 [LocalEmbeddings] Inicjalizacja lokalnego modelu ONNX: ${LOCAL_EMBEDDING_MODEL}`);
        const extractor = await pipeline('feature-extraction', LOCAL_EMBEDDING_MODEL);
        console.log(`✅ [LocalEmbeddings] Model ${LOCAL_EMBEDDING_MODEL} gotowy do pracy.`);
        return extractor as FeatureExtractorFn;
      } catch (err) {
        console.error('❌ [LocalEmbeddings] Błąd inicjalizacji @xenova/transformers:', err);
        _localPipelinePromise = null;
        throw err;
      }
    })();
  }
  return _localPipelinePromise;
}

/**
 * Zwraca rozmiar embeddingu dla aktywnej wersji RAG.
 * Domyślnie używa lokalnego modelu (EMBEDDING_DIM_LOCAL = 1024 dim).
 * Gdy RAG_PROVIDER=gemini, respektuje RAG_VERSION (V1 = 768 dim, V2 = 3072 dim).
 *
 * Cache module-level - read env once per Next.js serverless instance.
 */
export function getEmbeddingDimensions(): number {
  if (_cachedDimensions !== null) return _cachedDimensions;
  if (process.env.RAG_PROVIDER === 'gemini') {
    const version = process.env.RAG_VERSION === 'v2' ? 'v2' : 'v1';
    _cachedDimensions =
      version === 'v2' ? RAG_VERSION_V2_DIM : RAG_VERSION_V1_DIM;
  } else {
    _cachedDimensions = EMBEDDING_DIM_LOCAL;
  }
  return _cachedDimensions;
}

/**
 * Reset module-level cache. Eksportowane DLA TESTÓW (beforeEach).
 * NIE używać w runtime kodzie - wartość embedding dim jest stała per process.
 */
export function _resetEmbeddingDimsCache(): void {
  _cachedDimensions = null;
}

/**
 * Typ zadania dla embeddingu - pomaga modelowi tworzyć optymalne wektory:
 * - RETRIEVAL_DOCUMENT: archiwizowany dokument (do indeksowania w bazie wektorowej)
 * - RETRIEVAL_QUERY:    zapytanie wyszukiwawcze (do wykrycia podobnych dokumentów)
 * - SEMANTIC_SIMILARITY/CLASSIFICATION/CLUSTERING: pozostałe domeny
 * Brak parametru = domyślne SDK (kompatybilne wstecz z istniejącymi wektorami).
 */
export type EmbeddingTaskType =
  | 'RETRIEVAL_DOCUMENT'
  | 'RETRIEVAL_QUERY'
  | 'SEMANTIC_SIMILARITY'
  | 'CLASSIFICATION'
  | 'CLUSTERING';

// ============================================================================
// COSINE SIMILARITY
// ============================================================================

/**
 * Oblicz podobieństwo kosinusowe między dwoma wektorami.
 * Wartość 1.0 = identyczne, 0.0 = ortogonalne, -1.0 = przeciwne.
 *
 * `ArrayLike<number>` (nie `number[]`) - akceptuje też `Float32Array` z binarnego
 * formatu RAG (IND-263). Indeksowanie + `.length` działa identycznie na obu.
 */
export function cosineSimilarity(
  a: ArrayLike<number>,
  b: ArrayLike<number>
): number {
  if (a.length !== b.length) {
    console.error('Vector length mismatch:', a.length, 'vs', b.length);
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

// ============================================================================
// EMBEDDING SERVICE
// ============================================================================

class EmbeddingService {
  private apiKey: string | null = null;
  private memoryIndex: MemoryIndex | null = null;

  /**
   * Inicjalizacja z kluczem API (opcjonalny dla lokalnego RAG, zachowany dla kompatybilności).
   */
  initialize(apiKey?: string): void {
    if (!apiKey) return;
    if (this.apiKey === apiKey) return;
    this.apiKey = apiKey;
    console.log('🧠 EmbeddingService initialized');
  }

  /**
   * Załaduj indeks pamięci z GCS (lub z cache).
   */
  setMemoryIndex(index: MemoryIndex): void {
    this.memoryIndex = index;
    console.log(`🧠 Memory index loaded: ${index.entries.length} entries`);
  }

  /**
   * Pobierz aktualny indeks pamięci.
   */
  getMemoryIndex(): MemoryIndex | null {
    return this.memoryIndex;
  }

  /**
   * Generuj embedding dla tekstu.
   * Domyślnie: 100% lokalny model ONNX (Xenova/bge-m3, 1024 dim), zero chmury i zero klucza API.
   * Fallback chmurowy: tylko gdy RAG_PROVIDER=gemini.
   *
   * @param text Tekst do zembedowania
   * @param taskType Opcjonalny typ zadania (RETRIEVAL_DOCUMENT/RETRIEVAL_QUERY/...).
   */
  async generateEmbedding(
    text: string,
    taskType?: EmbeddingTaskType,
    apiKey?: string
  ): Promise<number[] | null> {
    if (!text || text.trim() === '') return null;

    // Tryb chmurowy (opt-in lub testowy)
    if (process.env.RAG_PROVIDER === 'gemini') {
      return this.generateGeminiEmbedding(text, taskType, apiKey);
    }

    // Tryb domyślny: 100% LOKALNY ONNX (suwerenność danych)
    try {
      const extractor = await getLocalPipeline();
      const output = await extractor(text, { pooling: 'mean', normalize: true });
      if (output?.data) {
        return Array.from(output.data);
      }
      return null;
    } catch (localErr) {
      console.error('❌ [LocalEmbeddings] Błąd generowania lokalnego embeddingu:', localErr);
      // Bezpieczna degradacja: zwracamy null, aby nie mieszać wymiarów i przestrzeni wektorowej
      return null;
    }
  }

  /**
   * Generates an embedding with the local ONNX model regardless of RAG_PROVIDER.
   * Use only for app-owned, approved dossier records; never falls back to a remote API.
   */
  async generateLocalEmbedding(text: string): Promise<number[] | null> {
    if (!text || text.trim() === '') return null;
    try {
      const extractor = await getLocalPipeline();
      const output = await extractor(text, { pooling: 'mean', normalize: true });
      return output?.data ? Array.from(output.data) : null;
    } catch (localErr) {
      console.error('❌ [LocalEmbeddings] Błąd generowania lokalnego embeddingu dossier:', localErr);
      return null;
    }
  }

  /**
   * Generowanie embeddingu przez Google Gemini API (fallback / legacy).
   */
  private async generateGeminiEmbedding(
    text: string,
    taskType?: EmbeddingTaskType,
    apiKey?: string
  ): Promise<number[] | null> {
    const key = apiKey || this.apiKey || process.env.GEMINI_API_KEY;
    const ai = getGeminiClient(key);
    if (!ai) {
      console.error('❌ EmbeddingService: Brak klienta Gemini (wymagany klucz API)');
      return null;
    }

    try {
      const dims = getEmbeddingDimensions();
      const result = await ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: text,
        config: {
          ...(dims === RAG_VERSION_V1_DIM && { outputDimensionality: dims }),
          ...(taskType && { taskType }),
        },
      });

      const embedding = result.embeddings?.[0]?.values ?? null;
      if (!embedding || embedding.length !== dims) {
        console.warn(
          '⚠️ Unexpected embedding dimensions:',
          embedding?.length,
          `(expected ${dims})`
        );
        return null;
      }
      return embedding;
    } catch (error) {
      console.error('❌ Error generating Gemini embedding:', error);
      return null;
    }
  }

  /**
   * Batch embedding generation.
   * W trybie lokalnym: natywny batching w ONNX runtime.
   */
  async generateBatchEmbeddings(
    texts: string[],
    taskType?: EmbeddingTaskType,
    apiKey?: string
  ): Promise<(number[] | null)[]> {
    if (texts.length === 0) return [];

    if (process.env.RAG_PROVIDER === 'gemini') {
      const results: (number[] | null)[] = [];
      for (const text of texts) {
        results.push(await this.generateGeminiEmbedding(text, taskType, apiKey));
      }
      return results;
    }

    try {
      const extractor = await getLocalPipeline();
      const output = await extractor(texts, { pooling: 'mean', normalize: true });
      if (output?.data && output?.dims) {
        const [batchSize, dim] = output.dims;
        const results: (number[] | null)[] = [];
        for (let i = 0; i < batchSize; i++) {
          const slice = output.data.subarray(i * dim, (i + 1) * dim);
          results.push(Array.from(slice));
        }
        return results;
      }
      // Fallback sekwencyjny
      const results: (number[] | null)[] = [];
      for (const t of texts) {
        results.push(await this.generateEmbedding(t, taskType, apiKey));
      }
      return results;
    } catch (err) {
      console.error('❌ [LocalEmbeddings] Błąd batch embeddingu, fallback sekwencyjny:', err);
      const results: (number[] | null)[] = [];
      for (const text of texts) {
        results.push(await this.generateEmbedding(text, taskType, apiKey));
      }
      return results;
    }
  }

  /**
   * Wyszukaj najbardziej podobne chunki do zapytania.
   * Zwraca listę wpisów posortowaną od najwyższego podobieństwa.
   */
  async searchSimilarChunks(
    query: string,
    maxResults: number = MAX_RESULTS
  ): Promise<Array<MemoryIndexEntry & { similarity: number }>> {
    if (!this.memoryIndex || this.memoryIndex.entries.length === 0) {
      console.log('⚠️ No memory index available for search');
      return [];
    }

    const queryEmbedding = await this.generateEmbedding(
      query,
      'RETRIEVAL_QUERY'
    );
    if (!queryEmbedding) {
      return [];
    }

    // Oblicz podobieństwo dla każdego wpisu
    const results = this.memoryIndex.entries
      .map((entry) => ({
        ...entry,
        similarity: cosineSimilarity(queryEmbedding, entry.embedding),
      }))
      .filter((entry) => entry.similarity >= SIMILARITY_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxResults);

    console.log(
      `🔍 Found ${results.length} similar chunks for query: "${query.slice(0, 50)}..."`
    );
    return results;
  }

  /**
   * Buduj sekcję "WSPOMNIENIA" do wstrzyknięcia w prompt AI.
   */
  async buildMemoryPromptSection(query: string): Promise<string> {
    const relevantChunks = await this.searchSimilarChunks(query);

    if (relevantChunks.length === 0) {
      return '';
    }

    let section = '\n## WSPOMNIENIA (z archiwum sesji)\n';
    section +=
      'Poniższe fragmenty dotyczą wcześniejszych wydarzeń, które mogą być istotne:\n\n';

    for (const chunk of relevantChunks) {
      const simPercent = Math.round(chunk.similarity * 100);
      section += `### Wspomnienie (podobieństwo: ${simPercent}%)\n`;
      section += `*Czas w grze: ${chunk.gameTimestamp}*\n`;
      section += `${chunk.summary}\n`;
      if (chunk.tags.length > 0) {
        section += `Tagi: ${chunk.tags.join(', ')}\n`;
      }
      section += '\n';
    }

    return section;
  }

  /**
   * Stwórz nowy wpis do indeksu pamięci.
   * Używane przy archiwizacji nowego chunka.
   */
  async createIndexEntry(
    chunkId: string,
    chunkText: string,
    summary: string,
    gameTimestamp: string,
    tags: string[],
    messageRange: { start: number; end: number },
    taskType?: EmbeddingTaskType
  ): Promise<MemoryIndexEntry | null> {
    const embedding = await this.generateEmbedding(chunkText, taskType);
    if (!embedding) {
      return null;
    }

    const entry: MemoryIndexEntry = {
      chunkId,
      embedding,
      summary,
      gameTimestamp,
      realTimestamp: new Date().toISOString(),
      tags,
      messageRange,
      text: chunkText,
    };

    return entry;
  }

  /**
   * Dodaj wpis do lokalnego indeksu pamięci.
   */
  addToIndex(entry: MemoryIndexEntry): void {
    if (!this.memoryIndex) {
      this.memoryIndex = {
        version: '1.0.0',
        sessionId: 'default',
        entries: [],
        lastUpdated: new Date().toISOString(),
      };
    }

    this.memoryIndex.entries.push(entry);
    this.memoryIndex.lastUpdated = new Date().toISOString();
    console.log(`🧠 Added entry to memory index: ${entry.chunkId}`);
  }

  /**
   * Wyeksportuj indeks pamięci (do zapisania w GCS).
   */
  exportIndex(): MemoryIndex | null {
    return this.memoryIndex;
  }
}

// Singleton export
export const embeddingService = new EmbeddingService();
