import { expect, test } from '@playwright/test';
import pl from '../../messages/pl.json';
import en from '../../messages/en.json';
import { createAuthoredPrabutyPayload } from '../../src/lib/adventure-dossier/authored-prabuty';
import { fingerprintLocalDraftPayload } from '../../src/lib/adventure-dossier/runtime-authorization';
import { getStrefa11CharactersForAdventure } from '../../src/lib/immersion/strefa-11-characters';

const adventureId = 'cien-nad-prabutami';
const presets = getStrefa11CharactersForAdventure(adventureId);

// This content test needs no hardware pressure sensor. Disable the browser's
// experimental API so its Permissions Policy diagnostic cannot pollute errors.
test.use({ launchOptions: { args: ['--disable-blink-features=ComputePressure'] } });

for (const preset of presets) {
  test(`new Prabuty game and PL/EN biography: ${preset.id}`, async ({ page }, info) => {
    const fingerprint = await fingerprintLocalDraftPayload(createAuthoredPrabutyPayload(`sha256:${'0'.repeat(64)}`));
    const payload = createAuthoredPrabutyPayload(fingerprint);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' || message.text().includes('MISSING_MESSAGE')) errors.push(message.text());
    });
    await page.addInitScript(() => {
      if (sessionStorage.getItem('prabuty-era-initialized')) return;
      sessionStorage.setItem('prabuty-era-initialized', 'true');
      localStorage.clear();
      for (const key of ['onboarding_completed', 'rules_onboarding_completed', 'session_zero_completed', 'straznik_beta_welcome_dismissed']) localStorage.setItem(key, 'true');
      localStorage.setItem('health_check_last_run', String(Date.now()));
      localStorage.setItem('language_selected', 'pl');
      localStorage.setItem('zew-app-api-keys', JSON.stringify({ GEMINI_API_KEY: 'e2e-local-key' }));
      localStorage.setItem('pdf_memory', JSON.stringify({ rulesUrl: '/data/rag/rules.json' }));
      localStorage.setItem('ai_settings', JSON.stringify({ qualityPreset: 'low', imageGenerationEnabled: false, voiceSettings: { enabled: false } }));
    });
    // Exercise the real start and persistence code, with no external AI/media calls.
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/chat') {
        return route.fulfill({ status: 200, contentType: 'text/event-stream', body:
          `data: ${JSON.stringify({ type: 'text', content: 'Redakcja, Warszawa, 18 października 1973 roku. Czeka na was teczka sprawy.' })}\n\n` +
          `data: ${JSON.stringify({ type: 'metadata', finishReason: 'STOP', dossierFinalizationToken: 'e2e-opening', dossierInventoryWritesAllowed: false })}\n\n` });
      }
      if (path === '/api/memory/turn') {
        const input = route.request().postDataJSON();
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(
          input.phase === 'prepare' ? { prepared: true } : { accepted: input.accepted }) });
      }
      const data = path === '/api/adventure-dossier/playtest' && route.request().method() === 'GET'
        ? { mode: 'local_playtest', humanApproval: 'pending', adventureId, editionFingerprint: fingerprint, payload }
        : { success: true, activated: true, recordCount: 1, hasBaseRules: true, configured: false, serverConfigured: false };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });

    await page.goto('/pl');
    await page.getByTestId('btn-quick-setup').click();
    const quick = page.getByTestId('quick-setup-modal');
    const index = presets.findIndex(character => character.id === preset.id);
    await quick.getByRole('button', { name: /Biografia/i }).nth(index).click();
    const preview = page.getByRole('dialog').last();
    const biography = preview.getByText(preset.backstory!, { exact: true });
    await biography.scrollIntoViewIfNeeded();
    await expect(biography).toBeVisible();
    await preview.screenshot({ path: info.outputPath('preview-pl.png') });
    await preview.getByRole('button', { name: 'Zamknij', exact: true }).click();
    await quick.getByRole('button', { name: new RegExp(preset.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).click();
    await quick.getByRole('button', { name: 'Rozpocznij przygodę', exact: true }).click();
    await expect(page.getByTestId('loading-screen-enter-cta')).toBeEnabled({ timeout: 45_000 });
    await page.getByTestId('loading-screen-enter-cta').click();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('has_started_game'))).toBe('true');

    const stored = await page.evaluate(id => {
      const roster = JSON.parse(localStorage.getItem('characters') || '[]');
      return roster.find((character: { sourcePresetId?: string }) => character.sourcePresetId === id);
    }, preset.id);
    expect(stored.backstory).toBe(preset.backstory);
    expect(stored.skills).toEqual(preset.skills);
    expect(stored.equipment).toEqual(expect.arrayContaining(preset.equipment!.map(item => expect.objectContaining({ id: item.id, name: item.name }))));
    for (const obsolete of ['eq_hel_telefon', 'eq_barb_camera']) {
      expect(stored.equipment.map((item: { id: string }) => item.id)).not.toContain(obsolete);
    }

    for (const [locale, messages] of [['pl', pl], ['en', en]] as const) {
      if (locale === 'en') {
        // Adventure locale takes precedence over the URL. Use an explicit EN
        // edition of the same fixture rather than changing the production rule.
        await page.evaluate(() => {
          const adventure = JSON.parse(localStorage.getItem('adventure_context') || '{}');
          localStorage.setItem('adventure_context', JSON.stringify({ ...adventure, locale: 'en' }));
          localStorage.setItem('language_selected', 'en');
        });
        await page.goto('/en');
      }
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await page.getByTestId('btn-open-character-sheet').click();
      const sheet = page.getByRole('dialog').last();
      const entry = messages.PredefinedCharacters.characters[preset.id as keyof typeof messages.PredefinedCharacters.characters];
      for (const label of Object.values(entry.data.equipment)) {
        await sheet.getByText(label.name, { exact: true }).first().scrollIntoViewIfNeeded();
        await expect(sheet.getByText(label.name, { exact: true }).first()).toBeVisible();
      }
      await sheet.screenshot({ path: info.outputPath(`equipment-${locale}.png`) });
      const text = sheet.getByText(entry.data.backstory, { exact: true });
      await text.scrollIntoViewIfNeeded();
      await expect(text).toBeVisible();
      await expect(sheet).not.toContainText(/komórk|mobile phone|NightVision|1990s|1989|Niva|Polonez|MISSING_MESSAGE/i);
      await sheet.screenshot({ path: info.outputPath(`biography-${locale}.png`) });
      if (preset.id === 'strefa11_ryszard_klucznik') await expect(sheet.getByText(entry.data.meaningfulLocation, { exact: true })).toContainText('Warszawa');
      const images = await sheet.locator('img').evaluateAll(nodes => nodes.map(node => ({ src: node.getAttribute('src'), loaded: (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0 })));
      expect(images.length).toBeGreaterThan(0);
      expect(images.every(image => image.loaded)).toBe(true);
      await sheet.getByRole('button', { name: locale === 'pl' ? 'Zamknij' : 'Close', exact: true }).click();
    }
    expect(errors).toEqual([]);
  });
}

