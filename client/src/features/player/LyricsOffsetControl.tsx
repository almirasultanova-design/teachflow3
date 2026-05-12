import { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import { api } from '../../lib/api';
import { useT } from '../../i18n';
import { formatTime } from '../../lib/utils';

interface Props {
  songId: number;
}

// Positive offset = lyrics appear LATER than the audio (use this when the
// video has an intro). Negative offset = lyrics appear EARLIER (use this
// when the lrclib timings start before the actual vocals).
const STEPS_MS = [-5000, -500, 500, 5000];

export function LyricsOffsetControl({ songId }: Props) {
  const t = useT();
  const lyricsOffsetMs = usePlayerStore((s) => s.lyricsOffsetMs);
  const setLyricsOffset = usePlayerStore((s) => s.setLyricsOffset);
  const timeMs = usePlayerStore((s) => s.timeMs);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const syncPickMode = usePlayerStore((s) => s.syncPickMode);
  const setSyncPickMode = usePlayerStore((s) => s.setSyncPickMode);

  const lyricTimeMs = Math.max(0, timeMs - lyricsOffsetMs);
  const canAutoSync = isPlaying || timeMs > 0;

  const [aiState, setAiState] = useState<{
    status: 'idle' | 'loading' | 'ok' | 'error';
    message?: string;
  }>({ status: 'idle' });

  const lastSaved = useRef(lyricsOffsetMs);
  useEffect(() => {
    if (lastSaved.current === lyricsOffsetMs) return;
    const timer = setTimeout(() => {
      const value = lyricsOffsetMs;
      api.songs
        .setOffset(songId, value)
        .then(() => {
          lastSaved.current = value;
        })
        .catch((err: Error) => console.warn('save offset failed:', err.message));
    }, 600);
    return () => clearTimeout(timer);
  }, [songId, lyricsOffsetMs]);

  useEffect(() => {
    lastSaved.current = lyricsOffsetMs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songId]);

  const formatted = formatOffset(lyricsOffsetMs);
  const showHint = !isPlaying && timeMs === 0;

  const handleAiSync = async () => {
    setAiState({ status: 'loading' });
    try {
      const res = await api.songs.autoSync(songId);
      setLyricsOffset(res.offsetMs);
      lastSaved.current = res.offsetMs; // server already saved it
      setAiState({
        status: 'ok',
        message: t('player.offset.ai.ok', { offset: formatOffset(res.offsetMs) }),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'auto-sync failed';
      setAiState({ status: 'error', message });
    }
  };

  return (
    <div className="panel p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs text-ink-dim mr-1">
          {t('player.offset.label')}:
        </span>
        <button
          onClick={handleAiSync}
          disabled={aiState.status === 'loading'}
          className="rounded-lg px-2.5 py-1 text-xs font-medium border border-brand/40 text-brand hover:bg-brand/10 transition disabled:opacity-50"
          title={t('player.offset.ai.help')}
        >
          {aiState.status === 'loading'
            ? t('player.offset.ai.loading')
            : t('player.offset.ai.start')}
        </button>
        <button
          onClick={() => setSyncPickMode(!syncPickMode)}
          disabled={!canAutoSync && !syncPickMode}
          className={
            syncPickMode
              ? 'rounded-lg px-2.5 py-1 text-xs font-medium bg-brand text-bg hover:bg-brand/90 transition'
              : 'rounded-lg px-2.5 py-1 text-xs font-medium border border-brand/40 text-brand hover:bg-brand/10 transition disabled:opacity-40 disabled:hover:bg-transparent'
          }
          title={t('player.offset.pick.help')}
        >
          {syncPickMode ? t('player.offset.pick.cancel') : t('player.offset.pick.start')}
        </button>
        <span className="mx-1 text-ink-dim/50">·</span>
        {STEPS_MS.map((step) => (
          <button
            key={step}
            onClick={() => setLyricsOffset(lyricsOffsetMs + step)}
            className="rounded-lg border border-bg-ring px-2.5 py-1 text-xs text-ink-muted hover:text-ink hover:bg-bg-soft transition tabular-nums"
            title={
              step > 0
                ? t('player.offset.later')
                : t('player.offset.earlier')
            }
          >
            {step > 0 ? '+' : '−'}
            {(Math.abs(step) / 1000).toFixed(Math.abs(step) % 1000 === 0 ? 0 : 1)}s
          </button>
        ))}
        <button
          onClick={() => setLyricsOffset(0)}
          disabled={lyricsOffsetMs === 0}
          className="rounded-lg border border-bg-ring px-2.5 py-1 text-xs text-ink-muted hover:text-ink hover:bg-bg-soft transition disabled:opacity-40"
        >
          {t('player.offset.reset')}
        </button>
        <span
          className={`ml-auto chip tabular-nums ${
            lyricsOffsetMs !== 0 ? 'bg-brand/15 text-brand border-brand/30' : ''
          }`}
          title={t('player.offset.current')}
        >
          {formatted}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-dim border-t border-bg-ring/60 pt-2">
        <span className="tabular-nums">
          {t('player.offset.audio')}: <span className="text-ink-muted">{formatTime(timeMs)}</span>
        </span>
        <span className="tabular-nums">
          {t('player.offset.lyric')}: <span className="text-ink-muted">{formatTime(lyricTimeMs)}</span>
        </span>
        {showHint && (
          <span className="text-amber-400/90">
            {t('player.offset.playFirst')}
          </span>
        )}
        <span className="ml-auto opacity-70 hidden sm:inline" title={t('player.offset.help')}>
          {t('player.offset.help.short')}
        </span>
      </div>

      {aiState.status !== 'idle' && aiState.status !== 'loading' && aiState.message && (
        <div
          className={
            aiState.status === 'ok'
              ? 'rounded-md text-[11px] px-2.5 py-1.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
              : 'rounded-md text-[11px] px-2.5 py-1.5 bg-rose-500/10 text-rose-300 border border-rose-500/30'
          }
        >
          {aiState.message}
        </div>
      )}
    </div>
  );
}

function formatOffset(ms: number): string {
  if (ms === 0) return '0.0s';
  const sign = ms > 0 ? '+' : '−';
  const abs = Math.abs(ms);
  return `${sign}${(abs / 1000).toFixed(1)}s`;
}
