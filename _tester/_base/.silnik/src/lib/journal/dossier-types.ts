/**
 * Definicje typów dla Akt Śledczych i Notesu Badacza (Investigator's Dossier).
 * Zgodne z oficjalnymi zasadami Call of Cthulhu 7th Edition (RAW).
 * Zastępuje anachroniczne koncepcje cRPG (questy, objectives, questStatus).
 */

export type ClueCategory = 'forensic' | 'document' | 'testimony' | 'occult';

export type ClueStatus = 'unconfirmed' | 'confirmed' | 'disproven' | 'superseded';

export type ClueDiscoveryStatus = 'unrevealed' | 'discovered' | 'verified';
export type EpistemicLayerType = 'keeper_truth' | 'player_clue';
export type ClueProvenance = 'observed' | 'testimony' | 'deduction' | 'handout';
export type ClueAcquisitionCause = 'fail_forward';

/**
 * Wektor dramatyczny M.I.C.E. Quotient (Orson Scott Card / Mary Robinette Kowal):
 * - milieu: konflikt przestrzeni, uwięzienie, droga ucieczki lub zabezpieczenie lokacji
 * - inquiry: pytanie śledcze, poszlaka, zagadka do rozwikłania
 * - character: motywacja wewnętrzna, tożsamość, lęk moralny lub przemiana postaci
 * - event: zachwianie porządku świata, kataklizm, rytuał, wyścig z czasem
 */
export type MiceQuotientType = 'milieu' | 'inquiry' | 'character' | 'event';

/**
 * Podział poszlak: Core (krytyczne, odblokowujące węzły śledztwa) vs Flavor (smaczki i tło klimatyczne).
 * Działa w 100% pod maską i w [MYŚLI_MG] - niewidzialny dla gracza w UI Notesu Badacza (Issue #648 Faza 2 R3).
 */
export type ClueType = 'core' | 'flavor';

export interface ClueEntry {
  id: string;
  title: string;
  description: string;
  category: ClueCategory;
  status: ClueStatus;
  /** Kategoryzacja poszlaki pod maską: Core vs Flavor (Issue #648 Faza 2 R3) */
  clueType?: ClueType;
  /** Status odkrycia poszlaki w ramach epistemicznej mgły wojny (Concordia pattern) */
  discoveryStatus?: ClueDiscoveryStatus;
  /** Stabilny ID odpowiadającego rekordu `clue` z aktywnej teczki wydania. */
  dossierRecordId?: string;
  /** Jawny powód zdobycia tropu, przekazany przez rozstrzygniętą mechanikę. */
  acquisitionCause?: ClueAcquisitionCause;
  /** Warstwa epistemiczna: obiektywna prawda MG vs wiedza badacza */
  epistemicLayer?: EpistemicLayerType;
  /** Epistemiczna proweniencja / źródło poznawcze poszlaki (LIMIT / anty-zapaść wektorowa) */
  provenance?: ClueProvenance;
  /** Identyfikator poszlaki unieważniającej (Arcanum Benchmark 2026: Fact Supersession) */
  supersededBy?: string;
  sourceNpc?: string;
  sourceNpcId?: string;
  foundLocation?: string;
  foundLocationId?: string;
  inGameDate?: string;
  timestamp?: number;
  /** Wniosek Badacza / Dedukcja postaci (np. z rzutu na Pomysł / INT) */
  investigatorInsight?: string;
  tags?: string[];
  imageUrl?: string;
  /** Czy poszlaka stanowi kluczowy element śledztwa (Core Clue RAW) */
  isKeyClue?: boolean;
  /** Powiązane identyfikatory węzłów dowodowych (Alexandrian Three-Clue Rule & Node Network) */
  linkedNodeIds?: string[];
  /** Alternatywne tropy prowadzące do tej samej konkluzji (eliminacja chokepointów) */
  alternativeClueTrails?: string[];
  /** Wektor dramatyczny M.I.C.E. Quotient */
  miceType?: MiceQuotientType;
  /** Kluczowe pytanie lub cel w ramach wektora M.I.C.E. */
  miceObjective?: string;
  sourceJournalEntryId?: string;
}

