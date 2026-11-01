import { playerActionSentences, playerActionSegments, stripLeadingMaterialSource } from './player-action-clauses';
import { acquiredAuthoredMedia, authoredPrabutyMediaId, resolveAuthoredPrabutyMedia } from './authored-media';
import { resolveCanonicalAdventureLocation, canonicalSceneIds } from '../canonical-adventure-location';
import type { DossierRagPayload } from './rag-schema';
import type { LocalDossierImage } from './local-library';
import type { Message } from '../types';

/** Decode only the authored image pages. No OCR, inferred crop, redraw, model or remote PDF upload. */
export async function extractLocalDossierImages(pdfFile: Blob, payload: DossierRagPayload): Promise<LocalDossierImage[]> {
  const records = payload.records.filter(r => r.local_handout);
  if (!records.length) return [];
  const { getDocumentProxy, extractImages, definePDFJSModule, getResolvedPDFJS } = await import('unpdf');
  // unpdf's reduced serverless bundle omits the JPX WASM loader. Use the matching full build,
  // served by this application, including its worker and OpenJPEG (no CDN requests).
  const moduleUrl = `${window.location.origin}/pdfjs/6.1.200/pdf.min.mjs`;
  await definePDFJSModule(() => import(/* webpackIgnore: true */ moduleUrl));
  const pdfjs = await getResolvedPDFJS();
  pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdfjs/6.1.200/pdf.worker.min.mjs`;
  const pdf = await getDocumentProxy(new Uint8Array(await pdfFile.arrayBuffer()), {
    isOffscreenCanvasSupported: false, isImageDecoderSupported: false,
    maxImageSize: 16777216, wasmUrl: `${window.location.origin}/pdfjs/6.1.200/`,
  });
  const images: LocalDossierImage[] = [];
  try {
    for (const page of [...new Set(records.map(r => r.local_handout!.pdf_page))]) {
      const extracted = await extractImages(pdf, page);
      for (const record of records.filter(r => r.local_handout!.pdf_page === page)) {
        const locator = record.local_handout!;
        let matched: Uint8ClampedArray<ArrayBuffer> | undefined;
        for (const image of extracted.filter(i => i.width === locator.width && i.height === locator.height)) {
          const rgba = new Uint8ClampedArray(image.width * image.height * 4);
          for (let p = 0; p < image.width * image.height; p++) {
            const s = p * image.channels, d = p * 4;
            rgba[d] = image.data[s];
            rgba[d + 1] = image.data[s + (image.channels === 1 ? 0 : 1)];
            rgba[d + 2] = image.data[s + (image.channels === 1 ? 0 : 2)];
            rgba[d + 3] = image.channels === 4 ? image.data[s + 3] : 255;
          }
          const digest = await crypto.subtle.digest('SHA-256', rgba);
          const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
          if (hash === locator.rgba_sha256) matched = rgba;
        }
        if (!matched) throw new Error('DOSSIER_HANDOUT_PIXEL_MISMATCH');
        const canvas = document.createElement('canvas');
        canvas.width = locator.width; canvas.height = locator.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('DOSSIER_HANDOUT_CANVAS_UNAVAILABLE');
        context.putImageData(new ImageData(matched, locator.width, locator.height), 0, 0);
        const image = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
          blob => blob ? resolve(blob) : reject(new Error('DOSSIER_HANDOUT_EXPORT_FAILED')), 'image/png'));
        images.push({ recordId: record.record_id, image, title: locator.title, width: locator.width, height: locator.height });
      }
    }
    return images;
  } finally { await pdf.loadingTask.destroy(); }
}

export interface DossierHandoutBinding { adventureId: string; editionFingerprint: string }

export interface HandoutDiscoveryContext {
  playerMessage: string;
  location: string;
  knownHandoutIds?: readonly string[];
  /** Last completed narrator turn, used only to resolve a deliberate pronoun action. */
  previousAssistantMessage?: string;
  /** Suppress cards already published by the same interrupted player turn. */
  alreadyPresentedHandoutIds?: readonly string[];
}

/** Restore the original declaration's context across any number of continuation chunks. */
export function handoutContinuationContext(history: readonly Message[], targetId: string, binding: DossierHandoutBinding) {
  const end = history.findIndex(message => message.id === targetId);
  let start = end;
  while (start >= 0 && history[start].role !== 'user') start--;
  return {
    previousAssistantMessage: history.slice(0, Math.max(0, start)).filter(message => message.role === 'assistant').at(-1)?.content,
    alreadyPresentedHandoutIds: history.slice(start + 1, end + 1)
      .filter(message => message.role === 'assistant' && message.dossierHandoutBinding?.adventureId === binding.adventureId &&
        message.dossierHandoutBinding?.editionFingerprint === binding.editionFingerprint)
      .flatMap(message => message.dossierHandoutRecordIds ?? []),
  };
}

const handoutTag = /\[(?:HANDOUT|DOWÓD|DOWOD|EVIDENCE):\s*([^\]\s]+)\s*\]/giu;
const physicalMaterial = /(?:fotografi|zdj[eę]ci|dokument|teczk|list\b|gazet|wycinek|raport|map[aeęy]|ta[sś]m|nagran|photograph|photo\b|document|folder|letter|newspaper|clipping|report|map\b|tape|recording)/iu;

function discoveryAction(message: string, folder: boolean, taking?: RegExp): boolean {
  const segments=playerActionSegments(message);
  if(segments.some(segment=>segment.speaker!==undefined)) return segments.some(segment=>discoveryAction(segment.text,folder,taking));
  const unquoted = playerActionSegments(message).map(segment=>segment.text).join('; ').replace(/„[^”]*”|“[^”]*”|"[^"]*"|«[^»]*»/g, '');
  const normalized = unquoted.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if (/^(?:rozwazam|zastanawiam|mysle|jezeli|jesli|gdybym|czy|if|what\s+if|would|(?:i|we)\s+(?:consider|wonder|might|would))\b/.test(normalized)) return false;
  if (/^[^.!?\n]*\b(?:mowi|powiedzial|powiedziala|says?|said|asks?|pyta)\s*[:,]/.test(normalized)) return false;
  return normalized.split(/\s+(?:and|ale|but)\s+|\s+i\s+(?=(?:nie|otwieram|zagladam|przegladam|ogladam|biore|zabieram|podnosze|chowam)\b)|[,;.!?\n]+/).some(part => {
    const clause = part.trim().replace(/^(?:(?:ja|my)\s+)?(?:(?:ostroznie|powoli|teraz|prosze)\s+)*/, '');
    if (taking) return taking.test(clause) && (/^(?:biore|bierzemy|zabieram|zabieramy|zabierz|wez|podnosze|chowam)\b/.test(clause) ||
      /^(?:(?:i|we)\s+)?(?:please\s+)?(?:take|pick\s+up|collect|keep)\b/.test(clause));
    if (folder) return /^(?:otwieram|otwieramy|otworz|zagladam|zagladamy|przegladam|przegladamy)\b.{0,50}\btecz(?:ke|ki|ce|ka)\b/.test(clause) ||
      /^pokaz\s+(?:mi\s+)?(?:co\s+jest\s+w|zawartosc)\s+(?:tej\s+)?tecz(?:ce|ki)\b/.test(clause) ||
      /^(?:(?:i|we)\s+)?(?:please\s+)?(?:open|inspect|look\s+inside)\s+(?:the\s+|this\s+|a\s+)?(?:folder|case\s+file)\b/.test(clause) ||
      /^(?:please\s+)?show\s+(?:me\s+)?(?:what\s+is\s+inside|the\s+contents\s+of)\s+(?:the\s+|this\s+|a\s+)?(?:folder|case\s+file)\b/.test(clause);
    return /^(?:ogladam|ogladamy|badam|badamy|czytam|czytamy|odsluchuje|odsluchujemy|przegladam|przegladamy|podnosze|biore|zabieram|pokaz|przeczytaj|odtworz)\b/.test(clause) ||
      /^(?:(?:i|we)\s+)?(?:please\s+)?(?:examine|inspect|read|listen\s+to|take|pick\s+up|look\s+at|show\s+me|play)\b/.test(clause);
  });
}

export function hasHandoutTakingDeclaration(message: string, reference: string): boolean {
  const target = /photo/i.test(reference) ? /(?:fotografi|zdjeci|odbitk|photograph|photo\b)/i
    : /sb-file/.test(reference) ? /(?:klin|teczk|akta|file|folder|dossier|dokument|document)/i
    : /herbal-recipe/.test(reference) ? /(?:receptur|r[eę]kopis|mieszank|zi[oó]l|recipe|manuscript|herbal)/i : physicalMaterial;
  return discoveryAction(message, false, target);
}

// Explicit identities are the access rules for this authored adventure. Never infer
// a new handout from prose, a retrieval hit, or the narrator's choice of tag.
const prabutyHandoutActions = {
  'prabuty.media.clue-photo-prabuty-1947': /(?:fotografi|zdjeci|odbitk|photograph|photo\b)/,
  'prabuty.media.clue-sb-file-klin': /(?:\bklin\b|raport|dokument|akta|dossier|report|document)/,
  'prabuty.media.clue-herbal-recipe-152': /(?:receptur|rekopis|mieszank|ziol|recipe|manuscript|herbal)/,
  'prabuty.media.audio-sb-wiretap-elblag': /(?:tasm|nagran|magnetofon|zk[- ]?140|tape|recording|reel.to.reel)/,
} as const;
const folderSubject = /(?:tecz[ck]|folder|case\s+file)/;
const openingAction = /^(?:otwieram|otwieramy|otworz|zagladam|zagladamy|przegladam|przegladamy|open|inspect|look\s+inside)\b/;
const viewingAction = /^(?:ogladam|ogladamy|badam|badamy|czytam|czytamy|odsluchuje|odsluchujemy|przegladam|przegladamy|podnosze|biore|zabieram|pokaz|przeczytaj|odtworz|examine|inspect|read|listen\s+to|take|pick\s+up|look\s+at|show|play)\b/;
function normalizeAction(text: string): string {
  return text.replace(/„[^”]*”|“[^”]*”|"[^"]*"|«[^»]*»/g, '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').toLowerCase().trim();
}
function matchesPrabutyAction(id: keyof typeof prabutyHandoutActions, context: HandoutDiscoveryContext, inScene: boolean): boolean {
  const message = normalizeAction(context.playerMessage);
  const subject = prabutyHandoutActions[id];
  const photo = id === 'prabuty.media.clue-photo-prabuty-1947';
  const file = id === 'prabuty.media.clue-sb-file-klin';
  // Only the immediate narrator turn supplies an antecedent. Tags cannot supply it.
  let antecedent = normalizeAction(context.previousAssistantMessage ?? '').replace(/\[[^\]]*\]/g, '');
  for (const sentence of playerActionSentences(message)) {
    if (/\b(?:jezeli|jesli|gdybym|if|whether)\b|^(?:rozwazam|zastanawiam|mysle|czy|what\s+if|would|(?:i|we)\s+(?:consider|wonder|might|would))\b/.test(sentence.trim())) continue;
    if (/\b(?:mowi|powiedzial|powiedziala|says?|said|asks?|pyta)\s*[:,]/.test(sentence)) continue;
    for (const part of sentence.split(/\s+(?:and|ale|but|oraz|i)\s+|,/)) {
      const clause = part.trim().replace(/^(?:(?:ja|my|i|we)\s+)?(?:(?:ostroznie|powoli|teraz|prosze|please)\s+)*/, '');
      const positive = clause.replace(/\b(?:nie|not|without|bez|zamiast|instead\s+of)\b.*$/, '');
      const opens = openingAction.test(positive);
      const views = viewingAction.test(positive);
      const action = viewingAction.exec(positive) ?? openingAction.exec(positive);
      const directObject = stripLeadingMaterialSource(positive.slice(action?.[0].length ?? positive.length).trim())
        .replace(/^(?:(?:do|w|na|the|this|that|a|an|inside|at|to|te|ten|ta|tej|to|tego|ponownie|stara|stary|czarno-biala)\s+)*/, '');
      const folder = folderSubject.exec(directObject)?.index === 0;
      const explicit = subject.exec(directObject)?.index === 0;
      const pronoun = /^(?:otwieram|otwieramy|ogladam|czytam|odsluchuje|open|inspect|examine|read|play)\s+(?:ja|go|je|to|it|them)\b/.test(positive);
      const mentions = Object.entries(prabutyHandoutActions).filter(([, target]) => target.test(antecedent));
      const antecedentFolder = folderSubject.test(antecedent);
      const ambiguous = mentions.length > 1 || (antecedentFolder && mentions.some(([key]) => key === 'prabuty.media.audio-sb-wiretap-elblag'));
      const antecedentMatches = !ambiguous && (subject.test(antecedent) ||
        (inScene && (photo || file) && antecedentFolder && mentions.length === 0));
      const showContents = /^pokaz\s+(?:mi\s+)?(?:co\s+(?:masz|jest)|zawartosc|teczke)|^show\s+(?:me\s+)?(?:what|the\s+contents|the\s+folder)/.test(positive);
      // MSW has two materials: opening the file never reveals its recording.
      if ((views && (explicit || (file && folder))) || (inScene && (photo || file) && ((folder && opens) || (showContents && folderSubject.test(positive)))) ||
        (pronoun && antecedentMatches && (opens || views))) return true;
      if (folder || Object.values(prabutyHandoutActions).some(target => target.test(positive))) antecedent = positive;
    }
  }
  return false;
}

function canDiscoverHandout(id: string, payload: DossierRagPayload, context: HandoutDiscoveryContext): boolean {
  if (Object.prototype.hasOwnProperty.call(prabutyHandoutActions, id)) {
    if (!resolveAuthoredPrabutyMedia(payload, id)) return false;
    const record = payload.records.find(entry => entry.record_id === id);
    const sceneIds = canonicalSceneIds(resolveCanonicalAdventureLocation(payload.adventure_id, context.location));
    const inScene = record?.tags.scenes.some(scene => sceneIds.includes(scene) || scene === context.location);
    return Boolean((inScene || context.knownHandoutIds?.includes(id)) &&
      matchesPrabutyAction(id as keyof typeof prabutyHandoutActions, context, Boolean(inScene)));
  }
  if (context.knownHandoutIds?.includes(id) && discoveryAction(context.playerMessage, false) && physicalMaterial.test(context.playerMessage)) return true;
  const authored = resolveAuthoredPrabutyMedia(payload, id);
  const record = payload.records.find(entry => entry.record_id === id);
  const sceneIds = canonicalSceneIds(resolveCanonicalAdventureLocation(payload.adventure_id, context.location));
  const inScene = record?.tags.scenes.some(scene => sceneIds.includes(scene) || scene === context.location);
  if (!inScene) return false;
  const folder = id === 'prabuty.media.clue-photo-prabuty-1947';
  if (!discoveryAction(context.playerMessage, folder)) return false;
  if (folder) return Boolean(authored);
  // An action must concern a physical material, rather than an unrelated object in the room.
  return physicalMaterial.test(context.playerMessage);
}

/** Retrieval is not discovery or ownership; player access gates the authored material. */
export function acquiredHandoutsFromTurn(text: string, eligibleIds: string[], payload: DossierRagPayload, context?: HandoutDiscoveryContext): string[] {
  text = text.replace(handoutTag, (_tag, id: string) => `[HANDOUT:${id}]`);
  const eligible = new Set([...eligibleIds, ...(context?.knownHandoutIds ?? [])]);
  const local = new Set(payload.records.filter(r => r.local_handout).map(r => r.record_id));
  const originals = [...new Set([...text.matchAll(/\[HANDOUT:([^\]\s]+)\]/g)].map(m => m[1]))]
    .filter(id => eligible.has(id) && local.has(id));
  const candidates = [...new Set([...originals, ...acquiredAuthoredMedia(text, [...eligible], payload)])];
  if (!context) return candidates;
  for (const id of Object.keys(prabutyHandoutActions)) {
    if (canDiscoverHandout(id, payload, context)) candidates.push(id);
  }
  return [...new Set(candidates)].filter(id => canDiscoverHandout(id, payload, context));
}

/** Keep the existing handout tag as the single presentation path; seeing never grants ownership. */
export function presentHandoutsForTurn(text: string, eligibleIds: string[], payload: DossierRagPayload, context: HandoutDiscoveryContext) {
  const handouts = acquiredHandoutsFromTurn(text, eligibleIds, payload, context)
    .filter(id => !context.alreadyPresentedHandoutIds?.includes(id));
  const shown = new Set<string>();
  let content = text.replace(handoutTag, (_tag, reference: string) => {
    const id = authoredPrabutyMediaId(reference) ?? reference;
    if (!handouts.includes(id) || shown.has(id)) return '';
    shown.add(id);
    return `[HANDOUT:${id}]`;
  });
  for (const id of handouts) if (!shown.has(id)) content += `\n\n[HANDOUT:${id}]`;
  return { content: content.trimEnd(), handouts };
}
