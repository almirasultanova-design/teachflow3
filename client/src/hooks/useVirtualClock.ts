import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../stores/playerStore';

/**
 * Drives the player's `timeMs` using `requestAnimationFrame` while `isPlaying` is true.
 * Used for the virtual mode (no audio) and as a fallback when audio elements don't
 * fire `timeupdate` frequently enough.
 */
export function useVirtualClock(enabled: boolean): void {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const setTime = usePlayerStore((s) => s.setTime);
  const setPlaying = usePlayerStore((s) => s.setPlaying);
  const lastTickRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !isPlaying) {
      lastTickRef.current = null;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    const tick = (now: number) => {
      const last = lastTickRef.current ?? now;
      const dt = now - last;
      lastTickRef.current = now;

      const state = usePlayerStore.getState();
      const next = state.timeMs + dt;
      if (state.durationMs > 0 && next >= state.durationMs) {
        setTime(state.durationMs);
        setPlaying(false);
        return;
      }
      setTime(next);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [enabled, isPlaying, setTime, setPlaying]);
}
