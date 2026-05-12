import { useEffect, useState } from 'react';
import type { LineTranslation, LyricLine } from '@lyricling/shared';
import { api } from '../../lib/api';
import { useT } from '../../i18n';

interface Props {
  line: LyricLine;
  onClose: () => void;
}

export function LineTranslationPanel({ line, onClose }: Props) {
  const t = useT();
  const [data, setData] = useState<LineTranslation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.translate
      .line(line.id)
      .then((res) => {
        if (!cancelled) setData(res);
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
  }, [line.id]);

  return (
    <div className="panel p-5 animate-fade-up">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-ink-dim">
            {t('player.lineTranslation')}
          </div>
          <div className="font-display text-lg mt-0.5">{line.text}</div>
        </div>
        <button onClick={onClose} className="text-ink-dim hover:text-ink" aria-label={t('common.close')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {loading && <div className="mt-3 text-ink-muted text-sm">{t('player.loading')}</div>}
      {error && <div className="mt-3 text-rose-400 text-sm">{error}</div>}

      {data && (
        <div className="mt-4 space-y-3">
          <Row label={t('player.natural')}>{data.natural || '—'}</Row>
          <Row label={t('player.literal')}>{data.literal || '—'}</Row>
          {data.notes && <Row label={t('player.notes')}>{data.notes}</Row>}
          {data.slang && data.slang.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-ink-dim mb-2">
                {t('player.slang')}
              </div>
              <div className="space-y-2">
                {data.slang.map((s, i) => (
                  <div key={i} className="rounded-lg bg-bg-soft px-3 py-2 text-sm">
                    <span className="text-brand-accent font-medium">{s.phrase}</span>
                    <span className="text-ink-muted"> — {s.meaning}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-ink-dim">{label}</div>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}
