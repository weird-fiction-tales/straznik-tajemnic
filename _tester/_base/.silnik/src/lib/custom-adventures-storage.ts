/**
 * Custom Adventures Persistent Storage (IND-130 / Issue #419)
 *
 * IndexedDB primary + localStorage fallback dla custom adventures (PDF + AI analysis).
 *
 * Optymalizacja pamięciowa (Issue #419):
 *  - Schemat IndexedDB podniesiony do v2 ze składowaniem per-rekord (`key: adv.id`).
 *  - Kompresja ciężkich struktur (`graph`, `fullNarrativeSummary`, `lorebookData`, `puzzles`, `handouts`)
 *    za pomocą standardowego browserowego `CompressionStream('gzip')` i `DecompressionStream('gzip')`
 *    (lub fallbacku JSON przy braku wsparcia strumieni kompresji).
 *  - 100% wsteczna kompatybilność: legacy rekord `'default'` z v1 jest automatycznie i
 *    bezstratnie migrowany do per-rekordów przy pierwszym odczycie.
 *  - W localStorage trzymana jest wyłącznie ultralekka kopia metadanych (id, title, era,
 *    eraLabel, yearRange, location, country, isCustom, fileName) bez ciężkich grafów,
 *    gwarantując bezpieczeństwo przed przekroczeniem limitu pamięci (DOM QuotaExceededError).
 *  - Bezpieczna hydratacja: odczyt z localStorage / fallbacku automatycznie uzupełnia
 *    wymagane pola (themes, graph, hook, etc.) zapobiegając crashom UI.
 */

import type { CustomAdventure } from './adventures-data';
import type {
  AdventureGraph,
  AdventureNode,
  AdventureNodeType,
  AdventureClue,
  GraphConnection,
  AdventureNPC,
  AdventureLocation,
} from './types';
import { normalizeClueType } from './journal/dossier-types';

export const DB_NAME = 'zew-custom-adventures';
export const DB_VERSION = 2;
export const STORE = 'adventures';
export const LEGACY_RECORD_KEY = 'default';
export const META_RECORD_KEY = '__meta__';
export const STORAGE_KEY = 'custom_adventures';

export interface StoredAdventures {
  adventures: CustomAdventure[];
  activeId: string | null;
}

export interface HeavyAdventureData {
  graph?: AdventureGraph;
  fullNarrativeSummary?: string;
  lorebookData?: unknown;
  puzzles?: unknown[];
  handouts?: unknown[];
  [key: string]: unknown;
}

export interface StoredAdventureRecord {
  id: string; // adv.id
  adventure: CustomAdventure; // Oczyszczona baza bez ciężkich struktur
  compressedPayload?: Uint8Array | string; // Gzip-compressed payload
  rawHeavyPayload?: HeavyAdventureData; // Fallback gdy CompressionStream niedostępny
  isCompressed?: boolean;
  updatedAt: number;
}

export interface StoredMetaRecord {
  id: typeof META_RECORD_KEY;
  activeId: string | null;
  adventureIds: string[];
  updatedAt: number;
}

export interface LegacyStoredRecord extends StoredAdventures {
  id: typeof LEGACY_RECORD_KEY;
  updatedAt: number;
}

export interface LeanAdventureMeta {
  id: string;
  title: string;
  era: CustomAdventure['era'];
  eraLabel: string;
  yearRange: string;
  location: string;
  country: string;
  isCustom: boolean;
  fileName: string;
  tone?: CustomAdventure['tone'];
  documentType?: CustomAdventure['documentType'];
  uploadedAt?: string;
  isAnalyzed?: boolean;
}

export interface StoredLeanAdventures {
  adventures: LeanAdventureMeta[];
  activeId: string | null;
  isLeanBackup?: boolean;
}

interface GlobalStreamEnvironment {
  CompressionStream?: typeof CompressionStream;
  DecompressionStream?: typeof DecompressionStream;
  ReadableStream?: typeof ReadableStream;
  TextEncoder?: typeof TextEncoder;
  TextDecoder?: typeof TextDecoder;
}

function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

export function getCompressionStream(): typeof CompressionStream | undefined {
  if (typeof CompressionStream !== 'undefined') return CompressionStream;
  if (typeof window !== 'undefined') {
    const win = window as unknown as GlobalStreamEnvironment;
    if (win.CompressionStream) return win.CompressionStream;
  }
  if (typeof globalThis !== 'undefined') {
    const gt = globalThis as unknown as GlobalStreamEnvironment;
    if (gt.CompressionStream) return gt.CompressionStream;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const streamWeb = require('stream/web') as GlobalStreamEnvironment;
    if (streamWeb?.CompressionStream) return streamWeb.CompressionStream;
  } catch {}
  return undefined;
}