export type NpcRelationshipStatus =
  | 'friendly'
  | 'neutral'
  | 'hostile'
  | 'suspicious'
  | 'fanatical'
  | 'unknown'
  | 'deceased';

export interface NpcDossierEntry {
  id: string;
  name: string;
  occupation?: string;
  firstImpression?: string;
  keyInformation?: string;
  relationshipStatus: NpcRelationshipStatus;
  /** Nastawienie psychologiczne NPC (blokada uległości bez testu socjalnego) */
  disposition?: 'friendly' | 'neutral' | 'suspicious' | 'hostile' | 'fanatical';
  location?: string;
  locationId?: string;
  avatarUrl?: string;
  tags?: string[];
  notes?: string;
  inGameDate?: string;
  timestamp?: number;
  sourceJournalEntryId?: string;
  /** Identyfikatory poszlak powiązanych z tą postacią / przez nią przekazanych */
  relatedClueIds?: string[];

  // === Trójwymiarowy profil postaci według Lajosa Egriego (The Art of Dramatic Writing) ===
  /** Wymiar fizjologiczny: cecha wyglądu, tik, manieryzm fizyczny, postawa */
  physiologicalDetail?: string;
  /** Wymiar socjologiczny: status społeczny, klasa, pozycja siły, przynależność */
  sociologicalStatus?: string;
  /** Wymiar psychologiczny: ukryta agenda, prywatny lęk, słabość moralna */
  psychologicalAgenda?: string;
  /** Sekret postaci (dla Mistrza Gry lub zamaskowany dla Badacza) */
  secret?: string;
}

export type LocationSearchStatus =
  | 'unvisited'
  | 'partially_searched'
  | 'thoroughly_searched';

/**
 * 7 Typów Zagadek Zamkniętego Pokoju (John Dickson Carr - The Hollow Man, 1935)
 */
export type LockedRoomMysteryType =
  | 'accident_feigned_as_murder' // Typ 1: Fatalny wypadek pozorowany na zabójstwo
  | 'toxic_gas_or_paroxysm'      // Typ 2: Trujący gaz lub szał niszczący otoczenie
  | 'mechanical_trap'            // Typ 3: Mechaniczna pułapka (zegar, rygiel)
  | 'suicide_framed_as_murder'   // Typ 4: Samobójstwo znikającą bronią (np. sopel)
  | 'victim_impersonation'       // Typ 5: Sprawca udający ofiarę po zabójstwie
  | 'strike_from_outside'        // Typ 6: Strzał/atak z zewnątrz (lufcik, szczelina)
  | 'strike_during_break_in';    // Typ 7: Atak w trakcie wyważania drzwi w chaosie

export interface LocationDossierEntry {
  id: string;
  name: string;
  addressOrRegion?: string;
  searchStatus: LocationSearchStatus;
  discoveredClueIds?: string[];
  /** Identyfikatory postaci powiązanych z tą lokacją lub w niej przebywających */
  npcIds?: string[];
  description?: string;
  tags?: string[];
  imageUrl?: string;
  inGameDate?: string;
  timestamp?: number;
  sourceJournalEntryId?: string;

  // === Zagadka Zamkniętego Pokoju (John Dickson Carr) ===
  lockedRoomMystery?: {
    type: LockedRoomMysteryType;
    anomalyDescription: string;
    investigationHint?: string;
  };
}

export interface PlayerNoteEntry {
  id: string;
  title: string;
  content: string;
  linkedClueIds?: string[];
  linkedNpcIds?: string[];
  linkedLocationIds?: string[];
  tags?: string[];
  inGameDate?: string;
  timestamp?: number;
  sourceJournalEntryId?: string;
}

