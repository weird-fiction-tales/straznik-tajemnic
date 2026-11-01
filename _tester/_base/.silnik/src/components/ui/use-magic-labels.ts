'use client';

import { useLocale, useTranslations } from 'next-intl';

/** Presentation labels only. Canonical catalog values remain unchanged for mechanics. */
export function useMagicLabels() {
  const locale = useLocale();
  const t = useTranslations('Magic');
  const languages: Record<string, 'latin' | 'english' | 'french' | 'german'> = {
    Łacina: 'latin',
    Angielski: 'english',
    Francuski: 'french',
    Niemiecki: 'german',
  };
  return {
    language: (name: string) =>
      languages[name] ? t(`languageNames.${languages[name]}`) : name,
    source: (title: string) =>
      title === 'Księga Strażnika CoC 7e' ? t('keeperRulebookSource') : title,
    author: (name: string) =>
      locale === 'en' ? name.replace('tłum.', t('translatedBy')) : name,
    dice: (formula: string | number) =>
      locale === 'en'
        ? String(formula).replace(/k(?=\d)/gi, 'd')
        : String(formula),
  };
}
