import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
const moduleUrl = new URL('./scene-review-render.mjs', import.meta.url);
const { renderSceneReview } = existsSync(moduleUrl) ? await import(moduleUrl) : {};
const model = { schema_version:1, adventure_id:'fixture', edition_fingerprint:'sha256:test', coverage:{total:1}, errors:[], groups:[{id:'scene:opening',title:'Odprawa <script>alert(1)</script>',kind:'scene',snapshot:'hash',record_ids:['fact'],reference_record_ids:[],records:[{record_id:'fact',content:'Evidence </script><script>alert(2)</script>',evidence:{source_ref:'/source#fact'}}],scene:{focus:'Poznaj zadanie',choices:['Porozmawiaj','Obserwuj'],state:'Dostęp po deklaracji'},issues:[]},{id:'shared',title:'Zasady wspólne',kind:'shared',snapshot:'shared-hash',record_ids:[],reference_record_ids:[],records:[],issues:[]},{id:'exceptions',title:'Wyjątki',kind:'exceptions',snapshot:'exceptions-hash',record_ids:[],reference_record_ids:[],records:[],issues:[]}] };
test('renders a local author review with six checks and all three group kinds',()=>{
 assert.equal(typeof renderSceneReview,'function');
 const html=renderSceneReview({model,title:'Neutral fixture',media:[]});
 for(const label of ['Sens sytuacji','Tropy i swoboda','Testy i skutki','Przedmioty','Media','Dalszy przebieg','Zasady wspólne','Wyjątki']) assert.ok(html.includes(label),label);
 assert.ok(html.includes('application/json'));assert.ok(html.includes('Nie jest to odbiór całej przygody'));
});
test('embedded data cannot close the JSON script or inject author content',()=>{
 assert.equal(typeof renderSceneReview,'function');
 const html=renderSceneReview({model,title:'<img src=x onerror=alert(3)>',media:[]});
 assert.ok(!html.includes('Evidence </script>'));assert.ok(!html.includes('<img src=x onerror'));
 const json=html.match(/<script type="application\/json" id="review-data">([\s\S]*?)<\/script>/)[1];
 assert.equal(JSON.parse(json).model.groups[0].records[0].content,model.groups[0].records[0].content);
});
test('does not load remote scripts, fonts, or send author decisions to a network',()=>{
 assert.equal(typeof renderSceneReview,'function');const html=renderSceneReview({model,title:'Fixture',media:[]});
 assert.ok(!/<script[^>]+src=/.test(html));assert.ok(!html.includes('fetch('));assert.ok(!html.includes('localStorage'));
});

test('full semantic record and referenced graph are available to the author',()=>{
 const m=structuredClone(model);m.groups[0].records[0].inventory_item={access_check:{difficulty:'hard'}};
 m.groups[0].reference_records=[{record_id:'linked',content:'Linked exact source'}];m.groups[0].graph={edges:[{condition:'Only after clue'}]};
 const html=renderSceneReview({model:m,title:'Fixture',media:[]});
 assert.ok(html.includes('Pełne dane objęte decyzją'));
 assert.ok(html.includes('Powiązane rekordy odbierane osobno'));
 assert.ok(html.includes('Warunki grafu'));
});

test('scene summary discloses NPC knowledge boundaries, clues and missing mechanical conditions',async()=>{
 const {summarizeReviewGroup}=await import('./scene-review-render.mjs');assert.equal(typeof summarizeReviewGroup,'function');
 const group={kind:'scene',scene:{id:'opening',focus:'Find the missing witness',choices:[]},records:[{record_type:'clue',content:JSON.stringify({pointer:'/clues/0',value:{name:'Letter',description:'Names the next place',requiredSkill:'Spot Hidden'}})}],reference_records:[{record_type:'actor',content:JSON.stringify({pointer:'/npcs/0',value:{name:'Witness',description:'Waits nearby',secret:'Cannot identify the visitor'}})}],graph:{edges:[{from:'opening',to:'next',condition:'Read the letter'}]}};
 const summary=summarizeReviewGroup(group);assert.ok(summary[0].includes('Cannot identify the visitor'));assert.ok(summary[1].includes('Names the next place'));assert.ok(summary[2].includes('Spot Hidden'));assert.ok(summary[2].includes('Nie ustalono'));assert.ok(summary[5].includes('Read the letter'));
});

