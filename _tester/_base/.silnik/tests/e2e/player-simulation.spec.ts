import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Visual Player Simulation E2E Test (Obowiązkowy Test Gracza)
 *
 * Zgodnie z nową regułą skilla aios-vibe-coder:
 * 1. Playwright uruchamia aplikację, wchodzi w rolę gracza (symulacja sesji z mockiem AI).
 * 2. Przeklikuje kluczowe panele (Szybki Start, wybór postaci, czat z MG, ekwipunek).
 * 3. Żelazne warunki wejścia:
 *    - Zero błędów w konsoli (brak console.error, TypeError, Unhandled, ReferenceError).
 *    - Screenshot Evidence zapisany do test-results/player-simulation.png potwierdzający
 *      renderowanie elementów i przeliczeń.
 */

test.describe('Visual Player Simulation - Obowiązkowy Test Gracza E2E', () => {
  test.setTimeout(90000);

  test('Symulacja gracza: Szybki Start -> Rozmowa z MG -> Ekwipunek -> Screenshot', async ({ page }) => {
    const consoleErrors: string[] = [];

    // Nasłuch na błędy konsoli i nieobsłużone wyjątki
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[console.error] ${msg.text()}`);
      }
    });

    page.on('pageerror', (err) => {
      consoleErrors.push(`[pageerror] ${err.name || 'Error'}: ${err.message || String(err)}`);
    });

    // Inicjalizacja localStorage (PL, pominięcie onboardingów, odblokowanie zasad i kluczy API)
    await page.addInitScript(() => {
      if (sessionStorage.getItem('journal-simulation-initialized')) return;
      sessionStorage.setItem('journal-simulation-initialized', 'true');
      localStorage.clear();
      localStorage.setItem('language_selected', 'pl');
      localStorage.setItem('onboarding_completed', 'true');
      localStorage.setItem('rules_onboarding_completed', 'true');
      localStorage.setItem('straznik_beta_welcome_dismissed', 'true');
      localStorage.setItem('coc7_rulebook_profile', 'starter-d100');
      localStorage.setItem('coc7_rulebook_title', 'Starter CoC 7e');
      localStorage.setItem(
        'zew-app-api-keys',
        JSON.stringify({ gemini: 'mock-key', GEMINI_API_KEY: 'mock-key' })
      );
      localStorage.setItem('health_check_last_run', String(Date.now()));
    });

    const gmNarrations = [
      'Rozpoczyna się wasza historia.',
      '[ZMIANA_SCENY: Archiwum] W archiwum Stanisław twierdzi, że list wysłano z doków. [NPC: Stanisław: Archiwista]',
      'Kończycie rozmowę i wychodzicie na korytarz. [ZMIANA_SCENY: Korytarz] Stanisław twierdził, że list wysłano z doków.',
      'Stanisław powtarza, że usłyszał to od portiera.',
      'Na korytarzu cichną kroki. [KONIEC_SESJI:POTWIERDZENIE]',
      'Następnego spotkania wychodzicie na ulicę. [ZMIANA_SCENY: Ulica] Słychać dzwony.',
    ];
    let chatTurn = 0;
    let savedGame: Record<string, unknown> | undefined;
    await page.route('**/api/memory/restore', async (route) => {
      const payload = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, scope: payload.scope ?? {
          schemaVersion: 1, campaignDefinitionId: 'scenario:test',
          playthroughId: 'run-test', adventureId: 'test', kind: 'scenario',
        } }) });
    });

    // Mock tras sieciowych Playwright (żelazny warunek: bramka zasad BYOB i strumień czatu MG)
    await page.route('**/api/desktop/update/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'none', state: 'idle', updatedAt: '1970-01-01T00:00:00.000Z' }),
      });
    });

    await page.route('**/api/desktop/update/check', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ available: false, currentVersion: '0.9.5' }),
      });
    });

    await page.route('**/api/pdf/ingest-local*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          recordCount: 150,
          rulebookProfile: { profile: 'starter-d100', title: 'Starter CoC 7e' },
        }),
      });
    });

    let summaryAttempts = 0;
    await page.route('**/api/summarize-scene', async (route) => {
      const payload = route.request().postDataJSON() as { locale?: string; sceneLocation?: string; messages: Array<{ content: string }> };
      if (payload.sceneLocation === 'Archiwum') {
        summaryAttempts += 1;
        expect(payload.messages.map((message) => message.content).join(' ')).toContain('W archiwum Stanisław twierdzi');
      }
      if (payload.sceneLocation === 'Archiwum' && summaryAttempts === 1) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Temporary model failure' }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          entry: {
            content:
              payload.locale === 'en'
                ? 'Stanisław claimed the letter had been sent from the docks.'
                : 'Stanisław twierdził, że list wysłano z doków.',
          },
          summaries: {
            pl: 'Stanisław twierdził, że list wysłano z doków.',
            en: 'Stanisław claimed the letter had been sent from the docks.',
          },
        }),
      });
    });

    await page.route('**/api/game-save*', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        savedGame = request.postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            saveId: savedGame.id,
            formattedSize: '1 KB',
            messageCount: 3,
            imageCount: 0,
          }),
        });
        return;
      }

      if (request.url().includes('list=true')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            saves: savedGame
              ? [
                  {
                    id: savedGame.id,
                    userId: 'local',
                    name: 'Kronika testowa',
                    createdAt: '2026-10-10T10:00:00.000Z',
                    formattedSize: '1 KB',
                    messageCount: 3,
                    imageCount: 0,
                  },
                ]
              : [],
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ save: savedGame }),
      });
    });

    await page.route('**/api/chat**', async (route) => {
      if (route.request().url().includes('/api/chat-test')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, tier: 'free' }),
        });
        return;
      }

      const gmNarration = gmNarrations[Math.min(chatTurn, gmNarrations.length - 1)];
      chatTurn += 1;
      const sseBody = [
        `data: ${JSON.stringify({ text: gmNarration })}\n\n`,
        `data: ${JSON.stringify({
          type: 'metadata',
          illustrations: [],
          dialogues: [],
          costData: { totalTokens: 50 },
        })}\n\n`,
      ].join('');

      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
        body: sseBody,
      });
    });

    // 1. Otwarcie strony głównej
    await page.goto('/pl');
    await page.waitForLoadState('domcontentloaded');

    // Zamknięcie ewentualnych modalów wstępnych (np. podręcznik lub beta)
    const modalCloseButtons = page.locator(
      'button:has-text("Przejdź do gry"), button:has-text("Rozumiem"), button[aria-label="Close"]'
    );
    if (await modalCloseButtons.first().isVisible({ timeout: 1000 }).catch(() => false)) {
      await modalCloseButtons.first().click();
    }

    // 2. Kliknięcie w Szybki Start (Quick Setup)
    const quickSetupBtn = page.locator('[data-testid="btn-quick-setup"]');
    await expect(quickSetupBtn).toBeVisible({ timeout: 15000 });
    await quickSetupBtn.click();

    // 3. Wybór postaci w QuickSetupModal
    const quickModal = page.locator('[data-testid="quick-setup-modal"]');
    await expect(quickModal).toBeVisible({ timeout: 10000 });

    const firstCharCard = quickModal.locator('.aspect-\\[3\\/4\\]').first();
    await expect(firstCharCard).toBeVisible({ timeout: 5000 });
    await firstCharCard.click();

    const startAdventureBtn = quickModal.getByRole('button', { name: /Rozpocznij przygodę|Start/i });
    await expect(startAdventureBtn).toBeEnabled({ timeout: 5000 });
    await startAdventureBtn.click();

    // Upewnij się, że QuickSetupModal zniknął
    await expect(quickModal).toBeHidden({ timeout: 5000 });

    // 4. Obsługa ekranu wejścia do gry (TTSHardLoadingScreen / Enter CTA)
    const enterCta = page.locator('[data-testid="loading-screen-enter-cta"]');
    await expect(enterCta).toBeVisible({ timeout: 30000 });
    await enterCta.click();
    await expect(enterCta).toBeHidden({ timeout: 5000 });

    // 5. Weryfikacja wejścia do okna czatu i interakcja gracza
    const chatInput = page.locator('textarea[placeholder*="Mistrza Gry"], textarea[placeholder*="wiadomość"], textarea').first();
    await expect(chatInput).toBeVisible({ timeout: 20000 });

    // Quick Start wysyła narrację otwierającą przed pierwszą turą gracza.
    await expect(page.locator('body')).toContainText('Rozpoczyna się wasza historia.', { timeout: 15000 });
    await expect(chatInput).toBeEnabled();
    await chatInput.fill('Wchodzę do archiwum i rozglądam się po pokoju.');
    await chatInput.press('Enter');
    await expect(page.locator('body')).toContainText('Stanisław twierdzi', { timeout: 15000 });
    await expect(chatInput).toBeEnabled();
    const summaryResponse = page.waitForResponse((response) => response.url().includes('/api/summarize-scene') && response.request().postDataJSON().sceneLocation === 'Archiwum');
    await chatInput.fill('Pytam Stanisława o źródło tej informacji.');
    await chatInput.press('Enter');
    await expect(page.locator('body')).toContainText('wychodzicie na korytarz', { timeout: 15000 });
    await summaryResponse;
    expect(summaryAttempts).toBe(1);
    await expect(chatInput).toBeEnabled();
    await chatInput.fill('Dopytuję, kto przekazał tę wiadomość.');
    await chatInput.press('Enter');
    await expect(page.locator('body')).toContainText('usłyszał to od portiera');
    await expect.poll(() => summaryAttempts).toBeGreaterThanOrEqual(2);

    // Zakończona scena trafia do Dziennika z zachowaną atrybucją plotki.
    await page.locator('[data-testid="btn-open-journal"]').click();
    let journal = page.locator('[data-testid="session-journal"]');
    await expect(journal).toBeVisible({ timeout: 10000 });
    await journal.getByRole('button', { name: /^Kronika/ }).click();
    await expect(journal.getByTestId('journal-session-header')).toContainText('Sesja 1');
    await journal.getByRole('button', { name: /Scena #\d+ Archiwum/i }).click();
    await expect(journal.getByTestId('journal-entry').filter({ has: page.getByRole('heading', { name: 'Archiwum', exact: true }) }).getByTestId('scene-chronicle-summary')).toContainText(
      'Stanisław twierdził, że list wysłano z doków.'
    );
    await page.screenshot({ path: 'test-results/player-journal-pl.png' });
    await journal.getByRole('button', { name: 'Zamknij dziennik' }).click();

    // Zapis i wczytanie pełnej gry zachowuje obie wersje językowe wpisu.
    await page.getByRole('button', { name: 'Zapisz', exact: true }).click();
    await page
      .getByPlaceholder(/Rozdział 1|Chapter 1/i)
      .fill('Kronika testowa');
    await page.getByRole('button', { name: /Zapisz grę/i }).click();
    await expect.poll(() => savedGame !== undefined).toBe(true);
    const savedCharacters = savedGame?.characters as Array<{
      sceneCards?: Array<{
        chronicleSummaryByLocale?: { pl?: string; en?: string };
      }>;
    }>;
    expect(savedCharacters[0]?.sceneCards?.find((scene) => scene.chronicleSummaryByLocale)?.chronicleSummaryByLocale).toEqual({
      pl: 'Stanisław twierdził, że list wysłano z doków.',
      en: 'Stanisław claimed the letter had been sent from the docks.',
    });

    await page.getByRole('button', { name: 'Wczytaj', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Kronika testowa', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Wczytaj', exact: true }).last().click();
    await page.locator('[data-testid="btn-open-journal"]').click();
    journal = page.locator('[data-testid="session-journal"]');
    await journal.getByRole('button', { name: /^Kronika/ }).click();
    await journal.getByRole('button', { name: /Scena #\d+ Archiwum/i }).click();
    await expect(journal.getByTestId('journal-entry').filter({ has: page.getByRole('heading', { name: 'Archiwum', exact: true }) }).getByTestId('scene-chronicle-summary')).toContainText(
      'Stanisław twierdził, że list wysłano z doków.'
    );
    await journal.getByRole('button', { name: 'Zamknij dziennik' }).click();

    // Potwierdzony koniec domyka ostatnią scenę przed autozapisem.
    await chatInput.fill('Kończymy dzisiejsze spotkanie.');
    await chatInput.press('Enter');
    await expect.poll(() => {
      const characters = savedGame?.characters as Array<{ chronicleSession?: { closedByMessageId?: string } }> | undefined;
      return Boolean(characters?.[0]?.chronicleSession?.closedByMessageId);
    }).toBe(true);
    const closedCharacters = savedGame?.characters as Array<{ chronicleSession: { sessionNumber: number }; sceneCards: Array<{ location: string; chronicleChapter: { sessionNumber: number } }> }>;
    expect(closedCharacters[0].chronicleSession.sessionNumber).toBe(1);
    expect(closedCharacters[0].sceneCards.some((scene) => scene.location === 'Korytarz' && scene.chronicleChapter.sessionNumber === 1)).toBe(true);
    await page.getByRole('button', { name: 'Wczytaj', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Kronika testowa', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Wczytaj', exact: true }).last().click();
    await chatInput.fill('Kontynuujemy naszą historię.');
    await chatInput.press('Enter');
    await expect.poll(() => page.evaluate(() => {
      const characters = JSON.parse(localStorage.getItem('characters') ?? '[]');
      return characters.find((character: { isActive?: boolean }) => character.isActive)?.chronicleSession?.sessionNumber;
    })).toBe(2);
    await page.getByTestId('btn-open-journal').click();
    journal = page.getByTestId('session-journal');
    await journal.getByRole('button', { name: /^Kronika/ }).click();
    await expect(journal.getByTestId('journal-session-header')).toHaveText(['Sesja 1', 'Sesja 2']);
    await page.screenshot({ path: 'test-results/journal-chapters-pl.png' });
    await journal.getByRole('button', { name: 'Zamknij dziennik' }).click();

    // 6. Otwarcie panelu bocznego (Ekwipunek)
    const eqBtn = page.locator('[data-testid="btn-open-equipment"]');
    await expect(eqBtn).toBeVisible({ timeout: 10000 });
    await eqBtn.click();

    const eqModal = page.locator('[data-testid="equipment-modal"]');
    await expect(eqModal).toBeVisible({ timeout: 10000 });

    // Przełączenie na zakładkę Wyposażenie (żeby pokazać listę przedmiotów badacza)
    const gearTab = eqModal.getByRole('button', { name: /WYPOSAŻENIE|EQUIPMENT/i });
    if (await gearTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gearTab.click();
    }

    // Asercja na widoczność kluczowych elementów przed zrzutem ekranu
    const financeBar = page.locator('[data-testid="equipment-finance-bar"]');
    await expect(financeBar).toBeVisible({ timeout: 5000 });
    await expect(eqModal.locator('.font-serif').first()).toBeVisible({ timeout: 5000 });

    // Startup locale follows the active adventure and latest save metadata.
    await page.evaluate(() => {
      localStorage.setItem('language_selected', 'en');
      const adventure = JSON.parse(localStorage.getItem('adventure_context') ?? 'null');
      if (adventure) localStorage.setItem('adventure_context', JSON.stringify({ ...adventure, locale: 'en' }));
      const saves = JSON.parse(localStorage.getItem('zew-game-saves-list') ?? '[]');
      localStorage.setItem('zew-game-saves-list', JSON.stringify(saves.map((save: Record<string, unknown>) => ({ ...save, locale: 'en' }))));
      document.cookie = 'NEXT_LOCALE=en;path=/';
    });
    await page.goto('/en');
    await expect(page).toHaveURL(/\/en/);
    await page.locator('[data-testid="btn-open-journal"]').click();
    journal = page.locator('[data-testid="session-journal"]');
    await journal.getByRole('button', { name: /^Chronicle/ }).click();
    await expect(journal.getByTestId('journal-session-header')).toHaveText(['Session 1', 'Session 2']);
    await journal.getByRole('button', { name: /Scene #\d+ Archiwum/i }).click();
    await expect(journal.getByTestId('journal-entry').filter({ has: page.getByRole('heading', { name: 'Archiwum', exact: true }) }).getByTestId('scene-chronicle-summary')).toContainText(
      'Stanisław claimed the letter had been sent from the docks.'
    );

    // 7. Zapisanie zrzutu ekranu jako dowodu (Screenshot Evidence)
    const resultsDir = path.resolve(process.cwd(), 'test-results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    const screenshotPath = path.join(resultsDir, 'player-simulation.png');
    await page.screenshot({ path: screenshotPath });

    expect(fs.existsSync(screenshotPath)).toBe(true);

    // 8. Żelazny warunek wejścia: zero błędów w konsoli przeglądarki i unhandled exceptions
    const fatalErrors = consoleErrors.filter((err) => {
      // Ignoruj komunikaty systemowe/przeglądarkowe Chromium (np. brak polityki compute-pressure)
      if (err.includes('Permissions policy violation') || err.includes('compute-pressure')) {
        return false;
      }
      return true;
    });

    expect(fatalErrors).toEqual([]);
  });
});
