import { useEffect, useMemo, useState } from 'react';
import type { SavedWord, WordStatus, WordTranslation } from '@lyricling/shared';
import { useDictionaryStore } from '../../stores/dictionaryStore';
import { useT, type DictKey } from '../../i18n';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';

const STATUSES: WordStatus[] = ['new', 'learning', 'known'];

export function DictionaryPage() {
  const t = useT();
  const words = useDictionaryStore((s) => s.words);
  const load = useDictionaryStore((s) => s.load);
  const update = useDictionaryStore((s) => s.update);
  const remove = useDictionaryStore((s) => s.remove);

  const [details, setDetails] = useState<Record<string, WordTranslation | null>>({});

  useEffect(() => {
    load();
  }, [load]);

  // Lazy-load richer card content (POS / IPA / examples) from the cache so we
  // don't burn OpenAI tokens. Only words we haven't fetched yet are queried.
  useEffect(() => {
    const missing = Array.from(
      new Set(
        words
          .map((w) => w.word.toLowerCase())
          .filter((w) => details[w] === undefined),
      ),
    );
    if (missing.length === 0) return;
    let cancelled = false;
    api.translate
      .lookupBatch(missing)
      .then((batch) => {
        if (cancelled) return;
        setDetails((prev) => ({ ...prev, ...batch }));
      })
      .catch(() => {
        // mark all as null so we don't retry forever
        setDetails((prev) => {
          const next = { ...prev };
          for (const w of missing) if (next[w] === undefined) next[w] = null;
          return next;
        });
      });
    return () => {
      cancelled = true;
    };
  }, [words, details]);

  if (words.length === 0) {
    return (
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight mb-6">{t('dict.title')}</h1>
        <div className="panel p-10 text-center text-ink-muted">{t('dict.empty')}</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold tracking-tight mb-2">{t('dict.title')}</h1>
      <p className="text-sm text-ink-muted mb-6">{t('dict.subtitle', { n: words.length })}</p>

      <div className="grid gap-4 lg:grid-cols-2">
        {words.map((w) => (
          <WordCard
            key={w.id}
            word={w}
            details={details[w.word.toLowerCase()]}
            onStatus={(status) => update(w.id, { status })}
            onReview={() => update(w.id, { reviewed: true })}
            onRemove={() => remove(w.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface CardProps {
  word: SavedWord;
  details: WordTranslation | null | undefined;
  onStatus: (s: WordStatus) => void;
  onReview: () => void;
  onRemove: () => void;
}

function WordCard({ word, details, onStatus, onReview, onRemove }: CardProps) {
  const t = useT();
  const pos = (details?.partOfSpeech ?? '').toLowerCase();
  const ipa = details?.ipa ?? '';
  const explanation = details?.explanation ?? '';
  const examples = useMemo(
    () => (details?.examples ?? []).slice(0, 3).filter((e) => e?.en && e?.ru),
    [details],
  );
  const alternatives = useMemo(
    () => (details?.alternatives ?? []).filter((a) => a && a !== details?.translation).slice(0, 4),
    [details],
  );
  const rule = useMemo(() => grammarRule(pos, t), [pos, t]);

  return (
    <div className="panel p-5">
      <div className="flex items-baseline gap-3 flex-wrap">
        <div className="font-display text-2xl font-bold">{word.word}</div>
        {ipa && <div className="text-sm text-ink-dim">/{ipa}/</div>}
        {pos && <span className="chip text-[10px] uppercase tracking-wider">{posLabel(pos, t)}</span>}
        {details?.slang && <span className="chip text-[10px] text-amber-300 border-amber-500/40">slang</span>}
      </div>

      <div className="mt-1 text-lg text-ink">
        <span className="text-ink-muted">→</span> {word.translation}
      </div>

      {alternatives.length > 0 && (
        <div className="mt-1 text-xs text-ink-dim">
          {t('dict.alternatives')}: {alternatives.join(', ')}
        </div>
      )}

      {explanation && (
        <div className="mt-3 text-sm text-ink-muted leading-relaxed">{explanation}</div>
      )}

      {rule && (
        <div className="mt-3 text-xs text-ink-muted bg-bg-soft/60 rounded-lg px-3 py-2 border border-bg-ring/60">
          <span className="font-semibold text-ink-muted">{t('dict.rule')}:</span> {rule}
        </div>
      )}

      {examples.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-dim mb-1">
            {t('dict.examples')}
          </div>
          <ul className="space-y-1.5 text-sm">
            {examples.map((ex, i) => (
              <li key={i} className="leading-snug">
                <div className="text-ink">{ex.en}</div>
                <div className="text-ink-dim text-xs">{ex.ru}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(word.songTitle || word.lineText) && (
        <div className="mt-3 text-xs text-ink-dim border-t border-bg-ring/40 pt-3">
          {word.songTitle && (
            <div>
              {t('dict.fromSong')}: <span className="text-ink-muted">{word.songTitle}</span>
            </div>
          )}
          {word.lineText && <div className="italic mt-0.5">«{word.lineText}»</div>}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => onStatus(s)}
              className={cn(
                'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                word.status === s
                  ? statusActiveCls(s)
                  : 'border border-bg-ring text-ink-dim hover:text-ink hover:bg-bg-soft',
              )}
            >
              {t(`dict.status.${s}` as DictKey)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {word.reviewCount > 0 && (
            <span className="text-[11px] text-ink-dim mr-1">×{word.reviewCount}</span>
          )}
          <button onClick={onReview} className="btn-ghost text-xs px-2 py-1">
            {t('dict.review')}
          </button>
          <button
            onClick={onRemove}
            className="btn-ghost text-xs px-2 py-1 text-rose-400 hover:text-rose-300"
          >
            {t('dict.delete')}
          </button>
        </div>
      </div>
    </div>
  );
}

function statusActiveCls(s: WordStatus) {
  if (s === 'new') return 'bg-brand/20 text-brand border border-brand/40';
  if (s === 'learning') return 'bg-amber-500/15 text-amber-200 border border-amber-500/40';
  return 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/40';
}

function posLabel(pos: string, t: ReturnType<typeof useT>): string {
  const key = `dict.pos.${pos}` as DictKey;
  const fallbackKey = 'dict.pos.other' as DictKey;
  // i18n returns the key as-is when missing; treat that as "fallback to other".
  const tr = t(key);
  return tr === key ? t(fallbackKey) : tr;
}

const POS_WITH_RULES = new Set([
  'noun',
  'verb',
  'adjective',
  'adverb',
  'preposition',
  'pronoun',
  'conjunction',
  'interjection',
  'phrase',
]);

function grammarRule(pos: string, t: ReturnType<typeof useT>): string {
  if (!POS_WITH_RULES.has(pos)) return '';
  const key = `dict.rule.${pos}` as DictKey;
  const tr = t(key);
  return tr === key ? '' : tr;
}
