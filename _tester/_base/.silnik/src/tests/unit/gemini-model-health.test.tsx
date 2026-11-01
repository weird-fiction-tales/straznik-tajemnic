import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import type { NextRequest } from 'next/server';

jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}));

import {
  GET,
  type GeminiHealth,
} from '@/app/api/health/gemini/route';
import { HeaderSection } from '@/components/settings/gemini-sections/header';
import { HealthStatusPanel } from '@/components/settings/health-status-panel';
import { defaultAISettings } from '@/lib/ai-settings/defaults';

function makeNextRequest(
  url: string,
  headers: Record<string, string> = {}
): NextRequest {
  const parsed = new URL(url);
  return {
    url,
    nextUrl: parsed,
    headers: {
      get: (name: string) => {
        const match = Object.entries(headers).find(
          ([k]) => k.toLowerCase() === name.toLowerCase()
        );
        return match ? match[1] : null;
      },
    },
  } as unknown as NextRequest;
}

const mockModelsList = jest.fn();
const mockGenerateContent = jest.fn();

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      list: (...args: unknown[]) => mockModelsList(...args),
      generateContent: (...args: unknown[]) => mockGenerateContent(...args),
    },
  })),
}));

jest.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string, values?: Record<string, unknown>) => {
    if (ns === 'GeminiHeaderSection') {
      const map: Record<string, string> = {
        title: 'Gemini API (Google AI)',
        testApi: 'Test API',
        enableLabel: 'Włącz Gemini API',
        enableHelp: 'Pomoc',
        apiKeyLabel: 'API Key',
        apiKeyHelp: 'Pomoc klucza',
        apiKeyPlaceholder: 'Wprowadź klucz API',
        modelLabel: 'Model',
        modelHelp: 'Pomoc modelu',
        modelStatusChecking: 'Sprawdzam model…',
        modelStatusAvailable: `Dostępny (${values?.ms ?? 1} ms)`,
        modelStatusOverloaded: 'Przeciążony (503 High Demand)',
        modelStatusRateLimited: 'Limit zapytań (429 Quota)',
        modelStatusUnavailable: 'Niedostępny (sprawdź klucz/model)',
      };
      return map[key] || key;
    }
    if (ns === 'HealthStatusPanel') {
      const map: Record<string, string> = {
        title: 'Zdrowie Strażnika',
        checking: 'Sprawdzam…',
        checkNow: 'Sprawdź teraz',
        geminiKey: 'Klucz Gemini',
        statusOk: 'Klucz Gemini ważny',
        statusInvalidKey: 'Klucz nieważny lub wygasły',
        statusNetworkError: 'Nie udało się sprawdzić (problem sieci)',
        statusNoKey: 'Brak klucza',
        clickToVerify: 'Kliknij „Sprawdź teraz”, by zweryfikować klucz.',
        narrationModels: 'Modele narracji',
        noLiveModels: 'Brak żywych modeli narracji.',
        modelMissing: `${values?.id ?? ''} - brak w żywym API`,
        ragEmbeddings: 'Embeddingi RAG',
        embeddingsAvailable: '✅ Dostępne',
        embeddingsMissing: '❌ Brak',
        checkedAt: `Sprawdzono: ${values?.time ?? ''}`,
        pricing: 'Cennik',
        pricingFresh: 'Świeży (pobrany z API)',
        pricingCached: 'Z pamięci podręcznej',
        pricingBundled: 'Wbudowany',
        refreshing: 'Odświeżam…',
        refreshPricing: 'Odśwież cennik',
        healthTimeout: 'Przekroczono limit czasu połączenia (8s)',
        pricingTimeout: 'Przekroczono limit czasu (25s)',
        networkError: 'Błąd połączenia sieciowego',
        selectedModelStatus: 'Stan wybranego modelu',
        modelPingAvailable: `Dostępny (${values?.ms ?? 1} ms)`,
        modelPingOverloaded: 'Przeciążony (503 High Demand)',
        modelPingRateLimited: 'Limit zapytań (429 Quota)',
        modelPingUnavailable: 'Niedostępny (błąd klucza lub modelu)',
      };
      return map[key] || key;
    }
    return key;
  },
}));

function createAsyncIterable<T>(items: T[]): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      let idx = 0;
      return {
        async next() {
          if (idx < items.length) {
            return { value: items[idx++], done: false };
          }
          return { value: undefined as unknown as T, done: true };
        },
      };
    },
  };
}

