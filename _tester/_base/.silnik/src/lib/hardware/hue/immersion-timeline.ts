import type { LightingEffect } from './score';
export interface ImmersionCue {
  id: string;
  messageId: string;
  sceneId: string;
  effectId: LightingEffect;
  anchor: string;
  segmentId?: number;
}
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
export class ImmersionTimeline {
  private message = '';
  private voiced = false;
  private entries = new Map<
    string,
    { cue: ImmersionCue; armed: boolean; passed: boolean }
  >();
  private consumed = new Set<string>();
  constructor(private emit: (cue: ImmersionCue) => void) {}
  begin(messageId: string, voiced: boolean): void {
    if (this.message !== messageId) {
      this.cancel();
      this.message = messageId;
    }
    this.voiced = voiced;
  }
  enqueue(cue: ImmersionCue, armed: boolean): void {
    if (
      this.consumed.has(cue.id) ||
      this.entries.has(cue.id) ||
      cue.messageId !== this.message
    )
      return;
    this.entries.set(cue.id, { cue, armed, passed: false });
    if (!this.voiced && armed) this.fire(cue.id);
  }
  private fire(id: string): void {
    const e = this.entries.get(id);
    if (!e) return;
    this.consumed.add(id);
    this.entries.delete(id);
    if (!e.passed) this.emit(e.cue);
  }
  commit(message: string, effect: LightingEffect): void {
    for (const [id, e] of this.entries) {
      if (e.cue.messageId !== message || e.cue.effectId !== effect) continue;
      e.armed = true;
      if (e.passed) this.fire(id);
      else if (!this.voiced) this.fire(id);
    }
  }
  segment(message: string, text: string, segmentId?: number): boolean {
    if (message !== this.message) return false;
    const spoken = norm(text);
    let emitted = false;
    for (const [id, e] of this.entries) {
      const anchor = norm(e.cue.anchor);
      if (!anchor || !spoken.includes(anchor)) continue;
      e.cue.segmentId = segmentId;
      if (e.armed) {
        this.fire(id);
        emitted = true;
      } else e.passed = true;
    }
    return emitted;
  }
  cancel(): void {
    for (const id of this.entries.keys()) this.consumed.add(id);
    this.entries.clear();
    this.message = '';
  }
}
