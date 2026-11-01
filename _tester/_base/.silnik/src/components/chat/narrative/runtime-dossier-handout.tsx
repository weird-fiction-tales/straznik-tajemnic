'use client';
import { useEffect, useState } from 'react';
import { isAuthoredAdventureId } from '@/lib/adventure-dossier/authored-scenarios';
import { useLocale } from 'next-intl';
import { LocalDossierHandout } from './local-dossier-handout';
import type { DossierHandoutBinding } from '@/lib/adventure-dossier/local-handouts';
import { loadAuthoredPrabutyEdition } from '@/lib/adventure-dossier/authored-client';
import { authoredPrabutyMediaId, resolveAuthoredPrabutyMedia } from '@/lib/adventure-dossier/authored-media';
import type { AdventureHandout } from '@/lib/adventures-data';
import { DocumentViewer } from '@/components/ui/document-viewer';
import { AudioReelPlayer } from '@/components/ui/audio-reel-player';

export function RuntimeDossierHandout({ recordId, binding, allowedIds }: { recordId: string; binding: DossierHandoutBinding; allowedIds: string[] }) {
  const [handout, setHandout] = useState<AdventureHandout | null>(null);
  const locale = useLocale();
  const authoredId = isAuthoredAdventureId(binding.adventureId) ? authoredPrabutyMediaId(recordId) : null;
  const acquired = Boolean(authoredId && allowedIds.includes(authoredId));
  useEffect(() => {
    let cancelled = false; setHandout(null);
    if (acquired) loadAuthoredPrabutyEdition(binding.adventureId, binding.editionFingerprint)
      .then(edition => { if (!cancelled && edition) setHandout(resolveAuthoredPrabutyMedia(edition.payload, recordId)); })
      .catch(() => { /* A stale edition never falls back to a different asset. */ });
    return () => { cancelled = true; };
  }, [acquired, binding.adventureId, binding.editionFingerprint, recordId]);
  if (!authoredId) return <LocalDossierHandout recordId={recordId} binding={binding} acquired={allowedIds.includes(recordId)} />;
  if (!acquired || !handout) return null;
  return <section data-testid="authored-dossier-handout" className="my-4 space-y-3 rounded border border-brass/40 bg-card p-4">
    <h3 className="font-display text-brass">{handout.title}</h3>
    {handout.image && <DocumentViewer imageUrl={handout.image} title={handout.title} preserveOriginal />}
    {handout.textContent && <p className="whitespace-pre-wrap font-serif">{handout.textContent}</p>}
    {(handout.audioUrlPl || handout.audioUrl) && <AudioReelPlayer audioUrl={(locale === 'en' ? handout.audioUrlEn : handout.audioUrlPl) || handout.audioUrl || ''} reelType={handout.reelType || 'reel_to_reel'} title={handout.title} />}
  </section>;
}
