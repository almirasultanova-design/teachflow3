import { Link } from 'react-router-dom';
import { useT, type DictKey } from '../../i18n';

interface Tile {
  to: string;
  icon: React.ReactNode;
  titleKey: DictKey;
  descKey: DictKey;
}

export function HomePage() {
  const t = useT();

  const tiles: Tile[] = [
    {
      to: '/library',
      titleKey: 'home.tile.library.title',
      descKey: 'home.tile.library.desc',
      icon: <Icon path="M9 18V5l12-2v13M9 9l12-2M6 21a3 3 0 100-6 3 3 0 000 6zm15-3a3 3 0 100-6 3 3 0 000 6z" />,
    },
    {
      to: '/dictionary',
      titleKey: 'home.tile.dict.title',
      descKey: 'home.tile.dict.desc',
      icon: <Icon path="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />,
    },
    {
      to: '/progress',
      titleKey: 'home.tile.progress.title',
      descKey: 'home.tile.progress.desc',
      icon: <Icon path="M3 3v18h18M7 14l4-4 4 4 5-5" />,
    },
  ];

  return (
    <div>
      <section className="mb-8 panel p-7 sm:p-10 bg-gradient-to-br from-brand/15 via-bg-panel to-bg-panel relative overflow-hidden">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-brand/30 blur-3xl pointer-events-none" />
        <div className="relative max-w-2xl">
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight">
            {t('home.hero.title')}
          </h1>
          <p className="mt-3 text-lg text-ink-muted">{t('home.hero.subtitle')}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link to="/library" className="btn-primary">
              {t('home.cta.start')}
            </Link>
            <Link to="/dictionary" className="btn-outline">
              {t('home.cta.dict')}
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <Link
            key={tile.to}
            to={tile.to}
            className="panel p-5 hover:border-brand/50 hover:bg-bg-soft/40 transition-all hover:-translate-y-0.5"
          >
            <div className="h-10 w-10 rounded-lg bg-brand/15 text-brand flex items-center justify-center mb-3">
              {tile.icon}
            </div>
            <div className="font-display text-lg font-semibold text-ink">{t(tile.titleKey)}</div>
            <p className="mt-1 text-sm text-ink-muted leading-relaxed">{t(tile.descKey)}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}

function Icon({ path }: { path: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}
