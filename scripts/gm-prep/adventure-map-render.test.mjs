import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const moduleUrl = new URL('./adventure-map-render.mjs', import.meta.url);
const { renderAdventureMap } = existsSync(moduleUrl) ? await import(moduleUrl) : {};
const require = createRequire(new URL('../../_tester/_base/.silnik/package.json', import.meta.url));
const { JSDOM } = require('jsdom');

function fixture() {
  const node = (id, type, position) => ({ id, type, label: id, description: 'Opis ' + id, status: 'draft',
    details: [{ label: 'Wydarzenie', value: 'Źródłowy opis zdarzenia' }], source_refs: ['source.json#/' + id], scene_ids: ['room'], position });
  return { title: 'Teczka Prabut', adventure_id: 'prabuty', start_node_id: 'room',
    nodes: [node('room', 'scene', [0, 0, 0]), node('next', 'scene', [300, 20, -150]),
      node('desk', 'location', [140, 80, 90]), node('witness', 'character', [-120, 80, -90]),
      node('photo', 'clue', [-200, -80, 150]), node('secret', 'secret', [60, 150, 180])],
    edges: [{ id: 'e1', source: 'room', target: 'desk', label: 'rozgrywa się w', type: 'location' },
      { id: 'e2', source: 'room', target: 'witness', label: 'uczestniczy', type: 'character' },
      { id: 'e3', source: 'room', target: 'photo', label: 'udostępnia trop', type: 'clue', condition: 'Po obejrzeniu odbitki' },
      { id: 'e4', source: 'photo', target: 'secret', label: 'wyjaśnia', type: 'secret' }],
    summary: { private: 'UNRELATED_PRIVATE_SENTINEL' }, gaps: ['Nie przygotowano nagrania.'] };
}

test('renders an offline author map with a canvas, source inspector and visible hidden-secret count', () => {
  assert.equal(typeof renderAdventureMap, 'function');
  const html = renderAdventureMap({ model: fixture() });
  const dom = new JSDOM(html);
  const document = dom.window.document;
  assert.equal(document.documentElement.lang, 'pl');
  assert.ok(document.querySelector('canvas'));
  assert.ok(document.querySelector('#node-details'));
  assert.ok(document.querySelector('#show-secrets'));
  assert.equal(document.querySelector('#show-secrets').checked, false);
  assert.match(document.querySelector('#secret-count').textContent, /1 ukrytych węzłów autora/);
  assert.ok(!html.includes('UNRELATED_PRIVATE_SENTINEL'));
  assert.ok(!/<script[^>]+src=|@import|fetch\(|localStorage/.test(html));
  dom.window.close();
});

test('preserves supplied XYZ coordinates and assigns deterministic volumetric positions when absent', () => {
  const model = fixture();
  const parse = html => JSON.parse(new JSDOM(html).window.document.querySelector('#map-data').textContent);
  let data = parse(renderAdventureMap({ model }));
  assert.deepEqual(data.nodes[2].position, [140, 80, 90]);
  for (const node of model.nodes) delete node.position;
  data = parse(renderAdventureMap({ model }));
  assert.equal(new Set(data.nodes.map(node => node.position[2])).size > 1, true);
  assert.equal(new Set(data.nodes.map(node => node.position[1])).size > 1, true);
  assert.deepEqual(data.nodes.map(node => node.position), parse(renderAdventureMap({ model })).nodes.map(node => node.position));
});

test('rejects remote media, invalid edges, malformed positions and nested text objects', () => {
  const model = fixture();
  model.nodes[0].media = { kind: 'image', url: 'https://remote.invalid/photo.jpg' };
  assert.throws(() => renderAdventureMap({ model }), /local|lokal/i);
  model.nodes[0].media.url = 'file:///private/tmp/photo.jpg';
  assert.doesNotThrow(() => renderAdventureMap({ model }));
  model.edges[0].target = 'absent';
  assert.throws(() => renderAdventureMap({ model }), /edge|relac|target/i);
  const malformed = fixture();
  malformed.nodes[0].position = [1, 2, 'private'];
  assert.throws(() => renderAdventureMap({ model: malformed }), /position|XYZ/i);
  const nested = fixture();
  nested.nodes[0].description = { visible: 'Text', private: 'SECRET_NESTED' };
  assert.throws(() => renderAdventureMap({ model: nested }), /string|text/i);
});

test('player-supplied labels cannot inject HTML or close the JSON data script', () => {
  const model = fixture();
  model.title = '<img src=x onerror=alert(1)>';
  model.nodes[0].description = '</script><script>throw Error("injected")</script>';
  const html = renderAdventureMap({ model });
  const document = new JSDOM(html).window.document;
  assert.equal(document.querySelector('img[onerror]'), null);
  const data = JSON.parse(document.querySelector('#map-data').textContent);
  assert.equal(data.nodes[0].description, model.nodes[0].description);
  assert.ok(!html.includes('<img src=x onerror'));
});

test('missing media with a null local URL remains a visible gap without blocking the whole map', () => {
  const model = fixture();
  model.nodes[0].status = 'missing';
  model.nodes[0].media = { kind: 'image', url: null, caption: 'Nieprzygotowana fotografia' };
  let html;
  assert.doesNotThrow(() => { html = renderAdventureMap({ model }); });
  const document = new JSDOM(html).window.document;
  const data = JSON.parse(document.querySelector('#map-data').textContent);
  assert.equal(data.nodes[0].media.url, null);
  assert.equal(data.nodes[0].status, 'missing');
});
