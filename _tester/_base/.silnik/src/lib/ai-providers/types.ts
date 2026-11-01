/**
 * Provider Abstraction Layer - typy i interfejsy (single-provider Gemini po IND-46).
 *
 * IND-12: refaktor ChatCompletionRequest na flat + opcjonalne sub-objects
 * (geminiOptions). Backward-compatible przez deprecated alias na top-level
 * (do usunięcia w v4.1).
 */

import type { CachedContent } from '@google/genai';

/**
 * Opcje specyficzne dla providera Gemini.
 * IND-12 PR-B Faza 2: pełna ekspozycja pól Gemini API.
 */
export interface GeminiExtraOptions {
  // === Kontekst ===
  /** Dodatkowe sekcje kontekstu dorzucane do system message (czas, RAG, era itp.) */
  additionalContext?: string[];
  /** Pliki PDF przez Gemini File API URIs */
  fileAttachments?: Array<{ fileUri: string; mimeType: string }>;

  // === Thinking (Gemini 2.5 i 3.x) ===
  /** Kontrola głębokości rozumowania dla Gemini 3.x */
  thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high' | 'auto';
  /** Dokładny budżet tokenów myślenia (0 = wyłączone / minimal, do 24576) */
  thinkingBudget?: number;

  // === Sampling ===
  /** Liczba najprawdopodobniejszych tokenów przy każdym kroku (1-100) */
  topK?: number;
  /** Liczba niezależnych kandydatów odpowiedzi (domyślnie 1) */
  candidateCount?: number;
  /** Max 5 ciągów stopujących - AI zatrzymuje generowanie gdy napotka jeden z nich */
  stopSequences?: string[];
  /** Ziarno losowości - ten sam seed = ten sam wynik dla tych samych ustawień */
  seed?: number;
  /** Kara za ponowne pojawienie się tematu (-2.0 do 2.0) */
  presencePenalty?: number;
  /** Kara za powtarzanie słów (-2.0 do 2.0) */
  frequencyPenalty?: number;

  // === Output ===
  /** Typ MIME odpowiedzi: text/plain (domyślnie) lub application/json */
  responseMimeType?: 'text/plain' | 'application/json';
  /** JSON Schema struktury odpowiedzi (wymaga responseMimeType=application/json) */
  responseSchema?: object;

  // === Safety ===
  /** Filtry bezpieczeństwa - 4 kategorie × 4 progi */
  safetySettings?: {
    harassment:
      | 'BLOCK_NONE'
      | 'BLOCK_ONLY_HIGH'
      | 'BLOCK_MEDIUM_AND_ABOVE'
      | 'BLOCK_LOW_AND_ABOVE';
    hateSpeech:
      | 'BLOCK_NONE'
      | 'BLOCK_ONLY_HIGH'
      | 'BLOCK_MEDIUM_AND_ABOVE'
      | 'BLOCK_LOW_AND_ABOVE';
    sexuallyExplicit:
      | 'BLOCK_NONE'
      | 'BLOCK_ONLY_HIGH'
      | 'BLOCK_MEDIUM_AND_ABOVE'
      | 'BLOCK_LOW_AND_ABOVE';
    dangerousContent:
      | 'BLOCK_NONE'
      | 'BLOCK_ONLY_HIGH'
      | 'BLOCK_MEDIUM_AND_ABOVE'
      | 'BLOCK_LOW_AND_ABOVE';
  };

  // === Tools / Function Calling (eksperymentalne) ===
  /** Tablica deklaracji funkcji w formacie [{name, description?, parameters?}] */
  tools?: object[];
  /** Tryb wyboru narzędzi (placeholder - pełna integracja w przyszłości) */
  toolConfig?: object;

  // === Cache (IND-13) ===
  /** Nazwa istniejącego cache Gemini (np. cachedContents/abc123) - user-manual, opcjonalne */
  cachedContent?: string;
  /** Włącz cache - musi być true gdy cachedContent jest ustawione */
  enableCache?: boolean;
  /**
   * Wynik getOrCreateGeminiCache() - obiekt CachedContent z API (IND-13).
   * Gdy ustawiony, gemini-provider używa config.cachedContent = cache.name (IND-19).
   */
  resolvedCachedContent?: CachedContent;
}

export interface ChatCompletionRequest {
  /** Total provider budget across model attempts; cancellation must not start a fallback. */
  timeoutMs?: number;
  signal?: AbortSignal;
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  userMessage: string;
  temperature: number;
  topP: number;
  maxOutputTokens: number;

  geminiOptions?: GeminiExtraOptions;

  /** @deprecated użyj geminiOptions.thinkingLevel - alias zostanie usunięty w v4.1 */
  thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high' | 'auto';
  /** @deprecated użyj geminiOptions.fileAttachments - alias zostanie usunięty w v4.1 */
  fileAttachments?: Array<{ fileUri: string; mimeType: string }>;
  /** @deprecated użyj geminiOptions.additionalContext - alias zostanie usunięty w v4.1 */
  additionalContext?: string[];
}

export interface StreamChunk {
  text: string;
}

export interface CompletionUsage {
  /** Charged reasoning tokens, separate from visible candidate output. */
  thinkingTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens: number;
  model: string;
  // OPT-26: tokeny wejścia obsłużone z cache promptu (Gemini cachedContentTokenCount).
  // Liczone z ~90% rabatem; bez tego pola telemetria/koszt fałszywie pokazywały 0.
  cachedTokens?: number;
}

export interface StreamingChatResult {
  stream: AsyncIterable<StreamChunk>;
  getUsage: () => Promise<CompletionUsage | null>;
  /** Dostępne dopiero po skonsumowaniu całego streamu. */
  getFinishReason: () => string | undefined;
}

export interface ChatResult {
  text: string;
  usage: CompletionUsage | null;
}

export interface IChatProvider {
  readonly type: 'gemini';
  streamChat(request: ChatCompletionRequest): Promise<StreamingChatResult>;
  chat(request: ChatCompletionRequest): Promise<ChatResult>;
  testConnection(): Promise<{ success: boolean; error?: string }>;
}
