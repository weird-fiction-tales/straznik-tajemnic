import { fireEvent, render, screen, within } from '@testing-library/react';
import { isPlotRelevantItem, filterPlotItems } from '@/lib/journal/item-filter';
import { SessionJournal } from './session-journal';
import { makePublicJournalFixture } from '@/tests/fixtures/public-journal';
import { buildPublicJournal } from '@/lib/journal/public-journal';

describe('item-filter', () => {
  it('odfiltrowuje pospolite przedmioty codziennego użytku', () => {
    expect(isPlotRelevantItem('Baterie')).toBe(false);
    expect(isPlotRelevantItem('baterie AA')).toBe(false);
    expect(isPlotRelevantItem('telefon komórkowy')).toBe(false);
    expect(isPlotRelevantItem('smartfon')).toBe(false);
    expect(isPlotRelevantItem('Pudełko zapałek')).toBe(false);
    expect(isPlotRelevantItem('zapalniczka')).toBe(false);
    expect(isPlotRelevantItem('Portfel')).toBe(false);
    expect(isPlotRelevantItem('Drobne monety')).toBe(false);
    expect(isPlotRelevantItem('Chusteczki higieniczne')).toBe(false);
    expect(isPlotRelevantItem('grzebień')).toBe(false);
  });

  it('odfiltrowuje odmienione gramatycznie formy pospolitych przedmiotów (przypadki i liczba mnoga)', () => {
    expect(isPlotRelevantItem('Paczka zapałek')).toBe(false);
    expect(isPlotRelevantItem('Garść zapałek')).toBe(false);
    expect(isPlotRelevantItem('Komplet baterii')).toBe(false);
    expect(isPlotRelevantItem('Zapas baterii')).toBe(false);
    expect(isPlotRelevantItem('Paczka chusteczek')).toBe(false);
    expect(isPlotRelevantItem('Niedopałek papierosa')).toBe(false);
    expect(isPlotRelevantItem('Zawartość portfela')).toBe(false);
    expect(isPlotRelevantItem('Garść bilonu')).toBe(false);
    expect(isPlotRelevantItem('Dwa ołówki')).toBe(false);
    expect(isPlotRelevantItem('Klucze do mieszkania')).toBe(false);
    expect(isPlotRelevantItem('Klucz od domu')).toBe(false);
  });

  it('zachowuje przedmioty istotne dla fabuły i poszlaki', () => {
    expect(isPlotRelevantItem('Mosiężny klucz')).toBe(true);
    expect(isPlotRelevantItem('List od Wilcoxa')).toBe(true);
    expect(isPlotRelevantItem('Zakrwawiony nóż')).toBe(true);
    expect(isPlotRelevantItem('Amulet Cthulhu')).toBe(true);
    expect(isPlotRelevantItem('Stara fotografia')).toBe(true);
    expect(isPlotRelevantItem('Zeznanie dozorcy')).toBe(true);
    expect(isPlotRelevantItem('Dziennik Corbitta')).toBe(true);
    expect(isPlotRelevantItem('Magiczny zegarek kieszonkowy')).toBe(true);
    expect(isPlotRelevantItem('Klucz do krypty')).toBe(true);
  });

  it('przedmiot pospolity z silnym znacznikiem fabularnym jest uznawany za istotny', () => {
    expect(isPlotRelevantItem('Zakrwawiona chusteczka')).toBe(true);
    expect(isPlotRelevantItem('Zaszyfrowany telefon')).toBe(true);
    expect(isPlotRelevantItem('Tajemnicze zapałki z symbolem')).toBe(true);
  });

  it('filterPlotItems poprawnie oczyszcza listę przedmiotów', () => {
    const rawItems = [
      'Baterie',
      'Mosiężny klucz',
      'telefon komórkowy',
      'List od Wilcoxa',
      'Zapałki',
      'Zakrwawiony medalion',
    ];
    const filtered = filterPlotItems(rawItems);
    expect(filtered).toEqual([
      'Mosiężny klucz',
      'List od Wilcoxa',
      'Zakrwawiony medalion',
    ]);
  });
});

