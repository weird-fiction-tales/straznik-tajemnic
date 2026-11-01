import { TextEncoder } from 'node:util';
import { webcrypto } from 'node:crypto';
import { authorizeLocalDraftPayload, fingerprintLocalDraftPayload, isRuntimeAuthorizedDossierRecord } from './runtime-authorization';
import { isIndexableDossierRecord, type DossierRagPayload } from './rag-schema';

beforeAll(() => {
  Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: TextEncoder });
  Object.defineProperty(globalThis.crypto, 'subtle', { configurable: true, value: webcrypto.subtle });
});

function draft(): DossierRagPayload {
  return { schema_version: 1, adventure_id: 'synthetic-author', edition_fingerprint: 'sha256:placeholder', records: [{
    schema_version: 1, record_id: 'scene-one', record_type: 'scene', adventure_id: 'synthetic-author', edition_fingerprint: 'sha256:placeholder',
    language: 'pl', content: 'Neutral local author fixture.',
    tags: { entities: [], scenes: ['room'], mechanics: [], topics: [], triggers: [] },
    retrieval: { visibility: 'gm_only', availability: 'when_scene_active', condition: null, priority: 1 },
    evidence: { provenance: 'approved_design', source_ref: 'synthetic-only', status: 'set', approval: 'pending', approved_by: null, approved_at: null }, links: [],
  }] };
}
async function versioned(input = draft()) {
  const editionFingerprint = await fingerprintLocalDraftPayload(input);
  return { ...input, edition_fingerprint: editionFingerprint,
    records: input.records.map(record => ({ ...record, edition_fingerprint: editionFingerprint })) };
}
const expected = (payload: DossierRagPayload) => ({ adventureId: payload.adventure_id, editionFingerprint: payload.edition_fingerprint });

test('default runtime policy remains the strict release policy for unregistered records', () => {
  for (const status of ['set', 'unspecified', 'pending_review'] as const) for (const approval of ['pending', 'approved'] as const) {
    const record = draft().records[0]; record.evidence = { ...record.evidence, status, approval };
    expect(isRuntimeAuthorizedDossierRecord(record)).toBe(isIndexableDossierRecord(record));
  }
});
test('trusted enrollment authorizes only exact immutable copies without changing evidence or release eligibility', async () => {
  const input = await versioned(); const before = JSON.stringify(input);
  const authorized = await authorizeLocalDraftPayload(input, expected(input));
  expect(JSON.stringify(input)).toBe(before);
  expect(authorized).toEqual(input);
  expect(authorized).not.toBe(input);
  expect(isRuntimeAuthorizedDossierRecord(input.records[0])).toBe(false);
  expect(isRuntimeAuthorizedDossierRecord(authorized.records[0])).toBe(true);
  expect(isIndexableDossierRecord(authorized.records[0])).toBe(false);
  expect(authorized.records[0].evidence).toEqual(input.records[0].evidence);
  expect(Object.isFrozen(authorized.records[0].evidence)).toBe(true);
  expect(Object.isFrozen(authorized.records[0].tags.scenes)).toBe(true);
  expect(() => { authorized.records[0].content = 'changed'; }).toThrow();
});
test('canonical fingerprint ignores only edition fields and property order, not content or array order', async () => {
  const input = await versioned();
  expect(await fingerprintLocalDraftPayload(input)).toBe(input.edition_fingerprint);
  const reverseKeys = (value: unknown): unknown => Array.isArray(value) ? value.map(reverseKeys) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, reverseKeys(child)])) : value;
  expect(await fingerprintLocalDraftPayload(reverseKeys(input) as DossierRagPayload)).toBe(input.edition_fingerprint);
  const changed = JSON.parse(JSON.stringify(input)) as DossierRagPayload;
  changed.records[0].tags.scenes = ['room', 'hall'];
  const a = await fingerprintLocalDraftPayload(changed);
  changed.records[0].tags.scenes.reverse();
  expect(await fingerprintLocalDraftPayload(changed)).not.toBe(a);
  expect(await fingerprintLocalDraftPayload({ ...input, edition_fingerprint: 'other', records: input.records.map(r => ({ ...r, edition_fingerprint: 'other' })) })).toBe(input.edition_fingerprint);
});
test('rejects changed bytes, wrong adventure, wrong record binding and invalid schema before enrollment', async () => {
  const input = await versioned();
  await expect(authorizeLocalDraftPayload(input, { ...expected(input), adventureId: 'other' })).rejects.toThrow();
  const changed = JSON.parse(JSON.stringify(input)) as DossierRagPayload;
  changed.records[0].content = 'changed';
  await expect(authorizeLocalDraftPayload(changed, expected(input))).rejects.toThrow();
  const foreign = JSON.parse(JSON.stringify(input)) as DossierRagPayload;
  foreign.records[0].edition_fingerprint = 'sha256:' + 'b'.repeat(64);
  await expect(authorizeLocalDraftPayload(foreign, expected(input))).rejects.toThrow();
  const invalid = await versioned({ ...input, records: [...input.records, ...input.records] });
  await expect(authorizeLocalDraftPayload(invalid, expected(invalid))).rejects.toThrow();
  expect(changed.records.every(record => !isRuntimeAuthorizedDossierRecord(record))).toBe(true);
});
test('unknown review-only records do not gain runtime capability', async () => {
  const input = draft(); input.records[0].evidence.status = 'unspecified';
  const bound = await versioned(input);
  await expect(authorizeLocalDraftPayload(bound, expected(bound))).rejects.toThrow();
});
test('JSON roundtrip loses capability and requires fresh trusted enrollment of the same version', async () => {
  const input = await versioned(); const authorized = await authorizeLocalDraftPayload(input, expected(input));
  const restored = JSON.parse(JSON.stringify(authorized)) as DossierRagPayload;
  expect(isRuntimeAuthorizedDossierRecord(restored.records[0])).toBe(false);
  const reenrolled = await authorizeLocalDraftPayload(restored, expected(input));
  expect(isRuntimeAuthorizedDossierRecord(reenrolled.records[0])).toBe(true);
  restored.records[0].retrieval.priority = 3;
  await expect(authorizeLocalDraftPayload(restored, expected(input))).rejects.toThrow();
});


