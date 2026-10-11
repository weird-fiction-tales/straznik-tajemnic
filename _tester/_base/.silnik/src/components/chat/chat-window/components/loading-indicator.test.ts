import {
  labelForSeconds,
  PACER_MESSAGES,
  type PacerPhaseKey,
} from './loading-indicator';

describe('LoadingIndicator - Diegetyczny Pacer (Issue #757)', () => {
  it('zwraca angielskie fazy diegetyczne dla locale en', () => {
    expect(labelForSeconds(0, 'en')).toBe("Reading the Investigator's intent...");
    expect(labelForSeconds(2, 'en')).toBe('Listening for footsteps in the dark...');
    expect(labelForSeconds(5, 'en')).toBe('Framing the scene...');
    expect(labelForSeconds(8, 'en')).toBe('Recording the investigative chronicle...');
    expect(labelForSeconds(12, 'en')).toBe('The Game Master weighs their words in silence...');
    expect(labelForSeconds(20, 'en')).toBe('The Game Master weighs their words in silence...');
  });

  it('zwraca polskie fazy diegetyczne dla locale pl', () => {
    expect(labelForSeconds(0, 'pl')).toBe('Odczytywanie intencji Badacza...');
    expect(labelForSeconds(2, 'pl')).toBe('Nadsłuchiwanie kroków w mroku...');
    expect(labelForSeconds(5, 'pl')).toBe('Układanie scenerii w kadrze...');
    expect(labelForSeconds(8, 'pl')).toBe('Spisywanie kroniki zdarzeń...');
    expect(labelForSeconds(12, 'pl')).toBe('Mistrz Gry waży słowa w ciszy...');
  });

  it('obsługuje funkcję tłumaczącą next-intl t() z bezpiecznym fallbackiem', () => {
    const mockT = jest.fn((key: PacerPhaseKey): string => `T_${key}`);
    const res = labelForSeconds(5, 'pl', mockT);
    expect(mockT).toHaveBeenCalledWith('phase2');
    expect(res).toBe('T_phase2');
  });

  it('gwarantuje 100% symetrię faz w słownikach PACER_MESSAGES', () => {
    const plKeys = Object.keys(PACER_MESSAGES.pl);
    const enKeys = Object.keys(PACER_MESSAGES.en);
    expect(plKeys).toEqual(enKeys);
    expect(plKeys.length).toBe(5);
  });
});

