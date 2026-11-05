import { sanitizeDiegeticProse, stripAITags, stripIncompletePrivateMarkers } from '../parsers/text-cleaner';
import { playerActionSentences, playerActionSegments, stripLeadingMaterialSource } from './player-action-clauses';
import { extractJournalTags } from '../parsers/journal-parser';
import type { Character, GameTime } from '../types';
import type { SkillRollResolution, SkillTestData } from '../parsers/types';
import type { DossierRagPayload, DossierItemAccessCheck } from './rag-schema';
import type { DossierInventoryProjection } from './inventory-state';
import type { DossierWorldStateProjection } from './world-object-state';
import { isAuthoredPrabutyPlaytest, advanceAuthoredPrabutyClock, applyAuthoredPrabutyTurn } from './authored-prabuty-turn';
import { getPrabutyClueRules, PRABUTY_WORLD_IDS } from './authored-prabuty';
import { acquiredHandoutsFromTurn } from './local-handouts';
import { canonicalSceneIds, resolveCanonicalAdventureLocation } from '../canonical-adventure-location';
import { meetsDifficulty, mapDifficultyToRequired } from '../dice-utils';
import { enforcePrabutyNarrativeFacts, publicPrabutyText } from './prabuty-narrative-fidelity';
import { extractAttributedDialogueSpans } from '../parsers/dialogue-parser';
import { resolveNpcPublicProfile } from '../npc-public-profile';
import { parseRevealedTags } from '@/core/memory/revealed-facts';

