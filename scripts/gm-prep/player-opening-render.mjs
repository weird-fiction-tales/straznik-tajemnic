/** Offline, directed player preview. Only explicitly selected player fields enter the HTML. */
export function renderPlayerOpening({ story, mediaBase = 'assets/' }) {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const text = (value, field, optional = false) => {
    if (optional && value === undefined) return undefined;
    if (typeof value !== 'string') throw new Error(field + ' must be a string');
    return value;
  };
  const localPath = value => {
    if (typeof value !== 'string' || !value.trim()) throw new Error('Expected a local relative media path');
    let decoded;
    try { decoded = decodeURIComponent(value); } catch { throw new Error('Invalid local media path'); }
    if (/^(?:[a-z][a-z\d+.-]*:|[\\/])|(?:^|[\\/])\.\.(?:[\\/]|$)|[\\?#\u0000-\u001f]/i.test(decoded)) {
      throw new Error('Media must use local relative paths');
    }
    return value;
  };
  const base = localPath(mediaBase).replace(/\/?$/, '/');
  const asset = value => value == null || value === '' ? null : base + localPath(value);
  if (!story?.role || !Array.isArray(story.scenes) || !story.scenes.length) throw new Error('Missing player role or scenes');
  const title = text(story.title, 'story.title', true);
  const subtitle = text(story.subtitle, 'story.subtitle', true);
  const initialScene = text(story.initial_scene, 'story.initial_scene');
  const scenes = story.scenes.map(scene => ({
    id: text(scene.id, 'scene.id'), title: text(scene.title, 'scene.title'),
    speaker: text(scene.speaker, 'scene.speaker', true) || 'Prowadzący',
    text: Array.isArray(scene.text) ? scene.text.map(value => text(value, 'scene.text')) : [],
    image: asset(scene.image), audio: asset(scene.audio),
    choices: (scene.choices || []).map(choice => ({
      id: text(choice.id, 'choice.id'), label: text(choice.label, 'choice.label'),
      target: text(choice.target, 'choice.target'), discover: text(choice.discover, 'choice.discover', true),
    })),
    handout: scene.handout ? {
      frontImage: asset(scene.handout.frontImage), caption: text(scene.handout.caption, 'handout.caption', true),
      reverseText: text(scene.handout.reverseText, 'handout.reverseText'), reverseAudio: asset(scene.handout.reverseAudio),
    } : null,
    end: Boolean(scene.end),
  }));
  const ids = new Set(scenes.map(scene => scene.id));
  if (ids.size !== scenes.length || !ids.has(initialScene)) throw new Error('Invalid initial scene or duplicate scene id');
  const journal = (story.journal_entries || []).map(entry => ({
    id: text(entry.id, 'journal.id'), title: text(entry.title, 'journal.title'), text: text(entry.text, 'journal.text'),
  }));
  const journalIds = new Set(journal.map(entry => entry.id));
  for (const scene of scenes) {
    if (!scene.id || !scene.text.length) throw new Error('Every scene needs an id and narrative text');
    const choiceIds = new Set();
    for (const choice of scene.choices) {
      if (!choice.id || choiceIds.has(choice.id) || !ids.has(choice.target)) throw new Error('Invalid choice id or target scene');
      if (choice.discover && !journalIds.has(choice.discover)) throw new Error('Unknown journal discovery');
      choiceIds.add(choice.id);
    }
  }
  const role = {
    title: text(story.role.title, 'role.title', true), name: text(story.role.name, 'role.name'),
    occupation: text(story.role.occupation, 'role.occupation'),
    portrait: asset(story.role.portrait), description: text(story.role.description, 'role.description', true),
  };
  const data = JSON.stringify({
    title: title || 'Cień nad Prabutami', subtitle: subtitle || '',
    role, initial_scene: initialScene, scenes, journal_entries: journal,
  }).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
  return `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer"><title>${escape(title || 'Cień nad Prabutami')}</title>
<style>
:root{color-scheme:dark;--ink:#0b100e;--paper:#e7dfcb;--muted:#b9b6a5;--brass:#c9a96a;--emerald:#85bc9f;--line:#685a39}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at top,#203329 0,#111a15 42%,#090c0a 100%);color:var(--paper);font:18px/1.75 Georgia,"Times New Roman",serif;min-height:100vh}
body:before{content:"";pointer-events:none;position:fixed;inset:12px;border:1px solid #c9a96a35;z-index:4}
button,summary{font:inherit}button{cursor:pointer;min-height:48px;border:1px solid var(--line);border-radius:0;padding:12px 19px;color:var(--paper);background:#151e18;line-height:1.45;transition:background .16s,border-color .16s}
button:hover{border-color:var(--brass);background:#24352a}button:disabled{opacity:.5;cursor:default}button.primary{background:#244a3a;border-color:var(--emerald);color:#f0eadb}
:focus-visible{outline:3px solid var(--emerald);outline-offset:5px}h1,h2,h3{font-family:Georgia,serif;font-weight:400;line-height:1.2;overflow-wrap:anywhere}h1{font-size:clamp(36px,5vw,66px);margin:12px 0 22px}h2{font-size:clamp(28px,3vw,42px);margin:10px 0 22px}h3{font-size:23px;color:var(--brass)}p{margin:0 0 20px}img{display:block;max-width:100%}[hidden]{display:none!important}
.masthead{max-width:1500px;margin:auto;padding:26px 42px 16px;display:flex;justify-content:space-between;gap:24px;align-items:center}.wordmark{font:14px/1.5 system-ui,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:var(--brass)}.edition{font:14px/1.5 system-ui,sans-serif;color:var(--muted);text-align:right}
main{max-width:1440px;margin:auto;padding:20px 42px 50px}.rule{display:flex;align-items:center;gap:18px;color:var(--brass);font-size:14px;letter-spacing:.18em;text-transform:uppercase}.rule:before,.rule:after{content:"";height:1px;background:linear-gradient(90deg,transparent,var(--line));flex:1}.rule:after{transform:rotate(180deg)}
#cover{min-height:72vh;display:grid;grid-template-columns:minmax(0,1.3fr) minmax(260px,.7fr);gap:70px;align-items:center;padding:36px 34px}.eyebrow{font:14px/1.5 system-ui,sans-serif;text-transform:uppercase;letter-spacing:.2em;color:var(--brass);margin-bottom:20px}.cover-subtitle{font-size:22px;color:var(--muted);max-width:610px}.role-name{font-size:29px;margin:22px 0 4px}.role-occupation{color:var(--muted);margin-bottom:30px}.role-frame{border:1px solid var(--line);padding:12px;position:relative;background:#141a14;box-shadow:0 18px 70px #0009}.role-frame:before,.role-frame:after{content:"";position:absolute;width:32px;height:32px;border-color:var(--brass);pointer-events:none}.role-frame:before{top:-5px;left:-5px;border-top:2px solid;border-left:2px solid}.role-frame:after{bottom:-5px;right:-5px;border-bottom:2px solid;border-right:2px solid}.role-frame img{width:100%;height:490px;object-fit:cover;object-position:top;filter:sepia(.16)}.role-frame figcaption{font:14px/1.5 system-ui,sans-serif;color:var(--muted);padding:13px 8px 4px}
#stage{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:36px;align-items:start;padding-top:20px}.scene-panel{min-width:0}.scene-art{margin:0 0 28px;border:1px solid var(--line);padding:8px;background:#111810}.scene-art img{width:100%;max-height:300px;object-fit:cover}.scene-art figcaption{font:14px/1.5 system-ui,sans-serif;color:var(--muted);padding:8px 6px 2px}
.scene-copy{max-width:900px}.speaker{font:14px/1.5 system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--emerald);margin-bottom:20px}#scene-copy{font-size:21px;line-height:1.85}#scene-copy p:first-child:first-letter{font-size:1.5em;color:var(--brass)}.choices-title{font:14px/1.5 system-ui,sans-serif;color:var(--brass);text-transform:uppercase;letter-spacing:.18em;margin:34px 0 16px}.choices{display:grid;gap:12px}.choice{text-align:left;display:flex;align-items:center;gap:16px}.choice:before{content:"◇";color:var(--brass);flex-shrink:0}.choice:hover:before{color:var(--emerald)}
.side-panel{position:sticky;top:24px;min-width:0}.identity{border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:20px 0;margin:0 0 28px}.identity strong{display:block;font-weight:400;font-size:23px;color:var(--brass)}.identity span{font-size:16px;color:var(--muted)}details{border-bottom:1px solid var(--line);padding:16px 0}summary{cursor:pointer;min-height:44px;color:var(--brass);font-size:19px}.count{font:14px/1.5 system-ui,sans-serif;color:var(--muted)}#journal-list{padding-left:22px;font-size:16px;line-height:1.7}#journal-list li{padding:12px 0}#journal-list strong{display:block;color:var(--paper);font-weight:400;font-size:19px}.journal-empty{font-size:16px;color:var(--muted)}.side-actions{display:grid;gap:10px;margin-top:26px}.quiet{font-size:16px;background:transparent;color:var(--muted)}
#history{margin-top:36px}#story-log{list-style:none;padding:0;max-height:380px;overflow-y:auto;scrollbar-color:var(--line) var(--ink);font-size:17px;line-height:1.7}#story-log li{padding:18px;border-bottom:1px solid #685a3955;background:#111a14}#story-log li[data-kind=choice]{border-left:2px solid var(--brass);color:var(--brass);background:#211f16}#story-log .log-speaker{display:block;color:var(--emerald);font:14px/1.5 system-ui,sans-serif;margin-bottom:8px}#story-log p:last-child{margin-bottom:0}
#handout{margin:30px 0;padding:24px;border:1px solid var(--line);background:#1c2119}.photo-front{max-width:560px;margin:0 auto 20px;padding:12px;background:#d8d0b6;color:#332d21;box-shadow:0 8px 32px #0008}.photo-front img{width:100%;max-height:480px;object-fit:contain}.photo-front figcaption{font-size:16px;padding:12px 4px 2px}.photo-back{background:#ded5b9;color:#302a20;padding:32px;min-height:200px;line-height:1.9;font-size:22px;white-space:pre-wrap;box-shadow:0 8px 32px #0008}.missing-media{padding:24px;border:1px dashed var(--line);font:16px/1.7 system-ui,sans-serif;color:var(--muted)}.photo-front .missing-media{color:#403928;border-color:#84785e}.flip{margin-top:22px}
.audio-panel{border-top:1px solid var(--line);padding-top:20px;margin-top:26px}.audio-panel label{display:block;color:var(--brass);font-size:16px;margin-bottom:10px}audio{width:100%;height:46px}.media-status{font:14px/1.6 system-ui,sans-serif;color:var(--muted);margin-top:10px}.end-note{color:var(--brass);font-style:italic;margin:30px 0}
footer{max-width:1440px;margin:auto;padding:0 42px 28px;color:var(--muted);font:14px/1.6 system-ui,sans-serif}.noscript{margin:30px;padding:20px;border:1px solid var(--brass)}
@media(max-width:1050px){#stage{grid-template-columns:minmax(0,1fr) 260px;gap:26px}#cover{gap:38px;padding:30px 0}.role-frame img{height:400px}}
@media(max-width:760px){.masthead{padding:26px 28px 10px;align-items:flex-start;flex-direction:column;gap:10px}.edition{text-align:left}main{padding:14px 28px 34px}#cover{grid-template-columns:1fr;gap:35px}.role-frame{max-width:360px;margin:0 auto}.role-frame img{height:330px}#stage{display:block}.side-panel{position:static;margin-top:38px}#scene-copy{font-size:19px}.scene-art img{max-height:340px}footer{padding:0 28px 26px}.photo-back{padding:22px;font-size:20px}}
@media(prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
</style></head><body>
<header class="masthead"><div class="wordmark">Strażnik Tajemnic <span aria-hidden="true">◇</span> Strefa 11</div><div class="edition">Próba początku - przygotowane wybory</div></header>
<main><div class="rule" aria-hidden="true">Opowieść się zaczyna</div>
<section id="cover" aria-labelledby="story-title"><div><p class="eyebrow">${escape(role.title || 'Twoja postać')}</p><h1 id="story-title">${escape(title || 'Cień nad Prabutami')}</h1><p class="cover-subtitle">${escape(subtitle || 'Deszczowy wieczór. Wiadomość, której nie da się zignorować. Pierwszy krok należy do ciebie.')}</p><p class="role-name">${escape(role.name)}</p><p class="role-occupation">${escape(role.occupation)}</p>${role.description ? '<p>' + escape(role.description) + '</p>' : ''}<button type="button" class="primary" data-action="start">Rozpocznij opowieść</button></div><figure class="role-frame" id="role-portrait"></figure></section>
<section id="stage" hidden aria-label="Początek przygody"><article class="scene-panel"><figure id="scene-image" class="scene-art" hidden></figure><div class="scene-copy"><h2 id="scene-title" tabindex="-1"></h2><p class="speaker" id="speaker"></p><div id="scene-copy"></div></div><section id="handout" hidden aria-label="Fotografia"></section><p class="choices-title" id="choices-title">Co robisz?</p><div id="choices" class="choices" aria-label="Twoje decyzje"></div><p id="end-note" class="end-note" hidden>To koniec tej próby początku. Dalsza droga jest jeszcze przed tobą.</p><details id="history"><summary>Dotychczasowa rozmowa <span id="log-count" class="count"></span></summary><ol id="story-log"></ol></details></article><aside class="side-panel" aria-label="Postać i dziennik"><p class="identity"><strong>${escape(role.name)}</strong><span>${escape(role.occupation)}</span></p><section id="audio-panel" class="audio-panel" hidden><label for="narration-audio">Posłuchaj tej sceny</label><audio id="narration-audio" controls preload="none"></audio><p id="audio-status" class="media-status" role="status"></p></section><details id="journal" open><summary>Dziennik <span id="journal-count" class="count">0</span></summary><p id="journal-empty" class="journal-empty">Ważne spostrzeżenia trafią tutaj.</p><ul id="journal-list"></ul></details><div class="side-actions"><button type="button" class="quiet" data-action="restart">Zacznij tę próbę od nowa</button></div></aside></section>
<noscript><p class="noscript">Włącz JavaScript, aby przejść przez tę lokalną opowieść.</p></noscript></main>
<footer>Twoje wybory i notatki pozostają tylko w tej otwartej próbie.</footer>
<script type="application/json" id="player-story">${data}</script><script>(${playerOpeningClient.toString()})();</script></body></html>`;
}

function playerOpeningClient() {
  'use strict';
  const data = JSON.parse(document.getElementById('player-story').textContent);
  const byId = new Map(data.scenes.map(scene => [scene.id, scene]));
  const journal = new Map(data.journal_entries.map(entry => [entry.id, entry]));
  const discovered = new Set();
  const $ = id => document.getElementById(id);
  const audio = $('narration-audio');
  let current = null;
  let historyCount = 0;
  let reverse = false;

  function paragraph(text, className) {
    const element = document.createElement('p');
    element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function picture(container, source, alt, missing) {
    container.replaceChildren();
    const note = paragraph(missing, 'missing-media');
    note.setAttribute('role', 'status');
    if (source) {
      const image = document.createElement('img');
      image.alt = alt;
      image.addEventListener('error', () => image.replaceWith(note), { once: true });
      image.src = source;
      container.append(image);
    } else container.append(note);
  }

  function stopAudio() {
    if (audio.hasAttribute('src')) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    $('audio-status').textContent = '';
  }

  function setSceneAudio(scene) {
    stopAudio();
    const source = reverse ? scene.handout?.reverseAudio : scene.audio;
    const missing = reverse && !source
      ? 'Nagranie odwrotu nie jest jeszcze gotowe. Opis możesz przeczytać na odwrocie fotografii.'
      : '';
    audio.hidden = !source;
    $('audio-panel').hidden = !source && !missing;
    document.querySelector('label[for="narration-audio"]').textContent =
      reverse ? 'Posłuchaj opisu odwrotu' : 'Posłuchaj tej sceny';
    if (source) audio.src = source;
    $('audio-status').textContent = missing;
  }

  function appendLog(kind, label, lines) {
    const entry = document.createElement('li');
    entry.dataset.kind = kind;
    const speaker = document.createElement('span');
    speaker.className = 'log-speaker';
    speaker.textContent = label;
    entry.append(speaker);
    for (const line of lines) entry.append(paragraph(line));
    $('story-log').append(entry);
    $('log-count').textContent = '· ' + (++historyCount);
    $('story-log').scrollTop = $('story-log').scrollHeight;
  }

  function discover(id) {
    if (!id || discovered.has(id)) return;
    const entry = journal.get(id);
    if (!entry) return;
    discovered.add(id);
    const item = document.createElement('li');
    const title = document.createElement('strong');
    title.textContent = entry.title;
    item.append(title, document.createTextNode(entry.text));
    $('journal-list').append(item);
    $('journal-count').textContent = String(discovered.size);
    $('journal-empty').hidden = true;
  }

  function renderHandout(scene) {
    const panel = $('handout');
    panel.replaceChildren();
    panel.hidden = !scene.handout;
    if (!scene.handout) return;
    if (reverse) panel.append(paragraph(scene.handout.reverseText || 'Na odwrocie nie ma dodatkowych słów.', 'photo-back'));
    else {
      const front = document.createElement('figure');
      front.className = 'photo-front';
      picture(front, scene.handout.frontImage, scene.handout.caption || 'Fotografia z koperty',
        'Fotografia nie jest jeszcze gotowa. Możesz przeczytać jej opis i obejrzeć odwrocie.');
      if (scene.handout.caption) {
        const caption = document.createElement('figcaption');
        caption.textContent = scene.handout.caption;
        front.append(caption);
      }
      panel.append(front);
    }
    const flip = document.createElement('button');
    flip.type = 'button';
    flip.dataset.action = 'flip';
    flip.className = 'flip';
    flip.textContent = reverse ? 'Pokaż przód fotografii' : 'Odwróć fotografię';
    flip.setAttribute('aria-pressed', String(reverse));
    panel.append(flip);
  }

  function showScene(id) {
    const scene = byId.get(id);
    if (!scene) return;
    current = scene;
    reverse = false;
    $('stage').dataset.scene = id;
    $('scene-title').textContent = scene.title;
    $('speaker').textContent = scene.speaker;
    $('scene-copy').replaceChildren(...scene.text.map(text => paragraph(text)));
    $('scene-image').hidden = !scene.image;
    if (scene.image) picture($('scene-image'), scene.image, scene.title,
      'Ilustracja tej sceny nie jest jeszcze gotowa.');
    else $('scene-image').replaceChildren();
    renderHandout(scene);
    setSceneAudio(scene);
    $('choices').replaceChildren();
    for (const choice of scene.choices) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'choice';
      button.dataset.choice = choice.id;
      button.textContent = choice.label;
      button.setAttribute('aria-label', choice.label);
      $('choices').append(button);
    }
    $('choices-title').hidden = !scene.choices.length;
    $('end-note').hidden = !scene.end;
    appendLog('narration', scene.speaker + ' · ' + scene.title, scene.text);
    $('scene-title').focus({ preventScroll: true });
    $('stage').scrollIntoView?.({ block: 'start' });
  }

  function reset() {
    stopAudio();
    current = null;
    reverse = false;
    historyCount = 0;
    discovered.clear();
    $('journal-list').replaceChildren();
    $('journal-count').textContent = '0';
    $('journal-empty').hidden = false;
    $('story-log').replaceChildren();
    $('log-count').textContent = '';
    $('stage').hidden = true;
    $('cover').hidden = false;
    document.querySelector('[data-action="start"]').hidden = false;
    document.querySelector('[data-action="start"]').focus();
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.action === 'start') {
      $('cover').hidden = true;
      button.hidden = true;
      $('stage').hidden = false;
      showScene(data.initial_scene);
    } else if (button.dataset.action === 'restart') reset();
    else if (button.dataset.action === 'flip' && current?.handout) {
      reverse = !reverse;
      renderHandout(current);
      setSceneAudio(current);
      appendLog('choice', data.role.name, [reverse ? 'Odwracam fotografię.' : 'Oglądam przód fotografii.']);
      appendLog('narration', current.speaker, [reverse ? current.handout.reverseText : current.handout.caption || 'Fotografia']);
      $('handout').querySelector('button').focus({ preventScroll: true });
    } else if (button.dataset.choice && current) {
      const choice = current.choices.find(item => item.id === button.dataset.choice);
      if (!choice) return;
      appendLog('choice', data.role.name, [choice.label]);
      discover(choice.discover);
      showScene(choice.target);
    }
  });
  audio.addEventListener('error', () => {
    $('audio-status').textContent = 'Nagranie tej sceny nie jest jeszcze gotowe. Całą scenę możesz przeczytać powyżej.';
  });
  picture($('role-portrait'), data.role.portrait, data.role.name,
    'Portret tej postaci nie jest jeszcze gotowy.');
  const caption = document.createElement('figcaption');
  caption.textContent = data.role.name + ' · ' + data.role.occupation;
  $('role-portrait').append(caption);
}