jest.mock('@/components/chat/narrative/runtime-dossier-handout', () => ({
  RuntimeDossierHandout: ({ recordId }: { recordId: string }) => (
    <div data-testid="archived-source-handout">{recordId}</div>
  ),
}));

describe('shared visual journal', () => {
  afterEach(() => {
    delete process.env.NEXT_INTL_TEST_LOCALE;
  });
  it.each(['pl', 'en'] as const)(
    'opens the current scene, exposes five categories and only public knowledge (%s)',
    (locale) => {
      process.env.NEXT_INTL_TEST_LOCALE = locale;
      const fixture = makePublicJournalFixture(locale);
      render(
        <SessionJournal
          character={fixture.characters[0]}
          model={fixture.model}
        />
      );
      expect(screen.getByRole('dialog')).toHaveAccessibleName(
        locale === 'pl' ? 'Dziennik przygody' : 'Adventure journal'
      );
      expect(screen.getByTestId('journal-current-scene')).toBeVisible();
      expect(
        screen.getByRole('button', {
          name: `${locale === 'pl' ? 'Otwórz' : 'Open'}: ${fixture.labels.material}`,
        })
      ).toBeVisible();
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
        locale === 'pl' ? 'Kronika śledztwa' : 'Investigation Chronicle'
      );
      const nav = within(screen.getByTestId('journal-contents'));
      for (const label of locale === 'pl'
        ? ['Postacie', 'Miejsca', 'Wydarzenia', 'Ustalenia', 'Materiały']
        : ['People', 'Places', 'Events', 'Findings', 'Materials']) {
        expect(
          nav.getByRole('button', { name: new RegExp('^' + label) })
        ).toBeVisible();
      }
      expect(screen.getByRole('dialog').textContent).not.toMatch(
        /PRIVATE_|JOURNAL|source_quote/
      );
      expect(
        screen.queryByRole('button', { name: /edytuj|edit|dedukuj|deduce/i })
      ).toBeNull();
    }
  );

  it('keeps both witness accounts, opens an exact source and returns to the searched gallery', () => {
    const fixture = makePublicJournalFixture('pl');
    render(
      <SessionJournal character={fixture.characters[0]} model={fixture.model} />
    );
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Szukaj w dzienniku' }),
      { target: { value: 'brama' } }
    );
    const reader = screen.getByTestId('journal-reader');
    expect(
      screen.getByRole('button', { name: `Otwórz: ${fixture.labels.person}` })
    ).toBeVisible();
    reader.scrollTop = 216;
    const tile = screen.getByRole('button', {
      name: `Otwórz: ${fixture.labels.finding}`,
    });
    tile.focus();
    fireEvent.click(tile);
    const detail = screen.getByTestId('journal-card-detail');
    expect(detail).toHaveTextContent(fixture.labels.first);
    expect(detail).toHaveTextContent(fixture.labels.second);
    fireEvent.click(
      within(detail).getAllByRole('button', {
        name: 'Zobacz rozmowę: Dozorca',
      })[0]
    );
    expect(screen.getByTestId('journal-source')).toHaveTextContent(
      fixture.labels.first
    );
    expect(screen.getByTestId('journal-source')).not.toHaveTextContent(
      fixture.labels.second
    );
    fireEvent.click(screen.getByRole('button', { name: 'Wróć' }));
    expect(screen.getByTestId('journal-card-detail')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Wróć' }));
    expect(screen.getByRole('textbox')).toHaveValue('brama');
    expect(reader.scrollTop).toBe(216);
    expect(tile).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: `Otwórz: ${fixture.labels.finding}` })
    ).toHaveFocus();
  });

  it('shows a mentioned place without exposing a prepared portrait and keeps the true event date', () => {
    const fixture = makePublicJournalFixture('pl');
    render(
      <SessionJournal character={fixture.characters[0]} model={fixture.model} />
    );
    const nav = within(screen.getByTestId('journal-contents'));
    fireEvent.click(nav.getByRole('button', { name: /^Miejsca/ }));
    const mentioned = screen.getByRole('button', {
      name: `Otwórz: ${fixture.labels.distant}`,
    });
    expect(mentioned).toHaveTextContent('Znane ze wzmianki');
    expect(within(mentioned).queryByRole('img')).toBeNull();
    fireEvent.click(nav.getByRole('button', { name: /^Wydarzenia/ }));
    fireEvent.click(
      screen.getByRole('button', { name: `Otwórz: ${fixture.labels.oldEvent}` })
    );
    expect(screen.getByTestId('journal-card-detail')).toHaveTextContent(
      'około 1900'
    );
  });

  it('acknowledges only the opened card and preserves read versions in the existing character save', () => {
    const fixture = makePublicJournalFixture('pl');
    const update = jest.fn();
    render(
      <SessionJournal
        character={fixture.characters[0]}
        model={fixture.model}
        onUpdateCharacter={update}
      />
    );
    fireEvent.click(
      screen.getByRole('button', { name: `Otwórz: ${fixture.labels.finding}` })
    );
    expect(update).toHaveBeenCalledTimes(1);
    const saved = JSON.parse(JSON.stringify(update.mock.calls[0][0]));
    const model = buildPublicJournal({
      characters: [saved, fixture.characters[1]],
      chapter: fixture.chapter,
      binding: fixture.binding,
      locale: 'pl',
    });
    expect(
      model.cards.find((card) => card.title === fixture.labels.finding)?.unread
    ).toBeUndefined();
    expect(model.cards.some((card) => card.unread === 'new')).toBe(true);
  });

  it('navigates from a finding to its single original material without relying on possession', () => {
    const fixture = makePublicJournalFixture('pl');
    render(
      <SessionJournal character={fixture.characters[0]} model={fixture.model} />
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: `Otwórz: ${fixture.labels.photoFinding}`,
      })
    );
    fireEvent.click(
      within(screen.getByRole('region', { name: 'Powiązane karty' })).getByRole(
        'button',
        { name: fixture.labels.material }
      )
    );
    expect(screen.getByTestId('archived-source-handout')).toHaveTextContent(
      fixture.materialId
    );
    expect(
      fixture.characters.every(
        (character) =>
          !character.equipment?.some(
            (item) =>
              item.dossierBinding?.handoutRecordId === fixture.materialId
          )
      )
    ).toBe(true);
  });

  it('keeps scroll position on a background update and uses Escape to return before closing', () => {
    const fixture = makePublicJournalFixture('pl');
    const close = jest.fn();
    const props = {
      character: fixture.characters[0],
      model: fixture.model,
      onClose: close,
    };
    const { rerender } = render(<SessionJournal {...props} />);
    const reader = screen.getByTestId('journal-reader');
    reader.scrollTop = 137;
    rerender(<SessionJournal {...props} model={{ ...fixture.model }} />);
    expect(reader.scrollTop).toBe(137);
    fireEvent.click(
      screen.getByRole('button', { name: `Otwórz: ${fixture.labels.finding}` })
    );
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByTestId('journal-card-detail')).toBeNull();
    expect(close).not.toHaveBeenCalled();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('traps Tab from a source heading and wraps backward within the journal', () => {
    const fixture = makePublicJournalFixture('pl');
    render(
      <SessionJournal
        character={fixture.characters[0]}
        model={fixture.model}
        onClose={jest.fn()}
      />
    );
    fireEvent.click(
      screen.getByRole('button', { name: `Otwórz: ${fixture.labels.finding}` })
    );
    fireEvent.click(
      within(screen.getByTestId('journal-card-detail')).getAllByRole('button', {
        name: 'Zobacz rozmowę: Dozorca',
      })[0]
    );
    expect(screen.getByRole('heading', { level: 2 })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
    expect(
      screen.getByRole('button', { name: 'Zamknij dziennik przygody' })
    ).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Wróć' })).toHaveFocus();
  });

  it('restores the original opener after the journal moves focus to its own headings', () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    const fixture = makePublicJournalFixture('pl');
    const { unmount } = render(
      <SessionJournal
        character={fixture.characters[0]}
        model={fixture.model}
        onClose={jest.fn()}
      />
    );
    fireEvent.click(
      screen.getByRole('button', { name: `Otwórz: ${fixture.labels.finding}` })
    );
    unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });
});

