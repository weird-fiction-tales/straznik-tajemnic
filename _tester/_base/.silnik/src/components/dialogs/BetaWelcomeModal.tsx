'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Hammer, Sparkles, Bug } from 'lucide-react';

export const BETA_WELCOME_STORAGE_KEY = 'straznik_beta_welcome_dismissed';

interface BetaWelcomeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenFeedback?: () => void;
}

export function BetaWelcomeModal({
  open,
  onOpenChange,
  onOpenFeedback,
}: BetaWelcomeModalProps) {
  const t = useTranslations('BetaWelcome');
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // Synchronizacja początkowego stanu z localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const dismissed = localStorage.getItem(BETA_WELCOME_STORAGE_KEY);
      setDontShowAgain(dismissed === 'true');
    }
  }, [open]);

  const handleClose = () => {
    if (typeof window !== 'undefined' && dontShowAgain) {
      localStorage.setItem(BETA_WELCOME_STORAGE_KEY, 'true');
    }
    onOpenChange(false);
  };

  const handleFeedbackClick = () => {
    handleClose();
    if (onOpenFeedback) {
      onOpenFeedback();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="wide"
        className="w-[85vw] max-w-[85vw] h-[85vh] max-h-[85vh] flex flex-col overflow-hidden border-brass/50 bg-[#0d0f12]/95 backdrop-blur-md"
      >
        <DialogHeader className="shrink-0 space-y-2 pb-3 border-b border-brass/20">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-brass/70 text-brass bg-brass/10 font-display font-semibold uppercase tracking-wider text-xs px-2.5 py-0.5"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1 text-primary" />
              {t('badge')}
            </Badge>
          </div>
          <DialogTitle className="font-display text-2xl md:text-3xl font-bold tracking-wide text-foreground uppercase">
            {t('title')}
          </DialogTitle>
          <DialogDescription className="text-sm md:text-base font-special-elite text-muted-foreground">
            {t('subtitle')}
          </DialogDescription>
        </DialogHeader>

        <div
          data-testid="beta-welcome-scroll-body"
          className="flex-1 overflow-y-auto min-h-0 my-3 pr-2"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Kolumna 1: Gotowe moduły (100% d100 RAW & Strefa 11) */}
            <div className="space-y-3.5 rounded-lg p-5 bg-emerald-950/20 border border-emerald-500/30">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <h3 className="font-display font-bold text-base tracking-wider uppercase text-emerald-300">
                  {t('readySectionTitle')}
                </h3>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground font-special-elite">
                {t('readySectionDesc')}
              </p>
              <ul className="space-y-3.5 pt-2 text-sm leading-relaxed">
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                  <div>
                    <strong className="text-foreground font-semibold text-sm md:text-base block mb-0.5">
                      {t('readyItem1Title')}
                    </strong>
                    <span className="text-muted-foreground text-xs md:text-sm leading-relaxed block">
                      {t('readyItem1Desc')}
                    </span>
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                  <div>
                    <strong className="text-foreground font-semibold text-sm md:text-base block mb-0.5">
                      {t('readyItem2Title')}
                    </strong>
                    <span className="text-muted-foreground text-xs md:text-sm leading-relaxed block">
                      {t('readyItem2Desc')}
                    </span>
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                  <div>
                    <strong className="text-foreground font-semibold text-sm md:text-base block mb-0.5">
                      {t('readyItem3Title')}
                    </strong>
                    <span className="text-muted-foreground text-xs md:text-sm leading-relaxed block">
                      {t('readyItem3Desc')}
                    </span>
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                  <div>
                    <strong className="text-foreground font-semibold text-sm md:text-base block mb-0.5">
                      {t('readyItem4Title')}
                    </strong>
                    <span className="text-muted-foreground text-xs md:text-sm leading-relaxed block">
                      {t('readyItem4Desc')}
                    </span>
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                  <div>
                    <strong className="text-foreground font-semibold text-sm md:text-base block mb-0.5">
                      {t('readyItem5Title')}
                    </strong>
                    <span className="text-muted-foreground text-xs md:text-sm leading-relaxed block">
                      {t('readyItem5Desc')}
                    </span>
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                  <div>
                    <strong className="text-foreground font-semibold text-sm md:text-base block mb-0.5">
                      {t('readyItem6Title')}
                    </strong>
                    <span className="text-muted-foreground text-xs md:text-sm leading-relaxed block">
                      {t('readyItem6Desc')}
                    </span>
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                  <div>
                    <strong className="text-foreground font-semibold text-sm md:text-base block mb-0.5">
                      {t('readyItem7Title')}
                    </strong>
                    <span className="text-muted-foreground text-xs md:text-sm leading-relaxed block">
                      {t('readyItem7Desc')}
                    </span>
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                  <div>
                    <strong className="text-foreground font-semibold text-sm md:text-base block mb-0.5">
                      {t('readyItem8Title')}
                    </strong>
                    <span className="text-muted-foreground text-xs md:text-sm leading-relaxed block">
                      {t('readyItem8Desc')}
                    </span>
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                  <div>
                    <strong className="text-foreground font-semibold text-sm md:text-base block mb-0.5">
                      {t('readyItem9Title')}
                    </strong>
                    <span className="text-muted-foreground text-xs md:text-sm leading-relaxed block">
                      {t('readyItem9Desc')}
                    </span>
                  </div>
                </li>
                <li data-testid="beta-opening-node" className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                  <div>
                    <strong className="text-foreground font-semibold text-sm md:text-base block mb-0.5">
                      {t('openingNodeTitle')}
                    </strong>
                    <span className="text-muted-foreground text-xs md:text-sm leading-relaxed block">
                      {t('openingNodeDesc')}
                    </span>
                  </div>
                </li>
              </ul>
            </div>

            {/* Kolumna 2: Moduły w budowie */}
            <div className="space-y-3.5 rounded-lg p-5 bg-amber-950/20 border border-amber-500/30">
              <div className="flex items-center gap-2">
                <Hammer className="w-5 h-5 text-amber-400 shrink-0" />
                <h3 className="font-display font-bold text-base tracking-wider uppercase text-amber-300">
                  {t('inProgressSectionTitle')}
                </h3>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground font-special-elite">
                {t('inProgressSectionDesc')}
              </p>
              <ul className="space-y-3.5 pt-2 text-sm leading-relaxed">
                <li className="flex items-start gap-2.5">
                  <span className="text-amber-400 font-bold mt-0.5">🚧</span>
                  <div>
                    <strong className="text-foreground font-semibold text-sm md:text-base block mb-0.5">
                      {t('inProgressItem1Title')}
                    </strong>
                    <span className="text-muted-foreground text-xs md:text-sm leading-relaxed block">
                      {t('inProgressItem1Desc')}
                    </span>
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-amber-400 font-bold mt-0.5">🚧</span>
                  <div>
                    <strong className="text-foreground font-semibold text-sm md:text-base block mb-0.5">
                      {t('inProgressItem2Title')}
                    </strong>
                    <span className="text-muted-foreground text-xs md:text-sm leading-relaxed block">
                      {t('inProgressItem2Desc')}
                    </span>
                  </div>
                  <div className="border border-brass/20 p-3 bg-card/50">
                    <h4 className="font-display text-brass text-sm">
                      {t('inProgressItem3Title')}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('inProgressItem3Desc')}
                    </p>
                  </div>
                </li>
                <li className="space-y-1">
                  <strong className="block text-foreground">{t('ambilightTitle')}</strong>
                  <span className="block text-muted-foreground text-xs md:text-sm">{t('ambilightDesc')}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Pasek wskazówki zgłoszeń z adresem e-mail */}
        <div className="shrink-0 rounded p-2.5 bg-black/40 border border-brass/20 text-xs md:text-sm font-special-elite text-muted-foreground">
          <span>{t('betaFeedbackHint')}</span>
        </div>

        <DialogFooter className="shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-brass/20">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="beta-dont-show"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="h-4 w-4 rounded border-brass/50 bg-black/40 text-primary accent-primary cursor-pointer"
            />
            <label
              htmlFor="beta-dont-show"
              className="text-xs md:text-sm font-special-elite text-muted-foreground cursor-pointer select-none"
            >
              {t('dontShowAgain')}
            </label>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onOpenFeedback && (
              <Button
                variant="ghost"
                onClick={handleFeedbackClick}
                className="text-xs md:text-sm text-brass hover:text-brass hover:bg-brass/10 border border-brass/30"
              >
                <Bug className="w-4 h-4 mr-2 text-primary" />
                {t('openFeedback')}
              </Button>
            )}
            <Button
              onClick={handleClose}
              className="font-display uppercase tracking-wider text-xs md:text-sm px-6 bg-primary text-primary-foreground hover:brightness-110"
            >
              {t('enterGame')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
