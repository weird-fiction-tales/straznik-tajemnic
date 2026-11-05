import { PREDEFINED_CHARACTERS } from '@/lib/immersion/predefined-characters';
import { buildPublicJournal } from '@/lib/journal/public-journal';
import {TextEncoder} from 'node:util';
import {webcrypto} from 'node:crypto';
import {createAuthoredPrabutyPayload} from './authored-prabuty';
import {authorizeLocalDraftPayload,fingerprintLocalDraftPayload} from './runtime-authorization';
import {createDossierOpeningCommit} from './commit-opening';
import {acknowledgeDossierTurn} from './validated-stream';
jest.mock('./validated-stream',()=>({
 parseValidatedDossierStream:jest.fn(async(_response,callbacks,gate)=>{
  const metadata={type:'metadata',finishReason:'STOP',dossierFinalizationToken:'opening-token',dossierInventoryWritesAllowed:false};
  callbacks.onMetadata(metadata);gate.validate('Helena kładzie fotografię na biurku.',metadata);
  return 'Helena kładzie fotografię na biurku.';
 }),
 prepareDossierTurnOnServer:jest.fn(async()=>{}),
 acknowledgeDossierTurn:jest.fn(async()=>({accepted:true})),
}));
beforeAll(()=>{Object.defineProperty(globalThis,'TextEncoder',{configurable:true,value:TextEncoder});Object.defineProperty(globalThis.crypto,'subtle',{configurable:true,value:webcrypto.subtle});});
beforeEach(()=>localStorage.clear());
test('post-commit callbacks preserve the durable opening without revealing a photograph before player action',async()=>{
 const fp=await fingerprintLocalDraftPayload(createAuthoredPrabutyPayload('sha256:'+'0'.repeat(64)));
 const payload=await authorizeLocalDraftPayload(createAuthoredPrabutyPayload(fp),{adventureId:'cien-nad-prabutami',editionFingerprint:fp});
 jest.mocked(acknowledgeDossierTurn).mockImplementationOnce(async()=>{
  expect(localStorage.getItem('zew_chat_messages')).toBeNull();return {accepted:true};
 });
 const accept=createDossierOpeningCommit({payload,adventureId:payload.adventure_id,editionFingerprint:fp,playthroughId:'opening-play',turnId:'opening-turn',
  location:'loc-warszawa-redakcja',now:new Date(0),gameTime:{year:1973,month:9,day:18,hour:19,minute:30},era:'prl',
  characters:[],activeCharacter:null,skillTests:[],skillRolls:[],isCurrent:()=>true},'/handouts/cien-nad-prabutami/playtest/newsroom-1973.png');
 const result=await accept({} as Response);
 expect(result.text).toBe(result.message.content);
 expect(result.text).not.toContain('[HANDOUT:');
 const stored=JSON.parse(localStorage.getItem('zew_chat_messages')!);
 expect(stored[0].content).toBe(result.text);
 expect(stored[0].dossierHandoutRecordIds).toEqual([]);
});

test('the accepted canonical opening publishes visible Helena without revealing absent actors or materials',async()=>{
 const fp=await fingerprintLocalDraftPayload(createAuthoredPrabutyPayload('sha256:'+'0'.repeat(64)));
 const payload=await authorizeLocalDraftPayload(createAuthoredPrabutyPayload(fp),{adventureId:'cien-nad-prabutami',editionFingerprint:fp});
 const pc={...PREDEFINED_CHARACTERS[0],id:'pc',name:'Tomasz Nowicki',equipment:[],journal:[]};
 const scope={adventureId:payload.adventure_id,playthroughId:'opening'};
 const binding={adventureId:payload.adventure_id,editionFingerprint:fp};
 const accept=createDossierOpeningCommit({payload,...scope,...binding,turnId:'opening',location:'loc-warszawa-redakcja',now:new Date(0),gameTime:{year:1973,month:9,day:18,hour:19,minute:30},era:'prl',characters:[pc],activeCharacter:pc,skillTests:[],skillRolls:[],isCurrent:()=>true});
 const result=await accept({} as Response);
 const people=buildPublicJournal({characters:result.characters,chapter:scope,binding,locale:'pl'}).cards.filter(card=>card.kind==='person');
 expect(people.map(card=>card.title)).toEqual(['Helena Krawczyk']);
 expect(result.message.dossierHandoutRecordIds).toEqual([]);
});
