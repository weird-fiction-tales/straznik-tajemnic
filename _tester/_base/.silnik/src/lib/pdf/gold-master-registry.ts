/**
 * gold-master-registry.ts - Systemowy Rejestr Certyfikowanych Przygód & Bramka Jakości (Issue #737)
 *
 * Zastępuje kruche heurystyki parsowania PDF deterministycznym załadowaniem
 * zweryfikowanych pakietów Gold Master (1:1 NPC, pomoce i graf węzłowy)
 * oraz chroni silnik przed zanieczyszczeniem zepsutymi PDF-ami (Reject Gate).
 */

import type { CustomAdventure } from '@/lib/adventures-data';
import type { AdventureGraph } from '@/lib/types';
import type { RulebookProfile } from './rulebook-fingerprint';
import {
  STARTER_HAUNTING_ADVENTURE,
  HAUNTING_HANDOUTS,
} from '@/lib/starter-haunting-data';
import { getHauntingGraph } from '@/lib/adventures/starter-dossier';

export interface QualityGateResult {
  isValid: boolean;
  reason?: string;
  issues?: string[];
}

/**
 * Buduje certyfikowany graf śledztwa The Alexandrian dla Nawiedzonego Domu.
 */
function buildHauntingGoldMasterGraph(): AdventureGraph {
  return getHauntingGraph('pl');
}

function slugify(text: string): string {
  const map: Record<string, string> = {
    ą: 'a',
    ć: 'c',
    ę: 'e',
    ł: 'l',
    ń: 'n',
    ó: 'o',
    ś: 's',
    ź: 'z',
    ż: 'z',
  };
  return (
    text
      .toLowerCase()
      .replace(/[ąćęłńóśźż]/g, (c) => map[c] || c)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'starter'
  );
}

/**
 * Certyfikowana definicja Gold Master dla scenariusza Nawiedzony Dom.
 */
function createHauntingGoldMasterAdventure(params?: {
  existingAdventureId?: string;
  fileName?: string;
}): CustomAdventure {
  const base = STARTER_HAUNTING_ADVENTURE;
  const graph = buildHauntingGoldMasterGraph();

  const fileSlug = params?.fileName
    ? slugify(
        params.fileName
          .replace(/\.pdf$/i, '')
          .replace(/[-_]+/g, ' ')
          .trim()
      )
    : 'starter';
  const id =
    params?.existingAdventureId || `custom-${fileSlug}-starter-scenariusz`;

  return {
    id,
    title: 'Nawiedzony dom',
    era: base.era,
    eraLabel: base.eraLabel,
    yearRange: base.yearRange,
    activeSceneYear: base.activeSceneYear,
    location: base.location,
    country: base.country,
    tone: base.tone,
    themes: base.themes,
    suggestedOccupations: base.suggestedOccupations,
    suggestedArchetypes: base.suggestedArchetypes,
    hook: base.hook,
    description: base.description,
    investigatorIntro: base.investigatorIntro,
    estimatedSessions: base.estimatedSessions,
    playerCount: base.playerCount,
    difficulty: base.difficulty,
    isCustom: true,
    pdfUrl: '',
    geminiFileUri: '',
    fileName: params?.fileName || 'Zew_Cthulhu_Starter_7e.pdf',
    uploadedAt: new Date().toISOString(),
    isAnalyzed: true,
    documentType: 'scenario',
    isCampaign: false,
    graph,
    source: 'Starter d100',
    sourceCategory: 'starter',
    sourceBookId: 'starter-d100',
    recommendedForBeginners: true,
    attachedLorebookIds: [],
    handouts: HAUNTING_HANDOUTS,
    settingTrivia: base.settingTrivia,
  };
}

/**
 * Sprawdza, czy wejściowy dokument PDF odpowiada certyfikowanemu pakietowi Gold Master.
 */
export function findGoldMasterMatch(
  text: string,
  fileName?: string,
  profile?: RulebookProfile,
  existingAdventureId?: string
): CustomAdventure | null {
  if (!text) return null;
  const sample = text.slice(0, 100000);
  const cleanFileName = (fileName || '').toLowerCase();

  // Dopasowanie Startera Zew Cthulhu 7e / Nawiedzony Dom / The Haunting
  const isStarter =
    profile === 'starter-d100' ||
    cleanFileName.includes('starter') ||
    cleanFileName.includes('haunting') ||
    cleanFileName.includes('nawiedzony');

  const hasHauntingSignals =
    /nawiedzony\s+dom/i.test(sample) ||
    /the\s+haunting/i.test(sample) ||
    /walter[a-z\s]*corbitt/i.test(sample) ||
    /steven[a-z\s]*knott/i.test(sample) ||
    /kaplic[aęy]\s+kontemplacji/i.test(sample);

  if (isStarter && hasHauntingSignals) {
    return createHauntingGoldMasterAdventure({
      existingAdventureId,
      fileName,
    });
  }

  return null;
}

/**
 * Twarda Bramka Jakości (Reject Gate) dla nieznanych/dowolnych plików PDF.
 * Zapobiega zanieczyszczeniu biblioteki atrapami bez węzłów śledztwa, postaci i poszlak.
 */
export function validateAdventureQualityGate(
  adventure: CustomAdventure,
  rawPdfText: string
): QualityGateResult {
  // Kompendia regułowe i bestiariusze nie podlegają rygorom śledczym
  if (adventure.documentType === 'compendium') {
    return { isValid: true };
  }

  const issues: string[] = [];

  if (!rawPdfText || rawPdfText.trim().length < 20) {
    issues.push(
      'Zbyt krótka lub pusta warstwa tekstowa PDF (możliwy skan bez OCR).'
    );
  }

  const nodes = adventure.graph?.nodes || [];
  const locations = adventure.graph?.locations || [];
  if (nodes.length === 0 && locations.length === 0) {
    issues.push('Brak jakichkolwiek węzłów lub lokalizacji śledztwa.');
  }

  const npcs = adventure.graph?.npcs || [];
  const clues = adventure.graph?.clues || [];
  const handouts = adventure.handouts || [];
  if (npcs.length === 0 && clues.length === 0 && handouts.length === 0) {
    issues.push('Brak rozpoznanych postaci (NPC), poszlak ani rekwizytów.');
  }

  if (issues.length > 0) {
    return {
      isValid: false,
      reason: issues.join(' '),
      issues,
    };
  }

  return { isValid: true };
}