export function getDecompressionStream():
  | typeof DecompressionStream
  | undefined {
  if (typeof DecompressionStream !== 'undefined') return DecompressionStream;
  if (typeof window !== 'undefined') {
    const win = window as unknown as GlobalStreamEnvironment;
    if (win.DecompressionStream) return win.DecompressionStream;
  }
  if (typeof globalThis !== 'undefined') {
    const gt = globalThis as unknown as GlobalStreamEnvironment;
    if (gt.DecompressionStream) return gt.DecompressionStream;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const streamWeb = require('stream/web') as GlobalStreamEnvironment;
    if (streamWeb?.DecompressionStream) return streamWeb.DecompressionStream;
  } catch {}
  return undefined;
}

export function getReadableStream(): typeof ReadableStream | undefined {
  if (typeof ReadableStream !== 'undefined') return ReadableStream;
  if (typeof window !== 'undefined') {
    const win = window as unknown as GlobalStreamEnvironment;
    if (win.ReadableStream) return win.ReadableStream;
  }
  if (typeof globalThis !== 'undefined') {
    const gt = globalThis as unknown as GlobalStreamEnvironment;
    if (gt.ReadableStream) return gt.ReadableStream;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const streamWeb = require('stream/web') as GlobalStreamEnvironment;
    if (streamWeb?.ReadableStream) return streamWeb.ReadableStream;
  } catch {}
  return undefined;
}

export function getTextEncoder(): typeof TextEncoder {
  if (typeof TextEncoder !== 'undefined') return TextEncoder;
  if (typeof window !== 'undefined') {
    const win = window as unknown as GlobalStreamEnvironment;
    if (win.TextEncoder) return win.TextEncoder;
  }
  if (typeof globalThis !== 'undefined') {
    const gt = globalThis as unknown as GlobalStreamEnvironment;
    if (gt.TextEncoder) return gt.TextEncoder;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const util = require('util') as { TextEncoder?: typeof TextEncoder };
    if (util?.TextEncoder) return util.TextEncoder;
  } catch {}
  return (global as unknown as { TextEncoder: typeof TextEncoder }).TextEncoder;
}

export function getTextDecoder(): typeof TextDecoder {
  if (typeof TextDecoder !== 'undefined') return TextDecoder;
  if (typeof window !== 'undefined') {
    const win = window as unknown as GlobalStreamEnvironment;
    if (win.TextDecoder) return win.TextDecoder;
  }
  if (typeof globalThis !== 'undefined') {
    const gt = globalThis as unknown as GlobalStreamEnvironment;
    if (gt.TextDecoder) return gt.TextDecoder;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const util = require('util') as { TextDecoder?: typeof TextDecoder };
    if (util?.TextDecoder) return util.TextDecoder;
  } catch {}
  return (global as unknown as { TextDecoder: typeof TextDecoder }).TextDecoder;
}

export function isCompressionStreamSupported(): boolean {
  return Boolean(
    getCompressionStream() &&
    getDecompressionStream() &&
    getReadableStream() &&
    getTextEncoder() &&
    getTextDecoder()
  );
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength
    ).toString('base64');
  }
  let binary = '';
  const len = bytes.byteLength;
  const CHUNK_SIZE = 0x8000;
  for (let i = 0; i < len; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(base64, 'base64');
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Kompresuje obiekt JSON za pomocą gzip (CompressionStream).
 * W razie braku wsparcia zwraca null (sygnał dla fallbacku).
 */
export async function compressPayload(
  data: unknown
): Promise<Uint8Array | null> {
  const CS = getCompressionStream();
  const RS = getReadableStream();
  const TE = getTextEncoder();

  if (!CS || !RS || !TE) {
    return null;
  }

  try {
    const jsonString = JSON.stringify(data);
    const encoder = new TE();
    const encodedData = encoder.encode(jsonString);

    const stream = new RS({
      start(controller: ReadableStreamDefaultController<Uint8Array>) {
        controller.enqueue(encodedData);
        controller.close();
      },
    }).pipeThrough(
      new CS('gzip') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>
    );

    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value as Uint8Array);
    }

    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const c of chunks) {
      result.set(c, offset);
      offset += c.length;
    }
    return result;
  } catch (err) {
    console.warn('CompressionStream failed, fallback to raw payload:', err);
    return null;
  }
}

/**
 * Pomocnicza kompresja do Base64
 */
export async function compressPayloadToBase64(
  data: unknown
): Promise<string | null> {
  const bytes = await compressPayload(data);
  return bytes ? uint8ArrayToBase64(bytes) : null;
}

/**
 * Dekompresuje gzip Uint8Array / ArrayBuffer / base64 string z powrotem do obiektu.
 */
