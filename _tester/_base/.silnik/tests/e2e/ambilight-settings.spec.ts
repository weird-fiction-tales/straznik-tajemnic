import { test, expect } from '@playwright/test';

for (const locale of ['pl', 'en'] as const) {
  test(`Ambilight discovery, PIN, effects and restoration - ${locale}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    const state = {
      paired: false,
      enabled: false,
      ip: '',
      name: '',
      generation: 'test-generation',
    };
    let effects = 0;
    await page.route('**/api/desktop/update/status', (route) =>
      route.fulfill({ json: { id: 'none', state: 'idle' } })
    );
    await page.route('**/api/health/gemini?*', (route) =>
      route.fulfill({
        json: {
          status: 'no_key',
          registry: { chatModelsPresent: [], chatModelsMissing: [] },
        },
      })
    );
    await page.route('**/api/pricing/refresh', (route) =>
      route.fulfill({ json: { source: 'bundled' } })
    );
    await page.route('**/api/hardware/ambilight', async (route) => {
      const body =
        route.request().method() === 'POST'
          ? route.request().postDataJSON()
          : {};
      let result: unknown = state;
      if (body.action === 'discover')
        result = { devices: [{ ip: '192.168.1.50', name: '55PUS7303/12' }] };
      if (body.action === 'pair') {
        expect(body.ip).toBe('192.168.1.50');
        result = { pinRequired: true };
      }
      if (body.action === 'confirm') {
        if (body.pin !== '1234') {
          await route.fulfill({ status: 400, json: { error: 'invalidPin' } });
          return;
        }
        Object.assign(state, {
          paired: true,
          ip: '192.168.1.50',
          name: '55PUS7303/12',
        });
      }
      if (body.action === 'enable') state.enabled = body.enabled;
      if (body.action === 'effect') {
        effects++;
        result = { applied: true };
      }
      if (body.action === 'disconnect')
        Object.assign(state, {
          paired: false,
          enabled: false,
          ip: '',
          name: '',
        });
      await route.fulfill({ json: result });
    });
    await page.addInitScript(() => {
      localStorage.setItem('straznik_beta_welcome_dismissed', 'true');
      localStorage.setItem('straznik_onboarding_completed', 'true');
    });
    await page.goto(`/${locale}/settings`);
    const hue = page.getByTestId('hue-settings');
    await hue
      .getByRole('button', { name: locale === 'pl' ? 'Rozwiń' : 'Expand' })
      .click();
    const panel = page.getByTestId('ambilight-settings');
    await expect(
      panel.getByRole('heading', {
        name:
          locale === 'pl'
            ? 'Telewizor Philips Ambilight'
            : 'Philips Ambilight TV',
      })
    ).toBeVisible();
    await panel
      .getByRole('button', {
        name: locale === 'pl' ? 'Wyszukaj telewizory' : 'Find TVs',
      })
      .click();
    await panel
      .getByRole('button', { name: '55PUS7303/12 (192.168.1.50)' })
      .click();
    await panel
      .getByRole('button', {
        name: locale === 'pl' ? 'Połącz telewizor' : 'Connect TV',
        exact: true,
      })
      .click();
    await panel.locator('#ambilight-pin').fill('1234');
    await panel
      .getByRole('button', {
        name: locale === 'pl' ? 'Zatwierdź PIN' : 'Confirm PIN',
      })
      .click();
    await panel
      .getByRole('button', {
        name: locale === 'pl' ? 'Włącz efekty TV' : 'Enable TV effects',
      })
      .click();
    await panel
      .getByRole('button', {
        name: locale === 'pl' ? 'Testuj Ambilight' : 'Test Ambilight',
      })
      .click();
    await expect.poll(() => effects).toBe(1);
    await expect(panel).toContainText(
      locale === 'pl'
        ? 'Telewizor przyjął polecenie testowe'
        : 'TV accepted the test command'
    );
    await panel.screenshot({
      path: `test-results/ambilight-active-${locale}.png`,
    });
    await panel
      .getByRole('button', {
        name: locale === 'pl' ? 'Przywróć tryb telewizora' : 'Restore TV mode',
      })
      .click();
    await expect(panel.getByTestId('ambilight-status')).toContainText(
      locale === 'pl' ? 'Efekty wyłączone' : 'Effects disabled'
    );
    await panel
      .getByRole('button', {
        name: locale === 'pl' ? 'Odłącz telewizor' : 'Disconnect TV',
        exact: true,
      })
      .click();
    await expect(panel).toContainText(
      locale === 'pl' ? 'Brak połączonego telewizora' : 'No TV connected'
    );
    await expect(panel).not.toContainText('MISSING_MESSAGE');
    await panel.screenshot({
      path: `test-results/ambilight-disconnected-${locale}.png`,
    });
    expect(errors).toEqual([]);
  });
}

test('real local API rejects foreign origins and non-LAN addresses', async ({
  request,
  baseURL,
}) => {
  const status = await request.get('/api/hardware/ambilight');
  expect(status.ok()).toBe(true);
  expect(await status.json()).not.toHaveProperty('password');
  const foreign = await request.post('/api/hardware/ambilight', {
    headers: { Origin: 'https://example.com' },
    data: { action: 'discover' },
  });
  expect(foreign.status()).toBe(403);
  const invalid = await request.post('/api/hardware/ambilight', {
    headers: { Origin: baseURL! },
    data: { action: 'pair', ip: '8.8.8.8' },
  });
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).toEqual({ error: 'invalidAddress' });
});
