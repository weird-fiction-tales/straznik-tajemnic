import { resolveCanonicalAdventureLocation } from '@/lib/canonical-adventure-location';
import type {
  Character,
  ChronicleChapter,
  JournalEntry,
  Message,
} from '@/lib/types';
import type { ClueProvenance } from './dossier-types';
import {
  parseRevealedClue,
  parseRevealedTags,
} from '@/core/memory/revealed-facts';
import { sanitizeDiegeticProse, stripAITags } from '@/lib/parsers/text-cleaner';
import { normalizeEntityTitle } from './entity-visual-resolver';
import { isVisualPromptLeak } from '@/lib/parsers/event-parser';
import type { DossierHandoutBinding } from '@/lib/adventure-dossier/local-handouts';
import type { DossierRagPayload } from '@/lib/adventure-dossier/rag-schema';
import { resolveAuthoredPrabutyMedia } from '@/lib/adventure-dossier/authored-media';
import { resolvePreparedPublicProfile } from './prepared-public-profiles';
import { resolveNpcPublicProfile } from '@/lib/npc-public-profile';
import { extractAttributedDialogueSpans } from '@/lib/parsers/dialogue-parser';

export type JournalCardKind =
  | 'person'
  | 'place'
  | 'event'
  | 'finding'
  | 'material';
export interface JournalSource {
  messageId: string;
  excerpt: string;
  witness?: string;
  materialId?: string;
}
export interface JournalMaterial {
  recordId?: string;
  binding?: DossierHandoutBinding;
  text?: string;
  audioUrl?: string;
  imageUrl?: string;
  audioUrlEn?: string;
  audioUrlPl?: string;
}
export interface JournalVisual {
  imageUrl?: string;
  cacheKey?: string;
}
export interface JournalVisualPublication {
  cardId: string;
  scope?: PublicJournalContext['scope'];
  binding?: DossierHandoutBinding;
  visual: JournalVisual;
}
/** Public fragments are persisted in the existing journal, never reconstructed from keeper dossiers. */
export interface PublicJournalKnowledge {
  cardId: string;
  kind: JournalCardKind;
  title: string;
  text: string;
  source: JournalSource;
  scope?: Pick<ChronicleChapter, 'playthroughId' | 'adventureId'>;
  binding?: DossierHandoutBinding;
  provenance?: ClueProvenance;
  mentioned?: boolean;
  occurredAt?: string;
  learnedAt?: string;
  relatedIds: string[];
  sceneLocation?: string;
  material?: JournalMaterial;
  visual?: JournalVisual;
}
export interface PublicJournalContext {
  sceneLocation?: string;
  scope?: Pick<ChronicleChapter, 'playthroughId' | 'adventureId'>;
  binding?: DossierHandoutBinding;
  handoutRecordIds?: string[];
  knownMaterialRecordIds?: string[];
  sourceContent?: string;
  learnedAt?: string;
  payload?: DossierRagPayload;
}
export interface JournalCard {
  id: string;
  kind: JournalCardKind;
  title: string;
  paragraphs: {
    text: string;
    provenance?: ClueProvenance;
    sourceIndex: number;
  }[];
  sources: JournalSource[];
  relatedIds: string[];
  mentioned: boolean;
  occurredAt?: string;
  learnedAt?: string;
  learnedIn?: string;
  discoveredAt: number;
  updatedAt: number;
  revision: string;
  unread?: 'new' | 'updated';
  imageUrl?: string;
  imageCacheKey?: string;
  material?: JournalMaterial;
  /** Prepared, spoiler-free introduction; never an attributed quotation. */
  publicDescription?: string;
}
export interface PublicJournal {
  scopeKey: string;
  title?: string;
  cards: JournalCard[];
  scene?: {
    title: string;
    location: string;
    inGameDate?: string;
    relatedIds: string[];
  };
}
export const journalCardId = (kind: JournalCardKind, name: string) =>
  `${kind}:${normalizeEntityTitle(name)}`;
