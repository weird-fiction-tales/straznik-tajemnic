import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildAdventureMap} from './adventure-map-model.mjs';
const source=JSON.parse(fs.readFileSync(new URL('../../data/adventures/predefined/cien-nad-prabutami.json',import.meta.url),'utf8'));
const record=(id,pointer,extra={})=>({record_id:id,adventure_id:source.id,content:JSON.stringify({pointer,value:{fixture:true}}),
 evidence:{source_ref:'data/adventures/predefined/'+source.id+'.json#'+pointer,approval:'pending'},tags:{scenes:[],entities:[],topics:[]},...extra});
const leafPointers=(value,pointer='')=>value&&typeof value==='object'&&Object.keys(value).length?
 Object.entries(value).flatMap(([key,child])=>leafPointers(child,pointer+'/'+key.replaceAll('~','~0').replaceAll('/','~1'))):[pointer];
test('complete canonical adventure has five scenes, five locations, five characters, twelve clues and four handouts',()=>{
 const m=buildAdventureMap({source});
 assert.equal(m.title,source.title);assert.equal(m.adventure_id,source.id);assert.equal(m.start_node_id,source.nodes[0].id);
 assert.equal(m.nodes.filter(n=>n.type==='scene').length,5);assert.equal(m.nodes.filter(n=>n.type==='location').length,5);
 assert.equal(m.nodes.filter(n=>n.type==='character').length,5);assert.equal(m.nodes.filter(n=>n.type==='clue').length,12);
 assert.equal(m.nodes.filter(n=>n.is_handout).length,4);assert.equal(m.nodes.filter(n=>n.type==='event').length,4);
 assert.equal(m.summary.secrets,6);assert.ok(m.nodes.some(n=>n.type==='secret'&&n.source_refs.some(r=>r.endsWith('#/truthAnchor'))));
});
test('every source field remains available in node details and source coverage',()=>{
 const m=buildAdventureMap({source});
 for(const pointer of leafPointers(source))assert.ok(m.summary.source_coverage.some(c=>pointer===c.pointer||pointer.startsWith(c.pointer+'/')),pointer);
 const clock=m.nodes.find(n=>n.source_refs.some(r=>r.endsWith('#/doomClock')));
 assert.ok(clock.details.some(d=>d.value.includes('28')));
 for(const node of m.nodes){
  assert.ok(node.details.every(d=>typeof d.label==='string'&&typeof d.value==='string'));
  assert.ok(Array.isArray(node.source_refs));assert.ok(Array.isArray(node.scene_ids));
 }
});
test('no dangling edges; source route descriptions survive without invented conditions',()=>{
 const m=buildAdventureMap({source}),ids=new Set(m.nodes.map(n=>n.id));
 assert.equal(ids.size,m.nodes.length);
 for(const edge of m.edges){assert.ok(ids.has(edge.source));assert.ok(ids.has(edge.target));}
 const routes=m.edges.filter(e=>e.type==='route');assert.equal(routes.length,source.connections.length);
 for(const connection of source.connections)assert.ok(routes.some(e=>e.source===connection.fromId&&e.target===connection.toId&&e.label===connection.description&&!Object.hasOwn(e,'condition')));
 const s=structuredClone(source);s.connections[0].condition='Known authored condition';
 assert.equal(buildAdventureMap({source:s}).edges.find(e=>e.type==='route').condition,'Known authored condition');
});
test('one character can retain references from several source scenes without creating duplicate characters or asserting presence',()=>{
 const s=structuredClone(source);s.nodes[1].npcIds.push(s.npcs[0].id);
 const m=buildAdventureMap({source:s}),actor=m.nodes.find(n=>n.id===s.npcs[0].id);
 assert.equal(m.nodes.filter(n=>n.id===actor.id).length,1);
 assert.ok(actor.scene_ids.includes(s.nodes[0].id));assert.ok(actor.scene_ids.includes(s.nodes[1].id));
 const edges=m.edges.filter(e=>e.type==='appears'&&e.target===actor.id);
 assert.equal(edges.length,2);assert.ok(edges.every(e=>e.label.includes('źród')));assert.equal(actor.presence,undefined);
});
test('all seventy records remain accessible including unmapped and unknown integration records',()=>{
 const records=Array.from({length:68},(_,i)=>record('r-'+i,'/nodes/'+(i%5)));
 records.push(record('unmapped','/not-in-source'));records.push(record('unknown','',{tags:{topics:['unknown-integration'],scenes:[],entities:[]},content:'Unresolved fixture'}));
 const m=buildAdventureMap({source,records});
 assert.equal(m.summary.records,70);assert.equal(m.summary.assigned_records,70);assert.equal(m.summary.unmapped_records,2);
 const represented=m.nodes.flatMap(n=>n.record_ids||[]);assert.equal(new Set(represented).size,70);
 for(const r of records)assert.ok(m.nodes.some(n=>n.details.some(d=>d.label==='Rekord '+r.record_id&&JSON.parse(d.value).record_id===r.record_id)));
 assert.ok(m.gaps.some(g=>g.includes('unmapped')));assert.ok(m.nodes.some(n=>n.exception===true));
});
test('record pointers attach to their exact source entities, including split records and route records',()=>{
 const records=[record('actor','/npcs/0/name'),record('location','/locations/0'),record('route','/connections/0'),record('meta','/title')];
 const m=buildAdventureMap({source,records});
 assert.ok(m.nodes.find(n=>n.id===source.npcs[0].id).record_ids.includes('actor'));
 assert.ok(m.nodes.find(n=>n.id===source.locations[0].id).record_ids.includes('location'));
 assert.ok(m.nodes.find(n=>n.id===source.connections[0].fromId).record_ids.includes('route'));
 assert.ok(m.nodes.some(n=>n.record_ids?.includes('meta')));
});
test('handouts remain distinct from inventory ownership; explicit bindings are preserved',()=>{
 const m=buildAdventureMap({source});assert.equal(m.nodes.filter(n=>n.type==='item').length,4);assert.ok(m.nodes.filter(n=>n.is_handout).every(n=>n.inventory_status==='unknown'));
 assert.ok(m.gaps.some(g=>/przenoszenia.*zużywania/.test(g)));
 const binding={entity_id:'owned-fixture',name:'Explicit item',source_location:source.locations[0].id};
 const bound=buildAdventureMap({source,records:[record('bound','/handouts/0',{inventory_item:binding})]});
 const item=bound.nodes.find(n=>n.type==='item'&&!n.is_handout);assert.ok(item);assert.ok(item.details.some(d=>d.value.includes('owned-fixture')));
 assert.equal(item.owner,undefined);
});
test('media preserve all inventory entries and source associations without inventing reveal triggers',()=>{
 const media={assets:[{url:source.handouts[0].image,kind:'image',filesystem_status:'present',language:'pl',source_refs:['inventory#/assets/0']},
 {url:'/missing.mp3',kind:'audio',filesystem_status:'missing',language:'en',source_refs:['inventory#/assets/1']},
 {url:source.handouts[0].image,kind:'image',quality:'unknown',source_refs:['inventory#/assets/2']}]};
 const m=buildAdventureMap({source,media}),photo=m.nodes.find(n=>n.media?.url===source.handouts[0].image);
 assert.equal(photo.status,'present');assert.ok(photo.details.some(d=>d.value.includes('inventory#/assets/2')));
 assert.equal(m.nodes.find(n=>n.media?.url==='/missing.mp3').status,'missing');
 const handout=m.nodes.find(n=>n.is_handout&&n.source_refs.some(r=>r.endsWith('#/handouts/0')));
 const association=m.edges.find(e=>e.type==='media'&&e.source===source.nodes[0].id&&e.target===handout.id);
 assert.ok(association.label.includes('źród'));assert.equal(association.condition,undefined);
 assert.ok(m.gaps.some(g=>/ujawnienia/.test(g)));
});
test('nine adapted opening steps remain previews attached to newsroom rather than canonical new scenes',()=>{
 const opening={role:{name:'Tomasz'},scenes:Array.from({length:9},(_,i)=>({id:'step-'+i,title:'Step '+i,text:['Adaptation '+i]}))};
 const m=buildAdventureMap({source,opening}),newsroom=m.nodes.find(n=>n.id===source.nodes[0].id);
 assert.equal(m.nodes.filter(n=>n.type==='scene').length,5);assert.equal(m.summary.opening_steps,9);
 assert.equal(newsroom.preview_steps.length,9);assert.ok(newsroom.details.some(d=>d.value.includes('Adaptation 8')));
 assert.ok(newsroom.preview_steps.every(s=>s.status==='preview'));
});
test('secrets are flagged, no node is approved, and pure input remains unchanged',()=>{
 const input={source:structuredClone(source),records:[record('r','/nodes/0')]},before=JSON.stringify(input);
 const m=buildAdventureMap(input);assert.equal(JSON.stringify(input),before);
 assert.ok(m.nodes.every(n=>['draft','present','missing','preview'].includes(n.status)));
 assert.ok(!m.nodes.some(n=>n.status==='approved'));
 const actor=m.nodes.find(n=>n.id===source.npcs[0].id);
 assert.ok(!actor.details.some(d=>d.label==='secret'));assert.ok(m.nodes.some(n=>n.type==='secret'&&n.source_refs.some(r=>r.endsWith('#/npcs/0/secret'))));
});

