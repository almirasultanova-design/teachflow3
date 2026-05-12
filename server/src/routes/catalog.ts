import { Router } from 'express';
import { z } from 'zod';
import type { CatalogSearchResult } from '@lyricling/shared';
import { requireAuth } from '../middleware/auth.js';
import { getLrclibById, searchLrclib } from '../services/lrclib.js';
import { findBestYouTubeVideo } from '../services/youtube.js';
import {
  addSongToUserLibrary,
  createSong,
  findSongByExternal,
} from '../services/songs.js';

const router = Router();
router.use(requireAuth);

const EXTERNAL_SOURCE = 'lrclib';

router.get('/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (!q) return res.json([]);

  try {
    const tracks = await searchLrclib(q, 8);
    const results: CatalogSearchResult[] = tracks.map((t) => ({
      externalId: `${EXTERNAL_SOURCE}:${t.id}`,
      title: t.trackName,
      artist: t.artistName,
      durationMs: t.duration ? Math.round(t.duration * 1000) : null,
      hasSyncedLyrics: Boolean(t.syncedLyrics?.trim()),
      youtubeId: null,
      coverUrl: null,
    }));
    res.json(results);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'lrclib failed' });
  }
});

const addBody = z.object({
  externalId: z.string().min(3),
});

router.post('/add', async (req, res) => {
  const parsed = addBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid body', details: parsed.error.flatten() });
  }

  const [source, idStr] = parsed.data.externalId.split(':');
  if (source !== EXTERNAL_SOURCE) {
    return res.status(400).json({ error: 'unsupported source' });
  }
  const lrclibId = Number(idStr);
  if (!Number.isFinite(lrclibId) || lrclibId <= 0) {
    return res.status(400).json({ error: 'invalid externalId' });
  }

  const userId = req.user!.id;

  // Reuse the existing global record if some other user already imported it.
  const existing = findSongByExternal(EXTERNAL_SOURCE, String(lrclibId));
  if (existing) {
    addSongToUserLibrary(userId, existing.id);
    return res.status(200).json(existing);
  }

  const track = await getLrclibById(lrclibId).catch(() => null);
  if (!track) return res.status(404).json({ error: 'not found in lrclib' });
  if (!track.syncedLyrics?.trim()) {
    return res.status(422).json({ error: 'track has no synchronized lyrics' });
  }

  // Try to enrich with a YouTube video so the song can be played in the embedded player.
  let youtubeId: string | null = null;
  let coverUrl: string | null = null;
  try {
    const hintMs = track.duration ? Math.round(track.duration * 1000) : null;
    const yt = await findBestYouTubeVideo(track.artistName, track.trackName, hintMs);
    if (yt) {
      youtubeId = yt.videoId;
      coverUrl = yt.thumbnailUrl ?? `https://i.ytimg.com/vi/${yt.videoId}/hqdefault.jpg`;
    }
  } catch (err) {
    console.warn('youtube search failed:', err);
  }

  try {
    const song = createSong({
      title: track.trackName,
      artist: track.artistName,
      sourceType: youtubeId ? 'youtube' : 'virtual',
      youtubeId,
      coverUrl,
      lrc: track.syncedLyrics,
      externalSource: EXTERNAL_SOURCE,
      externalId: String(track.id),
      ownerUserId: userId,
    });
    res.status(201).json(song);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'failed to import';
    res.status(400).json({ error: msg });
  }
});

export default router;
