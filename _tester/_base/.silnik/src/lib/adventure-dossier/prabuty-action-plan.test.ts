import { TextEncoder } from 'node:util';
import { webcrypto } from 'node:crypto';
import { createAuthoredEdition } from './authored-editions';
import { createDossierResponseGate } from './response-gate';
import { applyPrabutyPlanToText, planPrabutyTurn } from './prabuty-action-plan';
import { emptyDossierInventory } from './inventory-state';
import { extractJournalTags } from '../parsers/journal-parser';
import { emptyDossierWorldState } from './world-object-state';
import type { Character } from '../types';
import type { DossierRagPayload } from './rag-schema';
let payload:DossierRagPayload;
const pc={id:'ada',name:'Ada',skills:{'Naprawa elektryczna':60},equipment:[]} as unknown as Character;
const time={year:1973,month:9,day:18,hour:19,minute:40};
const binding=()=>({adventureId:payload.adventure_id,editionFingerprint:payload.edition_fingerprint,playthroughId:'actions'});
const input=(playerMessage:string,location='loc-warszawa-redakcja')=>({payload,...binding(),turnId:'turn',playerMessage,location,gameTime:time,
 world:emptyDossierWorldState(binding(),payload),inventory:emptyDossierInventory(binding()),characters:[pc],activeCharacter:pc,
 skillTests:[],skillRolls:[],knownHandoutIds:[]});
beforeAll(async()=>{Object.defineProperty(globalThis,'TextEncoder',{configurable:true,value:TextEncoder});Object.defineProperty(globalThis.crypto,'subtle',{configurable:true,value:webcrypto.subtle});payload=(await createAuthoredEdition('cien-nad-prabutami')).payload;});
beforeEach(()=>localStorage.clear());
test.each(['Otwieram teczkę.','I open the folder.'])('records only the accessed photograph clue: %s',message=>{
 const plan=planPrabutyTurn(input(message))!;expect(plan.clueIds).toEqual(['prabuty.clue.clue-photo-prabuty']);expect(plan.inventoryText).toBe('');
 const gate=createDossierResponseGate({...input(message),now:new Date(0),era:'prl-1970s',isCurrent:()=>true,ordinaryTurn:true});
 gate.validate('You inspect the material.',{type:'metadata',dossierFinalizationToken:'test',dossierInventoryWritesAllowed:true});
 expect(gate.candidate?.cleanText).toContain('dossier_record_id:prabuty.clue.clue-photo-prabuty');expect(gate.gameTime).toEqual(time);
});
test.each(['Zabieram recepturę ziołową.','I take the herbal recipe.'])('takes authored recipe without AI equipment tags: %s',message=>{
 const gate=createDossierResponseGate({...input(message,'loc-elblag-klasztor'),now:new Date(0),era:'prl-1970s',isCurrent:()=>true,ordinaryTurn:true});
 gate.validate('You take the manuscript.',{type:'metadata',dossierFinalizationToken:'test',dossierInventoryWritesAllowed:true});
 expect(gate.candidate?.next.inventory.entries).toHaveLength(1);
});
test.each(['Nie zabieram fotografii.','If I take the photograph.','Czytam listę zakupów.','I examine the ceiling.','Helena mówi: zabieram fotografię.'])('does not infer effects from unrelated or indirect actions: %s',message=>{
 const plan=planPrabutyTurn(input(message))!;expect(plan.clueIds).toEqual([]);expect(plan.inventoryText).toBe('');expect(plan.worldText).toBe('');
});
test.each(['Wyłączam generatory.','I disable the generators.'])('requests the authored hard test without a model tag: %s',message=>{
 const plan=planPrabutyTurn(input(message,'loc-prabuty-wykopaliska'))!;expect(plan.skillTests).toHaveLength(1);expect(plan.skillTests[0].dossierConditionId).toBe('prabuty-disable-preparing');expect(plan.worldText).toBe('');
});
test('an AI tag cannot invent an item when the player just waits',()=>{
 const gate=createDossierResponseGate({...input('Czekam.'),now:new Date(0),era:'prl-1970s',isCurrent:()=>true,ordinaryTurn:true});
 expect(()=>gate.validate('[EKWIPUNEK: DODAJ | @prabuty.item.clue-photo-prabuty-1947]',{type:'metadata',dossierFinalizationToken:'test',dossierInventoryWritesAllowed:true})).toThrow('DOSSIER_UNPLANNED_EFFECT');
 gate.validate('You wait.',{type:'metadata',dossierFinalizationToken:'test',dossierInventoryWritesAllowed:true,timeUpdate:{...time,day:19,hour:23,minute:59}});
 expect(gate.candidate?.next.inventory.entries).toHaveLength(0);expect(gate.gameTime).toEqual(time);
});

