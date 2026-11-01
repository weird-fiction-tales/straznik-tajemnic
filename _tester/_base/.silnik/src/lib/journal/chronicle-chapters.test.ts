import type { Character } from '@/lib/types';
import type { CampaignMemoryScope } from '@/core/memory/types';
import { PREDEFINED_CHARACTERS } from '@/lib/immersion/predefined-characters';
import { appendJournalToParty, buildSceneChronicleTranscript } from './apply-journal-tags';
import { beginChronicleTurn, closeChronicleSession, stampChronicleEntries } from './chronicle-chapters';

const scope: CampaignMemoryScope = { schemaVersion: 1, playthroughId: 'run', campaignDefinitionId: 'campaign', adventureId: 'archive', kind: 'custom' };
const character = (id: string): Character => ({ ...PREDEFINED_CHARACTERS[0], id, journal: [], sceneCards: [], activeScene: undefined, chronicleSession: undefined });
const begin = (characters: Character[], active: Character, message = 'user-1', currentScope = scope) => beginChronicleTurn(characters, active, {
  scope: currentScope, adventureTitle: 'Archiwum', participantIds: ['anna', 'jan'], startMessageId: message, location: 'Archiwum',
});

describe('durable chronicle chapters', () => {
  it('shares one session with participants, leaves the character catalog untouched and preserves identity across turns', () => {
    const anna = character('anna'); const jan = character('jan'); const other = character('other');
    const first = begin([anna, jan, other], anna);
    expect(first.characters[2]).toBe(other);
    expect(first.characters[0].chronicleSession).toEqual(first.characters[1].chronicleSession);
    expect(first.activeCharacter.chronicleSession).toMatchObject({ sessionId: 'run:session:1', sessionNumber: 1 });
    const next = begin(first.characters, first.activeCharacter, 'user-2');
    expect(next.changed).toBe(false);
    expect(next.activeCharacter.activeScene?.startMessageId).toBe('user-1');
  });

  it('stamps location changes and never relabels old journal entries', () => {
    const anna = character('anna');
    anna.journal = [{ id: 'legacy', timestamp: new Date(), type: 'scene', title: 'Dawny zapis', content: 'Stanisław twierdził...', tags: [], isBookmarked: false }];
    const first = begin([anna], anna);
    const turn = appendJournalToParty(first.characters, first.activeCharacter, 'Wychodzimy. [ZMIANA_SCENY: Doki]', 'assistant-1');
    const stamped = stampChronicleEntries(turn.activeCharacter, anna);
    expect(stamped.sceneCards?.[0].chronicleChapter?.sessionNumber).toBe(1);
    expect(stamped.activeScene?.chronicleChapter?.sessionId).toBe('run:session:1');
    expect(stamped.journal?.find((entry) => entry.id === 'legacy')?.chronicleChapter).toBeUndefined();
    expect(stamped.journal?.find((entry) => entry.sceneData)?.chronicleChapter?.sessionNumber).toBe(1);
  });

  it('closes the scene without optional scene tags, is idempotent and resumes at session 2 after JSON save/load', () => {
    const anna = character('anna'); const first = begin([anna], anna);
    const closed = closeChronicleSession(first.activeCharacter, 'assistant-end');
    expect(closed.activeScene).toBeUndefined();
    expect(closed.sceneCards).toHaveLength(1);
    expect(closed.sceneCards?.[0]).toMatchObject({ startMessageId: 'user-1', endMessageId: 'assistant-end', keyTakeaways: [], chronicleChapter: { sessionNumber: 1 } });
    expect(closeChronicleSession(closed, 'assistant-end')).toBe(closed);
    const loaded = JSON.parse(JSON.stringify(closed)) as Character;
    const resumed = begin([loaded], loaded, 'user-next');
    expect(resumed.activeCharacter.chronicleSession?.sessionNumber).toBe(2);
    expect(resumed.activeCharacter.activeScene?.startMessageId).toBe('user-next');
    expect(resumed.activeCharacter.sceneCards?.[0].chronicleChapter?.sessionNumber).toBe(1);
    expect(resumed.activeCharacter.activeScene?.sceneNumber).toBe(2);
    expect(buildSceneChronicleTranscript([{ id: 'user-1', role: 'user', content: 'Rozglądam się.' }, { id: 'assistant-end', role: 'assistant', content: 'Stanisław twierdził, że list jest z doków. [KONIEC_SESJI:POTWIERDZENIE]' }], closed.sceneCards![0])).toEqual([
      { role: 'user', content: 'Rozglądam się.' }, { role: 'assistant', content: 'Stanisław twierdził, że list jest z doków.' },
    ]);
  });

  it('reload of an open session does not invent a boundary', () => {
    const anna = character('anna'); const first = begin([anna], anna);
    const loaded = JSON.parse(JSON.stringify(first.activeCharacter)) as Character;
    expect(begin([loaded], loaded, 'another-day').activeCharacter.chronicleSession?.sessionNumber).toBe(1);
  });

  it('preserves an in-progress legacy scene and its transcript anchor', () => {
    const anna = character('anna');
    anna.activeScene = { sceneNumber: 4, title: 'Dawna rozmowa', location: 'Biblioteka', startedAt: '2026-01-01', startMessageId: 'old-start', people: ['Portier'], findings: ['Baterie'], notes: ['Portier twierdził...'], isLocationExhausted: true };
    const original = JSON.parse(JSON.stringify(anna.activeScene));
    const first = begin([anna], anna);
    expect(first.activeCharacter.activeScene).toMatchObject(original);
    expect(anna.activeScene).toEqual(original);
    const closed = closeChronicleSession(first.activeCharacter, 'end');
    expect(closed.sceneCards?.[0]).toMatchObject({ startMessageId: 'old-start', people: ['Portier'], findings: ['Baterie'], keyTakeaways: ['Portier twierdził...'] });
  });

  it('does not create an empty extra scene when the ending reply already seals a scene', () => {
    const anna = character('anna'); const first = begin([anna], anna);
    const narration = 'Wychodzimy. [ZMIANA_SCENY: Doki] [KONIEC_SESJI:POTWIERDZENIE]';
    const turn = appendJournalToParty(first.characters, first.activeCharacter, narration, 'end');
    expect(closeChronicleSession(turn.activeCharacter, 'end', narration).sceneCards).toHaveLength(1);
    const withDestination = 'Wychodzimy. [ZMIANA_SCENY: Doki] Na nabrzeżu słyszymy dzwon. [KONIEC_SESJI:POTWIERDZENIE]';
    expect(closeChronicleSession(turn.activeCharacter, 'end', withDestination).sceneCards).toHaveLength(2);
  });

  it('retains the exact dossier edition when the player closes a known scene', () => {
    const anna = character('anna'); const first = begin([anna], anna);
    const binding = { adventureId: scope.adventureId, editionFingerprint: 'known-edition' };
    first.activeCharacter.activeScene!.dossierBinding = binding;
    expect(closeChronicleSession(first.activeCharacter, 'end').sceneCards?.[0].dossierBinding).toEqual(binding);
  });

  it('recovers the previous scene boundary for legacy closure and never summarizes the whole older chat', () => {
    const anna = character('anna');
    anna.sceneCards = [{ id: 'old-card', sceneNumber: 1, location: 'Doki', title: 'Doki', timestamp: '2026-01-01', people: [], findings: [], keyTakeaways: [], isSealed: true, endMessageId: 'old-end' }];
    anna.activeScene = { sceneNumber: 2, location: 'Biblioteka', startedAt: '2026-01-02', people: [], findings: [], notes: [] };
    const prepared = begin([anna], anna);
    const closed = closeChronicleSession(prepared.activeCharacter, 'new-end');
    const messages = [
      { id: 'old-start', role: 'assistant', content: 'Dawna rozmowa w dokach.' },
      { id: 'old-end', role: 'assistant', content: 'Kończymy dawną rozmowę. [ZMIANA_SCENY: Biblioteka] W bibliotece gasną światła.' },
      { id: 'new-end', role: 'assistant', content: 'Portier milczał. [KONIEC_SESJI:POTWIERDZENIE]' },
    ];
    expect(buildSceneChronicleTranscript(messages, closed.sceneCards![1])).toEqual([
      { role: 'assistant', content: 'W bibliotece gasną światła.' }, { role: 'assistant', content: 'Portier milczał.' },
    ]);
    const withoutHistory = { ...anna, sceneCards: [] };
    const unknownPrepared = begin([withoutHistory], withoutHistory);
    const unknown = closeChronicleSession(unknownPrepared.activeCharacter, 'new-end');
    expect(unknown.sceneCards?.[0].chronicleBoundaryKnown).toBe(false);
    expect(buildSceneChronicleTranscript(messages, unknown.sceneCards![0])).toEqual([]);
    const ordinary = appendJournalToParty(unknownPrepared.characters, unknownPrepared.activeCharacter, 'Wychodzimy. [ZMIANA_SCENY: Ulica]', 'new-end');
    expect(ordinary.activeCharacter.sceneCards?.[0].chronicleBoundaryKnown).toBe(false);
    expect(buildSceneChronicleTranscript(messages, ordinary.activeCharacter.sceneCards![0])).toEqual([]);
    expect(ordinary.activeCharacter.activeScene?.chronicleBoundaryKnown).toBe(true);
  });

  it('keeps recorded adventure boundaries and isolates another playthrough of the same scenario', () => {
    const anna = character('anna'); const first = begin([anna], anna);
    const closed = closeChronicleSession(first.activeCharacter, 'end');
    const second = begin([closed], closed, 'u2', { ...scope, adventureId: 'docks' });
    expect(second.activeCharacter.chronicleSession).toMatchObject({ adventureId: 'docks', sessionNumber: 2 });
    expect(second.activeCharacter.sceneCards?.[0].chronicleChapter?.adventureId).toBe('archive');
    const replay = begin(second.characters, second.activeCharacter, 'replay', { ...scope, playthroughId: 'other-run' });
    expect(replay.activeCharacter.chronicleSession).toMatchObject({ playthroughId: 'other-run', sessionNumber: 1 });
  });
});
