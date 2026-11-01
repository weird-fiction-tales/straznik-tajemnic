import { isRuntimeAuthorizedDossierRecord } from './runtime-authorization';
import { cosineSimilarity, embeddingService } from '@/lib/embedding-service';
import { hasDossierItemAccess } from './apply-inventory-turn';
import type { DossierInventoryProjection } from './inventory-state';
import { isDossierWorldStateForPayload, isDossierWorldStateProjection, type DossierWorldStateProjection } from './world-object-state';
import { bindDossierActors, renderDossierActorState, type DossierActorObservation } from './actor-binding';
import {
  validateDossierRagPayload,
  type DossierConditionClause,
  type DossierRagPayload,
  type DossierRagRecord,
} from './rag-schema';

interface IndexedRecord {
  record: DossierRagRecord;
  embedding: number[];
}

interface ActiveDossierIndex {
  adventureId: string;
  editionFingerprint: string;
  records: IndexedRecord[];
  lastAccessedAt: number;
}

export interface ActiveDossierRagBinding {
  adventureId: string;
  editionFingerprint: string;
}

export interface DossierRetrievalContext {
  activationId: string;
  adventureId: string;
  editionFingerprint: string;
  query: string;
  activeSceneIds: string[];
  presentEntityIds: string[];
  targetEntityIds?: string[];
  acquiredRecordIds: string[];
  mechanicIds: string[];
  /** Explicitly requested rule topics; never used to satisfy mechanic_active gates. */
  requestedMechanicIds?: string[];
  limit?: number;
  maxContextChars?: number;
  onDependencyDecision?: (decision: {from: string; to: string; reason: 'included' | 'unavailable' | 'budget'}) => void;
  minimumScore?: number;
  inventory?: DossierInventoryProjection;
  worldObjectState?: DossierWorldStateProjection;
  actorObservations?: DossierActorObservation[];
}

export interface DossierRetrievalHit {
  recordId: string;
  recordType: DossierRagRecord['record_type'];
  content: string;
  provenance: DossierRagRecord['evidence']['provenance'];
  sourceRef: string;
  score: number;
}

function renderWorldObjectState(record: DossierRagRecord, state?: DossierWorldStateProjection): string {
  if (!state || !isDossierWorldStateProjection(state) || state.adventureId !== record.adventure_id ||
    state.editionFingerprint !== record.edition_fingerprint || !record.world_object_binding) return '';
  const definitions = [record.world_object_binding, ...(record.world_object_binding.instances ?? [])];
  const observed = definitions.flatMap(definition => {
    const entry = state.objects.find(object => object.entityId === definition.entity_id);
    return entry && definition.states.includes(entry.state) ? [entry] : [];
  });
  if (observed.length === 0) return '';
  return `\nBieżące stany obiektu świata: ${observed.map(entry => `${entry.entityId}=${entry.state}`).join('; ')}. To zapis kampanii; nie cofaj go do stanu początkowego. Zmień go wyłącznie przez dozwolone przejście po rozstrzygnięciu działania.`;
}

export function renderDossierWorldStateSection(input: {
  activationId: string;
  adventureId: string;
  editionFingerprint: string;
  worldObjectState: unknown;
  locale?: 'pl' | 'en';
}): string {
  const index = getFreshIndex(input.activationId);
  if (!index || index.adventureId !== input.adventureId ||
    index.editionFingerprint !== input.editionFingerprint) return '';

  const payload: DossierRagPayload = {
    schema_version: 1,
    adventure_id: index.adventureId,
    edition_fingerprint: index.editionFingerprint,
    records: index.records.map(({ record }) => record),
  };
  const worldObjectState = input.worldObjectState;
  if (!isDossierWorldStateForPayload(worldObjectState, payload)) return '';

  const bindings = index.records.flatMap(({ record }) => record.world_object_binding
    ? [record.world_object_binding, ...(record.world_object_binding.instances ?? [])]
    : []);
  if (bindings.length === 0) return '';

  const observed = bindings.flatMap(binding => {
    const entry = worldObjectState.objects.find(object => object.entityId === binding.entity_id);
    return entry ? [`${entry.entityId}=${entry.state}`] : [];
  });
  if (observed.length === 0) return '';

  const states = observed.map(value => `- ${value}`).join('\n');
  return input.locale === 'en'
    ? `\n\n## AUTHORITATIVE CAMPAIGN WORLD STATE\nCurrent recorded states (entity ID=state):\n${states}\nTreat this snapshot as the source of truth. Do not infer a state change from player intent, generated narration, or a failed roll. A failed roll does not change these values by itself. Narrate a change only when an existing dossier rule and resolved mechanics allow it, or recorded game time confirms a scheduled event. Without such confirmation, describe the attempt and consequences consistent with these states.`
    : `\n\n## AUTORYTATYWNY STAN ŚWIATA W KAMPANII\nZapisane stany (ID obiektu=stan):\n${states}\nTraktuj ten zapis jako źródło prawdy. Nie wnioskuj o zmianie stanu z samej deklaracji gracza, wygenerowanej narracji ani nieudanego testu. Nieudany test sam w sobie nie zmienia tych wartości. Opisuj zmianę tylko wtedy, gdy istniejąca reguła teczki i rozstrzygnięty wynik mechaniki na nią pozwalają albo zapisany czas gry potwierdza zdarzenie. Bez takiego potwierdzenia opisuj próbę i skutki zgodne z tym zapisem.`;
}

