import {STREFA_11_ADVENTURES} from '../adventures-data';
import {validateDossierRagPayload,isIndexableDossierRecord} from './rag-schema';
import {createAuthoredPrabutyPayload,PRABUTY_WORLD_IDS,PRABUTY_AUTHORING_VERSION,
 getPrabutyClueRules,getPrabutyEnding,canApplyPrabutyWorldTransition} from './authored-prabuty';

const fingerprint='sha256:'+'a'.repeat(64);
const adventure=STREFA_11_ADVENTURES.find(a=>a.id==='cien-nad-prabutami')!;
const time=(hour=19,day=18,minute=30)=>({year:1973,month:9,day,hour,minute});
describe('authored Prabuty local playtest content',()=>{
 test('preserves source canon and creates schema-valid pending operational cards with exact edition binding',()=>{
  const before=JSON.stringify(adventure),payload=createAuthoredPrabutyPayload(fingerprint);
  expect(validateDossierRagPayload(payload)).toMatchObject({ok:true});
  expect(payload.adventure_id).toBe(adventure.id);
  expect(payload.records.every(r=>r.edition_fingerprint===fingerprint)).toBe(true);
  expect(payload.records.every(r=>r.evidence.status==='set'&&r.evidence.approval==='pending'&&r.evidence.approved_by===null&&r.evidence.approved_at===null)).toBe(true);
  expect(payload.records.some(isIndexableDossierRecord)).toBe(false);
  expect(payload.records.every(r=>r.evidence.source_ref.includes(PRABUTY_AUTHORING_VERSION))).toBe(true);
  expect(JSON.stringify(adventure)).toBe(before);
  expect(createAuthoredPrabutyPayload(fingerprint)).toEqual(payload);
 });
 test('covers five source scenes, twelve source clues, five source actors and four physical handout instances',()=>{
  const cards=createAuthoredPrabutyPayload(fingerprint).records;
  expect(cards.filter(r=>r.record_type==='scene')).toHaveLength(5);
  expect(cards.filter(r=>r.record_type==='clue')).toHaveLength(12);
  expect(cards.filter(r=>r.actor_binding)).toHaveLength(5);
  expect(cards.filter(r=>r.inventory_item)).toHaveLength(4);
  for(const node of adventure.graph!.nodes!)expect(cards.some(r=>r.record_type==='scene'&&r.tags.scenes.includes(node.id))).toBe(true);
  for(const clue of adventure.graph!.clues)expect(cards.some(r=>r.record_id==='prabuty.clue.'+clue.id)).toBe(true);
  for(const actor of adventure.graph!.npcs)expect(cards.some(r=>r.actor_binding?.entity_id===actor.id)).toBe(true);
  for(const handout of adventure.handouts!){
   const card=cards.find(r=>r.record_id==='prabuty.item.'+handout.slug)!;
   const node=adventure.graph!.nodes!.find(n=>n.id===handout.nodeId)!;
   expect(card.inventory_item!.source_location).toBe(node.locationId);
   expect(card.tags.scenes).toContain(node.id);
   expect(card.inventory_item!.access_check).toBeUndefined();
   expect(card.local_handout).toBeUndefined();
  }
 });
 test('retains three independent basic newsroom exits with no compulsory roll and real optional skill checks',()=>{
  const rules=getPrabutyClueRules(),initial=rules.filter(r=>r.sourceNodeId==='node-warszawa-redakcja');
  expect(initial).toHaveLength(3);
  expect(new Set(initial.map(r=>r.targetNodeId)).size).toBe(3);
  expect(initial.every(r=>r.basicRequiresRoll===false)).toBe(true);
  for(const rule of rules){
   expect(rule.bonusCheck.skill_names.length).toBeGreaterThan(0);
   expect(rule.bonusCheck.difficulty).toBe('regular');
   expect(rule.failure.grantAcquisition).toBe(false);
   expect(rule.failure.preserveSourceRoutes).toBe(true);
  }
 });
 test('actor initial state distinguishes Tomasz PC from NPCs and never fabricates HP or other stats',()=>{
  const actors=createAuthoredPrabutyPayload(fingerprint).records.filter(r=>r.actor_binding);
  expect(actors.some(r=>r.actor_binding!.name==='Tomasz Nowicki')).toBe(false);
  expect(actors.find(r=>r.actor_binding!.entity_id==='npc-helena-krawczyk')!.actor_binding!.initial_state!.location_id).toBe('loc-warszawa-redakcja');
  expect(actors.every(r=>!r.content.includes('"hp"'))).toBe(true);
 });
 test('generator, rift and one ending machine are explicit and every referenced state exists',()=>{
  const payload=createAuthoredPrabutyPayload(fingerprint),objects=payload.records.filter(r=>r.world_object_binding);
  expect(objects.map(r=>r.world_object_binding!.entity_id).sort()).toEqual(Object.values(PRABUTY_WORLD_IDS).sort());
  const ending=objects.find(r=>r.world_object_binding!.entity_id===PRABUTY_WORLD_IDS.ending)!.world_object_binding!;
  expect(ending.states).toEqual(expect.arrayContaining(['ongoing','interrupted','operation-completed','withdrawn']));
  expect(validateDossierRagPayload(payload).ok).toBe(true);
  const checks=objects.flatMap(r=>r.world_object_binding!.transitions.filter(t=>t.access_check));
  expect(checks.length).toBeGreaterThan(0);
  for(const t of checks)expect(t.condition_id).toBe(t.access_check!.id);
 });
 test('ending predicates use actual deadline and confirmed world states, never clock phase75%',()=>{
  expect(getPrabutyEnding({gameTime:time(16,19,59),generator:'active',rift:'open'})).toBeNull();
  expect(getPrabutyEnding({gameTime:time(23,19,59),generator:'active',rift:'open'})).toBe('operation-completed');
  expect(getPrabutyEnding({gameTime:time(),generator:'disabled',rift:'latent'})).toBe('interrupted');
  expect(getPrabutyEnding({gameTime:time(),generator:'disabled',rift:'closed'})).toBe('interrupted');
  expect(getPrabutyEnding({gameTime:time(),generator:'preparing',rift:'latent',withdrawalDeclared:true})).toBe('withdrawn');
  expect(getPrabutyEnding({gameTime:time(),generator:'active',rift:'open'})).toBeNull();
 });
 test('clock-dependent state proposals and endings require their exact authored preconditions',()=>{
  const base={gameTime:time(),generator:'preparing',rift:'latent'};
  expect(canApplyPrabutyWorldTransition({...base,entityId:PRABUTY_WORLD_IDS.generator,transitionId:'start-generators'})).toBe(false);
  expect(canApplyPrabutyWorldTransition({...base,gameTime:time(23,19,59),entityId:PRABUTY_WORLD_IDS.generator,transitionId:'start-generators'})).toBe(true);
  expect(canApplyPrabutyWorldTransition({...base,entityId:PRABUTY_WORLD_IDS.ending,transitionId:'complete-operation'})).toBe(false);
  expect(canApplyPrabutyWorldTransition({...base,entityId:PRABUTY_WORLD_IDS.ending,transitionId:'withdraw'})).toBe(false);
  expect(canApplyPrabutyWorldTransition({...base,withdrawalDeclared:true,entityId:PRABUTY_WORLD_IDS.ending,transitionId:'withdraw'})).toBe(true);
 });
 test('does not invent PDF locators or promote unresolved review-only unknown records',()=>{
  const payload=createAuthoredPrabutyPayload(fingerprint);
  expect(payload.records.some(r=>r.local_handout||r.evidence.status!=='set'||r.tags.topics.includes('unknown-integration'))).toBe(false);
  expect(()=>createAuthoredPrabutyPayload('sha256:invented')).toThrow(/fingerprint/i);
 });
});

