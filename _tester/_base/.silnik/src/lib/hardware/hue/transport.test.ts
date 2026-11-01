import { validateBridgeAddress } from './bridge-transport';
import { HueSession } from './server-session';
import type { BridgeIO, StoredHueState } from './server-types';
describe('Hue defensive lifecycle', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  it('only accepts LAN IPs, never a URL, public host or loopback target', () => {
    expect(validateBridgeAddress('192.168.1.5')).toBe(true);
    for (const ip of [
      'https://bridge',
      '127.0.0.1',
      '8.8.8.8',
      '10.0.0.1/path',
    ])
      expect(validateBridgeAddress(ip)).toBe(false);
  });
  it('emergency cancels a pending accent and remains at 100 percent after timers', async () => {
    const state: StoredHueState = {
      config: {
        enabled: true,
        bridgeIp: '192.168.1.2',
        appKey: '',
        selectedLightIds: ['light'],
        mode: 'entertainment',
        areaId: 'area',
        flashesEnabled: true,
      },
      appKey: 'dummy',
      clientKey: 'dummy',
    };
    const write = jest.fn().mockResolvedValue(undefined);
    const stream = {
      start: jest.fn().mockResolvedValue(undefined),
      transition: jest.fn(),
      stop: jest.fn().mockResolvedValue(undefined),
    };
    const bridge: BridgeIO = {
      write,
      lights: async () => [
        {
          id: 'light',
          metadata: { name: 'Desk' },
          on: { on: true },
          dimming: { brightness: 40 },
          color_temperature: { mirek: 370, mirek_valid: true },
        },
      ],
      areas: async () => [
        {
          id: 'area',
          metadata: { name: 'Room' },
          status: 'inactive',
          channels: [],
          lightIds: ['light'],
        },
      ],
    };
    const session = new HueSession(state, bridge, async () => {}, stream);
    await session.start('one');
    await session.apply('one', { dimming: { brightness: 25 } });
    await session.accent('one', 'gunshot');
    await session.emergency('one');
    await jest.advanceTimersByTimeAsync(1000);
    expect(write.mock.calls.at(-1)?.[1]).toEqual(
      expect.objectContaining({ dimming: { brightness: 100 } })
    );
    expect(session.phase).toBe('emergency');
    expect(stream.stop).toHaveBeenCalled();
    await session.stop('one');
  });
});
