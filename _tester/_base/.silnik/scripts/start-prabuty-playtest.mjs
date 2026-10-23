#!/usr/bin/env node
// Local-only launcher. Credentials stay in server memory; private rules stay ignored.
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,join,basename} from 'node:path';
import {existsSync,mkdirSync,cpSync,readFileSync,writeFileSync,statSync} from 'node:fs';
import {spawn} from 'node:child_process';
const require=createRequire(import.meta.url);
const runtime=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const base=join(runtime,'.local-playtest/prabuty/runtime');
const url='http://127.0.0.1:3818/pl';
const expectedFingerprint='sha256:d925f9637d13f977ccdb337c5e150ea7f3905a0e3fe0620228b1e5724fd952f8';
let connected=false;
try {
 const response=await fetch('http://127.0.0.1:3818/api/adventure-dossier/playtest',{signal:AbortSignal.timeout(2000)});
 connected=true;
 const body=await response.json();
 if(!response.ok||body.mode!=='local_playtest'||body.adventureId!=='cien-nad-prabutami'||body.editionFingerprint!==expectedFingerprint)
  throw Error('Nieprawidłowa wersja pilota.');
 const [rulesResponse,ttsResponse]=await Promise.all([
  fetch('http://127.0.0.1:3818/api/pdf/ingest-local?type=rules',{signal:AbortSignal.timeout(5000)}),
  fetch('http://127.0.0.1:3818/api/tts/gemini?languageCode=pl-PL',{signal:AbortSignal.timeout(5000)}),
 ]);
 const [rules,tts]=await Promise.all([rulesResponse.json(),ttsResponse.json()]);
 if(!rulesResponse.ok||rules.hasBaseRules!==true||!ttsResponse.ok||tts.provider!=='macos-zosia'||tts.voice!=='Zosia')
  throw Error('Nieprawidłowa konfiguracja zasad lub lokalnego lektora.');
 console.log('Prabuty są uruchomione: '+url);process.exit(0);
} catch(error) {
 if(connected)throw Error('Port 3818 obsługuje niezgodny lub niegotowy pilot. Zakończ go przed uruchomieniem tej wersji.');
}
if(!existsSync(join(runtime,'.next/BUILD_ID')))throw Error('Najpierw wykonaj npm run build w katalogu aplikacji.');
let apiKey=process.env.GEMINI_API_KEY?.trim()||process.env.GOOGLE_API_KEY?.trim();
if(!apiKey){
 const credentialFile=join(runtime,'.local-playtest/prabuty/server-credentials.json');
 if(existsSync(credentialFile)){
  if((statSync(credentialFile).mode&0o777)!==0o600)throw Error('Prywatny plik klucza serwera wymaga uprawnień 0600.');
  let credentials;
  try{credentials=JSON.parse(readFileSync(credentialFile,'utf8'));}catch{throw Error('Nie można odczytać prywatnego pliku klucza serwera.');}
  if(!credentials||typeof credentials!=='object'||Array.isArray(credentials)||Object.keys(credentials).some(key=>key!=='geminiApiKey')||
    typeof credentials.geminiApiKey!=='string'||!credentials.geminiApiKey.trim())throw Error('Nieprawidłowy prywatny plik klucza serwera. Wymagane pole geminiApiKey.');
  apiKey=credentials.geminiApiKey.trim();
 }
}
if(!apiKey){
 const {loadEnvConfig}=require('@next/env');
 const mainRuntime=resolve(runtime,'../../../../../_tester/_base/.silnik');
 const config=loadEnvConfig(mainRuntime,false,{info(){},error(){}});
 apiKey=config.combinedEnv.GEMINI_API_KEY||config.combinedEnv.GOOGLE_API_KEY;
}
if(!apiKey)throw Error('Brak klucza serwerowego. Skonfiguruj prywatny plik .local-playtest/prabuty/server-credentials.json (0600) lub lokalne GEMINI_API_KEY. Klucza nie wpisuj w przeglądarce.');
const rag=join(base,'rag'),seed=join(runtime,'.local-playtest/prabuty/rules-seed');
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
const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3818'],{
 cwd:runtime,stdio:'inherit',env:{...process.env,GEMINI_API_KEY:apiKey,ZEW_LOCAL_PLAYTEST:'prabuty-tomasz',ZEW_LOCAL_TTS:'macos',
 ZEW_DATA_DIR:join(base,'data'),RAG_DATA_DIR:rag,TTS_CACHE_DIR:join(base,'tts'),NEXT_TELEMETRY_DISABLED:'1'},
});
console.log('Uruchamiam Prabuty: '+url);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code??1));
