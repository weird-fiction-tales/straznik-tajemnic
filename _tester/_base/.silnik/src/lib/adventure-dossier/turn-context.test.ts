import { embeddingService } from '@/lib/embedding-service';
import { activateDossierRag, clearDossierRag } from './rag-runtime';
import {
  getActiveDossierMechanicIds,
  getAcquiredDossierRecordIds,
  getPartyAcquiredDossierRecordIds,
  retrieveDossierTurnContext,
} from './turn-context';

const activationId = 'dossier-turn-context-test';
const fingerprint = 'sha256:synthetic-test-edition';

const payload = {
  schema_version: 1,
  adventure_id: 'synthetic-adventure',
  edition_fingerprint: fingerprint,
  records: [{
    schema_version: 1,
    record_id: 'synthetic.scene.fact',
    record_type: 'scene',
    adventure_id: 'synthetic-adventure',
    edition_fingerprint: fingerprint,
    language: 'pl',
    content: 'Synthetic test fact; no published adventure content.',
    tags: { entities: [], scenes: ['scene-one'], mechanics: [], topics: ['test'], triggers: [] },
    retrieval: { visibility: 'gm_only', availability: 'when_scene_active', condition: null, priority: 1 },
    evidence: {
      provenance: 'approved_design',
      source_ref: 'synthetic-test-fixture',
      status: 'set',
      approval: 'approved',
      approved_by: 'test-fixture',
      approved_at: '2026-10-11T00:00:00Z',
    },
    links: [],
  }, {
    schema_version: 1,
    record_id: 'synthetic.clue.lead',
    record_type: 'clue',
    adventure_id: 'synthetic-adventure',
    edition_fingerprint: fingerprint,
    language: 'pl',
    content: 'Synthetic clue record; no published adventure content.',
    tags: { entities: [], scenes: ['scene-one'], mechanics: [], topics: ['clue'], triggers: [] },
    retrieval: { visibility: 'gm_only', availability: 'when_scene_active', condition: null, priority: 1 },
    evidence: {
      provenance: 'approved_design',
      source_ref: 'synthetic-test-fixture',
      status: 'set',
      approval: 'approved',
      approved_by: 'test-fixture',
      approved_at: '2026-10-11T00:00:00Z',
    },
    links: [],
  }, {
    schema_version: 1,
    record_id: 'synthetic.handout.locator-letter',
    record_type: 'handout_locator',
    adventure_id: 'synthetic-adventure',
    edition_fingerprint: fingerprint,
    language: 'pl',
    content: 'Synthetic handout locator; exact local PDF handout only.',
    tags: { entities: [], scenes: ['scene-one'], mechanics: [], topics: ['handout'], triggers: ['clue_acquired'] },
    retrieval: { visibility: 'gm_only', availability: 'when_scene_active', condition: null, priority: 2 },
    evidence: {
      provenance: 'approved_design',
      source_ref: 'synthetic-test-fixture#page=1',
      status: 'set',
      approval: 'approved',
      approved_by: 'test-fixture',
      approved_at: '2026-10-11T00:00:00Z',
    },
    links: [],
  }, {
    schema_version: 1,
    record_id: 'synthetic.after-clue.fact',
    record_type: 'fact',
    adventure_id: 'synthetic-adventure',
    edition_fingerprint: fingerprint,
    language: 'pl',
    content: 'Synthetic dependent fact; no published adventure content.',
    tags: { entities: [], scenes: ['scene-one'], mechanics: [], topics: ['dependent'], triggers: [] },
    retrieval: {
      visibility: 'gm_only',
      availability: 'after_reveal',
      condition: { all: [{ kind: 'reveal_acquired', id: 'synthetic.clue.lead' }] },
      priority: 2,
    },
    evidence: {
      provenance: 'approved_design',
      source_ref: 'synthetic-test-fixture',
      status: 'set',
      approval: 'approved',
      approved_by: 'test-fixture',
      approved_at: '2026-10-11T00:00:00Z',
    },
    links: [],
  }],
};

