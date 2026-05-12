import { NavLink, Link, useNavigate } from 'react-router-dom';
import { Logo } from './Logo';
import { Avatar } from './Avatar';
import { useLocaleStore, useT } from '../i18n';
import { cn } from '../lib/utils';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

export function Header() {
  const t = useT();
  const navigate = useNavigate();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [openai, setOpenai] = useState<boolean | null>(null);

  useEffect(() => {
    api.health().then((h) => setOpenai(h.openai)).catch(() => setOpenai(null));
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-bg-ring/60 bg-bg/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link to="/" className="flex items-center gap-3 group">
          <Logo size={32} />
          <div className="leading-tight">
            <div className="font-display text-xl font-bold tracking-tight bg-gradient-to-r from-brand to-brand-glow bg-clip-text text-transparent">
              TeachFlow
            </div>
            <div className="text-[11px] text-ink-dim group-hover:text-ink-muted transition-colors">
              {t('app.tagline')}
            </div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1 ml-4">
          <NavItem to="/">{t('nav.home')}</NavItem>
          <NavItem to="/library">{t('nav.library')}</NavItem>
          <NavItem to="/dictionary">{t('nav.dictionary')}</NavItem>
          <NavItem to="/progress">{t('nav.progress')}</NavItem>
          <NavItem to="/profile">{t('nav.profile')}</NavItem>
          {user?.role === 'teacher' && (
            <NavItem to="/students">{t('nav.students')}</NavItem>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {openai !== null && (
            <span
              className={cn(
                'hidden sm:inline-flex chip',
                openai ? 'border-brand/40 text-brand' : 'border-amber-500/40 text-amber-300',
              )}
              title={openai ? t('common.openaiOn') : t('common.openaiOff')}
            >
              <span className={cn('mr-1 inline-block h-1.5 w-1.5 rounded-full',
                openai ? 'bg-brand animate-pulse-soft' : 'bg-amber-400')} />
              {openai ? 'OpenAI' : 'Mock'}
            </span>
          )}
          <div className="flex items-center rounded-xl border border-bg-ring overflow-hidden text-xs">
            <button
              onClick={() => setLocale('ru')}
              className={cn(
                'px-2.5 py-1.5 transition-colors',
                locale === 'ru' ? 'bg-bg-soft text-ink' : 'text-ink-dim hover:text-ink',
              )}
            >
              RU
            </button>
            <button
              onClick={() => setLocale('en')}
              className={cn(
                'px-2.5 py-1.5 transition-colors',
                locale === 'en' ? 'bg-bg-soft text-ink' : 'text-ink-dim hover:text-ink',
              )}
            >
              EN
            </button>
          </div>
          {user && (
            <div className="flex items-center gap-2">
              <Link
                to="/profile"
                className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 hover:bg-bg-soft transition-colors group"
                title={t('nav.profile')}
              >
                <Avatar seed={user.email} name={user.displayName ?? user.email} size={32} />
                <span
                  className="hidden sm:inline-block max-w-[140px] truncate text-xs text-ink-dim group-hover:text-ink"
                >
                  {user.displayName || user.email}
                </span>
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-xl border border-bg-ring px-3 py-1.5 text-xs text-ink-muted hover:text-ink hover:bg-bg-soft transition-colors"
              >
                {t('auth.logout')}
              </button>
            </div>
          )}
        </div>
      </div>

      <nav className="md:hidden flex items-center gap-1 px-4 pb-3 overflow-x-auto">
        <NavItem to="/">{t('nav.home')}</NavItem>
        <NavItem to="/library">{t('nav.library')}</NavItem>
        <NavItem to="/dictionary">{t('nav.dictionary')}</NavItem>
        <NavItem to="/progress">{t('nav.progress')}</NavItem>
        <NavItem to="/profile">{t('nav.profile')}</NavItem>
        {user?.role === 'teacher' && (
          <NavItem to="/students">{t('nav.students')}</NavItem>
        )}
      </nav>
    </header>
  );
}

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
          isActive ? 'bg-bg-soft text-ink' : 'text-ink-muted hover:text-ink hover:bg-bg-soft/60',
        )
      }
    >
      {children}
    </NavLink>
  );
}
