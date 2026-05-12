import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

export function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function extractYoutubeId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^[A-Za-z0-9_-]{8,16}$/.test(trimmed) && !trimmed.includes('/')) return trimmed;
  const m = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,16})/);
  return m?.[1] ?? null;
}

export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/^[^a-z']+|[^a-z']+$/g, '');
}

/** Split a lyric line into clickable word and separator tokens. */
export type LineToken = { type: 'word' | 'sep'; value: string };

export function tokenizeLine(text: string): LineToken[] {
  const tokens: LineToken[] = [];
  const re = /([A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F'\u2018\u2019]*)|([^A-Za-z\u00C0-\u024F]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[1]) tokens.push({ type: 'word', value: m[1] });
    else if (m[2]) tokens.push({ type: 'sep', value: m[2] });
  }
  return tokens;
}

export function compareAnswers(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[^a-zа-яё0-9'\s]/giu, '')
      .replace(/\s+/g, ' ')
      .trim();
  return norm(a) === norm(b);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
