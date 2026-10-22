/**
 * Next.js middleware: next-intl routing plus API trace IDs.
 */
import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

function makeTraceId(): string {
  return `tel_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function withTraceId(request: NextRequest): NextResponse {
  const traceId = request.headers.get('x-trace-id') ?? makeTraceId();
  const headers = new Headers(request.headers);
  headers.set('x-trace-id', traceId);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('x-trace-id', traceId);
  return response;
}

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) return withTraceId(request);
  if (request.nextUrl.pathname.startsWith('/fonts/')) return NextResponse.next();
  if (request.nextUrl.pathname === '/welcome') return NextResponse.next();
  if (request.nextUrl.pathname === '/default-gm-prompt.md' || request.nextUrl.pathname === '/default-gm-prompt-en.md') return NextResponse.next();
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|fonts|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|eot|mp3|wav)$).*)',
    '/(api|trpc)(.*)',
  ],
};

