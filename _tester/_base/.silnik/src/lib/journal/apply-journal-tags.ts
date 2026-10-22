import type { Character, JournalEntry, EquipmentItem, EquipmentCategory, SceneCaseCard, ActiveSceneState, ActReport } from '@/lib/types';
import type { JournalTagEntry } from '@/lib/parsers/types';
import { parseRevealedTags,parseRevealedClue,findReplacedClue,resolveRevealedRecipient,revealedEntityId } from '@/core/memory/revealed-facts';
import {
  synthesizeClueFact,
  parseClueProvenance,
  inferClueProvenance,
  extractSceneChangeTag,
  extractSceneCardTag,
  extractLocationExhaustedTag,
  extractActReportTag,
  ExtractedNpcTag,
  ExtractedItemTag,
  ExtractedSceneChange,
  ExtractedSceneCard,
} from '@/lib/parsers/journal-parser';
import {
  extractLatestTagLocation,
  isVisualPromptLeak,
  sanitizeLocationName,
} from '@/lib/parsers/event-parser';
import { normalizeEntityTitle } from '@/lib/journal/entity-visual-resolver';
import { cleanResponseText } from '@/lib/parsers/text-cleaner';
import {
  ensureCharacterDossier,
  inferClueCategory,
} from '@/lib/journal/dossier-migration';

import {
  linkClueNpcLocation,
  type InvestigatorDossier,
  type NpcDossierEntry,
  type NpcRelationshipStatus,
  type ClueEntry,
  type ClueAcquisitionCause,
  type ClueProvenance,
  type LocationDossierEntry,
  normalizeClueType,
} from '@/lib/journal/dossier-types';

/**
 * Normalizuje i ekstrahuje nastawienie / status relacji NPC.
 * Obsługuje formaty:
 * - [NPC: Janusz Nowak | podejrzliwy]
 * - [NPC: Janusz Nowak | nastawienie=podejrzliwy]
 * - [NPC: Janusz Nowak | disposition: suspicious]
 * - [RELACJA: Janusz Nowak | wrogi]
 */
export function isPureDispositionToken(raw?: string): boolean {
  if (!raw) return false;
  const s = raw.toLowerCase().trim();
  // Usuń opcjonalny prefiks klucza: "disposition:", "nastawienie=", "relacja:", "relationship:"
  const stripped = s
    .replace(/^(?:disposition|nastawienie|relacja|relationship)\s*[:=-]\s*['"]?/i, '')
    .replace(/['"]?\s*$/, '')
    .trim();
  // Usuń końcowe znaki interpunkcyjne
  const clean = stripped.replace(/[.;!]+$/, '').trim();
  const purePattern =
    /^(?:friendly|przyjazn[yaeie]|pomocn[yaeie]|zaufan[yaeie]|hostile|wrog[iaeo]|agresywn[yaeie]|nieprzyjazn[yaeie]|suspicious|podejrzliw[yaeie]|nieufn[yaeie]|ostrożn[yaeie]|ostrozn[yaeie]|fanatical|fanatyczn[yaeie]|obłąkan[yaeie]|oblakan[yaeie]|oddany_kultu|neutral|neutraln[yaeie]|obojętn[yaeie]|obojetn[yaeie]|deceased|martw[yae]|nieżyw[yae]|niezyw[yae]|zmarł[yae]|zmarl[yae])$/i;
  return purePattern.test(clean);
}

export function parseNpcDisposition(
  raw: string
): {
  disposition?: 'friendly' | 'neutral' | 'suspicious' | 'hostile' | 'fanatical';
  relationshipStatus?: NpcRelationshipStatus;
} | null {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();

  // Sprawdź czy są tokeny klucz-wartość, np. disposition=suspicious, relacja=wroga, nastawienie: przyjazny
  const kvMatch = s.match(/(?:disposition|nastawienie|relacja|relationship)\s*[:=-]\s*['"]?([a-ząćęłńóśźż_\s]+?)['"]?(?:[;,|\]]|$)/i);
  const targetStr = kvMatch ? kvMatch[1].trim() : s;

  if (/\b(friendly|przyjazn[yaeie]|pomocn[yaeie]|zaufan[yaeie])\b/.test(targetStr)) {
    return { disposition: 'friendly', relationshipStatus: 'friendly' };
  }
  if (/\b(hostile|wrog[iaeo]|agresywn[yaeie]|nieprzyjazn[yaeie])\b/.test(targetStr)) {
    return { disposition: 'hostile', relationshipStatus: 'hostile' };
  }
  if (/\b(suspicious|podejrzliw[yaeie]|nieufn[yaeie]|ostrożn[yaeie]|ostrozn[yaeie])\b/.test(targetStr)) {
    return { disposition: 'suspicious', relationshipStatus: 'suspicious' };
  }
  if (/\b(fanatical|fanatyczn[yaeie]|obłąkan[yaeie]|oblakan[yaeie]|oddany_kultu)\b/.test(targetStr)) {
    return { disposition: 'fanatical', relationshipStatus: 'fanatical' };
  }
  if (/\b(neutral|neutraln[yaeie]|obojętn[yaeie]|obojetn[yaeie])\b/.test(targetStr)) {
    return { disposition: 'neutral', relationshipStatus: 'neutral' };
  }
  if (/\b(deceased|martw[yae]|nieżyw[yae]|niezyw[yae]|zmarł[yae]|zmarl[yae])\b/.test(targetStr)) {
    return { relationshipStatus: 'deceased' };
  }

  // Sprawdź w całym tekście jeśli kvMatch nic nie dało
  if (kvMatch) {
    if (/\b(friendly|przyjazn[yaeie]|pomocn[yaeie]|zaufan[yaeie])\b/.test(s)) {
      return { disposition: 'friendly', relationshipStatus: 'friendly' };
    }
    if (/\b(hostile|wrog[iaeo]|agresywn[yaeie]|nieprzyjazn[yaeie])\b/.test(s)) {
      return { disposition: 'hostile', relationshipStatus: 'hostile' };
    }
    if (/\b(suspicious|podejrzliw[yaeie]|nieufn[yaeie]|ostrożn[yaeie]|ostrozn[yaeie])\b/.test(s)) {
      return { disposition: 'suspicious', relationshipStatus: 'suspicious' };
    }
    if (/\b(fanatical|fanatyczn[yaeie]|obłąkan[yaeie]|oblakan[yaeie]|oddany_kultu)\b/.test(s)) {
      return { disposition: 'fanatical', relationshipStatus: 'fanatical' };
    }
    if (/\b(neutral|neutraln[yaeie]|obojętn[yaeie]|obojetn[yaeie])\b/.test(s)) {
      return { disposition: 'neutral', relationshipStatus: 'neutral' };
    }
    if (/\b(deceased|martw[yae]|nieżyw[yae]|niezyw[yae]|zmarł[yae]|zmarl[yae])\b/.test(s)) {
      return { relationshipStatus: 'deceased' };
    }
  }

  return null;
}

/**
 * Ekstrahuje niestandardowe tagi NPC i relacji z tekstu (np. z formatu z kreską pionową | lub [RELACJA: ...]).
 */
export function extractExtraNpcTags(rawText: string): ExtractedNpcTag[] {
  const extra: ExtractedNpcTag[] = [];

  // 1. Tagi [NPC: Imię | Opis] z pionową kreską
  const pipeNpcPattern = /\[NPC:(?:@([^:|\]\n]+?):)?\s*([^:|\]\n]+)\s*\|\s*([^\]]+)\]/gi;
  let pMatch: RegExpExecArray | null;
  while ((pMatch = pipeNpcPattern.exec(rawText)) !== null) {
    const who = pMatch[1]?.trim();
    const name = pMatch[2].trim();
    const description = pMatch[3].trim();
    if (name && description) {
      extra.push({ name, description, who });
    }
  }

  // 2. Tagi relacji i nastawienia np. [RELACJA: Janusz Nowak | podejrzliwy] lub [RELACJA: Janusz Nowak - wrogi]
  // Separator myślnikowy wymaga spacji (np. " - " lub " – "), by nie dzielić nazwisk z łącznikiem (np. "Jean-Paul", "Skłodowska-Curie").
  const dispPattern =
    /\[(?:DISPOSITION|NASTAWIENIE|RELACJA|RELATIONSHIP):\s*(?:@([^:|\]\n]+?):)?\s*([^|:\]\n]+?)\s*(?:[|:]|\s+[\-–—]\s*|\s*[\-–—]\s+)\s*([^\]]+)\]/gi;
  let dMatch: RegExpExecArray | null;
  while ((dMatch = dispPattern.exec(rawText)) !== null) {
    const who = dMatch[1]?.trim();
    const name = dMatch[2].trim();
    const description = dMatch[3].trim();
    if (name && description) {
      extra.push({ name, description, who });
    }
  }

  return extra;
}

