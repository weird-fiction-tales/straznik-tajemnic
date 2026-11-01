import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readBuildModel } from './build-model.mjs';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const runtime=path.join(root,'_tester/_base/.silnik');
export const require=createRequire(path.join(runtime,'package.json'));
const yaml=require('js-yaml');
export const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
export function loadAuditCore(){
 const old=require.extensions['.ts']; const ts=require('typescript');
 require.extensions['.ts']=(module,file)=>{
  if(!file.startsWith(path.join(runtime,'src/lib/adventure-dossier/'))&&file!==path.join(runtime,'src/lib/immersion/adventure-asset-resolver.ts'))throw Error('Unexpected audit dependency');
  module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},fileName:file}).outputText,file);
 };
 try{return {...require(path.join(runtime,'src/lib/adventure-dossier/audit.ts')),...require(path.join(runtime,'src/lib/adventure-dossier/audit-registry.ts')),...require(path.join(runtime,'src/lib/immersion/adventure-asset-resolver.ts'))};}
 finally{if(old)require.extensions['.ts']=old;else delete require.extensions['.ts'];}
}
export function readAuditInput(directory){
 const extras=[], hashes={};
 const note=(code,file,field,actual,status='discrepancy',expected='readable regular data')=>extras.push({code,group:'structure',status,file,field,actual,expected,ids:[],required:true,severity:status==='discrepancy'?'error':'warning',scope:'dossier',evidenceType:'data',impact:'Niepełne lub nieaktualne dane wejściowe.',recommendation:'Popraw wskazany plik i ponów audyt.',evidence:[`${file}#${field}`]});
 const read=(relative,format='json')=>{
  const f=path.resolve(directory,relative);
  try{
   const stat=fs.lstatSync(f);if(!stat.isFile()||stat.isSymbolicLink())throw Error('Expected regular file, no symlinks');
   const b=fs.readFileSync(f);hashes[f]=sha(b);
   return format==='yaml'?yaml.load(b.toString(),{schema:yaml.JSON_SCHEMA}):format==='text'?b.toString():JSON.parse(b.toString());
  }catch(e){note('INPUT_READ',relative,'$',String(e));return null;}
 };
 const manifest=read('dossier.yaml','yaml');
 const records=[];
 try{
  const d=path.join(directory,'records'), stat=fs.lstatSync(d);
  if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('Expected regular records directory');
  for(const name of fs.readdirSync(d).sort()){
   if(!name.endsWith('.yaml')){note('INPUT_FORMAT',`records/${name}`,'$',name);continue;}
   const value=read(`records/${name}`,'yaml');if(value!==null)records.push({file:`records/${name}`,value});
  }
 }catch(e){note('INPUT_READ','records','$',String(e));}
 const review=read('preparation/review-data.json');
 const supplement=read('preparation/playbook.json');
 const config=read('preparation/build.json');
 const receipt=read('preparation/generated-files.json');
 const html=read('teczka.html','text');
 const readiness=read('preparation/readiness.json');
 let model;
 // Hash original source too, including when compilation cannot normalize it.
 if(config?.source)read(config.source,'text');
 try{model=readBuildModel(directory,{audit:true});for(const [i,error] of model.diagnostics.entries())note('SOURCE_DIAGNOSTIC',config?.source||'source',`diagnostics[${i}]`,error);}catch(e){note('SOURCE_NORMALIZATION','preparation/build.json','source',String(e),'unverifiable');}
 if(model){
  for(const [key,actual,expected] of [['review-data',review,model.review],['readiness',readiness,model.readiness]]){
   if(JSON.stringify(actual)!==JSON.stringify(expected))note('GENERATED_STALE',`preparation/${key}.json`,'$',sha(JSON.stringify(actual)), 'discrepancy',sha(JSON.stringify(expected)));
   else extras.push({code:'GENERATED_CURRENT',group:'structure',status:'checked',file:`preparation/${key}.json`,field:'$',ids:[],expected:'fresh compilation',actual:'equal',required:true,severity:'info',scope:'dossier',evidenceType:'data',impact:'Aktualny wynik kompilacji.',recommendation:'Brak.',evidence:['comparison with readBuildModel']});
  }
  const expected=JSON.stringify(model.review).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
  if(typeof html!=='string'||!html.includes(expected))note('PREVIEW_STALE','teczka.html','embedded_data','differs from source');
 }
 if(receipt&&typeof receipt==='object')for(const [file,hash]of Object.entries(receipt)){
  const actual=hashes[path.join(directory,'records',file)];
  if(actual!==hash)note('RECEIPT_MISMATCH',`records/${file}`,'sha256',actual||'missing','discrepancy',hash);
 }
 const input={manifest,records,graph:review?.graph,actors:review?.actors,supplement,
  ...(model?{expectedRecords:model.payload.records,sourceNodeClaims:model.sourceNodeClaims,
   aliases:[...model.locationNameOwners].map(([alias,owners])=>({alias,owners:[...owners]})),
   rawRefs:[...model.metadata].flatMap(([recordId,v])=>v.refs.map(ref=>({recordId,ref,target:model.primary.get(ref),file:path.relative(directory,model.sourcePath)})))}:{})};
 return {input,extras,hashes,review,model};
}
export function verifyUnchanged(hashes){
 return Object.entries(hashes).filter(([file,hash])=>!fs.existsSync(file)||sha(fs.readFileSync(file))!==hash).map(([file])=>file);
}
