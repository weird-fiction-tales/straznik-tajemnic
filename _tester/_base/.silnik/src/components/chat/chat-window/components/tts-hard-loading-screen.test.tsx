import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TTSHardLoadingScreen } from './tts-hard-loading-screen';

// Mock next-intl useTranslations i useLocale
let mockLocale = 'pl';
jest.mock('next-intl', () => ({
  useLocale: () => mockLocale,
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    const messages: Record<string, string> = {
      preparingSession: 'Strażnik Tajemnic przygotowuje sesję...',
      generatingStory: 'Trwa spisywanie mrocznej kroniki i dostrajanie głosu...',
      hookHeader: 'Meldunek operacyjny / Telegram do Badaczy',
      settingTriviaHeader: 'Realia Epoki i Świata',
      settingTriviaSubtitle: 'Kontekst historyczny i zasady świata',
      periodKnowledgeBadge: 'Wiedza Badacza z epoki',
      investigationStatus: 'Aktywne Śledztwo',
      spoilerFree: 'BEZ SPOILERÓW',
      confidential: 'DLA BADACZA',
      bufferingNarrator: 'Wsłuchiwanie się w głos z zaświatów...',
      chronicleDossier: 'Akta Śledztwa',
      playBriefing: 'Odsłuchaj zapowiedź sprawy',
      pauseBriefing: 'Pauza',
      playingBriefing: 'Odtwarzanie zapowiedzi sprawy...',
      startingBriefing: 'Uruchamianie zapowiedzi...',
      cancelBriefing: 'Anuluj uruchamianie',
      briefingPlaybackError: 'Nie udało się odtworzyć zapowiedzi. Spróbuj ponownie.',
      briefingAudioTitle: 'Zapowiedź lektorska (audiobook)',
      defaultChronicleIntro: 'W cieniu zapomnianych ulic i zakurzonych archiwów kryją się sekrety...',
      defaultChronicleHook: 'Zbieg tajemniczych okoliczności rzuca badaczy w samo serce śledztwa...',
      enterAdventure: 'Rozpocznij Przygodę',
      chronicleReady: 'Pieczęć złamana. Czas stawić czoła nieznanemu.',
      awaitingAccept: 'Kliknij, aby rozpocząć śledztwo',
      themesLabel: 'Motywy:',
      eraLabel: 'Epoka:',
      locationLabel: 'Lokalizacja:',
    };
    if (params) {
      let msg = messages[key] || key;
      Object.entries(params).forEach(([k, v]) => {
        msg = msg.replace(`{${k}}`, String(v));
      });
      return msg;
    }
    return messages[key] || key;
  },
}));

let audioInstances: HTMLAudioElement[];
let resolvePlayback: () => void;

beforeEach(() => {
  mockLocale = 'pl';
  audioInstances = [];
  jest.spyOn(globalThis, 'Audio').mockImplementation((src?: string) => {
    const audio = document.createElement('audio');
    if (src) audio.src = src;
    audio.load = jest.fn();
    audio.pause = jest.fn();
    audio.play = jest.fn(() => new Promise<void>((resolve) => { resolvePlayback = resolve; }));
    audioInstances.push(audio);
    return audio;
  });
});

afterEach(() => jest.restoreAllMocks());

