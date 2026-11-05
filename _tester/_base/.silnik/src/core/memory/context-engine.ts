import { createHash } from 'crypto';
import { CampaignContextBudgetError, estimateTokens } from '@/lib/ai-providers/context-budget';
export { CampaignContextBudgetError } from '@/lib/ai-providers/context-budget';
import { DEFAULT_GEMINI_MODEL } from '@/lib/ai-providers/constants';
import { getGeminiClient } from '@/lib/gemini-client-pool';
import { getContextLimit } from '@/lib/model-registry';
import type { Message } from '@/lib/types';
import { getCampaignMemoryLedgerStore, type CampaignMemoryLedgerStore } from './ledger-store';
import { searchCampaignMemory, type CampaignMemoryRetrieval } from './retrieval';
import { sharedKnowledge, publicMemoryText, SHARED_KNOWLEDGE_POLICY } from './knowledge-policy';
import type { MemoryLedgerEntry } from './types';
import type { CampaignMemoryScope, RevealedMemoryFact } from './types';

export const COMPRESSION_THRESHOLD_RATIO = 0.5;
export const ADAPTIVE_TOKEN_THRESHOLD = 20_000;
export const ADAPTIVE_TURN_THRESHOLD = 20;
export const MAX_HEAD_PRESERVED_MESSAGES = 4;
export const MAX_TAIL_PRESERVED_MESSAGES = 10;
const HEAD_BUDGET_RATIO = 0.1;
const TAIL_BUDGET_RATIO = 0.25;
const CHECKPOINT_STALENESS_MESSAGES = 20;

export function countConversationTurns(messages: Message[]): number {
  const userCount = messages.filter((m) => m.role === 'user').length;
  return Math.max(userCount, Math.floor(messages.length / 2));
}


// The ledger owns persistence/migration of these optional fields. Legacy rows
// remain readable, but are deliberately ineligible for checkpoint reuse.
declare module './types' {
  interface CampaignCompressionCheckpoint {
    sourceHash?: string;
    locale?: 'pl' | 'en';
    modelId?: string;
  }
}

type RetrievalOptions = { queryEmbedding?: number[] | null; locale?: 'pl' | 'en'; recipientIds?:string[]; sceneEntityIds?:string[] };
// Compatible with the old three-argument implementation during integration.
const retrieveMemory: (
  scope: CampaignMemoryScope,
  query: string,
  ledger: CampaignMemoryLedgerStore,
  options?: RetrievalOptions,
) => Promise<CampaignMemoryRetrieval> = searchCampaignMemory;

export interface PreparedCampaignContext {
  messages: Message[];
  summarySection: string | null;
  memorySection: string;
  retrieval: CampaignMemoryRetrieval | null;
  compacted: boolean;
}

function messageTokens(message: Message): number {
  return estimateTokens(message.content) + 8;
}

function sourceHash(messages: Message[]): string {
  return createHash('sha256').update(JSON.stringify(messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: publicMemoryText(message.content),
  })))).digest('hex');
}

type Compaction = Pick<PreparedCampaignContext, 'messages' | 'summarySection' | 'compacted'>;

// Validate only. Selection belongs to compaction, never to a second lossy pass.
export function fitContext(context: Compaction, budget: number): Compaction {
  const required = context.messages.reduce((n, m) => n + messageTokens(m), 0)
    + estimateTokens(context.summarySection ?? '');
  if (!Number.isFinite(budget) || budget < 0 || required > budget) {
    throw new CampaignContextBudgetError(required, budget);
  }
  return context;
}

function protectedHistoryStart(messages: Message[]): number {
  const lastUser = messages.map(m => m.role).lastIndexOf('user');
  if (lastUser < 0) return Math.max(0, messages.length - 1);
  // Keep the GM's preceding response together with the action it prompted.
  for (let i = lastUser - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') return i;
  }
  return lastUser;
}

function takeWithinBudget(messages: Message[], budget: number, fromEnd: boolean, maxMessages?: number): Message[] {
  const selected: Message[] = [];
  let used = 0;
  const indexes = fromEnd
    ? Array.from({ length: messages.length }, (_, index) => messages.length - 1 - index)
    : Array.from({ length: messages.length }, (_, index) => index);
  for (const index of indexes) {
    if (maxMessages !== undefined && selected.length >= maxMessages) break;
    const cost = estimateTokens(messages[index].content) + 8;
    if (used + cost > budget) break;
    selected.push(messages[index]);
    used += cost;
  }
  return fromEnd ? selected.reverse() : selected;
}

