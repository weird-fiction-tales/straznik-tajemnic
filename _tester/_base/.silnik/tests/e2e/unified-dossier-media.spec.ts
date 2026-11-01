import { test, expect } from '@playwright/test';
import { getStrefa11CharactersForAdventure } from '../../src/lib/immersion/strefa-11-characters';
import { getAdventureById } from '../../src/lib/adventures-data';

for (const locale of ['pl', 'en'] as const) {
  test(`discovered source photograph and playable source tape render (${locale})`, async ({ page, request }) => {
    const id = 'cien-nad-prabutami';
    const editionResponse = await request.get('/api/adventure-dossier/playtest?adventureId=' + id);
    expect(editionResponse.status()).toBe(200);
    const edition = await editionResponse.json();
    const adventure = getAdventureById(id)!;
    const tape = adventure.handouts!.find(h => h.slug === 'audio-sb-wiretap-elblag')!;
    expect(tape.audioUrl).toBeTruthy();
    const audio = await request.get(tape.audioUrl!);
    expect(audio.status()).toBe(200);
    expect(audio.headers()['content-type']).toMatch(/^audio\//);
    expect((await audio.body()).length).toBeGreaterThan(1000);
    const character = { ...getStrefa11CharactersForAdventure(id)[0], isActive: true, equipment: [], journal: [], sceneCards: [] };
    const binding = { adventureId: id, editionFingerprint: edition.editionFingerprint };
    const allowed = ['prabuty.media.clue-photo-prabuty-1947', 'prabuty.media.audio-sb-wiretap-elblag'];
    const fixture = { locale, character, binding, allowed, adventure: { ...adventure, locale, graph: undefined } };
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' || m.text().includes('MISSING_MESSAGE')) errors.push(m.text()); });
    await page.addInitScript(data => {
      for (const key of ['onboarding_completed', 'rules_onboarding_completed', 'session_zero_completed', 'straznik_beta_welcome_dismissed', 'has_started_game']) localStorage.setItem(key, 'true');
      localStorage.setItem('health_check_last_run', String(Date.now()));
      localStorage.setItem('language_selected', data.locale);
      localStorage.setItem('characters', JSON.stringify([data.character]));
      localStorage.setItem('adventure_context', JSON.stringify(data.adventure));
      localStorage.setItem('ai_settings', JSON.stringify({ qualityPreset: 'high', imageGenerationEnabled: false, voiceSettings: { enabled: false } }));
      localStorage.setItem('zew-app-api-keys', JSON.stringify({ GEMINI_API_KEY: 'e2e-local-key', GEMINI_TIER: 'paid' }));
      localStorage.setItem('pdf_memory', JSON.stringify({ adventureId: data.binding.adventureId, adventureDossierFingerprint: data.binding.editionFingerprint, adventureDossierStatus: 'ready', rulesUrl: '/data/rag/rules.json' }));
      localStorage.setItem('zew-campaign-memory-scope', JSON.stringify({ schemaVersion: 1, playthroughId: 'media-render-run', campaignDefinitionId: 'scenario:' + data.binding.adventureId, adventureId: data.binding.adventureId, kind: 'scenario' }));
      localStorage.setItem('zew_chat_messages', JSON.stringify([{ id: 'accepted-media', role: 'assistant', timestamp: new Date().toISOString(), content: data.allowed.map((record: string) => '[HANDOUT:' + record + ']').join('\n\n'), dossierHandoutRecordIds: data.allowed, dossierHandoutBinding: data.binding }]));
    }, JSON.parse(JSON.stringify(fixture)));
    await page.route(/https:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\//, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><title>Background media test fixture</title></html>' }));
    await page.route('**/api/**', route => {
      if (new URL(route.request().url()).pathname === '/api/adventure-dossier/playtest') return route.continue();
      return route.fulfill({ json: { success: true, recordCount: 1, hasBaseRules: true } });
    });
    await page.goto('/' + locale);
    const cards = page.getByTestId('authored-dossier-handout');
    await expect(cards).toHaveCount(2);
    const tapeCard = cards.filter({ hasText: tape.title });
    await expect(tapeCard.getByRole('button', { name: locale === 'pl' ? 'Odtwórz' : 'Play', exact: true })).toBeEnabled({ timeout: 20000 });
    const play = tapeCard.getByRole('button', { name: locale === 'pl' ? 'Odtwórz' : 'Play', exact: true });
    await play.click();
    const pause = tapeCard.getByRole('button', { name: locale === 'pl' ? 'Wstrzymaj' : 'Pause', exact: true });
    await expect(pause).toBeVisible();
    await pause.click();
    await expect(play).toBeVisible();
    await expect(cards.first()).toContainText('1947');
    await page.screenshot({ path: `test-results/unified/dossier-media-${locale}.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}