describe('zapowiedź audio (Issue #826)', () => {
  const props = { isStarting: true, adventureTitle: 'Cień nad Prabutami' };

  it('przygotowuje plik przed kliknięciem bez automatycznego odtwarzania', () => {
    render(<TTSHardLoadingScreen {...props} />);
    expect(audioInstances).toHaveLength(1);
    expect(audioInstances[0].preload).toBe('auto');
    expect(audioInstances[0].load).toHaveBeenCalledTimes(1);
    expect(audioInstances[0].play).not.toHaveBeenCalled();
  });

  it('od razu pokazuje oczekiwanie i pozwala je anulować bez późnego startu', async () => {
    render(<TTSHardLoadingScreen {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Odsłuchaj zapowiedź/i }));
    const cancel = screen.getByRole('button', { name: /Anuluj uruchamianie/i });
    expect(cancel).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Uruchamianie zapowiedzi...')).toBeInTheDocument();
    fireEvent.click(cancel);
    expect(audioInstances[0].pause).toHaveBeenCalled();
    await act(async () => resolvePlayback());
    expect(screen.getByRole('button', { name: /Odsłuchaj zapowiedź/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('obsługuje odtwarzanie, buforowanie i koniec nagrania', async () => {
    render(<TTSHardLoadingScreen {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Odsłuchaj zapowiedź/i }));
    await act(async () => resolvePlayback());
    expect(screen.getByRole('button', { name: /Pauza/i })).toHaveAttribute('aria-pressed', 'true');
    fireEvent(audioInstances[0], new Event('waiting'));
    expect(screen.getByText('Uruchamianie zapowiedzi...')).toBeInTheDocument();
    fireEvent(audioInstances[0], new Event('playing'));
    expect(screen.getByRole('button', { name: /Pauza/i })).toBeInTheDocument();
    fireEvent(audioInstances[0], new Event('ended'));
    expect(screen.getByRole('button', { name: /Odsłuchaj zapowiedź/i })).toBeInTheDocument();
  });

  it('pokazuje błąd pliku i pozwala ponowić odtwarzanie', () => {
    render(<TTSHardLoadingScreen {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Odsłuchaj zapowiedź/i }));
    fireEvent(audioInstances[0], new Event('error'));
    expect(screen.getByText('Nie udało się odtworzyć zapowiedzi. Spróbuj ponownie.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Odsłuchaj zapowiedź/i }));
    expect(audioInstances[0].load).toHaveBeenCalledTimes(2);
    expect(audioInstances[0].play).toHaveBeenCalledTimes(2);
  });

  it('zatrzymuje nagranie i ignoruje opóźnione play po ukryciu ekranu', async () => {
    const { rerender } = render(<TTSHardLoadingScreen {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Odsłuchaj zapowiedź/i }));
    rerender(<TTSHardLoadingScreen {...props} isStarting={false} />);
    expect(audioInstances[0].pause).toHaveBeenCalled();
    expect(audioInstances[0].getAttribute('src')).toBeNull();
    await act(async () => resolvePlayback());
    expect(screen.queryByRole('button', { name: /Pauza/i })).not.toBeInTheDocument();
  });

  it('zmiana sprawy zwalnia poprzedni plik i przygotowuje nowy', () => {
    const { rerender } = render(<TTSHardLoadingScreen {...props} />);
    rerender(<TTSHardLoadingScreen {...props} adventureTitle="Tajemnica Dzieci z Traszyna" />);
    expect(audioInstances).toHaveLength(2);
    expect(audioInstances[0].pause).toHaveBeenCalled();
    expect(audioInstances[0].getAttribute('src')).toBeNull();
    expect(audioInstances[1].src).toContain('/tajemnica-dzieci-z-traszyna/');
    expect(audioInstances[1].play).not.toHaveBeenCalled();
  });

  it('zmiana języka zatrzymuje oczekujący odsłuch również przy wspólnym pliku fallback', async () => {
    const { rerender } = render(<TTSHardLoadingScreen {...props} />);
    const originalUrl = audioInstances[0].src;
    fireEvent.click(screen.getByRole('button', { name: /Odsłuchaj zapowiedź/i }));
    mockLocale = 'en';
    rerender(<TTSHardLoadingScreen {...props} />);
    expect(audioInstances).toHaveLength(2);
    expect(audioInstances[0].pause).toHaveBeenCalled();
    expect(audioInstances[0].getAttribute('src')).toBeNull();
    expect(audioInstances[1].src).toBe(originalUrl);
    expect(audioInstances[1].play).not.toHaveBeenCalled();
    await act(async () => resolvePlayback());
    expect(screen.getByTestId('briefing-audio-toggle')).toHaveAttribute('data-state', 'idle');
  });
});

describe('TTSHardLoadingScreen (Issue #177, #364 & #482)', () => {
  it('allows cancelling while the narrator is still pending, without waiting for an error',()=>{
    const onCancel=jest.fn();
    render(<TTSHardLoadingScreen isStarting startProgress={75} onCancel={onCancel} />);
    fireEvent.click(screen.getByTestId('loading-screen-cancel-btn'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
  it('nie renderuje niczego, gdy wszystkie flagi są false', () => {
    const { container } = render(
      <TTSHardLoadingScreen isBuffering={false} isStarting={false} isReadyToEnter={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renderuje lewy boks Dossier z bezspoilerowym opisem oraz prawy boks z Realiami Epoki i Świata', () => {
    render(
      <TTSHardLoadingScreen
        isStarting={true}
        startProgress={45}
        adventureTitle="Cień nad Prabutami"
        adventureContext={{
          title: 'Cień nad Prabutami',
          investigatorIntro: 'Naukowa weryfikacja fenomenów ojca Klimuszki uderza w tajne operacje SB.',
          description: 'Pełny opis ze spoilerem o czwartym wymiarze i anomalii czasowej.',
          settingTrivia: [
            'W PRL lat 70. każde nieoficjalne zgromadzenie podlegało inwigilacji SB.',
            'Obywatele musieli posiadać dowód tożsamości w przestrzeni publicznej.',
          ],
          themes: ['Jasnowidzenie', 'Służba Bezpieczeństwa', 'Trauma wojenna'],
        }}
        region="Warszawa - Elbląg - Prabuty"
      />
    );

    expect(screen.getByTestId('tts-hard-loading-screen')).toBeInTheDocument();
    expect(screen.getByText('Cień nad Prabutami')).toBeInTheDocument();
    expect(screen.getByText('Strażnik Tajemnic przygotowuje sesję...')).toBeInTheDocument();

    // Lewy boks: bezspoilerowy investigatorIntro
    expect(screen.getByText('Naukowa weryfikacja fenomenów ojca Klimuszki uderza w tajne operacje SB.')).toBeInTheDocument();
    expect(screen.queryByText('Pełny opis ze spoilerem o czwartym wymiarze i anomalii czasowej.')).not.toBeInTheDocument();
    // Przycisk odsłuchu zapowiedzi lektorskiej
    expect(screen.getByRole('button', { name: /Odsłuchaj zapowiedź sprawy/i })).toBeInTheDocument();

    // Zero tagów motywów w lewym boksie (Issue #482)
    expect(screen.queryByText('Motywy:')).not.toBeInTheDocument();
    expect(screen.queryByText('Jasnowidzenie')).not.toBeInTheDocument();
    expect(screen.queryByText('Trauma wojenna')).not.toBeInTheDocument();

    // Prawy boks: Realia Epoki i Świata
    expect(screen.getByText('Realia Epoki i Świata')).toBeInTheDocument();
    expect(screen.getByText('W PRL lat 70. każde nieoficjalne zgromadzenie podlegało inwigilacji SB.')).toBeInTheDocument();
    expect(screen.getByText('Obywatele musieli posiadać dowód tożsamości w przestrzeni publicznej.')).toBeInTheDocument();

    expect(screen.getByText('BEZ SPOILERÓW')).toBeInTheDocument();
    expect(screen.getByText('Wiedza Badacza z epoki')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('wyświetla hero CTA po osiągnięciu 100% i obsługuje kliknięcie potwierdzenia', () => {
    const handleConfirm = jest.fn();
    render(
      <TTSHardLoadingScreen
        isStarting={true}
        isReadyToEnter={true}
        startProgress={100}
        adventureTitle="Cień nad Innsmouth"
        onConfirmEnterGame={handleConfirm}
      />
    );

    const ctaButton = screen.getByTestId('loading-screen-enter-cta');
    expect(ctaButton).toBeInTheDocument();
    expect(screen.getByText('Rozpocznij Przygodę')).toBeInTheDocument();
    expect(screen.getByText('Pieczęć złamana. Czas stawić czoła nieznanemu.')).toBeInTheDocument();

    fireEvent.click(ctaButton);
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it('dobiera automatyczne ciekawostki z epoki, gdy nie podano jawnego settingTrivia', () => {
    render(
      <TTSHardLoadingScreen
        isStarting={true}
        startProgress={50}
        adventureContext={{
          title: 'Klasyczna sprawa w Bostonie',
          activeSceneYear: 1925,
          country: 'USA',
          description: 'Badacze badają sprawę zaginionego profesora Uniwersytetu Miskatonic.',
        }}
      />
    );

    expect(screen.getByText('Realia Epoki i Świata')).toBeInTheDocument();
    expect(screen.getByText(/USA, lata 20\./)).toBeInTheDocument();
    expect(screen.getByText(/Prohibicja/i)).toBeInTheDocument();
  });

  it('odrzuca techniczny żargon w lewym boksie i renderuje nastrojowy pattern z zawodem Badacza (Issue #612)', () => {
    render(
      <TTSHardLoadingScreen
        isStarting={true}
        startProgress={60}
        adventureTitle="Krakowska Enigma"
        adventureContext={{
          title: 'Krakowska Enigma',
          location: 'Warszawa',
          country: 'Polska',
          activeSceneYear: 1921,
          eraLabel: 'Lata 20. XX w.',
          description:
            'Autorski scenariusz d100 wyekstrahowany w trybie lokalnym z pliku "Zew_Cthulhu_7ed._Krakowska_Enigma.pdf". Dokument zawiera 28 stron, 2 kluczowych postaci dramatu oraz 2 zidentyfikowanych poszlak i rekwizytów.',
        }}
        activeCharacter={{ name: 'Jan Kowalski', occupation: 'Dziennikarz' }}
      />
    );

    // Brak wycieku technicznych fraz
    expect(screen.queryByText(/wyekstrahowany/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/zawiera 28 stron/i)).not.toBeInTheDocument();

    // Obecność nastrojowego patternu z zawodem Badacza i sprawą
    expect(
      screen.getByText(/Jako dociekliwy Dziennikarz podejmujesz śledztwo w sprawie znanej jako „Krakowska Enigma”/)
    ).toBeInTheDocument();
    expect(screen.getByText(/1921 rok/)).toBeInTheDocument();
  });

  it('obsługuje brak jakichkolwiek tekstów bezpiecznie cofając się do wartości domyślnych', () => {
    render(
      <TTSHardLoadingScreen
        isStarting={true}
        startProgress={20}
      />
    );

    expect(screen.getByText('W cieniu zapomnianych ulic i zakurzonych archiwów kryją się sekrety...')).toBeInTheDocument();
    expect(screen.getByText('Realia Epoki i Świata')).toBeInTheDocument();
    expect(screen.getByText('BEZ SPOILERÓW')).toBeInTheDocument();
  });

  it('w stanie błędu (startError) wyświetla dwupoziomowy komunikat, przyciski retry/cancel i obsługuje kliknięcia', () => {
    const handleRetry = jest.fn();
    const handleCancel = jest.fn();

    render(
      <TTSHardLoadingScreen
        isStarting={false}
        startError={{
          statusCode: 503,
          category: 'server_overloaded',
          title: 'Przeciążenie darmowych serwerów Gemini [Błąd 503]',
          userAdvice: 'Serwery Google Gemini przeżywają chwilowe przeciążenie na darmowym planie Free Tier.',
          technicalDetails: 'ApiError: 503 Service Unavailable - high demand',
        }}
        onRetry={handleRetry}
        onCancel={handleCancel}
      />
    );

    expect(screen.getByTestId('loading-screen-error-container')).toBeInTheDocument();
    expect(screen.getAllByText('Przeciążenie darmowych serwerów Gemini [Błąd 503]')).toHaveLength(2);
    expect(
      screen.getByText('Serwery Google Gemini przeżywają chwilowe przeciążenie na darmowym planie Free Tier.')
    ).toBeInTheDocument();
    expect(screen.getByText('ApiError: 503 Service Unavailable - high demand')).toBeInTheDocument();

    const retryBtn = screen.getByTestId('loading-screen-retry-btn');
    const cancelBtn = screen.getByTestId('loading-screen-cancel-btn');
    const apiSettingsBtn = screen.getByTestId('loading-screen-api-settings-btn');

    expect(retryBtn).toBeInTheDocument();
    expect(cancelBtn).toBeInTheDocument();
    expect(apiSettingsBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);

    fireEvent.click(cancelBtn);
    expect(handleCancel).toHaveBeenCalledTimes(1);
  });
});

