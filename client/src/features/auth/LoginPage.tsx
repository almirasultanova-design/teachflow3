import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useT } from '../../i18n';
import { AuthLayout } from './AuthLayout';

export function LoginPage() {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const login = useAuthStore((s) => s.login);
  const status = useAuthStore((s) => s.status);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title={t('auth.login.title')}
      subtitle={t('auth.login.subtitle')}
      footer={
        <span>
          {t('auth.login.noAccount')}{' '}
          <Link to="/register" className="text-brand hover:underline">
            {t('auth.register.cta')}
          </Link>
        </span>
      }
    >
      <form onSubmit={submit} className="space-y-3">
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
            autoComplete="current-password"
            required
            minLength={6}
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <div className="text-sm text-rose-400">{error}</div>}
        <button
          type="submit"
          className="btn-primary w-full"
          disabled={submitting || status === 'loading'}
        >
          {submitting ? t('common.loading') : t('auth.login.cta')}
        </button>
      </form>
    </AuthLayout>
  );
}
