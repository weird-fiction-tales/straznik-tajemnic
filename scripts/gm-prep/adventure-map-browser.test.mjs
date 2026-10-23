import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { renderAdventureMap } from './adventure-map-render.mjs';
const require = createRequire(new URL('../../_tester/_base/.silnik/package.json', import.meta.url));
const { chromium } = require('@playwright/test');

function fixture({ extreme = false } = {}) {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'adventure-map-browser-')));
  fs.mkdirSync(path.join(directory, 'assets'));
  fs.writeFileSync(path.join(directory, 'assets/photo.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="300"><rect width="500" height="300" fill="#45664d"/><text x="40" y="140" font-size="26" fill="#fff">Neutralny materiał testowy</text></svg>');
  const wave = Buffer.alloc(44 + 32000 * 3);
  wave.write('RIFF', 0); wave.writeUInt32LE(wave.length - 8, 4); wave.write('WAVEfmt ', 8);
  wave.writeUInt32LE(16, 16); wave.writeUInt16LE(1, 20); wave.writeUInt16LE(1, 22);
  wave.writeUInt32LE(16000, 24); wave.writeUInt32LE(32000, 28); wave.writeUInt16LE(2, 32); wave.writeUInt16LE(16, 34);
  wave.write('data', 36); wave.writeUInt32LE(wave.length - 44, 40);
  fs.writeFileSync(path.join(directory, 'assets/audio.wav'), wave);
  const node = (id, type, label, position) => ({ id, type, label, position, description: 'Pełny opis: ' + label, status: 'draft',
    details: [{ label: 'Treść źródłowa', value: 'Niezależne źródłowe szczegóły: ' + label }], source_refs: ['source.json#/' + id], scene_ids: ['room'] });
  const model = { title: 'Neutralna teczka', adventure_id: 'fixture', start_node_id: 'room', nodes: [
    node('room', 'scene', 'Redakcja', [0, 0, 0]), node('next', 'scene', 'Stacja', [300, 20, -150]),
    node('desk', 'location', 'Gabinet', [180, 70, 70]), node('witness', 'character', 'Rozmówczyni z wyjątkowo długim kanonicznym tytułem opisującym jej miejsce w całej historii oraz odpowiedzialność w redakcji', [-160, -80, -80]),
    node('photo', 'clue', 'Fotografia', [-190, 100, 150]), node('event', 'event', 'Początek rozmowy', [100, -120, 200]),
    node('item', 'item', 'Koperta', [-100, 160, -180]), node('image', 'media', 'Obraz odbitki', [230, 160, 50]),
    node('audio', 'media', 'Nagranie rozmowy', [-280, 40, -150]), node('rule', 'rule', 'Zasada tropu', [80, -180, -220]),
    node('secret', 'secret', 'Sekret rozmówczyni', [100, 240, 210]), node('remote', 'clue', 'Odległy trop', [400, -140, 250]),
    node('missing', 'media', 'Brakująca taśma', [-320, -130, 170]),
  ], edges: [], gaps: ['Nie przygotowano taśmy.', 'Ślad wymaga powiązania ze sceną.'] };
  model.nodes.find(node => node.id === 'image').media = { kind: 'image', url: 'assets/photo.svg', caption: 'Odbitka testowa' };
  model.nodes.find(node => node.id === 'image').status = 'present';
  model.nodes.find(node => node.id === 'audio').media = { kind: 'audio', url: 'assets/audio.wav', caption: 'Nagranie testowe' };
  model.nodes.find(node => node.id === 'audio').status = 'preview';
  model.nodes.find(node => node.id === 'missing').media = { kind: 'audio', url: null, caption: 'Brak pliku' };
  model.nodes.find(node => node.id === 'missing').status = 'missing';
  for (const target of ['desk', 'witness', 'photo', 'event', 'item', 'image', 'audio', 'rule', 'missing']) {
    model.edges.push({ id: 'room-' + target, source: 'room', target, type: target, label: 'Źródłowa relacja: ' + target, condition: target === 'photo' ? 'Po obejrzeniu koperty' : '' });
  }
  model.edges.push({ id: 'photo-secret', source: 'photo', target: 'secret', label: 'Ukryte wyjaśnienie', type: 'secret' });
  if (extreme) {
    model.start_node_id = 'center';
    model.nodes = [node('center', 'scene', 'Środek', [0, 0, 0]),
      node('corner', 'clue', 'Skrajny węzeł', [1000, 0, 1000]),
      node('behind', 'clue', 'Węzeł za kamerą', [-1000, 0, -1000])];
    model.edges = [{ id: 'a', source: 'center', target: 'corner', label: 'prowadzi', type: 'clue' },
      { id: 'b', source: 'corner', target: 'behind', label: 'łączy', type: 'clue' }];
  }
  const html = path.join(directory, 'index.html');
  fs.writeFileSync(html, renderAdventureMap({ model }));
  return { directory, html };
}