for (const locale of ['pl', 'en'] as const) {
  test(`legacy Prabuty save keeps player text and equipment in ${locale}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' || message.text().includes('MISSING_MESSAGE')) errors.push(message.text()); });
    const legacy = { ...presets[1], id: 'legacy-helena', sourcePresetId: presets[1].id, isActive: true,
      backstory: 'Własna historia gracza po 1989 roku.', background: 'Własne tło postaci.',
      description: 'Własny opis z telefonem w dłoni.', meaningfulLocation: 'Własne miejsce gracza.',
      treasuredPossession: 'Własna pamiątka gracza.',
      equipment: [{ id: 'eq_hel_telefon', name: 'Telefon komórkowy (wielki)', category: 'tool', description: 'Pamiątka gracza' }] };
    await page.addInitScript(({ character, selectedLocale }) => {
      if (sessionStorage.getItem('legacy-prabuty-initialized')) return;
      sessionStorage.setItem('legacy-prabuty-initialized', 'true');
      localStorage.clear();
      for (const key of ['onboarding_completed', 'rules_onboarding_completed', 'session_zero_completed', 'straznik_beta_welcome_dismissed', 'has_started_game']) localStorage.setItem(key, 'true');
      localStorage.setItem('health_check_last_run', String(Date.now()));
      localStorage.setItem('language_selected', selectedLocale);
      localStorage.setItem('characters', JSON.stringify([character]));
      localStorage.setItem('active_character_id', character.id);
      localStorage.setItem('zew-app-api-keys', JSON.stringify({ GEMINI_API_KEY: 'e2e-local-key' }));
      localStorage.setItem('pdf_memory', JSON.stringify({ rulesUrl: '/data/rag/rules.json' }));
    }, { character: legacy, selectedLocale: locale });
    await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, recordCount: 1 }) }));
    await page.goto('/' + locale);
    await page.getByTestId('btn-open-character-sheet').click();
    const sheet = page.getByRole('dialog').last();
    const story = sheet.getByText(legacy.backstory, { exact: true });
    await story.scrollIntoViewIfNeeded();
    await expect(story).toBeVisible();
    await expect(sheet.getByText(legacy.description, { exact: true })).toBeVisible();
    await expect(sheet.getByText(legacy.equipment[0].name, { exact: true })).toHaveCount(1);
    await sheet.screenshot({ path: info.outputPath(`legacy-${locale}.png`) });
    await page.reload();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('characters') || '[]')[0]);
    expect(saved.backstory).toBe(legacy.backstory);
    expect(saved.equipment).toEqual(legacy.equipment);
    expect(errors).toEqual([]);
  });
}
