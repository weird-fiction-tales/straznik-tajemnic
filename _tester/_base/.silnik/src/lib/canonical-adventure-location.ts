import { getAdventureById } from './adventures-data';

/** Exact source binding only: never infer a location from prose or another adventure. */
export function isCanonicalAdventureLocation(name: string, adventureId?: string): boolean {
  if (!adventureId || !name || name.length > 120 || /[\r\n\[\]]/.test(name)) return false;
  return getAdventureById(adventureId)?.graph?.locations.some(
    location => name === location.name || name === location.id
  ) ?? false;
}

export function isAcceptedLocationLength(name: string, adventureId?: string): boolean {
  return name.length <= 45 || isCanonicalAdventureLocation(name, adventureId);
}


export interface CanonicalAdventureLocation {
  nodeId: string | null;
  locationId: string;
  name: string;
}
/** Source identifiers and exact labels only; display prose never establishes presence. */
export function resolveCanonicalAdventureLocation(adventureId?: string, reference?: string | null): CanonicalAdventureLocation | null {
  if (!adventureId || !reference) return null;
  const value = reference.trim();
  if (value.length > 120 || /[\r\n\[\]]/.test(value)) return null;
  const graph = getAdventureById(adventureId)?.graph;
  if (!graph) return null;
  const node = graph.nodes?.find(candidate => candidate.id === value);
  const location = node ? graph.locations.find(candidate => candidate.id === node.locationId)
    : graph.locations.find(candidate => candidate.id === value || candidate.name === value);
  if (!location) return null;
  const nodes = graph.nodes?.filter(candidate => candidate.locationId === location.id) ?? [];
  return {nodeId:node?.id ?? (nodes.length === 1 ? nodes[0].id : null),locationId:location.id,name:location.name};
}

export function canonicalSceneIds(binding: CanonicalAdventureLocation | null): string[] {
  return binding ? [...(binding.nodeId ? [binding.nodeId] : []),binding.locationId,binding.name] : [];
}

export interface OffGraphLocationRequest {
  mode: 'off_graph'; label: string; adventureId: string; playthroughId: string;
}
export function isOffGraphLabel(value: unknown): value is string {
  return typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 120 && !/[\x00-\x1f\x7f\[\]|]/.test(value);
}
export function isOffGraphLocationRequest(value: unknown, adventureId?: string, playthroughId?: string): value is OffGraphLocationRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !adventureId || !playthroughId) return false;
  const v = value as Partial<OffGraphLocationRequest>;
  return Object.keys(v).every(key => ['mode','label','adventureId','playthroughId'].includes(key)) &&
    v.mode === 'off_graph' && isOffGraphLabel(v.label) && v.adventureId === adventureId && v.playthroughId === playthroughId;
}
export type AcceptedLocationTag = (CanonicalAdventureLocation & {description: string; mode?: undefined}) |
  {nodeId: null; locationId: null; name: string; description: string; mode: 'off_graph'};

export function extractLatestCanonicalLocationTag(text: string, adventureId?: string): AcceptedLocationTag | null {
  let last: AcceptedLocationTag | null = null;
  for (const match of text.matchAll(/\[(?:LOKACJA|LOCATION):\s*([^:|\]\n]+)(?:[:|]\s*([^\]]*))?\]/gi)) {
    const reference = match[1].trim();
    const label = match[2]?.trim() ?? '';
    if (reference === 'OFF_GRAPH' && isOffGraphLabel(label)) {
      last = {nodeId:null,locationId:null,name:label,description:'',mode:'off_graph'};
    } else {
      const binding = resolveCanonicalAdventureLocation(adventureId,reference);
      if (binding) last = {...binding,description:label};
    }
  }
  return last;
}

export function buildCanonicalLocationInstruction(adventureId: string | undefined, binding: CanonicalAdventureLocation | null, locale: 'pl' | 'en', offGraph?: OffGraphLocationRequest): string {
  const graph = adventureId ? getAdventureById(adventureId)?.graph : undefined;
  if (!graph?.locations.length) return '';
  const entries = graph.locations.map(location => ({locationId:location.id,name:location.name,
    nodeIds:(graph.nodes ?? []).filter(node => node.locationId === location.id).map(node => node.id)}));
  return locale === 'en'
    ? '\n[CANONICAL CURRENT LOCATION]\nConfirmed binding: '+JSON.stringify(offGraph ?? binding)+'.\nSource locations: '+JSON.stringify(entries)+
      '\nOn every turn emit [LOCATION: exact locationId] for the actual current source location. If the player travels to a real place outside the source graph, emit [LOCATION: OFF_GRAPH | short place label] instead. OFF_GRAPH is an explicit non-source location, never an invented source ID; it has no local source NPC or world effects. Returning requires an exact source ID. Stay truthful about travel; never anchor the player to a source location they left. Change it only when the player explicitly moves there; a mention or descriptive adjective is not movement. Never use the initial scene as a fallback. If binding is null, do not invent a position: use the current player declaration and established scene to identify a source location. If it cannot be established, do not invent a tag; the ordinary response will remain uncommitted. A sublocation description does not create a new source ID.\n'
    : '\n[KANONICZNA BIEŻĄCA LOKACJA]\nPotwierdzone powiązanie: '+JSON.stringify(offGraph ?? binding)+'.\nLokacje źródłowe: '+JSON.stringify(entries)+
      '\nW każdej turze emituj [LOKACJA: dokładne locationId] rzeczywistej bieżącej lokacji źródłowej. Jeśli gracz podróżuje do rzeczywistego miejsca poza grafem źródła, emituj [LOKACJA: OFF_GRAPH | krótka nazwa miejsca]. OFF_GRAPH jest jawną lokacją poza źródłem, nie nowym ID; nie udostępnia lokalnych NPC ani efektów świata źródłowej sceny. Powrót wymaga dokładnego ID źródłowego. Nie przypisuj gracza do lokacji źródłowej, którą opuścił. Zmieniaj ją tylko po jawnym ruchu gracza; wzmianka ani przymiotnik opisu nie oznaczają ruchu. Nie wracaj domyślnie do sceny początkowej. Przy null nie wymyślaj położenia: ustal źródłową lokację z bieżącej deklaracji gracza i potwierdzonej sceny. Jeśli nie da się jej ustalić, nie wymyślaj tagu; zwykła odpowiedź pozostanie niezapisana. Opis podlokacji nie tworzy nowego ID źródłowego.\n';
}


/** Validate only explicit source bindings; no prose inference or implicit scene repair. */
export function canonicalLocationProtocolIssues(adventureId: string, current: string | undefined, text: string, offGraph = false): string[] {
  if (!getAdventureById(adventureId)?.graph?.locations.length) return [];
  const issues: string[] = [];
  const tag = /\[(?:LOKACJA|LOCATION):\s*([^:|\]\n]+)(?:[:|]\s*([^\]]*))?\]/gi;
  let valid = false;
  for (const match of text.matchAll(tag)) {
    if (resolveCanonicalAdventureLocation(adventureId, match[1]) || (match[1].trim() === 'OFF_GRAPH' && isOffGraphLabel(match[2]?.trim()))) valid = true;
    else issues.push('DOSSIER_LOCATION_INVALID');
  }
  if (/\[(?:LOKACJA|LOCATION)\b/i.test(text.replace(tag, ''))) issues.push('DOSSIER_LOCATION_INVALID');
  if (!valid && !offGraph && !resolveCanonicalAdventureLocation(adventureId, current)) issues.push('DOSSIER_LOCATION_REQUIRED');
  return [...new Set(issues)];
}
