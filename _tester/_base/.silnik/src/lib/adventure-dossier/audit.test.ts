import { auditDossier, type AuditInput } from './audit';
import type { DossierRagRecord } from './rag-schema';
const fingerprint='sha256:'+'a'.repeat(64);
const record=(id:string):DossierRagRecord=>({schema_version:1,record_id:id,record_type:'fact',adventure_id:'fixture',edition_fingerprint:fingerprint,language:'pl',content:'Autorska neutralna karta.',tags:{entities:[],scenes:[],mechanics:[],topics:[],triggers:[]},retrieval:{visibility:'gm_only',availability:'always',condition:null,priority:1},evidence:{provenance:'approved_design',source_ref:'neutral fixture',status:'set',approval:'approved',approved_by:'fixture author',approved_at:'2026-10-16T00:00:00Z'},links:[]});
const fixture=():AuditInput=>({manifest:{approval:'approved',adventure_id:'fixture',edition_fingerprint:fingerprint},records:[{file:'records/a.yaml',value:record('a')}],graph:{nodes:[{id:'start',kind:'location',start:true},{id:'optional',kind:'scene',optional:true}],edges:[]},supplement:{items:[],scene_frames:[]},actors:[]});
const problems=(input:AuditInput)=>auditDossier(input).results.filter(r=>r.status==='discrepancy');

test('optional scenes, global cards and cycles are valid; relationships are not travel',()=>{
 const f=fixture();f.graph!.nodes.push({id:'next',kind:'location'},{id:'npc-a',kind:'actor'},{id:'npc-b',kind:'actor'});
 f.graph!.edges.push({id:'go',from:'start',to:'next',kind:'transition'},{id:'back',from:'next',to:'start',kind:'transition'},{id:'rel',from:'npc-a',to:'npc-b',kind:'relationship'});
 expect(problems(f)).toEqual([]);
 expect(auditDossier(f).results.find(r=>r.code==='REACHABILITY'&&r.ids[0]==='next')?.status).toBe('checked');
 expect(auditDossier(f).results.find(r=>r.code==='REACHABILITY'&&r.ids[0]==='optional')?.status).toBe('not_applicable');
});
test('finds dangling reference at exact file/field while keeping other checks',()=>{
 const f=fixture();(f.records[0].value as DossierRagRecord).links=['missing'];f.records.push({file:'records/b.yaml',value:record('b')});
 expect(problems(f)).toEqual(expect.arrayContaining([expect.objectContaining({code:'LINK_TARGET',file:'records/a.yaml',field:'links[0]',ids:['a','missing']})]));
 expect(auditDossier(f).results.some(r=>r.code==='ID_UNIQUE'&&r.ids[0]==='b'&&r.status==='checked')).toBe(true);
});
test('duplicate IDs and malformed independent records cannot produce green',()=>{
 const f=fixture();f.records.push({file:'records/b.yaml',value:record('a')},{file:'records/c.yaml',value:null});
 expect(problems(f).filter(r=>r.code==='ID_UNIQUE')).toHaveLength(3);
 expect(auditDossier(f).exitCode).toBe(1);
});
test('detects dropped raw RAG link and a stale generated record',()=>{
 const f=fixture();f.records.push({file:'records/b.yaml',value:record('b')});f.rawRefs=[{recordId:'a',ref:'npc-fixture',target:'b',file:'source.md'}];f.expectedRecords=[{...record('a'),links:['b']}];
 expect(problems(f).map(r=>r.code)).toEqual(expect.arrayContaining(['RAG_LINK_DROPPED','COMPILED_RECORD_STALE']));
});
test('detects conflicting tests, wrong owner and invalid locator',()=>{
 const f=fixture();const item=record('a');item.inventory_item={entity_id:'object',name:'Autorski klucz',category:'story',source_location:'start',access_check:{id:'gate',skill_names:['Spot Hidden'],difficulty:'hard'}};
 const other=record('b');other.inventory_item={...item.inventory_item,entity_id:'object-two',access_check:{id:'gate',skill_names:['Spot Hidden'],difficulty:'regular'}};other.local_handout={kind:'embedded_image',pdf_page:0,width:10,height:10,rgba_sha256:'invalid',title:'fixture',audience:'party'};
 f.records=[{file:'records/a.yaml',value:item},{file:'records/b.yaml',value:other}];f.supplement={items:[{id:'object',owner:'nonexistent',inventory_binding:{access_check:item.inventory_item.access_check}}]};
 expect(problems(f).map(r=>r.code)).toEqual(expect.arrayContaining(['ACCESS_CHECK_CONFLICT','LINK_TARGET','HANDOUT_LOCATOR']));
});
test('free access has justified N/A; prose is review, never a false contradiction',()=>{
 const f=fixture();const r=record('a');r.inventory_item={entity_id:'object',name:'Autorski klucz',category:'story',source_location:'start'};f.records[0].value=r;
 f.graph!.edges.push({id:'loop',from:'start',to:'start',kind:'transition',condition:'jeżeli sytuacja pozwala'});
 expect(problems(f)).toEqual([]);
 expect(auditDossier(f).results.find(r=>r.code==='ACCESS_CHECK_NOT_REQUIRED')?.status).toBe('not_applicable');
 expect(auditDossier(f).results.find(r=>r.code==='CONDITION_PROSE')?.status).toBe('unverifiable');
});
test('same input yields same results without mutation',()=>{
 const f=fixture();const before=JSON.stringify(f);expect(auditDossier(f)).toEqual(auditDossier(f));expect(JSON.stringify(f)).toBe(before);
});

