import { renderHook } from '@testing-library/react';
import { useMagicLabels } from './use-magic-labels';

describe('magic presentation labels', () => {
  const previousLocale = process.env.NEXT_INTL_TEST_LOCALE;
  afterEach(() => {
    process.env.NEXT_INTL_TEST_LOCALE = previousLocale;
  });

  it.each(['pl', 'en'] as const)(
    'renders catalog metadata in %s without changing canonical values',
    (locale) => {
      process.env.NEXT_INTL_TEST_LOCALE = locale;
      const { result } = renderHook(useMagicLabels);
      expect(result.current.language('Łacina')).toBe(
        locale === 'en' ? 'Latin' : 'Łacina'
      );
      expect(result.current.source('Księga Strażnika CoC 7e')).toBe(
        locale === 'en' ? 'Keeper Rulebook (CoC 7e)' : 'Księga Strażnika CoC 7e'
      );
      expect(
        result.current.author('Abdul Alhazred (tłum. Olaus Wormius)')
      ).toBe(
        locale === 'en'
          ? 'Abdul Alhazred (trans. Olaus Wormius)'
          : 'Abdul Alhazred (tłum. Olaus Wormius)'
      );
      expect(result.current.dice('2k10')).toBe(
        locale === 'en' ? '2d10' : '2k10'
      );
      expect(result.current.dice(2)).toBe('2');
      expect(result.current.language('Aklo')).toBe('Aklo');
    }
  );
});
