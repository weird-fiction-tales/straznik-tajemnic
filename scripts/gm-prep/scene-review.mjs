/** Pure author review groups. Input contains authored records, never original PDF bytes. */
import { createHash } from 'node:crypto';

const DOMAINS = ['content', 'media', 'integration', 'playthrough'];
const STATUSES = ['accepted', 'rework', 'deferred'];
const BOOKKEEPING = new Set(['approval', 'approved_by', 'approved_at']);
const unsafeIds = new Set(['__proto__', 'prototype', 'constructor']);
function identity(value, label = 'id') {
  if (typeof value !== 'string' || value.length > 200 || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(value) || unsafeIds.has(value)) {
    throw new Error('Invalid ' + label);
  }
  return value;
}
const canonical = value => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
};
const hash = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const uniq = values => [...new Set(values)].sort();
const list = value => Array.isArray(value) ? value : [];
function recordSnapshot(record) {
  const result = structuredClone(record);
  if (result.evidence) result.evidence = Object.fromEntries(Object.entries(result.evidence).filter(([key]) => !BOOKKEEPING.has(key)));
  return result;
}
function assertDocument(model, document) {
  if (!document || document.schema_version !== 1 || !Array.isArray(document.decisions)) throw new Error('Invalid decisions document');
  if (document.adventure_id !== model.adventure_id) throw new Error('Decision adventure mismatch');
  if (document.edition_fingerprint !== model.edition_fingerprint) throw new Error('Decision edition mismatch');
}
function validateDecision(model, decision, requireFresh = false) {
  if (!decision || typeof decision !== 'object') throw new Error('Invalid decision');
  identity(decision.group_id, 'group id');
  const group = model.groups.find(g => g.id === decision.group_id);
  if (!group) throw new Error('Unknown decision group');
  if (!DOMAINS.includes(decision.domain) || !STATUSES.includes(decision.status)) throw new Error('Invalid decision domain/status');
  if (typeof decision.snapshot !== 'string' || !/^[a-f0-9]{64}$/.test(decision.snapshot)) throw new Error('Invalid snapshot');
  if (requireFresh && group.snapshot !== decision.snapshot) throw new Error('Stale snapshot');
  if (typeof decision.reviewer !== 'string' || !decision.reviewer.trim() || decision.reviewer.length > 200) throw new Error('Explicit reviewer required');
  if (typeof decision.at !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(decision.at) ||
      !Number.isFinite(Date.parse(decision.at)) || new Date(Date.parse(decision.at.slice(0,10))).toISOString().slice(0,10) !== decision.at.slice(0,10)) {
    throw new Error('Explicit valid review date required');
  }
  if (decision.comment !== undefined && (typeof decision.comment !== 'string' || decision.comment.length > 10000)) throw new Error('Invalid decision comment');
  if (group.kind === 'exceptions' && decision.domain === 'content' && decision.status === 'accepted') throw new Error('Resolve exceptions before accepting content');
  return {
    group_id:decision.group_id, snapshot:decision.snapshot, domain:decision.domain, status:decision.status,
    reviewer:decision.reviewer.trim(), at:decision.at, ...(decision.comment !== undefined ? {comment:decision.comment} : {}),
  };
}