test('actor equipment template requires explicit actor and instance binding, not a fabricated owner',()=>{
 const f=fixture();f.supplement={items:[{id:'template',kind:'actor_inventory',origin_binding:{kind:'actor_inventory',requires_actor_id:true,requires_instance_id:true}}]};
 expect(auditDossier(f).results.find(r=>r.code==='ITEM_ORIGIN_TEMPLATE')?.status).toBe('not_applicable');
 f.supplement={items:[{id:'template',kind:'actor_inventory'}]};
 expect(problems(f).some(r=>r.code==='ITEM_ORIGIN')).toBe(true);
});

test('portable inventory, world objects and vehicles receive separate executor findings',()=>{
 const f=fixture();f.supplement={items:[
  {id:'crystal',kind:'world_object',location:'start'},
  {id:'truck',kind:'vehicle',location:'start'},
  {id:'template',kind:'actor_inventory',origin_binding:{kind:'actor_inventory',requires_actor_id:true,requires_instance_id:true}},
  {id:'sample',kind:'sample',location:'start'},
 ]};
 const rows=auditDossier(f).results;
 expect(rows.find(r=>r.code==='ITEM_EXECUTOR'&&r.ids[0]==='crystal')?.status).toBe('not_applicable');
 expect(rows.find(r=>r.code==='WORLD_OBJECT_STATE_EXECUTOR'&&r.ids[0]==='crystal')?.status).toBe('unverifiable');
 expect(rows.find(r=>r.code==='ITEM_EXECUTOR'&&r.ids[0]==='truck')?.status).toBe('not_applicable');
 expect(rows.find(r=>r.code==='VEHICLE_STATE_EXECUTOR'&&r.ids[0]==='truck')?.status).toBe('unverifiable');
 expect(rows.find(r=>r.code==='ITEM_EXECUTOR'&&r.ids[0]==='template')?.status).toBe('not_applicable');
 expect(rows.find(r=>r.code==='ITEM_EXECUTOR'&&r.ids[0]==='sample')?.status).toBe('unverifiable');
});

test('catalog selections and collections are templates until a concrete item instance exists',()=>{
 const f=fixture();f.supplement={items:[
  {id:'shop-stock',kind:'catalog_selection',location:'start'},
  {id:'keepsakes',kind:'collection',location:'start'},
 ]};
 const rows=auditDossier(f).results;
 for(const id of ['shop-stock','keepsakes']){
  expect(rows.find(r=>r.code==='ITEM_ORIGIN_TEMPLATE'&&r.ids[0]===id)?.status).toBe('not_applicable');
  expect(rows.find(r=>r.code==='ITEM_EXECUTOR'&&r.ids[0]===id)?.status).toBe('not_applicable');
 }
});

