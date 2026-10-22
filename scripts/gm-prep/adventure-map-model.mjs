/** Pure, complete author map. Source associations never establish runtime presence or ownership. */
const list=value=>Array.isArray(value)?value:[];
const text=value=>typeof value==='string'?value:JSON.stringify(value,null,2)??'null';
const pointerKey=value=>String(value).replaceAll('~','~0').replaceAll('/','~1');
const hasSecret=value=>!!value&&typeof value==='object'&&Object.entries(value).some(([key,child])=>/secret|truthAnchor/i.test(key)||hasSecret(child));

export function buildAdventureMap({source,records=[],review={},media={},opening}){
 if(!source||typeof source.id!=='string'||!Array.isArray(source.nodes))throw Error('Canonical adventure source required');
 const nodes=[],edges=[],gaps=[],coverage=[],byId=new Map(),pointerOwners=new Map(),mediaByUrl=new Map();
 const sourcePath='data/adventures/predefined/'+source.id+'.json';
 const ref=pointer=>sourcePath+'#'+pointer;
 const fields=value=>Object.entries(value||{}).filter(([key])=>key!=='secret').map(([label,value])=>({label,value:text(value)}));
 function addNode(node){
  if(typeof node.id!=='string'||!node.id||byId.has(node.id))throw Error('Missing or duplicate map node id');
  const result={description:'',status:'draft',details:[],source_refs:[],scene_ids:[],record_ids:[],...node};
  nodes.push(result);byId.set(result.id,result);return result;
 }
 function connect(from,to,label,type='reference',condition){
  if(!byId.has(from)||!byId.has(to)){gaps.push('Brak końca relacji: '+from+' -> '+to);return;}
  edges.push({id:'edge-'+edges.length,source:from,target:to,label,type,...(condition!==undefined?{condition:text(condition)}:{})});
 }
 function cover(pointer,node){
  coverage.push({pointer,node_id:node.id});pointerOwners.set(pointer,node.id);
  if(!node.source_refs.includes(ref(pointer)))node.source_refs.push(ref(pointer));
 }
 const overview=addNode({id:'rule:overview',type:'rule',label:source.title||source.id,description:'Dane źródłowe przygody. Mapa jest opracowaniem roboczym.'});
 function addSecret(id,label,value,pointer,parent){
  const node=addNode({id,type:'secret',label,description:'Wiedza MG - nieujawniona automatycznie graczom.',details:fields({value})});
  cover(pointer,node);if(parent)connect(parent.id,node.id,'Wiedza MG w źródle');return node;
 }
 function sourceEntity(value,type,pointer){
  const node=addNode({id:value.id,type,label:value.name||value.title||value.id,description:value.description||value.atmosphere||'',details:fields(value)});
  cover(pointer,node);
  if(Object.hasOwn(value,'secret'))addSecret('secret:'+value.id,'Wiedza MG: '+node.label,value.secret,pointer+'/secret',node);
  return node;
 }
 for(const [key,collection,type] of [['nodes',source.nodes,'scene'],['locations',source.locations,'location'],['npcs',source.npcs,'character'],['clues',source.clues,'clue']]){
  list(collection).forEach((value,index)=>sourceEntity(value,type,'/'+key+'/'+index));
  if(Array.isArray(collection)&&!collection.length)cover('/'+key,overview);
 }
 const scenes=list(source.nodes),first=scenes.find(n=>n.id===source.activeNodeId)||scenes.find(n=>n.type==='intro')||scenes[0];
 const start=first?.id||overview.id;
 for(const scene of scenes){
  const node=byId.get(scene.id);node.scene_ids=[scene.id];
  if(scene.locationId){
   connect(scene.id,scene.locationId,'Miejsce sytuacji wskazane w źródle','contains');
   const location=byId.get(scene.locationId);if(location&&!location.scene_ids.includes(scene.id))location.scene_ids.push(scene.id);
  }
  for(const id of new Set(list(scene.npcIds))){
   connect(scene.id,id,'Postać wymieniona w źródle; obecność zależy od gry','appears');
   const actor=byId.get(id);if(actor&&!actor.scene_ids.includes(scene.id))actor.scene_ids.push(scene.id);
  }
  for(const id of new Set([...list(scene.availableClues),...list(scene.leadInClueIds),...list(scene.leadOutClueIds)])){
   connect(scene.id,id,'Powiązanie tropu w źródle; nie automatyczne odkrycie','contains');
   const clue=byId.get(id);if(clue&&!clue.scene_ids.includes(scene.id))clue.scene_ids.push(scene.id);
  }
 }
 list(source.clues).forEach(clue=>{
  if(clue.targetNodeId)connect(clue.id,clue.targetNodeId,'Trop wskazuje tę sytuację w źródle');
 });
 list(source.connections).forEach((connection,index)=>{
  const owner=byId.get(connection.fromId)||overview;
  owner.details.push({label:'Połączenie źródłowe '+index,value:text(connection)});cover('/connections/'+index,owner);
  connect(connection.fromId,connection.toId,connection.description||'Połączenie źródłowe','route',connection.condition);
  if(connection.clueId)connect(connection.clueId,connection.toId,'Trop powiązany z przejściem w źródle');
 });
 if(Array.isArray(source.connections)&&!source.connections.length)cover('/connections',overview);
 function mediaNode(url,kind,label,pointer,origin='source',metadata={}){
  if(typeof url!=='string'||!url)return null;
  let node=mediaByUrl.get(url);
  if(!node){
   node=addNode({id:'media:'+mediaByUrl.size,type:'media',label:label||url,description:'Istniejący materiał lub wskazanie pliku; jakość i moment ujawnienia wymagają sprawdzenia.',
    status:origin==='opening'?'preview':'draft',media:{kind,url,origin,caption:label||url}});
   mediaByUrl.set(url,node);
  }
  if(origin==='source')cover(pointer,node);
  else if(!node.source_refs.includes(pointer))node.source_refs.push(pointer);
  if(Object.keys(metadata).length)node.details.push({label:origin==='opening'?'Materiał podglądu':'Inwentarz mediów',value:text(metadata)});
  return node;
 }
 list(source.handouts).forEach((handout,index)=>{
  const pointer='/handouts/'+index;
  const node=addNode({id:'handout:'+handout.slug,type:'item',is_handout:true,inventory_status:'unknown',
   label:handout.title||handout.slug,description:'Materiał fabularny; źródło nie ustala zabrania, przekazania ani zużycia.',details:fields(handout),
   scene_ids:handout.nodeId?[handout.nodeId]:[]});
  cover(pointer,node);
  if(handout.nodeId)connect(handout.nodeId,node.id,'Powiązanie źródłowe; moment ujawnienia nieustalony','media');
  for(const key of ['image','audioUrl','audioUrlPl','audioUrlEn'])if(handout[key]){
   const child=mediaNode(handout[key],key==='image'?'image':'audio',handout.title,pointer+'/'+key);
   connect(node.id,child.id,'Plik materiału wskazany w źródle','media');
   if(handout.nodeId&&!child.scene_ids.includes(handout.nodeId))child.scene_ids.push(handout.nodeId);
  }
 });
 if(Array.isArray(source.handouts)&&!source.handouts.length)cover('/handouts',overview);
 list(source.items).forEach((item,index)=>{
  const node=addNode({id:'item:'+item.id,type:'item',label:item.name||item.id,description:item.description||'Przedmiot wskazany w źródle.',inventory_status:'unknown',details:fields(item)});
  cover('/items/'+index,node);connect(overview.id,node.id,'Przedmiot źródłowy','contains');
 });
 if(Array.isArray(source.items)&&!source.items.length)cover('/items',overview);
 if(source.doomClock){
  const {stages,...clock}=source.doomClock;
  const clockNode=addNode({id:'rule:clock',type:'rule',label:'Zegar świata',description:'Źródłowe ramy czasu; mapa nie wykonuje skutków zegara.',details:fields(clock)});
  cover('/doomClock',clockNode);connect(overview.id,clockNode.id,'Zegar świata w źródle','contains');
  list(stages).forEach((stage,index)=>{
   const event=addNode({id:'event:clock:'+index,type:'event',label:stage.title||'Etap zegara '+index,description:stage.description||'',details:fields(stage)});
   cover('/doomClock/stages/'+index,event);connect(clockNode.id,event.id,'Etap zegara w źródle; nie zdarzenie już wykonane','contains');
  });
 }
 list(source.secretsPool).forEach((secret,index)=>addSecret('secret:pool:'+index,'Sekret źródłowy '+(index+1),secret,'/secretsPool/'+index,overview));
 if(Array.isArray(source.secretsPool)&&!source.secretsPool.length)cover('/secretsPool',overview);
 const handled=new Set(['nodes','locations','npcs','clues','connections','handouts','items','doomClock','secretsPool']);
 for(const [key,value] of Object.entries(source)){
  if(handled.has(key))continue;
  if(['truthAnchor','summary','boundarySummary'].includes(key)||/secret/i.test(key)||hasSecret(value))addSecret('secret:root:'+key,key,value,'/'+pointerKey(key),overview);
  else{overview.details.push({label:key,value:text(value)});cover('/'+pointerKey(key),overview);}
 }
 const mediaAssets=Array.isArray(media)?media:list(media.assets);
 for(const [index,asset] of mediaAssets.entries()){
  const url=asset.url||asset.path||asset.preview_url;
  if(!url){gaps.push('Brak URL materiału w inwentarzu: '+index);continue;}
  const kind=asset.kind==='audio'||/\.(mp3|wav|ogg)(?:$|\?)/i.test(url)?'audio':'image';
  const node=mediaNode(url,kind,asset.label||asset.handout_slug||asset.asset_id||url,'media-manifest.json#/assets/'+index,'inventory',asset);
  for(const value of list(asset.source_refs))if(!node.source_refs.includes(value))node.source_refs.push(value);
  if(asset.filesystem_status==='present'||asset.storage_status==='present')node.status='present';
  else if(node.status!=='present'&&(asset.filesystem_status==='missing'||asset.storage_status==='missing'))node.status='missing';
  if(node.status==='missing')gaps.push('Brak pliku medium: '+url);
 }
 let explicitItems=list(source.items).length,unmappedRecords=0;
 const seenRecords=new Set();
 for(const record of records){
  if(typeof record.record_id!=='string'||!record.record_id||seenRecords.has(record.record_id))throw Error('Missing or duplicate record id');
  seenRecords.add(record.record_id);
  let decoded;try{decoded=JSON.parse(record.content);}catch{decoded=null;}
  const pointer=typeof decoded?.pointer==='string'?decoded.pointer:record.evidence?.source_ref?.split('#')[1];
  const match=[...pointerOwners.keys()].filter(p=>pointer===p||pointer?.startsWith(p+'/')).sort((a,b)=>b.length-a.length)[0];
  let owner=match?byId.get(pointerOwners.get(match)):null;
  if(record.adventure_id&&record.adventure_id!==source.id)owner=null;
  const binding=record.inventory_item||record.world_object_binding;
  if(binding){
   const key=binding.entity_id||record.record_id,id='item:binding:'+key;
   let item=byId.get(id);
   if(!item){item=addNode({id,type:'item',label:binding.name||key,description:'Jawne powiązanie przedmiotu; mapa nie ustala aktualnego właściciela.',inventory_status:'unknown',details:hasSecret(binding)?[]:[{label:'Powiązania źródłowe',value:text({inventory_item:record.inventory_item,world_object_binding:record.world_object_binding})}]});explicitItems++;}
   if(owner)connect(owner.id,item.id,'Jawne powiązanie rekordu z przedmiotem');
  }
  const rawSecret=hasSecret(decoded)||hasSecret(record.inventory_item)||hasSecret(record.world_object_binding);
  const sourceSecretOwner=owner?.type==='secret';
  const sourceObjectSecret=owner&&coverage.some(c=>c.node_id===owner.id&&pointerOwners.has(c.pointer+'/secret')&&!(pointer?.startsWith(c.pointer+'/')&&pointer!==c.pointer+'/secret'));
  if(owner&&(rawSecret||sourceSecretOwner||sourceObjectSecret)){
   const secret=addNode({id:'secret:record:'+record.record_id,type:'secret',label:'Pełny rekord MG: '+record.record_id,description:'Pełne dane rekordu zawierają wiedzę MG.'});
   connect(owner.id,secret.id,'Pełny rekord z wiedzą MG');owner=secret;
  }
  if(!owner){
   owner=addNode({id:'exception:'+record.record_id,type:rawSecret?'secret':'rule',label:'Nieprzypisany rekord: '+record.record_id,
    description:'Rekord zachowany w całości; brak jednoznacznego przypisania do źródła.',exception:true});
   unmappedRecords++;gaps.push('unmapped record: '+record.record_id);
  }
  owner.record_ids.push(record.record_id);
  owner.details.push({label:'Rekord '+record.record_id,value:text(record)});
  if(record.evidence?.source_ref&&!owner.source_refs.includes(record.evidence.source_ref))owner.source_refs.push(record.evidence.source_ref);
 }
 const newsroom=byId.get(start);
 if(opening&&newsroom){
  const hero=opening.role?addNode({id:'character:opening-role',type:'character',status:'preview',label:opening.role.name||'Bohater podglądu',
   description:'Bohater wybrany do podglądu; nie NPC',source_id:'opening/story.json#/role',source_refs:['opening/story.json#/role'],details:fields(opening.role)}):null;
  if(hero)connect(newsroom.id,hero.id,'Bohater wybrany do podglądu początku');
  newsroom.preview_steps=list(opening.scenes).map(step=>({...structuredClone(step),status:'preview'}));
  const previewEvents=new Map(list(opening.scenes).map((step,index)=>{
   const event=addNode({id:'event:opening:'+(step.id||index),type:'event',status:'preview',preview_step_id:step.id,
    label:'Podgląd: '+(step.title||step.id||index),description:list(step.text).join('\n\n'),details:fields(step),
    source_refs:['opening/story.json#/scenes/'+index],scene_ids:[newsroom.id]});
   connect(newsroom.id,event.id,'Przygotowany krok adaptacji początku','contains');
   return [step.id,event];
  }));
  for(const [index,step] of list(opening.scenes).entries()){
   newsroom.details.push({label:'Adaptowany początek (podgląd): '+(step.title||step.id),value:text(step)});
   const base='opening/story.json#/scenes/'+index,previewEvent=previewEvents.get(step.id);
   for(const choice of list(step.choices)){
    const target=previewEvents.get(choice.target);
    if(target)connect(previewEvent.id,target.id,'W podglądzie: '+choice.label,'reference',choice.condition);
    else gaps.push('Brak celu działania w podglądzie: '+choice.target);
   }
   for(const [field,kind,url] of [['image','image',step.image],['audio','audio',step.audio],['handout/frontImage','image',step.handout?.frontImage],['handout/reverseAudio','audio',step.handout?.reverseAudio]]){
    if(!url)continue;const child=mediaNode('opening:'+url,kind,step.title,base+'/'+field,'opening',{step_id:step.id,field});
    connect(previewEvent.id,child.id,'Plik tego kroku podglądu; nie powiązanie kanoniczne','media');
    const speaker=list(source.npcs).find(npc=>npc.name===step.speaker);
    if(field==='image'&&speaker)connect(speaker.id,child.id,'Wizerunek wykorzystany w adaptacji otwarcia');
   }
   const representative=step.image||step.handout?.frontImage||step.audio;
   if(representative)previewEvent.media=structuredClone(mediaByUrl.get('opening:'+representative).media);
  }
  const {scenes:adaptedScenes,...metadata}=opening;
  newsroom.details.push({label:'Adaptacja początku - pozostałe dane',value:text(metadata)});
  if(opening.role?.portrait){
   const child=mediaNode('opening:'+opening.role.portrait,'image',opening.role.name,'opening/story.json#/role/portrait','opening');
   connect(hero.id,child.id,'Portret roli w podglądzie początku');hero.media=structuredClone(child.media);
  }
 }
 for(const entry of list(review.unknown_integration)){
  const node=addNode({id:'rule:integration:'+nodes.length,type:'rule',label:'Nieustalona integracja: '+(entry.id||''),description:entry.detail||text(entry),details:fields(entry),exception:true});
  connect(overview.id,node.id,'Brak do sprawdzenia');gaps.push(node.description);
 }
 gaps.push('Źródło nie ustala pełnego modelu przenoszenia i zużywania przedmiotów.',
  'Powiązanie mediów z sytuacją jest źródłowe; moment ujawnienia, jakość i odtwarzanie wymagają sprawdzenia.',
  'Mapa przedstawia opracowanie robocze; nie zatwierdza treści ani działania rozgrywki.');
 for(const node of nodes){
  if(node.id===overview.id)continue;
  if(!edges.some(edge=>edge.source===node.id||edge.target===node.id))connect(overview.id,node.id,'Element teczki','contains');
 }
 return {title:source.title||source.id,adventure_id:source.id,start_node_id:start,nodes,edges,
  summary:{source_scenes:scenes.length,locations:list(source.locations).length,characters:list(source.npcs).length,clues:list(source.clues).length,
   handouts:list(source.handouts).length,secrets:list(source.secretsPool).length,clock_events:list(source.doomClock?.stages).length,
   items:nodes.filter(n=>n.type==='item').length,explicit_inventory_items:explicitItems,records:records.length,assigned_records:seenRecords.size,unmapped_records:unmappedRecords,
   media_assets:mediaAssets.length,opening_steps:list(opening?.scenes).length,nodes:nodes.length,edges:edges.length,source_coverage:coverage},
  gaps:[...new Set(gaps)]};
}
