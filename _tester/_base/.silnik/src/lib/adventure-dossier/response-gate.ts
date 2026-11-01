import { planPrabutyTurn, applyPrabutyPlanToText } from './prabuty-action-plan';
import {unsupportedDocumentQuotes} from './document-fidelity';
import { canonicalLocationProtocolIssues, extractLatestCanonicalLocationTag } from '../canonical-adventure-location';
import { isGameTime } from '../time-manager';
import type { GameTime } from '../types';
import { DossierEffectsRejectedError } from './narration-correction';
import type { DossierTurnPreviewInput } from './preview-turn';
import { previewDossierTurn } from './preview-turn';
import { loadDossierInventory } from './inventory-state';
import { loadDossierWorldState } from './world-object-state';
import { loadNpcSnapshot } from './actor-initialization';
import type { SSEMetadataEvent } from '../sse-parser';
import { hasHandoutTakingDeclaration, presentHandoutsForTurn } from './local-handouts';

function contradictedInternalWorldStateClaims(
  text: string,
  current: ReturnType<typeof loadDossierWorldState>,
  staged: ReturnType<typeof loadDossierWorldState>,
): string[] {
  const currentIds = new Set(current.objects.map(object => object.entityId));
  const stagedStates = new Map(staged.objects.map(object => [object.entityId, object.state]));
  const thoughts = [...text.matchAll(/\[(?:MYŚLI_MG|THOUGHTS)\s*:\s*([^\]]*)\]/gi)].map(match => match[1] ?? '');
  const rejected = new Set<string>();
  const claimPattern = /\b([A-Za-z0-9._:-]{1,120})\s*=\s*([A-Za-z0-9._:-]{1,80})\b/g;
  for (const thought of thoughts) {
    for (const claim of thought.matchAll(claimPattern)) {
      const entityId = claim[1];
      const statedState = claim[2];
      if (!currentIds.has(entityId)) continue;
      const acceptedState = stagedStates.get(entityId);
      if (acceptedState && statedState !== acceptedState) rejected.add(entityId);
    }
  }
  return [...rejected];
}

