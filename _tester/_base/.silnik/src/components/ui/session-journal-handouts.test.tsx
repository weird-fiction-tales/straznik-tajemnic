import { fireEvent, render, screen } from '@testing-library/react';
import { SessionJournal } from './session-journal';
import { makePublicJournalFixture } from '@/tests/fixtures/public-journal';
import { buildPublicJournal } from '@/lib/journal/public-journal';
import type { Character } from '@/lib/types';

jest.mock('@/components/chat/narrative/runtime-dossier-handout', () => ({
  RuntimeDossierHandout: ({
    recordId,
    allowedIds,
  }: {
    recordId: string;
    allowedIds: string[];
  }) =>
    allowedIds.includes(recordId) ? (
      <div data-testid="archived-source-handout">{recordId}</div>
    ) : null,
}));
afterEach(() => {
  delete process.env.NEXT_INTL_TEST_LOCALE;
});

it.each(['pl', 'en'] as const)(
  'restores an observed source without chat history or physical possession (%s)',
  (locale) => {
    process.env.NEXT_INTL_TEST_LOCALE = locale;
    const fixture = makePublicJournalFixture(locale);
    const characters: Character[] = JSON.parse(
      JSON.stringify(fixture.characters)
    );
    characters.forEach((character) => {
      character.equipment = [];
    });
    const model = buildPublicJournal({
      characters,
      chapter: fixture.chapter,
      binding: fixture.binding,
      locale,
    });
    render(<SessionJournal character={characters[1]} model={model} />);
    fireEvent.click(
      screen
        .getByTestId('journal-contents')
        .querySelector('[data-nav-id="section-material"]')!
    );
    expect(
      screen
        .getAllByTestId('journal-card')
        .filter((card) => card.getAttribute('data-card-kind') === 'material')
    ).toHaveLength(1);
    fireEvent.click(
      screen.getByRole('button', {
        name: `${locale === 'pl' ? 'Otwórz' : 'Open'}: ${fixture.labels.material}`,
      })
    );
    expect(screen.getByTestId('archived-source-handout')).toHaveTextContent(
      fixture.materialId
    );
    expect(characters.every((character) => !character.equipment?.length)).toBe(
      true
    );
  }
);

it('keeps one material after acquiring its physical instance and rejects another edition or run', () => {
  const fixture = makePublicJournalFixture('pl');
  fixture.characters[0].equipment!.push({
    id: 'physical-photo',
    name: fixture.labels.material,
    category: 'document',
    dossierBinding: {
      ...fixture.binding,
      recordId: 'physical-photo',
      handoutRecordId: fixture.materialId,
    },
  });
  const model = buildPublicJournal({
    characters: fixture.characters,
    chapter: fixture.chapter,
    binding: fixture.binding,
    locale: 'pl',
  });
  expect(model.cards.filter((card) => card.kind === 'material')).toHaveLength(
    1
  );
  expect(
    buildPublicJournal({
      characters: fixture.characters,
      chapter: fixture.chapter,
      binding: { ...fixture.binding, editionFingerprint: 'other' },
      locale: 'pl',
    }).cards
  ).toEqual([]);
  expect(
    buildPublicJournal({
      characters: fixture.characters,
      chapter: { ...fixture.chapter, playthroughId: 'other' },
      binding: fixture.binding,
      locale: 'pl',
    }).cards
  ).toEqual([]);
});
