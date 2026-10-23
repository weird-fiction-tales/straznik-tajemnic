#!/usr/bin/env node
// Frozen local showcase. User data and BYOK stay outside the application bundle.
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,join} from 'node:path';
import {mkdirSync,readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {homedir} from 'node:os';
const require=createRequire(import.meta.url);
const runtime=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const dataRoot=process.env.ZEW_DATA_DIR||join(homedir(),'Library/Application Support/ZewCthulhu');
const showcasePort=Number(process.env.ZEW_SHOWCASE_PORT||4050);
if(!Number.isInteger(showcasePort)||showcasePort<1024||showcasePort>65535)throw Error('Nieprawidłowy port pokazu.');
const origin='http://127.0.0.1:'+showcasePort;
const adventureIds=['cien-nad-prabutami','englewood-murder-castle-1893'];
const buildId=readFileSync(join(runtime,'.next/BUILD_ID'),'utf8').trim();
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifestPath='/_next/static/'+buildId+'/_buildManifest.js';
async function verifyReady(){
 const manifest=await fetch(origin+manifestPath,{signal:AbortSignal.timeout(3000)});
 if(!manifest.ok||sha(Buffer.from(await manifest.arrayBuffer()))!==sha(readFileSync(join(runtime,'.next/static',buildId,'_buildManifest.js'))))throw Error('Inny build na porcie pokazu.');
 for(const id of adventureIds){
  const response=await fetch(origin+'/api/adventure-dossier/playtest?adventureId='+id,{signal:AbortSignal.timeout(5000)});
  const value=await response.json();
  if(!response.ok||value.mode!=='local_playtest'||value.adventureId!==id||value.payload?.adventure_id!==id)throw Error('Brak gotowej teczki: '+id);
 }
 const response=await fetch(origin+'/api/desktop/update/check',{signal:AbortSignal.timeout(3000)});
 const update=await response.json();
 if(!response.ok||update.available!==false||update.canSelfUpdate!==false||update.configured!==false||!update.currentVersion?.includes('showcase'))throw Error('Brak ochrony wersji pokazowej.');
}
if(process.argv.includes('--check')){
 try{await verifyReady();process.exit(0);}catch{process.exit(1);}
}
let connected=false;
try{
 const response=await fetch(origin+manifestPath,{signal:AbortSignal.timeout(2000)});
 connected=true;
 await response.body?.cancel();
 await verifyReady();
 console.log('Pokaz PL/EN już działa: '+origin+'/pl');
 process.exit(0);
}catch{
 if(connected)throw Error('Port '+showcasePort+' obsługuje inną wersję gry. Zamknij ją przed uruchomieniem pokazu.');
}
const rag=process.env.RAG_DATA_DIR||join(dataRoot,'rag');
mkdirSync(rag,{recursive:true});
const showcaseEnv={...process.env};
delete showcaseEnv.GEMINI_API_KEY;
delete showcaseEnv.GOOGLE_API_KEY;
delete showcaseEnv.ZEW_UPDATE_MANIFEST_URL;
const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(showcasePort)],{
 cwd:runtime,stdio:'inherit',env:{...showcaseEnv,STRAZNIK_DESKTOP_UPDATE:'1',
 ZEW_DESKTOP_SHOWCASE:'1',ZEW_DESKTOP_SELF_UPDATE:'0',ZEW_LOCAL_PLAYTEST:'showcase-pl-en',
 ZEW_DISABLE_GIT_FALLBACK:'1',ZEW_DATA_DIR:dataRoot,RAG_DATA_DIR:rag,ZEW_APP_PORT:String(showcasePort),
 NEXT_TELEMETRY_DISABLED:'1'},
});
console.log('Uruchamiam pokaz PL/EN: '+origin+'/pl');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('error',error=>{console.error(error.message);process.exit(1);});
child.on('exit',code=>process.exit(code??1));
