import { fireEvent, render, screen, within } from '@testing-library/react';
import { SessionJournal } from './session-journal';
import { makePublicJournalFixture } from '@/tests/fixtures/public-journal';
import { buildPublicJournal } from '@/lib/journal/public-journal';

describe('player journal presentation', () => {
  afterEach(() => {
    delete process.env.NEXT_INTL_TEST_LOCALE;
  });

  it.each(['pl', 'en'] as const)(
    'starts with the saved chronicle and a scene in progress (%s)',
    (locale) => {
      process.env.NEXT_INTL_TEST_LOCALE = locale;
      const fixture = makePublicJournalFixture(locale);
      fixture.characters[0].sceneCards = [
        {
          id: 'sealed',
          sceneNumber: 1,
          title: 'Archiwum',
          location: fixture.labels.place,
          timestamp: '2026-11-01T12:00:00Z',
          isSealed: true,
          people: ['Dozorca'],
          findings: [],
          keyTakeaways: [],
          chronicleChapter: fixture.characters[0].chronicleSession,
          dossierBinding: fixture.binding,
          chronicleSummaryByLocale: {
            pl: 'Dozorca twierdził, że brama była zamknięta.',
            en: 'The caretaker claimed the gate was locked.',
          },
        },
      ];
      const model = buildPublicJournal({
        characters: fixture.characters,
        chapter: fixture.chapter,
        binding: fixture.binding,
        locale,
      });
      render(
        <SessionJournal character={fixture.characters[0]} model={model} />
      );
      expect(screen.getByTestId('journal-chronicle')).toBeVisible();
      expect(screen.getByTestId('journal-chronicle')).toHaveTextContent(
        locale === 'pl' ? 'Dozorca twierdził' : 'The caretaker claimed'
      );
      expect(screen.getByTestId('journal-current-scene')).toHaveTextContent(
        locale === 'pl' ? 'W toku' : 'In progress'
      );
    }
  );

  it('shows testimony without technical labels and exposes each conversation only once', () => {
    const fixture = makePublicJournalFixture('pl');
    render(
      <SessionJournal character={fixture.characters[0]} model={fixture.model} />
    );
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Szukaj w dzienniku' }),
      { target: { value: 'Brama' } }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Otwórz: Brama' }));
    const detail = screen.getByTestId('journal-card-detail');
    expect(detail).not.toHaveTextContent(
      /Materiał źródłowy|Obserwacja|Przebieg sceny|Źródła/
    );
    expect(within(detail).getAllByTestId('journal-source-link')).toHaveLength(
      fixture.model.cards.find((card) => card.title === 'Brama')!.sources.length
    );
    expect(detail).toHaveTextContent('Dozorca twierdzi');
    expect(detail).toHaveTextContent('Sąsiadka twierdzi');
  });

  it('does not reserve a landscape banner for a portrait or show an unknown date field', () => {
    const fixture = makePublicJournalFixture('pl');
    const person = fixture.model.cards.find((card) => card.kind === 'person')!;
    person.imageUrl = '/portrait.png';
    render(
      <SessionJournal character={fixture.characters[0]} model={fixture.model} />
    );
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Szukaj w dzienniku' }),
      { target: { value: person.title } }
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Otwórz: ' + person.title })
    );
    expect(
      screen
        .getByTestId('journal-card-detail')
        .querySelector('[data-art-layout="portrait"]')
    ).not.toBeNull();
    expect(screen.getByTestId('journal-card-detail')).not.toHaveTextContent(
      'Data nieustalona'
    );
  });
});
