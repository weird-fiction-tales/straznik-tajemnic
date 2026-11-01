'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './dialog';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';

type PlayMode = 'solo' | 'duet';

interface HotSeatSetupProps {
  open: boolean;
  onClose: () => void;
  onChooseSolo: (player1Name: string) => void;
  onStartHotSeat: (player1Name: string, player2Name: string) => void;
}

/**
 * Modal wyboru trybu gry: Solo (1 osoba) lub Duet (2 osoby przy jednej klawiaturze).
 * Postaci NIE wybiera się tutaj - binding postaci do graczy to osobna faza.
 */
export function HotSeatSetup({
  open,
  onClose,
  onChooseSolo,
  onStartHotSeat,
}: HotSeatSetupProps) {
  const t = useTranslations('HotSeatSetup');
  const [mode, setMode] = useState<PlayMode>('solo');
  const [player1Name, setPlayer1Name] = useState(t('player1Default'));
  const [player2Name, setPlayer2Name] = useState(t('player2Default'));

  const canStart =
    mode === 'solo'
      ? !!player1Name.trim()
      : !!player1Name.trim() && !!player2Name.trim();

  const handleStart = () => {
    if (!canStart) return;
    if (mode === 'solo') {
      onChooseSolo(player1Name.trim());
    } else {
      onStartHotSeat(player1Name.trim(), player2Name.trim());
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent size="wide">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            🎮 {t('title')}
          </DialogTitle>
          <DialogDescription>
            {t('subtitle')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Przełącznik trybu */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode('solo')}
              className={`flex flex-col items-start gap-1 rounded-lg border-2 p-4 text-left transition-colors ${
                mode === 'solo'
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-border hover:border-emerald-500/50'
              }`}
            >
              <span className="text-base font-semibold">
                {mode === 'solo' ? '◉' : '○'} {t('modeSoloLabel')}
              </span>
              <span className="text-xs text-muted-foreground">
                {t('soloPlayersCount')}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMode('duet')}
              className={`flex flex-col items-start gap-1 rounded-lg border-2 p-4 text-left transition-colors ${
                mode === 'duet'
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-border hover:border-emerald-500/50'
              }`}
            >
              <span className="text-base font-semibold">
                {mode === 'duet' ? '◉' : '○'} {t('modeDuetLabel')}
              </span>
              <span className="text-xs text-muted-foreground">
                {t('duetPlayersCount')}
              </span>
            </button>
          </div>

          {/* Gracz 1 */}
          <div
            className="space-y-3 p-4 rounded-lg border-2"
            style={{ borderColor: '#4ade80' }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: '#4ade80' }}
              />
              <Label className="text-base font-semibold">
                {mode === 'duet' ? t('player1Label') : t('playerLabel')}
              </Label>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                {t('playerNameLabel')}
              </Label>
              <Input
                value={player1Name}
                onChange={(e) => setPlayer1Name(e.target.value)}
                placeholder={t('player1Placeholder')}
                className="mt-1"
              />
            </div>
          </div>

          {/* Gracz 2 - tylko w duecie */}
          {mode === 'duet' && (
            <div
              className="space-y-3 p-4 rounded-lg border-2"
              style={{ borderColor: '#f472b6' }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: '#f472b6' }}
                />
                <Label className="text-base font-semibold">
                  {t('player2Label')}
                </Label>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  {t('playerNameLabel')}
                </Label>
                <Input
                  value={player2Name}
                  onChange={(e) => setPlayer2Name(e.target.value)}
                  placeholder={t('player2Placeholder')}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {/* Info */}
          {mode === 'duet' && (
            <div className="text-xs text-muted-foreground space-y-1">
              <p>💡 {t('changePlayerHint')}</p>
              <p>💡 {t('activeFrameHint')}</p>
            </div>
          )}

          {/* Przyciski */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleStart}
              disabled={!canStart}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {t('confirmMode')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default HotSeatSetup;
