import { appendJournalToParty } from '@/lib/journal/apply-journal-tags';
import {
  applyPublishedJournalVisuals,
  buildPublicJournal,
  journalCardId,
} from '@/lib/journal/public-journal';
import { PREDEFINED_CHARACTERS } from '@/lib/immersion/predefined-characters';
import type { Character, Message } from '@/lib/types';
import type { DossierRagPayload } from '@/lib/adventure-dossier/rag-schema';

/** Neutral authored fixture exercised through the same parser as accepted game turns. */
export function makePublicJournalFixture(
  locale: 'pl' | 'en',
  adventureId = 'journal-neutral'
) {
  const en = locale === 'en';
  const labels = {
    place: en ? 'City archive' : 'Archiwum miejskie',
    person: en ? 'Caretaker' : 'Dozorca',
    witness: en ? 'Neighbor' : 'Sąsiadka',
    finding: en ? 'Gate' : 'Brama',
    mention: 'Leon',
    distant: en ? 'Old mill' : 'Stary młyn',
    material: en ? 'Photograph of the gate' : 'Fotografia bramy',
    oldEvent: en ? 'Mill fire' : 'Pożar młyna',
    first: en
      ? 'The caretaker claims the gate was locked.'
      : 'Dozorca twierdzi, że brama była zamknięta.',
    second: en
      ? 'The neighbor says the gate was open.'
      : 'Sąsiadka twierdzi, że brama była otwarta.',
    photo: en
      ? 'The photograph shows a scratch on the gate.'
      : 'Fotografia pokazuje rysę na bramie.',
    photoFinding: en ? 'Scratch on the gate' : 'Rysa na bramie',
  };
  const chapter = {
    playthroughId: 'journal-run',
    campaignDefinitionId: 'journal-campaign',
    adventureId,
    adventureTitle: en ? 'The archive case' : 'Sprawa archiwum',
    sessionId: 'journal-session',
    sessionNumber: 1,
  };
  const binding = {
    adventureId: chapter.adventureId,
    editionFingerprint: `sha256:${'a'.repeat(64)}`,
  };
  const materialId = 'neutral.media.archive-photo';
  const payload: DossierRagPayload = {
    schema_version: 1,
    adventure_id: binding.adventureId,
    edition_fingerprint: binding.editionFingerprint,
    records: [
      {
        schema_version: 1,
        record_id: materialId,
        record_type: 'media',
        adventure_id: binding.adventureId,
        edition_fingerprint: binding.editionFingerprint,
        language: locale,
        content: '',
        tags: {
          entities: [],
          scenes: [],
          mechanics: [],
          topics: [],
          triggers: [],
        },
        retrieval: {
          visibility: 'player_projection',
          availability: 'after_reveal',
          condition: null,
          priority: 1,
        },
        evidence: {
          provenance: 'approved_design',
          source_ref: 'neutral fixture',
          status: 'set',
          approval: 'approved',
          approved_by: 'fixture',
          approved_at: '2026-10-24',
        },
        links: [],
        local_handout: {
          kind: 'embedded_image',
          pdf_page: 1,
          width: 200,
          height: 200,
          rgba_sha256: 'a'.repeat(64),
          title: labels.material,
          audience: 'party',
        },
      },
    ],
  };
  const character = (id: string): Character => ({
    ...PREDEFINED_CHARACTERS[0],
    id,
    name: id === 'anna' ? 'Anna' : 'Maria',
    journal: [],
    equipment: [],
    sceneCards: [],
    chronicleSession: chapter,
    investigatorDossier: {
      clues: [],
      npcs: [
        {
          id: 'prepared',
          name: 'PRIVATE_PERSON',
          relationshipStatus: 'unknown',
          avatarUrl: '/PRIVATE_PORTRAIT.webp',
          secret: 'PRIVATE_SECRET',
        },
      ],
      locations: [],
      notes: [],
    },
  });
  const placeText = en
    ? 'We are reading records in the city archive.'
    : 'Czytamy akta w archiwum miejskim.';
  const personText = en
    ? 'The caretaker works at the archive.'
    : 'Dozorca pracuje w archiwum.';
  const mentionText = en
    ? 'The caretaker mentioned Leon.'
    : 'Dozorca wspomniał o Leonie.';
  const distantText = en
    ? 'The neighbor told us about the old mill.'
    : 'Sąsiadka opowiedziała o starym młynie.';
  const eventText = en
    ? 'The newspaper describes a fire around 1900.'
    : 'Gazeta opisuje pożar około 1900 roku.';
  const firstText =
    `${placeText}\n${personText}\n${labels.first}\n${mentionText}\n${distantText}\n${eventText}\n` +
    `[LOKACJA:${labels.place}:${placeText}]` +
    `[JOURNAL:npc:${labels.person}|source_quote:${personText}]${personText}[/JOURNAL]` +
    `[JOURNAL:clue:${labels.finding}|witness:${labels.person}|source_quote:${labels.first}]${labels.first} | źródło:zeznanie[/JOURNAL]` +
    `[JOURNAL:npc:Leon|knowledge:mentioned|source_quote:${mentionText}]${mentionText}[/JOURNAL]` +
    `[JOURNAL:location:${labels.distant}|knowledge:mentioned|source_quote:${distantText}]${distantText}[/JOURNAL]` +
    `[JOURNAL:event:${labels.oldEvent}|event_date:${en ? 'around 1900' : 'około 1900'}|source_quote:${eventText}]${eventText}[/JOURNAL]` +
    '[GM_THOUGHTS][JOURNAL:clue:PRIVATE_CLUE]PRIVATE_FACT[/JOURNAL][/GM_THOUGHTS]';
  const first = appendJournalToParty(
    [character('anna'), character('maria')],
    character('anna'),
    firstText,
    'journal-source-a',
    undefined,
    [],
    { scope: chapter, binding }
  );
  const secondText =
    `${labels.second}\n${labels.photo}\n` +
    `[JOURNAL:clue:${labels.finding}|witness:${labels.witness}|source_quote:${labels.second}]${labels.second} | źródło:zeznanie[/JOURNAL]` +
    `[JOURNAL:clue:${labels.photoFinding}|source_quote:${labels.photo}|source_material_id:${materialId}]${labels.photo} | źródło:handout[/JOURNAL]`;
  const second = appendJournalToParty(
    first.characters,
    first.characters[1],
    secondText,
    'journal-source-b',
    undefined,
    [],
    { scope: chapter, binding, handoutRecordIds: [materialId], payload }
  );
  const publication = {
    cardId: journalCardId('person', labels.person),
    scope: chapter,
    binding,
    visual: { imageUrl: '/portraits/retro-svg/journalist.svg' },
  };
  const messages: Message[] = [
    {
      id: 'journal-source-a',
      role: 'assistant',
      timestamp: new Date(),
      content: firstText,
      generatedImages: [publication.visual.imageUrl],
      generatedImageTypes: ['portrait'],
      publicJournalVisuals: [publication],
    },
    {
      id: 'journal-source-b',
      role: 'assistant',
      timestamp: new Date(),
      content: secondText,
      dossierHandoutBinding: binding,
      dossierHandoutRecordIds: [materialId],
    },
  ];
  const characters = applyPublishedJournalVisuals(second.characters, [
    publication,
  ]);
  return {
    characters,
    chapter,
    binding,
    messages,
    labels,
    materialId,
    model: buildPublicJournal({
      characters,
      chapter,
      binding,
      messages,
      locale,
    }),
  };
}