test('actual canvas supports selection, depth rotation, zoom and focus; source panel exposes all semantic groups', async () => {
  const files = fixture();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(5000);
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', request => requests.push(request.url()));
    await page.goto(pathToFileURL(files.html).href);
    const canvas = page.locator('canvas');
    await page.waitForFunction(() => document.querySelector('canvas').width > 500);
    const startPixels = await canvas.screenshot();
    assert.equal(await page.locator('#node-details').getAttribute('data-node'), 'room');
    assert.match(await page.locator('#map-status').innerText(), /Sceny \+ pierwsze sąsiedztwo/);
    assert.equal(await page.locator('#node-list [data-node=remote]').count(), 0);
    assert.equal(await page.locator('#node-list [data-node=secret]').count(), 0);
    assert.match(await page.locator('#secret-count').innerText(), /1 ukrytych węzłów autora/);
    const rows = await page.locator('#node-list button').evaluateAll(buttons => buttons.map(button => ({
      top: button.getBoundingClientRect().top, bottom: button.getBoundingClientRect().bottom,
      contentBottom: button.lastElementChild.getBoundingClientRect().bottom,
    })));
    assert.ok(rows.every((row, index) => row.contentBottom <= row.bottom && (!index || row.top >= rows[index - 1].bottom + 4)), 'Wrapped canonical labels overlap other node buttons');
    for (const label of ['Miejsca', 'Postacie', 'Tropy', 'Wydarzenia', 'Przedmioty', 'Media', 'Reguły']) {
      assert.ok((await page.locator('#node-details').innerText()).includes(label), label);
    }
    assert.match(await page.locator('#node-details').innerText(), /Po obejrzeniu koperty/);
    const sourcePanel = page.locator('#node-details details');
    assert.equal(await sourcePanel.count(), 1);
    assert.equal(await sourcePanel.evaluate(details => details.open), false);
    assert.equal(await page.locator('#node-details .sources').isVisible(), false);
    await sourcePanel.locator('summary').click();
    assert.equal(await page.locator('#node-details .sources').isVisible(), true);
    assert.match(await page.locator('#node-details').innerText(), /source.json#\/room/);
    await sourcePanel.locator('summary').click();
    await page.locator('#node-list [data-node=witness]').click();
    assert.equal(await page.locator('#node-details').getAttribute('data-node'), 'witness');
    const selectedHeading = await page.locator('#node-details h2').boundingBox();
    assert.ok(selectedHeading.y >= 80 && selectedHeading.y + selectedHeading.height <= 1000, 'Selected node heading should be visible in sidebar');
    const selectedDescription = await page.locator('#node-details .description').boundingBox();
    assert.ok(selectedDescription.y >= 80 && selectedDescription.y + selectedDescription.height <= 1000, 'Selected node description should be immediately visible without scrolling');
    const bounds = await canvas.boundingBox();
    await canvas.click({ position: { x: bounds.width / 2, y: bounds.height / 2 } });
    assert.equal(await page.locator('#node-details').getAttribute('data-node'), 'room');
    await canvas.dblclick({ position: { x: bounds.width / 2, y: bounds.height / 2 } });
    assert.equal(await page.locator('#neighbors').isChecked(), true);
    assert.equal(await page.locator('#node-list [data-node=next]').count(), 0);
    await page.getByRole('button', { name: 'Pokaż całą teczkę', exact: true }).click();
    assert.equal(await page.locator('#node-list [data-node=remote]').count(), 1);
    await page.getByRole('button', { name: 'Przybliż', exact: true }).click();
    assert.equal(await page.locator('#zoom-value').innerText(), '192%');
    assert.equal((await canvas.screenshot()).equals(startPixels), false);
    const beforeDrag = await canvas.screenshot();
    await page.mouse.move(bounds.x + bounds.width * .55, bounds.y + bounds.height * .6);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * .55 + 120, bounds.y + bounds.height * .6 + 70, { steps: 10 });
    await page.mouse.up();
    await page.waitForFunction(() => !document.querySelector('canvas').classList.contains('dragging'));
    assert.equal((await canvas.screenshot()).equals(beforeDrag), false);
    await canvas.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowUp');
    await page.getByRole('button', { name: 'Resetuj widok', exact: true }).click();
    assert.equal(await page.locator('#zoom-value').innerText(), '160%');
    assert.equal(await page.locator('#neighbors').isChecked(), false);
    await page.locator('#node-list [data-node=witness]').press('Enter');
    assert.equal(await page.locator('#neighbors').isChecked(), true);
    assert.equal(await page.locator('#node-details').getAttribute('data-node'), 'witness');
    assert.equal(await page.locator('#node-list [data-node=room]').count(), 1);
    await page.screenshot({ path: path.join(files.directory, 'map-focus.png'), fullPage: true });
    assert.ok(requests.every(url => url.startsWith('file:')), requests.join('\n'));
    assert.deepEqual(errors, []);
    console.log('Map browser screenshots: ' + files.directory);
  } finally { await browser.close(); }
});

