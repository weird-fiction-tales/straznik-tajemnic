import { expect, test } from '@playwright/test';

for (const locale of ['pl', 'en'] as const) {
  test(`narrative formatting cards render in ${locale}`, async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });

    const content =
      locale === 'pl'
        ? [
            'W pokoju redakcyjnym unosi się dym z papierosów.',
            '',
            '📜 DOKUMENT ŚLEDCZY: RAPORT',
            'Teczka zawiera kopię rozmowy z archiwum.',
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            '',
            'Helena Krawczyk: „Góra dała zielone światło na ten odcinek”.',
            '',
            '[RZUT 42]',
            '',
            '@E2E Investigator: Rozpoznajesz głos z nagrania.',
            '',
            '[Co robisz?]',
          ].join('\n')
        : [
            'Smoke from cheap cigarettes hangs in the editorial room.',
            '',
            '📜 INVESTIGATION REPORT',
            'The folder contains a copy of the archive interview.',
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            '',
            'Helena Krawczyk: „The network approved this segment”.',
            '',
            '[RZUT 42]',
            '',
            '@E2E Investigator: You recognize the voice from the recording.',
            '',
            '[What do you do?]',
          ].join('\n');

    await page.addInitScript(
      ({ selectedLocale, messageContent }) => {
        localStorage.clear();
        localStorage.setItem('onboarding_completed', 'true');
        localStorage.setItem('rules_onboarding_completed', 'true');
        localStorage.setItem('has_started_game', 'true');
        localStorage.setItem('session_zero_completed', 'true');
        localStorage.setItem('straznik_beta_welcome_dismissed', 'true');
        localStorage.setItem('health_check_last_run', String(Date.now()));
        localStorage.setItem('language_selected', selectedLocale);
        localStorage.setItem(
          'zew-app-api-keys',
          JSON.stringify({ GEMINI_API_KEY: 'e2e-local-key' })
        );
        localStorage.setItem(
          'pdf_memory',
          JSON.stringify({ rulesUrl: '/data/rag/rules.json' })
        );
        localStorage.setItem(
          'zew_chat_messages',
          JSON.stringify([
            {
              id: 'narrative-formatting-fixture',
              role: 'assistant',
              content: messageContent,
              timestamp: '2026-10-22T19:10:23.000Z',
            },
          ])
        );
        localStorage.setItem(
          'characters',
          JSON.stringify([
            {
              id: 'narrative-formatting-investigator',
              name: 'E2E Investigator',
              occupation: 'Journalist',
              age: 35,
              gender: 'male',
              str: 60,
              dex: 60,
              con: 60,
              app: 50,
              pow: 50,
              edu: 60,
              siz: 60,
              int: 60,
              luck: 50,
              hp: 12,
              maxHp: 12,
              san: 50,
              maxSan: 99,
              mp: 10,
              maxMp: 10,
              background: '',
              skills: {},
              equipment: [],
              playerName: '',
              isActive: true,
              lastUsed: '2026-10-22T19:10:23.000Z',
              notes: '',
              experience: {
                totalXP: 0,
                availableXP: 0,
                earnedThisSession: 0,
                maxEarnedThisSession: 0,
              },
              developmentHistory: [],
            },
          ])
        );
        localStorage.setItem(
          'active_character_id',
          'narrative-formatting-investigator'
        );
      },
      { selectedLocale: locale, messageContent: content }
    );

    await page.route('**/api/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, recordCount: 1 }),
      })
    );

    await page.goto(`/${locale}`);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(
      page.getByPlaceholder(
        locale === 'pl'
          ? 'Wpisz wiadomość do Mistrza Gry...'
          : 'Write a message to the Game Master...'
      )
    ).toBeVisible();

    const narrative = page
      .locator('.narrative-content')
      .filter({ hasText: 'Helena Krawczyk' });
    const speaker = narrative.getByText('Helena Krawczyk', { exact: true });
    await expect(speaker).toBeVisible();
    const dialogueCard = speaker.locator('xpath=..');
    await expect(dialogueCard).toHaveClass(/border-l-2/);
    await expect(dialogueCard.locator('p')).toContainText(
      locale === 'pl'
        ? '„Góra dała zielone światło na ten odcinek”.'
        : '„The network approved this segment”.'
    );

    const handoutText = narrative.getByText(
      locale === 'pl'
        ? 'Teczka zawiera kopię rozmowy z archiwum.'
        : 'The folder contains a copy of the archive interview.'
    );
    await expect(handoutText).toBeVisible();
    await expect(handoutText.locator('xpath=..')).toHaveClass(/\bborder\b/);

    const rollText = narrative.getByText('RZUT 42', { exact: true });
    await expect(rollText).toBeVisible();
    await expect(rollText.locator('xpath=../..')).toHaveClass(
      /border-brass\/30/
    );

    const perspectiveText = narrative.getByText(
      locale === 'pl'
        ? 'Rozpoznajesz głos z nagrania.'
        : 'You recognize the voice from the recording.',
      { exact: true }
    );
    const perspectiveCard = perspectiveText.locator('xpath=..');
    await expect(perspectiveText).toBeVisible();
    await expect(perspectiveCard).toHaveCSS('border-left-width', '4px');

    const whisper = narrative.locator('div[class~="bg-muted/30"]').filter({
      hasText: locale === 'pl' ? 'Co robisz?' : 'What do you do?',
    });
    await expect(whisper).toBeVisible();
    await expect(whisper).toContainText(
      locale === 'pl' ? 'Co robisz?' : 'What do you do?'
    );

    await expect(page.locator('body')).not.toContainText('MISSING_MESSAGE');
    expect(runtimeErrors).toEqual([]);
    await page.screenshot({
      path: `test-results/narrative-formatting-${locale}.png`,
    });
  });
}
