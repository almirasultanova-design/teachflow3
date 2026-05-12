import { Router, type NextFunction, type Request, type Response } from 'express';
import { getDb } from '../db/index.js';
import { findUserById } from '../services/users.js';
import { requireAuth } from '../middleware/auth.js';
import type {
  QuizAttempt,
  SavedWord,
  StudentDetail,
  StudentSummary,
} from '@lyricling/shared';

const router = Router();

router.use(requireAuth);
router.use((req: Request, res: Response, next: NextFunction) => {
  const me = findUserById(req.user!.id);
  if (!me || me.role !== 'teacher') {
    return res.status(403).json({ error: 'teacher only' });
  }
  next();
});

interface StudentRow {
  id: number;
  email: string;
  display_name: string | null;
  created_at: string;
  total_songs: number;
  listened_songs: number;
  total_listens: number;
  saved_words: number;
  known_words: number;
  quiz_attempts: number;
  avg_quiz_ratio: number;
  last_listen: string | null;
  last_attempt: string | null;
}

const STUDENT_LIST_SQL = `
  SELECT
    u.id, u.email, u.display_name, u.created_at,
    COALESCE(lib.total_songs, 0)        AS total_songs,
    COALESCE(lib.listened_songs, 0)     AS listened_songs,
    COALESCE(lib.total_listens, 0)      AS total_listens,
    COALESCE(words.saved, 0)            AS saved_words,
    COALESCE(words.known, 0)            AS known_words,
    COALESCE(quiz.attempts, 0)          AS quiz_attempts,
    COALESCE(quiz.avg_ratio, 0)         AS avg_quiz_ratio,
    lib.last_listen                     AS last_listen,
    quiz.last_attempt                   AS last_attempt
  FROM users u
  LEFT JOIN (
    SELECT user_id,
           COUNT(*)                                                  AS total_songs,
           SUM(CASE WHEN listen_count > 0 THEN 1 ELSE 0 END)         AS listened_songs,
           COALESCE(SUM(listen_count), 0)                            AS total_listens,
           MAX(last_listened_at)                                     AS last_listen
    FROM user_library GROUP BY user_id
  ) lib ON lib.user_id = u.id
  LEFT JOIN (
    SELECT user_id,
           COUNT(*)                                                  AS saved,
           SUM(CASE WHEN status = 'known' THEN 1 ELSE 0 END)         AS known
    FROM saved_words GROUP BY user_id
  ) words ON words.user_id = u.id
  LEFT JOIN (
    SELECT user_id,
           COUNT(*)                                                  AS attempts,
           COALESCE(AVG(1.0 * score / total), 0)                     AS avg_ratio,
           MAX(created_at)                                           AS last_attempt
    FROM quiz_attempts GROUP BY user_id
  ) quiz ON quiz.user_id = u.id
  WHERE u.role = 'student'
`;

function studentFromRow(r: StudentRow): StudentSummary {
  const last = [r.last_listen, r.last_attempt]
    .filter(Boolean)
    .sort()
    .pop() as string | undefined;
  return {
    id: r.id,
    email: r.email,
    displayName: r.display_name,
    createdAt: r.created_at,
    totalSongs: r.total_songs,
    listenedSongs: r.listened_songs,
    totalListens: r.total_listens,
    savedWords: r.saved_words,
    knownWords: r.known_words,
    quizAttempts: r.quiz_attempts,
    avgQuizRatio: r.avg_quiz_ratio,
    streakDays: 0, // filled in by computeStreak below
    lastActiveAt: last ?? null,
  };
}

router.get('/students', (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(`${STUDENT_LIST_SQL} ORDER BY u.display_name, u.email`)
    .all() as StudentRow[];

  const list = rows.map(studentFromRow);
  for (const s of list) {
    s.streakDays = computeStreakForUser(s.id);
  }
  res.json(list);
});

router.get('/students/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
  const db = getDb();

  const row = db
    .prepare(`${STUDENT_LIST_SQL} AND u.id = ?`)
    .get(id) as StudentRow | undefined;
  if (!row) return res.status(404).json({ error: 'not found' });

  const summary = studentFromRow(row);
  summary.streakDays = computeStreakForUser(id);

  const recentAttempts = db
    .prepare(
      `SELECT qa.id, qa.song_id AS songId, s.title AS songTitle, qa.score, qa.total, qa.created_at AS createdAt
       FROM quiz_attempts qa
       JOIN songs s ON s.id = qa.song_id
       WHERE qa.user_id = ?
       ORDER BY qa.created_at DESC
       LIMIT 10`,
    )
    .all(id) as QuizAttempt[];

  const recentWords = db
    .prepare(
      `SELECT sw.id, sw.word, sw.lemma, sw.translation, sw.status,
              sw.song_id AS songId, s.title AS songTitle,
              sw.line_id AS lineId, l.text AS lineText,
              sw.review_count AS reviewCount, sw.last_reviewed_at AS lastReviewedAt,
              sw.created_at AS createdAt
       FROM saved_words sw
       LEFT JOIN songs s ON s.id = sw.song_id
       LEFT JOIN lyric_lines l ON l.id = sw.line_id
       WHERE sw.user_id = ?
       ORDER BY sw.created_at DESC
       LIMIT 20`,
    )
    .all(id) as SavedWord[];

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
    .all(id) as StudentDetail['readyForQuiz'];

  const detail: StudentDetail = {
    ...summary,
    recentAttempts,
    recentWords,
    readyForQuiz,
  };
  res.json(detail);
});

function computeStreakForUser(userId: number): number {
  const days = getDb()
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

  if (days.length === 0) return 0;
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setUTCDate(today.getUTCDate() - 1);
  const todayStr = today.toISOString().slice(0, 10);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  let cursor: Date;
  if (days[0].day === todayStr) cursor = new Date(`${todayStr}T00:00:00Z`);
  else if (days[0].day === yesterdayStr) cursor = new Date(`${yesterdayStr}T00:00:00Z`);
  else return 0;

  const set = new Set(days.map((d) => d.day));
  let streak = 0;
  while (set.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export default router;
