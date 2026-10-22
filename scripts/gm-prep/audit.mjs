#!/usr/bin/env node
/** Local-only CLI; output must be private and outside the input directory. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { readAuditInput,loadAuditCore,verifyUnchanged,root,runtime,require,sha } from './audit-read.mjs';
import { auditMedia } from './audit-media.mjs';
import { renderAudit } from './audit-render.mjs';
import { verifyPdfHandouts } from './audit-pdf.mjs';

export async function runAudit(argv){
 const directory=fs.realpathSync(path.resolve(argv[0]||''));
 const options={runtime:false};
 for(let i=1;i<argv.length;i++){
  if(argv[i]==='--runtime')options.runtime=true;
  else if(['--out','--pdf'].includes(argv[i])&&argv[i+1]&&!argv[i+1].startsWith('--'))options[argv[i].slice(2)]=path.resolve(argv[++i]);
  else throw Error('Usage: audit.mjs <directory> [--runtime] [--pdf file] --out <private directory>');
 }
 if(!options.out)throw Error('--out is required');
 // Resolve existing ancestor so a symlink cannot redirect private reports to public/input.
 let ancestor=options.out;const missing=[];while(!fs.existsSync(ancestor)){missing.unshift(path.basename(ancestor));ancestor=path.dirname(ancestor);}
 const out=path.join(fs.realpathSync(ancestor),...missing);
 if(out===directory||out.startsWith(directory+path.sep)||out.split(path.sep).includes('public'))throw Error('Reports must be private and outside input');
 const {auditDossier,auditFinding,finishAudit,DOSSIER_AUDIT_ADAPTERS}=loadAuditCore();
 const data=readAuditInput(directory); const base=auditDossier(data.input);
 const results=[...base.results,...data.extras.map(auditFinding),...(await auditMedia(directory,data.input,data.hashes)).map(auditFinding)];
 const add=(code,status,actual,extra={})=>results.push(auditFinding({code,status,actual,group:'mechanics',file:'runtime',field:code,ids:[],expected:'verified',required:true,severity:status==='discrepancy'?'error':status==='unverifiable'?'warning':'info',evidenceType:'adapter',scope:'neutral_adapter',impact:'Zakres tej próby nie potwierdza konkretnej przygody.',recommendation:'Uzupełnij wskazany dowód.',evidence:[],...extra}));
 let temporary;
 try{
  if(options.runtime){
   temporary=fs.mkdtempSync(path.join(os.tmpdir(),'dossier-audit-'));
   const evidence=path.join(temporary,'adapters.json');
   const suites=DOSSIER_AUDIT_ADAPTERS.map(x=>x.suite.startsWith('src/')?x.suite:`src/lib/adventure-dossier/${x.suite}`);
   const proc=spawnSync(process.execPath,[path.join(runtime,'node_modules/jest/bin/jest.js'),'--runInBand','--runTestsByPath',...suites,'--json',`--outputFile=${evidence}`],{cwd:runtime,encoding:'utf8',timeout:240000,maxBuffer:8*1024*1024,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'}});
   let report;try{report=JSON.parse(fs.readFileSync(evidence,'utf8'));}catch{}
   for(const adapter of DOSSIER_AUDIT_ADAPTERS){
    const suite=report?.testResults?.find(x=>x.name.endsWith('/'+adapter.suite));
    if(!suite?.assertionResults?.length){add('ADAPTER_UNAVAILABLE','unverifiable',proc.error?.message||suite?.message||'No test evidence',{field:adapter.id,evidence:[adapter.adapter,adapter.limitation]});continue;}
    for(const t of suite.assertionResults)add('ADAPTER_PROBE',t.status==='passed'?'checked':t.status==='failed'?'discrepancy':'unverifiable',t.status,{field:adapter.id+':'+t.fullName,expected:'passed',evidence:[adapter.adapter,adapter.suite,t.fullName,adapter.limitation,...(t.failureMessages||[])]});
   }
  }else for(const a of DOSSIER_AUDIT_ADAPTERS)add('ADAPTER_NOT_RUN','unverifiable','--runtime not supplied',{field:a.id,evidence:[a.adapter]});
  add('PILOT_RUNTIME','unverifiable',data.input.manifest?.approval==='approved'?'No approved-package UI evidence in this audit':'Approval gate closed',{scope:'dossier',evidenceType:'interface',file:'dossier.yaml',field:'approval',expected:'approved package gameplay evidence',impact:'Neutralne próby nie dowodzą działania pakietu przygody.',recommendation:'Odbierz teczkę i wykonaj osobny przebieg zatwierdzonego pakietu.'});
  if(options.pdf){
   let bytes;try{bytes=fs.readFileSync(options.pdf);data.hashes[options.pdf]=sha(bytes);}catch(e){add('PDF_INPUT_UNAVAILABLE','unverifiable',String(e),{group:'items',scope:'dossier',file:options.pdf,field:'$',evidenceType:'data'});}
   if(bytes){
   const actual='sha256:'+sha(bytes), expected=data.input.manifest?.edition_fingerprint;
   add('PDF_EDITION',actual===expected?'checked':'discrepancy',actual,{scope:'dossier',evidenceType:'data',file:path.basename(options.pdf),expected,field:'sha256',impact:'Aktualny paker rozpoznaje dokładny hash pliku.',recommendation:'Użyj zweryfikowanego wydania; audyt nie odblokowuje pakietu.'});
   const handouts=data.input.records.filter(x=>x.value?.local_handout);
   try{
    const checks=await verifyPdfHandouts(bytes,handouts.map(x=>x.value));
    for(const c of checks)add('PDF_HANDOUT_PIXELS',c.status,c.actual,{group:'items',scope:'dossier',file:handouts.find(x=>x.value.record_id===c.recordId)?.file||'records',field:'local_handout',ids:[c.recordId],expected:'original pixels match via application extractor',evidenceType:'adapter',evidence:c.evidence,impact:'Kontrola obrazu lokalnego; nie potwierdza zdobycia w rozgrywce.',recommendation:c.status==='checked'?'Brak.':'Sprawdź dekoder i locator, nie podmieniaj wzorca na podstawie błędu odczytu.'});
   }catch(e){add('PDF_EXTRACTION_UNAVAILABLE','unverifiable',String(e),{group:'items',scope:'dossier',file:'local PDF',field:'local_handout'});}
   }
  }else add('PDF_NOT_SUPPLIED','unverifiable','--pdf not supplied',{group:'items',scope:'dossier',file:'local PDF',field:'edition/handouts',evidenceType:'data',expected:'local edition and pixel extraction proof'});
  const changed=verifyUnchanged(data.hashes);
  add('INPUT_UNCHANGED',changed.length?'discrepancy':'checked',changed,{group:'structure',scope:'dossier',file:'input snapshot',field:'sha256',evidenceType:'data',expected:[],evidence:[`${Object.keys(data.hashes).length} input files hashed before and after; runtime probes use isolated jsdom storage`]});
  const report={...finishAudit(results,base.graph),createdAt:new Date().toISOString(),input:directory,controls:DOSSIER_AUDIT_ADAPTERS,inputHashes:data.hashes};
  fs.mkdirSync(out,{recursive:true,mode:0o700});fs.chmodSync(out,0o700);
  for(const [name,text]of [['report.json',JSON.stringify(report,null,2)+'\n'],['report.html',renderAudit(report)]]){const target=path.join(out,name);if(fs.existsSync(target)&&(!fs.lstatSync(target).isFile()||fs.lstatSync(target).isSymbolicLink()))throw Error('Report target must be a regular file');fs.writeFileSync(target,text,{mode:0o600});fs.chmodSync(target,0o600);}
  console.log(JSON.stringify({report:path.join(out,'report.html'),coverage:report.coverage,exitCode:report.exitCode}));
  return report.exitCode;
 }finally{if(temporary)fs.rmSync(temporary,{recursive:true,force:true});}
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){runAudit(process.argv.slice(2)).then(code=>{process.exitCode=code;}).catch(e=>{console.error('AUDITOR_FAILURE: '+e.message);process.exitCode=2;});}
