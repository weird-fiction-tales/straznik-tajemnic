import { test, expect, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import pl from '../../messages/pl.json';
import en from '../../messages/en.json';
import { defaultAISettings } from '../../src/lib/ai-settings/defaults';

const surfaces: Record<string, string | undefined> = {
  'quick-setup': 'QuickSetupModal.kicker',
  'adventure-selector': 'AdventureSelector.title',
  'adventure-details': undefined,
  'character-wizard': 'CharacterWizard.stepConceptTitle',
  'hot-seat': 'HotSeatSetup.title',
  'session-zero': 'SessionZeroModal.dialogTitle',
  'api-keys': 'ApiKeysModal.title',
  characters: 'CharacterDialog.manageTitle',
  'character-sheet': 'CharacterSheet.dialogTitle',
  equipment: 'EquipmentModal.title',
  'equipment-detail': undefined,
  journal: 'SessionJournal.caseFileTitle',
  development: 'DevelopmentPhaseModal.title',
  'sanity-therapy': 'SanityTherapyModal.title',
  'medical-care': 'MedicalCareModal.title',
  'save-game': 'FullGameSaveModal.saveTitle',
  'load-game': 'FullGameSaveModal.loadTitle',
  help: 'CompendiumModal.title',
  settings: 'SettingsModal.title',
  'new-adventure': 'NewAdventureModal.newAdventureTitle',
  'full-reset': 'FullResetDialog.title',
  rulebook: 'RulebookModal.title',
  'roll-test': undefined,
  'beta-welcome': 'BetaWelcome.title',
  'beta-feedback': 'BetaFeedback.title',
  'language-selection': undefined,
  'image-lightbox': undefined,
  'desktop-update': 'UpdateSettings.modalTitle',
  'session-list': 'SessionList.title',
  'full-reset-final': 'FullResetDialog.lastWarning',
  'combat-card': undefined,
  'spell-card': undefined,
  'tome-card': undefined,
};

function message(locale: 'pl' | 'en', key: string): string {
  let value: unknown = locale === 'pl' ? pl : en;
  for (const part of key.split('.')) {
    if (typeof value !== 'object' || value === null || !(part in value))
      throw new Error(`Missing fixture message ${key}`);
    value = Reflect.get(value, part);
  }
  if (typeof value !== 'string') throw new Error(`Not a message: ${key}`);
  return value;
}

async function surfaceRoot(page: Page, surface: string): Promise<Locator> {
  if (surface === 'image-lightbox') return page.locator('body > .deco-window');
  if (surface.endsWith('-card')) return page.getByTestId('visual-card');
  if (
    [
      'full-reset',
      'full-reset-final',
      'session-list',
      'save-game',
      'load-game',
    ].includes(surface)
  )
    return page.getByTestId('desktop-window-fixture').locator('> div > div');
  if (['character-wizard', 'language-selection'].includes(surface))
    return page
      .getByTestId('desktop-window-fixture')
      .locator('> .fixed')
      .first();
  return page.locator('[role="dialog"]').last();
}

/** Measures actual text boxes and composites translucent solid backgrounds. */
async function measurements(root: Locator) {
  return root.evaluate((container) => {
    const findings: string[] = [];
    const rgba = (value: string): number[] => {
      const ns = value.match(/[\d.]+/g)?.map(Number) ?? [];
      return [ns[0] ?? 0, ns[1] ?? 0, ns[2] ?? 0, ns[3] ?? 1];
    };
    const over = (front: number[], back: number[]): number[] => {
      const alpha = front[3] + back[3] * (1 - front[3]);
      return [0, 1, 2]
        .map(
          (i) =>
            (front[i] * front[3] + back[i] * back[3] * (1 - front[3])) /
            (alpha || 1)
        )
        .concat(alpha);
    };
    const luminance = (color: number[]) =>
      color.slice(0, 3).reduce((sum, v, i) => {
        const x = v / 255;
        return (
          sum +
          (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4) *
            [0.2126, 0.7152, 0.0722][i]
        );
      }, 0);
    const background = (element: Element): number[] => {
      const chain: Element[] = [];
      for (let e: Element | null = element; e; e = e.parentElement)
        chain.unshift(e);
      return chain.reduce(
        (back, e) => over(rgba(getComputedStyle(e).backgroundColor), back),
        [10, 12, 15, 1]
      );
    };
    const visible = (e: Element) => {
      const r = e.getBoundingClientRect();
      if (
        r.width === 0 ||
        r.height === 0 ||
        r.bottom <= 0 ||
        r.top >= innerHeight ||
        r.right <= 0 ||
        r.left >= innerWidth
      )
        return false;
      for (let p: Element | null = e; p; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (
          s.visibility === 'hidden' ||
          s.display === 'none' ||
          Number(s.opacity) === 0
        )
          return false;
        if (p !== e && /(auto|scroll|hidden)/.test(s.overflowY)) {
          const b = p.getBoundingClientRect();
          if (r.bottom <= b.top || r.top >= b.bottom) return false;
        }
      }
      return !e.classList.contains('sr-only');
    };
    const bounds = container.getBoundingClientRect();
    if (
      bounds.left < -1 ||
      bounds.right > innerWidth + 1 ||
      (!container.matches('[data-testid=visual-card]') &&
        (bounds.top < -1 || bounds.bottom > innerHeight + 1))
    )
      findings.push('window outside viewport');
    const textBoxes: { element: HTMLElement; box: DOMRect; label: string }[] =
      [];
    const elements = [
      container,
      ...container.querySelectorAll<HTMLElement>('*'),
    ];
    for (const e of elements) {
      if (!(e instanceof HTMLElement) || !visible(e)) continue;
      const style = getComputedStyle(e),
        r = e.getBoundingClientRect();
      const direct = [...e.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent)
        .join('')
        .trim();
      const label = (
        direct ||
        e.getAttribute('aria-label') ||
        e.textContent ||
        ''
      )
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 90);
      if (
        e.matches(
          'button, [role="tab"], input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), select'
        ) &&
        !e.matches('input[type=file], [role=checkbox], [role=switch]') &&
        (r.height < 43.5 || (e.matches('button, [role=tab]') && r.width < 43.5))
      )
        findings.push(`control ${r.height.toFixed(1)}px: ${label}`);
      const control = e.matches(
        'button:not([role=checkbox]):not([role=switch]), input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]), select, textarea'
      );
      if (
        control &&
        !e.closest(':disabled, [aria-disabled="true"]') &&
        parseFloat(style.borderTopWidth) > 0 &&
        rgba(style.borderTopColor)[3] > 0
      ) {
        const bg = background(e),
          outside = background(e.parentElement || e);
        const border = over(rgba(style.borderTopColor), bg);
        const contrast = (a: number[], b: number[]) =>
          (Math.max(luminance(a), luminance(b)) + 0.05) /
          (Math.min(luminance(a), luminance(b)) + 0.05);
        if (Math.max(contrast(bg, outside), contrast(border, outside)) < 2.95)
          findings.push(`control boundary: ${label}`);
      }
      if (
        e.matches('input[placeholder], textarea[placeholder]') &&
        !e.closest(':disabled')
      ) {
        const placeholder = getComputedStyle(e, '::placeholder');
        const bg = background(e),
          fg = over(rgba(placeholder.color), bg);
        const ratio =
          (Math.max(luminance(fg), luminance(bg)) + 0.05) /
          (Math.min(luminance(fg), luminance(bg)) + 0.05);
        if (ratio < 4.45)
          findings.push(
            `placeholder contrast ${ratio.toFixed(2)}: ${e.getAttribute('placeholder')}`
          );
      }
      if (!direct || !/[\p{L}\d]{2}/u.test(direct)) continue;
      for (const node of e.childNodes)
        if (
          node.nodeType === Node.TEXT_NODE &&
          /[\p{L}\d]{2}/u.test(node.textContent || '')
        ) {
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const box of range.getClientRects()) {
            const hit = document.elementFromPoint(
              Math.max(0, Math.min(innerWidth - 1, box.x + box.width / 2)),
              Math.max(0, Math.min(innerHeight - 1, box.y + box.height / 2))
            );
            if (
              box.width > 0 &&
              box.height > 0 &&
              box.top >= 0 &&
              box.bottom <= innerHeight &&
              hit &&
              (e.contains(hit) || hit.contains(e))
            )
              textBoxes.push({ element: e, box, label });
          }
        }
      const size = parseFloat(style.fontSize);
      const helper =
        /text-(xs|\[1[0-4]px\])|font-(mono|special-elite|display)/.test(
          e.className
        );
      const floor = e.matches('p') && !helper ? 16 : 14;
      if (size < floor - 0.1) findings.push(`font ${size}px: ${label}`);
      let opacity = 1;
      for (let p: Element | null = e; p; p = p.parentElement)
        opacity *= Number(getComputedStyle(p).opacity);
      if (opacity >= 0.99 && !e.closest(':disabled, [aria-disabled="true"]')) {
        const bg = background(e),
          fg = over(rgba(style.color), bg);
        const a = luminance(fg),
          b = luminance(bg);
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        const min =
          size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700)
            ? 3
            : 4.5;
        if (ratio < min - 0.05)
          findings.push(`contrast ${ratio.toFixed(2)}: ${label}`);
      }
      if (
        (style.textOverflow === 'ellipsis' || style.overflowX === 'hidden') &&
        e.scrollWidth > e.clientWidth + 2
      )
        findings.push(`clipped text: ${label}`);
      if (r.left < bounds.left - 2 || r.right > bounds.right + 2)
        findings.push(`horizontal overflow: ${label}`);
    }
    for (let i = 0; i < textBoxes.length; i++)
      for (let j = i + 1; j < textBoxes.length; j++) {
        const a = textBoxes[i],
          b = textBoxes[j];
        if (
          a.element === b.element ||
          a.element.contains(b.element) ||
          b.element.contains(a.element)
        )
          continue;
        if (
          Math.min(a.box.right, b.box.right) -
            Math.max(a.box.left, b.box.left) >
            2 &&
          Math.min(a.box.bottom, b.box.bottom) -
            Math.max(a.box.top, b.box.top) >
            2
        )
          findings.push(`text overlap: ${a.label} / ${b.label}`);
      }
    return [...new Set(findings)];
  });
}