const time = (value: unknown) => {
  const n = new Date(value as string).getTime();
  return Number.isFinite(n) ? n : 0;
};
const sameBinding = (a?: DossierHandoutBinding, b?: DossierHandoutBinding) =>
  (!a && !b) ||
  Boolean(
    a &&
    b &&
    a.adventureId === b.adventureId &&
    a.editionFingerprint === b.editionFingerprint
  );
const prose = (text: string) => text.split('|')[0].trim();
const knownLocation = (name?: string) =>
  name && !['Aktualna lokacja', 'Nowa lokacja'].includes(name)
    ? name
    : undefined;

/** Publication metadata is created only when the image was attached to a visible message. */
export function applyPublishedJournalVisuals(
  characters: Character[],
  publications: JournalVisualPublication[]
): Character[] {
  let changed = false;
  const result = characters.map((character) => {
    let characterChanged = false;
    const journal = character.journal?.map((entry) => {
      const record = entry.publicKnowledge;
      if (!record || record.mentioned) return entry;
      const publication = publications.findLast(
        (publication) =>
          publication.cardId === record.cardId &&
          publication.scope?.playthroughId === record.scope?.playthroughId &&
          publication.scope?.adventureId === record.scope?.adventureId &&
          sameBinding(publication.binding, record.binding)
      );
      if (
        !publication ||
        JSON.stringify(record.visual) === JSON.stringify(publication.visual)
      )
        return entry;
      characterChanged = true;
      return {
        ...entry,
        publicKnowledge: { ...record, visual: publication.visual },
      };
    });
    if (!characterChanged) return character;
    changed = true;
    return { ...character, journal };
  });
  return changed ? result : characters;
}

function sourceFragment(visible: string, text: string): string {
  const exact = text.trim();
  if (exact && visible.includes(exact)) return exact;
  // A tag body is metadata, not proof that the player saw those words.
  return '';
}

