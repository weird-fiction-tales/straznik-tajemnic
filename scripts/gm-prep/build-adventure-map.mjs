#!/usr/bin/env node
/** Prepare a private, portable author map without changing adventure or approvals. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildAdventureMap} from './adventure-map-model.mjs';
import {renderAdventureMap} from './adventure-map-render.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const runtime=path.join(root,'_tester/_base/.silnik');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function privateOutput(target){
 const absolute=path.resolve(target);
 if(absolute.split(path.sep).includes('public'))throw Error('Author maps cannot be public');
 let p=absolute;while(p!==path.dirname(p)){if(fs.existsSync(p)&&fs.lstatSync(p).isSymbolicLink())throw Error('Author output cannot contain symlinks');p=path.dirname(p);}
 return absolute;
}
export function writeAdventureMap({sourceFile,authoringDirectory,openingDirectory,outputDirectory}){
 const output=privateOutput(outputDirectory);
 const allowed=path.join(runtime,'test-results/two-quicksetup/adventure-map');
 if(output!==allowed&&!output.startsWith(allowed+path.sep))throw Error('Map output must stay in private adventure-map directory');
 for(const name of ['assets','index.html','model.json','provenance.json'])privateOutput(path.join(output,name));
 const source=read(sourceFile),readOptional=(name,fallback)=>fs.existsSync(name)?read(name):fallback;
 const records=authoringDirectory?readOptional(path.join(authoringDirectory,'payload.json'),{}).records||[]:[];
 const review=authoringDirectory?readOptional(path.join(authoringDirectory,'preparation/review-data.json'),{}):{};
 const media=authoringDirectory?readOptional(path.join(authoringDirectory,'preparation/media-manifest.json'),{}):{};
 const opening=openingDirectory?readOptional(path.join(openingDirectory,'story.json'),undefined):undefined;
 const model=buildAdventureMap({source,records,review,media,opening});
 const pending=new Map(),assets=[];
 for(const node of model.nodes){
  if(!node.media?.url)continue;
  const original=node.media.url,fromOpening=original.startsWith('opening:')||node.media.origin==='opening';
  const relative=fromOpening?original.replace(/^opening:/,''):original.replace(/^\//,'');
  const base=fromOpening?openingDirectory&&path.join(openingDirectory,'assets'):path.join(runtime,'public');
  if(!base)throw Error('Opening media has no opening directory');
  const candidate=path.resolve(base,relative),safe=candidate.startsWith(path.resolve(base)+path.sep)&&!relative.includes('\\');
  const ext=path.extname(candidate).toLowerCase();
  if(!safe||!['.png','.jpg','.jpeg','.webp','.mp3','.wav','.ogg','.m4a'].includes(ext))throw Error('Invalid local media reference: '+original);
  if(!fs.existsSync(candidate)||!fs.statSync(candidate).isFile()){
   node.status='missing';node.media.url=null;
   node.details.push({label:'Plik',value:'Nie znaleziono lokalnego pliku: '+original});
   model.gaps.push('Brak pliku: '+original);continue;
  }
  const realBase=fs.realpathSync(base),realFile=fs.realpathSync(candidate);
  if(!realFile.startsWith(realBase+path.sep))throw Error('Media symlink escapes its source directory: '+original);
  const bytes=fs.readFileSync(realFile),digest=sha(bytes);
  const filename=digest.slice(0,12)+'-'+path.basename(candidate);
  const destination=privateOutput(path.join(output,'assets',filename));
  if(fs.existsSync(destination)&&sha(fs.readFileSync(destination))!==digest)throw Error('Refuse overwrite of edited map asset: '+filename);
  pending.set(destination,bytes);
  node.media.url='assets/'+filename;
  if(node.status!=='preview')node.status='present';
  if(digest==='9cf7ae58df1400ffbb918e18e7e4c918c6f144fdee90e2b9da15c84191475bd6'){
   node.status='draft';
   node.details.push({label:'Kontrola obrazu',value:'Obejrzany plik to schematyczna plansza zastępcza. Docelowa fotografia do początku jest dostępna osobno w adaptacji Tomasza.'});
   model.gaps.push('Źródłowy handout fotografii nadal używa planszy zastępczej; nowy obraz istnieje w adaptacji początku.');
  }
  assets.push({node_id:node.id,original,source:path.relative(root,candidate),file:node.media.url,sha256:digest});
 }
 model.gaps=[...new Set(model.gaps)];
 const html=renderAdventureMap({model});
 const receipt={schema_version:1,source:path.relative(root,sourceFile),source_sha256:sha(fs.readFileSync(sourceFile)),records:records.length,assets,publication:false,author_approval:false};
 fs.mkdirSync(path.join(output,'assets'),{recursive:true,mode:0o700});
 for(const [file,bytes]of pending)if(!fs.existsSync(file))fs.writeFileSync(file,bytes,{mode:0o600,flag:'wx'});
 fs.writeFileSync(path.join(output,'index.html'),html,{mode:0o600});
 fs.writeFileSync(path.join(output,'model.json'),JSON.stringify(model,null,2)+'\n',{mode:0o600});
 fs.writeFileSync(path.join(output,'provenance.json'),JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
 return {html:path.join(output,'index.html'),nodes:model.nodes.length,edges:model.edges.length,assets:pending.size,summary:model.summary,gaps:model.gaps};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const id='cien-nad-prabutami',base=path.join(runtime,'test-results/two-quicksetup');
 const result=writeAdventureMap({sourceFile:path.join(root,'data/adventures/predefined',id+'.json'),authoringDirectory:path.join(base,'authoring',id),openingDirectory:path.join(base,'player-opening/prabuty-tomasz'),outputDirectory:process.argv[2]||path.join(base,'adventure-map/prabuty')});
 console.log(JSON.stringify(result,null,2));
}