/**
 * Normalizuje kategorię przedmiotu z języka polskiego lub angielskiego do EquipmentCategory.
 */
export function normalizeEquipmentCategory(rawCategory?: string, isHandout?: boolean): EquipmentCategory {
  if (!rawCategory && isHandout) return 'document';
  if (!rawCategory) return 'personal';
  const c = rawCategory.toLowerCase().trim();
  if (['dokument', 'document', 'list', 'letter', 'pismo', 'bilet', 'ticket', 'newspaper', 'gazeta'].includes(c)) return 'document';
  if (['bron', 'broń', 'weapon', 'pistolet', 'gun', 'knife', 'nóż', 'noz'].includes(c)) return 'weapon';
  if (['narzedzie', 'narzędzie', 'tool', 'narzedzia', 'narzędzia'].includes(c)) return 'tool';
  if (['artefakt', 'artifact', 'amulet', 'relic'].includes(c)) return 'artifact';
  if (['ochrona', 'pancerz', 'armor'].includes(c)) return 'armor';
  if (['medycyna', 'medyczny', 'medical', 'apteczka', 'first_aid'].includes(c)) return 'medical';
  if (['okultyzm', 'okultystyczny', 'occult'].includes(c)) return 'occult';
  if (['fabularny', 'fabularne', 'story', 'dowód', 'dowod', 'poszlaka'].includes(c)) return 'story';
  if (['personal', 'osobisty', 'osobiste'].includes(c)) return 'personal';
  return isHandout ? 'document' : 'personal';
}

/**
 * Most między parserem tagów MG a dziennikiem postaci i aktami śledczymi (Investigator Dossier).
 *
 * Issue #68: Dwukierunkowa pętla pamięci.
 * 1. Gdy MG opisuje NPC -> tworzy lub aktualizuje kartę w dossier (zamiast dodawać kolejny powtarzający się wpis kroniki).
 * 2. Gdy badacz odkrywa poszlakę -> syntetyzuje precyzyjny 1-zdaniowy fakt do dossier i dziennika.
 *
 * Typ `JournalEntry`:
 *  - `@/lib/types`            → `character.journal` (modal sesji, useSceneSummary)  ← SSOT
 */

/**
 * Mapuje tagi [DZIENNIK:typ:tytuł] na wpisy `character.journal`. Id jest deterministyczne
 * (`messageId` + index), więc dopisywanie jest idempotentne: ponowne przetworzenie tej samej
 * wiadomości nie tworzy duplikatów.
 */
export function buildJournalEntriesFromTags(
  tags: JournalTagEntry[],
  messageId: string
): JournalEntry[] {
  return tags.map((tag, index) => {
    const isClue = tag.type === 'clue' || tag.type === 'discovery';
    let cleanTitle = tag.title.trim();
    if (isClue && cleanTitle.includes('|')) {
      cleanTitle = cleanTitle.split('|')[0].trim();
    }
    const content = isClue
      ? synthesizeClueFact(cleanTitle, tag.content)
      : tag.content;

    return {
      id: `journal-${messageId}-${index}`,
      timestamp: new Date(),
      inGameDate: tag.inGameDate,
      type: tag.type,
      title: cleanTitle,
      content,
      tags: [],
      isBookmarked: false,
    };
  });
}

/**
 * IND-267: most `[LOKACJA: Nazwa: opis]` → wpis dziennika typu `location`.
 */
export function buildLocationEntryFromText(
  rawText: string,
  messageId: string
): JournalEntry | null {
  const location = extractLatestTagLocation(rawText);
  if (!location) return null;

  return {
    id: `location-${messageId}`,
    timestamp: new Date(),
    type: 'location',
    title: location.name,
    content: location.description,
    tags: [],
    isBookmarked: false,
  };
}

/**
 * Aktualizuje akta śledcze (dossier) oraz dziennik pojedynczej postaci na podstawie
 * tagów z tury narracji MG.
 */