const clueCases=[
 ['clue-photo-prabuty','loc-warszawa-redakcja','fotografię','photograph'],
 ['clue-prague-delegation-list','loc-warszawa-redakcja','listę delegatów','delegation list'],
 ['clue-skrzynski-psychotronic-report','loc-warszawa-redakcja','raport Skrzyńskiego',"Skrzynski's report"],
 ['clue-herbal-recipe-152','loc-elblag-klasztor','recepturę ziołową','herbal recipe'],
 ['clue-wiretap-bug-elblag','loc-elblag-klasztor','pluskwę podsłuchową','wiretap bug'],
 ['clue-klimuszko-vision-crypt','loc-elblag-klasztor','widzenie Klimuszki','vision'],
 ['clue-amber-ashes','loc-prabuty-wykopaliska','popiół bursztynowy','amber ashes'],
 ['clue-polak-testimony-monk','loc-prabuty-wykopaliska','Polaka o zakonniku','Polak about the monk'],
 ['clue-military-tire-tracks','loc-prabuty-wykopaliska','ślady opon','tire tracks'],
 ['clue-sb-file-klin','loc-msw-warszawa','teczkę SB KLIN','KLIN file'],
 ['clue-sb-wiretap-elblag-log','loc-msw-warszawa','taśmę ZK-140','reel-to-reel tape'],
 ['clue-msw-excavation-order','loc-msw-warszawa','rozkaz zabezpieczenia wykopalisk','excavation order'],
];
for(const lang of ['pl','en'] as const){
 test.each(clueCases)(`${lang} source %s grants only its basic clue; deeper action requests source bonus`,(id,location,pl,en)=>{
  const target=lang==='pl'?pl:en;
  const plan=planPrabutyTurn(input((lang==='pl'?'Badam ':'I examine the ')+target+'.',location))!;
  expect(plan.clueIds).toEqual(['prabuty.clue.'+id]);expect(plan.skillTests).toEqual([]);
  const deeper=planPrabutyTurn(input((lang==='pl'?'Analizuję ':'I study the ')+target+'.',location))!;
  expect(deeper.skillTests).toHaveLength(1);expect(deeper.skillTests[0].dossierConditionId).toBe('prabuty-bonus-'+id);
  expect(planPrabutyTurn(input((lang==='pl'?'Badam ':'I examine the ')+target+'.','OFF_GRAPH'))!.clueIds).toEqual([]);
 });
 test.each([
  ['clue-photo-prabuty-1947','loc-warszawa-redakcja','fotografię','photograph'],
  ['clue-sb-file-klin','loc-msw-warszawa','teczkę SB KLIN','KLIN file'],
  ['clue-herbal-recipe-152','loc-elblag-klasztor','recepturę ziołową','herbal recipe'],
  ['audio-sb-wiretap-elblag','loc-msw-warszawa','taśmę ZK-140','reel-to-reel tape'],
 ])(`${lang} item %s: take transfer drop and retake preserve one identity`,(slug,location,pl,en)=>{
  const other={...pc,id:'beata',name:'Beata',equipment:[]};
  const make=(message:string,actor=pc,characters=[pc,other])=>createDossierResponseGate({...input(message,location),activeCharacter:actor,characters,knownHandoutIds:['prabuty.media.'+slug],now:new Date(0),era:'prl-1970s',ordinaryTurn:true,isCurrent:()=>true,turnId:message.slice(0,20).replace(/[^a-zA-Z]/g,'a')});
  const meta=()=>({type:'metadata' as const,dossierFinalizationToken:'test',dossierInventoryWritesAllowed:true});
  const target=lang==='pl'?pl:en;
  const taken=make((lang==='pl'?'Zabieram ':'I take the ')+target+'.');taken.validate('OK.',meta());
  expect(taken.candidate!.next.inventory.entries).toHaveLength(1);
  const identity=taken.candidate!.next.inventory.entries[0].item.id;
  const owned=taken.candidate!.next;localStorage.setItem('zew-dossier-inventory:actions',JSON.stringify(owned.inventory));
  const transferred=make((lang==='pl'?'Przekazuję ':'I give the ')+target+(lang==='pl'?' dla Beata.':' to Beata.'),owned.activeCharacter!,owned.characters);transferred.validate('OK.',meta());
  expect(transferred.candidate!.next.inventory.entries[0].holderId).toBe('beata');
  const shared=transferred.candidate!.next;localStorage.setItem('zew-dossier-inventory:actions',JSON.stringify(shared.inventory));
  const dropped=make((lang==='pl'?'Odkładam ':'I drop the ')+target+'.',shared.characters.find(c=>c.id==='beata')!,shared.characters);dropped.validate('OK.',meta());
  expect(dropped.candidate!.next.inventory.entries[0].placement).toBe('location');
  localStorage.setItem('zew-dossier-inventory:actions',JSON.stringify(dropped.candidate!.next.inventory));
  const again=make((lang==='pl'?'Zabieram ':'I take the ')+target+'.',dropped.candidate!.next.activeCharacter!,dropped.candidate!.next.characters);again.validate('OK.',meta());
  expect(again.candidate!.next.inventory.entries[0].item.id).toBe(identity);
 });
}

