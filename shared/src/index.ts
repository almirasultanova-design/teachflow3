// Shared types between client and server.

export type SongSourceType = 'upload' | 'youtube' | 'virtual';

export interface Song {
  id: number;
  title: string;
  artist: string;
  sourceType: SongSourceType;
  /** Public URL of the audio file (for `upload`). */
  audioUrl: string | null;
  /** YouTube video id (for `youtube`). */
  youtubeId: string | null;
  /** Total duration in milliseconds. */
  durationMs: number;
  /** Optional cover image URL. */
  coverUrl: string | null;
  /** Optional difficulty/level label, e.g. A2, B1. */
  level: string | null;
  /** Free-form description. */
  description: string | null;
  /**
   * Lyric timing offset in milliseconds. Positive means the lyrics start LATER
   * than the audio source (e.g. when the YouTube video has an intro before the
   * track actually begins). Effective lyric time = audioTimeMs - lyricsOffsetMs.
   */
  lyricsOffsetMs: number;
  createdAt: string;
}

export interface LyricLine {
  id: number;
  songId: number;
  index: number;
  startMs: number;
  endMs: number;
  text: string;
  /** Pre-computed Russian translation if available. */
  translation: string | null;
  /** Slang/idiom notes (markdown). */
  notes: string | null;
}

export interface SongDetail extends Song {
  lines: LyricLine[];
}

export interface WordTranslation {
  word: string;
  lemma?: string;
  partOfSpeech?: string;
  ipa?: string;
  /** Best translation given the line context. */
  translation: string;
  /** Other common meanings as short phrases. */
  alternatives?: string[];
  /** True if this is slang/idiomatic. */
  slang?: boolean;
  /** Plain-language explanation in Russian. */
  explanation?: string;
  /** Usage examples (English -> Russian). */
  examples?: { en: string; ru: string }[];
}

export interface LineTranslation {
  literal: string;
  natural: string;
  notes?: string;
  slang?: { phrase: string; meaning: string }[];
}

export type QuizType = 'fill-blank' | 'match' | 'translate-line';

export interface FillBlankQuestion {
  type: 'fill-blank';
  lineId: number;
  /** Line with one or more blanks marked as `___`. */
  prompt: string;
  /** Correct words in order of blanks. */
  answers: string[];
  /** Optional pool of distractors for multiple-choice mode. */
  options?: string[];
}

export interface MatchQuestion {
  type: 'match';
  /** English words. */
  left: string[];
  /** Russian translations (same length, scrambled). */
  right: string[];
  /** Map: english -> russian (correct pairing). */
  answer: Record<string, string>;
}

export interface TranslateLineQuestion {
  type: 'translate-line';
  lineId: number;
  text: string;
  expected: string;
}

export type QuizQuestion = FillBlankQuestion | MatchQuestion | TranslateLineQuestion;

export interface Quiz {
  songId: number;
  questions: QuizQuestion[];
}

export type WordStatus = 'new' | 'learning' | 'known';

export interface SavedWord {
  id: number;
  word: string;
  lemma: string | null;
  translation: string;
  status: WordStatus;
  songId: number | null;
  songTitle: string | null;
  lineText: string | null;
  reviewCount: number;
  lastReviewedAt: string | null;
  createdAt: string;
}

export interface QuizAttempt {
  id: number;
  songId: number;
  songTitle: string;
  score: number;
  total: number;
  createdAt: string;
}

export interface ApiError {
  error: string;
  details?: unknown;
}

export type UserRole = 'student' | 'teacher';

export interface User {
  id: number;
  email: string;
  displayName: string | null;
  role: UserRole;
  createdAt: string;
}

export interface StudentSummary {
  id: number;
  email: string;
  displayName: string | null;
  createdAt: string;
  totalSongs: number;
  listenedSongs: number;
  totalListens: number;
  savedWords: number;
  knownWords: number;
  quizAttempts: number;
  avgQuizRatio: number;
  streakDays: number;
  lastActiveAt: string | null;
}

export interface StudentDetail extends StudentSummary {
  recentAttempts: QuizAttempt[];
  recentWords: SavedWord[];
  readyForQuiz: {
    id: number;
    title: string;
    artist: string;
    listenCount: number;
    lastListenedAt: string;
  }[];
}

export interface AuthResponse {
  user: User;
}

export interface CatalogSearchResult {
  /** Stable external id like "lrclib:12345". */
  externalId: string;
  title: string;
  artist: string;
  /** Track length in milliseconds, when known. */
  durationMs: number | null;
  /** True when the catalog provided synchronized LRC lyrics. */
  hasSyncedLyrics: boolean;
  /** YouTube video id when found via YouTube Data API. */
  youtubeId: string | null;
  /** Cover art URL (e.g. YouTube thumbnail). */
  coverUrl: string | null;
}
