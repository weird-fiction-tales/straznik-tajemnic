import { EventEmitter } from 'node:events';
import { createSocket } from 'node:dgram';
import { discoverTVAddresses } from './discovery';
jest.mock('node:dgram', () => ({ createSocket: jest.fn() }));

afterEach(() => jest.useRealTimers());
test('SSDP verifies sender addresses, deduplicates and never follows LOCATION URLs', async () => {
  jest.useFakeTimers();
  const socket = Object.assign(new EventEmitter(), {
    bind: jest.fn((_port: number, ready: () => void) => ready()),
    send: jest.fn(),
    close: jest.fn(),
  });
  jest
    .mocked(createSocket)
    .mockReturnValue(socket as unknown as ReturnType<typeof createSocket>);
  const promise = discoverTVAddresses();
  for (const ip of ['192.168.1.50', '192.168.1.50', '8.8.8.8']) {
    socket.emit(
      'message',
      Buffer.from(
        'HTTP/1.1 200 OK\r\nST: urn:schemas-upnp-org:device:MediaRenderer:1\r\nLOCATION: http://8.8.8.8/private'
      ),
      { address: ip }
    );
  }
  socket.emit('message', Buffer.from('unrelated'), { address: '192.168.1.60' });
  jest.advanceTimersByTime(2001);
  expect(await promise).toEqual(['192.168.1.50']);
  expect(socket.close).toHaveBeenCalledTimes(1);
  expect(socket.send).toHaveBeenCalledWith(
    expect.any(Buffer),
    1900,
    '239.255.255.250',
    expect.any(Function)
  );
});
