import { getAdventureById } from './adventures-data';
import { isCanonicalAdventureLocation, isAcceptedLocationLength, resolveCanonicalAdventureLocation, canonicalSceneIds, buildCanonicalLocationInstruction, extractLatestCanonicalLocationTag, isOffGraphLocationRequest } from './canonical-adventure-location';
import { sanitizeLocationName, extractLatestTagLocation } from './parsers/event-parser';
import { deriveSceneSensoryMemoryFromMessages } from './world-engine/adapter';
const id='cien-nad-prabutami';
const crypt=getAdventureById(id)!.graph!.locations.find(l=>l.id==='loc-prabuty-krypta')!.name;
test('exact canonical long name and id are accepted only for their active source adventure',()=>{
  expect(isCanonicalAdventureLocation(crypt,id)).toBe(true);
  expect(isCanonicalAdventureLocation('loc-prabuty-krypta',id)).toBe(true);
  for(const other of [undefined,'custom','missing','nawiedzony-dom']) {
    expect(isCanonicalAdventureLocation(crypt,other)).toBe(false);
    expect(isAcceptedLocationLength(crypt,other)).toBe(false);
  }
  for(const prose of [crypt+' i słychać krzyk.',crypt.toLowerCase(),'Przechodzę przez długi korytarz, a potem otwieram ciężkie drzwi.']) {
    expect(isAcceptedLocationLength(prose,id)).toBe(false);
    expect(extractLatestTagLocation('[LOKACJA: '+prose+']',id)).toBeNull();
  }
});
test('parser preserves canonical spelling and legacy no-context truncation',()=>{
  expect(sanitizeLocationName(crypt,id)).toBe(crypt);
  expect(sanitizeLocationName(crypt).length).toBeLessThanOrEqual(45);
  expect(extractLatestTagLocation('[LOKACJA: '+crypt+': Chłód]',id)).toEqual({name:crypt,description:'Chłód'});
  expect(extractLatestTagLocation('[LOCATION: '+crypt+' | Cold]',id)).toEqual({name:crypt,description:'Cold'});
});
test('F5 sensory restoration accepts canonical names with scope and rejects unrelated long prose',()=>{
  const messages=[{role:'assistant',content:'[LOKACJA: '+crypt+']'}];
  expect(deriveSceneSensoryMemoryFromMessages(messages,undefined,id).currentLocation).toBe(crypt);
  expect(deriveSceneSensoryMemoryFromMessages(messages).currentLocation).toBeFalsy();
  expect(deriveSceneSensoryMemoryFromMessages(messages,undefined,'custom').currentLocation).toBeFalsy();
  expect(deriveSceneSensoryMemoryFromMessages([{role:'assistant',content:'[LOKACJA: '+crypt+' i idziesz dalej.]'}],undefined,id).currentLocation).toBeFalsy();
});


test('the exact resolver accepts source node, location ID and long name; unknown never falls back to start',()=>{
 const expected={nodeId:'node-prabuty-krypta-climax',locationId:'loc-prabuty-krypta',name:crypt};
 for(const reference of [crypt,expected.nodeId,expected.locationId])expect(resolveCanonicalAdventureLocation(id,reference)).toEqual(expected);
 for(const reference of ['niskiej','Prabuty','foreign-room',crypt.toLowerCase()])expect(resolveCanonicalAdventureLocation(id,reference)).toBeNull();
 expect(resolveCanonicalAdventureLocation('englewood-murder-castle-1893',expected.locationId)).toBeNull();
 expect(canonicalSceneIds(null)).toEqual([]);
 const prompt=buildCanonicalLocationInstruction(id,null,'pl');
 expect(prompt).toContain('Potwierdzone powiązanie: null');expect(prompt).toContain('Nie wracaj domyślnie do sceny początkowej');
 expect(prompt).toContain(crypt);expect(prompt).toContain('loc-prabuty-krypta');
});

test('source-bound crypt activates actual local dossier cards and excludes initial office cards without model calls',async()=>{
 const {TextEncoder}=await import('node:util');const {webcrypto}=await import('node:crypto');
 Object.defineProperty(globalThis,'TextEncoder',{configurable:true,value:TextEncoder});
 Object.defineProperty(globalThis.crypto,'subtle',{configurable:true,value:webcrypto.subtle});
 const {createAuthoredPrabutyPayload}=await import('./adventure-dossier/authored-prabuty');
 const {fingerprintLocalDraftPayload,authorizeLocalDraftPayload}=await import('./adventure-dossier/runtime-authorization');
 const {activateDossierRag,retrieveDossierRag,clearDossierRag}=await import('./adventure-dossier/rag-runtime');
 const {embeddingService}=await import('./embedding-service');
 const embedding=jest.spyOn(embeddingService,'generateLocalEmbedding').mockResolvedValue([1,0]);
 try {
  const fp=await fingerprintLocalDraftPayload(createAuthoredPrabutyPayload('sha256:'+'0'.repeat(64)));
  const payload=await authorizeLocalDraftPayload(createAuthoredPrabutyPayload(fp),{adventureId:id,editionFingerprint:fp});
  expect((await activateDossierRag('canonical-location-rag',id,fp,payload)).ok).toBe(true);
  const base={activationId:'canonical-location-rag',adventureId:id,editionFingerprint:fp,query:'generator szczelina',presentEntityIds:[],acquiredRecordIds:[],mechanicIds:[],limit:20};
  const hits=await retrieveDossierRag({...base,activeSceneIds:canonicalSceneIds(resolveCanonicalAdventureLocation(id,crypt))});
  expect(hits.map(h=>h.recordId)).toContain('prabuty.scene.node-prabuty-krypta-climax');
  expect(hits.map(h=>h.recordId)).toContain('prabuty.world.obj-prabuty-rift');
  expect(hits.map(h=>h.recordId)).toContain('prabuty.world.obj-prabuty-generator');
  expect(hits.map(h=>h.recordId)).not.toContain('prabuty.scene.node-warszawa-redakcja');
  const unknown=await retrieveDossierRag({...base,activeSceneIds:[]});
  expect(unknown.some(h=>h.recordType==='scene'||h.recordId==='prabuty.world.obj-prabuty-rift')).toBe(false);
 } finally {clearDossierRag('canonical-location-rag');embedding.mockRestore();}
});


test('off-graph labels are bounded and separate from exact canonical identity and scope',()=>{
 const tag=extractLatestCanonicalLocationTag('[LOKACJA: OFF_GRAPH | Telefon przy szosie]',id);
 expect(tag).toEqual({mode:'off_graph',name:'Telefon przy szosie',nodeId:null,locationId:null,description:''});
 const request={mode:'off_graph',label:'Telefon przy szosie',adventureId:id,playthroughId:'p'};
 expect(isOffGraphLocationRequest(request,id,'p')).toBe(true);
 for(const value of [{...request,playthroughId:'foreign'},{...request,adventureId:'foreign'},{...request,label:'x'.repeat(121)},{...request,label:'bad\nlabel'},{...request,mode:'OFF_GRAPH'}])expect(isOffGraphLocationRequest(value,id,'p')).toBe(false);
 const history=[{role:'assistant',content:'[LOKACJA: loc-prabuty-krypta]'},{role:'assistant',content:'[LOKACJA: OFF_GRAPH | Telefon przy szosie]'}];
 expect(deriveSceneSensoryMemoryFromMessages(history,undefined,id,true).currentLocation).toBe('Telefon przy szosie');
});
