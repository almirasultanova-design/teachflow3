import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useT, type DictKey } from '../../i18n';
import { useAuthStore } from '../../stores/authStore';
import { Avatar } from '../../components/Avatar';

interface Summary {
  words: Record<string, number>;
  totalSongs: number;
  listenedSongs: number;
  totalListens: number;
  quizAttempts: number;
  avgQuizRatio: number;
  streakDays: number;
}

export function ProfilePage() {
  const t = useT();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    api.progress.summary().then(setSummary).catch(() => null);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  if (!user) return null;

  const name = user.displayName || user.email.split('@')[0];
  const wordsTotal = summary
    ? (summary.words.new ?? 0) + (summary.words.learning ?? 0) + (summary.words.known ?? 0)
    : 0;

  const isTeacher = user.role === 'teacher';

  return (
    <div>
      <h1 className="font-display text-3xl font-bold tracking-tight mb-6">
        {t('profile.title')}
      </h1>

      <section className="panel p-6 sm:p-8 mb-6 bg-gradient-to-br from-brand/10 via-bg-panel to-bg-panel relative overflow-hidden">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-brand/20 blur-3xl pointer-events-none" />
        <div className="relative flex items-center gap-5 flex-wrap">
          <Avatar seed={user.email} name={name} size={96} />
          <div className="min-w-0">
            <div className="font-display text-2xl font-bold tracking-tight">{name}</div>
            <div className="text-ink-muted text-sm">{user.email}</div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="chip text-xs">
                {t(`profile.role.${user.role}` as DictKey)}
              </span>
              {summary && summary.streakDays > 0 && (
                <span className="chip text-xs text-amber-200 border-amber-500/40">
                  🔥 {summary.streakDays} {t('profile.streak')}
                </span>
              )}
            </div>
          </div>
          <div className="ml-auto">
            <button
              onClick={handleLogout}
              className="rounded-xl border border-bg-ring px-4 py-2 text-sm text-ink-muted hover:text-ink hover:bg-bg-soft transition-colors"
            >
              {t('auth.logout')}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Stat label={t('profile.stat.words')} value={wordsTotal} />
        <Stat label={t('profile.stat.listened')} value={summary?.listenedSongs ?? 0} />
        <Stat label={t('profile.stat.attempts')} value={summary?.quizAttempts ?? 0} />
        <Stat
          label={t('profile.stat.avg')}
          value={`${Math.round((summary?.avgQuizRatio ?? 0) * 100)}%`}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <NavTile
          to="/library"
          icon="🎵"
          title={t('profile.tile.library.title')}
          desc={t('profile.tile.library.desc')}
        />
        <NavTile
          to="/dictionary"
          icon="📖"
          title={t('profile.tile.dict.title')}
          desc={t('profile.tile.dict.desc')}
        />
        <NavTile
          to="/progress"
          icon="📈"
          title={t('profile.tile.progress.title')}
          desc={t('profile.tile.progress.desc')}
        />
        {isTeacher && (
          <NavTile
            to="/students"
            icon="👩‍🏫"
            title={t('profile.tile.students.title')}
            desc={t('profile.tile.students.desc')}
          />
        )}
      </section>
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

function NavTile({
  to,
  icon,
  title,
  desc,
}: {
  to: string;
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="panel p-5 hover:border-brand/50 hover:bg-bg-soft/40 transition-all hover:-translate-y-0.5"
    >
      <div className="text-2xl mb-2">{icon}</div>
      <div className="font-display text-lg font-semibold text-ink">{title}</div>
      <p className="mt-1 text-sm text-ink-muted leading-relaxed">{desc}</p>
    </Link>
  );
}
