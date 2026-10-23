import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const modulePath = './prepare-quicksetup.mjs';
const api = await import(modulePath).catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND' && error.message.includes('prepare-quicksetup.mjs')) return {};
  throw error;
});
const ids = ['cien-nad-prabutami', 'englewood-murder-castle-1893'];
function source(id) {
  const sourceRef = 'data/adventures/predefined/' + id + '.json';
  return {sourceRef, text: fs.readFileSync(path.join(root, sourceRef), 'utf8')};
}
function atPointer(value, pointer) {
  return pointer.split('/').slice(1).reduce((v, key) => v[key.replaceAll('~1', '/').replaceAll('~0', '~')], value);
}
test('converter API exists', () => assert.equal(typeof api.prepareQuicksetup, 'function'));
for (const id of ids) test(id + ': preserves every source field and pending gate', async () => {
  assert.equal(typeof api.prepareQuicksetup, 'function');
  const {text, sourceRef} = source(id);
  const original = JSON.parse(text);
  const model = api.prepareQuicksetup(text, {sourceRef, root});
  assert.deepEqual(model.source, original);
  assert.equal(model.provenance.source_sha256, crypto.createHash('sha256').update(text).digest('hex'));
  assert.equal(model.manifest.approval, 'pending');
  assert.equal(model.validation.ok, true, model.validation.errors.join('\n'));
  assert.equal(model.review.readiness.production_ready, false);
  assert.equal(model.review.supplement.scene_frames.length, 5);
  assert.equal(model.review.supplement.handouts.length, 4);
  const canonical = model.records.filter(r => r.tags.topics.includes('canonical-source'));
  const reconstructed = {};
  for (const record of canonical) {
    const {pointer, value} = JSON.parse(record.content);
    assert.deepEqual(value, atPointer(original, pointer));
    assert.equal(record.evidence.source_ref, sourceRef + '#' + pointer);
    assert.equal(record.evidence.approval, 'pending');
    assert.equal(record.evidence.approved_by, null);
    const keys = pointer.split('/').slice(1).map(k => k.replaceAll('~1', '/').replaceAll('~0', '~'));
    let target = reconstructed;
    keys.forEach((key, index) => {
      if (index === keys.length - 1) target[key] = value;
      else target = target[key] ??= /^\d+$/.test(keys[index + 1]) ? [] : {};
    });
  }
  assert.deepEqual(reconstructed, original, 'source record coverage must be lossless');
  for (const frame of model.review.supplement.scene_frames) {
    const node = original.nodes.find(n => n.id === frame.node_ids[0]);
    assert.ok(node);
    assert.deepEqual(frame.actors, node.npcIds);
    assert.deepEqual(frame.locations, [node.locationId]);
    assert.deepEqual(frame.choices, [], 'source routes are not mandatory player choices');
    assert.ok(frame.source_refs.includes(sourceRef + '#/nodes/' + original.nodes.indexOf(node)));
  }
  assert.ok(model.records.filter(r => r.record_type === 'actor').every(r => !r.actor_binding && !r.inventory_item));
  assert.ok(model.records.every(r => r.tags.mechanics.length === 0 && r.tags.triggers.length === 0));
  assert.ok(model.review.unknown_integration.some(x => x.id === 'mechanics'));
  for (const [index, h] of original.handouts.entries()) {
    for (const field of ['image', 'audioUrl', 'audioUrlPl', 'audioUrlEn']) if (h[field]) {
      const media = model.media.assets.find(a => a.url === h[field]);
      assert.ok(media, h[field]);
      assert.ok(media.source_refs.includes(sourceRef + '#/handouts/' + index + '/' + field));
      assert.equal(media.quality, 'unknown');
      assert.equal(media.playback, 'unknown');
      assert.equal(media.approval, 'pending');
    }
  }
  assert.deepEqual(model.review.media_manifest,model.media);
  assert.equal(model.media.generation_calls, 0);
  assert.equal(model.media.generation_cost, null);
  assert.ok(model.media.assets.some(a => a.origin === 'visual-pack-manifest'));
  const packAssets = model.media.assets.filter(a => a.origin === 'visual-pack-manifest');
  assert.ok(packAssets.every(a => a.filesystem_status === 'present' && a.storage_status === 'present'));
  assert.ok(packAssets.every(a => a.storage_sha256 && a.storage_path.includes('/' + id + '/')));
  assert.ok(model.media.assets.every(a => ['present', 'missing', 'invalid-reference'].includes(a.filesystem_status)));
  const output = path.join(root, '_tester/_base/.silnik/test-results/two-quicksetup/authoring/test-run', id);
  const loaded = await api.writeQuicksetup(model, output);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.releaseReady, false);
  assert.equal(loaded.payload, undefined);
  assert.match(loaded.errors.join('\n'), /pending approval/);
  assert.equal(fs.readFileSync(path.join(output, 'source.json'), 'utf8'), text);
});
test('dangling canonical graph references fail rather than inventing a scene', () => {
  assert.equal(typeof api.prepareQuicksetup, 'function');
  const {text, sourceRef} = source(ids[0]);
  const modified = JSON.parse(text);
  modified.connections[0].toId = 'missing-node';
  assert.throws(() => api.prepareQuicksetup(JSON.stringify(modified), {sourceRef, root}), /Unknown node/);
});
test('writes refuse public paths and preserve existing files', async () => {
  assert.equal(typeof api.prepareQuicksetup, 'function');
  const {text, sourceRef} = source(ids[0]);
  const model = api.prepareQuicksetup(text, {sourceRef, root});
  await assert.rejects(api.writeQuicksetup(model, path.join(root, '_tester/_base/.silnik/public/draft')), /private authoring/);
});

