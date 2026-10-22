'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { DocumentViewer } from '@/components/ui/document-viewer';
import { loadLocalDossierImage } from '@/lib/adventure-dossier/local-library';
import type { DossierHandoutBinding } from '@/lib/adventure-dossier/local-handouts';

/** Original pixels stay in IndexedDB and a short-lived blob URL, never in the chat text or API. */
export function LocalDossierHandout({ recordId, binding, acquired }: {
  recordId: string; binding: DossierHandoutBinding; acquired: boolean;
}) {
  const locale = useLocale();
  const [asset, setAsset] = useState<{ url: string; title: string } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let url: string | undefined;
    setAsset(null); setFailed(false);
    if (acquired) void loadLocalDossierImage(binding.adventureId, binding.editionFingerprint, recordId)
      .then(image => {
        if (cancelled) return;
        if (!image) { setFailed(true); return; }
        url = URL.createObjectURL(image.image);
        setAsset({ url, title: image.title });
      }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [recordId, binding.adventureId, binding.editionFingerprint, acquired]);

  if (!acquired) return null;
  if (!asset) return <p role="status" className="my-4 text-sm text-muted-foreground">{
    locale === 'en'
      ? failed ? 'The local handout is unavailable on this device.' : 'Opening the handout...'
      : failed ? 'Lokalny handout jest niedostępny na tym urządzeniu.' : 'Otwieranie handoutu...'
  }</p>;
  return <div data-testid="local-dossier-handout" className="my-4">
    <DocumentViewer imageUrl={asset.url} title={asset.title} initialFilter="none" preserveOriginal />
  </div>;
}