test('shared actor labels are safe only when every runtime identity is a unique canonical ID',()=>{
 const f=fixture();const one=record('actor-one'),two=record('actor-two');
 one.record_type='actor';one.tags.entities=['npc-one'];one.actor_binding={entity_id:'npc-one',name:'Anonimowy artysta'};
 two.record_type='actor';two.tags.entities=['npc-two'];two.actor_binding={entity_id:'npc-two',name:'Anonimowy artysta'};
 f.records=[{file:'records/one.yaml',value:one},{file:'records/two.yaml',value:two}];
 f.actors=[{id:'npc-one'},{id:'npc-two'}];
 expect(auditDossier(f).results.find(r=>r.code==='ACTOR_ALIAS_AMBIGUOUS')?.status).toBe('not_applicable');
 f.actors=[{id:'npc-one'}];
 expect(auditDossier(f).results.find(r=>r.code==='ACTOR_ALIAS_AMBIGUOUS')?.status).toBe('unverifiable');
});

test('explicit group membership is a relation, never a travel edge',()=>{
 const f=fixture();f.graph!.nodes.push({id:'group',kind:'group'},{id:'npc',kind:'actor'});f.graph!.edges.push({id:'member',from:'group',to:'npc',kind:'membership'});
 expect(problems(f)).toEqual([]);
 expect(auditDossier(f).results.some(r=>r.code==='REACHABILITY'&&r.ids.includes('npc'))).toBe(false);
});

test('audits a structured mechanic hook through its RAG card, scene, mechanics and graph links',()=>{
 const f=fixture();
 const actor=record('actor-card');actor.record_type='actor';actor.actor_binding={entity_id:'npc-a',name:'NPC'};actor.tags.entities=['npc-a'];
 const item=record('item-card');item.tags.entities=['obj-a'];item.inventory_item={entity_id:'obj-a',name:'Object',category:'story',source_location:'start'};
 const frame=record('frame-card');frame.record_type='scene';frame.tags.scenes=['start'];
 const hookRecord=record('hook-card');hookRecord.record_type='mechanic_hook';hookRecord.content='Test hook\nWyzwalacz: gracz robi X\nDane: zamiar\nWykonanie / sukces: wynik\nNiewykonanie / porażka: koszt\nStan: zapis stanu\nRozstrzyga wspólna aplikacja; karta nie losuje ani nie wykonuje zapisu.';
 hookRecord.tags={entities:[],scenes:['start'],mechanics:['coc7:skill-tests'],topics:['trigger','resolution','state'],triggers:[]};
 hookRecord.retrieval={visibility:'gm_only',availability:'when_scene_active',condition:null,priority:3};
 hookRecord.links=['actor-card','item-card','frame-card'];
 f.records=[...f.records,{file:'records/actor.yaml',value:actor},{file:'records/item.yaml',value:item},{file:'records/frame.yaml',value:frame},{file:'records/hook.yaml',value:hookRecord}];
 f.graph!.nodes.push({id:'npc-a',kind:'actor'},{id:'obj-a',kind:'item'},{id:'hook-one',kind:'mechanic_hook'});
 f.graph!.edges.push({id:'prepare-hook',from:'start',to:'hook-one',kind:'mechanic',condition:'gracz robi X',effect:'zapis stanu'}, {id:'hook-item',from:'hook-one',to:'obj-a',kind:'mechanic',condition:'gracz robi X',effect:'wynik'});
 f.supplement={items:[{id:'obj-a'}],scene_frames:[{id:'start'}],mechanic_hooks:[{id:'hook-one',title:'Test hook',frames:['start'],actors:['npc-a'],objects:['obj-a'],mechanics:[13],trigger:'gracz robi X',parameters:'zamiar',success:'wynik',failure:'koszt',state:'zapis stanu',source:'neutral fixture'}]};
 const result=auditDossier(f).results.find(r=>r.code==='MECHANIC_INTEGRATION'&&r.ids.includes('hook-one'));
 expect(result).toMatchObject({status:'checked',actual:'verified'});
});

test('does not demand an executor for a source decision that configures a shared mechanic',()=>{
 const f=fixture();const decision=record('decision-card');decision.record_type='mechanic_hook';
 decision.tags.mechanics=['coc7:sanity-tests'];decision.tags.topics=['source-decision','mechanics.forest_path_shared_sanity_cap'];
 f.records.push({file:'records/decision.yaml',value:decision});
 expect(auditDossier(f).results.find(r=>r.code==='MECHANIC_INTEGRATION'&&r.ids.includes('decision-card'))?.status).toBe('not_applicable');
});

