'use client';

/**
 * DocumentViewer - Interaktywny diegetyczny czytnik dokumentów (P1)
 *
 * Wykorzystuje OpenSeadragon (BSD-3) do bezstratnego przybliżania (Deep Zoom),
 * przesuwania (pan & zoom) i badania detali: odręcznych dopisków, pieczęci,
 * mikro-śladów i planów bez rozmycia.
 *
 * Posiada diegetyczny pasek narzędzi Dark Art Déco oraz filtry starzenia papieru CSS:
 * - 'none': oryginalny skan
 * - 'vintage-1920': sepia, pożółkły pergamin, delikatne ziarno i ciepły odcień lat 20.
 * - 'prl-1970': matowy papier maszynowy, podbity kontrast powielacza/ksero
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import type OpenSeadragon from 'openseadragon';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  Maximize2,
  Minimize2,
  FileText,
  Sliders,
  Sparkles,
} from 'lucide-react';

export type PaperAgingFilter = 'none' | 'vintage-1920' | 'prl-1970';

interface DocumentViewerProps {
  imageUrl: string;
  title?: string;
  docTypeLabel?: string;
  className?: string;
  initialFilter?: PaperAgingFilter;
  preserveOriginal?: boolean;
  onFactDiscovered?: (factSummary: string) => void;
  evidenceFact?: string;
}

export function DocumentViewer({
  imageUrl,
  title,
  docTypeLabel,
  className = '',
  initialFilter = 'vintage-1920',
  preserveOriginal = false,
  onFactDiscovered,
  evidenceFact,
}: DocumentViewerProps) {
  const t = useTranslations('DocumentViewer');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const fullscreenButtonRef = useRef<HTMLButtonElement | null>(null);
  const wasFullscreen = useRef(false);

  const [filter, setFilter] = useState<PaperAgingFilter>(initialFilter);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [factLogged, setFactLogged] = useState(false);

  useEffect(() => {
    if (!isFullscreen && wasFullscreen.current) fullscreenButtonRef.current?.focus();
    wasFullscreen.current = isFullscreen;
    if (!isFullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsFullscreen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen]);

  // Inicjalizacja OpenSeadragon
  useEffect(() => {
    if (!containerRef.current) return;

    let isMounted = true;
    setIsLoading(true);
    let viewerInstance: OpenSeadragon.Viewer | null = null;

    (async () => {
      try {
        const OpenSeadragon = (await import('openseadragon')).default;
        if (!isMounted || !containerRef.current) return;

        const viewer = OpenSeadragon({
          element: containerRef.current,
          showNavigationControl: false, // Własny diegetyczny pasek sterowania
          showNavigator: false,
          tileSources: {
            type: 'image',
            url: imageUrl,
          },
          animationTime: 0.4,
          blendTime: 0.1,
          constrainDuringPan: true,
          maxZoomPixelRatio: 4,
          minZoomImageRatio: 0.8,
          visibilityRatio: 1,
          zoomPerScroll: 1.25,
          gestureSettingsMouse: {
            clickToZoom: false,
            dblClickToZoom: true,
          },
        });

        viewer.addHandler('open', () => {
          if (isMounted) setIsLoading(false);
        });

        viewer.addHandler('open-failed', () => {
          if (isMounted) setIsLoading(false);
        });

        viewerInstance = viewer;
        viewerRef.current = viewer;

        // Zasada Zero-Effort Ledger: badanie rekwizytu automatycznie rejestruje fakt w Dossier
        if (evidenceFact && onFactDiscovered && !factLogged) {
          onFactDiscovered(evidenceFact);
          setFactLogged(true);
        }
      } catch {
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
      if (viewerInstance) {
        viewerInstance.destroy();
      } else if (viewerRef.current) {
        viewerRef.current.destroy();
      }
      viewerRef.current = null;
    };
  }, [imageUrl, evidenceFact, onFactDiscovered, factLogged, isFullscreen]);

  // Kontrolki nawigacji
  const handleZoomIn = useCallback(() => {
    if (!viewerRef.current) return;
    const currentZoom = viewerRef.current.viewport.getZoom();
    viewerRef.current.viewport.zoomTo(currentZoom * 1.3);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!viewerRef.current) return;
    const currentZoom = viewerRef.current.viewport.getZoom();
    viewerRef.current.viewport.zoomTo(currentZoom * 0.7);
  }, []);

  const handleReset = useCallback(() => {
    if (!viewerRef.current) return;
    viewerRef.current.viewport.goHome();
    viewerRef.current.viewport.setRotation(0);
  }, []);

  const handleRotate = useCallback(() => {
    if (!viewerRef.current) return;
    const currentRotation = viewerRef.current.viewport.getRotation();
    viewerRef.current.viewport.setRotation((currentRotation + 90) % 360);
  }, []);

  // Klasy filtrów starzenia papieru CSS
  const getFilterStyle = (): React.CSSProperties => {
    switch (preserveOriginal ? 'none' : filter) {
      case 'vintage-1920':
        return {
          filter: 'sepia(0.55) contrast(1.15) brightness(0.92) saturate(1.1)',
        };
      case 'prl-1970':
        return {
          filter: 'grayscale(0.35) contrast(1.35) brightness(0.98)',
        };
      case 'none':
      default:
        return {};
    }
  };

  const documentView = (
    <div
      className={`flex flex-col border border-brass/35 bg-[#120f0c] shadow-2xl rounded-sm overflow-hidden select-none ${
        isFullscreen ? 'fixed inset-0 z-50 p-4 bg-black/95' : `relative ${className}`
      }`}
    >
      {/* Pasek nagłówka dokumentu */}
      <div className="flex items-center justify-between border-b border-primary/30 bg-[#0f1715] px-3.5 py-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-foreground truncate max-w-[280px]">
            {title || t('defaultTitle')}
          </span>
          {docTypeLabel && (
            <span className="inline-flex items-center text-[10px] font-mono uppercase bg-primary/15 text-primary border border-primary/40 px-1.5 py-0.5 rounded">
              {docTypeLabel}
            </span>
          )}
        </div>

        {/* Przełącznik filtru starzenia papieru */}
        {!preserveOriginal && <div className="flex items-center gap-1 text-[11px] font-mono">
          <span className="text-muted-foreground mr-1 hidden sm:inline-flex items-center gap-1">
            <Sliders className="h-3 w-3 text-primary/80" />
            {t('filterLabel')}:
          </span>
          <button
            type="button"
            onClick={() => setFilter('none')}
            className={`px-2 py-0.5 rounded transition-all ${
              filter === 'none'
                ? 'bg-primary/20 text-primary border border-primary/50 shadow-glow'
                : 'text-muted-foreground hover:text-brass'
            }`}
            title={t('filterNoneTitle')}
          >
            {t('filterNone')}
          </button>
          <button
            type="button"
            onClick={() => setFilter('vintage-1920')}
            className={`px-2 py-0.5 rounded transition-all ${
              filter === 'vintage-1920'
                ? 'bg-primary/20 text-primary border border-primary/50 shadow-glow'
                : 'text-muted-foreground hover:text-brass'
            }`}
            title={t('filterVintageTitle')}
          >
            {t('filterVintage')}
          </button>
          <button
            type="button"
            onClick={() => setFilter('prl-1970')}
            className={`px-2 py-0.5 rounded transition-all ${
              filter === 'prl-1970'
                ? 'bg-primary/20 text-primary border border-primary/50 shadow-glow'
                : 'text-muted-foreground hover:text-brass'
            }`}
            title={t('filterPrlTitle')}
          >
            {t('filterPrl')}
          </button>
        </div>}
      </div>

      {/* Kontener podglądu OpenSeadragon */}
      <div className="relative flex-1 min-h-[360px] bg-[#0c0a08] overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0c0a08]/80 text-primary font-special-elite text-xs uppercase tracking-widest animate-pulse">
            {t('loadingDocument')}
          </div>
        )}
        <div
          ref={containerRef}
          // OSD creates 100%-height children; min-height alone leaves their viewport at zero.
          style={{ ...getFilterStyle(), height: isFullscreen ? 'calc(100vh - 120px)' : 360 }}
          className="w-full min-h-[360px] cursor-grab active:cursor-grabbing transition-[filter] duration-300"
        />

        {/* Diegetyczny pasek narzędzi (Lupka & Rotacja) w rogu widoku */}
        <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 bg-[#0f1715]/90 border border-primary/40 p-1 rounded backdrop-blur-sm shadow-xl">
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1.5 text-brass/85 hover:text-primary hover:bg-primary/15 rounded transition-colors"
            title={t('zoomIn')}
            aria-label={t('zoomIn')}
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1.5 text-brass/85 hover:text-primary hover:bg-primary/15 rounded transition-colors"
            title={t('zoomOut')}
            aria-label={t('zoomOut')}
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleRotate}
            className="p-1.5 text-brass/85 hover:text-primary hover:bg-primary/15 rounded transition-colors"
            title={t('rotate')}
            aria-label={t('rotate')}
          >
            <RotateCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="p-1.5 text-brass/85 hover:text-primary hover:bg-primary/15 rounded transition-colors"
            title={t('resetView')}
            aria-label={t('resetView')}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <div className="h-4 w-px bg-primary/30 my-auto" />
          <button
            type="button"
            ref={fullscreenButtonRef}
            onClick={() => setIsFullscreen((prev) => !prev)}
            className={`p-1.5 rounded transition-colors ${
              isFullscreen
                ? 'text-primary bg-primary/20'
                : 'text-brass/85 hover:text-primary hover:bg-primary/15'
            }`}
            title={isFullscreen ? t('exitFullscreen') : t('fullscreen')}
            aria-label={isFullscreen ? t('exitFullscreen') : t('fullscreen')}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Diegetyczny badge wskazówki */}
        <div className="absolute top-3 left-3 pointer-events-none z-10 flex items-center gap-1 text-[11px] font-serif italic text-foreground/80 bg-[#0f1715]/80 px-2 py-0.5 rounded border border-primary/30">
          <Sparkles className="h-3 w-3 text-primary" />
          <span>{t('investigateHint')}</span>
        </div>
      </div>
    </div>
  );

  // Escape transformed and clipped chat ancestors while keeping the real OSD viewer.
  return isFullscreen ? createPortal(documentView, document.body) : documentView;
}

export default DocumentViewer;
