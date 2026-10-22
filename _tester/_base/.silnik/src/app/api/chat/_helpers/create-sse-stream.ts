/**
 * createSseStream - factory function dla sekcji 12 route.ts (IND-71 micro 3/3).
 *
 * Buduje ReadableStream w formacie SSE (Server-Sent Events) ze stream chunks
 * od `provider.streamChat()`. Po zakończeniu strumienia:
 *   1. parseAIResponse(fullText) - extract events/combat/dialogues/illustrations/timeUpdate
 *   2. updateDirectorState - warunkowo gdy sessionId + parsed.gmMetadata
 *   3. enqueue metadata event ('data: {type:"metadata",...}\n\n')
 *   4. logApiEvent - fire-and-forget cost recording + telemetria (OPT-28)
 *   5. conversationMemory.saveConversationTurn - fire-and-forget local RAG persist
 *
 * Pattern SSE: każdy chunk to `data: {JSON}\n\n` (z double-newline separator).
 * Error w stream → controller.error(e) propaguje do client (NIE swallows).
 *
 * Side effects (asynchroniczne):
 *   - updateDirectorState (sync, ale try/catch)
 *   - logApiEvent (Promise.catch swallowed - non-blocking telemetria)
 *   - conversationMemory.saveConversationTurn (Promise.catch swallowed - fire-and-forget)
 *
 * Dependencies (mockowalne przez jest): parseAIResponse, updateDirectorState,
 * logApiEvent, conversationMemory.
 */

import { parseAIResponse } from '@/lib/response-parser';
import { updateDirectorState } from '@/lib/director-state';
import { conversationMemory } from '@/lib/vector-db/conversation-memory';
import { logApiEvent } from '@/lib/telemetry';
import { calculateGeminiCost } from '@/lib/ai-cost-tracker';
import { recordUserUsage } from '@/lib/user-usage';
import type { StreamChunk, CompletionUsage } from '@/lib/ai-providers/types';
import type { Character, NPC } from '@/lib/types';
import { enrichMeleeAttackReferences } from '@/lib/combat/npc-combat-profile';
import type { RagMeta } from './run-rag-summary';
import type { CampaignMemoryScope } from '@/core/memory/types';
import { commitMemoryTurn, retainFailedTurn, stageDossierTurn, type DossierNarrativeTurn } from '@/core/memory/commit-turn';
import { extractRevealedTurn } from '@/core/memory/revealed-facts';
import { stripPushedRollConsequenceEntries } from '@/lib/parsers/mechanics-parser';
import type {
  PushedRollResolutionContext,
  PushedRollStakeRequestContext,
} from '@/lib/parsers/types';
import { extractJournalTags } from '@/lib/parsers/journal-parser';
import type { MemoryCommit } from '@/core/memory/types';
import { beginAiGeneration } from '@/lib/desktop/generation-state';
import {
  detectPendingSanityTestResolution,
  generateSanityFallbacks,
  type PendingSanityResolution,
} from './sanity-resolution';