describe('journal without empty illustration panels', () => {
  afterEach(() => {
    delete process.env.NEXT_INTL_TEST_LOCALE;
  });
  it.each(['pl', 'en'] as const)(
    'keeps a compact symbol and readable source labels (%s)',
    (locale) => {
      process.env.NEXT_INTL_TEST_LOCALE = locale;
      const fixture = makePublicJournalFixture(locale);
      const event = fixture.model.cards.find((card) => card.kind === 'event')!;
      render(
        <SessionJournal
          character={fixture.characters[0]}
          model={fixture.model}
        />
      );
      const nav = within(screen.getByTestId('journal-contents'));
      fireEvent.click(
        nav.getByRole('button', {
          name: locale === 'pl' ? /^Wydarzenia/ : /^Events/,
        })
      );
      fireEvent.click(
        screen.getByRole('button', {
          name: `${locale === 'pl' ? 'Otwórz' : 'Open'}: ${event.title}`,
        })
      );
      const detail = screen.getByTestId('journal-card-detail');
      expect(detail.querySelector('.aspect-\\[4\\/3\\]')).toBeNull();
      const labels = within(detail)
        .getAllByRole('button')
        .map((button) => button.textContent);
      expect(
        labels.some((label) => /(?:Źródło|Source): \d+$/.test(label ?? ''))
      ).toBe(false);
      expect(
        labels.some((label) =>
          label?.includes(locale === 'pl' ? 'Zobacz zapis:' : 'View record:')
        )
      ).toBe(true);
      expect(
        labels.some((label) =>
          /Przebieg sceny:|Scene record:/.test(label ?? '')
        )
      ).toBe(false);
      delete process.env.NEXT_INTL_TEST_LOCALE;
    }
  );

  it.each(['pl', 'en'] as const)(
    'separates a public profile from evidence and makes it searchable (%s)',
    (locale) => {
      process.env.NEXT_INTL_TEST_LOCALE = locale;
      const fixture = makePublicJournalFixture(locale);
      const person = fixture.model.cards.find(
        (card) => card.kind === 'person' && !card.mentioned
      )!;
      person.publicDescription =
        locale === 'pl' ? 'Redaktorka telewizyjna.' : 'A television editor.';
      render(
        <SessionJournal
          character={fixture.characters[0]}
          model={fixture.model}
        />
      );
      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: locale === 'pl' ? 'redaktorka' : 'television' },
      });
      const tile = screen.getByTestId('journal-card');
      expect(tile).toHaveTextContent(person.publicDescription);
      fireEvent.click(tile);
      expect(screen.getByTestId('journal-public-profile')).toHaveTextContent(
        person.publicDescription
      );
      expect(screen.getByTestId('journal-card-detail')).toHaveTextContent(
        person.paragraphs[0].text
      );
      const source = screen.getAllByTestId('journal-source-link')[0];
      fireEvent.click(source);
      expect(screen.getByTestId('journal-source')).not.toHaveTextContent(
        person.publicDescription
      );
    }
  );

  it('resets new destinations and restores scroll and focus when returning from a related card', () => {
    const fixture = makePublicJournalFixture('pl');
    render(
      <SessionJournal character={fixture.characters[0]} model={fixture.model} />
    );
    const reader = screen.getByTestId('journal-reader');
    reader.scrollTop = 210;
    const tile = screen.getByRole('button', {
      name: `Otwórz: ${fixture.labels.finding}`,
    });
    tile.focus();
    fireEvent.click(tile);
    expect(reader.scrollTop).toBe(0);
    reader.scrollTop = 135;
    const related = screen.getByRole('button', { name: fixture.labels.place });
    related.focus();
    fireEvent.click(related);
    expect(reader.scrollTop).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Wróć' }));
    expect(reader.scrollTop).toBe(135);
    expect(
      screen.getByRole('button', { name: fixture.labels.place })
    ).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Wróć' }));
    expect(reader.scrollTop).toBe(210);
    expect(
      screen.getByRole('button', { name: `Otwórz: ${fixture.labels.finding}` })
    ).toHaveFocus();
    fireEvent.click(
      within(screen.getByTestId('journal-contents')).getByRole('button', {
        name: /^Wydarzenia/,
      })
    );
    expect(reader.scrollTop).toBe(0);
  });
});