test('secret toggle can hide complete raw NPC, GM root metadata and unmapped secret records without leaks',()=>{
 const records=[
  {...record('full-npc','/npcs/0'),content:JSON.stringify({pointer:'/npcs/0',value:source.npcs[0]})},
  {...record('gm-meta','/boundarySummary'),content:JSON.stringify({pointer:'/boundarySummary',value:source.boundarySummary})},
  {...record('unmapped-secret','/unknown'),content:JSON.stringify({pointer:'/unknown',value:{secret:'UNMAPPED PRIVATE FIXTURE'}})},
 ];
 const m=buildAdventureMap({source,records}),visible=JSON.stringify(m.nodes.filter(n=>n.type!=='secret').map(n=>n.details));
 for(const needle of [source.npcs[0].secret,source.boundarySummary,'UNMAPPED PRIVATE FIXTURE'])assert.ok(!visible.includes(needle));
 for(const r of records)assert.ok(m.nodes.some(n=>n.type==='secret'&&n.record_ids.includes(r.record_id)));
 assert.equal(m.summary.assigned_records,3);
});
test('opening artwork and audio are explicit preview leaves distinguishable from canonical source URLs',()=>{
 const opening={role:{name:'Tomasz',portrait:'tomasz.webp'},scenes:[{id:'newsroom',title:'Adaptation',image:'newsroom.png',audio:'newsroom.mp3',handout:{frontImage:'photo-1947.png',reverseAudio:'reverse.mp3'}}]};
 const m=buildAdventureMap({source,opening}),previews=m.nodes.filter(n=>n.type==='media'&&n.media?.origin==='opening');
 assert.equal(previews.length,5);assert.ok(previews.every(n=>n.media.url.startsWith('opening:')&&n.status==='preview'));
 assert.ok(m.nodes.some(n=>n.media?.url===source.handouts[0].image&&n.media.origin==='source'));
 assert.equal(m.nodes.filter(n=>n.type==='scene').length,5);
});