export function processCharacterJournalAndDossier(
  character: Character,
  tags: JournalTagEntry[],
  npcTags: ExtractedNpcTag[],
  locationEntry: JournalEntry | null,
  messageId: string,
  itemTags: ExtractedItemTag[] = [],
  sceneChange: ExtractedSceneChange | null = null,
  sceneCard: ExtractedSceneCard | null = null,
  sharedLocationName?: string,
  locationExhausted?: { locationName?: string } | null,
  actReport?: ActReport | null,
  clueAcquisitionCause?: ClueAcquisitionCause,
  allowedDossierRecordIds: string[] = []
): { character: Character; changed: boolean } {
  const charWithDossier = ensureCharacterDossier(character);
  const dossier: InvestigatorDossier = {
    ...charWithDossier.investigatorDossier,
    clues: [...charWithDossier.investigatorDossier.clues],
    npcs: [...charWithDossier.investigatorDossier.npcs],
    locations: [...charWithDossier.investigatorDossier.locations],
    notes: [...charWithDossier.investigatorDossier.notes],
  };
  const allowedDossierRecordIdSet = new Set(
    allowedDossierRecordIds.map((id) => id.trim()).filter(Boolean),
  );

  const existingJournal = [...(charWithDossier.journal ?? [])];
  const existingJournalIds = new Set(existingJournal.map((e) => e.id));
  const existingEquipment: EquipmentItem[] = [...(charWithDossier.equipment ?? [])];
  const existingSceneCards: SceneCaseCard[] = [...(charWithDossier.sceneCards ?? [])];
  const existingActReports: ActReport[] = [...(charWithDossier.actReports ?? [])];

  const currentLocName = locationEntry ? locationEntry.title : (sharedLocationName || 'Aktualna lokacja');

  let activeScene: ActiveSceneState = charWithDossier.activeScene
    ? {
        ...charWithDossier.activeScene,
        location:
          charWithDossier.activeScene.location === 'Aktualna lokacja' && (locationEntry?.title || sharedLocationName)
            ? (locationEntry?.title || sharedLocationName!)
            : charWithDossier.activeScene.location,
        people: [...(charWithDossier.activeScene.people || [])],
        findings: [...(charWithDossier.activeScene.findings || [])],
        notes: [...(charWithDossier.activeScene.notes || [])],
        isLocationExhausted: charWithDossier.activeScene.isLocationExhausted || false,
      }
    : {
        sceneNumber: existingSceneCards.length + 1,
        location: currentLocName,
        startedAt: new Date().toISOString(),
        people: [],
        findings: [],
        notes: [],
        isLocationExhausted: false,
      };

  let changed = false;
  let sceneSealedThisMessage = false;
  const previousCard = existingSceneCards[existingSceneCards.length - 1];
  const chronicleStartMessageId = activeScene.startMessageId
    ?? previousCard?.endMessageId
    ?? previousCard?.id.replace(/^scene-card-(?:auto-)?/, '');

  // Bramkowanie lokacji (anty-pixel-hunting) - oznaczenie w aktywnej scenie i dossier
  if (locationExhausted) {
    activeScene.isLocationExhausted = true;
    const targetLocName = locationExhausted.locationName || activeScene.location;
    if (targetLocName && targetLocName !== 'Aktualna lokacja') {
      const locIdx = dossier.locations.findIndex(
        (l) => l.name.toLowerCase() === targetLocName.toLowerCase()
      );
      if (locIdx >= 0) {
        dossier.locations[locIdx] = {
          ...dossier.locations[locIdx],
          searchStatus: 'thoroughly_searched',
        };
      } else {
        dossier.locations.push({
          id: `loc-${messageId}`,
          name: targetLocName,
          searchStatus: 'thoroughly_searched',
          timestamp: Date.now(),
        });
      }
    }
    changed = true;
  }

  // Automatyczne pieczętowanie poprzedniej sceny przy zmianie lokacji (Issue #471)
  const prevLocation = activeScene.location?.trim();
  const isLocationChange = Boolean(
    locationEntry &&
    prevLocation &&
    prevLocation !== '' &&
    prevLocation !== 'Aktualna lokacja' &&
    locationEntry.title.trim().toLowerCase() !== prevLocation.toLowerCase()
  );

  if (isLocationChange) {
    const cardId = sceneCard ? `scene-card-${messageId}` : `scene-card-auto-${messageId}`;
    if (!existingSceneCards.some((sc) => sc.id === cardId)) {
      const cardTitle =
        sceneCard?.title || activeScene.title || activeScene.location || `Scena ${activeScene.sceneNumber}`;
      const sealedTakeaways =
        sceneCard?.keyTakeaways && sceneCard.keyTakeaways.length > 0
          ? sceneCard.keyTakeaways
          : activeScene.notes.length > 0
            ? activeScene.notes
            : ['Zbadano lokację i zabezpieczono zebrane poszlaki.'];

      const sealedPeople =
        sceneCard?.people && sceneCard.people.length > 0
          ? sceneCard.people
          : activeScene.people;

      const sealedFindings =
        sceneCard?.findings && sceneCard.findings.length > 0
          ? sceneCard.findings
          : activeScene.findings;

      const nextStep =
        sceneCard?.nextStep ||
        (sceneChange?.newLocation
          ? `Udać się do: ${sceneChange.newLocation}`
          : `Udać się do: ${locationEntry!.title}`);

      const sealedCard: SceneCaseCard = {
        chronicleChapter: activeScene.chronicleChapter,
        chronicleBoundaryKnown: activeScene.chronicleBoundaryKnown,
        id: cardId,
        sceneNumber: activeScene.sceneNumber,
        location: activeScene.location,
        title: cardTitle,
        inGameDate: sceneCard?.inGameDate || activeScene.inGameDate || charWithDossier.activeScene?.inGameDate,
        timestamp: new Date().toISOString(),
        people: [...sealedPeople],
        startMessageId: chronicleStartMessageId,
        endMessageId: messageId,
        findings: [...sealedFindings],
        keyTakeaways: [...sealedTakeaways],
        nextStep,
        isSealed: true,
        isLocationExhausted: activeScene.isLocationExhausted || false,
      };

      existingSceneCards.push(sealedCard);

      const journalSceneId = `journal-scene-${messageId}`;
      if (!existingJournalIds.has(journalSceneId)) {
        existingJournal.push({
          id: journalSceneId,
          timestamp: new Date(),
          inGameDate: sealedCard.inGameDate,
          type: 'scene',
          title:
            sceneCard?.title ||
            (isVisualPromptLeak(sealedCard.location)
              ? `Scena #${sealedCard.sceneNumber}`
              : `Scena #${sealedCard.sceneNumber}: ${sanitizeLocationName(sealedCard.location)}`),
          content: sealedCard.keyTakeaways.join('\n'),
          tags: ['scena', 'akta-sprawy'],
          isBookmarked: false,
          sceneData: sealedCard,
        });
        existingJournalIds.add(journalSceneId);
      }

      activeScene = {
        chronicleChapter: activeScene.chronicleChapter,
        chronicleBoundaryKnown: true,
        sceneNumber: sealedCard.sceneNumber + 1,
        location: sanitizeLocationName(locationEntry!.title),
        startedAt: new Date().toISOString(),
        inGameDate: locationEntry!.inGameDate || activeScene.inGameDate,
        startMessageId: messageId,
        people: [],
        findings: [],
        notes: [],
        isLocationExhausted: false,
      };
      changed = true;
      sceneSealedThisMessage = true;
    }
  }

  // Obsługa Raportu Aktu / Mini-podsumowania etapowego (Mechanika 8 / Issue #481)
  if (actReport) {
    const reportJournalId = `act-report-${messageId}-${actReport.actNumber}`;
    if (!existingJournalIds.has(reportJournalId)) {
      existingJournal.push({
        id: reportJournalId,
        timestamp: new Date(),
        inGameDate: actReport.inGameDate,
        type: 'act_report',
        title: actReport.title || `Akt #${actReport.actNumber}`,
        content: actReport.leadHypothesis || actReport.confirmedFacts.join('\n'),
        tags: ['act_report', `akt_${actReport.actNumber}`],
        isBookmarked: true,
        actReportData: actReport,
      });
      existingJournalIds.add(reportJournalId);
      changed = true;
    }

    const reportIdx = existingActReports.findIndex((r) => r.actNumber === actReport.actNumber);
    if (reportIdx >= 0) {
      existingActReports[reportIdx] = actReport;
    } else {
      existingActReports.push(actReport);
    }
    existingActReports.sort((a, b) => a.actNumber - b.actNumber);
    changed = true;
  }

  // 1. Obsługa NPC (zarówno z [NPC: Imię: opis], jak i [DZIENNIK:npc:Imię])
  const combinedNpcs = [...npcTags];
  for (const t of tags) {
    if (t.type === 'npc' && t.title && t.content) {
      if (!combinedNpcs.some((n) => n.name.toLowerCase().trim() === t.title.toLowerCase().trim())) {
        combinedNpcs.push({
          name: t.title.trim(),
          description: t.content.trim(),
          who: t.who,
        });
      }
    }
  }

  for (const npc of combinedNpcs) {
    if (!npc || typeof npc.name !== 'string') continue;
    const normName = npc.name.trim();
    if (!normName) continue;
    const lowerName = normName.toLowerCase();

    if (!activeScene.people.includes(normName)) {
      activeScene.people.push(normName);
      changed = true;
    }

    const existingNpcIndex = dossier.npcs.findIndex(
      (n) => n.name.toLowerCase().trim() === lowerName
    );

    const parsedDisp = parseNpcDisposition(npc.description);

    if (existingNpcIndex >= 0) {
      // NPC już istnieje: AKTUALIZUJEMY kartę w dossier bez tworzenia kolejnego wpisu w kronice
      const existing = dossier.npcs[existingNpcIndex];
      let npcUpdated = false;

      // Aktualizacja nastawienia/relacji z tagu
      if (parsedDisp?.disposition && existing.disposition !== parsedDisp.disposition) {
        existing.disposition = parsedDisp.disposition;
        npcUpdated = true;
      }
      const targetRel = parsedDisp?.relationshipStatus || (parsedDisp?.disposition as NpcRelationshipStatus);
      if (targetRel && existing.relationshipStatus !== targetRel) {
        existing.relationshipStatus = targetRel;
        npcUpdated = true;
      }

      const pureDisp = isPureDispositionToken(npc.description);
      if (!existing.firstImpression && npc.description && !pureDisp) {
        existing.firstImpression = npc.description;
        npcUpdated = true;
      } else if (npc.description && !pureDisp) {
        // Dołącz nową informację, jeśli nie jest duplikatem ani czystym tokenem nastawienia
        const snippet = npc.description.slice(0, 30).toLowerCase();
        const currentKeyInfo = existing.keyInformation || '';
        if (!currentKeyInfo.toLowerCase().includes(snippet)) {
          existing.keyInformation = currentKeyInfo
            ? `${currentKeyInfo}; ${npc.description}`
            : npc.description;
          npcUpdated = true;
        }
      }

      if (locationEntry && !existing.location) {
        existing.location = locationEntry.title;
        existing.locationId = revealedEntityId('location', messageId, locationEntry.title);
        npcUpdated = true;
      }

      if (npcUpdated) {
        existing.timestamp = Date.now();
        dossier.npcs[existingNpcIndex] = { ...existing };
        changed = true;
      }
    } else {
      // Nowy NPC: twórz nową kartę w dossier + JEDEN wpis w kronice
      // Ekstrakcja trójwymiarowości Egriego jeśli podana w formacie [opis | ciało | status | cel]
      let firstImpression = isPureDispositionToken(npc.description) ? undefined : npc.description;
      let physiologicalDetail: string | undefined;
      let sociologicalStatus: string | undefined;
      let psychologicalAgenda: string | undefined;

      if (npc.description.includes('|')) {
        const parts = npc.description.split('|').map((p) => p.trim());
        firstImpression = isPureDispositionToken(parts[0]) ? undefined : (parts[0] || npc.description);
        if (parts.length >= 2) physiologicalDetail = parts[1];
        if (parts.length >= 3) sociologicalStatus = parts[2];
        if (parts.length >= 4) psychologicalAgenda = parts[3];
      }

      const newNpc: NpcDossierEntry = {
        id: revealedEntityId('npc', messageId, normName),
        name: normName,
        firstImpression,
        physiologicalDetail,
        sociologicalStatus,
        psychologicalAgenda,
        relationshipStatus: parsedDisp?.relationshipStatus || (parsedDisp?.disposition as NpcRelationshipStatus) || 'unknown',
        disposition: parsedDisp?.disposition,
        location: locationEntry ? locationEntry.title : undefined,
        locationId: locationEntry ? revealedEntityId('location', messageId, locationEntry.title) : undefined,
        timestamp: Date.now(),
      };
      dossier.npcs.push(newNpc);

      const jId = `journal-${messageId}-npc-${lowerName.replace(/[^a-z0-9]/g, '-')}`;
      if (!existingJournalIds.has(jId)) {
        existingJournal.push({
          id: jId,
          timestamp: new Date(),
          type: 'npc',
          title: normName,
          content: firstImpression || npc.description,
          tags: [],
          isBookmarked: false,
        });
        existingJournalIds.add(jId);
      }
      changed = true;
    }
  }

  // 1.5. Obsługa przedmiotów i handoutów (Zero-Effort Ledger & Potrójny Byt Handoutów)
  const combinedItems = [...itemTags];
  for (const t of tags) {
    if (t.type === 'item' && t.title && t.content) {
      if (!combinedItems.some((i) => i.name.toLowerCase().trim() === t.title.toLowerCase().trim())) {
        combinedItems.push({
          name: t.title.trim(),
          description: t.content.trim(),
          who: t.who,
        });
      }
    }
  }

  for (const item of combinedItems) {
    const normName = item.name.trim();
    if (!normName) continue;
    const lowerName = normName.toLowerCase();

    if (!activeScene.findings.includes(normName)) {
      activeScene.findings.push(normName);
      changed = true;
    }
    const jId = `journal-${messageId}-item-${lowerName.replace(/[^a-z0-9]/g, '-')}`;

    if (!existingJournalIds.has(jId)) {
      existingJournal.push({
        id: jId,
        timestamp: new Date(),
        type: 'item',
        title: normName,
        content: item.description,
        tags: item.category ? [item.category] : [],
        isBookmarked: false,
      });
      existingJournalIds.add(jId);
      changed = true;
    }

    // Jeśli przedmiot jest dokumentem, listem, wycinkiem, gazetą, zdjęciem, taśmą, mapą, planem lub księgą (Handout)
    // automatycznie generujemy potrójny byt: fizyczny rekwizyt w ekwipunku + czytnik + fakt w dossier!
    const isHandout =
      item.category === 'document' ||
      item.category === 'dokument' ||
      item.category === 'map' ||
      item.category === 'mapa' ||
      /dokument|list|wycinek|gazet|artykuł|pismo|fotografi|zdjęci|taśm|nagrani|książk|księg|pamiętnik|dziennik|notatk|raport|telegram|akt|akta|świadectwo|certyfikat|bilet|przepustk|map|mapa|mapy|plan|plany|szkic|blueprint|schemat|document|letter|clipping|newspaper|article|photo|tape|recording|book|tome|diary|journal|notes|report|telegram|file|certificate|pass/i.test(
        `${normName} ${item.description} ${item.category || ''}`
      );

    // 2. Fizyczny rekwizyt w ekwipunku postaci: NIE dodajemy samowolnie nowych rzeczy (Issue #565).
    // Jeśli gracz ma już ten przedmiot w torbie, jedynie uzupełniamy treść do czytania.
    const normItemTitle = normalizeEntityTitle(normName);
    const existingEqIndex = existingEquipment.findIndex(
      (eq) => normalizeEntityTitle(eq.name || '') === normItemTitle
    );

    if (existingEqIndex !== -1 && isHandout) {
      const existingEq = existingEquipment[existingEqIndex];
      if (!existingEq.readableContent && item.description) {
        existingEquipment[existingEqIndex] = {
          ...existingEq,
          isReadable: true,
          readableContent: item.description,
          readableContentStatus: 'ready',
        };
        changed = true;
      }
    }

    // 3. Syntetyczny 1-zdaniowy fakt śledczy w Dossier (Dossier Clue)
    if (isHandout && !isVisualPromptLeak(normName)) {
      const existingClue = dossier.clues.find(
        (c) => normalizeEntityTitle(c.title) === normItemTitle
      );
      const fact = synthesizeClueFact(normName, item.description);
      if (!existingClue) {
        dossier.clues.push({
          id: `clue-${messageId}-handout-${lowerName.replace(/[^a-z0-9]/g, '-')}`,
          title: normName,
          description: fact,
          category: 'document',
          status: 'confirmed',
          discoveryStatus: 'discovered',
          epistemicLayer: 'player_clue',
          provenance: 'handout',
          foundLocation: locationEntry?.title ? sanitizeLocationName(locationEntry.title) : undefined,
          foundLocationId: locationEntry ? revealedEntityId('location', messageId, locationEntry.title) : undefined,
          timestamp: Date.now(),
          sourceJournalEntryId: jId,
        });
        changed = true;
      } else {
        if (!existingClue.provenance) {
          existingClue.provenance = 'handout';
          existingClue.timestamp = Date.now();
          changed = true;
        }
        if (!existingClue.foundLocation && locationEntry) {
          existingClue.foundLocation = locationEntry.title;
          existingClue.foundLocationId = revealedEntityId('location', messageId, locationEntry.title);
          existingClue.timestamp = Date.now();
          changed = true;
        }
      }
    }
  }

  // 2. Obsługa pozostałych tagów dziennika (w tym poszlak z syntezą 1-zdaniową i wektorem M.I.C.E.)
  let failForwardCauseAssigned = false;
  tags.forEach((tag, index) => {
    // Tagi typu 'npc' oraz 'item' zostały już obsłużone powyżej
    if (tag.type === 'npc' || tag.type === 'item') return;

    const isClue = tag.type === 'clue' || tag.type === 'discovery';
    let rawContent = tag.content;
    let explicitMiceType: import('@/lib/journal/dossier-types').MiceQuotientType | undefined;
    let miceObjective: string | undefined;
    let explicitProvenance: ClueProvenance | undefined;
    let cleanClueTitle = tag.title.trim();
    let clueInGameDate = tag.inGameDate;

    // Sprawdź czy w 4. argumencie / dacie nie podano proweniencji (np. [DZIENNIK:trop:Tytuł:obserwacja])
    if (isClue && clueInGameDate) {
      const provFromDate = parseClueProvenance(clueInGameDate);
      if (provFromDate) {
        explicitProvenance = provFromDate;
        clueInGameDate = undefined;
      }
    }

    // Sprawdź czy w tytule nie podano proweniencji (np. [DZIENNIK:trop:Tytuł|zeznanie])
    if (isClue && cleanClueTitle.includes('|')) {
      const titleParts = cleanClueTitle.split('|').map((p) => p.trim());
      cleanClueTitle = titleParts[0];
      for (let i = 1; i < titleParts.length; i++) {
        const prov = parseClueProvenance(titleParts[i]);
        if (prov) explicitProvenance = prov;
      }
    }

    if (isClue && tag.content.includes('|')) {
      const parts = tag.content.split('|').map((p) => p.trim());
      rawContent = parts[0] || tag.content;

      // Iteruj po kolejnych segmentach pipe (elastyczna kolejność tokenów proweniencji i M.I.C.E.)
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;

        // 1. Sprawdź proweniencję
        const detectedProv = parseClueProvenance(part);
        if (detectedProv) {
          explicitProvenance = detectedProv;
          continue;
        }

        // 2. Sprawdź M.I.C.E.
        const pLower = part.toLowerCase();
        if (['m', 'milieu', 'otoczenie', 'przestrzen'].includes(pLower)) {
          explicitMiceType = 'milieu';
          continue;
        }
        if (['i', 'inquiry', 'sledztwo', 'pytanie'].includes(pLower)) {
          explicitMiceType = 'inquiry';
          continue;
        }
        if (['c', 'character', 'postac', 'tozsamosc'].includes(pLower)) {
          explicitMiceType = 'character';
          continue;
        }
        if (['e', 'event', 'zagrozenie', 'wydarzenie', 'zdarzenie'].includes(pLower)) {
          explicitMiceType = 'event';
          continue;
        }

        // 3. Sprawdź czy to nie unieważnienie (np. zastępuje: ...)
        if (/(?:zastępuje|unieważnia|obala|supersedes|refutes):/i.test(part)) {
          continue;
        }

        // 4. Ignoruj metadane relacji (świadek, lokacja, data, status)
        if (
          /^(?:świadek|swiadek|witness|npc|źródło_npc|zrodlo_npc)\s*:/i.test(part) ||
          /^(?:lokacja|location|miejsce|place)\s*:/i.test(part) ||
          /^(?:data|date|czas|time|status)\s*:/i.test(part)
        ) {
          continue;
        }

        // 5. Fallback na miceObjective
        if (!miceObjective) {
          miceObjective = part;
        }
      }
    }

    const fact = isClue
      ? synthesizeClueFact(cleanClueTitle, rawContent)
      : tag.content;

    if (isClue && cleanClueTitle) {
      if (!activeScene.findings.includes(cleanClueTitle.trim())) {
        activeScene.findings.push(cleanClueTitle.trim());
        changed = true;
      }
    } else if (!isClue && tag.content) {
      const trimmedContent = tag.content.trim();
      if (!activeScene.notes.includes(trimmedContent)) {
        activeScene.notes.push(trimmedContent);
        changed = true;
      }
    }

    // Aktualizuj poszlaki w dossier
    if (isClue && cleanClueTitle && !isVisualPromptLeak(cleanClueTitle)) {
      const normClueTitle = normalizeEntityTitle(cleanClueTitle);
      const existingClue = dossier.clues.find(
        (c) => normalizeEntityTitle(c.title) === normClueTitle
      );

      // Wykrywanie unieważniania starszych poszlak
      const supersedesMatch = tag.content.match(/(?:zastępuje|unieważnia|obala|supersedes|refutes):\s*([^|\n\]]+)/i);
      const supersededTarget = supersedesMatch ? supersedesMatch[1].trim().toLowerCase() : null;
      const replaced = findReplacedClue(dossier.clues,supersededTarget ?? undefined);
      if (replaced && replaced !== existingClue) {
        replaced.status = parseRevealedClue(tag).replacementStatus;
        replaced.supersededBy = existingClue?.id ?? `clue-${messageId}-${index}`;
        changed = true;
      }

      const resolvedCategory = inferClueCategory({ title: cleanClueTitle, content: rawContent });
      const resolvedProvenance =
        explicitProvenance || inferClueProvenance(cleanClueTitle, rawContent, resolvedCategory);

      // Uszczelnianie relacji: wykrywanie powiązanego NPC i Lokacji
      let sourceNpc = tag.sourceNpc;
      let sourceNpcId: string | undefined;
      let foundLocation = tag.foundLocation;
      let foundLocationId: string | undefined;

      // 1. Ustalanie źródłowego NPC
      if (!sourceNpc) {
        if (combinedNpcs.length === 1) {
          sourceNpc = combinedNpcs[0].name;
        } else if (resolvedProvenance === 'testimony' && combinedNpcs.length > 0) {
          sourceNpc = combinedNpcs[0].name;
        } else {
          const allCandidateNpcs = [
            ...combinedNpcs.map((n) => ({ name: n.name, id: revealedEntityId('npc', messageId, n.name) })),
            ...dossier.npcs,
          ];
          const textToScan = `${cleanClueTitle} ${rawContent}`.toLowerCase();
          const matchedCandidate = allCandidateNpcs.find(
            (n) => n.name && textToScan.includes(n.name.toLowerCase().trim())
          );
          if (matchedCandidate) {
            sourceNpc = matchedCandidate.name;
            sourceNpcId = matchedCandidate.id;
          }
        }
      }

      if (sourceNpc && !sourceNpcId) {
        const m = dossier.npcs.find((n) => n.name.toLowerCase().trim() === sourceNpc!.toLowerCase().trim())
          || combinedNpcs.find((n) => n.name.toLowerCase().trim() === sourceNpc!.toLowerCase().trim());
        if (m) {
          sourceNpcId = 'id' in m && m.id ? m.id : revealedEntityId('npc', messageId, m.name);
        }
      }

      // 2. Ustalanie lokacji odnalezienia
      if (!foundLocation) {
        if (locationEntry) {
          foundLocation = locationEntry.title;
          foundLocationId = revealedEntityId('location', messageId, locationEntry.title);
        } else {
          const textToScan = `${cleanClueTitle} ${rawContent}`.toLowerCase();
          const matchedLoc = dossier.locations.find(
            (l) => l.name && textToScan.includes(l.name.toLowerCase().trim())
          );
          if (matchedLoc) {
            foundLocation = matchedLoc.name;
            foundLocationId = matchedLoc.id;
          }
        }
      }

      if (foundLocation && !foundLocationId) {
        const m = dossier.locations.find((l) => l.name.toLowerCase().trim() === foundLocation!.toLowerCase().trim());
        if (m) {
          foundLocationId = m.id;
        }
      }

      if (!existingClue) {
        const isKey = /klucz|core|key|główn/i.test(`${cleanClueTitle} ${tag.content}`);
        const resolvedMiceType = explicitMiceType || inferClueMiceType(cleanClueTitle, fact);
        const isFailForwardClue = clueAcquisitionCause === 'fail_forward' && !failForwardCauseAssigned;
        const dossierRecordId = tag.dossierRecordId && allowedDossierRecordIdSet.has(tag.dossierRecordId)
          ? tag.dossierRecordId
          : undefined;
        const newClue: ClueEntry = {
          id: `clue-${messageId}-${index}`,
          title: cleanClueTitle,
          description: fact,
          category: resolvedCategory,
          status: parseRevealedClue(tag).status,
          discoveryStatus: 'discovered',
          ...(isFailForwardClue ? { acquisitionCause: 'fail_forward' as const } : {}),
          ...(dossierRecordId ? { dossierRecordId } : {}),
          epistemicLayer: 'player_clue',
          provenance: resolvedProvenance,
          sourceNpc,
          sourceNpcId,
          foundLocation,
          foundLocationId,
          isKeyClue: isKey,
          clueType: normalizeClueType({ isKeyClue: isKey, title: cleanClueTitle, description: fact }),
          miceType: resolvedMiceType,
          miceObjective,
          inGameDate: clueInGameDate,
          timestamp: Date.now(),
          sourceJournalEntryId: `journal-${messageId}-${index}`,
        };
        dossier.clues.push(newClue);
        if (isFailForwardClue) failForwardCauseAssigned = true;
        changed = true;
      } else {
        // Aktualizacja istniejącej poszlaki
        if (
          !existingClue.dossierRecordId &&
          tag.dossierRecordId &&
          allowedDossierRecordIdSet.has(tag.dossierRecordId)
        ) {
          existingClue.dossierRecordId = tag.dossierRecordId;
          changed = true;
        }
        const explicitStatus=parseRevealedClue(tag).explicitStatus;
        if(explicitStatus && existingClue.status!==explicitStatus) {existingClue.status=explicitStatus;changed=true;}
        if (existingClue.description !== fact && fact) {
          existingClue.description = fact;
          existingClue.timestamp = Date.now();
          changed = true;
        }
        if (explicitProvenance && existingClue.provenance !== explicitProvenance) {
          existingClue.provenance = explicitProvenance;
          existingClue.timestamp = Date.now();
          changed = true;
        } else if (!existingClue.provenance && resolvedProvenance) {
          existingClue.provenance = resolvedProvenance;
          existingClue.timestamp = Date.now();
          changed = true;
        }
        if (!existingClue.sourceNpc && sourceNpc) {
          existingClue.sourceNpc = sourceNpc;
          existingClue.sourceNpcId = sourceNpcId;
          existingClue.timestamp = Date.now();
          changed = true;
        }
        if (!existingClue.foundLocation && foundLocation) {
          existingClue.foundLocation = foundLocation;
          existingClue.foundLocationId = foundLocationId;
          existingClue.timestamp = Date.now();
          changed = true;
        }
        if (!existingClue.clueType) {
          existingClue.clueType = normalizeClueType({
            isKeyClue: existingClue.isKeyClue,
            title: cleanClueTitle,
            description: existingClue.description || fact,
          });
          changed = true;
        }
      }

      // Potrójny Byt Handoutów: jeśli poszlaka jest dokumentem/handoutem, dołącz rekwizyt fizyczny do ekwipunku postaci
      const isPersonEntity =
        /\b(uciekinier|świadek|swiadek|podejrzan|kierowca|mechanik|postać|postac|człowiek|czlowiek|mężczyzna|mezczyzna|kobieta|profesor|doktor|ofiara|kapłan|kaplan|strażnik|straznik|przechodzień|przechodzien|badacz|detektyw|konstruktor|inżynier|inzynier|włamywacz|złodziej|goniec|policjant|oficer|żołnierz|zolnierz|ksiądz|ksadz|marynarz)\b/i.test(
          cleanClueTitle
        );

      const isTitleDocument =
        /\b(dokument|list|wycinek|gazet|artykuł|pismo|fotografi|zdjęci|taśm|nagrani|książk|księg|pamiętnik|dziennik|notatk|raport|telegram|akt|akta|świadectwo|certyfikat|bilet|przepustk|kalka|mapa|plakat|afisz|document|letter|clipping|newspaper|article|photo|tape|recording|book|tome|diary|journal|notes|report|file|certificate|pass|map|blueprint)\b/i.test(
          cleanClueTitle
        );

      const isClueHandout =
        !isPersonEntity &&
        !isVisualPromptLeak(cleanClueTitle) &&
        (explicitProvenance === 'handout' ||
          (isTitleDocument && (resolvedProvenance === 'handout' || resolvedCategory === 'document')));

      // Poszlaki/Handouty: NIE dodajemy samowolnie nowych dokumentów do ekwipunku postaci (Issue #565).
      // Dokument trafia do Dossier (dossier.clues). Jeśli gracz posiada już ten rekwizyt w torbie, jedynie uzupełniamy treść.
      if (isClueHandout) {
        const existingEqIndex = existingEquipment.findIndex(
          (eq) => normalizeEntityTitle(eq.name || '') === normClueTitle
        );
        if (existingEqIndex !== -1) {
          const existingEq = existingEquipment[existingEqIndex];
          if (!existingEq.readableContent && rawContent) {
            existingEquipment[existingEqIndex] = {
              ...existingEq,
              isReadable: true,
              readableContent: rawContent,
              readableContentStatus: 'ready',
            };
            changed = true;
          }
        }
      }
    }

    // Dopisz wpis do kroniki (z zachowaniem pełnej treści narracyjnej w content)
    const jId = `journal-${messageId}-${index}`;
    const mappedType = ['sprawa', 'case', 'cel'].includes(tag.type)
      ? 'case'
      : ['notatka', 'note'].includes(tag.type)
        ? 'note'
        : tag.type;

    if (!existingJournalIds.has(jId)) {
      existingJournal.push({
        id: jId,
        timestamp: new Date(),
        inGameDate: isClue ? clueInGameDate : tag.inGameDate,
        type: mappedType,
        title: isClue ? cleanClueTitle : tag.title,
        content: fact,
        tags: [],
        isBookmarked: false,
      });
      existingJournalIds.add(jId);
      changed = true;
    }
  });

  // 3. Obsługa lokacji
  if (locationEntry) {
    const lowerLoc = locationEntry.title.toLowerCase().trim();
    const existingLoc = dossier.locations.find(
      (l) => l.name.toLowerCase().trim() === lowerLoc
    );

    if (!existingLoc) {
      let locDesc = locationEntry.content;
      let lockedRoomMystery: LocationDossierEntry['lockedRoomMystery'];

      if (locationEntry.content.includes('|')) {
        const parts = locationEntry.content.split('|').map((p) => p.trim());
        locDesc = parts[0] || locationEntry.content;
        const typeToken = (parts[1] || '').toLowerCase();
        const validTypes: Record<string, import('@/lib/journal/dossier-types').LockedRoomMysteryType> = {
          typ1: 'accident_feigned_as_murder',
          wypadek: 'accident_feigned_as_murder',
          typ2: 'toxic_gas_or_paroxysm',
          gaz: 'toxic_gas_or_paroxysm',
          typ3: 'mechanical_trap',
          pulapka: 'mechanical_trap',
          typ4: 'suicide_framed_as_murder',
          samobojstwo: 'suicide_framed_as_murder',
          typ5: 'victim_impersonation',
          podszycie: 'victim_impersonation',
          typ6: 'strike_from_outside',
          zewnatrz: 'strike_from_outside',
          typ7: 'strike_during_break_in',
          wywazanie: 'strike_during_break_in',
        };

        const matchedType = validTypes[typeToken];
        if (matchedType) {
          lockedRoomMystery = {
            type: matchedType,
            anomalyDescription: parts[2] || 'Zamknięte od wewnątrz drzwi i brak śladów ucieczki.',
            investigationHint: parts[3] || undefined,
          };
        }
      }

      dossier.locations.push({
        id: revealedEntityId('location',messageId,locationEntry.title),
        name: locationEntry.title,
        description: locDesc,
        searchStatus: 'partially_searched',
        lockedRoomMystery,
        timestamp: Date.now(),
      });
      changed = true;
    }

    if (!existingJournalIds.has(locationEntry.id)) {
      existingJournal.push(locationEntry);
      existingJournalIds.add(locationEntry.id);
      changed = true;
    }
  }

  // 4. Uszczelnienie relacji dwukierunkowych (Fact <-> NPC <-> Location)
  if (linkClueNpcLocation(dossier)) {
    changed = true;
  }

  // 5. Obsługa zakończenia i pieczętowania sceny (Issue #402)
  if ((sceneCard || sceneChange) && !sceneSealedThisMessage) {
    const cardId = `scene-card-${messageId}`;
    if (!existingSceneCards.some((sc) => sc.id === cardId)) {
      const cardTitle = sceneCard?.title || activeScene.location || `Scena ${activeScene.sceneNumber}`;
      const cardLoc = sceneCard?.location || activeScene.location;
      const sealedTakeaways =
        sceneCard?.keyTakeaways && sceneCard.keyTakeaways.length > 0
          ? sceneCard.keyTakeaways
          : activeScene.notes.length > 0
          ? activeScene.notes
          : ['Zbadano lokację i zabezpieczono zebrane poszlaki.'];

      const sealedPeople =
        sceneCard?.people && sceneCard.people.length > 0
          ? sceneCard.people
          : activeScene.people;

      const sealedFindings =
        sceneCard?.findings && sceneCard.findings.length > 0
          ? sceneCard.findings
          : activeScene.findings;

      const nextStep =
        sceneCard?.nextStep ||
        (sceneChange?.newLocation ? `Udać się do: ${sceneChange.newLocation}` : undefined);

      const sealedCard: SceneCaseCard = {
        chronicleChapter: activeScene.chronicleChapter,
        chronicleBoundaryKnown: activeScene.chronicleBoundaryKnown,
        id: cardId,
        sceneNumber: activeScene.sceneNumber,
        location: cardLoc,
        title: cardTitle,
        inGameDate: sceneCard?.inGameDate || activeScene.inGameDate || locationEntry?.inGameDate,
        timestamp: new Date().toISOString(),
        people: sealedPeople,
        startMessageId: chronicleStartMessageId,
        endMessageId: messageId,
        findings: sealedFindings,
        keyTakeaways: sealedTakeaways,
        nextStep,
        isSealed: true,
        isLocationExhausted: activeScene.isLocationExhausted || false,
      };

      existingSceneCards.push(sealedCard);

      const journalSceneId = `journal-scene-${messageId}`;
      if (!existingJournalIds.has(journalSceneId)) {
        existingJournal.push({
          id: journalSceneId,
          timestamp: new Date(),
          inGameDate: sealedCard.inGameDate,
          type: 'scene',
          title:
            sceneCard?.title ||
            (isVisualPromptLeak(sealedCard.location)
              ? `Scena #${sealedCard.sceneNumber}`
              : `Scena #${sealedCard.sceneNumber}: ${sanitizeLocationName(sealedCard.location)}`),
          content: sealedCard.keyTakeaways.join('\n'),
          tags: ['scena', 'akta-sprawy'],
          isBookmarked: false,
          sceneData: sealedCard,
        });
        existingJournalIds.add(journalSceneId);
      }

      // Nowa aktywna scena po przejściu
      activeScene = {
        chronicleChapter: activeScene.chronicleChapter,
        chronicleBoundaryKnown: true,
        sceneNumber: sealedCard.sceneNumber + 1,
        location: sanitizeLocationName(sceneChange?.newLocation || 'Nowa lokacja'),
        startedAt: new Date().toISOString(),
        people: [],
        startMessageId: messageId,
        findings: [],
        notes: [],
        isLocationExhausted: false,
      };
      changed = true;
    }
  }

  if (!changed) return { character, changed: false };

  dossier.lastUpdated = new Date().toISOString();
  return {
    character: {
      ...charWithDossier,
      journal: existingJournal,
      equipment: existingEquipment,
      investigatorDossier: dossier,
      sceneCards: existingSceneCards,
      activeScene,
      actReports: existingActReports,
    },
    changed: true,
  };
}

