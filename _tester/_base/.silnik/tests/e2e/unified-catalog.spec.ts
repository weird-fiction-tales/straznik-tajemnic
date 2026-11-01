import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
for (const locale of ['pl', 'en'] as const) {
  test(`complete Quick Setup catalog and investigator choice (${locale})`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' || m.text().includes('MISSING_MESSAGE')) errors.push(m.text()); });
    await page.addInitScript(selected => {
      for (const key of ['onboarding_completed', 'rules_onboarding_completed', 'session_zero_completed', 'straznik_beta_welcome_dismissed']) localStorage.setItem(key, 'true');
      localStorage.setItem('health_check_last_run', String(Date.now()));
      localStorage.setItem('language_selected', selected);
      localStorage.setItem('zew-app-api-keys', JSON.stringify({ GEMINI_API_KEY: 'e2e-local-key' }));
      localStorage.setItem('pdf_memory', JSON.stringify({ rulesUrl: '/data/rag/rules.json' }));
    }, locale);
    await page.route(/https:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\//, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><title>Background media test fixture</title></html>' }));
    await page.route('**/api/**', route => route.fulfill({ json: { success: true, recordCount: 1, hasBaseRules: true } }));
    await page.goto('/' + locale);
    await page.getByTestId('btn-quick-setup').click();
    const modal = page.getByTestId('quick-setup-modal');
    await expect(modal).toBeVisible();
    const adventures = modal.locator('button[aria-label][aria-pressed]');
    expect(await adventures.count()).toBeGreaterThan(2);
    const prabuty = adventures.filter({ hasText: locale === 'pl' ? /Cień nad Prabutami/ : /Englewood/ });
    await prabuty.click();
    await expect(prabuty).toHaveAttribute('aria-pressed', 'true');
    const investigator = locale === 'pl' ? 'Tomasz Nowicki' : 'Det. Frank Geyer';
    await modal.getByRole('button', { name: new RegExp(investigator) }).click();
    await expect(modal.getByText(investigator, { exact: true })).toBeVisible();
    await expect(modal.getByRole('button', { name: locale === 'pl' ? 'Rozpocznij przygodę' : 'Start adventure', exact: true })).toBeEnabled();
    await expect(page.locator('body')).not.toContainText('MISSING_MESSAGE');
    await page.screenshot({ path: `test-results/unified/catalog-${locale}.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}

test('prepared editions and every registered media file come from the frozen bundle', async ({ request }) => {
  for (const id of ['cien-nad-prabutami', 'englewood-murder-castle-1893']) {
    const response = await request.get('/api/adventure-dossier/playtest?adventureId=' + id);
    expect(response.status()).toBe(200);
    const edition = await response.json();
    expect(edition.payload.adventure_id).toBe(id);
    expect(edition.humanApproval).toBe('pending');
    const manifest = JSON.parse(readFileSync(path.resolve(__dirname, '../../public/adventure-packs', id, 'manifest.json'), 'utf8'));
    for (const asset of manifest.handouts) {
      for (const url of [asset.image, asset.audioUrl, asset.audioUrlPl, asset.audioUrlEn].filter(Boolean)) {
        const media = await request.get(url);
        expect(media.status(), url).toBe(200);
        expect(media.headers()['content-type'], url).toMatch(/^(image|audio)\//);
        expect((await media.body()).length, url).toBeGreaterThan(1000);
      }
    }
  }
});