export function capturePublicJournalTurn(
  character: Character,
  rawText: string,
  messageId: string,
  context: PublicJournalContext = {}
): Character {
  const parsed = parseRevealedTags(rawText);
  const chapter = character.chronicleSession;
  const scope =
    context.scope ??
    (chapter
      ? {
          playthroughId: chapter.playthroughId,
          adventureId: chapter.adventureId,
        }
      : undefined);
  const publicText = parseRevealedTags(
    context.sourceContent ?? rawText
  ).text.replace(
    /\[(?:DZIENNIK|JOURNAL):[^\]]*\][\s\S]*?\[\/(?:DZIENNIK|JOURNAL)\]/gi,
    ''
  );
  const excerpt = stripAITags(
    sanitizeDiegeticProse(publicText, { normalizeDialogues: false })
  );
  const journal = [...(character.journal ?? [])];
  const existing = new Set(journal.map((entry) => entry.id));
  const pending = new Map<string, PublicJournalKnowledge>();
  const ownScene = character.activeScene;
  const ownSceneCurrent =
    ownScene &&
    (!ownScene.dossierBinding ||
      sameBinding(ownScene.dossierBinding, context.binding)) &&
    (!ownScene.chronicleChapter ||
      (ownScene.chronicleChapter.playthroughId === scope?.playthroughId &&
        ownScene.chronicleChapter.adventureId === scope?.adventureId));
  const location =
    parsed.location?.name ??
    context.sceneLocation ??
    (ownSceneCurrent ? knownLocation(ownScene.location) : undefined);
  const add = (
    kind: JournalCardKind,
    title: string,
    text: string,
    extra: Partial<PublicJournalKnowledge> = {}
  ) => {
    if (
      (!title && kind !== 'material') ||
      (kind === 'place' &&
        (isVisualPromptLeak(title) || isVisualPromptLeak(text)))
    )
      return;
    const cardId = extra.cardId ?? journalCardId(kind, title);
    const key = `${cardId}\u0000${text}\u0000${extra.source?.witness ?? ''}`;
    const previous = pending.get(key);
    const record: PublicJournalKnowledge = {
      cardId,
      kind,
      title,
      text,
      source: { messageId, excerpt: sourceFragment(excerpt, text) },
      scope,
      binding: context.binding,
      sceneLocation: location,
      learnedAt: context.learnedAt ?? character.activeScene?.inGameDate,
      relatedIds:
        location && kind !== 'place' ? [journalCardId('place', location)] : [],
      ...previous,
      ...extra,
      ...(text ? { text } : {}),
    };
    record.source = {
      ...record.source,
      excerpt: extra.source?.excerpt ?? sourceFragment(excerpt, text),
    };
    pending.set(key, record);
    return record;
  };
  for (const npc of parsed.npcTags) {
    add('person', npc.name.split('|')[0].trim(), prose(npc.description), {
      mentioned: /(?:knowledge|poznanie)\s*:\s*(?:mentioned|wzmianka)/i.test(
        npc.description
      ),
    });
  }
  if (parsed.location)
    add('place', parsed.location.name, prose(parsed.location.description));
  for (const tag of parsed.journalTags) {
    const title = tag.title.split('|')[0].trim();
    const kind: JournalCardKind =
      tag.type === 'npc'
        ? 'person'
        : tag.type === 'location'
          ? 'place'
          : ['clue', 'discovery', 'note', 'bookmark'].includes(tag.type)
            ? 'finding'
            : tag.type === 'item'
              ? 'material'
              : 'event';
    const clue = parseRevealedClue(tag);
    const materialKnown =
      tag.sourceMaterialId &&
      ([
        ...(context.handoutRecordIds ?? []),
        ...(context.knownMaterialRecordIds ?? []),
      ].includes(tag.sourceMaterialId) ||
        journal.some(
          (entry) =>
            entry.publicKnowledge?.material?.recordId ===
              tag.sourceMaterialId &&
            sameBinding(entry.publicKnowledge?.binding, context.binding) &&
            entry.publicKnowledge?.scope?.playthroughId ===
              scope?.playthroughId &&
            entry.publicKnowledge?.scope?.adventureId === scope?.adventureId
        ));
    const relatedIds = [
      ...(tag.sourceNpc ? [journalCardId('person', tag.sourceNpc)] : []),
      ...(tag.foundLocation || location
        ? [journalCardId('place', tag.foundLocation || location!)]
        : []),
      ...(materialKnown ? [`material:${tag.sourceMaterialId}`] : []),
    ];
    add(kind, title, prose(tag.content), {
      provenance: clue.provenance,
      source: {
        messageId,
        excerpt: sourceFragment(excerpt, tag.sourceQuote || prose(tag.content)),
        ...(tag.sourceNpc ? { witness: tag.sourceNpc } : {}),
        ...(materialKnown ? { materialId: tag.sourceMaterialId } : {}),
      },
      relatedIds,
      mentioned: tag.knowledge === 'mentioned',
      occurredAt: tag.occurredAt,
      ...(kind === 'material'
        ? { material: { text: prose(tag.content) } }
        : {}),
    });
    const mentionSource = {
      messageId,
      excerpt: sourceFragment(excerpt, tag.sourceQuote || prose(tag.content)),
    };
    if (tag.sourceNpc)
      add('person', tag.sourceNpc, '', {
        mentioned: true,
        source: mentionSource,
      });
    if (tag.foundLocation)
      add('place', tag.foundLocation, '', {
        mentioned: true,
        source: mentionSource,
      });
  }
  if (context.binding)
    for (const recordId of new Set(context.handoutRecordIds ?? [])) {
      const media = context.payload
        ? resolveAuthoredPrabutyMedia(context.payload, recordId)
        : null;
      const local = context.payload?.records.find(
        (record) => record.record_id === recordId
      )?.local_handout;
      add('material', media?.title || local?.title || '', '', {
        cardId: `material:${recordId}`,
        material: {
          recordId,
          binding: context.binding,
          ...(media
            ? {
                imageUrl: media.image,
                text: media.textContent,
                audioUrl: media.audioUrl,
                audioUrlEn: media.audioUrlEn,
                audioUrlPl: media.audioUrlPl,
              }
            : {}),
        },
        source: { messageId, excerpt: '', materialId: recordId },
      });
    }
  for (const [index, record] of [...pending.values()].entries()) {
    const id = `public-journal:${messageId}:${record.cardId}:${index}`;
    if (existing.has(id)) continue;
    // Repeated descriptions do not become a new revision just because another turn repeats them.
    const previous = [...journal]
      .reverse()
      .find(
        (entry) =>
          entry.publicKnowledge?.cardId === record.cardId &&
          entry.publicKnowledge.scope?.playthroughId === scope?.playthroughId &&
          entry.publicKnowledge.scope?.adventureId === scope?.adventureId &&
          sameBinding(entry.publicKnowledge.binding, record.binding)
      )?.publicKnowledge;
    if (
      previous &&
      previous.text === record.text &&
      previous.mentioned === record.mentioned &&
      previous.occurredAt === record.occurredAt &&
      previous.source.witness === record.source.witness &&
      previous.source.excerpt === record.source.excerpt &&
      JSON.stringify(previous.relatedIds) === JSON.stringify(record.relatedIds)
    )
      continue;
    journal.push({
      id,
      title: '',
      content: '',
      timestamp: new Date(),
      tags: ['public-journal'],
      isBookmarked: false,
      type: 'note',
      chronicleChapter: chapter,
      publicKnowledge: record,
    });
  }
  const activeScene =
    ownScene && ownSceneCurrent && context.binding && !ownScene.dossierBinding
      ? { ...ownScene, dossierBinding: context.binding }
      : ownScene;
  const sceneCards = character.sceneCards?.map((scene) =>
    scene.endMessageId === messageId && context.binding && !scene.dossierBinding
      ? { ...scene, dossierBinding: context.binding }
      : scene
  );
  const sceneChanged = sceneCards?.some(
    (scene, index) => scene !== character.sceneCards?.[index]
  );
  return journal.length === (character.journal?.length ?? 0) &&
    activeScene === character.activeScene &&
    !sceneChanged
    ? character
    : { ...character, journal, activeScene, sceneCards };
}

