import { createDossierResponseGate } from './response-gate';
import type { DossierRagPayload } from './rag-schema';
import type { Character } from '../types';
const fingerprint = 'sha256:' + 'a'.repeat(64);
const payload: DossierRagPayload = { schema_version: 1, adventure_id: 'neutral', edition_fingerprint: fingerprint, records: [] };
const input = () => ({payload, adventureId: 'neutral', editionFingerprint: fingerprint, playthroughId: 'p', turnId: 't',
  location: 'cell', now: new Date(0), gameTime: {year:1925,month:5,day:20,hour:10,minute:0}, era:'1920s',
  characters:[],activeCharacter:null,skillTests:[],skillRolls:[],isCurrent:()=>true});
const metadata = {type:'metadata' as const,dossierFinalizationToken:'token',dossierInventoryWritesAllowed:true};
beforeEach(()=>localStorage.clear());
test('keeps the candidate local and does not mutate storage',()=>{
 const gate=createDossierResponseGate(input());
 gate.validate('Observation.',metadata);
 expect(gate.token).toBe('token');expect(gate.candidate?.ok).toBe(true);expect(localStorage.length).toBe(0);
});
test('rejects changed NPC storage rather than overwriting a concurrent action',()=>{
 const gate=createDossierResponseGate(input());
 localStorage.setItem('gm_npcs',JSON.stringify([{id:'other'}]));
 expect(()=>gate.validate('Observation.',metadata)).toThrow('DOSSIER_STATE_CHANGED');
 expect(gate.candidate).toBeUndefined();
});
test('rejects an aborted/replaced request',()=>{
 const gate=createDossierResponseGate({...input(),isCurrent:()=>false});
 expect(()=>gate.validate('Observation.',metadata)).toThrow('DOSSIER_STATE_CHANGED');
});
test('requires the server acknowledgement protocol for generated narration',()=>{
 const gate=createDossierResponseGate(input());
 expect(()=>gate.validate('Observation.',{type:'metadata'})).toThrow('DOSSIER_FINALIZATION_REQUIRED');
 expect(gate.candidate).toBeUndefined();
});

test('local commands bypass narrative memory but cannot grant dossier effects',()=>{
 const gate=createDossierResponseGate(input());
 expect(()=>gate.validate('Help.',{type:'metadata',isCommand:true})).not.toThrow();
 expect(gate.token).toBeUndefined();
 expect(()=>gate.validate('[TECZKA_STANU: unknown | open]',{type:'metadata',isCommand:true})).toThrow('DOSSIER_EFFECTS_REJECTED');
});