import {extractSkillTests} from '../parsers/mechanics-parser';
test('authored test requests are parseable by the real mechanics parser and preserve reviewed condition metadata',()=>{
 const cards=createAuthoredPrabutyPayload(fingerprint).records;
 for(const card of cards.filter(r=>r.record_type==='scene')){
  const scene=JSON.parse(card.content) as {tests:Array<{bonusCheck:{id:string;skill_names:string[]};request:string}>;worldActions:Array<{testRequest?:string;checkId?:string}>};
  for(const request of scene.tests){
   const parsed=extractSkillTests(request.request);
   expect(parsed).toHaveLength(1);expect(parsed[0].dossierConditionId).toBe(request.bonusCheck.id);
   expect(parsed[0].skillName).toBe(request.bonusCheck.skill_names[0]);
   expect(parsed[0].difficulty).toBe('zwykly');
  }
  for(const action of scene.worldActions.filter(a=>a.testRequest)){
   const parsed=extractSkillTests(action.testRequest!);
   expect(parsed).toHaveLength(1);expect(parsed[0].dossierConditionId).toBe(action.checkId);
   expect(parsed[0].skillName).toBe('Naprawa elektryczna');expect(parsed[0].difficulty).toBe('trudny');
  }
 }
});

test('photo and all document cards distinguish source summaries from literal quotations',()=>{
 const payload=createAuthoredPrabutyPayload(fingerprint);
 for(const source of adventure.handouts!){
  for(const id of ['prabuty.item.','prabuty.media.']){
   const card=JSON.parse(payload.records.find(r=>r.record_id===id+source.slug)!.content);
   expect(card.documentAuthority).toEqual({canonicalText:source.textContent,representation:'source-summary',literalTranscriptionAvailable:false});
  }
 }
});
