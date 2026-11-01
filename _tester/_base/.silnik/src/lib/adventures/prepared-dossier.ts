import type { AdventureHandout } from '../adventures-data';

export type DossierLocale = 'pl' | 'en';
export interface PreparedHandout extends AdventureHandout {
  sourceNumber?: number;
  sourcePages: number[];
  provenance: 'source_derived' | 'approved_design';
  reveal: {
    sceneId: string;
    checks: string[];
    requires: string[];
    action: string;
  };
  illustration?: string;
}
export interface PreparedScene {
  id: string;
  title: string;
  sourcePages: number[];
  entry: string;
  atmosphere: string;
  actorIds: string[];
  knowledge: string[];
  actions: string[];
  checks: Array<{
    id: string;
    test: string;
    success: string;
    failure: string;
    pushedFailure?: string;
  }>;
  handoutSlugs: string[];
  audioIds: string[];
  exits: string[];
  director: string;
}
export interface PreparedActor {
  id: string;
  name: string;
  sceneIds: string[];
  description: string;
  knowledge: string;
  behaviour: string;
  portrait?: string;
  stats?: string;
  sourcePages: number[];
  voice: string;
}
export interface PreparedAudio {
  id: string;
  sceneId: string;
  trigger: string;
  kind: 'briefing' | 'performance' | 'reading' | 'ambience' | 'sfx';
  status: 'needs_review' | 'replace' | 'missing';
  sourcePages: number[];
  files: Partial<Record<DossierLocale, string>>;
  scripts: Record<DossierLocale, string>;
  seconds: number;
  notes: string;
}
export interface PreparedDossier {
  schemaVersion: 1;
  adventureId: string;
  editionId: string;
  locale: DossierLocale;
  approval: 'pending';
  source: { url: string; sha256: string; printedPageOffset: number };
  handouts: PreparedHandout[];
  actors: PreparedActor[];
  scenes: PreparedScene[];
  endings: Array<{
    id: string;
    sourcePages: number[];
    condition: string;
    consequence: string;
  }>;
  audio: PreparedAudio[];
  rooms: Array<{
    id: string;
    sceneId: string;
    sourcePages: number[];
    description: string;
  }>;
  rules: Array<{ id: string; sourcePages: number[]; text: string }>;
  unresolved: Array<{ id: string; sourcePages: number[]; description: string }>;
}
export interface PreparedDiscovery {
  sceneId: string;
  acquired: string[];
  checks: string[];
}

/** Eligibility is data, not an instruction to publish or acquire the material. */
export function eligibleDossierHandouts(
  dossier: PreparedDossier,
  state: PreparedDiscovery
): PreparedHandout[] {
  const acquired = new Set(state.acquired),
    checks = new Set(state.checks);
  return dossier.handouts.filter(
    (h) =>
      !h.keeperOnly &&
      h.isPlayerFacing !== false &&
      !acquired.has(h.slug) &&
      h.reveal.sceneId === state.sceneId &&
      h.reveal.requires.every((id) => acquired.has(id)) &&
      h.reveal.checks.every((id) => checks.has(id))
  );
}

