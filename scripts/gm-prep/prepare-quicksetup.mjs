#!/usr/bin/env node
/** Lossless local DRAFT adapter for the two approved structured QuickSetup sources. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {buildSceneReview, importSceneDecisions, applyContentApprovals} from './scene-review.mjs';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runtime = path.join(repository, '_tester/_base/.silnik');
const outputRoot = path.join(runtime, 'test-results/two-quicksetup/authoring');
const require = createRequire(path.join(runtime, 'package.json'));
const yaml = require('js-yaml');
const ts = require('typescript');
const oldExtension = require.extensions['.ts'];
let validateDossierRagPayload, loadDossierAuthoringDirectory, resolveAdventureAsset;
try {
  require.extensions['.ts'] = (module, filename) => {
    if (!filename.startsWith(path.join(runtime, 'src/lib/adventure-dossier/')) &&
        !['time-manager.ts', 'dice-utils.ts', 'handout-resolver.ts', 'immersion/adventure-asset-resolver.ts'].some(name => filename === path.join(runtime, 'src/lib', name))) {
      throw new Error('Unexpected TypeScript dependency: ' + filename);
    }
    module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true},
      fileName: filename,
    }).outputText, filename);
  };
  ({validateDossierRagPayload} = require(path.join(runtime, 'src/lib/adventure-dossier/rag-schema.ts')));
  ({loadDossierAuthoringDirectory} = require(path.join(runtime, 'src/lib/adventure-dossier/authoring-loader.ts')));
  ({resolveAdventureAsset} = require(path.join(runtime, 'src/lib/immersion/adventure-asset-resolver.ts')));
} finally {
  if (oldExtension) require.extensions['.ts'] = oldExtension;
  else delete require.extensions['.ts'];
}
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const pointerKey = key => String(key).replaceAll('~', '~0').replaceAll('/', '~1');
const unique = values => [...new Set(values)];
const sourceTypes = {nodes:'location', locations:'location', npcs:'actor', clues:'clue',
  handouts:'handout_locator', connections:'scene', doomClock:'pacing', secretsPool:'fact'};
const unknownIntegration = [
  {id:'mechanics', detail:'Źródło podaje nazwy wymaganych umiejętności, ale nie definiuje zatwierdzonych testów, poziomów trudności ani mechanicznych skutków.'},
  {id:'actor-state', detail:'Nie ustalono statystyk NPC ani warunków ich przejść. Obecność NPC w kilku węzłach to możliwy kontekst, nie automatyczne przemieszczenie.'},
  {id:'clock-runtime', detail:'Etapy i termin zegara to kanon źródła. Automatyczne skutki w zapisie kampanii wymagają osobnej weryfikacji integracji.'},
  {id:'media-triggers', detail:'Powiązanie handoutu z węzłem nie ustala warunku odkrycia, przyznania graczom ani odtworzenia audio.'},
  {id:'media-quality', detail:'Obecność pliku i wynik resolvera nie potwierdzają treści, zgodności z epoką, jakości obrazu ani odtwarzania.'},
  {id:'import-binding', detail:'Fingerprint identyfikuje bajty JSON, nie rozpoznany PDF. Nie ustalono tożsamości wydania PDF ani gotowego pakietu importu.'},
];

/** Canonical values remain intact JSON, not summaries or invented authoring facts. */
export function prepareQuicksetup(sourceText, {sourceRef, root = repository}) {
  const source = JSON.parse(sourceText);
  if (!source.id || !source.title || !Array.isArray(source.nodes)) throw new Error('Expected structured QuickSetup source');
  const nodeIds = new Set(source.nodes.map(n => n.id));
  const npcIds = new Set(source.npcs.map(n => n.id));
  const locationIds = new Set(source.locations.map(n => n.id));
  const clueIds = new Set(source.clues.map(n => n.id));
  const assertRef = (ids, id, kind) => { if (id && !ids.has(id)) throw new Error('Unknown ' + kind + ': ' + id); };
  for (const node of source.nodes) {
    assertRef(locationIds, node.locationId, 'location');
    for (const id of node.npcIds || []) assertRef(npcIds, id, 'actor');
    for (const id of [...(node.availableClues || []), ...(node.leadInClueIds || []), ...(node.leadOutClueIds || [])]) assertRef(clueIds, id, 'clue');
  }
  for (const clue of source.clues) {
    assertRef(nodeIds, clue.sourceNodeId, 'node'); assertRef(nodeIds, clue.targetNodeId, 'node');
  }
  for (const edge of source.connections) {
    assertRef(nodeIds, edge.fromId, 'node'); assertRef(nodeIds, edge.toId, 'node'); assertRef(clueIds, edge.clueId, 'clue');
  }
  for (const handout of source.handouts) assertRef(nodeIds, handout.nodeId, 'node');

  const sourceHash = hash(sourceText), fingerprint = 'sha256:' + sourceHash;
  const manifest = {schema_version:1, dossier_id:source.id + '-quicksetup-draft', adventure_id:source.id,
    edition_id:'predefined-json-' + sourceHash.slice(0, 12), edition_fingerprint:fingerprint,
    language:'pl', source_ref:sourceRef, approval:'pending', approved_by:null, approved_at:null, records_directory:'records'};
  const sceneFrames = source.nodes.map((node, index) => ({
    id:node.id, title:node.title || node.name, focus:node.description, choices:[],
    state:node, actors:node.npcIds || [], locations:[node.locationId], objects:[],
    node_ids:[node.id], source_refs:[sourceRef + '#/nodes/' + index],
    framing:'initial_situation', order_constraint:null,
    route_refs:source.connections.flatMap((edge, i) => edge.fromId === node.id ? [sourceRef + '#/connections/' + i] : []),
  }));
  const records = [], sourceCoverage = [];
  const baseRecord = (pointer, type, value, {scenes = [], entities = []} = {}) => {
    const record = {schema_version:1, record_id:'quicksetup.' + hash(source.id + ':' + pointer).slice(0, 24),
      record_type:type, adventure_id:source.id, edition_fingerprint:fingerprint, language:'pl',
      content:JSON.stringify({pointer, value}),
      tags:{entities:unique(entities), scenes:unique(scenes), mechanics:[], topics:['canonical-source', pointer.split('/')[1]], triggers:[]},
      retrieval:{visibility:'gm_only', availability:'always', condition:null, priority:2},
      evidence:{provenance:'source_confirmed', source_ref:sourceRef + '#' + pointer, status:'set', approval:'pending', approved_by:null, approved_at:null},
      links:[]};
    if (record.content.length > 4000) {
      if (!value || typeof value !== 'object') throw new Error('Source scalar exceeds schema content limit: ' + pointer);
      for (const [key, child] of Object.entries(value)) baseRecord(pointer + '/' + pointerKey(key), type, child, {scenes,entities});
      return;
    }
    records.push(record); sourceCoverage.push({pointer, record_id:record.record_id});
  };
  for (const [key, value] of Object.entries(source)) {
    const type = sourceTypes[key] || 'fact';
    if (!Array.isArray(value) || value.length === 0) {baseRecord('/' + pointerKey(key), type, value); continue;}
    value.forEach((entry, index) => {
      let scenes = [], entities = [];
      if (key === 'nodes') scenes = [entry.id];
      if (key === 'locations') scenes = source.nodes.filter(n => n.locationId === entry.id).map(n => n.id);
      if (key === 'clues') scenes = [entry.sourceNodeId].filter(Boolean);
      if (key === 'handouts') scenes = [entry.nodeId].filter(Boolean);
      // Target nodes are cross references, not scene owners.
      if (key === 'connections') scenes = [entry.fromId];
      if (key === 'npcs') entities = [entry.id];
      baseRecord('/' + pointerKey(key) + '/' + index, type, entry, {scenes, entities});
    });
  }
  for (const gap of unknownIntegration) records.push({
    schema_version:1, record_id:'quicksetup.unknown.' + gap.id, record_type:'director_note', adventure_id:source.id,
    edition_fingerprint:fingerprint, language:'pl', content:gap.detail,
    tags:{entities:[], scenes:[], mechanics:[], topics:['unknown-integration', gap.id], triggers:[]},
    retrieval:{visibility:'gm_only', availability:'always', condition:null, priority:3},
    evidence:{provenance:'source_derived', source_ref:sourceRef + '#', status:'unspecified', approval:'pending', approved_by:null, approved_at:null}, links:[],
  });
  const payload = {schema_version:1, adventure_id:source.id, edition_fingerprint:fingerprint, records};
  const validation = validateDossierRagPayload(payload);
  if (!validation.ok) throw new Error(validation.errors.join('\n'));
  const media = inventoryMedia(source, sourceRef, root);
  const readiness = {authored:true, status:'DRAFT', production_ready:false, human_approval:'pending',
    counts:{rag_records:records.length, locations:source.locations.length, actors:source.npcs.length, clues:source.clues.length,
      scene_frames:sceneFrames.length, handouts:source.handouts.length, connections:source.connections.length},
    blockers:unknownIntegration, approvals:{pending:records.length}};
  const graphNodes = [
    ...source.nodes.map((n, i) => ({id:n.id,label:n.title || n.name,kind:'location',source_ref:sourceRef + '#/nodes/' + i})),
    ...source.npcs.map((n, i) => ({id:n.id,label:n.name,kind:'actor',source_ref:sourceRef + '#/npcs/' + i})),
    ...source.clues.map((n, i) => ({id:n.id,label:n.name,kind:'clue',source_ref:sourceRef + '#/clues/' + i})),
  ];
  const review = {schema_version:1, title:source.title, status:'DRAFT', source:sourceRef, source_sha256:sourceHash,
    manifest, readiness, media_manifest:media, unknown_integration:unknownIntegration,
    supplement:{scene_frames:sceneFrames, items:[], policies:[], handouts:source.handouts},
    graph:{nodes:graphNodes, edges:source.connections.map((edge, i) => ({...edge,id:'route-' + i,from:edge.fromId,to:edge.toId,kind:'source-route',source_ref:sourceRef + '#/connections/' + i}))},
    record_index:records.map(r => ({id:r.record_id,type:r.record_type,title:r.evidence.source_ref,source_ref:r.evidence.source_ref,approval:r.evidence.approval})),
    source_coverage:sourceCoverage, canonical_source:source,
    grouping_policy:{initial_situations:'Węzły źródłowe opisują lokacje. Grupy nie narzucają kolejności scen ani działań graczy.',
      global:'Metadane, prawda scenariusza, sekrety i zegar pozostają globalne.',
      shared:'NPC przypisani do kilku węzłów zachowują jedną kartę z wieloma kontekstami.',
      exceptions:'Nieustalone mechaniki, warunki mediów i integracja pozostają jawne i niezatwierdzone.'}};
  return {source, sourceText, records, payload, manifest, review, media, validation,
    provenance:{schema_version:1, source:sourceRef, source_sha256:sourceHash, fingerprint_kind:'structured-json-bytes',
      source_coverage:sourceCoverage, pdf_identity:'unknown', approval:'pending', converter:'scripts/gm-prep/prepare-quicksetup.mjs'}};
}

