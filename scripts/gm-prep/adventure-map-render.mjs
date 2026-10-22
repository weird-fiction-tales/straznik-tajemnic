const TYPES = ['scene', 'location', 'character', 'clue', 'event', 'item', 'media', 'rule', 'secret'];

/** A self-contained author view. Source fields stay explicit; no app state is read or written. */
export function renderAdventureMap({ model }) {
  const text = (value, field, optional = false) => {
    if (optional && value === undefined) return '';
    if (typeof value !== 'string') throw new Error(field + ' must be a string');
    return value;
  };
  const escape = value => value.replace(/[&<>"']/g, character =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const localMedia = value => {
    const url = text(value, 'media.url');
    let decoded;
    try { decoded = decodeURIComponent(url); } catch { throw new Error('Invalid local media URL'); }
    if (!url || /[\u0000-\u001f\\]/.test(decoded) ||
      (!/^file:\/\/\//.test(decoded) && (/^(?:[a-z][a-z\d+.-]*:|\/)/i.test(decoded) || /(?:^|\/)\.\.(?:\/|$)/.test(decoded)))) {
      throw new Error('Media URL must be local: file:/// or a relative path');
    }
    return url;
  };
  if (!model || !Array.isArray(model.nodes) || !model.nodes.length || !Array.isArray(model.edges)) {
    throw new Error('Map requires nodes and edges');
  }
  const sceneIds = model.nodes.filter(node => node.type === 'scene').map(node => node.id);
  const nodes = model.nodes.map((node, index) => {
    if (!TYPES.includes(node.type)) throw new Error('Unknown node type');
    const id = text(node.id, 'node.id');
    const sceneIndex = Math.max(0, sceneIds.indexOf(node.scene_ids?.[0] || id));
    const angle = sceneIndex * Math.PI * 2 / Math.max(1, sceneIds.length);
    const orbit = index * 2.399963;
    const position = node.position ?? (node.type === 'scene'
      ? [Math.cos(angle) * 300, Math.sin(angle * 2 + .4) * 95, Math.sin(angle) * 300]
      : [Math.cos(angle) * 300 + Math.cos(orbit) * 170,
        Math.sin(orbit * .7) * 190, Math.sin(angle) * 300 + Math.sin(orbit) * 170]);
    if (!Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite)) throw new Error('Invalid XYZ position');
    if (!['draft', 'present', 'missing', 'preview'].includes(node.status)) throw new Error('Unknown node status');
    if (node.media && !['image', 'audio'].includes(node.media.kind)) throw new Error('Unknown local media kind');
    return {
      id, type: node.type, label: text(node.label, 'node.label'), description: text(node.description, 'node.description', true),
      status: node.status, position: [...position],
      details: (node.details || []).map(detail => ({ label: text(detail.label, 'detail.label'), value: text(detail.value, 'detail.value') })),
      source_refs: (node.source_refs || []).map(ref => text(ref, 'source_ref')),
      scene_ids: (node.scene_ids || []).map(scene => text(scene, 'scene_id')),
      media: node.media ? { kind: node.media.kind,
        url: node.status === 'missing' && node.media.url === null ? null : localMedia(node.media.url),
        caption: text(node.media.caption, 'media.caption', true) } : null,
    };
  });
  const ids = new Set(nodes.map(node => node.id));
  if (ids.size !== nodes.length || nodes.some(node => !node.id)) throw new Error('Duplicate or empty node id');
  const edges = model.edges.map(edge => {
    if (!ids.has(edge.source) || !ids.has(edge.target)) throw new Error('Unknown edge source or target');
    return { id: text(edge.id, 'edge.id'), source: edge.source, target: edge.target,
      label: text(edge.label, 'edge.label'), type: text(edge.type, 'edge.type', true),
      condition: text(edge.condition, 'edge.condition', true) };
  });
  const title = text(model.title, 'title');
  const data = { title, adventure_id: text(model.adventure_id, 'adventure_id'),
    start_node_id: ids.has(model.start_node_id) ? model.start_node_id : nodes.find(node => node.type === 'scene')?.id || nodes[0].id,
    nodes, edges, gaps: (model.gaps || []).map(gap => text(gap, 'gap')) };
  const json = JSON.stringify(data).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
  const secretCount = nodes.filter(node => node.type === 'secret').length;
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Mapa teczki · ${escape(title)}</title><style>
:root{color-scheme:dark;--bg:#0d1511;--card:#172019;--ink:#eee7d4;--muted:#b6b9a9;--brass:#cfad6a;--emerald:#8bbda4;--line:#655a3c;--danger:#e5a398}*{box-sizing:border-box}body{height:100vh;margin:0;display:flex;flex-direction:column;overflow:hidden;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,sans-serif}
header{padding:17px 26px 14px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:24px}h1,h2,h3{font-family:Georgia,serif;font-weight:400;line-height:1.25;overflow-wrap:anywhere}h1{font-size:27px;margin:3px 0 0;color:var(--brass)}h2{font-size:28px;margin:12px 0}h3{font-size:21px;color:var(--brass);margin:22px 0 12px}.eyebrow{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}.author-note{font-size:14px;color:var(--muted);max-width:490px;margin:0}
button,input,select,summary{font:inherit}button,select,input[type=search]{min-height:44px;color:var(--ink);border:1px solid var(--line);background:#17231a;border-radius:0;padding:9px 13px}button{cursor:pointer}button:hover{border-color:var(--brass);background:#263529}button.primary{border-color:var(--emerald);color:var(--emerald)}:focus-visible{outline:3px solid var(--emerald);outline-offset:3px}input[type=checkbox]{width:20px;height:20px;accent-color:#7ba78d;flex-shrink:0}label.check{display:flex;align-items:center;gap:10px;min-height:44px;cursor:pointer}.check span{font-size:15px}main{display:grid;grid-template-columns:minmax(420px,1fr) 420px;min-height:0;flex:1}.map-area{position:relative;min-width:0;min-height:0;overflow:hidden}canvas{width:100%;height:100%;display:block;touch-action:none;cursor:grab}canvas.dragging{cursor:grabbing}.map-tools{position:absolute;left:22px;right:22px;top:18px;display:flex;flex-wrap:wrap;align-items:center;gap:8px;pointer-events:none}.map-tools>*{pointer-events:auto}.zoom{display:flex;gap:0;background:var(--bg)}.zoom button{width:46px;font-size:22px;padding:0}.zoom output{min-width:64px;display:flex;justify-content:center;align-items:center;font-size:14px;border-block:1px solid var(--line)}.map-hint{position:absolute;left:24px;bottom:22px;font-size:13px;color:var(--muted);pointer-events:none;max-width:390px}.global-gaps{position:absolute;right:20px;bottom:18px;max-width:420px;background:#152018ee;border:1px solid var(--line);padding:10px 15px;z-index:2}.global-gaps summary{min-height:36px;cursor:pointer;color:var(--brass);font-size:14px}.global-gaps ul{font-size:14px;max-height:210px;overflow:auto;padding-left:22px;max-width:370px}.global-gaps li{margin:10px 0}.map-status{position:absolute;top:78px;left:24px;font-size:13px;color:var(--muted);pointer-events:none}
aside{border-left:1px solid var(--line);background:linear-gradient(#1c251d,#131b15);overflow-y:auto;padding:20px 22px 35px;min-width:0;scrollbar-color:var(--line) var(--bg)}.field{display:block;font-size:14px;color:var(--muted);margin:0 0 7px}#search,#type-filter{width:100%}.filter-row{display:grid;grid-template-columns:1fr;gap:10px;margin-top:12px}.spoiler{border-block:1px solid var(--line);margin:7px 0;padding:4px 0}.spoiler strong{font-weight:500;color:var(--brass)}.node-list{max-height:210px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;margin:12px 0 18px;padding:2px;scrollbar-color:var(--line) var(--bg)}.node-button{flex-shrink:0;text-align:left;display:flex;align-items:center;gap:10px;padding:8px 10px;line-height:1.45;min-height:46px}.node-button>span:last-child{min-width:0;overflow-wrap:anywhere}.node-button[aria-pressed=true]{border-color:var(--emerald);background:#253b2e}.dot{display:inline-block;width:9px;height:9px;border-radius:50%;flex-shrink:0}.type{font-size:13px;color:var(--muted);display:block}.badge{display:inline-block;font-size:13px;padding:3px 8px;border:1px solid var(--line);color:var(--brass);margin:3px 7px 3px 0}.badge.missing{border-color:#936358;color:var(--danger)}#node-details{border-top:1px solid var(--line);padding-top:18px;overflow-wrap:anywhere}#node-details p{white-space:pre-wrap}.description{font:18px/1.8 Georgia,serif}.focus-button{width:100%;margin:10px 0}.sources{font:13px/1.6 ui-monospace,monospace;color:var(--muted);padding-left:20px}.sources li{margin:8px 0}.details-row{border-bottom:1px solid #655a3c66;padding:10px 0}.details-row strong{display:block;font-weight:500;color:var(--brass);font-size:14px}.details-row p{margin:5px 0 0;font-size:15px}.relations{list-style:none;margin:0;padding:0}.relations li{border-bottom:1px solid #655a3c77;padding:10px 0}.relations button{display:block;width:100%;text-align:left;margin:6px 0}.relation-label{font-size:14px;color:var(--muted)}.condition{font-size:14px;color:var(--brass);margin:8px 0}.media-preview img{max-width:100%;max-height:330px;object-fit:contain;display:block;border:1px solid var(--line)}audio{width:100%;height:44px}.media-caption,.missing-note{font-size:14px;color:var(--muted);margin:8px 0}.missing-note{color:var(--danger)}.empty{color:var(--muted);font-size:14px}.source-note{font-size:13px;color:var(--muted)}.source-data{margin-top:24px;border-top:1px solid var(--line);padding:16px 0}.source-data summary{cursor:pointer;min-height:44px;color:var(--brass);font-size:16px}
@media(max-width:1050px){main{grid-template-columns:minmax(360px,1fr) 360px}aside{padding:18px}header{padding:14px 20px}.author-note{max-width:330px}.map-tools{left:16px;right:16px}.map-hint{display:none}.global-gaps{max-width:280px;right:16px}}
@media(max-width:760px){body{height:auto;overflow:auto}header{align-items:flex-start;flex-direction:column;gap:10px}main{display:flex;flex-direction:column}.map-area{height:62vh;min-height:430px}aside{border-left:none;border-top:1px solid var(--line);overflow:visible}.map-tools{gap:6px;top:14px}.map-tools button{font-size:14px}.map-status{top:124px}.global-gaps{max-width:260px}.node-list{max-height:210px}}
</style></head><body><header><div><div class="eyebrow">Mapa autora · powiązania w przestrzeni</div><h1>${escape(title)}</h1></div><p class="author-note">Teczka robocza. Opis źródłowy i obecność pliku nie oznaczają akceptacji ani sprawdzonego działania w grze.</p></header><main><section class="map-area" aria-label="Przestrzenna mapa przygody"><canvas id="graph" tabindex="0" aria-label="Graf trójwymiarowy. Przeciągnij, aby obrócić; użyj listy węzłów do obsługi klawiaturą.">Przestrzenna mapa powiązań; wszystkie węzły są także dostępne na liście.</canvas><div class="map-tools"><button id="overview" class="primary">Sceny i ich otoczenie</button><button id="show-all">Pokaż całą teczkę</button><button id="reset">Resetuj widok</button><div class="zoom"><button id="zoom-out" aria-label="Oddal">−</button><output id="zoom-value" aria-label="Powiększenie">160%</output><button id="zoom-in" aria-label="Przybliż">+</button></div></div><div id="map-status" class="map-status" aria-live="polite"></div><p class="map-hint">Przeciągnij: obrót · kółko: zbliżenie<br>Kliknięcie: opis · podwójne kliknięcie: wejdź w sąsiedztwo</p><details id="gaps" class="global-gaps"><summary>Co jeszcze wymaga pracy (${data.gaps.length})</summary><ul>${data.gaps.map(gap => '<li>' + escape(gap) + '</li>').join('') || '<li>Nie wskazano dodatkowych braków w tym zestawie.</li>'}</ul></details></section><aside aria-label="Węzły i pełna treść źródłowa"><label class="field" for="search">Znajdź węzeł w całej teczce</label><input id="search" type="search" placeholder="Miejsce, osoba, przedmiot, trop…" autocomplete="off"><div class="filter-row"><label><span class="field">Rodzaj węzła</span><select id="type-filter" aria-label="Rodzaj węzła"></select></label></div><label class="check"><input type="checkbox" id="neighbors"><span>Tylko sąsiedztwo wybranego węzła</span></label><label class="check spoiler"><input type="checkbox" id="show-secrets"><span><strong>Pokaż spoilery autora</strong><br><span id="secret-count">${secretCount} ukrytych węzłów autora</span></span></label><div id="list-count" class="field"></div><nav id="node-list" class="node-list" aria-label="Widoczne węzły"></nav><article id="node-details" aria-live="polite"></article></aside></main><script type="application/json" id="map-data">${json}</script><script>(${adventureMapClient.toString()})();</script></body></html>`;
}

function adventureMapClient() {
  'use strict';
  const data = JSON.parse(document.getElementById('map-data').textContent);
  const $ = id => document.getElementById(id);
  const canvas = $('graph'), context = canvas.getContext('2d');
  const nodes = new Map(data.nodes.map(node => [node.id, node]));
  const labels = { scene: 'Sceny', location: 'Miejsca', character: 'Postacie', clue: 'Tropy', event: 'Wydarzenia', item: 'Przedmioty', media: 'Media', rule: 'Reguły', secret: 'Sekrety autora' };
  const colors = { scene: '#d9b875', location: '#8cc3a6', character: '#a8b9df', clue: '#e3ce79', event: '#d99a85', item: '#c6b596', media: '#b9a5d0', rule: '#abb8b2', secret: '#e29494' };
  const statuses = { draft: 'Do sprawdzenia', present: 'Plik dostępny', missing: 'Brak', preview: 'Podgląd otwarcia' };
  const allowed = node => $('show-secrets').checked || node.type !== 'secret';
  let selected = data.start_node_id, mode = 'overview', hovered = null;
  let camera = { yaw: .35, pitch: -.24, zoom: 1.6, target: [...nodes.get(selected).position] };
  let projected = [], dragging = null, dragDistance = 0, activeAudio = null;
  const center = [0, 1, 2].map(axis => data.nodes.reduce((sum, node) => sum + node.position[axis], 0) / data.nodes.length);
  const extent = Math.max(1, ...data.nodes.map(node => Math.hypot(...node.position.map((value, axis) => value - center[axis]))));
  const scale = 340 / extent;
  let width = 0, height = 0, frame = null;

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function neighboring(id) {
    const result = new Set([id]);
    for (const edge of data.edges) {
      if (edge.source === id) result.add(edge.target);
      if (edge.target === id) result.add(edge.source);
    }
    return result;
  }

  function visibleNodes() {
    const query = $('search').value.trim().toLocaleLowerCase('pl');
    const type = $('type-filter').value;
    const overview = new Set(data.nodes.filter(node => node.type === 'scene').map(node => node.id));
    for (const id of neighboring(selected)) overview.add(id);
    const area = $('neighbors').checked ? neighboring(selected)
      : mode === 'all' || query || type !== 'all' ? new Set(nodes.keys()) : overview;
    return data.nodes.filter(node => allowed(node) && area.has(node.id) && (type === 'all' || node.type === type) &&
      (!query || [node.label, node.description, ...node.details.map(detail => detail.value)].join(' ').toLocaleLowerCase('pl').includes(query)));
  }

  function project(position) {
    const [x, y, z] = position.map((value, axis) => (value - camera.target[axis]) * scale * camera.zoom);
    const cy = Math.cos(camera.yaw), sy = Math.sin(camera.yaw), cp = Math.cos(camera.pitch), sp = Math.sin(camera.pitch);
    const turnedX = x * cy + z * sy, turnedZ = -x * sy + z * cy;
    const turnedY = y * cp - turnedZ * sp, depth = y * sp + turnedZ * cp;
    const distance = 1200 + depth;
    if (!Number.isFinite(distance) || distance < 120) return null;
    const perspective = 1200 / distance;
    return { x: width / 2 + turnedX * perspective, y: height / 2 + turnedY * perspective, depth, perspective };
  }

  function draw() {
    frame = null;
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width; height = bounds.height;
    const ratio = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const gradient = context.createRadialGradient(width / 2, height / 2, 40, width / 2, height / 2, Math.max(width, height));
    gradient.addColorStop(0, '#21352a'); gradient.addColorStop(1, '#0b110e');
    context.fillStyle = gradient; context.fillRect(0, 0, width, height);
    context.strokeStyle = '#bdad7512'; context.lineWidth = 1;
    for (let line = -3; line <= 3; line++) {
      const offset = line * extent / 3;
      for (const axis of [0, 2]) {
        const a = [...center], b = [...center];
        a[1] = b[1] = center[1] + extent * .55;
        a[axis] += offset; b[axis] += offset;
        a[axis === 0 ? 2 : 0] -= extent; b[axis === 0 ? 2 : 0] += extent;
        const p = project(a), q = project(b);
        if (!p || !q) continue;
        context.beginPath(); context.moveTo(p.x, p.y); context.lineTo(q.x, q.y); context.stroke();
      }
    }
    const visible = visibleNodes(), visibleIds = new Set(visible.map(node => node.id));
    projected = visible.map(node => {
      const point = project(node.position);
      return point ? { node, ...point } : null;
    }).filter(Boolean).sort((a, b) => b.depth - a.depth);
    const points = new Map(projected.map(point => [point.node.id, point]));
    for (const edge of data.edges) {
      if (!visibleIds.has(edge.source) || !visibleIds.has(edge.target)) continue;
      const a = points.get(edge.source), b = points.get(edge.target);
      if (!a || !b) continue;
      const active = edge.source === selected || edge.target === selected;
      context.strokeStyle = active ? '#c9ae73b0' : '#a1b8a436';
      context.lineWidth = active ? 1.8 : 1;
      context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke();
    }
    for (const point of projected) {
      const active = point.node.id === selected;
      point.radius = Math.max(4, Math.min(24, (point.node.type === 'scene' ? 11 : 6.5) * point.perspective)) + (active ? 3 : 0);
      if (active) {
        context.beginPath(); context.arc(point.x, point.y, point.radius + 7, 0, Math.PI * 2);
        context.strokeStyle = '#d9c38d'; context.lineWidth = 1.5; context.stroke();
      }
      context.beginPath(); context.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
      context.fillStyle = colors[point.node.type]; context.globalAlpha = Math.max(.45, Math.min(1, point.perspective));
      context.fill(); context.globalAlpha = 1;
    }
    const labelBoxes = [];
    const labelPoints = projected.filter(point => point.node.type === 'scene' || point.node.id === selected || point.node.id === hovered)
      .sort((a, b) => Number(b.node.id === selected) - Number(a.node.id === selected) || Number(b.node.id === hovered) - Number(a.node.id === hovered));
    for (const point of labelPoints) {
      const active = point.node.id === selected;
      context.font = active ? '600 15px system-ui' : '14px system-ui';
      const full = active || point.node.id === hovered;
      const label = !full && point.node.label.length > 28 ? point.node.label.slice(0, 27) + '…' : point.node.label;
      const lines = [];
      let line = '';
      for (const word of label.split(/\s+/)) {
        if (line && context.measureText(line + ' ' + word).width > 250) { lines.push(line); line = word; }
        else line += (line ? ' ' : '') + word;
      }
      if (line) lines.push(line);
      const boxWidth = Math.min(260, Math.max(...lines.map(value => context.measureText(value).width)) + 12);
      const boxHeight = lines.length * 19 + 8;
      const candidates = [
        [point.x + point.radius + 10, point.y - boxHeight],
        [point.x - point.radius - boxWidth - 10, point.y - boxHeight],
        [point.x + point.radius + 10, point.y + 12],
        [point.x - point.radius - boxWidth - 10, point.y + 12],
      ].map(([x, y]) => ({ x: Math.max(8, Math.min(width - boxWidth - 8, x)), y: Math.max(8, Math.min(height - boxHeight - 8, y)), width: boxWidth, height: boxHeight }));
      const box = candidates.find(candidate => !labelBoxes.some(other =>
        candidate.x < other.x + other.width + 6 && candidate.x + candidate.width + 6 > other.x &&
        candidate.y < other.y + other.height + 6 && candidate.y + candidate.height + 6 > other.y));
      if (!box && !full) continue;
      const placed = box || candidates[0];
      labelBoxes.push(placed);
      context.fillStyle = '#101911ed'; context.fillRect(placed.x, placed.y, placed.width, placed.height);
      context.fillStyle = active ? '#f3e6c2' : '#d6cfb8';
      lines.forEach((value, index) => context.fillText(value, placed.x + 6, placed.y + 17 + index * 19, 248));
    }
  }
  function scheduleDraw() { if (!frame) frame = requestAnimationFrame(draw); }

  function renderList() {
    const visible = visibleNodes();
    $('node-list').replaceChildren();
    for (const node of visible) {
      const button = element('button', undefined, 'node-button');
      button.type = 'button'; button.dataset.node = node.id; button.setAttribute('aria-pressed', String(node.id === selected));
      button.setAttribute('aria-label', node.label);
      const dot = element('span', undefined, 'dot'); dot.style.backgroundColor = colors[node.type]; dot.setAttribute('aria-hidden', 'true');
      const name = element('span', node.label); name.append(element('span', labels[node.type] + ' · ' + statuses[node.status], 'type'));
      button.append(dot, name); $('node-list').append(button);
    }
    if (!visible.length) $('node-list').append(element('p', 'Brak węzłów dla tych filtrów.', 'empty'));
    $('list-count').textContent = 'Widoczne węzły: ' + visible.length;
    $('map-status').textContent = (mode === 'overview' && !$('neighbors').checked && !$('search').value && $('type-filter').value === 'all' ? 'Sceny + pierwsze sąsiedztwo' : $('neighbors').checked ? 'Otoczenie wybranego węzła' : 'Cała teczka') + ' · ' + visible.length + ' / ' + data.nodes.length + ' węzłów';
    const hidden = data.nodes.filter(node => node.type === 'secret').length;
    $('secret-count').textContent = hidden + ($('show-secrets').checked ? ' węzłów autora dostępnych' : ' ukrytych węzłów autora');
    scheduleDraw();
  }

  function inspect() {
    if (activeAudio) { activeAudio.pause(); activeAudio = null; }
    const node = nodes.get(selected), panel = $('node-details');
    panel.replaceChildren();
    if (!node || !allowed(node)) { panel.append(element('p', 'Wybierz widoczny węzeł.', 'empty')); return; }
    panel.dataset.node = selected;
    panel.append(element('span', labels[node.type], 'badge'), element('span', statuses[node.status], 'badge ' + node.status), element('h2', node.label));
    panel.append(element('p', node.description || 'Nie opisano tego w źródle.', 'description'));
    const focus = element('button', 'Wejdź w węzeł', 'primary focus-button'); focus.id = 'focus-node'; focus.type = 'button'; panel.append(focus);
    if (node.media) {
      const preview = element('section', undefined, 'media-preview');
      preview.append(element('h3', node.media.kind === 'audio' ? 'Nagranie' : 'Obraz'));
      const missing = element('p', 'Materiał niedostępny. Powiązanie wymaga uzupełnienia.', 'missing-note');
      if (node.status === 'missing') preview.append(missing);
      else {
        const media = document.createElement(node.media.kind === 'audio' ? 'audio' : 'img');
        if (node.media.kind === 'audio') { media.controls = true; media.preload = 'none'; activeAudio = media; }
        else media.alt = node.media.caption || node.label;
        media.addEventListener('error', () => media.replaceWith(missing), { once: true });
        media.src = node.media.url; preview.append(media);
      }
      if (node.media.caption) preview.append(element('p', node.media.caption, 'media-caption'));
      panel.append(preview);
    }
    const connected = data.edges.filter(edge => edge.source === selected || edge.target === selected);
    const groups = new Map();
    for (const edge of connected) {
      const other = nodes.get(edge.source === selected ? edge.target : edge.source);
      if (!allowed(other)) continue;
      if (!groups.has(other.type)) groups.set(other.type, []);
      groups.get(other.type).push({ edge, other });
    }
    for (const [type, links] of groups) {
      panel.append(element('h3', labels[type]));
      const list = element('ul', undefined, 'relations');
      for (const { edge, other } of links) {
        const item = element('li');
        item.append(element('span', (edge.source === selected ? '→ ' : '← ') + edge.label, 'relation-label'));
        const button = element('button', other.label); button.type = 'button'; button.dataset.neighbor = other.id; item.append(button);
        if (edge.condition) item.append(element('p', 'Warunek: ' + edge.condition, 'condition'));
        list.append(item);
      }
      panel.append(list);
    }
    if (!groups.size) panel.append(element('p', 'Brak jawnych powiązań w tym widoku.', 'empty'));
    const sourceData = element('details', undefined, 'source-data');
    sourceData.append(element('summary', 'Dane źródłowe i pełne fragmenty (' + node.details.length + ')'));
    if (node.details.length) for (const detail of node.details) {
      const row = element('div', undefined, 'details-row');
      row.append(element('strong', detail.label), element('p', detail.value)); sourceData.append(row);
    }
    sourceData.append(element('h3', 'Źródła'));
    if (node.source_refs.length) {
      const sources = element('ul', undefined, 'sources');
      for (const ref of node.source_refs) sources.append(element('li', ref));
      sourceData.append(sources);
    } else sourceData.append(element('p', 'Nie wskazano źródła. To wymaga uzupełnienia.', 'missing-note'));
    panel.append(sourceData);
  }

  function revealSelection() {
    const panel = $('node-details'), sidebar = panel.parentElement;
    sidebar.scrollTop += panel.getBoundingClientRect().top - sidebar.getBoundingClientRect().top - 14;
  }
  function select(id) {
    if (!nodes.has(id) || !allowed(nodes.get(id))) return;
    selected = id; inspect(); renderList(); revealSelection();
  }
  function focusSelected() {
    camera.target = [...nodes.get(selected).position];
    $('neighbors').checked = true; $('search').value = ''; $('type-filter').value = 'all';
    renderList(); revealSelection();
  }
  function zoom(amount) {
    camera.zoom = Math.max(.4, Math.min(2.5, camera.zoom * amount));
    $('zoom-value').textContent = Math.round(camera.zoom * 100) + '%';
    scheduleDraw();
  }
  function hit(event) {
    const bounds = canvas.getBoundingClientRect(), x = event.clientX - bounds.left, y = event.clientY - bounds.top;
    return [...projected].reverse().find(point => Math.hypot(x - point.x, y - point.y) <= point.radius + 7)?.node;
  }

  const option = element('option', 'Wszystkie rodzaje'); option.value = 'all'; $('type-filter').append(option);
  for (const type of Object.keys(labels)) {
    const count = data.nodes.filter(node => node.type === type).length;
    const entry = element('option', labels[type] + ' (' + count + ')'); entry.value = type; $('type-filter').append(entry);
  }
  $('node-list').addEventListener('click', event => { const button = event.target.closest('[data-node]'); if (button) select(button.dataset.node); });
  $('node-list').addEventListener('dblclick', event => { const button = event.target.closest('[data-node]'); if (button) { select(button.dataset.node); focusSelected(); } });
  $('node-list').addEventListener('keydown', event => {
    const button = event.target.closest('[data-node]');
    if (button && event.key === 'Enter') { event.preventDefault(); select(button.dataset.node); focusSelected(); }
  });
  $('node-details').addEventListener('click', event => {
    const neighbor = event.target.closest('[data-neighbor]');
    if (neighbor) select(neighbor.dataset.neighbor);
    else if (event.target.closest('#focus-node')) focusSelected();
  });
  for (const id of ['search', 'type-filter', 'neighbors', 'show-secrets']) $(id).addEventListener(id === 'search' ? 'input' : 'change', () => {
    if (!allowed(nodes.get(selected))) selected = data.start_node_id;
    renderList(); if (id === 'show-secrets') inspect();
  });
  $('overview').addEventListener('click', () => { mode = 'overview'; $('search').value = ''; $('type-filter').value = 'all'; $('neighbors').checked = false; renderList(); });
  $('show-all').addEventListener('click', () => { mode = 'all'; $('search').value = ''; $('type-filter').value = 'all'; $('neighbors').checked = false; renderList(); });
  $('reset').addEventListener('click', () => {
    mode = 'overview'; selected = data.start_node_id; hovered = null;
    $('show-secrets').checked = false; $('neighbors').checked = false; $('search').value = ''; $('type-filter').value = 'all';
    camera = { yaw: .35, pitch: -.24, zoom: 1.6, target: [...nodes.get(selected).position] };
    $('zoom-value').textContent = '160%'; inspect(); renderList(); $('node-details').parentElement.scrollTop = 0;
  });
  $('zoom-in').addEventListener('click', () => zoom(1.2));
  $('zoom-out').addEventListener('click', () => zoom(1 / 1.2));
  canvas.addEventListener('wheel', event => { event.preventDefault(); zoom(event.deltaY < 0 ? 1.1 : 1 / 1.1); }, { passive: false });
  canvas.addEventListener('pointerdown', event => {
    dragging = { x: event.clientX, y: event.clientY }; dragDistance = 0;
    canvas.setPointerCapture(event.pointerId); canvas.classList.add('dragging');
  });
  canvas.addEventListener('pointermove', event => {
    if (dragging) {
      const dx = event.clientX - dragging.x, dy = event.clientY - dragging.y;
      dragDistance += Math.abs(dx) + Math.abs(dy);
      camera.yaw += dx * .008; camera.pitch = Math.max(-1.25, Math.min(1.25, camera.pitch + dy * .008));
      dragging = { x: event.clientX, y: event.clientY }; scheduleDraw();
    } else { const id = hit(event)?.id || null; if (hovered !== id) { hovered = id; scheduleDraw(); } }
  });
  canvas.addEventListener('pointerup', event => {
    dragging = null; canvas.classList.remove('dragging');
    if (dragDistance < 5) { const node = hit(event); if (node) select(node.id); }
  });
  canvas.addEventListener('pointercancel', () => { dragging = null; canvas.classList.remove('dragging'); });
  canvas.addEventListener('dblclick', event => { const node = hit(event); if (node) { select(node.id); focusSelected(); } });
  canvas.addEventListener('keydown', event => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', 'Enter'].includes(event.key)) event.preventDefault();
    if (event.key === 'ArrowLeft') camera.yaw -= .12;
    if (event.key === 'ArrowRight') camera.yaw += .12;
    if (event.key === 'ArrowUp') camera.pitch = Math.max(-1.25, camera.pitch - .12);
    if (event.key === 'ArrowDown') camera.pitch = Math.min(1.25, camera.pitch + .12);
    if (event.key === '+') zoom(1.2);
    if (event.key === '-') zoom(1 / 1.2);
    if (event.key === 'Enter') focusSelected();
    scheduleDraw();
  });
  new ResizeObserver(scheduleDraw).observe(canvas);
  inspect(); renderList();
}
