import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ru } from './ru';
import { en } from './en';

export type Locale = 'ru' | 'en';

const dictionaries = { ru, en };
export type DictKey = keyof typeof ru;

interface LocaleState {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: 'ru',
      setLocale: (locale) => set({ locale }),
    }),
    { name: 'techflow.locale' },
  ),
);

export function useT(): (key: DictKey, vars?: Record<string, string | number>) => string {
  const locale = useLocaleStore((s) => s.locale);
  const dict = dictionaries[locale] as Record<string, string>;
  return (key, vars) => {
    let str = dict[key] ?? (en as Record<string, string>)[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return str;
  };
}