export async function decompressPayload<T = unknown>(
  payload: Uint8Array | ArrayBuffer | string
): Promise<T | null> {
  if (!payload) return null;

  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed) as T;
      } catch {
        return null;
      }
    }
    try {
      payload = base64ToUint8Array(trimmed);
    } catch {
      return null;
    }
  }

  const DCS = getDecompressionStream();
  const RS = getReadableStream();
  const TD = getTextDecoder();

  if (!DCS || !RS || !TD) {
    console.warn('DecompressionStream not supported in this environment');
    return null;
  }

  try {
    const inputBytes =
      payload instanceof Uint8Array
        ? payload
        : ArrayBuffer.isView(payload)
          ? new Uint8Array(
              payload.buffer,
              payload.byteOffset,
              payload.byteLength
            )
          : payload instanceof ArrayBuffer
            ? new Uint8Array(payload)
            : null;

    if (!inputBytes) return null;

    const stream = new RS({
      start(controller: ReadableStreamDefaultController<Uint8Array>) {
        controller.enqueue(inputBytes);
        controller.close();
      },
    }).pipeThrough(
      new DCS('gzip') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>
    );

    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value as Uint8Array);
    }

    const decoder = new TD();
    let text = '';
    for (const c of chunks) {
      text += decoder.decode(c, { stream: true });
    }
    text += decoder.decode();

    return JSON.parse(text) as T;
  } catch (err) {
    console.warn('DecompressionStream failed:', err);
    return null;
  }
}

/**
 * Normalizuje graf przygody do modelu The Alexandrian Canon (Issue #502 / Milestone M1).
 *
 * Gwarantuje dwukierunkowa spojnosc:
 * 1. Jesli wezly `nodes` brakuja (np. starszy rekord z IDB lub starszy generator),
 *    generuje je z istniejacych tablic `locations` i `npcs`.
 * 2. Jesli `nodes` sa zdefiniowane, rzutuje je na tablice wsteczne `npcs` i `locations`,
 *    chroniac komponenty UI i hooki czatu przed awaria (brakujace wlasnosci).
 */