import { createRequire } from 'node:module';
const runtimeRequire = createRequire(new URL('../../_tester/_base/.silnik/package.json',import.meta.url));
const {JSDOM,VirtualConsole} = runtimeRequire('jsdom');
function renderedMediaFixture(manifest, media = []) {
 const fixture=structuredClone(model);
 fixture.groups[0].media_manifest=manifest;
 const errors=[], virtualConsole=new VirtualConsole();
 virtualConsole.on('jsdomError',error=>errors.push(error.message));
 const dom=new JSDOM(renderSceneReview({model:fixture,title:'Media fixture',media}),{runScripts:'dangerously',virtualConsole});
 assert.deepEqual(errors,[]);
 return dom;
}
test('rendered author page exposes the complete hashed media manifest in readable details',()=>{
 const manifest={schema_version:1,assets:[{url:'/fixture.webp',quality:'unknown',playback:'unknown',
   source_refs:['source.json#/handouts/0/image'],description:'Evidence </script><script>throw Error("injected")</script>'}],
   visual_pack:{matches:[{query:'npc-fixture',priority:3,url:null}]},generation_calls:0};
 const dom=renderedMediaFixture(manifest);
 const details=dom.window.document.querySelector('[data-testid="media-manifest-details"]');
 assert.ok(details,'full group.media_manifest must have an author-visible details panel');
 assert.deepEqual(JSON.parse(details.querySelector('pre').textContent),manifest);
 assert.ok(details.querySelector('summary').textContent.includes('Pełny inwentarz mediów'));
 dom.window.close();
});
test('unresolved media trigger language quality playback and mapping stay visible before media consent',()=>{
 const dom=renderedMediaFixture({assets:[{url:'/fixture.mp3',quality:'unknown',playback:'unknown'}]});
 const document=dom.window.document, gaps=document.querySelector('[data-testid="media-review-gaps"]');
 assert.ok(gaps,'media uncertainties must be visible without opening details');
 assert.equal(gaps.closest('details'),null);
 for(const field of ['trigger','language','quality','playback','mapping']) {
   const value=gaps.querySelector('[data-media-field="'+field+'"]');
   assert.ok(value,field+' must be presented');
   assert.match(value.textContent,/Nie ustalono/);
 }
 const decision=document.querySelector('.decision-form');
 assert.ok(gaps.compareDocumentPosition(decision)&dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
 assert.ok(gaps.textContent.includes('/fixture.mp3'));
 dom.window.close();
});
test('known media fields remain visible and an absent inventory explicitly discloses missing fields',()=>{
 const dom=renderedMediaFixture({assets:[{url:'/fixture.mp3',trigger:'after-clue',language:'pl',
   quality:'author-reviewed',playback:'checked-locally',mapping:'node-opening'}]});
 const gaps=dom.window.document.querySelector('[data-testid="media-review-gaps"]');
 assert.ok(gaps);
 for(const value of ['after-clue','pl','author-reviewed','checked-locally','node-opening']) assert.ok(gaps.textContent.includes(value));
 dom.window.close();
 const missing=renderedMediaFixture(undefined), panel=missing.window.document.querySelector('[data-testid="media-review-gaps"]');
 assert.ok(panel);assert.match(panel.textContent,/Nie ustalono/);
 for(const field of ['trigger','language','quality','playback','mapping']) assert.ok(panel.textContent.includes(field));
 missing.window.close();
});

test('author instructions explain source fragments and creative consent without asking for a technical audit',()=>{
 const dom=renderedMediaFixture({assets:[]}),document=dom.window.document;
 const guide=document.querySelector('[data-testid="author-review-guide"]');
 assert.ok(guide,'plain-language instructions must appear before author review');
 for(const phrase of ['fragmenty jednego opisu','osobne zadania','zapoznałem się','Do poprawy','uwagę','Braki w przygotowaniu uzupełnia agent']) assert.ok(guide.textContent.includes(phrase),phrase);
 const labels=[...document.querySelectorAll('.check label')].map(label=>label.textContent);
 assert.equal(labels.length,6);assert.ok(labels.every(label=>label.trim().startsWith('Tak,')));
 assert.ok(labels.every(label=>!/aplikacja|wykonaw|rozstrzyga|kod|warunki|język/.test(label)));
 assert.match(document.querySelector('#groups button .count').textContent,/1 fragmentów źródła/);
 assert.ok(!document.querySelector('#groups').textContent.includes('rekordów'));
 const details=[...document.querySelectorAll('#scene details')].find(item=>item.querySelector('summary')?.textContent.includes('Fragmenty źródła'));
 assert.ok(details);assert.match(details.textContent,/jeden opis/);
 assert.ok(details.textContent.includes(model.groups[0].records[0].content));
 assert.equal(document.querySelectorAll('[data-decision]').length,3);
 const embedded=JSON.parse(document.querySelector('#review-data').textContent);
 assert.equal(embedded.model.groups[0].snapshot,model.groups[0].snapshot);
 dom.window.close();
});
test('source actors are distinguished from playable choices and starting points',async()=>{
 const {summarizeReviewGroup}=await import('./scene-review-render.mjs');
 const summary=summarizeReviewGroup({kind:'scene',scene:{focus:'A neutral meeting'},records:[{
  record_id:'npc',record_type:'actor',content:JSON.stringify({value:{name:'Witness',description:'Waits nearby',secret:'Keeps a secret'}})
 }]});
 assert.match(summary[0],/Osoby opisane w źródle tej sceny/);
 assert.ok(summary[0].includes('To nie jest lista postaci do wyboru ani potwierdzenie ich punktów startowych.'));
 assert.ok(summary[0].includes('Witness'));assert.ok(summary[0].includes('Keeps a secret'));
 assert.ok(!summary[0].includes('prowadzi aplikacja'));
});

test('complete media gallery opens independently of scene assignment without changing decisions or snapshots',()=>{
 const media=[
  {id:'image-pl',label:'Obraz PL',kind:'image',preview_url:'file:///private/fixture.webp',language:'pl',source_refs:['source.json#/image']},
  {id:'audio-en',label:'Nagranie EN',kind:'audio',preview_url:'file:///private/fixture.mp3',language:'en',source_refs:['source.json#/audio']},
  {id:'image-copy',label:'Drugi wpis tego samego obrazu',kind:'image',preview_url:'file:///private/fixture.webp',source_refs:['manifest.json#/asset']},
 ];
 const dom=renderedMediaFixture({assets:[]},media),document=dom.window.document;
 assert.equal(document.querySelectorAll('#scene img, #scene audio').length,0,'global media must not be assigned to the opening scene');
 const gallery=document.querySelector('#media-library');assert.ok(gallery);
 document.querySelector('#media-library-trigger').click();assert.equal(gallery.open,true);
 assert.equal(gallery.querySelectorAll('article').length,3);
 assert.equal(gallery.querySelectorAll('img').length,2);assert.equal(gallery.querySelectorAll('audio').length,1);
 assert.equal(gallery.querySelector('audio').autoplay,false);
 for(const value of ['Istniejące materiały','przypisanie do scen','moment ujawnienia','Nieobejrzane','source.json#/audio','en','manifest.json#/asset']) assert.ok(gallery.textContent.includes(value),value);
 assert.ok(gallery.compareDocumentPosition(document.querySelector('.decision-form'))&dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
 assert.equal(JSON.parse(document.querySelector('#review-data').textContent).model.groups[0].snapshot,model.groups[0].snapshot);
 assert.match(document.querySelector('#decision-status').textContent,/Brak aktualnej decyzji/);
 dom.window.close();
});

test('already assigned scene previews appear before six review sections without duplicate scene cards',()=>{
 const dom=renderedMediaFixture({assets:[]},[{id:'assigned',label:'Assigned source image',kind:'image',
  scene_ids:['opening'],preview_url:'file:///private/assigned.webp'}]);
 const document=dom.window.document,preview=document.querySelector('#scene-media');
 assert.equal(preview.querySelectorAll('img').length,1);assert.equal(document.querySelectorAll('#scene img').length,1);
 assert.ok(preview.compareDocumentPosition(document.querySelector('.checks'))&dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
 assert.equal(document.querySelectorAll('[data-check]').length,6);
 dom.window.close();
});
