import { getSFXVolume, releaseSFXAudioElement } from './sfx-catalog';
import { resolveLightingScene } from '@/lib/hardware/hue/score';

// Existing recordings matching the authored atmosphere. No filename guessing or prop-triggered sounds.
const PRABUTY_AMBIENCE: Record<string, string> = {
  'scene-warszawa-redakcja': '/sounds/sfx/lucznik_typewriter_01.webm',
  'scene-elblag-klasztor': '/sounds/sfx/clock_ticking.mp3',
};

/** A separate, quiet ambience channel: the speech queue and event SFX keep their own lifecycle. */
export class SceneSoundscape {
  private audio: HTMLAudioElement | null = null;
  private key = '';
  play(adventureId: string, sceneId: string): void {
    const scene =
      adventureId === 'cien-nad-prabutami'
        ? resolveLightingScene(sceneId)
        : undefined;
    const file = scene && PRABUTY_AMBIENCE[scene.sceneId];
    const volume = getSFXVolume() * 0.1;
    if (!file || volume <= 0 || typeof Audio === 'undefined') {
      this.stop();
      return;
    }
    if (this.audio && this.key === scene!.sceneId) {
      this.audio.volume = volume;
      return;
    }
    this.stop();
    const audio = new Audio(file);
    this.audio = audio;
    this.key = scene!.sceneId;
    audio.loop = true;
    audio.volume = volume;
    audio.onerror = () => this.stop();
    void audio.play().catch(() => {
      if (this.audio === audio) this.stop();
    });
  }
  pause(): void {
    this.audio?.pause();
  }
  resume(): void {
    if (getSFXVolume() <= 0) {
      this.stop();
      return;
    }
    void this.audio?.play().catch(() => this.stop());
  }
  stop(): void {
    releaseSFXAudioElement(this.audio);
    this.audio = null;
    this.key = '';
  }
}
export const sceneSoundscape = new SceneSoundscape();