test('search, type filters, spoiler toggle, local media and missing gaps remain keyboard accessible', async () => {
  const files = fixture();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(pathToFileURL(files.html).href);
    await page.getByRole('searchbox').fill('Odległy');
    assert.equal(await page.locator('#node-list button').count(), 1);
    await page.locator('#node-list button').press('Enter');
    assert.equal(await page.locator('#node-details').getAttribute('data-node'), 'remote');
    assert.equal(await page.locator('#neighbors').isChecked(), true);
    await page.getByRole('button', { name: 'Pokaż całą teczkę', exact: true }).click();
    await page.getByRole('combobox', { name: 'Rodzaj węzła' }).selectOption('media');
    assert.equal(await page.locator('#node-list button').count(), 3);
    await page.locator('#node-list [data-node=image]').click();
    const image = page.locator('#node-details img');
    await image.waitFor();
    assert.equal(await image.getAttribute('alt'), 'Odbitka testowa');
    await page.waitForFunction(() => document.querySelector('#node-details img').naturalWidth > 0);
    assert.match(await page.locator('#node-details').innerText(), /Plik dostępny/);
    await page.locator('#node-list [data-node=audio]').click();
    assert.match(await page.locator('#node-details').innerText(), /Podgląd otwarcia/);
    assert.equal(await page.locator('audio').evaluate(audio => audio.autoplay), false);
    await page.locator('audio').focus(); await page.keyboard.press('Space');
    await page.waitForFunction(() => !document.querySelector('audio').paused, null, { timeout: 3000 });
    await page.locator('#node-list [data-node=missing]').click();
    assert.equal(await page.locator('audio').count(), 0);
    assert.match(await page.locator('#node-details').innerText(), /Materiał niedostępny/);
    await page.getByRole('button', { name: 'Pokaż całą teczkę', exact: true }).click();
    await page.getByRole('searchbox').fill('Sekret');
    assert.equal(await page.locator('#node-list button').count(), 0);
    await page.locator('#show-secrets').check();
    assert.equal(await page.locator('#node-list button').count(), 1);
    await page.locator('#node-list button').click();
    assert.equal(await page.locator('#node-details').getAttribute('data-node'), 'secret');
    assert.match(await page.locator('#node-details').innerText(), /Pełny opis: Sekret rozmówczyni/);
    await page.locator('#show-secrets').uncheck();
    assert.equal(await page.locator('#node-list [data-node=secret]').count(), 0);
    assert.equal(await page.locator('#node-details').innerText().then(text => text.includes('Pełny opis: Sekret rozmówczyni')), false);
    await page.locator('#gaps summary').click();
    assert.match(await page.locator('#gaps').innerText(), /Nie przygotowano taśmy/);
    await page.getByRole('button', { name: 'Resetuj widok', exact: true }).click();
    assert.equal(await page.getByRole('searchbox').inputValue(), '');
    assert.equal(await page.locator('#show-secrets').isChecked(), false);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});


test('near-plane clipping stays finite at 250 percent after focusing and orbiting an extreme XYZ node', async () => {
  const files = fixture({ extreme: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.mapArcTrace = [];
      const fill = CanvasRenderingContext2D.prototype.fillRect;
      CanvasRenderingContext2D.prototype.fillRect = function(x, y, width, height) {
        if (x === 0 && y === 0) window.mapArcTrace = [];
        return fill.call(this, x, y, width, height);
      };
      const arc = CanvasRenderingContext2D.prototype.arc;
      CanvasRenderingContext2D.prototype.arc = function(x, y, radius, ...rest) {
        window.mapArcTrace.push({ x, y, radius });
        return arc.call(this, x, y, radius, ...rest);
      };
    });
    await page.goto(pathToFileURL(files.html).href);
    await page.locator('#node-list [data-node=corner]').click();
    await page.getByRole('button', { name: 'Wejdź w węzeł', exact: true }).click();
    for (let index = 0; index < 6; index++) await page.getByRole('button', { name: 'Przybliż', exact: true }).click();
    assert.equal(await page.locator('#zoom-value').innerText(), '250%');
    await page.locator('canvas').focus();
    for (let index = 0; index < 10; index++) await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const circles = await page.evaluate(() => window.mapArcTrace);
    assert.equal(circles.length, 3, 'Only selected node + its ring and the front neighbor should draw; rear node must be clipped');
    assert.ok(circles.every(circle => [circle.x, circle.y, circle.radius].every(Number.isFinite)));
    assert.equal(await page.locator('#node-list [data-node=behind]').count(), 1, 'Clipped source node must remain accessible in the list');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