export function validatePreparedDossier(d: PreparedDossier): string[] {
  const errors: string[] = [];
  const unique = (values: string[], label: string) => {
    if (new Set(values).size !== values.length)
      errors.push(`${label}: duplicate identity`);
  };
  unique(
    d.handouts.map((h) => h.slug),
    'handouts'
  );
  unique(
    d.scenes.map((s) => s.id),
    'scenes'
  );
  unique(
    d.actors.map((a) => a.id),
    'actors'
  );
  unique(
    d.audio.map((a) => a.id),
    'audio'
  );
  unique(
    d.endings.map((e) => e.id),
    'endings'
  );
  unique(
    d.rules.map((r) => r.id),
    'rules'
  );
  unique(
    d.rooms.map((r) => r.id),
    'rooms'
  );
  const scenes = new Set(d.scenes.map((s) => s.id)),
    actors = new Set(d.actors.map((a) => a.id));
  const handouts = new Set(d.handouts.map((h) => h.slug)),
    audio = new Set(d.audio.map((a) => a.id));
  const checks = new Set(d.scenes.flatMap((s) => s.checks.map((c) => c.id)));
  const pages = (values: number[], id: string) => {
    if (
      !values.length ||
      values.some((p) => !Number.isInteger(p) || p < 15 || p > 30)
    )
      errors.push(`${id}: missing source page`);
  };
  for (const s of d.scenes) {
    pages(s.sourcePages, s.id);
    if (![s.title, s.entry, s.atmosphere, s.director].every((t) => t.trim()))
      errors.push(`${s.id}: incomplete scene`);
    for (const id of s.actorIds)
      if (!actors.has(id)) errors.push(`${s.id}: missing actor ${id}`);
    for (const id of s.handoutSlugs)
      if (!handouts.has(id)) errors.push(`${s.id}: missing handout ${id}`);
    for (const id of s.audioIds)
      if (!audio.has(id)) errors.push(`${s.id}: missing audio ${id}`);
    for (const id of s.exits)
      if (!scenes.has(id)) errors.push(`${s.id}: missing exit ${id}`);
  }
  for (const h of d.handouts) {
    pages(h.sourcePages, h.slug);
    if (!scenes.has(h.reveal.sceneId) || h.nodeId !== h.reveal.sceneId)
      errors.push(`${h.slug}: invalid scene binding`);
    for (const id of h.reveal.requires)
      if (!handouts.has(id))
        errors.push(`${h.slug}: missing prerequisite ${id}`);
    for (const id of h.reveal.checks)
      if (!checks.has(id)) errors.push(`${h.slug}: missing check ${id}`);
    if (!h.title.trim() || !h.textContent?.trim() || !h.image)
      errors.push(`${h.slug}: missing content`);
  }
  for (const a of d.actors) {
    pages(a.sourcePages, a.id);
    for (const id of a.sceneIds)
      if (!scenes.has(id)) errors.push(`${a.id}: invalid scene`);
  }
  for (const a of d.audio) {
    pages(a.sourcePages, a.id);
    if (!scenes.has(a.sceneId) || !a.scripts.pl.trim() || !a.scripts.en.trim())
      errors.push(`${a.id}: incomplete audio brief`);
    if (!d.scenes.find((s) => s.id === a.sceneId)?.audioIds.includes(a.id))
      errors.push(`${a.id}: orphan audio brief`);
  }
  for (const r of d.rules) pages(r.sourcePages, r.id);
  for (const r of d.rooms) {
    pages(r.sourcePages, r.id);
    if (!scenes.has(r.sceneId) || !r.description.trim())
      errors.push(`${r.id}: invalid room`);
  }
  for (const e of d.endings) {
    pages(e.sourcePages, e.id);
    if (!e.condition || !e.consequence)
      errors.push(`${e.id}: incomplete ending`);
  }
  if (!/^[a-f0-9]{64}$/.test(d.source.sha256))
    errors.push('source: invalid fingerprint');
  return errors;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Deterministic typesetting: visible text and transcription have one source. No model output. */
export function documentSvg(
  title: string,
  text: string,
  symbol = false
): string {
  const wrap = (value: string, width: number) =>
    value.split('\n').flatMap((p) => {
      const lines: string[] = [];
      let line = '';
      for (const word of p.split(/\s+/)) {
        if ((line + ' ' + word).trim().length > width && line) {
          lines.push(line);
          line = '';
        }
        line = (line + ' ' + word).trim();
      }
      lines.push(line);
      return lines;
    });
  const titles = wrap(title, 55),
    lines = wrap(text, 78),
    start = 95 + titles.length * 44;
  const height = Math.max(740, start + lines.length * 38 + (symbol ? 290 : 80));
  const glyph = symbol
    ? `<g transform="translate(560 ${start + lines.length * 38 + 20})" fill="none" stroke="#30251d" stroke-width="6" stroke-linecap="round"><path d="M120 10V55L85 115M120 55L155 115M10 205L45 185L80 125M45 185H112M230 205L195 185L160 125M195 185H128"/><path d="M85 135Q120 105 155 135Q120 165 85 135Z"/><circle cx="120" cy="135" r="11" fill="#30251d"/></g>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="${height}" viewBox="0 0 1400 ${height}"><rect width="1400" height="${height}" fill="#e7d6b7"/><rect x="35" y="35" width="1330" height="${height - 70}" fill="none" stroke="#756046" stroke-width="2"/><g fill="#30251d" font-family="Georgia,serif">${titles.map((s, i) => `<text x="85" y="${95 + i * 44}" font-size="34" font-weight="bold">${escapeXml(s)}</text>`).join('')}<path d="M85 ${start - 18}H1315" stroke="#756046"/>${lines.map((s, i) => `<text x="85" y="${start + 34 + i * 38}" font-size="27">${escapeXml(s)}</text>`).join('')}</g>${glyph}</svg>`;
}

export function documentImage(
  title: string,
  text: string,
  symbol = false
): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(documentSvg(title, text, symbol))}`;
}
