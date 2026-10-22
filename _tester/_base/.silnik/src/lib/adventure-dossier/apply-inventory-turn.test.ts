import { applyDossierInventoryTurn, registerDossierAccessTests, resolveDossierAccessChecks } from './apply-inventory-turn';
import { emptyDossierInventory } from './inventory-state';
import type { DossierRagPayload } from './rag-schema';
import type { Character } from '../types';

const fingerprint = 'sha256:' + 'a'.repeat(64);
const character: Character = {
 id:'pc-1', name:'Ada', occupation:'Detektyw', age:35, str:50, con:50, siz:50, dex:50, app:50, int:50, pow:50, edu:50,
 skills:{Spostrzegawczość:60}, hp:10, san:50, maxSan:99, luck:50, mp:10, equipment:[], background:'', playerName:'Gracz',
 isActive:true, lastUsed:new Date(), notes:'', experience:{totalXP:0,availableXP:0,earnedThisSession:0,maxEarnedThisSession:0}, developmentHistory:[],
};
const payload: DossierRagPayload = {
 schema_version:1, adventure_id:'fixture', edition_fingerprint:fingerprint,
 records:[{schema_version:1,record_id:'item-1',record_type:'fact',adventure_id:'fixture',edition_fingerprint:fingerprint,language:'pl',
 content:'Autorski przedmiot testowy.',tags:{entities:['object-1'],scenes:['test-camp'],mechanics:[],topics:[],triggers:[]},
 retrieval:{visibility:'gm_only',availability:'always',condition:null,priority:1},
 evidence:{provenance:'approved_design',source_ref:'authored test fixture',status:'set',approval:'approved',approved_by:'test fixture',approved_at:'2026-10-15T00:00:00Z'},links:[],
 inventory_item:Object.assign({entity_id:'object-1',name:'Mosiężny klucz',category:'story' as const,source_location:'test-camp'},
 {access_check:{id:'discover-key',skill_names:['Spostrzegawczość'],difficulty:'hard' as const}}),
 }],
};
const state = () => emptyDossierInventory({playthroughId:'play-1',adventureId:'fixture',editionFingerprint:fingerprint});
const input = () => ({payload,state:state(),turnId:'turn-1',characters:[character],activeCharacter:character,
 rawText:'[EKWIPUNEK: DODAJ | @item-1]',location:'test-camp',writesAllowed:true,era:'1920s'});

test('location and narrator ADD cannot grant an undiscovered gated item', () => {
 const result = applyDossierInventoryTurn(input());
 expect(result.activeCharacter.equipment).toHaveLength(0);
 expect(result.rejected).toEqual(['item-1']);
});

const requested = (overrides: Partial<import('../parsers/types').SkillTestData> = {}): import('../parsers/types').SkillTestData => ({
 id:'test-1',characterId:character.id,skillName:'Spostrzegawczość',skillValue:60,difficulty:'trudny',modifiers:[],justification:'Oględziny',
 dossierConditionId:'discover-key',...overrides,
});
const roll = (overrides: Partial<import('../parsers/types').SkillRollResolution> = {}): import('../parsers/types').SkillRollResolution => ({
 testId:'test-1',resolutionId:'roll-1',characterId:character.id,skillNames:['Spostrzegawczość'],outcome:'hard',luckSpent:0,
 requiredDifficulty:'hard',passedRequirement:true,...overrides,
});
const pending = () => registerDossierAccessTests(payload,state(),[requested()],'test-camp',[character]);
const discovered = () => resolveDossierAccessChecks(payload,pending(),[roll()],'test-camp',[character]);

import { storeDossierInventory, loadDossierInventory, isDossierInventoryState, projectDossierInventory, readDossierInventoryForSave } from './inventory-state';
import { FullGameSaveManager } from '../full-game-save-manager';
import type { AISettings } from '../ai-settings';
import { validateDossierRagPayload } from './rag-schema';
import { extractSkillTests } from '../parsers/mechanics-parser';
import { collectTestGroupResult } from '../hot-seat/test-groups';

test.each<[string, Partial<import('../parsers/types').SkillRollResolution>]>([
 ['missing',{}], ['unrelated test',{testId:'another-test'}], ['other investigator',{characterId:'pc-2'}],
 ['failure',{outcome:'fail',passedRequirement:false}], ['regular is not hard',{outcome:'regular',passedRequirement:false}],
 ['false success claim',{outcome:'fail',passedRequirement:true}], ['different requirement',{requiredDifficulty:'regular'}],
 ['another skill',{skillNames:['Nasłuchiwanie']}], ['missing identity',{resolutionId:undefined}],
])('rejects %s', (label, overrides) => {
 const rolls = label === 'missing' ? [] : [roll(overrides)];
 const resolved = resolveDossierAccessChecks(payload,pending(),rolls,'test-camp',[character]);
 expect(applyDossierInventoryTurn({...input(),state:resolved}).activeCharacter.equipment).toHaveLength(0);
});