async function scanScrolled(root: Locator): Promise<string[]> {
  const steps = await root.evaluate((e) =>
    Math.max(
      1,
      ...[
        e,
        ...e.querySelectorAll('*'),
        ...(e.matches('[data-testid=visual-card]')
          ? [document.scrollingElement]
          : []),
      ].map((n) =>
        n instanceof HTMLElement &&
        (n === document.scrollingElement ||
          /auto|scroll/.test(getComputedStyle(n).overflowY))
          ? Math.ceil(
              (n.scrollHeight - n.clientHeight) /
                Math.max(100, n.clientHeight * 0.7)
            )
          : 0
      )
    )
  );
  const findings: string[] = [];
  for (let i = 0; i <= steps; i++) {
    await root.evaluate((e, fraction) => {
      for (const n of [
        e,
        ...e.querySelectorAll('*'),
        ...(e.matches('[data-testid=visual-card]')
          ? [document.scrollingElement]
          : []),
      ])
        if (
          n instanceof HTMLElement &&
          (n === document.scrollingElement ||
            /auto|scroll/.test(getComputedStyle(n).overflowY))
        )
          n.scrollTop = fraction * (n.scrollHeight - n.clientHeight);
    }, i / steps);
    findings.push(...(await measurements(root)));
  }
  return findings;
}