export function buildPublicJournal({
  characters,
  chapter,
  binding,
  messages = [],
  locale,
}: {
  characters: Character[];
  chapter?: Pick<ChronicleChapter, 'playthroughId' | 'adventureId'>;
  binding?: DossierHandoutBinding;
  messages?: Message[];
  locale: 'pl' | 'en';
}): PublicJournal {
  const displayPlace = (reference: string) => resolveCanonicalAdventureLocation(
    chapter?.adventureId ?? binding?.adventureId ?? '', reference)?.name ?? reference;
  const scopeKey = `${chapter?.playthroughId ?? 'current'}:${chapter?.adventureId ?? binding?.adventureId ?? 'current'}:${binding?.editionFingerprint ?? ''}`;
  const rows = new Map<string, JournalEntry>();
  for (const character of characters)
    for (const entry of character.journal ?? []) {
      const record = entry.publicKnowledge;
      if (
        !record ||
        (chapter &&
          (record.scope?.playthroughId !== chapter.playthroughId ||
            record.scope.adventureId !== chapter.adventureId)) ||
        !sameBinding(record.binding, binding)
      )
        continue;
      rows.set(entry.id, entry);
    }
  const cards = new Map<string, JournalCard>();
  for (const entry of [...rows.values()].sort(
    (a, b) => time(a.timestamp) - time(b.timestamp) || a.id.localeCompare(b.id)
  )) {
    const record = entry.publicKnowledge!;
    let card = cards.get(record.cardId);
    if (!card) {
      card = {
        id: record.cardId,
        kind: record.kind,
        title: record.kind === 'place' ? displayPlace(record.title) : record.title,
        paragraphs: [],
        sources: [],
        relatedIds: [],
        mentioned: true,
        discoveredAt: time(entry.timestamp),
        updatedAt: time(entry.timestamp),
        revision: '',
        material: record.material,
      };
      cards.set(card.id, card);
    }
    card.title = record.title ? (record.kind === 'place' ? displayPlace(record.title) : record.title) : card.title;
    const sourceIndex = card.sources.findIndex(
      (source) =>
        source.messageId === record.source.messageId &&
        source.witness === record.source.witness &&
        source.excerpt === record.source.excerpt
    );
    const index =
      sourceIndex < 0 ? card.sources.push({ ...record.source }) - 1 : sourceIndex;
    if (record.text) {
      const paragraph = card.paragraphs.find(
        (p) =>
          p.text === record.text &&
          card!.sources[p.sourceIndex].witness === record.source.witness
      );
      if (!paragraph)
        card.paragraphs.push({
          text: record.text,
          provenance: record.provenance,
          sourceIndex: index,
        });
      else if (
        !card.sources[paragraph.sourceIndex].excerpt &&
        record.source.excerpt
      )
        paragraph.sourceIndex = index;
    }
    card.relatedIds = [
      ...new Set([...card.relatedIds, ...record.relatedIds]),
    ].filter((id) => id !== card!.id);
    card.mentioned = card.mentioned && Boolean(record.mentioned);
    card.occurredAt = record.occurredAt ?? card.occurredAt;
    card.learnedAt = card.learnedAt ?? record.learnedAt;
    card.learnedIn = card.learnedIn ?? (record.sceneLocation ? displayPlace(record.sceneLocation) : undefined);
    if (record.material?.imageUrl) card.imageUrl = record.material.imageUrl;
    if (record.visual && !record.mentioned) {
      card.imageUrl = record.visual.imageUrl;
      card.imageCacheKey = record.visual.cacheKey;
    }
    if (record.material)
      card.material = {
        ...record.material,
        audioUrl:
          (locale === 'en'
            ? record.material.audioUrlEn
            : record.material.audioUrlPl) || record.material.audioUrl,
      };
    card.updatedAt = Math.max(card.updatedAt, time(entry.timestamp));
    card.revision += `${entry.id}:${JSON.stringify(record.visual ?? '')};`;
  }
  const readStates = Object.assign(
    {},
    ...characters.map(
      (character) => character.journalReadState?.[scopeKey] ?? {}
    )
  ) as Record<string, { revision: string; readAt: number }>;
  // Read acknowledgements follow the latest user action, independently of the active investigator.
  for (const character of characters)
    for (const [id, state] of Object.entries(
      character.journalReadState?.[scopeKey] ?? {}
    )) {
      if (!readStates[id] || state.readAt > readStates[id].readAt)
        readStates[id] = state;
    }
  for (const card of cards.values()) {
    const read = readStates[card.id];
    if (read?.revision !== card.revision)
      card.unread = read ? 'updated' : 'new';
    card.relatedIds = card.relatedIds.filter((id) => cards.has(id));
    // Historical illustrations remain available, independently of the prepared public introduction.
    for (const source of card.sources) {
      const message = messages.find(
        (message) =>
          message.role === 'assistant' && message.id === source.messageId
      );
      const illustration = message?.illustrations?.find(
        (image) =>
          normalizeEntityTitle(image.element.name) ===
            normalizeEntityTitle(card.title) &&
          (card.kind === 'person'
            ? image.element.type === 'character'
            : card.kind === 'place'
              ? image.element.type === 'location'
              : image.element.type === 'item')
      );
      if (illustration?.imageUrl && !card.mentioned)
        card.imageUrl = illustration.imageUrl;
      if (message && card.kind === 'person' && sameBinding(message.dossierHandoutBinding, binding)) {
        const adventureId = chapter?.adventureId ?? binding?.adventureId;
        const profile = resolveNpcPublicProfile(adventureId, card.title, locale);
        const visible = stripAITags(sanitizeDiegeticProse(parseRevealedTags(message.content).text, { normalizeDialogues: false }));
        const spoken = extractAttributedDialogueSpans(visible).find(span => {
          const speaker = resolveNpcPublicProfile(adventureId, span.speaker, locale);
          const sameSpeaker = profile ? speaker?.id === profile.id : normalizeEntityTitle(span.speaker) === normalizeEntityTitle(card.title);
          return sameSpeaker && Boolean(source.excerpt) && visible.slice(span.start, span.end).startsWith(source.excerpt);
        });
        if (spoken) {
          const quotation = visible.slice(spoken.start, spoken.end);
          // Older saves may contain a prefix truncated at “dr.”. Only the same
          // accepted source message can restore its missing words.
          if (source.excerpt && quotation.startsWith(source.excerpt)) {
            for (const paragraph of card.paragraphs) {
              if (card.sources[paragraph.sourceIndex] === source && quotation.startsWith(paragraph.text))
                paragraph.text = quotation;
            }
            source.excerpt = quotation;
            source.witness ??= profile?.name ?? spoken.speaker;
          }
        }
      }
    }
    if (!card.mentioned && (card.kind === 'person' || card.kind === 'place')) {
      const prepared = resolvePreparedPublicProfile(chapter?.adventureId ?? binding?.adventureId, card.kind, card.title, locale);
      if (prepared) {
        card.publicDescription = prepared.description;
        if (!card.imageUrl && !card.imageCacheKey) card.imageUrl = prepared.imageUrl;
      }
    }
  }
  const activeScenes = characters.flatMap((character) =>
    character.activeScene &&
    knownLocation(character.activeScene.location) &&
    sameBinding(character.activeScene.dossierBinding, binding) &&
    (!chapter ||
      (character.activeScene.chronicleChapter?.playthroughId ===
        chapter.playthroughId &&
        character.activeScene.chronicleChapter.adventureId ===
          chapter.adventureId))
      ? [character.activeScene]
      : []
  );
  const recordedLocation = [...rows.values()]
    .sort((a, b) => time(b.timestamp) - time(a.timestamp))
    .find((entry) => knownLocation(entry.publicKnowledge?.sceneLocation))
    ?.publicKnowledge?.sceneLocation;
  const active =
    activeScenes.sort(
      (a, b) =>
        time(b.startedAt) - time(a.startedAt) || b.sceneNumber - a.sceneNumber
    )[0] ??
    (recordedLocation
      ? {
          location: recordedLocation,
          title: recordedLocation,
          inGameDate: undefined,
        }
      : undefined);
  // Sealed summaries already contain player-facing narration; the dossier's nextStep and secrets are never consulted.
  for (const character of characters)
    for (const scene of character.sceneCards ?? []) {
      if (
        !scene.isSealed ||
        !sameBinding(scene.dossierBinding, binding) ||
        !scene.chronicleSummaryByLocale?.[locale] ||
        (chapter &&
          (scene.chronicleChapter?.playthroughId !== chapter.playthroughId ||
            scene.chronicleChapter.adventureId !== chapter.adventureId))
      )
        continue;
      const id = `event:scene:${scene.id}`;
      if (!cards.has(id))
        cards.set(id, {
          id,
          kind: 'event',
          title: scene.title || scene.location,
          paragraphs: [
            { text: scene.chronicleSummaryByLocale[locale]!, sourceIndex: 0 },
          ],
          sources: scene.endMessageId
            ? [{ messageId: scene.endMessageId, excerpt: '' }]
            : [],
          relatedIds: cards.has(journalCardId('place', scene.location))
            ? [journalCardId('place', scene.location)]
            : [],
          mentioned: false,
          occurredAt: scene.inGameDate,
          learnedAt: scene.inGameDate,
          learnedIn: displayPlace(scene.location),
          discoveredAt: time(scene.timestamp),
          updatedAt: time(scene.timestamp),
          revision: JSON.stringify(scene.chronicleSummaryByLocale),
          unread:
            readStates[id]?.revision ===
            JSON.stringify(scene.chronicleSummaryByLocale)
              ? undefined
              : readStates[id]
                ? 'updated'
                : 'new',
        });
    }
  // Relations are navigable both ways, including sealed events, and only between public cards.
  for (const card of cards.values())
    for (const relatedId of [...card.relatedIds]) {
      const related = cards.get(relatedId);
      if (related && !related.relatedIds.includes(card.id))
        related.relatedIds.push(card.id);
    }
  const scenePlaceId = active && journalCardId('place', active.location);
  return {
    scopeKey,
    title: characters.find(
      (character) =>
        character.chronicleSession?.adventureId === chapter?.adventureId
    )?.chronicleSession?.adventureTitle,
    cards: [...cards.values()].sort(
      (a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id)
    ),
    ...(active
      ? {
          scene: {
            title: displayPlace(active.title || active.location),
            location: active.location,
            inGameDate: active.inGameDate,
            relatedIds: [...cards.values()]
              .filter(
                (card) =>
                  card.id === scenePlaceId ||
                  card.relatedIds.includes(scenePlaceId!)
              )
              .map((card) => card.id),
          },
        }
      : {}),
  };
}