test('reports a broken trigger-to-success graph edge on a structured mechanic hook',()=>{
 const f=fixture();const frame=record('frame-card');frame.record_type='scene';frame.tags.scenes=['start'];
 const hook=record('hook-card');hook.record_type='mechanic_hook';hook.content='Hook\nWyzwalacz: bada\nDane: zamiar\nWykonanie / sukces: odkrywa\nNiewykonanie / porażka: opóźnienie\nStan: trop odkryty\nRozstrzyga wspólna aplikacja; karta nie losuje ani nie wykonuje zapisu.';
 hook.tags.scenes=['start'];hook.tags.mechanics=['coc7:skill-tests'];hook.retrieval.availability='when_scene_active';hook.links=['frame-card'];
 f.records.push({file:'records/frame.yaml',value:frame},{file:'records/hook.yaml',value:hook});
 f.graph!.nodes.push({id:'hook-one',kind:'mechanic_hook'});f.graph!.edges.push({id:'edge',from:'start',to:'hook-one',kind:'mechanic',condition:'bada',effect:'wrong'});
 f.supplement={items:[],scene_frames:[{id:'start'}],mechanic_hooks:[{id:'hook-one',title:'Hook',frames:['start'],actors:[],objects:[],mechanics:[13],trigger:'bada',parameters:'zamiar',success:'odkrywa',failure:'opóźnienie',state:'trop odkryty',source:'fixture'}]};
 expect(auditDossier(f).results.find(r=>r.code==='MECHANIC_INTEGRATION'&&r.ids.includes('hook-one'))?.status).toBe('discrepancy');
});

test('information, encounters and world events do not create travel paths',()=>{
 const f=fixture();f.graph!.nodes.push({id:'clue',kind:'clue'},{id:'remote',kind:'location'},{id:'npc',kind:'actor'},{id:'event',kind:'event'});
 f.graph!.edges.push({id:'info',from:'clue',to:'remote',kind:'information'},{id:'meet',from:'start',to:'npc',kind:'encounter'},{id:'clock',from:'event',to:'remote',kind:'world_event'});
 const results=auditDossier(f).results;
 expect(results.filter(r=>r.code==='EDGE_TYPES'&&r.status==='checked')).toHaveLength(3);
 expect(results.find(r=>r.code==='REACHABILITY'&&r.ids[0]==='remote')?.status).toBe('unverifiable');
 f.graph!.edges.push({id:'wrong',from:'npc',to:'clue',kind:'access'});
 expect(problems(f).some(r=>r.code==='EDGE_TYPES'&&r.ids[0]==='wrong')).toBe(true);
});

test('descriptive graph relations are not falsely audited as state-changing executors',()=>{
 const f=fixture();f.graph!.nodes.push({id:'npc-a',kind:'actor'},{id:'npc-b',kind:'actor'},{id:'goal-a',kind:'goal'},{id:'clue-a',kind:'clue'});
 f.graph!.edges=[
  {id:'relation',from:'npc-a',to:'npc-b',kind:'relationship',condition:'NPCs have a prior connection',effect:'Their goals can conflict.'},
  {id:'goal',from:'npc-a',to:'goal-a',kind:'goal',condition:'NPC acts autonomously',effect:'Goal is authored in its actor card.'},
  {id:'knowledge',from:'start',to:'clue-a',kind:'information',condition:'Investigators inspect the source',effect:'The clue becomes available; the conclusion remains theirs.'},
  {id:'event',from:'start',to:'npc-a',kind:'world_event',condition:'Clock reaches its in-world trigger',effect:'Move NPC to a new location.'},
 ];
 const rows=auditDossier(f).results;
 for(const id of ['relation','goal','knowledge']){
  expect(rows.filter(r=>['CONDITION_PROSE','EFFECT_EXECUTOR'].includes(r.code)&&r.ids[0]===id).every(r=>r.status==='not_applicable')).toBe(true);
 }
 expect(rows.find(r=>r.code==='EFFECT_EXECUTOR'&&r.ids[0]==='event')?.status).toBe('unverifiable');
});

test('item, mechanic and handout edges are connectors checked by their dedicated adapters',()=>{
 const f=fixture();
 f.graph!.nodes.push({id:'item-a',kind:'item'},{id:'hook-a',kind:'mechanic_hook'},{id:'handout-a',kind:'handout'});
 f.graph!.edges=[
  {id:'item-edge',from:'start',to:'item-a',kind:'item',condition:'The item is accessible',effect:'Transfer through inventory adapter.'},
  {id:'mechanic-edge',from:'start',to:'hook-a',kind:'mechanic',condition:'A skill check is needed',effect:'Use the shared skill test engine.'},
  {id:'handout-edge',from:'item-a',to:'handout-a',kind:'handout',condition:'The party acquires the source object',effect:'Show its local PDF image.'},
 ];
 const rows=auditDossier(f).results.filter(r=>['CONDITION_PROSE','EFFECT_EXECUTOR'].includes(r.code));
 expect(rows).toHaveLength(6);
 expect(rows.every(r=>r.status==='not_applicable')).toBe(true);
});

