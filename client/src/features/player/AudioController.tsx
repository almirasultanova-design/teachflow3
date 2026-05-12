import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../../stores/playerStore';

interface Props {
  src: string;
}

/**
 * Wraps an HTML <audio> element and binds it to the player store.
 * Fires `setTime` on `timeupdate`, listens for play/pause, and seeks
 * the element when an external seek is requested via `requestSeekMs`.
 */
export function AudioController({ src }: Props) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const setTime = usePlayerStore((s) => s.setTime);
  const setPlaying = usePlayerStore((s) => s.setPlaying);
  const setDuration = usePlayerStore((s) => s.setDuration);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onTime = () => setTime(el.currentTime * 1000);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onLoaded = () => setDuration((el.duration || 0) * 1000);

    el.addEventListener('timeupdate', onTime);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('loadedmetadata', onLoaded);

    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('loadedmetadata', onLoaded);
    };
  }, [setTime, setPlaying, setDuration]);

  // Subscribe to seek/play requests issued by the controls bar.
  useEffect(() => {
    const handler = ((e: CustomEvent<{ kind: string; valueMs?: number }>) => {
      const el = ref.current;
      if (!el) return;
      const { kind, valueMs } = e.detail;
      if (kind === 'seek' && typeof valueMs === 'number') el.currentTime = valueMs / 1000;
      if (kind === 'play') void el.play();
      if (kind === 'pause') el.pause();
    }) as EventListener;
    window.addEventListener('lyricling:transport', handler);
    return () => window.removeEventListener('lyricling:transport', handler);
  }, []);

  return (
    <div className="panel p-6 flex flex-col items-center justify-center text-center">
      <audio ref={ref} src={src} preload="metadata" className="hidden" />
      <div className="font-display text-xl text-ink">Audio loaded</div>
      <div className="text-xs text-ink-dim mt-1">Use the transport bar below to play.</div>
    </div>
  );
}
