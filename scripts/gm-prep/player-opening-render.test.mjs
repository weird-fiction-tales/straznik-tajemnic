import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const moduleUrl = new URL('./player-opening-render.mjs', import.meta.url);
const { renderPlayerOpening } = existsSync(moduleUrl) ? await import(moduleUrl) : {};
const require = createRequire(new URL('../../_tester/_base/.silnik/package.json', import.meta.url));
const { JSDOM } = require('jsdom');

const fixture = () => ({
  title: 'Cień nad miastem',
  role: { title: 'Twoja postać', name: 'Jan Testowy', occupation: 'Reporter', portrait: 'jan.svg' },
  initial_scene: 'room',
  scenes: [
    { id: 'room', title: 'Redakcja', speaker: 'Prowadzący', text: ['Deszcz stuka w okno.'], image: 'room.svg', choices: [
      { id: 'photo', label: 'Przyglądam się fotografii', target: 'photo', discover: 'photo-clue' },
      { id: 'depart', label: 'Wychodzę na dworzec', target: 'depart' },
    ] },
    { id: 'photo', title: 'Fotografia', speaker: 'Helena', text: ['Spójrz na podpis.'], handout: {
      frontImage: 'photo.svg', caption: 'Fotografia z koperty', reverseText: 'Elbląg, przed tygodniem.',
    }, choices: [{ id: 'back', label: 'Wracam do rozmowy', target: 'room' }] },
    { id: 'depart', title: 'Przed redakcją', speaker: 'Prowadzący', text: ['Ruszacie w drogę.'], end: true, choices: [] },
  ],
  journal_entries: [{ id: 'photo-clue', title: 'Podpis na zdjęciu', text: 'Na odwrocie ktoś dopisał datę.' }],
  source: { private: 'PRIVATE_AUTHOR_SECRET' },
});

