import { useEffect, useRef, useState } from 'react';
import type { LyricLine } from '@lyricling/shared';
import { LyricLineRow } from './LyricLineRow';
import { useActiveLine } from '../../hooks/useActiveLine';
import { usePlayerStore } from '../../stores/playerStore';
import { transport } from './TransportBar';
import { LineTranslationPanel } from './LineTranslationPanel';
import { useT } from '../../i18n';

interface Props {
  songId: number;
  lines: LyricLine[];
  /** When true, seeking is performed by setting the virtual clock directly. */
  virtual?: boolean;
}

export function LyricsView({ songId, lines, virtual = false }: Props) {
  const t = useT();
  const timeMs = usePlayerStore((s) => s.timeMs);
  const showTranslations = usePlayerStore((s) => s.showTranslations);
  const lyricsOffsetMs = usePlayerStore((s) => s.lyricsOffsetMs);
  const syncPickMode = usePlayerStore((s) => s.syncPickMode);
  const setLyricsOffset = usePlayerStore((s) => s.setLyricsOffset);
  const setSyncPickMode = usePlayerStore((s) => s.setSyncPickMode);
  const setTime = usePlayerStore((s) => s.setTime);

  // Lyric times are relative to the song; the audio source may have an intro,
  // so we shift the playhead by the configured offset before resolving the
  // active line. seek() does the inverse: maps a lyric time back to audio time.
  const lyricTimeMs = timeMs - lyricsOffsetMs;
  const activeIdx = useActiveLine(lines, lyricTimeMs);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selectedLine, setSelectedLine] = useState<LyricLine | null>(null);

  // Allow ESC to cancel sync-pick mode.
  useEffect(() => {
    if (!syncPickMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSyncPickMode(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [syncPickMode, setSyncPickMode]);

  const pickLineAsNow = (line: LyricLine) => {
    // The clicked line is the one the user is hearing right now. The audio
    // playhead is at `timeMs`; the LRC says this line starts at line.startMs.
    // So the lyrics are running ahead/behind by exactly (timeMs - line.startMs).
    setLyricsOffset(timeMs - line.startMs);
    setSyncPickMode(false);
  };

  useEffect(() => {
    if (activeIdx < 0) return;
    const container = containerRef.current;
    if (!container) return;
    const el = container.querySelector<HTMLElement>(`[data-line-id="${lines[activeIdx].id}"]`);
    if (!el) return;
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const offset = eRect.top - cRect.top - cRect.height / 2 + eRect.height / 2;
    container.scrollBy({ top: offset, behavior: 'smooth' });
  }, [activeIdx, lines]);

  const seek = (lyricMs: number) => {
    const audioMs = Math.max(0, lyricMs + lyricsOffsetMs);
    if (virtual) setTime(audioMs);
    else transport('seek', audioMs);
  };

  if (!lines.length) {
    return <div className="text-ink-dim">{t('player.noLines')}</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
      <div
        ref={containerRef}
        className={`panel max-h-[60vh] overflow-y-auto p-2 sm:p-3 ${
          syncPickMode ? 'ring-2 ring-brand/50' : ''
        }`}
      >
        {syncPickMode && (
          <div className="sticky top-0 z-10 mb-2 rounded-lg bg-brand/15 border border-brand/40 px-3 py-2 text-xs text-brand backdrop-blur">
            {t('player.offset.pick.banner')}{' '}
            <button
              onClick={() => setSyncPickMode(false)}
              className="ml-2 underline hover:no-underline"
            >
              {t('player.offset.pick.cancel')} (Esc)
            </button>
          </div>
        )}
        <div className="space-y-1">
          {lines.map((line, i) => (
            <LyricLineRow
              key={line.id}
              line={line}
              songId={songId}
              active={i === activeIdx}
              showTranslation={showTranslations}
              onLineClick={() => setSelectedLine(line)}
              onSeek={seek}
              onPick={syncPickMode ? () => pickLineAsNow(line) : undefined}
            />
          ))}
        </div>
      </div>

      <aside className="space-y-3">
        {selectedLine ? (
          <LineTranslationPanel line={selectedLine} onClose={() => setSelectedLine(null)} />
        ) : (
          <div className="panel p-5 text-sm text-ink-muted">
            <div className="font-medium text-ink mb-1">{t('player.lineTranslation')}</div>
            <p>
              Кликни по строке — здесь появится литературный и дословный перевод, разбор сленга и идиом.
              Двойной клик по строке — перемотка к ней.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