export interface PrabutyActionInput {
  payload: DossierRagPayload; turnId: string; playerMessage?: string; location: string; gameTime: GameTime;
  world: DossierWorldStateProjection; inventory: DossierInventoryProjection;
  characters: Character[]; activeCharacter: Character | null; skillTests: SkillTestData[]; skillRolls: SkillRollResolution[];
  knownHandoutIds?: readonly string[]; previousAssistantMessage?: string; continuation?: boolean;
}
// These are identities of the twelve authored sources, not a bag of scene keywords.
// Matching requires a direct action on the source, at its actual location.
const sources: Record<string, RegExp> = {
  'clue-photo-prabuty': /^(?:fotografi|zdjeci|odbitk|photograph|photo\b)/,
  'clue-prague-delegation-list': /^(?:liste?\s+(?:delegat|wyjazdow)|list\s+of\s+delegates|delegation\s+list)/,
  'clue-skrzynski-psychotronic-report': /^(?:raport\s+(?:dr\.?\s*)?skrzyn|skrzyn|doctor\s+skrzyn|dr\.?\s+skrzyn|skrzynski.s\s+report)/,
  'clue-herbal-recipe-152': /^(?:receptur|rekopis|mieszank|herbal\s+recipe|recipe|manuscript)/,
  'clue-wiretap-bug-elblag': /^(?:pluskw|mikrofon|kratke?\s+wentyl|pods l?uch|wiretap\s+bug|microphone|ventilation\s+grille|vent\b)/,
  'clue-klimuszko-vision-crypt': /^(?:klimuszk|ojca\s+klimuszk|o\.\s+klimuszk|father\s+klimuszk|widzeni|vision)/,
  'clue-amber-ashes': /^(?:popiol|probke?\s+(?:popiol|zywic)|bursztyn|amber\s+ash|ashes|resin\s+sample)/,
  'clue-polak-testimony-monk': /^(?:tadeusza?\s+polak|polak|koscieln|sexton)/,
  'clue-military-tire-tracks': /^(?:slady?\s+opon|kolein|przepustk|tire\s+tracks|tyre\s+tracks|military\s+tracks|pass\b)/,
  'clue-sb-file-klin': /^(?:folder\b|file\b|teczk[aei]?(?:$|\s+(?:dla|to)\b)|teczk[aei]?\s+(?:sb|msw|klin)|akta\s+klin|klin\s+(?:file|dossier)|(?:sb|msw)\s+file)/,
  'clue-sb-wiretap-elblag-log': /^(?:tasm|nagran|zk[- ]?140|tape|recording|reel.to.reel)/,
  'clue-msw-excavation-order': /^(?:rozkaz|szyfrogram|excavation\s+order|order\s+securing|coded\s+order)/,
};
const itemSources: Record<string,string> = {
  'clue-photo-prabuty-1947':'clue-photo-prabuty','clue-sb-file-klin':'clue-sb-file-klin',
  'clue-herbal-recipe-152':'clue-herbal-recipe-152','audio-sb-wiretap-elblag':'clue-sb-wiretap-elblag-log',
};
const normalize=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ł/g,'l').toLowerCase().trim();
function declarations(text:string):string[] {
  return playerActionSentences(text.replace(/\[[^\]]*\]/g,'')).map(normalize)
    .filter(sentence=>!/(?:\b(?:if|would|whether|said|says|asks|nie|not|without|jezeli|jesli|gdybym|zamiast)\b|^(?:czy|rozwazam|mysle|what\s+if)\b|mowi\s*:|powiedzial)/.test(sentence))
    .flatMap(sentence=>sentence.split(/\s+(?:and|oraz|i)\s+(?=(?:take|read|inspect|drop|give|open|biore|zabieram|czytam|ogladam|odkladam|przekazuje)\b)/))
    .map(part=>part.trim().replace(/^(?:(?:i|we|ja|my)\s+)?(?:(?:please|prosze|teraz|ostroznie)\s+)*/,'')).filter(Boolean).filter(part=>! /^(?:pasuje|pass)$/.test(part));
}
function object(clause:string,verbs:RegExp):string|null {
  const match=verbs.exec(clause);if(!match)return null;
  return stripLeadingMaterialSource(clause.slice(match[0].length).trim()).replace(/^(?:(?:the|a|an|this|that|ten|te|ta|tej|to|tego|stara|stary)\s+)*/,'');
}
const view=/^(?:ogladam|badam|czytam|przegladam|analizuje|interpretuje|sprawdzam|odsluchuje|slucham|pytam|rozmawiam\s+z|examine|inspect|read|study|analyze|interpret|check|listen\s+to|ask|talk\s+to)\s+/;
const take=/^(?:zabieram|biore|podnosze|chowam|take|pick\s+up|collect|keep)\s+/;
const give=/^(?:przekazuje|oddaje|wreczam|give|transfer|hand)\s+/;
const drop=/^(?:odkladam|upuszczam|klade|drop|put\s+down|leave)\s+/;
const deepen=/^(?:analizuje|interpretuje|badam\s+szczegolowo|study|analyze|interpret|examine\s+closely)\s+/;
function validRoll(input:PrabutyActionInput,check:DossierItemAccessCheck) {
  const tests=input.skillTests.filter(test=>test.dossierConditionId===check.id && !test.combined && !test.targetNpcId &&
    input.characters.some(pc=>pc.id===test.characterId) && check.skill_names.includes(test.skillName) && mapDifficultyToRequired(test.difficulty)===check.difficulty);
  if(tests.length!==1)return undefined;
  const test=tests[0],rolls=input.skillRolls.filter(roll=>roll.testId===test.id && roll.characterId===test.characterId &&
    !!roll.resolutionId && !roll.targetNpcId && roll.skillNames.length===1 && roll.skillNames[0]===test.skillName && roll.requiredDifficulty===check.difficulty);
  return rolls.length===1?rolls[0]:undefined;
}
export function planPrabutyTurn(input:PrabutyActionInput) {
  if(!isAuthoredPrabutyPlaytest(input.payload))return null;
  const segments=playerActionSegments(input.playerMessage??'');
  const directed=segments.some(segment=>segment.speaker!==undefined);
  const commands=input.continuation?[]:segments.flatMap(segment=>{
    const matches=segment.speaker ? input.characters.filter(pc=>pc.name===segment.speaker) : input.activeCharacter?[input.activeCharacter]:[];
    return matches.length===1 ? [{actor:matches[0],clauses:declarations(segment.text)}] : [];
  });
  const clauses=commands.flatMap(command=>command.clauses);
  const scene=resolveCanonicalAdventureLocation(input.payload.adventure_id,input.location);
  const sceneIds=canonicalSceneIds(scene);
  const atScene=(tags:string[])=>tags.some(tag=>tag===input.location||sceneIds.includes(tag));
  const handoutContext={playerMessage:input.continuation?'':input.playerMessage??'',location:input.location,
    previousAssistantMessage:input.previousAssistantMessage,knownHandoutIds:input.knownHandoutIds};
  const handouts=acquiredHandoutsFromTurn('',[],input.payload,handoutContext);
  const clueIds:string[]=[],journal:string[]=[],inventory:string[]=[],world:string[]=[],skillTests:SkillTestData[]=[];
  const request=(check:DossierItemAccessCheck,title:string,actor=input.activeCharacter)=>{
    if(!actor)return;
    const skillName=check.skill_names[0];
    skillTests.push({id:'prabuty:'+input.turnId+':'+check.id+(directed?':'+actor.id:''),dossierConditionId:check.id,characterId:actor.id,
      skillName,skillValue:0,difficulty:check.difficulty==='hard'?'trudny':check.difficulty==='extreme'?'ekstremalny':'zwykly',modifiers:[],justification:title});
  };
  for(const rule of getPrabutyClueRules()){
    const card=input.payload.records.find(r=>r.record_id==='prabuty.clue.'+rule.clueId)!;
    if(!atScene(card.tags.scenes))continue;
    const content=JSON.parse(card.content) as {title:string;basicInformation:string;sourceDescription:string};
    const targets=sources[rule.clueId];
    const direct=clauses.some(clause=>{const subject=object(clause,deepen)??object(clause,view)??object(clause,take);return subject!==null && targets.test(subject);});
    const media=Object.entries(itemSources).find(([,id])=>id===rule.clueId)?.[0];
    const seen=media && handouts.includes('prabuty.media.'+media);
    const roll=input.continuation?undefined:validRoll(input,rule.bonusCheck);
    const deep=clauses.some(clause=>{const subject=object(clause,deepen);return subject!==null && targets.test(subject);});
    if(direct||seen||roll){
      clueIds.push(card.record_id);
      const extra=roll?.passedRequirement===true && meetsDifficulty(roll.outcome,rule.bonusCheck.difficulty);
      journal.push(`[DZIENNIK:clue:${content.title} | dossier_record_id:${card.record_id}]${publicPrabutyText(extra?content.sourceDescription:content.basicInformation.replace(/^Po wiarygodnym zbadaniu tego źródła zachowaj kierunek: /,''))}[/DZIENNIK]`);
    }
    if(deep&&!roll)for(const command of commands)if(command.clauses.some(clause=>{const subject=object(clause,deepen);return subject!==null&&targets.test(subject);}))request(rule.bonusCheck,content.title,command.actor);
  }
  for(const [slug,clue] of Object.entries(itemSources)){
    const recordId='prabuty.item.'+slug,card=input.payload.records.find(r=>r.record_id===recordId)!;
    const entry=input.inventory.entries.find(e=>e.recordId===recordId);
    for(const command of commands)for(const clause of command.clauses){
      const owner=command.actor;
      const equipmentTag=(operation:string)=>`[EKWIPUNEK${directed?':@'+owner.id:''}: ${operation}]`;
      const taking=object(clause,take),giving=object(clause,give),dropping=object(clause,drop);
      if(taking!==null && sources[clue].test(taking) && (entry?entry.placement==='location'&&entry.location===input.location:atScene(card.tags.scenes)))
        inventory.push(equipmentTag(`DODAJ | @${recordId}`));
      if(entry?.placement!=='character'||entry.holderId!==owner.id)continue;
      if(dropping!==null && sources[clue].test(dropping))inventory.push(equipmentTag(`ODLOZ | @${recordId}`));
      if(giving!==null && sources[clue].test(giving)){
        const recipients=input.characters.filter(pc=>{
          if(pc.id===owner.id)return false;
          const full=normalize(pc.name),first=full.replace(/^(?:dr\.?|doktor|prof\.?)\s+/,'').split(/\s+/)[0];
          const stem=first.slice(0,-1);
          const dative=first.endsWith('a')?stem+(stem.endsWith('r')?'ze':'ie'):first+'owi';
          const names=[full,first,dative].map(name=>name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
          return new RegExp('(?:\\bto\\s+|\\bdla\\s+|\\b)(?:'+names.join('|')+')$').test(giving);
        });
        if(recipients.length===1)inventory.push(equipmentTag(`PRZEKAZ | @${recordId} | @${recipients[0].id}`));
      }
    }
  }
  // Clock transitions use the same saved time on both sides. No duration is invented.
  let gameTime=input.gameTime;
  const timedTravel = clauses.length===2 && /^(?:podroz\s+(?:zajmie|zajmuje|trwa)|(?:the\s+)?(?:journey|trip)\s+(?:takes|will\s+take))\s+\d{1,3}\s*(?:minut\w*|minutes?|godzin\w*|hours?)$/.test(clauses[1]);
  const clockClauses=timedTravel?[clauses.join(' ')]:clauses;
  const travelling=clockClauses.length===1 && /^(?:jade|ide|podrozuje|wyruszam|travel|go|drive|head)\b/.test(clockClauses[0]);
  const destinations: Array<[string,RegExp]> = [
    ['loc-elblag-klasztor',/(?:klasztor|monastery)/],['loc-warszawa-redakcja',/(?:redakcj|editorial\s+office)/],
    ['loc-msw-warszawa',/(?:msw|ministerstw|interior\s+ministry)/],['loc-prabuty-wykopaliska',/(?:wykopalisk|excavation)/],
    ['loc-prabuty-krypta',/(?:krypt|crypt)/],
  ];
  const targets=travelling?destinations.filter(([,target])=>target.test(clockClauses[0])):[];
  let location=input.location;
  const duration=clockClauses.length===1 && (/^(?:czekam|wait|odpoczywam|rest)\b/.test(clockClauses[0])||travelling)
    ? /\b(\d{1,3})\s*(minut\w*|minutes?|godzin\w*|hours?)\b/.exec(clockClauses[0]):null;
  if(duration){const minutes=Number(duration[1])*(/godzin|hour/.test(duration[2])?60:1);
    if(minutes>0&&minutes<=24*60){const date=new Date(Date.UTC(gameTime.year,gameTime.month,gameTime.day,gameTime.hour,gameTime.minute+minutes));
      gameTime={year:date.getUTCFullYear(),month:date.getUTCMonth(),day:date.getUTCDate(),hour:date.getUTCHours(),minute:date.getUTCMinutes()};
      if(targets.length===1)location=targets[0][0];}}
  const clock=advanceAuthoredPrabutyClock({payload:input.payload,state:{schemaVersion:1,appliedTurnIds:[],...input.world},turnId:input.turnId,gameTime,writesAllowed:true});
  const state=clock.applicable?clock.state:input.world;
  const ended=state.objects.find(o=>o.entityId===PRABUTY_WORLD_IDS.ending)?.state!=='ongoing';
  for(const card of input.payload.records.filter(r=>r.world_object_binding && atScene(r.tags.scenes))){
    const def=card.world_object_binding!,current=state.objects.find(o=>o.entityId===def.entity_id)?.state;
    if(ended||input.continuation)continue;
    const performers=commands.filter(command=>command.clauses.some(c=>
      def.entity_id===PRABUTY_WORLD_IDS.generator ? /^(?:wylaczam|unieruchamiam|uszkadzam|disable|switch\s+off|shut\s+down|sabotage)\s+(?:(?:the|te)\s+)?generator/.test(c) :
      def.entity_id===PRABUTY_WORLD_IDS.rift && /^(?:zamykam|close|seal)\s+(?:(?:the|te)\s+)?(?:szczelin|rift)/.test(c)));
    const disable=def.entity_id===PRABUTY_WORLD_IDS.generator && performers.length>0;
    const close=def.entity_id===PRABUTY_WORLD_IDS.rift && performers.length>0;
    for(const transition of def.transitions){
      if(transition.from!==current || !['disable-preparing','disable-active','close-rift'].includes(transition.id))continue;
      const roll=transition.access_check?validRoll(input,transition.access_check):undefined;
      if(!disable&&!close&&!roll)continue;
      if((transition.requires??[]).some(r=>state.objects.find(o=>o.entityId===r.entity_id)?.state!==r.state))continue;
      if(transition.access_check){
        if(!roll){for(const command of performers)request(transition.access_check,(JSON.parse(card.content) as {title:string}).title,command.actor);continue;}
        if(roll.passedRequirement!==true || !meetsDifficulty(roll.outcome,transition.access_check.difficulty))continue;
      }
      world.push(`[TECZKA_STANU:${def.entity_id} | ${transition.id}]`);
    }
  }
  const projection=applyAuthoredPrabutyTurn({payload:input.payload,state:{schemaVersion:1,appliedTurnIds:[],...input.world},
    turnId:input.turnId,gameTime,writesAllowed:true,location,rawText:world.join('\n'),
    playerMessage:input.continuation?'':input.playerMessage,skillTests:input.skillTests,skillRolls:input.skillRolls});
  const presentActorNames=input.payload.records.flatMap(record=>{
    const actor=record.actor_binding;
    return actor && actor.initial_state?.location_id===resolveCanonicalAdventureLocation(input.payload.adventure_id,location)?.locationId &&
      !input.characters.some(pc=>normalize(pc.name)===normalize(actor.name)) ? [actor.name] : [];
  });
  const inventoryActions=inventory.flatMap(tag=>{
    const match=/^\[EKWIPUNEK(?::@([^:\]]+))?: (DODAJ|ODLOZ|PRZEKAZ) \| @([^\s|\]]+)(?: \| @([^\s|\]]+))?/.exec(tag);
    const actor=match?.[1]?input.characters.find(pc=>pc.id===match[1]):input.activeCharacter;
    const slug=match?.[3].replace(/^prabuty\.item\./,'');
    const item=match&&input.payload.records.find(record=>record.record_id===match[3])?.inventory_item;
    if(!actor||!slug||!itemSources[slug]||!item||!match)return [];
    const recipient=input.characters.find(pc=>pc.id===match[4]);
    return [{characterName:actor.name,itemName:item.name,
      operation:match[2],ownerBefore:match[2]==='DODAJ'?null:actor.name,
      ownerAfter:match[2]==='ODLOZ'?null:match[2]==='PRZEKAZ'?recipient?.name:actor.name}];
  });
  const recipeName=input.payload.records.find(record=>record.record_id==='prabuty.item.clue-herbal-recipe-152')!.inventory_item!.name;
  const narrativeFacts={recipeNumber:/\b152\b/.exec(recipeName)![0],gameTime};
  return {narrativeFacts,inventoryActions,presentActorNames,projectedWorld:projection.state.objects.map(({entityId,state})=>({entityId,state})),
    events:projection.events,ending:projection.ending,rejected:projection.rejected,location,gameTime,clueIds,journalText:journal.join('\n'),inventoryText:[...new Set(inventory)].join('\n'),worldText:world.join('\n'),skillTests,handouts};
}