// Next routes can bundle independent copies of this module. The versioned process
// registry shares private vectors across those copies; nothing is serialized.
const indexRegistryKey = Symbol.for('straznik.adventure-dossier.active-indexes.v1');
const processRegistry = globalThis as typeof globalThis & {
  [indexRegistryKey]?: Map<string, ActiveDossierIndex>;
};
const activeIndexes = processRegistry[indexRegistryKey] ?? new Map<string, ActiveDossierIndex>();
if (!processRegistry[indexRegistryKey]) {
  Object.defineProperty(processRegistry, indexRegistryKey, { value: activeIndexes });
}
const DEFAULT_LIMIT = 8;
const DEFAULT_MINIMUM_SCORE = 0.25;
const ACTIVE_CONTEXT_RERANK_BOOST = {
  mechanic: 0.08,
  scene: 0.06,
  entity: 0.04,
} as const;
const MAX_ACTIVE_DOSSIERS = 16;
const ACTIVE_DOSSIER_TTL_MS = 12 * 60 * 60 * 1000;

function getFreshIndex(activationId: string): ActiveDossierIndex | null {
  const index = activeIndexes.get(activationId);
  if (!index) return null;
  if (Date.now() - index.lastAccessedAt > ACTIVE_DOSSIER_TTL_MS) {
    activeIndexes.delete(activationId);
    return null;
  }
  index.lastAccessedAt = Date.now();
  activeIndexes.delete(activationId);
  activeIndexes.set(activationId, index);
  return index;
}

function clauseIsSatisfied(
  clause: DossierConditionClause,
  context: Pick<DossierRetrievalContext, 'activeSceneIds' | 'presentEntityIds' | 'targetEntityIds' | 'acquiredRecordIds' | 'mechanicIds'>,
): boolean {
  switch (clause.kind) {
    case 'entity_present':
      return context.presentEntityIds.includes(clause.id);
    case 'target_entity':
      return (context.targetEntityIds ?? []).includes(clause.id);
    case 'scene_active':
      return context.activeSceneIds.includes(clause.id);
    case 'reveal_acquired':
      return context.acquiredRecordIds.includes(clause.id);
    case 'mechanic_active':
      return context.mechanicIds.includes(clause.id);
  }
}

function conditionsAreSatisfied(
  record: DossierRagRecord,
  context: Pick<DossierRetrievalContext, 'activeSceneIds' | 'presentEntityIds' | 'targetEntityIds' | 'acquiredRecordIds' | 'mechanicIds'>,
): boolean {
  const condition = record.retrieval.condition;
  return !condition || condition.all.every((clause) => clauseIsSatisfied(clause, context));
}

function isAvailable(
  record: DossierRagRecord,
  context: Pick<DossierRetrievalContext, 'activeSceneIds' | 'presentEntityIds' | 'targetEntityIds' | 'acquiredRecordIds' | 'mechanicIds' | 'inventory' | 'adventureId' | 'editionFingerprint'>,
): boolean {
  if (!isRuntimeAuthorizedDossierRecord(record)) return false;
  // Once the party has the original, it stays available outside the discovery scene.
  if (record.record_type === 'handout_locator' && record.local_handout && context.acquiredRecordIds.includes(record.record_id)) return true;
  // The party's known instance follows campaign state after leaving its source
  // scene. A removed instance remains retrievable so narration cannot respawn it.
  if (record.inventory_item && context.inventory?.adventureId === context.adventureId &&
    context.inventory.editionFingerprint === context.editionFingerprint &&
    context.inventory.entries.some(entry => entry.recordId === record.record_id)) return true;
  if (!conditionsAreSatisfied(record, context)) return false;

  const hasTargetedNpcResistance = context.mechanicIds.includes('coc7:npc-profiles-resistance') &&
    (context.targetEntityIds?.length ?? 0) > 0;
  if (hasTargetedNpcResistance && record.record_type === 'actor') {
    const targets = new Set(context.targetEntityIds);
    // Actor records are one NPC each. Never return a neighboring NPC's hidden
    // profile just because it is also present in the scene.
    if (record.tags.entities.length !== 1 || !targets.has(record.tags.entities[0])) return false;
  }

  switch (record.retrieval.availability) {
    case 'always':
      return true;
    case 'when_entity_present':
      return record.tags.entities.some((id) => context.presentEntityIds.includes(id));
    case 'when_scene_active':
      return record.tags.scenes.some((id) => context.activeSceneIds.includes(id));
    case 'after_reveal':
      return record.retrieval.condition !== null;
    case 'state_condition':
      return record.retrieval.condition !== null;
  }
}

