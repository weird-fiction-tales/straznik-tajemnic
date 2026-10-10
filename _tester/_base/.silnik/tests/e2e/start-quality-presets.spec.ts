import { expect, test, type Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const OUT_DIR_SILNIK = path.resolve(__dirname, '../../out/start-quality-presets');
const OUT_DIR_ROOT = path.resolve(__dirname, '../../../../../out/start-quality-presets');

function ensureOutDirs() {
  fs.mkdirSync(OUT_DIR_SILNIK, { recursive: true });
  fs.mkdirSync(OUT_DIR_ROOT, { recursive: true });
}

async function saveScreenshot(page: Page, filename: string) {
  ensureOutDirs();
  const fileSilnik = path.join(OUT_DIR_SILNIK, filename);
  const fileRoot = path.join(OUT_DIR_ROOT, filename);
  await page.screenshot({ path: fileSilnik, fullPage: true });
  fs.copyFileSync(fileSilnik, fileRoot);
}

async function setupPage(
  page: Page,
  locale: 'pl' | 'en',
  customSettings?: Record<string, unknown>
) {
  const consoleErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignoruj komunikaty systemowe/przegladarkowe Chromium (np. brak polityki compute-pressure)
      if (
        text.includes('Permissions policy violation') ||
        text.includes('compute-pressure')
      ) {
        return;
      }
      consoleErrors.push(text);
    }
  });

  page.on('pageerror', (err) => {
    const text = err.message;
    if (
      text.includes('Permissions policy violation') ||
      text.includes('compute-pressure')
    ) {
      return;
    }
    consoleErrors.push(text);
  });

  await page.route('**/api/pdf/ingest-local**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        type: 'rules',
        recordCount: 61,
        hasBaseRules: true,
      }),
    })
  );

  await page.route('**/api/health/gemini', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, valid: true }),
    })
  );

  await page.route('**/api/desktop/update/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, status: 'idle' }),
    })
  );

  await page.route('**/api/chat-test', (route) =>
    route.fulfill({ status: 200, body: 'ok' })
  );

  await page.addInitScript(
    ({ selectedLocale, settings }) => {
      if (!sessionStorage.getItem('test_initialized')) {
        localStorage.clear();
        sessionStorage.setItem('test_initialized', 'true');
        localStorage.setItem('onboarding_completed', 'true');
        localStorage.setItem('language_selected', selectedLocale);
        localStorage.setItem(
          'zew-app-api-keys',
          JSON.stringify({ gemini: 'mock-key', GEMINI_API_KEY: 'mock-key' })
        );
        localStorage.setItem('health_check_last_run', String(Date.now()));
        localStorage.setItem('beta_welcome_dismissed', 'true');
        localStorage.setItem('straznik_beta_welcome_dismissed', 'true');
        localStorage.setItem('rules_onboarding_completed', 'true');
        if (settings) {
          localStorage.setItem('ai_settings', JSON.stringify(settings));
        }
      }
    },
    { selectedLocale: locale, settings: customSettings }
  );

  return { consoleErrors };
}