test('narrative access guidance requires a matching source-backed RAG card, not a state executor',()=>{
 const f=fixture();
 const card=record('access-row');card.record_type='director_note';
 card.content='Od: start\nDo: next\nWarunek / przekazywana informacja: Badacze mogą wejść do ogrodu\nSkutek projektowy: Mogą wybrać inną drogę';
 card.evidence.source_ref='source.md:12; s. 42';
 f.records=[{file:'records/access-row.yaml',value:card}];
 f.graph!.nodes.push({id:'next',kind:'location'});
 f.graph!.edges=[{id:'access',from:'start',to:'next',kind:'access',condition:'Badacze mogą wejść do ogrodu',effect:'Mogą wybrać inną drogę',source_ref:'s. 42'}];
 const rows=auditDossier(f).results;
 expect(rows.find(r=>r.code==='GRAPH_GUIDANCE_CARD')?.status).toBe('checked');
 expect(rows.filter(r=>['CONDITION_PROSE','EFFECT_EXECUTOR'].includes(r.code)&&r.ids[0]==='access').every(r=>r.status==='not_applicable')).toBe(true);
});

test('narrative access guidance is a discrepancy when its source-backed RAG card is missing',()=>{
 const f=fixture();f.graph!.nodes.push({id:'next',kind:'location'});
 f.graph!.edges=[{id:'access',from:'start',to:'next',kind:'access',condition:'Reach the garden',effect:'Offer another route',source_ref:'s. 42'}];
 expect(auditDossier(f).results.find(r=>r.code==='GRAPH_GUIDANCE_CARD')?.status).toBe('discrepancy');
});

test('world-event condition is narrative guidance when its exact source-backed RAG card exists',()=>{
 const f=fixture();
 const card=record('world-event-edge');card.record_type='director_note';
 card.content='Od: start\nDo: event-a\nWarunek / przekazywana informacja: Po zmroku więźniowie pozostają na miejscu\nSkutek projektowy: Przenieś tylko osoby nadal przetrzymywane';
 card.evidence.source_ref='source.md:21; s. 52';f.records=[{file:'records/world-event-edge.yaml',value:card}];
 f.graph!.nodes.push({id:'event-a',kind:'event'});
 f.graph!.edges=[{id:'world-event',from:'start',to:'event-a',kind:'world_event',condition:'Po zmroku więźniowie pozostają na miejscu',effect:'Przenieś tylko osoby nadal przetrzymywane',source_ref:'s. 52'}];
 const rows=auditDossier(f).results;
 expect(rows.find(r=>r.code==='GRAPH_GUIDANCE_CARD')?.status).toBe('checked');
 expect(rows.find(r=>r.code==='CONDITION_PROSE')?.status).toBe('not_applicable');
 expect(rows.find(r=>r.code==='EFFECT_EXECUTOR')?.status).toBe('unverifiable');
});

test('statement reliability is not an initial mechanical state',()=>{
 const f=fixture();f.actors=[{id:'actor',fields:{'narrative_boundary.statement_is_not_truth':{value:'An assertion is not evidence.'},'opening_state.hp':{value:4}}}];
 const rows=auditDossier(f).results.filter(r=>r.code==='ACTOR_INITIAL_STATE');
 expect(rows).toHaveLength(1);expect(rows[0].field).toContain('opening_state.hp');
});