/**
 * Ekstrahuje tagi [DZIENNIK:], [NPC:], [PRZEDMIOT:], [LOKACJA:], [ZMIANA_SCENY:], [KARTA_SCENY:] oraz [RAPORT_AKTU:]
 * z tekstu odpowiedzi MG, aktualizuje dossier, sceny, raporty i dopisuje wpisy do `character.journal`.
 */
function appendJournalFromTextWithoutActTag(
  character: Character,
  rawText: string,
  messageId: string
): Character {
  const parsed = parseRevealedTags(rawText);
  const {journalTags:tags,npcTags,itemTags}=parsed;
  const extraNpcs = extractExtraNpcTags(rawText);
  for (const extra of extraNpcs) {
    const exists = npcTags.some((n) => n.name.toLowerCase().trim() === extra.name.toLowerCase().trim());
    if (!exists) {
      npcTags.push(extra);
    } else {
      const found = npcTags.find((n) => n.name.toLowerCase().trim() === extra.name.toLowerCase().trim());
      if (found && !found.description.includes(extra.description)) {
        found.description += ` | ${extra.description}`;
      }
    }
  }
  const locationEntry = buildLocationEntryFromText(parsed.text, messageId);
  const sceneChange = extractSceneChangeTag(rawText);
  const sceneCard = extractSceneCardTag(rawText);
  const locationExhausted = extractLocationExhaustedTag(rawText);
  const actReport = extractActReportTag(rawText);

  if (
    tags.length === 0 &&
    npcTags.length === 0 &&
    itemTags.length === 0 &&
    !locationEntry &&
    !sceneChange &&
    !sceneCard &&
    !locationExhausted &&
    !actReport
  ) {
    return character;
  }

  const result = processCharacterJournalAndDossier(
    character,
    tags,
    npcTags,
    locationEntry,
    messageId,
    itemTags,
    sceneChange,
    sceneCard,
    undefined,
    locationExhausted,
    actReport
  );

  return result.character;
}

