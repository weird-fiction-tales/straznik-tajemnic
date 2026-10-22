import {TextEncoder} from 'node:util';
import {webcrypto} from 'node:crypto';
import {createAuthoredPrabutyPayload} from './authored-prabuty';
import {authorizeLocalDraftPayload,fingerprintLocalDraftPayload} from './runtime-authorization';
import {createDossierOpeningCommit} from './commit-opening';
import {acknowledgeDossierTurn} from './validated-stream';
jest.mock('./validated-stream',()=>({
 parseValidatedDossierStream:jest.fn(async(_response,callbacks,gate)=>{
  const metadata={type:'metadata',dossierFinalizationToken:'opening-token',dossierInventoryWritesAllowed:false};
  callbacks.onMetadata(metadata);gate.validate('Helena kładzie fotografię na biurku.',metadata);
  return 'Helena kładzie fotografię na biurku.';
 }),
 prepareDossierTurnOnServer:jest.fn(async()=>{}),
 acknowledgeDossierTurn:jest.fn(async()=>({accepted:true})),
}));
beforeAll(()=>{Object.defineProperty(globalThis,'TextEncoder',{configurable:true,value:TextEncoder});Object.defineProperty(globalThis.crypto,'subtle',{configurable:true,value:webcrypto.subtle});});
beforeEach(()=>localStorage.clear());
test('post-commit callbacks receive exactly the durable visible opening including the trusted photograph',async()=>{
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
 expect(result.text).toContain('[HANDOUT:prabuty.media.clue-photo-prabuty-1947]');
 const stored=JSON.parse(localStorage.getItem('zew_chat_messages')!);
 expect(stored[0].content).toBe(result.text);
 expect(stored[0].dossierHandoutRecordIds).toEqual(['prabuty.media.clue-photo-prabuty-1947']);
});