test('structured NPC opening fields pass when their exact values reach an entity-linked RAG card',()=>{
 const f=fixture();
 const card=record('npc-field');card.record_type='actor';card.tags.entities=['npc-a'];card.content='Jane · identity.initial_location\nKryjówka w lesie';
 f.records=[{file:'records/npc-field.yaml',value:card}];
 f.actors=[{id:'npc-a',fields:{'identity.initial_location':{status:'set',value:'Kryjówka w lesie'}}}];
 expect(auditDossier(f).results.find(r=>r.code==='ACTOR_INITIAL_STATE')?.status).toBe('checked');
 card.content='Jane · identity.default_location_day_3\nChatka nr 4';
 f.actors=[{id:'npc-a',fields:{'identity.initial_location':{status:'set',value:'Kryjówka w lesie'}}}];
 expect(auditDossier(f).results.find(r=>r.code==='ACTOR_INITIAL_STATE')?.status).toBe('discrepancy');
});
test('context-only scene frames require a reason to be excluded from physical reachability',()=>{
 const f=fixture();const frame:{id:string;kind:string;navigation_role:string;navigation_reason?:string}={id:'frame',kind:'scene',navigation_role:'context_only',navigation_reason:'Groups existing locations; no physical destination.'};f.graph!.nodes.push(frame);
 expect(auditDossier(f).results.find(r=>r.code==='REACHABILITY'&&r.ids[0]==='frame')?.status).toBe('not_applicable');
 delete frame.navigation_reason;
 expect(auditDossier(f).results.find(r=>r.code==='REACHABILITY'&&r.ids[0]==='frame')?.status).toBe('unverifiable');
});

test('static preparation annotation needs no executor, but a real effect still requires review',()=>{
 const f=fixture();f.graph!.nodes.push({id:'frame',kind:'scene'});
 f.graph!.edges.push({id:'prep',from:'frame',to:'start',kind:'preparation',condition:'Powiązanie przygotowania; nie obecność ani obowiązkowe przejście',effect:'Sprawdź aktualny stan i dostęp przed użyciem karty.'});
 let rows=auditDossier(f).results;
 expect(rows.find(r=>r.code==='CONDITION_PROSE')?.status).toBe('not_applicable');
 expect(rows.find(r=>r.code==='EFFECT_EXECUTOR')?.status).toBe('not_applicable');
 f.graph!.edges=[{id:'prep',from:'frame',to:'start',kind:'preparation',effect:'Subtract 5 HP.'}];
 rows=auditDossier(f).results;
 expect(rows.find(r=>r.code==='EFFECT_EXECUTOR')?.status).toBe('unverifiable');
});
test('pending actor approval includes its actual authored content and source without approving',()=>{
 const f=fixture();const r=record('actor');r.record_type='actor';r.tags.entities=['npc-test'];r.evidence.approval='pending';f.records[0].value=r;
 const result=auditDossier(f).results.find(r=>r.code==='RECORD_APPROVAL')!;
 expect(result.group).toBe('actors');expect(result.status).toBe('unverifiable');
 expect(result.actual).toMatchObject({content:r.content,source_ref:r.evidence.source_ref,review_group:'npc-test'});
 expect(r.evidence.approval).toBe('pending');
});

test('scene enrichment verifies preserved source cards without approving their content',()=>{
 const f=fixture();
 const cards=[{kind:'scene',label:'Base',source_ref:'notes:1',detail:'Base facts',role:'source_scene'}, {kind:'scene',label:'Frame',source_ref:'playbook:frame',detail:'',role:'preparation_frame'}];
 f.graph!.nodes.push({id:'frame',kind:'scene',source_cards:cards});
 f.sourceNodeClaims=cards.map(c=>({id:'frame',...c}));
 expect(auditDossier(f).results.find(r=>r.code==='NODE_MERGE')?.status).toBe('checked');
 f.graph!.nodes[2]={id:'frame',kind:'scene',source_cards:cards.slice(0,1)};
 expect(auditDossier(f).results.find(r=>r.code==='NODE_MERGE')?.status).toBe('discrepancy');
});
test('undeclared or conflicting scene merges remain unresolved',()=>{
 const f=fixture();
 f.sourceNodeClaims=[{id:'frame',kind:'scene',source_ref:'a'},{id:'frame',kind:'scene',source_ref:'b'}];
 expect(auditDossier(f).results.find(r=>r.code==='NODE_MERGE')?.status).toBe('unverifiable');
 f.sourceNodeClaims=[{id:'frame',kind:'scene',role:'source_scene'},{id:'frame',kind:'actor',role:'preparation_frame'}];
 expect(auditDossier(f).results.find(r=>r.code==='NODE_MERGE')?.status).toBe('discrepancy');
});