/**
 * Wariant party-aware (duet / Hot Seat): wpis `[DZIENNIK:@Imię:...]` trafia do
 * dziennika postaci wskazanej prefiksem `@Imię` (fallback: aktywna postać).
 */
function appendJournalToPartyWithoutActTag(
  characters: Character[],
  activeCharacter: Character,
  rawText: string,
  messageId: string,
  clueAcquisitionCause?: ClueAcquisitionCause,
  allowedDossierRecordIds: string[] = []
): { characters: Character[]; activeCharacter: Character; changed: boolean } {
  const parsed = parseRevealedTags(rawText);
  const {journalTags:tags,npcTags,itemTags}=parsed;
  const extraNpcs = extractExtraNpcTags(rawText);
  for (const extra of extraNpcs) {
    const exists = npcTags.some((n) => n.name.toLowerCase().trim() === extra.name.toLowerCase().trim());
    if (!exists) {
      npcTags.push(extra);
    } else {
      const found = npcTags.find((n) => n.name.toLowerCase().trim() === extra.name.toLowerCase().trim());
      if (found && !found.description.includes(extra.description)) {
        found.description += ` | ${extra.description}`;
      }
    }
  }
  const locationEntry = buildLocationEntryFromText(parsed.text, messageId);
  const sceneChange = extractSceneChangeTag(rawText);
  const sceneCard = extractSceneCardTag(rawText);
  const locationExhausted = extractLocationExhaustedTag(rawText);
  const actReport = extractActReportTag(rawText);

  if (
    tags.length === 0 &&
    npcTags.length === 0 &&
    itemTags.length === 0 &&
    !locationEntry &&
    !sceneChange &&
    !sceneCard &&
    !locationExhausted &&
    !actReport
  ) {
    return { characters, activeCharacter, changed: false };
  }

  // Mapuj tagi na postacie
  const tagsByChar = new Map<string, JournalTagEntry[]>();
  const npcTagsByChar = new Map<string, ExtractedNpcTag[]>();
  const itemTagsByChar = new Map<string, ExtractedItemTag[]>();

  tags.forEach((tag) => {
    const target = resolveRevealedRecipient(characters, tag.who, activeCharacter);
    if(!target)return;
    const list = tagsByChar.get(target.id) ?? [];
    list.push(tag);
    tagsByChar.set(target.id, list);
  });

  npcTags.forEach((npc) => {
    const target = resolveRevealedRecipient(characters, npc.who, activeCharacter);
    if(!target)return;
    const list = npcTagsByChar.get(target.id) ?? [];
    list.push(npc);
    npcTagsByChar.set(target.id, list);
  });

  itemTags.forEach((item) => {
    if (!item.who?.trim()) {
      // Rekwizyty i dokumenty odkryte wspólnie (bez jawnego @Kto) synchronizujemy dla całej drużyny
      characters.forEach((char) => {
        const list = itemTagsByChar.get(char.id) ?? [];
        list.push(item);
        itemTagsByChar.set(char.id, list);
      });
      return;
    }
    const target = resolveRevealedRecipient(characters, item.who, activeCharacter);
    if (!target) return;
    const list = itemTagsByChar.get(target.id) ?? [];
    list.push(item);
    itemTagsByChar.set(target.id, list);
  });

  let changedAny = false;
  const apply = (c: Character): Character => {
    const cTags = tagsByChar.get(c.id) ?? [];
    const cNpcs = npcTagsByChar.get(c.id) ?? [];
    const cItems = itemTagsByChar.get(c.id) ?? [];
    const cLoc = c.id === activeCharacter.id ? locationEntry : null;

    if (
      cTags.length === 0 &&
      cNpcs.length === 0 &&
      cItems.length === 0 &&
      !cLoc &&
      !sceneChange &&
      !sceneCard &&
      !locationExhausted &&
      !actReport
    ) {
      return c;
    }

    const res = processCharacterJournalAndDossier(
      c,
      cTags,
      cNpcs,
      cLoc,
      messageId,
      cItems,
      sceneChange,
      sceneCard,
      locationEntry?.title,
      locationExhausted,
      actReport,
      clueAcquisitionCause,
      allowedDossierRecordIds
    );
    if (res.changed) changedAny = true;
    return res.character;
  };

  const nextCharacters = characters.map(apply);
  const nextActive =
    nextCharacters.find((c) => c.id === activeCharacter.id) ??
    apply(activeCharacter);

  return {
    characters: nextCharacters,
    activeCharacter: nextActive,
    changed: changedAny,
  };
}

