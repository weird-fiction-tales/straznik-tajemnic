import React from 'react';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {QuickSetupModal} from './quick-setup-modal';
import {QUICK_SETUP_SHOWCASE_PROFILE} from './quick-setup-showcase-profile';

const originalEnabled = QUICK_SETUP_SHOWCASE_PROFILE.enabled;
const originalLocale = process.env.NEXT_INTL_TEST_LOCALE;
afterEach(() => {
  QUICK_SETUP_SHOWCASE_PROFILE.enabled = originalEnabled;
  if (originalLocale === undefined) delete process.env.NEXT_INTL_TEST_LOCALE;
  else process.env.NEXT_INTL_TEST_LOCALE = originalLocale;
});

it.each([
  ['pl', 'Tomasz Nowicki', 'Dr Barbara Zawadzka', 'strefa11_barbara_zawadzka', /Rozpocznij przygodę/i],
  ['en', 'Det. Frank Geyer', 'Clara Vance', 'coldcase_clara_vance', /Start adventure/i],
] as const)('keeps exactly one man and one woman available through solo and duet (%s)', async (locale, man, woman, womanId, startLabel) => {
  process.env.NEXT_INTL_TEST_LOCALE = locale;
  QUICK_SETUP_SHOWCASE_PROFILE.enabled = true;
  const user = userEvent.setup();
  const start = jest.fn();
  render(<QuickSetupModal open onQuickStart={start} onOpenChange={jest.fn()} />);
  const biography = locale === 'pl' ? /Biografia/i : /Biography/i;
  expect(screen.getAllByRole('button', {name: biography})).toHaveLength(2);
  expect(screen.getByText(man)).toBeVisible();
  expect(screen.getByText(woman)).toBeVisible();
  await user.click(screen.getByRole('button', {name: name => name.includes(woman)}));
  await user.click(screen.getByRole('button', {name: /Hot Seat/i}));
  expect(screen.getAllByRole('button', {name: biography})).toHaveLength(4);
  expect(screen.getAllByText(man)).toHaveLength(2);
  expect(screen.getAllByText(woman)).toHaveLength(2);
  await user.click(screen.getByRole('button', {name: /Solo/i}));
  expect(screen.getAllByRole('button', {name: biography})).toHaveLength(2);
  await user.click(screen.getByRole('button', {name: startLabel}));
  expect(start).toHaveBeenCalledWith(expect.any(String), womanId, 'solo', undefined);
});
