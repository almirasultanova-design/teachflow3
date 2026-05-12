import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { QuizAttempt } from '@lyricling/shared';
import { api } from '../../lib/api';
import { useT } from '../../i18n';
import { Avatar } from '../../components/Avatar';
import { useAuthStore } from '../../stores/authStore';

interface ReadyForQuiz {
  id: number;
  title: string;
  artist: string;
  listenCount: number;
  lastListenedAt: string;
}

interface Summary {
  words: Record<string, number>;
  totalSongs: number;
  listenedSongs: number;
  totalListens: number;
  quizAttempts: number;
  avgQuizRatio: number;
  streakDays: number;
  readyForQuiz: ReadyForQuiz[];
}

export function ProgressPage() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);

  useEffect(() => {
    api.progress.summary().then(setSummary).catch(() => null);
    api.quiz.attempts().then(setAttempts).catch(() => null);
  }, []);

  const wordsTotal = summary
    ? (summary.words.new ?? 0) + (summary.words.learning ?? 0) + (summary.words.known ?? 0)
    : 0;

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        {user && <Avatar seed={user.email} name={user.displayName ?? user.email} size={56} />}
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">{t('progress.title')}</h1>
          {user && (
            <div className="text-sm text-ink-dim">
              {user.displayName || user.email}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-6">
        <Stat label={t('progress.streak')} value={`${summary?.streakDays ?? 0}🔥`} />
        <Stat label={t('progress.listened')} value={summary?.listenedSongs ?? 0} />
        <Stat label={t('progress.songs')} value={summary?.totalSongs ?? 0} />
        <Stat label={t('progress.words')} value={wordsTotal} />
        <Stat label={t('progress.attempts')} value={summary?.quizAttempts ?? 0} />
        <Stat
          label={t('progress.avg')}
          value={`${Math.round((summary?.avgQuizRatio ?? 0) * 100)}%`}
        />
      </div>

      {summary && summary.readyForQuiz.length > 0 && (
        <section className="mb-6">
          <h2 className="font-display text-xl font-semibold mb-1">{t('progress.ready.title')}</h2>
          <p className="text-sm text-ink-muted mb-3">{t('progress.ready.subtitle')}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {summary.readyForQuiz.map((s) => (
              <div
                key={s.id}
                className="panel p-4 flex items-center justify-between gap-3 hover:border-brand/40 transition-colors"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{s.title}</div>
                  <div className="text-xs text-ink-dim truncate">
                    {s.artist} · {t('progress.ready.listens', { n: s.listenCount })}
                  </div>
                </div>
                <Link to={`/songs/${s.id}/quiz`} className="btn-primary shrink-0">
                  {t('progress.ready.cta')}
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      <h2 className="font-display text-xl font-semibold mb-3">{t('progress.recent')}</h2>
      {attempts.length === 0 ? (
        <div className="panel p-6 text-ink-muted">{t('progress.noAttempts')}</div>
      ) : (
        <div className="panel divide-y divide-bg-ring/60">
          {attempts.map((a) => (
            <div key={a.id} className="flex items-center justify-between p-4">
              <div>
                <div className="font-medium">{a.songTitle}</div>
                <div className="text-xs text-ink-dim">{new Date(a.createdAt).toLocaleString()}</div>
              </div>
              <div className="text-right">
                <div className="font-display text-lg">
                  {Math.round((a.score / a.total) * 100)}%
                </div>
                <div className="text-xs text-ink-dim">
                  {a.score} / {a.total}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="panel p-4">
      <div className="text-xs uppercase tracking-wider text-ink-dim">{label}</div>
      <div className="mt-1 font-display text-3xl font-bold bg-gradient-to-r from-brand to-brand-glow bg-clip-text text-transparent">
        {value}
      </div>
    </div>
  );
}
