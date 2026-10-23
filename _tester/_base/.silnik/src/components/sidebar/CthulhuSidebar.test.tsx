import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { CthulhuSidebar } from './CthulhuSidebar';
import { getAdventureById } from '@/lib/adventures-data';

let mockLocalTransport = false;
let mockTransportLoading = false;
jest.mock('@/hooks/useLocalPlaytestTransport', () => ({useLocalPlaytestTransport: () => ({serverConfigured:mockLocalTransport,serverHasBaseRules:mockLocalTransport,loading:mockTransportLoading})}));

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



describe('local solo Prabuty save and explicit withdrawal',()=>{
 const character:import('@/lib/types').Character={id:'player',name:'Tomasz',playerName:'Player',str:50,dex:50,con:50,app:50,pow:50,edu:50,siz:50,int:50,luck:50,hp:10,san:50,mp:10,skills:{},occupation:'Reporter',age:30,background:'',isActive:true,lastUsed:new Date(0),notes:'',equipment:[],experience:{totalXP:0,availableXP:0,earnedThisSession:0,maxEarnedThisSession:10},developmentHistory:[]};
 const originalFetch=global.fetch;
 const validMode={mode:'local_playtest',adventureId:'cien-nad-prabutami',editionFingerprint:'sha256:'+'a'.repeat(64)};
 const base={activeCharacter:character,adventureContext:getAdventureById('cien-nad-prabutami')!};
 beforeEach(()=>{localStorage.clear();mockLocalTransport=true;mockTransportLoading=false;global.fetch=jest.fn(async url=>{if(url!=='/api/adventure-dossier/playtest')throw new Error('Unexpected test request');return {status:200,ok:true,json:async()=>validMode} as Response;});});
 afterEach(()=>{global.fetch=originalFetch;mockLocalTransport=false;mockTransportLoading=false;delete process.env.NEXT_INTL_TEST_LOCALE;});
 it.each(['pl','en'])('%s opens normal save UI without any chat request or premature save claim',async locale=>{
  process.env.NEXT_INTL_TEST_LOCALE=locale;const save=jest.fn(),send=jest.fn();render(<CthulhuSidebar {...base} onSaveGame={save} handleSendMessage={send}/>);
  fireEvent.click(await screen.findByRole('button',{name:locale==='pl'?'Zakończ lub zapisz':'End or save'}));
  expect(screen.getByText(locale==='pl'?'Otwórz okno zapisu i zapisz grę przed przerwą.':'Open the save dialog and save your game before taking a break.')).toBeVisible();
  fireEvent.click(screen.getByTestId('pilot-save-game'));expect(save).toHaveBeenCalledTimes(1);expect(send).not.toHaveBeenCalled();
  expect(screen.queryByTestId('pilot-withdraw-confirm')).not.toBeInTheDocument();
 });
 it.each(['pl','en'])('%s requires a second explicit confirmation and emits only one plain withdrawal declaration',async locale=>{
  process.env.NEXT_INTL_TEST_LOCALE=locale;const send=jest.fn();render(<CthulhuSidebar {...base} handleSendMessage={send}/>);
  fireEvent.click(await screen.findByRole('button',{name:locale==='pl'?'Zakończ lub zapisz':'End or save'}));
  fireEvent.click(screen.getByRole('button',{name:locale==='pl'?'Wycofaj się ze śledztwa':'Withdraw from the investigation'}));
  expect(send).not.toHaveBeenCalled();expect(screen.getByText(locale==='pl'?'Wycofanie kończy tę wyprawę z nierozwiązaną tajemnicą. Czy potwierdzasz tę decyzję?':'Withdrawing ends this investigation with the mystery unresolved. Do you confirm this decision?')).toBeVisible();
  fireEvent.click(screen.getByTestId('pilot-withdraw-confirm'));expect(send).toHaveBeenCalledTimes(1);expect(send).toHaveBeenCalledWith('Wycofuję się ze śledztwa.');
  expect(screen.queryByTestId('pilot-withdraw-confirm')).not.toBeInTheDocument();
 });
 it('cancel and adventure changes discard pending confirmation without publishing a declaration',async()=>{
  process.env.NEXT_INTL_TEST_LOCALE='pl';const send=jest.fn();const {rerender}=render(<CthulhuSidebar {...base} handleSendMessage={send}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Zakończ lub zapisz'}));fireEvent.click(screen.getByRole('button',{name:'Wycofaj się ze śledztwa'}));
  fireEvent.click(screen.getByRole('button',{name:'Wróć do gry'}));expect(send).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole('button',{name:'Zakończ lub zapisz'}));fireEvent.click(screen.getByRole('button',{name:'Wycofaj się ze śledztwa'}));
  rerender(<CthulhuSidebar {...base} adventureContext={null} handleSendMessage={send}/>);
  rerender(<CthulhuSidebar {...base} handleSendMessage={send}/>);
  expect(screen.queryByTestId('pilot-withdraw-confirm')).not.toBeInTheDocument();expect(send).not.toHaveBeenCalled();
 });
 it.each(['no-transport','other-adventure','duet'] as const)('preserves the generic end-session action for %s',mode=>{
  process.env.NEXT_INTL_TEST_LOCALE='pl';mockLocalTransport=mode!=='no-transport';const send=jest.fn();
  render(<CthulhuSidebar {...base} adventureContext={mode==='other-adventure'?null:base.adventureContext} hotSeatConfig={mode==='duet'?{enabled:true,players:[],activePlayerIndex:0,allowInterruptions:true,showPlayerIndicator:true}:undefined} handleSendMessage={send}/>);
  fireEvent.click(screen.getByRole('button',{name:'Koniec Sesji'}));expect(send).toHaveBeenCalledWith('[KONIEC_SESJI]');expect(screen.queryByTestId('pilot-withdraw-confirm')).not.toBeInTheDocument();
 });
 it('cold F5 cannot enter legacy closure while trusted capability is pending',async()=>{
  process.env.NEXT_INTL_TEST_LOCALE='pl';mockLocalTransport=false;mockTransportLoading=true;const send=jest.fn();
  const {rerender}=render(<CthulhuSidebar {...base} handleSendMessage={send}/>);
  const pending=screen.getByRole('button',{name:'Koniec Sesji'});expect(pending).toBeDisabled();fireEvent.click(pending);expect(send).not.toHaveBeenCalled();
  mockLocalTransport=true;mockTransportLoading=false;rerender(<CthulhuSidebar {...base} handleSendMessage={send}/>);
  expect(await screen.findByRole('button',{name:'Zakończ lub zapisz'})).toBeEnabled();expect(send).not.toHaveBeenCalled();
 });
 it.each([
  [404,validMode],[200,{...validMode,mode:'release'}],[200,{...validMode,adventureId:'foreign'}],
  [200,{...validMode,editionFingerprint:'not-a-hash'}],[201,validMode],
 ])('requires exact server playtest mode; %s / %j retains ordinary closure',async(status,body)=>{
  process.env.NEXT_INTL_TEST_LOCALE='pl';const send=jest.fn();jest.mocked(fetch).mockResolvedValueOnce({status,ok:status===200,json:async()=>body} as Response);
  render(<CthulhuSidebar {...base} handleSendMessage={send}/>);
  await waitFor(()=>expect(screen.getByRole('button',{name:'Koniec Sesji'})).toBeEnabled());
  expect(screen.queryByRole('button',{name:'Zakończ lub zapisz'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Koniec Sesji'}));expect(send).toHaveBeenCalledWith('[KONIEC_SESJI]');
 });
 it('disables closure until the mode request settles and discards an aborted old scope response',async()=>{
  process.env.NEXT_INTL_TEST_LOCALE='pl';const send=jest.fn();let resolve!:(response:Response)=>void;
  jest.mocked(fetch).mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
  const {rerender}=render(<CthulhuSidebar {...base} handleSendMessage={send}/>);
  const pending=screen.getByRole('button',{name:'Koniec Sesji'});expect(pending).toBeDisabled();fireEvent.click(pending);expect(send).not.toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledWith('/api/adventure-dossier/playtest',expect.objectContaining({cache:'no-store',signal:expect.any(AbortSignal)}));
  const signal=jest.mocked(fetch).mock.calls[0][1]!.signal!;
  rerender(<CthulhuSidebar {...base} adventureContext={null} handleSendMessage={send}/>);expect(signal.aborted).toBe(true);
  jest.mocked(fetch).mockResolvedValueOnce({status:404,ok:false,json:async()=>({})} as Response);
  rerender(<CthulhuSidebar {...base} handleSendMessage={send}/>);
  await waitFor(()=>expect(screen.getByRole('button',{name:'Koniec Sesji'})).toBeEnabled());
  await act(async()=>resolve({status:200,ok:true,json:async()=>validMode} as Response));
  expect(screen.queryByRole('button',{name:'Zakończ lub zapisz'})).not.toBeInTheDocument();expect(send).not.toHaveBeenCalled();
 });
 it('a failed mode request preserves generic closure and unmount aborts pending verification',async()=>{
  process.env.NEXT_INTL_TEST_LOCALE='pl';jest.mocked(fetch).mockRejectedValueOnce(new Error('network unavailable'));
  const first=render(<CthulhuSidebar {...base}/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Koniec Sesji'})).toBeEnabled());first.unmount();
  jest.mocked(fetch).mockImplementationOnce(()=>new Promise(()=>{}));
  const second=render(<CthulhuSidebar {...base}/>);const signal=jest.mocked(fetch).mock.calls.at(-1)![1]!.signal!;
  expect(signal.aborted).toBe(false);second.unmount();expect(signal.aborted).toBe(true);
 });
 it('keeps an ended game disabled without offering another withdrawal',()=>{
  process.env.NEXT_INTL_TEST_LOCALE='pl';const send=jest.fn();render(<CthulhuSidebar {...base} sessionEndStatus="ended" isSessionEnded handleSendMessage={send}/>);
  expect(screen.getByRole('button',{name:'Sesja Zamknięta'})).toBeDisabled();expect(screen.queryByRole('button',{name:'Zakończ lub zapisz'})).not.toBeInTheDocument();expect(send).not.toHaveBeenCalled();
 });
});
