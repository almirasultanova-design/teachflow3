import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import type { SavedWord, WordStatus } from '@lyricling/shared';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

interface SavedWordRow {
  id: number;
  word: string;
  lemma: string | null;
  translation: string;
  status: WordStatus;
  song_id: number | null;
  song_title: string | null;
  line_id: number | null;
  line_text: string | null;
  review_count: number;
  last_reviewed_at: string | null;
  created_at: string;
}

const fromRow = (r: SavedWordRow): SavedWord => ({
  id: r.id,
  word: r.word,
  lemma: r.lemma,
  translation: r.translation,
  status: r.status,
  songId: r.song_id,
  songTitle: r.song_title,
  lineText: r.line_text,
  reviewCount: r.review_count,
  lastReviewedAt: r.last_reviewed_at,
  createdAt: r.created_at,
});

const SELECT_SAVED = `
  SELECT sw.id, sw.word, sw.lemma, sw.translation, sw.status,
         sw.song_id, s.title AS song_title, sw.line_id, l.text AS line_text,
         sw.review_count, sw.last_reviewed_at, sw.created_at
  FROM saved_words sw
  LEFT JOIN songs s ON s.id = sw.song_id
  LEFT JOIN lyric_lines l ON l.id = sw.line_id
`;

router.get('/words', (req, res) => {
  const rows = getDb()
    .prepare(`${SELECT_SAVED} WHERE sw.user_id = ? ORDER BY sw.created_at DESC`)
    .all(req.user!.id) as SavedWordRow[];
  res.json(rows.map(fromRow));
});

const saveBody = z.object({
  word: z.string().min(1).max(64),
  lemma: z.string().optional(),
  translation: z.string().min(1).max(200),
  status: z.enum(['new', 'learning', 'known']).optional(),
  songId: z.number().int().positive().optional(),
  lineId: z.number().int().positive().optional(),
});

router.post('/words', (req, res) => {
  const parsed = saveBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid body', details: parsed.error.flatten() });

  const db = getDb();
  const status: WordStatus = parsed.data.status ?? 'learning';
  const result = db
    .prepare(
      `INSERT INTO saved_words (user_id, word, lemma, translation, status, song_id, line_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, word) DO UPDATE SET
         translation = excluded.translation,
         status = excluded.status,
         song_id = COALESCE(excluded.song_id, saved_words.song_id),
         line_id = COALESCE(excluded.line_id, saved_words.line_id)
       RETURNING id`,
    )
    .get(
      req.user!.id,
      parsed.data.word.toLowerCase(),
      parsed.data.lemma ?? null,
      parsed.data.translation,
      status,
      parsed.data.songId ?? null,
      parsed.data.lineId ?? null,
    ) as { id: number };

  const row = db
    .prepare(`${SELECT_SAVED} WHERE sw.id = ? AND sw.user_id = ?`)
    .get(result.id, req.user!.id) as SavedWordRow;
  res.status(201).json(fromRow(row));
});

const patchBody = z.object({
  status: z.enum(['new', 'learning', 'known']).optional(),
  reviewed: z.boolean().optional(),
});

router.patch('/words/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
  const parsed = patchBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid body' });

  const db = getDb();
  if (parsed.data.status) {
    db.prepare(`UPDATE saved_words SET status = ? WHERE id = ? AND user_id = ?`).run(
      parsed.data.status,
      id,
      req.user!.id,
    );
  }
  if (parsed.data.reviewed) {
    db.prepare(
      `UPDATE saved_words SET review_count = review_count + 1, last_reviewed_at = datetime('now') WHERE id = ? AND user_id = ?`,
    ).run(id, req.user!.id);
  }
  const row = db
    .prepare(`${SELECT_SAVED} WHERE sw.id = ? AND sw.user_id = ?`)
    .get(id, req.user!.id) as SavedWordRow | undefined;
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(fromRow(row));
});

router.delete('/words/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
  const result = getDb()
    .prepare(`DELETE FROM saved_words WHERE id = ? AND user_id = ?`)
    .run(id, req.user!.id);
  if (result.changes === 0) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

router.get('/summary', (req, res) => {
  const db = getDb();
  const userId = req.user!.id;

  const counts = db
    .prepare(
      `SELECT status, COUNT(*) AS n FROM saved_words WHERE user_id = ? GROUP BY status`,
    )
    .all(userId) as { status: WordStatus; n: number }[];

  const songs = db
    .prepare(`SELECT COUNT(*) AS n FROM user_library WHERE user_id = ?`)
    .get(userId) as { n: number };

  const listens = db
    .prepare(
      `SELECT COUNT(*) AS distinctSongs, COALESCE(SUM(listen_count), 0) AS total
       FROM user_library WHERE user_id = ? AND listen_count > 0`,
    )
    .get(userId) as { distinctSongs: number; total: number };

  const attempts = db
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(AVG(1.0 * score / total), 0) AS avgRatio
       FROM quiz_attempts WHERE user_id = ?`,
    )
    .get(userId) as { n: number; avgRatio: number };

  // Streak: count consecutive days of activity ending today/yesterday.
  // Activity = either a listen or a quiz attempt on a given date (UTC).
  const days = db
    .prepare(
      `SELECT DISTINCT day FROM (
         SELECT date(last_listened_at) AS day FROM user_library
           WHERE user_id = ? AND last_listened_at IS NOT NULL
         UNION
         SELECT date(created_at) AS day FROM quiz_attempts WHERE user_id = ?
       )
       WHERE day IS NOT NULL
       ORDER BY day DESC`,
    )
    .all(userId, userId) as { day: string }[];
  const streakDays = computeStreak(days.map((d) => d.day));

  // Songs that have been listened to but never quizzed yet — perfect targets.
  const readyForQuiz = db
    .prepare(
      `SELECT s.id, s.title, s.artist, ul.listen_count AS listenCount, ul.last_listened_at AS lastListenedAt
       FROM user_library ul
       JOIN songs s ON s.id = ul.song_id
       WHERE ul.user_id = ?
         AND ul.listen_count > 0
         AND NOT EXISTS (
           SELECT 1 FROM quiz_attempts qa WHERE qa.user_id = ul.user_id AND qa.song_id = ul.song_id
         )
       ORDER BY ul.last_listened_at DESC
       LIMIT 6`,
    )
    .all(userId) as {
      id: number;
      title: string;
      artist: string;
      listenCount: number;
      lastListenedAt: string;
    }[];

  res.json({
    words: Object.fromEntries(counts.map((c) => [c.status, c.n])),
    totalSongs: songs.n,
    listenedSongs: listens.distinctSongs,
    totalListens: listens.total,
    quizAttempts: attempts.n,
    avgQuizRatio: attempts.avgRatio,
    streakDays,
    readyForQuiz,
  });
});

function computeStreak(daysDesc: string[]): number {
  if (daysDesc.length === 0) return 0;
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setUTCDate(today.getUTCDate() - 1);
  const todayStr = today.toISOString().slice(0, 10);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  // Streak is allowed to start either today or yesterday — that way late-night
  // sessions still count toward "today" for the user the next morning.
  let cursor: Date;
  if (daysDesc[0] === todayStr) cursor = new Date(`${todayStr}T00:00:00Z`);
  else if (daysDesc[0] === yesterdayStr) cursor = new Date(`${yesterdayStr}T00:00:00Z`);
  else return 0;

  let streak = 0;
  const set = new Set(daysDesc);
  while (set.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export default router;
