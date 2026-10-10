import { expect, test } from '@playwright/test';

for (const locale of ['pl', 'en'] as const) {
  for (const layout of ['desktop', 'mobile', 'wide'] as const) {
    const mobile = layout === 'mobile';
    const wide = layout === 'wide';
    test(`continuous chronicle ${locale} ${layout}`, async ({ page }) => {
      await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: wide ? 2560 : 1280, height: wide ? 1440 : 800 });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(`${message.text()} ${message.location().url}`); });
      await page.addInitScript(({ language, wideScreen }) => {
        localStorage.clear();
        for (const key of ['onboarding_completed', 'rules_onboarding_completed', 'has_started_game', 'session_zero_completed', 'straznik_beta_welcome_dismissed']) localStorage.setItem(key, 'true');
        localStorage.setItem('language_selected', language);
        localStorage.setItem('coc7_rulebook_profile', 'starter-d100');
        localStorage.setItem('health_check_last_run', String(Date.now()));
        localStorage.setItem('zew-app-api-keys', JSON.stringify({ gemini: 'mock-key', GEMINI_API_KEY: 'mock-key' }));
        localStorage.setItem('ai_settings', JSON.stringify({ voiceSettings: { enabled: false }, imageGenerationEnabled: false, sessionZero: { narrativeMode: 'full_rpg', mechanics: { schemaVersion: 1, enabled: true } } }));
        localStorage.setItem('characters', JSON.stringify([{
          id: 'reader', name: 'Anna', occupation: 'Detective', age: 35, gender: 'female',
          str: 50, dex: 60, con: 60, app: 50, pow: 50, edu: 60, siz: 60, int: 60, luck: 50,
          hp: 12, maxHp: 12, san: 50, maxSan: 99, mp: 10, maxMp: 10, background: '',
          skills: {}, equipment: [], damageBonus: '0', playerName: '', isActive: true,
          lastUsed: new Date().toISOString(), notes: '', journal: wideScreen ? [
            { id: 'place', type: 'location', title: 'Gabinet Katedry Etnografii UW', content: 'subjective first-person camera POV, dim room lit by single desk lamp, archival noir photography 1970s', timestamp: '2026-01-01T09:00:00Z' },
            { id: 'npc', type: 'npc', title: 'Janusz Bielski', content: language === 'pl' ? 'Zmęczony dziennikarz telewizyjny w wymiętym prochowcu.' : 'A tired television reporter in a rumpled trench coat.', timestamp: '2026-01-01T10:00:00Z' },
            { id: 'opening', type: 'note', title: language === 'pl' ? 'Początek śledztwa' : 'The investigation begins', content: language === 'pl' ? 'Redaktor Bielski przyniósł do gabinetu na UW taśmę z zapisem fenomenów wokół ojca Klimuszki i Prabut, wstrzymaną przez cenzurę.' : 'Bielski brought a tape recording of events around Father Klimuszko and Prabuty to the university office. Censorship had blocked its release.', timestamp: '2026-01-01T11:00:00Z' },
          ] : [],
          activeScene: wideScreen ? { location: 'Gabinet Katedry Etnografii UW', sceneNumber: 1, people: [], findings: [], notes: [], startedAt: '2026-01-01T11:00:00Z' } : undefined,
          experience: { totalXP: 0, availableXP: 0, earnedThisSession: 0, maxEarnedThisSession: 0 }, developmentHistory: [],
          sceneCards: wideScreen ? [] : Array.from({ length: 60 }, (_, index) => ({
            id: `scene-${index + 1}`, sceneNumber: index + 1, title: `Archiwum ${index + 1}`, location: 'Archiwum',
            timestamp: new Date(Date.UTC(2026, 0, index + 1)).toISOString(), isSealed: true,
            people: ['Stanisław'], findings: [], keyTakeaways: [],
            chronicleChapter: {
              playthroughId: 'run', campaignDefinitionId: 'campaign',
              adventureId: index < 40 ? 'archive' : 'docks', adventureTitle: index < 40 ? 'Archiwum miejskie' : 'Doki',
              sessionId: `session-${Math.floor(index / 20) + 1}`, sessionNumber: Math.floor(index / 20) + 1,
            },
            chronicleSummaryByLocale: {
              pl: `Wpis ${index + 1}. Stanisław twierdził, że list wysłano z doków. Obejrzeliśmy księgę i wróciliśmy do miasta.`,
              en: `Entry ${index + 1}. Stanisław claimed the letter had been sent from the docks. We examined the ledger and returned to town.`,
            },
          })),
        }]));
        localStorage.setItem('active_character_id', 'reader');
      }, { language: locale, wideScreen: wide });
      await page.route('**/api/memory/restore', async (route) => route.fulfill({ status: 200, json: { success: true, scope: route.request().postDataJSON().scope } }));
      await page.route('**/api/pdf/ingest-local*', (route) => route.fulfill({ status: 200, json: { recordCount: 150, rulebookProfile: { profile: 'starter-d100', title: 'Starter CoC 7e' } } }));
      await page.route('**/api/desktop/update/status', (route) => route.fulfill({ status: 200, json: { id: 'none', state: 'idle', updatedAt: '1970-01-01T00:00:00.000Z' } }));
      await page.route('**/api/desktop/update/check', (route) => route.fulfill({ status: 200, json: { available: false, currentVersion: '0.9.5' } }));
      await page.goto(`/${locale}`);
      const trigger = page.getByTestId('btn-open-journal');
      await expect(trigger).toBeVisible({ timeout: 15000 });
      await trigger.click();
      const dialog = page.getByTestId('session-journal');
      await expect(dialog).toHaveAccessibleName(locale === 'pl' ? 'Kronika' : 'Chronicle');
      await expect(dialog.getByTestId('journal-entry')).toHaveCount(wide ? 2 : 60);
      expect(await dialog.evaluate((element) => element.getBoundingClientRect().width)).toBeLessThanOrEqual(1360);
      await expect(dialog).not.toContainText('camera POV');
      if (!wide) {
      await expect(dialog.getByTestId('journal-session-header')).toHaveText(locale === 'pl' ? ['Sesja 1', 'Sesja 2', 'Sesja 3'] : ['Session 1', 'Session 2', 'Session 3']);
      await expect(dialog.getByRole('heading', { name: 'Archiwum miejskie', exact: true })).toHaveCount(1);
      await expect(dialog.getByRole('heading', { name: 'Doki', exact: true })).toHaveCount(1);
      }
      if (!wide) await expect.poll(() => dialog.getByTestId('journal-reader').evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      await dialog.getByTestId('journal-contents').getByRole('button', { name: wide ? 'Janusz Bielski' : /(?:Scena|Scene) #1 Archiwum 1$/ }).click();
      const first = dialog.getByTestId('journal-entry').first();
      await expect(first).toBeFocused();
      await expect(first).toContainText(wide ? (locale === 'pl' ? 'Zmęczony dziennikarz' : 'A tired television reporter') : (locale === 'pl' ? 'Stanisław twierdził' : 'Stanisław claimed'));
      expect(await first.locator('[data-testid=scene-chronicle-summary], [data-testid=journal-legacy-record]').evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(18);
      await expect.poll(() => dialog.getByTestId('journal-reader').evaluate((element) => element.scrollTop)).toBeLessThan(400);
      expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      await expect(dialog.getByRole('textbox')).toHaveCount(0);
      await page.screenshot({ path: `test-results/journal-reader-${locale}-${layout}.png` });
      await page.keyboard.press('Tab');
      await expect(dialog.getByRole('button').first()).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
      expect(errors.filter((error) => !error.includes('Permissions policy violation') && !error.includes('compute-pressure'))).toEqual([]);
    });
  }
}
