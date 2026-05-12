import { config, isYouTubeEnabled } from '../config.js';

const SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';

export interface YouTubeVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string | null;
  durationMs: number | null;
}

interface YtSearchItem {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    thumbnails?: Record<string, { url?: string }>;
  };
}

interface YtSearchResponse {
  items?: YtSearchItem[];
}

interface YtVideoItem {
  id?: string;
  contentDetails?: { duration?: string };
}

interface YtVideosResponse {
  items?: YtVideoItem[];
}

const cache = new Map<string, { at: number; videos: YouTubeVideo[] }>();
const TTL_MS = 10 * 60 * 1000;

export async function searchYouTube(query: string, maxResults = 10): Promise<YouTubeVideo[]> {
  if (!isYouTubeEnabled()) return [];
  const q = query.trim();
  if (!q) return [];

  const cacheKey = `${maxResults}|${q.toLowerCase()}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.videos;

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: String(maxResults),
    q,
    key: config.youtube.apiKey,
    safeSearch: 'none',
    videoEmbeddable: 'true',
  });

  const res = await fetch(`${SEARCH_URL}?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`youtube search ${res.status}: ${text || res.statusText}`);
  }
  const data = (await res.json()) as YtSearchResponse;
  const partialVideos = (data.items ?? [])
    .filter((it): it is YtSearchItem & { id: { videoId: string } } =>
      Boolean(it.id?.videoId),
    )
    .map((it) => {
      const thumbs = it.snippet?.thumbnails ?? {};
      const thumb =
        thumbs.high?.url ?? thumbs.medium?.url ?? thumbs.default?.url ?? null;
      return {
        videoId: it.id.videoId,
        title: it.snippet?.title ?? '',
        channelTitle: it.snippet?.channelTitle ?? '',
        thumbnailUrl: thumb,
        durationMs: null as number | null,
      } satisfies YouTubeVideo;
    });

  // Enrich with durations in a single batch call so we can filter shorts and remixes.
  const ids = partialVideos.map((v) => v.videoId).join(',');
  const durations: Record<string, number | null> = {};
  if (ids.length > 0) {
    const dRes = await fetch(
      `${VIDEOS_URL}?${new URLSearchParams({
        part: 'contentDetails',
        id: ids,
        key: config.youtube.apiKey,
      }).toString()}`,
    );
    if (dRes.ok) {
      const dData = (await dRes.json()) as YtVideosResponse;
      (dData.items ?? []).forEach((it) => {
        if (!it.id) return;
        durations[it.id] = parseISODuration(it.contentDetails?.duration);
      });
    }
  }

  const videos = partialVideos.map((v) => ({
    ...v,
    durationMs: durations[v.videoId] ?? null,
  }));

  cache.set(cacheKey, { at: Date.now(), videos });
  return videos;
}

/**
 * Pick the best video for a song. Strategy:
 *   1. Prefer "Artist - Topic" / "VEVO" / official audio uploads — these are
 *      usually master tracks with no intro and timings that match lrclib.
 *   2. Penalize videos whose duration is far from the expected duration
 *      (lyrics-based or hint), filters out remixes / live / hour-long mixes.
 *   3. Penalize videos that look like covers / reactions / shorts.
 */
export async function findBestYouTubeVideo(
  artist: string,
  title: string,
  hintDurationMs?: number | null,
): Promise<YouTubeVideo | null> {
  if (!isYouTubeEnabled()) return null;

  const query = `${artist} ${title}`;
  const videos = await searchYouTube(query, 10);
  if (videos.length === 0) return null;

  const scored = videos
    .map((v) => ({ v, score: scoreVideo(v, artist, title, hintDurationMs) }))
    .filter((s) => s.score > -1000)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.v ?? null;
}

function scoreVideo(
  v: YouTubeVideo,
  artist: string,
  title: string,
  hintDurationMs: number | null | undefined,
): number {
  const t = (v.title || '').toLowerCase();
  const ch = (v.channelTitle || '').toLowerCase();
  const a = artist.toLowerCase();
  const ti = title.toLowerCase();
  let score = 0;

  // Strong preference: YouTube's auto-generated topic channels — pure audio.
  if (/-\s*topic$/.test(ch)) score += 100;
  if (/vevo$/.test(ch)) score += 30;

  // Channel matches the artist name: very likely the official source.
  if (a && ch.includes(a)) score += 40;

  // Title quality signals.
  if (/\bofficial\s+audio\b/.test(t)) score += 50;
  if (/\baudio\b/.test(t)) score += 20;
  if (/\blyrics?\b/.test(t)) score += 10;
  if (/\bofficial\b/.test(t) && !/audio/.test(t)) score += 5;

  // Negative signals: remixes, live, covers, sped up etc.
  if (/\b(remix|sped\s*up|slowed|nightcore|cover|reaction|karaoke|mashup|live)\b/.test(t))
    score -= 60;
  if (/\b8d\s*audio\b/.test(t)) score -= 30;

  // Title relevance: artist or title in the video title is reassuring.
  if (a && t.includes(a)) score += 15;
  if (ti && t.includes(ti)) score += 15;

  // Duration filtering.
  if (v.durationMs != null) {
    if (v.durationMs < 30_000) score -= 200; // shorts
    if (v.durationMs > 20 * 60_000) score -= 200; // hour-long mix
    if (hintDurationMs && hintDurationMs > 0) {
      const ratio = v.durationMs / hintDurationMs;
      // Strong preference for ±15 % around expected duration. Penalise the rest.
      if (ratio > 0.85 && ratio < 1.15) score += 60;
      else if (ratio > 0.7 && ratio < 1.4) score += 10;
      else score -= 80;
    }
  }

  return score;
}

function parseISODuration(iso?: string): number | null {
  if (!iso) return null;
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  const h = Number(m[1] ?? 0);
  const min = Number(m[2] ?? 0);
  const s = Number(m[3] ?? 0);
  return ((h * 60 + min) * 60 + s) * 1000;
}
