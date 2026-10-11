import { applyStatChangesToParty, applyStatChangesFromText } from '@/lib/character/apply-stat-changes';
import { cleanResponseText } from '@/lib/parsers/text-cleaner';
import type { Character } from '@/lib/types';

describe('Issue #763: Stat Changes Mechanics & Events (HP, SAN, LUCK)', () => {
  const createMockCharacter = (overrides?: Partial<Character>): Character => ({
    id: 'char-1',
    name: 'Eleanor Vance',
    occupation: 'Archeolog',
    age: 28,
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
      'Archeologia': 60,
      'Inteligencja': 80,
      'Spostrzegawczość': 50,
    },
    hp: 11,
    maxHp: 11,
    san: 70,
    maxSan: 99,
    maxMp: 14,
    luck: 65,
    ...overrides,
  });

  describe('Triada statystyk w applyStatChangesToParty', () => {
    it('generuje ustrukturyzowane zdarzenie statChangeEvents dla utraty HP i diegetycznego powodu', () => {
      const char = createMockCharacter({ hp: 11, maxHp: 11 });
      const text = 'Pochód kultystów zbliża się. [OBRAŻENIA: -3: poparzenia od rozżarzonego mosiądzu]';

      const result = applyStatChangesToParty([char], char, text);

      expect(result.changed).toBe(true);
      expect(result.activeCharacter.hp).toBe(8);
      expect(result.statChangeEvents).toBeDefined();
      expect(result.statChangeEvents).toHaveLength(1);

      const event = result.statChangeEvents[0];
      expect(event.characterId).toBe('char-1');
      expect(event.characterName).toBe('Eleanor Vance');
      expect(event.changes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'hp',
            delta: -3,
            reason: 'poparzenia od rozżarzonego mosiądzu',
            previousValue: 11,
            currentValue: 8,
            maxValue: 11,
          }),
        ])
      );
    });

    it('obsługuje notację kościaną dla obrażeń i utraty SAN', () => {
      const char = createMockCharacter({ hp: 11, san: 70 });
      const text = 'Bestia wyłania się ze śluzy! [OBRAŻENIA: 1k4: cios szponem] [UTRATA_SAN: 1k6: widok abominacji]';

      const result = applyStatChangesToParty([char], char, text);

      expect(result.changed).toBe(true);
      expect(result.activeCharacter.hp).toBeLessThan(11);
      expect(result.activeCharacter.san).toBeLessThan(70);

      const event = result.statChangeEvents[0];
      expect(event.changes.some((c) => c.type === 'hp' && c.delta < 0)).toBe(true);
      expect(event.changes.some((c) => c.type === 'san' && c.delta < 0)).toBe(true);
    });

    it('obsługuje modyfikacje Szczęścia (LUCK / SZCZĘŚCIE) ze znakiem plus i minus', () => {
      const char = createMockCharacter({ luck: 50 });
      const textReward = 'Niezwykłe zrządzenie losu sprzyja badaczce. [SZCZĘŚCIE: +5: nagroda za brawurę]';

      const resultReward = applyStatChangesToParty([char], char, textReward);
      expect(resultReward.activeCharacter.luck).toBe(55);
      expect(resultReward.statChangeEvents[0].changes).toContainEqual(
        expect.objectContaining({
          type: 'luck',
          delta: 5,
          reason: 'nagroda za brawurę',
          previousValue: 50,
          currentValue: 55,
        })
      );

      const textSpend = 'Wyczerpanie zapasów fortuny. [LUCK: -15: unknięcie kuli]';
      const resultSpend = applyStatChangesToParty([char], char, textSpend);
      expect(resultSpend.activeCharacter.luck).toBe(35);
      expect(resultSpend.statChangeEvents[0].changes).toContainEqual(
        expect.objectContaining({
          type: 'luck',
          delta: -15,
          reason: 'unknięcie kuli',
          previousValue: 50,
          currentValue: 35,
        })
      );
    });

    it('ustawia flagę intCheckRequired przy pojedynczej stracie >= 5 SAN', () => {
      const char = createMockCharacter({ san: 70 });
      const text = 'Zasłona rzeczywistości pęka. [SANITY: -6: kosmiczny bezmiar Azathotha]';

      const result = applyStatChangesToParty([char], char, text);
      expect(result.statChangeEvents[0].intCheckRequired).toBe(true);
    });

    it('rozdziela zmiany w duecie według prefiksu @Imię', () => {
      const char1 = createMockCharacter({ id: 'char-1', name: 'Eleanor' });
      const char2 = createMockCharacter({ id: 'char-2', name: 'Thomas', hp: 12 });
      const text = 'Eksplozja wstrząsa korytarzem! [HP: @Eleanor: -2: odłamki] [HP: @Thomas: -4: fala uderzeniowa]';

      const result = applyStatChangesToParty([char1, char2], char1, text);
      expect(result.statChangeEvents).toHaveLength(2);

      const eleanorEvent = result.statChangeEvents.find((e) => e.characterId === 'char-1');
      const thomasEvent = result.statChangeEvents.find((e) => e.characterId === 'char-2');

      expect(eleanorEvent?.changes[0].delta).toBe(-2);
      expect(thomasEvent?.changes[0].delta).toBe(-4);
    });
  });

  describe('Czyszczenie tekstu z tagów statystyk', () => {
    it('wycina tagi HP, OBRAŻENIA, UTRATA_SAN, SANITY, LUCK i SZCZĘŚCIE z prozy narracyjnej', () => {
      const raw = 'Badacz potyka się. [OBRAŻENIA: -2: upadek ze schodów] Odgłos kroków cichnie. [SZCZĘŚCIE: +5: ocalenie latarni]';
      const cleaned = cleanResponseText(raw);

      expect(cleaned).not.toContain('[OBRAŻENIA:');
      expect(cleaned).not.toContain('[SZCZĘŚCIE:');
      expect(cleaned).toContain('Badacz potyka się.');
      expect(cleaned).toContain('Odgłos kroków cichnie.');
    });
  });
});