async function authoredGateInput(){
 const {TextEncoder}=await import('node:util');const {webcrypto}=await import('node:crypto');
 Object.defineProperty(globalThis,'TextEncoder',{configurable:true,value:TextEncoder});Object.defineProperty(globalThis.crypto,'subtle',{configurable:true,value:webcrypto.subtle});
 const {createAuthoredPrabutyPayload}=await import('./authored-prabuty');
 const {fingerprintLocalDraftPayload,authorizeLocalDraftPayload}=await import('./runtime-authorization');
 const {STREFA_11_ADVENTURES}=await import('../adventures-data');
 const deadline=STREFA_11_ADVENTURES.find(a=>a.id==='cien-nad-prabutami')!.doomClock!.deadline!;
 const {isGameTime}=await import('@/lib/time-manager');
 if(!isGameTime(deadline)) throw new Error('Fixture deadline must be complete');
 const fp=await fingerprintLocalDraftPayload(createAuthoredPrabutyPayload(fingerprint));
 const authored=await authorizeLocalDraftPayload(createAuthoredPrabutyPayload(fp),{adventureId:'cien-nad-prabutami',editionFingerprint:fp});
 const previous=new Date(Date.UTC(deadline.year,deadline.month,deadline.day,deadline.hour,deadline.minute)-60000);
 const before={year:previous.getUTCFullYear(),month:previous.getUTCMonth(),day:previous.getUTCDate(),hour:previous.getUTCHours(),minute:previous.getUTCMinutes()};
 return {x:{...input(),payload:authored,adventureId:authored.adventure_id,editionFingerprint:fp,gameTime:before},deadline};
}
test('rejects internal world-state claims that contradict the accepted pre-activation state',async()=>{
 const {x}=await authoredGateInput();
 const beforeActivation={year:1973,month:9,day:19,hour:12,minute:15};
 const gate=createDossierResponseGate({...x,gameTime:beforeActivation});
 try {
  gate.validate('[MYŚLI_MG: obj-prabuty-generator=active; obj-prabuty-rift=open] Test.',metadata);
  throw new Error('accepted contradictory internal state claims');
 } catch(error) {
  expect((error as {rejectedIds:string[]}).rejectedIds).toEqual(expect.arrayContaining([
   'DOSSIER_NARRATION_STATE_CONTRADICTION:obj-prabuty-generator',
   'DOSSIER_NARRATION_STATE_CONTRADICTION:obj-prabuty-rift',
  ]));
 }
 expect(gate.candidate).toBeUndefined();expect(gate.token).toBeUndefined();expect(localStorage.length).toBe(0);
});
test('accepted response crossing the exact deadline stages world and ending with its final clock',async()=>{
 const {x,deadline}=await authoredGateInput();const gate=createDossierResponseGate(x);
 gate.validate('[MYŚLI_MG: obj-prabuty-generator=active; obj-prabuty-rift=open] Time passes.',{...metadata,timeUpdate:deadline});
 expect(gate.candidate?.codeEvidence?.ending).toBe('operation-completed');
 expect(gate.candidate?.next.world.objects.find(o=>o.entityId==='obj-prabuty-generator')?.state).toBe('active');
 expect(localStorage.length).toBe(0);
});
test('explicit code-owned pushed cost takes priority over narrator time',async()=>{
 const {x,deadline}=await authoredGateInput();const gate=createDossierResponseGate({...x,finalGameTime:deadline});
 gate.validate('Time passes.',{...metadata,timeUpdate:x.gameTime});
 expect(gate.candidate?.codeEvidence?.ending).toBe('operation-completed');
});


test('ordinary policy gathers protocol and effect failures before exposing a candidate',async()=>{
 const {x}=await authoredGateInput();
 const gate=createDossierResponseGate({...x,ordinaryTurn:true,location:'niskiej'});
 try {gate.validate('[LOKACJA: foreign-room] [TECZKA_STANU: absent | open]',{...metadata,timeUpdate:null});throw new Error('accepted invalid draft');}
 catch(error){expect((error as {rejectedIds:string[]}).rejectedIds).toEqual(expect.arrayContaining(['DOSSIER_LOCATION_INVALID','DOSSIER_TIME_REQUIRED','absent']));}
 expect(gate.candidate).toBeUndefined();expect(gate.token).toBeUndefined();expect(localStorage.length).toBe(0);
});
test.each(['missing','malformed','foreign'])('ordinary unknown binding requires canonical location: %s',async kind=>{
 const {x}=await authoredGateInput();const gate=createDossierResponseGate({...x,ordinaryTurn:true,location:'niskiej'});
 const text=kind==='missing'?'Question?':kind==='malformed'?'[LOKACJA: loc-prabuty-krypta':'[LOCATION: foreign-room]';
 expect(()=>gate.validate(text,{...metadata,timeUpdate:x.gameTime})).toThrow('DOSSIER_LOCATION_');
 expect(gate.candidate).toBeUndefined();
});
test('ordinary confirmed location permits no movement and equal time; unknown can bind exact source ID',async()=>{
 const {x}=await authoredGateInput();
 const known=createDossierResponseGate({...x,ordinaryTurn:true,location:'loc-prabuty-krypta'});
 expect(()=>known.validate('Question?',{...metadata,timeUpdate:x.gameTime})).not.toThrow();
 const unknown=createDossierResponseGate({...x,ordinaryTurn:true,location:'niskiej'});
 expect(()=>unknown.validate('[LOKACJA: loc-prabuty-krypta]',{...metadata,timeUpdate:x.gameTime})).not.toThrow();
 expect(unknown.gameTime).toEqual(x.gameTime);
});
test('ordinary clock is explicit but command, guardrail and code-owned time remain exceptions',()=>{
 const x=input();const gate=createDossierResponseGate({...x,ordinaryTurn:true});
 expect(()=>gate.validate('Question?',metadata)).toThrow('DOSSIER_TIME_REQUIRED');
 expect(()=>gate.validate('Help.',{type:'metadata',isCommand:true})).not.toThrow();
 expect(()=>gate.validate('No.',{type:'metadata',guardrail:true})).not.toThrow();
 const pushed=createDossierResponseGate({...x,ordinaryTurn:true,finalGameTime:x.gameTime});
 expect(()=>pushed.validate('Result.',metadata)).not.toThrow();
});


