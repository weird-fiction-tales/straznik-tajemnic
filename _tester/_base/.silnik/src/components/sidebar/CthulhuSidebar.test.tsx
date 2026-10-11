import { render, screen, act, fireEvent } from '@testing-library/react';
import { CthulhuSidebar } from './CthulhuSidebar';

jest.mock('../ui/youtube-player', () => ({
  YouTubePlayer: ({ isTTSPlaying }: { isTTSPlaying?: boolean }) => (
    <div data-testid="youtube-player">YouTube player {isTTSPlaying ? 'ducked' : 'normal'}</div>
  ),
}));

jest.mock('../ui/character-sheet', () => ({
  CharacterSheet: () => null,
}));

describe('CthulhuSidebar player tools', () => {
  afterEach(() => {
    delete process.env.NEXT_INTL_TEST_LOCALE;
  });

  it('renders the existing YouTube player in Investigator Tools without GM Tools', () => {
    process.env.NEXT_INTL_TEST_LOCALE = 'en';

    render(<CthulhuSidebar isTTSPlaying />);

    expect(screen.getByText('Investigator Tools')).toBeInTheDocument();
    expect(screen.getByTestId('youtube-player')).toHaveTextContent('ducked');
    expect(screen.queryByText(/GM Tools/i)).not.toBeInTheDocument();
  });

  it('blokuje przycisk Fazy Rozwoju w trakcie aktywnej gry (CoC 7e puryzm)', () => {
    process.env.NEXT_INTL_TEST_LOCALE = 'pl';
    const mockOpenDev = jest.fn();
    const mockChar = {
      id: 'char_1',
      name: 'Harvey',
      skills: {},
    } as never;

    render(
      <CthulhuSidebar
        activeCharacter={mockChar}
        onOpenDevelopmentPhase={mockOpenDev}
        isSessionEnded={false}
        sessionEndStatus="idle"
      />
    );

    const lockedBtn = screen.getByTitle(/Faza Rozwoju według zasad d100 Weird Fiction jest dostępna dopiero po zakończeniu sesji/i);
    expect(lockedBtn).toBeInTheDocument();
    expect(lockedBtn).toBeDisabled();
  });

  it('odblokowuje przycisk Fazy Rozwoju po zakończeniu sesji', () => {
    process.env.NEXT_INTL_TEST_LOCALE = 'pl';
    const mockOpenDev = jest.fn();
    const mockChar = {
      id: 'char_1',
      name: 'Harvey',
      skills: {},
    } as never;

    render(
      <CthulhuSidebar
        activeCharacter={mockChar}
        onOpenDevelopmentPhase={mockOpenDev}
        isSessionEnded={true}
        sessionEndStatus="ended"
      />
    );

    const readyBtn = screen.getByTitle(/Sesja zakończona! Otwórz Fazę Rozwoju/i);
    expect(readyBtn).toBeInTheDocument();
    expect(readyBtn).not.toBeDisabled();
    readyBtn.click();
    expect(mockOpenDev).toHaveBeenCalledTimes(1);
  });

  it('poprawnie renderuje stan oczekiwania na słowo gracza bez rozbijania ramki', () => {
    process.env.NEXT_INTL_TEST_LOCALE = 'pl';
    const mockChar = {
      id: 'char_1',
      name: 'Harvey',
      skills: {},
    } as never;

    render(
      <CthulhuSidebar
        activeCharacter={mockChar}
        isSessionEnded={false}
        sessionEndStatus="awaiting_player_closure"
      />
    );

    const awaitingBtn = screen.getByTitle(/Trwa domykanie sesji/i);
    expect(awaitingBtn).toBeInTheDocument();
    expect(awaitingBtn).toBeDisabled();
    expect(awaitingBtn).toHaveTextContent(/Oczekiwanie na słowo gracza.../i);
  });

  it('renderuje stan bezpiecznie zamkniętej sesji z właściwą etykietą i tytułem', () => {
    process.env.NEXT_INTL_TEST_LOCALE = 'pl';
    const mockChar = {
      id: 'char_1',
      name: 'Harvey',
      skills: {},
    } as never;

    render(
      <CthulhuSidebar
        activeCharacter={mockChar}
        isSessionEnded={true}
        sessionEndStatus="ended"
      />
    );

    const closedBtn = screen.getByTitle(/Sesja została bezpiecznie zamknięta/i);
    expect(closedBtn).toBeInTheDocument();
    expect(closedBtn).toBeDisabled();
    expect(closedBtn).toHaveTextContent(/Sesja Zamknięta/i);
  });

  it('bezpiecznie renderuje portret postaci gdy adventureContext jest pusty (ochrona przed błędem epoki)', () => {
    process.env.NEXT_INTL_TEST_LOCALE = 'pl';
    const mockChar = {
      id: 'char_1',
      name: 'Harvey Walters',
      occupation: 'Dziennikarz',
      portraitUrl: 'https://example.com/harvey.png',
      hp: 10,
      san: 50,
      mp: 10,
      luck: 50,
      skills: {},
    } as never;

    render(
      <CthulhuSidebar
        activeCharacter={mockChar}
        adventureContext={null}
      />
    );

    const img = screen.getByAltText('Harvey Walters');
    expect(img).toBeInTheDocument();
    // Domyślny klasyczny filtr CoC 1920s gdy kontekst przygody jest pusty
    expect(img).toHaveStyle({ filter: 'sepia(0.22) saturate(0.76) contrast(1.04) brightness(0.98)' });
  });

  it('stosuje autentyczny filtr epoki 1980s dla scenariusza Traszyn (1983-1999)', () => {
    process.env.NEXT_INTL_TEST_LOCALE = 'pl';
    const mockChar = {
      id: 'char_1',
      name: 'Ksiądz Jan',
      occupation: 'Egzorcysta',
      portraitUrl: 'https://example.com/jan.png',
      hp: 10,
      san: 50,
      mp: 10,
      luck: 50,
      skills: {},
    } as never;

    const mockAdventure = {
      id: 'tajemnica-dzieci-z-traszyna',
      title: 'Tajemnica Dzieci z Traszyna',
      era: '1990s',
      yearRange: '1983-1999',
    } as never;

    render(
      <CthulhuSidebar
        activeCharacter={mockChar}
        adventureContext={mockAdventure}
      />
    );

    const img = screen.getByAltText('Ksiądz Jan');
    expect(img).toBeInTheDocument();
    // 1980s filter
    expect(img).toHaveStyle({ filter: 'sepia(0.04) saturate(0.88) contrast(1.04) brightness(0.97)' });
  });

  it('renderuje Kompendium i Kulisy MG w sekcji Pomoce Badacza i obsługuje przełączanie', () => {
    process.env.NEXT_INTL_TEST_LOCALE = 'pl';
    const mockOpenHelp = jest.fn();

    render(
      <CthulhuSidebar
        onOpenHelp={mockOpenHelp}
      />
    );

    // Kompendium w Pomocach Badacza
    const compendiumBtn = screen.getByTitle(/Otwórz kompendium wiedzy/i);
    expect(compendiumBtn).toBeInTheDocument();
    act(() => {
      compendiumBtn.click();
    });
    expect(mockOpenHelp).toHaveBeenCalledTimes(1);

    // Kulisy MG w Pomocach Badacza
    const directorBtn = screen.getByTitle(/Przełącz widok kulis Mistrza Gry/i);
    expect(directorBtn).toBeInTheDocument();
    expect(directorBtn).toHaveAttribute('aria-pressed', 'false');
    expect(directorBtn).toHaveTextContent(/Wył/i);

    act(() => {
      directorBtn.click();
    });
    expect(directorBtn).toHaveAttribute('aria-pressed', 'true');
    expect(directorBtn).toHaveTextContent(/Wł/i);
  });

  it('nie renderuje dropdownu wyboru postaci ani licznika gdy sesja ma tylko 1 postać (tryb Solo)', () => {
    process.env.NEXT_INTL_TEST_LOCALE = 'pl';
    const mockChar = { id: 'char_1', name: 'Helena Krawczyk', skills: {} } as never;

    render(
      <CthulhuSidebar
        activeCharacter={mockChar}
        characters={[mockChar]}
      />
    );

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByText('1/1')).not.toBeInTheDocument();
    expect(screen.getByText('Helena Krawczyk')).toBeInTheDocument();
  });

  it('renderuje dropdown wyboru postaci i licznik gdy sesja ma co najmniej 2 postacie (Hot Seat / Duet)', () => {
    process.env.NEXT_INTL_TEST_LOCALE = 'pl';
    const mockChar1 = { id: 'char_1', name: 'Helena Krawczyk', occupation: 'Producent', skills: {} } as never;
    const mockChar2 = { id: 'char_2', name: 'Ryszard Kaczmarek', occupation: 'Oficer', skills: {} } as never;

    render(
      <CthulhuSidebar
        activeCharacter={mockChar1}
        characters={[mockChar1, mockChar2]}
      />
    );

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  it('wywołuje onCharacterSwitch po zmianie wyboru w dropdownie postaci', () => {
    process.env.NEXT_INTL_TEST_LOCALE = 'pl';
    const mockChar1 = { id: 'char_1', name: 'Helena Krawczyk', occupation: 'Producent', skills: {} } as never;
    const mockChar2 = { id: 'char_2', name: 'Ryszard Kaczmarek', occupation: 'Oficer', skills: {} } as never;
    const mockOnSwitch = jest.fn();

    render(
      <CthulhuSidebar
        activeCharacter={mockChar1}
        characters={[mockChar1, mockChar2]}
        onCharacterSwitch={mockOnSwitch}
      />
    );

    const select = screen.getByRole('combobox');
    act(() => {
      fireEvent.change(select, { target: { value: 'char_2' } });
    });

    expect(mockOnSwitch).toHaveBeenCalledWith(mockChar2);
  });

  it('renderuje kontrolkę oświetlenia Hue w Ustawieniach i obsługuje szybki toggle oraz światło awaryjne', () => {
    process.env.NEXT_INTL_TEST_LOCALE = 'pl';
    localStorage.setItem(
      'straznik_hue_config',
      JSON.stringify({
        enabled: true,
        bridgeIp: '192.168.1.10',
        appKey: 'test-app-key',
        selectedLightIds: ['1'],
      })
    );

    render(<CthulhuSidebar />);

    // Kontrolka Hue powinna być widoczna ze stanem Wł
    expect(screen.getByText(/Światło Hue:\s*Wł/i)).toBeInTheDocument();
    // Przycisk światła awaryjnego 100%
    const emergencyBtn = screen.getByTitle(/Światło Awaryjne 100%/i);
    expect(emergencyBtn).toBeInTheDocument();

    // Kliknięcie toggle Hue przełącza na Wył
    const hueToggleBtn = screen.getByTitle(/Włącz lub wyłącz nastrojowe oświetlenie Philips Hue/i);
    act(() => {
      fireEvent.click(hueToggleBtn);
    });

    expect(screen.getByText(/Światło Hue:\s*Wył/i)).toBeInTheDocument();
  });
});