export function normalizeAdventureGraph(
  graph: unknown,
  options?: { inferClueType?: boolean }
): AdventureGraph & { nodes: AdventureNode[] } {
  if (!graph || typeof graph !== 'object') {
    return {
      nodes: [],
      clues: [],
      connections: [],
      npcs: [],
      locations: [],
    };
  }

  const raw = graph as Partial<AdventureGraph> & {
    nodes?: AdventureNode[];
    npcs?: AdventureNPC[];
    locations?: AdventureLocation[];
    clues?: AdventureClue[];
    connections?: GraphConnection[];
  };

  const rawNodes = Array.isArray(raw.nodes)
    ? raw.nodes.filter((n): n is AdventureNode =>
        Boolean(n && typeof n === 'object')
      )
    : [];
  const rawClues = Array.isArray(raw.clues)
    ? raw.clues.filter((c): c is AdventureClue =>
        Boolean(c && typeof c === 'object')
      )
    : [];
  const rawConnections = Array.isArray(raw.connections)
    ? raw.connections.filter((conn): conn is GraphConnection =>
        Boolean(conn && typeof conn === 'object')
      )
    : [];
  const rawNpcs = Array.isArray(raw.npcs)
    ? raw.npcs.filter((n): n is AdventureNPC =>
        Boolean(n && typeof n === 'object')
      )
    : [];
  const rawLocations = Array.isArray(raw.locations)
    ? raw.locations.filter((l): l is AdventureLocation =>
        Boolean(l && typeof l === 'object')
      )
    : [];

  const hasNodes = rawNodes.length > 0;

  let nodes: AdventureNode[] = [];
  if (hasNodes) {
    nodes = rawNodes.map((n) => ({
      id: String(n.id || `node-${Math.random().toString(36).substring(2, 9)}`),
      name: String(n.name || 'Nienazwany wezel'),
      type: (n.type as AdventureNodeType) || 'location',
      description: String(n.description || ''),
      leadInClueIds: Array.isArray(n.leadInClueIds) ? n.leadInClueIds : [],
      leadOutClueIds: Array.isArray(n.leadOutClueIds) ? n.leadOutClueIds : [],
      ...(typeof n.isBottleneck === 'boolean'
        ? { isBottleneck: n.isBottleneck }
        : {}),
      ...(typeof n.isClimax === 'boolean'
        ? { isClimax: n.isClimax }
        : n.type === 'climax'
          ? { isClimax: true }
          : {}),
      ...(n.atmosphere ? { atmosphere: n.atmosphere } : {}),
      ...(Array.isArray(n.scenes) ? { scenes: n.scenes } : {}),
      ...(n.secret ? { secret: n.secret } : {}),
      ...(n.statsSummary ? { statsSummary: n.statsSummary } : {}),
      ...(n.locationId ? { locationId: n.locationId } : {}),
      ...(Array.isArray(n.npcIds) ? { npcIds: n.npcIds } : {}),
    }));
  } else if (rawLocations.length > 0 || rawNpcs.length > 0) {
    // Generowanie wezlow ze starych struktur locations i npcs gdy nodes brakuja
    const generatedNodes: AdventureNode[] = [];

    for (const loc of rawLocations) {
      if (!loc || !loc.id) continue;
      const leadInClues = rawConnections
        .filter((c) => c.toId === loc.id && c.clueId)
        .map((c) => c.clueId as string);
      const leadOutClues = rawConnections
        .filter((c) => c.fromId === loc.id && c.clueId)
        .map((c) => c.clueId as string);

      const nameLower = (loc.name || '').toLowerCase();
      const descLower = (loc.description || '').toLowerCase();
      const locRecord = loc as unknown as Record<string, unknown>;
      const isClimax =
        Boolean(locRecord.isClimax) ||
        locRecord.type === 'climax' ||
        nameLower.includes('finał') ||
        nameLower.includes('final') ||
        nameLower.includes('kulminacj') ||
        nameLower.includes('climax') ||
        descLower.includes('finał') ||
        descLower.includes('final') ||
        descLower.includes('kulminacj') ||
        descLower.includes('climax');

      generatedNodes.push({
        id: loc.id,
        name: loc.name || 'Nieznana lokacja',
        type: isClimax ? 'climax' : 'location',
        description: loc.description || '',
        leadInClueIds: leadInClues,
        leadOutClueIds: leadOutClues,
        ...(isClimax ? { isClimax: true } : {}),
        ...(loc.atmosphere ? { atmosphere: loc.atmosphere } : {}),
        locationId: loc.id,
      });
    }

    for (const npc of rawNpcs) {
      if (!npc || !npc.id) continue;
      const leadInClues = rawConnections
        .filter((c) => c.toId === npc.id && c.clueId)
        .map((c) => c.clueId as string);
      const leadOutClues = rawConnections
        .filter((c) => c.fromId === npc.id && c.clueId)
        .map((c) => c.clueId as string);

      generatedNodes.push({
        id: npc.id,
        name: npc.name || 'Nieznany NPC',
        type: 'npc',
        description: npc.description || '',
        leadInClueIds: leadInClues,
        leadOutClueIds: leadOutClues,
        ...(npc.secret ? { secret: npc.secret } : {}),
        ...(npc.statsSummary ? { statsSummary: npc.statsSummary } : {}),
        npcIds: [npc.id],
      });
    }

    nodes = generatedNodes;
  }

  // 2. Rzutowanie npcs i locations z nodes (ochrona komponentow UI)
  const npcs: AdventureNPC[] = [...rawNpcs];
  const existingNpcIds = new Set(npcs.map((n) => n.id));

  for (const node of nodes) {
    if (node.type === 'npc') {
      const npcId = node.npcIds?.[0] || node.id;
      if (!existingNpcIds.has(npcId)) {
        npcs.push({
          id: npcId,
          name: node.name,
          description: node.description,
          ...(node.secret ? { secret: node.secret } : {}),
          ...(node.statsSummary ? { statsSummary: node.statsSummary } : {}),
        });
        existingNpcIds.add(npcId);
      }
    }
  }

  const locations: AdventureLocation[] = [...rawLocations];
  const existingLocIds = new Set(locations.map((l) => l.id));

  for (const node of nodes) {
    if (
      node.type === 'location' ||
      node.type === 'climax' ||
      node.type === 'intro' ||
      node.locationId
    ) {
      const locId = node.locationId || node.id;
      if (!existingLocIds.has(locId)) {
        locations.push({
          id: locId,
          name: node.name,
          description: node.description,
          ...(node.atmosphere ? { atmosphere: node.atmosphere } : {}),
        });
        existingLocIds.add(locId);
      }
    }
  }

  // 3. Normalizacja poszlak (AdventureClue)
  const clues: AdventureClue[] = rawClues.map((c, idx) => {
    const clueId = c.id || `clue-${idx + 1}`;
    const matchingConn = rawConnections.find((conn) => conn.clueId === clueId);
    const targetNodeId = c.targetNodeId || matchingConn?.toId || '';
    const sourceNodeId = c.sourceNodeId || matchingConn?.fromId || undefined;

    return {
      id: clueId,
      name: c.name || `Poszlaka ${idx + 1}`,
      description: c.description || '',
      ...(c.sourceType ? { sourceType: c.sourceType } : {}),
      ...(c.clueType
        ? { clueType: normalizeClueType({ clueType: c.clueType }) }
        : options?.inferClueType
          ? { clueType: normalizeClueType({ ...c, targetNodeId }) }
          : {}),
      ...(targetNodeId ? { targetNodeId } : {}),
      ...(sourceNodeId ? { sourceNodeId } : {}),
      ...(c.requiredSkill ? { requiredSkill: c.requiredSkill } : {}),
      ...(typeof c.isRedHerring === 'boolean'
        ? { isRedHerring: c.isRedHerring }
        : {}),
      ...(typeof c.isSynthesized === 'boolean'
        ? { isSynthesized: c.isSynthesized }
        : {}),
    };
  });

  // 4. Normalizacja polaczen (GraphConnection)
  const connections: GraphConnection[] = rawConnections.map((conn) => ({
    fromId: conn.fromId || '',
    toId: conn.toId || '',
    description: conn.description || '',
    ...(conn.clueId ? { clueId: conn.clueId } : {}),
  }));

  return {
    nodes,
    clues,
    connections,
    npcs,
    locations,
  };
}

/**
 * Sanityzacja i wyodrebnienie ciezkich struktur przygody przed zapisem w pamieci (Issue #419, M1).
 * Alias kompatybilnosciowy dla extractHeavyData.
 */
export const sanitizeCustomAdventureForStorage = extractHeavyData;

