import { PRABUTY_SCENES, resolveLightingScene } from './score';
import type { LightingEffect } from './score';
export type ParsedLightCue = {
  id: string;
  kind: 'scene' | 'end' | 'effect';
  value: string;
  anchor: string;
  committed: boolean;
};
export class CueParser {
  private seen = new Set<string>();
  feed(messageId: string, text: string): ParsedLightCue[] {
    const cues: ParsedLightCue[] = [];
    for (const match of text.matchAll(
      /\[(SCENA|SCENE|CUE|SANITY|KONIEC_SESJI):([^\]]+)\]/gi
    )) {
      const id = messageId + ':' + match.index;
      if (this.seen.has(id)) continue;
      const tag = match[1].toUpperCase(),
        value = match[2].trim();
      const before = text
        .slice(0, match.index)
        .replace(/\[[^\]]*\]/g, '')
        .trim();
      const after = text
        .slice(match.index! + match[0].length)
        .replace(/\[[^\]]*\]/g, '')
        .trim();
      const anchor = (
        before
          .split(/[.!?\n]/)
          .filter(Boolean)
          .at(-1)
          ?.slice(-60) ||
        after.slice(0, 60) ||
        ''
      ).trim();
      if (tag === 'SCENA' || tag === 'SCENE') {
        const scene = resolveLightingScene(value);
        if (!scene) continue;
        this.seen.add(id);
        cues.push({
          id,
          kind: 'scene',
          value: scene.sceneId,
          anchor,
          committed: true,
        });
      } else if (tag === 'CUE') {
        const accent = PRABUTY_SCENES.flatMap((s) => s.lighting.accents).find(
          (a) => a.id === value
        );
        if (!accent) continue;
        // Wait until some spoken text is available to anchor this cue.
        if (!anchor) continue;
        this.seen.add(id);
        cues.push({
          id,
          kind: 'effect',
          value: accent.id,
          anchor,
          committed: true,
        });
      } else if (tag === 'SANITY' && /^(?:@[^:]+:\s*)?-\d+/.test(value)) {
        if (!anchor) continue;
        this.seen.add(id);
        cues.push({
          id,
          kind: 'effect',
          value: 'sanity-loss' satisfies LightingEffect,
          anchor,
          committed: false,
        });
      } else if (tag === 'KONIEC_SESJI' && value === 'POTWIERDZENIE') {
        this.seen.add(id);
        cues.push({ id, kind: 'end', value, anchor, committed: true });
      }
    }
    return cues;
  }
  clear(): void {
    this.seen.clear();
  }
}
