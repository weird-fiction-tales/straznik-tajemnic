import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { resolvePreparedPublicProfile } from './prepared-public-profiles';

it.each(['pl', 'en'] as const)('returns only a public introduction and a prepared image (%s)', locale => {
  for (const [adventure, reference] of [
    ['cien-nad-prabutami', 'loc-warszawa-redakcja'],
    ['cien-nad-prabutami', 'loc-elblag-klasztor'],
    ['cien-nad-prabutami', 'loc-prabuty-wykopaliska'],
    ['cien-nad-prabutami', 'loc-msw-warszawa'],
    ['cien-nad-prabutami', 'loc-prabuty-krypta'],
    ['englewood-murder-castle-1893', 'loc-chicago-precinct'],
    ['englewood-murder-castle-1893', 'loc-castle-pharmacy'],
    ['englewood-murder-castle-1893', 'loc-castle-second-floor'],
    ['englewood-murder-castle-1893', 'loc-quinlan-quarters'],
    ['englewood-murder-castle-1893', 'loc-castle-basement'],
  ]) {
    const profile = resolvePreparedPublicProfile(adventure, 'place', reference, locale)!;
    expect(profile).not.toBeNull();
    expect(Object.keys(profile).sort()).toEqual(['description', 'imageUrl']);
    expect(profile.description).not.toMatch(/KLIN|sekret|secret|rift|gas chambers|key|stolen|ukrad|klucz/i);
    expect(profile.imageUrl).toBeTruthy();
    expect(existsSync(join(process.cwd(), 'public', profile.imageUrl!))).toBe(true);
  }
});

it('requires an exact identity from the same adventure', () => {
  expect(resolvePreparedPublicProfile('cien-nad-prabutami', 'place', 'Redakcja', 'pl')).toBeNull();
  expect(resolvePreparedPublicProfile('englewood-murder-castle-1893', 'place', 'loc-warszawa-redakcja', 'en')).toBeNull();
  expect(resolvePreparedPublicProfile(undefined, 'person', 'Helena', 'pl')).toBeNull();
  expect(resolvePreparedPublicProfile('custom', 'person', 'Helena', 'pl')).toBeNull();
});
