#!/usr/bin/env node
// Local-only launcher. Credentials stay in server memory; private rules stay ignored.
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,join,basename} from 'node:path';
import {existsSync,mkdirSync,cpSync,readFileSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const runtime=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const showcaseHome=process.env.ZEW_SHOWCASE_HOME||join(runtime,'.local-playtest/showcase');
const privateHome=process.env.ZEW_SHOWCASE_PRIVATE_ROOT||join(runtime,'.local-playtest/prabuty');
const base=join(showcaseHome,'runtime');
const showcasePort=Number(process.env.ZEW_SHOWCASE_PORT||3818);
if(!Number.isInteger(showcasePort)||showcasePort<1024||showcasePort>65535)throw Error('Nieprawidłowy port pokazu.');
const origin='http://127.0.0.1:'+showcasePort;
const url=origin+'/pl';
const adventureIds=['cien-nad-prabutami','englewood-murder-castle-1893'];
let connected=false;
try {
 const response=await fetch(origin+'/api/adventure-dossier/playtest',{signal:AbortSignal.timeout(2000)});
 connected=true;
 const body=await response.json();
 if(!response.ok||body.mode!=='local_playtest'||body.adventureId!=='cien-nad-prabutami'||!/^sha256:[a-f0-9]{64}$/.test(body.editionFingerprint))
  throw Error('Nieprawidłowa wersja pilota.');
 for(const id of adventureIds){
  const edition=await fetch(origin+'/api/adventure-dossier/playtest?adventureId='+id,{signal:AbortSignal.timeout(5000)});
  const value=await edition.json();
  if(!edition.ok||value.adventureId!==id||value.payload?.adventure_id!==id)throw Error('Brak gotowej przygody: '+id);
 }
 const buildId=readFileSync(join(runtime,'.next/BUILD_ID'),'utf8').trim();
 const manifestPath='/_next/static/'+buildId+'/_buildManifest.js';
 const manifest=await fetch(origin+''+manifestPath,{signal:AbortSignal.timeout(5000)});
 const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 if(!manifest.ok||sha(Buffer.from(await manifest.arrayBuffer()))!==sha(readFileSync(join(runtime,'.next/static',buildId,'_buildManifest.js'))))throw Error('Inny build na porcie pokazu.');
 const [rulesResponse,ttsResponse]=await Promise.all([
  fetch(origin+'/api/pdf/ingest-local?type=rules',{signal:AbortSignal.timeout(5000)}),
  fetch(origin+'/api/tts/gemini?languageCode=pl-PL',{signal:AbortSignal.timeout(5000)}),
 ]);
 const [rules,tts]=await Promise.all([rulesResponse.json(),ttsResponse.json()]);
 if(!rulesResponse.ok||rules.hasBaseRules!==true||!ttsResponse.ok||tts.provider!=='macos-zosia'||tts.voice!=='Zosia')
  throw Error('Nieprawidłowa konfiguracja zasad lub lokalnego lektora.');
 console.log('Pokaz PL/EN jest uruchomiony: '+url);process.exit(0);
} catch(error) {
 if(connected)throw Error(`Port ${showcasePort} obsługuje niezgodny lub niegotowy pilot. Zakończ go przed uruchomieniem tej wersji.`);
}
if(!existsSync(join(runtime,'.next/BUILD_ID')))throw Error('Najpierw wykonaj npm run build w katalogu aplikacji.');
// The player configures BYOK in app settings; there is no separate server-key requirement.
const rag=join(base,'rag'),seed=join(privateHome,'rules-seed');
mkdirSync(rag,{recursive:true});
if(!existsSync(join(rag,'rules.bin'))){
 if(!existsSync(join(seed,'rules.bin')))throw Error('Brak lokalnego, prywatnego indeksu zasad do próby.');
 cpSync(seed,rag,{recursive:true,errorOnExist:true,force:false});
 const capabilityFile=join(rag,'capabilities.json');
 const capabilities=JSON.parse(readFileSync(capabilityFile,'utf8'));
 for(const overlay of capabilities.installedOverlays??[]){
  if(overlay.overlayPath)overlay.overlayPath=join(rag,'overlays',basename(overlay.overlayPath));
 }
 writeFileSync(capabilityFile,JSON.stringify(capabilities));
}
const showcaseEnv={...process.env};
delete showcaseEnv.GEMINI_API_KEY;
delete showcaseEnv.GOOGLE_API_KEY;
delete showcaseEnv.ZEW_UPDATE_MANIFEST_URL;
const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(showcasePort)],{
 cwd:runtime,stdio:'inherit',env:{...showcaseEnv,STRAZNIK_DESKTOP_UPDATE:'1',ZEW_LOCAL_PLAYTEST:'showcase-pl-en',ZEW_LOCAL_TTS:'macos',
 ZEW_DATA_DIR:join(base,'data'),RAG_DATA_DIR:rag,TTS_CACHE_DIR:join(base,'tts'),NEXT_TELEMETRY_DISABLED:'1'},
});
console.log('Uruchamiam pokaz PL/EN: '+url);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code??1));
