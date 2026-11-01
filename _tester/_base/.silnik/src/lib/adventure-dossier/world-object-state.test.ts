import { applyDossierWorldObjectTurn, emptyDossierWorldState, isDossierWorldState,
  loadDossierWorldState, storeDossierWorldState } from './world-object-state';
import type { DossierRagPayload } from './rag-schema';
import { validateDossierRagPayload } from './rag-schema';
import type { SkillRollResolution, SkillTestData } from '../parsers/types';

const fingerprint = 'sha256:' + 'a'.repeat(64);
const binding = {
  entity_id: 'obj-hoist',
  initial_state: 'built',
  states: ['built', 'disabled', 'destroyed'],
  transitions: [
    { id: 'disable-hoist', from: 'built', to: 'disabled', condition_id: 'disable-hoist-test',
      access_check: { id: 'disable-hoist-test', skill_names: ['Mechanika'], difficulty: 'hard' as const } },
    { id: 'destroy-hoist', from: 'built', to: 'destroyed' },
  ],
};
const payload: DossierRagPayload = {
  schema_version: 1,
  adventure_id: 'fixture',
  edition_fingerprint: fingerprint,
  records: [{
    schema_version: 1, record_id: 'hoist-card', record_type: 'fact', adventure_id: 'fixture',
    edition_fingerprint: fingerprint, language: 'pl', content: 'Neutral fixture.',
    tags: { entities: ['obj-hoist'], scenes: ['crater'], mechanics: [], topics: [], triggers: [] },
    retrieval: { visibility: 'gm_only', availability: 'always', condition: null, priority: 1 },
    evidence: { provenance: 'approved_design', source_ref: 'neutral fixture', status: 'set', approval: 'approved', approved_by: 'fixture', approved_at: '2026-10-16T00:00:00Z' },
    links: [], world_object_binding: binding,
  }],
};
const state = () => emptyDossierWorldState({ playthroughId: 'play-1', adventureId: 'fixture', editionFingerprint: fingerprint }, payload);
const skillTest: SkillTestData = {
  id: 'test-1', characterId: 'pc-1', dossierConditionId: 'disable-hoist-test', skillName: 'Mechanika', skillValue: 50,
  difficulty: 'trudny', modifiers: [], justification: 'Neutral test',
};
const passed: SkillRollResolution = {
  outcome: 'hard', luckSpent: 0, skillNames: ['Mechanika'], testId: 'test-1',
  resolutionId: 'roll-1', characterId: 'pc-1', requiredDifficulty: 'hard', passedRequirement: true,
};

