import { LightDirector } from '../hue/light-director';
import { HueClient } from '../hue/hue-client';

function setup(hueEnabled = true) {
  const hue = new HueClient({ enabled: hueEnabled });
  jest.spyOn(hue, 'applyToSelectedLights').mockResolvedValue();
  jest.spyOn(hue, 'captureSnapshot').mockResolvedValue([]);
  jest.spyOn(hue, 'restoreSnapshot').mockResolvedValue();
  const tv = {
    isEnabled: () => true,
    apply: jest.fn().mockResolvedValue(undefined),
    end: jest.fn().mockResolvedValue(undefined),
  };
  return { hue, tv, director: new LightDirector(hue, tv) };
}
afterEach(() => jest.useRealTimers());
test('a lightning event dispatches the same payload to TV and Hue', async () => {
  const { hue, tv, director } = setup();
  await director.triggerLightningFlash();
  expect(tv.apply).toHaveBeenCalledWith(
    expect.objectContaining({ color_temperature: { mirek: 153 } })
  );
  expect(tv.apply.mock.calls[0][0]).toEqual(
    jest.mocked(hue.applyToSelectedLights).mock.calls[0][0]
  );
  director.cancelPendingEffects();
});
test('TV works without a paired or enabled Hue bridge', async () => {
  const { tv, director } = setup(false);
  await director.onSessionStart();
  expect(tv.apply).toHaveBeenCalled();
});
test('offline TV does not delay or reject a Hue effect', async () => {
  const { hue, tv, director } = setup();
  tv.apply.mockRejectedValue(new Error('offline'));
  await expect(director.applyPreset('kerosene_lamp')).resolves.toBe(true);
  expect(hue.applyToSelectedLights).toHaveBeenCalled();
});
test('pending TV request does not block Hue', async () => {
  const { tv, director } = setup();
  tv.apply.mockImplementation(() => new Promise(() => undefined));
  await expect(director.applyPreset('kerosene_lamp')).resolves.toBe(true);
});
test('end cancels nested spark timers and blocks late narrative effects', async () => {
  jest.useFakeTimers();
  const { tv, director } = setup();
  await director.triggerElectricalSpark();
  await director.onSessionEnd();
  jest.advanceTimersByTime(5000);
  await director.applyPreset('cosmic_horror');
  expect(tv.apply).toHaveBeenCalledTimes(1);
  expect(tv.end).toHaveBeenCalledTimes(1);
});