test.each(['preparing','active'])('a matching actual hard roll executes generator transition from %s without an AI state tag',phase=>{
 const ctx=input('Wynik lokalnego testu.','loc-prabuty-wykopaliska');
 const state={...ctx.world,objects:ctx.world.objects.map(o=>({...o,state:o.entityId==='obj-prabuty-generator'?phase:o.entityId==='obj-prabuty-rift'&&phase==='active'?'open':o.state}))};
 localStorage.setItem('zew-dossier-world-state:actions',JSON.stringify(state));
 const test={id:'local-test',dossierConditionId:phase==='active'?'prabuty-disable-active':'prabuty-disable-preparing',characterId:pc.id,skillName:'Naprawa elektryczna',skillValue:60,difficulty:'trudny' as const,modifiers:[],justification:'Generators'};
 const roll={testId:test.id,resolutionId:'actual-roll',characterId:pc.id,skillNames:[test.skillName],requiredDifficulty:'hard' as const,passedRequirement:true,outcome:'hard' as const,luckSpent:0};
 const gate=createDossierResponseGate({...ctx,skillTests:[test],skillRolls:[roll],now:new Date(0),era:'prl-1970s',ordinaryTurn:true,isCurrent:()=>true});
 gate.validate('Done.',{type:'metadata',dossierFinalizationToken:'token',dossierInventoryWritesAllowed:true});
 expect(gate.candidate!.next.world.objects.find(o=>o.entityId==='obj-prabuty-generator')!.state).toBe('disabled');
 expect(gate.candidate!.next.world.usedResolutionIds).toContain('actual-roll');
 const failed=createDossierResponseGate({...ctx,skillTests:[test],skillRolls:[{...roll,outcome:'fail',passedRequirement:false}],now:new Date(0),era:'prl-1970s',ordinaryTurn:true,isCurrent:()=>true});
 failed.validate('Done.',{type:'metadata',dossierFinalizationToken:'token',dossierInventoryWritesAllowed:true});
 expect(failed.candidate!.next.world.objects.find(o=>o.entityId==='obj-prabuty-generator')!.state).toBe(phase);
});
test.each(['Zamykam szczelinę.','I close the rift.'])('closes rift only after disabled generators: %s',message=>{
 const ctx=input(message,'loc-prabuty-krypta');
 for(const generator of ['disabled','active']){
  const world={...ctx.world,objects:ctx.world.objects.map(o=>({...o,state:o.entityId==='obj-prabuty-generator'?generator:o.entityId==='obj-prabuty-rift'?'open':o.state}))};
  const plan=planPrabutyTurn({...ctx,world})!;expect(Boolean(plan.worldText)).toBe(generator==='disabled');
 }
});
test.each(['Jadę do klasztoru przez 4 godziny.','I travel to the monastery for 4 hours.'])('explicit authorized travel duration controls arrival and clock: %s',message=>{
 const plan=planPrabutyTurn(input(message))!;expect(plan.location).toBe('loc-elblag-klasztor');expect(plan.gameTime.hour).toBe(23);expect(plan.clueIds).toEqual([]);
});
test('continuation never repeats acquisition, checks, or world effects',()=>{
 const plan=planPrabutyTurn({...input('Zabieram fotografię. Analizuję fotografię.'),continuation:true})!;
 expect(plan.clueIds).toEqual([]);expect(plan.inventoryText).toBe('');expect(plan.skillTests).toEqual([]);expect(plan.worldText).toBe('');
});
test('wait duration drives the existing deadline executor, while bare travel has no invented duration',()=>{
 const plan=planPrabutyTurn(input('Czekam 24 godziny.'))!;expect(plan.gameTime.day).toBe(19);
 const bare=planPrabutyTurn(input('Jadę do klasztoru.'))!;expect(bare.gameTime).toEqual(time);expect(bare.location).toBe('loc-warszawa-redakcja');
});

