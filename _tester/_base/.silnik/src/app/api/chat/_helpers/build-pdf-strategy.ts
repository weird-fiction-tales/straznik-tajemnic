/**
 * buildPdfStrategy - pure function dla sekcji PDF STRATEGY route.ts (IND-183 micro 4/5).
 *
 * Decyduje czy używać native Gemini Files API (file_api) czy fallback do RAG
 * (lokalny RAG retrieval). Strategy `file_api` aktywna tylko gdy:
 *   - PDF files uploaded (pdfMemory ma Gemini file URI)
 *   - AND (early session ≤10 msg LUB rule-lookup query)
 *
 * Zachowuje 1:1 zachowanie z oryginalnego route.ts (lin 186-212 przed split).
 *
 * Pure function: brak side effects, brak async, brak external deps.
 */

// Minimal shape z pdfMemory (file URIs + mime types + adventureId).
// Pełny PdfMemory z @/hooks/usePdfMemory ma więcej pól (parsed metadata, local indexing status).
import { isDocumentModelUseBlocked } from '@/lib/document-model-policy';

export interface PdfMemoryAttachments {
  rulesGeminiFileUri?: string;
  rulesGeminiMimeType?: string;
  adventureGeminiFileUri?: string;
  adventureGeminiMimeType?: string;
  adventureId?: string;
  adventureDossierFingerprint?: string;
  adventureDossierStatus?: 'ready' | 'unavailable';
}

export interface BuildPdfStrategyOpts {
  pdfMemory?: PdfMemoryAttachments | null;
  message: string;
  messages?: Array<unknown> | null;
  isGameStart?: boolean;
}

export interface BuildPdfStrategyResult {
  pdfStrategy: 'file_api' | 'rag';
  fileAttachments: Array<{ fileUri: string; mimeType: string }>;
}

// Wykryj zapytanie o zasady CoC (PL + EN). Regex case-insensitive z rdzeniami +
// `\w*` żeby matchować deklinacje PL:
//   walk* → walka/walki/walce/walkach
//   rzut*/rzuc* → rzut/rzutu + rzucać/rzucanie/rzucił
//   umiejętn* → umiejętność/umiejętności/umiejętnościami (drop ć przed inflekcją)
//   mechanik* → mechanika/mechanikę/mechaniką
//   zasad*/reguł* → zasady/zasadach + regułach/regułami
const RULE_LOOKUP_REGEX =
  /\b(zasad|reguł|mechanik|test|rzut|rzuc|umiejętn|skill|rule|check|combat|walk)\w*/i;

export function buildPdfStrategy(
  opts: BuildPdfStrategyOpts
): BuildPdfStrategyResult {
  // Also blocks stale file URIs restored from older saves.
  if (isDocumentModelUseBlocked()) return { pdfStrategy: 'rag', fileAttachments: [] };
  const hasPdfFiles = !!(
    opts.pdfMemory?.rulesGeminiFileUri || opts.pdfMemory?.adventureGeminiFileUri
  );
  const isEarlySession =
    opts.isGameStart || !opts.messages || opts.messages.length < 10;
  const isRuleLookup = RULE_LOOKUP_REGEX.test(opts.message);

  const pdfStrategy: 'file_api' | 'rag' =
    hasPdfFiles && (isEarlySession || isRuleLookup) ? 'file_api' : 'rag';

  const fileAttachments: Array<{ fileUri: string; mimeType: string }> = [];
  if (pdfStrategy === 'file_api') {
    if (opts.pdfMemory?.rulesGeminiFileUri) {
      fileAttachments.push({
        fileUri: opts.pdfMemory.rulesGeminiFileUri,
        mimeType: opts.pdfMemory.rulesGeminiMimeType || 'text/plain',
      });
    }
    if (opts.pdfMemory?.adventureGeminiFileUri) {
      fileAttachments.push({
        fileUri: opts.pdfMemory.adventureGeminiFileUri,
        mimeType: opts.pdfMemory.adventureGeminiMimeType || 'text/plain',
      });
    }
  }

  return { pdfStrategy, fileAttachments };
}
