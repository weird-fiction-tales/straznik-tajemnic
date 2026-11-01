import { test, expect, type Page } from '@playwright/test';
import { appendJournalToParty } from '../../src/lib/journal/apply-journal-tags';
import { defaultAISettings } from '../../src/lib/ai-settings/defaults';
import { restorePublicJournalScope } from '../../src/lib/journal/public-journal';
import type { Character, ChronicleSession } from '../../src/lib/types';
import type { CampaignMemoryScope } from '../../src/core/memory/types';

function fixture(locale: 'pl' | 'en') {
  const adventureId = locale === 'pl' ? 'cien-nad-prabutami' : 'englewood-murder-castle-1893';
  const speaker = locale === 'pl' ? 'Helena Krawczyk' : 'Inspector John Shea';
  const npcId = locale === 'pl' ? 'npc-helena-krawczyk' : 'npc-inspector-shea';
  const portrait = `/adventure-packs/${adventureId}/${npcId}.png`;
  const equipmentIds = locale === 'pl'
    ? ['eq_tom_latarka', 'eq_strefa11-tomasz-nowicki_latarka-elektryczna']
    : ['roundtrip-old-lantern-one', 'roundtrip-old-lantern-two'];
  const scope: ChronicleSession = {
    playthroughId: `save-roundtrip-${locale}-${Date.now()}`,
    campaignDefinitionId: `scenario:${adventureId}`, adventureId,
    adventureTitle: 'Neutral save roundtrip', sessionId: `roundtrip-session-${locale}`, sessionNumber: 1,
  };
  const quote = locale === 'pl' ? 'Przeczytaj raport dr. Nowaka. Porozmawiamy później.' : 'Read Dr. Smith’s report. We will speak later.';
  const location = locale === 'pl' ? 'loc-warszawa-redakcja' : 'loc-chicago-precinct';
  const content = `${speaker}: „${quote}”\n[LOKACJA:${location}]` +
    `[JOURNAL:npc:${speaker}|witness:${speaker}|source_quote:${quote}]${quote}[/JOURNAL]`;
  const pc: Character = {
    id: `roundtrip-investigator-${locale}`, name: locale === 'pl' ? 'Badacz Testowy' : 'Test Investigator',
    str: 50, dex: 60, con: 65, app: 55, pow: 65, edu: 70, siz: 60, int: 70,
    luck: 54, hp: 11, san: 65, mp: 12, skills: { 'Spostrzegawczość': 60 },
    occupation: 'Investigator', age: 40, background: 'Neutral synthetic test investigator.',
    playerName: '', isActive: true, lastUsed: new Date(), notes: '', era: locale === 'pl' ? 'prl-1970s' : 'gaslight',
    experience: { totalXP: 0, availableXP: 0, earnedThisSession: 0, maxEarnedThisSession: 0 }, developmentHistory: [],
    equipment: locale === 'pl' ? [
      { id: equipmentIds[0], name: 'Mocna latarka policyjna', category: 'tool', source: 'starting', imageUrl: '/equipment/catalog/police-flashlight-prl.webp' },
      { id: equipmentIds[1], name: 'Latarka elektryczna', category: 'tool', source: 'starting', imageUrl: '/equipment/catalog/police-flashlight-prl.webp' },
    ] : equipmentIds.map((id, index) => ({ id, name: index === 0 ? 'Lampa naftowa' : 'Latarnia oliwna', category: 'tool', source: 'starting', imageUrl: '/equipment/catalog/oil-lantern-1890s.webp' })),
    journal: [], sceneCards: [], chronicleSession: scope,
    investigatorDossier: { clues: [], npcs: [], locations: [], notes: [] },
    activeScene: { sceneNumber: 1, location, startedAt: new Date().toISOString(), people: [speaker], findings: [], notes: [], chronicleChapter: scope },
  };
  const published = appendJournalToParty([pc], pc, content, `roundtrip-message-${locale}`, undefined, [], { scope });
  return {
    scope, quote, locale, speaker, portrait, equipmentIds, character: published.characters[0],
    messages: [{ id: `roundtrip-message-${locale}`, role: 'assistant', content, timestamp: new Date() }],
    context: { id: adventureId, title: 'Neutral save roundtrip', location, era: locale === 'pl' ? 'prl' : 'gaslight', eraLabel: locale === 'pl' ? 'PRL' : 'Gaslight', yearRange: locale === 'pl' ? '1973' : '1893', country: locale === 'pl' ? 'Polska' : 'USA',
      graph: { nodes: [], clues: [], connections: [], npcs: [{ id: npcId, name: speaker, description: 'Public acquaintance.' }] } },
    settings: { ...defaultAISettings, qualityPreset: 'high', voiceSettings: { ...defaultAISettings.voiceSettings, enabled: false }, imageGenerationEnabled: false },
  };
}