/** Dopisuje podsumowanie do już zamkniętej sceny, bez zmiany jej faktów i bez duplikatów. */
/** Message anchors survive save/load and do not depend on stream processing times. */
export function buildSceneChronicleTranscript(
  messages: Array<{ id: string; role: string; content: string }>,
  scene: Pick<SceneCaseCard, 'startMessageId' | 'endMessageId' | 'chronicleBoundaryKnown'>
): Array<{ role: string; content: string }> {
  if (scene.chronicleBoundaryKnown === false) return [];
  const start = scene.startMessageId
    ? messages.findIndex((message) => message.id === scene.startMessageId)
    : 0;
  const end = messages.findIndex((message) => message.id === scene.endMessageId);
  if (start < 0 || end < start) return [];
  return messages.slice(start, end + 1).map((message) => {
    let content = message.content;
    const transition = /\[(?:ZMIANA_SCENY|SCENE_CHANGE):[^\]]*\]/i.exec(content);
    if (transition) {
      if (message.id === scene.startMessageId) {
        content = content.slice(transition.index + transition[0].length);
      } else if (message.id === scene.endMessageId) {
        content = content.slice(0, transition.index);
      }
    }
    return { role: message.role, content: message.role === 'assistant'
      ? cleanResponseText(content) : content.trim() };
  }).filter((message) => (message.role === 'assistant' || message.role === 'user') && message.content.length > 0);
}