describe('dossier turn context', () => {
  it('uses only discovered player clues to unlock dependent records', () => {
    expect(getAcquiredDossierRecordIds([
      { id: 'revealed-clue', discoveryStatus: 'discovered', epistemicLayer: 'player_clue' },
      { id: 'legacy-clue', discoveryStatus: 'verified', dossierRecordId: 'dossier.clue.verified' },
      { id: 'verified-clue', discoveryStatus: 'verified' },
      { id: 'hidden-truth', discoveryStatus: 'verified', epistemicLayer: 'keeper_truth' },
      { id: 'not-yet-found', discoveryStatus: 'unrevealed', epistemicLayer: 'player_clue' },
      { id: 'legacy-no-status' },
    ])).toEqual(['revealed-clue', 'dossier.clue.verified', 'verified-clue']);
  });

  it('shares acquired clue IDs across current Hot Seat participants only', () => {
    expect(getPartyAcquiredDossierRecordIds({
      activeCharacterId: 'active',
      participantIds: ['active', 'co-investigator'],
      characters: [
        {
          id: 'active',
          investigatorDossier: { clues: [{ id: 'active-clue', dossierRecordId: 'dossier.shared', discoveryStatus: 'discovered' }] },
        },
        {
          id: 'co-investigator',
          investigatorDossier: { clues: [{ id: 'partner-clue', dossierRecordId: 'dossier.partner', discoveryStatus: 'verified' }] },
        },
        {
          id: 'inactive-roster',
          investigatorDossier: { clues: [{ id: 'unrelated-clue', dossierRecordId: 'dossier.unrelated', discoveryStatus: 'discovered' }] },
        },
      ] as never,
    })).toEqual(['dossier.shared', 'dossier.partner']);
  });

  it('maps only active chase and combat state to the audit-area mechanic IDs', () => {
    expect(getActiveDossierMechanicIds({ chaseActive: true })).toEqual([
      'coc7:chase-movement', 'coc7:chase-obstacles', 'coc7:chase-maneuvers',
      'coc7:action-scenes-suspense',
    ]);
    expect(getActiveDossierMechanicIds({
      combatResolutions: [{ maneuverType: 'grapple', damageDealtTo: 'defender' }],
    })).toEqual([
      'coc7:combat-round',
      'coc7:melee-combat',
      'coc7:combat-defense',
      'coc7:armor',
      'coc7:combat-maneuver',
      'coc7:damage-bonus-build',
      'coc7:wounds',
    ]);
    expect(getActiveDossierMechanicIds({})).toEqual([]);
  });

  it('maps a submitted local skill or SAN roll without inferring a roll from ordinary prose', () => {
    const ids = getActiveDossierMechanicIds({
      submittedRollText: `[🎲 Test: Poczytalność (50%) [+1 kość bonusowa]\nWynik: 7 → Sukces\nTest Trudny: ZDANY`,
    });
    expect(ids).toEqual([
      'coc7:skill-tests',
      'coc7:percentile-rolls',
      'coc7:sanity-tests',
      'coc7:bonus-penalty-dice',
      'coc7:difficulty-levels',
    ]);
    expect(getActiveDossierMechanicIds({
      submittedRollText: 'Wykonuję test Poczytalności i wyrzucam 7.',
    })).toEqual([]);
  });

  it('maps combined local skill result tags and only their explicit modifiers/outcomes', () => {
    expect(getActiveDossierMechanicIds({
      submittedRollText: `[🎲 Test łączony: I (wymagane oba) [+1 kość bonusowa]]\nRzut d100: **01**\n[WYNIK: Pomysłowość | 01 ≤ 50 | KRYTYK | BONUS | LUCK]\n[WYNIK: Wykształcenie | 01 ≤ 60 | SUKCES]`,
    })).toEqual([
      'coc7:skill-tests',
      'coc7:percentile-rolls',
      'coc7:combined-skill-tests',
      'coc7:luck-points',
      'coc7:bonus-penalty-dice',
      'coc7:criticals-fumbles',
      'coc7:idea-roll',
      'coc7:knowledge-roll',
    ]);
    expect(getActiveDossierMechanicIds({
      submittedRollText: '[WYNIK: Spostrzegawczość | 34 ≤ 55 | SUKCES]',
    })).toEqual(['coc7:skill-tests', 'coc7:percentile-rolls']);
  });

  it('maps group-test mechanics only after Hot Seat submits the complete resolved group', () => {
    expect(getActiveDossierMechanicIds({
      submittedRollText: 'Wyniki testów obojga badaczy:\n[DICE_ROLL] Ada wykonała test umiejętności "Nasłuchiwanie" (45%): wynik 22, REGULAR - SUKCES\n[DICE_ROLL] Jan wykonał test umiejętności "Nasłuchiwanie" (55%): wynik 67, FAIL - PORAŻKA',
    })).toEqual(['coc7:skill-tests', 'coc7:percentile-rolls', 'coc7:group-tests']);
    expect(getActiveDossierMechanicIds({
      submittedRollText: 'Wyniki testów obojga badaczy:\n[DICE_ROLL] Ada wykonała test umiejętności "Nasłuchiwanie" (45%): wynik 22, REGULAR - SUKCES',
    })).toEqual([]);
  });

  it('maps completed development and only a successful Luck recovery', () => {
    expect(getActiveDossierMechanicIds({ developmentResolved: true })).toEqual([
      'coc7:investigator-development',
    ]);
    expect(getActiveDossierMechanicIds({
      developmentResolved: true,
      luckRecovered: true,
    })).toEqual(['coc7:investigator-development', 'coc7:luck-points']);
  });

  it('maps a typed resolved Idea Roll and its critical or fumble result', () => {
    expect(getActiveDossierMechanicIds({
      ideaRollResolved: true,
      ideaRollOutcome: 'fail',
    })).toEqual([
      'coc7:skill-tests',
      'coc7:percentile-rolls',
      'coc7:idea-roll',
      'coc7:dice-adjudication',
      'coc7:clues-fail-forward',
    ]);
    expect(getActiveDossierMechanicIds({
      ideaRollResolved: true,
      ideaRollOutcome: 'fumble',
    })).toEqual([
      'coc7:skill-tests',
      'coc7:percentile-rolls',
      'coc7:idea-roll',
      'coc7:dice-adjudication',
      'coc7:clues-fail-forward',
      'coc7:criticals-fumbles',
    ]);
    expect(getActiveDossierMechanicIds({ ideaRollOutcome: 'fail' })).toEqual([]);
    expect(getActiveDossierMechanicIds({
      ideaRollResolved: true,
      ideaRollOutcome: 'regular',
    })).not.toContain('coc7:clues-fail-forward');
  });

  it('maps only resolved local skill-roll outcomes and Luck spending', () => {
    expect(getActiveDossierMechanicIds({
      skillRolls: [{ outcome: 'regular', luckSpent: 2 }],
    })).toEqual([
      'coc7:skill-tests',
      'coc7:percentile-rolls',
      'coc7:dice-adjudication',
      'coc7:luck-points',
    ]);
    expect(getActiveDossierMechanicIds({
      skillRolls: [{ outcome: 'fumble', luckSpent: 0 }],
    })).toEqual([
      'coc7:skill-tests',
      'coc7:percentile-rolls',
      'coc7:dice-adjudication',
      'coc7:criticals-fumbles',
    ]);
    expect(getActiveDossierMechanicIds({
      skillRolls: [{ outcome: 'regular', luckSpent: 0 }],
    })).toEqual([
      'coc7:skill-tests',
      'coc7:percentile-rolls',
      'coc7:dice-adjudication',
    ]);
  });

  it('selects clue fail-forward only for failed investigative skill rolls', () => {
    expect(getActiveDossierMechanicIds({
      skillRolls: [{ outcome: 'fail', luckSpent: 0, skillNames: ['Spostrzegawczość'] }],
    })).toEqual([
      'coc7:skill-tests',
      'coc7:percentile-rolls',
      'coc7:dice-adjudication',
      'coc7:clues-fail-forward',
    ]);
    expect(getActiveDossierMechanicIds({
      skillRolls: [{ outcome: 'fumble', luckSpent: 0, skillNames: ['Track'] }],
    })).toContain('coc7:clues-fail-forward');
    expect(getActiveDossierMechanicIds({
      skillRolls: [{ outcome: 'fail', luckSpent: 0, skillNames: ['Walka Wręcz'] }],
    })).not.toContain('coc7:clues-fail-forward');
    expect(getActiveDossierMechanicIds({
      skillRolls: [{ outcome: 'regular', luckSpent: 0, skillNames: ['Bibliotekoznawstwo'] }],
    })).not.toContain('coc7:clues-fail-forward');
  });

  it('activates social-resistance context only for a resolved social influence skill', () => {
    expect(getActiveDossierMechanicIds({
      skillRolls: [{ outcome: 'regular', luckSpent: 0, skillNames: ['Perswazja'] }],
    })).toEqual([
      'coc7:skill-tests',
      'coc7:percentile-rolls',
      'coc7:dice-adjudication',
      'coc7:social-resistance',
    ]);
    expect(getActiveDossierMechanicIds({
      skillRolls: [{ outcome: 'regular', luckSpent: 0, skillNames: ['Psychologia'] }],
    })).toEqual(['coc7:skill-tests', 'coc7:percentile-rolls', 'coc7:dice-adjudication']);
  });

  it('retrieves madness-bout mechanics only while the investigator has an active bout', () => {
    expect(getActiveDossierMechanicIds({ activeBoutOfMadness: true })).toEqual([
      'coc7:madness-bouts',
    ]);
    expect(getActiveDossierMechanicIds({ activeBoutOfMadness: false })).toEqual([]);
  });

  it('maps a resolved local spell card result and its conditional magic mechanics', () => {
    expect(getActiveDossierMechanicIds({
      submittedSpellResultText: '[WYNIK_CZARU: id=event-1 | spell=spell-1 | nazwa=Czar | sukces=true | forsowany=true | mp=2 | hp=0 | san=1 | pow=0 | starcie=40vs30 | zwyciezca=caster | KATASTROFA]',
    })).toEqual([
      'coc7:magic-points-sanity',
      'coc7:spell-casting',
      'coc7:pushed-rolls',
      'coc7:opposed-magic',
      'coc7:magical-catastrophes',
    ]);
    expect(getActiveDossierMechanicIds({
      submittedSpellResultText: 'Gracz mówi: zamierzam rzucić czar.',
    })).toEqual([]);
  });

  it('maps only resolved local hazard results and their actual damage or check areas', () => {
    expect(getActiveDossierMechanicIds({
      submittedHazardResultText: '[WYNIK_ZAGROŻENIA: id=hazard-1 | Obrażenia: -2 HP | Test Kondycji: 40/50% (SUCCESS)]',
    })).toEqual([
      'coc7:other-damage',
      'coc7:wounds',
      'coc7:skill-tests',
      'coc7:percentile-rolls',
    ]);
    expect(getActiveDossierMechanicIds({
      submittedHazardResultText: '[HAZARD_RESULT: id=hazard-2 | Damage: -0 HP | Fire resisted]',
    })).toEqual(['coc7:other-damage']);
    expect(getActiveDossierMechanicIds({
      submittedHazardResultText: 'I fall into acid and take damage.',
    })).toEqual([]);
  });

  it('maps local tome, opposed-magic, and firearm-card results without inferring them from prose', () => {
    expect(getActiveDossierMechanicIds({
      submittedTomeResultText: '[WYNIK_TOMU: id=tome-1 | tome=book-1 | akcja=study | sukces=true | san=2]',
    })).toEqual([
      'coc7:mythos-book-reading',
      'coc7:mythos-tome-study',
      'coc7:skill-tests',
      'coc7:percentile-rolls',
      'coc7:sanity-tests',
    ]);
    expect(getActiveDossierMechanicIds({
      submittedOpposedMagicResultText: '[WYNIK_OBRONY_MAGII: id=magic-1 | cel=Investigator | sukces=true]',
    })).toEqual([
      'coc7:opposed-rolls',
      'coc7:opposed-magic',
      'coc7:skill-tests',
      'coc7:percentile-rolls',
    ]);
    expect(getActiveDossierMechanicIds({
      submittedFirearmResultText: '[WYNIK_STRZAŁU: Cultist -> Investigator | DiveForCover=SUKCES | rzut=30/50 | stan=leży_na_ziemi]',
    })).toEqual(['coc7:firearms-range', 'coc7:skill-tests', 'coc7:percentile-rolls']);
    expect(getActiveDossierMechanicIds({
      submittedTomeResultText: 'Czytam księgę Mitów.',
      submittedOpposedMagicResultText: 'Wróg rzuca czar.',
      submittedFirearmResultText: 'Strzelec celuje do Badacza.',
    })).toEqual([]);
  });

  it('keeps the documented runtime adapter coverage explicit and stable', () => {
    expect(getActiveDossierMechanicIds({
      chaseActive: true,
      combatResolutions: [{ maneuverType: 'grapple', damageDealtTo: 'defender' }],
      submittedRollText: 'Wyniki testów obojga badaczy:\n[DICE_ROLL] Ada wykonała test umiejętności "Nasłuchiwanie" (45%): wynik 22, REGULAR - SUKCES\n[DICE_ROLL] Jan wykonał test umiejętności "Nasłuchiwanie" (55%): wynik 67, FAIL - PORAŻKA\n[🎲 Test: Poczytalność (50%) [+1 kość bonusowa]\nWynik: 7 → Sukces\nTest Trudny: ZDANY\n[🎲 Test łączony: I (wymagane oba)]\n[WYNIK: Pomysłowość | 01 ≤ 50 | KRYTYK | BONUS | LUCK]\n[WYNIK: Wykształcenie | 01 ≤ 60 | SUKCES]',
      submittedSpellResultText: '[WYNIK_CZARU: id=spell-1 | spell=spell-1 | sukces=true | forsowany=true | starcie=40vs30 | KATASTROFA]',
      submittedHazardResultText: '[WYNIK_ZAGROŻENIA: id=hazard-1 | Obrażenia: -2 HP | Test Kondycji: 40/50% (SUCCESS)]',
      submittedTomeResultText: '[WYNIK_TOMU: id=tome-1 | tome=book-1 | akcja=study | sukces=true | san=2]',
      submittedOpposedMagicResultText: '[WYNIK_OBRONY_MAGII: id=magic-1 | sukces=true]',
      submittedFirearmResultText: '[WYNIK_STRZAŁU: Cultist -> Investigator | DiveForCover=SUKCES | rzut=30/50]',
      developmentResolved: true,
      activeBoutOfMadness: true,
      skillRolls: [{ outcome: 'regular', luckSpent: 0, skillNames: ['Perswazja'] }],
    }).sort()).toEqual([
      'coc7:dice-adjudication',
      'coc7:damage-bonus-build',
      'coc7:magic-points-sanity',
      'coc7:pushed-rolls',
      'coc7:difficulty-levels',
      'coc7:skill-tests',
      'coc7:percentile-rolls',
      'coc7:social-resistance',
      'coc7:group-tests',
      'coc7:criticals-fumbles',
      'coc7:luck-points',
      'coc7:idea-roll',
      'coc7:knowledge-roll',
      'coc7:opposed-rolls',
      'coc7:bonus-penalty-dice',
      'coc7:combined-skill-tests',
      'coc7:investigator-development',
      'coc7:combat-round',
      'coc7:melee-combat',
      'coc7:combat-maneuver',
      'coc7:combat-defense',
      'coc7:armor',
      'coc7:firearms-range',
      'coc7:wounds',
      'coc7:other-damage',
      'coc7:chase-movement',
      'coc7:chase-obstacles',
      'coc7:chase-maneuvers',
      'coc7:action-scenes-suspense',
      'coc7:sanity-tests',
      'coc7:madness-bouts',
      'coc7:mythos-book-reading',
      'coc7:spell-casting',
      'coc7:magical-catastrophes',
      'coc7:mythos-tome-study',
      'coc7:opposed-magic',
    ].sort());
  });

  const embedding = jest.spyOn(embeddingService, 'generateLocalEmbedding');

  beforeEach(() => {
    embedding.mockResolvedValue([1, 0]);
    clearDossierRag(activationId);
  });

  afterAll(() => embedding.mockRestore());

  it('returns empty context and no eligible clue ids when the session has no activated dossier', async () => {
    await expect(retrieveDossierTurnContext({
      activationId,
      adventureId: 'synthetic-adventure',
      query: 'What is happening?',
      activeSceneIds: ['scene-one'],
      presentEntityIds: [],
    })).resolves.toEqual({ context: '', clueRecordIds: [], handoutLocatorIds: [] });
  });

  it('returns eligible clue IDs alongside approved records for the active scene', async () => {
    const activated = await activateDossierRag(
      activationId,
      'synthetic-adventure',
      fingerprint,
      payload,
    );
    expect(activated.ok).toBe(true);

    const context = await retrieveDossierTurnContext({
      activationId,
      adventureId: 'synthetic-adventure',
      query: 'What is happening?',
      activeSceneIds: ['scene-one'],
      presentEntityIds: [],
    });
    expect(context.context).toContain('[KONTEKST TECZKI PRZYGODY - NOTATKI DLA MG]');
    expect(context.context).toContain('synthetic.scene.fact');
    expect(context.context).toContain('Synthetic test fact; no published adventure content.');
    expect(context.context).toContain('Dostępne ID aktywnych rekordów typu clue: synthetic.clue.lead.');
    expect(context.context).toContain('synthetic.handout.locator-letter');
    expect(context.context).toContain('Gdy Badacze zdobędą wskazany materiał, wstaw dokładnie [HANDOUT:synthetic.handout.locator-letter].');
    expect(context.clueRecordIds).toEqual(['synthetic.clue.lead']);
    expect(context.handoutLocatorIds).toEqual(['synthetic.handout.locator-letter']);
    expect(context.context).not.toContain('Synthetic dependent fact');

    const afterReveal = await retrieveDossierTurnContext({
      activationId,
      adventureId: 'synthetic-adventure',
      query: 'What is happening?',
      activeSceneIds: ['scene-one'],
      presentEntityIds: [],
      acquiredRecordIds: getAcquiredDossierRecordIds([{
        id: 'player-clue-1',
        dossierRecordId: 'synthetic.clue.lead',
        discoveryStatus: 'discovered',
        epistemicLayer: 'player_clue',
      }]),
    });
    expect(afterReveal.context).toContain('Synthetic dependent fact');

    const otherAdventure = await retrieveDossierTurnContext({
      activationId,
      adventureId: 'another-adventure',
      query: 'What is happening?',
      activeSceneIds: ['scene-one'],
      presentEntityIds: [],
    });
    expect(otherAdventure).toEqual({ context: '', clueRecordIds: [], handoutLocatorIds: [] });
  });
});
