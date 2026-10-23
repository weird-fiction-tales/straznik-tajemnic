import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { renderPlayerOpening } from './player-opening-render.mjs';

const require = createRequire(new URL('../../_tester/_base/.silnik/package.json', import.meta.url));
const { chromium } = require('@playwright/test');

function previewFixture({ missingPhoto = false, missingReverseAudio = false, longOpening = false } = {}) {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'player-opening-browser-')));
  const assets = path.join(directory, 'assets');
  fs.mkdirSync(assets);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="960" height="540" fill="#334737"/><path d="M80 480V90h800v390M480 90v390M80 285h800" stroke="#b79c65" stroke-width="10"/><text x="480" y="240" text-anchor="middle" fill="#e8dfc8" font-family="serif" font-size="40">Neutralna ilustracja testowa</text></svg>';
  for (const name of ['portrait.svg', 'room.svg', 'photo.svg']) fs.writeFileSync(path.join(assets, name), svg);
  const samples = 16000 * 4;
  const wave = Buffer.alloc(44 + samples * 2);
  wave.write('RIFF', 0); wave.writeUInt32LE(wave.length - 8, 4);
  wave.write('WAVEfmt ', 8); wave.writeUInt32LE(16, 16);
  wave.writeUInt16LE(1, 20); wave.writeUInt16LE(1, 22);
  wave.writeUInt32LE(16000, 24); wave.writeUInt32LE(32000, 28);
  wave.writeUInt16LE(2, 32); wave.writeUInt16LE(16, 34);
  wave.write('data', 36); wave.writeUInt32LE(samples * 2, 40);
  for (const name of ['room.wav', 'photo.wav', 'reverse.wav']) fs.writeFileSync(path.join(assets, name), wave);
  const back = { id: 'back', label: 'Wróć do redakcji', target: 'room' };
  const routes = { id: 'routes', label: 'Wybierz kierunek śledztwa', target: 'routes' };
  const story = {
    title: 'Opowieść testowa', subtitle: 'Początek bez zapisów w aplikacji',
    role: { title: 'Warszawa · wieczór', name: 'Jan Testowy', occupation: 'Reporter', portrait: 'portrait.svg' },
    initial_scene: 'room',
    scenes: [
      { id: 'room', title: 'Redakcja', speaker: 'Prowadzący', image: 'room.svg', audio: 'room.wav',
        text: ['Deszcz stuka w okno. Na biurku leży koperta.',
          'Za drzwiami stukają maszyny do pisania. Kolejne wiadomości napływają do redakcji.',
          'Przy stole czeka rozmówczyni, która chce przedstawić ci nową sprawę i prosi o uwagę.',
          'Od kilku dni powtarzają się relacje z odległego miasta. Nikt jeszcze ich nie sprawdził.',
          'Możesz zacząć od fotografii albo od razu zdecydować, gdzie pojedziesz najpierw.'], choices: [
          { id: 'photo', label: 'Obejrzyj fotografię', target: 'photo', discover: 'photograph' }, routes,
        ] },
      { id: 'photo', title: 'Fotografia', speaker: 'Prowadzący', audio: 'photo.wav', text: ['Oglądasz odbitkę ruin.'],
        handout: { frontImage: missingPhoto ? null : 'photo.svg', caption: 'Fotografia z koperty',
          reverseText: 'Na odwrocie wskazano miejsce przechowywania dziennika.',
          reverseAudio: missingReverseAudio ? null : 'reverse.wav' }, choices: [back, routes] },
      { id: 'routes', title: 'Trzy drogi', speaker: 'Prowadzący', text: ['Każdy z tych tropów możesz sprawdzić jako pierwszy.'],
        choices: ['east', 'west', 'north'].map((direction) => ({
          id: direction, label: 'Wybierz: ' + direction, target: 'end-' + direction,
        })).concat(back) },
      ...['east', 'west', 'north'].map((direction) => ({
        id: 'end-' + direction, title: 'Kierunek: ' + direction, speaker: 'Prowadzący',
        text: ['Postanawiasz sprawdzić ten trop.'], choices: [back], end: true,
      })),
    ],
    journal_entries: [{ id: 'photograph', title: 'Fotografia ruin', text: 'Otrzymano fotografię. Na odwrocie jest adnotacja.' }],
    source: { secret: 'UNREVEALED_AUTHOR_RECORD' },
  };
  if (longOpening) {
    story.scenes[0].text = Array.from({ length: 40 }, (_, index) => 'Długi akapit redakcji ' + index + '. Deszcz stuka w okno, a rozmowa trwa.');
    story.scenes[1].text = Array.from({ length: 40 }, (_, index) => 'Długi akapit o fotografii ' + index + '. Oglądasz kolejne szczegóły.');
  }
  const html = path.join(directory, 'index.html');
  fs.writeFileSync(html, renderPlayerOpening({ story }));
  return { directory, html };
}