/**
 * Kotwica Prawdy (Truth Anchor / Sealed Envelope)
 */
export interface DossierTruthAnchor {
  culprit: string;
  motive: string;
  murderWeapon: string;
  immutableFacts: string[];
}

/**
 * Beat w scenie śledztwa (DeepMind Dramatron / CoC 7e RAW)
 */
export interface SceneBeatEntry {
  id: string;
  title: string;
  description: string;
  miceType?: MiceQuotientType;
  sanLossRisk?: string;
  skillChecks?: string[];
  keyClueId?: string;
  outcome?: string;
}

/**
 * Karta Sceny w Dossier (4 Akty Obłędu)
 */
export interface SceneDossierEntry {
  id: string;
  title: string;
  act: 1 | 2 | 3 | 4;
  locationId: string;
  npcIds: string[];
  description: string;
  clueIds: string[];
  isClimax?: boolean;
  beats: SceneBeatEntry[];
}

export interface InvestigatorDossier {
  adventureId?: string;
  clues: ClueEntry[];
  npcs: NpcDossierEntry[];
  locations: LocationDossierEntry[];
  notes: PlayerNoteEntry[];
  scenes?: SceneDossierEntry[];
  truthAnchor?: DossierTruthAnchor;
  lastUpdated?: string;
}

/**
 * Zwraca nową, pustą strukturę akt śledczych.
 */