test.each(['trop','wskazowka','odkrycie','discovery','find','item','przedmiot','rzecz'])('AI journal alias %s cannot grant a clue',alias=>{
 const gate=createDossierResponseGate({...input('Czekam.'),now:new Date(0),era:'prl-1970s',ordinaryTurn:true,isCurrent:()=>true});
 gate.validate(`[DZIENNIK:${alias}:Nieautoryzowany trop]Tajny dokument[/DZIENNIK] [PRZEDMIOT: Tajny dokument: opis]`,{type:'metadata',dossierFinalizationToken:'t',dossierInventoryWritesAllowed:true});
 expect(gate.candidate!.cleanText).not.toContain('Nieautoryzowany');expect(gate.candidate!.cleanText).not.toContain('PRZEDMIOT');
});
test.each(['Zabieram teczkę.','I take the folder.'])('the actual MSW folder has unambiguous ownership: %s',message=>{
 const gate=createDossierResponseGate({...input(message,'loc-msw-warszawa'),now:new Date(0),era:'prl-1970s',ordinaryTurn:true,isCurrent:()=>true});
 gate.validate('OK.',{type:'metadata',dossierFinalizationToken:'t',dossierInventoryWritesAllowed:true});
 expect(gate.candidate!.next.inventory.entries[0].recordId).toBe('prabuty.item.clue-sb-file-klin');
});
test('pre-narration plan includes the exact automatic ending and clock events',()=>{
 const plan=planPrabutyTurn({...input('Czekam 2 godziny.'),gameTime:{...time,day:19,hour:22,minute:59}})!;
 expect(plan.ending).toBe('operation-completed');expect(plan.events).toHaveLength(3);expect(plan.projectedWorld.find(o=>o.entityId==='obj-prabuty-ending')!.state).toBe('operation-completed');
});


