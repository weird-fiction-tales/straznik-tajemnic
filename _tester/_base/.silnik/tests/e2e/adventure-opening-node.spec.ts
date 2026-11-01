import { expect, test } from '@playwright/test';
import { STREFA_11_ADVENTURES } from '../../src/lib/adventures-data';
import { defaultAISettings } from '../../src/lib/ai-settings/defaults';
import path from 'node:path';

const adventure = STREFA_11_ADVENTURES.find(a => a.id === 'cien-nad-prabutami')!;
const place = "Redakcja 'Sygnałów Nieznanego' (RTV Warszawa)";
const character = { id: 'opening-investigator', name: 'Tomasz Nowicki', occupation: 'Dziennikarz', age: 42,
  str: 50, dex: 50, con: 50, int: 50, pow: 50, edu: 50, app: 50, siz: 50,
  hp: 10, maxHp: 10, san: 50, maxSan: 99, mp: 10, luck: 50, skills: {}, equipment: [],
  journal: [], background: '', notes: '', isActive: true, lastUsed: new Date(0).toISOString(),
  experience: { totalXP: 0, availableXP: 0, earnedThisSession: 0, maxEarnedThisSession: 10 }, developmentHistory: [] };

for (const locale of ['pl', 'en'] as const) {
  test(`${locale}: a fresh game sends and renders the dossier opening`, async ({ page }) => {
    await page.setViewportSize({ width: 1680, height: 1000 });
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://www.youtube.com/**', route => route.fulfill({ status: 200,
      contentType: route.request().resourceType() === 'script' ? 'application/javascript' : 'text/html', body: '' }));
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/chat') {
        const body = route.request().postDataJSON();
        expect(body.isGameStart).toBe(true);
        expect(body.activeNodeId).toBe('node-warszawa-redakcja');
        expect(body.currentLocation).toBe(place);
        expect(body.adventureContext.activeLocationId).toBe('loc-warszawa-redakcja');
        expect(body.message).toContain(locale === 'en' ? 'MANDATORY OPENING SCENE' : 'OBOWIĄZKOWA SCENA OTWARCIA');
        const prose = locale === 'pl'
          ? 'W gabinecie przy Woronicza Helena Krawczyk czeka przy biurku. W redakcji słychać stukot maszyn.'
          : 'In the Warsaw newsroom on Woronicza Street, Helena Krawczyk waits beside her desk. Typewriters clatter nearby.';
        const text = `[${locale === 'en' ? 'LOCATION' : 'LOKACJA'}: ${place} | Paper and tobacco.]\n\n${prose}\n\n[${locale === 'en' ? 'What do you do?' : 'Co robisz?'}]`;
        return route.fulfill({ status: 200, contentType: 'text/event-stream', body:
          `data: ${JSON.stringify({ type: 'text', content: text })}\n\ndata: ${JSON.stringify({ type: 'metadata' })}\n\ndata: ${JSON.stringify({ type: 'done' })}\n\n` });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        success: true, valid: true, status: 'idle', hasBaseRules: true, recordCount: 61,
        characters: [character], sessions: [], saves: [], npcs: [], files: [], entries: [],
      }) });
    });
    await page.addInitScript(({ locale, adventure, character, settings }) => {
      if (window.top !== window || sessionStorage.getItem('opening-test-initialized')) return;
      sessionStorage.setItem('opening-test-initialized', 'true');
      localStorage.clear();
      for (const [k, v] of Object.entries({ onboarding_completed: 'true', language_selected: locale,
        rules_onboarding_completed: 'true', straznik_beta_welcome_dismissed: 'true',
        welcome_manual_mode: 'true', session_zero_completed: 'true', health_check_last_run: String(Date.now()),
        'zew-app-api-keys': JSON.stringify({ GEMINI_API_KEY: 'synthetic-browser-test', GEMINI_TIER: 'free' }),
        adventure_context: JSON.stringify({ ...adventure, locale, activeNodeId: 'node-elblag-klasztor' }),
        characters: JSON.stringify([character]), ai_settings: JSON.stringify(settings),
      })) localStorage.setItem(k, v);
    }, { locale, adventure, character, settings: { ...defaultAISettings, imageGenerationEnabled: false,
      voiceSettings: { ...defaultAISettings.voiceSettings, enabled: false } } });
    await page.goto(`/${locale}`);
    const panel = page.getByTestId('manual-setup-panel');
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: locale === 'en' ? /Start Game/i : /Rozpocznij grę/i }).click();
    await expect(page.getByTestId('loading-screen-enter-cta')).toBeVisible({ timeout: 20000 });
    await page.getByTestId('loading-screen-enter-cta').click();
    await expect(page.getByTestId('tts-hard-loading-screen')).not.toBeVisible();
    await expect(page.getByText(locale === 'en' ? /In the Warsaw newsroom on Woronicza/ : /W gabinecie przy Woronicza/).first()).toBeVisible();
    await expect(page.getByTitle(/Redakcja Sygnałów Nieznanego \(RTV Warszawa\)/).first()).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('world_setup_v1')!).openingScene.nodeId)).toBe('node-warszawa-redakcja');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('adventure_context')!).activeNodeId)).toBe('node-warszawa-redakcja');
    await expect(page.locator('body')).not.toContainText('MISSING_MESSAGE');
    await page.screenshot({ path: path.resolve(__dirname, '../../docs/audits/adventure-opening-node', `opening-${locale}.png`), fullPage: true });
    expect(errors).toEqual([]);
  });
}
