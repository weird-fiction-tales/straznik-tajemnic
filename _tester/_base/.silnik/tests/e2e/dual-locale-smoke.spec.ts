import { expect, test, type Page } from '@playwright/test';

/**
 * Dual-Locale Smoke Test dla Strażnika Tajemnic AI.
 *
 * Cel:
 * Błyskawiczna weryfikacja stabilności runtime po czystym starcie (clean state):
 * 1. Otwarcie gry w języku angielskim (/en) i polskim (/pl).
 * 2. Przejście do szybkiego startu i wybór gotowej postaci.
 * Gotowe postacie należą do szybkiego startu; tryb ręczny korzysta z własnych kart.
 * 3. Nasłuch na błędy konsoli przeglądarki - wyłapanie awarii typu:
 *    - "equipment.map is not a function"
 *    - "TypeError"
 *    - Niezłapane wyjątki renderowania (Uncaught Error).
 */

async function setupPageLocale(page: Page, locale: 'pl' | 'en') {
  const consoleErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
  });

  await page.route('**/api/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, recordCount: 1 }),
    })
  );

  await page.addInitScript((selectedLocale) => {
    localStorage.clear();
    localStorage.setItem('onboarding_completed', 'true');
    localStorage.setItem('rules_onboarding_completed', 'true');
    localStorage.setItem('straznik_beta_welcome_dismissed', 'true');
    localStorage.setItem('language_selected', selectedLocale);
    localStorage.setItem(
      'zew-app-api-keys',
      JSON.stringify({ gemini: 'mock-key', GEMINI_API_KEY: 'mock-key' })
    );
    localStorage.setItem('health_check_last_run', String(Date.now()));
  }, locale);

  return { consoleErrors };
}

test.describe('Dual-Locale Smoke Test - Runtime & i18n Error Detection', () => {
  for (const locale of ['pl', 'en'] as const) {
    test(`${locale}: quick setup selects the scenario investigator without runtime errors`, async ({ page }) => {
      const { consoleErrors } = await setupPageLocale(page, locale);
      await page.goto('/' + locale);
      await page.getByTestId('btn-quick-setup').click();
      const modal = page.getByTestId('quick-setup-modal');
      await expect(modal).toBeVisible();
      const startButton = modal.getByRole('button', {
        name: locale === 'pl' ? /Rozpocznij przygodę/i : /Start adventure|Begin adventure/i,
      });
      await expect(startButton).toBeInViewport();
      await expect(startButton).toBeEnabled();
      const investigator = modal.getByRole('button', {
        name: locale === 'pl' ? /Tomasz Nowicki/i : /Frank Geyer/i,
      });
      await investigator.click();
      await expect(investigator).toHaveAttribute('aria-pressed', 'true');
      await expect(startButton).toBeEnabled();
      const fatalErrors = consoleErrors.filter((error) =>
        /\.map is not a function|TypeError|Uncaught|MISSING_MESSAGE/.test(error));
      expect(fatalErrors).toEqual([]);
      await page.screenshot({ path: test.info().outputPath(locale + '-quick-setup.png') });
    });
  }
});
