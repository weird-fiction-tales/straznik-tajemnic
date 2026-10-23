#!/usr/bin/env node
/** Offline author review. Never approves a manifest or publishes an adventure. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildSceneReview, importSceneDecisions, exportSceneDecisions } from './scene-review.mjs';
import { renderSceneReview } from './scene-review-render.mjs';
const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const readJSON=file=>JSON.parse(fs.readFileSync(file,'utf8'));
function privatePath(target){
 const absolute=path.resolve(target);if(absolute.split(path.sep).includes('public'))throw Error('Author review cannot be public');
 let candidate=absolute;while(candidate!==path.dirname(candidate)){
  if(fs.existsSync(candidate)&&fs.lstatSync(candidate).isSymbolicLink())throw Error('Author review path cannot contain symbolic links');candidate=path.dirname(candidate);
 }
 return absolute;
}
function mediaForReview(raw){
 return (Array.isArray(raw)?raw:raw.assets||[]).map((item,index)=>{
  const relative=item.filesystem_status==='present'?item.filesystem_path:item.storage_status==='present'?item.storage_path:null;
  let preview;
  if(relative){
   const file=path.resolve(repository,relative),publicRoot=path.join(repository,'_tester/_base/.silnik/public');
   if(file.startsWith(publicRoot+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())preview=pathToFileURL(file).href;
  }
  return {...item,id:item.id||'media-'+index,label:item.label||item.handout_slug||path.basename(item.url||item.path||'Materiał'),
   scene_ids:item.scene_ids||(item.node_id?[item.node_id]:[]),preview_url:preview};
 });
}
export async function writeSceneReview({directory,output,decisionsPath,saveDecisions=false}){
 directory=privatePath(directory);output=privatePath(output||path.join(directory,'scene-review'));
 let manifest,records,review;
 if(fs.existsSync(path.join(directory,'payload.json'))){
  const payload=readJSON(path.join(directory,'payload.json'));review=readJSON(path.join(directory,'preparation/review-data.json'));manifest=review.manifest;records=payload.records;
 }else{
  const {readBuildModel}=await import('./build-model.mjs');
  const input=readBuildModel(directory,{audit:true});manifest=input.manifest;records=input.payload.records;review=input.review;
 }
 const mediaPath=path.join(directory,'preparation/media-manifest.json');
 const rawMedia=fs.existsSync(mediaPath)?readJSON(mediaPath):{assets:[]};
 // Current bytes are part of the snapshot; stored inventory hashes alone cannot authorize changed media.
 for(const item of rawMedia.assets||[]){
  for(const [field,hashField] of [['filesystem_path','sha256'],['storage_path','storage_sha256']]){
   if(!item[field])continue;const file=path.resolve(repository,item[field]);const publicRoot=path.join(repository,'_tester/_base/.silnik/public');
   const observed=file.startsWith(publicRoot+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()?crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'):null;
   if ((item[hashField]??null)!==observed) throw Error('Media changed since inventory; regenerate the draft before review: '+(item.url||item[field]));
  }
 }
 review={...review,media_manifest:rawMedia};
 const model=buildSceneReview({manifest,records,review});
 const canonicalLedger=path.join(directory,'preparation/scene-decisions.json');
 const chosen=decisionsPath||(!saveDecisions&&fs.existsSync(canonicalLedger)?canonicalLedger:null);
 let decisions,staleLedger=false;const warnings=[];
 if(chosen){
  const source=fs.readFileSync(path.resolve(chosen),'utf8');
  try{decisions=importSceneDecisions(model,source);}catch(error){
   if(decisionsPath||saveDecisions||!/adventure\/edition mismatch|Unknown decision group/.test(error.message))throw error;
   staleLedger=true;warnings.push('Zachowano poprzedni plik decyzji, ale nie dotyczy aktualnego zestawu. Nowa wersja wymaga odbioru.');
  }
 }
 if(saveDecisions&&!decisionsPath)throw Error('Saving decisions requires an explicit input file');
 const html=path.join(output,'index.html'),json=path.join(output,'review.json');
 let historyPath,previousBytes;
 if(saveDecisions){
  privatePath(canonicalLedger);
  if(fs.existsSync(canonicalLedger)){
   previousBytes=fs.readFileSync(canonicalLedger);
   const digest=crypto.createHash('sha256').update(previousBytes).digest('hex');
   historyPath=privatePath(path.join(directory,'preparation/scene-decisions-history',digest+'.json'));
   if(fs.existsSync(historyPath)&&!fs.readFileSync(historyPath).equals(previousBytes))throw Error('Decision history hash collision or altered archive');
   let prior=[];
   try{
    const previous=JSON.parse(previousBytes.toString('utf8'));
    if(!Array.isArray(previous.decisions))throw Error('Invalid previous decisions');
    importSceneDecisions(model,{...previous,decisions:[]});
    const counts=new Map();
    for(const entry of previous.decisions){
     const key=entry?.group_id+'|'+entry?.domain;counts.set(key,(counts.get(key)||0)+1);
     try{
      const valid=importSceneDecisions(model,{...previous,decisions:[entry]}).decisions[0];
      if(model.groups.find(group=>group.id===valid.group_id)?.snapshot===valid.snapshot)prior.push(valid);
     }catch{ /* The exact rejected entry remains in private history. */ }
    }
    prior=prior.filter(entry=>counts.get(entry.group_id+'|'+entry.domain)===1);
    staleLedger=prior.length!==previous.decisions.length;
   }catch{staleLedger=true;}
   if(staleLedger)warnings.push('Poprzednie decyzje zachowano w prywatnej historii. Dołączono wyłącznie poprawne wpisy aktualnego wydania i zestawu.');
   const incoming=new Set(decisions.decisions.map(d=>d.group_id+'|'+d.domain));
   decisions.decisions=[...prior.filter(d=>!incoming.has(d.group_id+'|'+d.domain)),...decisions.decisions];
  }
 }
 const presentation={model,title:review.title||manifest.adventure_id,media:mediaForReview(rawMedia),decisions,warnings};
 const htmlContent=renderSceneReview(presentation);
 // Preflight all inputs and decisions above before any output or ledger write.
 if(historyPath){
  fs.mkdirSync(path.dirname(historyPath),{recursive:true,mode:0o700});
  if(!fs.existsSync(historyPath))fs.writeFileSync(historyPath,previousBytes,{mode:0o600,flag:'wx'});
  fs.chmodSync(historyPath,0o600);
 }
 fs.mkdirSync(output,{recursive:true,mode:0o700});
 fs.writeFileSync(html,htmlContent,{mode:0o600});fs.writeFileSync(json,JSON.stringify(presentation,null,2)+'\n',{mode:0o600});
 if(saveDecisions){fs.mkdirSync(path.dirname(canonicalLedger),{recursive:true,mode:0o700});fs.writeFileSync(canonicalLedger,exportSceneDecisions(model,decisions),{mode:0o600});fs.chmodSync(canonicalLedger,0o600);}
 return {html,json,model,decisions_saved:saveDecisions,stale_ledger:staleLedger,...(historyPath?{history:historyPath}:{})};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);const directory=args.shift();if(!directory)throw Error('Usage: review-scenes.mjs <private-authoring-directory> [--out directory] [--decisions file] [--save-decisions]');
 const options={directory};for(let i=0;i<args.length;i++){
  if(args[i]==='--out')options.output=args[++i];else if(args[i]==='--decisions')options.decisionsPath=args[++i];else if(args[i]==='--save-decisions')options.saveDecisions=true;else throw Error('Unknown argument: '+args[i]);
 }
 const result=await writeSceneReview(options);console.log(JSON.stringify({html:result.html,coverage:result.model.coverage,decisions_saved:result.decisions_saved},null,2));
}
