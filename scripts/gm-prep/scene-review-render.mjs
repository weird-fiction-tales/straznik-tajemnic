import { validateSceneDecisionDocument } from './scene-review.mjs';
/** Standalone local author review. All decisions stay on this device until explicitly exported. */
export function renderSceneReview({ model, title, media = [], decisions, warnings = [] }) {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const presentedModel={...model,groups:model.groups.map(group=>({...group,summary:summarizeReviewGroup(group)}))};
  const data = JSON.stringify({model:presentedModel,title,media,decisions,warnings}).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Odbiór scen · ${escape(title)}</title><style>
:root{color-scheme:dark;--bg:#14130f;--card:#201e17;--text:#efe7d4;--muted:#c4bda9;--brass:#ccb469;--green:#76c7a3;--line:#706342}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:17px/1.6 system-ui,sans-serif}header,main,footer{max-width:1440px;margin:auto;padding:24px}header{border-bottom:1px solid var(--line)}h1,h2,h3{font-family:Georgia,serif;line-height:1.25;color:var(--brass)}h1{font-size:34px;margin:8px 0}h2{font-size:27px}h3{font-size:21px}p{margin:10px 0}button,input,select,textarea{font:inherit;color:var(--text);background:var(--bg);border:1px solid var(--line);padding:10px 14px;min-height:46px;border-radius:3px}button{cursor:pointer}button:hover,button[aria-current=true]{border-color:var(--green)}:focus-visible{outline:3px solid var(--green);outline-offset:3px}input,textarea{width:100%}textarea{min-height:80px}main{display:grid;grid-template-columns:290px minmax(0,1fr);gap:24px}nav{display:flex;flex-direction:column;gap:10px;align-self:start;position:sticky;top:16px}nav button{text-align:left}article,.panel{background:var(--card);border:1px solid var(--line);padding:22px;margin-bottom:20px;min-width:0}.notice{border-left:4px solid var(--brass);padding:12px 18px;background:var(--card)}.muted{color:var(--muted)}.checks{display:grid;grid-template-columns:1fr 1fr;gap:16px}.check{border-top:1px solid var(--line);padding-top:12px}.check label{display:flex;min-height:44px;gap:12px;align-items:flex-start}.check input{width:22px;min-height:22px;margin-top:5px;flex-shrink:0}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}.primary{color:var(--green);border-color:var(--green)}.danger{color:#ffb5a9}.tag{display:inline-block;color:var(--green);font-size:14px;border:1px solid var(--line);padding:3px 9px;margin:3px 8px 3px 0}details{border-top:1px solid var(--line);padding:12px 0}summary{cursor:pointer;color:var(--brass)}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.6 ui-monospace,monospace}.media-inventory{overflow-x:auto}.media-inventory table{width:100%;border-collapse:collapse;font-size:14px}.media-inventory th,.media-inventory td{padding:8px;text-align:left;vertical-align:top;border:1px solid var(--line);overflow-wrap:anywhere;min-width:100px}img{max-width:100%;max-height:420px;object-fit:contain}audio{width:100%}ul{padding-left:22px}li{margin:7px 0}#message{white-space:pre-wrap}#decision-status{font-weight:600}footer{border-top:1px solid var(--line);color:var(--muted);font-size:14px}label.field{display:block;margin:12px 0}.count{display:block;font-size:14px;color:var(--muted)}@media(max-width:950px){main{grid-template-columns:1fr}nav{position:static;display:grid;grid-template-columns:1fr 1fr}.checks{grid-template-columns:1fr}}@media print{nav,.actions,.decision-form{display:none}main{display:block}body{background:white;color:black}article,.panel{background:white;break-inside:avoid}}
</style></head><body><header><p class="muted">Warsztat autora · lokalny odbiór treści</p><h1>${escape(title)}</h1><p class="notice">Oceniasz sceny i jawne wyjątki, a nie pojedyncze rekordy. Nie jest to odbiór całej przygody ani potwierdzenie działania gry.</p><div class="notice" data-testid="author-review-guide"><p>Rekordy to fragmenty jednego opisu, a nie osobne zadania do wykonania. Liczba fragmentów pokazuje tylko, z ilu części źródła powstał opis.</p><p>Checkbox oznacza: zapoznałem się z fragmentem i akceptuję jego sens. Jeśli masz wątpliwość, wybierz „Do poprawy” i dodaj uwagę własnymi słowami.</p><p>Braki w przygotowaniu uzupełnia agent. Nie musisz sprawdzać kodu ani udzielać odpowiedzi technicznych.</p></div><div class="actions"><button id="media-library-trigger">Obrazy i nagrania przygody</button><button id="export-all">Pobierz wszystkie decyzje</button><button id="import-trigger">Wczytaj decyzje z pliku</button><input id="import-file" type="file" accept="application/json,.json" aria-label="Plik decyzji autora" hidden></div><p id="message" role="status" aria-live="polite">Decyzje pozostają w tej karcie przeglądarki. Pobierz plik, żeby je zachować.</p><details id="media-library"><summary>Wszystkie obrazy i nagrania przygody</summary><p>Istniejące materiały; przypisanie do scen i moment ujawnienia wymagają sprawdzenia.</p><div id="media-library-items"></div></details></header><main><nav aria-label="Grupy odbioru" id="groups"></nav><div><section id="scene" aria-live="polite"></section><section class="panel decision-form"><h2>Twoja decyzja</h2><p id="decision-status"></p><label class="field" for="reviewer">Osoba zatwierdzająca<input id="reviewer" autocomplete="name" required></label><label class="field" for="domain">Co oceniasz?<select id="domain"><option value="content">Treść i znaczenie sceny</option><option value="media">Obrazy i audio</option></select></label><p class="muted">Integracja i przebieg gry mają osobne dowody. Sam odbiór treści nie oznacza gotowej rozgrywki.</p><label class="field" for="comment">Uwagi i wyjątki<textarea id="comment"></textarea></label><div class="actions"><button class="primary" data-decision="accepted">Zatwierdzam opisany zestaw i pobieram decyzję</button><button data-decision="rework">Do poprawy i pobierz decyzję</button><button data-decision="deferred">Odkładam i pobierz decyzję</button></div></section></div></main><footer>Pełna treść i źródła są dostępne w szczegółach. Zmiana zestawu unieważnia wcześniejszą akceptację. Żaden przycisk nie wysyła danych do sieci ani nie publikuje przygody.</footer><script type="application/json" id="review-data">${data}</script><script>(${sceneReviewClient.toString()})(${validateSceneDecisionDocument.toString()});</script></body></html>`;
}

function sceneReviewClient(validateDocument) {
  'use strict';
  const data = JSON.parse(document.getElementById('review-data').textContent);
  const model = data.model;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const printable = value => typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  let selected = model.groups[0]?.id;
  let documentData = data.decisions || {schema_version:1,adventure_id:model.adventure_id,edition_fingerprint:model.edition_fingerprint,decisions:[]};
  const statuses = {accepted:'Zatwierdzone',rework:'Do poprawy',deferred:'Odłożone'};
  const labels = ['Sens sytuacji','Tropy i swoboda','Testy i skutki','Przedmioty','Media','Dalszy przebieg'];
  const checks = [
    'Tak, ta sytuacja i zamiary opisanych osób pasują do historii.',
    'Tak, te informacje i możliwe drogi pasują do historii.',
    'Tak, opisane trudności i konsekwencje pasują do mojej intencji.',
    'Tak, opis przedmiotów i sposobu ich zdobycia pasuje do historii.',
    'Tak, zapoznałem się z opisem mediów i zaznaczonymi brakami.',
    'Tak, dalszy rozwój sytuacji pozostawia graczom wybór.'
  ];
  function current(){return model.groups.find(g=>g.id===selected);}
  function effective(group,domain){return documentData.decisions.filter(d=>d.group_id===group.id&&d.domain===domain&&d.snapshot===group.snapshot).at(-1);}
  function mediaFor(group){return data.media.filter(m=>!m.scene_ids?.length?group.kind==='shared':m.scene_ids.some(id=>id===group.id||'scene:'+id===group.id));}
  function safeMedia(url){return typeof url==='string' && /^(file:\/\/\/|data:(image\/(png|jpeg|webp)|audio\/mpeg);base64,)/.test(url);}
  function mediaArticle(m){
    const article=document.createElement('article'),title=document.createElement('h3');
    title.textContent=m.label||m.id||m.path||'Materiał';article.append(title);
    const context=document.createElement('p');
    const sources=Array.isArray(m.source_refs)?m.source_refs.join(', '):m.source||m.source_ref||'Nie wskazano';
    context.textContent='Nieobejrzane / nieodsłuchane. Język: '+(m.language||m.lang||'Nie ustalono')+'. Źródło: '+sources;
    article.append(context);
    if(safeMedia(m.preview_url)){
      const element=document.createElement(m.kind==='audio'?'audio':'img');element.src=m.preview_url;
      if(m.kind==='audio')element.controls=true;else element.alt=m.label||m.id||'Podgląd';
      article.append(element);
    }else{
      const note=document.createElement('p');note.textContent='Podgląd niedostępny. Nie uznawaj tego materiału za sprawdzony.';article.append(note);
    }
    return article;
  }
  function mediaInventory(group){
    const manifest=group.media_manifest;
    const assets=Array.isArray(manifest?.assets)?manifest.assets:[];
    const fields=[['trigger','Moment ujawnienia'],['language','Język'],['quality','Jakość'],['playback','Odtwarzanie'],['mapping','Powiązanie']];
    const status=value=>value===null||value===undefined||value===''||['unknown','unspecified','pending','pending_review','unverified'].includes(value)?'Nie ustalono':printable(value);
    return `<section data-testid="media-review-gaps" class="media-inventory"><h3>Media i braki do odbioru</h3><p>Nie ustalono oznacza brak potwierdzonej informacji. Obecność pliku i podgląd nie potwierdzają jakości, odtwarzania ani powiązania z sytuacją.</p>${assets.length?`<table><thead><tr><th>Materiał</th>${fields.map(([key,label])=>`<th>${label} (${key})</th>`).join('')}</tr></thead><tbody>${assets.map(asset=>`<tr><th scope="row">${esc(asset.url||asset.path||asset.id||'Nie wskazano pliku')}</th>${fields.map(([key])=>`<td data-media-field="${key}">${esc(status(asset[key]))}</td>`).join('')}</tr>`).join('')}</tbody></table>`:'<p>Nie ustalono inwentarza mediów ani wartości: trigger, language, quality, playback, mapping.</p>'}</section><details data-testid="media-manifest-details"><summary>Pełny inwentarz mediów objęty decyzją</summary><pre>${esc(JSON.stringify(manifest??null,null,2))}</pre></details>`;
  }
  function render(){
    const group=current();if(!group)return;
    $('groups').innerHTML=model.groups.map(g=>`<button data-group="${esc(g.id)}" aria-current="${g.id===selected}">${esc(g.title)}<span class="count">${g.record_ids.length} fragmentów źródła · ${esc(statuses[effective(g,'content')?.status]||'Do odbioru')}</span></button>`).join('');
    const frame=group.scene||{};
    const unknown='Nie opisano tego jednoznacznie w danych sceny. Sprawdź szczegóły lub oznacz do poprawy.';
    const paragraphs=group.summary||[frame.focus||frame.summary||unknown,
      (frame.choices?.length?frame.choices.join('\n'):frame.approaches)||unknown,
      frame.mechanics||frame.conditions||unknown,
      frame.items||frame.objects||unknown,
      mediaFor(group).map(m=>m.label||m.id||m.path).join('\n')||'Brak przypisanych mediów w tym widoku. Pełna inwentaryzacja pozostaje osobnym dowodem.',
      frame.state||frame.outcome||unknown];
    const policies=group.kind==='shared'?(group.policies||[]).map(p=>`<p><b>${esc(p.title)}</b> ${esc(p.content)}</p>`).join(''):'';
    const referenceCount=group.reference_record_ids?.length||0;
    $('scene').innerHTML=`<article><span class="tag">${esc(group.kind==='scene'?'Scena':group.kind==='shared'?'Zasady wspólne':'Jawne wyjątki')}</span><h2>${esc(group.title)}</h2><p>${group.record_ids.length} fragmentów źródła składa się na ten opis. ${referenceCount} odniesień do opisów odbieranych w innych grupach.</p>${policies}${group.kind==='exceptions'?'<p class="notice">Nieprzypisane i niejednoznaczne rekordy nie otrzymują automatycznej akceptacji.</p>':''}<div id="scene-media"></div><div class="checks">${labels.map((label,i)=>`<div class="check"><h3>${label}</h3><p style="white-space:pre-wrap">${esc(printable(paragraphs[i]))}</p><label><input type="checkbox" data-check="${i}"><span>${checks[i]}</span></label></div>`).join('')}</div>${mediaInventory(group)}${group.issues?.length?`<div class="notice"><h3>Wyjątki do rozstrzygnięcia</h3><ul>${group.issues.map(x=>`<li>${esc(printable(x))}</li>`).join('')}</ul></div>`:''}<details><summary>Fragmenty źródła i pełna treść (${group.record_ids.length})</summary><p>Te fragmenty składają się na jeden opis. Nie są osobnymi zadaniami. Tutaj możesz przeczytać cały zakres objęty decyzją.</p>${group.records.map(r=>`<section><h3>${esc(r.content?.split('\n')[0]||r.record_id)}</h3><pre>${esc(r.content)}</pre><p class="muted">Źródło: ${esc(r.evidence?.source_ref||'Nie wskazano')}</p><details><summary>Pełne dane objęte decyzją</summary><pre>${esc(JSON.stringify(r,null,2))}</pre></details></section>`).join('')}</details><details><summary>Identyfikacja ocenianego zestawu</summary><pre>${esc(group.snapshot)}\n${esc(group.record_ids.join('\n'))}</pre></details><details><summary>Powiązane rekordy odbierane osobno</summary>${(group.reference_records||[]).map(r=>`<h3>${esc(r.record_id)}</h3><pre>${esc(JSON.stringify(r,null,2))}</pre>`).join('')}</details><details><summary>Warunki grafu</summary><pre>${esc(JSON.stringify(group.graph||{},null,2))}</pre></details></article>`;
    for(const m of mediaFor(group)) $('scene-media').append(mediaArticle(m));
    showStatus();
  }
  function showStatus(){const decision=effective(current(),$('domain').value);$('decision-status').textContent=decision?`${statuses[decision.status]}: ${decision.reviewer}, ${decision.at}`:'Brak aktualnej decyzji dla tego zestawu.';}
  function download(){const blob=new Blob([JSON.stringify(documentData,null,2)+'\n'],{type:'application/json'});const link=document.createElement('a');const url=URL.createObjectURL(blob);link.href=url;link.download=model.adventure_id+'-scene-decisions.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function validateImport(doc){ return validateDocument(model,doc); }

  document.addEventListener('click',event=>{
    const group=event.target.closest('[data-group]');if(group){selected=group.dataset.group;render();return;}
    const action=event.target.closest('[data-decision]');if(!action)return;
    try{
      if(action.dataset.decision==='accepted'&&current().kind==='exceptions'&&$('domain').value==='content')throw Error('Najpierw przypisz i wyjaśnij rekordy z grupy wyjątków.');
      const reviewer=$('reviewer').value.trim();if(!reviewer)throw Error('Wpisz osobę zatwierdzającą.');
      if(action.dataset.decision==='accepted'&&[...document.querySelectorAll('[data-check]')].some(e=>!e.checked))throw Error('Przed akceptacją sprawdź sześć punktów karty.');
      const decision={group_id:selected,snapshot:current().snapshot,status:action.dataset.decision,domain:$('domain').value,reviewer,at:new Date().toISOString(),comment:$('comment').value.trim()};
      documentData=validateDocument(model,{...documentData,decisions:[...documentData.decisions.filter(d=>!(d.group_id===selected&&d.domain===decision.domain)),decision]});
      render();download();$('message').textContent='Decyzja przygotowana. Zachowaj pobrany plik. Import w kompilatorze ponownie sprawdzi jego zgodność z treścią.';
    }catch(error){$('message').textContent=error.message;}
  });
  for(const m of data.media)$('media-library-items').append(mediaArticle(m));
  $('media-library-trigger').addEventListener('click',()=>{$('media-library').open=true;});
  $('export-all').addEventListener('click',download);
  $('import-trigger').addEventListener('click',()=>$('import-file').click());
  $('domain').addEventListener('change',showStatus);
  $('import-file').addEventListener('change',async event=>{try{const file=event.target.files[0];if(!file)return;const doc=validateImport(JSON.parse(await file.text()));documentData=doc;render();$('message').textContent='Wczytano decyzje. Wpisy dotyczące zmienionych zestawów nie nadają aktualnej akceptacji.';}catch(error){$('message').textContent='Nie wczytano decyzji: '+error.message;}});
  render();
  if(data.warnings?.length)$('message').textContent=data.warnings.join('\n');
}

/** Deterministic author synopsis from disclosed source fields; missing rules stay explicit. */
export function summarizeReviewGroup(group) {
 const records=[...(group.records||[]),...(group.reference_records||[])];
 const unique=[...new Map(records.map(r=>[r.record_id||r.content,r])).values()];
 const values=type=>unique.filter(r=>r.record_type===type).map(r=>{try{const data=JSON.parse(r.content);return data.value??data;}catch{return {description:r.content};}});
 const line=value=>typeof value==='string'?value:JSON.stringify(value);
 const named=value=>[value.name||value.title,value.description||value.content].filter(Boolean).join(': ');
 const actors=values('actor').map(a=>[named(a),a.secret?'Wiedza tylko MG: '+a.secret:''].filter(Boolean).join('\n'));
 const clues=values('clue');
 const tests=clues.filter(c=>c.requiredSkill).map(c=>(c.name||'Trop')+' - wskazana umiejętność: '+line(c.requiredSkill));
 const bindings=unique.filter(r=>r.inventory_item||r.world_object_binding).map(r=>line(r.inventory_item||r.world_object_binding));
 const routes=(group.graph?.edges||[]).filter(e=>group.kind!=='scene'||e.from===group.scene?.id).map(e=>[e.condition||e.description,e.effect].filter(Boolean).join(' → '));
 const unresolved=unique.filter(r=>r.evidence?.status==='unspecified').map(r=>{try{return JSON.parse(r.content).value??r.content;}catch{return r.content;}});
 const frame=group.scene||{};
 const policies=(group.policies||[]).map(p=>[p.title,p.content].filter(Boolean).join(': '));
 const general=group.kind==='shared'?'Tutaj odbierasz wspólne fakty i reguły używane w wielu sytuacjach. Osoba, która pojawia się w kilku miejscach, ma jednego właściciela akceptacji.':group.kind==='exceptions'?'Te rekordy trzeba najpierw przypisać lub wyjaśnić. Nie można zatwierdzić tej grupy zbiorczo.':'';
 return [
  [frame.focus||frame.summary||general,...(actors.length?['Osoby opisane w źródle tej sceny. To nie jest lista postaci do wyboru ani potwierdzenie ich punktów startowych.',...actors]:[])].filter(Boolean).join('\n\n')||'Brak jednoznacznego opisu sytuacji.',
  [clues.map(named).join('\n\n'),frame.choices?.length?'Przykładowe podejścia: '+frame.choices.map(line).join('; '):'Źródło nie podaje zamkniętej listy działań. Inne pomysły graczy wymagają zwykłego rozstrzygnięcia.'].filter(Boolean).join('\n\n'),
  [...tests,'Nie ustalono wszystkich poziomów trudności i wykonawców skutków dla tej teczki. Samo wskazanie umiejętności nie jest wynikiem testu.',...unresolved.map(line)].join('\n\n'),
  bindings.length?bindings.join('\n\n'):'Źródło nie zawiera tutaj jawnie podłączonej karty przenoszenia i zużycia przedmiotu. Handout nie oznacza automatycznego dodania do ekwipunku.',
  'Sprawdź podglądy i widoczny inwentarz poniżej. Nieustalone warunki ujawnienia, język, jakość, odtwarzanie i powiązania wymagają osobnego odbioru mediów.',
  [typeof frame.state==='string'?frame.state:'',...routes,...policies].filter(Boolean).join('\n\n')||'Przejścia i zakończenia wymagają sprawdzenia w pełnym przebiegu gry.'
 ];
}