describe('dossier world-object state transitions', () => {
  test('seeds a collection as distinct, independently addressable world objects', () => {
    const instances = ['august', 'jacob', 'empty-1', 'empty-2', 'empty-3'].map((suffix, index) => ({
      entity_id: `obj-blue-sarcophagus-${suffix}`,
      initial_state: index < 2 ? 'occupied' : 'empty',
      states: ['occupied', 'empty', 'open', 'sealed'],
      transitions: [{ id: 'open', from: index < 2 ? 'occupied' : 'empty', to: 'open' }],
    }));
    instances[0].transitions.push({ id: 'emerge', from: 'occupied', to: 'empty' });
    const crystal = {
      entity_id: 'obj-blue-crystal', initial_state: 'tracked', states: ['tracked'], transitions: [],
      instances: [{ entity_id: 'obj-blue-crystal-extraction', initial_state: 'unextracted',
        states: ['unextracted', 'extracted'], transitions: [{ id: 'extract', from: 'unextracted', to: 'extracted' }] },
      { entity_id: 'obj-blue-crystal-transport', initial_state: 'at-crater', states: ['at-crater', 'in-transit', 'at-lake'],
        transitions: [{ id: 'transport', from: 'at-crater', to: 'in-transit', requires: [{ entity_id: 'obj-blue-crystal-extraction', state: 'extracted' }] }] }],
    };
    const collectionPayload: DossierRagPayload = {
      ...payload,
      records: [
        { ...payload.records[0], record_id: 'sarcophagi-card',
          tags: { ...payload.records[0].tags, entities: ['obj-blue-sarcophagus'], scenes: ['crypt'] },
          world_object_binding: { entity_id: 'obj-blue-sarcophagus', initial_state: 'collection', states: ['collection'], transitions: [], instances } },
        { ...payload.records[0], record_id: 'crystal-card',
          tags: { ...payload.records[0].tags, entities: ['obj-blue-crystal'] }, world_object_binding: crystal },
      ],
    };
    expect(validateDossierRagPayload(collectionPayload).ok).toBe(true);
    const danglingRequirement = JSON.parse(JSON.stringify(collectionPayload)) as DossierRagPayload;
    danglingRequirement.records[1].world_object_binding!.instances![1].transitions[0].requires = [
      { entity_id: 'obj-blue-crystal-missing', state: 'extracted' },
    ];
    expect(validateDossierRagPayload(danglingRequirement).ok).toBe(false);
    const initial = emptyDossierWorldState({ playthroughId: 'play-1', adventureId: 'fixture', editionFingerprint: fingerprint }, collectionPayload);
    expect(initial.objects).toEqual(expect.arrayContaining([
      { entityId: 'obj-blue-sarcophagus', state: 'collection' },
      { entityId: 'obj-blue-sarcophagus-august', state: 'occupied' },
      { entityId: 'obj-blue-sarcophagus-jacob', state: 'occupied' },
      { entityId: 'obj-blue-sarcophagus-empty-1', state: 'empty' },
      { entityId: 'obj-blue-sarcophagus-empty-2', state: 'empty' },
      { entityId: 'obj-blue-sarcophagus-empty-3', state: 'empty' },
    ]));
    const opened = applyDossierWorldObjectTurn({
      payload: collectionPayload, state: initial, turnId: 'open-one',
      rawText: '[TECZKA_STANU: obj-blue-sarcophagus-empty-2 | open]', location: 'crypt',
      writesAllowed: true, skillTests: [], skillRolls: [],
    });
    expect(opened.state.objects.find(item => item.entityId === 'obj-blue-sarcophagus-empty-2')?.state).toBe('open');
    expect(opened.state.objects.find(item => item.entityId === 'obj-blue-sarcophagus-empty-1')?.state).toBe('empty');
    const crystalState = emptyDossierWorldState({ playthroughId: 'play-crystal', adventureId: 'fixture', editionFingerprint: fingerprint }, collectionPayload);
    const earlyTransport = applyDossierWorldObjectTurn({ payload: collectionPayload, state: crystalState, turnId: 'too-early',
      rawText: '[TECZKA_STANU: obj-blue-crystal-transport | transport]', location: 'crater', writesAllowed: true, skillTests: [], skillRolls: [] });
    expect(earlyTransport.rejected).toEqual(['obj-blue-crystal-transport']);
    const extracted = applyDossierWorldObjectTurn({ payload: collectionPayload, state: crystalState, turnId: 'extract',
      rawText: '[TECZKA_STANU: obj-blue-crystal-extraction | extract]', location: 'crater', writesAllowed: true, skillTests: [], skillRolls: [] });
    const afterExtraction = applyDossierWorldObjectTurn({ payload: collectionPayload, state: extracted.state, turnId: 'transport',
      rawText: '[TECZKA_STANU: obj-blue-crystal-transport | transport]', location: 'crater', writesAllowed: true, skillTests: [], skillRolls: [] });
    expect(afterExtraction.state.objects.find(item => item.entityId === 'obj-blue-crystal-transport')?.state).toBe('in-transit');
  });

  test('accepts a bounded transition table and rejects transitions to undefined states', () => {
    expect(validateDossierRagPayload(payload).ok).toBe(true);
    const invalid = { ...payload, records: payload.records.map(record => ({
      ...record,
      world_object_binding: { ...binding, transitions: [{ id: 'bad', from: 'built', to: 'not-listed' }] },
    })) };
    expect(validateDossierRagPayload(invalid).ok).toBe(false);
  });

  test('seeds only authored initial states and applies a transition after its matching local result', () => {
    const initial = state();
    expect(initial.objects).toEqual([{ entityId: 'obj-hoist', state: 'built' }]);
    const result = applyDossierWorldObjectTurn({
      payload, state: initial, turnId: 'assistant-1', rawText: '[TECZKA_STANU: obj-hoist | disable-hoist]',
      location: 'crater', writesAllowed: true, skillTests: [skillTest], skillRolls: [passed],
    });
    expect(result.state.objects[0]).toMatchObject({ entityId: 'obj-hoist', state: 'disabled', updatedByTurnId: 'assistant-1', lastResolutionId: 'roll-1' });
    expect(result.cleanText).toBe('');
  });

  test('does not infer a transition from prose or from a failed, wrong-target, or prior-turn test', () => {
    const initial = state();
    const rawText = 'The hoist is disabled. [TECZKA_STANU: obj-hoist | disable-hoist]';
    for (const result of [
      applyDossierWorldObjectTurn({ payload, state: initial, turnId: 'turn-a', rawText, location: 'crater', writesAllowed: true, skillTests: [], skillRolls: [] }),
      applyDossierWorldObjectTurn({ payload, state: initial, turnId: 'turn-b', rawText, location: 'crater', writesAllowed: true, skillTests: [skillTest], skillRolls: [{ ...passed, outcome: 'fail', passedRequirement: false }] }),
      applyDossierWorldObjectTurn({ payload, state: initial, turnId: 'turn-c', rawText, location: 'crater', writesAllowed: true, skillTests: [skillTest], skillRolls: [{ ...passed, testId: 'another-test' }] }),
    ]) {
      expect(result.state.objects[0].state).toBe('built');
      expect(result.rejected).toEqual(['obj-hoist']);
      expect(result.cleanText).toBe('The hoist is disabled.');
    }
  });

  test('rejects wrong scene, unknown transition, and writes outside an authorized turn', () => {
    const initial = state();
    for (const result of [
      applyDossierWorldObjectTurn({ payload, state: initial, turnId: 'a', rawText: '[TECZKA_STANU: obj-hoist | destroy-hoist]', location: 'village', writesAllowed: true, skillTests: [], skillRolls: [] }),
      applyDossierWorldObjectTurn({ payload, state: initial, turnId: 'b', rawText: '[TECZKA_STANU: obj-hoist | missing]', location: 'crater', writesAllowed: true, skillTests: [], skillRolls: [] }),
      applyDossierWorldObjectTurn({ payload, state: initial, turnId: 'c', rawText: '[TECZKA_STANU: obj-hoist | destroy-hoist]', location: 'crater', writesAllowed: false, skillTests: [], skillRolls: [] }),
    ]) {
      expect(result.state.objects[0].state).toBe('built');
      expect(result.rejected).toEqual(['obj-hoist']);
    }
  });

  test('is idempotent per assistant turn and validates edition-bound campaign state', () => {
    const initial = state();
    const input = { payload, state: initial, turnId: 'same-turn', rawText: '[TECZKA_STANU: obj-hoist | destroy-hoist]', location: 'crater', writesAllowed: true, skillTests: [] as SkillTestData[], skillRolls: [] as SkillRollResolution[] };
    const once = applyDossierWorldObjectTurn(input);
    const twice = applyDossierWorldObjectTurn({ ...input, state: once.state });
    expect(once.state.objects[0].state).toBe('destroyed');
    expect(twice.state).toEqual(once.state);
    expect(twice.cleanText).toBe('');
    expect(isDossierWorldState(once.state)).toBe(true);
    expect(() => applyDossierWorldObjectTurn({ ...input, state: { ...once.state, editionFingerprint: 'sha256:' + 'b'.repeat(64) } })).toThrow('DOSSIER_WORLD_STATE_INVALID');
  });

  test('persists campaign state locally and rejects state from another edition', () => {
    const initial = state();
    window.localStorage.clear();
    storeDossierWorldState(initial);
    expect(loadDossierWorldState({ playthroughId: 'play-1', adventureId: 'fixture', editionFingerprint: fingerprint }, payload))
      .toEqual(initial);
    expect(() => loadDossierWorldState({ playthroughId: 'play-1', adventureId: 'fixture', editionFingerprint: 'sha256:' + 'b'.repeat(64) }, payload))
      .toThrow('DOSSIER_WORLD_STATE_INVALID');
  });
});


