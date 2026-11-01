import { createSocket } from 'node:dgram';
import { isPrivateIPv4 } from './transport';

/** SSDP only collects sender IPs. Never fetch arbitrary LOCATION URLs. */
export function discoverTVAddresses(): Promise<string[]> {
  return new Promise((resolve) => {
    const socket = createSocket('udp4');
    const hosts = new Set<string>();
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {
        /* bind may have failed */
      }
      resolve([...hosts].slice(0, 16));
    };
    const timer = setTimeout(finish, 2000);
    socket.on('error', finish);
    socket.on('message', (message, sender) => {
      const text = message.toString();
      if (
        /philips|jointspace|tpvision|MediaRenderer/i.test(text) &&
        isPrivateIPv4(sender.address)
      )
        hosts.add(sender.address);
    });
    socket.bind(0, () => {
      const message = Buffer.from(
        'M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 1\r\nST: ssdp:all\r\n\r\n'
      );
      socket.send(message, 1900, '239.255.255.250', (error) => {
        if (error) finish();
      });
    });
  });
}
