'use client';

import '@/components/ui/deco-window.css';

import { useTranslations } from 'next-intl';
import { Button } from './button';

/**
 * 2-stopniowy confirm dialog Pełnego Resetu.
 *
 * Step 1 - pierwszy confirm z listą co zostanie usunięte.
 * Step 2 - finalne ostrzeżenie ("OSTATNIE OSTRZEŻENIE").
 *
 * Stan dialogu jest własnością `useFullReset()` hook'a - komponent jest "dumb",
 * dostaje propsy i woła callbacki.
 *
 * Wyodrębniony z `settings-modal.tsx` (linie 676-759) jako część IND-17.
 */

interface FullResetDialogProps {
  show: boolean;
  step: 0 | 1 | 2;
  onClose: () => void;
  onConfirmStep1: () => void;
  onConfirm: () => void | Promise<void>;
}

export function FullResetDialog({
  show,
  step,
  onClose,
  onConfirmStep1,
  onConfirm,
}: FullResetDialogProps) {
  const t = useTranslations('FullResetDialog');
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center"
      onClick={(e) => {
        // Zamknij tylko jeśli kliknięto w tło
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="deco-window bg-card border-2 border-red-500 rounded-lg p-6 w-full max-w-lg mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {step === 1 && (
          <>
            <h3 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
              {t('title')}
            </h3>
            <div className="text-foreground mb-6 space-y-2">
              <p>
                {t.rich('intro', {
                  strong: (chunks) => (
                    <strong className="text-red-400">{chunks}</strong>
                  ),
                })}
              </p>
              <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                <li>{t('itemCharacters')}</li>
                <li>{t('itemSessions')}</li>
                <li>{t('itemChatHistory')}</li>
                <li>{t('itemSettings')}</li>
                <li>{t('itemNotes')}</li>
                <li>{t('itemMediaCache')}</li>
                <li>{t('itemPdfs')}</li>
                <li>{t('itemCache')}</li>
              </ul>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={onClose}
                variant="outline"
                className="flex-1 bg-muted hover:bg-muted border-border"
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={onConfirmStep1}
                variant="destructive"
                className="flex-1 bg-destructive hover:bg-destructive/90"
              >
                {t('understandContinue')}
              </Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h3 className="text-xl font-bold text-red-500 mb-4 flex items-center gap-2">
              {t('lastWarning')}
            </h3>
            <div className="text-foreground mb-6">
              <p className="text-center text-lg mb-4">
                {t.rich('confirmDeleteAllQuestion', {
                  strong: (chunks) => (
                    <strong className="text-red-500">{chunks}</strong>
                  ),
                })}
              </p>
              <p className="text-center text-sm text-muted-foreground">
                {t('irreversible')}
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={onClose}
                variant="outline"
                className="flex-1 bg-muted hover:bg-muted border-border"
              >
                {t('cancelX')}
              </Button>
              <Button
                onClick={() => onConfirm()}
                variant="destructive"
                className="flex-1 bg-red-700 hover:bg-red-800 animate-pulse"
              >
                {t('deleteAll')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default FullResetDialog;
