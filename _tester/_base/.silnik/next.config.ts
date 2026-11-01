import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';
// @sentry/nextjs jest required dependency w package.json — usunięcie wymaga rollbacku do .mjs z dynamic import (try/catch wokół ESM static import jest niemożliwe)
import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';

// next-intl: wskazujemy plik request config (i18n routing + messages).
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const localDesktop = process.env.NEXT_PUBLIC_LOCAL_MODE === 'true' || process.env.STRAZNIK_DESKTOP_UPDATE === '1';

const nextConfig: NextConfig = {
  // Desktop serves original local files and never writes an image cache into the signed app.
  images: { unoptimized: localDesktop },
  // PDF-y przygód są wysyłane jako multipart/form-data do Route Handlera.
  // Domyślny limit proxy Next.js (10 MB) ucinał większe startery przed endpointem.
  experimental: {
    // A signed desktop bundle is immutable, including metadata routes such as favicon.
    isrFlushToDisk: !localDesktop,
    proxyClientMaxBodySize: '500mb',
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
  serverExternalPackages: ['pdf-parse', 'better-sqlite3', 'node-dtls-client'],
  async headers() {
    return [
      {
        // Nagłówki bezpieczeństwa dla wszystkich stron
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      {
        // CORS dla API routes
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400',
          },
        ],
      },
    ];
  },
};

// Buduj końcowy config — Sentry owijamy warunkowo żeby nie blokować gdy DSN nie ustawiony
const finalConfig = withNextIntl(withBundleAnalyzer(nextConfig));

const config: NextConfig = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(finalConfig, {
      // Wycisz logi Sentry podczas buildu
      silent: !process.env.CI,
      // Upload source maps wyłącznie gdy mamy token (produkcja). Bez tokenu Sentry pomija upload silently.
      sourcemaps: {
        disable: !process.env.SENTRY_AUTH_TOKEN,
      },
      org: process.env.SENTRY_ORG || '',
      project: process.env.SENTRY_PROJECT || 'zew-cthulhu',
      // Automatyczny routing błędów przez Sentry tunnel (omija ad-blockery)
      tunnelRoute: '/monitoring-tunnel',
      // Nie dodawaj Sentry do wszystkich route'ów automatycznie (robimy to ręcznie)
      autoInstrumentServerFunctions: false,
    })
  : finalConfig;

export default config;
