/**
 * @file sfx-hue-sync.test.ts
 * Testy jednostkowe integracji SFX z rozbłyskami Philips Hue (Issue #789).
 */

import { LightDirector } from '@/lib/hardware/hue/light-director';
import { HueClient } from '@/lib/hardware/hue/hue-client';
import {
  SFX_CATALOG,
  playSFX,
  SFX_ENABLED,
  getSFXVolume,
  setSFXVolume,
  SFX_VOLUME_STORAGE_KEY,
  SFX_MUTED_STORAGE_KEY,
} from '@/lib/audio/sfx-catalog';

describe('SFX & Philips Hue Audiovisual Synchronization (Issue #789)', () => {
  describe('LightDirector - Impulsy świetlne i bezpiecznik sensoryczny', () => {
    let client: HueClient;
    let director: LightDirector;

    beforeEach(() => {
      client = new HueClient({
        enabled: true,
        bridgeIp: '192.168.1.120',
        appKey: 'test-key',
        selectedLightIds: ['light-1'],
      });
      director = new LightDirector(client);
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.clearAllMocks();
    });

    it('triggerLightningFlash wywołuje zimny rozbłysk 6500K (80ms) i powraca do barwy sceny', async () => {
      const applySpy = jest.spyOn(client, 'applyToSelectedLights').mockResolvedValue();

      const result = await director.triggerLightningFlash();
      expect(result).toBe(true);

      // Krok 1: rozbłysk 6500K (mirek 153), 100% jasności, 80 ms
      expect(applySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          on: { on: true },
          dimming: { brightness: 100 },
          color_temperature: { mirek: 153 },
          dynamics: { duration: 80 },
        })
      );

      // Krok 2: powrót po 100 ms do nastroju sceny
      jest.advanceTimersByTime(110);
      expect(applySpy).toHaveBeenCalledTimes(2);
    });

    it('triggerGunshotFlash wywołuje ciepły mikro-rozbłysk 3000K (60ms) i powraca do nastroju sceny', async () => {
      const applySpy = jest.spyOn(client, 'applyToSelectedLights').mockResolvedValue();

      const result = await director.triggerGunshotFlash();
      expect(result).toBe(true);

      expect(applySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          on: { on: true },
          dimming: { brightness: 100 },
          color_temperature: { mirek: 333 },
          dynamics: { duration: 60 },
        })
      );

      jest.advanceTimersByTime(90);
      expect(applySpy).toHaveBeenCalledTimes(2);
    });

    it('triggerElectricalSpark generuje podwójne mikro-migotanie', async () => {
      const applySpy = jest.spyOn(client, 'applyToSelectedLights').mockResolvedValue();

      const result = await director.triggerElectricalSpark();
      expect(result).toBe(true);

      // Błysk 1
      expect(applySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          dimming: { brightness: 90 },
          color_temperature: { mirek: 180 },
          dynamics: { duration: 50 },
        })
      );

      // Przejście przez kolejne stany migotania z odwijaniem kolejki microtasków
      jest.advanceTimersByTime(70);
      await Promise.resolve();
      jest.advanceTimersByTime(60);
      await Promise.resolve();
      jest.advanceTimersByTime(70);
      await Promise.resolve();
      expect(applySpy.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it('bezpiecznik sensoryczny: blokuje kolejny rozbłysk w oknie 1.5 sekundy (anty-stroboskop)', async () => {
      jest.spyOn(client, 'applyToSelectedLights').mockResolvedValue();

      const first = await director.triggerLightningFlash();
      expect(first).toBe(true);

      // Próba drugiego rozbłysku po 200 ms (w trakcie cooldownu 1500 ms)
      jest.advanceTimersByTime(200);
      const second = await director.triggerGunshotFlash();
      expect(second).toBe(false);

      // Po upływie 1600 ms cooldown mija i kolejny rozbłysk jest dozwolony
      jest.advanceTimersByTime(1400);
      const third = await director.triggerGunshotFlash();
      expect(third).toBe(true);
    });

    it('miękki fallback: gdy mostek jest wyłączony, metody zwracają false bez wywołań HTTP', async () => {
      client.updateConfig({ enabled: false, bridgeIp: '', appKey: '', selectedLightIds: [] });
      const applySpy = jest.spyOn(client, 'applyToSelectedLights');

      const lightningResult = await director.triggerLightningFlash();
      const gunshotResult = await director.triggerGunshotFlash();
      const sparkResult = await director.triggerElectricalSpark();

      expect(lightningResult).toBe(false);
      expect(gunshotResult).toBe(false);
      expect(sparkResult).toBe(false);
      expect(applySpy).not.toHaveBeenCalled();
    });
  });

  describe('SFX Catalog & Audio Ducking Control', () => {
    beforeEach(() => {
      localStorage.clear();
      jest.clearAllMocks();
      window.HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
      window.HTMLMediaElement.prototype.pause = jest.fn();
    });

    it('SFX_ENABLED jest ustawione na true (odtwarzanie aktywne)', () => {
      expect(SFX_ENABLED).toBe(true);
    });

    it('getSFXVolume i setSFXVolume poprawnie zarządzają głośnością w localStorage', () => {
      expect(getSFXVolume()).toBe(1.0); // domyślnie 100%

      setSFXVolume(65);
      expect(localStorage.getItem(SFX_VOLUME_STORAGE_KEY)).toBe('65');
      expect(getSFXVolume()).toBe(0.65);

      setSFXVolume(0);
      expect(getSFXVolume()).toBe(0);

      localStorage.setItem(SFX_MUTED_STORAGE_KEY, 'true');
      expect(getSFXVolume()).toBe(0);
    });

    it('playSFX emituje zdarzenie zew:sfx-ducking przy wystrzałach i wybuchach', () => {
      const dispatchSpy = jest.spyOn(window, 'dispatchEvent');

      playSFX('gunshot');

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'zew:sfx-ducking',
        })
      );
      dispatchSpy.mockRestore();
    });

    it('katalog zawiera 54 zdefiniowane presety z poprawnymi ścieżkami audio', () => {
      const ids = Object.keys(SFX_CATALOG);
      expect(ids).toHaveLength(54);
      for (const id of ids) {
        const def = SFX_CATALOG[id];
        expect(def.file).toMatch(/^\/sounds\/sfx\/.*\.mp3$/);
        expect(def.volume).toBeGreaterThan(0);
        expect(def.volume).toBeLessThanOrEqual(1.0);
      }
    });
  });
});
