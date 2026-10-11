import {
  ANCIENT_TREES_DREAM_VARIANTS,
  getAvailableDreamVariantsForNight,
  selectDreamVariantForNight,
} from './ancient-trees-dreams';

describe('ancient-trees-dreams - Senne Wezwania CoC 7e RAW (Issue #787)', () => {
  it('definiuje dokładnie 4 kanoniczne warianty snów z Księgi Strażnika', () => {
    const variants = Object.values(ANCIENT_TREES_DREAM_VARIANTS);
    expect(variants).toHaveLength(4);
    expect(variants.map((v) => v.id)).toEqual([
      'restless-night',
      'dark-cabin',
      'forest-path',
      'thing-in-lake',
    ]);
  });

  it('wariant 1 (Niespokojna noc) jest dozwolony wyłącznie w Noc 1', () => {
    const v1 = ANCIENT_TREES_DREAM_VARIANTS['restless-night'];
    expect(v1.allowedNights).toEqual([1]);
    expect(v1.mechanicalResolution.conPenaltyDice).toBe(true);
    expect(v1.mechanicalResolution.sanityCheckRequired).toBe(false);
  });

  it('w Noc 2 pula snów wyklucza wariant 1 i zawiera dokładnie warianty 2, 3 i 4', () => {
    const night2Variants = getAvailableDreamVariantsForNight(2);
    expect(night2Variants).toHaveLength(3);
    expect(night2Variants.map((v) => v.id)).not.toContain('restless-night');
    expect(night2Variants.map((v) => v.id)).toEqual([
      'dark-cabin',
      'forest-path',
      'thing-in-lake',
    ]);
  });

  it('wariant 2 (Chata w ciemnościach) wymaga testu SAN 1/1d6 oraz ustawia trigger rozpoznania chaty', () => {
    const v2 = ANCIENT_TREES_DREAM_VARIANTS['dark-cabin'];
    expect(v2.mechanicalResolution.sanityCheckRequired).toBe(true);
    expect(v2.mechanicalResolution.sanityLossFormula).toBe('1/1d6');
    expect(v2.mechanicalResolution.subsequentTriggerLocation).toBe('loc-turner-cabin');
    expect(v2.mechanicalResolution.subsequentSanityLossFormula).toBe('1/1d6');
  });

  it('wariant 3 (Ścieżka przez las) nie wymaga testu SAN po śnie, ale ustawia trigger SAN 0/1 na rozwidleniu', () => {
    const v3 = ANCIENT_TREES_DREAM_VARIANTS['forest-path'];
    expect(v3.mechanicalResolution.sanityCheckRequired).toBe(false);
    expect(v3.mechanicalResolution.subsequentTriggerLocation).toBe('loc-forest-fork');
    expect(v3.mechanicalResolution.subsequentSanityLossFormula).toBe('0/1');
  });

  it('wariant 4 (Coś w jeziorze) wymaga testu SAN 1d3/1d10 po przebudzeniu', () => {
    const v4 = ANCIENT_TREES_DREAM_VARIANTS['thing-in-lake'];
    expect(v4.mechanicalResolution.sanityCheckRequired).toBe(true);
    expect(v4.mechanicalResolution.sanityLossFormula).toBe('1d3/1d10');
  });

  it('selectDreamVariantForNight deterministycznie wybiera wariant po indeksie', () => {
    const pickedN1 = selectDreamVariantForNight(1, 0);
    expect(pickedN1.id).toBe('restless-night');

    const pickedN2 = selectDreamVariantForNight(2, 0);
    expect(pickedN2.id).toBe('dark-cabin');
  });
});
