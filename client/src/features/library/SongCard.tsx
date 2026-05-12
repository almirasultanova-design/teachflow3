import { Link } from 'react-router-dom';
import type { Song } from '@lyricling/shared';
import { formatTime } from '../../lib/utils';
import { useT } from '../../i18n';

interface Props {
  song: Song;
}

export function SongCard({ song }: Props) {
  const t = useT();
  const cover = song.coverUrl;
  const sourceLabel =
    song.sourceType === 'youtube' ? 'YouTube' : song.sourceType === 'upload' ? 'MP3' : 'Lyrics';

  return (
    <Link
      to={`/songs/${song.id}`}
      className="group panel p-4 flex gap-4 transition hover:border-brand/50 hover:shadow-glow"
    >
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-bg-soft border border-bg-ring">
        {cover ? (
          <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-brand/30 to-brand-glow/20">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink/80">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-display text-lg font-semibold truncate group-hover:text-brand transition-colors">
              {song.title}
            </div>
            <div className="text-sm text-ink-muted truncate">{song.artist}</div>
          </div>
          <span className="chip">{sourceLabel}</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-ink-dim">
          <span>{formatTime(song.durationMs)}</span>
          {song.level && (
            <>
              <span>·</span>
              <span>
                {t('library.level')}: {song.level}
              </span>
            </>
          )}
        </div>
        {song.description && (
          <div className="mt-2 text-xs text-ink-muted line-clamp-2">{song.description}</div>
        )}
      </div>
    </Link>
  );
}
