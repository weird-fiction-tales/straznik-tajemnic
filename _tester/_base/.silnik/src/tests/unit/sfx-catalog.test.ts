import { SFX_PATTERNS } from '@/lib/parsers/patterns';
import { SFX_CATALOG, playSFX, SFX_ENABLED } from '@/lib/audio/sfx-catalog';

describe('SFX Catalog & Detection Patterns (Issue #205, Issue #504, Issue #789)', () => {
  beforeEach(() => {
    window.HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
    window.HTMLMediaElement.prototype.pause = jest.fn();
  });

  it('SFX_ENABLED jest ustawione na true (Issue #789 - odtwarzanie aktywne)', () => {
    expect(SFX_ENABLED).toBe(true);
  });

  it('playSFX inicjalizuje odtwarzanie Audio dla poprawnego presetu', () => {
    const audioSpy = jest.spyOn(global, 'Audio');
    playSFX('creaking_door');
    expect(audioSpy).toHaveBeenCalledWith('/sounds/sfx/creaking_door.mp3');
    audioSpy.mockRestore();
  });
  it('każdy wzorzec w SFX_PATTERNS wskazuje na istniejący preset w SFX_CATALOG', () => {
    for (const entry of SFX_PATTERNS) {
      const preset = SFX_CATALOG[entry.presetId];
      expect(preset).toBeDefined();
      expect(preset.file).toMatch(/^\/sounds\/sfx\/.*\.mp3$/);
      expect(preset.volume).toBeGreaterThan(0);
      expect(preset.volume).toBeLessThanOrEqual(1.0);
    }
  });

  it('poprawnie dopasowuje odgłosy broni palnej z zachowaniem priorytetów', () => {
    const shotgunMatch = SFX_PATTERNS.find((p) => new RegExp(p.pattern.source, p.pattern.flags).test('Wyciąga obrzyn i celuje w mrok.'));
    expect(shotgunMatch?.presetId).toBe('shotgun_blast');

    const tommyMatch = SFX_PATTERNS.find((p) => new RegExp(p.pattern.source, p.pattern.flags).test('Wystrzelił serię z automatu.'));
    expect(tommyMatch?.presetId).toBe('tommy_gun_burst');

    const clickMatch = SFX_PATTERNS.find((p) => new RegExp(p.pattern.source, p.pattern.flags).test('Naciskasz spust, ale słyszysz tylko suchy klik.'));
    expect(clickMatch?.presetId).toBe('empty_gun_click');

    const genericGunMatch = SFX_PATTERNS.find((p) => new RegExp(p.pattern.source, p.pattern.flags).test('Rozległ się głośny wystrzał z rewolweru.'));
    expect(genericGunMatch?.presetId).toBe('gunshot');
  });

  it('poprawnie dopasowuje odgłosy horroru i zjawisk nadprzyrodzonych', () => {
    const doorMatch = SFX_PATTERNS.find((p) => new RegExp(p.pattern.source, p.pattern.flags).test('Skrzypiące drzwi uchyliły się bez ostrzeżenia.'));
    expect(doorMatch?.presetId).toBe('creaking_door');

    const whispersMatch = SFX_PATTERNS.find((p) => new RegExp(p.pattern.source, p.pattern.flags).test('W kącie pokoju szepcze niewidoczna postać.'));
    expect(whispersMatch?.presetId).toBe('whispers');

    const eldritchMatch = SFX_PATTERNS.find((p) => new RegExp(p.pattern.source, p.pattern.flags).test('Z głębi studni dobiegł nieludzki ryk.'));
    expect(eldritchMatch?.presetId).toBe('eldritch_growl');
  });

  it('playSFX nie rzuca błędów w środowisku testowym (graceful degradation)', () => {
    expect(() => {
      playSFX('creaking_door');
      playSFX('non_existent_preset');
    }).not.toThrow();
  });
});
