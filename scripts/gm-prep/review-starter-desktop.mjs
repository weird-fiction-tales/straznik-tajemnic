// Checks the delivered content and opening screen only. Never starts a game.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(root, '_tester/_base/.silnik/package.json'));
const { chromium } = require('playwright');
const origin = process.argv[2] || 'http://127.0.0.1:4165';
assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/);
const output = path.join(root, '.local-playtest/starter-desktop');
const browser = await chromium.launch({ headless: true });
const report = [];
try {
  for (const locale of ['pl', 'en']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors = [], forbidden = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await context.route('**/api/**', async (route) => {
      if (/\/api\/(?:chat(?:\/|$)|tts(?:\/|$)|adventure\/setup|ai\/|imagen|vertex-imagen|replicate-image|flux-kontext)/.test(route.request().url())) {
        forbidden.push(route.request().url().split('?')[0]);
        await route.abort();
      } else await route.continue();
    });
    const response = await page.goto(`${origin}/starter-dossier/${locale}/index.html`);
    assert.equal(response.status(), 200);
    assert.equal(await page.locator('html').getAttribute('lang'), locale);
    for (const [id, count] of [['handout-card', 14], ['scene-card', 14], ['actor-card', 8], ['audio-card', 10]]) assert.equal(await page.getByTestId(id).count(), count);
    await page.locator('img').evaluateAll((images) => Promise.all(images.map((img) => img.decode())));
    await page.locator('header').screenshot({ path: path.join(output, `desktop-dossier-${locale}.png`) });
    await page.locator('#clue-02-boston-globe-1918').screenshot({ path: path.join(output, `desktop-handout-${locale}.png`) });
    assert.equal(await page.getByTestId('open-application').getAttribute('href'), '/' + locale);
    await page.getByTestId('open-application').click();
    await page.waitForLoadState('domcontentloaded');
    await page.locator('body').filter({ hasText: /STRAŻNIK TAJEMNIC|KEEPER|Strażnik Tajemnic/ }).waitFor();
    assert.ok(!(await page.locator('body').innerText()).includes('MISSING_MESSAGE'));
    await page.screenshot({ path: path.join(output, `desktop-opening-${locale}.png`) });
    assert.deepEqual(forbidden, []);
    assert.deepEqual(errors, []);
    report.push({ locale, handouts: 14, scenes: 14, actors: 8, audioBriefs: 10, applicationOpened: true, consoleErrors: errors, generationRequests: forbidden });
    await context.close();
  }
} finally { await browser.close(); }
fs.writeFileSync(path.join(output, 'desktop-render-report.json'), JSON.stringify({ origin, gameStarted: false, report }, null, 2) + '\n');
console.log(JSON.stringify({ gameStarted: false, report }));
