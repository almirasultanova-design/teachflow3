// Thin wrapper around https://lrclib.net/docs — public, no API key required.
// Returns synchronized LRC lyrics that can be parsed directly by parseLrc.

const BASE_URL = 'https://lrclib.net/api';
const USER_AGENT = 'TeachFlow/0.1.0 (https://github.com/local)';

export interface LrclibTrack {
  id: number;
  trackName: string;
  artistName: string;
  albumName?: string;
  duration: number; // seconds
  syncedLyrics: string | null;
  plainLyrics: string | null;
}

interface LrclibSearchRow {
  id: number;
  trackName: string;
  artistName: string;
  albumName?: string;
  duration: number;
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
}

interface LrclibGetRow extends LrclibSearchRow {}

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`lrclib ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function searchLrclib(query: string, limit = 8): Promise<LrclibTrack[]> {
  const q = query.trim();
  if (!q) return [];
  const params = new URLSearchParams({ q });
  const rows = await request<LrclibSearchRow[]>(`/search?${params.toString()}`);
  return rows.slice(0, limit).map(rowToTrack);
}

export async function getLrclibById(id: number): Promise<LrclibTrack | null> {
  try {
    const row = await request<LrclibGetRow>(`/get/${id}`);
    return rowToTrack(row);
  } catch {
    return null;
  }
}

function rowToTrack(row: LrclibSearchRow): LrclibTrack {
  return {
    id: row.id,
    trackName: row.trackName,
    artistName: row.artistName,
    albumName: row.albumName,
    duration: row.duration,
    syncedLyrics: row.syncedLyrics ?? null,
    plainLyrics: row.plainLyrics ?? null,
  };
}
