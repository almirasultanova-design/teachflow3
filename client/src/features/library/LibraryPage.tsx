import { useEffect, useState } from 'react';
import type { Song } from '@lyricling/shared';
import { api } from '../../lib/api';
import { useT } from '../../i18n';
import { SongCard } from './SongCard';
import { AddSongDialog } from './AddSongDialog';

export function LibraryPage() {
  const t = useT();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = () => {
    setLoading(true);
    api.songs
      .list()
      .then((items) => {
        setSongs(items);
        setErr(null);
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">{t('library.title')}</h1>
          <p className="text-ink-muted mt-1 text-sm">{t('library.subtitle')}</p>
        </div>
        <button className="btn-primary" onClick={() => setDialogOpen(true)}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {t('nav.add')}
        </button>
      </div>

      {loading && <div className="text-ink-dim">{t('common.loading')}</div>}
      {err && <div className="text-rose-400">{t('common.error', { message: err })}</div>}

      {!loading && songs.length === 0 && (
        <div className="panel p-10 text-center text-ink-muted">
          <div className="mb-2">{t('library.empty')}</div>
          <button className="btn-primary mt-2 inline-flex" onClick={() => setDialogOpen(true)}>
            {t('nav.add')}
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {songs.map((s) => (
          <SongCard key={s.id} song={s} />
        ))}
      </div>

      <AddSongDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={() => load()}
      />
    </div>
  );
}