import { bindDossierActors } from './actor-binding';
import { initializeDossierActors } from './actor-initialization';
import { applyDossierActorTurn, bindDossierActorTests } from './actor-turn';
import { applyDossierInventoryTurn } from './apply-inventory-turn';
import { emptyDossierInventory } from './inventory-state';
import { applyDossierWorldObjectTurn, emptyDossierWorldState } from './world-object-state';
import { activateDossierRag, clearDossierRag, retrieveDossierRag } from './rag-runtime';
import { embeddingService } from '../embedding-service';
import { PREDEFINED_CHARACTERS } from '../immersion/predefined-characters';
import type { NPC } from '../types';

function operationalDraft(): DossierRagPayload {
  const base = draft(); const record = base.records[0];
  base.records = [
    { ...record, record_id: 'actor-one', record_type: 'actor', tags: { ...record.tags, entities: ['npc-one'] },
      actor_binding: { entity_id: 'npc-one', name: 'Neutral witness',
        initial_state: { status: 'alive', location_id: 'room', location_name: 'Room', source_ref: 'neutral fixture',
          effects: [{ id: 'bound', name: 'Bound', description: 'Neutral fixture' }] },
        transitions: [{ id: 'release', from_effect_id: 'bound', to_effect: { id: 'freed', name: 'Freed', description: 'Neutral fixture' },
          source_location_id: 'room', access_check: { id: 'release-check', skill_names: ['Perswazja'], difficulty: 'hard' } }] } },
    { ...record, record_id: 'item-one', record_type: 'fact', tags: { ...record.tags, entities: ['key'] },
      inventory_item: { entity_id: 'key', name: 'Neutral key', category: 'story', source_location: 'room' } },
    { ...record, record_id: 'world-one', record_type: 'fact', tags: { ...record.tags, entities: ['door'] },
      world_object_binding: { entity_id: 'door', initial_state: 'closed', states: ['closed', 'open'], transitions: [{ id: 'open', from: 'closed', to: 'open' }] } },
  ];
  return base;
}

