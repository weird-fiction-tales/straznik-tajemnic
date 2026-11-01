import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MedicalCareModal } from './MedicalCareModal';
import type { Character } from '@/lib/types';
import * as recoveryTracker from '@/lib/health/recovery-tracker';

jest.mock('@/components/dice/physical-dice-scene', () => ({
  PhysicalDiceScene: ({ label }: { label: string }) => (
    <div data-testid="physical-dice-scene">{label}</div>
  ),
}));

const createMockCharacter = (overrides: Partial<Character> = {}): Character => ({
  id: 'char-med-1',
  name: 'Dr Henry Armitage',
  playerName: 'Gracz 1',
  isActive: true,
  notes: '',
  lastUsed: new Date(),
  occupation: 'Profesor',
  age: 55,
  gender: 'male',
  appearance: '',
  background: '',
  str: 50,
  con: 60,
  siz: 60,
  dex: 50,
  app: 50,
  int: 80,
  pow: 70,
  edu: 85,
  luck: 50,
  hp: 6,
  maxHp: 12,
  san: 65,
  maxSan: 99,
  mp: 14,
  maxMp: 14,
  hasMajorWound: true,
  isDying: false,
  isUnconscious: false,
  cash: 150,
  skills: {
    'Pierwsza pomoc': 60,
    Medycyna: 75,
    Majętność: 50,
  },
  equipment: [],
  scars: ['Blizna po szponach na przedramieniu'],
  experience: { totalXP: 0, availableXP: 0, earnedThisSession: 0, maxEarnedThisSession: 15 },
  developmentHistory: [],
  ...overrides,
});

