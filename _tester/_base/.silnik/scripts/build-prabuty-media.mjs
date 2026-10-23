import { chromium } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const props = [
 { file:'klin-report-text-reference.png', label:'Meldunek Departamentu IV', title:'Kryptonim KLIN', lines:[
  'Ministerstwo Spraw Wewnętrznych · Departament IV · 1973',
  'Meldunek dotyczy obserwacji franciszkanina z Elbląga i anomalii elektromagnetycznych w jego celi klasztornej.',
 ]},
 { file:'recipe-152-text-reference.png', label:'Rękopis receptury', title:'Receptura nr 152', lines:[
  'Zapis proporcji ziół z dopiskiem:',
  '„Pić przed snem, by uciszyć głosy czwartego wymiaru”.',
 ]},
 { file:'tape-zk140-text-reference.png', label:'Meldunek z obserwacji', title:'Taśma ZK-140', lines:[
  'Meldunek oficera z 12 października 1973 roku opisuje szept modlitewny, pisk aparatury, skok pola elektromagnetycznego i drżenie szyb.',
  'Oficer twierdzi, że słyszał drugi głos; mikrofon go nie zarejestrował. To relacja oficera, a nie dowód obecności drugiej osoby.',
 ]},
];
const target=path.resolve('public/handouts/cien-nad-prabutami/playtest');
await mkdir(target,{recursive:true});
const escape=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const browser=await chromium.launch({headless:true});
const receipts=[];
try {
 const page=await browser.newPage({viewport:{width:1100,height:1400},deviceScaleFactor:1});
 for(const prop of props){
  await page.setContent(`<!doctype html><html lang="pl"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:70px;background:#2b251d;color:#30281c;font-family:Georgia,serif}article{height:1260px;padding:75px 65px;background:#e6d8b6;border:2px solid #766344;box-shadow:0 15px 30px #0009;position:relative}header{font:20px monospace;letter-spacing:3px;border-bottom:2px solid;padding-bottom:28px;text-transform:uppercase}h1{font-size:55px;line-height:1.12;margin:45px 0}p{font:27px/1.55 'Courier New',monospace;margin:25px 0}footer{position:absolute;bottom:35px;font:15px monospace;color:#77664b;letter-spacing:1px}</style><article><header>${escape(prop.label)}</header><h1>${escape(prop.title)}</h1>${prop.lines.map(line=>`<p>${escape(line)}</p>`).join('')}<footer>STRAŻNIK TAJEMNIC · FIKCYJNY REKWIZYT PRZYGODY</footer></article></html>`);
  await page.screenshot({path:path.join(target,prop.file)});
  const bytes=await readFile(path.join(target,prop.file));
  receipts.push({...prop,sha256:createHash('sha256').update(bytes).digest('hex'),provenance:'authored-game-prop',costPLN:0});
 }
} finally {await browser.close();}
await writeFile(path.join(target,'authored-props-text-reference.json'),JSON.stringify({schemaVersion:1,props:receipts},null,2));
console.log(JSON.stringify({rendered:receipts.length,costPLN:0,target,kind:'canonical-text-reference-only'}));
