'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from './button';

interface YouTubePlayerProps {
  isTTSPlaying?: boolean;
}

const STORAGE_KEY = 'youtube_url';
const VOLUME_STORAGE_KEY = 'youtube_volume';
const DEFAULT_VOLUME = 15;

// Domyślna playlista atmosferyczna - zaszyta na sztywno, ładuje się gdy gracz
// nie wkleił własnego URL. Gracz może ją chwilowo podmienić (zapis do localStorage).
const DEFAULT_PLAYLIST_URL =
  'https://www.youtube.com/playlist?list=PLiv9C0j7O4-PK88Yi1g7dYgCCxVzixbsb';

// Minimalny typ YouTube IFrame Player API (tylko metody, których używamy).
interface YTPlayer {
  destroy(): void;
  setVolume(volume: number): void;
  getVolume?(): number;
  unMute?(): void;
  isMuted?(): boolean;
  playVideo(): void;
  pauseVideo(): void;
  setShuffle(shuffle: boolean): void;
  getPlaylist?(): string[] | undefined;
  playVideoAt(index: number): void;
  nextVideo(): void;
  previousVideo(): void;
  getVideoData(): { title?: string };
}

interface YTPlayerEvent {
  target: YTPlayer;
  data: number;
}

interface YTNamespace {
  Player: new (
    container: HTMLElement,
    options: {
      height?: string;
      width?: string;
      videoId?: string;
      playerVars?: Record<string, string | number | undefined>;
      events?: {
        onReady?: (event: YTPlayerEvent) => void;
        onStateChange?: (event: YTPlayerEvent) => void;
        onError?: (event: YTPlayerEvent) => void;
      };
    }
  ) => YTPlayer;
  PlayerState: { PLAYING: number };
}

declare global {
  interface Window {
    YT: YTNamespace;
    onYouTubeIframeAPIReady: () => void;
  }
}

type ContentType = 'video' | 'playlist' | null;

// Wyciągnij ID z URL YouTube
function extractYouTubeContent(
  url: string
): { type: ContentType; id: string } | null {
  try {
    const urlObj = new URL(url);

    // Playlista: https://youtube.com/playlist?list=PLxxxxxx
    const listParam = urlObj.searchParams.get('list');
    if (listParam && !urlObj.searchParams.get('v')) {
      return { type: 'playlist', id: listParam };
    }

    // Film: https://youtube.com/watch?v=xxxxx lub https://youtu.be/xxxxx
    const videoParam = urlObj.searchParams.get('v');
    if (videoParam) {
      return { type: 'video', id: videoParam };
    }

    // youtu.be/xxxxx
    if (urlObj.hostname === 'youtu.be') {
      const id = urlObj.pathname.slice(1);
      if (id) return { type: 'video', id };
    }

    // youtube.com/embed/xxxxx
    if (urlObj.pathname.startsWith('/embed/')) {
      const id = urlObj.pathname.split('/')[2];
      if (id) return { type: 'video', id };
    }

    return null;
  } catch {
    // Może samo ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
      return { type: 'video', id: url };
    }
    if (url.startsWith('PL') || url.startsWith('OL') || url.startsWith('RD')) {
      return { type: 'playlist', id: url };
    }
    return null;
  }
}

// Mapuj kod błędu YT IFrame API na klucz tłumaczenia (komunikat składany w komponencie).
// 2 = zły identyfikator, 5 = błąd odtwarzacza, 100 = usunięty/prywatny,
// 101/150 = właściciel zablokował osadzanie.
function mapYouTubeError(code: number): string {
  switch (code) {
    case 2:
      return 'errorInvalidId';
    case 100:
      return 'errorDeletedOrPrivate';
    case 101:
    case 150:
      return 'errorEmbeddingBlocked';
    case 5:
      return 'errorPlayerGeneric';
    default:
      return 'errorFallback';
  }
}

