import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QuickSetupModal } from './quick-setup-modal';
import { QUICK_SETUP_SHOWCASE_PROFILE } from './quick-setup-showcase-profile';

const originalShowcaseEnabled = QUICK_SETUP_SHOWCASE_PROFILE.enabled;

describe('QuickSetupModal (Issue #121)', () => {
  const originalLocale = process.env.NEXT_INTL_TEST_LOCALE;

  beforeEach(() => {
    QUICK_SETUP_SHOWCASE_PROFILE.enabled = false;
  });

  afterEach(() => {
    QUICK_SETUP_SHOWCASE_PROFILE.enabled = originalShowcaseEnabled;
    process.env.NEXT_INTL_TEST_LOCALE = originalLocale;
  });

  it('blokuje przycisk startu, gdy nie wybrano postaci w trybie solo', () => {
    const onOpenChange = jest.fn();
    const onQuickStart = jest.fn();

    render(
      <QuickSetupModal
        open={true}
        onOpenChange={onOpenChange}
        onQuickStart={onQuickStart}
      />
    );

    const startBtn = screen.getByRole('button', { name: /Rozpocznij przygodę/i });
    expect(startBtn).toBeDisabled();

    fireEvent.click(startBtn);
    expect(onQuickStart).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('po wybraniu postaci woła onQuickStart i zamyka modal (onOpenChange(false))', () => {
    const onOpenChange = jest.fn();
    const onQuickStart = jest.fn();

    render(
      <QuickSetupModal
        open={true}
        onOpenChange={onOpenChange}
        onQuickStart={onQuickStart}
      />
    );

    const charCards = screen.getAllByRole('button', { name: /Tomasz Nowicki/i });
    expect(charCards.length).toBeGreaterThan(0);
    fireEvent.click(charCards[0]);

    const startBtn = screen.getByRole('button', { name: /Rozpocznij przygodę/i });
    expect(startBtn).not.toBeDisabled();

    fireEvent.click(startBtn);

    expect(onQuickStart).toHaveBeenCalledWith(
      'cien-nad-prabutami',
      'strefa11_tomasz_nowicki',
      'solo',
      undefined
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('automatycznie wywołuje onOpenChange(false) gdy isStarting przełączy się na true', () => {
    const onOpenChange = jest.fn();
    const { rerender } = render(
      <QuickSetupModal
        open={true}
        onOpenChange={onOpenChange}
        onQuickStart={jest.fn()}
        isStarting={false}
      />
    );

    expect(onOpenChange).not.toHaveBeenCalled();

    rerender(
      <QuickSetupModal
        open={true}
        onOpenChange={onOpenChange}
        onQuickStart={jest.fn()}
        isStarting={true}
      />
    );

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('w trybie Hot Seat przekazuje ID postaci Gracza 1 i Gracza 2', () => {
    const onOpenChange = jest.fn();
    const onQuickStart = jest.fn();

    render(
      <QuickSetupModal
        open={true}
        onOpenChange={onOpenChange}
        onQuickStart={onQuickStart}
      />
    );

    const hotSeatBtn = screen.getByRole('button', { name: /Hot Seat \(Duet\)/i });
    fireEvent.click(hotSeatBtn);

    const p1Tomasz = screen.getAllByRole('button', { name: /Tomasz Nowicki/i })[0];
    fireEvent.click(p1Tomasz);

    const startBtn = screen.getByRole('button', { name: /Rozpocznij przygodę/i });
    expect(startBtn).toBeDisabled();

    const p2Helena = screen.getAllByRole('button', { name: /Helena Krawczyk/i });
    const p2Card = p2Helena[p2Helena.length - 1];
    fireEvent.click(p2Card);

    expect(startBtn).not.toBeDisabled();
    fireEvent.click(startBtn);

    expect(onQuickStart).toHaveBeenCalledWith(
      'cien-nad-prabutami',
      'strefa11_tomasz_nowicki',
      'hot-seat',
      'strefa11_helena_krawczyk'
    );
  });

  it('wyświetla stan ładowania i pasek postępu gdy isStarting={true} (PL)', () => {
    const onOpenChange = jest.fn();
    const onQuickStart = jest.fn();

    render(
      <QuickSetupModal
        open={true}
        onOpenChange={onOpenChange}
        onQuickStart={onQuickStart}
        isStarting={true}
        startProgress={60}
        startStatus="Nawiązywanie kontaktu z Mistrzem Gry..."
      />
    );

    const startBtn = screen.getByRole('button', { name: /Przygotowywanie sesji.../i });
    expect(startBtn).toBeDisabled();

    expect(screen.getByTestId('quick-setup-progress-container')).toBeInTheDocument();
    const progressBar = screen.getByTestId('quick-setup-progress-bar');
    expect(progressBar).toHaveStyle({ width: '60%' });

    expect(screen.getByText('Nawiązywanie kontaktu z Mistrzem Gry...')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('wyświetla zlokalizowany stan ładowania i pasek postępu po angielsku (EN)', () => {
    process.env.NEXT_INTL_TEST_LOCALE = 'en';

    render(
      <QuickSetupModal
        open={true}
        onOpenChange={jest.fn()}
        onQuickStart={jest.fn()}
        isStarting={true}
        startProgress={90}
        startStatus="Generating opening scene..."
      />
    );

    const startBtn = screen.getByRole('button', { name: /Preparing session.../i });
    expect(startBtn).toBeDisabled();

    expect(screen.getByTestId('quick-setup-progress-container')).toBeInTheDocument();
    const progressBar = screen.getByTestId('quick-setup-progress-bar');
    expect(progressBar).toHaveStyle({ width: '90%' });

    expect(screen.getByText('Generating opening scene...')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.queryByText('Przygotowywanie sesji...')).not.toBeInTheDocument();
    expect(progressBar).toHaveClass('bg-primary');
  });

  it('podświetla wybrane karty trybu, scenariusza i postaci akcentem szmaragdowym Art Déco', () => {
    render(
      <QuickSetupModal
        open={true}
        onOpenChange={jest.fn()}
        onQuickStart={jest.fn()}
      />
    );

    const soloBtn = screen.getByRole('button', { name: /Solo/i });
    expect(soloBtn).toHaveClass('border-primary', 'bg-[#0f1715]');

    const charCards = screen.getAllByRole('button', { name: /Tomasz Nowicki/i });
    fireEvent.click(charCards[0]);
    expect(charCards[0].closest('div.border')).toHaveClass('border-primary', 'bg-[#0f1715]');

    const startBtn = screen.getByRole('button', { name: /Rozpocznij przygodę/i });
    expect(startBtn).toHaveClass('bg-primary');
  });

  it('w języku angielskim (EN) ładuje dedykowany zestaw 4 przygód American Mythos Cold Cases zamiast Strefy 11 (Issue #659)', () => {
    process.env.NEXT_INTL_TEST_LOCALE = 'en';
    const onOpenChange = jest.fn();
    const onQuickStart = jest.fn();

    render(
      <QuickSetupModal
        open={true}
        onOpenChange={onOpenChange}
        onQuickStart={onQuickStart}
      />
    );

    expect(screen.getByText('American Mythos Cold Cases')).toBeInTheDocument();
    expect(screen.getByText("The Englewood Labyrinth: Holmes's Castle")).toBeInTheDocument();
    expect(screen.getByText('The Almer Coe Spectacles: The Franks Affair')).toBeInTheDocument();
    expect(screen.getByText('Postmarked Columbus: The Circleville Letters')).toBeInTheDocument();
    expect(screen.getByText(/The Ovidhall Lake Anomaly/i)).toBeInTheDocument();

    // Polskie przygody ze Strefy 11 nie powinny być wyświetlane w EN Quick Setup
    expect(screen.queryByText(/Prabuty/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Kowary/i)).not.toBeInTheDocument();

    // Wybór dedykowanego badacza z pierwszego scenariusza (Frank Geyer)
    const geyerCards = screen.getAllByRole('button', { name: /Frank Geyer/i });
    expect(geyerCards.length).toBeGreaterThan(0);
    fireEvent.click(geyerCards[0]);

    const startBtn = screen.getByRole('button', { name: /Start adventure/i });
    expect(startBtn).not.toBeDisabled();
    fireEvent.click(startBtn);

    expect(onQuickStart).toHaveBeenCalledWith(
      'englewood-murder-castle-1893',
      'coldcase_frank_geyer',
      'solo',
      undefined
    );
  });
});
