import fs from 'node:fs';
import path from 'node:path';
import { require, root, runtime, sha, loadAuditCore } from './audit-read.mjs';
// Only explicit machine-readable descriptors are checked. Never infer visual facts from pixels/prose.
export async function auditMedia(directory,input,hashes={}){
 const readMediaFile=(file,encoding)=>{const bytes=fs.readFileSync(file);hashes[file]=sha(bytes);return encoding?bytes.toString(encoding):bytes;};
 const out=[]; const sharp=require('sharp');
 const emit=(code,status,file,field,ids,expected,actual,impact,fix)=>out.push({code,status,file,field,ids,expected,actual,impact,recommendation:fix,group:'media',required:true,severity:status==='discrepancy'?'error':status==='unverifiable'?'warning':'info',scope:'dossier',evidenceType:'data',evidence:[`${file}#${field}`]});
 const assets=[...(Array.isArray(input.supplement?.assets)?input.supplement.assets:[])];
 let explicitEmptyInventory=false;
 const privateInventory=path.join(directory,'preparation/media-inventory.json');
 if(fs.existsSync(privateInventory)) {
  const relative='preparation/media-inventory.json';
  try {
   const inventory=JSON.parse(readMediaFile(privateInventory,'utf8'));
   if(inventory.schema_version!==1||!Array.isArray(inventory.excluded_assets)||!Array.isArray(inventory.approved_assets))throw Error('Invalid private media inventory');
   explicitEmptyInventory=inventory.approved_assets.length===0&&typeof inventory.empty_reason==='string'&&inventory.empty_reason.trim().length>0;
   assets.push(...inventory.approved_assets.map((a,i)=>({...a,source_file:relative,source_field:`approved_assets[${i}]`})));
   for(const [i,a] of inventory.excluded_assets.entries()) {
    let retained=false;
    try { const real=fs.realpathSync(path.resolve(directory,String(a.path)));retained=real.startsWith(root+path.sep)&&sha(readMediaFile(real))===a.sha256; } catch { /* Missing copy is an explicit discrepancy below. */ }
    const safe=retained&&a.active===false&&a.approval==='rejected'&&typeof a.reason==='string'&&a.reason.trim().length>0;
    emit('MEDIA_EXCLUSION',safe?'checked':'discrepancy',relative,`excluded_assets[${i}]`,[String(a.id)],'retained hash, explicit rejection and inactive state',{retained,active:a.active,approval:a.approval,reason:a.reason},'Odrzucony materiał pozostaje poza grą.','Zachowaj kopię i uzasadnienie; nie aktywuj odrzuconego materiału.');
   }
  } catch(e) { emit('MEDIA_INVENTORY_READ','discrepancy',relative,'$',[],'readable private inventory',String(e),'Nie można sprawdzić wykazu.','Popraw wykaz.'); }
 }
 const adventureId=input.manifest?.adventure_id;
 if(typeof adventureId==='string'&&/^[a-z0-9-]+$/.test(adventureId)){
  const inventoryPath=path.join(root,'docs/adventure-dossiers/quarantine',adventureId,'inventory.json');
  let quarantine=[];
  if(fs.existsSync(inventoryPath)){
   try{quarantine=JSON.parse(readMediaFile(inventoryPath,'utf8'));if(!Array.isArray(quarantine))throw Error('expected array');
    for(const [i,q] of quarantine.entries()){
     const original=path.resolve(root,q.public_original_path||'');
     const retained=path.resolve(path.dirname(inventoryPath),q.file||'');
     const valid=retained.startsWith(path.dirname(inventoryPath)+path.sep)&&fs.existsSync(retained)&&sha(readMediaFile(retained))===q.sha256;
     emit('QUARANTINE_COPY',valid?'checked':'discrepancy',path.relative(directory,inventoryPath),`[${i}].sha256`,[q.id],'retained hash matches',valid,'Kwarantanna musi zachować wiarygodną kopię.','Sprawdź inwentarz i plik.');
     const absent=original.startsWith(root+path.sep)&&!fs.existsSync(original);
     emit('QUARANTINE_PUBLIC',absent?'checked':'discrepancy',path.relative(directory,inventoryPath),`[${i}].public_original_path`,[q.id],'public copy absent',absent,'Materiał odrzucony nie powinien być dostępny dla gracza.','Wyłącz wskazaną publiczną kopię.');
    }
   }catch(e){emit('QUARANTINE_READ','discrepancy',path.relative(directory,inventoryPath),'$',[], 'readable inventory',String(e),'Nie można sprawdzić kwarantanny.','Popraw inwentarz.');quarantine=[];}
  }
  const manifestPath=path.join(runtime,'public/adventure-packs',adventureId,'manifest.json');
  if(!fs.existsSync(manifestPath)){
   const packDirectory=path.dirname(manifestPath);
   const inactive=explicitEmptyInventory&&assets.length===0&&(!fs.existsSync(packDirectory)||fs.readdirSync(packDirectory).length===0);
   emit('MEDIA_RUNTIME_MANIFEST',inactive?'not_applicable':'unverifiable',path.relative(directory,manifestPath),'$',[],
    inactive?'no approved media and no runtime pack':'runtime visual pack manifest',null,
    inactive?'Nie ma zatwierdzonych grafik ani aktywnego katalogu pakietu; odrzucone pliki są osobno sprawdzone w kwarantannie.':'Brak manifestu przy możliwych aktywnych plikach wizualnych.',
    inactive?'Brak działania do podłączenia.':'Uzupełnij zatwierdzony pakiet w istniejącym formacie.');
  }
  else try{
   const manifest=JSON.parse(readMediaFile(manifestPath,'utf8'));
   if(!Array.isArray(manifest.assets))throw Error('assets must be an array');
   const {computeNameHash,resolveAdventureAsset}=loadAuditCore();
   for(const [i,a] of manifest.assets.entries()){
    const actorMatches=(input.actors||[]).filter(x=>Array.isArray(a.nameHashes)&&a.nameHashes.includes(computeNameHash(String(x.label||''))));
    const entity=a.nodeId||a.clueId||(actorMatches.length===1?actorMatches[0].id:undefined);
    const file=path.resolve(path.dirname(manifestPath),String(a.file||''));
    const digest=file.startsWith(path.dirname(manifestPath)+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()?sha(readMediaFile(file)):null;
    const quarantined=quarantine.some(q=>q.sha256===digest||path.resolve(root,q.public_original_path||'')===file);
    assets.push({...a,path:path.relative(directory,file),entity_id:entity,active:true,quarantine:quarantined,source_file:path.relative(directory,manifestPath),source_field:`assets[${i}]`});
    const resolved=resolveAdventureAsset({slugOrQuery:a.id,manifest});
    emit('MEDIA_RESOLVER',resolved.matchedAsset?.id===a.id?'checked':'discrepancy',path.relative(directory,manifestPath),`assets[${i}].id`,[a.id],'same asset returned by existing resolver',resolved.matchedAsset?.id||null,'Niejednoznaczne dopasowanie zasobu.','Popraw identyfikatory manifestu.');
   }
  }catch(e){emit('MEDIA_MANIFEST_READ','discrepancy',path.relative(directory,manifestPath),'$',[],'readable manifest',String(e),'Nie można sprawdzić aktywnych grafik.','Popraw manifest.');}
 }
 if(!assets.length)emit('MEDIA_INVENTORY',explicitEmptyInventory?'not_applicable':'unverifiable',
  explicitEmptyInventory?'preparation/media-inventory.json':'preparation/playbook.json',explicitEmptyInventory?'approved_assets':'assets',[],
  explicitEmptyInventory?'explicit empty inventory with reason':'structured approved media inventory',
  explicitEmptyInventory?{approved_assets:0,reason:'declared'}:null,
  explicitEmptyInventory?'Nie ma zatwierdzonych mediów do przypisania; audyt osobno kontroluje odrzucone kopie i brak publicznej ekspozycji.':'Brak weryfikowalnego powiązania plików z kartami.',
  explicitEmptyInventory?'Dodaj media dopiero po inspekcji i zatwierdzeniu.':'Uzupełnij istniejący wykaz zasobów i wiązania.');
 const entities=new Set((Array.isArray(input.graph?.nodes)?input.graph.nodes:[]).map(n=>n.id));
 for(const [i,a]of assets.entries()){
  if(!a||typeof a!=='object'){emit('MEDIA_DESCRIPTOR','discrepancy','preparation/playbook.json',`assets[${i}]`,[],'object',a,'Nieczytelna definicja.','Popraw rekord.');continue;}
  const field=a.source_field||`assets[${i}]`, sourceFile=a.source_file||'preparation/playbook.json', ids=[String(a.id||'')];
  const check=(ok,code,key,expected,actual)=>emit(code,ok?'checked':'discrepancy',sourceFile,`${field}.${key}`,ids,expected,actual,'Zasób może być niedostępny lub niespójny.','Popraw przypisanie lub dane zasobu.');
  check(entities.has(a.entity_id),'MEDIA_ENTITY','entity_id','existing entity',a.entity_id);
  check(!a.active||(!a.quarantine&&!String(a.path).includes('quarantine')),'MEDIA_QUARANTINE','active','approved and not quarantined when active',{active:a.active,approval:a.approval,quarantine:a.quarantine});
  emit('MEDIA_APPROVAL',!a.active?'not_applicable':a.approval==='approved'?'checked':a.approval==='pending'?'discrepancy':'unverifiable',sourceFile,field+'.approval',ids,'approved active material',a.approval||null,'Format pakietu nie stanowi dowodu akceptacji.','Powiąż zasób z odbiorem autora.');
  if(typeof a.path!=='string'){check(false,'MEDIA_FILE','path','local file',a.path);continue;}
  const file=path.resolve(directory,a.path);
  try{
   const real=fs.realpathSync(file); if(!real.startsWith(root+path.sep))throw Error('Media path outside repository');
   if(!fs.statSync(real).isFile())throw Error('not a file');
   check(true,'MEDIA_FILE','path','existing file',a.path);
   if(/\.(png|jpe?g|webp|avif)$/i.test(real)){
    const meta=await sharp(real).metadata();
    if(a.width&&a.height)check(meta.width===a.width&&meta.height===a.height,'MEDIA_DIMENSIONS','width/height',[a.width,a.height],[meta.width,meta.height]);
    else emit('MEDIA_DIMENSIONS','unverifiable','preparation/playbook.json',field,ids,'expected width/height',[meta.width,meta.height],'Nie określono rozmiaru docelowego.','Powiąż rozmiary z profilem wizualnym.');
   }
  }catch(e){check(false,'MEDIA_FILE','path','readable local media',String(e));}
  const actor=(Array.isArray(input.actors)?input.actors:[]).find(x=>x.id===a.entity_id);
  for(const [key,value]of Object.entries(a.continuity||{})){
   const expected=actor?.fields?.[key]?.value;
   if(expected===undefined)emit('MEDIA_CONTINUITY','unverifiable','preparation/playbook.json',`${field}.continuity.${key}`,ids,'explicit actor fact',value,'Brak jawnego punktu odniesienia.','Odbierz cechę autorsko.');
   else check(JSON.stringify(expected)===JSON.stringify(value),'MEDIA_CONTINUITY',`continuity.${key}`,expected,value);
  }
  emit('MEDIA_PIXEL_SEMANTICS','unverifiable','preparation/playbook.json',field,ids,'human visual review','not inferred','Zgodność opisu z pikselami wymaga oceny.','Obejrzyj obraz w odbiorze autorskim.');
 }
 return out;
}