/** Each card has one approval owner. Shared references are display-only in scene groups. */
export function buildSceneReview({manifest, records, review = {}}) {
  manifest ??= review.manifest;
  if (!manifest || !Array.isArray(records)) throw new Error('Manifest and exact records required');
  identity(manifest.adventure_id, 'adventure id');
  if (typeof manifest.edition_fingerprint !== 'string' || !manifest.edition_fingerprint) throw new Error('Edition fingerprint required');
  const frames = list(review.supplement?.scene_frames ?? review.scene_frames);
  const seenFrames = new Set(), seenRecords = new Set();
  const groups = frames.map(frame => {
    identity(frame.id, 'frame id');
    if (seenFrames.has(frame.id)) throw new Error('duplicate frame id');
    seenFrames.add(frame.id);
    return {id:'scene:'+frame.id, title:String(frame.title || frame.id), kind:'scene', scene:structuredClone(frame), record_ids:[], reference_record_ids:[], records:[], issues:[]};
  });
  const shared = {id:'shared',title:'Wspólne i globalne',kind:'shared',scene:null,record_ids:[],reference_record_ids:[],records:[],issues:[]};
  const exceptions = {id:'exceptions',title:'Do przypisania i wyjaśnienia',kind:'exceptions',scene:null,record_ids:[],reference_record_ids:[],records:[],issues:[]};
  const owners = new Map(), references = new Map();
  for (const record of records) {
    identity(record.record_id, 'record id');
    if (seenRecords.has(record.record_id)) throw new Error('duplicate record id');
    seenRecords.add(record.record_id);
    if (record.adventure_id !== manifest.adventure_id) throw new Error('Record adventure mismatch');
    if (record.edition_fingerprint !== manifest.edition_fingerprint) throw new Error('Record edition mismatch');
    const scenes = list(record.tags?.scenes), entities = list(record.tags?.entities);
    const direct = groups.filter(g => scenes.includes(g.scene.id));
    const mapped = groups.filter(g => [...list(g.scene.locations), ...list(g.scene.node_ids)].some(id => scenes.includes(id)));
    const entityGroups = groups.filter(g => [...list(g.scene.actors), ...list(g.scene.objects), ...list(g.scene.node_ids)].some(id => entities.includes(id)));
    let owner, issue;
    if (direct.length > 1) { owner=exceptions; issue='ambiguous_scene_frames'; }
    else if (direct.length === 1) owner=direct[0];
    else if (mapped.length > 1) { owner=exceptions; issue='ambiguous_scene_locations'; }
    else if (mapped.length === 1) owner=mapped[0];
    else if (scenes.length) { owner=exceptions; issue='unmapped_scene'; }
    else if (entityGroups.length === 1) owner=entityGroups[0];
    else if (entityGroups.length > 1) owner=shared;
    else if (entities.length) { owner=exceptions; issue='unmapped_entity'; }
    else owner=shared;
    owner.record_ids.push(record.record_id);
    owners.set(record.record_id,owner.id);
    if (issue) owner.issues.push({record_id:record.record_id,reason:issue});
    if (owner === shared) {
      const referring = entityGroups;
      for (const group of referring) group.reference_record_ids.push(record.record_id);
      references.set(record.record_id,referring.map(g => g.id));
    }
  }
  const byId = new Map(records.map(r => [r.record_id,r]));
  const allGroups = [...groups,shared,exceptions];
  for (const group of allGroups) {
    const existing = new Set([...group.record_ids,...group.reference_record_ids]);
    for (const id of existing) {
      const record = byId.get(id);
      for (const linked of [...list(record.links),...list(record.context_links)]) {
        if (!byId.has(linked)) throw new Error('Unknown record reference: '+linked);
        if (!group.record_ids.includes(linked)) group.reference_record_ids.push(linked);
      }
    }
  }
  for (const group of allGroups) {
    group.record_ids.sort();
    group.reference_record_ids = uniq(group.reference_record_ids);
    group.records = group.record_ids.map(id => structuredClone(byId.get(id)));
    const visibleIds = uniq([...group.record_ids,...group.reference_record_ids]);
    const relevantFrames = group.kind === 'scene' ? [group.scene] :
      groups.filter(g => g.reference_record_ids.some(id => group.record_ids.includes(id))).map(g=>g.scene);
    const nodeIds = new Set(relevantFrames.flatMap(f=>[f.id,...list(f.locations),...list(f.actors),...list(f.objects),...list(f.node_ids)]));
    for (const id of visibleIds) for (const value of [...list(byId.get(id).tags?.entities),...list(byId.get(id).tags?.scenes)]) nodeIds.add(value);
    const graph = review.graph || {};
    const edges = list(graph.edges).filter(e=>nodeIds.has(e.from)||nodeIds.has(e.to));
    for (const edge of edges) { nodeIds.add(edge.from); nodeIds.add(edge.to); }
    group.graph = {nodes:list(graph.nodes).filter(n=>nodeIds.has(n.id)),edges};
    group.reference_records = group.reference_record_ids.map(id=>structuredClone(byId.get(id)));
    group.policies = structuredClone(list(review.supplement?.policies));
    group.media_manifest = structuredClone(review.media_manifest || {assets:[]});
    group.snapshot = hash({
      adventure_id:manifest.adventure_id, edition_fingerprint:manifest.edition_fingerprint, language:manifest.language,
      id:group.id, kind:group.kind, record_ids:group.record_ids, reference_record_ids:group.reference_record_ids,
      records:visibleIds.map(id=>recordSnapshot(byId.get(id))),
      scenes:relevantFrames, issues:group.issues,
      index:list(review.record_index).filter(r=>visibleIds.includes(r.id)).map(r=>Object.fromEntries(Object.entries(r).filter(([key])=>!BOOKKEEPING.has(key)))),
      graph:group.graph, policies:group.policies, media_manifest:group.media_manifest,
    });
  }
  return {
    schema_version:1, adventure_id:manifest.adventure_id, edition_fingerprint:manifest.edition_fingerprint,
    groups:allGroups,
    coverage:{total:records.length,owned:owners.size,unowned:records.length-owners.size,duplicate_owners:0,
      shared:shared.record_ids.length,exceptions:exceptions.record_ids.length},
    errors:exceptions.issues.map(issue=>issue.reason+':'+issue.record_id),
  };
}