test('player enters with keyboard, hears only requested audio, flips a photo and keeps a unique journal', async () => {
  const fixture = previewFixture();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', request => requests.push(request.url()));
    await page.goto(pathToFileURL(fixture.html).href);
    assert.equal(await page.getByRole('button', { name: 'Rozpocznij opowieść' }).count(), 1);
    assert.equal(await page.locator('#stage').isVisible(), false);
    assert.equal(await page.locator('audio').getAttribute('src'), null);
    assert.equal(await page.locator('input, textarea, select').count(), 0);
    assert.equal(await page.locator('body').innerText().then(text => text.includes('UNREVEALED_AUTHOR_RECORD')), false);
    await page.screenshot({ path: path.join(fixture.directory, 'cover.png'), fullPage: true });
    await page.getByRole('button', { name: 'Rozpocznij opowieść' }).press('Enter');
    assert.equal(await page.locator('#stage').getAttribute('data-scene'), 'room');
    assert.equal(await page.locator('audio').evaluate(element => element.paused), true);
    assert.equal(await page.locator('audio').evaluate(element => element.autoplay), false);
    assert.match(await page.locator('#scene-copy').innerText(), /Deszcz stuka w okno/);
    const audioBounds = await page.locator('audio').boundingBox();
    assert.ok(audioBounds.y >= 0 && audioBounds.y + audioBounds.height <= 1000, 'Narration controls require scrolling');
    const firstParagraph = await page.locator('#scene-copy p').first().boundingBox();
    assert.ok(firstParagraph.y >= 0 && firstParagraph.y + firstParagraph.height <= 1000, 'Opening paragraph requires scrolling');
    assert.equal(await page.locator('#scene-image img').evaluate(image => image.complete && image.naturalWidth > 0), true);
    const controls = await page.getByRole('button').evaluateAll(buttons => buttons.filter(button => button.getClientRects().length).map(button => {
      const bounds = button.getBoundingClientRect(); return { label: button.textContent, width: bounds.width, height: bounds.height };
    }));
    assert.ok(controls.every(button => button.width >= 44 && button.height >= 44), JSON.stringify(controls));
    await page.locator('audio').focus();
    await page.keyboard.press('Space');
    await page.waitForFunction(() => !document.querySelector('audio').paused);
    await page.getByRole('button', { name: 'Obejrzyj fotografię', exact: true }).press('Enter');
    assert.equal(await page.locator('audio').evaluate(element => element.paused), true);
    assert.match(await page.locator('audio').getAttribute('src'), /photo.wav$/);
    assert.equal(await page.locator('#journal-list li').count(), 1);
    assert.equal(await page.locator('#handout img').getAttribute('alt'), 'Fotografia z koperty');
    assert.equal(await page.locator('#handout').innerText().then(text => text.includes('miejsce przechowywania dziennika')), false);
    await page.getByRole('button', { name: 'Odwróć fotografię', exact: true }).press('Enter');
    assert.match(await page.locator('#handout').innerText(), /miejsce przechowywania dziennika/);
    assert.match(await page.locator('audio').getAttribute('src'), /reverse.wav$/);
    assert.equal(await page.locator('audio').evaluate(element => element.paused), true);
    await page.screenshot({ path: path.join(fixture.directory, 'photo-reverse.png'), fullPage: true });
    await page.getByRole('button', { name: 'Pokaż przód fotografii', exact: true }).press('Enter');
    assert.match(await page.locator('audio').getAttribute('src'), /photo.wav$/);
    await page.getByRole('button', { name: 'Wróć do redakcji', exact: true }).click();
    await page.getByRole('button', { name: 'Obejrzyj fotografię', exact: true }).click();
    assert.equal(await page.locator('#journal-list li').count(), 1);
    await page.locator('#history summary').click();
    assert.match(await page.locator('#story-log').innerText(), /Obejrzyj fotografię/);
    assert.match(await page.locator('#story-log').innerText(), /Oglądasz odbitkę ruin/);
    assert.ok(await page.locator('#story-log').evaluate(element => element.getBoundingClientRect().height) <= 380);
    await page.getByRole('button', { name: 'Zacznij tę próbę od nowa', exact: true }).click();
    assert.equal(await page.locator('#cover').isVisible(), true);
    assert.equal(await page.locator('#journal-list li').count(), 0);
    assert.equal(await page.locator('#story-log li').count(), 0);
    assert.equal(await page.locator('audio').getAttribute('src'), null);
    assert.ok(requests.every(url => url.startsWith('file:')), requests.join('\n'));
    assert.deepEqual(errors, []);
    console.log('Player preview screenshots: ' + fixture.directory);
  } finally {
    await browser.close();
  }
});