function inventoryMedia(source, sourceRef, root) {
  const publicRoot = path.join(root, '_tester/_base/.silnik/public');
  const assets = new Map();
  const add = (url, ref, origin, kind, extra = {}) => {
    if (typeof url !== 'string' || !url) return;
    const valid = url.startsWith('/') && !url.startsWith('//') && !url.split('/').includes('..');
    const file = valid ? path.join(publicRoot, url.slice(1)) : null;
    const present = file && fs.existsSync(file) && fs.statSync(file).isFile();
    const existing = assets.get(url);
    if (existing) {existing.source_refs = unique([...existing.source_refs, ref]); return;}
    assets.set(url, {url,kind,origin,source_refs:[ref],required:origin === 'scenario-json',
      filesystem_path:file ? path.relative(root,file) : null, filesystem_status:valid ? (present?'present':'missing'):'invalid-reference',
      sha256:present ? hash(fs.readFileSync(file)):null, quality:'unknown', playback:'unknown', approval:'pending', ...extra});
  };
  source.handouts.forEach((handout, i) => {
    for (const key of ['image','audioUrl','audioUrlPl','audioUrlEn']) if (handout[key]) {
      add(handout[key], sourceRef + '#/handouts/' + i + '/' + key, 'scenario-json', key === 'image'?'image':'audio',
        {handout_slug:handout.slug, node_id:handout.nodeId, trigger:'unknown'});
    }
  });
  const packRef = '_tester/_base/.silnik/public/adventure-packs/' + source.id + '/manifest.json';
  const packFile = path.join(root,packRef);
  let visualPack = {status:'missing',source:packRef,resolver:'adventure-asset-resolver',matches:[]};
  if (fs.existsSync(packFile)) {
    const packText = fs.readFileSync(packFile,'utf8'), pack = JSON.parse(packText);
    const queries = unique([...source.nodes.map(n=>n.id), ...source.npcs.flatMap(n=>[n.id,n.name]), ...source.clues.map(n=>n.id)]);
    const matches = queries.map(query => {
      const result = resolveAdventureAsset({slugOrQuery:query,manifest:pack});
      return {query,priority:result.priority,url:result.assetUrl,matched_asset_id:result.matchedAsset?.id || null};
    });
    visualPack = {status:'present',source:packRef,sha256:hash(packText),resolver:'adventure-asset-resolver',matches};
    pack.assets.forEach((asset,i) => {
      const storageFile = path.resolve(path.dirname(packFile),asset.file);
      const safeStorage = storageFile.startsWith(path.dirname(packFile) + path.sep);
      const stored = safeStorage && fs.existsSync(storageFile) && fs.statSync(storageFile).isFile();
      add('/adventure-packs/' + (pack.assetDirectory ?? pack.caseId) + '/' + asset.file,
        packRef + '#/assets/' + i + '/file', 'visual-pack-manifest', asset.file.endsWith('.mp3')?'audio':'image',
        {asset_id:asset.id,category:asset.category,trigger:'unknown',
          storage_path:safeStorage ? path.relative(root,storageFile) : null,
          storage_status:safeStorage ? (stored ? 'present' : 'missing') : 'invalid-reference',
          storage_sha256:stored ? hash(fs.readFileSync(storageFile)) : null});
    });
  }
  // Existing resolver explicitly supplies the opposite language variant for these two audio paths.
  const resolverRef = '_tester/_base/.silnik/src/lib/handout-resolver.ts';
  const resolverHash = hash(fs.readFileSync(path.join(root,resolverRef)));
  const baseLanguage = source.id === 'cien-nad-prabutami' ? 'pl' : 'en';
  for (const handout of source.handouts) if (handout.audioUrl) {
    const variant = handout.audioUrl.replace(/\.mp3$/, baseLanguage === 'pl' ? '-en.mp3' : '-pl.mp3');
    add(variant, resolverRef + '#AUDIO_VARIANTS', 'handout-resolver-variant', 'audio',
      {handout_slug:handout.slug,trigger:'unknown',resolver_source_sha256:resolverHash});
  }
  return {schema_version:1,status:'DRAFT',generation_calls:0,generation_cost:null,
    quality:'unknown',playback:'unknown',visual_pack:visualPack,
    handout_resolver:{source:resolverRef,sha256:resolverHash,status:'source-inspected',runtime_playback:'unknown'},
    assets:[...assets.values()]};
}

