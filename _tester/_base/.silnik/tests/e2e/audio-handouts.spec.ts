import { expect, test } from '@playwright/test';

for (const locale of ['pl', 'en'] as const) {
  test(`discovered audio handout ${locale}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(language => {
      localStorage.clear();
      for (const key of ['onboarding_completed', 'rules_onboarding_completed', 'has_started_game', 'session_zero_completed', 'straznik_beta_welcome_dismissed']) localStorage.setItem(key, 'true');
      localStorage.setItem('language_selected', language);
      localStorage.setItem('coc7_rulebook_profile', 'starter-d100');
      localStorage.setItem('health_check_last_run', String(Date.now()));
      localStorage.setItem('zew-app-api-keys', JSON.stringify({ gemini: 'mock-key', GEMINI_API_KEY: 'mock-key' }));
      localStorage.setItem('ai_settings', JSON.stringify({ voiceSettings: { enabled: false }, imageGenerationEnabled: false, sessionZero: { narrativeMode: 'full_rpg', mechanics: { schemaVersion: 1, enabled: true } } }));
      const messages = [{ id: 'discovered-tape', role: 'assistant', content: '[HANDOUT:audio-stilon-c60-interview]', timestamp: new Date().toISOString() }];
      for (const key of ['zew_chat_messages', 'chat-messages']) localStorage.setItem(key, JSON.stringify(messages));
      localStorage.setItem('adventure_context', JSON.stringify({ id: 'tajemnica-dzieci-z-traszyna', title: 'Traszyn', era: 'modern', country: 'Polska', yearRange: '1999', activeSceneYear: 1999, activeNodeId: 'node-exorcist-shrine' }));
      localStorage.setItem('characters', JSON.stringify([{
        id: 'audio-reader', name: 'Anna', occupation: 'Detective', age: 35, gender: 'female',
        str: 50, dex: 60, con: 60, app: 50, pow: 50, edu: 60, siz: 60, int: 60, luck: 50,
        hp: 12, maxHp: 12, san: 50, maxSan: 99, mp: 10, maxMp: 10, background: '',
        skills: {}, equipment: [], damageBonus: '0', playerName: '', isActive: true,
        lastUsed: new Date().toISOString(), notes: '', journal: [],
        experience: { totalXP: 0, availableXP: 0, earnedThisSession: 0, maxEarnedThisSession: 0 }, developmentHistory: [],
      }]));
      localStorage.setItem('active_character_id', 'audio-reader');
    }, locale);
    await page.route('**/api/**', route => route.fulfill({ status: 200, json: { success: true, recordCount: 150, rulebookProfile: { profile: 'starter-d100', title: 'Starter CoC 7e' }, state: 'idle', available: false } }));
    const suffix = locale === 'en' ? '-en' : '';
    const request = page.waitForResponse(response => response.url().endsWith(`/audio/handouts/tajemnica-dzieci-z-traszyna/wywiad-dziecko-1983${suffix}.mp3`) && response.ok());
    await page.goto(`/${locale}`);
    await request;
    const play = page.getByRole('button', { name: locale === 'pl' ? 'Odtwórz' : 'Play', exact: true });
    await expect(play).toBeEnabled({ timeout: 30000 });
    await expect(page.getByRole('heading', { name: locale === 'pl' ? 'Kaseta Stilon C-60: Wywiad z przerażonym dzieckiem (1983)' : 'Stilon C-60 cassette: Interview with a terrified child (1983)' })).toBeVisible();
    await play.click();
    await expect(page.getByRole('button', { name: locale === 'pl' ? 'Wstrzymaj' : 'Pause', exact: true })).toBeVisible();
    await page.screenshot({ path: `test-results/audio-handout-${locale}.png` });
    expect(errors).toEqual([]);
    expect(await page.locator('body').innerText()).not.toContain('MISSING_MESSAGE');
  });
}