test.each([
  ['other character', {characterId:'pc-other'}],
  ['other skill', {skillNames:['Persuade']}],
  ['wrong required difficulty', {requiredDifficulty:'regular'}],
  ['insufficient outcome despite success flag', {outcome:'regular'}],
  ['invalid resolution identity', {resolutionId:'invalid id'}],
] as const)('world transition rejects %s', (_label, patch) => {
  const result=applyDossierWorldObjectTurn({payload,state:state(),turnId:'guard-test',
    rawText:'[TECZKA_STANU: obj-hoist | disable-hoist]',location:'crater',writesAllowed:true,
    skillTests:[skillTest],skillRolls:[{...passed,...patch,skillNames:('skillNames' in patch ? [...patch.skillNames] : passed.skillNames)}]});
  expect(result.changed).toBe(false);
  expect(result.rejected).toEqual(['obj-hoist']);
});


test('consumed roll cannot be reused after another transition and save/reload', () => {
  const cycle:DossierRagPayload={...payload,records:[{...payload.records[0],world_object_binding:{...binding,
    transitions:[...binding.transitions,{id:'repair',from:'disabled',to:'built'}]}}]};
  const input={payload:cycle,state:state(),turnId:'first',rawText:'[TECZKA_STANU: obj-hoist | disable-hoist]',
    location:'crater',writesAllowed:true,skillTests:[skillTest],skillRolls:[passed]};
  const first=applyDossierWorldObjectTurn(input);expect(first.changed).toBe(true);
  const repaired=applyDossierWorldObjectTurn({...input,state:first.state,turnId:'repair',rawText:'[TECZKA_STANU: obj-hoist | repair]',skillTests:[],skillRolls:[]});
  expect(repaired.state.objects[0].state).toBe('built');
  localStorage.clear();storeDossierWorldState(repaired.state);
  const restored=loadDossierWorldState({playthroughId:'play-1',adventureId:'fixture',editionFingerprint:fingerprint},cycle);
  const replay=applyDossierWorldObjectTurn({...input,state:restored,turnId:'replay'});
  expect(replay.changed).toBe(false);expect(replay.state.objects[0].state).toBe('built');
  expect(applyDossierWorldObjectTurn({...input,state:restored,turnId:'fresh',skillRolls:[{...passed,resolutionId:'fresh-roll'}]}).changed).toBe(true);
});

