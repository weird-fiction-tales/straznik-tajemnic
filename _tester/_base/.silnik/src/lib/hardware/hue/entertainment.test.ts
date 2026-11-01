import { EventEmitter } from 'node:events';
import { encodeHueFrame, HueEntertainment, whitePoint } from './entertainment';
import type { StoredHueState } from './server-types';
import { dtls } from 'node-dtls-client';
jest.mock('node-dtls-client', () => ({ dtls: { createSocket: jest.fn() } }));
const area = {
  id: '00112233-4455-6677-8899-aabbccddeeff',
  metadata: { name: 'Room' },
  status: 'inactive' as const,
  channels: [{ channel_id: 3, members: [] }],
};
describe('Entertainment wire and lifecycle', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  it('encodes the v2 header, UUID, real channel ID and 16-bit xy brightness', () => {
    const b = encodeHueFrame(
      area.id,
      [3],
      { x: 0.5, y: 0.25, brightness: 0.5 },
      257
    );
    expect(b.length).toBe(59);
    expect(b.toString('ascii', 0, 9)).toBe('HueStream');
    expect(b[9]).toBe(2);
    expect(b[11]).toBe(1);
    expect(b[14]).toBe(1);
    expect(b[52]).toBe(3);
    expect(b.readUInt16BE(53)).toBe(32768);
  });
  it('sends 50 frames per second, interpolates and tears down without more frames', async () => {
    const socket = Object.assign(new EventEmitter(), {
      send: jest.fn(),
      close: jest.fn(),
    });
    const request = jest.fn().mockResolvedValue({});
    const state = {
      config: { bridgeIp: '192.168.1.2' },
      appKey: 'key',
      clientKey: '01234567',
    } as StoredHueState;
    const stream = new HueEntertainment(
      state,
      request,
      () => {},
      async () => socket
    );
    await stream.start(area);
    expect(socket.send).not.toHaveBeenCalled();
    stream.transition({
      dimming: { brightness: 60 },
      dynamics: { duration: 1000 },
    });
    await jest.advanceTimersByTimeAsync(1000);
    expect(socket.send).toHaveBeenCalledTimes(51);
    const last = socket.send.mock.calls.at(-1)![0] as Buffer;
    expect(last.readUInt16BE(57)).toBe(Math.round(0.6 * 65535));
    await stream.stop();
    await jest.advanceTimersByTimeAsync(1000);
    expect(socket.send).toHaveBeenCalledTimes(51);
    expect(socket.close).toHaveBeenCalledTimes(1);
  });
  it('does not steal an active area', async () => {
    const request = jest.fn();
    const stream = new HueEntertainment(
      { config: {} } as StoredHueState,
      request
    );
    await expect(stream.start({ ...area, status: 'active' })).rejects.toThrow(
      'AREA_BUSY'
    );
    expect(request).not.toHaveBeenCalled();
  });
  it('retries a failed handshake once while retaining the same reserved area', async () => {
    const socket = Object.assign(new EventEmitter(), {
      send: jest.fn(),
      close: jest.fn(),
    });
    const factory = jest
      .fn()
      .mockRejectedValueOnce(new Error('handshake timed out'))
      .mockResolvedValue(socket);
    const request = jest.fn().mockResolvedValue({});
    const stream = new HueEntertainment(
      { config: {}, appKey: 'key', clientKey: '01234567' } as StoredHueState,
      request,
      () => {},
      factory
    );
    await stream.start(area);
    expect(factory).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenCalledTimes(1);
    await stream.stop();
  });
  it('rejects a native handshake error without closing the already closed UDP socket', async () => {
    const socket = Object.assign(new EventEmitter(), {
      send: jest.fn(),
      close: jest.fn(() => {
        throw new Error('ERR_SOCKET_DGRAM_NOT_RUNNING');
      }),
    });
    jest
      .mocked(dtls.createSocket)
      .mockReturnValue(
        socket as unknown as ReturnType<typeof dtls.createSocket>
      );
    const request = jest.fn().mockResolvedValue({});
    const stream = new HueEntertainment(
      {
        config: { bridgeIp: '192.168.1.2' },
        appKey: 'key',
        clientKey: '01234567',
      } as StoredHueState,
      request
    );
    const starting = stream.start(area);
    const rejected = expect(starting).rejects.toThrow('OFFLINE');
    await jest.advanceTimersByTimeAsync(500);
    expect(() =>
      socket.emit('error', new Error('handshake failed'))
    ).not.toThrow();
    await jest.advanceTimersByTimeAsync(500);
    expect(() => socket.emit('error', new Error('retry failed'))).not.toThrow();
    await rejected;
    expect(socket.close).not.toHaveBeenCalled();
    expect(request).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.any(String),
      'PUT',
      { action: 'stop' }
    );
  });
  it('releases the area after a runtime socket error without closing a dead socket twice', async () => {
    const socket = Object.assign(new EventEmitter(), {
      send: jest.fn(),
      close: jest.fn(),
    });
    const failed = jest.fn();
    const stream = new HueEntertainment(
      { config: {}, appKey: 'key', clientKey: '01234567' } as StoredHueState,
      jest.fn().mockResolvedValue({}),
      failed,
      async () => socket
    );
    await stream.start(area);
    socket.emit('error', new Error('UDP already closed'));
    await Promise.resolve();
    await Promise.resolve();
    expect(socket.close).not.toHaveBeenCalled();
    expect(failed).toHaveBeenCalledTimes(1);
  });
  it('produces a warmer xy point for 2700K than 6500K', () => {
    expect(whitePoint(370).x).toBeGreaterThan(whitePoint(153).x);
  });
});
