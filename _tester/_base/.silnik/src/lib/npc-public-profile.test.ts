import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { resolveNpcPublicProfile } from './npc-public-profile';

it.each(['Helena', 'Helena Krawczyk', 'redaktorka Helena', 'npc-helena-krawczyk'])(
  'resolves an explicit unambiguous alias within its adventure: %s', reference => {
    expect(resolveNpcPublicProfile('cien-nad-prabutami', reference)?.id).toBe('npc-helena-krawczyk');
  }
);

it.each(['dr. Skrzyński', 'DR SKRZYNSKI', 'Jarosław', 'doktor Skrzyński'])(
  'normalises a known doctor alias: %s', reference => {
    expect(resolveNpcPublicProfile('cien-nad-prabutami', reference)?.name).toBe('dr Jarosław Skrzyński');
  }
);

it('rejects cross-adventure, fuzzy, unknown, and ambiguous role-only references', () => {
  for (const reference of ['Hel', 'Helena mówi', 'pani', 'doktor', 'redaktorka', 'Nieznajomy'])
    expect(resolveNpcPublicProfile('cien-nad-prabutami', reference)).toBeNull();
  expect(resolveNpcPublicProfile('englewood-murder-castle-1893', 'Helena')).toBeNull();
  expect(resolveNpcPublicProfile(undefined, 'Helena')).toBeNull();
});

it.each(['pl', 'en'] as const)('returns only a safe localised profile and existing portrait assets (%s)', locale => {
  const cases = {
    'cien-nad-prabutami': ['Helena', 'Skrzyński', 'Klimuszko', 'Tadeusz', 'Majewski'],
    'englewood-murder-castle-1893': ['Shea', 'Gary', 'Chappell', 'Quinlan', 'Emeline'],
  };
  for (const [adventureId, names] of Object.entries(cases)) for (const name of names) {
    const profile = resolveNpcPublicProfile(adventureId, name, locale)!;
    expect(profile).not.toBeNull();
    expect(Object.keys(profile).sort()).toEqual(['aliases', 'description', 'id', 'name', 'portraitUrl']);
    expect(profile.description).not.toMatch(/KLIN|szantaż|blackmail|keeper|rift|szczelin|spal|burn/i);
    expect(existsSync(join(process.cwd(), 'public', profile.portraitUrl!))).toBe(true);
  }
  expect(resolveNpcPublicProfile('cien-nad-prabutami', 'Helena', locale)?.description)
    .toContain(locale === 'pl' ? 'Redaktorka' : 'Editor');
});

it('does not let a consumer mutate shared alias definitions', () => {
  const profile = resolveNpcPublicProfile('cien-nad-prabutami', 'Helena')!;
  (profile.aliases as string[]).push('Secret alias');
  expect(resolveNpcPublicProfile('cien-nad-prabutami', 'Secret alias')).toBeNull();
});

it('uses only the explicit active roster and rejects ambiguous first names', () => {
  const roster = [{ id: 'a', name: 'dr Jan Kowalski', portraitUrl: '/jan-a.png' }, { id: 'b', name: 'Jan Nowak', portraitUrl: '/jan-b.png' }];
  expect(resolveNpcPublicProfile('custom', 'Jan', 'pl', roster)).toBeNull();
  expect(resolveNpcPublicProfile('custom', 'Jan Kowalski', 'pl', roster))
    .toMatchObject({id: 'a', name: 'dr Jan Kowalski', portraitUrl: '/jan-a.png', description: ''});
  expect(resolveNpcPublicProfile('custom', 'Jan', 'pl', roster.slice(0, 1))?.id).toBe('a');
  expect(resolveNpcPublicProfile(undefined, 'Jan', 'pl', roster.slice(0, 1))).toBeNull();
});

it('does not let a prepared short alias override a different person in the active roster', () => {
  const roster = [{id: 'npc-helena-krawczyk', name: 'Helena Krawczyk'}, {id: 'other', name: 'Helena Nowak'}];
  expect(resolveNpcPublicProfile('cien-nad-prabutami', 'Helena', 'pl', roster)).toBeNull();
  expect(resolveNpcPublicProfile('cien-nad-prabutami', 'Helena Krawczyk', 'pl', roster)?.id).toBe('npc-helena-krawczyk');
});
