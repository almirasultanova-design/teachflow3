import { create } from 'zustand';
import type { SavedWord } from '@lyricling/shared';
import { api } from '../lib/api';

interface DictState {
  words: SavedWord[];
  loaded: boolean;
  loading: boolean;
  load: () => Promise<void>;
  add: (input: Parameters<typeof api.progress.saveWord>[0]) => Promise<SavedWord>;
  update: (id: number, patch: Parameters<typeof api.progress.updateWord>[1]) => Promise<void>;
  remove: (id: number) => Promise<void>;
  isSaved: (word: string) => boolean;
}

export const useDictionaryStore = create<DictState>((set, get) => ({
  words: [],
  loaded: false,
  loading: false,

  load: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    try {
      const words = await api.progress.words();
      set({ words, loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  add: async (input) => {
    const saved = await api.progress.saveWord(input);
    set((s) => {
      const others = s.words.filter((w) => w.id !== saved.id && w.word !== saved.word);
      return { words: [saved, ...others] };
    });
    return saved;
  },

  update: async (id, patch) => {
    const updated = await api.progress.updateWord(id, patch);
    set((s) => ({ words: s.words.map((w) => (w.id === id ? updated : w)) }));
  },

  remove: async (id) => {
    await api.progress.deleteWord(id);
    set((s) => ({ words: s.words.filter((w) => w.id !== id) }));
  },

  isSaved: (word) => {
    const lower = word.toLowerCase();
    return get().words.some((w) => w.word.toLowerCase() === lower);
  },
}));