async function seed(page: Page, locale: 'pl' | 'en') {
  const data = fixture(locale);
  // Register the synthetic accepted history through the real legacy restore
  // boundary. The save endpoint correctly rejects browser-only conversation.
  const memoryResponse = await page.request.post('/api/memory/restore', {
    data: {
      requestId: `roundtrip-seed-${locale}-${Date.now()}`,
      scope: { ...data.scope, schemaVersion: 1, kind: 'scenario' },
      messages: data.messages, characters: [data.character], activeCharacterId: data.character.id,
    },
  });
  expect(memoryResponse.status()).toBe(200);
  const memory = await memoryResponse.json() as { scope: CampaignMemoryScope };
  data.character = restorePublicJournalScope([data.character], data.scope, memory.scope)[0];
  data.scope = { ...data.scope, ...memory.scope };
  await page.addInitScript((input) => {
    if (localStorage.getItem('save-roundtrip-seeded')) return;
    for (const key of ['onboarding_completed', 'rules_onboarding_completed', 'session_zero_completed', 'straznik_beta_welcome_dismissed', 'has_started_game']) localStorage.setItem(key, 'true');
    localStorage.setItem('health_check_last_run', String(Date.now()));
    localStorage.setItem('language_selected', input.locale);
    localStorage.setItem('characters', JSON.stringify([input.character]));
    localStorage.setItem('zew_chat_messages', JSON.stringify(input.messages));
    localStorage.setItem('adventure_context', JSON.stringify(input.context));
    localStorage.setItem('gm_npcs', JSON.stringify(input.context.graph.npcs));
    localStorage.setItem('zew-campaign-memory-scope', JSON.stringify({ ...input.scope, schemaVersion: 1, kind: 'scenario' }));
    localStorage.setItem('ai_settings', JSON.stringify(input.settings));
    localStorage.setItem('zew-app-api-keys', JSON.stringify({ GEMINI_API_KEY: 'e2e-local-key' }));
    // Legacy public history has an adventure identity, but no dossier edition or handout binding.
    localStorage.setItem('pdf_memory', JSON.stringify({ rulesUrl: '/data/rag/rules.json', adventureId: input.context.id }));
    localStorage.setItem('save-roundtrip-seeded', 'true');
  }, JSON.parse(JSON.stringify(data)));
  await page.route(/https:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\//, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><title>Background media test fixture</title></html>' }));
  await page.route('**/api/**', (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.startsWith('/api/game-save') || pathname === '/api/memory/restore') return route.continue();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, recordCount: 1, hasBaseRules: true }) });
  });
  return data;
}

async function readState(page: Page) {
  return page.evaluate(() => {
    const pc = JSON.parse(localStorage.getItem('characters')!)[0] as Character;
    return { id: pc.id, hp: pc.hp, san: pc.san, luck: pc.luck, equipmentIds: pc.equipment?.map(item => item.id) };
  });
}

