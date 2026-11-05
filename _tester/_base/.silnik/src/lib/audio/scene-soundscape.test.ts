import { SceneSoundscape } from './scene-soundscape';

describe('scene ambience playback', () => {
  const audio: Array<{
    src: string;
    volume: number;
    loop: boolean;
    play: jest.Mock;
    pause: jest.Mock;
    load: jest.Mock;
  }> = [];
  const OriginalAudio = global.Audio;
  beforeEach(() => {
    localStorage.clear();
    audio.length = 0;
    global.Audio = jest.fn((src: string) => {
      const item = {
        src,
        volume: 1,
        loop: false,
        play: jest.fn().mockResolvedValue(undefined),
        pause: jest.fn(),
        load: jest.fn(),
      };
      audio.push(item);
      return item;
    }) as unknown as typeof Audio;
  });
  afterEach(() => {
    global.Audio = OriginalAudio;
  });
  it('starts one subdued authored newsroom layer, preserves it across segments and releases it on stop', () => {
    const sound = new SceneSoundscape();
    sound.play('cien-nad-prabutami', 'scene-warszawa-redakcja');
    sound.play('cien-nad-prabutami', 'loc-warszawa-redakcja');
    expect(audio).toHaveLength(1);
    expect(audio[0].src).toBe('/sounds/sfx/lucznik_typewriter_01.webm');
    expect(audio[0].volume).toBeLessThanOrEqual(0.12);
    expect(audio[0].loop).toBe(true);
    sound.pause();
    expect(audio[0].pause).toHaveBeenCalled();
    sound.resume();
    expect(audio[0].play).toHaveBeenCalledTimes(2);
    sound.stop();
    expect(audio[0].src).toBe('');
    expect(audio[0].load).toHaveBeenCalled();
  });
  it('respects mute, stops old scenes and does not invent ambience for an unknown scene', () => {
    const sound = new SceneSoundscape();
    sound.play('cien-nad-prabutami', 'node-warszawa-redakcja');
    localStorage.setItem('sfx_muted', 'true');
    sound.play('cien-nad-prabutami', 'node-warszawa-redakcja');
    expect(audio[0].src).toBe('');
    sound.play('other-case', 'node-warszawa-redakcja');
    sound.play('cien-nad-prabutami', 'not-a-scene');
    expect(audio).toHaveLength(1);
  });
  it('replaces the newsroom layer with the authored monastery clock', () => {
    const sound = new SceneSoundscape();
    sound.play('cien-nad-prabutami', 'scene-warszawa-redakcja');
    sound.play('cien-nad-prabutami', 'loc-elblag-klasztor');
    expect(audio[0].src).toBe('');
    expect(audio[1].src).toBe('/sounds/sfx/clock_ticking.mp3');
  });
});
