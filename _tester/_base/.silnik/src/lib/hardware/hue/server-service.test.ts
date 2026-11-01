import { HueService } from './server-service';
import { HueV2Bridge } from './bridge-transport';
import { DEFAULT_HUE_CONFIG } from './types';
import type { StoredHueState } from './server-types';
jest.mock('./server-store', () => ({
  saveHueState: jest.fn().mockResolvedValue(undefined),
  loadHueState: jest.fn(),
}));
const state = (): StoredHueState => ({
  config: {
    ...DEFAULT_HUE_CONFIG,
    bridgeIp: '192.168.1.2',
    bridgeId: '001788fffe123456',
    selectedLightIds: ['lamp'],
  },
  appKey: 'current-dummy',
  clientKey: 'client-dummy',
});
describe('settings and credential transactions', () => {
  afterEach(() => jest.restoreAllMocks());
  it('does not release lamps for invalid settings', async () => {
    const s = new HueService(state());
    const stop = jest.spyOn(s.session, 'stop');
    await expect(s.configure('one', { intensity: 99 })).rejects.toThrow(
      'INVALID_INTENSITY'
    );
    expect(stop).not.toHaveBeenCalled();
  });
  it('keeps the previous credentials if a legacy import cannot be verified', async () => {
    const data = state();
    const s = new HueService(data);
    jest
      .spyOn(HueV2Bridge.prototype, 'lights')
      .mockRejectedValue(new Error('OFFLINE'));
    await expect(
      s.importLegacy('one', { ...data.config, appKey: 'older-dummy' })
    ).rejects.toThrow('OFFLINE');
    expect(data.appKey).toBe('current-dummy');
    expect(data.clientKey).toBe('client-dummy');
  });
  it('never pairs a migrated username with a client key from another username', async () => {
    const data = state();
    const s = new HueService(data);
    jest.spyOn(HueV2Bridge.prototype, 'lights').mockResolvedValue([]);
    await s.importLegacy('one', { ...data.config, appKey: 'older-dummy' });
    expect(data.appKey).toBe('older-dummy');
    expect(data.clientKey).toBe('');
  });
  it('returns live failure state without exposing keys', async () => {
    const s = new HueService(state());
    jest
      .spyOn(HueV2Bridge.prototype, 'lights')
      .mockRejectedValue(new Error('OFFLINE'));
    jest.spyOn(HueV2Bridge.prototype, 'areas').mockResolvedValue([]);
    const status = await s.status();
    expect(status.phase).toBe('unavailable');
    expect(status.config.appKey).toBe('');
    expect(JSON.stringify(status)).not.toContain('dummy');
  });
});