export function createEmptyDossier(): InvestigatorDossier {
  return {
    clues: [],
    npcs: [],
    locations: [],
    notes: [],
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Normalizuje lub wnioskuje typ poszlaki: krytyczna dla węzłów (core) vs tło klimatyczne (flavor).
 * Działa w 100% pod maską i w [MYŚLI_MG] - niewidzialny w UI Notesu Badacza (Issue #648 Faza 2 R3).
 */
export function normalizeClueType(raw?: {
  clueType?: unknown;
  isKeyClue?: unknown;
  targetNodeId?: unknown;
  tags?: unknown;
  title?: unknown;
  name?: unknown;
  description?: unknown;
} | string | null): ClueType {
  if (typeof raw === 'string') {
    const trimmed = raw.trim().toLowerCase();
    if (trimmed === 'core' || trimmed === 'flavor') {
      return trimmed as ClueType;
    }
  }
  if (raw && typeof raw === 'object') {
    if (typeof raw.clueType === 'string') {
      const lowerClueType = raw.clueType.trim().toLowerCase();
      if (lowerClueType === 'core' || lowerClueType === 'flavor') {
        return lowerClueType as ClueType;
      }
    }
    if (raw.isKeyClue === true || raw.isKeyClue === 'true' || Boolean(raw.targetNodeId)) {
      return 'core';
    }
    if (Array.isArray(raw.tags)) {
      const hasCore = raw.tags.some(
        (t) => typeof t === 'string' && /core|kluczowa|key|główn/i.test(t)
      );
      if (hasCore) return 'core';
    }
    const text = `${String(raw.title || raw.name || '')} ${String(raw.description || '')}`.toLowerCase();
    if (/klucz|core|key|główn/i.test(text)) {
      return 'core';
    }
  }
  return 'flavor';
}

/**
 * Type guard sprawdzający, czy obiekt to ClueEntry.
 */
export function isClueEntry(item: unknown): item is ClueEntry {
  if (!item || typeof item !== 'object') return false;
  const c = item as Record<string, unknown>;
  const rawClueType = typeof c.clueType === 'string' ? c.clueType.trim().toLowerCase() : c.clueType;
  return (
    typeof c.id === 'string' &&
    typeof c.title === 'string' &&
    typeof c.category === 'string' &&
    typeof c.status === 'string' &&
    (c.dossierRecordId === undefined || typeof c.dossierRecordId === 'string') &&
    (c.acquisitionCause === undefined || c.acquisitionCause === 'fail_forward') &&
    (rawClueType === undefined || rawClueType === null || rawClueType === 'core' || rawClueType === 'flavor')
  );
}

/**
 * Type guard sprawdzający, czy obiekt to NpcDossierEntry.
 */
export function isNpcDossierEntry(item: unknown): item is NpcDossierEntry {
  if (!item || typeof item !== 'object') return false;
  const n = item as Record<string, unknown>;
  return (
    typeof n.id === 'string' &&
    typeof n.name === 'string' &&
    typeof n.relationshipStatus === 'string'
  );
}

/**
 * Type guard sprawdzający, czy obiekt to LocationDossierEntry.
 */
export function isLocationDossierEntry(item: unknown): item is LocationDossierEntry {
  if (!item || typeof item !== 'object') return false;
  const l = item as Record<string, unknown>;
  return (
    typeof l.id === 'string' &&
    typeof l.name === 'string' &&
    typeof l.searchStatus === 'string'
  );
}

/**
 * Type guard sprawdzający, czy obiekt to PlayerNoteEntry.
 */
export function isPlayerNoteEntry(item: unknown): item is PlayerNoteEntry {
  if (!item || typeof item !== 'object') return false;
  const p = item as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.title === 'string' &&
    typeof p.content === 'string'
  );
}

/**
 * Type guard sprawdzający, czy obiekt to SceneDossierEntry.
 */
export function isSceneDossierEntry(item: unknown): item is SceneDossierEntry {
  if (!item || typeof item !== 'object') return false;
  const s = item as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    typeof s.title === 'string' &&
    typeof s.act === 'number' &&
    Array.isArray(s.beats)
  );
}

/**
 * Uszczelnia relacje dwukierunkowe w Aktach Śledczych (Fact <-> NPC <-> Location).
 * Chroni przed gubieniem referencji i powiązań między poszlakami, postaciami a lokacjami.
 * Zwraca true, jeśli zaktualizowano jakiekolwiek referencje.
 */
export function linkClueNpcLocation(dossier: InvestigatorDossier): boolean {
  if (!dossier) return false;
  let changed = false;

  const npcsByName = new Map<string, NpcDossierEntry>();
  const npcsById = new Map<string, NpcDossierEntry>();
  for (const n of dossier.npcs || []) {
    if (n.name) npcsByName.set(n.name.trim().toLowerCase(), n);
    if (n.id) npcsById.set(n.id, n);
  }

  const locationsByName = new Map<string, LocationDossierEntry>();
  const locationsById = new Map<string, LocationDossierEntry>();
  for (const l of dossier.locations || []) {
    if (l.name) locationsByName.set(l.name.trim().toLowerCase(), l);
    if (l.id) locationsById.set(l.id, l);
  }

  // 1. Poszlaki: połącz z NPC i Lokacjami
  for (const clue of dossier.clues || []) {
    // A. Źródłowy NPC
    if (clue.sourceNpc && !clue.sourceNpcId) {
      const sLower = clue.sourceNpc.trim().toLowerCase();
      let match = npcsByName.get(sLower);
      if (!match) {
        const fuzzy = (dossier.npcs || []).filter(
          (n) => n.name && (n.name.toLowerCase().includes(sLower) || sLower.includes(n.name.toLowerCase()))
        );
        if (fuzzy.length === 1) match = fuzzy[0];
      }
      if (match) {
        clue.sourceNpcId = match.id;
        changed = true;
      }
    } else if (clue.sourceNpcId && !clue.sourceNpc) {
      const match = npcsById.get(clue.sourceNpcId);
      if (match) {
        clue.sourceNpc = match.name;
        changed = true;
      }
    }

    if (clue.sourceNpcId) {
      const npc = npcsById.get(clue.sourceNpcId);
      if (npc) {
        if (!npc.relatedClueIds) npc.relatedClueIds = [];
        if (!npc.relatedClueIds.includes(clue.id)) {
          npc.relatedClueIds.push(clue.id);
          changed = true;
        }
      }
    }

    // B. Lokacja znalezienia
    if (clue.foundLocation && !clue.foundLocationId) {
      const lLower = clue.foundLocation.trim().toLowerCase();
      let match = locationsByName.get(lLower);
      if (!match) {
        const fuzzy = (dossier.locations || []).filter(
          (l) => l.name && (l.name.toLowerCase().includes(lLower) || lLower.includes(l.name.toLowerCase()))
        );
        if (fuzzy.length === 1) match = fuzzy[0];
      }
      if (match) {
        clue.foundLocationId = match.id;
        changed = true;
      }
    } else if (clue.foundLocationId && !clue.foundLocation) {
      const match = locationsById.get(clue.foundLocationId);
      if (match) {
        clue.foundLocation = match.name;
        changed = true;
      }
    }

    if (clue.foundLocationId) {
      const loc = locationsById.get(clue.foundLocationId);
      if (loc) {
        if (!loc.discoveredClueIds) loc.discoveredClueIds = [];
        if (!loc.discoveredClueIds.includes(clue.id)) {
          loc.discoveredClueIds.push(clue.id);
          changed = true;
        }
      }
    }
  }

  // 2. Postacie NPC: połącz z Lokacją
  for (const npc of dossier.npcs || []) {
    if (npc.location && !npc.locationId) {
      const lLower = npc.location.trim().toLowerCase();
      let match = locationsByName.get(lLower);
      if (!match) {
        const fuzzy = (dossier.locations || []).filter(
          (l) => l.name && (l.name.toLowerCase().includes(lLower) || lLower.includes(l.name.toLowerCase()))
        );
        if (fuzzy.length === 1) match = fuzzy[0];
      }
      if (match) {
        npc.locationId = match.id;
        changed = true;
      }
    } else if (npc.locationId && !npc.location) {
      const match = locationsById.get(npc.locationId);
      if (match) {
        npc.location = match.name;
        changed = true;
      }
    }

    if (npc.locationId) {
      const loc = locationsById.get(npc.locationId);
      if (loc) {
        if (!loc.npcIds) loc.npcIds = [];
        if (!loc.npcIds.includes(npc.id)) {
          loc.npcIds.push(npc.id);
          changed = true;
        }
      }
    }

    // Sprawdź czy relatedClueIds są dwustronnie zsynchronizowane (bez niszczenia istniejących referencji)
    if (Array.isArray(npc.relatedClueIds)) {
      for (const cId of npc.relatedClueIds) {
        const clue = dossier.clues?.find((c) => c.id === cId);
        if (clue) {
          if (!clue.sourceNpcId || !npcsById.has(clue.sourceNpcId)) {
            clue.sourceNpcId = npc.id;
            clue.sourceNpc = npc.name;
            changed = true;
          }
        }
      }
    }
  }

  // 3. Lokacje: połącz z poszlakami i postaciami (bez niszczenia istniejących referencji)
  for (const loc of dossier.locations || []) {
    if (Array.isArray(loc.discoveredClueIds)) {
      for (const cId of loc.discoveredClueIds) {
        const clue = dossier.clues?.find((c) => c.id === cId);
        if (clue) {
          if (!clue.foundLocationId || !locationsById.has(clue.foundLocationId)) {
            clue.foundLocationId = loc.id;
            clue.foundLocation = loc.name;
            changed = true;
          }
        }
      }
    }

    if (Array.isArray(loc.npcIds)) {
      for (const nId of loc.npcIds) {
        const npc = dossier.npcs?.find((n) => n.id === nId);
        if (npc) {
          if (!npc.locationId || !locationsById.has(npc.locationId)) {
            npc.locationId = loc.id;
            npc.location = loc.name;
            changed = true;
          }
        }
      }
    }
  }

  return changed;
}
