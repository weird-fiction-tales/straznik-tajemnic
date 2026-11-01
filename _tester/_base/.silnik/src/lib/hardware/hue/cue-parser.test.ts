import { CueParser } from './cue-parser';
import { ImmersionTimeline } from './immersion-timeline';
describe('one cue per complete tag', () => {
  it('does not repeat scene changes, authored cues or session end across chunks', () => {
    const p = new CueParser();
    const text =
      '[SCENA:scene-prabuty-krypta-climax]Anomalia narasta [CUE:prabuty-time-anomaly][KONIEC_SESJI:POTWIERDZENIE]';
    expect(p.feed('one', text.slice(0, 15))).toEqual([]);
    expect(p.feed('one', text)).toHaveLength(3);
    expect(p.feed('one', text + ' Cisza')).toEqual([]);
  });
  it('rejects unknown scene and cue IDs and firearm tests are not gunshots', () => {
    expect(
      new CueParser().feed('one', '[SCENA:bogus][CUE:bogus][TEST:Firearms]')
    ).toEqual([]);
  });
  it('matches playback once, drops replay and cancels waiting cues on Stop', () => {
    const emit = jest.fn();
    const t = new ImmersionTimeline(emit);
    t.begin('m', true);
    t.enqueue(
      {
        id: 'm:1',
        messageId: 'm',
        sceneId: 's',
        effectId: 'thunder',
        anchor: 'the thunder cracks',
      },
      true
    );
    expect(t.segment('m', 'The thunder cracks.')).toBe(true);
    t.segment('m', 'The thunder cracks.');
    expect(emit).toHaveBeenCalledTimes(1);
    t.enqueue(
      {
        id: 'm:2',
        messageId: 'm',
        sceneId: 's',
        effectId: 'gunshot',
        anchor: 'a shot',
      },
      true
    );
    t.cancel();
    t.segment('m', 'a shot');
    expect(emit).toHaveBeenCalledTimes(1);
  });
  it('never plays a mechanical cue whose sentence has already passed before commit', () => {
    const emit = jest.fn();
    const t = new ImmersionTimeline(emit);
    t.begin('m', true);
    const cue = {
      id: 'm:1',
      messageId: 'm',
      sceneId: 's',
      effectId: 'sanity-loss' as const,
      anchor: 'something terrible',
    };
    t.enqueue(cue, false);
    t.segment('m', 'Something terrible.');
    t.commit('m', 'sanity-loss');
    expect(emit).not.toHaveBeenCalled();
  });
});