function assertPrivateOutput(directory) {
  const target = path.resolve(directory);
  const relative = path.relative(outputRoot,target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Output must be inside private authoring directory');
  let ancestor = target;
  while (ancestor !== path.dirname(ancestor)) {
    if (fs.existsSync(ancestor) && fs.lstatSync(ancestor).isSymbolicLink()) throw new Error('Output must use regular private authoring directories');
    ancestor = path.dirname(ancestor);
  }
  return target;
}

/** Writes draft YAML and validates it with the unchanged application authoring loader. */
function applyAuthorLedger(model, target) {
  const sceneReview = buildSceneReview({manifest:model.manifest, records:model.records, review:model.review});
  const ledgerPath = path.join(target,'preparation/scene-decisions.json');
  const empty = {schema_version:1,adventure_id:sceneReview.adventure_id,
    edition_fingerprint:sceneReview.edition_fingerprint,decisions:[]};
  let decisions = empty, stale = [], present = false;
  if (fs.existsSync(ledgerPath)) {
    if (!fs.lstatSync(ledgerPath).isFile() || fs.lstatSync(ledgerPath).isSymbolicLink()) throw new Error('Author ledger must be a regular file');
    present = true;
    const saved = JSON.parse(fs.readFileSync(ledgerPath,'utf8'));
    if (!saved || saved.schema_version !== 1 || typeof saved.adventure_id !== 'string' ||
        typeof saved.edition_fingerprint !== 'string' || !Array.isArray(saved.decisions)) throw new Error('Invalid author ledger');
    if (saved.adventure_id !== sceneReview.adventure_id || saved.edition_fingerprint !== sceneReview.edition_fingerprint) {
      stale = saved.decisions.map(decision=>({group_id:decision?.group_id,reason:'adventure_or_edition_changed'}));
    } else {
      const groups = new Map(sceneReview.groups.map(group=>[group.id,group]));
      const known = saved.decisions.filter(decision=>groups.has(decision?.group_id));
      stale = saved.decisions.filter(decision=>!groups.has(decision?.group_id)).map(decision=>({group_id:decision?.group_id,reason:'group_removed'}));
      decisions = importSceneDecisions(sceneReview,{...saved,decisions:known});
      stale.push(...decisions.decisions.filter(decision=>groups.get(decision.group_id).snapshot !== decision.snapshot)
        .map(decision=>({group_id:decision.group_id,reason:'group_snapshot_changed'})));
    }
  }
  const records = applyContentApprovals({manifest:model.manifest, records:model.records, review:model.review, decisions});
  const approvalIntegration = {ledger_present:present, stale_count:stale.length, stale_decisions:stale,
    approved_records:records.filter(record=>record.evidence.approval==='approved').length,
    manifest_approval:model.manifest.approval};
  const byId = new Map(records.map(record=>[record.record_id,record]));
  const readiness = {...model.review.readiness,
    approvals:records.reduce((counts,record)=>{const status=record.evidence.approval;counts[status]=(counts[status]||0)+1;return counts;},{}),
    approval_integration:approvalIntegration};
  return {...model, records, payload:{...model.payload,records}, review:{...model.review, readiness,
    approval_integration:approvalIntegration,
    record_index:model.review.record_index.map(entry=>({...entry,approval:byId.get(entry.id).evidence.approval}))}};
}

export async function writeQuicksetup(inputModel, directory) {
  const target = assertPrivateOutput(directory);
  const model = applyAuthorLedger(inputModel,target);
  const files = new Map([
    ['dossier.yaml',yaml.dump(model.manifest,{noRefs:true,lineWidth:110})],
    ['source.json',model.sourceText], ['payload.json',JSON.stringify(model.payload,null,2)+'\n'],
    ['preparation/review-data.json',JSON.stringify(model.review,null,2)+'\n'],
    ['preparation/media-manifest.json',JSON.stringify(model.media,null,2)+'\n'],
    ['preparation/provenance.json',JSON.stringify(model.provenance,null,2)+'\n'],
    ['preparation/readiness.json',JSON.stringify(model.review.readiness,null,2)+'\n'],
  ]);
  for (const record of model.records) files.set('records/' + record.record_id + '.yaml',yaml.dump(record,{noRefs:true,lineWidth:110}));
  const receipt = path.join(target,'preparation/generated-files.json');
  const previous = fs.existsSync(receipt) ? JSON.parse(fs.readFileSync(receipt,'utf8')) : {};
  // Preflight the entire write set before touching existing authoring. Never delete stale files.
  for (const name of Object.keys(previous)) if (!files.has(name)) throw new Error('Refuse regeneration with obsolete managed file: ' + name);
  for (const name of unique([...files.keys(), ...Object.keys(previous)])) {
    if (name.includes('..') || path.isAbsolute(name)) throw new Error('Invalid managed file path');
    const file = path.join(target,name);
    if (fs.existsSync(file) && (!Object.hasOwn(previous,name) || hash(fs.readFileSync(file)) !== previous[name])) {
      throw new Error('Refuse overwrite of unmanaged or edited authoring file: ' + name);
    }
  }
  fs.mkdirSync(path.join(target,'records'),{recursive:true,mode:0o700});
  fs.mkdirSync(path.join(target,'preparation'),{recursive:true,mode:0o700});
  for (const [name,text] of files) fs.writeFileSync(path.join(target,name),text,{mode:0o600});
  fs.writeFileSync(receipt,JSON.stringify(Object.fromEntries([...files].map(([name,text])=>[name,hash(text)])),null,2)+'\n',{mode:0o600});
  const loaded = await loadDossierAuthoringDirectory(target,model.manifest.edition_fingerprint);
  if (!loaded.ok || loaded.releaseReady) throw new Error('Draft validation failed: ' + loaded.errors.join('\n'));
  return loaded;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const base = path.resolve(process.argv[2] || outputRoot);
  for (const id of ['cien-nad-prabutami','englewood-murder-castle-1893']) {
    const sourceRef = 'data/adventures/predefined/' + id + '.json';
    const model = prepareQuicksetup(fs.readFileSync(path.join(repository,sourceRef),'utf8'),{sourceRef});
    const directory = path.join(base,id);
    const loaded = await writeQuicksetup(model,directory);
    console.log(JSON.stringify({directory,schema_valid:loaded.ok,release_ready:loaded.releaseReady,
      approval:model.manifest.approval,...model.review.readiness.counts,media_refs:model.media.assets.length}));
  }
}