export interface CreateSseStreamOpts {
  /** Defer narrative memory/director until the local dossier transaction succeeds. */
  deferDossierFinalization?: boolean;
  dossierCorrectionContextHash?: string;
  dossierCorrectionAttempt?: boolean;
  providerStream: AsyncIterable<StreamChunk>;
  getUsage: () => Promise<CompletionUsage | null>;
  /** Odczyt po skonsumowaniu providerStream. */
  getFinishReason: () => string | undefined;
  sessionId?: string;
  message: string;
  character?: Character;
  modelId: string;
  traceId: string;
  timer: { elapsed: () => number };
  /** Telemetry: metadata RAG retrieval (null gdy fallback / brak hits) */
  ragMeta?: RagMeta | null;
  /** Telemetry: aktywny embedding dim (768 v1 / 3072 v2) */
  embeddingDim: number;
  /** Telemetry: aktywna wersja RAG ('v1' | 'v2') z process.env.RAG_VERSION */
  ragVersion: string;
  /** IND-168 Faza 6: userId konta (Clerk) dla licznika zużycia per-konto */
  userId: string;
  assistantMessageId?: string;
  userMessageId?: string;
  characters?: Character[];
  npcs?: NPC[];
  combatMechanicsEnabled?: boolean;
  memoryScope?: CampaignMemoryScope | null;
  pendingSanityResolutions?: PendingSanityResolution[];
  /** Stable clue record IDs that the local dossier RAG exposed in this turn. */
  dossierClueRecordIds?: string[];
  /** Exact handout locator IDs that the local dossier RAG exposed in this turn. */
  dossierHandoutRecordIds?: string[];
  /** Referee outcome permits material changes; a pending check must not grant items. */
  dossierInventoryWritesAllowed?: boolean;
  /** Validated, accepted pushed-roll result for conditional consequence persistence. */
  pushedRoll?: PushedRollResolutionContext;
  /** Validated stake proposal request; model output must not advance game time. */
  pushedRollStakeRequest?: PushedRollStakeRequestContext;
}