function embeddingText(record: DossierRagRecord): string {
  return [
    record.content,
    ...record.tags.entities,
    ...record.tags.scenes,
    ...record.tags.mechanics,
    ...record.tags.topics,
    ...record.tags.triggers,
  ].join('\n');
}

/**
 * Activates a validated dossier index in process memory only.
 * The caller must decrypt the exact edition locally, or enroll a hash-verified local author draft.
 */
export async function activateDossierRag(
  activationId: string,
  expectedAdventureId: string,
  expectedFingerprint: string,
  decryptedPayload: unknown,
): Promise<{ ok: boolean; errors: string[] }> {
  const scopedActivationId = activationId.trim();
  if (!scopedActivationId) return { ok: false, errors: ['activationId is required'] };
  // A failed replacement must not leave stale facts available for this session.
  activeIndexes.delete(scopedActivationId);

  const validation = validateDossierRagPayload(decryptedPayload);
  if (!validation.ok || !validation.payload) {
    return { ok: false, errors: validation.errors };
  }
  const payload: DossierRagPayload = validation.payload;

  if (payload.adventure_id !== expectedAdventureId) {
    return { ok: false, errors: ['payload adventure does not match active adventure'] };
  }
  if (payload.edition_fingerprint !== expectedFingerprint) {
    return { ok: false, errors: ['payload edition does not match recognized PDF'] };
  }

  const records = payload.records.filter(isRuntimeAuthorizedDossierRecord);
  if (records.length === 0) {
    return { ok: false, errors: ['payload has no authorized runtime records'] };
  }

  const indexed: IndexedRecord[] = [];
  for (const record of records) {
    const embedding = await embeddingService.generateLocalEmbedding(embeddingText(record));
    if (!embedding?.length) {
      return { ok: false, errors: ['local embedding unavailable; dossier index was not activated'] };
    }
    indexed.push({ record, embedding });
  }

  while (activeIndexes.size >= MAX_ACTIVE_DOSSIERS) {
    const oldestActivationId = activeIndexes.keys().next().value;
    if (!oldestActivationId) break;
    activeIndexes.delete(oldestActivationId);
  }
  activeIndexes.set(scopedActivationId, {
    adventureId: payload.adventure_id,
    editionFingerprint: payload.edition_fingerprint,
    records: indexed,
    lastAccessedAt: Date.now(),
  });
  return { ok: true, errors: [] };
}

