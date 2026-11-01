'use client';
import { isAuthoredAdventureId } from '@/lib/adventure-dossier/authored-scenarios';
import { activateAuthoredPrabutySession } from '@/lib/adventure-dossier/authored-client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { extractLocalDossierImages } from '@/lib/adventure-dossier/local-handouts';
import { saveLocalDossier } from '@/lib/adventure-dossier/local-library';
import type { Message } from '@/lib/types';
import { getApiKeyHeaders } from '@/lib/api-keys-service';
import { loadAISettings } from '@/lib/ai-settings';
import {
  activateLocalDossierPack,
  findReleasedDossierPack,
  openPreparedDossier,
  restorePreparedDossier,
  hasLocalDossierRuntime,
  type PreparedDossierPack,
} from '@/lib/adventure-dossier/client-activation';

/**
 * Hook do zarządzania uploadem i pamięcią PDF
 * Wyodrębniony z page.tsx dla zgodności z GEMINI.md (max 200 linii/plik)
 *
 * Po uploadzie automatycznie indeksuje PDF do lokalnego RAG
 * (namespace "rules" / "adventures").
 */

export interface PdfMemory {
  rulesUrl?: string;
  rulesTextUrl?: string;
  rulesGeminiFileUri?: string;
  rulesTextGeminiFileUri?: string; // URI pliku tekstowego (wyekstraktowany)
  rulesFileName?: string;
  rulesIndexedLocally?: boolean;
  rulesIndexedChunks?: number; // Ile chunków zaindeksowano
  adventureUrl?: string;
  adventureTextUrl?: string;
  adventureGeminiFileUri?: string;
  adventureTextGeminiFileUri?: string; // URI pliku tekstowego (wyekstraktowany)
  adventureFileName?: string;
  adventureIndexedLocally?: boolean;
  adventureIndexedChunks?: number;
  adventureId?: string;
  adventureDossierFingerprint?: string;
  adventureDossierStatus?: 'ready' | 'unavailable';
  lastUpdated?: string;
}

export interface LocalPdfIndexingResult {
  success: boolean;
  indexed: number;
  failed: number;
  totalChunks: number;
  namespace: string;
  durationMs: number;
  error?: string;
}

export function normalizePdfMemory(
  value: PdfMemory | null | undefined
): PdfMemory {
  const memory = value ?? {};
  return {
    ...memory,
    rulesIndexedLocally: memory.rulesIndexedLocally ?? false,
    adventureIndexedLocally: memory.adventureIndexedLocally ?? false,
  };
}

export async function indexPdfLocally(
  file: File,
  type: 'rules' | 'adventure',
  fileName: string = file.name,
  adventureId?: string
): Promise<LocalPdfIndexingResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);
  formData.append('fileName', fileName);
  if (adventureId) {
    formData.append('adventureId', adventureId);
  }

  const response = await fetch('/api/pdf/ingest-local', {
    method: 'POST',
    headers: getApiKeyHeaders(),
    body: formData,
  });
  const result = (await response
    .json()
    .catch(() => ({}))) as Partial<LocalPdfIndexingResult>;
  if (!response.ok || !result.success) {
    throw new Error(result.error || `HTTP ${response.status}`);
  }
  return result as LocalPdfIndexingResult;
}

export interface UsePdfMemoryReturn {
  pdfMemory: PdfMemory;
  setPdfMemory: React.Dispatch<React.SetStateAction<PdfMemory>>;
  isUploading: boolean;
  isIndexing: boolean;
  uploadProgress: number; // 0-100
  indexingProgress: number; // 0-100
  handlePdfUpload: (
    file: File,
    type: 'rules' | 'adventure',
    customAdventureId?: string
  ) => Promise<void>;
  activateDossierForSession: (sessionId: string, adventureId: string) => Promise<{
    ok: boolean;
    reason?: string;
    adventureDossierFingerprint?: string;
    adventureDossierStatus?: 'ready';
  }>;
  handleFileChange: (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'rules' | 'adventure',
    customAdventureId?: string
  ) => void;
}

interface UsePdfMemoryOptions {
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  adventureId?: string;
}

