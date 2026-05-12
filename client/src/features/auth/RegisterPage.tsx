import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useT } from '../../i18n';
import { AuthLayout } from './AuthLayout';

export function RegisterPage() {
  const t = useT();
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);
  const status = useAuthStore((s) => s.status);

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError(t('auth.error.passwordShort'));
      return;
    }
    setSubmitting(true);
    try {
      await register(email.trim(), password, displayName.trim() || undefined, role);
      navigate(role === 'teacher' ? '/students' : '/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title={t('auth.register.title')}
      subtitle={t('auth.register.subtitle')}
      footer={
        <span>
          {t('auth.register.haveAccount')}{' '}
          <Link to="/login" className="text-brand hover:underline">
            {t('auth.login.cta')}
          </Link>
        </span>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">{t('auth.role')}</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRole('student')}
              className={
                role === 'student'
                  ? 'rounded-xl border border-brand bg-brand/15 text-ink px-3 py-2 text-sm font-medium'
                  : 'rounded-xl border border-bg-ring text-ink-muted px-3 py-2 text-sm hover:text-ink'
              }
            >
              {t('auth.role.student')}
            </button>
            <button
              type="button"
              onClick={() => setRole('teacher')}
              className={
                role === 'teacher'
                  ? 'rounded-xl border border-brand bg-brand/15 text-ink px-3 py-2 text-sm font-medium'
                  : 'rounded-xl border border-bg-ring text-ink-muted px-3 py-2 text-sm hover:text-ink'
              }
            >
              {t('auth.role.teacher')}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">{t('auth.displayName')}</label>
          <input
            type="text"
            autoComplete="name"
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t('auth.displayName.placeholder')}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">{t('auth.email')}</label>
          <input
            type="email"
            autoComplete="email"
            required
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">{t('auth.password')}</label>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-ink-dim">{t('auth.password.hint')}</p>
        </div>
        {error && <div className="text-sm text-rose-400">{error}</div>}
        <button
          type="submit"
          className="btn-primary w-full"
          disabled={submitting || status === 'loading'}
        >
          {submitting ? t('common.loading') : t('auth.register.cta')}
        </button>
      </form>
    </AuthLayout>
  );
}
