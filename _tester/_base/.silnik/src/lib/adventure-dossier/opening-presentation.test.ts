import {TextEncoder} from 'node:util';
import {webcrypto} from 'node:crypto';
import {createAuthoredPrabutyPayload} from './authored-prabuty';
import {authorizeLocalDraftPayload,fingerprintLocalDraftPayload} from './runtime-authorization';
import {composeOpeningPresentation} from './commit-opening';
beforeAll(()=>{Object.defineProperty(globalThis,'TextEncoder',{configurable:true,value:TextEncoder});Object.defineProperty(globalThis.crypto,'subtle',{configurable:true,value:webcrypto.subtle});});
async function edition(){
 const fp=await fingerprintLocalDraftPayload(createAuthoredPrabutyPayload('sha256:'+'0'.repeat(64)));
 return authorizeLocalDraftPayload(createAuthoredPrabutyPayload(fp),{adventureId:'cien-nad-prabutami',editionFingerprint:fp});
}
const photo='prabuty.media.clue-photo-prabuty-1947';
test('a closed folder in the newsroom opening never reveals its photograph',async()=>{
 const payload=await edition(),before=JSON.stringify(payload);
 const result=composeOpeningPresentation(payload,'Helena podaje zamkniętą teczkę. Wspomina o fotografii.',[],true);
 expect(result.handouts).toEqual([]);expect(result.content).not.toContain('[HANDOUT:');
 expect(result.content).not.toMatch(/EKWIPUNEK|clue-sb-file-klin|clue-tape/);
 expect(JSON.stringify(payload)).toBe(before);
});
test('an opening model tag cannot authorize revealing the closed folder contents',async()=>{
 const payload=await edition();
 const result=composeOpeningPresentation(payload,'[HANDOUT:clue-photo-prabuty-1947]',[photo],true);
 expect(result.handouts).toEqual([]);expect(result.content).not.toContain('[HANDOUT:');
});
test('unregistered copies and other openings cannot use this source-specific reveal',async()=>{
 const payload=await edition();
 expect(composeOpeningPresentation(JSON.parse(JSON.stringify(payload)),'Opening.',[],true)).toEqual({content:'Opening.',handouts:[]});
 expect(composeOpeningPresentation(payload,'Opening.',[],false)).toEqual({content:'Opening.',handouts:[]});
});