test('selected preview hero remains distinct from source NPCs and portrait attribution is only a reference',()=>{
 const opening={role:{name:'Tomasz Nowicki',portrait:'tomasz.webp'},scenes:[
  {id:'helena',title:'Conversation',speaker:'Helena Krawczyk',image:'helena.webp',text:['Preview']}
 ]};
 const m=buildAdventureMap({source,opening}),hero=m.nodes.find(n=>n.id==='character:opening-role');
 assert.ok(hero);assert.equal(hero.type,'character');assert.equal(hero.status,'preview');assert.match(hero.description,/nie NPC/);
 assert.equal(m.summary.characters,5);
 const portrait=m.nodes.find(n=>n.type==='media'&&n.media?.url==='opening:tomasz.webp'),helena=m.nodes.find(n=>n.type==='media'&&n.media?.url==='opening:helena.webp');
 assert.ok(m.edges.some(e=>e.source===hero.id&&e.target===portrait.id&&e.type==='reference'));
 assert.ok(m.edges.some(e=>e.source===source.npcs[0].id&&e.target===helena.id&&e.type==='reference'&&e.label==='Wizerunek wykorzystany w adaptacji otwarcia'));
});

test('prepared opening steps are clickable preview events with exact choice and media links',()=>{
 const opening={role:{name:'Tomasz'},scenes:[
  {id:'newsroom',title:'Redakcja',text:['Adaptowany opis'],image:'newsroom.png',choices:[{label:'Obejrzyj zdjęcie',target:'photo'}]},
  {id:'photo',title:'Fotografia',text:['Adaptowany opis fotografii'],audio:'photo.mp3',handout:{frontImage:'photo.png'},choices:[{label:'Wróć',target:'newsroom'}]}
 ]};
 const m=buildAdventureMap({source,opening}),events=m.nodes.filter(n=>n.type==='event'&&n.status==='preview');
 assert.equal(events.length,2);assert.ok(events.every(n=>n.label.startsWith('Podgląd: ')));
 const newsroom=events.find(n=>n.preview_step_id==='newsroom'),photo=events.find(n=>n.preview_step_id==='photo');
 assert.ok(m.edges.some(e=>e.source===source.nodes[0].id&&e.target===newsroom.id&&e.type==='contains'));
 assert.ok(m.edges.some(e=>e.source===newsroom.id&&e.target===photo.id&&e.type==='reference'&&e.label==='W podglądzie: Obejrzyj zdjęcie'));
 assert.equal(photo.media.url,'opening:photo.png');assert.equal(photo.media.kind,'image');
 const photoMedia=m.nodes.find(n=>n.type==='media'&&n.media?.url==='opening:photo.png');
 const audioMedia=m.nodes.find(n=>n.type==='media'&&n.media?.url==='opening:photo.mp3');
 assert.ok(m.edges.some(e=>e.source===photo.id&&e.target===audioMedia.id));
 assert.ok(m.edges.some(e=>e.source===photo.id&&e.target===photoMedia.id&&e.type==='media'));
 assert.ok(!m.edges.some(e=>e.source===source.nodes[0].id&&e.target===photoMedia.id));
 assert.equal(m.summary.source_scenes,5);assert.equal(m.summary.clock_events,4);assert.equal(m.summary.opening_steps,2);
});