/** Public statements from the same accepted operation that changes ownership. */
export function describePrabutyInventory(plan:NonNullable<ReturnType<typeof planPrabutyTurn>>,locale:'pl'|'en'='pl'):string {
  return plan.inventoryActions.map(action=>{
    if(action.operation==='PRZEKAZ')return locale==='pl'
      ? `${action.itemName}: ${action.ownerBefore} przekazuje ten przedmiot postaci ${action.ownerAfter}.`
      : `${action.itemName}: ${action.ownerBefore} transfers this item to ${action.ownerAfter}.`;
    if(action.operation==='ODLOZ')return locale==='pl'
      ? `${action.itemName}: ${action.ownerBefore} odkłada ten przedmiot w bieżącym miejscu.`
      : `${action.itemName}: ${action.ownerBefore} leaves this item at the current location.`;
    return locale==='pl' ? `${action.itemName}: ten przedmiot ma teraz przy sobie ${action.ownerAfter}.`
      : `${action.itemName}: this item is now carried by ${action.ownerAfter}.`;
  }).join('\n');
}

/** Strip narrator proposals for this exact edition; only the code plan may emit these effects. */
export function applyPrabutyPlanToText(text:string,plan:NonNullable<ReturnType<typeof planPrabutyTurn>>,locale:'pl'|'en'='pl') {
  text=enforcePrabutyNarrativeFacts(stripIncompletePrivateMarkers(text),plan.narrativeFacts,locale);
  const canonical=resolveCanonicalAdventureLocation('cien-nad-prabutami',plan.location);
  const narrative=canonical?text.replace(/\[(?:LOKACJA|LOCATION)[^\]]*\]/gi,''):text;
  // Strip complete and inline private content before selecting any speaker.
  // This cleaner preserves paragraph boundaries, unlike stripAITags.
  const publicNarrative=sanitizeDiegeticProse(parseRevealedTags(narrative).text,{normalizeDialogues:false});
  const spoken=extractAttributedDialogueSpans(publicNarrative);
  const people=plan.presentActorNames.flatMap(name=>{
    const profile=resolveNpcPublicProfile('cien-nad-prabutami',name,locale);
    const dialogue=spoken.find(span=>profile && resolveNpcPublicProfile('cien-nad-prabutami',span.speaker,locale)?.id===profile.id);
    const visibleName = normalize(publicNarrative);
    const nameTokens = normalize(name).replace(/^(?:dr|ojciec|o)\.?\s+/, '').split(/\s+/).filter(token => token.length > 3);
    const visible = nameTokens.some(token => new RegExp('(?:^|[^a-z])'+token+'(?:$|[^a-z])').test(visibleName));
    const fragment=dialogue ? stripAITags(sanitizeDiegeticProse(publicNarrative.slice(dialogue.start,dialogue.end),{normalizeDialogues:false})).trim()
      : visible ? profile?.description : undefined;
    return fragment ? [`[DZIENNIK:npc:${name}${dialogue?'|witness:'+name:''}]${fragment}[/DZIENNIK]`] : [];
  });
  const confirmed=[describePrabutyInventory(plan,locale),...extractJournalTags(plan.journalText).map(entry=>entry.content)].filter(Boolean).join('\n\n');
  return (confirmed&&!narrative.startsWith(confirmed)?confirmed+'\n\n':'')+narrative.replace(/\[EKWIPUNEK[^\]]*\]|\[TECZKA_STANU[^\]]*\]|\[TEST[^\]]*\]/gi,'')
    .replace(/\[(?:DZIENNIK|JOURNAL):[\s\S]*?\[\/(?:DZIENNIK|JOURNAL)\]/gi,block=>
      extractJournalTags(block).some(tag=>['clue','discovery','item','npc','location'].includes(tag.type))?'':block)
    .replace(/\[(?:PRZEDMIOT|ITEM|NPC):[^\]]*\]/gi,'').trim()+
    '\n'+[...people,plan.journalText,plan.inventoryText,plan.worldText,canonical?`[LOKACJA:${canonical.locationId}]`:undefined].filter(Boolean).join('\n');
}
