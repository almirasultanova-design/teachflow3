import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { z } from 'zod';
import { config } from '../config.js';
import {
  addSongToUserLibrary,
  createSong,
  getSong,
  isSongInUserLibrary,
  listSongsForUser,
  markSongListened,
  removeSongFromUserLibrary,
  setSongLyricsOffset,
} from '../services/songs.js';
import { requireAuth } from '../middleware/auth.js';
import { autoSyncSong } from '../services/autosync.js';

const router = Router();
router.use(requireAuth);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadsDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^A-Za-z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safe}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.get('/', (req, res) => {
  res.json(listSongsForUser(req.user!.id));
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
  if (!isSongInUserLibrary(req.user!.id, id)) {
    return res.status(404).json({ error: 'not found' });
  }
  const song = getSong(id);
  if (!song) return res.status(404).json({ error: 'not found' });
  res.json(song);
});

const youtubeBody = z.object({
  title: z.string().min(1),
  artist: z.string().min(1),
  youtubeId: z.string().min(5),
  lrc: z.string().min(1),
  coverUrl: z.string().url().optional(),
  level: z.string().optional(),
  description: z.string().optional(),
});

router.post('/youtube', (req, res) => {
  const parsed = youtubeBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid body', details: parsed.error.flatten() });

  const song = createSong({
    title: parsed.data.title,
    artist: parsed.data.artist,
    sourceType: 'youtube',
    youtubeId: parsed.data.youtubeId,
    coverUrl: parsed.data.coverUrl ?? `https://i.ytimg.com/vi/${parsed.data.youtubeId}/hqdefault.jpg`,
    level: parsed.data.level ?? null,
    description: parsed.data.description ?? null,
    lrc: parsed.data.lrc,
    ownerUserId: req.user!.id,
  });
  res.status(201).json(song);
});

const virtualBody = z.object({
  title: z.string().min(1),
  artist: z.string().min(1),
  lrc: z.string().min(1),
  level: z.string().optional(),
  description: z.string().optional(),
});

router.post('/virtual', (req, res) => {
  const parsed = virtualBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid body', details: parsed.error.flatten() });

  const song = createSong({
    title: parsed.data.title,
    artist: parsed.data.artist,
    sourceType: 'virtual',
    level: parsed.data.level ?? null,
    description: parsed.data.description ?? null,
    lrc: parsed.data.lrc,
    ownerUserId: req.user!.id,
  });
  res.status(201).json(song);
});

router.post(
  '/upload',
  upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'lrc', maxCount: 1 },
  ]),
  (req, res) => {
    const files = req.files as { [k: string]: Express.Multer.File[] } | undefined;
    const audioFile = files?.audio?.[0];
    const lrcFile = files?.lrc?.[0];

    const { title, artist, level, description } = req.body as Record<string, string | undefined>;
    if (!title || !artist) {
      return res.status(400).json({ error: 'title and artist are required' });
    }

    let lrcContent: string | null = null;
    if (lrcFile) {
      lrcContent = fs.readFileSync(lrcFile.path, 'utf8');
    } else if (typeof req.body.lrc === 'string') {
      lrcContent = req.body.lrc as string;
    }
    if (!lrcContent) {
      return res.status(400).json({ error: 'lrc content (file or field) is required' });
    }

    let audioUrl: string | null = null;
    if (audioFile) {
      const rel = path.relative(config.uploadsDir, audioFile.path).replace(/\\/g, '/');
      audioUrl = `${config.publicBaseUrl}/uploads/${rel}`;
    }

    try {
      const song = createSong({
        title,
        artist,
        sourceType: audioFile ? 'upload' : 'virtual',
        audioUrl,
        level: level ?? null,
        description: description ?? null,
        lrc: lrcContent,
        ownerUserId: req.user!.id,
      });
      res.status(201).json(song);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'failed to create song';
      res.status(400).json({ error: msg });
    }
  },
);

// Removes the song only from the current user's library — the song record itself
// stays in the global catalog so other users keep access.
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
  const ok = removeSongFromUserLibrary(req.user!.id, id);
  if (!ok) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

router.post('/:id/library', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
  const song = getSong(id);
  if (!song) return res.status(404).json({ error: 'not found' });
  addSongToUserLibrary(req.user!.id, id);
  res.status(201).json(song);
});

const offsetBody = z.object({
  // Reasonable bounds: ±5 minutes covers any imaginable lyric drift.
  lyricsOffsetMs: z.number().int().min(-300_000).max(300_000),
});

router.post('/:id/listened', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
  if (!isSongInUserLibrary(req.user!.id, id)) {
    return res.status(404).json({ error: 'not found' });
  }
  const stats = markSongListened(req.user!.id, id);
  res.json(stats ?? { listenCount: 0, lastListenedAt: null });
});

router.post('/:id/auto-sync', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
  if (!isSongInUserLibrary(req.user!.id, id)) {
    return res.status(404).json({ error: 'not found' });
  }
  try {
    const result = await autoSyncSong(id);
    const song = getSong(id);
    res.json({ ...result, song });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'auto-sync failed';
    console.warn('auto-sync failed:', err);
    res.status(422).json({ error: msg });
  }
});

router.patch('/:id/offset', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
  if (!isSongInUserLibrary(req.user!.id, id)) {
    return res.status(404).json({ error: 'not found' });
  }
  const parsed = offsetBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid body', details: parsed.error.flatten() });
  }
  setSongLyricsOffset(id, parsed.data.lyricsOffsetMs);
  const song = getSong(id);
  if (!song) return res.status(404).json({ error: 'not found' });
  res.json(song);
});

export default router;