export async function retrieveDossierRag(
  context: DossierRetrievalContext,
): Promise<DossierRetrievalHit[]> {
  const index = getFreshIndex(context.activationId);
  if (
    !index ||
    index.adventureId !== context.adventureId ||
    index.editionFingerprint !== context.editionFingerprint ||
    !context.query.trim()
  ) {
    return [];
  }

  const actors = bindDossierActors(index.records.map(entry => entry.record), context.actorObservations ?? []);
  const worldObjectState = isDossierWorldStateForPayload(context.worldObjectState, {
    schema_version: 1,
    adventure_id: index.adventureId,
    edition_fingerprint: index.editionFingerprint,
    records: index.records.map(entry => entry.record),
  }) ? context.worldObjectState : undefined;
  const canonicalId = (id: string) => actors.entityIdByRuntimeId.get(id) ?? id;
  context = { ...context,
    presentEntityIds: [...new Set(context.presentEntityIds.map(canonicalId))],
    targetEntityIds: [...new Set((context.targetEntityIds ?? []).map(canonicalId))],
  };
  const queryEmbedding = await embeddingService.generateLocalEmbedding(context.query);
  if (!queryEmbedding?.length) return [];

  const limit = Number.isFinite(context.limit) ? Math.max(1, Math.min(Math.floor(context.limit!), 20)) : DEFAULT_LIMIT;
  const minimumScore = context.minimumScore ?? DEFAULT_MINIMUM_SCORE;

  const available = index.records.filter(({record}) => isAvailable(record, context));
  const availableById = new Map(available.map(({record}) => [record.record_id,record]));
  const ranked = available
    .map(({ record, embedding }) => ({
      record,
      semanticScore: cosineSimilarity(queryEmbedding, embedding),
    }))
    // Semantic relevance selects seeds. Explicit dependencies are added below,
    // after the same approval and availability gates, without recursive traversal.
    .filter(({ semanticScore }) => semanticScore >= minimumScore)
    .map(({ record, semanticScore }) => {
      const mechanicMatch = record.tags.mechanics.some((id) =>
        context.mechanicIds.includes(id) || context.requestedMechanicIds?.includes(id),
      );
      const sceneMatch = record.tags.scenes.some((id) => context.activeSceneIds.includes(id));
      const entityMatch = record.tags.entities.some((id) => context.presentEntityIds.includes(id));
      const score = semanticScore +
        (mechanicMatch ? ACTIVE_CONTEXT_RERANK_BOOST.mechanic : 0) +
        (sceneMatch ? ACTIVE_CONTEXT_RERANK_BOOST.scene : 0) +
        (entityMatch ? ACTIVE_CONTEXT_RERANK_BOOST.entity : 0);
      return { record, score };
    })
    .sort((a, b) => b.score - a.score || b.record.retrieval.priority - a.record.retrieval.priority || a.record.record_id.localeCompare(b.record.record_id, 'en'));
  const render = ({ record, score }: {record: DossierRagRecord; score: number}): DossierRetrievalHit => ({
      recordId: record.record_id,
      recordType: record.record_type,
      content: record.content + renderDossierActorState(record, actors) + renderWorldObjectState(record, worldObjectState) + (() => {
        const inventory = context.inventory;
        if (!record.inventory_item || inventory?.adventureId !== index.adventureId || inventory.editionFingerprint !== index.editionFingerprint) return '';
        const entry = inventory.entries.find(e => e.recordId === record.record_id);
        const access = record.inventory_item.access_check;
        const accessNote = access ? (hasDossierItemAccess({ schema_version: 1, adventure_id: index.adventureId,
          edition_fingerprint: index.editionFingerprint, records: [record] }, inventory, record.record_id)
          ? '\nDostęp odkryty i zapamiętany. To nie oznacza zabrania: dodaj przedmiot dopiero po deklaracji.'
          : `\nDostęp nieodkryty. Właściwy test oznacz wewnątrz [TEST: ... | DOSSIER_ACCESS: ${access.id}]. Warunek: ${access.skill_names.join(' / ')}, trudność ${access.difficulty}. Sam tag DODAJ nie spełnia warunku.`) : '';
        return accessNote + (entry
          ? `\nStan tego egzemplarza w kampanii: ${JSON.stringify(entry)}. Ten zapis zastępuje początkowe położenie. Nie twórz kolejnej kopii ani nie przywracaj utraconego przedmiotu.`
          : '\nStan tego egzemplarza: brak zarejestrowanej zmiany posiadacza. Obowiązują początkowe położenie i warunki dostępu; nie oznacza to automatycznego zdobycia.');
      })(),
      provenance: record.evidence.provenance,
      sourceRef: record.evidence.source_ref,
      score,
    });
  const selected = new Map<string,DossierRetrievalHit>();
  const requestedBudget = context.maxContextChars ?? 32000;
  const charBudget = Number.isFinite(requestedBudget) ? Math.max(0,Math.min(80000,Math.floor(requestedBudget))) : 32000;
  let usedChars=0;
  const append = (record: DossierRagRecord, score: number) => {
    if(selected.has(record.record_id)) return true;
    if(selected.size>=limit || usedChars+record.content.length>charBudget) return false;
    const hit=render({record,score});
    if(usedChars+hit.content.length>charBudget) return false;
    selected.set(record.record_id,hit);usedChars+=hit.content.length;return true;
  };
  for(const seed of ranked) {
    if(selected.size>=limit) break;
    // A card added as a dependency cannot become a recursive traversal seed.
    if(selected.has(seed.record.record_id) || !append(seed.record,seed.score)) continue;
    for(const id of seed.record.context_links ?? []) {
      const dependency=availableById.get(id);
      const reason=!dependency?'unavailable':append(dependency,seed.score)?'included':'budget';
      context.onDependencyDecision?.({from:seed.record.record_id,to:id,reason});
    }
  }
  return [...selected.values()];
}

/** Clears decrypted dossier vectors when a session ends or changes source edition. */
export function clearDossierRag(activationId: string): void {
  activeIndexes.delete(activationId);
}

/** Returns only the binding needed to scope retrieval; record data stays private. */
export function getDossierRagBinding(
  activationId: string,
): ActiveDossierRagBinding | null {
  const index = getFreshIndex(activationId);
  if (!index) return null;
  return {
    adventureId: index.adventureId,
    editionFingerprint: index.editionFingerprint,
  };
}
