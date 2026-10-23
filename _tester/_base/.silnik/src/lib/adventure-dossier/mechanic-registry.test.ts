import { DOSSIER_MECHANICS, getDossierMechanicIdForAuditArea, isDossierMechanicId } from './mechanic-registry';

describe('dossier mechanic registry', () => {
  it('maps all 58 audited CoC areas to unique stable IDs', () => {
    const areas = DOSSIER_MECHANICS.map(({ auditArea }) => auditArea).sort((a, b) => a - b);
    const ids = DOSSIER_MECHANICS.map(({ id }) => id);

    expect(areas).toEqual(Array.from({ length: 58 }, (_, index) => index + 1));
    expect(new Set(ids).size).toBe(58);
    expect(isDossierMechanicId('coc7:social-resistance')).toBe(true);
    expect(isDossierMechanicId('coc7:25')).toBe(false);
    expect(getDossierMechanicIdForAuditArea(39)).toBe('coc7:chase-movement');
  });
});