function buildSummarySection(summary: string, start: number, end: number, locale: 'pl' | 'en'): string {
  const heading = locale === 'en' ? 'CAMPAIGN CONTEXT SUMMARY' : 'PODSUMOWANIE KONTEKSTU KAMPANII';
  return `\n## ${heading} (messages ${start}-${end})\n${summary}`;
}

const SUMMARY_INSTRUCTION = `Select relevant source IDs from the supplied revealed campaign records. Return only JSON {"sourceIds": ["id"]}. Never invent IDs or rewrite facts. Player declarations are not confirmed facts.`;

function groundedSummary(raw: string, entries: MemoryLedgerEntry[]): string | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || !('sourceIds' in value) || !Array.isArray(value.sourceIds)) return null;
    const ids: unknown[] = value.sourceIds;
    const byId = new Map(entries.map(e => [e.id, e]));
    if (!ids.length || ids.some(id => typeof id !== 'string' || !byId.has(id))) return null;
    return renderSources(entries.filter(e => ids.includes(e.id)));
  } catch { return null; }
}

function renderSources(entries: MemoryLedgerEntry[]): string {
  return entries.map(e => `- [${e.status ?? (e.role === 'user' ? 'player declaration' : 'revealed narration')}; ${e.sourceMessageIds.join(', ')}] ${e.text}`).join('\n');
}

export class CampaignContextEngine {
  constructor(private readonly ledger: CampaignMemoryLedgerStore = getCampaignMemoryLedgerStore()) {}

  async prepareContext(input: {
    messages?: Message[];
    query: string;
    modelId: string;
    apiKey: string;
    scope: CampaignMemoryScope | null;
    locale: 'pl' | 'en';
    contextLimitOverride?: number;
    queryEmbedding?: number[] | null;
    recipientIds?:string[];
    sceneEntityIds?:string[];
    /** Remaining input budget after other prompt sections, output reserve and 10% margin. */
    availableContextTokens?: number;
    adaptiveTokenThreshold?: number;
    adaptiveTurnThreshold?: number;
  }): Promise<PreparedCampaignContext> {
    const messages = input.messages ?? [];
    const retrieval = input.scope ? await this.searchCampaignMemory(input.scope, input.query, {
      queryEmbedding: input.queryEmbedding, locale: input.locale,
      recipientIds: input.recipientIds, sceneEntityIds: input.sceneEntityIds,
    }) : null;
    const totalBudget = input.availableContextTokens ?? input.contextLimitOverride ?? getContextLimit(input.modelId);
    const protectedCost = messages.slice(protectedHistoryStart(messages)).reduce((sum, m) => sum + messageTokens(m), 0);
    const reserve = Math.min(1200, estimateTokens(retrieval?.promptSection ?? ''), Math.max(0, totalBudget - protectedCost));
    const compaction = await this.compactIfNeeded({
        messages,
        modelId: input.modelId,
        apiKey: input.apiKey,
        scope: input.scope,
        locale: input.locale,
        contextLimitOverride: input.contextLimitOverride,
        availableContextTokens: totalBudget - reserve,
        adaptiveTokenThreshold: input.adaptiveTokenThreshold,
        adaptiveTurnThreshold: input.adaptiveTurnThreshold,
      });
    const budget = input.availableContextTokens ?? input.contextLimitOverride ?? getContextLimit(input.modelId);
    const remaining = Math.max(0, Math.floor(budget)
      - compaction.messages.reduce((sum, message) => sum + messageTokens(message), 0)
      - estimateTokens(compaction.summarySection ?? ''));
    // Memory has lower priority than the current action and conversation. Keep
    // complete lines only, and suppress an orphan heading when no fact fits.
    const lines = (retrieval?.promptSection ?? '').split('\n');
    let memorySection = '';
    for (const line of lines) {
      const next = memorySection ? `${memorySection}\n${line}` : line;
      if (estimateTokens(next) > remaining) break;
      memorySection = next;
    }
    if (!memorySection.split('\n').some((line) => line.startsWith('- '))) memorySection = '';
    return {
      ...compaction,
      retrieval,
      memorySection,
    };
  }