test('authorized actors use the existing initializer, identity binder and checked transition without approval spoofing', async () => {
  localStorage.clear();
  const input = await versioned(operationalDraft());
  const authorized = await authorizeLocalDraftPayload(input, expected(input));
  const init = { sessionId: 'play', adventureId: input.adventure_id, editionFingerprint: input.edition_fingerprint, now: new Date(0), storage: localStorage };
  expect(initializeDossierActors({ ...init, payload: input }).initialized).toEqual([]);
  expect(initializeDossierActors({ ...init, payload: authorized }).initialized).toEqual(['npc-one']);
  const npcs = JSON.parse(localStorage.getItem('gm_npcs')!) as NPC[];
  expect(bindDossierActors(authorized.records, [{ id: 'npc-one', name: 'Neutral witness', status: 'alive' }]).stateByEntityId.has('npc-one')).toBe(true);
  const proposed = { id: 'test', dossierConditionId: 'release-check', characterId: 'pc', skillName: 'Perswazja', skillValue: 50,
    difficulty: 'trudny' as const, modifiers: [], justification: 'Neutral fixture' };
  const tests = bindDossierActorTests(authorized, [proposed]);
  expect(tests[0].targetNpcId).toBe('npc-one');
  const turn = { payload: authorized, npcs, playthroughId: 'play', adventureId: input.adventure_id, editionFingerprint: input.edition_fingerprint,
    turnId: 'turn', rawText: '[TECZKA_STANU: npc-one | release]', writesAllowed: true, location: 'room',
    gameTime: { year: 1973, month: 9, day: 18, hour: 19, minute: 30 }, now: new Date(0), skillTests: tests, skillRolls: [] };
  expect(applyDossierActorTurn(turn).changed).toBe(false);
  expect(applyDossierActorTurn({ ...turn, skillRolls: [{ outcome: 'hard', luckSpent: 0, skillNames: ['Perswazja'], testId: 'test',
    targetNpcId: 'npc-one', resolutionId: 'roll', characterId: 'pc', requiredDifficulty: 'hard', passedRequirement: true }] }).changed).toBe(true);
  expect(authorized.records[0].evidence.approval).toBe('pending');
});
test('authorized inventory and world records use existing write gates and retain version binding', async () => {
  const input = await versioned(operationalDraft()); const authorized = await authorizeLocalDraftPayload(input, expected(input));
  const binding = { playthroughId: 'play', adventureId: input.adventure_id, editionFingerprint: input.edition_fingerprint };
  const character = { ...PREDEFINED_CHARACTERS[0], id: 'pc', equipment: [] };
  const turn = { state: emptyDossierInventory(binding), turnId: 'take', characters: [character], activeCharacter: character,
    rawText: '[EKWIPUNEK: DODAJ | @item-one]', location: 'room', writesAllowed: true, era: '1970s' };
  expect(applyDossierInventoryTurn({ ...turn, payload: input }).activeCharacter.equipment).toHaveLength(0);
  expect(applyDossierInventoryTurn({ ...turn, payload: authorized, writesAllowed: false }).activeCharacter.equipment).toHaveLength(0);
  const acquired = applyDossierInventoryTurn({ ...turn, payload: authorized });
  expect(acquired.activeCharacter.equipment).toHaveLength(1);
  expect(acquired.activeCharacter.equipment?.[0].dossierBinding?.editionFingerprint).toBe(input.edition_fingerprint);
  expect(emptyDossierWorldState(binding, input).objects).toHaveLength(0);
  const state = emptyDossierWorldState(binding, authorized);
  expect(state.objects).toHaveLength(1);
  const worldTurn = { payload: authorized, state, turnId: 'open', rawText: '[TECZKA_STANU: door | open]', location: 'room', writesAllowed: true, skillTests: [], skillRolls: [] };
  expect(applyDossierWorldObjectTurn({ ...worldTurn, writesAllowed: false }).state.objects[0].state).toBe('closed');
  expect(applyDossierWorldObjectTurn(worldTurn).state.objects[0].state).toBe('open');
});
test('only enrolled draft reaches the existing local RAG index and scene eligibility still applies', async () => {
  const input = await versioned(); const authorized = await authorizeLocalDraftPayload(input, expected(input));
  const embedding = jest.spyOn(embeddingService, 'generateLocalEmbedding').mockResolvedValue([1, 0]);
  try {
    expect((await activateDossierRag('author-test', input.adventure_id, input.edition_fingerprint, input)).ok).toBe(false);
    expect((await activateDossierRag('author-test', input.adventure_id, input.edition_fingerprint, authorized)).ok).toBe(true);
    const context = { activationId: 'author-test', adventureId: input.adventure_id, editionFingerprint: input.edition_fingerprint,
      query: 'neutral', activeSceneIds: [], presentEntityIds: [], acquiredRecordIds: [], mechanicIds: [] };
    expect(await retrieveDossierRag(context)).toHaveLength(0);
    expect(await retrieveDossierRag({ ...context, activeSceneIds: ['room'] })).toHaveLength(1);
  } finally { clearDossierRag('author-test'); embedding.mockRestore(); }
});


test('separate route module loads recognize the same enrolled object without granting serialized or default drafts', async () => {
  jest.resetModules();
  const routeA = await import('./runtime-authorization');
  const input = await versioned();
  const enrolled = await routeA.authorizeLocalDraftPayload(input, expected(input));
  jest.resetModules();
  const routeB = await import('./runtime-authorization');
  expect(routeB.isRuntimeAuthorizedDossierRecord(enrolled.records[0])).toBe(true);
  expect(routeB.isRuntimeAuthorizedDossierRecord(input.records[0])).toBe(false);
  expect(routeB.isRuntimeAuthorizedDossierRecord(JSON.parse(JSON.stringify(enrolled.records[0])))).toBe(false);
  expect(enrolled.records[0].evidence.approval).toBe('pending');
  expect(isIndexableDossierRecord(enrolled.records[0])).toBe(false);
  expect(Object.isFrozen(enrolled.records[0])).toBe(true);
});