test('all three departures work before collecting anything; missing photo and reverse audio stay explicit', async () => {
  const fixture = previewFixture({ missingPhoto: true, missingReverseAudio: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(fixture.html).href);
    for (const direction of ['east', 'west', 'north']) {
      await page.getByRole('button', { name: 'Rozpocznij opowieść' }).click();
      await page.getByRole('button', { name: 'Wybierz kierunek śledztwa', exact: true }).click();
      await page.getByRole('button', { name: 'Wybierz: ' + direction, exact: true }).click();
      assert.equal(await page.locator('#stage').getAttribute('data-scene'), 'end-' + direction);
      assert.equal(await page.locator('#journal-list li').count(), 0);
      await page.getByRole('button', { name: 'Zacznij tę próbę od nowa', exact: true }).click();
    }
    await page.getByRole('button', { name: 'Rozpocznij opowieść' }).click();
    await page.getByRole('button', { name: 'Obejrzyj fotografię', exact: true }).click();
    assert.match(await page.locator('#handout').innerText(), /Fotografia nie jest jeszcze gotowa/);
    assert.equal(await page.locator('#handout img').count(), 0);
    await page.getByRole('button', { name: 'Odwróć fotografię', exact: true }).click();
    assert.match(await page.locator('#audio-status').innerText(), /Nagranie odwrotu nie jest jeszcze gotowe/);
    assert.equal(await page.locator('audio').getAttribute('src'), null);
    assert.equal(await page.locator('audio').isVisible(), false);
    await page.getByRole('button', { name: 'Wróć do redakcji', exact: true }).click();
    assert.equal(await page.locator('#stage').getAttribute('data-scene'), 'room');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});


test('scene navigation returns the viewport to the new scene after a choice far below a long opening', async () => {
  const fixture = previewFixture({ longOpening: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(pathToFileURL(fixture.html).href);
    await page.getByRole('button', { name: 'Rozpocznij opowieść' }).click();
    const choice = page.getByRole('button', { name: 'Obejrzyj fotografię', exact: true });
    await choice.scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(() => window.scrollY) > 1000);
    await choice.click();
    assert.equal(await page.locator('#stage').getAttribute('data-scene'), 'photo');
    const bounds = await page.locator('#stage').boundingBox();
    assert.ok(bounds.y >= -1 && bounds.y < 100, 'New scene begins outside viewport at ' + bounds.y);
    const heading = await page.locator('#scene-title').boundingBox();
    assert.ok(heading.y >= 0 && heading.y < 200);
  } finally {
    await browser.close();
  }
});
