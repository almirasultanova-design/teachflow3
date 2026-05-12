import { useMemo, useRef, useState } from 'react';
import type { LyricLine } from '@lyricling/shared';
import { tokenizeLine, normalizeWord, cn } from '../../lib/utils';
import { WordPopover } from './WordPopover';
import { useDictionaryStore } from '../../stores/dictionaryStore';

interface Props {
  line: LyricLine;
  songId: number;
  active: boolean;
  showTranslation: boolean;
  onLineClick: () => void;
  onSeek: (ms: number) => void;
  /**
   * If provided, any click anywhere inside the row is intercepted and
   * forwarded to this handler instead of triggering the regular open /
   * word popover behavior. Used by the "tap to sync" mode.
   */
  onPick?: () => void;
}

export function LyricLineRow({
  line,
  songId,
  active,
  showTranslation,
  onLineClick,
  onSeek,
  onPick,
}: Props) {
  const tokens = useMemo(() => tokenizeLine(line.text), [line.text]);
  const [popoverWord, setPopoverWord] = useState<{ word: string; anchor: HTMLElement } | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  const savedWords = useDictionaryStore((s) => s.words);
  const savedSet = useMemo(
    () => new Set(savedWords.map((w) => w.word.toLowerCase())),
    [savedWords],
  );

  const handleWordClick = (e: React.MouseEvent<HTMLSpanElement>, word: string) => {
    e.stopPropagation();
    setPopoverWord({ word, anchor: e.currentTarget });
  };

  return (
    <div
      ref={ref}
      data-line-id={line.id}
      className={cn(
        'group rounded-xl px-4 py-3 transition-all cursor-pointer',
        onPick && 'ring-1 ring-brand/40 hover:ring-brand hover:bg-brand/10 cursor-crosshair',
        active
          ? 'bg-bg-panel/90 border border-bg-ring shadow-glow'
          : 'border border-transparent hover:bg-bg-soft/40',
      )}
      onClickCapture={(e) => {
        if (!onPick) return;
        e.preventDefault();
        e.stopPropagation();
        onPick();
      }}
      onClick={onLineClick}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onSeek(line.startMs);
      }}
    >
      <div
        className={cn(
          'font-display leading-relaxed transition-all',
          active ? 'text-2xl text-ink' : 'text-lg text-ink-muted group-hover:text-ink',
        )}
      >
        {tokens.map((tok, i) => {
          if (tok.type === 'sep') return <span key={i}>{tok.value}</span>;
          const norm = normalizeWord(tok.value);
          const saved = norm.length > 0 && savedSet.has(norm);
          return (
            <span
              key={i}
              className={cn('lyric-word', saved && 'is-saved')}
              onClick={(e) => handleWordClick(e, tok.value)}
            >
              {tok.value}
            </span>
          );
        })}
      </div>

      {showTranslation && line.translation && (
        <div className={cn(
          'mt-1 text-sm transition-colors',
          active ? 'text-brand/90' : 'text-ink-dim group-hover:text-ink-muted',
        )}>
          {line.translation}
        </div>
      )}

      {line.notes && active && (
        <div className="mt-2 text-xs text-ink-muted bg-bg-soft/60 rounded-md px-2 py-1.5 border border-bg-ring/60">
          {line.notes}
        </div>
      )}

      {popoverWord && (
        <WordPopover
          word={popoverWord.word}
          anchor={popoverWord.anchor}
          lineId={line.id}
          songId={songId}
          onClose={() => setPopoverWord(null)}
        />
      )}
    </div>
  );
}
