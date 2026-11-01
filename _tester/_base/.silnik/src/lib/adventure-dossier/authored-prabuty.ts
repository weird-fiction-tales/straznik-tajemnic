import {STREFA_11_ADVENTURES} from '../adventures-data';
import {isGameTime} from '../time-manager';
import type {GameTime} from '../types';
import type {DossierItemAccessCheck,DossierRagPayload,DossierRagRecord,DossierRecordType,DossierWorldObjectBinding} from './rag-schema';

/** Authored local playtest design. A populated design never represents human approval. */
export const PRABUTY_AUTHORING_VERSION='prabuty-situations-v5';
export const PRABUTY_WORLD_IDS={generator:'obj-prabuty-generator',rift:'obj-prabuty-rift',ending:'obj-prabuty-ending'} as const;
export type PrabutyEnding='interrupted'|'operation-completed'|'withdrawn';
export interface PrabutyWorldContext {
 gameTime:GameTime;generator:string;rift:string;withdrawalDeclared?:boolean;
}
function sourceAdventure(){
 const adventure=STREFA_11_ADVENTURES.find(a=>a.id==='cien-nad-prabutami');
 if(!adventure?.graph?.nodes||adventure.graph.nodes.length!==5||adventure.graph.clues.length!==12||
   adventure.graph.npcs.length!==5||adventure.handouts?.length!==4)throw Error('Prabuty canonical source coverage changed');
 return adventure;
}
/** Explicit playtest pacing: the last quarter of the source clock is a playable climax. */
export function getPrabutySchedule(){
 const clock=sourceAdventure().doomClock;
 if(!clock?.deadline||!isGameTime(clock.deadline)||!clock.totalHours||!Number.isFinite(clock.totalHours)||clock.totalHours<=0)
  throw Error('Prabuty canonical clock required');
 const deadline={...clock.deadline};
 const t=new Date(Date.UTC(deadline.year,deadline.month,deadline.day,deadline.hour,deadline.minute)-clock.totalHours*3_600_000/4);
 return {deadline,generatorActivation:{year:t.getUTCFullYear(),month:t.getUTCMonth(),day:t.getUTCDate(),hour:t.getUTCHours(),minute:t.getUTCMinutes()}};
}
function reached(time:GameTime,target:GameTime){
 if(!isGameTime(time))return false;
 const stamp=(t:GameTime)=>Date.UTC(t.year,t.month,t.day,t.hour,t.minute);
 return stamp(time)>=stamp(target);
}
function deadlineReached(time:GameTime){return reached(time,getPrabutySchedule().deadline);}
function activationReached(time:GameTime){return reached(time,getPrabutySchedule().generatorActivation);}
/** Called with the saved application clock and confirmed world state, never a narrator's phase number. */
export function getPrabutyEnding(input:PrabutyWorldContext):PrabutyEnding|null {
 if(!isGameTime(input.gameTime)||!['preparing','active','disabled'].includes(input.generator)||!['latent','open','closed'].includes(input.rift))return null;
 if(input.generator==='disabled'&&['latent','closed'].includes(input.rift))return 'interrupted';
 if(deadlineReached(input.gameTime)&&input.generator==='active'&&input.rift==='open')return 'operation-completed';
 if(input.withdrawalDeclared===true)return 'withdrawn';
 return null;
}
/** An additional scenario guard for the existing typed world executor, not a replacement for dice validation. */
export function canApplyPrabutyWorldTransition(input:PrabutyWorldContext&{entityId:string;transitionId:string}):boolean {
 if(!isGameTime(input.gameTime))return false;
 if(input.entityId===PRABUTY_WORLD_IDS.generator){
  if(input.transitionId==='start-generators')return input.generator==='preparing'&&activationReached(input.gameTime);
  if(input.transitionId==='disable-preparing')return input.generator==='preparing';
  if(input.transitionId==='disable-active')return input.generator==='active';
 }
 if(input.entityId===PRABUTY_WORLD_IDS.rift){
  if(input.transitionId==='open-rift')return input.rift==='latent'&&input.generator==='active'&&activationReached(input.gameTime);
  if(input.transitionId==='close-rift')return input.rift==='open'&&input.generator==='disabled';
 }
 if(input.entityId===PRABUTY_WORLD_IDS.ending){
  const ending=getPrabutyEnding(input);
  return (input.transitionId==='prevent-experiment'&&ending==='interrupted'&&input.rift==='latent')||
   (input.transitionId==='interrupt-experiment'&&ending==='interrupted'&&input.rift==='closed')||
   (input.transitionId==='complete-operation'&&ending==='operation-completed')||
   (input.transitionId==='withdraw'&&ending==='withdrawn');
 }
 return false;
}
export interface PrabutyClueRule {
 clueId:string;sourceNodeId:string;targetNodeId:string;basicRequiresRoll:false;
 basicDisclosure:'on-credible-action';bonusCheck:DossierItemAccessCheck;
 failure:{grantAcquisition:false;preserveSourceRoutes:true;retryRequires:string};
}
export function getPrabutyClueRules():PrabutyClueRule[]{
 return sourceAdventure().graph!.clues.map(clue=>({
  clueId:clue.id,sourceNodeId:clue.sourceNodeId!,targetNodeId:clue.targetNodeId!,
  basicRequiresRoll:false,basicDisclosure:'on-credible-action',
  bonusCheck:{id:'prabuty-bonus-'+clue.id,skill_names:clue.requiredSkill==='Nauka (Botanika / Farmacja)'?
   ['Nauka (Botanika)','Nauka (Farmacja)']:clue.requiredSkill==='Biblioteka'?
   ['Korzystanie z Bibliotek','Biblioteka','Library Use']:[clue.requiredSkill!],difficulty:'regular'},
  failure:{grantAcquisition:false,preserveSourceRoutes:true,
   retryRequires:'Nowe wiarygodne podejście lub dodatkowy czas. Nie zaliczaj nieudanego testu ani nie przyznawaj przedmiotu.'},
 }));
}
/** Source values and authored operations are separate in every card. No PDF or media bytes are produced. */
export function createAuthoredPrabutyPayload(editionFingerprint:string):DossierRagPayload{
 if(!/^sha256:[a-f0-9]{64}$/.test(editionFingerprint))throw Error('Exact edition fingerprint required');
 const adventure=sourceAdventure(),graph=adventure.graph!,nodes=graph.nodes!,records:DossierRagRecord[]=[];
 const canonical='runtime:adventures-data/'+adventure.id;
 const sceneById=new Map(nodes.map(node=>[node.id,node]));
 const locationById=new Map(graph.locations.map(location=>[location.id,location]));
 const sceneTags=(id:string)=>{const scene=sceneById.get(id),location=scene?.locationId?locationById.get(scene.locationId):undefined;
  return [...new Set([id,scene?.locationId,location?.name].filter((v):v is string=>!!v))];};
 const sceneRecord=(id:string)=>'prabuty.scene.'+id;
 const clueRecord=(id:string)=>'prabuty.clue.'+id;
 function add(id:string,type:DossierRecordType,content:unknown,options:{scenes?:string[];entities?:string[];mechanics?:DossierRagRecord['tags']['mechanics'];links?:string[];source?:string;always?:boolean}={}){
  const card:DossierRagRecord={schema_version:1,record_id:id,record_type:type,adventure_id:adventure.id,
   edition_fingerprint:editionFingerprint,language:'pl',content:JSON.stringify(content),
   tags:{scenes:options.scenes||[],entities:options.entities||[],mechanics:options.mechanics||[],topics:['authored-playtest',PRABUTY_AUTHORING_VERSION],triggers:[]},
   retrieval:{visibility:'gm_only',availability:options.always?'always':options.entities?.length&&type==='actor'?'when_entity_present':options.scenes?.length?'when_scene_active':'always',condition:null,priority:3},
   evidence:{provenance:'approved_design',source_ref:'authored-playtest:'+PRABUTY_AUTHORING_VERSION+'; '+canonical+'#'+(options.source||''),status:'set',approval:'pending',approved_by:null,approved_at:null},
   links:options.links||[]};
  records.push(card);return card;
 }
 const tag=(entity:string,transition:string)=>'[TECZKA_STANU: '+entity+' | '+transition+']';
 const rules=getPrabutyClueRules();
 const requestTest=(check:DossierItemAccessCheck,reason:string)=>
  '[TEST: '+check.skill_names[0]+' | '+(check.difficulty==='hard'?'trudny':check.difficulty==='extreme'?'ekstremalny':'zwykły')+' | | '+reason+' | DOSSIER_ACCESS: '+check.id+']';
 for(const [index,node] of nodes.entries()){
  const exits=graph.connections.filter(connection=>connection.fromId===node.id).map(connection=>({
   target:connection.toId,clue:connection.clueId,description:connection.description,
  }));
  add(sceneRecord(node.id),'scene',{
   title:node.name,situation:node.description,atmosphere:node.atmosphere,
   leads:graph.clues.filter(c=>c.sourceNodeId===node.id).map(c=>({id:c.id,destination:c.targetNodeId})),
   improvisation:'Dopowiadaj wiarygodne poboczne osoby, miejsca i zdarzenia. Zachowuj nowe powracające fakty w pamięci kampanii. Nie zmieniaj sprawców, dokumentów, położenia dowodów ani zapisanych wyników mechaniki.',
   sourceActorReferences:node.npcIds||[],sourceExits:exits,keeperSecret:node.secret,
   authorship:'Robocza adaptacja operacyjna. Nazwa NPC w źródle nie dowodzi jego aktualnej obecności.',
   procedure:'Zapytaj o zamiar gracza. Podstawowe informacje po wiarygodnej czynności nie wymagają rzutu. Nie zamykaj innych źródłowych dróg po porażce.',
   tests:rules.filter(rule=>rule.sourceNodeId===node.id).map(rule=>({clueId:rule.clueId,bonusCheck:rule.bonusCheck,
    request:requestTest(rule.bonusCheck,'Pogłębienie tropu '+rule.clueId),
    note:'Metadane przykładu wymagają parsera testów i identyfikacji aktywnego Badacza. Wynik dostarcza modal kości, nigdy tekst MG.'})),
   worldActions:node.isClimax?[
    {intent:'Wyłączyć lub uszkodzić pracujące generatory',tag:tag(PRABUTY_WORLD_IDS.generator,'disable-active'),checkId:'prabuty-disable-active',skill:'Naprawa elektryczna',difficulty:'hard',testRequest:'[TEST: Naprawa elektryczna | trudny | | Unieruchomienie generatorów pod presją | DOSSIER_ACCESS: prabuty-disable-active]'},
    {intent:'Po wyłączeniu generatorów zamknąć szczelinę',tag:tag(PRABUTY_WORLD_IDS.rift,'close-rift')},
    {intent:'Potwierdzić przerwanie eksperymentu',tag:tag(PRABUTY_WORLD_IDS.ending,'interrupt-experiment')},
    {intent:'Wycofać się',tag:tag(PRABUTY_WORLD_IDS.ending,'withdraw'),requires:'Wyraźna decyzja gracza; bez udawania wygranej.'},
   ]:node.id==='node-prabuty-wykopaliska'?[
    {intent:'Unieruchomić przygotowywane generatory',tag:tag(PRABUTY_WORLD_IDS.generator,'disable-preparing'),checkId:'prabuty-disable-preparing',skill:'Naprawa elektryczna',difficulty:'hard',testRequest:'[TEST: Naprawa elektryczna | trudny | | Unieruchomienie przygotowywanych generatorów | DOSSIER_ACCESS: prabuty-disable-preparing]'},
    {intent:'Potwierdzić powstrzymanie eksperymentu',tag:tag(PRABUTY_WORLD_IDS.ending,'prevent-experiment')},
   ]:[],
  },{scenes:sceneTags(node.id),mechanics:['coc7:clues-fail-forward','coc7:action-scenes-suspense'],
   links:exits.map(exit=>sceneRecord(exit.target)),source:'/graph/nodes/'+index});
 }
 for(const [index,clue] of graph.clues.entries()){
  const rule=rules.find(rule=>rule.clueId===clue.id)!;
  const basic:Record<string,string>={
   'clue-photo-prabuty':'Adnotacja na odwrocie fotografii kieruje do klasztoru w Elblągu i dzienników wizji ojca Klimuszki.',
   'clue-prague-delegation-list':'Przy nazwisku Klimuszki jest pieczęć Departamentu IV MSW i kryptonim KLIN. To kierunek urzędowego sprawdzenia w Warszawie.',
   'clue-skrzynski-psychotronic-report':'Doktor przedstawia relację o poparzeniach i świetlistych smugach przy plebanii i cmentarzu w Prabutach. To relacja do niezależnego sprawdzenia.',
  };
  add(clueRecord(clue.id),'clue',{title:clue.name,sourceDescription:clue.description,
   basicInformation:basic[clue.id]||'Po wiarygodnym zbadaniu tego źródła zachowaj kierunek: '+sceneById.get(rule.targetNodeId)!.name,
   rule,note:'Zwykłe czytanie udostępnionych informacji nie wymaga testu. Test dotyczy pogłębienia lub ryzyka, nie oczywistych liter. Nieudany test nie odblokowuje automatycznie dodatkowych szczegółów ani dostępu do przedmiotu.'},
   {scenes:sceneTags(rule.sourceNodeId),links:[sceneRecord(rule.targetNodeId)],mechanics:['coc7:clues-fail-forward','coc7:skill-tests'],source:'/graph/clues/'+index});
  add('prabuty.check.'+clue.id,'mechanic_hook',{kind:'authored-clue-bonus',clueId:clue.id,check:rule.bonusCheck,
   trigger:'Gracz deklaruje czynność, która wymaga pogłębionej interpretacji albo wiąże się z ryzykiem.',
   success:'Dodatkowy szczegół źródłowy można ujawnić dopiero po właściwym lokalnym rozstrzygnięciu.',
   failure:rule.failure,mechanicsOwner:'Wspólny resolver k100. MG nie wykonuje rzutu ani nie nadaje wynikowi sukcesu.'},
   {scenes:sceneTags(rule.sourceNodeId),links:[clueRecord(clue.id)],mechanics:['coc7:skill-tests','coc7:percentile-rolls','coc7:clues-fail-forward'],source:'/graph/clues/'+index});
 }
 const portrayal:Record<string,{goal:string;fear:string;resources:string}>={
  'npc-helena-krawczyk':{goal:'Zdobyć materiał oparty na sprawdzalnych dowodach.',fear:'Interwencja MSW i zamknięcie redakcji.',resources:'Redakcja, fotografia i kontakty zawodowe.'},
  'npc-jaroslaw-skrzynski':{goal:'Utrzymać pozycję konsultanta i przetrwać szantaż.',fear:'Ujawnienie współpracy i represje SB.',resources:'Wiedza o kongresie, raporty i kontakt z redakcją.'},
  'npc-klimuszko':{goal:'Pomóc zrozumieć zagrożenie bez powtarzania katastrofy.',fear:'Ponowne otwarcie szczeliny związanej z jego wizjami.',resources:'Wspomnienia z 1945 roku, dzienniki wizji i wiedza zielarska.'},
  'npc-tadeusz-polak':{goal:'Zachować świadectwo wydarzeń z 1945 roku.',fear:'Utrata pozostałych dowodów i naruszenie krypty.',resources:'Wspomnienia, plebania i zachowane fragmenty bursztynu.'},
  'npc-edward-majewski':{goal:'Przejąć kontrolę nad szczeliną dla przewagi politycznej.',fear:'Utrata kontroli nad operacją KLIN.',resources:'Podwładni Departamentu IV i program psychotroniczny KLIN.'},
 };
 const actorScene:Record<string,string>={
  'npc-helena-krawczyk':'node-warszawa-redakcja','npc-jaroslaw-skrzynski':'node-warszawa-redakcja',
  'npc-klimuszko':'node-elblag-klasztor','npc-tadeusz-polak':'node-prabuty-wykopaliska','npc-edward-majewski':'node-prabuty-wykopaliska',
 };
 for(const [index,actor] of graph.npcs.entries()){
  const scene=sceneById.get(actorScene[actor.id])!,location=locationById.get(scene.locationId!)!;
  const card=add('prabuty.actor.'+actor.id,'actor',{name:actor.name,description:actor.description,keeperSecret:actor.secret,authoredPortrayal:portrayal[actor.id],
   portrayalNote:'Motywacje i sposób prowadzenia są autorską adaptacją źródła. Wiedza NPC jest ograniczona do jego relacji i sekretu. Reaguj na wiarygodne pomysły gracza; nie dopisuj zasobów mechanicznych ani premii.',
   note:'Nie dopisuj statystyk. Stanu i położenia nie ustala sama wzmianka w karcie sceny.'},
   {entities:[actor.id],mechanics:['coc7:npc-profiles-resistance'],source:'/graph/npcs/'+index});
  card.actor_binding={entity_id:actor.id,name:actor.name,initial_state:{status:'alive',location_id:location.id,location_name:location.name,
   effects:[],source_ref:'authored-playtest:'+PRABUTY_AUTHORING_VERSION+'; '+canonical+'/graph/npcs/'+index},transitions:[]};
 }
 for(const [index,handout] of adventure.handouts!.entries()){
  const node=sceneById.get(handout.nodeId!)!,entityId='obj-'+handout.slug;
  const documentAuthority={canonicalText:handout.textContent,representation:'source-summary',literalTranscriptionAvailable:false};
  const card=add('prabuty.item.'+handout.slug,'fact',{title:handout.title,sourceText:handout.textContent,handoutSlug:handout.slug,documentAuthority,
   lifecycle:'Udostępnienie i obejrzenie nie oznaczają posiadania. Dodaj dopiero po wyraźnej deklaracji zabrania i rzeczywistym dostępie. Dokumentu nie zużywa samo przeczytanie.',
   addTag:'[EKWIPUNEK: DODAJ | @prabuty.item.'+handout.slug+']',transfer:'[EKWIPUNEK:@Imię właściciela: PRZEKAZ | @prabuty.item.'+handout.slug+' | Imię odbiorcy]',
   drop:'[EKWIPUNEK: ODLOZ | @prabuty.item.'+handout.slug+']'},
   {scenes:sceneTags(node.id),entities:[entityId],mechanics:['coc7:clues-fail-forward'],source:'/handouts/'+index});
  card.inventory_item={entity_id:entityId,name:handout.title,category:handout.audioUrl?'story':'document',source_location:node.locationId!,initial_state:{condition:'used'}};
  add('prabuty.media.'+handout.slug,'media',{handoutSlug:handout.slug,title:handout.title,image:handout.image,audioUrl:handout.audioUrl,
   nodeId:handout.nodeId,text:handout.textContent,documentAuthority,reveal:'Dopiero po realnym dostępie i obejrzeniu/odsłuchaniu. To autorski materiał lokalny, nie locator strony PDF.'},
   {scenes:sceneTags(node.id),links:[card.record_id],source:'/handouts/'+index});
 }
 const repair=(id:string):DossierItemAccessCheck=>({id,skill_names:['Naprawa elektryczna','Electrical Repair'],difficulty:'hard'});
 const {generator,rift,ending}=PRABUTY_WORLD_IDS;
 const machines:Array<{id:string;title:string;scenes:string[];binding:DossierWorldObjectBinding}>= [
  {id:generator,title:'Generatory operacji',scenes:[...sceneTags('node-prabuty-wykopaliska'),...sceneTags('node-prabuty-krypta-climax')],
   binding:{entity_id:generator,initial_state:'preparing',states:['preparing','active','disabled'],transitions:[
    {id:'start-generators',from:'preparing',to:'active'},
    {id:'disable-preparing',from:'preparing',to:'disabled',condition_id:'prabuty-disable-preparing',access_check:repair('prabuty-disable-preparing')},
    {id:'disable-active',from:'active',to:'disabled',condition_id:'prabuty-disable-active',access_check:repair('prabuty-disable-active')},
   ]}},
  {id:rift,title:'Szczelina w krypcie',scenes:sceneTags('node-prabuty-krypta-climax'),
   binding:{entity_id:rift,initial_state:'latent',states:['latent','open','closed'],transitions:[
    {id:'open-rift',from:'latent',to:'open',requires:[{entity_id:generator,state:'active'}]},
    {id:'close-rift',from:'open',to:'closed',requires:[{entity_id:generator,state:'disabled'}]},
   ]}},
  {id:ending,title:'Rozstrzygnięcie przygody',scenes:[],
   binding:{entity_id:ending,initial_state:'ongoing',states:['ongoing','interrupted','operation-completed','withdrawn'],transitions:[
    {id:'prevent-experiment',from:'ongoing',to:'interrupted',requires:[{entity_id:generator,state:'disabled'},{entity_id:rift,state:'latent'}]},
    {id:'interrupt-experiment',from:'ongoing',to:'interrupted',requires:[{entity_id:generator,state:'disabled'},{entity_id:rift,state:'closed'}]},
    {id:'complete-operation',from:'ongoing',to:'operation-completed',requires:[{entity_id:generator,state:'active'},{entity_id:rift,state:'open'}]},
    {id:'withdraw',from:'ongoing',to:'withdrawn'},
   ]}},
 ];
 for(const machine of machines){
  const card=add('prabuty.world.'+machine.id,'fact',{title:machine.title,states:machine.binding,
   authoredDesign:'Robocze, autorskie rozstrzygnięcia finału; nie są przepisanym zakończeniem ze źródła.',
   tags:machine.binding.transitions.map(t=>({transition:t.id,request:tag(machine.id,t.id),check:t.access_check,testRequest:t.access_check?requestTest(t.access_check,'Unieruchomienie generatorów'):undefined})),
   clockGuard:'start-generators i open-rift uruchamia aplikacja po generatorActivation zapisanym w harmonogramie; complete-operation dopiero po końcowym deadline. Numer fazy z narracji nie uruchamia żadnego zdarzenia. Nie emituj tych trzech przejść. Przed deadline istnieje okno na wyłączenie pracujących generatorów i zamknięcie szczeliny rzeczywistym testem kości.',
   endingGuard:'Zakończenie zapisuje aplikacja na podstawie potwierdzonych stanów. Narrator otrzymuje dowód zakończenia i dopiero wtedy opisuje finał. Sam tekst i tag końca sesji nie ustalają wyniku.'},
   {scenes:[...new Set(machine.scenes)],entities:[machine.id],always:machine.id===ending,source:'/authored-world'});
  card.world_object_binding=machine.binding;
 }
 add('prabuty.clock','pacing',{startDate:adventure.startDate,doomClock:adventure.doomClock,authoredSchedule:getPrabutySchedule(),
  climaxWindowDesign:'Autorska adaptacja do próby gry: ostatnia ćwiartka źródłowych 28 godzin, czyli 7 godzin przed deadline, jest oknem kulminacji. Generatory i szczelina uruchamiają się 19 października o 16:59. Do 23:59 można jeszcze przerwać operację. Nie jest to dodatkowy fakt historyczny ani zgoda człowieka.',
  documentFidelity:'Opisy dokumentów to streszczenia, nie dosłowne transkrypcje. Nie wymyślaj cytatów, autografów, dat dziennych ani nowych ostrzeżeń na fotografii. Rewers fotografii przekazuje tylko kierunek: klasztor w Elblągu i dzienniki wizji Klimuszki. Rozmowa może parafrazować ten fakt, bez udawania dokładnego brzmienia dokumentu. Obraz i audio pokazuje istniejący handout.',
  authoredProcedure:'Czas prowadzi TimeManager. Fazy napięcia nie są wykonanymi zdarzeniami. Nie dodawaj stałej kary czasu za nieudany test pogłębienia: źródło jej nie ustala. Zwykły czas czynności i podróży podaj jawnie w metadanych tury. Podróż wymaga jawnego zatwierdzonego czasu przejścia.',
  deadlineGuard:'Kod uruchamia start-generators i open-rift po generatorActivation jeśli aktualne stany na to pozwalają; nigdy nie przywraca disabled/closed. Operacja kończy się niepowodzeniem dopiero po końcowym deadline. Wcześniej można ją przerwać.'},
  {always:true,mechanics:['coc7:action-scenes-suspense'],source:'/doomClock'});
 add('prabuty.canon','director_note',{truthAnchor:adventure.truthAnchor,source:'Wiedza MG. Nie ujawniaj graczowi samego istnienia tej karty.',
  boundaries:'Różne źródłowe drogi i własne wiarygodne zamiary gracza pozostają dozwolone. Nie zamykaj sprawy z powodu jednego nieudanego rzutu.'},
  {always:true,source:'/truthAnchor'});
 return {schema_version:1,adventure_id:adventure.id,edition_fingerprint:editionFingerprint,records};
}