test('explicit off-graph departure commits time and deadline without inventing a source location',async()=>{
 const {x,deadline}=await authoredGateInput();const gate=createDossierResponseGate({...x,ordinaryTurn:true,location:'loc-prabuty-krypta'});
 gate.validate('Jadę do telefonu. [LOKACJA: OFF_GRAPH | Telefon przy szosie]',{...metadata,timeUpdate:deadline});
 expect(gate.candidate?.codeEvidence?.ending).toBe('operation-completed');expect(gate.gameTime).toEqual(deadline);
});
test('same-turn off-graph departure rejects local effects even from a previously canonical location',async()=>{
 const {x}=await authoredGateInput();const gate=createDossierResponseGate({...x,ordinaryTurn:true,location:'loc-prabuty-krypta'});
 expect(()=>gate.validate('[TECZKA_STANU: obj-prabuty-generator | start-generator] [LOKACJA: OFF_GRAPH | Telefon przy szosie]',{...metadata,timeUpdate:x.gameTime})).toThrow('DOSSIER_OFF_GRAPH_EFFECT');
 expect(gate.candidate).toBeUndefined();expect(localStorage.length).toBe(0);
});
test('off-graph current state is distinct from unknown and can return only through an exact source tag',async()=>{
 const {x}=await authoredGateInput();
 const gate=createDossierResponseGate({...x,ordinaryTurn:true,offGraph:true,location:'OFF_GRAPH'});
 expect(()=>gate.validate('Rozmawiam przez telefon.',{...metadata,timeUpdate:x.gameTime})).not.toThrow();
 expect(()=>gate.validate('[LOKACJA: loc-prabuty-krypta]',{...metadata,timeUpdate:x.gameTime})).not.toThrow();
 expect(()=>gate.validate('[LOKACJA: a random street]',{...metadata,timeUpdate:x.gameTime})).toThrow('DOSSIER_LOCATION_INVALID');
 for(const label of ['', 'x'.repeat(121),'Telephone\nInjected']) expect(()=>gate.validate('[LOKACJA: OFF_GRAPH | '+label+']',{...metadata,timeUpdate:x.gameTime})).toThrow('DOSSIER_LOCATION_INVALID');
});

// Movement and local actions use the same accepted source location.
test('arrival effects use the proposed canonical scene; leaving cannot mutate the scene left behind',async()=>{
 const {x}=await authoredGateInput();
 const {emptyDossierWorldState}=await import('./world-object-state');
 const state=emptyDossierWorldState(x,x.payload);
 const generator=state.objects.find(o=>o.entityId==='obj-prabuty-generator')!;generator.state='disabled';
 const rift=state.objects.find(o=>o.entityId==='obj-prabuty-rift')!;rift.state='open';
 localStorage.setItem('zew-dossier-world-state:p',JSON.stringify(state));
 const card=x.payload.records.find(r=>r.world_object_binding?.entity_id==='obj-prabuty-rift')!;
 const location=card.tags.scenes.find(v=>v.startsWith('loc-'))!;
 const arriving=createDossierResponseGate({...x,ordinaryTurn:true,location:'loc-warszawa-redakcja'});
 expect(()=>arriving.validate('[LOKACJA: '+location+'] [TECZKA_STANU: obj-prabuty-rift | close-rift]',{...metadata,timeUpdate:x.gameTime})).not.toThrow();
 const leaving=createDossierResponseGate({...x,ordinaryTurn:true,location});
 expect(()=>leaving.validate('[LOKACJA: loc-warszawa-redakcja] [TECZKA_STANU: obj-prabuty-rift | close-rift]',{...metadata,timeUpdate:x.gameTime})).toThrow();
});