/**
 * Wyodrębnia ciężkie struktury (graf, syntezę narracyjną, lorebook, zagadki, wycinki handoutów) z przygody
 * i tworzy prawdziwie oczyszczony obiekt bazy leanAdv.
 */
export function extractHeavyData(adv: CustomAdventure): {
  leanAdv: CustomAdventure;
  heavyData: HeavyAdventureData;
  hasHeavy: boolean;
} {
  const anyAdv = adv as unknown as Record<string, unknown>;
  const { graph, lorebookData, puzzles, handouts, ...rest } = anyAdv;

  const fullNarrativeSummary =
    typeof rest.fullNarrativeSummary === 'string'
      ? (rest.fullNarrativeSummary as string)
      : undefined;
  delete rest.fullNarrativeSummary;

  const heavyData: HeavyAdventureData = {};
  let hasHeavy = false;

  if (
    graph &&
    typeof graph === 'object' &&
    ((graph as AdventureGraph).nodes?.length ||
      (graph as AdventureGraph).locations?.length ||
      (graph as AdventureGraph).npcs?.length ||
      (graph as AdventureGraph).clues?.length ||
      (graph as AdventureGraph).connections?.length)
  ) {
    heavyData.graph = normalizeAdventureGraph(graph);
    hasHeavy = true;
  }

  if (fullNarrativeSummary) {
    heavyData.fullNarrativeSummary = fullNarrativeSummary;
    hasHeavy = true;
  }

  if (lorebookData) {
    heavyData.lorebookData = lorebookData;
    hasHeavy = true;
  }

  if (Array.isArray(puzzles) && puzzles.length > 0) {
    heavyData.puzzles = puzzles;
    hasHeavy = true;
  }

  if (Array.isArray(handouts) && handouts.length > 0) {
    heavyData.handouts = handouts;
    hasHeavy = true;
  }

  const leanAdv = {
    ...rest,
    graph: { nodes: [], npcs: [], locations: [], clues: [], connections: [] },
  } as unknown as CustomAdventure;

  return { leanAdv, heavyData, hasHeavy };
}

/**
 * Uzupełnia brakujące pola w ultralekkiej kopii metadanych, gwarantując bezpieczne
 * uruchomienie komponentów UI i promptów AI bez błędów undefined.
 */
export function hydrateLeanAdventure(
  raw: Partial<CustomAdventure>
): CustomAdventure {
  const era = raw.era || 'classic';
  return {
    id: raw.id || `custom-${Date.now()}`,
    title: raw.title || 'Niezatytułowana przygoda',
    era,
    eraLabel:
      raw.eraLabel ||
      (era === 'gaslight'
        ? 'Wiktoriańska Anglia'
        : era === 'prl'
          ? 'Polska Rzeczpospolita Ludowa'
          : era === 'noir'
            ? 'Lata 30. / Noir'
            : era === 'modern'
              ? 'Współczesność'
              : 'Klasyczne lata 20.'),
    yearRange: raw.yearRange || '1920-1929',
    location: raw.location || 'Arkham / Massachusetts',
    country: raw.country || 'USA',
    tone: raw.tone || 'purist',
    themes:
      Array.isArray(raw.themes) && raw.themes.length > 0
        ? raw.themes
        : ['tajemnica', 'śledztwo'],
    suggestedOccupations:
      Array.isArray(raw.suggestedOccupations) &&
      raw.suggestedOccupations.length > 0
        ? raw.suggestedOccupations
        : ['detektyw', 'dziennikarz'],
    suggestedArchetypes:
      Array.isArray(raw.suggestedArchetypes) &&
      raw.suggestedArchetypes.length > 0
        ? raw.suggestedArchetypes
        : ['investigator'],
    hook:
      raw.hook ||
      `Śledztwo w sprawie "${raw.title || 'tajemnicy'}" czeka na odkrycie.`,
    description: raw.description || '',
    estimatedSessions: raw.estimatedSessions || '2-3',
    playerCount: raw.playerCount || '1-4',
    difficulty: raw.difficulty || 'normal',
    isCustom: true,
    pdfUrl: raw.pdfUrl || '',
    geminiFileUri: raw.geminiFileUri || '',
    fileName: raw.fileName || '',
    uploadedAt: raw.uploadedAt || new Date().toISOString(),
    isAnalyzed: raw.isAnalyzed ?? true,
    graph:
      raw.graph && typeof raw.graph === 'object'
        ? normalizeAdventureGraph(raw.graph)
        : { nodes: [], npcs: [], locations: [], clues: [], connections: [] },
    documentType: raw.documentType || 'scenario',
    lorebookData: raw.lorebookData,
    attachedLorebookIds: raw.attachedLorebookIds || [],
    ...(typeof (raw as Record<string, unknown>).fullNarrativeSummary ===
    'string'
      ? {
          fullNarrativeSummary: (raw as Record<string, unknown>)
            .fullNarrativeSummary as string,
        }
      : {}),
    ...(raw.puzzles ? { puzzles: raw.puzzles } : {}),
    ...(raw.handouts ? { handouts: raw.handouts } : {}),
  };
}

