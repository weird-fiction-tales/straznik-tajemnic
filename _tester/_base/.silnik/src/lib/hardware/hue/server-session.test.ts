import { HueSession } from './server-session';
import type { BridgeIO, StoredHueState } from './server-types';
const light = {
  id: 'v2-light',
  id_v1: '/lights/1',
  metadata: { name: 'Desk' },
  on: { on: true },
  dimming: { brightness: 73 },
  color_temperature: { mirek: 300, mirek_valid: false },
  color: { xy: { x: 0.2, y: 0.3 } },
};
const state = (): StoredHueState => ({
  config: {
    enabled: true,
    bridgeIp: '192.168.1.2',
    appKey: '',
    selectedLightIds: ['1'],
    mode: 'basic',
  },
  appKey: 'dummy',
  clientKey: '',
});
const io = (): BridgeIO => ({
  lights: jest.fn().mockResolvedValue([light]),
  areas: jest.fn().mockResolvedValue([]),
  write: jest.fn().mockResolvedValue(undefined),
});
describe('server Hue ownership and restore', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  it('captures once, maps v1 IDs and restores the active xy mode after disabling', async () => {
    const bridge = io();
    const store = state();
    const save = jest.fn().mockResolvedValue(undefined);
    const s = new HueSession(store, bridge, save);
    await s.start('owner');
    await s.start('owner');
    expect(bridge.lights).toHaveBeenCalledTimes(1);
    expect(store.config.selectedLightIds).toEqual(['v2-light']);
    store.config.enabled = false;
    await s.stop('owner');
    expect(bridge.write).toHaveBeenCalledWith(
      'v2-light',
      expect.objectContaining({ color: { xy: light.color.xy } })
    );
    expect(store.snapshot).toBeUndefined();
  });
  it('another tab cannot acquire or stop an owned session', async () => {
    const s = new HueSession(state(), io(), async () => {});
    await s.start('one');
    await expect(s.start('two')).rejects.toThrow('BUSY');
    await expect(s.stop('two')).rejects.toThrow('BUSY');
  });
  it('expires after ten seconds and does not replay a pending accent', async () => {
    const store = state();
    const bridge = io();
    const s = new HueSession(store, bridge, async () => {});
    await s.start('one');
    await jest.advanceTimersByTimeAsync(10001);
    expect(store.snapshot).toBeUndefined();
    expect(s.phase).toBe('off');
  });
  it('retains recovery snapshot when restoring fails', async () => {
    const store = state();
    const bridge = io();
    const s = new HueSession(store, bridge, async () => {});
    await s.start('one');
    jest.mocked(bridge.write).mockRejectedValue(new Error('OFFLINE'));
    await expect(s.stop('one')).rejects.toThrow('OFFLINE');
    expect(store.snapshot).toHaveLength(1);
  });
  it('renews the lease after a slow handshake so the first browser heartbeat can arrive', async () => {
    const store = state();
    store.config.mode = 'entertainment';
    store.config.areaId = 'area';
    store.clientKey = 'client';
    const bridge = io();
    jest
      .mocked(bridge.areas)
      .mockResolvedValue([
        {
          id: 'area',
          metadata: { name: 'Room' },
          status: 'inactive',
          channels: [],
          lightIds: ['v2-light'],
        },
      ]);
    const stream = {
      start: () => new Promise<void>((resolve) => setTimeout(resolve, 8000)),
      stop: jest.fn().mockResolvedValue(undefined),
      transition: jest.fn(),
    };
    const session = new HueSession(store, bridge, async () => {}, stream);
    const starting = session.start('one');
    await jest.advanceTimersByTimeAsync(8000);
    await starting;
    await jest.advanceTimersByTimeAsync(2500);
    expect(session.phase).toBe('entertainment');
    session.heartbeat('one');
    await session.stop('one');
  });
});
