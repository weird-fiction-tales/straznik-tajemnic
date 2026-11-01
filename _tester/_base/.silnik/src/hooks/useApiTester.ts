'use client';
import { getHueStatus } from '@/lib/hardware/hue/hue-client';

import { useState, useCallback } from 'react';

/**
 * Hook do testowania 6 zewnętrznych API (gemini, googleTTS, replicate, cloudSessions,
 * elevenlabs, openai). Aktualizuje wyniki w `testResults`.
 *
 * Uwagi architektoniczne:
 * - `loadAvailableVoices` callback - po pomyślnym teście googleTTS hook musi odświeżyć
 *   listę głosów; konsument przekazuje tę funkcję bo trzyma state list.
 * - `setIsLoading` w return - wymóg `tts-settings.tsx` który kontroluje loading state
 *   wewnętrznie.
 *
 * Wyodrębniony z `settings-modal.tsx` (linie 358-485) jako część IND-17.
 */

export interface TestResults {
  gemini: boolean | null;
  tts: boolean | null;
  image: boolean | null;
  hue: boolean | null;
  /** @deprecated zachowane dla kompatybilności wstecznej */
  googleTTS?: boolean | null;
  /** @deprecated zachowane dla kompatybilności wstecznej */
  replicate?: boolean | null;
  /** @deprecated zachowane dla kompatybilności wstecznej */
  cloudSessions?: boolean | null;
}

export interface UseApiTesterReturn {
  testResults: TestResults;
  isLoading: boolean;
  /** Dispatch - wymóg sub-komponentu TTSSettings (linia 23) */
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  testAPI: (apiType: string) => Promise<void>;
  testAllAPIs: () => Promise<void>;
  getTestResultIcon: (result: boolean | null) => string;
  getTestResultColor: (result: boolean | null) => string;
}

export interface UseApiTesterOptions {
  /**
   * Getter callback dla live klucza Gemini z formularza (IND-30 sesja 21).
   * Bez tego `checkAPIStatus` czyta localStorage, omijając wpisany ale niezapisany klucz.
   */
  getGeminiApiKey?: () => string;
  /** Wywoływane po pomyślnym teście googleTTS - odświeża listę głosów w konsumencie. */
  loadAvailableVoices?: () => Promise<void>;
}

const initialResults: TestResults = {
  gemini: null,
  tts: null,
  image: null,
  hue: null,
};

export function useApiTester(options: UseApiTesterOptions): UseApiTesterReturn {
  const { getGeminiApiKey, loadAvailableVoices } = options;

  const [testResults, setTestResults] = useState<TestResults>(initialResults);
  const [isLoading, setIsLoading] = useState(false);

  const testAPI = useCallback(
    async (apiType: string) => {
      setIsLoading(true);
      try {
        let response;
        const liveKey = getGeminiApiKey?.()?.trim();
        const authHeaders: Record<string, string> = {};
        if (liveKey) {
          authHeaders['X-Gemini-Api-Key'] = liveKey;
        }

        switch (apiType) {
          case 'gemini': {
            const { geminiService } = await import('@/lib/gemini-service');
            const result = await geminiService.checkAPIStatus(liveKey);
            setTestResults((prev) => ({ ...prev, gemini: result }));
            setIsLoading(false);
            return;
          }

          case 'tts':
          case 'googleTTS': {
            response = await fetch('/api/tts/gemini', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...authHeaders },
              body: JSON.stringify({
                text: 'Próba syntezy głosu.',
                voice: 'Charon',
                languageCode: 'pl-PL',
              }),
            });
            const ok = response.ok;
            setTestResults((prev) => ({
              ...prev,
              tts: ok,
              googleTTS: ok,
            }));
            if (ok && loadAvailableVoices) {
              await loadAvailableVoices();
            }
            setIsLoading(false);
            return;
          }

          case 'image':
          case 'replicate': {
            response = await fetch('/api/health/gemini', {
              headers: authHeaders,
            });
            const ok = response.ok;
            setTestResults((prev) => ({
              ...prev,
              image: ok,
              replicate: ok,
            }));
            setIsLoading(false);
            return;
          }

          case 'hue': {
            const status = await getHueStatus();
            setTestResults((prev) => ({
              ...prev,
              hue: status.paired && !status.error && status.lights.length > 0,
            }));
            setIsLoading(false);
            return;
          }

          case 'cloudSessions': {
            setTestResults((prev) => ({ ...prev, cloudSessions: true }));
            setIsLoading(false);
            return;
          }

          default:
            setIsLoading(false);
            return;
        }
      } catch {
        setTestResults((prev) => ({ ...prev, [apiType]: false }));
      } finally {
        setIsLoading(false);
      }
    },
    [getGeminiApiKey, loadAvailableVoices]
  );

  const testAllAPIs = useCallback(async () => {
    await testAPI('gemini');
    await testAPI('tts');
    await testAPI('image');
    await testAPI('hue');
  }, [testAPI]);

  const getTestResultIcon = useCallback((result: boolean | null) => {
    if (result === null) return '⚪';
    return result ? '✅' : '❌';
  }, []);

  const getTestResultColor = useCallback((result: boolean | null) => {
    if (result === null) return 'text-muted-foreground';
    return result ? 'text-green-400' : 'text-red-400';
  }, []);

  return {
    testResults,
    isLoading,
    setIsLoading,
    testAPI,
    testAllAPIs,
    getTestResultIcon,
    getTestResultColor,
  };
}
