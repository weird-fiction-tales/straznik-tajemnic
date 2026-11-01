import {
  getHauntingDossier,
  getHauntingHandouts,
  getHauntingGraph,
  projectHauntingMap,
  resolveHauntingConsequence,
} from './starter-dossier';
import {
  eligibleDossierHandouts,
  validatePreparedDossier,
} from './prepared-dossier';

describe('prepared starter edition', () => {
  it.each(['pl', 'en'] as const)(
    'has complete source aids, actors, scenes and endings (%s)',
    (locale) => {
      const dossier = getHauntingDossier(locale);
      expect(validatePreparedDossier(dossier)).toEqual([]);
      expect(dossier.approval).toBe('pending');
      expect(
        dossier.handouts
          .filter((h) => h.sourceNumber)
          .map((h) => h.sourceNumber)
          .sort()
      ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(dossier.scenes.map((s) => s.id)).toEqual(
        expect.arrayContaining([
          'node-library',
          'node-courthouse',
          'node-neighbourhood',
          'node-corbitt-house',
          'node-corbitt-basement',
        ])
      );
      expect(dossier.actors.map((a) => a.id)).toEqual(
        expect.arrayContaining([
          'npc-kim-debrun',
          'npc-mr-dooley',
          'npc-gabriela-macario',
          'npc-vittorio-macario',
        ])
      );
      expect(dossier.endings.map((e) => e.id)).toEqual(
        expect.arrayContaining([
          'success',
          'false-clearance',
          'withdrawal',
          'defeat',
        ])
      );
    }
  );
  it('binds source evidence to the right place and keeps original slugs', () => {
    const d = getHauntingDossier('en');
    expect(
      d.handouts.find((h) => h.slug === 'clue-09-corbitt-journal')?.nodeId
    ).toBe('node-corbitt-house');
    expect(
      d.handouts.find((h) => h.slug === 'clue-07-police-raid-file')?.nodeId
    ).toBe('node-courthouse');
    expect(d.actors.find((a) => a.id === 'npc-ruth-blake')?.sceneIds).toEqual([
      'node-boston-globe',
    ]);
    expect(
      getHauntingGraph('pl').npcs.find((a) => a.id === 'npc-walter-corbitt')
        ?.statsSummary
    ).toContain('HP 16');
  });
  it('gates research in source order and does not reveal any private map', () => {
    const d = getHauntingDossier('en');
    expect(
      eligibleDossierHandouts(d, {
        sceneId: 'node-library',
        acquired: [],
        checks: [],
      })
    ).toEqual([]);
    expect(
      eligibleDossierHandouts(d, {
        sceneId: 'node-library',
        acquired: [],
        checks: ['library-1'],
      }).map((h) => h.sourceNumber)
    ).toEqual([3]);
    expect(
      eligibleDossierHandouts(d, {
        sceneId: 'node-library',
        acquired: ['clue-03-land-registry-1852'],
        checks: ['library-2'],
      }).map((h) => h.sourceNumber)
    ).toEqual([4]);
    const map = projectHauntingMap('en', ['G3', 'B1']);
    expect(map.rooms.map((r) => r.id)).toEqual(['G3', 'B1']);
    expect(JSON.stringify(map)).not.toMatch(/Corbitt|B3|B4|hidden chamber/i);
    expect(getHauntingHandouts('en').some((h) => h.keeperOnly)).toBe(false);
  });
  it('never silently substitutes different-language evidence or unapproved audio', () => {
    const pl = getHauntingHandouts('pl'),
      en = getHauntingHandouts('en');
    expect(pl.map((h) => h.slug)).toEqual(en.map((h) => h.slug));
    expect(
      en.find((h) => h.slug === 'clue-02-boston-globe-1918')?.textContent
    ).toContain('1918');
    expect(
      en.find((h) => h.slug === 'clue-05-obituary-1866')?.textContent
    ).not.toContain('Mount Auburn');
    expect(pl.every((h) => !h.audioUrl && !h.audioUrlPl && !h.audioUrlEn)).toBe(
      true
    );
  });
  it('preserves warning before pushed stair damage and source knife shortcut', () => {
    expect(
      resolveHauntingConsequence({
        event: 'stairs',
        success: false,
        pushed: false,
        roll: 4,
      })
    ).toEqual({ hpLoss: 0, warning: true });
    expect(
      resolveHauntingConsequence({
        event: 'stairs',
        success: false,
        pushed: true,
        roll: 4,
      })
    ).toEqual({ hpLoss: 4, warning: false });
    expect(
      resolveHauntingConsequence({
        event: 'corbitt-hit',
        damage: 1,
        armour: 12,
        hp: 16,
        ownKnife: true,
      })
    ).toEqual({ hp: 0, armour: 12, destroyed: true });
    expect(
      resolveHauntingConsequence({
        event: 'corbitt-hit',
        damage: 8,
        armour: 6,
        hp: 16,
        ownKnife: false,
      })
    ).toEqual({ hp: 14, armour: 0, destroyed: false });
  });
});
