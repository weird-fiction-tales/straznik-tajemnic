import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSceneReview, recordDecision, exportSceneDecisions, importSceneDecisions, applyContentApprovals } from './scene-review.mjs';

const manifest = { adventure_id:'test-one', edition_fingerprint:'edition-one', approval:{status:'approved'} };
const card = (id, scenes=[], entities=[]) => ({
  record_id:id, adventure_id:manifest.adventure_id, edition_fingerprint:manifest.edition_fingerprint,
  content:'Authored test '+id, tags:{scenes,entities,topics:['test']}, links:[],
  retrieval:{condition:null}, evidence:{source_ref:'synthetic fixture',approval:'pending',approved_by:null,approved_at:null}
});
function fixture() {
  return {manifest:structuredClone(manifest),records:[card('a',['frame-a']),card('b',['loc-b']),card('npc',[],['npc-shared']),card('global'),card('unknown',['nowhere']),card('ambiguous',['frame-a','frame-b'])],
    review:{supplement:{scene_frames:[
      {id:'frame-a',title:'Situation A',focus:'Initial situation',locations:['loc-a'],actors:['npc-shared']},
      {id:'frame-b',title:'Situation B',locations:['loc-b'],actors:['npc-shared']}
    ]},record_index:[]}};
}
const empty = m => ({schema_version:1,adventure_id:m.adventure_id,edition_fingerprint:m.edition_fingerprint,decisions:[]});
const decision = (m,id,domain='content',status='accepted') => ({group_id:id,snapshot:m.groups.find(g=>g.id===id).snapshot,domain,status,reviewer:'Author',at:'2026-10-20T12:00:00Z'});

test('every record has exactly one owner; shared references and exceptions are explicit',()=>{
  const m=buildSceneReview(fixture());
  assert.deepEqual(m.groups.find(g=>g.id==='scene:frame-a').record_ids,['a']);
  assert.deepEqual(m.groups.find(g=>g.id==='scene:frame-b').record_ids,['b']);
  assert.deepEqual(m.groups.find(g=>g.id==='shared').record_ids,['global','npc']);
  assert.deepEqual(m.groups.find(g=>g.id==='exceptions').record_ids,['ambiguous','unknown']);
  assert.deepEqual(m.groups.find(g=>g.id==='scene:frame-a').reference_record_ids,['npc']);
  assert.equal(m.coverage.total,6);
  assert.equal(m.coverage.owned,6);
  assert.equal(m.coverage.unowned,0);
  assert.equal(m.coverage.duplicate_owners,0);
  assert.ok(m.groups.find(g=>g.id==='exceptions').issues.length);
});
test('manifest approval never approves cards; domains stay separate',()=>{
  const f=fixture(),m=buildSceneReview(f);
  assert.ok(applyContentApprovals({...f,decisions:empty(m)}).every(r=>r.evidence.approval==='pending'));
  let doc=recordDecision(m,empty(m),decision(m,'scene:frame-a','media'));
  assert.equal(applyContentApprovals({...f,decisions:doc})[0].evidence.approval,'pending');
  doc=recordDecision(m,doc,decision(m,'scene:frame-a'));
  const records=applyContentApprovals({...f,decisions:doc});
  assert.equal(records[0].evidence.approval,'approved');
  assert.equal(records[0].evidence.approved_by,'Author');
  assert.equal(records[1].evidence.approval,'pending');
  assert.equal(f.records[0].evidence.approval,'pending');
});
test('accepted, rework and deferred survive local JSON roundtrip with reviewer/date',()=>{
  const m=buildSceneReview(fixture());
  let doc=empty(m);
  for (const [id,status] of [['scene:frame-a','accepted'],['scene:frame-b','rework'],['shared','deferred']]) doc=recordDecision(m,doc,decision(m,id,'content',status));
  assert.deepEqual(importSceneDecisions(m,exportSceneDecisions(m,doc)),doc);
  assert.deepEqual(doc.decisions.map(d=>d.status),['accepted','rework','deferred']);
});
test('all exact card content affects snapshot except approval bookkeeping',()=>{
  const f=fixture(),before=buildSceneReview(f).groups[0].snapshot;
  for (const mutate of [
    r=>r.content+=' changed',r=>r.tags.topics.push('changed'),r=>r.retrieval.condition={flag:true},
    r=>r.links.push('b'),r=>r.evidence.source_ref+=' changed',r=>r.extra={exact:'metadata'}
  ]) {
    const changed=structuredClone(f);mutate(changed.records[0]);
    assert.notEqual(buildSceneReview(changed).groups[0].snapshot,before);
  }
  f.records[0].evidence.approval='approved';f.records[0].evidence.approved_by='Author';f.records[0].evidence.approved_at='2026-10-20';
  assert.equal(buildSceneReview(f).groups[0].snapshot,before);
});
test('membership additions, scene metadata and edition changes invalidate acceptance',()=>{
  const f=fixture(),m=buildSceneReview(f),doc=recordDecision(m,empty(m),decision(m,'scene:frame-a'));
  for (const mutate of [
    x=>x.records.push(card('new',['frame-a'])),
    x=>x.review.supplement.scene_frames[0].focus+=' changed',
    x=>x.records[0].tags.scenes=['frame-b']
  ]) {
    const changed=structuredClone(f);mutate(changed);
    const applied=applyContentApprovals({...changed,decisions:doc});
    assert.ok(applied.every(r=>r.evidence.approval==='pending'));
    assert.equal(importSceneDecisions(buildSceneReview(changed),JSON.stringify(doc)).decisions.length,1);
  }
  const changed=structuredClone(f);changed.manifest.edition_fingerprint='edition-two';
  assert.throws(()=>applyContentApprovals({...changed,decisions:doc}),/edition/);
});
test('shared edits invalidate scene reference snapshots and shared approval',()=>{
  const f=fixture(),m=buildSceneReview(f);f.records.find(r=>r.record_id==='npc').content+=' changed';
  const next=buildSceneReview(f);
  for (const id of ['scene:frame-a','scene:frame-b','shared']) assert.notEqual(next.groups.find(g=>g.id===id).snapshot,m.groups.find(g=>g.id===id).snapshot);
});
test('two adventures cannot exchange approvals even when record IDs match',()=>{
  const f=fixture(),m=buildSceneReview(f),doc=recordDecision(m,empty(m),decision(m,'shared'));
  const other=structuredClone(f);other.manifest.adventure_id='test-two';other.records.forEach(r=>r.adventure_id='test-two');
  assert.throws(()=>importSceneDecisions(buildSceneReview(other),JSON.stringify(doc)),/adventure/);
});
test('invalid identities, ambiguous frames and duplicate cards fail closed',()=>{
  for(const id of ['../escape','<script>','__proto__','constructor','a/b']) {
    const f=fixture();f.records[0].record_id=id;assert.throws(()=>buildSceneReview(f),/id/);
  }
  const f=fixture();f.records.push(structuredClone(f.records[0]));assert.throws(()=>buildSceneReview(f),/duplicate/);
  const g=fixture();g.review.supplement.scene_frames.push({...g.review.supplement.scene_frames[0]});assert.throws(()=>buildSceneReview(g),/duplicate/);
});
test('decisions require explicit reviewer, date, valid group, snapshot, domain and status',()=>{
  const m=buildSceneReview(fixture()),valid=decision(m,'shared');
  for(const patch of [{reviewer:''},{at:'nonsense'},{at:'2026-02-30'},{group_id:'../escape'},{snapshot:'x'},{domain:'everything'},{status:'approved'}]) {
    assert.throws(()=>recordDecision(m,empty(m),{...valid,...patch}));
  }
  const invalid={...empty(m),decisions:[{...valid,reviewer:''}]};
  assert.throws(()=>importSceneDecisions(m,JSON.stringify(invalid)));
  assert.throws(()=>recordDecision(m,empty(m),decision(m,'exceptions')),/exception/);
});
test('rework/deferred supersede content approval and stale approvals are reset',()=>{
  const f=fixture(),m=buildSceneReview(f);let doc=recordDecision(m,empty(m),decision(m,'scene:frame-a'));
  for (const status of ['rework','deferred']) {
    doc=recordDecision(m,doc,decision(m,'scene:frame-a','content',status));
    assert.equal(applyContentApprovals({...f,decisions:doc})[0].evidence.approval,'pending');
  }
  f.records[0].evidence={...f.records[0].evidence,approval:'approved',approved_by:'Earlier author',approved_at:'2026-10-01'};
  assert.equal(applyContentApprovals({...f,decisions:empty(m)})[0].evidence.approval,'pending');
});

