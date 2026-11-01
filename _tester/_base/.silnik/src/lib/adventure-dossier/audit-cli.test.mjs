import test from 'node:test';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readAuditInput,loadAuditCore,root,require } from '../../../../../../scripts/gm-prep/audit-read.mjs';
import { auditMedia } from '../../../../../../scripts/gm-prep/audit-media.mjs';
const temporary=()=>fs.mkdtempSync(path.join(os.tmpdir(),'audit-fixture-'));

test('independent broken YAML does not suppress readable records or successful graph checks',()=>{
 const dir=temporary();try{fs.mkdirSync(path.join(dir,'records'));fs.writeFileSync(path.join(dir,'dossier.yaml'),'adventure_id: fixture\nedition_fingerprint: fixture\napproval: pending\n');fs.writeFileSync(path.join(dir,'records/broken.yaml'),'bad: [');fs.writeFileSync(path.join(dir,'records/readable.yaml'),'record_id: good\nlinks: [missing]\n');
 const data=readAuditInput(dir);assert.equal(data.input.records.length,1);assert.ok(data.extras.some(r=>r.code==='INPUT_READ'&&r.file==='records/broken.yaml'));
 const report=loadAuditCore().auditDossier(data.input);assert.equal(report.exitCode,1);assert.ok(report.results.some(r=>r.code==='LINK_TARGET'&&r.file==='records/readable.yaml'));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('active quarantined media is located precisely and cannot pass',async()=>{
 const input={graph:{nodes:[{id:'actor'}]},supplement:{assets:[{id:'bad',entity_id:'actor',path:'missing.webp',active:true,approval:'approved',quarantine:true}]}};
 const rows=await auditMedia(root,input);assert.ok(rows.some(r=>r.code==='MEDIA_QUARANTINE'&&r.status==='discrepancy'&&r.field==='assets[0].active'));
});
test('an explicit empty inventory is not a missing runtime manifest when no active pack exists',async()=>{
 const dir=temporary();try{fs.mkdirSync(path.join(dir,'preparation'));fs.mkdirSync(path.join(dir,'records'));
  fs.writeFileSync(path.join(dir,'dossier.yaml'),'adventure_id: dossier-media-empty-fixture\n');
  fs.writeFileSync(path.join(dir,'preparation/media-inventory.json'),JSON.stringify({schema_version:1,approved_assets:[],excluded_assets:[],empty_reason:'All prior images are quarantined; none is approved.'}));
  const data=readAuditInput(dir);const rows=await auditMedia(dir,data.input,data.hashes);
  assert.ok(rows.some(r=>r.code==='MEDIA_INVENTORY'&&r.status==='not_applicable'));
  assert.ok(rows.some(r=>r.code==='MEDIA_RUNTIME_MANIFEST'&&r.status==='not_applicable'));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('actual media dimensions and explicit continuity are checked',async()=>{
 const dir=path.join(root,'_tester/_base/.silnik/test-results/audit-media-fixture');fs.mkdirSync(dir,{recursive:true});
 try{await require('sharp')({create:{width:4,height:3,channels:3,background:'#223322'}}).png().toFile(path.join(dir,'image.png'));
 const rows=await auditMedia(dir,{graph:{nodes:[{id:'actor'}]},actors:[{id:'actor',fields:{'appearance.hair':{value:'dark'}}}],supplement:{assets:[{id:'image',entity_id:'actor',path:'image.png',active:true,approval:'approved',width:4,height:3,continuity:{'appearance.hair':'light'}}]}});
 assert.ok(rows.some(r=>r.code==='MEDIA_DIMENSIONS'&&r.status==='checked'));assert.ok(rows.some(r=>r.code==='MEDIA_CONTINUITY'&&r.status==='discrepancy'));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('CLI produces a private incomplete report for corrupt input, never false success',()=>{
 const dir=temporary(),out=temporary();try{
 fs.mkdirSync(path.join(dir,'records'));fs.writeFileSync(path.join(dir,'dossier.yaml'),'x: [');
 const run=spawnSync(process.execPath,[path.join(root,'scripts/gm-prep/audit.mjs'),dir,'--out',out],{encoding:'utf8'});assert.equal(run.status,1,run.stderr);const report=JSON.parse(fs.readFileSync(path.join(out,'report.json')));assert.ok(report.results.some(r=>r.code==='INPUT_READ'));assert.equal(fs.statSync(path.join(out,'report.json')).mode&0o777,0o600);
 const refused=spawnSync(process.execPath,[path.join(root,'scripts/gm-prep/audit.mjs'),dir,'--out',path.join(dir,'public')],{encoding:'utf8'});assert.equal(refused.status,2);assert.equal(fs.existsSync(path.join(dir,'public')),false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});fs.rmSync(out,{recursive:true,force:true});}
});

// Fully authored one-pixel PDF. No external document, OCR or proprietary text.
test('optional PDF verifies edition and exact image pixels locally',()=>{
 const hash=b=>createHash('sha256').update(b).digest('hex');
 const dir=temporary(),out=temporary();
 try{
  const chunks=[Buffer.from('%PDF-1.4\n')],offsets=[0];let length=chunks[0].length;
  const objects=[
   '<< /Type /Catalog /Pages 2 0 R >>',
   '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
   '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 10 10] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>',
   '<< /Length 27 >>\nstream\nq 10 0 0 10 0 0 cm /Im0 Do Q\nendstream',
   Buffer.concat([Buffer.from('<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length 3 >>\nstream\n'),Buffer.from([255,0,0]),Buffer.from('\nendstream')]),
  ];
  for(const [i,object]of objects.entries()){offsets.push(length);const b=Buffer.concat([Buffer.from(`${i+1} 0 obj\n`),Buffer.isBuffer(object)?object:Buffer.from(object),Buffer.from('\nendobj\n')]);chunks.push(b);length+=b.length;}
  chunks.push(Buffer.from(`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`));
  const bytes=Buffer.concat(chunks),pdf=path.join(dir,'authored.pdf');fs.writeFileSync(pdf,bytes);
  fs.mkdirSync(path.join(dir,'records'));fs.writeFileSync(path.join(dir,'dossier.yaml'),`adventure_id: fixture\nedition_fingerprint: sha256:${hash(bytes)}\napproval: pending\n`);
  const locator={kind:'embedded_image',pdf_page:1,width:1,height:1,rgba_sha256:hash(Buffer.from([255,0,0,255])),title:'Autorska próbka',audience:'party'};
  fs.writeFileSync(path.join(dir,'records/image.yaml'),JSON.stringify({record_id:'image',local_handout:locator}));
  const run=spawnSync(process.execPath,[path.join(root,'scripts/gm-prep/audit.mjs'),dir,'--pdf',pdf,'--out',out],{encoding:'utf8'});assert.equal(run.status,1,run.stderr);
  let report=JSON.parse(fs.readFileSync(path.join(out,'report.json')));assert.ok(report.results.some(r=>r.code==='PDF_EDITION'&&r.status==='checked'));
  assert.ok(report.results.some(r=>r.code==='PDF_HANDOUT_PIXELS'&&r.status==='checked'),JSON.stringify(report.results.filter(r=>r.code.startsWith('PDF_'))));
  locator.rgba_sha256='0'.repeat(64);fs.writeFileSync(path.join(dir,'records/image.yaml'),JSON.stringify({record_id:'image',local_handout:locator}));
  spawnSync(process.execPath,[path.join(root,'scripts/gm-prep/audit.mjs'),dir,'--pdf',pdf,'--out',out],{encoding:'utf8'});
  report=JSON.parse(fs.readFileSync(path.join(out,'report.json')));assert.ok(report.results.some(r=>r.code==='PDF_HANDOUT_PIXELS'&&r.status==='discrepancy'));
 }finally{fs.rmSync(dir,{recursive:true,force:true});fs.rmSync(out,{recursive:true,force:true});}
});

test('private media inventory retains rejected files without making them playable',async()=>{
 const dir=path.join(root,'_tester/_base/.silnik/test-results/private-media-inventory-fixture');fs.mkdirSync(path.join(dir,'preparation'),{recursive:true});
 try {
  const bytes=Buffer.from('authored rejected fixture');fs.writeFileSync(path.join(dir,'rejected.bin'),bytes);
  const entry={id:'rejected',path:'rejected.bin',sha256:createHash('sha256').update(bytes).digest('hex'),active:false,approval:'rejected',reason:'Invalid authored reference.'};
  const file=path.join(dir,'preparation/media-inventory.json');
  fs.writeFileSync(file,JSON.stringify({schema_version:1,approved_assets:[],excluded_assets:[entry],local_handouts:[]}));
  let rows=await auditMedia(dir,{graph:{nodes:[]},supplement:{}});
  assert.ok(rows.some(r=>r.code==='MEDIA_EXCLUSION'&&r.status==='checked'));
  assert.ok(rows.some(r=>r.code==='MEDIA_INVENTORY'&&r.status==='unverifiable'));
  entry.active=true;fs.writeFileSync(file,JSON.stringify({schema_version:1,approved_assets:[],excluded_assets:[entry],local_handouts:[]}));
  rows=await auditMedia(dir,{graph:{nodes:[]},supplement:{}});
  assert.ok(rows.some(r=>r.code==='MEDIA_EXCLUSION'&&r.status==='discrepancy'));
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('pilot compiler preserves source cards and adds authored connections to RAG without approving',async()=>{
 const {readBuildModel}=await import('../../../../../../scripts/gm-prep/build-model.mjs');
 const model=readBuildModel(path.join(root,'docs/adventure-dossiers/posrod-pradawnych-drzew-v1.3'));
 assert.equal(model.manifest.approval,'pending');
 for(const connection of model.config.additional_connections){
  const r=model.records.find(r=>r.record_id===model.primary.get(connection.from));
  assert.ok(r?.links.includes(model.primary.get(connection.to)),connection.id);
  const guide=model.records.find(r=>r.record_type==='director_note'&&r.content.includes(`Od: ${connection.from}`)&&r.content.includes(`Do: ${connection.to}`)&&r.content.includes(connection.condition)&&r.evidence.source_ref.includes(connection.source_ref));
  assert.ok(guide,`RAG guidance card missing for ${connection.id}`);
  assert.equal(guide.retrieval.availability,'always',`graph guidance must remain searchable outside its endpoint scene: ${connection.id}`);
  assert.ok(guide.links.includes(model.primary.get(connection.from)),`source node link missing for ${connection.id}`);
  assert.ok(guide.links.includes(model.primary.get(connection.to)),`target node link missing for ${connection.id}`);
 }
 for(const claim of model.sourceNodeClaims){
  const node=model.review.graph.nodes.find(n=>n.id===claim.id);
  assert.ok(node.source_cards.some(c=>c.kind===claim.kind&&c.source_ref===claim.source_ref),claim.id);
 }
 const expected=['obj-clearing-casings','obj-artist-sketches-sheet','obj-geological-maps','obj-geological-papers'];
 for(const entity of expected)assert.equal(model.records.filter(r=>r.inventory_item?.entity_id===entity).length,1,entity);
 assert.ok(model.review.graph.edges.some(e=>e.from==='evt-day-3-forest'&&e.to==='evt-captives-taken-to-lake'&&e.kind==='world_event'));
});

test('pilot compiler keeps world objects and selection templates out of investigator inventory semantics',async()=>{
 const {readBuildModel}=await import('../../../../../../scripts/gm-prep/build-model.mjs');
 const model=readBuildModel(path.join(root,'docs/adventure-dossiers/posrod-pradawnych-drzew-v1.3'));
 const recordFor=(entity)=>model.records.find(r=>r.record_type==='fact'&&r.tags.entities.includes(entity));
 for(const entity of ['obj-blue-crystal','obj-excavation-hoist','obj-blue-sarcophagus','obj-geology-truck']){
  const record=recordFor(entity);
  assert.ok(record,entity);
  assert.equal(record.inventory_item,undefined,entity);
  assert.ok(record.tags.topics.includes('adventure_object'),entity);
  assert.doesNotMatch(record.content,/Po zdobyciu przekazanie|wspólny adapter ekwipunku/i,entity);
  assert.doesNotMatch(record.tags.triggers.join(' '),/give|drop|^take$/i,entity);
 }
 const sampleRecord=recordFor('obj-sarcophagus-residue');
 assert.ok(sampleRecord.inventory_item,'one collected sample must use the shared persistent inventory adapter');
 assert.equal(sampleRecord.inventory_item.category,'story');
 assert.equal(sampleRecord.inventory_item.source_location,'loc-turner-undercroft');
 assert.match(sampleRecord.content,/konkretnej instancji/i);
 for(const entity of ['obj-purchased-equipment','obj-turner-keepsakes','obj-truck-dynamite','obj-shed-supplies']){
  const record=recordFor(entity);
  assert.ok(record,entity);
  assert.equal(record.inventory_item,undefined,entity);
  assert.match(record.content,/karta sama nie tworzy instancji ekwipunku/i,entity);
 }
 const template=recordFor('obj-npc-carried-equipment');
 assert.match(template.content,/szablon pochodzenia wyposażenia NPC, nie egzemplarz/i);
 assert.equal(template.inventory_item,undefined);
});

test('prepared actor overviews retain authored opening/world state without executing it',async()=>{
 const {readBuildModel}=await import('../../../../../../scripts/gm-prep/build-model.mjs');
 const model=readBuildModel(path.join(root,'docs/adventure-dossiers/posrod-pradawnych-drzew-v1.3'));
 for(const actor of model.review.actors){
  const overviews=model.records.filter(r=>r.record_type==='actor'&&r.tags.entities.includes(actor.id)&&r.tags.topics.includes('intent'));
  const text=overviews.map(r=>r.content).join('\n');
  for(const [key,raw] of Object.entries(actor.fields)){
   const field={...actor.field_defaults?.[raw.provenance],...raw};
   if(!/^(opening_state|world_state|body)\./.test(key)||field.status!=='set'||field.value==null)continue;
   assert.ok(text.includes(key+': '),actor.id+' '+key);
  }
  if(overviews.length)assert.ok(text.includes('nie oznacza, że już zaszły'),actor.id);
 }
});

test('pilot context prerequisites are bounded actor profiles, not all graph neighbors',async()=>{
 const {readBuildModel}=await import('../../../../../../scripts/gm-prep/build-model.mjs');
 const model=readBuildModel(path.join(root,'docs/adventure-dossiers/posrod-pradawnych-drzew-v1.3'));
 const byId=new Map(model.records.map(r=>[r.record_id,r]));let dependencies=0;
 for(const record of model.records){
  for(const id of record.context_links||[]){
   dependencies++;const target=byId.get(id);
   assert.ok(record.links.includes(id));assert.notEqual(id,record.record_id);
   assert.equal(record.record_type,'actor');assert.deepEqual(target.tags.entities,record.tags.entities);
   assert.ok(target.tags.topics.includes('intent')||target.tags.topics.includes('uncertainty'));
  }
 }
 assert.ok(dependencies>0);assert.equal(model.manifest.approval,'pending');
});