export function usePdfMemory(options: UsePdfMemoryOptions): UsePdfMemoryReturn {
  const { setMessages, adventureId: defaultAdventureId } = options;
  const locale = useLocale();

  const [pdfMemory, setPdfMemory] = useState<PdfMemory>({});
  const preparedDossierRef = useRef<PreparedDossierPack | null>(null);
  useEffect(() => {
    if (!defaultAdventureId) return;
    setPdfMemory(previous => {
      if (!previous.adventureId || previous.adventureId === defaultAdventureId) return previous;
      localStorage.setItem(`pdf_memory:adventure:${previous.adventureId}`, JSON.stringify(previous));
      const next = Object.fromEntries(Object.entries(previous).filter(([key]) => !key.startsWith('adventure'))) as PdfMemory;
      localStorage.setItem('pdf_memory', JSON.stringify(next));
      preparedDossierRef.current = null;
      return next;
    });
  }, [defaultAdventureId, pdfMemory.adventureId]);

  const [isUploading, setIsUploading] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [indexingProgress, setIndexingProgress] = useState(0);

  const handlePdfUpload = useCallback(
    async (
      file: File,
      type: 'rules' | 'adventure',
      customAdventureId?: string
    ) => {
      const effectiveAdventureId = customAdventureId ?? defaultAdventureId;
      setIsUploading(true);
      setUploadProgress(10); // Start

      try {
        if (type === 'adventure') {
          preparedDossierRef.current = null;
          const unavailableMemory: PdfMemory = {
            ...pdfMemory, adventureUrl: '', adventureTextUrl: '',
            adventureGeminiFileUri: undefined, adventureTextGeminiFileUri: undefined,
            adventureDossierFingerprint: undefined, adventureDossierStatus: 'unavailable',
            adventureId: effectiveAdventureId, adventureFileName: file.name,
            adventureIndexedLocally: false, adventureIndexedChunks: 0,
          };
          setPdfMemory(unavailableMemory);
          localStorage.setItem('pdf_memory', JSON.stringify(unavailableMemory));
          if (!hasLocalDossierRuntime()) throw new Error(locale === 'en'
            ? 'Adventure dossiers require the application to run locally on this device.'
            : 'Teczki wymagają uruchomienia aplikacji lokalnie na tym urządzeniu.');
          const lookup = effectiveAdventureId
            ? await findReleasedDossierPack(effectiveAdventureId, file)
            : { ok: false as const, reason: 'pack_not_found' as const };
          if (lookup.ok) {
            const payload = await openPreparedDossier(lookup.prepared);
            const images = await extractLocalDossierImages(file, payload);
            await saveLocalDossier(lookup.prepared, images);
            preparedDossierRef.current = lookup.prepared;
            const newMemory: PdfMemory = {
              ...pdfMemory,
              adventureUrl: '',
              adventureTextUrl: '',
              adventureGeminiFileUri: undefined,
              adventureTextGeminiFileUri: undefined,
              adventureFileName: file.name,
              adventureIndexedLocally: false,
              adventureIndexedChunks: 0,
              adventureId: effectiveAdventureId,
              adventureDossierFingerprint: lookup.prepared.expectedFingerprint,
              adventureDossierStatus: 'ready',
              lastUpdated: new Date().toISOString(),
            };
            setPdfMemory(newMemory);
            localStorage.setItem('pdf_memory', JSON.stringify(newMemory));
            setMessages((prev) => [...prev, {
              id: `dossier-ready-${Date.now()}`,
              role: 'assistant',
              content: locale === 'en'
                ? 'The adventure edition has been recognized. It is ready to start; the PDF remains on this device.'
                : 'Rozpoznano wydanie przygody. Możesz rozpocząć grę; PDF pozostaje na tym urządzeniu.',
              timestamp: new Date(),
            }]);
            setUploadProgress(100);
            return;
          }
          setMessages(prev => [...prev, {
            id: `dossier-unavailable-${Date.now()}`, role: 'assistant',
            content: locale === 'en'
              ? 'This adventure edition is not available to play yet. The PDF has not been uploaded.'
              : 'To wydanie przygody nie jest jeszcze dostępne do gry. PDF nie został wysłany.',
            timestamp: new Date(),
          }]);
          return;
        }

        console.log(
          `📤 Starting PDF upload for ${type}: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)}MB)`
        );

        // Krok 1: Upload pliku i lokalne parsowanie
        console.log(`📤 Step 1: Parsing and uploading PDF locally (GCS-free)...`);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('fileName', file.name);

        const parseResponse = await fetch('/api/pdf/parse-local', {
          method: 'POST',
          headers: getApiKeyHeaders(),
          body: formData,
        });

        if (!parseResponse.ok) {
          let errorMessage = 'Błąd podczas uploadu i parsowania pliku';
          try {
            const errorData = await parseResponse.json();
            errorMessage = errorData.error || errorData.details || errorMessage;
          } catch {
            errorMessage = `Błąd HTTP ${parseResponse.status}: ${parseResponse.statusText}`;
          }
          throw new Error(errorMessage);
        }

        const uploadData = await parseResponse.json();

        if (!uploadData.success) {
          throw new Error(
            uploadData.error || uploadData.details || 'Błąd podczas parsowania'
          );
        }

        console.log(`✅ PDF uploaded and parsed:`, uploadData);
        setUploadProgress(80); // Parse complete

        // Aktualizuj pamięć PDF
        const newMemory: PdfMemory = {
          ...pdfMemory,
          ...(type === 'rules'
            ? {
                rulesUrl: '', // GCS-free
                rulesTextUrl: '',
                rulesGeminiFileUri: uploadData.geminiFileUri,
                rulesTextGeminiFileUri: undefined,
                rulesFileName: uploadData.fileName,
              }
            : {
                adventureUrl: '', // GCS-free
                adventureTextUrl: '',
                adventureGeminiFileUri: uploadData.geminiFileUri,
                adventureTextGeminiFileUri: undefined,
                adventureFileName: uploadData.fileName,
                adventureId: effectiveAdventureId,
              }),
          lastUpdated: new Date().toISOString(),
        };

        setPdfMemory(newMemory);
        localStorage.setItem('pdf_memory', JSON.stringify(newMemory));

        // Zapisz do pamięci serwera
        await fetch('/api/pdf-memory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type,
            url: '',
            textUrl: '',
            geminiFileUri: uploadData.geminiFileUri,
            textGeminiFileUri: undefined,
            filename: uploadData.fileName,
          }),
        });

        // Dodaj wiadomość systemową
        const systemMessage: Message = {
          id: `system-${Date.now()}`,
          role: 'assistant',
          content: `📚 ${type === 'rules' ? 'Zasady gry' : 'Przygoda'} "${uploadData.fileName}" zostały wczytane.\n\n📊 Sparsowano ${uploadData.parsedData.pages} stron (${Math.round(uploadData.parsedData.textLength / 1000)}k znaków).\n📚 Dodawanie do lokalnej pamięci zasad w toku...`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, systemMessage]);
        setUploadProgress(100); // Done

        // Krok 2: Auto-indeksuj sparsowany tekst do lokalnego RAG (fire-and-forget).
        // Bezpieczne, bo używa sparsowanego tekstu z closure.
        if (uploadData.parsedData?.text) {
          void (async () => {
            try {
              setIsIndexing(true);
              setIndexingProgress(5);

              // Wysyłamy lekki JSON zamiast FormData całego pliku!
              const response = await fetch('/api/pdf/ingest-local', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...getApiKeyHeaders(),
                },
                body: JSON.stringify({
                  text: uploadData.parsedData.text,
                  type,
                  fileName: uploadData.fileName,
                  clearBefore:
                    type === 'rules' ||
                    (type === 'adventure' && !!effectiveAdventureId),
                  adventureId: effectiveAdventureId,
                }),
              });

              if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
              }

              const indexResult = await response.json();
              setIndexingProgress(95);

              if (indexResult.success) {
                const indexedKey =
                  type === 'rules'
                    ? 'rulesIndexedLocally'
                    : 'adventureIndexedLocally';
                const chunksKey =
                  type === 'rules'
                    ? 'rulesIndexedChunks'
                    : 'adventureIndexedChunks';

                setPdfMemory((prev) => {
                  const updated = {
                    ...prev,
                    [indexedKey]: true,
                    [chunksKey]: indexResult.indexed,
                  };
                  localStorage.setItem('pdf_memory', JSON.stringify(updated));
                  return updated;
                });

                const idxMsg: Message = {
                  id: `local-rag-${Date.now()}`,
                  role: 'assistant',
                  content: `📚 ${type === 'rules' ? 'Zasady' : 'Przygoda'} dodane do lokalnej pamięci: ${indexResult.indexed}/${indexResult.totalChunks} fragmentów (${indexResult.durationMs}ms).`,
                  timestamp: new Date(),
                };
                setMessages((prev) => [...prev, idxMsg]);
              }
            } catch (e) {
              console.warn('⚠️ Local PDF indexing error (non-blocking):', e);
              const errorMsg: Message = {
                id: `local-rag-error-${Date.now()}`,
                role: 'assistant',
                content: `⚠️ Nie udało się dodać ${type === 'rules' ? 'zasad' : 'przygody'} do lokalnej pamięci: ${e instanceof Error ? e.message : 'Nieznany błąd'}. Plik pozostaje wczytany i możesz spróbować ponownie później.`,
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, errorMsg]);
            } finally {
              setIsIndexing(false);
              setTimeout(() => setIndexingProgress(0), 500);
            }
          })();
        }
      } catch (error) {
        console.error('❌ Błąd podczas uploadu PDF:', error);

        const errorContent = locale === 'en' ? 'Unable to import the file.' : 'Nie udało się wczytać pliku.';
        const errorDetails = type === 'adventure'
          ? !hasLocalDossierRuntime()
            ? locale === 'en'
              ? 'Run the application locally on this device to open an adventure.'
              : 'Aby otworzyć przygodę, uruchom aplikację lokalnie na tym urządzeniu.'
            : locale === 'en'
              ? 'The adventure and its required materials could not be prepared. The PDF has not been uploaded.'
              : 'Nie udało się przygotować przygody i jej wymaganych materiałów. PDF nie został wysłany.'
          : error instanceof Error ? error.message : locale === 'en' ? 'Unknown error' : 'Nieznany błąd';

        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `${errorContent}\n\n${errorDetails}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsUploading(false);
        // Reset progress after brief delay
        setTimeout(() => setUploadProgress(0), 500);
      }
    },
    [pdfMemory, setMessages, defaultAdventureId, locale]
  );

  const activateDossierForSession = useCallback(
    async (sessionId: string, adventureId: string) => {
      const fingerprint = pdfMemory.adventureId && pdfMemory.adventureId !== adventureId ? undefined : pdfMemory.adventureDossierFingerprint;
      if (isAuthoredAdventureId(adventureId) && !preparedDossierRef.current) {
        try {
          const authored = await activateAuthoredPrabutySession(sessionId, adventureId, fingerprint, { freshSession: true });
          if (authored) {
            const binding = { adventureDossierFingerprint: authored.editionFingerprint, adventureDossierStatus: 'ready' as const };
            setPdfMemory(previous => {
              const next = { ...previous, ...binding, adventureId };
              localStorage.setItem('pdf_memory', JSON.stringify(next));
              return next;
            });
            return { ok: true, ...binding };
          }
        } catch { return { ok: false, reason: 'LOCAL_PLAYTEST_ACTIVATION_FAILED' }; }
      }
      const cached = preparedDossierRef.current;
      const prepared = cached?.adventureId === adventureId && cached.expectedFingerprint === fingerprint
        ? cached : fingerprint ? await restorePreparedDossier(adventureId, fingerprint) : null;
      if (!fingerprint && !prepared) return { ok: true };
      if (!prepared || prepared.adventureId !== adventureId) {
        return { ok: false, reason: 'DOSSIER_LOCAL_SOURCE_UNAVAILABLE' };
      }
      return activateLocalDossierPack({
        sessionId,
        adventureId,
        expectedFingerprint: prepared.expectedFingerprint,
        sourcePdf: prepared.sourcePdf,
        encryptedPack: prepared.encryptedPack,
      });
    },
    [pdfMemory.adventureDossierFingerprint, pdfMemory.adventureId],
  );

  const handleFileChange = useCallback(
    (
      e: React.ChangeEvent<HTMLInputElement>,
      type: 'rules' | 'adventure',
      customAdventureId?: string
    ) => {
      const file = e.target.files?.[0];
      if (file) {
        handlePdfUpload(file, type, customAdventureId);
      }
    },
    [handlePdfUpload]
  );

  return {
    pdfMemory,
    setPdfMemory,
    isUploading,
    isIndexing,
    uploadProgress,
    indexingProgress,
    handlePdfUpload,
    activateDossierForSession,
    handleFileChange,
  };
}