test.each([
 'Oglądam to zdjęcie. \n\nA Pan, Panie Dotkorze... co Pan o tym sądzi?',
 'Co Pan o tym sądzi? Oglądam to zdjęcie.',
 'I examine this photograph. Doctor, what do you think?',
 'Doctor, what do you think? I examine the photograph.',
])('mixed turn preserves the source clue and published handout: %s', playerMessage => {
 const context = input(playerMessage);
 const plan = planPrabutyTurn(context)!;
 expect(plan.handouts).toEqual(['prabuty.media.clue-photo-prabuty-1947']);
 expect(plan.clueIds).toEqual(['prabuty.clue.clue-photo-prabuty']);
 expect(plan.inventoryText).toBe('');
 const gate = createDossierResponseGate({...context,now:new Date(0),era:'prl-1970s',isCurrent:()=>true,ordinaryTurn:true});
 gate.validate('Opis fotografii bez znacznika handoutu.',{type:'metadata',dossierFinalizationToken:'test',dossierInventoryWritesAllowed:true});
 expect(gate.handouts).toEqual(plan.handouts);
 expect(gate.candidate?.cleanText).toContain('[HANDOUT:prabuty.media.clue-photo-prabuty-1947]');
 expect(gate.candidate?.cleanText).toContain('dossier_record_id:prabuty.clue.clue-photo-prabuty');
 expect(gate.candidate?.next.inventory.entries).toHaveLength(0);
});
test.each(['Oglądam fotografię?', 'Jeśli Pan pozwoli,\noglądam fotografię. Co Pan o tym sądzi?', 'Helena mówi:\noglądam fotografię. Co Pan o tym sądzi?', 'Co Pan sądzi? Nie oglądam fotografii.', 'What do you think? If you allow it, I examine the photograph.'])(
 'mixed turn with no declared action grants no clue: %s', playerMessage => {
  const plan = planPrabutyTurn(input(playerMessage))!;
  expect(plan.handouts).toEqual([]); expect(plan.clueIds).toEqual([]); expect(plan.inventoryText).toBe('');
 });

test('publishes present authored actors only from visible narration, without keeper or off-scene content',()=>{
 const plan=planPrabutyTurn(input('Rozglądam się.'))!;
 const result=applyPrabutyPlanToText('Helena kładzie teczkę na biurku. Dr Skrzyński czeka przy oknie. [GM_THOUGHTS]Klimuszko zna SEKRET.[/GM_THOUGHTS][DZIENNIK:npc:Nieznajomy]SEKRET[/DZIENNIK]',plan);
 expect(result).toMatch(/\[DZIENNIK:npc:Helena[^\]]*\]Helena kładzie teczkę na biurku\./);
 expect(extractJournalTags(result).find(tag => tag.title === 'dr Jarosław Skrzyński')?.content).toContain('Dr Skrzyński czeka przy oknie.');
 const tags=result.match(/\[DZIENNIK:npc:[\s\S]*?\[\/DZIENNIK\]/g)??[];
 expect(tags).toHaveLength(2);
 expect(tags.join('')).not.toMatch(/SEKRET|Klimuszko|keeperSecret/);
});

test('the observed natural take-from-desk declaration acquires one physical photograph and its source',()=>{
 const ctx=input('Biorę z biurka fotografię ruin do torby, po czym wyjmuję ją i oglądam z obu stron. Chcę ustalić, co dokładnie przedstawia i czy ma jakiś czytelny dopisek.');
 const gate=createDossierResponseGate({...ctx,now:new Date(0),era:'prl-1970s',ordinaryTurn:true,isCurrent:()=>true});
 gate.validate('Oglądasz fotografię.',{type:'metadata',dossierFinalizationToken:'t',dossierInventoryWritesAllowed:true});
 expect(gate.candidate!.next.inventory.entries).toHaveLength(1);
 expect(gate.handouts).toContain('prabuty.media.clue-photo-prabuty-1947');
});
test('hot-seat declarations bind the taken photograph to Tomasz and its deeper test to Barbara',()=>{
 const tomasz={...pc,id:'tomasz',name:'Tomasz Nowicki'};
 const barbara={...pc,id:'barbara',name:'Dr Barbara Zawadzka'};
 const message='Gracz 1 (@Tomasz Nowicki): Biorę z biurka fotografię ruin. ; Gracz 2 (@Dr Barbara Zawadzka): Analizuję fotografię, szukając szczegółów architektury ruin.';
 const ctx={...input(message),characters:[tomasz,barbara],activeCharacter:barbara};
 const gate=createDossierResponseGate({...ctx,now:new Date(0),era:'prl-1970s',ordinaryTurn:true,isCurrent:()=>true});
 gate.validate('Tomasz bierze fotografię. Barbara analizuje ruiny.',{type:'metadata',dossierFinalizationToken:'t',dossierInventoryWritesAllowed:true});
 expect(gate.candidate!.next.inventory.entries[0]?.holderId).toBe(tomasz.id);
 expect(gate.actionPlan!.skillTests).toEqual([expect.objectContaining({characterId:barbara.id,dossierConditionId:'prabuty-bonus-clue-photo-prabuty'})]);
 expect(gate.handouts).toContain('prabuty.media.clue-photo-prabuty-1947');
});

