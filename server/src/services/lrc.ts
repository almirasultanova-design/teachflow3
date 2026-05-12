/**
 * Minimal LRC parser. Supports:
 *   [mm:ss.xx] or [mm:ss.xxx] timestamps
 *   Multiple timestamps on a single line (compressed format)
 *   ID tags like [ti:Title], [ar:Artist] which are ignored for line extraction.
 *
 * Returns lines sorted by startMs with computed endMs (= next line's start, or +5s for last).
 */

export interface ParsedLrcLine {
  startMs: number;
  endMs: number;
  text: string;
}

const TIMESTAMP_RE = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

function parseTimestamp(min: string, sec: string, frac?: string): number {
  const m = parseInt(min, 10);
  const s = parseInt(sec, 10);
  let ms = 0;
  if (frac) {
    // Pad/trim to 3 digits.
    const padded = (frac + '000').slice(0, 3);
    ms = parseInt(padded, 10);
  }
  return m * 60_000 + s * 1000 + ms;
}

export function parseLrc(content: string): ParsedLrcLine[] {
  const rawLines = content.split(/\r?\n/);
  const collected: { startMs: number; text: string }[] = [];

  for (const raw of rawLines) {
    const line = raw.trim();
    if (!line) continue;

    // Skip ID tags like [ti:...], [ar:...] — only timestamps have digits at index 1.
    if (/^\[[a-zA-Z]+:/.test(line)) continue;

    const stamps: number[] = [];
    let lastIdx = 0;
    TIMESTAMP_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = TIMESTAMP_RE.exec(line)) !== null) {
      stamps.push(parseTimestamp(match[1], match[2], match[3]));
      lastIdx = match.index + match[0].length;
    }
    if (stamps.length === 0) continue;

    const text = line.slice(lastIdx).trim();
    if (!text) continue;

    for (const ms of stamps) {
      collected.push({ startMs: ms, text });
    }
  }

  collected.sort((a, b) => a.startMs - b.startMs);

  const lines: ParsedLrcLine[] = collected.map((l, i) => {
    const next = collected[i + 1];
    const endMs = next ? next.startMs : l.startMs + 5000;
    return { startMs: l.startMs, endMs, text: l.text };
  });

  return lines;
}

/** Tokenize a lyric line into clickable words and separators (punctuation, spaces). */
export interface LineToken {
  type: 'word' | 'sep';
  value: string;
}

export function tokenizeLine(text: string): LineToken[] {
  // Words: letters incl. apostrophes inside (don't, we're, rock'n'roll)
  const tokens: LineToken[] = [];
  const re = /([A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F'’]*)|([^A-Za-z\u00C0-\u024F]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[1]) tokens.push({ type: 'word', value: m[1] });
    else if (m[2]) tokens.push({ type: 'sep', value: m[2] });
  }
  return tokens;
}

export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/^[^a-z']+|[^a-z']+$/g, '');
}
