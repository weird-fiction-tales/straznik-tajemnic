import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
const base = process.env.HUE_TEST_BASE_URL ?? 'http://127.0.0.1:4064';
for (const locale of ['pl', 'en'] as const) {
  test(`Hue score and controls ${locale}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    const config = {
      enabled: true,
      bridgeIp: '192.168.1.2',
      bridgeId: '001788fffe123456',
      appKey: '',
      paired: true,
      selectedLightIds: ['light-1'],
      mode: 'basic',
      intensity: 1,
      flashesEnabled: false,
    };
    let phase = 'off';
    const commands: Array<Record<string, unknown>> = [];
    await page.addInitScript(
      ({ locale, config }) => {
        localStorage.setItem('app_locale', locale);
        localStorage.setItem('onboarding_completed', 'true');
        localStorage.setItem('straznik_beta_welcome_dismissed', 'true');
        localStorage.setItem('straznik_hue_config', JSON.stringify(config));
      },
      { locale, config }
    );
    await page.route('**/api/**', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          logs: [],
          voices: [],
          models: [],
          prompt: '',
          totalCost: 0,
          totalRequests: 0,
          total: { cost: 0, tokens: 0, requests: 0 },
          byProvider: {},
          available: false,
          status: 'idle',
          keyValid: false,
        }),
      })
    );
    await page.route('**/api/health/gemini**', (r) =>
      r.fulfill({
        json: {
          status: 'no_key',
          keyValid: null,
          availableModels: [],
          registry: {
            chatModelsPresent: [],
            chatModelsMissing: [],
            embeddingPresent: false,
          },
          checkedAt: '2026-10-30T12:00:00Z',
        },
      })
    );
    await page.route('**/api/hue', async (r) => {
      if (r.request().method() === 'GET') {
        await r.fulfill({
          json: {
            config,
            phase,
            paired: true,
            hasClientKey: true,
            lights: [
              {
                id: 'light-1',
                metadata: { name: 'Study lamp' },
                on: { on: true },
              },
            ],
            areas: [
              {
                id: 'area-1',
                metadata: { name: 'Game room' },
                status: 'inactive',
                channels: [],
                lightIds: ['light-1'],
              },
            ],
          },
        });
        return;
      }
      const cmd = r.request().postDataJSON();
      commands.push(cmd);
      if (cmd.action === 'configure') Object.assign(config, cmd.config);
      if (cmd.action === 'emergency') phase = 'emergency';
      if (cmd.action === 'start') phase = 'basic';
      if (cmd.action === 'pause') phase = 'paused';
      if (cmd.action === 'resume') phase = 'basic';
      if (cmd.action === 'stop') phase = 'off';
      await r.fulfill({
        json: {
          ok: true,
          snapshot: [{ lightId: 'light-1', on: true, brightness: 73 }],
        },
      });
    });
    await page.goto(`${base}/${locale}/settings`);
    const hue = page.getByTestId('hue-settings');
    await expect(
      hue.getByRole('heading', {
        name:
          locale === 'pl'
            ? 'Inteligentne Oświetlenie (Philips Hue)'
            : 'Smart Lighting (Philips Hue)',
      })
    ).toBeVisible();
    await hue
      .getByRole('button', {
        name: locale === 'pl' ? 'Rozwiń' : 'Expand',
        exact: true,
      })
      .click();
    const preview = hue.getByTestId('hue-lighting-preview');
    await expect(preview).toContainText(
      locale === 'pl'
        ? 'Partytura światła - Cień nad Prabutami'
        : 'Lighting score - Shadow over Prabuty'
    );
    await expect(preview.locator('tbody tr')).toHaveCount(5);
    await expect(hue.getByTestId('hue-flashes')).not.toBeChecked();
    await hue
      .getByTestId('hue-scene-select')
      .selectOption('scene-prabuty-krypta-climax');
    await expect(hue.getByTestId('hue-scene-values')).toContainText('10%');
    await hue.getByTestId('hue-mode').selectOption('entertainment');
    await hue.getByTestId('hue-area').selectOption('area-1');
    await expect(hue.getByTestId('hue-area-members')).toContainText(
      'Study lamp'
    );
    await hue.getByTestId('hue-save').click();
    await expect(hue.getByTestId('hue-notice')).toContainText(
      locale === 'pl' ? 'Polecenie wykonane.' : 'Command completed.'
    );
    await hue.getByTestId('hue-preview-base').click();
    await expect
      .poll(() => commands.filter((c) => c.action === 'state').length)
      .toBe(1);
    await hue.getByTestId('hue-emergency').click();
    await expect(hue.getByTestId('hue-status')).toContainText(
      locale === 'pl' ? 'Światło awaryjne' : 'Emergency light'
    );
    await expect
      .poll(() => commands.filter((c) => c.action === 'emergency').length)
      .toBe(1);
    const output = path.resolve('../../../docs/audits/hue-lighting/evidence');
    await fs.mkdir(output, { recursive: true });
    await hue.getByTestId('hue-emergency').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, `hue-${locale}.png`) });
    await preview.getByRole('table').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, `score-${locale}.png`) });
    expect(errors).toEqual([]);
  });
}
