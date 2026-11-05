import { test, expect, type Page } from '@playwright/test';
import { getStrefa11CharactersForAdventure } from '../../src/lib/immersion/strefa-11-characters';
import { buildPredefinedEquipment } from '../../src/lib/immersion/predefined-equipment';
import { appendJournalToParty } from '../../src/lib/journal/apply-journal-tags';
import type { Character, ChronicleSession, Message } from '../../src/lib/types';

const adventureId = 'cien-nad-prabutami';
const portrait = '/adventure-packs/cien-nad-prabutami/npc-helena-krawczyk.png';
const place = "Redakcja 'Sygnałów Nieznanego' (RTV Warszawa)";

function acceptedFixture(locale: 'pl' | 'en', legacyInventory = false) {
  const preset = getStrefa11CharactersForAdventure(adventureId).find(
    (character) => character.id === 'strefa11_tomasz_nowicki'
  )!;
  const scope: ChronicleSession = {
    playthroughId: 'player-fixes-run', campaignDefinitionId: `scenario:${adventureId}`,
    adventureId, adventureTitle: 'Cień nad Prabutami', sessionId: 'player-fixes-session', sessionNumber: 1,
  };
  const binding = { adventureId, editionFingerprint: `sha256:${'a'.repeat(64)}` };
  const quote = locale === 'pl'
    ? 'Przeczytaj raport dr. Skrzyńskiego. Potem porozmawiamy o dowodach.'
    : 'Read Dr. Skrzynski’s report. Then we can discuss the evidence.';
  const before = locale === 'pl' ? 'Helena odsuwa teczkę.' : 'Helena sets the folder aside.';
  const after = locale === 'pl' ? 'Za oknem pada deszcz.' : 'Rain falls outside.';
  const content = `${before} @Helena: „${quote}” ${after}\n` +
    `[LOKACJA:${place}:${before}]` +
    `[JOURNAL:npc:Helena Krawczyk|witness:Helena Krawczyk|source_quote:${quote}]${quote}[/JOURNAL]` +
    `[JOURNAL:event:${locale === 'pl' ? 'Początek śledztwa' : 'Beginning of the investigation'}]${before}[/JOURNAL]`;
  const equipment = buildPredefinedEquipment(preset, 'prl-1970s');
  if (legacyInventory) equipment.push({
    id: 'eq_strefa11-tomasz-nowicki_latarka-elektryczna', name: 'Latarka elektryczna',
    category: 'tool', source: 'starting', imageUrl: '/equipment/catalog/police-flashlight-prl.webp',
  });
  const character: Character = {
    ...preset, isActive: true, equipment, journal: [], sceneCards: [], chronicleSession: scope,
    investigatorDossier: { clues: [], npcs: [], locations: [], notes: [] },
    activeScene: { sceneNumber: 1, location: place, startedAt: new Date().toISOString(),
      people: ['Helena Krawczyk'], findings: [], notes: [], chronicleChapter: scope, dossierBinding: binding },
  };
  character.sceneCards = [{ id: 'earlier-newsroom', sceneNumber: 1, title: locale === 'pl' ? 'Rozmowa w redakcji' : 'At the newsroom', location: place, timestamp: '2026-11-01T12:00:00Z', isSealed: true, people: ['Helena Krawczyk'], findings: [], keyTakeaways: [], dossierBinding: binding, chronicleChapter: scope, chronicleSummaryByLocale: { pl: 'Helena poprosiła o przeczytanie raportu.', en: 'Helena asked us to read the report.' } }];
  const publication = appendJournalToParty([character], character, content, 'accepted-opening', undefined, [], { scope, binding });
  const messages: Message[] = [{ id: 'accepted-opening', role: 'assistant', content, timestamp: new Date() }];
  return { character: publication.characters[0], messages, scope, binding, quote, before, after, locale,
    context: { id: adventureId, title: 'Cień nad Prabutami', location: place,
      era: 'prl', eraLabel: 'PRL', yearRange: '1973', country: 'Polska',
      graph: { nodes: [], edges: [], clues: [], npcs: [{ id: 'npc-helena-krawczyk', name: 'Helena Krawczyk', avatarUrl: portrait }] } },
  };
}

