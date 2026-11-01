import {emptyDossierInventory,storeDossierInventory,loadDossierInventory,readDossierInventoryForSave} from './inventory-state';
import {emptyDossierWorldState,storeDossierWorldState,loadDossierWorldState,readDossierWorldStateForSave} from './world-object-state';
import type {DossierRagPayload} from './rag-schema';
const payload:DossierRagPayload={schema_version:1,adventure_id:'a',edition_fingerprint:'sha256:'+'a'.repeat(64),records:[]};
const binding={playthroughId:'p',adventureId:'a',editionFingerprint:payload.edition_fingerprint,payload,rawText:'secret draft',characters:['private full context']};
beforeEach(()=>localStorage.clear());
test('state constructors never copy a full turn context passed as a structural binding',()=>{
 for(const state of [emptyDossierInventory(binding),emptyDossierWorldState(binding,payload)]){
 expect(state).not.toHaveProperty('payload');expect(state).not.toHaveProperty('rawText');expect(state).not.toHaveProperty('characters');
 }
});
test('existing contaminated states are pruned on load, save and store without losing progress',()=>{
 const inv={...emptyDossierInventory(binding),payload,rawText:'hidden'};
 const world={...emptyDossierWorldState(binding,payload),payload,rawText:'hidden'};
 localStorage.setItem('zew-dossier-inventory:p',JSON.stringify(inv));localStorage.setItem('zew-dossier-world-state:p',JSON.stringify(world));
 for(const state of [loadDossierInventory(binding),loadDossierWorldState(binding,payload),readDossierInventoryForSave('p'),readDossierWorldStateForSave('p')])expect(state).not.toHaveProperty('payload');
 storeDossierInventory(inv);storeDossierWorldState(world);
 expect(localStorage.getItem('zew-dossier-inventory:p')).not.toContain('hidden');expect(localStorage.getItem('zew-dossier-world-state:p')).not.toContain('hidden');
});