export function markJournalCardRead(
  character: Character,
  scopeKey: string,
  card: JournalCard
): Character {
  return {
    ...character,
    journalReadState: {
      ...character.journalReadState,
      [scopeKey]: {
        ...character.journalReadState?.[scopeKey],
        [card.id]: { revision: card.revision, readAt: Date.now() },
      },
    },
  };
}

/** Loading a save forks its run. Move only that run's public history and read acknowledgements. */
export function restorePublicJournalScope(
  characters: Character[],
  from: PublicJournalContext['scope'],
  to: NonNullable<PublicJournalContext['scope']>
): Character[] {
  if (
    !from ||
    (from.playthroughId === to.playthroughId &&
      from.adventureId === to.adventureId)
  )
    return characters;
  const rebind = <T extends { playthroughId: string; adventureId: string }>(
    scope?: T
  ): T | undefined =>
    scope?.playthroughId === from.playthroughId &&
    scope.adventureId === from.adventureId
      ? {
          ...scope,
          playthroughId: to.playthroughId,
          adventureId: to.adventureId,
        }
      : scope;
  const oldPrefix = `${from.playthroughId}:${from.adventureId}:`;
  const newPrefix = `${to.playthroughId}:${to.adventureId}:`;
  return characters.map((character) => ({
    ...character,
    chronicleSession: rebind(character.chronicleSession),
    activeScene: character.activeScene && {
      ...character.activeScene,
      chronicleChapter: rebind(character.activeScene.chronicleChapter),
    },
    sceneCards: character.sceneCards?.map((scene) => ({
      ...scene,
      chronicleChapter: rebind(scene.chronicleChapter),
    })),
    journal: character.journal?.map((entry) => ({
      ...entry,
      chronicleChapter: rebind(entry.chronicleChapter),
      ...(entry.sceneData
        ? {
            sceneData: {
              ...entry.sceneData,
              chronicleChapter: rebind(entry.sceneData.chronicleChapter),
            },
          }
        : {}),
      ...(entry.publicKnowledge
        ? {
            publicKnowledge: {
              ...entry.publicKnowledge,
              scope: rebind(entry.publicKnowledge.scope),
            },
          }
        : {}),
    })),
    journalReadState:
      character.journalReadState &&
      Object.fromEntries(
        Object.entries(character.journalReadState).map(([key, state]) => [
          key.startsWith(oldPrefix)
            ? newPrefix + key.slice(oldPrefix.length)
            : key,
          state,
        ])
      ),
  }));
}
