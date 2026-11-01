import type { Character, ChronicleChapter, ChronicleSession, SceneCaseCard } from '@/lib/types';
import type { CampaignMemoryScope } from '@/core/memory/types';
import { cleanResponseText } from '@/lib/parsers/text-cleaner';

/** Session identity follows confirmed session ends, never wall-clock dates or reloads. */
export function beginChronicleTurn(
  characters: Character[],
  activeCharacter: Character,
  options: {
    scope: CampaignMemoryScope;
    adventureTitle?: string;
    participantIds: string[];
    startMessageId: string;
    location?: string;
  }
): { characters: Character[]; activeCharacter: Character; changed: boolean } {
  const ids = new Set([...options.participantIds, activeCharacter.id]);
  const party = [...characters.filter((character) => ids.has(character.id))];
  if (!party.some((character) => character.id === activeCharacter.id)) party.push(activeCharacter);
  const sessions = party.flatMap((character) => character.chronicleSession?.playthroughId === options.scope.playthroughId ? [character.chronicleSession] : []);
  const latest = sessions.sort((a, b) => b.sessionNumber - a.sessionNumber || Number(Boolean(b.closedByMessageId)) - Number(Boolean(a.closedByMessageId)))[0];
  const sameAdventure = latest?.adventureId === options.scope.adventureId;
  const session: ChronicleSession = latest && !latest.closedByMessageId && sameAdventure
    ? latest
    : {
        playthroughId: options.scope.playthroughId,
        campaignDefinitionId: options.scope.campaignDefinitionId,
        adventureId: options.scope.adventureId,
        adventureTitle: options.adventureTitle?.trim() || undefined,
        sessionId: `${options.scope.playthroughId}:session:${(latest?.sessionNumber ?? 0) + 1}`,
        sessionNumber: (latest?.sessionNumber ?? 0) + 1,
      };
  let changed = false;
  const apply = (character: Character): Character => {
    if (!ids.has(character.id)) return character;
    const continuing = character.chronicleSession?.sessionId === session.sessionId && character.chronicleSession.adventureId === session.adventureId;
    const preserveActive = continuing || !character.chronicleSession;
    if (continuing && character.activeScene?.chronicleChapter?.sessionId === session.sessionId) return character;
    changed = true;
    const previous = character.sceneCards?.[character.sceneCards.length - 1];
    const startMessageId = preserveActive && character.activeScene
      ? character.activeScene.startMessageId ?? previous?.endMessageId
        ?? (previous?.id.startsWith('scene-card-') ? previous.id.replace(/^scene-card-(?:auto-)?/, '') : undefined)
      : options.startMessageId;
    return {
      ...character,
      chronicleSession: { ...session },
      activeScene: {
        ...(preserveActive ? character.activeScene : undefined),
        sceneNumber: character.activeScene?.sceneNumber ?? (character.sceneCards?.length ?? 0) + 1,
        location: (preserveActive ? character.activeScene?.location : undefined) || options.location || character.activeScene?.location || 'Aktualna lokacja',
        startedAt: (preserveActive ? character.activeScene?.startedAt : undefined) || new Date().toISOString(),
        people: preserveActive ? [...(character.activeScene?.people ?? [])] : [],
        findings: preserveActive ? [...(character.activeScene?.findings ?? [])] : [],
        notes: preserveActive ? [...(character.activeScene?.notes ?? [])] : [],
        startMessageId,
        chronicleBoundaryKnown: Boolean(startMessageId),
        chronicleChapter: { ...session },
      },
    };
  };
  const updated = characters.map(apply);
  return { characters: updated, activeCharacter: updated.find((character) => character.id === activeCharacter.id) ?? apply(activeCharacter), changed };
}

/** Stamp only newly recorded entries; legacy history is not assigned invented sessions. */
export function stampChronicleEntries(character: Character, previous: Character): Character {
  const chapter = character.chronicleSession;
  if (!chapter) return character;
  const ids = new Set((previous.journal ?? []).map((entry) => entry.id));
  return {
    ...character,
    journal: (character.journal ?? []).map((entry) => ids.has(entry.id) || entry.chronicleChapter
      ? entry : { ...entry, chronicleChapter: entry.sceneData?.chronicleChapter ?? chapter }),
  };
}

/** Persist the last scene before session autosave, including scenes without optional AI tags. */
export function closeChronicleSession(character: Character, endMessageId: string, endingNarration = ''): Character {
  const session = character.chronicleSession;
  if (!session || session.closedByMessageId) return character;
  const chapter: ChronicleChapter = {
    playthroughId: session.playthroughId, campaignDefinitionId: session.campaignDefinitionId,
    adventureId: session.adventureId, adventureTitle: session.adventureTitle,
    sessionId: session.sessionId, sessionNumber: session.sessionNumber,
  };
  const active = character.activeScene;
  const sceneCards = [...(character.sceneCards ?? [])];
  const journal = [...(character.journal ?? [])];
  const transition = /\[(?:ZMIANA_SCENY|SCENE_CHANGE):[^\]]*\]/i.exec(endingNarration);
  const destinationNarration = transition ? cleanResponseText(endingNarration.slice(transition.index + transition[0].length)) : '';
  const justOpened = active?.startMessageId === endMessageId && sceneCards.some((card) => card.endMessageId === endMessageId);
  if (active && (!justOpened || destinationNarration.length > 0)) {
    const previous = sceneCards[sceneCards.length - 1];
    const startMessageId = active.startMessageId ?? previous?.endMessageId
      ?? (previous?.id.startsWith('scene-card-') ? previous.id.replace(/^scene-card-(?:auto-)?/, '') : undefined);
    const scene: SceneCaseCard = {
      id: `scene-card-session-${endMessageId}`, sceneNumber: active.sceneNumber,
      location: active.location, title: active.title || active.location,
      inGameDate: active.inGameDate, timestamp: new Date().toISOString(),
      people: [...active.people], findings: [...active.findings], keyTakeaways: [...active.notes],
      startMessageId, chronicleBoundaryKnown: Boolean(startMessageId), endMessageId, isSealed: true, chronicleChapter: chapter,
      dossierBinding: active.dossierBinding,
    };
    if (!sceneCards.some((card) => card.id === scene.id)) {
      sceneCards.push(scene);
      journal.push({ id: `journal-${scene.id}`, timestamp: new Date(), type: 'scene',
        title: scene.title, content: '', tags: [], isBookmarked: false, sceneData: scene,
        chronicleChapter: chapter, inGameDate: scene.inGameDate });
    }
  }
  return { ...character, sceneCards, journal, activeScene: undefined, chronicleSession: { ...session, closedByMessageId: endMessageId } };
}