test('one roll cannot change two independent objects in the same turn', () => {
  const pair:DossierRagPayload={...payload,records:[payload.records[0],{...payload.records[0],record_id:'second',
    tags:{...payload.records[0].tags,entities:['obj-second']},world_object_binding:{...binding,entity_id:'obj-second',transitions:binding.transitions.map(t=>t.access_check?{...t,condition_id:'second-test',access_check:{...t.access_check,id:'second-test'}}:t)}}]};
  const initial=emptyDossierWorldState({playthroughId:'play-1',adventureId:'fixture',editionFingerprint:fingerprint},pair);
  const result=applyDossierWorldObjectTurn({payload:pair,state:initial,turnId:'both',
    rawText:'[TECZKA_STANU: obj-hoist | disable-hoist] [TECZKA_STANU: obj-second | disable-hoist]',
    location:'crater',writesAllowed:true,skillTests:[skillTest],skillRolls:[passed]});
  expect(result.state.objects.map(o=>o.state)).toEqual(['disabled','built']);
  expect(result.rejected).toEqual(['obj-second']);
});


test('validates consumption history and retains available evidence from older saves', () => {
  const initial=state();
  expect(isDossierWorldState(initial)).toBe(true);
  for(const usedResolutionIds of [['same','same'],['invalid id'],[42],Array.from({length:10001},(_,i)=>`r-${i}`)]) {
    expect(isDossierWorldState({...initial,usedResolutionIds})).toBe(false);
  }
  const legacy={...initial,objects:[{...initial.objects[0],lastResolutionId:passed.resolutionId}]};
  const result=applyDossierWorldObjectTurn({payload,state:legacy,turnId:'legacy-replay',
    rawText:'[TECZKA_STANU: obj-hoist | disable-hoist]',location:'crater',writesAllowed:true,
    skillTests:[skillTest],skillRolls:[passed]});
  expect(result.changed).toBe(false);
  expect(result.state.usedResolutionIds).toEqual([passed.resolutionId]);
});

