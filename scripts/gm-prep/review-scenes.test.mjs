import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {existsSync} from 'node:fs';
const moduleUrl=new URL('./review-scenes.mjs',import.meta.url);
const {writeSceneReview}=existsSync(moduleUrl)?await import(moduleUrl):{};
function fixture(){const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'scene-review-')));fs.mkdirSync(path.join(dir,'preparation'));const manifest={adventure_id:'fixture',edition_fingerprint:'sha256:fixture',language:'pl',approval:'pending'};const record={record_id:'one',adventure_id:'fixture',edition_fingerprint:manifest.edition_fingerprint,content:'Neutral source',tags:{scenes:['opening'],entities:[]},evidence:{approval:'pending',source_ref:'fixture#one'},links:[]};fs.writeFileSync(path.join(dir,'payload.json'),JSON.stringify({records:[record]}));fs.writeFileSync(path.join(dir,'preparation/review-data.json'),JSON.stringify({title:'Fixture',manifest,supplement:{scene_frames:[{id:'opening',title:'Opening',focus:'Neutral scene'}]}}));return dir;}
test('writes author review without approving or modifying source records',async()=>{
 assert.equal(typeof writeSceneReview,'function');const dir=fixture();const before=fs.readFileSync(path.join(dir,'payload.json'),'utf8');
 const result=await writeSceneReview({directory:dir});
 assert.equal(result.model.coverage.total,1);assert.ok(fs.readFileSync(result.html,'utf8').includes('Fixture'));
 assert.equal(fs.readFileSync(path.join(dir,'payload.json'),'utf8'),before);assert.ok(!fs.existsSync(path.join(dir,'preparation/scene-decisions.json')));
});
test('refuses public output before any author file is written',async()=>{
 assert.equal(typeof writeSceneReview,'function');const dir=fixture();const out=path.join(dir,'public','review');
 await assert.rejects(()=>writeSceneReview({directory:dir,output:out}),/public/i);assert.ok(!fs.existsSync(out));
});
test('invalid imported decisions cannot replace an existing author ledger',async()=>{
 assert.equal(typeof writeSceneReview,'function');const dir=fixture();const ledger=path.join(dir,'preparation/scene-decisions.json');fs.writeFileSync(ledger,'original');const file=path.join(dir,'invalid.json');fs.writeFileSync(file,JSON.stringify({schema_version:1,adventure_id:'wrong',edition_fingerprint:'other',decisions:[]}));
 await assert.rejects(()=>writeSceneReview({directory:dir,decisionsPath:file,saveDecisions:true}));assert.equal(fs.readFileSync(ledger,'utf8'),'original');
});

test('a preserved ledger from an older edition does not prevent reviewing the new pending draft',async()=>{
 const dir=fixture();const ledger=path.join(dir,'preparation/scene-decisions.json');
 const old=JSON.stringify({schema_version:1,adventure_id:'fixture',edition_fingerprint:'sha256:older',decisions:[]});fs.writeFileSync(ledger,old);
 const result=await writeSceneReview({directory:dir});
 assert.ok(fs.existsSync(result.html));assert.equal(fs.readFileSync(ledger,'utf8'),old);assert.equal(result.stale_ledger,true);
 const doc=JSON.parse(fs.readFileSync(result.json,'utf8'));assert.equal(doc.decisions,undefined);assert.ok(doc.warnings.length);
});

const ledgerDocument=model=>({schema_version:1,adventure_id:model.adventure_id,edition_fingerprint:model.edition_fingerprint,decisions:[]});
const freshDecision=(model,group_id='scene:opening',domain='content')=>({
 group_id,domain,snapshot:model.groups.find(g=>g.id===group_id).snapshot,
 status:'accepted',reviewer:'Fixture author',at:'2026-10-20T12:00:00Z',
});
async function saveOverPrevious(dir,previous,additional=[]){
 const {model}=await writeSceneReview({directory:dir});
 const current=ledgerDocument(model);current.decisions=[freshDecision(model),...additional.map(domain=>freshDecision(model,'shared',domain))];
 const input=path.join(dir,'new-decisions.json');fs.writeFileSync(input,JSON.stringify(current));
 const ledger=path.join(dir,'preparation/scene-decisions.json');fs.writeFileSync(ledger,previous);
 const result=await writeSceneReview({directory:dir,decisionsPath:input,saveDecisions:true});
 return {result,ledger,model,saved:JSON.parse(fs.readFileSync(ledger,'utf8'))};
}
async function assertArchived(dir,bytes){
 const {createHash}=await import('node:crypto');
 const file=path.join(dir,'preparation/scene-decisions-history',createHash('sha256').update(bytes).digest('hex')+'.json');
 assert.deepEqual(fs.readFileSync(file),bytes);
 assert.equal(fs.statSync(file).mode&0o777,0o600);
}
test('fresh decisions replace an old edition after exact private archival without inheriting approval',async()=>{
 const dir=fixture(),{model}=await writeSceneReview({directory:dir}),old=ledgerDocument(model);
 old.edition_fingerprint='sha256:previous';old.decisions=[freshDecision(model,'shared','media')];
 const bytes=Buffer.from(' \n'+JSON.stringify(old,null,3)+'\n\n');
 const {saved,result}=await saveOverPrevious(dir,bytes);
 assert.equal(saved.edition_fingerprint,model.edition_fingerprint);
 assert.deepEqual(saved.decisions.map(d=>d.group_id+'|'+d.domain),['scene:opening|content']);
 assert.equal(result.decisions_saved,true);assert.equal(result.stale_ledger,true);
 await assertArchived(dir,bytes);
});
test('removed groups and stale snapshots do not block save or discard other fresh domains',async()=>{
 const dir=fixture(),{model}=await writeSceneReview({directory:dir}),old=ledgerDocument(model);
 old.decisions=[freshDecision(model,'shared','integration'),{...freshDecision(model),group_id:'scene:removed'},
 {...freshDecision(model,'shared','media'),snapshot:'0'.repeat(64)}];
 const bytes=Buffer.from(JSON.stringify(old,null,2)+'\n');
 const {saved,result}=await saveOverPrevious(dir,bytes);
 assert.deepEqual(saved.decisions.map(d=>d.group_id+'|'+d.domain),['shared|integration','scene:opening|content']);
 assert.equal(result.stale_ledger,true);await assertArchived(dir,bytes);
 const presentation=JSON.parse(fs.readFileSync(result.json,'utf8'));
 assert.deepEqual(presentation.decisions,saved);assert.ok(presentation.warnings.length);
});
test('saving retains current decisions and incoming choice replaces only its domain; repeated history is idempotent',async()=>{
 const dir=fixture(),{model}=await writeSceneReview({directory:dir}),old=ledgerDocument(model);
 old.decisions=[{...freshDecision(model),status:'rework'},freshDecision(model,'shared','playthrough')];
 const bytes=Buffer.from(JSON.stringify(old));
 const {saved}=await saveOverPrevious(dir,bytes,['media']);
 assert.equal(saved.decisions.length,3);
 assert.equal(saved.decisions.find(d=>d.group_id==='scene:opening').status,'accepted');
 assert.equal(saved.decisions.find(d=>d.domain==='playthrough').status,'accepted');
 await assertArchived(dir,bytes);
 await saveOverPrevious(dir,bytes,['media']);await assertArchived(dir,bytes);
});
