import type { NextRequest } from 'next/server';
const hosts = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
/** Next may normalize its internal URL to localhost; the browser origin follows Host. */
export function isSameOriginLocalDossierRequest(request: NextRequest): boolean {
  if (!hosts.has(request.nextUrl.hostname)) return false;
  try {
    const authority = new URL(`${request.nextUrl.protocol}//${request.headers.get('host') || request.nextUrl.host}`);
    if (!hosts.has(authority.hostname) || authority.username || authority.password || authority.pathname !== '/') return false;
    const origin = request.headers.get('origin');
    return !origin || origin === authority.origin;
  } catch { return false; }
}
