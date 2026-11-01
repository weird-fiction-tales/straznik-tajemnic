'use client';
import { useEffect, useState } from 'react';
import type { JournalMaterial } from '@/lib/journal/public-journal';
import { loadLocalDossierImage } from '@/lib/adventure-dossier/local-library';
import { persistentMediaCache, STORES } from '@/lib/persistent-media-cache';

export function useJournalPublishedImage(cacheKey?: string) {
  const [image, setImage] = useState<string>();
  useEffect(() => {
    let cancelled = false;
    setImage(undefined);
    if (cacheKey)
      void persistentMediaCache
        .get(STORES.CHARACTER_IMAGES, cacheKey)
        .then((value) => {
          if (!cancelled && value) setImage(value);
        })
        .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [cacheKey]);
  return image;
}

/** The model supplies only disclosed, edition-bound materials. */
export function useJournalMaterialPreview(material?: JournalMaterial) {
  const [image, setImage] = useState<string>();
  const recordId = material?.recordId;
  const adventureId = material?.binding?.adventureId;
  const edition = material?.binding?.editionFingerprint;
  useEffect(() => {
    let cancelled = false;
    let url: string | undefined;
    setImage(undefined);
    if (recordId && adventureId && edition && !material?.imageUrl) {
      void loadLocalDossierImage(adventureId, edition, recordId)
        .then((asset) => {
          if (!asset || cancelled) return;
          url = URL.createObjectURL(asset.image);
          setImage(url);
        })
        .catch(() => {
          /* The original viewer explains unavailable local files. */
        });
    }
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [recordId, adventureId, edition, material?.imageUrl]);
  return material?.imageUrl || image;
}
