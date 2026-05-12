import { useMemo } from 'react';
import type { LyricLine } from '@lyricling/shared';

export function useActiveLine(lines: LyricLine[], timeMs: number): number {
  return useMemo(() => {
    if (!lines.length) return -1;
    // Binary-search for the latest line whose startMs <= timeMs.
    let lo = 0;
    let hi = lines.length - 1;
    let best = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (lines[mid].startMs <= timeMs) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (best < 0) return -1;
    if (timeMs > lines[best].endMs + 200) {
      // We're between lines; still highlight the most recent one.
      return best;
    }
    return best;
  }, [lines, timeMs]);
}