/**
 * Rekonstruuje pełną przygodę z rekordu magazynu IDB
 */
export async function reconstructAdventure(
  record: StoredAdventureRecord | CustomAdventure
): Promise<CustomAdventure> {
  if (!('adventure' in record)) {
    return hydrateLeanAdventure(record as CustomAdventure);
  }

  const rec = record as StoredAdventureRecord;
  let heavyData: HeavyAdventureData | null = null;

  if (rec.isCompressed && rec.compressedPayload) {
    heavyData = await decompressPayload<HeavyAdventureData>(
      rec.compressedPayload
    );
  } else if (rec.rawHeavyPayload) {
    heavyData = rec.rawHeavyPayload;
  }

  const base = rec.adventure || ({} as CustomAdventure);
  const hydrated = hydrateLeanAdventure(base);

  return {
    ...hydrated,
    ...(heavyData?.graph
      ? { graph: normalizeAdventureGraph(heavyData.graph) }
      : {}),

    ...(heavyData?.fullNarrativeSummary
      ? { fullNarrativeSummary: heavyData.fullNarrativeSummary }
      : {}),
    ...(heavyData?.lorebookData
      ? {
          lorebookData:
            heavyData.lorebookData as CustomAdventure['lorebookData'],
        }
      : {}),
    ...(heavyData?.puzzles
      ? { puzzles: heavyData.puzzles as CustomAdventure['puzzles'] }
      : {}),
    ...(heavyData?.handouts
      ? { handouts: heavyData.handouts as CustomAdventure['handouts'] }
      : {}),
  };
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
  });

  return dbPromise;
}

/**
 * Tworzy rekord IDB dla pojedynczej przygody (z kompresją jeśli dostępna)
 */
async function createAdventureRecord(
  adv: CustomAdventure
): Promise<StoredAdventureRecord> {
  const { leanAdv, heavyData, hasHeavy } = extractHeavyData(adv);

  if (hasHeavy) {
    const compressed = await compressPayload(heavyData);
    if (compressed) {
      return {
        id: adv.id,
        adventure: leanAdv,
        compressedPayload: compressed,
        isCompressed: true,
        updatedAt: Date.now(),
      };
    }
    return {
      id: adv.id,
      adventure: leanAdv,
      rawHeavyPayload: heavyData,
      isCompressed: false,
      updatedAt: Date.now(),
    };
  }

  return {
    id: adv.id,
    adventure: leanAdv,
    isCompressed: false,
    updatedAt: Date.now(),
  };
}

async function readFromIndexedDB(): Promise<StoredAdventures | null> {
  try {
    const db = await openDB();

    // 1. Sprawdź czy istnieje legacy rekord 'default' (migracja z v1)
    const legacyRecord = await new Promise<LegacyStoredRecord | null>(
      (resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(LEGACY_RECORD_KEY);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          resolve((req.result as LegacyStoredRecord) || null);
        };
      }
    );

    if (legacyRecord && Array.isArray(legacyRecord.adventures)) {
      console.log(
        `🔄 Migracja IndexedDB v1 -> v2: konwersja ${legacyRecord.adventures.length} przygód do modelu per-rekord...`
      );

      // Migrujemy dane do nowego formatu (writeToIndexedDB automatycznie usuwa 'default')
      await writeToIndexedDB({
        adventures: legacyRecord.adventures,
        activeId: legacyRecord.activeId ?? null,
      });

      return {
        adventures: legacyRecord.adventures,
        activeId: legacyRecord.activeId ?? null,
      };
    }

    // 2. Czytamy rekord metadanych __meta__
    const metaRecord = await new Promise<StoredMetaRecord | null>(
      (resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(META_RECORD_KEY);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          resolve((req.result as StoredMetaRecord) || null);
        };
      }
    );

    if (metaRecord && Array.isArray(metaRecord.adventureIds)) {
      const total = metaRecord.adventureIds.length;
      if (total === 0) {
        return {
          adventures: [],
          activeId: metaRecord.activeId ?? null,
        };
      }

      // Pobieramy wszystkie rekordy w JEDNEJ transakcji dla maksymalnej wydajności
      const rawRecords = await new Promise<
        (StoredAdventureRecord | CustomAdventure | null)[]
      >((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const store = tx.objectStore(STORE);
        const results: (StoredAdventureRecord | CustomAdventure | null)[] =
          new Array(total);
        let completed = 0;

        for (let i = 0; i < total; i++) {
          const req = store.get(metaRecord.adventureIds[i]);
          req.onsuccess = () => {
            results[i] =
              (req.result as StoredAdventureRecord | CustomAdventure) || null;
            completed++;
            if (completed === total) resolve(results);
          };
          req.onerror = () => reject(req.error);
        }
        tx.onerror = () => reject(tx.error);
      });

      const adventures: CustomAdventure[] = [];
      for (const rawRec of rawRecords) {
        if (rawRec) {
          const adv = await reconstructAdventure(rawRec);
          adventures.push(adv);
        }
      }

      return {
        adventures,
        activeId: metaRecord.activeId ?? null,
      };
    }

    // 3. Fallback: jeśli __meta__ brak, ale są pojedyncze rekordy w store
    const allRecords = await new Promise<StoredAdventureRecord[]>(
      (resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const store = tx.objectStore(STORE);
        if (typeof store.getAll === 'function') {
          const req = store.getAll();
          req.onerror = () => reject(req.error);
          req.onsuccess = () =>
            resolve((req.result as StoredAdventureRecord[]) || []);
        } else {
          resolve([]);
        }
      }
    );

    const adventureRecords = allRecords.filter(
      (r) => r && r.id && r.id !== META_RECORD_KEY && r.id !== LEGACY_RECORD_KEY
    );

    if (adventureRecords.length > 0) {
      const adventures: CustomAdventure[] = [];
      for (const rec of adventureRecords) {
        adventures.push(await reconstructAdventure(rec));
      }
      return {
        adventures,
        activeId: null,
      };
    }

    return null;
  } catch (error) {
    console.warn('IndexedDB read failed, will fallback to localStorage', error);
    return null;
  }
}