test('a natural Polish transfer names Barbara in the dative and preserves one item identity',()=>{
 const tomasz={...pc,id:'tomasz',name:'Tomasz Nowicki'};const barbara={...pc,id:'barbara',name:'Dr Barbara Zawadzka'};
 const start={...input('Biorę fotografię.'),characters:[tomasz,barbara],activeCharacter:tomasz};
 const take=createDossierResponseGate({...start,now:new Date(0),era:'prl-1970s',ordinaryTurn:true,isCurrent:()=>true});
 const meta={type:'metadata' as const,dossierFinalizationToken:'t',dossierInventoryWritesAllowed:true};
 take.validate('Bierzesz fotografię.',meta);
 const owned=take.candidate!.next;localStorage.setItem('zew-dossier-inventory:actions',JSON.stringify(owned.inventory));
 const transfer=createDossierResponseGate({...start,turnId:'transfer',playerMessage:'Przekazuję fotografię Barbarze.',characters:owned.characters,activeCharacter:owned.activeCharacter!,now:new Date(0),era:'prl-1970s',ordinaryTurn:true,isCurrent:()=>true});
 transfer.validate('Barbara przyjmuje fotografię.',meta);
 expect(transfer.actionPlan!.inventoryActions).toEqual([expect.objectContaining({itemName:'Fotografia z ruin w Prabutach (1947)',ownerBefore:tomasz.name,ownerAfter:barbara.name,operation:'PRZEKAZ'})]);
 expect(transfer.candidate!.cleanText).toContain('Tomasz Nowicki przekazuje ten przedmiot postaci Dr Barbara Zawadzka.');
 expect(transfer.candidate!.next.inventory.entries[0].holderId).toBe(barbara.id);
 expect(transfer.candidate!.next.inventory.entries[0].item.id).toBe(owned.inventory.entries[0].item.id);
});

test('a duet world-action test belongs to its declarant, regardless of the selected sidebar character',()=>{
 const tomasz={...pc,id:'tomasz',name:'Tomasz Nowicki'};const barbara={...pc,id:'barbara',name:'Dr Barbara Zawadzka'};
 const ctx={...input('Gracz 1 (@Tomasz Nowicki): Wyłączam generator. ; Gracz 2 (@Dr Barbara Zawadzka): Pasuję.','loc-prabuty-wykopaliska'),characters:[tomasz,barbara],activeCharacter:barbara};
 expect(planPrabutyTurn(ctx)!.skillTests).toEqual([expect.objectContaining({characterId:tomasz.id,dossierConditionId:'prabuty-disable-preparing'})]);
});


test('the same source narration survives server publication, client validation and a strict save snapshot',async()=>{
 const {CampaignMemoryLedgerStore}=await import('@/core/memory/ledger-store');
 const {extractRevealedTurn}=await import('@/core/memory/revealed-facts');
 const ctx=input('Biorę fotografię.');
 const plan=planPrabutyTurn(ctx)!;
 const serverText=applyPrabutyPlanToText('[Co robisz?]',plan);
 const gate=createDossierResponseGate({...ctx,now:new Date(0),era:'prl-1970s',ordinaryTurn:true,isCurrent:()=>true});
 gate.validate(serverText,{type:'metadata',dossierFinalizationToken:'source-snapshot',dossierInventoryWritesAllowed:true});
 const clientText=gate.candidate!.cleanText;
 const serverNarrative=extractRevealedTurn(serverText,'source-snapshot').narrative;
 expect(extractRevealedTurn(clientText,'source-snapshot').narrative).toBe(serverNarrative);
 const store=new CampaignMemoryLedgerStore(':memory:');
 try{
  const scope={schemaVersion:1 as const,campaignDefinitionId:'scenario:prabuty',kind:'scenario' as const,playthroughId:'actions',adventureId:ctx.adventureId};
  store.recordConversationTurn({scope,sessionId:'actions',messageId:'source-snapshot',userText:ctx.playerMessage,assistantText:serverNarrative});
  expect(()=>store.createSnapshot(scope,[{id:'source-snapshot',role:'assistant',content:clientText}])).not.toThrow();
 }finally{store.close();}
});

