'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArtDecoEye } from '@/components/ui/art-deco-eye';
import {
  formatVersionWithCommit,
  startDesktopUpdate,
  type UpdateCheckView,
} from '@/lib/desktop/update-client';

interface DesktopUpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  update: UpdateCheckView | null;
  onDismissLater: () => void;
}

export function DesktopUpdateModal({
  open,
  onOpenChange,
  update,
  onDismissLater,
}: DesktopUpdateModalProps) {
  const t = useTranslations('UpdateSettings');
  const [phase, setPhase] = useState<'changelog' | 'downloading' | 'error'>('changelog');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!update?.manifest) return null;

  const targetVersionLabel = formatVersionWithCommit(
    update.manifest.version,
    update.manifest.commitSha,
    update.manifest.shortCommit
  );

  const handleStartUpdate = async () => {
    setPhase('downloading');
    setErrorMsg(null);
    try {
      await startDesktopUpdate();
      // Po wywołaniu proces serwera i desktopu zostanie przejęty przez update-worker
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setPhase('error');
    }
  };

  const handleLater = () => {
    onDismissLater();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="desktop-update-modal"
        className="w-[min(94vw,480px)] max-h-[85vh] flex flex-col items-center border border-brass/60 bg-[#0B0C0F] p-4 sm:p-6 text-foreground shadow-2xl rounded-lg overflow-y-auto journal-scroll z-[9999]"
      >
        {/* Dekoracyjne złote linie narożne Art Déco */}
        <div className="pointer-events-none absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-brass/70" />
        <div className="pointer-events-none absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-brass/70" />
        <div className="pointer-events-none absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-brass/70" />
        <div className="pointer-events-none absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-brass/70" />

        {/* 1. Animowane Oko Art Déco */}
        <div className="my-1 shrink-0 flex justify-center">
          <ArtDecoEye
            size={76}
            mode={phase === 'downloading' ? 'rotating' : 'gentle'}
            className="drop-shadow-[0_0_20px_rgba(212,175,55,0.25)]"
          />
        </div>

        {/* Faza 1: Changelog */}
        {phase === 'changelog' && (
          <div className="w-full flex flex-col items-center text-center space-y-3">
            <div>
              <DialogTitle className="font-display text-lg sm:text-xl font-bold tracking-[0.14em] uppercase text-brass">
                {t('modalTitle')}
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs sm:text-sm text-brass/80 font-special-elite">
                {t('availableVersion', { version: targetVersionLabel })}
              </DialogDescription>
            </div>

            {typeof update.commitsBehind === 'number' && update.commitsBehind > 0 && (
              <span className="inline-block px-3 py-0.5 text-xs font-mono rounded border border-brass/30 bg-brass/10 text-brass">
                {t('commitsBehind', { count: update.commitsBehind })}
              </span>
            )}

            {/* Boks z changelogiem w ramce monospaced / typewriter */}
            <div className="w-full max-h-36 sm:max-h-44 overflow-y-auto text-left rounded border border-brass/30 bg-black/60 p-3 text-sm text-foreground/90 font-mono space-y-2">
              <div className="text-brass/70 uppercase tracking-widest text-[10px] border-b border-brass/20 pb-1">
                {t('changelogHeader')}
              </div>
              <div className="space-y-1 leading-relaxed text-muted-foreground">
                <p className="text-emerald-400 font-semibold">• {t('changePoint1')}</p>
                <p className="text-brass/90">• {t('changePoint2')}</p>
                <p className="text-brass/90">• {t('changePoint3')}</p>
              </div>
              {update.manifest.releaseNotes && (
                <div className="pt-1.5 text-center">
                  <a
                    href={update.manifest.releaseNotes}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline text-xs inline-flex items-center gap-1"
                  >
                    ↗ {t('releaseNotesFull')}
                  </a>
                </div>
              )}
            </div>

            {/* Przyciski akcji (zawsze widoczne, sticky-friendly) */}
            <div className="w-full pt-1 flex flex-col sm:flex-row gap-2 shrink-0">
              <Button
                variant="outline"
                className="flex-1 border-brass/40 text-brass hover:bg-brass/10 h-9 text-xs sm:text-sm"
                onClick={handleLater}
              >
                {t('later')}
              </Button>
              {update.canSelfUpdate ? (
                <Button
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold tracking-wider uppercase h-9 text-xs sm:text-sm"
                  onClick={handleStartUpdate}
                >
                  {t('updateNow')}
                </Button>
              ) : (
                <div className="flex-1 text-xs text-muted-foreground self-center">
                  {t('devMode')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Faza 2: Pobieranie i przejęcie przez zewnętrzny mechanizm */}
        {phase === 'downloading' && (
          <div className="w-full flex flex-col items-center text-center space-y-4 py-2">
            <div>
              <DialogTitle className="font-display text-lg font-bold tracking-[0.14em] uppercase text-brass">
                {t('preparingTitle')}
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-xs text-muted-foreground max-w-sm leading-relaxed">
                {t('preparingDesc')}
              </DialogDescription>
            </div>

            {/* Złoty pasek postępu Art Déco */}
            <div className="w-full max-w-xs h-2 rounded-full border border-brass/40 bg-black/80 overflow-hidden relative my-2">
              <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-brass to-transparent animate-[shimmer_1.6s_infinite]" />
            </div>

            <p className="text-[11px] text-brass/70 font-mono uppercase tracking-widest">
              {t('handingOver')}
            </p>
          </div>
        )}

        {/* Faza 3: Błąd uruchomienia */}
        {phase === 'error' && (
          <div className="w-full flex flex-col items-center text-center space-y-4">
            <DialogTitle className="font-display text-lg font-bold text-red-400">
              {t('result.failed')}
            </DialogTitle>
            <p className="text-xs text-red-300 font-mono bg-red-950/40 p-3 rounded border border-red-500/30 max-w-sm">
              {errorMsg}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPhase('changelog')}>
                {t('retry')}
              </Button>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                {t('close')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
