import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import { findSeededTranslation } from '../db/seedWordCache.js';
import { getLine, getSong, hashContext, setLineTranslation } from '../services/songs.js';
import { translateLine, translateWord } from '../services/openai.js';
import type { LineTranslation, WordTranslation } from '@lyricling/shared';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const wordBody = z.object({
  word: z.string().min(1).max(64),
  lineId: z.number().int().positive().optional(),
  lineText: z.string().min(1).max(500).optional(),
  songId: z.number().int().positive().optional(),
});

router.post('/word', async (req, res) => {
  const parsed = wordBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid body', details: parsed.error.flatten() });
  }
  const { word } = parsed.data;
  let lineText = parsed.data.lineText ?? '';
  let songTitle: string | undefined;

  if (parsed.data.lineId) {
    const line = getLine(parsed.data.lineId);
    if (line) lineText = line.text;
    if (parsed.data.songId) {
      const song = getSong(parsed.data.songId);
      if (song) songTitle = `${song.artist} — ${song.title}`;
    }
  }

  const cacheKey = hashContext(`${word}|${lineText}`);
  const db = getDb();
  const cached = db
    .prepare(`SELECT payload_json FROM word_cache WHERE word = ? AND context_hash = ?`)
    .get(word.toLowerCase(), cacheKey) as { payload_json: string } | undefined;

  if (cached) {
    return res.json(JSON.parse(cached.payload_json) as WordTranslation);
  }

  // Fall back to the seeded basic dictionary so common words don't burn
  // OpenAI tokens. Context-aware translations still win above (cached row
  // for the exact line + word stays the source of truth).
  const seeded = findSeededTranslation(db, word);
  if (seeded) {
    return res.json(seeded);
  }

  try {
    const outcome = await translateWord({ word, lineText, songTitle });
    if (outcome.fromOpenAI) {
      db.prepare(
        `INSERT OR REPLACE INTO word_cache (word, context_hash, payload_json) VALUES (?, ?, ?)`,
      ).run(word.toLowerCase(), cacheKey, JSON.stringify(outcome.result));
    }
    res.json(outcome.result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'translation failed' });
  }
});

const lookupBody = z.object({
  words: z.array(z.string().min(1).max(64)).min(1).max(200),
});

/**
 * Bulk lookup of cached/seeded word translations. For each requested word we
 * return the richest WordTranslation we can find without spending OpenAI
 * tokens: prefer any context-specific row from `word_cache`, fall back to the
 * seeded basic dictionary, otherwise null.
 */
router.post('/word/lookup-batch', (req, res) => {
  const parsed = lookupBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid body', details: parsed.error.flatten() });
  }
  const db = getDb();
  const stmt = db.prepare(
    `SELECT payload_json FROM word_cache
     WHERE word = ?
     ORDER BY (context_hash = '__seed_v2__') ASC, ROWID DESC
     LIMIT 1`,
  );
  const out: Record<string, WordTranslation | null> = {};
  for (const raw of parsed.data.words) {
    const key = raw.toLowerCase().trim();
    if (!key || out[key] !== undefined) continue;
    const row = stmt.get(key) as { payload_json: string } | undefined;
    if (row) {
      out[key] = JSON.parse(row.payload_json) as WordTranslation;
    } else {
      const seeded = findSeededTranslation(db, key);
      out[key] = seeded;
    }
  }
  res.json(out);
});

const lineBody = z.object({
  lineId: z.number().int().positive(),
});

router.post('/line', async (req, res) => {
  const parsed = lineBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid body', details: parsed.error.flatten() });
  }

  const line = getLine(parsed.data.lineId);
  if (!line) return res.status(404).json({ error: 'line not found' });

  const db = getDb();
  const cached = db
    .prepare(`SELECT payload_json FROM line_cache WHERE line_id = ?`)
    .get(line.id) as { payload_json: string } | undefined;
  if (cached) {
    return res.json(JSON.parse(cached.payload_json) as LineTranslation);
  }

  const song = getSong(line.songId);
  const before = song?.lines.find((l) => l.index === line.index - 1)?.text;
  const after = song?.lines.find((l) => l.index === line.index + 1)?.text;

  try {
    const outcome = await translateLine({
      text: line.text,
      contextBefore: before,
      contextAfter: after,
      songTitle: song ? `${song.artist} — ${song.title}` : undefined,
    });
    if (outcome.fromOpenAI) {
      db.prepare(`INSERT OR REPLACE INTO line_cache (line_id, payload_json) VALUES (?, ?)`).run(
        line.id,
        JSON.stringify(outcome.result),
      );
      if (!line.translation) {
        setLineTranslation(
          line.id,
          outcome.result.natural || outcome.result.literal,
          outcome.result.notes ?? null,
        );
      }
    }
    res.json(outcome.result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'translation failed' });
  }
});

export default router;