test('world transition rejects a locally passed easier test than its authored reviewed check', () => {
  const reviewedBinding = {...binding, transitions:[{
    ...binding.transitions[0],
    access_check:{id:'disable-hoist-test',skill_names:['Mechanika'],difficulty:'hard' as const},
  }]};
  const authoredPayload:DossierRagPayload={...payload,records:[{...payload.records[0],world_object_binding:reviewedBinding}]};
  const initial=emptyDossierWorldState({playthroughId:'play-authored',adventureId:'fixture',editionFingerprint:fingerprint},authoredPayload);
  const result=applyDossierWorldObjectTurn({
    payload:authoredPayload,state:initial,turnId:'easy-proposal',
    rawText:'[TECZKA_STANU: obj-hoist | disable-hoist]',location:'crater',writesAllowed:true,
    skillTests:[{...skillTest,difficulty:'zwykly'}],
    skillRolls:[{...passed,outcome:'regular',requiredDifficulty:'regular'}],
  });
  expect(result.changed).toBe(false);
  expect(result.state.objects[0].state).toBe('built');
  expect(result.rejected).toEqual(['obj-hoist']);
});

test.each([
  ['wrong authored skill', {...skillTest,skillName:'Perswazja'}, {...passed,skillNames:['Perswazja']}],
  ['harder unreviewed declared difficulty', {...skillTest,difficulty:'ekstremalny'}, {...passed,outcome:'extreme',requiredDifficulty:'extreme'}],
  ['NPC target on a world-object test', {...skillTest,targetNpcId:'npc-other'}, {...passed,targetNpcId:'npc-other'}],
] as const)('world reviewed check rejects %s even when test and local result agree', (_label,test,roll) => {
  const result=applyDossierWorldObjectTurn({payload,state:state(),turnId:'authored-context',
    rawText:'[TECZKA_STANU: obj-hoist | disable-hoist]',location:'crater',writesAllowed:true,
    skillTests:[{...test,modifiers:[...test.modifiers]}],skillRolls:[{...roll,skillNames:[...roll.skillNames]}]});
  expect(result.changed).toBe(false);expect(result.rejected).toEqual(['obj-hoist']);
});

test('legacy condition-only transitions load but cannot execute without an explicit authored check',()=>{
  const {access_check:_check,...legacyTransition}=binding.transitions[0];
  const legacy:DossierRagPayload={...payload,records:[{...payload.records[0],
    world_object_binding:{...binding,transitions:[legacyTransition]}}]};
  expect(validateDossierRagPayload(legacy).ok).toBe(true);
  const initial=emptyDossierWorldState({playthroughId:'legacy',adventureId:'fixture',editionFingerprint:fingerprint},legacy);
  const result=applyDossierWorldObjectTurn({payload:legacy,state:initial,turnId:'legacy-check',
    rawText:'[TECZKA_STANU: obj-hoist | disable-hoist]',location:'crater',writesAllowed:true,
    skillTests:[skillTest],skillRolls:[passed]});
  expect(result.changed).toBe(false);expect(result.rejected).toEqual(['obj-hoist']);
});

test('a condition cannot authorize another owning record or ambiguous object even with a valid local result',()=>{
  const duplicate:DossierRagPayload={...payload,records:[...payload.records,{...payload.records[0],record_id:'other-record',
    tags:{...payload.records[0].tags,entities:['obj-other']},world_object_binding:{...binding,entity_id:'obj-other'}}]};
  const initial=emptyDossierWorldState({playthroughId:'ambiguous',adventureId:'fixture',editionFingerprint:fingerprint},duplicate);
  const result=applyDossierWorldObjectTurn({payload:duplicate,state:initial,turnId:'ambiguous-check',
    rawText:'[TECZKA_STANU: obj-hoist | disable-hoist]',location:'crater',writesAllowed:true,
    skillTests:[skillTest],skillRolls:[passed]});
  expect(result.changed).toBe(false);expect(result.rejected).toEqual(['obj-hoist']);
});

