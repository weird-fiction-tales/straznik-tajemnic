'use client';

import './deco-window.css';
import { useTranslations } from 'next-intl';
import { SafeImage } from '@/components/ui/safe-image';
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { isDataUrl, parseDataUrl } from '@/lib/image-utils';

interface ImageLightboxProps {
  src: string;
  images?: string[];
  onClose: () => void;
  alt?: string;
}

/**
 * Komponent lightbox do powiększonego wyświetlania obrazów
 * Obsługuje nawigację między wieloma obrazami, zoom i pobieranie
 */
export function ImageLightbox({
  src,
  images = [],
  onClose,
  alt = 'Powiększony obraz',
}: ImageLightboxProps) {
  const t = useTranslations('ImageLightbox');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  // Portal do <body>: lightbox musi nakryć CAŁY ekran (w tym prawy sidebar).
  // Renderowany w drzewie ChatWindow jego z-[100] nie przebijał sidebara z innej
  // gałęzi (osobny stacking context). mounted guard = SSR-safe (createPortal
  // wymaga document, a lightbox i tak montuje się dopiero po kliknięciu obrazu).
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Znajdź aktualny indeks w tablicy obrazów
  useEffect(() => {
    if (images.length > 0) {
      const idx = images.indexOf(src);
      if (idx !== -1) {
        setCurrentIndex(idx);
      }
    }
  }, [src, images]);

  const currentSrc = images.length > 0 ? images[currentIndex] : src;
  const hasMultiple = images.length > 1;

  const goNext = useCallback(() => {
    if (hasMultiple) {
      setCurrentIndex((prev) => (prev + 1) % images.length);
      setZoom(1);
    }
  }, [hasMultiple, images.length]);

  const goPrev = useCallback(() => {
    if (hasMultiple) {
      setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
      setZoom(1);
    }
  }, [hasMultiple, images.length]);

  const handleZoomIn = useCallback(
    () => setZoom((prev) => Math.min(prev + 0.5, 3)),
    []
  );
  const handleZoomOut = useCallback(
    () => setZoom((prev) => Math.max(prev - 0.5, 0.5)),
    []
  );

  const handleDownload = async () => {
    try {
      let blob: Blob;

      if (isDataUrl(currentSrc)) {
        // IND-135 B2: data URL - parse + atob → Blob (fetch w Safari iOS niespójny)
        const parsed = parseDataUrl(currentSrc);
        if (!parsed) throw new Error('Invalid data URL');
        const buffer = Uint8Array.from(atob(parsed.data), (c) =>
          c.charCodeAt(0)
        );
        blob = new Blob([buffer], { type: parsed.mimeType });
      } else {
        // IND-135 B3: HTTP URL - fetch + walidacja response.ok (404/500 z wygasłego signed URL)
        const response = await fetch(currentSrc);
        if (!response.ok) {
          throw new Error(
            `Download failed: ${response.status} ${response.statusText}`
          );
        }
        blob = await response.blob();
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zew-app-image-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download image:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      alert(`❌ Nie udało się pobrać obrazu: ${msg}`);
    }
  };

  // Obsługa klawiszy
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          goPrev();
          break;
        case 'ArrowRight':
          goNext();
          break;
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
          handleZoomOut();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, goNext, goPrev, handleZoomIn, handleZoomOut]);

  // Blokuj scroll body
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="deco-window fixed inset-0 z-[100] flex items-center justify-center bg-[#050608]/[0.92] backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Toolbar - pozycjonowany na dole dla ekranów mobilnych w bezpiecznej strefie, u góry na desktopie */}
      <div className="absolute top-5 right-6 max-sm:top-auto max-sm:bottom-5 max-sm:right-5 max-sm:left-5 max-sm:justify-center flex items-center gap-1.5 sm:gap-2 z-10 font-special-elite max-sm:bg-[#0a0c0f]/90 max-sm:p-2 max-sm:border max-sm:border-brass/30">
        {/* Zoom controls */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleZoomOut();
          }}
          className="p-2 border border-brass/35 bg-brass/[0.04] text-brass hover:bg-brass/10 hover:border-brass/60 transition-colors"
          title={t('zoomOut')}
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <span className="text-brass text-sm min-w-[3rem] text-center tracking-[0.08em]">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleZoomIn();
          }}
          className="p-2 border border-brass/35 bg-brass/[0.04] text-brass hover:bg-brass/10 hover:border-brass/60 transition-colors"
          title={t('zoomIn')}
        >
          <ZoomIn className="w-5 h-5" />
        </button>

        {/* Download */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDownload();
          }}
          className="p-2 border border-brass/35 bg-brass/[0.04] text-brass hover:bg-brass/10 hover:border-brass/60 transition-colors ml-2"
          title={t('download')}
        >
          <Download className="w-5 h-5" />
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          className="p-2 border border-brass/45 bg-brass/[0.04] text-brass hover:bg-destructive/40 hover:border-destructive/60 hover:text-foreground transition-colors ml-2"
          title={t('close')}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation arrows - dostosowane marginesy i rozmiary na małych ekranach */}
      {hasMultiple && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="absolute left-8 max-sm:left-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-12 h-16 max-sm:w-10 max-sm:h-14 border border-brass/35 bg-brass/[0.04] text-brass hover:bg-brass/10 hover:border-brass/60 transition-colors z-10"
            title={t('previous')}
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="absolute right-8 max-sm:right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-12 h-16 max-sm:w-10 max-sm:h-14 border border-brass/35 bg-brass/[0.04] text-brass hover:bg-brass/10 hover:border-brass/60 transition-colors z-10"
            title={t('next')}
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </>
      )}

      {/* Image - zamykanie przez tło/Esc/X. IND-139 B8: klik na obrazie NIE
          zamyka (stopPropagation na kontenerze) - zoom/pan na touch nie zamyka
          modala przypadkiem. Ramka déco: narożniki brass + raster + winieta. */}
      <div
        className="relative max-w-[90vw] max-h-[90vh] overflow-auto flex items-center justify-center border border-brass/60 bg-gradient-to-br from-[#16130f] to-[#0a0c0f] shadow-[0_0_60px_rgba(0,0,0,0.7),0_0_30px_rgba(13,148,136,0.1)] scrollbar-none"
        style={{
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Raster + winieta nad obrazem (pointer-events-none, nie blokuje zoom) */}
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg,rgba(201,162,39,.03) 0,rgba(201,162,39,.03) 12px,transparent 12px,transparent 24px)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{ boxShadow: 'inset 0 0 120px 36px rgba(0,0,0,.7)' }}
        />
        {/* Narożniki déco */}
        <span className="pointer-events-none absolute top-2.5 left-2.5 z-10 w-6 h-6 border-t-2 border-l-2 border-brass" />
        <span className="pointer-events-none absolute top-2.5 right-2.5 z-10 w-6 h-6 border-t-2 border-r-2 border-brass" />
        <span className="pointer-events-none absolute bottom-2.5 left-2.5 z-10 w-6 h-6 border-b-2 border-l-2 border-brass" />
        <span className="pointer-events-none absolute bottom-2.5 right-2.5 z-10 w-6 h-6 border-b-2 border-r-2 border-brass" />

        {/* IND-139 C8: raw <img> celowo. Lightbox wymaga max-w-none + manualnego
            transform: scale(zoom) + obsługi data: URL (AI base64). next/image
            (fill/fixed) łamie zoom UX i nie wspiera data URL bez custom loadera
            (analog IND-172 data URL → raw img). */}
        <SafeImage
          src={currentSrc}
          alt={alt}
          className="max-w-none transition-transform duration-200"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
          }}
          draggable={false}
        />
      </div>

      {/* Image counter - przesunięty wyżej na mobile, by nie nachodzić na toolbar */}
      {hasMultiple && (
        <div className="absolute bottom-6 max-sm:bottom-20 left-1/2 -translate-x-1/2 border border-brass/35 bg-[#0a0c0f]/80 px-4 py-2 text-brass text-sm font-special-elite tracking-[0.18em]">
          {currentIndex + 1} / {images.length}
        </div>
      )}
    </div>,
    document.body
  );
}

export default ImageLightbox;