test('English withdrawal traverses the real parser and ordinary gate with unchanged clock',async()=>{
 await authoredGateInput();
 const {createAuthoredEdition}=await import('./authored-editions');
 const {payload,editionFingerprint}=await createAuthoredEdition('englewood-murder-castle-1893');
 const {emptyDossierWorldState,projectDossierWorldState}=await import('./world-object-state');
 const {buildAuthoredScenarioWithdrawal}=await import('./authored-scenario-withdrawal');
 const {parseAIResponse}=await import('../response-parser');
 const x={...input(),payload,adventureId:payload.adventure_id,editionFingerprint,gameTime:{year:1894,month:10,day:19,hour:19,minute:0},location:payload.records.find(r=>r.record_type==='scene')!.tags.scenes[1],playerMessage:'i withdraw from the investigation'};
 const text=buildAuthoredScenarioWithdrawal({payload,world:projectDossierWorldState(emptyDossierWorldState(x,payload)),message:x.playerMessage,gameTime:x.gameTime,locale:'en'})!;
 const parsed=parseAIResponse(text);
 expect(parsed.timeUpdate).toEqual(x.gameTime);
 const gate=createDossierResponseGate({...x,ordinaryTurn:true});
 expect(()=>gate.validate(text,{...metadata,timeUpdate:parsed.timeUpdate})).not.toThrow();
 expect(gate.candidate?.codeEvidence?.ending).toBe('withdrawn');
});

test('fabricated source quotation is rejected before publication and without a partial candidate',async()=>{
 const {x}=await authoredGateInput();const gate=createDossierResponseGate(x);
 expect(()=>gate.validate('Na rewersie fotografii widnieje: „Tajne przejście otwiera się o północy.”',metadata)).toThrow('DOSSIER_DOCUMENT_QUOTE_UNSUPPORTED');
 expect(gate.candidate).toBeUndefined();expect(gate.token).toBeUndefined();expect(localStorage.length).toBe(0);
});

const investigator: Character = {
 id:'pc',name:'Ada',occupation:'Detective',age:35,str:50,con:50,siz:50,dex:50,app:50,int:50,pow:50,edu:50,
 skills:{},hp:10,san:50,maxSan:99,luck:50,mp:10,equipment:[],background:'',playerName:'Player',isActive:true,
 lastUsed:new Date(0),notes:'',experience:{totalXP:0,availableXP:0,earnedThisSession:0,maxEarnedThisSession:0},developmentHistory:[],
};
const photoId='prabuty.media.clue-photo-prabuty-1947';
const photoItemId='prabuty.item.clue-photo-prabuty-1947';
const proposedPhoto=`[EKWIPUNEK: DODAJ | @${photoItemId}]`;
test.each([
 'Co Helena wie o fotografii?', 'Otwieram teczkę.', 'Oglądam fotografię.',
 'Nie zabieram fotografii.', 'Helena mówi: zabieram fotografię.', 'Rozważam, czy zabieram fotografię.',
 'I do not take the photograph.', 'She says: I take the photograph.', 'What if I take the photograph?',
 'Zabieram latarkę.',
])('a model ADD cannot grant a source photograph without a discovery and taking declaration: %s',async playerMessage=>{
 const {x}=await authoredGateInput();
 const gate=createDossierResponseGate({...x,location:'loc-warszawa-redakcja',playerMessage,
  characters:[investigator],activeCharacter:investigator});
 expect(()=>gate.validate(proposedPhoto,metadata)).toThrow('DOSSIER_EFFECTS_REJECTED');
 expect(gate.candidate).toBeUndefined();expect(gate.token).toBeUndefined();expect(localStorage.length).toBe(0);
});
test.each(['Zabieram fotografię.', 'I take the photograph.'])('a discovered photograph can be deliberately taken: %s',async playerMessage=>{
 const {x}=await authoredGateInput();
 const gate=createDossierResponseGate({...x,location:'loc-warszawa-redakcja',playerMessage,knownHandoutIds:[photoId],
  characters:[investigator],activeCharacter:investigator});
 expect(()=>gate.validate(proposedPhoto,metadata)).not.toThrow();
 expect(gate.candidate?.next.activeCharacter?.equipment).toHaveLength(1);
});
test.each(['Nie zabieram fotografii.', 'Helena mówi: zabieram fotografię.', 'I do not take the photograph.',
 'She says: I take the photograph.', 'What if I take the photograph?', 'Zabieram latarkę.',
 'Oglądam fotografię i zabieram mapę.'])('discovery does not authorize a later unchosen acquisition: %s',async playerMessage=>{
 const {x}=await authoredGateInput();
 const gate=createDossierResponseGate({...x,location:'loc-warszawa-redakcja',playerMessage,knownHandoutIds:[photoId],
  characters:[investigator],activeCharacter:investigator});
 expect(()=>gate.validate(proposedPhoto,metadata)).toThrow('DOSSIER_EFFECTS_REJECTED');
 expect(gate.candidate).toBeUndefined();
});
test('opening the folder and taking its photograph in one declaration grants exactly one source item',async()=>{
 const {x}=await authoredGateInput();
 const gate=createDossierResponseGate({...x,location:'loc-warszawa-redakcja',playerMessage:'Otwieram teczkę i zabieram fotografię.',
  characters:[investigator],activeCharacter:investigator});
 gate.validate(proposedPhoto,metadata);
 expect(gate.handouts).toEqual([photoId]);
 expect(gate.candidate?.next.activeCharacter?.equipment).toHaveLength(1);
});

