import { embeddingService } from '@/lib/embedding-service';
import { activateDossierRag, clearDossierRag, retrieveDossierRag } from './rag-runtime';
import { validateDossierRagPayload } from './rag-schema';
const fp='sha256:'+'d'.repeat(64);
const card=(id:string,more:Record<string,unknown>={})=>({schema_version:1,record_id:id,record_type:'fact',adventure_id:'dependency-test',edition_fingerprint:fp,language:'pl',content:id==='seed'?'RELEVANT seed':'DETAIL '+id,tags:{entities:[],scenes:[],mechanics:[],topics:[],triggers:[]},retrieval:{visibility:'gm_only',availability:'always',condition:null,priority:1},evidence:{provenance:'approved_design',source_ref:'authored fixture',status:'set',approval:'approved',approved_by:'test',approved_at:'2026-10-17'},links:[],...more});
const payload=(records:unknown[])=>({schema_version:1,adventure_id:'dependency-test',edition_fingerprint:fp,records});
const context=()=>({activationId:'dependency-test',adventureId:'dependency-test',editionFingerprint:fp,query:'QUERY',activeSceneIds:[],presentEntityIds:[],acquiredRecordIds:[],mechanicIds:[],limit:8});
const embed=jest.spyOn(embeddingService,'generateLocalEmbedding');
beforeEach(()=>{clearDossierRag('dependency-test');embed.mockImplementation(async(text)=>text.startsWith('RELEVANT')||text==='QUERY'?[1,0]:[0,1]);});
afterAll(()=>embed.mockRestore());
test('explicit dependency survives low similarity; ordinary link does not',async()=>{
 expect(await activateDossierRag('dependency-test','dependency-test',fp,payload([card('seed',{links:['detail','relation'],context_links:['detail']}),card('detail'),card('relation')]))).toEqual({ok:true,errors:[]});
 expect((await retrieveDossierRag(context())).map(x=>x.recordId)).toEqual(['seed','detail']);
});
test('cycles stop after one hop and count limits still apply',async()=>{
 await activateDossierRag('dependency-test','dependency-test',fp,payload([card('seed',{links:['detail'],context_links:['detail']}),card('detail',{links:['seed','third'],context_links:['seed','third']}),card('third')]));
 expect((await retrieveDossierRag(context())).map(x=>x.recordId)).toEqual(['seed','detail']);
 expect((await retrieveDossierRag({...context(),limit:1})).map(x=>x.recordId)).toEqual(['seed']);
});
test('schema rejects unknown, duplicate, unrelated dependencies and foreign edition',()=>{
 for(const deps of [['missing'],['detail','detail'],['unrelated']])expect(validateDossierRagPayload(payload([card('seed',{links:['detail'],context_links:deps}),card('detail')])).ok).toBe(false);
 expect(validateDossierRagPayload(payload([card('seed',{links:['detail'],context_links:['detail']}),card('detail',{edition_fingerprint:'foreign'})])).ok).toBe(false);
});
test('unapproved and unrevealed cards stay unavailable despite dependency',async()=>{
 const pending=card('pending');pending.evidence={...pending.evidence,approval:'pending'};
 await activateDossierRag('dependency-test','dependency-test',fp,payload([card('seed',{links:['pending','hidden'],context_links:['pending','hidden']}),pending,card('hidden',{record_type:'handout_locator',local_handout:{kind:'embedded_image',pdf_page:1,width:1,height:1,rgba_sha256:'a'.repeat(64),title:'Autorski handout',audience:'party'},retrieval:{visibility:'gm_only',availability:'after_reveal',condition:{all:[{kind:'reveal_acquired',id:'hidden'}]},priority:1}})]));
 expect((await retrieveDossierRag(context())).map(x=>x.recordId)).toEqual(['seed']);
});

test('diagnostics distinguish access gates from count and character budgets',async()=>{
 const hidden=card('hidden',{record_type:'handout_locator',local_handout:{kind:'embedded_image',pdf_page:1,width:1,height:1,rgba_sha256:'a'.repeat(64),title:'Autorski handout',audience:'party'},retrieval:{visibility:'gm_only',availability:'after_reveal',condition:{all:[{kind:'reveal_acquired',id:'hidden'}]},priority:1}});
 expect((await activateDossierRag('dependency-test','dependency-test',fp,payload([card('seed',{links:['hidden','detail'],context_links:['hidden','detail']}),hidden,card('detail')]))).ok).toBe(true);
 const decisions:Array<{from:string;to:string;reason:string}>=[];
 const result=await retrieveDossierRag({...context(),limit:1,onDependencyDecision:d=>decisions.push(d)});
 expect(result.map(x=>x.recordId)).toEqual(['seed']);
 expect(decisions.map(d=>[d.to,d.reason])).toEqual([['hidden','unavailable'],['detail','budget']]);
 decisions.length=0;
 const chars=await retrieveDossierRag({...context(),maxContextChars:'RELEVANT seed'.length,onDependencyDecision:d=>decisions.push(d)});
 expect(chars.reduce((n,r)=>n+r.content.length,0)).toBeLessThanOrEqual('RELEVANT seed'.length);
 expect(decisions.find(d=>d.to==='detail')?.reason).toBe('budget');
 expect(await retrieveDossierRag({...context(),editionFingerprint:'other-edition'})).toEqual([]);
});
test('shared dependencies are deduplicated and selection is stable',async()=>{
 const records=[card('seed',{links:['detail'],context_links:['detail']}),card('second',{content:'RELEVANT second',links:['detail'],context_links:['detail']}),card('detail')];
 expect((await activateDossierRag('dependency-test','dependency-test',fp,payload(records))).ok).toBe(true);
 const first=await retrieveDossierRag(context());
 expect(first.filter(x=>x.recordId==='detail')).toHaveLength(1);
 expect(await retrieveDossierRag(context())).toEqual(first);
 clearDossierRag('dependency-test');
 await activateDossierRag('dependency-test','dependency-test',fp,payload([...records].reverse()));
 expect(await retrieveDossierRag(context())).toEqual(first);
});
test('legacy records without context_links keep ordinary selection',async()=>{
 expect((await activateDossierRag('dependency-test','dependency-test',fp,payload([card('seed',{links:['detail']}),card('detail')]))).ok).toBe(true);
 expect((await retrieveDossierRag(context())).map(x=>x.recordId)).toEqual(['seed']);
});
