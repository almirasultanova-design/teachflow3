import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import { getSong, isSongInUserLibrary } from '../services/songs.js';
import { generateQuizFromLines } from '../services/openai.js';
import type { QuizQuestion, Quiz, QuizAttempt } from '@lyricling/shared';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/song/:songId', async (req, res) => {
  const songId = Number(req.params.songId);
  if (!Number.isFinite(songId)) return res.status(400).json({ error: 'invalid id' });

  if (!isSongInUserLibrary(req.user!.id, songId)) {
    return res.status(404).json({ error: 'not found' });
  }
  const song = getSong(songId);
  if (!song) return res.status(404).json({ error: 'not found' });

  const generated = await generateQuizFromLines({
    songTitle: `${song.artist} — ${song.title}`,
    lines: song.lines.map((l) => ({ text: l.text, translation: l.translation })),
  });

  const questions: QuizQuestion[] = [];

  // Fill blanks
  for (const fb of generated.fillBlanks ?? []) {
    const line = song.lines[fb.lineIndex];
    if (!line) continue;
    questions.push({
      type: 'fill-blank',
      lineId: line.id,
      prompt: fb.prompt,
      answers: fb.answers,
    });
  }

  // Match
  if (generated.matches && generated.matches.length >= 2) {
    const left = generated.matches.map((m) => m.en);
    const right = [...generated.matches.map((m) => m.ru)].sort(() => Math.random() - 0.5);
    const answer: Record<string, string> = {};
    generated.matches.forEach((m) => {
      answer[m.en] = m.ru;
    });
    questions.push({ type: 'match', left, right, answer });
  }

  // Translate lines
  for (const tl of generated.translateLines ?? []) {
    const line = song.lines[tl.lineIndex];
    if (!line) continue;
    questions.push({
      type: 'translate-line',
      lineId: line.id,
      text: line.text,
      expected: line.translation ?? '',
    });
  }

  const quiz: Quiz = { songId, questions };
  res.json(quiz);
});

const submitBody = z.object({
  songId: z.number().int().positive(),
  score: z.number().int().min(0),
  total: z.number().int().min(1),
  details: z.unknown().optional(),
});

router.post('/attempt', (req, res) => {
  const parsed = submitBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid body', details: parsed.error.flatten() });

  if (!isSongInUserLibrary(req.user!.id, parsed.data.songId)) {
    return res.status(404).json({ error: 'song not in library' });
  }

  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO quiz_attempts (user_id, song_id, score, total, details_json) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      req.user!.id,
      parsed.data.songId,
      parsed.data.score,
      parsed.data.total,
      parsed.data.details ? JSON.stringify(parsed.data.details) : null,
    );
  res.status(201).json({ id: Number(result.lastInsertRowid) });
});

router.get('/attempts', (req, res) => {
  const rows = getDb()
    .prepare(
      `SELECT a.id, a.song_id AS songId, s.title AS songTitle, a.score, a.total, a.created_at AS createdAt
       FROM quiz_attempts a JOIN songs s ON s.id = a.song_id
       WHERE a.user_id = ?
       ORDER BY a.created_at DESC LIMIT 50`,
    )
    .all(req.user!.id) as QuizAttempt[];
  res.json(rows);
});

export default router;