async function writeToIndexedDB(data: StoredAdventures): Promise<void> {
  try {
    const db = await openDB();

    // Przygotuj skompresowane rekordy przed otwarciem transakcji (operacje async)
    const recordsToPut: StoredAdventureRecord[] = [];
    for (const adv of data.adventures) {
      recordsToPut.push(await createAdventureRecord(adv));
    }

    const metaRecord: StoredMetaRecord = {
      id: META_RECORD_KEY,
      activeId: data.activeId,
      adventureIds: data.adventures.map((a) => a.id),
      updatedAt: Date.now(),
    };

    const currentIds = new Set(data.adventures.map((a) => a.id));

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);

      // 1. Zapisz rekord metadanych
      store.put(metaRecord);

      // 2. Zapisz każdy rekord przygody
      for (const record of recordsToPut) {
        store.put(record);
      }

      // 3. Natychmiast usuń legacy 'default' jeśli istnieje
      store.delete(LEGACY_RECORD_KEY);

      // 4. Usuń przestarzałe/usunięte rekordy przygód
      if (typeof store.getAllKeys === 'function') {
        const keysReq = store.getAllKeys();
        keysReq.onsuccess = () => {
          const keys = keysReq.result || [];
          for (const key of keys) {
            const keyStr = String(key);
            if (keyStr === LEGACY_RECORD_KEY) {
              store.delete(key);
            } else if (keyStr !== META_RECORD_KEY && !currentIds.has(keyStr)) {
              store.delete(key);
            }
          }
        };
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.warn(
      'IndexedDB write failed (localStorage backup nadal aktywne)',
      error
    );
  }
}

function toLeanMeta(adv: CustomAdventure): LeanAdventureMeta {
  return {
    id: adv.id,
    title: adv.title,
    era: adv.era,
    eraLabel: adv.eraLabel,
    yearRange: adv.yearRange,
    location: adv.location,
    country: adv.country,
    isCustom: Boolean(adv.isCustom),
    fileName: adv.fileName || '',
    tone: adv.tone,
    documentType: adv.documentType,
    uploadedAt: adv.uploadedAt,
    isAnalyzed: adv.isAnalyzed,
  };
}

function updateLocalStorageRecord(adv: CustomAdventure): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as StoredLeanAdventures) : null;
    const adventures =
      parsed && Array.isArray(parsed.adventures) ? parsed.adventures : [];
    const idx = adventures.findIndex((a) => a.id === adv.id);
    const lean = toLeanMeta(adv);
    if (idx >= 0) {
      adventures[idx] = lean;
    } else {
      adventures.push(lean);
    }
    const payload: StoredLeanAdventures = {
      adventures,
      activeId: parsed?.activeId ?? null,
      isLeanBackup: true,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('updateLocalStorageRecord failed', err);
  }
}

function removeLocalStorageRecord(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as StoredLeanAdventures) : null;
    if (!parsed || !Array.isArray(parsed.adventures)) return;
    const adventures = parsed.adventures.filter((a) => a.id !== id);
    const activeId = parsed.activeId === id ? null : parsed.activeId;
    const payload: StoredLeanAdventures = {
      adventures,
      activeId,
      isLeanBackup: true,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('removeLocalStorageRecord failed', err);
  }
}

/**
 * Zapisuje pojedynczy rekord przygody w IndexedDB (dla szybkiej aktualizacji)
 */
