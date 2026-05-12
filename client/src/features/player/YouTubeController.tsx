import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../../stores/playerStore';

interface Props {
  videoId: string;
}

interface YTPlayer {
  destroy: () => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (s: number, allowSeekAhead?: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement,
        opts: {
          videoId: string;
          width?: string | number;
          height?: string | number;
          playerVars?: Record<string, unknown>;
          events?: {
            onReady?: (e: { target: YTPlayer }) => void;
            onStateChange?: (e: { data: number; target: YTPlayer }) => void;
          };
        },
      ) => YTPlayer;
      PlayerState: { PLAYING: 1; PAUSED: 2; ENDED: 0 };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

function loadYouTubeAPI(): Promise<void> {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve) => {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => resolve();
  });
  return apiPromise;
}

export function YouTubeController({ videoId }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const intervalRef = useRef<number | null>(null);

  const setTime = usePlayerStore((s) => s.setTime);
  const setPlaying = usePlayerStore((s) => s.setPlaying);
  const setDuration = usePlayerStore((s) => s.setDuration);

  useEffect(() => {
    let mounted = true;
    loadYouTubeAPI().then(() => {
      if (!mounted || !containerRef.current || !window.YT) return;

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady: ({ target }) => {
            setDuration(target.getDuration() * 1000);
          },
          onStateChange: ({ data, target }) => {
            if (!window.YT) return;
            if (data === window.YT.PlayerState.PLAYING) {
              setPlaying(true);
              if (!intervalRef.current) {
                intervalRef.current = window.setInterval(() => {
                  setTime(target.getCurrentTime() * 1000);
                }, 250);
              }
            } else {
              setPlaying(false);
              if (intervalRef.current) {
                window.clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
              if (data === window.YT.PlayerState.ENDED) {
                setTime(target.getDuration() * 1000);
              } else {
                setTime(target.getCurrentTime() * 1000);
              }
            }
          },
        },
      });
    });

    return () => {
      mounted = false;
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      try {
        playerRef.current?.destroy();
      } catch { /* ignore */ }
      playerRef.current = null;
    };
  }, [videoId, setTime, setPlaying, setDuration]);

  useEffect(() => {
    const handler = ((e: CustomEvent<{ kind: string; valueMs?: number }>) => {
      const p = playerRef.current;
      if (!p) return;
      const { kind, valueMs } = e.detail;
      if (kind === 'seek' && typeof valueMs === 'number') p.seekTo(valueMs / 1000, true);
      if (kind === 'play') p.playVideo();
      if (kind === 'pause') p.pauseVideo();
    }) as EventListener;
    window.addEventListener('lyricling:transport', handler);
    return () => window.removeEventListener('lyricling:transport', handler);
  }, []);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-bg-ring bg-black aspect-video">
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  );
}
