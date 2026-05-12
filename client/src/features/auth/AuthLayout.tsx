import { Link } from 'react-router-dom';
import { Logo } from '../../components/Logo';
import { useLocaleStore } from '../../i18n';
import { cn } from '../../lib/utils';

interface Props {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: Props) {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between gap-3 mb-6">
          <Link to="/" className="flex items-center gap-3">
            <Logo size={36} />
            <span className="font-display text-2xl font-bold tracking-tight bg-gradient-to-r from-brand to-brand-glow bg-clip-text text-transparent">
              TeachFlow
            </span>
          </Link>
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
        </div>
        <div className="panel p-6 sm:p-8">
          <h1 className="font-display text-xl font-semibold text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-dim">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
        {footer && <div className="mt-4 text-center text-sm text-ink-dim">{footer}</div>}
      </div>
    </div>
  );
}
