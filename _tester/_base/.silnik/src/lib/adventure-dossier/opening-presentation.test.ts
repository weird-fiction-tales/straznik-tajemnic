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
test('the newsroom opening visibly presents its source photograph without requiring a model handout tag or granting an item',async()=>{
 const payload=await edition(),before=JSON.stringify(payload);
 const result=composeOpeningPresentation(payload,'Helena kładzie fotografię na biurku.',[],true);
 expect(result.handouts).toEqual([photo]);expect(result.content).toContain('[HANDOUT:'+photo+']');
 expect(result.content).not.toMatch(/EKWIPUNEK|clue-sb-file-klin|clue-tape/);
 expect(JSON.stringify(payload)).toBe(before);
});
test('does not duplicate a model-presented photograph and never broadens the remaining handout allowlist',async()=>{
 const payload=await edition();
 const result=composeOpeningPresentation(payload,'[HANDOUT:clue-photo-prabuty-1947]',[photo],true);
 expect(result.handouts).toEqual([photo]);expect(result.content.match(/HANDOUT:/g)).toHaveLength(1);
});
test('unregistered copies and other openings cannot use this source-specific reveal',async()=>{
 const payload=await edition();
 expect(composeOpeningPresentation(JSON.parse(JSON.stringify(payload)),'Opening.',[],true)).toEqual({content:'Opening.',handouts:[]});
 expect(composeOpeningPresentation(payload,'Opening.',[],false)).toEqual({content:'Opening.',handouts:[]});
});