/** Add/replace only the explicitly selected domain; all other domain decisions remain separate. */
export function recordDecision(model, document, input) {
  const validated = importSceneDecisions(model, JSON.stringify(document));
  const next = validateDecision(model,input,true);
  validated.decisions = validated.decisions.filter(d => d.group_id !== next.group_id || d.domain !== next.domain);
  validated.decisions.push(next);
  return validated;
}

/** Stale entries remain visible after import, but cannot authorize current records. */
export function importSceneDecisions(model, json) {
  return validateSceneDecisionDocument(model,json);
}
export function exportSceneDecisions(model, document) {
  return JSON.stringify(importSceneDecisions(model,document),null,2)+'\n';
}

/** Pass generated records, or generatedRecordIds when records also include manual cards. */
export function applyContentApprovals({manifest, records, review, decisions, generatedRecordIds}) {
  const model = buildSceneReview({manifest,records,review});
  const document = decisions ? importSceneDecisions(model,decisions) :
    {schema_version:1,adventure_id:model.adventure_id,edition_fingerprint:model.edition_fingerprint,decisions:[]};
  const approvals = new Map();
  for (const group of model.groups) {
    const decision = document.decisions.find(d => d.group_id === group.id && d.domain === 'content' &&
      d.status === 'accepted' && d.snapshot === group.snapshot);
    if (decision) for (const id of group.record_ids) approvals.set(id,decision);
  }
  const generated = generatedRecordIds === undefined ? null : new Set(generatedRecordIds);
  return records.map(record => {
    const result = structuredClone(record);
    if (generated && !generated.has(record.record_id)) return result;
    const decision = approvals.get(record.record_id);
    result.evidence = {...result.evidence,approval:decision?'approved':'pending',
      approved_by:decision?.reviewer ?? null,approved_at:decision?.at ?? null};
    return result;
  });
}

/** This self-contained validator is embedded unchanged in the offline author page. */
export function validateSceneDecisionDocument(model, input) {
 const doc=typeof input==='string'?JSON.parse(input):structuredClone(input);
 if(!doc||doc.schema_version!==1||doc.adventure_id!==model.adventure_id||doc.edition_fingerprint!==model.edition_fingerprint||!Array.isArray(doc.decisions))throw Error('Invalid decisions document or adventure/edition mismatch');
 const seen=new Set();
 const decisions=doc.decisions.map(d=>{
  if(!d||typeof d.group_id!=='string'||d.group_id.length>200||!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(d.group_id)||['__proto__','prototype','constructor'].includes(d.group_id))throw Error('Invalid group id');
  const group=model.groups.find(g=>g.id===d.group_id);if(!group)throw Error('Unknown decision group');
  if(!['content','media','integration','playthrough'].includes(d.domain)||!['accepted','rework','deferred'].includes(d.status))throw Error('Invalid decision domain/status');
  if(typeof d.snapshot!=='string'||!/^[a-f0-9]{64}$/.test(d.snapshot))throw Error('Invalid snapshot');
  if(typeof d.reviewer!=='string'||!d.reviewer.trim()||d.reviewer.length>200)throw Error('Explicit reviewer required');
  if(typeof d.at!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(d.at)||!Number.isFinite(Date.parse(d.at))||new Date(Date.parse(d.at.slice(0,10))).toISOString().slice(0,10)!==d.at.slice(0,10))throw Error('Explicit valid review date required');
  if(d.comment!==undefined&&(typeof d.comment!=='string'||d.comment.length>10000))throw Error('Invalid comment');
  if(group.kind==='exceptions'&&d.domain==='content'&&d.status==='accepted')throw Error('Resolve exceptions before accepting content');
  const key=d.group_id+'|'+d.domain;if(seen.has(key))throw Error('Duplicate decision domain/group');seen.add(key);
  return {group_id:d.group_id,snapshot:d.snapshot,domain:d.domain,status:d.status,reviewer:d.reviewer.trim(),at:d.at,...(d.comment!==undefined?{comment:d.comment}:{})};
 });
 return {schema_version:1,adventure_id:model.adventure_id,edition_fingerprint:model.edition_fingerprint,decisions};
}