  recordCompletedTurn(input: {
    scope: CampaignMemoryScope;
    sessionId: string;
    messageId: string;
    userMessageId?: string;
    userText: string;
    assistantText: string;
    facts?: RevealedMemoryFact[];
  }): number {
    return this.ledger.recordConversationTurn(input);
  }

  async searchCampaignMemory(scope: CampaignMemoryScope, query: string, options?: RetrievalOptions): Promise<CampaignMemoryRetrieval> {
    return retrieveMemory(scope, query, this.ledger, options);
  }

  async compactIfNeeded(input: {
    messages: Message[];
    modelId: string;
    apiKey: string;
    scope: CampaignMemoryScope | null;
    locale: 'pl' | 'en';
    contextLimitOverride?: number;
    availableContextTokens?: number;
    adaptiveTokenThreshold?: number;
    adaptiveTurnThreshold?: number;
  }): Promise<Pick<PreparedCampaignContext, 'messages' | 'summarySection' | 'compacted'>> {
    input = { ...input, messages: input.messages.map(m => ({ ...m, content: publicMemoryText(m.content) })) };
    const limit = input.availableContextTokens ?? input.contextLimitOverride ?? getContextLimit(input.modelId);
    if (!Number.isFinite(limit) || limit < 0) throw new RangeError('Invalid available context token budget');
    const budget = Math.floor(limit);
    const original: Compaction = { messages: input.messages, summarySection: null, compacted: false };
    // Preflight before any compressor call, including cooldown and scope-less paths.
    const protectedStart = protectedHistoryStart(input.messages);
    fitContext({ ...original, messages: input.messages.slice(protectedStart) }, budget);
    const fallback = () => fitContext(original, budget);
    const total = input.messages.reduce((sum, entry) => sum + estimateTokens(entry.content) + 8, 0);

    const adaptiveTokenThreshold = input.adaptiveTokenThreshold ?? ADAPTIVE_TOKEN_THRESHOLD;
    const adaptiveTurnThreshold = input.adaptiveTurnThreshold ?? ADAPTIVE_TURN_THRESHOLD;

    const baseThreshold = input.availableContextTokens === undefined
      ? limit * COMPRESSION_THRESHOLD_RATIO
      : budget;
    const tokenThreshold = Math.min(baseThreshold, adaptiveTokenThreshold);

    const turnCount = countConversationTurns(input.messages);
    const exceedsTurnThreshold = turnCount >= adaptiveTurnThreshold;
    const exceedsTokenThreshold = total > tokenThreshold;

    if (!input.scope || (!exceedsTokenThreshold && !exceedsTurnThreshold)) {
      return fallback();
    }

    const effectiveBudget = Math.min(budget, adaptiveTokenThreshold);
    const headBudget = Math.floor(effectiveBudget * HEAD_BUDGET_RATIO);
    const tailBudget = Math.floor(effectiveBudget * TAIL_BUDGET_RATIO);
    const maxHeadMessages = budget > adaptiveTokenThreshold
      ? MAX_HEAD_PRESERVED_MESSAGES
      : undefined;
    const maxTailMessages = budget > adaptiveTokenThreshold
      ? MAX_TAIL_PRESERVED_MESSAGES
      : undefined;

    const head = takeWithinBudget(input.messages, headBudget, false, maxHeadMessages);
    const tailPool = input.messages.slice(head.length);
    let tail = takeWithinBudget(tailPool, tailBudget, true, maxTailMessages);
    if (input.messages.length - tail.length > protectedStart) tail = input.messages.slice(Math.max(head.length, protectedStart));
    const start = head.length;
    const endExclusive = input.messages.length - tail.length;
    if (endExclusive <= start) {
      return fallback();
    }

    const knowledge = sharedKnowledge(this.ledger.list(input.scope));
    const hashKnowledge = (ids: string[]) => createHash('sha256').update(JSON.stringify(knowledge
      .filter(e => e.sourceMessageIds.some(id => ids.includes(id)))
      .map(({ active, ...entry }) => entry))).digest('hex');
    const middleIds = new Set(input.messages.slice(start, endExclusive).map(m => m.id));
    const sources = knowledge.filter(e => e.sourceMessageIds.some(id => middleIds.has(id)));
    const cached = this.ledger.getLatestCheckpoint(input.scope.playthroughId);
    if (
      cached &&
      cached.knowledgePolicy === SHARED_KNOWLEDGE_POLICY &&
      cached.knowledgeHash === hashKnowledge(cached.sourceMessageIds) &&
      cached.playthroughId === input.scope.playthroughId &&
      cached.locale === input.locale &&
      cached.modelId === input.modelId &&
      cached.sourceStartSequence === start &&
      Number.isInteger(cached.sourceEndSequence) &&
      cached.sourceEndSequence >= start &&
      cached.sourceEndSequence < endExclusive &&
      endExclusive - 1 - cached.sourceEndSequence < CHECKPOINT_STALENESS_MESSAGES &&
      JSON.stringify(cached.sourceMessageIds) === JSON.stringify(input.messages.slice(start, cached.sourceEndSequence + 1).map((message) => message.id)) &&
      cached.sourceHash === sourceHash(input.messages.slice(start, cached.sourceEndSequence + 1))
    ) {
      const uncoveredMiddle = input.messages.slice(
        Math.max(start, cached.sourceEndSequence + 1),
        endExclusive
      );
      const reused = {
        messages: [...head, ...uncoveredMiddle, ...tail],
        summarySection: buildSummarySection(cached.summary, cached.sourceStartSequence, cached.sourceEndSequence, input.locale),
        compacted: true,
      };
      // If appended messages no longer fit effective budget, refresh instead of silently losing them.
      const reusedCost = reused.messages.reduce((sum, message) => sum + messageTokens(message), 0)
        + estimateTokens(reused.summarySection);
      if (reusedCost <= effectiveBudget) return reused;
    }

    const failure = this.ledger.getCompressionFailure(input.scope.playthroughId);
    if (failure.retryAfter && Date.parse(failure.retryAfter) > Date.now()) return fallback();

    try {
      const client = getGeminiClient(input.apiKey);
      if (!client) throw new Error('Gemini client unavailable');
      const result = await client.models.generateContent({
        model: DEFAULT_GEMINI_MODEL,
        contents: JSON.stringify(sources.map(e => ({ id: e.id, role: e.role, status: e.status, text: e.text }))),
        config: {
          systemInstruction: `${SUMMARY_INSTRUCTION}\nWrite all summary values in ${input.locale === 'en' ? 'English' : 'Polish'}.`,
          temperature: 0.1,
          topP: 0.9,
          maxOutputTokens: 1200,
        },
      });
      const summary = (result.text ? groundedSummary(result.text, sources) : null) || renderSources(sources);
      if (!summary) throw new Error('No grounded compression sources');
      const prepared = fitContext({
        messages: [...head, ...tail],
        summarySection: buildSummarySection(summary, start, endExclusive - 1, input.locale),
        compacted: true,
      }, budget);
      if (!prepared.summarySection) throw new Error('Compression summary exceeds context budget');
      const latest = this.ledger.getLatestCheckpoint(input.scope.playthroughId);
      const version = (latest?.version ?? 0) + 1;
      const id = createHash('sha256')
        .update(`${input.scope.playthroughId}:${version}:${input.locale}:${input.modelId}:${sourceHash(input.messages.slice(start, endExclusive))}:${summary}`)
        .digest('hex');
      this.ledger.saveCheckpoint({
        id,
        playthroughId: input.scope.playthroughId,
        version,
        sourceStartSequence: start,
        sourceEndSequence: endExclusive - 1,
        sourceMessageIds: input.messages.slice(start, endExclusive).map((message) => message.id),
        knowledgePolicy: SHARED_KNOWLEDGE_POLICY,
        knowledgeHash: hashKnowledge(input.messages.slice(start, endExclusive).map(m => m.id)),
        sourceHash: sourceHash(input.messages.slice(start, endExclusive)),
        locale: input.locale,
        modelId: input.modelId,
        summary,
        createdAt: new Date().toISOString(),
      });
      return prepared;
    } catch (error) {
      this.ledger.recordCompressionFailure(input.scope.playthroughId);
      console.warn('Campaign context compression failed; retaining full history or rejecting the turn:', error);
      return fallback();
    }
  }
}

let singleton: CampaignContextEngine | null = null;

export function getCampaignContextEngine(): CampaignContextEngine {
  if (!singleton) singleton = new CampaignContextEngine();
  return singleton;
}
