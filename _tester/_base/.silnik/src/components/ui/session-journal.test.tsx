import { fireEvent, render, screen, within } from '@testing-library/react';
import type { Character, JournalEntry, SceneCaseCard } from '@/lib/types';
import { PREDEFINED_CHARACTERS } from '@/lib/immersion/predefined-characters';
import { isPlotRelevantItem, filterPlotItems } from '@/lib/journal/item-filter';
import { SessionJournal } from './session-journal';

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

describe('SessionJournal reader', () => {
  const scene = (number: number, extra: Partial<SceneCaseCard> = {}): SceneCaseCard => ({
    id: `scene-${number}`, sceneNumber: number, location: `Miejsce ${number}`,
    title: `Rozdział ${number}`, timestamp: `2026-10-${String(number).padStart(2, '0')}T10:00:00Z`,
    people: ['Stanisław'], findings: [], keyTakeaways: [], isSealed: true,
    chronicleSummaryByLocale: { pl: `Stanisław twierdził, że list ${number} wysłano z doków.`, en: `Stanisław claimed letter ${number} came from the docks.` },
    ...extra,
  });
  const character = (scenes: SceneCaseCard[] = []): Character => ({ ...PREDEFINED_CHARACTERS[0], name: 'Maria', sceneCards: scenes, journal: [], actReports: [] });
  const scroll = jest.fn();
  beforeEach(() => { HTMLElement.prototype.scrollIntoView = scroll; scroll.mockClear(); });
  afterEach(() => { delete process.env.NEXT_INTL_TEST_LOCALE; jest.restoreAllMocks(); });

  it('ukrywa instrukcję obrazu ze starego opisu lokacji, zachowując fabułę', () => {
    const data = character();
    data.journal = [{ id: 'old-location', tags: [], type: 'location', title: 'Gabinet Katedry Etnografii UW', timestamp: new Date(), isBookmarked: false,
      content: 'subjective first-person camera POV, dim room lit by single desk lamp, archival noir photography 1970s\n\nRedaktor Bielski przyniósł taśmę z Prabut.' }];
    render(<SessionJournal character={data} />);
    expect(screen.queryByText(/camera POV/)).toBeNull();
    expect(screen.getByText('Redaktor Bielski przyniósł taśmę z Prabut.')).toBeVisible();
  });

  it('zachowuje relację o aparacie i fotografii oraz fabułę po promptcie w jednym akapicie', () => {
    process.env.NEXT_INTL_TEST_LOCALE = 'en';
    const data = character();
    data.journal = [
      { id: 'photo', tags: [], type: 'location', title: 'Office', timestamp: new Date(), isBookmarked: false, content: 'We found a camera and a photograph of the missing man.' },
      { id: 'mixed', tags: [], type: 'location', title: 'Archive', timestamp: new Date(), isBookmarked: false, content: 'subjective first-person camera POV, archival noir photography 1970s. Redaktor Bielski przyniósł taśmę z Prabut.' },
    ];
    render(<SessionJournal character={data} />);
    expect(screen.getByText('We found a camera and a photograph of the missing man.')).toBeVisible();
    expect(screen.getByText('Redaktor Bielski przyniósł taśmę z Prabut.')).toBeVisible();
    expect(screen.queryByText(/camera POV/)).toBeNull();
  });

  it.each(['pl', 'en'])('renderuje ciągły zapis i źródło plotki w %s', (locale) => {
    process.env.NEXT_INTL_TEST_LOCALE = locale;
    render(<SessionJournal character={character([scene(2), scene(1)])} onClose={jest.fn()} />);
    const articles = screen.getAllByTestId('journal-entry');
    expect(articles).toHaveLength(2);
    expect(within(articles[0]).getByRole('heading')).toHaveTextContent('Rozdział 1');
    expect(within(articles[1]).getByRole('heading')).toHaveTextContent('Rozdział 2');
    expect(articles[0]).toHaveTextContent(locale === 'pl' ? 'Stanisław twierdził, że list 1' : 'Stanisław claimed letter 1');
    expect(screen.getByRole('dialog')).toHaveAccessibleName(locale === 'pl' ? 'Kronika' : 'Chronicle');
    expect(scroll).toHaveBeenCalledWith({ block: 'start' });
  });

  it('nawigacja przewija do fragmentu bez ukrywania pozostałych wpisów', () => {
    render(<SessionJournal character={character([scene(1), scene(2)])} />);
    const navigation = screen.getByTestId('journal-contents');
    fireEvent.click(within(navigation).getByRole('button', { name: /Scena #1/ }));
    expect(scroll).toHaveBeenLastCalledWith({ block: 'start', behavior: 'smooth' });
    expect(screen.getAllByTestId('journal-entry')).toHaveLength(2);
    expect(screen.getAllByTestId('journal-entry')[0]).toHaveFocus();
  });

  it('zapis pozostaje tylko do czytania, bez liczników i porad ze starych raportów', () => {
    const data = character([scene(1, { nextStep: 'Sprawdź doki', isLocationExhausted: true })]);
    data.actReports = [{ id: 'act', actNumber: 1, title: 'Raport', confirmedFacts: ['Jan jest winny'], suspects: ['Jan'], unresolvedQuestions: ['Motyw'], leadHypothesis: 'Zabójcą jest Jan' }];
    const onQuote = jest.fn(); const onUpdate = jest.fn();
    render(<SessionJournal character={data} totalCluesEstimated={20} onQuoteToInput={onQuote} onUpdateCharacter={onUpdate} />);
    expect(screen.queryByTestId('clue-counter-badge')).toBeNull();
    expect(screen.queryByText(/Jan jest winny|Zabójcą jest Jan|Sprawdź doki|Przeszukana wyczerpująco/)).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /syntez|cytuj|hipotez/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Scena #1/ }));
    expect(onQuote).not.toHaveBeenCalled(); expect(onUpdate).not.toHaveBeenCalled();
  });

  it('zachowuje dawne znaleziska bez wybierania wartościowych tropów', () => {
    render(<SessionJournal character={character([scene(1, { chronicleSummaryByLocale: undefined, findings: ['Baterie', 'Zapałki', 'Telegram'], keyTakeaways: ['Świadek milczał.'] })])} />);
    const article = screen.getByTestId('journal-entry');
    expect(article).toHaveTextContent('Baterie, Zapałki, Telegram');
    expect(article).toHaveTextContent('Świadek milczał.');
  });

  it('nowy wpis oczekujący nie udaje przebiegu sceny', () => {
    render(<SessionJournal character={character([scene(1, { endMessageId: 'end', chronicleSummaryByLocale: undefined, keyTakeaways: ['Zbadano lokację i zabezpieczono poszlaki.'], findings: ['Sekretny trop'] })])} />);
    expect(screen.getByText('Podsumowanie tej sceny nie jest jeszcze dostępne.')).toBeInTheDocument();
    expect(screen.queryByText(/Zbadano lokację|Sekretny trop/)).toBeNull();
  });

  it('zachowuje zapis starej sceny o nieznanym początku bez podsumowania całego czatu', () => {
    render(<SessionJournal character={character([scene(1, { endMessageId: 'end', chronicleBoundaryKnown: false, chronicleSummaryByLocale: undefined, findings: ['Baterie'], keyTakeaways: ['Portier twierdził, że widział Jana.'] })])} />);
    expect(screen.getByTestId('journal-legacy-record')).toHaveTextContent('Portier twierdził');
    expect(screen.getByTestId('journal-entry')).toHaveTextContent('Baterie');
    expect(screen.queryByText('Podsumowanie tej sceny nie jest jeszcze dostępne.')).toBeNull();
  });

  it('scala wspólne karty bez duplikatu i preferuje wspólny nowszy zapis', () => {
    const updated = scene(1, { chronicleSummaryByLocale: { pl: 'Drużyna rozmawiała ze Stanisławem.' } });
    const shared: JournalEntry[] = [{ id: 'journal-1', timestamp: new Date(), type: 'scene', title: updated.title, content: 'fallback', tags: [], isBookmarked: false, sceneData: updated }];
    render(<SessionJournal character={character([scene(1)])} sharedJournal={shared} participantNames={['Maria', 'Jan']} />);
    expect(screen.getAllByTestId('journal-entry')).toHaveLength(1);
    expect(screen.getByTestId('scene-chronicle-summary')).toHaveTextContent('Drużyna rozmawiała ze Stanisławem.');
    expect(screen.getByText('Drużyna: Maria, Jan')).toBeInTheDocument();
  });

  it('pokazuje starszy samodzielny wpis, lecz pomija raport z hipotezą', () => {
    const data = character();
    data.journal = [
      { id: 'old', timestamp: new Date(), type: 'scene', title: 'Dawna rozmowa', content: 'Portier twierdził, że widział Jana.', tags: [], isBookmarked: false },
      { id: 'report', timestamp: new Date(), type: 'act_report', title: 'Raport z hipotezą', content: 'Jan jest winny.', tags: [], isBookmarked: false },
    ];
    render(<SessionJournal character={data} />);
    expect(screen.getByTestId('journal-legacy-record')).toHaveTextContent('Portier twierdził');
    expect(screen.queryByText('Raport z hipotezą')).toBeNull();
  });

  it('gotowy zapis postaci zastępuje oczekującą wspólną kopię', () => {
    const pending = scene(1, { endMessageId: 'end', chronicleSummaryByLocale: undefined });
    const shared: JournalEntry[] = [{ id: 'shared', timestamp: new Date(), type: 'scene', title: pending.title, content: '', tags: [], isBookmarked: false, sceneData: pending }];
    render(<SessionJournal character={character([scene(1)])} sharedJournal={shared} />);
    expect(screen.getAllByTestId('journal-entry')).toHaveLength(1);
    expect(screen.getByTestId('scene-chronicle-summary')).toHaveTextContent('Stanisław twierdził');
  });

  it('odświeżenie callbacku nie przenosi fokusu, a Escape używa aktualnego callbacku', () => {
    const firstClose = jest.fn(); const nextClose = jest.fn();
    const data = character([scene(1)]);
    const view = render(<SessionJournal character={data} onClose={firstClose} />);
    fireEvent.click(within(screen.getByTestId('journal-contents')).getByRole('button'));
    const article = screen.getByTestId('journal-entry');
    view.rerender(<SessionJournal character={data} onClose={nextClose} />);
    expect(article).toHaveFocus();
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Zamknij dziennik' })).toHaveFocus();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(firstClose).not.toHaveBeenCalled();
    expect(nextClose).toHaveBeenCalledTimes(1);
  });

  it('nie wyświetla niezapieczętowanych kart ani automatycznych porad aktywnej sceny', () => {
    const data = character([scene(1, { isSealed: false })]);
    data.activeScene = { sceneNumber: 1, location: 'Archiwum', startedAt: '2026-10-10', people: [], findings: ['Ukryty trop'], notes: ['Idź do doków'], isLocationExhausted: true };
    render(<SessionJournal character={data} />);
    expect(screen.queryByTestId('journal-entry')).toBeNull();
    expect(screen.getByText('Pierwszy wpis jest jeszcze przed nami')).toBeInTheDocument();
    expect(screen.getByText('Teraz: Archiwum')).toBeInTheDocument();
    expect(screen.queryByText(/Idź do doków|Ukryty trop/)).toBeNull();
  });

  it('obsługuje pustą kronikę, zamknięcie i Escape', () => {
    const onClose = jest.fn(); render(<SessionJournal character={character()} onClose={onClose} />);
    expect(screen.getByText('Pierwszy wpis jest jeszcze przed nami')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zamknij dziennik' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('utrzymuje cały zapis długiej kampanii bez obcinania starszych wpisów', () => {
    render(<SessionJournal character={character(Array.from({ length: 60 }, (_, i) => scene(i + 1)))} />);
    expect(screen.getAllByTestId('journal-entry')).toHaveLength(60);
    expect(within(screen.getByTestId('journal-contents')).getAllByRole('button')).toHaveLength(60);
  });

  it.each(['pl', 'en'])('pokazuje przygody i trwałe granice sesji w %s, bez zgadywania starych wpisów', (locale) => {
    process.env.NEXT_INTL_TEST_LOCALE = locale;
    const chapter = { playthroughId: 'run', campaignDefinitionId: 'campaign', adventureId: 'archive', adventureTitle: 'Archiwum', sessionId: 's1', sessionNumber: 1 };
    render(<SessionJournal character={character([
      scene(1),
      scene(2, { chronicleChapter: chapter }),
      scene(3, { chronicleChapter: { ...chapter, sessionId: 's2', sessionNumber: 2 } }),
      scene(4, { chronicleChapter: { ...chapter, adventureId: 'docks', adventureTitle: 'Doki', sessionId: 's3', sessionNumber: 3 } }),
    ])} />);
    expect(screen.getAllByTestId('journal-entry')).toHaveLength(4);
    expect(screen.getByRole('heading', { name: locale === 'pl' ? 'Wcześniejsze wpisy' : 'Earlier entries' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Archiwum' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Doki' })).toBeInTheDocument();
    expect(screen.getAllByTestId('journal-session-header').map((header) => header.textContent)).toEqual(locale === 'pl' ? ['Sesja 1', 'Sesja 2', 'Sesja 3'] : ['Session 1', 'Session 2', 'Session 3']);
  });
});
