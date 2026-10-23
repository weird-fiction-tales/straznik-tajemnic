import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getQuickSetupAdventures } from '@/lib/adventures-data';
import { getStrefa11CharactersForAdventure } from '@/lib/immersion/strefa-11-characters';
import { localizeStrefa11Adventure, localizeStrefa11Character } from '@/lib/immersion/strefa-11-localization';
import { QuickSetupModal } from './quick-setup-modal';
import { QUICK_SETUP_SHOWCASE_PROFILE } from './quick-setup-showcase-profile';

const originalShowcaseEnabled = QUICK_SETUP_SHOWCASE_PROFILE.enabled;

describe.each(['pl', 'en'] as const)('Quick Setup desktop acceptance (%s)', (locale) => {
  const originalLocale = process.env.NEXT_INTL_TEST_LOCALE;

  beforeEach(() => {
    process.env.NEXT_INTL_TEST_LOCALE = locale;
    QUICK_SETUP_SHOWCASE_PROFILE.enabled = false;
  });

  afterEach(() => {
    QUICK_SETUP_SHOWCASE_PROFILE.enabled = originalShowcaseEnabled;
    if (originalLocale === undefined) delete process.env.NEXT_INTL_TEST_LOCALE;
    else process.env.NEXT_INTL_TEST_LOCALE = originalLocale;
  });

  it('selects scenarios with Enter and Space and preserves the locale default and start callback', async () => {
    const user = userEvent.setup();
    const onQuickStart = jest.fn();
    const onOpenChange = jest.fn();
    const adventures = getQuickSetupAdventures(locale);
    const first = localizeStrefa11Adventure(adventures[0], locale);
    const second = localizeStrefa11Adventure(adventures[1], locale);
    render(<QuickSetupModal open onQuickStart={onQuickStart} onOpenChange={onOpenChange} />);

    const firstCard = screen.getByRole('button', { name: (name) => name.includes(first.title) });
    const secondCard = screen.getByRole('button', { name: (name) => name.includes(second.title) });
    expect(firstCard).toHaveAttribute('aria-pressed', 'true');
    expect(secondCard).toHaveAttribute('aria-pressed', 'false');
    expect(secondCard).toHaveClass('focus-visible:ring-2');
    secondCard.focus();
    expect(secondCard).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(secondCard).toHaveAttribute('aria-pressed', 'true');
    expect(firstCard).toHaveAttribute('aria-pressed', 'false');

    firstCard.focus();
    await user.keyboard(' ');
    expect(firstCard).toHaveAttribute('aria-pressed', 'true');
    const character = localizeStrefa11Character(getStrefa11CharactersForAdventure(first.id)[0], locale);
    await user.click(screen.getByRole('button', { name: new RegExp(character.name) }));
    await user.click(screen.getByRole('button', { name: locale === 'pl' ? /Rozpocznij przygodę/i : /Start adventure/i }));
    expect(onQuickStart).toHaveBeenCalledWith(first.id, character.id, 'solo', undefined);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('keeps complete scenario, investigator and occupation labels readable for both players', async () => {
    const user = userEvent.setup();
    const adventure = localizeStrefa11Adventure(getQuickSetupAdventures(locale)[0], locale);
    const characters = getStrefa11CharactersForAdventure(adventure.id).slice(0, 4)
      .map((character) => localizeStrefa11Character(character, locale));
    render(<QuickSetupModal open onQuickStart={jest.fn()} onOpenChange={jest.fn()} />);
    await user.click(screen.getByRole('button', { name: /Hot Seat/i }));

    const title = screen.getByText(adventure.title);
    expect(title).toHaveClass('text-base', 'whitespace-normal', 'break-words');
    expect(title.className).not.toMatch(/truncate|line-clamp|text-ellipsis/);
    for (const character of characters) {
      for (const name of screen.getAllByText(character.name)) {
        expect(name).toBeVisible();
        expect(name).toHaveClass('text-base', 'whitespace-normal', 'break-words');
        expect(name.className).not.toMatch(/truncate|line-clamp|text-ellipsis/);
      }
      for (const occupation of screen.getAllByText(character.occupation)) {
        expect(occupation).toBeVisible();
        expect(occupation).toHaveClass('text-sm', 'whitespace-normal', 'break-words');
        expect(occupation.className).not.toMatch(/truncate|line-clamp|text-ellipsis/);
      }
    }
    const biography = locale === 'pl' ? /Biografia/i : /Biography/i;
    for (const button of screen.getAllByRole('button', { name: biography })) {
      expect(button).toHaveClass('min-h-11', 'text-sm', 'focus-visible:ring-2');
    }
  });
});

describe.each([
  ['pl', 'cien-nad-prabutami', 'strefa11_tomasz_nowicki'],
  ['en', 'englewood-murder-castle-1893', 'coldcase_frank_geyer'],
] as const)('Quick Setup showcase (%s)', (locale, adventureId, characterId) => {
  const originalLocale = process.env.NEXT_INTL_TEST_LOCALE;

  beforeEach(() => {
    process.env.NEXT_INTL_TEST_LOCALE = locale;
    QUICK_SETUP_SHOWCASE_PROFILE.enabled = true;
  });

  afterEach(() => {
    QUICK_SETUP_SHOWCASE_PROFILE.enabled = originalShowcaseEnabled;
    if (originalLocale === undefined) delete process.env.NEXT_INTL_TEST_LOCALE;
    else process.env.NEXT_INTL_TEST_LOCALE = originalLocale;
  });

  it('exposes only the approved pair, preselects solo and starts only after clicking Start', async () => {
    const user = userEvent.setup();
    const onQuickStart = jest.fn();
    const onOpenChange = jest.fn();
    const allAdventures = ['pl', 'en'].flatMap((language) => getQuickSetupAdventures(language));
    const adventure = localizeStrefa11Adventure(
      allAdventures.find((candidate) => candidate.id === adventureId)!, locale
    );
    const allCharacters = allAdventures.flatMap((candidate) => getStrefa11CharactersForAdventure(candidate.id));
    const character = localizeStrefa11Character(
      allCharacters.find((candidate) => candidate.id === characterId)!, locale
    );

    render(<QuickSetupModal open onQuickStart={onQuickStart} onOpenChange={onOpenChange} />);
    expect(screen.getByRole('button', { name: adventure.title })).toHaveAttribute('aria-pressed', 'true');
    const characterCard = screen.getByRole('button', { name: (name) => name.includes(character.name) });
    expect(characterCard).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(character.occupation)).toBeVisible();
    const modal = screen.getByTestId('quick-setup-modal');
    if (locale === 'en') {
      expect(modal).toHaveTextContent('Set up an American Mythos Cold Cases session.');
      expect(modal).toHaveTextContent('2. Choose an American Mythos Cold Cases scenario');
      expect(modal).not.toHaveTextContent(/Strefa 11|television team/i);
    } else {
      expect(modal).toHaveTextContent('Skonfiguruj sesję z programu Strefa 11.');
    }
    expect(screen.getByRole('button', { name: /Solo/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: /Hot Seat/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: locale === 'pl' ? /Biografia/i : /Biography/i })).toHaveLength(1);

    for (const candidate of allAdventures.filter((candidate) => candidate.id !== adventureId)) {
      expect(screen.queryByRole('button', { name: candidate.title })).not.toBeInTheDocument();
      expect(screen.queryByText(candidate.title)).not.toBeInTheDocument();
    }
    for (const candidate of allCharacters.filter((candidate) => candidate.id !== characterId)) {
      expect(screen.queryByText(candidate.name)).not.toBeInTheDocument();
    }
    // The profile filters this modal; the underlying scenario and character catalogs remain intact.
    expect(getQuickSetupAdventures(locale)).toHaveLength(4);
    expect(getStrefa11CharactersForAdventure(adventureId)).toHaveLength(4);
    const start = screen.getByRole('button', { name: locale === 'pl' ? /Rozpocznij przygodę/i : /Start adventure/i });
    expect(start).toBeEnabled();
    expect(onQuickStart).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    await user.click(start);
    expect(onQuickStart).toHaveBeenCalledTimes(1);
    expect(onQuickStart).toHaveBeenCalledWith(adventureId, characterId, 'solo', undefined);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('synchronizes the approved pair across mounted locale changes without starting automatically', async () => {
    const user = userEvent.setup();
    const onQuickStart = jest.fn();
    const onOpenChange = jest.fn();
    const props = { open: true, onQuickStart, onOpenChange };
    const { rerender } = render(<QuickSetupModal {...props} />);
    const otherLocale = locale === 'pl' ? 'en' : 'pl';

    for (const language of [locale, otherLocale, locale]) {
      process.env.NEXT_INTL_TEST_LOCALE = language;
      rerender(<QuickSetupModal {...props} />);
      const adventure = localizeStrefa11Adventure(getQuickSetupAdventures(language)[0], language);
      const character = localizeStrefa11Character(
        getStrefa11CharactersForAdventure(adventure.id)[0], language
      );
      expect(screen.getByRole('button', { name: adventure.title })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: (name) => name.includes(character.name) })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText(character.occupation)).toBeVisible();
      expect(screen.getAllByRole('button', { name: language === 'pl' ? /Biografia/i : /Biography/i })).toHaveLength(1);
      expect(screen.getByRole('button', { name: language === 'pl' ? /Rozpocznij przygodę/i : /Start adventure/i })).toBeEnabled();
      const hiddenLocale = language === 'pl' ? 'en' : 'pl';
      expect(screen.queryByText(getQuickSetupAdventures(hiddenLocale)[0].title)).not.toBeInTheDocument();
      expect(onQuickStart).not.toHaveBeenCalled();
      expect(onOpenChange).not.toHaveBeenCalled();
    }

    await user.click(screen.getByRole('button', { name: locale === 'pl' ? /Rozpocznij przygodę/i : /Start adventure/i }));
    expect(onQuickStart).toHaveBeenCalledTimes(1);
    expect(onQuickStart).toHaveBeenCalledWith(adventureId, characterId, 'solo', undefined);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