test.each(['Otwieram ją.', 'I open it.'])('the final gate publishes a missing card from the prior turn reference: %s', async playerMessage=>{
 const {x}=await authoredGateInput();
 const gate=createDossierResponseGate({...x,location:'loc-warszawa-redakcja',playerMessage,
  previousAssistantMessage:'Na biurku leży zamknięta teczka. A closed folder rests on the desk.'});
 gate.validate('Oglądasz zawartość.',{...metadata,dossierHandoutRecordIds:[]});
 expect(gate.handouts).toEqual([photoId]);
 expect(gate.candidate?.cleanText).toContain(`[HANDOUT:${photoId}]`);
 expect(gate.candidate?.next.inventory.entries).toEqual([]);
});

test('a guardrail or a command cannot grant handout access from a rejected opening action',async()=>{
 const {x}=await authoredGateInput();
 for(const flags of [{guardrail:true},{isCommand:true}]){
  const gate=createDossierResponseGate({...x,location:'loc-warszawa-redakcja',playerMessage:'Otwieram teczkę.'});
  gate.validate('Nie możesz teraz tego zrobić.',{...metadata,...flags});
  expect(gate.handouts).toEqual([]);
 }
});


test('staging a second Helena entry after prepare preserves the roster guard and allows commit', async () => {
 const {appendJournalToParty}=await import('../journal/apply-journal-tags');
 const opening=appendJournalToParty([investigator],investigator,
  'Helena podaje teczkę. [JOURNAL:npc:Helena Krawczyk]Helena podaje teczkę.[/JOURNAL]', 'opening');
 const roster=opening.characters;
 const snapshot=JSON.stringify(roster);
 const gate=createDossierResponseGate({...input(),characters:roster,activeCharacter:opening.activeCharacter,
  isCurrent:()=>JSON.stringify(roster)===snapshot});
 const text='Helena patrzy na twój ruch. [JOURNAL:npc:Helena Krawczyk]Helena patrzy na twój ruch.[/JOURNAL]';
 gate.validate(text,{...metadata});
 const staged=appendJournalToParty(roster,opening.activeCharacter,gate.candidate!.cleanText,'photo');
 expect(()=>gate.assertCurrent()).not.toThrow();
 expect(gate.token).toBe('token');
 expect(staged.activeCharacter.investigatorDossier!.npcs[0].keyInformation).toContain('Helena patrzy');
 expect(JSON.stringify(roster)).toBe(snapshot);
});
