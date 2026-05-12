import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { StudentSummary } from '@lyricling/shared';
import { api } from '../../lib/api';
import { useT } from '../../i18n';
import { Avatar } from '../../components/Avatar';

export function StudentsPage() {
  const t = useT();
  const [students, setStudents] = useState<StudentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api.teacher
      .students()
      .then(setStudents)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <div className="text-rose-400">{t('common.error', { message: error })}</div>;
  if (!students) return <div className="text-ink-dim">{t('common.loading')}</div>;

  const filtered = query.trim()
    ? students.filter((s) => {
        const q = query.toLowerCase();
        return (
          s.email.toLowerCase().includes(q) ||
          (s.displayName ?? '').toLowerCase().includes(q)
        );
      })
    : students;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {t('teacher.students.title')}
          </h1>
          <p className="text-ink-muted mt-1">
            {t('teacher.students.subtitle', { n: students.length })}
          </p>
        </div>
        <input
          className="input max-w-xs"
          placeholder={t('teacher.students.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="panel p-10 text-center text-ink-muted">
          {students.length === 0 ? t('teacher.students.empty') : t('teacher.students.noMatch')}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((s) => (
            <StudentCard key={s.id} s={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function StudentCard({ s }: { s: StudentSummary }) {
  const t = useT();
  const name = s.displayName || s.email.split('@')[0];
  return (
    <Link
      to={`/students/${s.id}`}
      className="panel p-4 hover:border-brand/50 hover:bg-bg-soft/40 transition-all"
    >
      <div className="flex items-center gap-4">
        <Avatar seed={s.email} name={name} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <div className="font-medium text-ink truncate">{name}</div>
            <div className="text-xs text-ink-dim truncate">{s.email}</div>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
            <span>🔥 {s.streakDays} {t('teacher.students.short.streak')}</span>
            <span>{s.listenedSongs} {t('teacher.students.short.listened')}</span>
            <span>{s.savedWords} {t('teacher.students.short.words')}</span>
            <span>{s.quizAttempts} {t('teacher.students.short.attempts')}</span>
            {s.quizAttempts > 0 && (
              <span>{Math.round(s.avgQuizRatio * 100)}% {t('teacher.students.short.avg')}</span>
            )}
            {s.lastActiveAt && (
              <span className="text-ink-dim ml-auto">
                {t('teacher.students.short.lastActive')}: {new Date(s.lastActiveAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
