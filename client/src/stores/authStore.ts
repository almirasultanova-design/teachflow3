import { create } from 'zustand';
import type { User } from '@lyricling/shared';
import { api, ApiError } from '../lib/api';

type Status = 'idle' | 'loading' | 'authenticated' | 'guest';

interface AuthState {
  user: User | null;
  status: Status;
  error: string | null;
  fetchMe: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    displayName?: string,
    role?: 'student' | 'teacher',
  ) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'idle',
  error: null,

  fetchMe: async () => {
    set({ status: 'loading' });
    try {
      const { user } = await api.auth.me();
      set({ user, status: 'authenticated', error: null });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        set({ user: null, status: 'guest', error: null });
      } else {
        set({ user: null, status: 'guest', error: err instanceof Error ? err.message : 'unknown' });
      }
    }
  },

  login: async (email, password) => {
    set({ status: 'loading', error: null });
    try {
      const { user } = await api.auth.login({ email, password });
      set({ user, status: 'authenticated', error: null });
    } catch (err) {
      set({ status: 'guest', error: err instanceof Error ? err.message : 'login failed' });
      throw err;
    }
  },

  register: async (email, password, displayName, role) => {
    set({ status: 'loading', error: null });
    try {
      const { user } = await api.auth.register({ email, password, displayName, role });
      set({ user, status: 'authenticated', error: null });
    } catch (err) {
      set({ status: 'guest', error: err instanceof Error ? err.message : 'register failed' });
      throw err;
    }
  },

  logout: async () => {
    try {
      await api.auth.logout();
    } catch {
      // Ignore — we still want to clear local state.
    }
    set({ user: null, status: 'guest', error: null });
  },

  clearError: () => set({ error: null }),
}));
