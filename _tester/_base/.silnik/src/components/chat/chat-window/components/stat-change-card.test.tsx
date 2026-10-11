import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatChangeCard } from './stat-change-card';
import type { Character, StatChangeEventData } from '@/lib/types';

describe('StatChangeCard - diegetyczna karta zmian statystyk Badacza w czacie (Issue #763)', () => {
  const mockCharacter: Character = {
    id: 'char-eleanor',
    name: 'Eleanor Vance',
    occupation: 'Archeolog',
    age: 30,
    str: 50,
    con: 60,
    dex: 55,
    app: 65,
    pow: 70,
    siz: 50,
    edu: 75,
    int: 80,
    mp: 14,
    playerName: 'Gracz 1',
    isActive: true,
    notes: '',
    lastUsed: new Date(),
    background: '',
    experience: { totalXP: 0, availableXP: 0, earnedThisSession: 0, maxEarnedThisSession: 10 },
    developmentHistory: [],
    skills: {
      'Inteligencja': 80,
      'Archeologia': 65,
    },
    hp: 8,
    maxHp: 11,
    san: 48,
    maxSan: 99,
    luck: 55,
  };

  const sampleStatEvent: StatChangeEventData = {
    id: 'stat-event-1',
    characterId: 'char-eleanor',
    characterName: 'Eleanor Vance',
    changes: [
      {
        type: 'hp',
        delta: -3,
        reason: 'poparzenia III stopnia od rozżarzonego mosiądzu',
        previousValue: 11,
        currentValue: 8,
        maxValue: 11,
      },
      {
        type: 'san',
        delta: -2,
        reason: 'widok bluźnierczego hieroglifu',
        previousValue: 50,
        currentValue: 48,
        maxValue: 99,
      },
      {
        type: 'luck',
        delta: 5,
        reason: 'odnalezienie ukrytego przejścia',
        previousValue: 50,
        currentValue: 55,
      },
    ],
  };

  it('renderuje poprawnie nagłówek Art Déco, tożsamość Badacza oraz triadę zmian HP, SAN i Szczęścia', () => {
    render(
      <StatChangeCard
        statEvent={sampleStatEvent}
        activeCharacter={mockCharacter}
      />
    );

    expect(screen.getByTestId('stat-change-card')).toBeInTheDocument();
    expect(screen.getByText('Eleanor Vance')).toBeInTheDocument();

    // HP
    expect(screen.getByText('-3 PŻ')).toBeInTheDocument();
    expect(screen.getByText('„poparzenia III stopnia od rozżarzonego mosiądzu”')).toBeInTheDocument();

    // SAN
    expect(screen.getByText('-2 SAN')).toBeInTheDocument();
    expect(screen.getByText('„widok bluźnierczego hieroglifu”')).toBeInTheDocument();

    // Szczęście
    expect(screen.getByText('+5')).toBeInTheDocument();
    expect(screen.getByText('„odnalezienie ukrytego przejścia”')).toBeInTheDocument();
  });

  it('renderuje ostrzeżenia o progach krytycznych (Ciężka Rana, Utrata przytomności)', () => {
    const criticalEvent: StatChangeEventData = {
      ...sampleStatEvent,
      majorWound: true,
      unconscious: true,
    };

    render(
      <StatChangeCard
        statEvent={criticalEvent}
        activeCharacter={mockCharacter}
      />
    );

    expect(screen.getByText(/Ciężka Rana/i)).toBeInTheDocument();
    expect(screen.getByText(/Utrata przytomności/i)).toBeInTheDocument();
  });

  it('gdy intCheckRequired=true, wyświetla przycisk procedury testu Inteligencji (INT) i wywołuje onRollTest', () => {
    const mythosShockEvent: StatChangeEventData = {
      ...sampleStatEvent,
      intCheckRequired: true,
    };
    const handleRollTest = jest.fn();

    render(
      <StatChangeCard
        statEvent={mythosShockEvent}
        activeCharacter={mockCharacter}
        characters={[mockCharacter]}
        onRollTest={handleRollTest}
      />
    );

    const intButton = screen.getByRole('button', { name: /rzuć test inteligencji/i });
    expect(intButton).toBeInTheDocument();

    fireEvent.click(intButton);

    expect(handleRollTest).toHaveBeenCalledTimes(1);
    expect(handleRollTest).toHaveBeenCalledWith(
      expect.objectContaining({
        skillName: 'Inteligencja',
        skillValue: 80,
        characterName: 'Eleanor Vance',
      })
    );

    expect(screen.getByText(/wykonano test inteligencji/i)).toBeInTheDocument();
  });
});