test('success records access without ownership; later taking, full-save and retaking preserve one instance', () => {
 const access = discovered();
 expect(access.entries).toHaveLength(0);
 expect(access.accessChecks?.[0].resolution).toEqual({id:'roll-1',outcome:'hard'});
 storeDossierInventory(access);
 const save = FullGameSaveManager.createFullSave({name:'neutral access fixture',userId:'local',messages:[],
 gameSettings:{aiSettings:{} as AISettings},characters:[character],campaigns:[],npcs:[],locations:[],dossierInventory:readDossierInventoryForSave('play-1')});
 const restored = FullGameSaveManager.decompressSave(FullGameSaveManager.compressSave(save))!.dossierInventory!;
 expect(isDossierInventoryState(restored)).toBe(true);
 storeDossierInventory({...restored,playthroughId:'new-play'});
 expect(loadDossierInventory({...restored,playthroughId:'new-play'}).accessChecks).toEqual(access.accessChecks);
 expect(projectDossierInventory(restored).accessChecks?.[0].resolution?.id).toBe('roll-1');
 // Walking elsewhere cannot collect it remotely; returning still remembers discovery.
 expect(applyDossierInventoryTurn({...input(),state:restored,location:'village'}).activeCharacter.equipment).toHaveLength(0);
 const taken = applyDossierInventoryTurn({...input(),state:restored,turnId:'take'});
 expect(taken.activeCharacter.equipment).toHaveLength(1);
 const sameTurn = applyDossierInventoryTurn({...input(),state:taken.state,turnId:'take',characters:taken.characters,activeCharacter:taken.activeCharacter});
 expect(sameTurn.activeCharacter.equipment).toHaveLength(1);
 const replay = resolveDossierAccessChecks(payload,taken.state,[roll()],'test-camp',taken.characters);
 expect(replay.accessChecks).toEqual(taken.state.accessChecks);
 const continuation = applyDossierInventoryTurn({...input(),state:replay,turnId:'continuation',characters:taken.characters,activeCharacter:taken.activeCharacter,applyLegacy:false});
 expect(continuation.activeCharacter.equipment).toHaveLength(1);
 const dropped = applyDossierInventoryTurn({...input(),state:taken.state,turnId:'drop',characters:taken.characters,activeCharacter:taken.activeCharacter,
 location:'village',rawText:'[EKWIPUNEK: ODLOZ | @item-1]'});
 const retaken = applyDossierInventoryTurn({...input(),state:{...dropped.state,accessChecks:[]},turnId:'retake',characters:dropped.characters,activeCharacter:dropped.activeCharacter,location:'village'});
 expect(retaken.activeCharacter.equipment?.[0].id).toBe(taken.activeCharacter.equipment?.[0].id);
});

test('pending tests survive serialization and reject wrong scene, wrong edition, unreviewed cards and missing condition', () => {
 const wrongScene = resolveDossierAccessChecks(payload,JSON.parse(JSON.stringify(pending())),[roll()],'village',[character]);
 expect(wrongScene.accessChecks?.[0].resolution).toBeUndefined();
 expect(registerDossierAccessTests(payload,state(),[requested()],'village',[character]).accessChecks).toEqual([]);
 expect(registerDossierAccessTests(payload,state(),[requested({dossierConditionId:undefined})],'test-camp',[character]).accessChecks).toEqual([]);
 expect(registerDossierAccessTests(payload,state(),[requested({difficulty:'zwykly'})],'test-camp',[character]).accessChecks).toEqual([]);
 const unreviewed = {...payload,records:payload.records.map(r => ({...r,evidence:{...r.evidence,approval:'pending' as const}}))};
 expect(registerDossierAccessTests(unreviewed,state(),[requested()],'test-camp',[character]).accessChecks).toEqual([]);
 const otherEdition = {...payload,edition_fingerprint:'sha256:'+'b'.repeat(64)};
 expect(resolveDossierAccessChecks(otherEdition,pending(),[roll()],'test-camp',[character])).toEqual(pending());
});

test('free objects do not require a check and old states do not grant gated access', () => {
 const free = {...payload,records:payload.records.map(r => ({...r,inventory_item:{...r.inventory_item!,access_check:undefined}}))};
 expect(applyDossierInventoryTurn({...input(),payload:free}).activeCharacter.equipment).toHaveLength(1);
 expect(isDossierInventoryState(state())).toBe(true);
 expect(applyDossierInventoryTurn(input()).activeCharacter.equipment).toHaveLength(0);
});

