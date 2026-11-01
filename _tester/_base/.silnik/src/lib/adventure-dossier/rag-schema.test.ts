import { validateDossierRagPayload } from './rag-schema';

const fingerprint = 'sha256:synthetic-schema-test';

function record(content: string) {
  return {
    schema_version: 1,
    record_id: 'schema-test.fact',
    record_type: 'fact',
    adventure_id: 'schema-test',
    edition_fingerprint: fingerprint,
    language: 'pl',
    content,
    tags: { entities: [], scenes: [], mechanics: [], topics: [], triggers: [] },
    retrieval: { visibility: 'gm_only', availability: 'always', condition: null, priority: 1 },
    evidence: {
      provenance: 'approved_design',
      source_ref: 'synthetic-test-fixture',
      status: 'set',
      approval: 'approved',
      approved_by: 'test-fixture',
      approved_at: '2026-10-11T00:00:00Z',
    },
    links: [],
  };
}

describe('dossier record schema', () => {
  it('rejects oversized per-turn records before indexing', () => {
    const result = validateDossierRagPayload({
      schema_version: 1,
      adventure_id: 'schema-test',
      edition_fingerprint: fingerprint,
      records: [record('x'.repeat(4001))],
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('records[0].content: exceeds 4000 characters');
  });

  it('rejects invented or unregistered mechanic tags', () => {
    const invalidRecord = {
      ...record('synthetic fact'),
      tags: { entities: [], scenes: [], mechanics: ['coc7:25'], topics: [], triggers: [] },
    };
    const result = validateDossierRagPayload({
      schema_version: 1,
      adventure_id: 'schema-test',
      edition_fingerprint: fingerprint,
      records: [invalidRecord],
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'records[0].tags.mechanics: contains an unknown mechanic ID',
    );
  });

  it('accepts only registered IDs in explicit active-mechanic conditions', () => {
    const validRecord = {
      ...record('synthetic mechanic hook'),
      record_type: 'mechanic_hook',
      retrieval: {
        visibility: 'gm_only',
        availability: 'state_condition',
        condition: { all: [{ kind: 'mechanic_active', id: 'coc7:social-resistance' }] },
        priority: 1,
      },
    };
    const valid = validateDossierRagPayload({
      schema_version: 1,
      adventure_id: 'schema-test',
      edition_fingerprint: fingerprint,
      records: [validRecord],
    });
    expect(valid.ok).toBe(true);

    const invalid = validateDossierRagPayload({
      schema_version: 1,
      adventure_id: 'schema-test',
      edition_fingerprint: fingerprint,
      records: [{
        ...validRecord,
        retrieval: {
          ...validRecord.retrieval,
          condition: { all: [{ kind: 'mechanic_active', id: 'coc7:unknown-mechanic' }] },
        },
      }],
    });
    expect(invalid.ok).toBe(false);
    expect(invalid.errors).toContain(
      'records[0].retrieval.condition: unsupported condition structure',
    );
  });
});


test('one condition cannot bind two NPCs or both an NPC and an inventory item',()=>{
 const check={id:'shared-check',skill_names:['Dexterity'],difficulty:'hard'};
 const actor=(entity:string)=>({...record('Actor'),record_id:entity,record_type:'actor',tags:{...record('').tags,entities:[entity]},actor_binding:{entity_id:entity,name:entity,transitions:[{id:'free',from_effect_id:'bound',to_effect:{id:'free',name:'Free',description:'Free'},source_location_id:'cell',access_check:check}]}});
 const item={...record('Item'),record_id:'item',inventory_item:{entity_id:'item-entity',name:'Item',category:'story',source_location:'cell',access_check:check}};
 const validate=(records:unknown[])=>validateDossierRagPayload({schema_version:1,adventure_id:'schema-test',edition_fingerprint:fingerprint,records});
 expect(validate([actor('npc-a')]).ok).toBe(true);
 expect(validate([actor('npc-a'),actor('npc-b')]).ok).toBe(false);
 for(const records of [[actor('npc-a'),item],[item,actor('npc-a')]])expect(validate(records).ok).toBe(false);
});

function worldRecord(entity='obj-neutral',recordId='world-neutral',checkId='world-test') {
 return {...record('Neutral authored world object'),record_id:recordId,
  tags:{entities:[entity],scenes:['neutral-scene'],mechanics:[],topics:[],triggers:[]},
  world_object_binding:{entity_id:entity,initial_state:'active',states:['active','stopped'],transitions:[
   {id:'stop',from:'active',to:'stopped',condition_id:checkId,
    access_check:{id:checkId,skill_names:['Mechanika'],difficulty:'hard'}}
  ]}};
}
const worldPayload=(records:unknown[])=>({schema_version:1,adventure_id:'schema-test',edition_fingerprint:fingerprint,records});
test('world schema accepts exact reviewed check and distinct instance checks',()=>{
 const card=worldRecord();
 const extended={...card,world_object_binding:{...card.world_object_binding,instances:[
  {...card.world_object_binding,entity_id:'obj-neutral-one',transitions:[
   {...card.world_object_binding.transitions[0],condition_id:'instance-test',
    access_check:{id:'instance-test',skill_names:['Mechanika'],difficulty:'regular'}}
  ]}
 ]}};
 expect(validateDossierRagPayload(worldPayload([extended])).ok).toBe(true);
});
test.each([
 {id:'other-id',skill_names:['Mechanika'],difficulty:'hard'},
 {id:'world-test',skill_names:[],difficulty:'hard'},
 {id:'world-test',skill_names:['Mechanika'],difficulty:'invented'},
 {id:'world-test',skill_names:['Mechanika'],difficulty:'hard',unreviewed:true},
])('world schema rejects malformed or mismatched reviewed check %p',access_check=>{
 const card=worldRecord();
 card.world_object_binding.transitions[0].access_check=access_check;
 expect(validateDossierRagPayload(worldPayload([card])).ok).toBe(false);
});
test('world condition IDs cannot be shared with another record or inventory check',()=>{
 expect(validateDossierRagPayload(worldPayload([worldRecord(),worldRecord('obj-other','other-record')])).ok).toBe(false);
 const item={...record('Neutral inventory fixture'),record_id:'item-check',record_type:'fact',
  tags:{entities:['item-neutral'],scenes:['neutral-scene'],mechanics:[],topics:[],triggers:[]},
  inventory_item:{entity_id:'item-neutral',name:'Neutral item',category:'story',source_location:'neutral-scene',
   access_check:{id:'world-test',skill_names:['Mechanika'],difficulty:'hard'}}};
 expect(validateDossierRagPayload(worldPayload([item])).ok).toBe(true);
 expect(validateDossierRagPayload(worldPayload([worldRecord(),item])).ok).toBe(false);
});

test('world check cannot exist without its condition or collide with an actor check',()=>{
 const card=worldRecord(),{condition_id:_condition,...unbound}=card.world_object_binding.transitions[0];
 expect(validateDossierRagPayload(worldPayload([{...card,world_object_binding:{...card.world_object_binding,transitions:[unbound]}}])).ok).toBe(false);
 const actor={...record('Neutral actor'),record_id:'actor-check',record_type:'actor',
  tags:{entities:['npc-neutral'],scenes:['neutral-scene'],mechanics:[],topics:[],triggers:[]},
  actor_binding:{entity_id:'npc-neutral',name:'Neutral actor',transitions:[{id:'change',from_effect_id:'before',
   to_effect:{id:'after',name:'After',description:'Neutral effect'},source_location_id:'neutral-scene',
   access_check:{id:'world-test',skill_names:['Mechanika'],difficulty:'hard'}}]}};
 expect(validateDossierRagPayload(worldPayload([actor])).ok).toBe(true);
 expect(validateDossierRagPayload(worldPayload([card,actor])).ok).toBe(false);
});
