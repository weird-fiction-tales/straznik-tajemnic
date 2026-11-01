import { CueParser } from './cue-parser';
import { ImmersionTimeline, type ImmersionCue } from './immersion-timeline';
import {
  initializeHue,
  getGlobalLightDirector,
} from './light-director-service';
import { hueCommand } from './hue-client';
import {
  PRABUTY_SCENES,
  resolveLightingScene,
  type LightingEffect,
} from './score';
import { playSFX } from '@/lib/audio/sfx-catalog';
export interface LightingSaveState {
  sceneId?: string;
  paused?: boolean;
}
export const IMMERSION_SFX: Record<LightingEffect, string> = {
  gunshot: 'gunshot',
  thunder: 'thunder',
  'sanity-loss': 'sanity_loss_whisper',
  anomaly: 'whispers',
};
class ImmersionController {
  private parser = new CueParser();
  private state: LightingSaveState = {};
  private adventure = '';
  private ending = new Set<string>();
  readonly timeline = new ImmersionTimeline((cue) => this.emit(cue));
  private emit(cue: ImmersionCue): void {
    if (this.state.paused) return;
    playSFX(IMMERSION_SFX[cue.effectId]);
    void hueCommand('accent', { kind: cue.effectId }).catch(() => {});
  }
  snapshot(): LightingSaveState {
    return { ...this.state };
  }
  async selectScene(id: string, manual = false): Promise<void> {
    const scene = resolveLightingScene(id);
    if (!scene || (this.adventure !== 'cien-nad-prabutami' && !manual)) return;
    if (this.state.sceneId === scene.sceneId && !manual) return;
    this.timeline.cancel();
    this.state.sceneId = scene.sceneId;
    if (typeof window !== 'undefined')
      window.dispatchEvent(new Event('hue-scene-changed'));
    if (this.state.paused || scene.lighting.mode === 'keep') return;
    const d = getGlobalLightDirector();
    if (!d.getClient().getConfig().enabled) return;
    await d.onSessionStart(false);
    await d.applyPreset(
      scene.lighting.presetId,
      scene.lighting.transitionMs,
      scene.lighting.brightness
    );
  }
  async start(adventureId: string, initial?: string): Promise<void> {
    this.adventure = adventureId;
    this.ending.clear();
    if (getGlobalLightDirector().getClient().getConfig().enabled)
      await initializeHue();
    if (adventureId === 'cien-nad-prabutami')
      await this.selectScene(
        initial ?? this.state.sceneId ?? PRABUTY_SCENES[0].sceneId,
        true
      );
    else {
      const d = getGlobalLightDirector();
      if (d.getClient().getConfig().enabled) await d.onSessionStart();
    }
  }
  feed(messageId: string, text: string, voiced: boolean): void {
    this.timeline.begin(messageId, voiced);
    for (const cue of this.parser.feed(messageId, text)) {
      if (cue.kind === 'scene') {
        void this.selectScene(cue.value).catch(() => {});
        this.timeline.begin(messageId, voiced);
        continue;
      }
      if (cue.kind === 'end') continue;
      const scene = resolveLightingScene(this.state.sceneId ?? '');
      if (!scene) continue;
      const accent =
        cue.value === 'sanity-loss'
          ? scene.lighting.accents.find((a) => a.trigger === 'sanity-loss')
          : scene.lighting.accents.find((a) => a.id === cue.value);
      if (!accent) continue;
      this.timeline.enqueue(
        {
          id: cue.id,
          messageId,
          sceneId: scene.sceneId,
          effectId: accent.effectId,
          anchor: cue.anchor,
        },
        cue.committed &&
          accent.trigger !== 'sanity-loss' &&
          accent.trigger !== 'gunshot'
      );
    }
  }
  commitSanity(message: string): void {
    this.timeline.commit(message, 'sanity-loss');
  }
  committedShot(id: string): void {
    this.emit({
      id,
      messageId: id,
      sceneId: this.state.sceneId ?? '',
      effectId: 'gunshot',
      anchor: '',
    });
  }
  async pausePlayback(): Promise<void> {
    this.cancel();
    if (
      !this.state.paused &&
      getGlobalLightDirector().getClient().getConfig().enabled
    )
      await hueCommand('pause');
  }
  async resumePlayback(): Promise<void> {
    if (
      !this.state.paused &&
      getGlobalLightDirector().getClient().getConfig().enabled
    )
      await hueCommand('resume');
  }
  async pause(): Promise<void> {
    this.state.paused = true;
    this.timeline.cancel();
    getGlobalLightDirector().pause();
    await hueCommand('pause');
  }
  async resume(): Promise<void> {
    this.state.paused = false;
    await hueCommand('resume');
    await getGlobalLightDirector().resume();
    if (this.state.sceneId) await this.selectScene(this.state.sceneId, true);
  }
  async emergency(): Promise<void> {
    this.state.paused = true;
    this.timeline.cancel();
    getGlobalLightDirector().pause();
    await hueCommand('emergency');
  }
  cancel(): void {
    this.timeline.cancel();
    getGlobalLightDirector().cancelPending();
  }
  async end(message = 'session'): Promise<void> {
    if (this.ending.has(message)) return;
    this.ending.add(message);
    this.cancel();
    await getGlobalLightDirector().onSessionEnd();
  }
  async restore(state: LightingSaveState | undefined): Promise<void> {
    this.cancel();
    this.state =
      state && resolveLightingScene(state.sceneId ?? '')
        ? { sceneId: state.sceneId, paused: !!state.paused }
        : {};
    if (this.state.sceneId && !this.state.paused)
      void this.selectScene(this.state.sceneId, true).catch(() => {});
  }
}
export const immersion = new ImmersionController();
