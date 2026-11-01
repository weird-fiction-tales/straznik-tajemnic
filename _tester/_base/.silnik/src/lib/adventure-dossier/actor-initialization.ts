import { isRuntimeAuthorizedDossierRecord } from './runtime-authorization';
import type { NPC } from '../types';
import { type DossierRagPayload } from './rag-schema';
import { isDossierActorInitialState } from './actor-transition';

/** Hydrates only explicit opening facts in the existing NPC store. Never synthesizes statistics. */
export function initializeDossierActors(input:{
  payload:DossierRagPayload; sessionId:string; adventureId:string; editionFingerprint:string;
  now:Date; freshSession?:boolean; storage:Pick<Storage,'getItem'|'setItem'>;
}):{initialized:string[]} {
  const {payload}=input;
  if (!/^[a-zA-Z0-9._:/-]{1,200}$/.test(input.sessionId) || !Number.isFinite(input.now.getTime()) ||
    payload.adventure_id!==input.adventureId || payload.edition_fingerprint!==input.editionFingerprint) {
    throw new Error('DOSSIER_NPC_INITIALIZATION_BINDING');
  }
  const cards=payload.records.filter(r=>r.record_type==='actor' && r.actor_binding?.initial_state &&
    isRuntimeAuthorizedDossierRecord(r) && (r.evidence.approval === 'pending' || (r.evidence.approved_by && r.evidence.approved_at)));
  if (!cards.length) return {initialized:[]};
  let parsed:unknown;
  try {parsed=JSON.parse(input.storage.getItem('gm_npcs') ?? '[]');}
  catch {throw new Error('DOSSIER_NPC_STORAGE_INVALID');}
  if (!Array.isArray(parsed) || parsed.some(n=>!n || typeof n!=='object' || Array.isArray(n) || typeof n.id!=='string')) {
    throw new Error('DOSSIER_NPC_STORAGE_INVALID');
  }
  const npcs:Record<string,unknown>[]=parsed;
  const next=[...npcs];
  const initialized:string[]=[];
  const archiveKey=(sessionId:string)=>`dossier_npcs_session:${encodeURIComponent(sessionId)}`;
  type Archive={schemaVersion:1;sessionId:string;adventureId:string|null;editionFingerprint:string|null;npcs:Record<string,unknown>[]};
  const readArchive=(sessionId:string):Archive|null=>{
    const raw=input.storage.getItem(archiveKey(sessionId));
    if(!raw) return null;
    let value:Archive;
    try { value=JSON.parse(raw); } catch {throw new Error('DOSSIER_NPC_ARCHIVE_INVALID');}
    if(!value || value.schemaVersion!==1 || value.sessionId!==sessionId || !Array.isArray(value.npcs) ||
      value.npcs.some(n=>!n || typeof n!=='object' || Array.isArray(n) || typeof n.id!=='string')) {
      throw new Error('DOSSIER_NPC_ARCHIVE_INVALID');
    }
    return value;
  };
  const archives=new Map<string,Archive>();
  let targetArchive:Archive|null|undefined;
  // Validate all canonical cards before deciding whether any session state can move.
  for(const card of cards) {
    const binding=card.actor_binding!;
    if(card.adventure_id!==input.adventureId || card.edition_fingerprint!==input.editionFingerprint ||
      !isDossierActorInitialState(binding.initial_state) || card.tags.entities.length!==1 || card.tags.entities[0]!==binding.entity_id ||
      payload.records.filter(r=>r.actor_binding?.entity_id===binding.entity_id).length!==1) {
      throw new Error('DOSSIER_NPC_INITIALIZATION_CARD');
    }
  }
  for(const card of cards) {
    const binding=card.actor_binding!;
    const initial=binding.initial_state;
    if(card.adventure_id!==input.adventureId || card.edition_fingerprint!==input.editionFingerprint ||
      !isDossierActorInitialState(initial) || card.tags.entities.length!==1 || card.tags.entities[0]!==binding.entity_id ||
      payload.records.filter(r=>r.actor_binding?.entity_id===binding.entity_id).length!==1) {
      throw new Error('DOSSIER_NPC_INITIALIZATION_CARD');
    }
    const matches=npcs.filter(n=>n.id===binding.entity_id);
    if(matches.length>1) throw new Error('DOSSIER_NPC_ID_AMBIGUOUS');
    let existing:Record<string,unknown>|undefined=matches[0];
    const foreignSession=existing?.sessionId && existing.sessionId!==input.sessionId ? existing.sessionId : undefined;
    if(foreignSession!==undefined && typeof foreignSession!=='string') throw new Error('DOSSIER_NPC_STORAGE_INVALID');
    if(foreignSession || !existing) {
      if(targetArchive===undefined) targetArchive=readArchive(input.sessionId);
      if(!input.freshSession && targetArchive) {
        if(targetArchive.adventureId!==input.adventureId || targetArchive.editionFingerprint!==input.editionFingerprint) {
          throw new Error('DOSSIER_NPC_ARCHIVE_BINDING');
        }
        const saved=targetArchive.npcs.filter(n=>n.id===binding.entity_id);
        if(saved.length!==1 || saved[0].sessionId!==input.sessionId) throw new Error('DOSSIER_NPC_ARCHIVE_INVALID');
        existing=saved[0];
      } else if(foreignSession && !input.freshSession) {
        throw new Error('DOSSIER_NPC_SESSION_CONFLICT');
      } else if(foreignSession) {
        // Fresh play never inherits death, injuries, movement, effects or other played state.
        existing=undefined;
      }
      if(foreignSession) {
        const previous=readArchive(foreignSession);
        archives.set(foreignSession,{schemaVersion:1,sessionId:foreignSession,
          adventureId:previous?.adventureId ?? null,editionFingerprint:previous?.editionFingerprint ?? null,npcs});
      }
      if(existing && existing!==matches[0]) {
        if(matches[0]) next[next.indexOf(matches[0])]=existing; else next.push(existing);
        initialized.push(binding.entity_id);
        continue;
      }
    }
    // Even empty arrays or unknown status may be deliberate results of play. Do not repair them from opening facts.
    if(existing && ['status','locationId','location','statusEffects'].some(k=>existing[k]!==undefined)) continue;
    if(existing?.tags!==undefined && (!Array.isArray(existing.tags) || !existing.tags.every(t=>typeof t==='string'))) {
      throw new Error('DOSSIER_NPC_STORAGE_INVALID');
    }
    const npc={...existing,id:binding.entity_id,name:existing?.name ?? binding.name,
      sessionId:input.sessionId,status:initial!.status,locationId:initial!.location_id,location:initial!.location_name,
      statusEffects:initial!.effects.map(effect=>({...effect,type:'other',timestamp:input.now.toISOString()})),
      tags:existing?.tags ?? [],createdAt:existing?.createdAt ?? input.now.toISOString(),updatedAt:input.now.toISOString()};
    if(matches[0]) next[next.indexOf(matches[0])]=npc; else next.push(npc);
    initialized.push(binding.entity_id);
  }
  // Validate every candidate before one write, so a later conflict never leaves a partially initialized store.
  if(initialized.length) {
    // Archive first: a storage failure cannot discard the currently active session.
    for(const [sessionId,archive] of archives) input.storage.setItem(archiveKey(sessionId),JSON.stringify(archive));
    input.storage.setItem(archiveKey(input.sessionId),JSON.stringify({schemaVersion:1,sessionId:input.sessionId,
      adventureId:input.adventureId,editionFingerprint:input.editionFingerprint,npcs:next}));
    input.storage.setItem('gm_npcs',JSON.stringify(next));
  }
  return {initialized};
}

/** Shared snapshot for the opening request and subsequent turns. */
export function loadNpcSnapshot(): NPC[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem('gm_npcs') || '[]');
    return Array.isArray(parsed) ? (parsed as NPC[]) : [];
  } catch {
    return [];
  }
}