test('duet keeps each result with its test and actor; cannot reuse another roll', () => {
 const second = {...character,id:'pc-2',name:'Jan'};
 const tests = [requested({groupId:'group'}),requested({id:'test-2',characterId:second.id,groupId:'group'})];
 let progress = collectTestGroupResult(tests,[],{testId:'test-1',chatMessage:'a',systemContext:'a',skillRolls:[roll({outcome:'fail',passedRequirement:false})]});
 expect(progress.complete).toBe(false);
 progress = collectTestGroupResult(tests,progress.results,{testId:'test-2',chatMessage:'b',systemContext:'b',skillRolls:[roll({testId:'test-2',characterId:'pc-2',resolutionId:'roll-2'})]});
 expect(progress.complete).toBe(true);
 const registered = registerDossierAccessTests(payload,state(),tests,'test-camp',[character,second]);
 const resolved = resolveDossierAccessChecks(payload,registered,progress.results.flatMap(r => r.skillRolls ?? []),'test-camp',[character,second]);
 expect(resolved.accessChecks?.map(c => [c.characterId,c.resolution?.outcome])).toEqual([['pc-1','fail'],['pc-2','hard']]);
 expect(applyDossierInventoryTurn({...input(),state:resolved}).activeCharacter.equipment).toHaveLength(1);
 const reused = resolveDossierAccessChecks(payload,resolved,[roll({testId:'test-2',characterId:'pc-2'})],'test-camp',[character,second]);
 expect(reused).toEqual(resolved);
});

test('parser separates condition reference from player text and schema rejects conflicting condition definitions', () => {
 const tests = extractSkillTests('[TEST: Spostrzegawczość | trudny | | Oględziny | DOSSIER_ACCESS: discover-key | STAWKA: znaleźć klucz]');
 expect(tests[0]).toMatchObject({dossierConditionId:'discover-key',justification:'Oględziny',stake:'znaleźć klucz'});
 expect(extractSkillTests('[TEST: Spostrzegawczość | trudny | | Oględziny]')[0].dossierConditionId).toBeUndefined();
 expect(validateDossierRagPayload(payload).ok).toBe(true);
 const duplicate = {...payload.records[0],record_id:'item-2',inventory_item:{...payload.records[0].inventory_item!,access_check:{id:'discover-key',skill_names:['Spostrzegawczość'],difficulty:'regular' as const}}};
 expect(validateDossierRagPayload({...payload,records:[...payload.records,duplicate]}).errors).toContain('records[1]: conflicting access check');
});

import { cleanResponseText } from '../parsers/text-cleaner';
import { cleanupContent } from '../../components/chat/narrative/cleanup';
test('condition metadata stays out of player narration and TTS', () => {
 const text='Oglądasz wnękę. [TEST: Spostrzegawczość | trudny | | Oględziny | DOSSIER_ACCESS: discover-key]';
 expect(cleanResponseText(text)).toBe('Oglądasz wnękę.');
 expect(cleanupContent(text)).toBe('Oglądasz wnękę.');
});

test('reviewed display aliases bind the canonical scene without fuzzy matching', () => {
 const aliased = {...payload,records:payload.records.map(r=>({...r,tags:{...r.tags,scenes:[...r.tags.scenes,'Testowy obóz']}}))};
 const registered=registerDossierAccessTests(aliased,state(),[requested()],'Testowy obóz',[character]);
 expect(registered.accessChecks?.[0].location).toBe('test-camp');
 const resolved=resolveDossierAccessChecks(aliased,registered,[roll()],'Testowy obóz',[character]);
 expect(applyDossierInventoryTurn({...input(),payload:aliased,state:resolved,location:'Testowy obóz'}).activeCharacter.equipment).toHaveLength(1);
 expect(registerDossierAccessTests(aliased,state(),[requested()],'Obóz',[character]).accessChecks).toEqual([]);
});

// Save/load must retain the acquired instance, not only the right to discover it.
test('full save restores ownership and does not recreate the item under a new playthrough ID', () => {
 const taken=applyDossierInventoryTurn({...input(),state:discovered(),turnId:'take'});
 const save=FullGameSaveManager.createFullSave({name:'owned fixture',userId:'local',messages:[],
  gameSettings:{aiSettings:{} as AISettings},characters:taken.characters,campaigns:[],npcs:[],locations:[],dossierInventory:taken.state});
 const restored=FullGameSaveManager.decompressSave(FullGameSaveManager.compressSave(save))!;
 const inventory={...restored.dossierInventory!,playthroughId:'restored-play'};
 const result=applyDossierInventoryTurn({...input(),state:inventory,turnId:'after-load',
  characters:restored.characters,activeCharacter:restored.characters[0]});
 expect(result.activeCharacter.equipment).toHaveLength(1);
 expect(result.activeCharacter.equipment?.[0].id).toBe(taken.activeCharacter.equipment?.[0].id);
 expect(result.state.entries[0]).toMatchObject({holderId:character.id,placement:'character',item:{id:taken.state.entries[0].item.id}});
 expect(result.state.accessChecks).toEqual(taken.state.accessChecks);
});