test.each([
 'Jadę do klasztoru w Elblągu. Podróż zajmuje 6 godzin.',
 'Jadę do klasztoru w Elblągu. Podróż zajmie 6 godzin.',
 'I travel to the monastery in Elblag. The journey takes 6 hours.',
])('travel duration may be a separate sentence without adding a second action: %s',message=>{
 const plan=planPrabutyTurn(input(message))!;
 expect(plan.location).toBe('loc-elblag-klasztor');
 expect(plan.gameTime).toEqual({...time,day:19,hour:1});
});
test('another action or uncertain duration cannot authorize travel',()=>{
 for(const message of ['Jadę do klasztoru. Badam fotografię przez 6 godzin.','Jadę do klasztoru. Może podróż zajmie 6 godzin.']){
  const plan=planPrabutyTurn(input(message))!;expect(plan.location).toBe('loc-warszawa-redakcja');expect(plan.gameTime).toEqual(time);
 }
});
test('orphan private marker never reaches server/client source snapshot and mechanics survive',()=>{
 const plan=planPrabutyTurn(input('Biorę fotografię.'))!;
 const raw='Opis otoczenia. [MYŚLI\n[LOKACJA:loc-warszawa-redakcja]';
 const server=applyPrabutyPlanToText(raw,plan);const client=applyPrabutyPlanToText(server,plan);
 expect(server).not.toContain('[MYŚLI');expect(client).not.toContain('[MYŚLI');
 expect(server).toContain('[EKWIPUNEK: DODAJ');expect(server).toContain('[LOKACJA:loc-warszawa-redakcja]');
});

test.each(['[MYŚLI_MG: sekret pierwszej linii\nDrugi sekret o winowajcy\n','[MYŚLI_MG\nSekret winowajcy\n','[THOUGHTS: hidden [calm]\nCulprit secret\n'])('incomplete private block is removed in full before later mechanics: %s',privateBlock=>{
 const plan=planPrabutyTurn(input('Biorę fotografię.'))!;
 const value=applyPrabutyPlanToText('Opis jawny. '+privateBlock+'[LOKACJA:loc-warszawa-redakcja]',plan);
 expect(value).not.toMatch(/MYŚLI|THOUGHTS|sekret|Sekret|Culprit|hidden|winowajcy/);
 expect(value).toContain('Opis jawny.');expect(value).toContain('[EKWIPUNEK: DODAJ');
});

test('a model location tag cannot end an incomplete private block and reveal its tail',()=>{
 const plan=planPrabutyTurn(input('Biorę fotografię.'))!;
 const value=applyPrabutyPlanToText('Opis jawny. [MYŚLI_MG: plan:\n[LOKACJA:loc-warszawa-redakcja]\nUkrytym winowajcą jest Edward.',plan);
 expect(value).not.toMatch(/MYŚLI|winowajcą|Edward/);
 expect(value).toContain('Opis jawny.');expect(value).toContain('[EKWIPUNEK: DODAJ');expect(value).toContain('[LOKACJA:loc-warszawa-redakcja]');
});