export function YouTubePlayer({ isTTSPlaying = false }: YouTubePlayerProps) {
  const t = useTranslations('YoutubePlayer');
  const playbackErrorMessages: Record<string, string> = {
    errorInvalidId: t('errorInvalidId'),
    errorDeletedOrPrivate: t('errorDeletedOrPrivate'),
    errorEmbeddingBlocked: t('errorEmbeddingBlocked'),
    errorPlayerGeneric: t('errorPlayerGeneric'),
    errorFallback: t('errorFallback'),
  };
  const [isExpanded, setIsExpanded] = useState(false); // FEATURE:#16 - Domyślnie zwinięte
  const [content, setContent] = useState<{
    type: ContentType;
    id: string;
  } | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  // IND-270 #3: błąd odtwarzania z YT IFrame API (np. playlista usunięta /
  // zablokowane osadzanie). Wcześniej brak onError = kryptyczny overlay YT.
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedVol = localStorage.getItem(VOLUME_STORAGE_KEY);
      if (savedVol !== null) {
        const parsed = parseInt(savedVol, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
          return parsed;
        }
      }
    }
    return DEFAULT_VOLUME;
  });
  const [currentTitle, setCurrentTitle] = useState<string>('');
  const [isReady, setIsReady] = useState(false);

  const playerRef = useRef<YTPlayer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Gdy gracz kliknie „Rozpocznij" zanim player się załaduje - zapamiętaj,
  // żeby odpalić odtwarzanie w onReady.
  const pendingPlayRef = useRef(false);

  // Załaduj zapisany URL albo domyślną playlistę oraz zapisaną głośność
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem(STORAGE_KEY) || DEFAULT_PLAYLIST_URL;
    const parsed = extractYouTubeContent(saved);
    if (parsed) setContent(parsed);

    const savedVol = localStorage.getItem(VOLUME_STORAGE_KEY);
    if (savedVol !== null) {
      const parsedVol = parseInt(savedVol, 10);
      if (!isNaN(parsedVol) && parsedVol >= 0 && parsedVol <= 100) {
        setVolume(parsedVol);
      }
    }
  }, []);

  // Załaduj YouTube IFrame API
  useEffect(() => {
    if (typeof window === 'undefined' || !content) return;

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScript = document.getElementsByTagName('script')[0];
      firstScript.parentNode?.insertBefore(tag, firstScript);

      window.onYouTubeIframeAPIReady = () => {
        initPlayer();
      };
    } else {
      initPlayer();
    }
  }, [content]);

  // Wystartuj odtwarzanie. Dla playlisty: shuffle + losowy utwór na start.
  const startPlayback = useCallback(
    (player: YTPlayer | null) => {
      if (!player) return;
      if (content?.type === 'playlist') {
        try {
          player.setShuffle(true);
          const list = player.getPlaylist?.();
          if (Array.isArray(list) && list.length > 0) {
            player.playVideoAt(Math.floor(Math.random() * list.length));
            return;
          }
        } catch {
          // getPlaylist niedostępne tuż po onReady - fallback do zwykłego play niżej.
        }
      }
      player.playVideo();
    },
    [content]
  );

  const initPlayer = useCallback(() => {
    if (!content || !containerRef.current) return;

    if (playerRef.current) {
      playerRef.current.destroy();
    }

    const playerVars =
      content.type === 'playlist'
        ? {
            listType: 'playlist',
            list: content.id,
            autoplay: 0,
            controls: 1,
            modestbranding: 1,
            rel: 0,
          }
        : { autoplay: 0, controls: 1, modestbranding: 1, rel: 0 };

    const playerOptions =
      content.type === 'playlist'
        ? { height: '200', width: '100%', playerVars }
        : { height: '200', width: '100%', videoId: content.id, playerVars };

    playerRef.current = new window.YT.Player(containerRef.current, {
      ...playerOptions,
      events: {
        onReady: (event: YTPlayerEvent) => {
          setIsReady(true);
          try {
            if (event.target.isMuted?.()) {
              event.target.unMute?.();
            }
          } catch {
            // Bezpieczny fallback
          }
          event.target.setVolume(volume);
          if (content?.type === 'playlist') {
            event.target.setShuffle(true);
          }
          // Gracz kliknął „Rozpocznij" zanim player był gotowy - odpal teraz.
          if (pendingPlayRef.current) {
            pendingPlayRef.current = false;
            startPlayback(event.target);
          }
        },
        onStateChange: (event: YTPlayerEvent) => {
          setIsPlaying(event.data === window.YT.PlayerState.PLAYING);
          if (event.data === window.YT.PlayerState.PLAYING) {
            setPlaybackError(null); // gra → wyczyść ewentualny wcześniejszy błąd
            try {
              const videoData = event.target.getVideoData();
              setCurrentTitle(videoData.title || '');
            } catch {
              // getVideoData może chwilowo nie mieć tytułu - pomijamy.
            }
          }
        },
        // IND-270 #3: YT zgłasza błąd (usunięty/prywatny film, zablokowane
        // osadzanie 101/150) - pokaż czytelny komunikat zamiast cichego overlayu.
        onError: (event: YTPlayerEvent) => {
          setPlaybackError(mapYouTubeError(event.data));
        },
      },
    });
  }, [content, volume, startPlayback]);

  // Autostart przy kliknięciu „Rozpocznij" (event z useGameStart).
  // playVideo() w obrębie tego gestu = przeglądarka pozwala odpalić dźwięk.
  useEffect(() => {
    const handleStartMusic = () => {
      if (playerRef.current && isReady) {
        startPlayback(playerRef.current);
      } else {
        // Player jeszcze się ładuje - zagra w onReady.
        pendingPlayRef.current = true;
      }
    };
    window.addEventListener('zew:start-music', handleStartMusic);
    return () =>
      window.removeEventListener('zew:start-music', handleStartMusic);
  }, [isReady, startPlayback]);

  // Stop przy wyjściu do menu / "Nowej przygodzie" (event z page.tsx).
  // Muzyka tła ma grać TYLKO w trakcie gry - poza grą cichnie. Anuluje też
  // ewentualny pending autostart, by player nie zagrał po powrocie do menu.
  useEffect(() => {
    const handleStopMusic = () => {
      pendingPlayRef.current = false;
      if (playerRef.current) {
        playerRef.current.pauseVideo();
      }
      setIsPlaying(false);
    };
    window.addEventListener('zew:stop-music', handleStopMusic);
    return () => window.removeEventListener('zew:stop-music', handleStopMusic);
  }, []);

  // TTS - obniż głośność proporcjonalnie do poziomu ustawionego przez gracza
  useEffect(() => {
    if (!playerRef.current || !isReady) return;

    if (isTTSPlaying) {
      // Proporcjonalny ducking do ~30% wartości gracza (np. 80 -> 24, 15 -> 5)
      const duckedVolume = Math.round(volume * 0.3);
      playerRef.current.setVolume(duckedVolume);
    } else {
      playerRef.current.setVolume(volume);
    }
  }, [isTTSPlaying, isReady, volume]);

  // SFX Ducking - proporcjonalne przyciszenie muzyki na czas trwania efektu uderzeniowego (Issue #789)
  useEffect(() => {
    let duckTimer: ReturnType<typeof setTimeout> | null = null;
    const handleSFXDucking = (e: Event) => {
      const customEvt = e as CustomEvent<{ durationMs?: number }>;
      const duration = customEvt.detail?.durationMs ?? 1500;
      if (playerRef.current && isReady) {
        const duckedVolume = Math.round(volume * 0.4);
        playerRef.current.setVolume(duckedVolume);
        if (duckTimer) clearTimeout(duckTimer);
        duckTimer = setTimeout(() => {
          if (playerRef.current && isReady && !isTTSPlaying) {
            playerRef.current.setVolume(volume);
          }
        }, duration);
      }
    };
    window.addEventListener('zew:sfx-ducking', handleSFXDucking);
    return () => {
      window.removeEventListener('zew:sfx-ducking', handleSFXDucking);
      if (duckTimer) clearTimeout(duckTimer);
    };
  }, [isReady, volume, isTTSPlaying]);

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(VOLUME_STORAGE_KEY, String(newVolume));
      } catch {
        // Ignoruj błąd zapisu w incognito/pełnym storage
      }
    }
    if (playerRef.current && isReady) {
      try {
        playerRef.current.unMute?.();
      } catch {
        // Bezpieczny fallback
      }
      playerRef.current.setVolume(newVolume);
    }
  };

  const handleLoad = () => {
    setError(null);
    setPlaybackError(null);
    const trimmedUrl = inputValue.trim();
    if (!trimmedUrl) {
      setError(t('pasteUrlError'));
      return;
    }
    const parsed = extractYouTubeContent(trimmedUrl);
    if (!parsed) {
      setError(t('invalidUrlError'));
      return;
    }
    setContent(parsed);
    setInputValue('');
    setIsReady(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, trimmedUrl);
    }
  };

  const handleClear = () => {
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }
    setContent(null);
    setInputValue('');
    setError(null);
    setIsReady(false);
    setCurrentTitle('');
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const togglePlay = () => {
    if (!playerRef.current || !isReady) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

  const nextTrack = () => {
    if (playerRef.current && isReady && content?.type === 'playlist') {
      playerRef.current.nextVideo();
    }
  };

  const prevTrack = () => {
    if (playerRef.current && isReady && content?.type === 'playlist') {
      playerRef.current.previousVideo();
    }
  };

  return (
    <div className="border border-brass/35 rounded-lg overflow-hidden bg-card">
      <div
        className="flex items-center justify-between p-2 cursor-pointer hover:bg-brass/5 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span>📺</span>
          <span className="text-sm font-display uppercase tracking-[0.1em] text-brass">
            YouTube
          </span>
          {content && (
            <span
              className={`inline-flex items-center gap-1.5 text-xs px-1.5 py-0.5 rounded ${isExpanded ? 'bg-red-500/20 text-red-400' : 'bg-muted text-muted-foreground'}`}
            >
              <span className="flex items-center justify-center leading-none">{isPlaying ? '▶️' : '⏸️'}</span>
              <span>{content.type === 'playlist' ? t('typePlaylist') : t('typeVideo')}</span>
            </span>
          )}
        </div>
        <span className="text-muted-foreground text-xs">
          {isExpanded ? '▲' : '▼'}
        </span>
      </div>

      {content && (
        <div
          className="transition-all duration-200 overflow-hidden border-t border-brass/30"
          style={{
            maxHeight: isExpanded ? '400px' : '0px',
            opacity: isExpanded ? 1 : 0,
          }}
        >
          <div ref={containerRef} className="w-full" />

          <div className="p-2 bg-[#1a1610] space-y-2">
            {playbackError && (
              <div className="text-xs text-destructive px-1">
                ⚠️ {playbackErrorMessages[playbackError]}
              </div>
            )}
            {currentTitle && (
              <div className="text-xs text-foreground truncate px-1">
                🎵 {currentTitle}
              </div>
            )}

            <div className="flex items-center justify-center gap-2">
              {content.type === 'playlist' && (
                <Button
                  onClick={prevTrack}
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                >
                  ⏮️
                </Button>
              )}
              <Button
                onClick={togglePlay}
                size="sm"
                variant="outline"
                className="h-8 px-4"
              >
                {isPlaying ? '⏸️' : '▶️'}
              </Button>
              {content.type === 'playlist' && (
                <Button
                  onClick={nextTrack}
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                >
                  ⏭️
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2 px-1">
              <span className="text-xs text-muted-foreground">🔊</span>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                className="flex-1 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${volume}%, hsl(var(--muted)) ${volume}%, hsl(var(--muted)) 100%)`,
                }}
              />
              <span className="text-xs text-muted-foreground w-8 text-right">
                {volume}%
              </span>
            </div>

            {isTTSPlaying && (
              <div className="text-[14px] text-yellow-500 text-center">
                {t('volumeLowered')}
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={t('changePlaceholder')}
                className="flex-1 bg-background border border-brass/30 rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary"
                onKeyDown={(e) => e.key === 'Enter' && handleLoad()}
              />
              <Button
                onClick={handleLoad}
                size="sm"
                variant="outline"
                className="text-xs h-7 px-2"
              >
                OK
              </Button>
              <Button
                onClick={handleClear}
                size="sm"
                variant="ghost"
                className="text-xs h-7 px-2 text-muted-foreground"
              >
                ✕
              </Button>
            </div>
          </div>
        </div>
      )}

      {!content && isExpanded && (
        <div className="p-3 border-t border-brass/30 space-y-2">
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={t('linkPlaceholder')}
              className="min-w-0 flex-1 bg-background border border-brass/30 rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
              onKeyDown={(e) => e.key === 'Enter' && handleLoad()}
            />
            <Button onClick={handleLoad} size="sm" className="shrink-0">
              ▶️
            </Button>
          </div>
          {error && <p className="text-destructive text-xs">{error}</p>}
          <p className="text-muted-foreground text-xs">
            {t('supportedFormats')}
          </p>
        </div>
      )}
    </div>
  );
}

export default YouTubePlayer;
