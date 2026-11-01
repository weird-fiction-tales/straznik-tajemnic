import source from '../../../../../../../data/adventures/predefined/cien-nad-prabutami.json';
import presets from './light-presets.json';
export type LightingEffect = 'sanity-loss' | 'gunshot' | 'thunder' | 'anomaly';
export interface LightingAccent {
  id: string;
  trigger: LightingEffect | 'authored';
  effectId: LightingEffect;
  returnToBase: true;
}
export interface LightingScene {
  sceneId: string;
  nodeId: string;
  name: { pl: string; en: string };
  aliases: string[];
  lighting: {
    mode: 'preset' | 'keep';
    presetId: string;
    brightness: number;
    transitionMs: number;
    accents: LightingAccent[];
  };
}
const normalize = (s: string) =>
  s
    .toLocaleLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
export function validateLightingScenes(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length) return ['MISSING_SCENES'];
  const issues: string[] = [];
  const ids = new Set<string>();
  for (const item of value) {
    const s = item as Partial<LightingScene>;
    if (!s || typeof s.sceneId !== 'string' || ids.has(s.sceneId)) {
      issues.push('INVALID_SCENE_ID');
      continue;
    }
    ids.add(s.sceneId);
    if (
      typeof s.nodeId !== 'string' ||
      !source.nodes.some((n) => n.id === s.nodeId) ||
      typeof s.name?.pl !== 'string' ||
      typeof s.name?.en !== 'string' ||
      !s.name.pl ||
      !s.name.en ||
      !Array.isArray(s.aliases) ||
      s.aliases.some((a) => typeof a !== 'string')
    )
      issues.push(s.sceneId + ':INCOMPLETE');
    const l = s.lighting;
    if (
      !l ||
      !['preset', 'keep'].includes(l.mode) ||
      !(l.presetId in presets.presets) ||
      !Number.isFinite(l.brightness) ||
      l.brightness < 0 ||
      l.brightness > 100 ||
      !Number.isFinite(l.transitionMs) ||
      l.transitionMs < 0 ||
      !Array.isArray(l.accents)
    ) {
      issues.push(s.sceneId + ':INVALID_LIGHTING');
      continue;
    }
    const accents = new Set<string>();
    for (const a of l.accents) {
      if (
        !a.id ||
        accents.has(a.id) ||
        !['sanity-loss', 'gunshot', 'thunder', 'authored'].includes(
          a.trigger
        ) ||
        !['sanity-loss', 'gunshot', 'thunder', 'anomaly'].includes(
          a.effectId
        ) ||
        a.returnToBase !== true
      )
        issues.push(s.sceneId + ':INVALID_ACCENT');
      accents.add(a.id);
    }
  }
  return issues;
}
export const PRABUTY_SCENES: LightingScene[] = source.nodes.flatMap(
  (n) => n.scenes
) as LightingScene[];
export function resolveLightingScene(id: string): LightingScene | undefined {
  const key = normalize(id);
  return PRABUTY_SCENES.find(
    (s) =>
      normalize(s.sceneId) === key ||
      s.aliases.some((a) => normalize(a) === key)
  );
}
export function scenesForNode(id: string): LightingScene[] {
  return PRABUTY_SCENES.filter((s) => s.nodeId === id);
}
