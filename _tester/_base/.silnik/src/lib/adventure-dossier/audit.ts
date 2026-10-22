/** Local authoring audit. No mutation, network, approval or campaign writes. */
import { validateDossierRagPayload, isDossierLocalHandout } from './rag-schema';
import { DOSSIER_MECHANICS, getDossierMechanicIdForAuditArea } from './mechanic-registry';

export type AuditStatus = 'checked' | 'discrepancy' | 'unverifiable' | 'not_applicable';
export type AuditGroup = 'structure' | 'actors' | 'items' | 'mechanics' | 'media';
export interface AuditResult {
  key: string; code: string; group: AuditGroup; status: AuditStatus;
  severity: 'error' | 'warning' | 'info'; required: boolean;
  evidenceType: 'data' | 'adapter' | 'interface'; scope: 'dossier' | 'neutral_adapter';
  ids: string[]; file: string; field: string; expected: unknown; actual: unknown;
  impact: string; recommendation: string; evidence: string[];
}
export interface AuditInput {
  manifest: unknown;
  records: { file: string; value: unknown }[];
  graph?: { nodes: unknown[]; edges: unknown[] };
  supplement?: unknown;
  actors?: unknown[];
  rawRefs?: { recordId: string; ref: string; target?: string; file: string }[];
  aliases?: { alias: string; owners: string[] }[];
  expectedRecords?: unknown[];
  sourceNodeClaims?: unknown[];
}
export interface AuditReport {
  schema_version: 1; results: AuditResult[]; graph: AuditInput['graph'];
  coverage: Record<AuditStatus, number>; exitCode: 0 | 1;
}
type Obj = Record<string, unknown>;
export const auditObject = (v: unknown): Obj => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};
const arr = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const str = (v: unknown): string => typeof v === 'string' ? v : '';
const strings = (v: unknown): string[] => arr(v).filter((x): x is string => typeof x === 'string');
const canonical = (v: unknown): string => JSON.stringify(v, (_k, x: unknown) => {
  if (x && typeof x === 'object' && !Array.isArray(x)) return Object.fromEntries(Object.entries(x).sort(([a],[b]) => a.localeCompare(b)));
  return x;
});
export function auditFinding(v: Omit<AuditResult, 'key'>): AuditResult {
  return { ...v, key: [v.code,v.file,v.field,...v.ids].map(encodeURIComponent).join(':') };
}
export function finishAudit(results: AuditResult[], graph?: AuditInput['graph']): AuditReport {
  results = [...results].sort((a,b) => a.key.localeCompare(b.key, 'en'));
  const coverage = { checked:0, discrepancy:0, unverifiable:0, not_applicable:0 };
  for (const r of results) coverage[r.status]++;
  return {schema_version:1,results,graph,coverage,exitCode:results.some(r => r.status === 'discrepancy' || (r.status === 'unverifiable' && r.required)) ? 1 : 0};
}
export function auditDossier(input: AuditInput): AuditReport {
  const results: AuditResult[] = [];
  const add = (code: string, group: AuditGroup, status: AuditStatus, file: string, field: string, ids: string[], expected: unknown, actual: unknown, impact: string, recommendation: string, required = true) => {
    results.push(auditFinding({code,group,status,file,field,ids,expected,actual,impact,recommendation,required,
      severity: status === 'discrepancy' ? 'error' : status === 'unverifiable' ? 'warning' : 'info',
      evidenceType:'data',scope:'dossier',evidence:[`${file}#${field}`]}));
  };
  const check = (ok: boolean, code: string, group: AuditGroup, file: string, field: string, ids: string[], expected: unknown, actual: unknown, impact: string, fix: string) =>
    add(code,group,ok?'checked':'discrepancy',file,field,ids,expected,actual,impact,fix);
  const manifest = auditObject(input.manifest);
  const records = input.records.map(x => ({file:x.file, r:auditObject(x.value)}));
  const recordIds = new Set(records.map(x => str(x.r.record_id)).filter(Boolean));
  const nodes = arr(input.graph?.nodes).map(auditObject), edges = arr(input.graph?.edges).map(auditObject);
  const nodeIds = new Set(nodes.map(n => str(n.id)).filter(Boolean));
  const nodeById = new Map(nodes.map(n => [str(n.id), n]));
  const supplement = auditObject(input.supplement);
  const items = arr(supplement.items).map(auditObject), frames = arr(supplement.scene_frames).map(auditObject);
  const mechanicHooks = arr(supplement.mechanic_hooks).map(auditObject);
  const actorIds = new Set(arr(input.actors).map(a => str(auditObject(a).id)));
  const mechanics = new Set<string>(DOSSIER_MECHANICS.map(m => m.id));
  const unique = (list: {id:string;file:string;field:string}[], group:AuditGroup) => {
    const counts = new Map<string,number>();
    for (const x of list) counts.set(x.id,(counts.get(x.id)||0)+1);
    for (const x of list) check(!!x.id && counts.get(x.id)===1,'ID_UNIQUE',group,x.file,x.field,[x.id], 'nonempty unique ID', counts.get(x.id), 'Niejednoznaczny wybór karty lub połączenia.', 'Uzupełnij ID lub rozdziel duplikaty i ich odsyłacze.');
  };
  unique(records.map(({r,file})=>({id:str(r.record_id),file,field:'record_id'})), 'structure');
  unique(nodes.map((n,i)=>({id:str(n.id),file:'preparation/review-data.json',field:`graph.nodes[${i}].id`})), 'structure');
  unique(edges.map((e,i)=>({id:str(e.id),file:'preparation/review-data.json',field:`graph.edges[${i}].id`})), 'structure');
  unique(items.map((n,i)=>({id:str(n.id),file:'preparation/playbook.json',field:`items[${i}].id`})), 'items');
  unique(arr(input.actors).map((n,i)=>({id:str(auditObject(n).id),file:'source',field:`actors[${i}].id`})), 'actors');
  const claims = new Map<string, Obj[]>();
  for (const c of arr(input.sourceNodeClaims).map(auditObject)) claims.set(str(c.id), [...(claims.get(str(c.id)) || []),c]);
  for (const [id,list] of claims) if (list.length > 1) {
    const kindsMatch=new Set(list.map(c=>c.kind)).size===1;
    const enrichment=list.length===2&&list.every(c=>c.kind==='scene'&&str(c.source_ref).trim())&&
      list.filter(c=>c.role==='source_scene').length===1&&list.filter(c=>c.role==='preparation_frame').length===1;
    const sourceCards=arr(nodeById.get(id)?.source_cards);
    const expectedCards=list.map(({id:_id,...card})=>card);
    const preserved=canonical(sourceCards)===canonical(expectedCards);
    const status:AuditStatus=!kindsMatch?'discrepancy':enrichment?(preserved?'checked':'discrepancy'):'unverifiable';
    add('NODE_MERGE','structure',status,'source',`nodes.${id}`,[id],
      enrichment?'source scene plus preparation frame, both source cards preserved':'compatible deliberate enrichment',
      {claims:list,preserved},
      enrichment?'Kontrola zachowania obu kart podczas wzbogacenia sceny. Nie zatwierdza znaczenia ani faktów.':'Kilka deklaracji bez jawnego kontraktu wzbogacenia.',
      enrichment?'Treść obu kart nadal podlega osobnemu odbiorowi autora.':'Określ role deklaracji lub rozdziel sprzeczne definicje.');
  }
  for (const alias of input.aliases || []) check(alias.owners.length===1,'ALIAS_AMBIGUOUS','structure','preparation/build.json',`aliases.${alias.alias}`,alias.owners,'one owner',alias.owners,'Nie można jednoznacznie dobrać miejsca.','Użyj jednoznacznego aliasu lub ID.');
  let validation: ReturnType<typeof validateDossierRagPayload>;
  try { validation=validateDossierRagPayload({schema_version:1,adventure_id:manifest.adventure_id,edition_fingerprint:manifest.edition_fingerprint,records:input.records.map(x=>x.value)}); }
  catch (error) { validation={ok:false,errors:[String(error)]}; }
  if (validation.ok) add('SCHEMA','structure','checked','dossier.yaml','payload',[],'valid',true,'Schemat danych poprawny.','Brak.',false);
  for (const [i,error] of validation.errors.entries()) {
    const match=error.match(/^records\[(\d+)\]/), index=match?Number(match[1]):-1;
    add('SCHEMA','structure','discrepancy',input.records[index]?.file || 'dossier.yaml',`schema[${i}]`,[],'valid schema',error,'Dane nie mogą bezpiecznie wejść do RAG.','Popraw wskazane pole.');
  }
  add('MANIFEST_APPROVAL','mechanics',manifest.approval==='approved'?'checked':'unverifiable','dossier.yaml','approval',[], 'approved',manifest.approval,'Brak zgody blokuje próbę rzeczywistego pakietu.','Odbiór przez autora; audyt nie zatwierdza.');
  if (!input.graph) add('GRAPH_MISSING','structure','unverifiable','preparation/review-data.json','graph',[],'graph',null,'Nie można sprawdzić powiązań przygody.','Odtwórz graf z czytelnych źródeł.');
  if (input.graph) check(Array.isArray(input.graph.nodes)&&Array.isArray(input.graph.edges),'GRAPH_SHAPE','structure','preparation/review-data.json','graph',[],'nodes and edges arrays',input.graph,'Nieczytelna struktura grafu.','Popraw obie tablice grafu.');
  const ref = (target:string, group:AuditGroup, file:string, field:string, owner:string, universe:Set<string>) =>
    check(universe.has(target),'LINK_TARGET',group,file,field,[owner,target],'existing target',target,'Połączenie prowadzi donikąd.','Popraw odsyłacz lub uzupełnij kartę celu.');
  const bindings = new Map<string,string[]>(), actorNames = new Map<string,Set<string>>();
  const checks = new Map<string,string>();
  const incoming = new Set(records.flatMap(({r})=>strings(r.links)));
  const linkedNodes = new Set(edges.flatMap(e=>[str(e.from),str(e.to)]));
  for (const {r,file} of records) {
    const id=str(r.record_id), tags=auditObject(r.tags), retrieval=auditObject(r.retrieval), evidence=auditObject(r.evidence);
    for (const [i,target] of strings(r.links).entries()) ref(target,'structure',file,`links[${i}]`,id,recordIds);
    if (!strings(r.links).length && !incoming.has(id) && !strings(tags.entities).length && !strings(tags.scenes).length)
      add('CARD_ORPHAN','structure',retrieval.availability==='always'?'not_applicable':'unverifiable',file,'links',[id],'context or documented global card',retrieval.availability,'Brak połączeń karty.','Potwierdź globalny zakres lub dodaj powiązanie.',retrieval.availability!=='always');
    const approvalGroup:AuditGroup=r.record_type==='actor'?'actors':r.inventory_item||r.local_handout?'items':r.record_type==='media'?'media':['scene','location'].includes(str(r.record_type))?'structure':'mechanics';
    const title=str(r.content).split('\n')[0];
    const reviewGroup=approvalGroup==='actors'&&strings(tags.entities).length===1?strings(tags.entities)[0]:title.split(' · ')[0]||str(r.record_type);
    add('RECORD_APPROVAL',approvalGroup,evidence.approval==='approved'&&evidence.status==='set'?'checked':'unverifiable',file,'evidence',[id],'approved/set',{approval:evidence.approval,status:evidence.status,title,review_group:reviewGroup,content:r.content,source_ref:evidence.source_ref},'Selektor nie udostępni niezatwierdzonej karty.','Odbierz treść poza audytorem.');
    for (const [i,m] of strings(tags.mechanics).entries()) check(mechanics.has(m),'MECHANIC_ID','mechanics',file,`tags.mechanics[${i}]`,[id,m],'registered mechanic',m,'Nie można przypisać mechaniki.','Użyj aktualnego rejestru.');
    for (const [i,c] of arr(auditObject(retrieval.condition).all).map(auditObject).entries()) {
      const kind=str(c.kind), target=str(c.id);
      const universe=kind==='mechanic_active'?mechanics:kind==='reveal_acquired'?recordIds:kind==='scene_active'?new Set([...nodeIds,...frames.map(f=>str(f.id)),...(input.aliases||[]).map(a=>a.alias)]):nodeIds;
      ref(target,'mechanics',file,`retrieval.condition.all[${i}].id`,id,universe);
    }
    if (input.graph) {
      for (const [i,entity] of strings(tags.entities).entries()) ref(entity,'structure',file,`tags.entities[${i}]`,id,nodeIds);
      const sceneUniverse=new Set([...nodeIds,...frames.map(f=>str(f.id)),...(input.aliases||[]).map(a=>a.alias)]);
      for (const [i,scene] of strings(tags.scenes).entries()) ref(scene,'structure',file,`tags.scenes[${i}]`,id,sceneUniverse);
    }
    for (const [j,target] of strings(r.context_links).entries()) {
      check(strings(r.links).includes(target)&&recordIds.has(target),'RAG_CONTEXT_DEPENDENCY','mechanics',file,`context_links[${j}]`,[id,target],'existing direct context dependency',target,'Brak wymaganej karty kontekstu.','Popraw jawne zależności; wykonanie sprawdzają osobne próby selektora.');
    }
    if (r.record_type==='mechanic_hook' && strings(tags.mechanics).length && strings(tags.topics).includes('source-decision')) {
      add('MECHANIC_INTEGRATION','mechanics','not_applicable',file,'tags.mechanics',[id,...strings(tags.mechanics)],'source decision configuring a shared mechanic',retrieval,'Karta przechowuje zatwierdzony parametr, nie osobny wykonawca mechaniki.','Wspólna aplikacja rozstrzyga SAN i pozostałe testy.',false);
    }
    if (r.record_type==='mechanic_hook' && strings(tags.mechanics).length && !strings(tags.topics).includes('source-decision')) {
      const mappedToPlaybook = mechanicHooks.some((hook) => {
        const expectedContent = [
          str(hook.title),
          `Wyzwalacz: ${str(hook.trigger)}`,
          `Dane: ${str(hook.parameters)}`,
          `Wykonanie / sukces: ${str(hook.success)}`,
          `Niewykonanie / porażka: ${str(hook.failure)}`,
          `Stan: ${str(hook.state)}`,
          'Rozstrzyga wspólna aplikacja; karta nie losuje ani nie wykonuje zapisu.',
        ].join('\n');
        return expectedContent === str(r.content);
      });
      if (!mappedToPlaybook) add('MECHANIC_INTEGRATION','mechanics','unverifiable',file,'tags.mechanics',[id,...strings(tags.mechanics)],'structured playbook hook or explicit source decision',retrieval,'Karta nie ma strukturalnego wyzwalacza powiązanego z playbookiem.','Dodaj jawne powiązanie albo oznacz kartę jako decyzję konfiguracyjną.');
    }
    const binding=auditObject(r.actor_binding);
    if (r.actor_binding) {
      const entity=str(binding.entity_id); ref(entity,'actors',file,'actor_binding.entity_id',id,nodeIds);
      bindings.set(entity,[...(bindings.get(entity)||[]),id]);
      const name=str(binding.name).trim().normalize('NFC').toLocaleLowerCase();
      actorNames.set(name,new Set([...(actorNames.get(name)||[]),entity]));
    }
    const inv=auditObject(r.inventory_item);
    if (r.inventory_item) {
      ref(str(inv.source_location),'items',file,'inventory_item.source_location',id,nodeIds);
      const access=auditObject(inv.access_check);
      if (inv.access_check) {
        const key=str(access.id), sig=canonical({location:inv.source_location,skills:strings(access.skill_names).slice().sort(),difficulty:access.difficulty});
        check(!checks.has(key)||checks.get(key)===sig,'ACCESS_CHECK_CONFLICT','items',file,'inventory_item.access_check',[id,key],checks.get(key)||sig,sig,'Ten sam test ma sprzeczne wymagania.','Rozdziel warunki albo ujednolić definicję.'); checks.set(key,sig);
      } else add('ACCESS_CHECK_NOT_REQUIRED','items','not_applicable',file,'inventory_item.access_check',[id],'free access',null,'Przedmiot nie wymaga testu.','Brak; dostęp wynika z miejsca i fikcji.',false);
    }
    if (r.local_handout) {
      check(isDossierLocalHandout(r.local_handout),'HANDOUT_LOCATOR','items',file,'local_handout',[id],'valid local locator',r.local_handout,'Nie można otworzyć oryginału.','Popraw lokalny locator.');
      check(strings(tags.entities).some(e=>items.some(i=>i.id===e)),'HANDOUT_OBJECT','items',file,'tags.entities',[id],'existing physical object',tags.entities,'Handout nie ma źródła w świecie.','Powiąż handout z przedmiotem.');
    }
  }
  for (const [i,hook] of mechanicHooks.entries()) {
    const id=str(hook.id), file='preparation/playbook.json', field=`mechanic_hooks[${i}]`;
    const framesForHook=strings(hook.frames), actorsForHook=strings(hook.actors), objectsForHook=strings(hook.objects);
    const hookContent=[
      str(hook.title),
      `Wyzwalacz: ${str(hook.trigger)}`,
      `Dane: ${str(hook.parameters)}`,
      `Wykonanie / sukces: ${str(hook.success)}`,
      `Niewykonanie / porażka: ${str(hook.failure)}`,
      `Stan: ${str(hook.state)}`,
      'Rozstrzyga wspólna aplikacja; karta nie losuje ani nie wykonuje zapisu.',
    ].join('\n');
    const matches=records.filter(({r})=>r.record_type==='mechanic_hook'&&str(r.content)===hookContent);
    const hookCard=matches.length===1?matches[0].r:null;
    const hookTags=auditObject(hookCard?.tags), hookRetrieval=auditObject(hookCard?.retrieval);
    const expectedMechanics=arr(hook.mechanics).flatMap((area)=>{
      const mechanic=typeof area==='number'?getDossierMechanicIdForAuditArea(area):str(area);
      return mechanic?[mechanic]:[];
    });
    const cardMechanics=strings(hookTags.mechanics);
    const hasGraphNode=nodes.some((node)=>str(node.id)===id&&str(node.kind)==='mechanic_hook');
    const sceneEdges=framesForHook.map((frame)=>edges.some((edge)=>str(edge.from)===frame&&str(edge.to)===id&&str(edge.kind)==='mechanic'&&str(edge.condition)===str(hook.trigger)&&str(edge.effect)===str(hook.state)));
    const objectEdges=objectsForHook.map((object)=>edges.some((edge)=>str(edge.from)===id&&str(edge.to)===object&&str(edge.kind)==='mechanic'&&str(edge.condition)===str(hook.trigger)&&str(edge.effect)===str(hook.success)));
    const linkedTargets=[
      ...framesForHook.map((target)=>({target, predicate:(r:Obj)=>r.record_type==='scene'&&strings(auditObject(r.tags).scenes).includes(target)})),
      ...actorsForHook.map((target)=>({target, predicate:(r:Obj)=>str(auditObject(r.actor_binding).entity_id)===target})),
      ...objectsForHook.map((target)=>({target, predicate:(r:Obj)=>str(auditObject(r.inventory_item).entity_id)===target||strings(auditObject(r.tags).entities).includes(target)})),
    ];
    const linkChecks=linkedTargets.map(({target,predicate})=>records.some(({r})=>predicate(r)&&strings(hookCard?.links).includes(str(r.record_id))));
    const requiredFields=['id','title','trigger','parameters','success','failure','state','source'];
    const fieldsComplete=requiredFields.every((key)=>str(hook[key]).trim().length>0);
    const complete=fieldsComplete&&matches.length===1&&hasGraphNode&&hookRetrieval.availability==='when_scene_active'&&
      framesForHook.length>0&&framesForHook.every((frame)=>strings(hookTags.scenes).includes(frame)&&nodeIds.has(frame))&&
      expectedMechanics.length>0&&expectedMechanics.every((mechanic)=>mechanics.has(mechanic)&&cardMechanics.includes(mechanic))&&
      sceneEdges.every(Boolean)&&objectEdges.every(Boolean)&&linkChecks.every(Boolean);
    const failureReasons=[
      ...(!fieldsComplete?['missing structured hook fields']:[]),
      ...(matches.length!==1?['missing or duplicate generated RAG card']:[]),
      ...(!hasGraphNode?['missing mechanic hook graph node']:[]),
      ...(hookRetrieval.availability!=='when_scene_active'?['RAG card is not scoped to an active scene']:[]),
      ...(framesForHook.length===0||framesForHook.some((frame)=>!strings(hookTags.scenes).includes(frame)||!nodeIds.has(frame))?['frame is absent from RAG scope or graph']:[]),
      ...(expectedMechanics.length===0||expectedMechanics.some((mechanic)=>!mechanics.has(mechanic)||!cardMechanics.includes(mechanic))?['mechanic tag is missing, unknown or not connected to the card']:[]),
      ...(sceneEdges.some((valid)=>!valid)?['missing frame-to-hook mechanic edge']:[]),
      ...(objectEdges.some((valid)=>!valid)?['missing hook-to-object mechanic edge']:[]),
      ...(linkChecks.some((valid)=>!valid)?['actor, object or frame card is not linked']:[]),
    ];
    results.push(auditFinding({
      code:'MECHANIC_INTEGRATION',group:'mechanics',status:complete?'checked':'discrepancy',
      file,field,ids:[id,...expectedMechanics],expected:'complete structured hook, linked RAG card, scene/object graph edges and registered shared mechanics',
      actual:complete?'verified':failureReasons,impact:complete?'Igor dostaje kartę w aktywnej scenie; wspólna aplikacja rozstrzyga wskazane mechaniki.':'Karta może nie dotrzeć do Igora albo jej połączenie z mechaniką jest niekompletne.',
      recommendation:complete?'Brak.':'Uzupełnij playbook, kartę RAG lub krawędź wskazaną w wyniku.',
      required:true,severity:complete?'info':'error',evidenceType:'data',scope:'dossier',
      evidence:[`${file}#${field}`,...(hookCard?[matches[0].file+'#content',...strings(hookCard.links).map((link)=>`records/${link}`)]:[])],
    }));
  }
  for (const [entity,ids] of bindings) check(ids.length===1,'ACTOR_BINDING_UNIQUE','actors',records.find(x=>auditObject(x.r.actor_binding).entity_id===entity)?.file||'records','actor_binding',ids,'one identity binding per actor',ids,'Stan może trafić do niewłaściwego NPC.','Zostaw jedno wiązanie; karty cech odsyłają do niego.');
  for (const [name,owners] of actorNames) {
    const canonicalBindings=[...owners].every((entity)=>actorIds.has(entity)&&bindings.get(entity)?.length===1);
    const status:AuditStatus=owners.size===1?'checked':canonicalBindings?'not_applicable':'unverifiable';
    add('ACTOR_ALIAS_AMBIGUOUS','actors',status,records.find(x=>str(auditObject(x.r.actor_binding).name).trim().normalize('NFC').toLocaleLowerCase()===name)?.file||'records','actor_binding.name',[...owners],
      owners.size===1?'one name owner':canonicalBindings?'ambiguous display label plus unique canonical runtime identity':'unique name or canonical identity',
      [...owners],canonicalBindings?'Wspólna etykieta jest dozwolona, bo każdy aktor ma osobne ID; adapter wiąże po ID i odrzuca dopasowanie po niejednoznacznej nazwie.':'Wspólny opis anonimowych postaci nie rozstrzyga ich tożsamości; adapter odrzuca niejednoznaczną nazwę.',
      canonicalBindings?'Brak. Zachowaj unikalne ID przy przekazaniu obserwacji NPC.':'Wymagaj kanonicznego ID; nie dopisuj nazwisk do źródła.',!canonicalBindings);
  }
  for (const id of actorIds) check(bindings.has(id),'ACTOR_BINDING_MISSING','actors','source',`actors.${id}`,[id],'runtime identity binding',bindings.get(id)||null,'Nie można przypisać stanu kampanii do karty.','Dodaj wiązanie tożsamości.');
  // Structural predecessor proof only. An external event needs its own executor evidence.
  for(const {r,file} of records) {
    const binding=auditObject(r.actor_binding), initial=auditObject(binding.initial_state);
    const transitions=arr(binding.transitions).map(auditObject);
    const locations:Array<{field:string;id:string}>=[];
    if(binding.initial_state!==undefined) locations.push({field:'actor_binding.initial_state.location_id',id:str(initial.location_id)});
    transitions.forEach((t,i)=>{
      locations.push({field:`actor_binding.transitions[${i}].source_location_id`,id:str(t.source_location_id)});
      if(t.target_location_id!==undefined) locations.push({field:`actor_binding.transitions[${i}].target_location_id`,id:str(t.target_location_id)});
    });
    for(const location of locations) {
      add('ACTOR_STATE_LOCATION','actors',!input.graph?'unverifiable':nodeById.get(location.id)?.kind==='location'?'checked':'discrepancy',
        file,location.field,[str(binding.entity_id),location.id],'existing location node',nodeById.get(location.id)?.kind ?? null,
        'Stan NPC musi wskazywać konkretne miejsce, a nie osobę ani nieistniejący węzeł.','Uzupełnij kartę miejsca lub popraw odsyłacz.');
    }
    if(!transitions.length) continue;
    const stateKey=(location:unknown,effect:unknown)=>JSON.stringify([location,effect]);
    const reachable=new Set(initial.status==='alive' ? arr(initial.effects).map(auditObject).map(e=>stateKey(initial.location_id,e.id)) : []);
    let changed=true;
    while(changed) {
      changed=false;
      for(const t of transitions) {
        if(!reachable.has(stateKey(t.source_location_id,t.from_effect_id)) || t.result_status==='dead') continue;
        const next=stateKey(t.target_location_id ?? t.source_location_id,auditObject(t.to_effect).id);
        if(!reachable.has(next)){reachable.add(next);changed=true;}
      }
    }
    transitions.forEach((t,i)=>{
      const linked=reachable.has(stateKey(t.source_location_id,t.from_effect_id));
      add('ACTOR_STATE_PATH','actors',linked?'checked':'unverifiable',file,`actor_binding.transitions[${i}].from_effect_id`,
        [str(binding.entity_id),str(t.id)],'structural path from explicit opening state or separately verified external event',
        linked?'opening state path exists':{missingState:t.from_effect_id,location:t.source_location_id},
        linked?'Dane zawierają poprzednik przejścia; nie dowodzi to wykonania warunków w grze.':'Przejście wymaga stanu, którego ustawienia nie potwierdza zapisany łańcuch.',
        linked?'Zweryfikuj osobno wykonanie warunków.':'Podłącz zdarzenie ustanawiające wymagany stan; nie ustawiaj przyszłego skutku przy imporcie.');
    });
  }
  const executingRecords = records.filter(({r}) => {
    const world = auditObject(r.world_object_binding);
    return r.inventory_item !== undefined || arr(auditObject(r.actor_binding).transitions).length > 0 ||
      [world, ...arr(world.instances).map(auditObject)].some(binding => arr(binding.transitions).length > 0);
  });
  add('NARRATION_STATE_RECONCILIATION','mechanics',executingRecords.length ? 'unverifiable' : 'not_applicable',
    'runtime','rejected-state-to-narration',executingRecords.map(({r})=>str(r.record_id)).sort(),
    'rejected local mutations cannot be narrated, voiced or remembered as completed actions',
    executingRecords.length ? 'buffered client preview and deferred server finalization implemented; crash recovery, corrective regeneration and approved pilot proof remain unverified' : 'no executable dossier bindings',
    executingRecords.length ? 'Zapis może pozostać poprawny, a tekst, lektor lub historia nadal opisywać niewykonany skutek.' : 'Teczka nie deklaruje zmian stanu do wykonania.',
    executingRecords.length ? 'Zweryfikuj odrzucenie skutku przez kod, korektę odpowiedzi i brak fałszywego zapisu historii oraz TTS w rzeczywistym przebiegu tury.' : 'Brak.',
    executingRecords.length > 0);
  // Identity/read projection proves neither initial hydration nor state mutation.
  // Keep this explicit until a real NPC transition adapter and its runtime evidence exist.
  if (actorIds.size > 0) add('ACTOR_RUNTIME_TRANSITIONS','actors','unverifiable',
    'runtime','npc-state-transitions',[...actorIds].sort(),
    'verified campaign NPC mutation path with state prerequisites and replay protection',
    'neutral NPC transition adapter exists; approved pilot initialization and rendered turn path remain unverified',
    'Karta i odczyt stanu NPC nie potwierdzają zapisu uwolnienia, transportu ani przemiany.',
    'Powiąż zatwierdzone przejścia z istniejącym magazynem NPC; sprawdź warunki, ponowienie, zapis/wczytanie i rzeczywisty przebieg tury.');
  for (const [i,a] of arr(input.actors).map(auditObject).entries()) {
    const entityId=str(a.id);
    const actorCards=records.filter(({r})=>r.record_type==='actor'&&strings(auditObject(r.tags).entities).includes(entityId));
    for (const [field,value] of Object.entries(auditObject(a.fields))) {
      const v=auditObject(value);
      if (/(^|[._])(state|status|location|disposition|hp)([._]|$)/.test(field)) {
        const guardedUnknown=v.status==='unspecified'&&v.value===null&&records.some(({r})=>
          r.record_type==='director_note'&&strings(auditObject(r.tags).entities).includes(entityId)&&
          strings(auditObject(r.tags).topics).includes('uncertainty')&&str(r.content).includes(field));
        const valueText=typeof v.value==='string'?v.value:JSON.stringify(v.value);
        const fieldCard=actorCards.find(({r})=>{
          const content=str(r.content),lines=content.split(/\r?\n/).map(line=>line.trim());
          return (content.includes(`${field}: ${valueText}`)||
            (lines.some(line=>line.endsWith(`· ${field}`))&&lines.some(line=>line===valueText||line.includes(valueText))));
        });
        const status:AuditStatus=guardedUnknown?'not_applicable':fieldCard?'checked':actorCards.length?'discrepancy':'unverifiable';
        add('ACTOR_INITIAL_STATE','actors',status,fieldCard?.file||'source',`actors[${i}].fields.${field}`,[entityId],
          guardedUnknown?'explicit unknown retained in uncertainty guard':'exact field and value in an entity-linked RAG actor card',
          fieldCard?{record_id:fieldCard.r.record_id,value:v.value}:v.value,
          guardedUnknown?'Źródło jawnie nie ustala tej wartości. Karta granic danych zabrania zgadywania.':fieldCard?'Wartość początkowa dociera do profilu NPC; późniejszy stan kampanii nadal nadpisuje tylko obsługiwane pola.':'Nie znaleziono dokładnej wartości pola początkowego w karcie NPC.',
          guardedUnknown?'Nie inicjalizuj nieznanej wartości; zachowaj granicę wiedzy.':fieldCard?'Brak. Potwierdź dynamiczny zapis w odpowiednich próbach adaptera.':'Dodaj albo popraw kartę NPC powiązaną z kanonicznym ID.',!guardedUnknown);
      }
    }
  }
  for (const [i,e] of edges.entries()) {
    const file='preparation/review-data.json', base=`graph.edges[${i}]`, id=str(e.id), from=str(e.from), to=str(e.to), kind=str(e.kind);
    ref(from,'structure',file,`${base}.from`,id,nodeIds); ref(to,'structure',file,`${base}.to`,id,nodeIds);
    const f=str(nodeById.get(from)?.kind), t=str(nodeById.get(to)?.kind);
    const rules:Record<string,boolean>={information:['scene','location','actor','clue','event'].includes(f)&&['clue','location'].includes(t),encounter:['scene','location','event'].includes(f)&&t==='actor',world_event:(f==='event'||t==='event')&&['actor','event','location','scene','item'].includes(f)&&['actor','event','location','scene','item'].includes(t),membership:f==='group'&&['actor','item','location'].includes(t),relationship:f==='actor'&&t==='actor',goal:f==='actor'&&t==='goal',item:['location','actor','scene'].includes(f)&&t==='item',clue:f==='item'&&t==='clue',preparation:f==='scene'&&['location','actor','item','clue','event'].includes(t),approach:f==='scene'&&t==='approach',handout:f==='item'&&t==='handout',mechanic:f==='mechanic_hook'||t==='mechanic_hook',access:['scene','location'].includes(f)&&['scene','location'].includes(t),transition:['scene','location'].includes(f)&&['scene','location'].includes(t)};
    if (kind in rules) check(rules[kind],'EDGE_TYPES','structure',file,`${base}.kind`,[id,from,to],`compatible ${kind} endpoints`,[f,t],'Rodzaj połączenia nie pasuje do kart.','Sprawdź rodzaj i oba końce.');
    else add('EDGE_SEMANTICS','structure','unverifiable',file,`${base}.kind`,[id,from,to],'explicit relationship/access semantics',kind,'Nie wnioskuj o dostępności z ogólnej krawędzi route.','Oznacz znaczenie w danych autorskich.');
    const narrativeGuidance=['access','encounter','world_event'].includes(kind)||
      (kind==='preparation'&&((!!e.condition&&e.condition!=='Powiązanie przygotowania; nie obecność ani obowiązkowe przejście')||
        (!!e.effect&&e.effect!=='Sprawdź aktualny stan i dostęp przed użyciem karty.')));
    let guidanceCardFound=false;
    if (narrativeGuidance && (e.condition || e.effect)) {
      const edgeCard=records.find(({r})=>{
        const content=str(r.content).split(/\r?\n/).map(line=>line.trim());
        const evidence=str(auditObject(r.evidence).source_ref);
        return r.record_type==='director_note' &&
          auditObject(r.retrieval).availability==='always' &&
          content.includes(`Od: ${from}`) && content.includes(`Do: ${to}`) &&
          (!e.condition || content.some(line=>line.endsWith(`: ${str(e.condition)}`))) &&
          (!e.effect || content.some(line=>line.endsWith(`: ${str(e.effect)}`))) &&
          !!str(e.source_ref) && evidence.includes(str(e.source_ref));
      });
      guidanceCardFound=!!edgeCard;
      add('GRAPH_GUIDANCE_CARD','mechanics',edgeCard?'checked':'discrepancy',edgeCard?.file||file,
        edgeCard?'content':'graph.edges', [id,from,to],
        'matching source-backed, always-eligible semantic RAG card with the same endpoints and every authored condition/effect',
        edgeCard?.r.record_id||null,
        edgeCard?'Warunek i granica połączenia są dostępne do wyszukiwania semantycznego, także poza lokacją końców; automat nie uruchamia sceny sam.':'Brakuje dostępnej karty RAG przenoszącej tę wskazówkę grafu i jej źródło.',
        edgeCard?'Brak. Zasady testów i zapisu stanu nadal sprawdzają właściwe adaptery.':'Odtwórz kartę z tego samego wiersza źródłowego i zachowaj oba końce oraz wszystkie podane opisy.');
    }
    for (const field of ['condition','effect']) if (e[field]) {
      const descriptiveKinds=new Set(['relationship','membership','goal','information','clue','approach']);
      const preparationMetadata=kind==='preparation'&&rules.preparation&&e[field]===(field==='condition'
        ?'Powiązanie przygotowania; nie obecność ani obowiązkowe przejście':'Sprawdź aktualny stan i dostęp przed użyciem karty.');
      const delegatedKinds=new Set(['item','mechanic','handout']);
      const separateAdapter=delegatedKinds.has(kind);
      const proseCondition=field==='condition'&&narrativeGuidance&&guidanceCardFound;
      const guidanceEffect=field==='effect'&&['access','encounter'].includes(kind)&&guidanceCardFound;
      const nonExecuting=descriptiveKinds.has(kind)||preparationMetadata||separateAdapter||proseCondition||guidanceEffect;
      add(field==='effect'?'EFFECT_EXECUTOR':'CONDITION_PROSE','mechanics',nonExecuting?'not_applicable':'unverifiable',file,`${base}.${field}`,[id,from,to],
        descriptiveKinds.has(kind)||preparationMetadata?'descriptive graph relation/topology; no state mutation':separateAdapter?'dedicated item, mechanic or local-handout adapter':proseCondition?'source-backed narrative trigger condition for the AI referee; shared mechanics own rolls and state':guidanceEffect?'source-backed navigation/encounter guidance; shared mechanics own rolls and state':'structured condition / existing executor',
        e[field],descriptiveKinds.has(kind)||preparationMetadata?'Krawędź opisuje relację, źródło informacji albo przykład podejścia; nie jest samodzielnym zapisem stanu gry.':separateAdapter?'To połączenie jest obsługiwane przez wyspecjalizowaną kontrolę adaptera, nie przez efekt krawędzi.':'Opis nie potwierdza wykonania przez aplikację.',
        nonExecuting?'Brak osobnego wykonawcy krawędzi jest zamierzony; audyt osobno sprawdza kartę źródłową i adaptery mechanik.':'Zweryfikuj opis i powiązanie z istniejącym wykonawcą.',!nonExecuting);
    }
  }
  for (const [i,n] of nodes.entries()) {
    check(n.kind!=='reference','PLACEHOLDER_NODE','structure','preparation/review-data.json',`graph.nodes[${i}]`,[str(n.id)],'authored card',n.kind,'Węzeł zastępczy nie dostarcza właściwej karty.','Uzupełnij właściwą kartę.');
    if (!linkedNodes.has(str(n.id))) add('GRAPH_ORPHAN','structure',n.optional===true?'not_applicable':'unverifiable','preparation/review-data.json',`graph.nodes[${i}]`,[str(n.id)],'linked node or explicit optional',n.optional,'Karta nie ma żadnych krawędzi.','Potwierdź opcjonalność lub dodaj połączenie.',n.optional!==true);
  }
  const travel=edges.filter(e=>['access','transition'].includes(str(e.kind))||e.traversal===true);
  const starts=nodes.filter(n=>n.start===true).map(n=>str(n.id));
  if (!starts.length) add('REACHABILITY_START','structure','unverifiable','preparation/review-data.json','graph.nodes',[],'explicit starting node',null,'Brak podstawy do testu osiągalności.','Oznacz start; audyt nie zakłada kolejności scen.');
  else {
    const visited=new Set(starts); let changed=true;
    while(changed){changed=false;for(const e of travel)if(visited.has(str(e.from))&&!visited.has(str(e.to))){visited.add(str(e.to));changed=true;}}
    for (const n of nodes.filter(n=>['scene','location'].includes(str(n.kind)))) {
      const contextOnly=n.kind==='scene'&&n.navigation_role==='context_only'&&str(n.navigation_reason).trim().length>0;
      add('REACHABILITY','structure',n.optional===true||contextOnly?'not_applicable':visited.has(str(n.id))?'checked':'unverifiable','preparation/review-data.json',`graph.nodes.${str(n.id)}`,[str(n.id)],'path through explicit access edges',contextOnly?n.navigation_reason:visited.has(str(n.id)),contextOnly?'Karta kontekstu nie jest fizycznym celem podróży.':'Brak drogi w jawnym podgrafie nie dowodzi niemożliwości w fikcji.','Potwierdź przejścia albo opcjonalność.',n.optional!==true&&!contextOnly);
    }
  }
  for (const [i,f] of frames.entries()) for (const field of ['locations','actors','objects']) for (const [j,id] of strings(f[field]).entries()) ref(id,'structure','preparation/playbook.json',`scene_frames[${i}].${field}[${j}]`,str(f.id),nodeIds);
  for (const [i,item] of items.entries()) {
    const id=str(item.id), base=`items[${i}]`, binding=auditObject(item.inventory_binding);
    if (item.location) ref(str(item.location),'items','preparation/playbook.json',`${base}.location`,id,nodeIds);
    if (item.owner) ref(str(item.owner),'items','preparation/playbook.json',`${base}.owner`,id,actorIds);
    const origin=auditObject(item.origin_binding);
    const actorInventoryTemplate=item.kind==='actor_inventory'&&origin.kind==='actor_inventory'&&origin.requires_actor_id===true&&origin.requires_instance_id===true&&!item.inventory_binding;
    const selectionTemplate=['catalog_selection','collection'].includes(str(item.kind))&&!item.inventory_binding;
    const itemTemplate=actorInventoryTemplate||selectionTemplate;
    if(itemTemplate)add('ITEM_ORIGIN_TEMPLATE','items','not_applicable','preparation/playbook.json',base,[id],
      actorInventoryTemplate?'actor and instance selected at runtime':'concrete item selected or created at runtime',
      {kind:item.kind,origin_binding:origin},
      actorInventoryTemplate?'To reguła przekazania wyposażenia, nie gotowy egzemplarz.':'To katalog wyboru lub zbiór, nie jedna przenośna instancja przedmiotu.',
      actorInventoryTemplate?'Konkretny transfer musi wskazać aktora i egzemplarz.':'Po wyborze lub zabraniu konkretnej rzeczy utwórz jej instancję w istniejącym adapterze ekwipunku.',false);
    else check(!!item.location||!!item.owner,'ITEM_ORIGIN','items','preparation/playbook.json',base,[id],'location or owner',{location:item.location,owner:item.owner},'Nie wiadomo, skąd wziąć przedmiot.','Przypisz miejsce albo właściciela.');
    const bound=records.filter(({r})=>auditObject(r.inventory_item).entity_id===id);
    const nonPortable=['world_object','vehicle'].includes(str(item.kind));
    const executorStatus:AuditStatus=nonPortable||itemTemplate?'not_applicable':bound.length===1?'checked':bound.length>1?'discrepancy':'unverifiable';
    add('ITEM_EXECUTOR','items',executorStatus,'preparation/playbook.json',`${base}.inventory_binding`,[id],
      nonPortable?'dedicated world-object or vehicle state':itemTemplate?'instance created only after selection/interacting with a collection':'one inventory executor',bound.length,
      nonPortable?'To nie jest przenośna rzecz Badacza; nie należy tworzyć wpisu ekwipunku.':itemTemplate?'Nie istnieje jeszcze konkretna instancja do przekazania adapterowi.':'Opis zdobycia nie jest zapisem własności.',
      nonPortable?'Sprawdź osobną kontrolę stanu świata lub pojazdu.':itemTemplate?'Po wskazaniu konkretnej rzeczy sprawdź transfer jej instancji; nie rejestruj całego katalogu ani zbioru jako jednej rzeczy.':'Powiąż przenośny przedmiot z adapterem ekwipunku.',!nonPortable&&!itemTemplate);
    if(item.kind==='world_object'){
      const objectBindings=records.filter(({r})=>auditObject(r.world_object_binding).entity_id===id);
      const actual=objectBindings.map(({r})=>auditObject(r.world_object_binding));
      const status:AuditStatus=objectBindings.length===1?'checked':objectBindings.length>1?'discrepancy':'unverifiable';
      add('WORLD_OBJECT_STATE_EXECUTOR','items',status,'preparation/playbook.json',`${base}.kind`,[id],
        'one explicit source-bound world-state definition',actual,
        objectBindings.length===1?'Teczka definiuje dozwolone stany; ich zapis przechodzi przez wspólny adapter kampanii.':'Adapter stanu świata istnieje, ale ten obiekt nie ma własnej definicji stanów i przejść.',
        objectBindings.length===1?'Sprawdź źródłowy warunek każdego przejścia i jego mechaniczny dowód.':'Dodaj jawne stany/warunki z odniesieniem do źródła; nie wyprowadzaj ich z prozy.',true);
    }
    if(item.kind==='vehicle')add('VEHICLE_STATE_EXECUTOR','items','unverifiable','preparation/playbook.json',`${base}.kind`,[id],'custody, location and operational state adapter','collision-only partial state adapter','Rekonstrukcja kolizji nie zapisuje położenia ani przejęcia pojazdu.','Połącz kontrolę pojazdu i lokację z istniejącym stanem kampanii.');
    if (bound.length===1) check(canonical(auditObject(bound[0].r.inventory_item).access_check)===canonical(binding.access_check),'ITEM_ACCESS_MATCH','items',bound[0].file,'inventory_item.access_check',[id],binding.access_check||null,auditObject(bound[0].r.inventory_item).access_check||null,'RAG użyje innego testu niż opracowanie.','Przebuduj i zweryfikuj definicję testu.');
  }
  for (const raw of input.rawRefs || []) {
    if (raw.target===raw.recordId) add('SELF_REFERENCE','structure','not_applicable',raw.file,`refs.${raw.ref}`,[raw.recordId,raw.ref],'self link omitted',raw.target,'Własna karta nie wymaga linku do siebie.','Brak.',false);
    else { const r=records.find(x=>x.r.record_id===raw.recordId);
      check(!!raw.target && !!r && strings(r.r.links).includes(raw.target),'RAG_LINK_DROPPED','mechanics',raw.file,`refs.${raw.ref}`,[raw.recordId,raw.ref],raw.target||'resolved target',r?strings(r.r.links):null,'Odsyłacz źródłowy zniknął z RAG.','Uzupełnij mapowanie lub jawnie wyjaśnij odsyłacz.'); }
  }
  for (const expected of input.expectedRecords||[]) {
    const e=auditObject(expected), actual=records.find(x=>x.r.record_id===e.record_id);
    check(!!actual&&canonical(actual.r)===canonical(e),'COMPILED_RECORD_STALE','structure',actual?.file||'records',str(e.record_id),[str(e.record_id)],e,actual?.r||null,'Wygenerowana karta różni się od źródła.','Przebuduj po zachowaniu ręcznych zmian.');
  }
  return finishAudit(results,input.graph);
}