export async function saveAdventureRecord(adv: CustomAdventure): Promise<void> {
  try {
    const db = await openDB();
    const record = await createAdventureRecord(adv);

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      store.put(record);

      // Uaktualnij listę w __meta__ jeśli brak
      const metaReq = store.get(META_RECORD_KEY);
      metaReq.onsuccess = () => {
        const meta = (metaReq.result as StoredMetaRecord) || {
          id: META_RECORD_KEY,
          activeId: null,
          adventureIds: [],
          updatedAt: Date.now(),
        };
        if (!meta.adventureIds.includes(adv.id)) {
          meta.adventureIds.push(adv.id);
          meta.updatedAt = Date.now();
          store.put(meta);
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    updateLocalStorageRecord(adv);
  } catch (err) {
    console.warn('saveAdventureRecord failed:', err);
  }
}

/**
 * Wczytuje pojedynczą przygodę bezpośrednio po kluczu id
 */
export async function loadAdventureRecord(
  id: string
): Promise<CustomAdventure | null> {
  try {
    const db = await openDB();
    const rawRec = await new Promise<
      StoredAdventureRecord | CustomAdventure | null
    >((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(id);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        resolve(
          (req.result as StoredAdventureRecord | CustomAdventure) || null
        );
      };
    });

    if (!rawRec) return null;
    return await reconstructAdventure(rawRec);
  } catch (err) {
    console.warn(`loadAdventureRecord(${id}) failed:`, err);
    return null;
  }
}

/**
 * Usuwa pojedynczą przygodę z IndexedDB po kluczu id
 */
export async function deleteAdventureRecord(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      store.delete(id);

      const metaReq = store.get(META_RECORD_KEY);
      metaReq.onsuccess = () => {
        const meta = metaReq.result as StoredMetaRecord | undefined;
        if (meta && Array.isArray(meta.adventureIds)) {
          meta.adventureIds = meta.adventureIds.filter((item) => item !== id);
          if (meta.activeId === id) meta.activeId = null;
          meta.updatedAt = Date.now();
          store.put(meta);
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    removeLocalStorageRecord(id);
  } catch (err) {
    console.warn(`deleteAdventureRecord(${id}) failed:`, err);
  }
}

function readFromLocalStorage(): StoredAdventures | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Array.isArray((parsed as StoredAdventures).adventures)
    ) {
      console.warn(
        'custom_adventures localStorage corrupt (invalid shape), resetting'
      );
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    const obj = parsed as StoredAdventures;
    const adventures = obj.adventures.map((a) => hydrateLeanAdventure(a));
    return {
      adventures,
      activeId: typeof obj.activeId === 'string' ? obj.activeId : null,
    };
  } catch (error) {
    console.warn(
      'custom_adventures localStorage parse error, resetting',
      error
    );
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

/**
 * Zapisuje ultralekką kopię metadanych do localStorage (poniżej limitu quota)
 */
function writeToLocalStorage(data: StoredAdventures): void {
  if (typeof window === 'undefined') return;
  try {
    const leanAdventures: LeanAdventureMeta[] = data.adventures.map(toLeanMeta);

    const leanPayload: StoredLeanAdventures = {
      adventures: leanAdventures,
      activeId: data.activeId,
      isLeanBackup: true,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(leanPayload));
  } catch (error) {
    console.warn('localStorage lean write failed', error);
  }
}

/**
 * Load custom adventures. IndexedDB primary, localStorage fallback.
 * 1-time migration: jeśli IndexedDB pusty a localStorage ma dane (stary format) → kopiuj.
 */
export async function loadCustomAdventures(): Promise<StoredAdventures> {
  const empty: StoredAdventures = { adventures: [], activeId: null };

  const fromIDB = await readFromIndexedDB();
  if (fromIDB) {
    // Mirror do localStorage dla offline/fallback resilience
    writeToLocalStorage(fromIDB);
    return fromIDB;
  }

  const fromLS = readFromLocalStorage();
  if (fromLS) {
    // Migracja jednorazowa do IndexedDB TYLKO gdy localStorage zawierał stare pełne dane (nie lean backup)
    const raw =
      typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    let isLean = false;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as StoredLeanAdventures;
        isLean = Boolean(parsed?.isLeanBackup);
      } catch {}
    }
    if (!isLean) {
      void writeToIndexedDB(fromLS);
    }
    return fromLS;
  }

  return empty;
}

/**
 * Save custom adventures. Defense-in-depth: pisz do IndexedDB + ultralekkie metadane do localStorage.
 */
export async function saveCustomAdventures(
  data: StoredAdventures
): Promise<void> {
  writeToLocalStorage(data);
  await writeToIndexedDB(data);
}

/**
 * Export jako JSON string do manualnego backupu.
 */
export function exportAsJSON(data: StoredAdventures): string {
  return JSON.stringify(
    { version: 1, exportedAt: new Date().toISOString(), ...data },
    null,
    2
  );
}

/**
 * Parse import JSON string. Zwraca null jeśli kształt nieprawidłowy.
 */
export function parseImportJSON(json: string): StoredAdventures | null {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Array.isArray((parsed as StoredAdventures).adventures)
    ) {
      return null;
    }
    const obj = parsed as StoredAdventures;
    return {
      adventures: obj.adventures.map((a) => hydrateLeanAdventure(a)),
      activeId: typeof obj.activeId === 'string' ? obj.activeId : null,
    };
  } catch {
    return null;
  }
}

/**
 * Reset module-level cache. Tylko dla testów.
 */
export function _resetDBCache(): void {
  dbPromise = null;
}