test('an instance executes only its own reviewed check and leaves the parent state unchanged',()=>{
  const instance={...binding,entity_id:'obj-hoist-one',transitions:[{...binding.transitions[0],
    condition_id:'instance-test',access_check:{id:'instance-test',skill_names:['Mechanika'],difficulty:'hard' as const}}]};
  const collection:DossierRagPayload={...payload,records:[{...payload.records[0],
    world_object_binding:{...binding,transitions:[],instances:[instance]}}]};
  expect(validateDossierRagPayload(collection).ok).toBe(true);
  const initial=emptyDossierWorldState({playthroughId:'instances',adventureId:'fixture',editionFingerprint:fingerprint},collection);
  const result=applyDossierWorldObjectTurn({payload:collection,state:initial,turnId:'instance-turn',
    rawText:'[TECZKA_STANU: obj-hoist-one | disable-hoist]',location:'crater',writesAllowed:true,
    skillTests:[{...skillTest,dossierConditionId:'instance-test'}],skillRolls:[passed]});
  expect(result.state.objects.find(o=>o.entityId==='obj-hoist-one')?.state).toBe('disabled');
  expect(result.state.objects.find(o=>o.entityId==='obj-hoist')?.state).toBe('built');
  expect(result.rejected).toEqual([]);
});


test('enrolled actual Prabuty draft executes the reviewed hard repair without invented human approval', async () => {
  const { TextEncoder } = await import('node:util');
  const { webcrypto } = await import('node:crypto');
  Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: TextEncoder });
  Object.defineProperty(globalThis.crypto, 'subtle', { configurable: true, value: webcrypto.subtle });
  const { createAuthoredPrabutyPayload, PRABUTY_WORLD_IDS } = await import('./authored-prabuty');
  const { authorizeLocalDraftPayload, fingerprintLocalDraftPayload } = await import('./runtime-authorization');
  const editionFingerprint = await fingerprintLocalDraftPayload(createAuthoredPrabutyPayload(fingerprint));
  const draft = createAuthoredPrabutyPayload(editionFingerprint);
  const authorized = await authorizeLocalDraftPayload(draft, { adventureId: draft.adventure_id, editionFingerprint });
  const generator = authorized.records.find(record => record.world_object_binding?.entity_id === PRABUTY_WORLD_IDS.generator)!;
  expect(generator.evidence).toMatchObject({ approval: 'pending', approved_by: null, approved_at: null });
  const initial = emptyDossierWorldState({ playthroughId: 'actual-prabuty', adventureId: draft.adventure_id, editionFingerprint }, authorized);
  const input = { payload: authorized, state: initial, turnId: 'repair-generators',
    rawText: '[TECZKA_STANU: ' + PRABUTY_WORLD_IDS.generator + ' | disable-preparing]', location: generator.tags.scenes[0],
    writesAllowed: true, skillTests: [{ ...skillTest, dossierConditionId: 'prabuty-disable-preparing', skillName: 'Naprawa elektryczna' }],
    skillRolls: [{ ...passed, skillNames: ['Naprawa elektryczna'] }] };
  expect(applyDossierWorldObjectTurn({ ...input, skillRolls: [] }).changed).toBe(false);
  expect(applyDossierWorldObjectTurn({ ...input, payload: draft }).changed).toBe(false);
  const result = applyDossierWorldObjectTurn(input);
  expect(result.rejected).toEqual([]);
  expect(result.state.objects.find(object => object.entityId === PRABUTY_WORLD_IDS.generator)?.state).toBe('disabled');
  expect(generator.evidence.approval).toBe('pending');
});

test('released approved transition still rejects missing human reviewer metadata', () => {
  const unreviewed = { ...payload, records: payload.records.map(record => ({ ...record,
    evidence: { ...record.evidence, approved_by: null, approved_at: null } })) };
  const result = applyDossierWorldObjectTurn({ payload: unreviewed, state: state(), turnId: 'missing-reviewer',
    rawText: '[TECZKA_STANU: obj-hoist | disable-hoist]', location: 'crater', writesAllowed: true,
    skillTests: [skillTest], skillRolls: [passed] });
  expect(result.changed).toBe(false);
  expect(result.rejected).toEqual(['obj-hoist']);
});
