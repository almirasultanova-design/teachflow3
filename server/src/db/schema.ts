export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  display_name  TEXT,
  role          TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','teacher')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS songs (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  title            TEXT NOT NULL,
  artist           TEXT NOT NULL,
  source_type      TEXT NOT NULL CHECK (source_type IN ('upload', 'youtube', 'virtual')),
  audio_url        TEXT,
  youtube_id       TEXT,
  duration_ms      INTEGER NOT NULL DEFAULT 0,
  cover_url        TEXT,
  level            TEXT,
  description      TEXT,
  external_source  TEXT,
  external_id      TEXT,
  lyrics_offset_ms INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (external_source, external_id)
);

CREATE TABLE IF NOT EXISTS lyric_lines (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  song_id       INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  line_index    INTEGER NOT NULL,
  start_ms      INTEGER NOT NULL,
  end_ms        INTEGER NOT NULL,
  text          TEXT NOT NULL,
  translation   TEXT,
  notes         TEXT,
  UNIQUE (song_id, line_index)
);

CREATE INDEX IF NOT EXISTS idx_lines_song ON lyric_lines(song_id);

CREATE TABLE IF NOT EXISTS user_library (
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  song_id          INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  added_at         TEXT NOT NULL DEFAULT (datetime('now')),
  listen_count     INTEGER NOT NULL DEFAULT 0,
  last_listened_at TEXT,
  PRIMARY KEY (user_id, song_id)
);

CREATE INDEX IF NOT EXISTS idx_user_library_user ON user_library(user_id);

CREATE TABLE IF NOT EXISTS word_cache (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  word          TEXT NOT NULL,
  context_hash  TEXT NOT NULL,
  payload_json  TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (word, context_hash)
);

CREATE TABLE IF NOT EXISTS line_cache (
  line_id       INTEGER PRIMARY KEY REFERENCES lyric_lines(id) ON DELETE CASCADE,
  payload_json  TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS saved_words (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word            TEXT NOT NULL,
  lemma           TEXT,
  translation     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'learning' CHECK (status IN ('new','learning','known')),
  song_id         INTEGER REFERENCES songs(id) ON DELETE SET NULL,
  line_id         INTEGER REFERENCES lyric_lines(id) ON DELETE SET NULL,
  review_count    INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, word)
);

CREATE INDEX IF NOT EXISTS idx_saved_words_user ON saved_words(user_id);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  song_id       INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  score         INTEGER NOT NULL,
  total         INTEGER NOT NULL,
  details_json  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_quiz_song ON quiz_attempts(song_id);
CREATE INDEX IF NOT EXISTS idx_quiz_user ON quiz_attempts(user_id);
`;
