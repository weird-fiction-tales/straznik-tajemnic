import { embeddingService } from '@/lib/embedding-service';
import { localVectorStore } from '@/lib/vector-db/local-vector-store';
import { LOCAL_RAG_NAMESPACES } from '@/lib/vector-db/vector-types';
import { getCampaignMemoryLedgerStore, type CampaignMemoryLedgerStore } from './ledger-store';
import { embeddingSignature } from './index-queue';
import type { CampaignMemoryScope, CampaignMemorySearchResult, MemoryLedgerEntry } from './types';

export interface CampaignMemoryRetrieval {
  results: Array<CampaignMemorySearchResult & {sources:Array<'fts'|'like'|'semantic'>}>;
  promptSection:string;
  source:'hybrid'|'semantic'|'fts'|'like'|'none';
}
export interface MemoryRetrievalOptions {
  queryEmbedding?:number[]|null;
  locale?:'pl'|'en';
  recipientIds?:string[];
  sceneEntityIds?:string[];
}

import { sharedKnowledge } from './knowledge-policy';
export { currentMemoryEntries } from './knowledge-policy';

export async function searchCampaignMemory(scope:CampaignMemoryScope,query:string,
  ledger:CampaignMemoryLedgerStore=getCampaignMemoryLedgerStore(),options:MemoryRetrievalOptions={}):Promise<CampaignMemoryRetrieval> {
  const en=options.locale==='en';
  const allowed = sharedKnowledge(ledger.list(scope));
  const canonical=new Map(allowed.map(e=>[e.id,e]));
  const lexical=ledger.search(scope,query,80).filter(e=>canonical.has(e.id));
  const embedding=options.queryEmbedding!==undefined?options.queryEmbedding:
    await embeddingService.generateEmbedding(query,'RETRIEVAL_QUERY').catch(()=>null);
  let semantic:MemoryLedgerEntry[]=[];
  if(embedding) {
    try {
      const hits=await localVectorStore.query(LOCAL_RAG_NAMESPACES.campaign(scope.playthroughId),embedding,40,
        {embeddingSignature:embeddingSignature(),campaignDefinitionId:scope.campaignDefinitionId});
      semantic=hits.flatMap(hit=>{const e=canonical.get(hit.id);return e?[e]:[];});
    } catch { /* Lexical index remains authoritative. */ }
  }
  const ranked=new Map<string,{entry:MemoryLedgerEntry;rrf:number;sources:Array<'fts'|'like'|'semantic'>}>();
  function add(e:MemoryLedgerEntry,rank:number,source:'fts'|'like'|'semantic') {
    const previous=ranked.get(e.id);
    if(previous) {previous.rrf+=1/(61+rank);if(!previous.sources.includes(source))previous.sources.push(source);}
    else ranked.set(e.id,{entry:e,rrf:1/(61+rank),sources:[source]});
  }
  lexical.forEach((e,i)=>add(canonical.get(e.id)!,i,e.source));
  semantic.forEach((e,i)=>add(e,i,'semantic'));
  const entities=new Set(options.sceneEntityIds??[]);
  for(const {entry} of [...ranked.values()].slice(0,8)) if(entry.entityId)entities.add(entry.entityId);
  ledger.related(scope,[...entities],8).forEach((e,i)=>{if(canonical.has(e.id)&&!ranked.has(e.id))add(canonical.get(e.id)!,80+i,'fts');});
  // Corrections are context constraints even when the query matches old wording.
  allowed.filter(e=>e.status==='disproven'||e.status==='superseded').slice(-8)
    .forEach((e,i)=>{if(!ranked.has(e.id))add(e,80+i,'fts');});
  const scene=new Set(options.sceneEntityIds??[]);
  const priority=(e:MemoryLedgerEntry)=>e.status==='superseded'||e.status==='disproven'?2:e.entityId&&scene.has(e.entityId)?1:0;
  const ordered=[...ranked.values()].sort((a,b)=>priority(b.entry)-priority(a.entry)||b.rrf-a.rrf||b.entry.sequence-a.entry.sequence);
  const results:CampaignMemoryRetrieval['results']=[];
  const heading=en?'CAMPAIGN MEMORY: REVEALED EVIDENCE':'PAMIĘĆ KAMPANII: UJAWNIONE INFORMACJE';
  let promptSection=`\n## ${heading}\n`;
  for(const {entry:e,rrf,sources} of ordered) {
    const statusLabels = { confirmed: 'potwierdzone', unconfirmed: 'niepotwierdzone', disproven: 'obalone', superseded: 'zastąpione' };
    const label=e.role==='user'?(en?'player declaration, not confirmation':'deklaracja gracza, nie potwierdzenie'):
      e.status ? (en ? e.status : statusLabels[e.status]) : (en?'past narration':'wcześniejsza narracja');
    const line=`- [${label}; ${e.sourceMessageIds.join(', ')}] ${e.text}\n`;
    if(results.length>=8||Math.ceil((promptSection.length+line.length)/4)>1200)continue;
    results.push({...e,score:rrf,source:lexical.find(x=>x.id===e.id)?.source??'fts',sources});
    promptSection+=line;
  }
  const hasSemantic=results.some(e=>e.sources.includes('semantic'));
  const hasLexical=results.some(e=>e.sources.some(s=>s!=='semantic'));
  return {results,promptSection:results.length?promptSection:'',source:!results.length?'none':hasSemantic&&hasLexical?'hybrid':hasSemantic?'semantic':lexical[0]?.source??'fts'};
}