/** Capture before the request. Do not reinterpret a response against silently changed state. */
export function createDossierResponseGate(input: Omit<DossierTurnPreviewInput, 'rawText' | 'inventory' | 'world' | 'npcs' | 'writesAllowed'> & {
  writesAllowed?: boolean;
  locale?: 'pl'|'en';
  finalGameTime?: GameTime;
  /** Opt in only for ordinary player turns; opening and continuation preserve their contracts. */
  ordinaryTurn?: boolean;
  offGraph?: boolean;
  knownHandoutIds?: readonly string[];
  previousAssistantMessage?: string;
  alreadyPresentedHandoutIds?: readonly string[];
  continuation?: boolean;
  isCurrent: () => boolean;
}) {
  const snapshot = () => ({
    inventory: loadDossierInventory(input),
    world: loadDossierWorldState(input, input.payload),
    npcs: loadNpcSnapshot(),
  });
  const original = snapshot();
  const serialized = JSON.stringify(original);
  let token: string | undefined;
  let acceptedGameTime: GameTime | undefined;
  let candidate: Extract<ReturnType<typeof previewDossierTurn>, {ok:true}> | undefined;
  let handouts: string[] = [];
  let actionPlan: ReturnType<typeof planPrabutyTurn> = null;
  const assertCurrent = () => {
    if (!input.isCurrent() || serialized !== JSON.stringify(snapshot())) throw new Error('DOSSIER_STATE_CHANGED');
  };
  return {
    assertCurrent,
    get token() { return token; },
    get gameTime() { return acceptedGameTime; },
    get candidate() { return candidate; },
    get handouts() { return handouts; },
    get actionPlan() { return actionPlan; },
    validate(text: string, metadata: SSEMetadataEvent) {
      candidate = undefined;
      handouts = [];
      token = undefined;
      acceptedGameTime = undefined;
      assertCurrent();
      actionPlan = !metadata.guardrail && metadata.isCommand !== true && input.playerMessage !== undefined
        ? planPrabutyTurn({...input,...original,gameTime:input.finalGameTime ?? input.gameTime,
            continuation:input.continuation === true}) : null;
      if (actionPlan) {
        const normalizeEffect = (effect:string) => effect.replace(/\s+/g,'').toLowerCase();
        const allowedEffects = new Set([...`${actionPlan.inventoryText} ${actionPlan.worldText}`.matchAll(/\[(?:EKWIPUNEK|TECZKA_STANU)[^\]]*\]/gi)].map(match=>normalizeEffect(match[0])));
        const unplanned = [...text.matchAll(/\[(?:EKWIPUNEK|TECZKA_STANU)[^\]]*\]/gi)]
          .filter(match=>!allowedEffects.has(normalizeEffect(match[0])));
        if (unplanned.length) throw new DossierEffectsRejectedError(['DOSSIER_UNPLANNED_EFFECT']);
        text = applyPrabutyPlanToText(text,actionPlan,input.locale);
        metadata.timeUpdate = actionPlan.gameTime;
        metadata.dossierClueRecordIds = actionPlan.clueIds;
        metadata.skillTests = actionPlan.skillTests.map(test=>({...test}));
      }
      if (input.finalGameTime == null && metadata.timeUpdate != null && !isGameTime(metadata.timeUpdate) && !input.ordinaryTurn) throw new Error('DOSSIER_TIME_INVALID');
      const ordinary = input.ordinaryTurn === true && !metadata.guardrail && metadata.isCommand !== true;
      const issues = ordinary ? canonicalLocationProtocolIssues(input.adventureId, input.location, text, input.offGraph) : [];
      issues.push(...unsupportedDocumentQuotes(text,input.payload));
      if (ordinary && input.finalGameTime == null && !isGameTime(metadata.timeUpdate)) issues.push('DOSSIER_TIME_REQUIRED');
      // An invalid proposal is rejected below; preview still gathers independent effect failures against the snapshot.
      const finalGameTime = input.finalGameTime ?? (isGameTime(metadata.timeUpdate) ? metadata.timeUpdate : input.gameTime);
      if (!isGameTime(finalGameTime)) throw new Error('DOSSIER_TIME_INVALID');
      const proposedLocation = extractLatestCanonicalLocationTag(text, input.adventureId);
      const offGraph = proposedLocation ? proposedLocation.mode === 'off_graph' : input.offGraph;
      if (offGraph && /\[TECZKA_STANU\b/i.test(text)) issues.push('DOSSIER_OFF_GRAPH_EFFECT');
      const result = previewDossierTurn({ ...input, ...original, location:offGraph ? 'OFF_GRAPH' : proposedLocation?.locationId ?? input.location, gameTime: finalGameTime, rawText: text,
        writesAllowed: input.writesAllowed !== false && metadata.dossierInventoryWritesAllowed === true });
      if (!result.ok) issues.push(...result.rejected);
      const acceptedWorld = result.ok ? result.next.world : original.world;
      for (const entityId of contradictedInternalWorldStateClaims(text, original.world, acceptedWorld)) {
        issues.push(`DOSSIER_NARRATION_STATE_CONTRADICTION:${entityId}`);
      }
      if (issues.length) throw new DossierEffectsRejectedError([...new Set(issues)]);
      if (!result.ok) throw new DossierEffectsRejectedError(result.rejected);
      // Guardrail responses bypass generation and carry no narrative memory transaction.
      if (!metadata.guardrail && metadata.isCommand !== true && typeof metadata.dossierFinalizationToken !== 'string') {
        throw new Error('DOSSIER_FINALIZATION_REQUIRED');
      }
      const presentation = metadata.guardrail || metadata.isCommand === true
        ? { content: result.cleanText, handouts: [] as string[] }
        : presentHandoutsForTurn(result.cleanText, metadata.dossierHandoutRecordIds ?? [], input.payload, {
        playerMessage: input.playerMessage ?? '',
        location: offGraph ? 'OFF_GRAPH' : proposedLocation?.locationId ?? input.location ?? '',
        previousAssistantMessage: input.previousAssistantMessage,
        alreadyPresentedHandoutIds: input.alreadyPresentedHandoutIds,
        knownHandoutIds: input.knownHandoutIds,
      });
      const newlyTakenHandouts = result.next.inventory.entries.filter(entry => entry.placement === 'character' &&
        !original.inventory.entries.some(before => before.recordId === entry.recordId && before.placement === 'character'));
      for (const entry of newlyTakenHandouts) {
        const media = input.payload.records.find(record => record.record_type === 'media' && record.links.includes(entry.recordId));
        if (!media) continue;
        const discovered = presentation.handouts.includes(media.record_id) || input.knownHandoutIds?.includes(media.record_id) ||
          original.inventory.entries.some(before => before.recordId === entry.recordId);
        if (!discovered || !hasHandoutTakingDeclaration(input.playerMessage ?? '', media.record_id)) {
          throw new DossierEffectsRejectedError(['DOSSIER_HANDOUT_TAKING_REQUIRED:' + entry.recordId]);
        }
      }
      handouts = presentation.handouts;
      candidate = { ...result, cleanText: presentation.content };
      acceptedGameTime = finalGameTime;
      token = typeof metadata.dossierFinalizationToken === 'string' ? metadata.dossierFinalizationToken : undefined;
    },
  };
}
