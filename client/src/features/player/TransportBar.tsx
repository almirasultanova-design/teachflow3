import { usePlayerStore } from '../../stores/playerStore';
import { formatTime } from '../../lib/utils';
import { useT } from '../../i18n';

export function transport(kind: 'play' | 'pause' | 'seek', valueMs?: number) {
  window.dispatchEvent(
    new CustomEvent('lyricling:transport', { detail: { kind, valueMs } }),
  );
}

interface Props {
  /** When true the transport relies on the virtual clock (no audio element). */
  virtual?: boolean;
}

export function TransportBar({ virtual = false }: Props) {
  const t = useT();
  const timeMs = usePlayerStore((s) => s.timeMs);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const durationMs = usePlayerStore((s) => s.durationMs);
  const setTime = usePlayerStore((s) => s.setTime);
  const setPlaying = usePlayerStore((s) => s.setPlaying);
  const showTranslations = usePlayerStore((s) => s.showTranslations);
  const toggleTranslations = usePlayerStore((s) => s.toggleTranslations);

  const handlePlay = () => {
    if (virtual) {
      setPlaying(!isPlaying);
    } else {
      transport(isPlaying ? 'pause' : 'play');
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    if (virtual) setTime(value);
    else transport('seek', value);
  };

  return (
    <div className="panel p-3 flex items-center gap-3">
      <button
        onClick={handlePlay}
        className="h-10 w-10 rounded-full bg-brand text-bg flex items-center justify-center hover:bg-brand/90 transition shrink-0"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 5v14l12-7z" />
          </svg>
        )}
      </button>

      <span className="text-xs text-ink-dim tabular-nums w-10">{formatTime(timeMs)}</span>

      <input
        type="range"
        min={0}
        max={Math.max(durationMs, 1)}
        step={50}
        value={Math.min(timeMs, durationMs || timeMs)}
        onChange={handleSeek}
        className="flex-1 accent-brand cursor-pointer"
      />

      <span className="text-xs text-ink-dim tabular-nums w-10 text-right">
        {formatTime(durationMs)}
      </span>

      <button
        onClick={toggleTranslations}
        className="btn-ghost text-xs px-2 py-1.5 hidden sm:inline-flex"
        title={showTranslations ? t('player.hide.translation') : t('player.show.translation')}
      >
        {showTranslations ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        )}
        <span>RU</span>
      </button>
    </div>
  );
}