test('explicitly unspecified NPC state requires an uncertainty guard, not an invented initial value',()=>{
 const f=fixture();const r=record('guard');r.record_type='director_note';r.tags.entities=['npc'];r.tags.topics=['uncertainty'];r.content='Unspecified: opening_state.location';f.records[0].value=r;
 f.actors=[{id:'npc',fields:{'opening_state.location':{status:'unspecified',value:null}}}];
 expect(auditDossier(f).results.find(r=>r.code==='ACTOR_INITIAL_STATE')?.status).toBe('not_applicable');
 r.content='No other information';
 expect(auditDossier(f).results.find(r=>r.code==='ACTOR_INITIAL_STATE')?.status).toBe('unverifiable');
 f.actors=[{id:'npc',fields:{'opening_state.location':{status:'set',value:null}}}];
 expect(auditDossier(f).results.find(r=>r.code==='ACTOR_INITIAL_STATE')?.status).toBe('unverifiable');
});

test('actor identity and source cards do not prove runtime state transitions',()=>{
 const f=fixture();const a=record('actor-card');a.record_type='actor';a.actor_binding={entity_id:'npc-a',name:'Neutral NPC'};a.tags.entities=['npc-a'];
 f.records.push({file:'records/actor.yaml',value:a});
 f.actors=[{id:'npc-a',fields:{}}];
 f.graph!.nodes.push({id:'npc-a',kind:'actor'});
 const result=auditDossier(f).results.find(r=>r.code==='ACTOR_RUNTIME_TRANSITIONS');
 expect(result).toMatchObject({status:'unverifiable',required:true,evidenceType:'data',ids:['npc-a']});
 expect(auditDossier(f).exitCode).toBe(1);
 expect(auditDossier(fixture()).results.some(r=>r.code==='ACTOR_RUNTIME_TRANSITIONS')).toBe(false);
});


test('NPC transition audit distinguishes reachable opening states from a disconnected cycle',()=>{
 const f=fixture();const a=record('actor');a.record_type='actor';a.tags.entities=['npc'];
 const transition=(id:string,from:string,to:string)=>({id,from_effect_id:from,to_effect:{id:to,name:to,description:to},source_location_id:'start'});
 a.actor_binding={entity_id:'npc',name:'NPC',initial_state:{status:'alive',location_id:'start',location_name:'Start',effects:[{id:'held',name:'Held',description:'Held'}],source_ref:'fixture'},transitions:[transition('free','held','free'),transition('cycle-a','unknown-a','unknown-b'),transition('cycle-b','unknown-b','unknown-a')]};
 f.records.push({file:'records/actor.yaml',value:a});
 const checks=auditDossier(f).results.filter(r=>r.code==='ACTOR_STATE_PATH');
 expect(checks).toHaveLength(3);
 expect(checks.find(r=>r.ids.includes('free'))?.status).toBe('checked');
 expect(checks.filter(r=>r.status==='unverifiable')).toHaveLength(2);
});


test('NPC opening and transition locations must resolve to actual location nodes',()=>{
 const f=fixture();const a=record('actor');a.record_type='actor';a.tags.entities=['npc'];
 a.actor_binding={entity_id:'npc',name:'NPC',initial_state:{status:'alive',location_id:'missing',location_name:'Missing',effects:[],source_ref:'fixture'},transitions:[{id:'move',from_effect_id:'held',to_effect:{id:'moved',name:'Moved',description:'Moved'},source_location_id:'npc',target_location_id:'absent',target_location_name:'Absent'}]};
 f.records.push({file:'records/actor.yaml',value:a});f.graph!.nodes.push({id:'npc',kind:'actor'});
 const checks=auditDossier(f).results.filter(r=>r.code==='ACTOR_STATE_LOCATION');
 expect(checks).toHaveLength(3);expect(checks.every(r=>r.status==='discrepancy')).toBe(true);
 expect(checks.map(r=>r.field)).toContain('actor_binding.initial_state.location_id');
});

test('executable cards require proof that rejected mutations do not become narration', () => {
 const f=fixture();
 expect(auditDossier(f).results.find(r=>r.code==='NARRATION_STATE_RECONCILIATION')?.status).toBe('not_applicable');
 const r=record('object');r.world_object_binding={entity_id:'door',initial_state:'closed',states:['closed','open'],transitions:[{id:'open',from:'closed',to:'open'}]};
 f.records[0].value=r;
 expect(auditDossier(f).results.find(r=>r.code==='NARRATION_STATE_RECONCILIATION')).toMatchObject({status:'unverifiable',required:true,evidenceType:'data'});
 expect(auditDossier(f).exitCode).toBe(1);
});
