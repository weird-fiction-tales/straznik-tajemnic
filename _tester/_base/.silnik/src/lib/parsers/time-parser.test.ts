import { extractTimeUpdate } from './time-parser';

describe('time-parser (English & Polish DateTime Extraction)', () => {
  describe('English format parsing', () => {
    it('parses English day-first format with CURRENT TIME prefix', () => {
      const text = 'You step into the office. [CURRENT TIME: 15 October 1924, 21:30]';
      const result = extractTimeUpdate(text);
      expect(result).toEqual({
        day: 15,
        month: 9, // October is month index 9
        year: 1924,
        hour: 21,
        minute: 30,
      });
    });

    it('parses English month-first format with CURRENT TIME prefix', () => {
      const text = 'The rain falls steadily. [CURRENT TIME: October 15, 1924, 21:30]';
      const result = extractTimeUpdate(text);
      expect(result).toEqual({
        day: 15,
        month: 9,
        year: 1924,
        hour: 21,
        minute: 30,
      });
    });

    it('parses English date with Time: prefix and ordinal suffix', () => {
      const text = 'Midnight strikes. Time: October 15th, 1924, 00:00';
      const result = extractTimeUpdate(text);
      expect(result).toEqual({
        day: 15,
        month: 9,
        year: 1924,
        hour: 0,
        minute: 0,
      });
    });

    it('correctly maps all 12 English month names to 0-11 indices', () => {
      const months = [
        { name: 'January', index: 0 },
        { name: 'February', index: 1 },
        { name: 'March', index: 2 },
        { name: 'April', index: 3 },
        { name: 'May', index: 4 },
        { name: 'June', index: 5 },
        { name: 'July', index: 6 },
        { name: 'August', index: 7 },
        { name: 'September', index: 8 },
        { name: 'October', index: 9 },
        { name: 'November', index: 10 },
        { name: 'December', index: 11 },
      ];

      for (const { name, index } of months) {
        const text = `CURRENT TIME: 10 ${name} 1925, 14:00`;
        const res = extractTimeUpdate(text);
        expect(res).not.toBeNull();
        expect(res?.month).toBe(index);
        expect(res?.day).toBe(10);
        expect(res?.year).toBe(1925);
      }
    });

    it('correctly maps 3-letter English month abbreviations', () => {
      const text = 'Time: 4 Nov 1926, 18:45';
      const res = extractTimeUpdate(text);
      expect(res).toEqual({
        day: 4,
        month: 10, // November
        year: 1926,
        hour: 18,
        minute: 45,
      });
    });
  });

  describe('Polish format parsing', () => {
    it('parses Polish standard format with AKTUALNY CZAS', () => {
      const text = 'Wchodzisz do gabinetu. [AKTUALNY CZAS: 14 Stycznia 1925, 14:45]';
      const result = extractTimeUpdate(text);
      expect(result).toEqual({
        day: 14,
        month: 0, // Styczeń
        year: 1925,
        hour: 14,
        minute: 45,
      });
    });

    it('parses Polish nominative month format', () => {
      const text = 'Data: 10 Październik 1920, Czas: 12:00';
      const result = extractTimeUpdate(text);
      expect(result).toEqual({
        day: 10,
        month: 9, // Październik
        year: 1920,
        hour: 12,
        minute: 0,
      });
    });
  });

  describe('Edge cases & Fallbacks', () => {
    it('returns null when no date/time pattern is found', () => {
      expect(extractTimeUpdate('Zwykły opis bez żadnej daty.')).toBeNull();
      expect(extractTimeUpdate('')).toBeNull();
    });

    it('handles dot separator in time format (HH.MM)', () => {
      const text = 'CURRENT TIME: 20 June 1923, 16.15';
      const result = extractTimeUpdate(text);
      expect(result).toEqual({
        day: 20,
        month: 5, // June
        year: 1923,
        hour: 16,
        minute: 15,
      });
    });
  });
});
