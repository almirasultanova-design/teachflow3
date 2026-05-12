import crypto from 'node:crypto';
import { getDb } from '../db/index.js';
import { parseLrc } from './lrc.js';
import type { LyricLine, Song, SongDetail, SongSourceType } from '@lyricling/shared';

interface SongRow {
  id: number;
  title: string;
  artist: string;
  source_type: SongSourceType;
  audio_url: string | null;
  youtube_id: string | null;
  duration_ms: number;
  cover_url: string | null;
  level: string | null;
  description: string | null;
  external_source: string | null;
  external_id: string | null;
  lyrics_offset_ms: number;
  created_at: string;
}

interface LineRow {
  id: number;
  song_id: number;
  line_index: number;
  start_ms: number;
  end_ms: number;
  text: string;
  translation: string | null;
  notes: string | null;
}

const songFromRow = (r: SongRow): Song => ({
  id: r.id,
  title: r.title,
  artist: r.artist,
  sourceType: r.source_type,
  audioUrl: r.audio_url,
  youtubeId: r.youtube_id,
  durationMs: r.duration_ms,
  coverUrl: r.cover_url,
  level: r.level,
  description: r.description,
  lyricsOffsetMs: r.lyrics_offset_ms ?? 0,
  createdAt: r.created_at,
});

export function setSongLyricsOffset(songId: number, offsetMs: number): void {
  getDb()
    .prepare(`UPDATE songs SET lyrics_offset_ms = ? WHERE id = ?`)
    .run(offsetMs, songId);
}

export interface UserSongStats {
  listenCount: number;
  lastListenedAt: string | null;
}

export function getUserSongStats(userId: number, songId: number): UserSongStats | null {
  const row = getDb()
    .prepare(
      `SELECT listen_count, last_listened_at FROM user_library WHERE user_id = ? AND song_id = ?`,
    )
    .get(userId, songId) as
    | { listen_count: number; last_listened_at: string | null }
    | undefined;
  if (!row) return null;
  return { listenCount: row.listen_count, lastListenedAt: row.last_listened_at };
}

export function markSongListened(userId: number, songId: number): UserSongStats | null {
  const db = getDb();
  const result = db
    .prepare(
      `UPDATE user_library
         SET listen_count = listen_count + 1,
             last_listened_at = datetime('now')
       WHERE user_id = ? AND song_id = ?`,
    )
    .run(userId, songId);
  if (result.changes === 0) return null;
  return getUserSongStats(userId, songId);
}

const lineFromRow = (r: LineRow): LyricLine => ({
  id: r.id,
  songId: r.song_id,
  index: r.line_index,
  startMs: r.start_ms,
  endMs: r.end_ms,
  text: r.text,
  translation: r.translation,
  notes: r.notes,
});

export function listSongs(): Song[] {
  const rows = getDb()
    .prepare(`SELECT * FROM songs ORDER BY created_at DESC`)
    .all() as SongRow[];
  return rows.map(songFromRow);
}

export function listSongsForUser(userId: number): Song[] {
  const rows = getDb()
    .prepare(
      `SELECT s.* FROM songs s
       INNER JOIN user_library ul ON ul.song_id = s.id
       WHERE ul.user_id = ?
       ORDER BY ul.added_at DESC`,
    )
    .all(userId) as SongRow[];
  return rows.map(songFromRow);
}

export function isSongInUserLibrary(userId: number, songId: number): boolean {
  const row = getDb()
    .prepare(`SELECT 1 AS x FROM user_library WHERE user_id = ? AND song_id = ?`)
    .get(userId, songId) as { x: number } | undefined;
  return Boolean(row);
}

export function addSongToUserLibrary(userId: number, songId: number): void {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO user_library (user_id, song_id) VALUES (?, ?)`,
    )
    .run(userId, songId);
}

export function removeSongFromUserLibrary(userId: number, songId: number): boolean {
  const result = getDb()
    .prepare(`DELETE FROM user_library WHERE user_id = ? AND song_id = ?`)
    .run(userId, songId);
  return result.changes > 0;
}

export function findSongByExternal(
  externalSource: string,
  externalId: string,
): SongDetail | null {
  const row = getDb()
    .prepare(`SELECT * FROM songs WHERE external_source = ? AND external_id = ?`)
    .get(externalSource, externalId) as SongRow | undefined;
  if (!row) return null;
  return getSong(row.id);
}

export function getSong(id: number): SongDetail | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM songs WHERE id = ?`).get(id) as SongRow | undefined;
  if (!row) return null;

  const lineRows = db
    .prepare(`SELECT * FROM lyric_lines WHERE song_id = ? ORDER BY line_index ASC`)
    .all(id) as LineRow[];

  return { ...songFromRow(row), lines: lineRows.map(lineFromRow) };
}

export function getLine(id: number): LyricLine | null {
  const row = getDb()
    .prepare(`SELECT * FROM lyric_lines WHERE id = ?`)
    .get(id) as LineRow | undefined;
  return row ? lineFromRow(row) : null;
}

export interface CreateSongInput {
  title: string;
  artist: string;
  sourceType: SongSourceType;
  audioUrl?: string | null;
  youtubeId?: string | null;
  coverUrl?: string | null;
  level?: string | null;
  description?: string | null;
  externalSource?: string | null;
  externalId?: string | null;
  /** Raw LRC string. */
  lrc: string;
  /** When set, the new song is also inserted into this user's library. */
  ownerUserId?: number | null;
}

export function createSong(input: CreateSongInput): SongDetail {
  const lines = parseLrc(input.lrc);
  if (lines.length === 0) {
    throw new Error('LRC file produced no lines.');
  }
  const durationMs = lines[lines.length - 1].endMs;

  const db = getDb();
  const insertSong = db.prepare(
    `INSERT INTO songs
       (title, artist, source_type, audio_url, youtube_id, duration_ms,
        cover_url, level, description, external_source, external_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertLine = db.prepare(
    `INSERT INTO lyric_lines (song_id, line_index, start_ms, end_ms, text, translation, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertLibrary = db.prepare(
    `INSERT OR IGNORE INTO user_library (user_id, song_id) VALUES (?, ?)`,
  );

  const txn = db.transaction(() => {
    const result = insertSong.run(
      input.title,
      input.artist,
      input.sourceType,
      input.audioUrl ?? null,
      input.youtubeId ?? null,
      durationMs,
      input.coverUrl ?? null,
      input.level ?? null,
      input.description ?? null,
      input.externalSource ?? null,
      input.externalId ?? null,
    );
    const songId = Number(result.lastInsertRowid);
    lines.forEach((line, idx) => {
      insertLine.run(songId, idx, line.startMs, line.endMs, line.text, null, null);
    });
    if (input.ownerUserId) {
      insertLibrary.run(input.ownerUserId, songId);
    }
    return songId;
  });

  const songId = txn();
  const detail = getSong(songId);
  if (!detail) throw new Error('Failed to load song after insert.');
  return detail;
}

export function deleteSong(id: number): boolean {
  const result = getDb().prepare(`DELETE FROM songs WHERE id = ?`).run(id);
  return result.changes > 0;
}

export function setLineTranslation(lineId: number, translation: string, notes?: string | null) {
  getDb()
    .prepare(`UPDATE lyric_lines SET translation = ?, notes = ? WHERE id = ?`)
    .run(translation, notes ?? null, lineId);
}

export function hashContext(text: string): string {
  return crypto.createHash('sha1').update(text.toLowerCase().trim()).digest('hex').slice(0, 16);
}
