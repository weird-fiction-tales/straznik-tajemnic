import { persistentMediaCache, STORES } from '@/lib/persistent-media-cache';
import {
  journalCardId,
  type JournalCardKind,
  type JournalVisualPublication,
  type PublicJournalContext,
} from './public-journal';

/** Retain disclosed bytes in the existing protected image store, outside the expiring chat cache. */
export async function retainPublishedJournalVisual(input: {
  kind: JournalCardKind;
  name: string;
  imageUrl: string;
  messageId: string;
  context: PublicJournalContext;
}): Promise<JournalVisualPublication | null> {
  const { kind, name, imageUrl, messageId, context } = input;
  if (!name || imageUrl.startsWith('blob:')) return null;
  const cardId = journalCardId(kind, name);
  if (!imageUrl.startsWith('data:'))
    return {
      cardId,
      scope: context.scope,
      binding: context.binding,
      visual: { imageUrl },
    };
  const cacheKey = `journal:${context.scope?.playthroughId ?? 'current'}:${context.binding?.editionFingerprint ?? ''}:${messageId}:${cardId}`;
  const saved = await persistentMediaCache.set(
    STORES.CHARACTER_IMAGES,
    cacheKey,
    imageUrl,
    { messageId }
  );
  return saved
    ? {
        cardId,
        scope: context.scope,
        binding: context.binding,
        visual: { cacheKey },
      }
    : null;
}