const {buildSceneReview, recordDecision, exportSceneDecisions} = await import('./scene-review.mjs');
function freshModel(textOverride) {
  const {text, sourceRef} = source(ids[0]);
  return api.prepareQuicksetup(textOverride || text, {sourceRef,root});
}
function privateTestDirectory(name) {
  const base = path.join(root,'_tester/_base/.silnik/test-results/two-quicksetup/authoring/test-run');
  fs.mkdirSync(base,{recursive:true});
  return fs.mkdtempSync(path.join(base,name+'-'));
}
function authorLedger(model) {
  const review = buildSceneReview({manifest:model.manifest,records:model.records,review:model.review});
  const group = review.groups.find(g=>g.kind==='scene' && g.record_ids.length);
  return recordDecision(review,{schema_version:1,adventure_id:review.adventure_id,
    edition_fingerprint:review.edition_fingerprint,decisions:[]},
    {group_id:group.id,snapshot:group.snapshot,domain:'content',status:'accepted',
      reviewer:'Test fixture author',at:'2026-10-20',comment:'Test fixture approval only'});
}
async function authoringWithLedger(name) {
  const model=freshModel(), directory=privateTestDirectory(name);
  await api.writeQuicksetup(model,directory);
  const ledger=authorLedger(model), ledgerText=JSON.stringify(ledger,null,2)+'\n';
  const ledgerFile=path.join(directory,'preparation/scene-decisions.json');
  fs.writeFileSync(ledgerFile,ledgerText);
  return {model,directory,ledger,ledgerText,ledgerFile};
}
test('explicit saved content decision survives regeneration without approving manifest',async()=>{
  const fixture=await authoringWithLedger('approval');
  const loaded=await api.writeQuicksetup(freshModel(),fixture.directory);
  const payload=JSON.parse(fs.readFileSync(path.join(fixture.directory,'payload.json')));
  assert.ok(payload.records.some(r=>r.evidence.approval==='approved'));
  assert.ok(payload.records.filter(r=>r.evidence.approval==='approved').every(r=>r.evidence.approved_by==='Test fixture author'));
  assert.equal(loaded.releaseReady,false);
  assert.equal(loaded.dossier.approval,'pending');
  assert.equal(fs.readFileSync(fixture.ledgerFile,'utf8'),fixture.ledgerText);
  await api.writeQuicksetup(freshModel(),fixture.directory);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(fixture.directory,'payload.json'))),payload);
  const receipt=JSON.parse(fs.readFileSync(path.join(fixture.directory,'preparation/generated-files.json')));
  assert.equal(Object.hasOwn(receipt,'preparation/scene-decisions.json'),false);
});
test('new source edition preserves ledger but reports stale decisions and keeps all records pending',async()=>{
  const fixture=await authoringWithLedger('stale-source');
  const changed=JSON.parse(fixture.model.sourceText); changed.initialWeather+=' Test revision.';
  const model=freshModel(JSON.stringify(changed));
  await api.writeQuicksetup(model,fixture.directory);
  const payload=JSON.parse(fs.readFileSync(path.join(fixture.directory,'payload.json')));
  assert.ok(payload.records.every(r=>r.evidence.approval==='pending'));
  const review=JSON.parse(fs.readFileSync(path.join(fixture.directory,'preparation/review-data.json')));
  assert.equal(review.approval_integration.stale_count,1);
  assert.equal(fs.readFileSync(fixture.ledgerFile,'utf8'),fixture.ledgerText);
});
test('changed scene metadata invalidates content decision without changing edition',async()=>{
  const fixture=await authoringWithLedger('stale-group');
  const changed=freshModel(); changed.review.supplement.scene_frames[0].title+=' Test revision.';
  await api.writeQuicksetup(changed,fixture.directory);
  const payload=JSON.parse(fs.readFileSync(path.join(fixture.directory,'payload.json')));
  assert.ok(payload.records.every(r=>r.evidence.approval==='pending'));
  const review=JSON.parse(fs.readFileSync(path.join(fixture.directory,'preparation/review-data.json')));
  assert.equal(review.approval_integration.stale_count,1);
});
test('manually edited managed file blocks all writes',async()=>{
  const fixture=await authoringWithLedger('manual-edit');
  const payloadFile=path.join(fixture.directory,'payload.json');
  const before=fs.readFileSync(payloadFile,'utf8');
  const receipt=fs.readFileSync(path.join(fixture.directory,'preparation/generated-files.json'),'utf8');
  fs.appendFileSync(path.join(fixture.directory,'records',fixture.model.records[0].record_id+'.yaml'),'# manual edit\n');
  await assert.rejects(api.writeQuicksetup(freshModel(),fixture.directory),/Refuse overwrite/);
  assert.equal(fs.readFileSync(payloadFile,'utf8'),before);
  assert.equal(fs.readFileSync(path.join(fixture.directory,'preparation/generated-files.json'),'utf8'),receipt);
});
test('obsolete managed file blocks regeneration without deletion or partial writes',async()=>{
  const fixture=await authoringWithLedger('obsolete');
  const name='records/obsolete.yaml', obsoleteFile=path.join(fixture.directory,name), bytes='# obsolete test fixture\n';
  fs.writeFileSync(obsoleteFile,bytes);
  const receiptFile=path.join(fixture.directory,'preparation/generated-files.json');
  const receipt=JSON.parse(fs.readFileSync(receiptFile));
  receipt[name]=crypto.createHash('sha256').update(bytes).digest('hex');
  const receiptText=JSON.stringify(receipt,null,2)+'\n'; fs.writeFileSync(receiptFile,receiptText);
  const before=fs.readFileSync(path.join(fixture.directory,'payload.json'),'utf8');
  await assert.rejects(api.writeQuicksetup(freshModel(),fixture.directory),/obsolete managed file/);
  assert.equal(fs.readFileSync(obsoleteFile,'utf8'),bytes);
  assert.equal(fs.readFileSync(receiptFile,'utf8'),receiptText);
  assert.equal(fs.readFileSync(path.join(fixture.directory,'payload.json'),'utf8'),before);
});

