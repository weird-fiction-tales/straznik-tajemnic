import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DreamCard } from './dream-card';
import type { DreamVisionEventData } from '@/lib/types';

describe('DreamCard - diegetyczne okno wizji sennej w czacie (Issue #787)', () => {
  const sampleDream: DreamVisionEventData = {
    id: 'dream-1',
    variantId: 'dark-cabin',
    number: 2,
    title: 'Senne Wezwania 2: Chata w ciemnościach',
    narrative: 'Rozpadająca się chata z gnijących bali majaczy w leśnym półmroku...',
    investigatorName: 'Thomas Vance',
    nightNumber: 1,
    status: 'active',
    mechanicalEffect: {
      sanityCheckRequired: true,
      sanityLossFormula: '1/1d6',
      subsequentTriggerLocation: 'loc-turner-cabin',
    },
  };

  it('renderuje poprawnie nagłówek, imię badacza, tytuł i treść snu', () => {
    render(<DreamCard dreamEvent={sampleDream} />);

    expect(screen.getByTestId('dream-card')).toBeInTheDocument();
    expect(screen.getByText('Thomas Vance')).toBeInTheDocument();
    expect(screen.getByText('Senne Wezwania 2: Chata w ciemnościach')).toBeInTheDocument();
    expect(
      screen.getByText('„Rozpadająca się chata z gnijących bali majaczy w leśnym półmroku...”')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /obudź się/i })).toBeInTheDocument();
  });

  it('po kliknięciu przycisku [Obudź się] wywołuje callback onAwaken i zmienia stan na wybudzony', () => {
    const handleAwaken = jest.fn();
    render(<DreamCard dreamEvent={sampleDream} onAwaken={handleAwaken} />);

    const awakenBtn = screen.getByRole('button', { name: /obudź się/i });
    fireEvent.click(awakenBtn);

    expect(handleAwaken).toHaveBeenCalledWith('dream-1');
    expect(screen.queryByRole('button', { name: /obudź się/i })).not.toBeInTheDocument();
    expect(screen.getByText(/przebudzono się z koszmaru/i)).toBeInTheDocument();
  });

  it('gdy completed=true, nie wyświetla przycisku wybudzenia', () => {
    render(<DreamCard dreamEvent={sampleDream} completed={true} />);

    expect(screen.queryByRole('button', { name: /obudź się/i })).not.toBeInTheDocument();
    expect(screen.getByText(/przebudzono się z koszmaru/i)).toBeInTheDocument();
  });
});
