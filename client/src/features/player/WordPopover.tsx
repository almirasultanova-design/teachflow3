import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { WordTranslation } from '@lyricling/shared';
import { api } from '../../lib/api';
import { useT } from '../../i18n';
import { useDictionaryStore } from '../../stores/dictionaryStore';
import { normalizeWord } from '../../lib/utils';

interface Props {
  word: string;
  /** Anchor element for positioning. */
  anchor: HTMLElement;
  lineId: number;
  songId: number;
  onClose: () => void;
}

export function WordPopover({ word, anchor, lineId, songId, onClose }: Props) {
  const t = useT();
  const [data, setData] = useState<WordTranslation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const wordKey = normalizeWord(word);
  const savedRecord = useDictionaryStore((s) =>
    wordKey.length > 0 ? s.words.find((w) => w.word.toLowerCase() === wordKey) : undefined,
  );
  const updateWord = useDictionaryStore((s) => s.update);
  const removeWord = useDictionaryStore((s) => s.remove);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.translate
      .word({ word, lineId, songId })
      .then((res) => {
        if (cancelled) return;
        setData(res);
        // Auto-save: every word the user looks up lands in the dictionary
        // immediately. The store deduplicates by lowercased word, so opening
        // the same popover again is a no-op.
        const key = normalizeWord(res.word) || res.word.toLowerCase();
        const already = useDictionaryStore.getState().words.some(
          (w) => w.word.toLowerCase() === key,
        );
        if (!already && key.length > 0) {
          void useDictionaryStore.getState().add({
            word: key,
            lemma: res.lemma,
            translation: res.translation,
            status: 'new',
            songId,
            lineId,
          });
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [word, lineId, songId]);

  useEffect(() => {
    const update = () => {
      const rect = anchor.getBoundingClientRect();
      const popH = popRef.current?.offsetHeight ?? 220;
      const popW = popRef.current?.offsetWidth ?? 320;

      const spaceBelow = window.innerHeight - rect.bottom;
      const placeAbove = spaceBelow < popH + 12 && rect.top > popH + 12;

      const top = placeAbove ? rect.top - popH - 8 : rect.bottom + 8;
      let left = rect.left + rect.width / 2 - popW / 2;
      const margin = 8;
      left = Math.max(margin, Math.min(left, window.innerWidth - popW - margin));
      setPos({ top, left });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchor, data, loading]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        popRef.current &&
        !popRef.current.contains(e.target as Node) &&
        !anchor.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, anchor]);

  const setStatus = async (status: 'new' | 'learning' | 'known') => {
    if (!savedRecord) return;
    try {
      await updateWord(savedRecord.id, { status });
    } catch {
      /* ignore */
    }
  };

  const removeFromDict = async () => {
    if (!savedRecord) return;
    try {
      await removeWord(savedRecord.id);
    } catch {
      /* ignore */
    }
  };

  if (!pos) return null;

  return createPortal(
    <div
      ref={popRef}
      style={{ top: pos.top, left: pos.left }}
      className="fixed z-50 w-[320px] panel shadow-glow p-4 animate-fade-up"
    >
      {loading && (
        <div className="flex items-center gap-2 text-ink-muted text-sm">
          <span className="h-2 w-2 rounded-full bg-brand animate-pulse-soft" />
          {t('word.loading')}
        </div>
      )}
      {error && <div className="text-rose-400 text-sm">{error}</div>}
      {data && (
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <div className="font-display text-xl font-semibold">{data.word}</div>
              {data.ipa && <div className="text-xs text-ink-dim">/{data.ipa}/</div>}
            </div>
            <div className="flex items-center gap-1">
              {data.partOfSpeech && (
                <span className="chip">{data.partOfSpeech}</span>
              )}
              {data.slang && <span className="chip border-brand-accent/40 text-brand-accent">{t('word.slang')}</span>}
            </div>
          </div>

          <div className="mt-2 text-base text-ink">{data.translation}</div>

          {data.explanation && (
            <p className="mt-2 text-sm text-ink-muted">{data.explanation}</p>
          )}

          {data.alternatives && data.alternatives.length > 0 && (
            <div className="mt-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-dim mb-1">
                {t('word.alternatives')}
              </div>
              <div className="flex flex-wrap gap-1">
                {data.alternatives.map((alt) => (
                  <span key={alt} className="chip">
                    {alt}
                  </span>
                ))}
              </div>
            </div>
          )}

          {data.examples && data.examples.length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-dim">
                {t('word.examples')}
              </div>
              {data.examples.map((ex, i) => (
                <div key={i} className="rounded-lg bg-bg-soft px-3 py-2 text-sm">
                  <div className="text-ink">{ex.en}</div>
                  <div className="text-ink-muted text-xs">{ex.ru}</div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-bg-ring/60">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-ink-dim">
                {savedRecord ? t('word.inDict') : t('word.saving')}
              </span>
              <div className="flex items-center gap-1">
                <StatusButton
                  active={savedRecord?.status === 'new'}
                  onClick={() => setStatus('new')}
                  label={t('dict.status.new')}
                />
                <StatusButton
                  active={savedRecord?.status === 'learning'}
                  onClick={() => setStatus('learning')}
                  label={t('dict.status.learning')}
                />
                <StatusButton
                  active={savedRecord?.status === 'known'}
                  onClick={() => setStatus('known')}
                  label={t('dict.status.known')}
                />
                <button
                  onClick={removeFromDict}
                  disabled={!savedRecord}
                  title={t('dict.delete')}
                  className="ml-1 rounded-md px-2 py-1 text-xs text-ink-dim hover:text-rose-300 disabled:opacity-30"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

function StatusButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? 'rounded-md bg-brand text-bg px-2 py-1 text-xs font-medium'
          : 'rounded-md border border-bg-ring text-ink-muted px-2 py-1 text-xs hover:text-ink hover:bg-bg-soft'
      }
    >
      {label}
    </button>
  );
}
