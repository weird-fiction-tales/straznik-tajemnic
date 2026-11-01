import { findGoldMasterMatch } from '../pdf/gold-master-registry';
import { localizeAdventure } from '../immersion/strefa-11-localization';
import { resolveHandoutBySlug } from '../handout-resolver';
import { STARTER_HAUNTING_ADVENTURE } from '../starter-haunting-data';
import { buildHandoutsContext } from '@/app/api/chat/_helpers/build-handouts-context';

describe('starter import preparation integration, no gameplay', () => {
  it('imports corrected graph and localizes custom PDF identities without changing identity', () => {
    const a = findGoldMasterMatch(
      'Nawiedzony dom Walter Corbitt',
      'ZC_Starter.pdf',
      'starter-d100',
      'my-pdf-id'
    )!;
    const en = localizeAdventure(a, 'en');
    expect(en.id).toBe('my-pdf-id');
    expect(en.graph?.npcs.map((n) => n.name)).toContain('Gabriela Macario');
    expect(
      en.handouts?.find((h) => h.slug === 'clue-06-missing-court-verdict')
        ?.title
    ).toBe('No verdict on record');
    expect(en.graph?.nodes?.find((n) => n.id === 'node-library')?.name).toBe(
      'Central Library'
    );
  });
  it('renders the active locale and blocks keeper-only materials at resolver boundary', () => {
    const material = resolveHandoutBySlug(
      'clue-05-obituary-1866',
      STARTER_HAUNTING_ADVENTURE,
      'en'
    );
    expect(material?.title).toBe('Walter Corbitt’s obituary, 1866');
    expect(material?.image).toMatch(/^data:image\/svg/);
    const privateMaterial = {
      slug: 'private-plan',
      title: 'private',
      image: '/private.png',
      keeperOnly: true,
    };
    expect(
      resolveHandoutBySlug('private-plan', {
        ...STARTER_HAUNTING_ADVENTURE,
        handouts: [privateMaterial],
      })
    ).toBeNull();
  });
  it('includes exact reveal requirements in GM context instead of treating all evidence as global', () => {
    const context = buildHandoutsContext(
      STARTER_HAUNTING_ADVENTURE.handouts,
      undefined,
      { adventureId: 'nawiedzony-dom', activeNodeId: 'node-library' }
    );
    expect(context).toContain('library-1');
    expect(context).not.toContain('[HANDOUT:clue-07-police-raid-file]');
  });
});