describe('MedicalCareModal Component (Issue #523)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renderuje szmaragdowy nadtytuł Art Déco, odznakę Poważnej Rany w czerwieni oraz aktywne zakładki w szmaragdzie', () => {
    const character = createMockCharacter();
    render(
      <MedicalCareModal
        isOpen={true}
        onClose={jest.fn()}
        character={character}
        onCharacterUpdate={jest.fn()}
      />
    );

    const eyebrow = screen.getByText('ARCHIWUM MISKATONIC • LATA 20.');
    expect(eyebrow).toBeInTheDocument();
    expect(eyebrow).toHaveClass('text-primary', 'font-special-elite');

    // Odznaka Poważnej Rany pozostaje w czerwieni zagrożenia
    const majorWoundBadge = screen.getByText(/Ciężka Rana/i);
    expect(majorWoundBadge).toBeInTheDocument();

    // Wybrany okres (1_week) i placówka (public_hospital) mają szmaragdowy akcent
    const weekBtn = screen.getByRole('button', { name: /1 tydzień/i });
    expect(weekBtn).toHaveClass('bg-primary/10', 'text-foreground', 'border-primary');

    const clinicCard = screen.getByText(/Prywatna Klinika/i).closest('div.p-3');
    expect(clinicCard).not.toBeNull();
    fireEvent.click(clinicCard!);
    expect(clinicCard).toHaveClass('border-primary', 'bg-[#0f1715]', 'shadow-glow');
  });

  it('wyświetla szmaragdowe podsumowanie (+PŻ i wyleczenie Ciężkiej Rany) oraz czerwone powikłania po wykonaniu rekonwalescencji', () => {
    jest.spyOn(recoveryTracker, 'advanceTimeSkipRecovery').mockReturnValue({
      period: '2_weeks',
      daysAdvanced: 14,
      facility: 'private_clinic',
      initialHp: 6,
      finalHp: 11,
      hpGained: 5,
      hpLost: 0,
      totalCost: 200,
      wasMajorWoundCleared: true,
      newScar: {
        location: 'left_arm',
        roll: 12,
        descriptionPl: 'Głęboka blizna pooperacyjna na lewym ramieniu',
        descriptionEn: 'Deep surgical scar on left arm',
      },
      weeklyLogs: [
        {
          weekNumber: 1,
          conRoll: 24,
          conTarget: 60,
          outcome: 'hard',
          hpDelta: 5,
          infectionOccurred: false,
          notes: { pl: 'Pomyślna rekonwalescencja pod okiem lekarzy.', en: 'Successful recovery.' },
        },
        {
          weekNumber: 2,
          conRoll: 99,
          conTarget: 60,
          outcome: 'fumble',
          hpDelta: -2,
          infectionOccurred: true,
          notes: { pl: 'Gorączka przyranowa.', en: 'Wound fever.' },
        },
      ],
      narrativeSummary: {
        pl: 'Po dwóch tygodniach w klinice rana zasklepiła się.',
        en: 'After two weeks in the clinic the wound healed.',
      },
      nextCharacter: createMockCharacter({ hp: 11, hasMajorWound: false }),
    });

    const onCharacterUpdate = jest.fn();
    const onAddChatMessage = jest.fn();

    render(
      <MedicalCareModal
        isOpen={true}
        onClose={jest.fn()}
        character={createMockCharacter()}
        onCharacterUpdate={onCharacterUpdate}
        onAddChatMessage={onAddChatMessage}
      />
    );

    const executeBtn = screen.getByRole('button', { name: /Rozpocznij okres rekonwalescencji/i });
    expect(executeBtn).toHaveClass('bg-primary', 'text-primary-foreground');
    fireEvent.click(executeBtn);

    expect(onCharacterUpdate).toHaveBeenCalledTimes(1);
    expect(onAddChatMessage).toHaveBeenCalledWith(
      expect.stringContaining('Po dwóch tygodniach w klinice rana zasklepiła się.')
    );

    // Pozytywne leczenie w szmaragdzie (text-primary), a utrata PŻ w czerwieni (text-destructive)
    const positiveDeltas = screen.getAllByText('+5 PŻ');
    expect(positiveDeltas.length).toBeGreaterThanOrEqual(2);
    expect(positiveDeltas[0]).toHaveClass('text-primary');

    const negativeDelta = screen.getByText('-2 PŻ');
    expect(negativeDelta).toHaveClass('text-destructive');

    expect(
      screen.getByText(/Głęboka blizna pooperacyjna na lewym ramieniu/i)
    ).toBeInTheDocument();
  });

  it('w zakładce zabiegów rozróżnia szmaragdowy sukces leczenia od czerwonego krytycznego niepowodzenia (fumble)', () => {
    const firstAidSpy = jest.spyOn(recoveryTracker, 'applyFirstAid').mockReturnValue({
      success: true,
      roll: 18,
      targetSkill: 60,
      outcome: 'hard',
      hpGained: 1,
      stabilized: true,
      narrativeSummary: {
        pl: 'Opatrunek uciskowy zatamował krwawienie (+1 PŻ).',
        en: 'Pressure bandage stopped the bleeding (+1 HP).',
      },
      nextCharacter: createMockCharacter({ hp: 7 }),
    });

    const medicineSpy = jest.spyOn(recoveryTracker, 'applyMedicine').mockReturnValue({
      success: false,
      roll: 100,
      targetSkill: 75,
      outcome: 'fumble',
      hpGained: 0,
      stabilized: false,
      narrativeSummary: {
        pl: 'Zakażenie narzędzi chirurgicznych pogorszyło stan pacjenta.',
        en: 'Contaminated surgical instruments worsened the patient condition.',
      },
      nextCharacter: createMockCharacter({ hp: 5 }),
    });

    const character = createMockCharacter();
    render(
      <MedicalCareModal
        isOpen={true}
        onClose={jest.fn()}
        character={character}
        onCharacterUpdate={jest.fn()}
      />
    );

    // Przełącz na zakładkę Zabiegów (Doraźne Zabiegi)
    const treatmentsTab = screen.getByRole('tab', { name: /Doraźne Zabiegi/i });
    fireEvent.mouseDown(treatmentsTab);
    fireEvent.click(treatmentsTab);

    jest.useFakeTimers();

    const firstAidBtn = screen.getByRole('button', { name: /Wykonaj test Pierwszej Pomocy/i });
    expect(firstAidBtn).toHaveClass('bg-primary', 'text-primary-foreground');
    fireEvent.click(firstAidBtn);
    expect(firstAidSpy).toHaveBeenCalledTimes(1);

    const firstAidOutcome = screen.getByText(/HARD \(\+1 PŻ\)/i);
    expect(firstAidOutcome.parentElement).toHaveClass('text-primary');

    // W trakcie animacji kości oba przyciski zabiegów są zablokowane
    const medicineBtn = screen.getByRole('button', { name: /Wykonaj zabieg Medycyny/i });
    expect(medicineBtn).toBeDisabled();

    act(() => {
      jest.advanceTimersByTime(800);
    });
    jest.useRealTimers();

    expect(medicineBtn).not.toBeDisabled();
    expect(medicineBtn).toHaveClass('bg-primary', 'text-primary-foreground');
    fireEvent.click(medicineBtn);
    expect(medicineSpy).toHaveBeenCalledTimes(1);

    const medicineOutcome = screen.getByText('FUMBLE');
    expect(medicineOutcome.parentElement).toHaveClass('text-destructive');
  });
});
