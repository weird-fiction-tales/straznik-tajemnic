import { expect, test } from '@playwright/test';

for (const locale of ['pl', 'en'] as const) {
  test(`context budget: recover and retry (${locale})`, async ({
    page,
  }, testInfo) => {
    const appOrigin = new URL(
      testInfo.project.use.baseURL ?? 'http://localhost:3000'
    ).origin;
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.text().includes('MISSING_MESSAGE'))
        errors.push(msg.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/*', (route) =>
      new URL(route.request().url()).origin === appOrigin
        ? route.continue()
        : route.fulfill({ status: 200, body: '' })
    );
    await page.route('**/*default-gm-prompt*.md', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: 'Synthetic game master prompt.',
      })
    );
    await page.route('**/api/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, recordCount: 1 }),
      })
    );
    await page.addInitScript((selectedLocale) => {
      localStorage.clear();
      for (const key of [
        'onboarding_completed',
        'has_started_game',
        'session_zero_completed',
        'rules_onboarding_completed',
      ])
        localStorage.setItem(key, 'true');
      localStorage.setItem('language_selected', selectedLocale);
      localStorage.setItem('straznik_beta_welcome_dismissed', 'true');
      localStorage.setItem('health_check_last_run', String(Date.now()));
      localStorage.setItem(
        'zew-app-api-keys',
        JSON.stringify({ GEMINI_API_KEY: 'synthetic-local-test-key' })
      );
      localStorage.setItem(
        'pdf_memory',
        JSON.stringify({ rulesUrl: '/synthetic-rules' })
      );
      localStorage.setItem(
        'zew_chat_messages',
        JSON.stringify([
          {
            id: 'past',
            role: 'assistant',
            content:
              selectedLocale === 'pl'
                ? 'Czekasz przed biblioteką.'
                : 'You wait outside the library.',
            timestamp: '2026-10-31T12:00:00Z',
          },
        ])
      );
      const originalFetch = window.fetch.bind(window);
      let calls = 0;
      // Return the real HTTP error shape without a browser network-error log.
      // Server integration is independently covered by the real-pipeline Jest suite.
      window.fetch = async (input, init) => {
        if (String(input).includes('/api/chat') && init?.method === 'POST') {
          calls++;
          if (calls === 1)
            return new Response(
              JSON.stringify({ code: 'CAMPAIGN_CONTEXT_BUDGET_EXCEEDED' }),
              { status: 422, headers: { 'Content-Type': 'application/json' } }
            );
          const text =
            selectedLocale === 'pl'
              ? 'Bibliotekarz czeka na twoje pytanie.'
              : 'The librarian waits for your question.';
          return new Response(
            `data: ${JSON.stringify({ type: 'text', content: text })}\n\ndata: ${JSON.stringify({ type: 'metadata', finishReason: 'STOP' })}\n\n`,
            { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
          );
        }
        return originalFetch(input, init);
      };
    }, locale);
    await page.goto(`/${locale}`);
    await page
      .getByRole('button', {
        name: locale === 'pl' ? 'Lektor: Wł' : 'Narrator: On',
        exact: true,
      })
      .click();
    const action =
      locale === 'pl'
        ? 'Pytam o godziny otwarcia.'
        : 'I ask about the opening hours.';
    const input = page.locator('textarea').first();
    await expect(input).toBeVisible();
    await input.fill(action);
    await input.press('Enter');
    await expect(
      page
        .getByText(locale === 'pl' ? 'Tura zatrzymana' : 'Turn paused', {
          exact: true,
        })
        .first()
    ).toBeVisible();
    await expect(input).toHaveValue(action);
    const history = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('zew_chat_messages') ?? '[]')
    );
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe('past');
    await page.screenshot({
      path: testInfo.outputPath(`paused-${locale}.png`),
      fullPage: true,
    });
    await input.press('Enter');
    await expect(
      page.getByText(
        locale === 'pl'
          ? 'Bibliotekarz czeka na twoje pytanie.'
          : 'The librarian waits for your question.',
        { exact: true }
      )
    ).toBeVisible();
    await expect(
      page
        .getByText(locale === 'pl' ? 'Tura zatrzymana' : 'Turn paused', {
          exact: true,
        })
        .first()
    ).not.toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`success-${locale}.png`),
      fullPage: true,
    });
    await testInfo.attach('console-errors', {
      body: JSON.stringify(errors),
      contentType: 'application/json',
    });
    expect(errors).toEqual([]);
  });
}