describe('Issue #521 - Wskaźnik stanu i dostępności wybranego modelu Gemini', () => {
  const originalEnvKey = process.env.GEMINI_API_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.GEMINI_API_KEY;
    localStorage.clear();
    mockModelsList.mockResolvedValue(
      createAsyncIterable([
        {
          name: 'models/gemini-3.8-flash',
          supportedActions: ['generateContent'],
        },
        {
          name: 'models/gemini-embedding-001',
          supportedActions: ['embedContent'],
        },
      ])
    );
  });

  afterAll(() => {
    if (originalEnvKey !== undefined) {
      process.env.GEMINI_API_KEY = originalEnvKey;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
    global.fetch = originalFetch;
  });

  describe('GET /api/health/gemini?model=...', () => {
    it('zwraca zielony stan available z czasem odpowiedzi latencyMs dla działającego modelu', async () => {
      mockGenerateContent.mockResolvedValue({ text: 'ok' });

      const req = makeNextRequest(
        'http://localhost:3000/api/health/gemini?model=gemini-3.8-flash',
        { 'X-Gemini-Api-Key': 'test-valid-key' }
      );

      const res = await GET(req);
      const body = (await res.json()) as GeminiHealth;

      expect(body.status).toBe('ok');
      expect(body.modelPing).toBeDefined();
      expect(body.modelPing?.model).toBe('gemini-3.8-flash');
      expect(body.modelPing?.state).toBe('available');
      expect(body.modelPing?.reason).toBe('ok');
      expect(typeof body.modelPing?.latencyMs).toBe('number');
      expect(body.modelPing?.latencyMs).toBeGreaterThanOrEqual(1);
    });

    it('zwraca żółty stan overloaded (high_demand) przy błędzie 503 UNAVAILABLE / High Demand', async () => {
      mockGenerateContent.mockRejectedValue({
        status: 503,
        message: '503 UNAVAILABLE: The model is overloaded due to high demand.',
      });

      const req = makeNextRequest(
        'http://localhost:3000/api/health/gemini?model=gemini-3.8-flash',
        { 'X-Gemini-Api-Key': 'test-valid-key' }
      );

      const res = await GET(req);
      const body = (await res.json()) as GeminiHealth;

      expect(body.status).toBe('ok');
      expect(body.modelPing?.state).toBe('overloaded');
      expect(body.modelPing?.reason).toBe('high_demand');
      expect(body.modelPing?.latencyMs).toBeNull();
    });

    it('zwraca żółty stan overloaded (rate_limited) przy błędzie 429 RESOURCE_EXHAUSTED', async () => {
      mockGenerateContent.mockRejectedValue({
        status: 429,
        message: '429 RESOURCE_EXHAUSTED: Quota exceeded',
      });

      const req = makeNextRequest(
        'http://localhost:3000/api/health/gemini?model=gemini-3.8-flash',
        { 'X-Gemini-Api-Key': 'test-valid-key' }
      );

      const res = await GET(req);
      const body = (await res.json()) as GeminiHealth;

      expect(body.modelPing?.state).toBe('overloaded');
      expect(body.modelPing?.reason).toBe('rate_limited');
    });

    it('zwraca czerwony stan unavailable (invalid_key) przy braku klucza lub błędzie 400/403', async () => {
      const noKeyReq = makeNextRequest(
        'http://localhost:3000/api/health/gemini?model=gemini-2.5-flash'
      );
      const noKeyRes = await GET(noKeyReq);
      const noKeyBody = (await noKeyRes.json()) as GeminiHealth;

      expect(noKeyBody.status).toBe('no_key');
      expect(noKeyBody.modelPing).toEqual({
        model: 'gemini-2.5-flash',
        state: 'unavailable',
        latencyMs: null,
        reason: 'invalid_key',
      });
    });

    it('zwraca czerwony stan unavailable (not_found) przy błędzie 404 lub 400 dla nieobsługiwanego modelu', async () => {
      mockGenerateContent.mockRejectedValueOnce({
        status: 404,
        message: '404 NOT_FOUND: Model gemini-2.0-flash is not found',
      });

      const req404 = makeNextRequest(
        'http://localhost:3000/api/health/gemini?model=gemini-2.0-flash',
        { 'X-Gemini-Api-Key': 'test-valid-key' }
      );

      const res404 = await GET(req404);
      const body404 = (await res404.json()) as GeminiHealth;

      expect(body404.modelPing?.state).toBe('unavailable');
      expect(body404.modelPing?.reason).toBe('not_found');

      mockGenerateContent.mockRejectedValueOnce({
        status: 400,
        message:
          '400 INVALID_ARGUMENT: Model gemini-legacy is not supported for generateContent',
      });

      const req400 = makeNextRequest(
        'http://localhost:3000/api/health/gemini?model=gemini-legacy',
        { 'X-Gemini-Api-Key': 'test-valid-key' }
      );

      const res400 = await GET(req400);
      const body400 = (await res400.json()) as GeminiHealth;

      expect(body400.modelPing?.state).toBe('unavailable');
      expect(body400.modelPing?.reason).toBe('not_found');
    });
  });

  describe('HeaderSection i HealthStatusPanel - 3-stanowa kropka w UI', () => {
    it('wyświetla zieloną kropkę dostępności i opóźnienie przy selektorze modelu w HeaderSection', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () =>
          ({
            status: 'ok',
            keyValid: true,
            availableModels: ['gemini-3.8-flash'],
            registry: {
              chatModelsPresent: ['gemini-3.8-flash'],
              chatModelsMissing: [],
              embeddingPresent: true,
            },
            checkedAt: '2026-09-30T19:00:00.000Z',
            modelPing: {
              model: 'gemini-3.8-flash',
              state: 'available',
              latencyMs: 128,
              reason: 'ok',
            },
          }) satisfies GeminiHealth,
      }) as unknown as typeof fetch;

      render(
        <HeaderSection
          settings={{ ...defaultAISettings, geminiApiKey: 'test-key' }}
          setSettings={jest.fn()}
          testResults={{ gemini: null }}
          isLoading={false}
          testAPI={jest.fn()}
          getTestResultColor={() => ''}
          getTestResultIcon={() => ''}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByTestId('gemini-model-status-indicator')
        ).toHaveAttribute('data-state', 'available');
      });

      const dot = screen.getByTestId('gemini-model-status-dot');
      expect(dot.className).toContain('bg-emerald-400');
      expect(screen.getByText(/Dostępny \(128 ms\)/i)).toBeInTheDocument();
    });

    it('ignoruje spóźnioną odpowiedź fetch przy szybkiej zmianie modelu w HeaderSection (brak wyścigu)', async () => {
      let resolveFirst!: (value: unknown) => void;
      const firstPromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (String(url).includes('gemini-3.8-flash')) {
          return firstPromise;
        }
        return Promise.resolve({
          ok: true,
          json: async () =>
            ({
              status: 'ok',
              keyValid: true,
              availableModels: ['gemini-2.5-pro'],
              registry: {
                chatModelsPresent: ['gemini-2.5-pro'],
                chatModelsMissing: [],
                embeddingPresent: true,
              },
              checkedAt: '2026-09-30T19:00:00.000Z',
              modelPing: {
                model: 'gemini-2.5-pro',
                state: 'available',
                latencyMs: 95,
                reason: 'ok',
              },
            }) satisfies GeminiHealth,
        });
      }) as unknown as typeof fetch;

      const { rerender } = render(
        <HeaderSection
          settings={{
            ...defaultAISettings,
            geminiApiKey: 'test-key',
            geminiSettings: {
              ...defaultAISettings.geminiSettings,
              model: 'gemini-3.8-flash',
            },
          }}
          setSettings={jest.fn()}
          testResults={{ gemini: null }}
          isLoading={false}
          testAPI={jest.fn()}
          getTestResultColor={() => ''}
          getTestResultIcon={() => ''}
        />
      );

      // Szybka zmiana modelu zanim pierwszy request się zakończy
      rerender(
        <HeaderSection
          settings={{
            ...defaultAISettings,
            geminiApiKey: 'test-key',
            geminiSettings: {
              ...defaultAISettings.geminiSettings,
              model: 'gemini-2.5-pro',
            },
          }}
          setSettings={jest.fn()}
          testResults={{ gemini: null }}
          isLoading={false}
          testAPI={jest.fn()}
          getTestResultColor={() => ''}
          getTestResultIcon={() => ''}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Dostępny \(95 ms\)/i)).toBeInTheDocument();
      });

      // Teraz spóźniony pierwszy request zwraca błąd 503 - powinien zostać zignorowany
      resolveFirst({
        ok: true,
        json: async () =>
          ({
            status: 'ok',
            keyValid: true,
            availableModels: ['gemini-3.8-flash'],
            registry: {
              chatModelsPresent: ['gemini-3.8-flash'],
              chatModelsMissing: [],
              embeddingPresent: true,
            },
            checkedAt: '2026-09-30T19:00:00.000Z',
            modelPing: {
              model: 'gemini-3.8-flash',
              state: 'overloaded',
              latencyMs: null,
              reason: 'high_demand',
            },
          }) satisfies GeminiHealth,
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('gemini-model-status-indicator')
        ).toHaveAttribute('data-state', 'available');
      });
      expect(screen.getByText(/Dostępny \(95 ms\)/i)).toBeInTheDocument();
    });

    it('wyświetla żółtą kropkę przeciążenia (503 High Demand) w HealthStatusPanel i reaguje na zmianę selectedModel', async () => {
      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (String(url).includes('/api/pricing/refresh')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              source: 'bundled',
              lastVerified: '2026-09-30',
            }),
          });
        }
        const isPro = String(url).includes('gemini-2.5-pro');
        return Promise.resolve({
          ok: true,
          json: async () =>
            ({
              status: 'ok',
              keyValid: true,
              availableModels: ['gemini-3.8-flash', 'gemini-2.5-pro'],
              registry: {
                chatModelsPresent: ['gemini-3.8-flash'],
                chatModelsMissing: [],
                embeddingPresent: true,
              },
              checkedAt: '2026-09-30T19:00:00.000Z',
              modelPing: isPro
                ? {
                    model: 'gemini-2.5-pro',
                    state: 'available',
                    latencyMs: 140,
                    reason: 'ok',
                  }
                : {
                    model: 'gemini-3.8-flash',
                    state: 'overloaded',
                    latencyMs: null,
                    reason: 'high_demand',
                  },
            }) satisfies GeminiHealth,
        });
      }) as unknown as typeof fetch;

      const { rerender } = render(
        <HealthStatusPanel selectedModel="gemini-3.8-flash" />
      );

      await waitFor(() => {
        expect(
          screen.getByTestId('health-panel-model-status')
        ).toHaveAttribute('data-state', 'overloaded');
      });

      const dot = screen.getByTestId('health-panel-model-status-dot');
      expect(dot.className).toContain('bg-amber-400');
      expect(
        screen.getByText(/Przeciążony \(503 High Demand\)/i)
      ).toBeInTheDocument();

      rerender(<HealthStatusPanel selectedModel="gemini-2.5-pro" />);

      await waitFor(() => {
        expect(
          screen.getByTestId('health-panel-model-status')
        ).toHaveAttribute('data-state', 'available');
      });
      expect(screen.getByText(/gemini-2\.5-pro:/i)).toBeInTheDocument();
      expect(screen.getByText(/Dostępny \(140 ms\)/i)).toBeInTheDocument();
    });
  });
});


