import {
  buildNarrativeClueGate,
  appendJournalFromText,
  getNarrativeProgress,
  appendJournalToParty,
} from '@/lib/journal/apply-journal-tags';
import { cleanupContent } from '@/components/chat/narrative/cleanup';
import {
  cleanResponseText,
  stripMultilineArtifacts,
} from '@/lib/parsers/text-cleaner';
import { PREDEFINED_CHARACTERS } from '@/lib/immersion/predefined-characters';
import type { Character } from '@/lib/types';
import type { ClueEntry } from '@/lib/journal/dossier-types';

const clue = (id: string, overrides: Partial<ClueEntry> = {}): ClueEntry => ({
  id,
  title: id,
  description: 'Evidence',
  category: 'document',
  status: 'confirmed',
  clueType: 'core',
  ...overrides,
});
const character = (clues: ClueEntry[] = []): Character => ({
  ...PREDEFINED_CHARACTERS[0],
  investigatorDossier: {
    clues,
    npcs: [],
    locations: [],
    notes: [],
    lastUpdated: '',
  },
});

describe('Issue #761: deterministic clue gates', () => {
  it.each([0, 1])('locks the act and climax for %i core clues', (count) => {
    expect(
      buildNarrativeClueGate(
        character(Array.from({ length: count }, (_, i) => clue(String(i)))),
        'pl'
      )
    ).toContain('[BLOKADA_AKTU:');
  });
  it('unlocks only after two distinct revealed core clues', () => {
    expect(
      buildNarrativeClueGate(character([clue('a'), clue('b')]), 'en')
    ).not.toContain('[BLOKADA_AKTU:');
    expect(
      buildNarrativeClueGate(character([clue('a'), clue('a')]), 'en')
    ).toContain('[BLOKADA_AKTU:');
  });
  it.each([
    { clueType: 'flavor' as const },
    { discoveryStatus: 'unrevealed' as const },
    { epistemicLayer: 'keeper_truth' as const },
    { status: 'disproven' as const },
    { status: 'superseded' as const },
  ])('does not count invalid or hidden evidence %j', (overrides) => {
    expect(
      buildNarrativeClueGate(character([clue('a'), clue('b', overrides)]), 'pl')
    ).toContain('[BLOKADA_AKTU:');
  });
  it('rejects a premature transition without adding a journal entry', () => {
    const c = character([clue('a')]);
    const next = appendJournalFromText(c, '[PRZEJŚCIE_AKTU: Akt 2]', 'm1');
    expect(getNarrativeProgress(next).currentAct).toBe(1);
    expect(next.journal).toEqual(c.journal);
  });
  it('silently persists the next act, rejects replay and does not reuse old clues', () => {
    const c = character([clue('a'), clue('b')]);
    const next = appendJournalFromText(c, '[PRZEJŚCIE_AKTU: Akt II]', 'm1');
    expect(getNarrativeProgress(next).currentAct).toBe(2);
    expect(next.journal).toEqual(c.journal);
    expect(
      buildNarrativeClueGate(JSON.parse(JSON.stringify(next)), 'pl')
    ).toContain('0/2');
    expect(
      getNarrativeProgress(
        appendJournalFromText(next, '[PRZEJŚCIE_AKTU: Akt 3]', 'm2')
      ).currentAct
    ).toBe(2);
  });
  it.each(['[PRZEJŚCIE_AKTU: Akt II]', '[PRZEJŚCIE_AKTU: Akt'])(
    'keeps control tags out of visible prose and TTS: %s',
    (tag) => {
      const raw = 'Czekasz przy biurku. ' + tag;
      expect(cleanupContent(raw)).toBe('Czekasz przy biurku.');
      expect(cleanResponseText(raw)).toBe('Czekasz przy biurku.');
      expect(stripMultilineArtifacts(raw).trim()).toBe('Czekasz przy biurku.');
    }
  );
});

describe('Issue #761: state boundaries', () => {
  it('shares evidence and the act between party members', () => {
    const active = { ...character([clue('a')]), id: 'active' };
    const partner = { ...character([clue('b')]), id: 'partner' };
    const party = appendJournalToParty(
      [active, partner],
      active,
      '[PRZEJŚCIE_AKTU: Akt 2]',
      'turn'
    );
    expect(party.changed).toBe(true);
    expect(
      party.characters.map((c) => getNarrativeProgress(c).currentAct)
    ).toEqual([2, 2]);
    expect(
      buildNarrativeClueGate(party.activeCharacter, 'en', party.characters)
    ).toContain('0/2');
  });
  it('does not permit skipped acts or private transitions', () => {
    const c = character([clue('a'), clue('b')]);
    for (const raw of [
      '[PRZEJŚCIE_AKTU: Akt 3]',
      '[MYŚLI_MG: [PRZEJŚCIE_AKTU: Akt 2]]',
      '[PRZEJŚCIE_AKTU: Akt 2][PRZEJŚCIE_AKTU: Akt 3]',
    ]) {
      expect(
        getNarrativeProgress(appendJournalFromText(c, raw, 'm')).currentAct
      ).toBe(1);
    }
  });
  it('requires two new clues for the next act after save/load', () => {
    let c = appendJournalFromText(
      character([clue('a'), clue('b')]),
      '[PRZEJŚCIE_AKTU: Akt 2]',
      'm1'
    );
    c = {
      ...c,
      investigatorDossier: {
        ...c.investigatorDossier!,
        clues: [clue('a'), clue('b'), clue('c'), clue('d')],
      },
    };
    expect(
      getNarrativeProgress(
        appendJournalFromText(
          JSON.parse(JSON.stringify(c)),
          '[PRZEJŚCIE_AKTU: Akt 3]',
          'm2'
        )
      ).currentAct
    ).toBe(3);
  });
});
