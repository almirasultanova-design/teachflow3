import type {
  AuthResponse,
  CatalogSearchResult,
  LineTranslation,
  Quiz,
  QuizAttempt,
  SavedWord,
  Song,
  SongDetail,
  StudentDetail,
  StudentSummary,
  User,
  WordTranslation,
} from '@lyricling/shared';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const data = await res.json();
      if (data?.error) message = String(data.error);
    } catch { /* ignore */ }
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface Health {
  ok: boolean;
  openai: boolean;
  youtube: boolean;
  time: string;
}

export const api = {
  health: () => request<Health>('/api/health'),

  auth: {
    me: () => request<{ user: User }>('/api/auth/me'),
    login: (body: { email: string; password: string }) =>
      request<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    register: (body: {
      email: string;
      password: string;
      displayName?: string;
      role?: 'student' | 'teacher';
    }) =>
      request<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  },

  catalog: {
    search: (q: string) =>
      request<CatalogSearchResult[]>(`/api/catalog/search?q=${encodeURIComponent(q)}`),
    add: (externalId: string) =>
      request<SongDetail>('/api/catalog/add', {
        method: 'POST',
        body: JSON.stringify({ externalId }),
      }),
  },

  songs: {
    list: () => request<Song[]>('/api/songs'),
    get: (id: number) => request<SongDetail>(`/api/songs/${id}`),
    delete: (id: number) => request<void>(`/api/songs/${id}`, { method: 'DELETE' }),
    setOffset: (id: number, lyricsOffsetMs: number) =>
      request<SongDetail>(`/api/songs/${id}/offset`, {
        method: 'PATCH',
        body: JSON.stringify({ lyricsOffsetMs }),
      }),
    autoSync: (id: number) =>
      request<{
        offsetMs: number;
        matchedWords: string[];
        whisperFirstWordSec: number;
        lrcFirstLineMs: number;
        audioBytes: number;
        song: SongDetail;
      }>(`/api/songs/${id}/auto-sync`, { method: 'POST' }),
    markListened: (id: number) =>
      request<{ listenCount: number; lastListenedAt: string | null }>(
        `/api/songs/${id}/listened`,
        { method: 'POST' },
      ),
    createUpload: (form: FormData) =>
      request<SongDetail>('/api/songs/upload', { method: 'POST', body: form }),
    createYoutube: (body: {
      title: string;
      artist: string;
      youtubeId: string;
      lrc: string;
      level?: string;
      description?: string;
    }) =>
      request<SongDetail>('/api/songs/youtube', { method: 'POST', body: JSON.stringify(body) }),
    createVirtual: (body: {
      title: string;
      artist: string;
      lrc: string;
      level?: string;
      description?: string;
    }) =>
      request<SongDetail>('/api/songs/virtual', { method: 'POST', body: JSON.stringify(body) }),
  },

  translate: {
    word: (body: { word: string; lineId?: number; lineText?: string; songId?: number }) =>
      request<WordTranslation>('/api/translate/word', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    lookupBatch: (words: string[]) =>
      request<Record<string, WordTranslation | null>>('/api/translate/word/lookup-batch', {
        method: 'POST',
        body: JSON.stringify({ words }),
      }),
    line: (lineId: number) =>
      request<LineTranslation>('/api/translate/line', {
        method: 'POST',
        body: JSON.stringify({ lineId }),
      }),
  },

  quiz: {
    forSong: (songId: number) => request<Quiz>(`/api/quiz/song/${songId}`),
    submit: (body: { songId: number; score: number; total: number; details?: unknown }) =>
      request<{ id: number }>('/api/quiz/attempt', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    attempts: () => request<QuizAttempt[]>('/api/quiz/attempts'),
  },

  teacher: {
    students: () => request<StudentSummary[]>('/api/teacher/students'),
    student: (id: number) => request<StudentDetail>(`/api/teacher/students/${id}`),
  },

  progress: {
    words: () => request<SavedWord[]>('/api/progress/words'),
    saveWord: (body: {
      word: string;
      lemma?: string;
      translation: string;
      status?: 'new' | 'learning' | 'known';
      songId?: number;
      lineId?: number;
    }) =>
      request<SavedWord>('/api/progress/words', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    updateWord: (id: number, body: { status?: 'new' | 'learning' | 'known'; reviewed?: boolean }) =>
      request<SavedWord>(`/api/progress/words/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    deleteWord: (id: number) => request<void>(`/api/progress/words/${id}`, { method: 'DELETE' }),
    summary: () =>
      request<{
        words: Record<string, number>;
        totalSongs: number;
        listenedSongs: number;
        totalListens: number;
        quizAttempts: number;
        avgQuizRatio: number;
        streakDays: number;
        readyForQuiz: {
          id: number;
          title: string;
          artist: string;
          listenCount: number;
          lastListenedAt: string;
        }[];
      }>('/api/progress/summary'),
  },
};
