#!/usr/bin/env node
/** Local authoring compiler. Reads inspected notes, never PDFs, and never approves/publishes. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runtime = path.join(root, '_tester/_base/.silnik');
const require = createRequire(path.join(runtime, 'package.json'));
const yaml = require('js-yaml');
const ts = require('typescript');
// Use the actual application's schema/loader; compile TS in this authoring CLI process only.
const oldExtension = require.extensions['.ts'];
require.extensions['.ts'] = (module, filename) => {
  if (!filename.startsWith(path.join(runtime, 'src/lib/adventure-dossier/')) && !['time-manager.ts','dice-utils.ts'].some(name => filename === path.join(runtime, 'src/lib', name))) {
    throw new Error('Unexpected TypeScript dependency: ' + filename);
  }
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  }).outputText, filename);
};
const { validateDossierRagPayload } = require(path.join(runtime, 'src/lib/adventure-dossier/rag-schema.ts'));
const { DOSSIER_MECHANICS } = require(path.join(runtime, 'src/lib/adventure-dossier/mechanic-registry.ts'));
if (oldExtension) require.extensions['.ts'] = oldExtension;
else delete require.extensions['.ts'];


/** Read/normalize only. Never writes files or approves authoring. */
export function readBuildModel(inputDirectory, { audit = false } = {}) {
const diagnostics=[];
const fail=message=>{if(!audit)throw new Error(message);diagnostics.push(message);};
const directory = fs.realpathSync(path.resolve(inputDirectory));
if (directory.split(path.sep).includes('public')) fail('Authoring output must never be public');
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const config = readJson(path.join(directory, 'preparation/build.json'));
const supplement = readJson(path.join(directory, config.supplement));
const sourcePath = path.resolve(directory, config.source);
const source = fs.readFileSync(sourcePath, 'utf8');
const sourceRelative = path.relative(root, sourcePath);
const manifest = yaml.load(fs.readFileSync(path.join(directory, 'dossier.yaml'), 'utf8'), { schema: yaml.JSON_SCHEMA });
const hash = x => crypto.createHash('sha256').update(x).digest('hex');
const uid = x => 'auto.' + hash(x).slice(0, 24);
const uniq = xs => [...new Set(xs)];
const clean = s => String(s).replace(/`/g, '').trim();
const textValue = value => typeof value==='string'?value:JSON.stringify(value);
const ids = s => uniq([...String(s).matchAll(/\b(?:npc|entity|loc|clue|evt|obj|shop)-[a-z0-9-]+\b/g)].map(m => m[0]));
const mech = numbers => numbers.map(n => {
  const m = DOSSIER_MECHANICS.find(x => x.auditArea === n);
  if (!m) fail('Unknown mechanic ' + n);
  return m.id;
});
const tables = new Map();
let heading = '', headers = null;
const lines = source.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (/^#{1,6} /.test(line)) { heading = line.replace(/^#+ /, '').trim(); headers = null; }
  if (!line.startsWith('|')) { headers = null; continue; }
  const cells = line.trim().slice(1, -1).split(/(?<!\\)\|/).map(x => x.trim().replaceAll('\\|', '|'));
  if (cells.every(x => /^:?-+:?$/.test(x.replace(/\s/g, '')))) continue;
  if (!headers) { headers = cells; if (!tables.has(heading)) tables.set(heading, []); continue; }
  if (cells.length !== headers.length) fail(`Malformed table at ${sourceRelative}:${i + 1}`);
  tables.get(heading).push({ headers, cells, line: i + 1 });
}
const blocks = [...source.matchAll(/```yaml\n([\s\S]*?)```/g)].map(m => {
 const line=source.slice(0,m.index).split('\n').length;
 try{return {data:yaml.load(m[1],{schema:yaml.JSON_SCHEMA}),line};}
 catch(e){fail(`YAML ${sourceRelative}:${line}: ${e.message}`);return {data:null,line};}
});
const actors = blocks.filter(b => b.data?.record?.fields && /^(npc-|entity-)/.test(b.data.record.id))
  .map(({ data, line }) => ({ ...data.record, source_line: line }));
const coverage = blocks.find(b => b.data?.mechanicsCoverage)?.data.mechanicsCoverage;
if (!coverage) fail('Missing mechanic coverage');
const coveredAreas = Object.values(coverage || {}).filter(Array.isArray).flat().sort((a,b) => a-b);
if (coveredAreas.length !== DOSSIER_MECHANICS.length || coveredAreas.some((n,i) => n !== i + 1)) fail('Mechanic coverage has gaps or duplicates');
for (const h of [...config.sections.map(x => x[0]), ...config.review_only_sections]) if (!tables.has(h)) { fail('Missing source section: ' + h); tables.set(h,[]); }
if (tables.get('Paleta zahaczek z 16 kategorii worldbuildingu').length !== 16) fail('Expected all 16 worldbuilding categories');
if (tables.get('Pokrycie 36 filarów narracji i worldbuildingu').length !== 36) fail('Expected all 36 narrative pillars');

const sourceNodeClaims = [];
const records = [], metadata = new Map(), nodes = new Map(), edges = [], primary = new Map();
// Runtime may supply a canonical location ID or the displayed location name.
// Expand only exact, unambiguous names from the inspected location registry.
const locationNames = new Map();
const locationNameOwners = new Map();
const locationSlug = name => name.trim().toLocaleLowerCase().replace(/ł/g, 'l').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
for (const row of tables.get('Lokacje z mapy i scenariusza')) {
  const id = clean(row.cells[0]), name = clean(row.cells[1]).toLocaleLowerCase(), slug = locationSlug(name);
  const aliases = uniq([name, slug, slug ? `loc-${slug}` : '']).filter(Boolean);
  locationNames.set(id, aliases);
  for (const alias of aliases) {
    const owners = locationNameOwners.get(alias) || new Set();
    owners.add(id); locationNameOwners.set(alias, owners);
  }
}
const sceneTags = scenes => {
  const expanded = uniq(scenes.flatMap(id => [id, ...(supplement.scene_frames.find(f => f.id === id)?.locations || [])]));
  return uniq(expanded.flatMap(id => [id, ...(locationNames.get(id) || [])
    .filter(alias => locationNameOwners.get(alias)?.size === 1)]));
};
const evidence = (ref, provenance = 'source_derived') => ({ provenance, source_ref: ref, status: 'set', approval: 'pending', approved_by: null, approved_at: null });
const add = ({ key, type, title, content, entities = [], scenes = [], mechanics = [], topics = [], triggers = [], ref, ev, availability, priority = 1, refs = [] }) => {
  const record = {
    schema_version: 1, record_id: uid(key), record_type: type,
    adventure_id: manifest.adventure_id, edition_fingerprint: manifest.edition_fingerprint, language: manifest.language,
    content: `${title}\n${content}`,
    tags: { entities: uniq(entities), scenes: sceneTags(scenes), mechanics: uniq(mechanics), topics: uniq(topics), triggers: uniq(triggers) },
    retrieval: { visibility: 'gm_only', availability: availability || (entities.length ? 'when_entity_present' : scenes.length ? 'when_scene_active' : 'always'), condition: null, priority },
    evidence: ev || evidence(ref), links: [],
  };
  if (records.some(x => x.record_id === record.record_id)) fail('Duplicate source key ' + key);
  records.push(record); metadata.set(record.record_id, { title, refs: uniq(refs) });
  return record;
};
const node = (id, label, kind, ref, detail = '', role = 'definition') => {
  const sourceCard={kind,label:clean(label),source_ref:ref,detail,role};
  sourceNodeClaims.push({id,...sourceCard});
  if (!nodes.has(id)) nodes.set(id, { id, label: clean(label), kind, source_ref: ref, detail, source_cards:[sourceCard] });
  else nodes.get(id).source_cards.push(sourceCard);
};

const registry = tables.get('Atomowy rejestr aktorów ze źródła') || [];
for (const actor of actors) {
  const row = registry.find(r => clean(r.cells[0]) === actor.id);
  const name = String(actor.fields['identity.name']?.value || row?.cells[1] || actor.id);
  actor.label = name;
  node(actor.id, name, 'actor', `${sourceRelative}:${actor.source_line}`);
  const unknown = [], setFields = [];
  for (const [field, raw] of Object.entries(actor.fields)) {
    const value = { ...actor.field_defaults?.[raw.provenance], ...raw };
    if (value.status !== 'set' || value.value === null || value.value === undefined) { unknown.push(field); continue; }
    setFields.push([field, value]);
    const r = add({ key: actor.id + ':' + field, type: 'actor', title: `${name} · ${field}`,
      content: typeof value.value === 'string' ? value.value : JSON.stringify(value.value),
      entities: [actor.id], mechanics: mech([49]), topics: ['actor', field.split('.')[0]],
      refs: [actor.id, ...ids(value.value)], priority: /knowledge|agenda|goal|reaction/.test(field) ? 3 : 1,
      ev: { provenance: value.provenance, source_ref: value.sourceRef, status: value.status, approval: value.approval,
        approved_by: value.approvedBy ?? null, approved_at: value.approvedAt ?? null },
    });
    if (!primary.has(actor.id)) primary.set(actor.id, r.record_id);
  }
  const overviewFields = setFields.filter(([k]) => /identity\.(role|age|kind)|goal\.|agenda\.|agency\.|knowledge\.|psychology\.|social_response\.|narrative_boundary\.|opening_state\.|encounter_state\.|mechanical_profile\.|world_state\.|body\./.test(k));
  // Several small cards preserve facts instead of truncating a long profile.
  const parts = []; let part = [];
  for (const [k,v] of overviewFields) {
    const line = k + ': ' + (typeof v.value === 'string' ? v.value : JSON.stringify(v.value));
    if (part.join('\n').length + line.length > 3400) { parts.push(part); part = []; }
    part.push(line);
  }
  if (part.length) parts.push(part);
  parts.forEach((p,i) => {
    const r = add({ key: actor.id + ':overview:' + i, type: 'actor', title: `${name} · przygotowanie ${i+1}/${parts.length}`,
      content: 'Stan początkowy stanowi punkt odniesienia. Opis warunkowych zdarzeń nie oznacza, że już zaszły. Aktualny zapis kampanii ma pierwszeństwo w podanych polach.\n' + p.join('\n'), entities: [actor.id], mechanics: mech([49,25]), topics: ['actor','intent','knowledge'], priority: 3,
      ref: `${sourceRelative}:${actor.source_line}; atomowe odsyłacze i pochodzenie w karcie aktora`, refs: [actor.id] });
    if (i === 0) {
      primary.set(actor.id, r.record_id);
      r.actor_binding = { entity_id: actor.id, name };
      if (supplement.actor_initial_states?.[actor.id]) {
        r.actor_binding.initial_state = supplement.actor_initial_states[actor.id];
        metadata.get(r.record_id).refs.push(r.actor_binding.initial_state.location_id);
      }
      if (supplement.actor_transitions?.[actor.id]) {
        r.actor_binding.transitions = supplement.actor_transitions[actor.id];
        metadata.get(r.record_id).refs.push(...r.actor_binding.transitions.flatMap(t => [t.source_location_id, t.target_location_id].filter(Boolean)));
      }
    }
  });
  if (unknown.length) add({ key: actor.id + ':unspecified-guard', type: 'director_note', title: `${name} · granice danych`,
    content: 'Nie ustalono w sprawdzonym źródle: ' + unknown.join(', ') + '. Nie przedstawiaj tych pól jako faktów z podręcznika. Szczegóły odegrania można utrwalić jako interpretację kampanii; brak statystyk nie upoważnia do zgadywania rozstrzygnięć.',
    entities: [actor.id], topics: ['uncertainty','continuity'], ref: `${sourceRelative}:${actor.source_line}; jawne pola unspecified`, refs: [actor.id] });
  const goalFields=setFields.filter(([key])=>/^(goal\.|agenda\.|local_plan\.|autonomous_plan\.)/.test(key));
  if(goalFields.length){
    const goalId='goal:'+actor.id;
    const detail=goalFields.map(([key,value])=>key+': '+textValue(value.value)).join('\n');
    node(goalId,'Zamiary: '+name,'goal',`${sourceRelative}:${actor.source_line}`,detail);
    edges.push({id:uid(goalId),from:actor.id,to:goalId,kind:'goal',condition:'Aktualny plan wynika z karty i może się zmienić po zdarzeniach kampanii.',effect:detail,source_ref:`${sourceRelative}:${actor.source_line}`});
  }
}

// Non-actor atoms include the owner's two explicit decisions about the path motif.
// Preserve those decisions and their original provenance/approver; do not re-approve them.
for (const {data,line} of blocks.filter(b => b.data?.record?.fields && !/^(npc-|entity-)/.test(b.data.record.id))) {
  const record=data.record;
  for(const [field,value] of Object.entries(record.fields)) {
    if(value.status!=='set'||value.value===null||value.value===undefined) continue;
    add({key:record.id+':'+field,type:'mechanic_hook',title:record.id+' · '+field,
      content:typeof value.value==='string'?value.value:JSON.stringify(value.value),
      mechanics:mech([43]),topics:['source-decision',field],refs:[record.id],availability:'always',priority:3,
      ev:{provenance:value.provenance,source_ref:value.sourceRef||`${sourceRelative}:${line}`,status:value.status,
        approval:value.approval,approved_by:value.approvedBy??null,approved_at:value.approvedAt??null}});
  }
}

for (const [section, type] of config.sections) for (const row of tables.get(section)) {
  const plain = row.cells.map(clean), all = row.cells.join(' '), related = ids(all);
  const entities = related.filter(x => /^(npc-|entity-|obj-)/.test(x));
  const scenes = related.filter(x => /^(loc-|shop-)/.test(x));
  const title = plain[0];
  const recordType = config.node_type_overrides?.[title] || type;
  const r = add({ key: section + ':' + row.cells.slice(0, 2).join('|'), type:recordType, title: `${section} · ${title}`,
    content: row.headers.map((h,i) => `${clean(h)}: ${plain[i]}`).join('\n'), entities, scenes,
    mechanics: type === 'actor' ? mech([49]) : type === 'pacing' ? mech([52]) : type === 'clue' ? mech([51]) : type === 'event' ? mech([28]) : [],
    topics: [type], ref: `${sourceRelative}:${row.line}; ${plain.at(-1)}`, refs: related,
    availability: 'always', // GM knowledge can concern distant places; actual disclosure stays conditional in the card.
    priority: type === 'event' || type === 'clue' ? 2 : 1,
  });
  if (['Graf sytuacji','Lokacje z mapy i scenariusza','Rejestr tropów i źródeł informacji','Zdarzenia i zegar świata'].includes(section)) {
    const id = plain[0]; node(id, plain[1], recordType, r.evidence.source_ref, r.content, section === 'Graf sytuacji' ? 'source_scene' : 'definition'); primary.set(id, r.record_id);
  }
  if (section === 'Zweryfikowane krawędzie grafu' || section === 'Sieć relacji i zależności') {
    const fromIds = config.graph_aliases?.[plain[0]] || (ids(plain[0]).length ? ids(plain[0]) : [plain[0]]);
    const toIds = config.graph_aliases?.[plain[1]] || (ids(plain[1]).length ? ids(plain[1]) : [plain[1]]);
    for (const from of fromIds) for (const to of toIds) edges.push({ id: uid(r.record_id+':'+from+':'+to), from, to,
      kind: section === 'Sieć relacji i zależności' ? 'relationship' : (config.graph_edge_kinds?.[`${from}->${to}`] || 'route'), condition: plain[2], effect: plain[3], source_ref: plain[4] });
  }
}

for (const p of supplement.policies) add({ key:'policy:'+p.id, type:'director_note', title:p.title, content:p.content,
  topics:['policy',p.id], ref:supplement.source_ref, ev:evidence(supplement.source_ref,'approved_design'), availability:'always', priority:3 });
for (const item of supplement.items) {
  const inventoryBound=!!item.inventory_binding;
  const itemTopics=inventoryBound?['inventory',item.kind]:['adventure_object',item.kind];
  const itemTriggers=inventoryBound?['inspect','take','give','drop','use']:
    item.kind==='world_object'?['inspect','operate','damage','repair']:
    item.kind==='vehicle'?['inspect','drive','take_control','damage']:
    item.kind==='actor_inventory'?['inspect','disarm','transfer']:
    item.kind==='catalog_selection'?['inspect','select','purchase','take']:
    ['inspect','collect','take'];
  const lifecycle=inventoryBound
    ? 'Po zdobyciu tej konkretnej instancji wspólny adapter ekwipunku obsługuje przekazanie, odłożenie, utratę i użycie; nie twórz duplikatu.'
    : item.kind==='world_object'||item.kind==='vehicle'
      ? 'To obiekt świata, nie ekwipunek. Nie używaj operacji dodania, przekazania ani odłożenia przedmiotu.'
      : item.kind==='actor_inventory'
        ? 'To szablon pochodzenia wyposażenia NPC, nie egzemplarz. Wymaga wskazania aktora i konkretnej instancji.'
        : 'Opisuje możliwość znalezienia lub wyboru; karta sama nie tworzy instancji ekwipunku ani nie zapisuje jej posiadania.';
  node(item.id, item.name, 'item', item.source, item.constraints);
  const r = add({ key:'item:'+item.id, type:'fact', title:item.name,
    content:`Dostęp: ${item.access}\nZdobycie: ${item.acquire}\nGranice: ${item.constraints}\nRodzaj: ${item.kind}. ${lifecycle}`,
    entities:[item.id], scenes:item.location?[item.location]:[], mechanics:mech(item.mechanics), topics:itemTopics,
    triggers:itemTriggers, ref:item.source+'; operacyjne reguły pozyskania: preparation/playbook.json',
    ev:evidence(item.source+'; autorska adaptacja reguł posiadania','approved_design'), availability:'always', priority:2, refs:[item.location,...item.clues].filter(Boolean) });
  if (item.world_object_binding) r.world_object_binding = item.world_object_binding;
  if (item.inventory_binding) {
    if (!item.location) fail('Inventory instance requires a source location: ' + item.id);
    r.inventory_item = { entity_id:item.id, name:item.name, category:item.inventory_binding.category, source_location:item.location,
      ...(item.inventory_binding.access_check ? { access_check:item.inventory_binding.access_check } : {}),
      ...(item.inventory_binding.initial_state ? { initial_state:item.inventory_binding.initial_state } : {}) };
    r.content += `\nIdentyfikator pojedynczego egzemplarza: @${r.record_id}. Po rozstrzygnięciu zdobycia: [EKWIPUNEK: DODAJ | @${r.record_id}]. Przekazanie: [EKWIPUNEK:@Imię właściciela: PRZEKAZ | @${r.record_id} | Imię odbiorcy]. Odłożenie: [EKWIPUNEK: ODLOZ | @${r.record_id}]. Utrata lub zniszczenie: [EKWIPUNEK: USUN | @${r.record_id}]. Zużycie: [EKWIPUNEK: ZUZYJ | @${r.record_id} | ilość]. Nie dodawaj tego samego przedmiotu drugim tagiem ani kartą ZDOBYTO. Nie przyznawaj przedmiotu za samo obejrzenie; nie potwierdzaj nabycia przed wynikiem wymaganego testu.`;
  }
  primary.set(item.id, r.record_id);
  if (item.location) edges.push({ id:uid('itemedge:'+item.id),from:item.location,to:item.id,kind:'item',condition:item.access,effect:item.acquire,source_ref:item.source });
  for(const clue of item.clues) edges.push({ id:uid(item.id+':'+clue),from:item.id,to:clue,kind:'clue',condition:'Oględziny / badanie materiału w fikcji',effect:item.constraints,source_ref:item.source });
}
for (const frame of supplement.scene_frames) {
  node(frame.id, frame.title, 'scene', frame.source, '', 'preparation_frame');
  Object.assign(nodes.get(frame.id), {navigation_role:'context_only', navigation_reason:'Karta przygotowania grupuje lokacje i możliwe działania; fizyczne przejścia dotyczą powiązanych lokacji.'});
  const r = add({ key:'frame:'+frame.id, type:'scene', title:frame.title,
    content:`Sytuacja: ${frame.focus}\nOtwarte podejścia (przykłady, nie menu): ${frame.choices.join(' ')}\nAktualizacja: ${frame.state}\nPowiązane karty NPC nie dowodzą obecności postaci — tę określa stan kampanii.`,
    entities:[], scenes:uniq([frame.id,...frame.locations]), mechanics:mech([28,51,52]), topics:['scene','agency','state'],
    availability:'when_scene_active', priority:3, ev:evidence(frame.source+'; autorska karta przygotowania','approved_design'), refs:[...frame.locations,...frame.actors,...frame.objects] });
  primary.set(frame.id,r.record_id);
  for(const id of uniq([...frame.locations,...frame.actors,...frame.objects])) edges.push({ id:uid(frame.id+':'+id),from:frame.id,to:id,kind:'preparation',condition:'Powiązanie przygotowania; nie obecność ani obowiązkowe przejście',effect:'Sprawdź aktualny stan i dostęp przed użyciem karty.',source_ref:frame.source });
  frame.choices.forEach((choice,i)=>{
    const id=`approach:${frame.id}:${i+1}`;
    node(id,choice,'approach',frame.source,`Przykład podejścia, nie obowiązek ani zamknięte menu. ${choice}\nPo rozstrzygnięciu: ${frame.state}`);
    edges.push({id:uid(id),from:frame.id,to:id,kind:'approach',condition:'Gracze wybierają ten zamiar lub inną wykonalną metodę.',effect:frame.state,source_ref:frame.source});
  });
}
for(const hook of supplement.mechanic_hooks||[]){
  const content=`Wyzwalacz: ${hook.trigger}\nDane: ${hook.parameters}\nWykonanie / sukces: ${hook.success}\nNiewykonanie / porażka: ${hook.failure}\nStan: ${hook.state}\nRozstrzyga wspólna aplikacja; karta nie losuje ani nie wykonuje zapisu.`;
  node(hook.id,hook.title,'mechanic_hook',hook.source,content);
  const r=add({key:hook.id,type:'mechanic_hook',title:hook.title,content,entities:[],scenes:hook.frames,mechanics:mech(hook.mechanics),topics:['trigger','resolution','state'],availability:'when_scene_active',priority:3,ref:hook.source,refs:[...hook.actors,...hook.objects,...hook.frames]});
  primary.set(hook.id,r.record_id);
  for(const frame of hook.frames) edges.push({id:uid(hook.id+':'+frame),from:frame,to:hook.id,kind:'mechanic',condition:hook.trigger,effect:hook.state,source_ref:hook.source});
  for(const object of hook.objects) edges.push({id:uid(hook.id+':'+object),from:hook.id,to:object,kind:'mechanic',condition:hook.trigger,effect:hook.success,source_ref:hook.source});
}
for (const h of supplement.handouts) {
  const sourceItem = supplement.items.find(item => item.id === h.object_id);
  if (!sourceItem?.location) fail('Handout without an inspected source location: ' + h.id);
  node(h.id,h.label,'handout',`druk. s. ${h.printed_page}, PDF ${h.pdf_page}`);
  const r = add({ key:'handout:'+h.id,type:'handout_locator',title:h.label,
    content:`Warunek udostępnienia: ${h.access}. Po faktycznym dostępie wstaw [HANDOUT:${uid('handout:'+h.id)}]. Oryginał aplikacja otwiera lokalnie; nie odtwarzaj jego tekstu ani obrazu. Sam dostęp do materiału nie oznacza poznania wniosku ani zabrania fizycznego przedmiotu.`,entities:[h.object_id],scenes:[sourceItem.location],mechanics:mech([51,43]),topics:['handout','local-only'],
    ref:`druk. s. ${h.printed_page}; locator z wcześniejszej inspekcji`,refs:[h.object_id],availability:'when_scene_active',priority:3 });
  r.local_handout={kind:'embedded_image',pdf_page:h.pdf_page,width:h.width,height:h.height,rgba_sha256:h.rgba_sha256,title:h.label,audience:'party'};
  primary.set(h.id,r.record_id);
  edges.push({id:uid('reveal:'+h.id),from:h.object_id,to:h.id,kind:'handout',condition:h.access,effect:'Udostępnij całej drużynie oryginał lokalnie; nie wysyłaj bajtów do modelu.',source_ref:r.evidence.source_ref});
}
const visualProfile=blocks.find(b=>b.data?.visualPromptProfile)?.data.visualPromptProfile;
if (visualProfile) add({key:'visual-profile',type:'media',title:'Wspólny kierunek obrazu i generacji uzupełniającej',content:JSON.stringify(visualProfile),topics:['visual','continuity','image-generation'],ev:evidence('visualPromptProfile w inspekcji','approved_design'),availability:'always'});

// Explicit authoring groups preserve collective references without inventing entities.
for (const [id,group] of Object.entries(config.reference_groups || {})) {
  if (!Array.isArray(group.members) || !group.members.length) { fail('Empty reference group '+id); continue; }
  for (const member of group.members) if (!nodes.has(member)) fail('Unknown group member '+id+' -> '+member);
  const r=add({key:'reference-group:'+id,type:'fact',title:id,content:'Techniczna grupa istniejących kart: '+group.members.join(', ')+'. Nie jest pojedynczym NPC ani przedmiotem.',entities:group.members,topics:['reference-group'],ref:group.source_ref,refs:group.members,availability:'always'});
  primary.set(id,r.record_id);node(id,id,'group',group.source_ref);
  for (const member of group.members) edges.push({id:uid('membership:'+id+':'+member),from:id,to:member,kind:'membership',condition:'',effect:'',source_ref:group.source_ref});
}

// Additional connections reference already authored cards; no new world entities.
for (const connection of config.additional_connections || []) {
  if (!nodes.has(connection.from) || !nodes.has(connection.to) || !connection.source_ref || !connection.condition ||
      !['access','world_event','preparation'].includes(connection.kind)) {
    fail('Invalid authored connection: ' + connection.id); continue;
  }
  edges.push({...connection});
  const sourceRecord=metadata.get(primary.get(connection.from));
  if (!sourceRecord) { fail('Connection without a primary RAG card: '+connection.from); continue; }
  const fromNode=nodes.get(connection.from),toNode=nodes.get(connection.to);
  const relatedEntities=[fromNode,toNode].filter(n=>['actor','item','clue'].includes(n.kind)).map(n=>n.id);
  const relatedScenes=[fromNode,toNode].filter(n=>['scene','location','event'].includes(n.kind)).map(n=>n.id);
  const guidance=add({
    key:'graph-connection:'+connection.id,
    type:'director_note',
    title:`Połączenie grafu · ${fromNode.label} → ${toNode.label}`,
    content:[`Od: ${connection.from}`,`Do: ${connection.to}`,`Rodzaj: ${connection.kind}`,
      `Warunek / przekazywana informacja: ${connection.condition}`,
      ...(connection.effect?[`Skutek projektowy: ${connection.effect}`]:[]),
      `Źródło / status: ${connection.source_ref}`].join('\n'),
    entities:relatedEntities,scenes:relatedScenes,topics:['graph-edge',connection.kind],
    triggers:['graph_edge',connection.kind],ref:connection.source_ref,refs:[connection.from,connection.to],
    // Time-driven world events may need to be checked from a different active scene.
    // Semantic ranking and the normal context budget still select only relevant cards.
    availability:'always',priority:2,
  });
  sourceRecord.refs=uniq([...sourceRecord.refs,connection.to,connection.id]);
  primary.set(connection.id,guidance.record_id);
}
for (const annotation of config.context_nodes || []) {
  const entry=nodes.get(annotation.id);
  if (!entry || entry.kind!=='scene' || !annotation.reason) { fail('Invalid context scene: '+annotation.id); continue; }
  Object.assign(entry,{navigation_role:'context_only',navigation_reason:annotation.reason});
}

// Explicit authoring annotations refine reviewed edges; never infer travel from endpoint types.
for (const annotation of config.edge_semantics || []) {
  const matches = edges.filter(e => e.id === annotation.id);
  if (matches.length !== 1 || !annotation.source_ref || !['access','information','encounter','world_event'].includes(annotation.kind)) {
    fail('Invalid explicit edge annotation: ' + annotation.id); continue;
  }
  matches[0].kind = annotation.kind;
  matches[0].semantics_source_ref = annotation.source_ref;
}
for (const id of config.start_nodes || []) {
  const entry = nodes.get(id);
  if (!entry || !['scene','location'].includes(entry.kind)) { fail('Invalid start node: ' + id); continue; }
  entry.start = true;
}

// Existing manual cards stay untouched. Generated files are tracked with hashes to protect edits.
const recordsDir=path.join(directory,'records');
if(fs.lstatSync(recordsDir).isSymbolicLink()||!fs.lstatSync(recordsDir).isDirectory()) throw new Error('records must be a regular internal directory');
const receiptPath=path.join(directory,'preparation/generated-files.json');
const previous=fs.existsSync(receiptPath)?readJson(receiptPath):{};
const manual=[];
for(const name of fs.readdirSync(recordsDir)) {
  if (!name.endsWith('.yaml')) fail('Unexpected file in records: '+name);
  if(fs.lstatSync(path.join(recordsDir,name)).isSymbolicLink()||!fs.lstatSync(path.join(recordsDir,name)).isFile()) { fail('Record must be a regular file: '+name); continue; }
  if (Object.hasOwn(previous,name)) {
    if (hash(fs.readFileSync(path.join(recordsDir,name)))!==previous[name]) fail('Generated card was edited; preserve/move it to manual ownership before rebuilding: '+name);
    continue;
  }
  manual.push(yaml.load(fs.readFileSync(path.join(recordsDir,name),'utf8'),{schema:yaml.JSON_SCHEMA}));
}
for(const r of records) r.links=uniq(metadata.get(r.record_id).refs.map(id=>primary.get(id)).filter(id=>id&&id!==r.record_id));
// Explicit preparation policy: actor atoms require their bounded overview and uncertainty card.
// Narrative graph connections remain ordinary links, never automatic context dependencies.
if (config.context_dependencies?.actor_profiles === true) {
  for (const actor of actors) {
    const prerequisites=records.filter(r=>r.tags.entities.length===1&&r.tags.entities[0]===actor.id&&
      ((r.record_type==='actor'&&r.tags.topics.includes('intent'))||r.tags.topics.includes('uncertainty')));
    for (const record of records.filter(r=>r.record_type==='actor'&&r.tags.entities.length===1&&r.tags.entities[0]===actor.id)) {
      record.context_links=prerequisites.map(r=>r.record_id).filter(id=>id!==record.record_id).sort();
      record.links=uniq([...record.links,...record.context_links]);
    }
  }
}
const payload={schema_version:1,adventure_id:manifest.adventure_id,edition_fingerprint:manifest.edition_fingerprint,records:[...manual,...records]};
const checked=validateDossierRagPayload(payload);
if(!checked.ok) fail(checked.errors.join('\n'));
const missingEndpoints=uniq(edges.flatMap(e=>[e.from,e.to]).filter(id=>!nodes.has(id)));
for(const f of supplement.scene_frames) for(const id of [...f.locations,...f.actors,...f.objects]) if(!nodes.has(id)) fail('Unknown frame reference '+f.id+' -> '+id);
for(const i of supplement.items) for(const id of [i.location,...i.clues].filter(Boolean)) if(!nodes.has(id)) fail('Unknown item reference '+i.id+' -> '+id);
for(const h of supplement.handouts) if(!supplement.items.some(i=>i.id===h.object_id)) fail('Handout without a physical source '+h.id);
for(const id of missingEndpoints) {
  const relevant=edges.filter(e=>e.from===id||e.to===id);
  node(id,id,'reference',relevant.map(e=>e.source_ref).join(';'),'Punkt wymieniony w grafie źródłowym. Nie otrzymał osobnej karty; jego treść jest opisana na krawędziach.');
}
const allApprovals=payload.records.reduce((a,r)=>{a[r.evidence.approval]=(a[r.evidence.approval]||0)+1;return a;},{});
const readiness={
  authored:true, production_ready:false, human_approval:manifest.approval,
  counts:{actors:actors.length,actor_fields:actors.reduce((s,a)=>s+Object.keys(a.fields).length,0),rag_records:payload.records.length,
    locations:tables.get('Lokacje z mapy i scenariusza').length,clues:tables.get('Rejestr tropów i źródeł informacji').length,
    source_events:tables.get('Zdarzenia i zegar świata').length,source_edges:tables.get('Zweryfikowane krawędzie grafu').length,
    actor_relations:tables.get('Sieć relacji i zależności').length,items:supplement.items.length,scene_frames:supplement.scene_frames.length,
    graph_nodes:nodes.size,graph_edges:edges.length,mechanic_hooks:(supplement.mechanic_hooks||[]).length,
    unique_inventory_items:supplement.items.filter(i=>i.inventory_binding).length,
    actor_identity_bindings:records.filter(r=>r.actor_binding).length,
    approach_examples:supplement.scene_frames.reduce((sum,f)=>sum+f.choices.length,0),
    worldbuilding_categories:16,narrative_pillars:36,mechanics:DOSSIER_MECHANICS.length},
  approvals:allApprovals,
  reference_only_nodes:missingEndpoints,
  runtime_progress:[
    {label:'PDF jako lokalny dekoder',status:'kod podłączony',detail:'WebCrypto odczytuje istniejący format STDP v1. Endpoint nie przyjmuje PDF; dostaje zatwierdzone opracowanie w JSON wyłącznie na lokalnym hoście.'},
    {label:'Zachowanie po imporcie',status:'kod podłączony',detail:'PDF, szyfrogram i oryginalny handout w IndexedDB. Odtworzenie RAG po restarcie/wygaśnięciu indeksu bez ponownego wgrywania pliku.'},
    {label:'Oryginalny arkusz',status:'odczyt lokalny potwierdzony',detail:'PDF 404, obraz 614 × 490. Dekoder PDF.js + OpenJPEG; kontrola hasha RGBA. Żaden fragment tekstu PDF nie jest pobierany do promptu.'},
    {label:'Zdobycie i późniejsze otwarcie',status:'kod podłączony',detail:'Tag Igora musi wskazać dopuszczony locator. Zapis wiadomości zachowuje ID i wydanie; obraz jest ładowany lokalnie. Sam retrieval nie oznacza posiadania.'},
    {label:'Pojedyncze przedmioty',status:'kod podłączony',detail:`${supplement.items.filter(i=>i.inventory_binding).length} kart ma stałą tożsamość egzemplarza: zdobycie, przekazanie, odłożenie, użycie i utrata. Wspólny resolver liczy zużycie. Zapis kampanii przechowuje właściciela; RAG otrzymuje aktualny stan wybranej karty także poza miejscem znalezienia. Przebieg w grze pozostaje do potwierdzenia.`},
    {label:'Odkrycie przedmiotu i późniejsze zabranie',status:'sprawdzony na danych testowych',detail:'Właściwy test, postać i miejsce odblokowują dostęp. Stan przetrwał pełny zapis i wczytanie w próbie PL/EN. Porażka i sukces innego testu nie dają przedmiotu. W pilocie dwie karty korzystają ze wspólnego warunku odkrycia; ich treść pozostaje do odbioru autorskiego.'},
    {label:'Karty NPC i aktualny rejestr postaci',status:'kod podłączony',detail:`${records.filter(r=>r.actor_binding).length} kart identyfikuje aktora po jego ID lub pełnej, jednoznacznej nazwie. RAG dołącza zapisany status, położenie, HP i nastawienie, jeśli rejestr NPC je zawiera. Nie tworzy statystyk ani nie zapisuje automatycznie nowych skutków grafu.`},
    {label:'Ciągłość po wczytaniu gry',status:'kod podłączony',detail:'Pełny zapis zachowuje właścicieli przedmiotów, metadane zdobytych handoutów, datę, godzinę, pogodę oraz istniejący termin zegara. To odtworzenie stanu, nie automat wydarzeń przygody.'}
  ],
  blockers:[
    {id:'approval',label:'Akceptacja opracowania przez autora',detail:'Generator zachowuje pending. Nie wpisuje fikcyjnego nazwiska ani daty akceptacji.'},
    {id:'local-import',label:'Przebieg na zatwierdzonym pakiecie pilota',detail:'Kod odszyfrowuje teczkę w przeglądarce i zachowuje PDF oraz szyfrogram w IndexedDB. Lokalny proces dostaje tylko opracowane dane teczki. Pełny przebieg import → start wymaga zatwierdzonego pakietu; równoważne pliki wydania nie są jeszcze obsługiwane.'},
    {id:'state',label:'Pozostałe skutki grafu w kampanii',detail:'Pojedyncze przedmioty mają podłączony zapis właściciela i położenia; RAG odczytuje aktualny rejestr NPC, a zapis gry zachowuje zegar. Pozostają zapasy/ilości, automatyczne skutki grafu dla NPC i obiektów świata oraz warunkowe zdarzenia zegara. Tekstowa karta sama nie wykonuje tych skutków.'},
    {id:'handout',label:'Przebieg zdobycia handoutu w rozgrywce',detail:'Ekstraktor, kontrola pikseli, lokalny magazyn, znacznik zdobycia i podgląd w czacie są podłączone w kodzie. Potwierdzono lokalny odczyt 614 × 490 px; cały przebieg na zatwierdzonym pilocie nie został jeszcze sprawdzony.'},
    {id:'media',label:'Zgodne portrety i ilustracje',detail:'Przygotowano cechy, głosy i kierunek wizualny. Obecne błędne materiały pozostają w kwarantannie; nie ma zatwierdzonego zestawu portretów i lokacji.'}
  ]
};
for (const id of uniq([...Object.keys(supplement.actor_transitions || {}), ...Object.keys(supplement.actor_initial_states || {})])) {
  if (!records.some(r => r.actor_binding?.entity_id === id)) fail('Actor transition target has no identity binding: ' + id);
}
const review={schema_version:1,title:config.title,gm:'Igor',source:sourceRelative,source_sha256:hash(source),supplement_sha256:hash(JSON.stringify(supplement)),
  manifest,readiness,actors,sections:[...tables].filter(([h])=>config.sections.some(x=>x[0]===h)||config.review_only_sections.includes(h)).map(([title,rows])=>({title,rows})),
  mechanics:DOSSIER_MECHANICS.map(m=>({...m,status:Object.entries(coverage || {}).find(([,v])=>Array.isArray(v)&&v.includes(m.auditArea))?.[0]})),
  supplement,visualProfile,graph:{nodes:[...nodes.values()],edges},record_index:payload.records.map(r=>({id:r.record_id,type:r.record_type,title:metadata.get(r.record_id)?.title||r.record_id,source_ref:r.evidence.source_ref,approval:r.evidence.approval})),
};

return {diagnostics, directory, manifest, payload, records, review, readiness, previous, receiptPath, recordsDir, metadata, primary, sourceNodeClaims, config, sourcePath, supplement, locationNameOwners};
}