test('renderer is standalone, Polish and includes only player story fields', () => {
  assert.equal(typeof renderPlayerOpening, 'function');
  const html = renderPlayerOpening({ story: fixture(), mediaBase: 'assets/' });
  assert.match(html, /<html lang="pl"/);
  assert.match(html, /Próba początku/);
  assert.ok(!html.includes('PRIVATE_AUTHOR_SECRET'));
  assert.ok(!/<script[^>]+src=/.test(html));
  assert.ok(!/fetch\(|localStorage|sessionStorage|https?:\/\/|@import/.test(html));
  const dom = new JSDOM(html);
  assert.equal(dom.window.document.querySelectorAll('input, textarea, select').length, 0);
  assert.equal(dom.window.document.querySelector('audio[autoplay]'), null);
  dom.window.close();
});

test('author text cannot inject HTML or terminate embedded JSON scripts', () => {
  const story = fixture();
  story.title = '<img src=x onerror=alert(1)>';
  story.scenes[0].text = ['</script><script>throw Error("injected")</script>'];
  const dom = new JSDOM(renderPlayerOpening({ story }), { runScripts: 'dangerously' });
  assert.equal(dom.window.document.querySelector('img[onerror]'), null);
  const start = dom.window.document.querySelector('[data-action="start"]');
  start.click();
  assert.equal(dom.window.document.querySelector('#scene-copy').textContent.includes(story.scenes[0].text[0]), true);
  dom.window.close();
});

test('relative local assets are required and invalid scene links fail before rendering', () => {
  const story = fixture();
  assert.throws(() => renderPlayerOpening({ story, mediaBase: 'https://remote.invalid/' }), /local|relative|lokal/i);
  story.scenes[0].image = 'https://remote.invalid/room.jpg';
  assert.throws(() => renderPlayerOpening({ story }), /local|relative|lokal/i);
  const broken = fixture();
  broken.scenes[0].choices[0].target = 'absent';
  assert.throws(() => renderPlayerOpening({ story: broken }), /target|scene|scen/i);
});

test('missing photograph is disclosed and its reverse remains readable', () => {
  const story = fixture();
  story.scenes[1].handout.frontImage = null;
  const dom = new JSDOM(renderPlayerOpening({ story }), { runScripts: 'dangerously' });
  const document = dom.window.document;
  document.querySelector('[data-action="start"]').click();
  document.querySelector('[data-choice="photo"]').click();
  assert.match(document.querySelector('#handout').textContent, /fotografia.*nie jest.*gotowa/i);
  assert.equal(document.querySelector('#handout img'), null);
  document.querySelector('[data-action="flip"]').click();
  assert.match(document.querySelector('#handout').textContent, /Elbląg, przed tygodniem/);
  dom.window.close();
});

test('journal deduplicates discoveries and restart clears only this preview', () => {
  const dom = new JSDOM(renderPlayerOpening({ story: fixture() }), { runScripts: 'dangerously' });
  const document = dom.window.document;
  document.querySelector('[data-action="start"]').click();
  for (let repeat = 0; repeat < 2; repeat++) {
    document.querySelector('[data-choice="photo"]').click();
    document.querySelector('[data-choice="back"]').click();
  }
  assert.equal(document.querySelectorAll('#journal-list li').length, 1);
  assert.equal(document.querySelectorAll('#story-log [data-kind="choice"]').length, 4);
  document.querySelector('[data-action="restart"]').click();
  assert.equal(document.querySelectorAll('#journal-list li').length, 0);
  assert.equal(document.querySelectorAll('#story-log li').length, 0);
  assert.equal(document.querySelector('[data-action="start"]').hidden, false);
  dom.window.close();
});

test('photograph flip switches to its matching audio and never reuses front narration for the reverse', () => {
  const story = fixture();
  story.scenes[1].audio = 'photo-front.mp3';
  story.scenes[1].handout.reverseAudio = 'photo-reverse.mp3';
  const dom = new JSDOM(renderPlayerOpening({ story }), { runScripts: 'dangerously' });
  const document = dom.window.document;
  const audio = document.querySelector('audio');
  audio.pause = () => {};
  audio.load = () => {};
  document.querySelector('[data-action="start"]').click();
  document.querySelector('[data-choice="photo"]').click();
  assert.equal(audio.getAttribute('src'), 'assets/photo-front.mp3');
  document.querySelector('[data-action="flip"]').click();
  assert.equal(audio.getAttribute('src'), 'assets/photo-reverse.mp3');
  assert.equal(audio.autoplay, false);
  document.querySelector('[data-action="flip"]').click();
  assert.equal(audio.getAttribute('src'), 'assets/photo-front.mp3');
  dom.window.close();

  delete story.scenes[1].handout.reverseAudio;
  const missing = new JSDOM(renderPlayerOpening({ story }), { runScripts: 'dangerously' });
  const missingDocument = missing.window.document;
  missingDocument.querySelector('audio').pause = () => {};
  missingDocument.querySelector('audio').load = () => {};
  missingDocument.querySelector('[data-action="start"]').click();
  missingDocument.querySelector('[data-choice="photo"]').click();
  missingDocument.querySelector('[data-action="flip"]').click();
  assert.equal(missingDocument.querySelector('audio').hasAttribute('src'), false);
  assert.equal(missingDocument.querySelector('audio').hidden, true);
  assert.match(missingDocument.querySelector('#audio-status').textContent, /nagranie.*odwrotu.*nie jest.*gotowe/i);
  missing.window.close();
});

test('non-string player fields reject nested private objects before serialization', () => {
  const fields = [
    ['title'], ['subtitle'], ['initial_scene'],
    ['role', 'title'], ['role', 'name'], ['role', 'occupation'], ['role', 'description'],
    ['scenes', 0, 'id'], ['scenes', 0, 'title'], ['scenes', 0, 'speaker'], ['scenes', 0, 'text', 0],
    ['scenes', 0, 'choices', 0, 'id'], ['scenes', 0, 'choices', 0, 'label'],
    ['scenes', 0, 'choices', 0, 'target'], ['scenes', 0, 'choices', 0, 'discover'],
    ['scenes', 1, 'handout', 'caption'], ['scenes', 1, 'handout', 'reverseText'],
    ['journal_entries', 0, 'id'], ['journal_entries', 0, 'title'], ['journal_entries', 0, 'text'],
  ];
  for (const keys of fields) {
    const story = fixture();
    let target = story;
    for (const key of keys.slice(0, -1)) target = target[key];
    target[keys.at(-1)] = { player: 'Visible text', private: 'SENTINEL_PRIVATE_NESTED' };
    assert.throws(() => renderPlayerOpening({ story }), /string|text|tekst/i, keys.join('.'));
  }
});
