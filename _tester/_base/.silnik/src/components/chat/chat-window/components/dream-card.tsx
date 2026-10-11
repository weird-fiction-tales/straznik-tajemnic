'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Moon, Sparkles, Eye, Sunrise } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DreamVisionEventData } from '@/lib/types';

interface DreamCardProps {
  dreamEvent: DreamVisionEventData;
  onAwaken?: (eventId: string) => void;
  completed?: boolean;
}

/**
 * Diegetyczna ramka snu i koszmaru w czacie (Issue #787).
 * Stylizowana na ciemnozielono-szmaragdowy oniryzm Mitów (Gla’aki / las Vermont).
 * Wyróżnia sen od zwykłej sceny, nie tworzy handoutu ani przedmiotu w kampanii.
 */
export function DreamCard({
  dreamEvent,
  onAwaken,
  completed = false,
}: DreamCardProps) {
  const t = useTranslations('DreamCard');
  const [isAwakened, setIsAwakened] = useState(completed || dreamEvent.status === 'awakened');

  const handleAwaken = () => {
    setIsAwakened(true);
    onAwaken?.(dreamEvent.id);
  };

  return (
    <div
      data-testid="dream-card"
      className="my-3 relative overflow-hidden rounded-md border border-[#11B3A3]/40 bg-gradient-to-b from-[#081714] via-[#050f0d] to-[#020504] p-4 text-[#e6ede8] shadow-[0_0_20px_rgba(17,179,163,0.12)]"
    >
      {/* Ozdobny narożnik Art Déco */}
      <div className="absolute top-0 right-0 h-10 w-10 border-t-2 border-r-2 border-[#11B3A3]/30 pointer-events-none" />
      <div className="absolute bottom-0 left-0 h-10 w-10 border-b-2 border-l-2 border-[#11B3A3]/30 pointer-events-none" />

      {/* Nagłówek wizji sennej */}
      <div className="flex items-center justify-between border-b border-[#11B3A3]/20 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <Moon className="h-4 w-4 text-[#11B3A3] animate-pulse" />
          <span className="font-cinzel text-xs tracking-widest uppercase text-[#11B3A3]">
            {t('dreamVisionHeader')} • {t('nightLabel', { number: dreamEvent.nightNumber })}
          </span>
        </div>
        {dreamEvent.investigatorName && (
          <span className="font-special-elite text-xs text-[#a0b5ab]">
            {dreamEvent.investigatorName}
          </span>
        )}
      </div>

      {/* Tytuł wariantu snu */}
      <h4 className="font-cinzel text-base font-bold text-[#c9e3d9] tracking-wide mb-2 flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-[#11B3A3]/70" />
        {dreamEvent.title}
      </h4>

      {/* Treść oniryczna */}
      <div className="font-cormorant text-base sm:text-lg italic leading-relaxed text-[#d4ded8] bg-[#000000]/30 p-3 rounded border border-[#11B3A3]/10 mb-3">
        „{dreamEvent.narrative}”
      </div>

      {/* Skutki somatyczne i przycisk powrotu do jawy */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
        <div className="text-xs text-[#8ca397] font-special-elite flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5 text-[#11B3A3]/60" />
          {isAwakened ? (
            <span className="text-[#11B3A3]">{t('awakenedStatus')}</span>
          ) : (
            <span>{t('lingeringFearHint')}</span>
          )}
        </div>

        {!isAwakened && (
          <Button
            type="button"
            size="sm"
            onClick={handleAwaken}
            className="w-full sm:w-auto font-cinzel text-xs tracking-wider uppercase bg-[#11B3A3]/20 hover:bg-[#11B3A3]/30 text-[#e6ede8] border border-[#11B3A3]/50 transition-all flex items-center gap-1.5"
          >
            <Sunrise className="h-3.5 w-3.5 text-[#11B3A3]" />
            {t('awakenButton')}
          </Button>
        )}
      </div>
    </div>
  );
}
