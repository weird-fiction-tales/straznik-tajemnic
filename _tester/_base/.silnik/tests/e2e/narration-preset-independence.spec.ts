import { expect, test } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { defaultAISettings } from '../../src/lib/ai-settings/defaults';
import { applyPreset } from '../../src/lib/ai-presets/apply';

const output = path.resolve(
  __dirname,
  '../../out/narration-preset-independence'
);

for (const locale of ['pl', 'en'] as const) {
  test(`independent narration survives preset changes and reopening in ${locale}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (
        message.type() === 'error' ||
        message.text().includes('MISSING_MESSAGE')
      )
        errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    // Settings verification never contacts paid model or media services.
    await page.route(/https:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\//, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><title>Background media test fixture</title></html>' }));
    await page.route('**/api/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          status: 'idle',
          logs: [],
          voices: [],
          models: [],
          updates: [],
          available: false,
        }),
      })
    );
    await page.route('**/api/hue', route => route.fulfill({ json: {
      config: { enabled: false, paired: false, bridgeIp: '', appKey: '', selectedLightIds: [], mode: 'basic' },
      paired: false, phase: 'off', hasClientKey: false, lights: [], areas: []
    } }));
    await page.route('**/api/health/gemini**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'no_key',
          keyValid: null,
          availableModels: [],
          registry: {
            chatModelsPresent: [],
            chatModelsMissing: [],
            embeddingPresent: false,
          },
          checkedAt: '2026-10-23T12:00:00.000Z',
        }),
      })
    );
    await page.route('**/api/pdf/ingest-local**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          type: 'rules',
          recordCount: 1,
          hasBaseRules: true,
        }),
      })
    );
    await page.route('**/default-gm-prompt*.md', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: 'Synthetic test instructions',
      })
    );
    const saved = applyPreset('mid', defaultAISettings);
    saved.geminiSettings.maxOutputTokens = 2048; // legacy MID budget
    saved.gameMasterNarration = {
      ...saved.gameMasterNarration,
      prompts: { mainPrompt: 'Synthetic test instructions' },
      style: { responseLength: 'medium', detailLevel: 'standard' },
      behavior: {
        ...saved.gameMasterNarration.behavior,
        creativity: 'balanced',
      },
    };
    await page.addInitScript(
      ({ settings, language }) => {
        if (sessionStorage.getItem('narration-test-seeded')) return;
        sessionStorage.setItem('narration-test-seeded', 'true');
        localStorage.clear();
        localStorage.setItem('ai_settings', JSON.stringify(settings));
        localStorage.setItem('onboarding_completed', 'true');
        localStorage.setItem('language_selected', language);
        localStorage.setItem(
          'zew-app-api-keys',
          JSON.stringify({ gemini: 'mock-key', GEMINI_API_KEY: 'mock-key' })
        );
        localStorage.setItem('beta_welcome_dismissed', 'true');
        localStorage.setItem('straznik_beta_welcome_dismissed', 'true');
        localStorage.setItem('rules_onboarding_completed', 'true');
        localStorage.setItem('health_check_last_run', String(Date.now()));
      },
      { settings: saved, language: locale }
    );
    await page.setViewportSize({ width: 1440, height: 1080 });
    await page.goto(`/${locale}/settings`);
    const dialog = page.getByRole('dialog');
    const presets = dialog.getByTestId('settings-quality-presets');
    const mid = presets.getByTestId('settings-preset-mid');
    await expect(mid).toHaveAttribute('aria-pressed', 'true');
    await expect(presets).toContainText(
      locale === 'pl'
        ? 'Długość, szczegółowość i kreatywność narracji ustawiasz osobno'
        : 'Set narration length, detail and creativity separately'
    );
    const nerdy = dialog.getByRole('button', {
      name: locale === 'pl' ? /Ustawienia dla nerdów/ : /Nerd/,
    });
    await nerdy.click();
    const length = dialog.getByTestId('gm-response-length');
    const detail = dialog.getByTestId('gm-detail-level');
    const creativity = dialog.getByTestId('gm-creativity');
    await expect(length).toHaveValue('medium');
    await length.selectOption('long');
    await detail.selectOption('detailed');
    await creativity.selectOption('creative');
    await expect(mid).toHaveAttribute('aria-pressed', 'true');
    await expect(length.locator('option:checked')).toHaveText(
      locale === 'pl' ? 'Długa' : 'Long'
    );
    for (const preset of ['low', 'high', 'ultra', 'mid']) {
      const tile = presets.getByTestId(`settings-preset-${preset}`);
      await tile.click();
      await expect(tile).toHaveAttribute('aria-pressed', 'true');
      await expect(length).toHaveValue('long');
      await expect(detail).toHaveValue('detailed');
      await expect(creativity).toHaveValue('creative');
    }
    await dialog
      .getByRole('button', {
        name: locale === 'pl' ? /Zapisz Ustawienia/ : /Save Settings/i,
      })
      .click();
    await expect(dialog).toBeHidden();
    const startPresets = page.getByTestId('start-quality-presets');
    await expect(startPresets).toBeVisible();
    await expect(startPresets).toContainText(
      locale === 'pl'
        ? 'Długość, szczegółowość i kreatywność narracji ustawiasz osobno'
        : 'Set narration length, detail and creativity separately'
    );
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('ai_settings')!)
    );
    expect(stored.qualityPreset).toBe('mid');
    expect(stored.geminiSettings.maxOutputTokens).toBe(8192);
    expect(stored.gameMasterNarration.style).toEqual({
      responseLength: 'long',
      detailLevel: 'detailed',
    });
    expect(stored.gameMasterNarration.behavior.creativity).toBe('creative');
    // Open settings again from a new request, then reload the page as well.
    await page.goto(`/${locale}/settings`);
    await page.reload();
    await expect(mid).toHaveAttribute('aria-pressed', 'true');
    await nerdy.click();
    await expect(length).toHaveValue('long');
    await expect(detail).toHaveValue('detailed');
    await expect(creativity).toHaveValue('creative');
    fs.mkdirSync(output, { recursive: true });
    await presets.screenshot({
      path: path.join(output, `presets-${locale}.png`),
    });
    const narrationGrid = length.locator('xpath=../..');
    // Async settings sections can change height after reopening. Recenter until
    // all three localized controls share the viewport, then capture that state.
    await expect(async () => {
      await narrationGrid.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await expect(length).toBeInViewport({ timeout: 250 });
      await expect(detail).toBeInViewport({ timeout: 250 });
      await expect(creativity).toBeInViewport({ timeout: 250 });
    }).toPass({ timeout: 5000 });
    await narrationGrid.screenshot({
      path: path.join(output, `narration-${locale}.png`),
    });
    expect(errors).toEqual([]);
  });
}
