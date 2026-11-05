import { DialogueLine, NPCPosition } from './types';
import { cleanResponseText, isCommonWord } from './text-cleaner';

/** Jawnie podpisany cytat; indeksy obejmują podpis, cytat i końcową interpunkcję. */
export interface AttributedDialogueSpan {
  speaker: string;
  text: string;
  start: number;
  end: number;
  openingQuote: string;
  closingQuote: string;
  punctuationAfterQuote?: string;
}

/** Wspólny parser podpisanych wypowiedzi dla czatu i źródeł dziennika. */
export function extractAttributedDialogueSpans(
  text: string,
  includeIncomplete = false
): AttributedDialogueSpan[] {
  const spans: AttributedDialogueSpan[] = [];
  const labels =
    /(?:^|(?<=\s))(@?[*_]*(?:(?:[A-ZŁŻŹŚĆŃÓĄĘ][\p{L}'’\-]*|[Dd]r\.?|[Pp]rof\.?)\s+){0,3}[A-ZŁŻŹŚĆŃÓĄĘ][\p{L}'’\-]*[*_]*\s*:[*_]*\s*)([„“"«])/gu;
  let match: RegExpExecArray | null;

  while ((match = labels.exec(text)) !== null) {
    const openingQuote = match[2];
    const quoteStart = match.index + match[1].length;
    const closingQuote =
      openingQuote === '"' ? '"' : openingQuote === '«' ? '»' : '”';
    let quoteEnd = -1;
    let escaped = false;
    for (let index = quoteStart + 1; index < text.length; index++) {
      const character = text[index];
      if (character === closingQuote && !escaped) {
        quoteEnd = index;
        break;
      }
      escaped = character === '\\' && !escaped;
    }
    const incomplete = quoteEnd === -1;
    if (incomplete && !includeIncomplete) continue;
    if (incomplete) quoteEnd = text.length;
    // An ASCII quote directly followed by a word may open an unescaped
    // inner quotation. Do not split at an uncertain boundary; the caller
    // can keep the whole line through its existing prose/legacy path.
    if (closingQuote === '"' && /[\p{L}\p{N}]/u.test(text[quoteEnd + 1] ?? ''))
      continue;

    const punctuation = text.slice(quoteEnd + 1).match(/^[.!?,;:…]+/)?.[0];
    const end = incomplete
      ? text.length
      : quoteEnd + 1 + (punctuation?.length ?? 0);
    spans.push({
      speaker: match[1]
        .replace(/[*_]/g, '')
        .replace(/^@/, '')
        .replace(/:\s*$/, '')
        .trim(),
      text: text.slice(quoteStart + 1, quoteEnd),
      start: match.index,
      end,
      openingQuote,
      closingQuote: incomplete ? '' : closingQuote,
      ...(punctuation ? { punctuationAfterQuote: punctuation } : {}),
    });
    labels.lastIndex = end;
  }

  return spans;
}

/** Put signed dialogue on its own line before the streaming TTS sentence splitter.
 * The opening label is recognized before its closing quote arrives, so already
 * queued sentences keep the same boundaries as subsequent chunks are appended.
 */
export function separateAttributedDialogue(text: string): string {
  // Normalize title abbreviations before counting completed speech sentences,
  // even when a streamed name/colon/quote has not arrived yet. The UI keeps the original spelling.
  text = text.replace(/(?<!\p{L})([Dd]r|[Pp]rof)\.(?=\s|$)/gu, '$1');
  const spans = extractAttributedDialogueSpans(text, true);
  if (!spans.length) return text;
  const parts: string[] = [];
  let cursor = 0;
  for (const span of spans) {
    const speechEnd = span.punctuationAfterQuote?.match(/^[,;:]+$/)
      ? span.end - span.punctuationAfterQuote.length
      : span.end;
    parts.push(
      text.slice(cursor, span.start),
      text.slice(span.start, speechEnd).replace(/^(@?[*_]*)(dr|prof)\.?(?=\s)/i,
        (_match, prefix: string, title: string) => prefix + title[0].toUpperCase() + title.slice(1).toLowerCase())
    );
    cursor = span.end;
  }
  parts.push(text.slice(cursor));
  return parts.filter((part) => part.length > 0).join('\n');
}

// === WYKRYWANIE PŁCI NPC ===
export function detectSpeakerGender(textBeforeDialogue: string): 'male' | 'female' | 'unknown' {
    const context = textBeforeDialogue.toLowerCase();

    // Silne wskaźniki męskie
    const maleStrong = [
        /\bbibliotekarz\b/, /\bprofesor\b/, /\bdoktor\b/, /\bdr\.\b/, /\bpan\b/,
        /\bmężczyzna\b/, /\bchłop\b/, /\bstarzec\b/, /\bstarusz\b/, /\bojciec\b/,
        /\bbrat\b/, /\bsyn\b/, /\bmnich\b/, /\bkapłan\b/, /\bksiądz\b/,
        /\bstary\s+(?:człowiek|mężczyzna)\b/, /\bmłody\s+(?:człowiek|mężczyzna)\b/,
    ];

    // Silne wskaźniki żeńskie
    const femaleStrong = [
        /\bbibliotekar(?:ka|ki)\b/, /\bprofesork[ai]\b/, /\bdoktork[ai]\b/, /\bpani\b/,
        /\bkobieta\b/, /\bdziewczyn[aęy]\b/, /\bstaruszk[ai]\b/, /\bmatk[ai]\b/,
        /\bsiostr[ay]\b/, /\bcórk[ai]\b/, /\bwiedźm[ay]\b/, /\bpielęgniark[ai]\b/,
        /\bstara\s+(?:kobieta|pani)\b/, /\bmłoda\s+(?:kobieta|pani|dziewczyna)\b/,
    ];

    for (const pattern of maleStrong) {
        if (pattern.test(context)) return 'male';
    }
    for (const pattern of femaleStrong) {
        if (pattern.test(context)) return 'female';
    }

    return 'male'; // Domyślnie męski dla NPC (statystycznie)
}

// === WYKRYWANIE WIEKU NPC ===
export function detectSpeakerAge(contextBefore: string, contextAfter: string): 'young' | 'middle' | 'old' | 'unknown' {
    const context = (contextBefore + ' ' + contextAfter).toLowerCase();

    const oldPatterns = /starz|stary|sędziw|profesor|doktor|emeryt|dziadek|babci|starusz|podeszł|siw[yae]|pomarszczon/;
    if (oldPatterns.test(context)) return 'old';

    const youngPatterns = /młod|dziecko|chłopiec|dziewczyn|nastolet|mały|mała|chłopak|chłopię|dzieciątko|kilkulet/;
    if (youngPatterns.test(context)) return 'young';

    return 'middle';
}

// === WYKRYWANIE EMOCJI Z KONTEKSTU ===
export function detectEmotionFromContext(text: string, contextBefore: string): 'neutral' | 'fear' | 'anger' | 'sadness' | 'joy' | 'mysterious' | 'whisper' {
    const combined = (contextBefore + ' ' + text).toLowerCase();

    if (/przerażon|boi się|drżąc|trzęs|ze strachem|z lękiem|spanikowa|w panice|z przerażeniem/.test(combined)) return 'fear';
    if (/szepce|szepcze|szepnął|szepnęła|szeptem|cicho mówi|półgłosem|ledwo słyszaln/.test(combined)) return 'whisper';
    if (/wściekł|złośc|gniew|zezłośczon|krzyczy|wrzeszczy|ryczy|warczy|ze złością|gniewnie/.test(combined)) return 'anger';
    if (/smutnie|ze smutkiem|płacze|łzy|załaman|zrozpaczon|żałośnie|z bólem/.test(combined)) return 'sadness';
    if (/radośnie|z radością|entuzjast|podekscytowa|szczęśliw|śmieje się|chichocze|z uśmiechem/.test(combined)) return 'joy';
    if (/tajemnic|zagadkow|mroczn|złowieszcz|niepokojąc|dziwn|osobliw/.test(combined)) return 'mysterious';

    return 'neutral';
}

// === MAPOWANIE EMOCJI NA AUDIO TAGS ===
export function mapEmotionToAudioTag(emotion: 'neutral' | 'fear' | 'anger' | 'sadness' | 'joy' | 'mysterious' | 'whisper'): string {
    const emotionTags: Record<string, string> = {
        'fear': '[fearfully] ',
        'whisper': '[whispers] ',
        'anger': '[angrily] ',
        'sadness': '[sadly] ',
        'joy': '[laughs slightly] ',
        'mysterious': '[in a low, mysterious tone] ',
        'neutral': '',
    };
    return emotionTags[emotion] || '';
}

// === EKSTRAKCJA NAZWY NPC ===
export function extractNPCName(contextBefore: string, contextAfter: string): string {
    const beforePatterns = [
        /(?:profesor|doktor|dr\.|pan|pani|kapitan|sierżant|hrabia|ksiądz|ojciec)\s+([A-ZŻŹĆĄŚĘŁÓŃ][a-ząćęłńóśźż]+)\s*(?:mówi|pyta|odpowiada|szepcze|krzyczy|wzdycha|stwierdza|dodaje|zauważa)?:?\s*$/i,
        /([A-ZŻŹĆĄŚĘŁÓŃ][a-ząćęłńóśźż]+)\s+(?:mówi|pyta|odpowiada|szepcze|krzyczy|wzdycha|stwierdza|dodaje|zauważa):?\s*$/i,
        /([A-ZŻŹĆĄŚĘŁÓŃ][a-ząćęłńóśźż]+\s+[A-ZŻŹĆĄŚĘŁÓŃ][a-ząćęłńóśźż]+)\s+(?:mówi|pyta|odpowiada|szepcze|krzyczy):?\s*$/i,
    ];

    const afterPatterns = [
        /^\s*[-–—]\s*(?:powiedział|powiedziała|mówi|pyta|odpowiada|szepcze|krzyczy|dodaje|zauważa)\s+(?:profesor|doktor|dr\.|pan|pani)?\s*([A-ZŻŹĆĄŚĘŁÓŃ][a-ząćęłńóśźż]+)/i,
        /^\s*[-–—]\s*(?:powiedział|powiedziała|mówi|pyta|szepcze)\s+([A-ZŻŹĆĄŚĘŁÓŃ][a-ząćęłńóśźż]+)/i,
        /^\s*,?\s*(?:powiedział|powiedziała|mruknął|mruknęła)\s+([A-ZŻŹĆĄŚĘŁÓŃ][a-ząćęłńóśźż]+)/i,
    ];

    for (const pattern of beforePatterns) {
        const match = contextBefore.match(pattern);
        if (match && match[1]) {
            const name = match[1].trim();
            if (!isCommonWord(name)) return name;
        }
    }

    for (const pattern of afterPatterns) {
        const match = contextAfter.match(pattern);
        if (match && match[1]) {
            const name = match[1].trim();
            if (!isCommonWord(name)) return name;
        }
    }

    return 'npc';
}

// === GŁÓWNA FUNKCJA EKSTRAKCJI DIALOGÓW ===
export function extractDialogues(text: string, npcPositions?: NPCPosition[]): DialogueLine[] {
    const dialogues: DialogueLine[] = [];
    const cleanText = cleanResponseText(text);

    const quotePattern = /["„«]([^"„"»«]+)["»"]/g;

    interface QuoteMatch {
        start: number;
        end: number;
        text: string;
        contextBefore: string;
        contextAfter: string;
    }

    const quotes: QuoteMatch[] = [];
    let match;

    while ((match = quotePattern.exec(cleanText)) !== null) {
        const quoteText = match[1].trim();
        if (quoteText.length > 3) {
            const contextAfter = cleanText.substring(
                match.index + match[0].length,
                Math.min(cleanText.length, match.index + match[0].length + 100)
            );

            quotes.push({
                start: match.index,
                end: match.index + match[0].length,
                text: quoteText,
                contextBefore: cleanText.substring(Math.max(0, match.index - 300), match.index),
                contextAfter,
            });
        }
    }

    if (quotes.length === 0) {
        dialogues.push({
            speaker: 'narrator',
            text: cleanText,
            emotion: 'neutral',
            gender: 'unknown',
        });
        return dialogues;
    }

    let lastEnd = 0;

    for (const quote of quotes) {
        if (quote.start > lastEnd) {
            const narratorText = cleanText.substring(lastEnd, quote.start).trim();
            if (narratorText.length > 0) {
                dialogues.push({
                    speaker: 'narrator',
                    text: narratorText,
                    emotion: 'neutral',
                    gender: 'unknown',
                });
            }
        }

        const gender = detectSpeakerGender(quote.contextBefore);
        const age = detectSpeakerAge(quote.contextBefore, quote.contextAfter);
        let npcName = extractNPCName(quote.contextBefore, quote.contextAfter);

        // Tier 2: Cross-reference z pozycjami tagów [NPC:] w odpowiedzi
        if (npcName === 'npc' && npcPositions && npcPositions.length > 0) {
            const preceding = npcPositions.filter(p => p.charIndex < quote.start);
            if (preceding.length > 0) {
                npcName = preceding[preceding.length - 1].name;
            }
        }

        const detectedEmotion = detectEmotionFromContext(quote.text, quote.contextBefore);
        const audioTag = mapEmotionToAudioTag(detectedEmotion);

        const emotionMap: Record<string, DialogueLine['emotion']> = {
            'fear': 'fear', 'anger': 'anger', 'sadness': 'sadness',
            'joy': 'joy', 'mysterious': 'mysterious', 'whisper': 'fear',
            'neutral': 'neutral'
        };

        dialogues.push({
            speaker: npcName,
            text: quote.text,
            emotion: emotionMap[detectedEmotion] || 'neutral',
            gender,
            age,
            context: quote.contextBefore,
            contextAfter: quote.contextAfter,
            audioTags: audioTag || undefined,
        });

        lastEnd = quote.end;
    }

    if (lastEnd < cleanText.length) {
        const endText = cleanText.substring(lastEnd).trim();
        if (endText.length > 0) {
            dialogues.push({
                speaker: 'narrator',
                text: endText,
                emotion: 'neutral',
                gender: 'unknown',
            });
        }
    }

    return dialogues;
}
