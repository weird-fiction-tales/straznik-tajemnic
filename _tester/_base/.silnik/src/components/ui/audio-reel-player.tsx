'use client';

/**
 * AudioReelPlayer - Diegetyczny odtwarzacz nagrań i taśm szpulowych (P1)
 *
 * Wykorzystuje WaveSurfer.js (BSD-3) do wizualizacji fali dźwiękowej.
 * Oferuje:
 * - Klimatyczny widok magnetofonu szpulowego / kasetowego (obracające się szpule podczas odtwarzania)
 * - Znaczniki czasu powiązane z transkrypcją (kliknięcie przewija nagranie do wskazanego punktu)
 * - Miernik poziomu dźwięku (VU meter indicator)
 * - Pełną dostępność i responsywność Dark Art Déco
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import WaveSurfer from 'wavesurfer.js';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Radio,
  Disc,
  Clock,
  FileText,
} from 'lucide-react';

export interface AudioTimeCue {
  timeSeconds: number;
  label: string;
  transcriptSnippet?: string;
}

const EMPTY_CUES: AudioTimeCue[] = [];

interface AudioReelPlayerProps {
  audioUrl: string;
  title?: string;
  reelType?: 'reel_to_reel' | 'cassette' | 'gramophone' | 'radio';
  cues?: AudioTimeCue[];
  transcript?: string;
  className?: string;
  onCueClick?: (cue: AudioTimeCue) => void;
}

export function AudioReelPlayer({
  audioUrl,
  title,
  reelType = 'reel_to_reel',
  cues = EMPTY_CUES,
  transcript,
  className = '',
  onCueClick,
}: AudioReelPlayerProps) {
  const t = useTranslations('AudioReelPlayer');
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [activeCueIndex, setActiveCueIndex] = useState<number | null>(null);

  // Inicjalizacja WaveSurfer
  useEffect(() => {
    if (!waveformRef.current) return;

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#5a462b',
      progressColor: '#b89047',
      cursorColor: '#0d9488',
      barWidth: 2,
      barGap: 1.5,
      barRadius: 2,
      height: 44,
      url: audioUrl,
      normalize: true,
    });

    ws.on('ready', () => {
      setIsReady(true);
      setDuration(ws.getDuration());
    });

    ws.on('audioprocess', () => {
      const time = ws.getCurrentTime();
      setCurrentTime(time);

      // Aktualizacja aktywnego znacznika czasu
      if (cues.length > 0) {
        const matchingIdx = cues.findIndex((c, i) => {
          const nextCueTime = cues[i + 1]?.timeSeconds ?? Infinity;
          return time >= c.timeSeconds && time < nextCueTime;
        });
        setActiveCueIndex(matchingIdx !== -1 ? matchingIdx : null);
      }
    });

    ws.on('play', () => {
      setIsPlaying(true);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('straznik:pause-tts'));
        window.dispatchEvent(new CustomEvent('straznik:audio-handout-play', { detail: { audioUrl } }));
      }
    });
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => {
      setIsPlaying(false);
      setCurrentTime(0);
    });

    // Wstrzymaj ten player, gdy inny handout zaczyna grać
    const handleOtherHandoutPlay = (e: Event) => {
      const customEvent = e as CustomEvent<{ audioUrl?: string }>;
      if (customEvent.detail?.audioUrl !== audioUrl && ws.isPlaying()) {
        ws.pause();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('straznik:audio-handout-play', handleOtherHandoutPlay);
    }

    wavesurferRef.current = ws;

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('straznik:audio-handout-play', handleOtherHandoutPlay);
      }
      ws.destroy();
      wavesurferRef.current = null;
    };
  }, [audioUrl, cues]);

  const togglePlay = useCallback(() => {
    if (!wavesurferRef.current) return;
    wavesurferRef.current.playPause();
  }, []);

  const handleRestart = useCallback(() => {
    if (!wavesurferRef.current) return;
    wavesurferRef.current.seekTo(0);
    wavesurferRef.current.play();
  }, []);

  const handleSeekToCue = useCallback(
    (cue: AudioTimeCue) => {
      if (!wavesurferRef.current || duration === 0) return;
      const progress = Math.min(Math.max(cue.timeSeconds / duration, 0), 1);
      wavesurferRef.current.seekTo(progress);
      wavesurferRef.current.play();
      if (onCueClick) {
        onCueClick(cue);
      }
    },
    [duration, onCueClick]
  );

  const toggleMute = useCallback(() => {
    if (!wavesurferRef.current) return;
    const nextMuted = !isMuted;
    wavesurferRef.current.setMuted(nextMuted);
    setIsMuted(nextMuted);
  }, [isMuted]);

  // Formatowanie sekund do postaci MM:SS
  const formatTime = (secs: number): string => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const ReelIcon = reelType === 'radio' ? Radio : Disc;

  return (
    <div
      className={`border border-brass/35 bg-[#120f0c] shadow-2xl rounded-sm p-4 text-foreground select-none ${className}`}
    >
      {/* Nagłówek diegetyczny magnetofonu */}
      <div className="flex items-center justify-between border-b border-brass/20 pb-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <ReelIcon
              className={`h-6 w-6 text-brass transition-transform duration-700 ${
                isPlaying ? 'animate-spin' : ''
              }`}
            />
            {isPlaying && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            )}
          </div>
          <div>
            <h4 className="font-display text-sm font-bold text-amber-200 tracking-wider uppercase">
              {title || t('defaultRecordingTitle')}
            </h4>
            <span className="font-mono text-[10px] text-brass/70 uppercase">
              {reelType === 'cassette'
                ? t('formatCassette')
                : reelType === 'radio'
                ? t('formatRadio')
                : reelType === 'gramophone'
                ? t('formatGramophone')
                : t('formatReel')}
            </span>
          </div>
        </div>

        {/* Licznik czasu w stylu retro cyfrowo-mechanicznym */}
        <div className="flex items-center gap-1.5 font-mono text-xs bg-[#090806] border border-brass/30 px-2.5 py-1 rounded text-amber-400 shadow-inner">
          <Clock className="h-3 w-3 text-brass/70" />
          <span>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Wizualizacja fali dźwiękowej (WaveSurfer) */}
      <div className="relative bg-[#0a0806] p-2 rounded border border-brass/25 shadow-inner mb-3">
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center text-xs font-mono text-brass/60 animate-pulse">
            {t('bufferingTrack')}
          </div>
        )}
        <div ref={waveformRef} className="w-full" />
      </div>

      {/* Pasek sterowania (Play, Restart, Mute) */}
      <div className="flex items-center justify-between border-t border-brass/20 pt-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            disabled={!isReady}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-display font-semibold uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/90 rounded-sm shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            {isPlaying ? (
              <>
                <Pause className="h-3.5 w-3.5" />
                <span>{t('pause')}</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>{t('play')}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleRestart}
            className="p-1.5 text-brass/80 hover:text-amber-200 hover:bg-brass/10 border border-brass/30 rounded-sm transition-colors"
            title={t('restart')}
            aria-label={t('restart')}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={toggleMute}
            className="p-1.5 text-brass/80 hover:text-amber-200 hover:bg-brass/10 border border-brass/30 rounded-sm transition-colors"
            title={isMuted ? t('unmute') : t('mute')}
            aria-label={isMuted ? t('unmute') : t('mute')}
          >
            {isMuted ? (
              <VolumeX className="h-3.5 w-3.5 text-destructive" />
            ) : (
              <Volume2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {/* Diegetyczny wskaźnik VU */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono text-brass/60">VU:</span>
          <div className="flex gap-0.5">
            <span
              className={`h-2.5 w-1 rounded-xs transition-colors ${
                isPlaying ? 'bg-emerald-500' : 'bg-stone-800'
              }`}
            />
            <span
              className={`h-2.5 w-1 rounded-xs transition-colors ${
                isPlaying ? 'bg-emerald-500' : 'bg-stone-800'
              }`}
            />
            <span
              className={`h-2.5 w-1 rounded-xs transition-colors ${
                isPlaying ? 'bg-amber-400' : 'bg-stone-800'
              }`}
            />
            <span
              className={`h-2.5 w-1 rounded-xs transition-colors ${
                isPlaying ? 'bg-red-500 animate-pulse' : 'bg-stone-800'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Znaczniki na taśmie (Cues / Sprawozdanie śledcze) */}
      {cues.length > 0 && (
        <div className="mt-3 pt-3 border-t border-brass/20 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-display uppercase tracking-wider text-amber-300">
            <FileText className="h-3.5 w-3.5 text-brass" />
            <span>{t('timelineCuesTitle')}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {cues.map((cue, cIdx) => {
              const isActive = activeCueIndex === cIdx;
              return (
                <button
                  key={cIdx}
                  type="button"
                  onClick={() => handleSeekToCue(cue)}
                  className={`text-left p-2 rounded text-xs transition-all flex items-start justify-between gap-2 border ${
                    isActive
                      ? 'border-primary bg-primary/15 text-white shadow-[0_0_10px_rgba(13,148,136,0.3)]'
                      : 'border-brass/20 bg-[#17130e] text-muted-foreground hover:border-brass/50 hover:text-amber-100'
                  }`}
                >
                  <span className="line-clamp-1">{cue.label}</span>
                  <span className="font-mono text-[10px] text-brass/80 shrink-0">
                    {formatTime(cue.timeSeconds)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Transkrypcja nagrania */}
      {transcript && (
        <div className="mt-3 pt-3 border-t border-brass/20">
          <div className="text-[11px] font-mono uppercase text-brass/70 mb-1">
            {t('transcriptTitle')}:
          </div>
          <p className="font-serif italic text-xs text-foreground/85 leading-relaxed bg-[#0e0c09] p-2.5 rounded border border-brass/15">
            {transcript}
          </p>
        </div>
      )}
    </div>
  );
}

export default AudioReelPlayer;