test('media inventory identity participates in saved content decision snapshot',async()=>{
  const fixture=await authoringWithLedger('stale-media');
  const changed=freshModel(); changed.media.assets[0].sha256='0'.repeat(64);
  await api.writeQuicksetup(changed,fixture.directory);
  const payload=JSON.parse(fs.readFileSync(path.join(fixture.directory,'payload.json')));
  assert.ok(payload.records.every(r=>r.evidence.approval==='pending'));
  const review=JSON.parse(fs.readFileSync(path.join(fixture.directory,'preparation/review-data.json')));
  assert.equal(review.approval_integration.stale_count,1);
  assert.deepEqual(review.media_manifest,changed.media);
  assert.equal(fs.readFileSync(fixture.ledgerFile,'utf8'),fixture.ledgerText);
});

test('real visual pack inventory uses the physical assetDirectory without false missing URLs',()=>{
 for(const id of ['cien-nad-prabutami','englewood-murder-castle-1893']){
  const sourceRef='data/adventures/predefined/'+id+'.json';
  const draft=api.prepareQuicksetup(fs.readFileSync(path.join(root,sourceRef),'utf8'),{sourceRef});
  const assets=draft.media.assets.filter(a=>a.origin==='visual-pack-manifest');
  assert.equal(assets.length,5);
  assert.ok(assets.every(a=>a.filesystem_status==='present'));
  assert.ok(assets.every(a=>a.url.startsWith('/adventure-packs/'+id+'/')));
 }
});