export function appendSceneChronicleSummaryToParty(
  characters: Character[],
  activeCharacter: Character,
  sceneCardId: string,
  summaries: Partial<Record<'pl' | 'en', string>>
): { characters: Character[]; activeCharacter: Character; changed: boolean } {
  const normalizedSummaries = {
    pl: typeof summaries.pl === 'string' ? summaries.pl.trim() : '',
    en: typeof summaries.en === 'string' ? summaries.en.trim() : '',
  };
  if (!normalizedSummaries.pl || !normalizedSummaries.en) {
    return { characters, activeCharacter, changed: false };
  }

  let changed = false;
  const updateCharacter = (character: Character): Character => {
    const sceneCards = character.sceneCards ?? [];
    const sceneIndex = sceneCards.findIndex((scene) => scene.id === sceneCardId);
    const existingSummaries = sceneCards[sceneIndex]?.chronicleSummaryByLocale;
    if (
      sceneIndex < 0 ||
      (existingSummaries?.pl && existingSummaries.en)
    ) {
      return character;
    }

    const updatedScene = {
      ...sceneCards[sceneIndex],
      chronicleSummaryByLocale: normalizedSummaries,
    };
    const updatedSceneCards = [...sceneCards];
    updatedSceneCards[sceneIndex] = updatedScene;
    const journal = (character.journal ?? []).map((entry) =>
      entry.sceneData?.id === sceneCardId
        ? {
            ...entry,
            content: normalizedSummaries.pl,
            sceneData: updatedScene,
          }
        : entry
    );
    changed = true;
    return { ...character, sceneCards: updatedSceneCards, journal };
  };

  const updatedCharacters = characters.map(updateCharacter);
  const activeFromList = updatedCharacters.find(
    (character) => character.id === activeCharacter.id
  );
  const updatedActiveCharacter = activeFromList ?? updateCharacter(activeCharacter);

  return {
    characters: updatedCharacters,
    activeCharacter: updatedActiveCharacter,
    changed,
  };
}