export function createSseStream(opts: CreateSseStreamOpts): ReadableStream {
  const {
    providerStream,
    getUsage,
    getFinishReason,
    sessionId,
    message,
    character,
    modelId,
    traceId,
    timer,
    ragMeta,
    embeddingDim,
    ragVersion,
    userId,
    assistantMessageId,
    userMessageId,
    characters = [],
    npcs = [],
    combatMechanicsEnabled = false,
    memoryScope,
    pendingSanityResolutions,
    dossierHandoutRecordIds = [],
    dossierClueRecordIds = [],
    dossierInventoryWritesAllowed = false,
    pushedRoll,
    pushedRollStakeRequest,
  } = opts;

  const encoder = new TextEncoder();
  const endGeneration = beginAiGeneration();

  return new ReadableStream({
    async start(controller) {
      let fullText = '';

      try {
        for await (const chunk of providerStream) {
          if (chunk.text) {
            fullText += chunk.text;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'text', content: chunk.text })}\n\n`
              )
            );
          }
        }

        // Auto-sędzia: automatyczne egzekwowanie utraty Poczytalności (SAN) po oblanym teście kości CoC RAW (Issue #564)
        const effectiveSanityResolutions =
          pendingSanityResolutions ?? detectPendingSanityTestResolution(message);
        if (effectiveSanityResolutions.length > 0) {
          const isDuet = Boolean(
            (characters && characters.length > 1) ||
            effectiveSanityResolutions.some((r) => Boolean(r.characterName))
          );
          const fallbacks = generateSanityFallbacks(
            fullText,
            effectiveSanityResolutions,
            isDuet,
            character?.name
          );

          for (const fallback of fallbacks) {
            const separator = fullText.length > 0 && !fullText.endsWith('\n') ? '\n' : '';
            const fallbackChunk = `${separator}${fallback}`;
            fullText += fallbackChunk;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'text', content: fallbackChunk })}\n\n`
              )
            );
          }
        }

        const stateText = stripPushedRollConsequenceEntries(fullText);

        // Parsuj pełną odpowiedź i wyślij metadane (z osłoną przed nieobsłużonym błędem)
        let parsed;
        try {
          parsed = parseAIResponse(stateText);
          // The local pushed-roll resolver owns clock changes in this turn.
          if (pushedRoll || pushedRollStakeRequest) parsed.timeUpdate = null;
        } catch (parseErr) {
          console.warn('⚠️ parseAIResponse failed on full text:', parseErr);
          parsed = {
            events: [],
            combat: null,
            dialogues: [],
            illustrations: [],
            sfx: [],
            journalEntries: [],
            skillTests: [],
            skillResults: [],
            hazardEvents: [],
            spellCastEvents: [],
            opposedMagicEvents: [],
            opposedMeleeEvents: [],
            tomeStudyEvents: [],
            meleeAttacks: [],
            equipmentEvents: [],
            timeUpdate: null,
            refereeVetoEvents: [],
            gmMetadata: undefined,
            rawText: stateText,
          };
        }

        const melee =
          combatMechanicsEnabled && assistantMessageId
            ? enrichMeleeAttackReferences({
                references: parsed.meleeAttacks,
                npcs,
                characters,
                assistantMessageId,
              })
            : { attacks: [], rejected: [] };
        if (melee.rejected.length > 0) {
          console.warn('Rejected melee attack tags', melee.rejected);
        }

        const usage = await getUsage();
        const finishReason = getFinishReason();
        let memoryCommit: (MemoryCommit & {retryToken?:string}) | undefined;
        let narrativeTurn: DossierNarrativeTurn['turn'] | undefined;
        if (memoryScope) {
          const revealed = extractRevealedTurn(stateText,assistantMessageId ?? traceId,characters,character);
          const pushedConsequence = pushedRoll && !pushedRoll.passedRequirement
            ? [{
                kind: 'consequence' as const,
                text: `Forsowanie testu ${pushedRoll.skillName}: ${pushedRoll.failureStake}`,
                status: 'confirmed' as const,
                sourceJournalEntryId: `journal-${assistantMessageId ?? traceId}-${extractJournalTags(stateText).length}`,
                provenance: 'pushed_roll_resolver',
                tags: ['pushed_roll'],
              }]
            : [];
          narrativeTurn = {scope:memoryScope,sessionId:sessionId ?? memoryScope.playthroughId,
            messageId:assistantMessageId ?? traceId,userMessageId,userText:message,
            assistantText:revealed.narrative,facts:[...revealed.facts, ...pushedConsequence],
            recipientIds:character ? [character.id] : undefined};
        }
        const commitNarrative = () => {
        if (narrativeTurn) {
          const turn=narrativeTurn;
          try { memoryCommit = commitMemoryTurn(turn); }
          catch (error) {
            console.warn('Campaign memory ledger write failed:',error);
            memoryCommit = {messageId:turn.messageId,status:'failed',retryToken:retainFailedTurn(turn)};
          }
        }

        // Director's State update (warunkowo)
        if (sessionId && parsed.gmMetadata) {
          try {
            updateDirectorState(
              sessionId,
              parsed.gmMetadata,
              parsed.journalEntries
            );
          } catch (e) {
            console.warn('⚠️ Director state update failed:', e);
          }
        }

          return { memoryCommit };
        };
        if (opts.deferDossierFinalization && !memoryScope) throw new Error('DOSSIER_MEMORY_SCOPE_REQUIRED');
        const dossierFinalizationToken = opts.deferDossierFinalization
          ? stageDossierTurn({turn:narrativeTurn!, correctionContextHash:opts.dossierCorrectionContextHash, correctionAttempt:opts.dossierCorrectionAttempt, ...(sessionId && parsed.gmMetadata ? {
              director:{sessionId,metadata:parsed.gmMetadata,journalEntries:parsed.journalEntries},
            } : {})}) : undefined;
        if (!opts.deferDossierFinalization) commitNarrative();

        // Telemetry namespace dla PostHog client-side emit (spawn task 2026-05-22).
        // Client (useChat.onMetadata) odbiera te pola → trackEvent('ai_request_completed').
        const telemetry = {
          durationMs: timer.elapsed(),
          ragHits: ragMeta?.hits ?? 0,
          ragSource: ragMeta?.source ?? 'none',
          ragNamespaces: ragMeta?.namespaces ?? '',
          ragNamespaceCount: ragMeta?.namespaceCount ?? 0,
          ragDurationMs: ragMeta?.durationMs ?? 0,
          embeddingDim,
          ragVersion,
          model: usage?.model || modelId,
          tokensIn: usage?.promptTokens ?? 0,
          tokensOut: usage?.completionTokens ?? 0,
          cachedTokens: usage?.cachedTokens ?? 0,
          finishReason,
        };

        const metadata = {
          type: 'metadata',
          parsedEvents: parsed.events,
          combatState: parsed.combat,
          dialogues: parsed.dialogues,
          illustrations: parsed.illustrations,
          skillTests: parsed.skillTests,
          pendingMeleeAttacks: melee.attacks,
          opposedMagicEvents: parsed.opposedMagicEvents || [],
          opposedMeleeEvents: parsed.opposedMeleeEvents || [],
          equipmentEvents: parsed.equipmentEvents || [],
          timeUpdate: parsed.timeUpdate,
          costData: usage
            ? {
                totalTokens: usage.totalTokens,
                model: usage.model,
              }
            : null,
          finishReason,
          telemetry,
          memoryCommit,
          dossierFinalizationToken,
          dossierClueRecordIds,
          dossierHandoutRecordIds,
          dossierInventoryWritesAllowed: dossierInventoryWritesAllowed && (parsed.skillTests?.length ?? 0) === 0,
        };

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(metadata)}\n\n`)
        );

        // OPT-28: cost recording + telemetria (fire-and-forget)
        // IND-67: drop fs.appendFileSync('./src/cost-log.jsonl') - Vercel READ-ONLY FS rzucał EROFS.
        // Spawn task 2026-05-22: rozszerz meta o RAG fields (Sentry + Vercel Logs spójność z PostHog).
        if (usage) {
          // IND-257: koszt liczony raz, wspólny dla logApiEvent (telemetry.jsonl)
          // i recordUserUsage (budżet per-konto). Wcześniej logApiEvent nie miał
          // costUsd → kosztu czatu nie dało się czytać z telemetry.jsonl.
          const geminiCost = calculateGeminiCost(
            usage.model || modelId,
            usage.promptTokens ?? 0,
            usage.completionTokens ?? 0,
            usage.cachedTokens ?? 0,
            usage.thinkingTokens ?? 0
          );
          logApiEvent({
            traceId,
            endpoint: '/api/chat',
            provider: 'gemini',
            model: usage.model || modelId,
            status: 200,
            durationMs: timer.elapsed(),
            tokensIn: usage.promptTokens ?? 0,
            tokensOut: usage.completionTokens ?? 0,
            costUsd: geminiCost,
            result: 'success',
            sessionId: sessionId ?? undefined,
            meta: {
              cachedTokens: usage.cachedTokens ?? 0,
              thinkingTokens: usage.thinkingTokens ?? 0,
              totalTokens: usage.totalTokens ?? 0,
              ragHits: ragMeta?.hits ?? 0,
              ragSource: ragMeta?.source ?? 'none',
              ragNamespaces: ragMeta?.namespaces ?? '',
              ragNamespaceCount: ragMeta?.namespaceCount ?? 0,
              embeddingDim,
              ragVersion,
              finishReason: finishReason ?? null,
            },
          }).catch(() => {});

          // IND-168 Faza 6: licznik zużycia per-konto (fire-and-forget, GCS).
          // NIE może blokować streamu ani 500-ować - błędy swallowane.
          recordUserUsage(userId, {
            type: 'gemini',
            cost: geminiCost,
            tokens: usage.totalTokens ?? 0,
          }).catch(() => {});
        }

        // Conversation memory persist (fire-and-forget local RAG)
        if (!opts.deferDossierFinalization && !memoryScope && sessionId && fullText) {
          conversationMemory
            .saveConversationTurn({
              userMessage: message,
              aiResponse: extractRevealedTurn(stateText,assistantMessageId ?? traceId).narrative,
              sessionId,
              characterName: character?.name,
              memoryScope,
              messageId: assistantMessageId ?? traceId,
            })
            .catch(() => {});
        }

        controller.close();
      } catch (e) {
        console.error('❌ [create-sse-stream] Błąd podczas strumieniowania SSE:', e);
        controller.error(e);
      } finally {
        endGeneration();
      }
    },
  });
}
