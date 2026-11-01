import { isSameOriginOrLoopback } from '@/lib/desktop/origin-validator';
import { ambilightService } from '@/lib/hardware/ambilight/service';
import type { LightingPayload } from '@/lib/hardware/ambilight/color';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function localRequest(request: Request) {
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  return (
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
    (!origin || isSameOriginOrLoopback(origin, request.url)) &&
    !['cross-site', 'same-site'].includes(
      request.headers.get('sec-fetch-site') ?? ''
    )
  );
}
const reply = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET(request: Request) {
  if (!localRequest(request)) return reply({ error: 'forbidden' }, 403);
  try {
    return reply(await ambilightService.status());
  } catch {
    return reply({ error: 'storage' }, 503);
  }
}
export async function POST(request: Request) {
  if (
    !localRequest(request) ||
    !isSameOriginOrLoopback(request.headers.get('origin'), request.url) ||
    !request.headers.get('content-type')?.startsWith('application/json')
  )
    return reply({ error: 'forbidden' }, 403);
  try {
    const text = await request.text();
    if (text.length > 4096) return reply({ error: 'invalidRequest' }, 400);
    const body = JSON.parse(text);
    switch (body.action) {
      case 'discover':
        return reply({ devices: await ambilightService.discover() });
      case 'pair':
        return reply(
          await ambilightService.pair(
            typeof body.ip === 'string' ? body.ip : ''
          )
        );
      case 'confirm':
        return reply(
          await ambilightService.confirm(
            typeof body.pin === 'string' ? body.pin : ''
          )
        );
      case 'enable':
        if (typeof body.enabled !== 'boolean') break;
        return reply(await ambilightService.enable(body.enabled));
      case 'disconnect':
        return reply(await ambilightService.disconnect());
      case 'end':
        return reply(await ambilightService.end());
      case 'effect': {
        const p = body.payload as LightingPayload;
        const valid = (n: unknown, min: number, max: number) =>
          typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
        if (
          typeof body.generation !== 'string' ||
          !p ||
          typeof p !== 'object' ||
          (p.dimming && !valid(p.dimming.brightness, 0, 100)) ||
          (p.color_temperature &&
            !valid(p.color_temperature.mirek, 153, 500)) ||
          (p.color &&
            (!valid(p.color.xy?.x, 0, 1) || !valid(p.color.xy?.y, 0.001, 1))) ||
          (p.on && typeof p.on.on !== 'boolean')
        )
          break;
        return reply(await ambilightService.effect(p, body.generation));
      }
    }
    return reply({ error: 'invalidRequest' }, 400);
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const known = [
      'invalidAddress',
      'unsupported',
      'pairing',
      'expired',
      'invalidPin',
      'notPaired',
      'authentication',
      'certificateChanged',
      'disconnectFirst',
      'storage',
    ];
    return reply({ error: known.includes(code) ? code : 'offline' }, 400);
  }
}