describe('local playtest server transport handshake', () => {
  const savedKey = process.env.GEMINI_API_KEY;
  const savedMode = process.env.ZEW_LOCAL_PLAYTEST;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = 'server-test-key';
    process.env.ZEW_LOCAL_PLAYTEST = 'prabuty-tomasz';
    mockModelsList.mockResolvedValue(createAsyncIterable([]));
  });
  afterAll(() => {
    if (savedKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = savedKey;
    if (savedMode === undefined) delete process.env.ZEW_LOCAL_PLAYTEST;
    else process.env.ZEW_LOCAL_PLAYTEST = savedMode;
  });
  it('exposes only the verified boolean for explicit same-origin loopback with the env key', async () => {
    const body = await (await GET(makeNextRequest('http://localhost:3818/api/health/gemini', {
      host: '127.0.0.1:3818', origin: 'http://127.0.0.1:3818',
    }))).json();
    expect(body.serverConfigured).toBe(true);
    expect(JSON.stringify(body)).not.toContain('server-test-key');
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });
  it.each([
    ['remote', 'https://example.com/api/health/gemini', {}],
    ['foreign origin', 'http://localhost:3818/api/health/gemini', { origin: 'https://evil.example' }],
    ['remote Host', 'http://localhost:3818/api/health/gemini', { host: 'example.com' }],
    ['client key', 'http://localhost:3818/api/health/gemini', { 'X-Gemini-Api-Key': 'client-test-key' }],
  ])('does not advertise transport for %s', async (_name, url, headers) => {
    const body = await (await GET(makeNextRequest(url as string, headers as Record<string,string>))).json();
    expect(body.serverConfigured).not.toBe(true);
  });
  it('does not advertise transport without the explicit mode or with an invalid key', async () => {
    delete process.env.ZEW_LOCAL_PLAYTEST;
    expect((await (await GET(makeNextRequest('http://localhost/api/health/gemini'))).json()).serverConfigured).not.toBe(true);
    process.env.ZEW_LOCAL_PLAYTEST = 'prabuty-tomasz';
    mockModelsList.mockRejectedValue({ status: 403 });
    expect((await (await GET(makeNextRequest('http://localhost/api/health/gemini'))).json()).serverConfigured).not.toBe(true);
  });
});
