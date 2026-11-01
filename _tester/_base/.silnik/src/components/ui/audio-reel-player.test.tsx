import { act, fireEvent, render, screen } from '@testing-library/react';
import { AudioReelPlayer } from './audio-reel-player';
interface TestWave {
  listeners: Map<string, () => void>;
  playing: boolean;
  on: (event: string, callback: () => void) => void;
  playPause: () => void;
  pause: () => void;
  isPlaying: () => boolean;
  getDuration: () => number;
  getCurrentTime: () => number;
  destroy: jest.Mock;
}
const mockWaves: TestWave[] = [];
jest.mock('wavesurfer.js', () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => {
      const wave: TestWave = {
        listeners: new Map(),
        playing: false,
        on(event, callback) {
          this.listeners.set(event, callback);
        },
        playPause() {
          this.playing = !this.playing;
          this.listeners.get(this.playing ? 'play' : 'pause')?.();
        },
        pause() {
          this.playing = false;
          this.listeners.get('pause')?.();
        },
        isPlaying() {
          return this.playing;
        },
        getDuration: () => 45,
        getCurrentTime: () => 0,
        destroy: jest.fn(),
      };
      mockWaves.push(wave);
      return wave;
    }),
  },
}));
it('plays and pauses the same source recording without rebuilding the player on state changes', () => {
  mockWaves.length = 0;
  render(
    <AudioReelPlayer audioUrl="/audio/source-tape.mp3" title="Source tape" />
  );
  act(() => mockWaves[0].listeners.get('ready')?.());
  fireEvent.click(screen.getByRole('button', { name: 'Odtwórz' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Wstrzymaj' })
  );
  expect(
    screen.getByRole('button', { name: 'Odtwórz' })
  ).toBeEnabled();
  expect(mockWaves).toHaveLength(1);
});
