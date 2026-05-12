import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePlayerStore } from '../../stores/playerStore';
import { api } from '../../lib/api';
import { useT } from '../../i18n';

interface Props {
  songId: number;
}

const COMPLETION_RATIO = 0.85;

/**
 * Watches the player and, once the user has heard ~85% of the track, posts a
 * "listened" event to the server and shows a sticky CTA pointing them at the
 * quiz. The banner can be dismissed; it doesn't reappear in the same session
 * for the same song.
 */
export function ListenedBanner({ songId }: Props) {
  const t = useT();
  const timeMs = usePlayerStore((s) => s.timeMs);
  const durationMs = usePlayerStore((s) => s.durationMs);

  const [shown, setShown] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const fired = useRef(false);

  // Reset flags when the active song changes (component is keyed by songId).
  useEffect(() => {
    fired.current = false;
    setShown(false);
    setDismissed(false);
  }, [songId]);

  useEffect(() => {
    if (fired.current) return;
    if (!durationMs || durationMs <= 0) return;
    if (timeMs / durationMs < COMPLETION_RATIO) return;

    fired.current = true;
    setShown(true);

    api.songs.markListened(songId).catch((err: Error) => {
      console.warn('mark listened failed:', err.message);
    });
  }, [songId, timeMs, durationMs]);

  if (!shown || dismissed) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-2xl panel p-4 sm:p-5 border-brand/40 shadow-glow flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 bg-bg-panel/95 backdrop-blur">
        <div className="flex-1">
          <div className="font-display text-lg font-semibold flex items-center gap-2">
            <span className="text-xl">🎉</span>
            {t('listened.title')}
          </div>
          <p className="mt-0.5 text-sm text-ink-muted">{t('listened.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setDismissed(true)}
            className="rounded-lg border border-bg-ring px-3 py-1.5 text-sm text-ink-muted hover:text-ink hover:bg-bg-soft transition"
          >
            {t('listened.later')}
          </button>
          <Link
            to={`/songs/${songId}/quiz`}
            className="btn-primary"
            onClick={() => setDismissed(true)}
          >
            {t('listened.cta')}
          </Link>
        </div>
      </div>
    </div>
  );
}