async function seed(page: Page, locale: 'pl' | 'en', legacyInventory = false) {
  const fixture = acceptedFixture(locale, legacyInventory);
  await page.addInitScript((data) => {
    if (localStorage.getItem('player-fixes-seeded')) return;
    for (const key of ['onboarding_completed', 'rules_onboarding_completed', 'session_zero_completed', 'straznik_beta_welcome_dismissed', 'has_started_game']) localStorage.setItem(key, 'true');
    localStorage.setItem('health_check_last_run', String(Date.now()));
    localStorage.setItem('language_selected', data.locale);
    localStorage.setItem('characters', JSON.stringify([data.character]));
    localStorage.setItem('zew_chat_messages', JSON.stringify(data.messages));
    localStorage.setItem('adventure_context', JSON.stringify(data.context));
    localStorage.setItem('gm_npcs', JSON.stringify(data.context.graph.npcs));
    localStorage.setItem('zew-campaign-memory-scope', JSON.stringify({ ...data.scope, schemaVersion: 1, kind: 'scenario' }));
    localStorage.setItem('ai_settings', JSON.stringify({ qualityPreset: 'high', geminiEnabled: true,
      voiceSettings: { enabled: false, provider: 'gemini', speed: 1, voiceId: 'Charon' }, imageGenerationEnabled: false }));
    localStorage.setItem('zew-app-api-keys', JSON.stringify({ GEMINI_API_KEY: 'e2e-local-key' }));
    localStorage.setItem('pdf_memory', JSON.stringify({ rulesUrl: '/data/rag/rules.json', adventureId: data.binding.adventureId,
      adventureDossierFingerprint: data.binding.editionFingerprint, adventureDossierStatus: 'ready' }));
    localStorage.setItem('player-fixes-seeded', 'true');
  }, JSON.parse(JSON.stringify(fixture)));
  await page.route(/https:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\//, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><title>Background media test fixture</title></html>' }));
  await page.route('**/api/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, recordCount: 1, hasBaseRules: true }) }));
  return fixture;
}

for (const locale of ['pl', 'en'] as const) {
  test(`known profiles, complete dialogue and navigation (${locale})`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400) console.log('FAILED_RESOURCE', response.status(), response.url()); });
    const fixture = await seed(page, locale);
    await page.goto(`/${locale}`);
    const dialogue = page.getByTestId('npc-dialogue');
    await expect(dialogue).toHaveCount(1);
    await expect(dialogue).toContainText(fixture.quote);
    await expect(dialogue.locator('img')).toHaveAttribute('src', portrait);
    await expect(page.locator('.narrative-content')).toContainText(fixture.before);
    await expect(page.locator('.narrative-content')).toContainText(fixture.after);
    await page.screenshot({ path: `test-results/player-fixes/dialogue-${locale}.png` });

    await page.getByTestId('btn-open-journal').click();
    await expect(page.getByTestId('journal-chronicle')).toContainText(locale === 'pl' ? 'Helena poprosiła o przeczytanie raportu.' : 'Helena asked us to read the report.');
    await page.screenshot({ path: `test-results/player-fixes/chronicle-${locale}.png` });
    await expect(page.getByTestId('journal-current-scene')).toContainText(locale === 'pl' ? 'W toku' : 'In progress');
    const personCard = page.getByRole('button', { name: `${locale === 'pl' ? 'Otwórz' : 'Open'}: Helena Krawczyk`, exact: true });
    await expect(personCard).toBeVisible();
    await personCard.click();
    const detail = page.getByTestId('journal-card-detail');
    await expect(detail.getByTestId('journal-public-profile')).toBeVisible();
    await expect(detail.getByTestId('journal-public-profile')).toContainText(locale === 'pl'
      ? 'Redaktorka programu „Sygnały Nieznanego” w Telewizji Polskiej.'
      : 'Editor of the Polish Television programme “Signals of the Unknown”.');
    await expect(detail.getByRole('button', { name: `${locale === 'pl' ? 'Zobacz rozmowę' : 'View conversation'}: Helena Krawczyk`, exact: true })).toHaveCount(1);
    await expect(detail).toContainText(fixture.quote);
    await expect(detail).not.toContainText(/Materiał źródłowy|Przebieg sceny|Źródła/);
    const portraitBox = await detail.locator('[data-art-layout=portrait]').boundingBox();
    expect(portraitBox!.width).toBeLessThanOrEqual(240);
    expect(portraitBox!.height).toBeGreaterThan(portraitBox!.width);
    await expect.poll(() => detail.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await expect(detail.locator('img')).toHaveAttribute('src', portrait);
    await expect(detail).not.toContainText(/PRIVATE_|keeperSecret|authoredPortrayal/);
    const heading = page.getByRole('dialog').getByRole('heading', { level: 2 });
    await expect(heading).toBeInViewport();
    await page.screenshot({ path: `test-results/player-fixes/journal-profile-${locale}.png` });
    await detail.getByTestId('journal-source-link').first().click();
    await expect(page.getByTestId('journal-source')).toContainText(fixture.quote);
    await page.getByRole('button', { name: locale === 'pl' ? 'Wróć' : 'Back', exact: true }).click();
    await expect(detail).toBeVisible();
    await page.getByRole('button', { name: locale === 'pl' ? 'Wróć' : 'Back', exact: true }).click();
    await expect(page.getByTestId('journal-current-scene')).toBeVisible();

    await page.getByTestId('journal-contents').getByRole('button', { name: locale === 'pl' ? /^Wydarzenia/ : /^Events/ }).click();
    await page.getByRole('button', { name: `${locale === 'pl' ? 'Otwórz: Początek śledztwa' : 'Open: Beginning of the investigation'}`, exact: true }).click();
    await expect(page.getByTestId('journal-card-detail').getByTestId('journal-card-art')).toHaveCount(0);
    await expect(page.getByTestId('journal-card-detail').getByTestId('journal-card-symbol')).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByRole('dialog').getByRole('heading', { level: 2 })).toBeInViewport();
    await page.screenshot({ path: `test-results/player-fixes/journal-event-narrow-${locale}.png` });
    await page.getByTestId('journal-contents').getByRole('button', { name: locale === 'pl' ? /^Postacie/ : /^People/ }).click();
    const gallery = page.getByTestId('journal-gallery');
    await expect(gallery.getByRole('button', { name: `${locale === 'pl' ? 'Otwórz' : 'Open'}: Helena Krawczyk`, exact: true })).toBeVisible();
    expect(await gallery.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await expect.poll(() => gallery.getByRole('img', { name: 'Helena Krawczyk' }).evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await expect(gallery.getByRole('img', { name: 'Helena Krawczyk' })).toHaveCSS('opacity', '1');
    await page.screenshot({ path: `test-results/player-fixes/journal-people-narrow-${locale}.png` });
    await page.reload();
    await page.getByTestId('btn-open-journal').click();
    await expect(page.getByRole('button', { name: `${locale === 'pl' ? 'Otwórz' : 'Open'}: Helena Krawczyk`, exact: true })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('MISSING_MESSAGE');
    expect(errors).toEqual([]);
  });

  test(`new inventory and existing saved instances (${locale})`, async ({ browser }) => {
    for (const legacy of [false, true]) {
      const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      await seed(page, locale, legacy);
      await page.goto(`/${locale}`);
      await page.getByTestId('btn-open-equipment').click();
      const modal = page.getByTestId('equipment-modal');
      await expect(modal).toBeVisible();
      await modal.getByTestId('equipment-tab-gear').click();
      await expect(modal.getByTestId('equipment-tab-gear')).toContainText(`(${legacy ? 6 : 5})`);
      const equipmentIds = await page.evaluate(() => JSON.parse(localStorage.getItem('characters')!)[0].equipment.map((item: { id: string }) => item.id));
      expect(equipmentIds).toContain('eq_tom_latarka');
      expect(equipmentIds.includes('eq_strefa11-tomasz-nowicki_latarka-elektryczna')).toBe(legacy);
      await expect(modal.locator('img')).toHaveCount(legacy ? 6 : 5);
      await expect.poll(() => modal.locator('img').evaluateAll((images) => images.every((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0))).toBe(true);
      await page.screenshot({ path: `test-results/player-fixes/equipment-${locale}-${legacy ? 'saved' : 'new'}.png` });
      await page.reload();
      await page.getByTestId('btn-open-equipment').click();
      await expect(page.getByTestId('equipment-modal').getByTestId('equipment-tab-gear')).toContainText(`(${legacy ? 6 : 5})`);
      await expect(page.locator('body')).not.toContainText('MISSING_MESSAGE');
      expect(errors).toEqual([]);
      await context.close();
    }
  });
}