/**
 * Rozpoznaje wektor dramatyczny M.I.C.E. poszlaki na podstawie tytułu i treści.
 */
export function inferClueMiceType(
  title: string,
  content: string
): import('@/lib/journal/dossier-types').MiceQuotientType {
  const text = `${title} ${content}`.toLowerCase();
  if (/miejsce|lokacja|pokój|piwnica|krypta|tunel|drzwi|ucieczk|droga|wyjście|uwięzi|room|place|location|escape|door|tunnel|cell/i.test(text)) {
    return 'milieu';
  }
  if (/postać|świadek|podejrzan|relacj|psycholog|lęk|sekret|moral|osoba|npc|character|suspect|witness|fear|secret|guilt/i.test(text)) {
    return 'character';
  }
  if (/rytuał|kataklizm|zagrożeni|besti|potwór|eksplozj|zegar|pożar|czas|event|ritual|threat|monster|beast|countdown|fire/i.test(text)) {
    return 'event';
  }
  return 'inquiry';
}

/** Stored alongside the character so existing save/load and party updates preserve it. */
export interface NarrativeProgress {
  currentAct: number;
  completedActClueIds: string[];
}

type CharacterWithNarrativeProgress = Character & {
  narrativeProgress?: NarrativeProgress;
};

export function getNarrativeProgress(character: Character): NarrativeProgress {
  const progress = (character as CharacterWithNarrativeProgress)
    .narrativeProgress;
  return {
    currentAct:
      Number.isSafeInteger(progress?.currentAct) &&
      (progress?.currentAct ?? 0) > 0
        ? progress!.currentAct
        : 1,
    completedActClueIds: Array.isArray(progress?.completedActClueIds)
      ? progress.completedActClueIds.filter((id) => typeof id === 'string')
      : [],
  };
}

function getCurrentActCoreClueIds(
  character: Character,
  party: Character[] = []
): string[] {
  const previous = new Set(getNarrativeProgress(character).completedActClueIds);
  return [
    ...new Set(
      [character, ...party]
        .flatMap((c) => c.investigatorDossier?.clues ?? [])
        .filter(
          (clue) =>
            (clue.clueType === 'core' ||
              (clue.clueType === undefined && clue.isKeyClue)) &&
            clue.discoveryStatus !== 'unrevealed' &&
            clue.epistemicLayer !== 'keeper_truth' &&
            clue.status !== 'disproven' &&
            clue.status !== 'superseded' &&
            !previous.has(clue.id)
        )
        .map((clue) => clue.id)
    ),
  ];
}

export function buildNarrativeClueGate(
  character: Character,
  locale: 'pl' | 'en',
  party: Character[] = []
): string {
  const currentAct = getNarrativeProgress(character).currentAct;
  const count = getCurrentActCoreClueIds(character, party).length;
  if (count >= 2)
    return locale === 'en'
      ? `Act ${currentAct}: clue gate unlocked. The next act transition is permitted only when appropriate to the player's actions; never force it. Only [PRZEJŚCIE_AKTU: Akt ${currentAct + 1}] is valid.`
      : `Akt ${currentAct}: bramka poszlak odblokowana. Przejście do następnego aktu jest dozwolone tylko zgodnie z działaniami gracza; nie wymuszaj go. Dozwolony tag: [PRZEJŚCIE_AKTU: Akt ${currentAct + 1}].`;
  return locale === 'en'
    ? `[BLOKADA_AKTU: Act ${currentAct} locked. Revealed ${count}/2 Core clues. No act transition, climactic escalation, fleeing suspects, final confrontation or entry into the monster's lair. This applies also to one-shots without explicit acts. Never reveal this gate or counter to the player.]`
    : `[BLOKADA_AKTU: Akt ${currentAct} zablokowany. Odkryto ${count}/2 poszlak Core. Zakaz przejścia aktu, eskalacji kulminacyjnej, ucieczki podejrzanych, ostatecznej konfrontacji i wejścia do leża potwora. Dotyczy także jednostrzałów bez jawnych aktów. Nigdy nie ujawniaj graczowi bramki ani licznika.]`;
}

export function stripNarrativeActTags(text: string): string {
  return text.replace(/\[PRZEJŚCIE_AKTU\s*:[^\]]*(?:\]|$)/gi, '');
}

function advanceNarrativeAct(
  character: Character,
  rawText: string,
  party: Character[] = []
): Character {
  // Private GM thoughts must never cause a public-state update.
  const publicText = parseRevealedTags(rawText).text;
  const matches = [
    ...publicText.matchAll(
      /\[PRZEJŚCIE_AKTU\s*:\s*Akt\s+([0-9]+|[IVX]+)\s*\]/gi
    ),
  ];
  if (matches.length !== 1) return character;
  const romanActs: Record<string, number> = {
    I: 1,
    II: 2,
    III: 3,
    IV: 4,
    V: 5,
    VI: 6,
    VII: 7,
    VIII: 8,
    IX: 9,
    X: 10,
  };
  const act = romanActs[matches[0][1].toUpperCase()] ?? Number(matches[0][1]);
  const previous = getNarrativeProgress(character);
  const clues = getCurrentActCoreClueIds(character, party);
  if (act !== previous.currentAct + 1 || clues.length < 2) return character;
  const next: CharacterWithNarrativeProgress = {
    ...character,
    narrativeProgress: {
      currentAct: act,
      completedActClueIds: [
        ...new Set([...previous.completedActClueIds, ...clues]),
      ],
    },
  };
  return next;
}

export function appendJournalFromText(
  character: Character,
  rawText: string,
  messageId: string
): Character {
  return appendJournalFromTextWithoutActTag(
    advanceNarrativeAct(character, rawText),
    stripNarrativeActTags(rawText),
    messageId
  );
}

export function appendJournalToParty(
  characters: Character[],
  activeCharacter: Character,
  rawText: string,
  messageId: string,
  clueAcquisitionCause?: ClueAcquisitionCause,
  allowedDossierRecordIds: string[] = []
): {
  characters: Character[];
  activeCharacter: Character;
  changed: boolean;
} {
  const nextActive = advanceNarrativeAct(activeCharacter, rawText, characters);
  const actChanged = nextActive !== activeCharacter;
  const nextCharacters = actChanged
    ? characters.map((character) => {
        const next: CharacterWithNarrativeProgress = {
          ...character,
          narrativeProgress: getNarrativeProgress(nextActive),
        };
        return next;
      })
    : characters;
  const result = appendJournalToPartyWithoutActTag(
    nextCharacters,
    nextActive,
    stripNarrativeActTags(rawText),
    messageId,
    clueAcquisitionCause,
    allowedDossierRecordIds
  );
  return { ...result, changed: result.changed || actChanged };
}