for (const locale of ['pl', 'en'] as const) {
  test(`real UI save, load and reload preserve public history and legacy instances (${locale})`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    const requests: Array<{ method: string; path: string; status: number }> = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => {
      const path = new URL(response.url()).pathname;
      if (path.startsWith('/api/game-save') || path === '/api/memory/restore') requests.push({ method: response.request().method(), path, status: response.status() });
    });
    const data = await seed(page, locale);
    await page.goto(`/${locale}`);
    await expect(page.getByTestId('npc-dialogue')).toContainText(data.quote);
    const expected = { id: data.character.id, hp: 11, san: 65, luck: 54, equipmentIds: data.equipmentIds };
    expect(await readState(page)).toEqual(expected);

    await page.getByTitle(locale === 'pl' ? 'Zapisz grę' : 'Save game', { exact: true }).click();
    const saveTitle = locale === 'pl' ? 'Zapisz grę' : 'Save Game';
    const saveModal = page.getByRole('heading', { name: saveTitle, exact: true }).locator('xpath=../../..');
    const saveName = `Neutral roundtrip ${locale} ${Date.now()}`;
    await saveModal.locator('input[type="text"]').fill(saveName);
    const savedResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/game-save' && response.request().method() === 'POST');
    await saveModal.getByRole('button', { name: saveTitle, exact: true }).click();
    const saved = await savedResponse;
    expect(saved.status()).toBe(200);
    const savedResult = await saved.json() as { success: boolean; saveId: string };
    expect(savedResult.success).toBe(true);
    await expect(page.getByRole('heading', { name: saveTitle, exact: true })).toBeHidden();
    const storedResponse = await page.request.get(`/api/game-save?saveId=${savedResult.saveId}&userId=local`);
    expect(storedResponse.status()).toBe(200);
    const stored = await storedResponse.json();
    expect(stored.save.characters[0]).toMatchObject({ id: data.character.id, hp: 11, san: 65, luck: 54 });
    expect(stored.save.characters[0].equipment.map((item: { id: string }) => item.id)).toEqual(data.equipmentIds);
    expect(stored.save.pdfMemory.adventureDossierFingerprint).toBeUndefined();
    expect(stored.save.messages[0].content).toContain(data.quote);

    // Change only synthetic browser state to prove that loading restores the disk save.
    await page.evaluate(() => {
      const characters = JSON.parse(localStorage.getItem('characters')!) as Character[];
      characters[0].hp = 3; characters[0].journal = []; characters[0].equipment = [];
      localStorage.setItem('characters', JSON.stringify(characters));
      localStorage.setItem('zew_chat_messages', JSON.stringify([{ id: 'temporary-change', role: 'assistant', content: 'Temporary synthetic state.', timestamp: new Date().toISOString() }]));
    });
    await page.reload();
    expect((await readState(page)).hp).toBe(3);
    await page.getByTitle(locale === 'pl' ? 'Wczytaj zapisaną sesję' : 'Load a saved session', { exact: true }).click();
    const loadTitle = locale === 'pl' ? 'Wczytaj grę' : 'Load Game';
    const loadModal = page.getByRole('heading', { name: loadTitle, exact: true }).locator('xpath=../../..');
    const row = loadModal.getByRole('heading', { name: saveName, exact: true }).locator('xpath=../../../..');
    const restoredResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/memory/restore' && response.request().method() === 'POST');
    await row.getByRole('button', { name: locale === 'pl' ? 'Wczytaj' : 'Load', exact: true }).click();
    const restored = await restoredResponse;
    expect(restored.status()).toBe(200);
    const restoreResult = await restored.json();
    expect(restoreResult.scope.adventureId).toBe(data.context.id);
    expect(restoreResult.scope.playthroughId).not.toBe(data.scope.playthroughId);
    await expect(page.getByRole('heading', { name: loadTitle, exact: true })).toBeHidden();
    await expect.poll(() => readState(page)).toEqual(expected);
    await page.reload();
    await expect(page.getByTestId('npc-dialogue')).toContainText(data.quote);
    expect(await readState(page)).toEqual(expected);
    await page.getByTestId('btn-open-journal').click();
    await page.getByRole('button', { name: `${locale === 'pl' ? 'Otwórz' : 'Open'}: ${data.speaker}`, exact: true }).click();
    const detail = page.getByTestId('journal-card-detail');
    await expect(detail).toContainText(data.quote);
    await expect(detail.getByTestId('journal-public-profile')).toBeVisible();
    await expect(detail.locator('img')).toHaveAttribute('src', data.portrait);
    await expect.poll(() => detail.locator('img').evaluateAll(images => images.every(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0))).toBe(true);
    await page.screenshot({ path: `test-results/player-fixes/save-roundtrip-journal-${locale}.png` });
    await page.getByRole('button', { name: locale === 'pl' ? 'Zamknij dziennik przygody' : 'Close adventure journal', exact: true }).click();
    await page.getByTestId('btn-open-equipment').click();
    await page.getByTestId('equipment-modal').getByTestId('equipment-tab-gear').click();
    await expect(page.getByTestId('equipment-modal').getByTestId('equipment-tab-gear')).toContainText('(2)');
    await expect(page.getByTestId('equipment-modal').locator('img')).toHaveCount(2);
    await page.screenshot({ path: `test-results/player-fixes/save-roundtrip-equipment-${locale}.png` });
    await expect(page.locator('body')).not.toContainText('MISSING_MESSAGE');
    expect(errors).toEqual([]);
    await testInfo.attach(`real-save-roundtrip-${locale}`, { body: JSON.stringify({ saveId: savedResult.saveId, requests, expected, actual: await readState(page), restoredScope: restoreResult.scope, errors }, null, 2), contentType: 'application/json' });
  });
}
