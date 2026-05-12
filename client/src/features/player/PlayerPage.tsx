import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { SongDetail } from '@lyricling/shared';
import { api } from '../../lib/api';
import { useT } from '../../i18n';
import { usePlayerStore } from '../../stores/playerStore';
import { useDictionaryStore } from '../../stores/dictionaryStore';
import { useVirtualClock } from '../../hooks/useVirtualClock';
import { AudioController } from './AudioController';
import { YouTubeController } from './YouTubeController';
import { TransportBar } from './TransportBar';
import { LyricsView } from './LyricsView';
import { LyricsOffsetControl } from './LyricsOffsetControl';
import { ListenedBanner } from './ListenedBanner';

export function PlayerPage() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [song, setSong] = useState<SongDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reset = usePlayerStore((s) => s.reset);
  const setDuration = usePlayerStore((s) => s.setDuration);
  const setLyricsOffset = usePlayerStore((s) => s.setLyricsOffset);
  const loadDict = useDictionaryStore((s) => s.load);

  // Drive virtual clock when no audio source.
  const isVirtual = song?.sourceType === 'virtual';
  useVirtualClock(Boolean(isVirtual));

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    reset();
    api.songs
      .get(Number(id))
      .then((s) => {
        setSong(s);
        setError(null);
        setDuration(s.durationMs);
        setLyricsOffset(s.lyricsOffsetMs ?? 0);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
    loadDict();
  }, [id, reset, setDuration, setLyricsOffset, loadDict]);

  const handleDelete = async () => {
    if (!song) return;
    if (!confirm(t('player.deleteConfirm'))) return;
    await api.songs.delete(song.id);
    navigate('/');
  };

  if (loading) return <div className="text-ink-dim">{t('common.loading')}</div>;
  if (error) return <div className="text-rose-400">{t('common.error', { message: error })}</div>;
  if (!song) return null;

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-4">
        <Link to="/" className="btn-ghost">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          {t('player.back')}
        </Link>
        <div className="flex items-center gap-2">
          <Link to={`/songs/${song.id}/quiz`} className="btn-primary">
            {t('player.startQuiz')}
          </Link>
          <button onClick={handleDelete} className="btn-ghost text-rose-400 hover:text-rose-300">
            {t('player.delete')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-4">
        <div>
          {song.sourceType === 'youtube' && song.youtubeId && (
            <YouTubeController videoId={song.youtubeId} />
          )}
          {song.sourceType === 'upload' && song.audioUrl && (
            <AudioController src={song.audioUrl} />
          )}
          {song.sourceType === 'virtual' && (
            <div className="panel p-6 flex items-center justify-center text-center">
              <div>
                <div className="font-display text-2xl bg-gradient-to-r from-brand to-brand-glow bg-clip-text text-transparent">
                  {song.title}
                </div>
                <div className="text-ink-muted mt-1">{song.artist}</div>
                <div className="mt-3 inline-flex items-center gap-2 text-xs text-ink-dim">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-glow animate-pulse-soft" />
                  {t('player.virtualMode')}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="panel p-5">
          <div className="font-display text-xl font-semibold">{song.title}</div>
          <div className="text-ink-muted">{song.artist}</div>
          {song.level && (
            <div className="mt-2">
              <span className="chip">{t('library.level')}: {song.level}</span>
            </div>
          )}
          {song.description && (
            <p className="mt-3 text-sm text-ink-muted">{song.description}</p>
          )}
        </div>
      </div>

      <div className="mb-3">
        <TransportBar virtual={isVirtual} />
      </div>

      {!isVirtual && (
        <div className="mb-4">
          <LyricsOffsetControl songId={song.id} />
        </div>
      )}

      <LyricsView songId={song.id} lines={song.lines} virtual={isVirtual} />

      <ListenedBanner key={song.id} songId={song.id} />
    </div>
  );
}