test('linked records owned by another scene are disclosed and invalidate the dependent scene',()=>{
 const f=fixture();f.records[0].links=['b'];f.records[0].context_links=['b'];
 const before=buildSceneReview(f);const group=before.groups[0];
 assert.ok(group.reference_record_ids.includes('b'));
 assert.equal(group.reference_records.find(r=>r.record_id==='b').content,f.records[1].content);
 f.records[1].content+=' changed';assert.notEqual(buildSceneReview(f).groups[0].snapshot,group.snapshot);
});
test('author policies and exact media inventory participate in acceptance snapshots',()=>{
 const f=fixture();f.review.supplement.policies=[{title:'Agency',content:'Player decides'}];
 f.review.media_manifest={assets:[{url:'/image.webp',sha256:'aaa',node_id:'frame-a',language:'pl',trigger:'discovery'}]};
 const original=buildSceneReview(f).groups[0].snapshot;
 for(const mutate of [x=>x.review.supplement.policies[0].content+=' changed',x=>x.review.media_manifest.assets[0].sha256='bbb',x=>x.review.media_manifest.assets[0].trigger='later']){
  const changed=structuredClone(f);mutate(changed);assert.notEqual(buildSceneReview(changed).groups[0].snapshot,original);
 }
});
test('all hashed semantic records, references, policies and graph are returned for author disclosure',()=>{
 const f=fixture();f.review.graph={nodes:[{id:'frame-a',detail:'Exact scene'}],edges:[{from:'frame-a',to:'frame-b',condition:'Only after clue'}]};
 f.review.supplement.policies=[{title:'Rule',content:'Exact rule'}];
 const group=buildSceneReview(f).groups[0];
 assert.deepEqual(group.graph.edges,f.review.graph.edges);assert.deepEqual(group.policies,f.review.supplement.policies);
 assert.ok(group.reference_records.some(r=>r.record_id==='npc'));
});
