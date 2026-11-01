import { NextResponse } from 'next/server';
import { isSameOriginOrLoopback } from '@/lib/desktop/origin-validator';
import {
  getHueService,
  discoverHueBridges,
} from '@/lib/hardware/hue/server-service';
import { HueError } from '@/lib/hardware/hue/server-types';
import type { HueBridgeConfig } from '@/lib/hardware/hue/types';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function allowed(request: Request): boolean {
  const host = new URL(request.url).hostname;
  return (
    ['localhost', '127.0.0.1', '[::1]'].includes(host) &&
    isSameOriginOrLoopback(request.headers.get('origin'), request.url)
  );
}
export async function GET(request: Request) {
  // Same-origin fetches may omit Origin; Sec-Fetch-Site must then explicitly be same-origin.
  const url = new URL(request.url);
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !(
      allowed(request) ||
      request.headers.get('sec-fetch-site') === 'same-origin'
    )
  )
    return NextResponse.json({ error: 'LOCAL_ONLY' }, { status: 403 });
  try {
    return NextResponse.json(await (await getHueService()).status());
  } catch {
    return NextResponse.json({ error: 'HUE_STORAGE_ERROR' }, { status: 503 });
  }
}
export async function POST(request: Request) {
  if (!allowed(request))
    return NextResponse.json({ error: 'LOCAL_ONLY' }, { status: 403 });
  try {
    const raw = await request.text();
    if (raw.length > 20000) throw new HueError('INVALID_COMMAND');
    const cmd = JSON.parse(raw) as {
      action?: string;
      owner?: string;
      config?: Partial<HueBridgeConfig>;
      payload?: Record<string, unknown>;
      kind?: string;
    };
    if (!cmd.owner || !/^[a-zA-Z0-9_-]{1,100}$/.test(cmd.owner!))
      throw new HueError('INVALID_OWNER');
    const service = await getHueService();
    const session = service.session;
    return await service.run(async () => {
      if (cmd.action !== 'start' && cmd.action !== 'shutdown')
        session.heartbeat(cmd.owner!);
      switch (cmd.action) {
        case 'shutdown':
          if (
            !process.env.HUE_SHUTDOWN_TOKEN ||
            request.headers.get('x-hue-shutdown') !==
              process.env.HUE_SHUTDOWN_TOKEN
          )
            return NextResponse.json({ error: 'LOCAL_ONLY' }, { status: 403 });
          await session.shutdown();
          break;
        case 'discover':
          return NextResponse.json({ bridges: await discoverHueBridges() });
        case 'configure': {
          if (!cmd.config) throw new HueError('INVALID_CONFIG');
          const {
            enabled,
            bridgeIp,
            bridgeId,
            selectedLightIds,
            mode,
            areaId,
            intensity,
            flashesEnabled,
          } = cmd.config;
          await service.configure(
            cmd.owner!,
            Object.fromEntries(
              Object.entries({
                enabled,
                bridgeIp,
                bridgeId,
                selectedLightIds,
                mode,
                areaId,
                intensity,
                flashesEnabled,
              }).filter(([, value]) => value !== undefined)
            )
          );
          break;
        }
        case 'import':
          await service.importLegacy(cmd.owner!, cmd.config as HueBridgeConfig);
          break;
        case 'pair':
          await service.pair(cmd.owner!, request.signal);
          break;
        case 'start':
          await session.start(cmd.owner!);
          return NextResponse.json({ snapshot: service.state.snapshot });
        case 'heartbeat':
          session.heartbeat(cmd.owner!);
          break;
        case 'stop':
          await session.stop(cmd.owner!);
          break;
        case 'pause':
          await session.pause(cmd.owner!);
          break;
        case 'resume':
          await session.resume(cmd.owner!);
          break;
        case 'emergency':
          await session.emergency(cmd.owner!);
          break;
        case 'accent':
          if (
            !['sanity-loss', 'gunshot', 'thunder', 'anomaly'].includes(
              cmd.kind ?? ''
            )
          )
            throw new HueError('INVALID_CUE');
          await session.accent(cmd.owner!, cmd.kind!);
          break;
        case 'state': {
          if (!cmd.payload) throw new HueError('INVALID_STATE');
          // Closed input shape; callers cannot proxy arbitrary URLs or unknown Hue operations.
          const p = cmd.payload;
          const clean: Record<string, unknown> = {};
          if (
            p.on &&
            typeof p.on === 'object' &&
            'on' in p.on &&
            typeof p.on.on === 'boolean'
          )
            clean.on = p.on;
          if (
            p.dimming &&
            typeof p.dimming === 'object' &&
            'brightness' in p.dimming &&
            typeof p.dimming.brightness === 'number' &&
            Number.isFinite(p.dimming.brightness)
          )
            clean.dimming = {
              brightness: Math.min(
                70,
                Math.max(
                  10,
                  p.dimming.brightness * (service.state.config.intensity ?? 1)
                )
              ),
            };
          if (
            p.color_temperature &&
            typeof p.color_temperature === 'object' &&
            'mirek' in p.color_temperature &&
            typeof p.color_temperature.mirek === 'number' &&
            Number.isFinite(p.color_temperature.mirek)
          )
            clean.color_temperature = {
              mirek: Math.max(153, Math.min(500, p.color_temperature.mirek)),
            };
          if (
            p.color &&
            typeof p.color === 'object' &&
            'xy' in p.color &&
            p.color.xy &&
            typeof p.color.xy === 'object' &&
            'x' in p.color.xy &&
            'y' in p.color.xy
          ) {
            const { x, y } = p.color.xy;
            if (
              typeof x === 'number' &&
              typeof y === 'number' &&
              Number.isFinite(x) &&
              Number.isFinite(y) &&
              x >= 0 &&
              y > 0 &&
              x + y <= 1
            )
              clean.color = { xy: { x, y } };
          }
          const ms =
            p.dynamics &&
            typeof p.dynamics === 'object' &&
            'duration' in p.dynamics
              ? p.dynamics.duration
              : 3000;
          clean.dynamics = {
            duration:
              typeof ms === 'number' && Number.isFinite(ms)
                ? Math.min(10000, Math.max(0, ms))
                : 3000,
          };
          if (Object.keys(clean).length < 2)
            throw new HueError('INVALID_STATE');
          await session.apply(cmd.owner!, clean);
          break;
        }
        default:
          throw new HueError('INVALID_COMMAND');
      }
      return NextResponse.json({ ok: true });
    });
  } catch (e) {
    const code = e instanceof HueError ? e.code : 'HUE_ERROR';
    return NextResponse.json(
      { error: code },
      { status: ['BUSY', 'AREA_BUSY'].includes(code) ? 409 : 503 }
    );
  }
}
