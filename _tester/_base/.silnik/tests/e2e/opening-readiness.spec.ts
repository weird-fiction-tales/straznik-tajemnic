import { expect, test } from '@playwright/test';
import { STREFA_11_ADVENTURES } from '../../src/lib/adventures-data';
import { defaultAISettings } from '../../src/lib/ai-settings/defaults';
import path from 'node:path';
import { fingerprintLocalDraftPayload } from '../../src/lib/adventure-dossier/runtime-authorization';
import type { DossierRagPayload } from '../../src/lib/adventure-dossier/rag-schema';

const adventure = STREFA_11_ADVENTURES.find(a => a.id === 'cien-nad-prabutami')!;
const place = "Redakcja 'Sygnałów Nieznanego' (RTV Warszawa)";
const character = { id: 'opening-investigator', name: 'Tomasz Nowicki', occupation: 'Dziennikarz', age: 42,
  str: 50, dex: 50, con: 50, int: 50, pow: 50, edu: 50, app: 50, siz: 50,
  hp: 10, maxHp: 10, san: 50, maxSan: 99, mp: 10, luck: 50, skills: {}, equipment: [],
  journal: [], background: '', notes: '', isActive: true, lastUsed: new Date(0).toISOString(),
  experience: { totalXP: 0, availableXP: 0, earnedThisSession: 0, maxEarnedThisSession: 10 }, developmentHistory: [] };

const wav = Buffer.alloc(44 + 8000);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(8000, 40);
const audioUrl = 'data:audio/wav;base64,' + wav.toString('base64');

for (const locale of ['pl', 'en'] as const) for (const incomplete of [false, true]) {
  test(`${locale}: opening readiness, incomplete=${incomplete}`, async ({ page }) => {
    await page.setViewportSize({ width: 1680, height: 1000 });
    let releaseLastAudio!: () => void;
    const lastAudio = new Promise<void>(resolve => { releaseLastAudio = resolve; });
    let audioRequests = 0;
    const payload: DossierRagPayload = {schema_version: 1, adventure_id: adventure.id, edition_fingerprint: '', records: [{
      schema_version: 1, record_id: 'readiness-scene', record_type: 'scene', adventure_id: adventure.id, edition_fingerprint: '',
      language: locale, content: 'Neutral opening readiness fixture.',
      tags: {entities: [], scenes: ['node-warszawa-redakcja'], mechanics: [], topics: [], triggers: []},
      retrieval: {visibility: 'gm_only', availability: 'when_scene_active', condition: null, priority: 1},
      evidence: {provenance: 'approved_design', source_ref: 'synthetic-readiness-test', status: 'set', approval: 'pending', approved_by: null, approved_at: null}, links: [],
    }]};
    const fingerprint = await fingerprintLocalDraftPayload(payload);
    payload.edition_fingerprint = fingerprint;
    payload.records[0].edition_fingerprint = fingerprint;
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://www.youtube.com/**', route => route.fulfill({ status: 200,
      contentType: route.request().resourceType() === 'script' ? 'application/javascript' : 'text/html', body: '' }));
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/adventure-dossier/playtest') return route.fulfill({json: {mode: 'local_playtest', humanApproval: 'pending', adventureId: adventure.id, editionFingerprint: fingerprint, payload}});
      if (url.pathname === '/api/adventure-dossier/activate') return route.fulfill({json: {activated: true}});
      if (url.pathname === '/api/memory/turn') {
        const body = route.request().postDataJSON();
        return route.fulfill({json: body.phase === 'prepare' ? {prepared: true} : {accepted: body.accepted}});
      }
      if (url.pathname === '/api/tts/gemini') {
        if (route.request().method() === 'GET') return route.fulfill({json: {provider: 'gemini', voice: 'Algenib'}});
        audioRequests++;
        if (audioRequests >= 2) await lastAudio;
        return route.fulfill({json: {success: true, audioUrl, provider: 'gemini', voice: 'Algenib'}});
      }
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
        const text = `[${locale === 'en' ? 'LOCATION' : 'LOKACJA'}: ${place} | Paper and tobacco.]\n\n${prose}\n\n${locale === 'pl' ? 'To ostatni akapit pełnego otwarcia. Helena oczekuje na twoje pytania.' : 'This is the final paragraph of the complete opening. Helena waits for your questions.'}\n\n[${locale === 'en' ? 'What do you do?' : 'Co robisz?'}]`;
        return route.fulfill({ status: 200, contentType: 'text/event-stream', body:
          `data: ${JSON.stringify({ type: 'text', content: text })}\n\ndata: ${JSON.stringify({ type: 'metadata', dossierFinalizationToken: 'readiness-token', dossierInventoryWritesAllowed: false, finishReason: incomplete ? 'MAX_TOKENS' : 'STOP' })}\n\ndata: ${JSON.stringify({ type: 'done' })}\n\n` });
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
        'zew-app-api-keys': JSON.stringify({ GEMINI_API_KEY: 'synthetic-browser-test', GEMINI_TIER: 'paid' }),
        adventure_context: JSON.stringify({ ...adventure, locale, activeNodeId: 'node-elblag-klasztor' }),
        characters: JSON.stringify([character]), ai_settings: JSON.stringify(settings),
      })) localStorage.setItem(k, v);
    }, { locale, adventure, character, settings: { ...defaultAISettings, imageGenerationEnabled: false,
      voiceSettings: { ...defaultAISettings.voiceSettings, enabled: true } } });
    await page.goto(`/${locale}`);
    const panel = page.getByTestId('manual-setup-panel');
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: locale === 'en' ? /Start Game/i : /Rozpocznij grę/i }).click();
    const enter = page.getByTestId('loading-screen-enter-cta');
    const loading = page.getByTestId('tts-hard-loading-screen');
    if (incomplete) {
      await expect(page.getByTestId('loading-screen-error-container')).toBeVisible();
      await expect(enter).toHaveCount(0);
      await expect(loading).toContainText(locale === 'pl' ? 'Otwarcie nie jest jeszcze gotowe' : 'The opening is not ready');
      await expect(loading).not.toContainText('100%');
      await page.screenshot({path: path.resolve(__dirname, '../../test-results/issue-848', `incomplete-${locale}.png`), fullPage: true});
    } else {
      await expect.poll(() => audioRequests).toBeGreaterThanOrEqual(2);
      await expect(enter).toHaveCount(0);
      await expect(loading).not.toContainText('100%');
      await expect(loading).toContainText(locale === 'pl' ? 'Przygotowanie całego nagrania lektora' : 'Preparing the complete opening narration');
      await page.screenshot({path: path.resolve(__dirname, '../../test-results/issue-848', `buffering-${locale}.png`), fullPage: true});
      releaseLastAudio();
      await expect(enter).toBeVisible({timeout: 15000});
      await expect(loading).toContainText('100%');
      await page.screenshot({path: path.resolve(__dirname, '../../test-results/issue-848', `ready-${locale}.png`), fullPage: true});
      await enter.click();
      await expect(loading).not.toBeVisible();
      await expect(page.getByText(locale === 'pl' ? /To ostatni akapit pełnego otwarcia/ : /This is the final paragraph of the complete opening/).first()).toBeVisible();
      await page.screenshot({path: path.resolve(__dirname, '../../test-results/issue-848', `entered-${locale}.png`), fullPage: true});
    }
    await expect(page.locator('body')).not.toContainText('MISSING_MESSAGE');
    expect(errors).toEqual([]);
  });
}