test.describe('Start Quality Presets E2E & Visual Verification', () => {
  test('Renders 4 quality tiles on Desktop in Polish with ULTRA selected by default', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const { consoleErrors } = await setupPage(page, 'pl');

    await page.goto('/pl');
    const container = page.locator('[data-testid="start-quality-presets"]');
    await expect(container).toBeVisible({ timeout: 15000 });

    const presets = ['low', 'mid', 'high', 'ultra'] as const;
    for (const preset of presets) {
      const tile = page.locator(`[data-testid="start-preset-${preset}"]`);
      await expect(tile).toBeVisible();
      await expect(tile).toContainText(preset.toUpperCase());
    }

    // Default is ULTRA
    const ultraTile = page.locator('[data-testid="start-preset-ultra"]');
    await expect(ultraTile).toHaveAttribute('aria-pressed', 'true');

    // Check title in Polish
    await expect(container.locator('h2')).toContainText('Oprawa rozgrywki');

    await saveScreenshot(page, 'desktop-pl-ultra.png');
    expect(consoleErrors).toHaveLength(0);
  });

  test('Renders 4 quality tiles on Desktop in English with ULTRA selected by default', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const { consoleErrors } = await setupPage(page, 'en');

    await page.goto('/en');
    const container = page.locator('[data-testid="start-quality-presets"]');
    await expect(container).toBeVisible({ timeout: 15000 });

    const presets = ['low', 'mid', 'high', 'ultra'] as const;
    for (const preset of presets) {
      const tile = page.locator(`[data-testid="start-preset-${preset}"]`);
      await expect(tile).toBeVisible();
      await expect(tile).toContainText(preset.toUpperCase());
    }

    // Default is ULTRA
    const ultraTile = page.locator('[data-testid="start-preset-ultra"]');
    await expect(ultraTile).toHaveAttribute('aria-pressed', 'true');

    // Check title in English
    await expect(container.locator('h2')).toContainText('Game presentation');

    await saveScreenshot(page, 'desktop-en-ultra.png');
    expect(consoleErrors).toHaveLength(0);
  });

  test('Renders responsive layout on narrow screen (RWD Mobile) in Polish', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const { consoleErrors } = await setupPage(page, 'pl');
    await page.goto('/pl');
    const plContainer = page.locator('[data-testid="start-quality-presets"]');
    await expect(plContainer).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="start-preset-ultra"]')).toBeVisible();
    await expect(plContainer.locator('h2')).toContainText('Oprawa rozgrywki');
    await plContainer.scrollIntoViewIfNeeded();
    await saveScreenshot(page, 'mobile-pl-ultra.png');
    expect(consoleErrors).toHaveLength(0);
  });

  test('Renders responsive layout on narrow screen (RWD Mobile) in English', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const { consoleErrors } = await setupPage(page, 'en');
    await page.goto('/en');
    const enContainer = page.locator('[data-testid="start-quality-presets"]');
    await expect(enContainer).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="start-preset-ultra"]')).toBeVisible();
    await expect(enContainer.locator('h2')).toContainText('Game presentation');
    await enContainer.scrollIntoViewIfNeeded();
    await saveScreenshot(page, 'mobile-en-ultra.png');
    expect(consoleErrors).toHaveLength(0);
  });

  test('Clicking presets updates state immediately, persists to localStorage, and survives reload', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const { consoleErrors } = await setupPage(page, 'pl');

    await page.goto('/pl');
    const container = page.locator('[data-testid="start-quality-presets"]');
    await expect(container).toBeVisible({ timeout: 15000 });

    // 1. Click LOW
    const lowTile = page.locator('[data-testid="start-preset-low"]');
    await lowTile.click();
    await expect(lowTile).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-testid="start-preset-ultra"]')).toHaveAttribute('aria-pressed', 'false');

    // Check localStorage
    let storedSettings = await page.evaluate(() => {
      const raw = localStorage.getItem('ai_settings');
      return raw ? JSON.parse(raw) : null;
    });
    expect(storedSettings?.qualityPreset).toBe('low');
    expect(storedSettings?.voiceSettings?.enabled).toBe(false);
    expect(storedSettings?.imageGenerationEnabled).toBe(false);

    await saveScreenshot(page, 'desktop-pl-low-selected.png');

    // 2. Click HIGH
    const highTile = page.locator('[data-testid="start-preset-high"]');
    await highTile.click();
    await expect(highTile).toHaveAttribute('aria-pressed', 'true');
    await expect(lowTile).toHaveAttribute('aria-pressed', 'false');

    storedSettings = await page.evaluate(() => {
      const raw = localStorage.getItem('ai_settings');
      return raw ? JSON.parse(raw) : null;
    });
    expect(storedSettings?.qualityPreset).toBe('high');
    expect(storedSettings?.voiceSettings?.enabled).toBe(true);
    expect(storedSettings?.voiceSettings?.narratorOnly).toBe(true);
    expect(storedSettings?.imageGenerationEnabled).toBe(true);

    await saveScreenshot(page, 'desktop-pl-high-selected.png');

    // 3. Reload and verify persistence
    await page.reload();
    await expect(page.locator('[data-testid="start-quality-presets"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="start-preset-high"]')).toHaveAttribute('aria-pressed', 'true');

    storedSettings = await page.evaluate(() => {
      const raw = localStorage.getItem('ai_settings');
      return raw ? JSON.parse(raw) : null;
    });
    expect(storedSettings?.qualityPreset).toBe('high');

    expect(consoleErrors).toHaveLength(0);
  });

  test('Preserves CUSTOM mode when pre-existing in localStorage without overwriting', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const { consoleErrors } = await setupPage(page, 'pl', {
      qualityPreset: 'custom',
      geminiSettings: { temperature: 0.12 },
    });

    await page.goto('/pl');
    const container = page.locator('[data-testid="start-quality-presets"]');
    await expect(container).toBeVisible({ timeout: 15000 });

    // Custom status message is shown
    const statusMsg = container.locator('[role="status"]');
    await expect(statusMsg).toBeVisible();
    await expect(statusMsg).toContainText('Zachowano własne ustawienia');

    // None of the 4 preset buttons is aria-pressed
    for (const preset of ['low', 'mid', 'high', 'ultra']) {
      await expect(page.locator(`[data-testid="start-preset-${preset}"]`)).toHaveAttribute('aria-pressed', 'false');
    }

    // Verify localStorage was not overwritten
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('ai_settings');
      return raw ? JSON.parse(raw) : null;
    });
    expect(stored?.qualityPreset).toBe('custom');
    expect(stored?.geminiSettings?.temperature).toBe(0.12);

    await saveScreenshot(page, 'desktop-pl-custom-preserved.png');
    expect(consoleErrors).toHaveLength(0);
  });
});
