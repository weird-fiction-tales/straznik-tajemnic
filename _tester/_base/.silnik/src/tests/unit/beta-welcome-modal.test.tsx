import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BetaWelcomeModal, BETA_WELCOME_STORAGE_KEY } from '@/components/dialogs/BetaWelcomeModal';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const messages: Record<string, string> = {
      badge: 'Wersja Beta v0.9.5',
      title: 'Strażnik Tajemnic AI - Wersja Grywalna',
      subtitle: 'Raport gotowości',
      readySectionTitle: 'Moduły Gotowe do Gry (100% CoC 7e RAW)',
      readySectionDesc: 'W pełni przetestowane',
      inProgressSectionTitle: 'Moduły w Budowie (Faza Eksperymentalna)',
      inProgressSectionDesc: 'W trakcie rozbudowy',
      readyItem1Title: 'Karta Badacza CoC 7e RAW',
      readyItem1Desc: 'Pełna siatka cech',
      readyItem2Title: 'Mechanika Rzutów i Sukcesów',
      readyItem2Desc: 'Deterministyczne rzuty',
      readyItem3Title: 'Puryzm Walki Wręcz CoC 7e RAW',
      readyItem3Desc: 'OpposedMeleeCard i uniki',
      readyItem4Title: 'Kompendium Badacza i Kodeks Zasad',
      readyItem4Desc: 'Mini-Obsidian z regułami CoC 7e RAW',
      readyItem5Title: 'Dziennik Śledztwa, Raporty Aktów i Rzut na Pomysł',
      readyItem5Desc: 'Idea Roll RAW z regułą Fail-Forward',
      readyItem6Title: 'Ekwipunek i Finanse',
      readyItem6Desc: 'Znormalizowane epoki ekonomiczne i waluty',
      readyItem7Title: 'Scenariusze i Handouty Strefy 11',
      readyItem7Desc: '4 autorskie scenariusze',
      readyItem8Title: 'Czat Narracyjny i Audio TTS',
      readyItem8Desc: 'Mistrz Gry i lektor TTS',
      readyItem9Title: 'Pościgi Piesze i Pojazdowe (d100 RAW Rozdział 7)',
      readyItem9Desc: 'Deterministyczna mechanika pościgów',
      openingNodeTitle: 'Początek zgodny z teczką przygody',
      openingNodeDesc: 'Kontrola sceny otwarcia gotowa w kodzie (w trakcie testów rozgrywki).',
      inProgressItem1Title: 'Zaawansowane Rytuały i Magia',
      inProgressItem1Desc: 'Księgi w ekwipunku',
      inProgressItem2Title: 'Import Własnych Scenariuszy z PDF',
      inProgressItem2Desc: 'Gotowe działają',
      dontShowAgain: 'Nie pokazuj tego okna ponownie przy uruchomieniu',
      enterGame: 'Rozumiem, przejdź do gry',
      openFeedback: 'Zgłoś uwagę lub błąd',
      betaFeedbackHint: 'Uwagi i błędy z testów przesyłaj w grze lub bezpośrednio na adres: issue@callofchtulhu.pl',
    };
    return messages[key] || key;
  },
}));

describe('BetaWelcomeModal', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('renderuje poprawnie sekcje gotowe i w budowie oraz wskazówkę e-mail', () => {
    render(<BetaWelcomeModal open={true} onOpenChange={() => {}} />);
    expect(screen.getByText(/Strażnik Tajemnic AI - Wersja Grywalna/i)).toBeInTheDocument();
    expect(screen.getByText(/Moduły Gotowe do Gry/i)).toBeInTheDocument();
    expect(screen.getByText(/Moduły w Budowie/i)).toBeInTheDocument();
    expect(screen.getByText(/Karta Badacza CoC 7e RAW/i)).toBeInTheDocument();
    expect(screen.getByText(/Scenariusze i Handouty Strefy 11/i)).toBeInTheDocument();
    expect(screen.getByTestId('beta-opening-node')).toHaveTextContent('Początek zgodny z teczką przygody');
    expect(screen.getByText(/issue@callofchtulhu\.pl/i)).toBeInTheDocument();
  });

  it('zapisuje flagę w localStorage po zaznaczeniu dontShowAgain i kliknięciu enterGame', () => {
    const handleOpenChange = jest.fn();
    render(<BetaWelcomeModal open={true} onOpenChange={handleOpenChange} />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    const enterBtn = screen.getByRole('button', { name: /Rozumiem, przejdź do gry/i });
    fireEvent.click(enterBtn);

    expect(handleOpenChange).toHaveBeenCalledWith(false);
    expect(localStorage.getItem(BETA_WELCOME_STORAGE_KEY)).toBe('true');
  });

  it('wywołuje onOpenFeedback po kliknięciu przycisku zgłoszenia uwagi', () => {
    const handleFeedback = jest.fn();
    const handleOpenChange = jest.fn();
    render(
      <BetaWelcomeModal
        open={true}
        onOpenChange={handleOpenChange}
        onOpenFeedback={handleFeedback}
      />
    );

    const feedbackBtn = screen.getByRole('button', { name: /Zgłoś uwagę lub błąd/i });
    fireEvent.click(feedbackBtn);

    expect(handleOpenChange).toHaveBeenCalledWith(false);
    expect(handleFeedback).toHaveBeenCalledTimes(1);
  });

  it('ustawia wymiary 85vw x 85vh w układzie flex-col ze stałym nagłówkiem, przewijaną listą modułów i stałą stopką (#530)', () => {
    render(<BetaWelcomeModal open={true} onOpenChange={() => {}} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('w-[85vw]');
    expect(dialog.className).toContain('max-w-[85vw]');
    expect(dialog.className).toContain('h-[85vh]');
    expect(dialog.className).toContain('max-h-[85vh]');
    expect(dialog.className).toContain('flex-col');

    const scrollRegion = screen.getByTestId('beta-welcome-scroll-body');
    expect(scrollRegion.className).toContain('flex-1');
    expect(scrollRegion.className).toContain('overflow-y-auto');
    expect(scrollRegion.className).toContain('min-h-0');
  });

  it('utrzymuje czyste tłumaczenia BetaWelcome PL/EN bez wzmianek o wyłączonym SFX ani wydawcy Chaosium (#530)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const plMessages = require('../../../messages/pl.json');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const enMessages = require('../../../messages/en.json');

    const plDump = JSON.stringify(plMessages.BetaWelcome);
    const enDump = JSON.stringify(enMessages.BetaWelcome);

    expect(plDump).not.toMatch(/Chaosium/i);
    expect(enDump).not.toMatch(/Chaosium/i);
    expect(plDump).not.toMatch(/\bSFX\b/i);
    expect(enDump).not.toMatch(/\bSFX\b/i);
    expect(plMessages.BetaWelcome.readySectionDesc).toMatch(/d100 RAW/i);
    expect(enMessages.BetaWelcome.readySectionDesc).toMatch(/d100 RAW/i);
  });
});

