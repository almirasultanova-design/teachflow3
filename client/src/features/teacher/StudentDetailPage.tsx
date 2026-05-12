import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { StudentDetail } from '@lyricling/shared';
import { api } from '../../lib/api';
import { useT } from '../../i18n';
import { Avatar } from '../../components/Avatar';

export function StudentDetailPage() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<StudentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.teacher
      .student(Number(id))
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [id]);

  if (error) return <div className="text-rose-400">{t('common.error', { message: error })}</div>;
  if (!data) return <div className="text-ink-dim">{t('common.loading')}</div>;

  const name = data.displayName || data.email.split('@')[0];

  return (
    <div>
      <div className="mb-6">
        <Link to="/students" className="btn-ghost text-sm">← {t('teacher.detail.back')}</Link>
        <div className="mt-3 flex items-center gap-4">
          <Avatar seed={data.email} name={name} size={56} />
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">{name}</h1>
            <div className="text-sm text-ink-dim">{data.email}</div>
            <div className="text-xs text-ink-dim mt-0.5">
              {t('teacher.detail.joined')}: {new Date(data.createdAt).toLocaleDateString()}
              {data.lastActiveAt && (
                <> · {t('teacher.detail.lastActive')}: {new Date(data.lastActiveAt).toLocaleString()}</>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-8">
        <Stat label={t('progress.streak')} value={`${data.streakDays}🔥`} />
        <Stat label={t('progress.listened')} value={data.listenedSongs} />
        <Stat label={t('progress.songs')} value={data.totalSongs} />
        <Stat label={t('progress.words')} value={data.savedWords} />
        <Stat label={t('progress.attempts')} value={data.quizAttempts} />
        <Stat
          label={t('progress.avg')}
          value={`${Math.round(data.avgQuizRatio * 100)}%`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="font-display text-xl font-semibold mb-3">{t('teacher.detail.recentAttempts')}</h2>
          {data.recentAttempts.length === 0 ? (
            <div className="panel p-6 text-ink-muted">{t('progress.noAttempts')}</div>
          ) : (
            <div className="panel divide-y divide-bg-ring/60">
              {data.recentAttempts.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-4">
                  <div>
                    <div className="font-medium">{a.songTitle}</div>
                    <div className="text-xs text-ink-dim">
                      {new Date(a.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-lg">
                      {Math.round((a.score / a.total) * 100)}%
                    </div>
                    <div className="text-xs text-ink-dim">{a.score} / {a.total}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold mb-3">{t('teacher.detail.recentWords')}</h2>
          {data.recentWords.length === 0 ? (
            <div className="panel p-6 text-ink-muted">{t('dict.empty')}</div>
          ) : (
            <div className="panel divide-y divide-bg-ring/60">
              {data.recentWords.map((w) => (
                <div key={w.id} className="flex items-baseline justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {w.word} <span className="text-ink-dim">→ {w.translation}</span>
                    </div>
                    {w.songTitle && (
                      <div className="text-xs text-ink-dim truncate">{w.songTitle}</div>
                    )}
                  </div>
                  <span className="chip shrink-0">
                    {t(
                      w.status === 'new'
                        ? 'dict.status.new'
                        : w.status === 'learning'
                          ? 'dict.status.learning'
                          : 'dict.status.known',
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {data.readyForQuiz.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold mb-3">{t('progress.ready.title')}</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.readyForQuiz.map((s) => (
              <div key={s.id} className="panel p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{s.title}</div>
                  <div className="text-xs text-ink-dim truncate">
                    {s.artist} · {t('progress.ready.listens', { n: s.listenCount })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="panel p-4">
      <div className="text-xs uppercase tracking-wider text-ink-dim">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold bg-gradient-to-r from-brand to-brand-glow bg-clip-text text-transparent">
        {value}
      </div>
    </div>
  );
}