for (const locale of ['pl', 'en'] as const)
  for (const [surface, titleKey] of Object.entries(surfaces)) {
    test(`${surface} ${locale}`, async ({ page }, testInfo) => {
      const errors: string[] = [],
        forbidden: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });
      const settings = {
        ...defaultAISettings,
        voiceSettings: { ...defaultAISettings.voiceSettings, enabled: false },
        imageGenerationEnabled: false,
        gameMasterNarration: {
          ...defaultAISettings.gameMasterNarration,
          prompts: {
            ...defaultAISettings.gameMasterNarration.prompts,
            mainPrompt:
              locale === 'en'
                ? 'Safe visual fixture.'
                : 'Bezpieczna fixture wizualna.',
            gmInstructionsFileName: 'desktop-visual-fixture.md',
          },
        },
      };
      await page.addInitScript(
        ({ language, settings }) => {
          localStorage.setItem('onboarding_completed', 'true');
          localStorage.setItem('language_selected', language);
          localStorage.setItem('rules_onboarding_completed', 'true');
          localStorage.setItem('ai_settings', JSON.stringify(settings));
        },
        { language: locale, settings }
      );
      await page.route('**/default-gm-prompt*.md', (route) =>
        route.fulfill({
          contentType: 'text/plain',
          body: 'Safe visual fixture.',
        })
      );
      await page.route('**/api/**', (route) => {
        const request = route.request();
        if (
          request.method() !== 'GET' &&
          /chat|game-save|reset|character|update\/start|feedback/.test(
            request.url()
          )
        )
          forbidden.push(request.url());
        if (request.url().endsWith('/api/session'))
          return route.fulfill({
            json: {
              sessions: [
                {
                  sessionId: 'visual-session',
                  sessionData: {
                    sessionName:
                      locale === 'en'
                        ? 'The Black Sarcophagus'
                        : 'Czarny Sarkofag',
                    description:
                      locale === 'en'
                        ? 'An expedition returns to London.'
                        : 'Ekspedycja wraca do Londynu.',
                    character: {
                      id: 'visual',
                      name: 'Anna Kowalska',
                      occupation: '',
                    },
                    messages: [],
                    adventureText: '',
                    timestamp: '2026-10-23T12:00:00Z',
                  },
                },
              ],
            },
          });
        if (request.url().includes('/api/health/gemini'))
          return route.fulfill({
            json: {
              status: 'no_key',
              keyValid: null,
              availableModels: [],
              registry: {
                chatModelsPresent: [],
                chatModelsMissing: [],
                embeddingPresent: false,
              },
              checkedAt: '2026-10-23T12:00:00Z',
            },
          });
        return route.fulfill({
          json: {
            success: true,
            saves: [],
            files: [],
            rules: [],
            adventures: [],
            status: 'idle',
            supported: false,
          },
        });
      });
      await page.goto(`/${locale}/audit/desktop-windows/${surface}`);
      await expect(page.getByTestId('desktop-window-fixture')).toBeVisible();
      const root = await surfaceRoot(page, surface);
      await expect(root).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await root.evaluate((e) =>
        Promise.all(
          e
            .getAnimations({ subtree: true })
            .filter((a) => a.effect?.getTiming().iterations !== Infinity)
            .map((a) => a.finished.catch(() => undefined))
        )
      );
      await root
        .locator('img:visible')
        .evaluateAll((images) =>
          Promise.all(
            images.map((image) =>
              (image as HTMLImageElement).decode().catch(() => undefined)
            )
          )
        );
      if (titleKey)
        await expect(root).toContainText(message(locale, titleKey), {
          ignoreCase: true,
        });
      const output = path.resolve(
        'test-results/desktop-windows/evidence',
        `${surface}-${locale}`
      );
      await fs.mkdir(path.dirname(output), { recursive: true });
      const findings = await measurements(root);
      const states: string[] = ['default', 'focus', 'bottom'];
      await page.screenshot({ path: `${output}.png` });
      const focusable = root
        .locator('button:visible:not(:disabled), input:visible:not(:disabled)')
        .first();
      if (await focusable.count()) {
        await page.keyboard.press('Tab');
        await focusable.focus();
        await focusable.evaluate((e) => getComputedStyle(e).outline);
        await focusable.evaluate((e) =>
          Promise.all(
            e
              .getAnimations()
              .filter((a) => a.effect?.getTiming().iterations !== Infinity)
              .map((a) => a.finished.catch(() => undefined))
          )
        );
        const focus = await focusable.evaluate((e) => {
          const s = getComputedStyle(e);
          const probe = document.createElement('span');
          probe.style.color = `hsl(${s.getPropertyValue('--ring')})`;
          document.body.append(probe);
          const expected = getComputedStyle(probe).color;
          probe.remove();
          return {
            expected,
            outline: s.outlineColor,
            outlineStyle: s.outlineStyle,
            outlineWidth: s.outlineWidth,
            shadow: s.boxShadow,
            ring: getComputedStyle(e).getPropertyValue('--ring').trim(),
          };
        });
        if (
          focus.outlineStyle !== 'solid' ||
          parseFloat(focus.outlineWidth) < 2 ||
          focus.outline !== focus.expected
        )
          findings.push('missing keyboard focus outline');
        await fs.writeFile(`${output}-focus.json`, JSON.stringify(focus));
        await page.screenshot({ path: `${output}-focus.png` });
      }
      await root.evaluate((e) => {
        for (const node of [e, ...e.querySelectorAll('*')])
          if (
            node instanceof HTMLElement &&
            /auto|scroll/.test(getComputedStyle(node).overflowY)
          )
            node.scrollTop = node.scrollHeight;
      });
      findings.push(...(await scanScrolled(root)));
      await page.screenshot({ path: `${output}-bottom.png` });
      // Tabs only change the presented panel; action buttons remain untouched.
      const tabs = root.getByRole('tab');
      for (let index = 0; index < (await tabs.count()); index++) {
        const tab = tabs.nth(index);
        if (!(await tab.isVisible()) || (await tab.isDisabled())) continue;
        await tab.click();
        await expect(tab).toHaveAttribute('data-state', 'active');
        findings.push(...(await measurements(root)));
        await page.screenshot({ path: `${output}-tab-${index}.png` });
        await root.evaluate((e) => {
          for (const node of [e, ...e.querySelectorAll('*')])
            if (
              node instanceof HTMLElement &&
              /auto|scroll/.test(getComputedStyle(node).overflowY)
            )
              node.scrollTop = node.scrollHeight;
        });
        findings.push(...(await scanScrolled(root)));
        await page.screenshot({ path: `${output}-tab-${index}-bottom.png` });
        states.push(`tab-${index}`);
      }
      const capture = async (state: string, scope: Locator = root) => {
        await scope.evaluate((e) =>
          Promise.all(
            e
              .getAnimations({ subtree: true })
              .filter((a) => a.effect?.getTiming().iterations !== Infinity)
              .map((a) => a.finished.catch(() => undefined))
          )
        );
        findings.push(...(await measurements(scope)));
        await page.screenshot({ path: `${output}-${state}.png` });
        await scope.evaluate((e) => {
          for (const n of [e, ...e.querySelectorAll('*')])
            if (
              n instanceof HTMLElement &&
              /auto|scroll/.test(getComputedStyle(n).overflowY)
            )
              n.scrollTop = n.scrollHeight;
        });
        findings.push(...(await scanScrolled(scope)));
        await page.screenshot({ path: `${output}-${state}-bottom.png` });
        const target = scope
          .locator(
            'button:visible:not(:disabled), input:visible:not(:disabled)'
          )
          .first();
        if (await target.count()) {
          await page.keyboard.press('Tab');
          await target.focus();
          await target.evaluate((e) => getComputedStyle(e).outline);
          await target.evaluate((e) =>
            Promise.all(
              e
                .getAnimations()
                .filter((a) => a.effect?.getTiming().iterations !== Infinity)
                .map((a) => a.finished.catch(() => undefined))
            )
          );
          const focus = await target.evaluate((e) => {
            const style = getComputedStyle(e);
            return {
              width: parseFloat(style.outlineWidth),
              style: style.outlineStyle,
            };
          });
          if (focus.width < 1.99 || focus.style !== 'solid')
            findings.push(`missing focus in ${state}`);
          await page.screenshot({ path: `${output}-${state}-focus.png` });
        }
        states.push(state);
      };
      const presentationChoices =
        surface === 'help'
          ? root.locator('nav button')
          : surface === 'equipment'
            ? root.locator('[data-testid^=equipment-tab-]')
            : surface === 'journal'
              ? root.locator('[data-testid^=journal-section-]')
              : surface === 'beta-feedback'
                ? root.locator('[data-testid^=feedback-category-]')
                : null;
      if (presentationChoices)
        for (let i = 0; i < (await presentationChoices.count()); i++) {
          await presentationChoices.nth(i).click();
          await capture(`choice-${i}`);
        }
      if (surface === 'settings') {
        await root
          .getByRole('button', {
            name: message(locale, 'SettingsModal.nerdySection'),
            exact: true,
          })
          .click();
        await capture('advanced');
      }
      if (surface === 'character-wizard') {
        await root.locator('[data-testid^=wizard-archetype-]').first().click();
        const next = root.getByRole('button', {
          name: `${message(locale, 'CharacterWizard.next')} ›`,
          exact: true,
        });
        await next.click();
        await capture('step-2-roll');
        await root
          .getByRole('button')
          .filter({
            hasText: message(
              locale,
              'CharacterWizard.allocatePointsDescription'
            ),
          })
          .click();
        await capture('step-2-selected');
        await next.click();
        await root
          .locator('[data-testid^="wizard-occupation-"]')
          .first()
          .click();
        await capture('step-3-selected');
        await next.click();
        await capture('step-4');
        const skillInput = root
          .locator(
            '[data-testid^=skill-card-] input[type=number]:not(:disabled)'
          )
          .first();
        await skillInput.fill(
          String(Number(await skillInput.inputValue()) + 5)
        );
        await root.getByTestId('reset-skills-button').click();
        await capture(
          'reset-skills',
          root.getByTestId('reset-skills-confirm-dialog')
        );
        await root.getByTestId('reset-skills-cancel-btn').click();
        await next.click();
        await capture('step-5');
        await next.click();
        await capture('step-6');
        await root
          .getByRole('button')
          .filter({
            hasText: message(locale, 'CharacterWizard.changeRetroEngraving'),
          })
          .click();
        await capture(
          'retro-gallery',
          root.getByTestId('retro-portrait-gallery-dialog')
        );
        const engraving = root
          .getByTestId('retro-portrait-gallery-dialog')
          .locator('.aspect-square')
          .first();
        const aspect = await engraving.evaluate((e) => {
          const r = e.getBoundingClientRect();
          return r.height / r.width;
        });
        expect(
          aspect,
          'engraving must retain its square image area'
        ).toBeCloseTo(1, 1);
      }
      if (surface === 'settings') {
        const before = await page.evaluate(() =>
          localStorage.getItem('ai_settings')
        );
        await root.getByTestId('settings-reset-open').click();
        const confirm = root.getByTestId('settings-reset-confirm');
        await capture('reset-confirm', confirm);
        await confirm
          .getByRole('button', {
            name: message(locale, 'SettingsModal.cancel'),
            exact: true,
          })
          .click();
        expect(
          await page.evaluate(() => localStorage.getItem('ai_settings')),
          'opening/cancelling must not reset settings'
        ).toBe(before);
      }
      if (surface === 'roll-test') {
        await expect(root.getByRole('heading')).toContainText(
          locale === 'en' ? 'Test: Spot Hidden' : 'Test: Spostrzegawczość',
          { ignoreCase: true }
        );
        await root
          .getByRole('button', {
            name: message(locale, 'RollTestResult.roll'),
            exact: true,
          })
          .click();
        await expect(root.getByTestId('roll-test-result')).toBeVisible();
        await capture('result');
        const verdict = await root
          .getByTestId('roll-outcome-label')
          .textContent();
        expect(
          ['critical', 'extreme', 'hard', 'regular', 'fail', 'fumble'].some(
            (key) =>
              verdict?.includes(
                message(locale, `RollTestResult.outcomes.${key}`)
              )
          ),
          'localized roll verdict'
        ).toBe(true);
      }
      if (surface === 'spell-card' || surface === 'tome-card') {
        await root
          .getByTitle(message(locale, 'Magic.showLoreGuide'), { exact: true })
          .click();
        await capture('guide');
      }
      if (surface === 'save-game')
        for (const key of [
          'nameLabel',
          'notesLabel',
          'contentTitle',
          'chatHistoryLabel',
          'pdfMemoryLabel',
        ])
          await expect(root).toContainText(
            message(locale, `FullGameSaveModal.${key}`)
          );
      if (surface === 'roll-test')
        await expect(root).toContainText(
          message(locale, 'RollTestModal.kicker'),
          { ignoreCase: true }
        );
      if (surface === 'tome-card') {
        await expect(root).toContainText(
          message(locale, 'Magic.languageNames.latin')
        );
        await expect(root).toContainText(
          message(locale, 'Magic.keeperRulebookSource')
        );
        if (locale === 'en')
          await expect(root).not.toContainText(
            /Łacina|Księga Strażnika|tłum\./
          );
      }
      if (surface === 'medical-care')
        await expect(root).toContainText(
          message(locale, 'MedicalCareModal.archiveKicker'),
          { ignoreCase: true }
        );
      await expect(root).not.toContainText(/MISSING_MESSAGE|INVALID_MESSAGE/);
      const report = {
        locale,
        surface,
        states,
        viewport: '1280x720',
        findings: [...new Set(findings)],
        errors,
        forbidden,
      };
      await fs.writeFile(`${output}.json`, JSON.stringify(report, null, 2));
      await testInfo.attach('visual-metrics', {
        body: JSON.stringify(report, null, 2),
        contentType: 'application/json',
      });
      expect(errors, 'browser errors').toEqual([]);
      expect(forbidden, 'forbidden write request').toEqual([]);
      await expect(page.getByTestId('desktop-window-fixture')).toHaveAttribute(
        'data-actions',
        '0'
      );
      if (process.env.DESKTOP_VISUAL_RECORD_ONLY !== '1')
        expect(report.findings, 'rendered visual defects').toEqual([]);
    });
  }

for (const locale of ['pl', 'en'])
  test(`shared controls keep desktop defaults ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}/audit/desktop-windows/scope-check`);
    const controls = page.getByTestId('unscoped-controls');
    await expect(controls).toBeVisible();
    expect(
      await controls
        .getByRole('button')
        .evaluate((e) => e.getBoundingClientRect().height)
    ).toBe(40);
    expect(
      await controls
        .getByRole('textbox')
        .evaluate((e) => e.getBoundingClientRect().height)
    ).toBe(40);
  });