describe('public narration source fidelity',()=>{
 test('does not publish the internal ending label in clue prose or journal',()=>{
  const plan=planPrabutyTurn(input('Pytam Klimuszkę o widzenie.','loc-elblag-klasztor'))!;
  expect(plan.journalText).not.toContain('(Finał)');
  expect(applyPrabutyPlanToText('Krypta (Finał).',plan)).not.toContain('(Finał)');
 });
 test.each(['receptura numer sto pięćdziesiąt','receptury nr 150','mieszankę numer 151'])(
  'keeps the authored recipe number in NPC prose: %s',phrase=>{
   const plan=planPrabutyTurn(input('Pytam Klimuszkę o recepturę.','loc-elblag-klasztor'))!;
   const text=applyPrabutyPlanToText('Klimuszko mówi: „To '+phrase+'”.',plan);
   expect(text).toContain('152');expect(text).not.toContain(phrase);
   expect(applyPrabutyPlanToText(text,plan)).toBe(text);
  });
 test('does not rewrite unrelated numbers or an unnumbered recipe',()=>{
  const plan=planPrabutyTurn(input('Pytam Klimuszkę.','loc-elblag-klasztor'))!;
  const prose='Księga ma 150 stron. Receptura ma sto pięćdziesiąt lat. „Czekałem kwadrans” - mówi Klimuszko.';
  expect(applyPrabutyPlanToText(prose,plan)).toContain(prose);
 });
 test.each(['Mijają kwadranse. Popiół pozostaje zagadką.','Minęło piętnaście minut. Popiół pozostaje zagadką.'])(
  'cannot narrate an unrecorded elapsed interval: %s',prose=>{
   const plan=planPrabutyTurn(input('Badam popiół.','loc-prabuty-wykopaliska'))!;
   const text=applyPrabutyPlanToText(prose,plan);
   expect(text).not.toContain(prose.split('.')[0]);expect(text).toContain('19:40');expect(text).toContain('Popiół pozostaje zagadką.');
   expect(plan.gameTime).toEqual(time);expect(applyPrabutyPlanToText(text,plan)).toBe(text);
  });
 test('keeps future, conditional and historical time statements',()=>{
  const plan=planPrabutyTurn(input('Rozmawiam.'))!;
  const prose='Jeśli minie kwadrans, wrócimy. Podróż zajmie sześć godzin. Klimuszko mówi: „Minęły lata od wojny”.';
  expect(applyPrabutyPlanToText(prose,plan)).toContain(prose);
 });
 test('publishes the actual clock when travel changes date',()=>{
  const plan=planPrabutyTurn(input('Jadę do klasztoru. Podróż zajmie 6 godzin.'))!;
  expect(applyPrabutyPlanToText('Mijają kwadranse. Widać klasztor.',plan)).toContain('01:40');
  expect(plan.gameTime.day).toBe(19);
 });
});


test('keeps the complete public NPC quotation across doctor abbreviations', () => {
  const plan = planPrabutyTurn(input('Rozmawiam z Heleną.'))!;
  const quote = 'Helena Krawczyk: „Masz raport dr. Skrzyńskiego. Przeczytaj go uważnie.”';
  const result = applyPrabutyPlanToText(quote, plan);
  const tag = extractJournalTags(result).find(tag => tag.type === 'npc' && tag.title === 'Helena Krawczyk');
  expect(tag?.content).toBe(quote);
  expect(tag?.sourceNpc).toBe('Helena Krawczyk');
  expect(applyPrabutyPlanToText(result, plan)).toBe(result);
});


test.each([
  '[MYŚLI_MG: Helena Krawczyk: „UKRYTY SEKRET TESTOWY”.]',
  '[GM_THOUGHTS]Helena Krawczyk: „UKRYTY SEKRET TESTOWY”.[/GM_THOUGHTS]',
  '[GM_THOUGHTS]\nHelena Krawczyk: „UKRYTY SEKRET TESTOWY”.\n[DZIENNIK:npc:Helena Krawczyk]UKRYTY SEKRET TESTOWY[/DZIENNIK]\n[/GM_THOUGHTS]',
])('publishes the visible quotation after stripping private dialogue before parsing: %s', privateText => {
  const plan = planPrabutyTurn(input('Rozmawiam z Heleną.'))!;
  const spoken = 'Helena Krawczyk: „Dzień dobry”.';
  const paragraph = 'Helena kładzie teczkę na biurku.';
  const result = applyPrabutyPlanToText(privateText + '\n' + spoken + '\n\n' + paragraph, plan);
  const tag = extractJournalTags(result).find(tag => tag.type === 'npc' && tag.title === 'Helena Krawczyk');
  expect(tag?.content).toBe(spoken);
  expect(tag?.sourceNpc).toBe('Helena Krawczyk');
  expect(JSON.stringify(extractJournalTags(result))).not.toContain('UKRYTY SEKRET TESTOWY');
  expect(result).toContain(spoken + '\n\n' + paragraph);
});
