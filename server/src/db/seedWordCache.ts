import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type Database from 'better-sqlite3';
import type { WordTranslation } from '@lyricling/shared';

/**
 * Synthetic context hash used for offline / seeded word cards. Lookups for
 * a (word, contextHash) miss are allowed to fall back to this row.
 *
 * Bump the suffix whenever the bundled `word_seed.json` changes — older
 * seeded rows for previous hashes are deleted and the new bundle is
 * re-inserted on next startup.
 */
export const SEED_CONTEXT_HASH = '__seed_v2__';
const LEGACY_SEED_HASHES = ['__seed__'];

interface SeedEntry {
  word: string;
  translation: string;
  alternatives: string[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In dev (tsx) we run from source; in build (dist) we still want to find
// the JSON next to the project's data folder. Try a few candidates.
function resolveSeedPath(): string | null {
  const candidates = [
    path.resolve(__dirname, '../../data/seed/word_seed.json'),
    path.resolve(__dirname, '../../../server/data/seed/word_seed.json'),
    path.resolve(process.cwd(), 'server/data/seed/word_seed.json'),
    path.resolve(process.cwd(), 'data/seed/word_seed.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Seeds word_cache with a curated bundle of ~6k common English words and
 * their primary Russian translations. Idempotent: subsequent runs are no-ops.
 */
export function seedWordCacheIfEmpty(database: Database.Database): {
  inserted: number;
  total: number;
} {
  const seedPath = resolveSeedPath();
  if (!seedPath) {
    console.warn('[seed] word_seed.json not found, skipping seed');
    return { inserted: 0, total: 0 };
  }

  // Drop any rows from previous seed bundles so the dictionary stays in sync
  // with whatever `word_seed.json` currently contains.
  for (const hash of LEGACY_SEED_HASHES) {
    const removed = database
      .prepare(`DELETE FROM word_cache WHERE context_hash = ?`)
      .run(hash).changes;
    if (removed > 0) {
      console.log(`[seed] removed ${removed} legacy rows (${hash})`);
    }
  }

  const existing = database
    .prepare(`SELECT COUNT(*) AS n FROM word_cache WHERE context_hash = ?`)
    .get(SEED_CONTEXT_HASH) as { n: number } | undefined;
  if ((existing?.n ?? 0) > 0) {
    return { inserted: 0, total: existing!.n };
  }

  let entries: SeedEntry[];
  try {
    entries = JSON.parse(fs.readFileSync(seedPath, 'utf8')) as SeedEntry[];
  } catch (err) {
    console.warn('[seed] failed to parse word_seed.json:', err);
    return { inserted: 0, total: 0 };
  }

  const insert = database.prepare(
    `INSERT OR IGNORE INTO word_cache (word, context_hash, payload_json) VALUES (?, ?, ?)`,
  );

  const txn = database.transaction((rows: SeedEntry[]) => {
    for (const row of rows) {
      const payload: WordTranslation = {
        word: row.word,
        lemma: row.word,
        partOfSpeech: 'other',
        ipa: '',
        translation: row.translation,
        alternatives: row.alternatives ?? [],
        slang: false,
        explanation: 'Базовое словарное значение.',
        examples: [],
      };
      insert.run(row.word, SEED_CONTEXT_HASH, JSON.stringify(payload));
    }
  });

  txn(entries);
  return { inserted: entries.length, total: entries.length };
}

/**
 * Look up a seeded translation for `word`, with a tiny inflection fallback:
 * tries the word as-is, then a few common suffix strips so plurals / -ed /
 * -ing forms still hit the cache.
 */
export function findSeededTranslation(
  database: Database.Database,
  word: string,
): WordTranslation | null {
  const candidates = lemmaCandidates(word);
  for (const candidate of candidates) {
    const row = database
      .prepare(`SELECT payload_json FROM word_cache WHERE word = ? AND context_hash = ?`)
      .get(candidate, SEED_CONTEXT_HASH) as { payload_json: string } | undefined;
    if (row) {
      const parsed = JSON.parse(row.payload_json) as WordTranslation;
      // Echo back the user's original surface form, but keep the cached lemma.
      return { ...parsed, word };
    }
  }
  return null;
}

function lemmaCandidates(raw: string): string[] {
  const w = raw.toLowerCase().replace(/[^a-z'-]/g, '');
  if (!w) return [];
  const out = new Set<string>([w]);

  // Naive English inflection roll-back. Order matters — the longest suffix first.
  if (w.endsWith("'s")) out.add(w.slice(0, -2));
  if (w.endsWith('ies') && w.length > 4) out.add(w.slice(0, -3) + 'y');
  if (w.endsWith('es') && w.length > 3) out.add(w.slice(0, -2));
  if (w.endsWith('s') && w.length > 3) out.add(w.slice(0, -1));
  if (w.endsWith('ed') && w.length > 4) {
    out.add(w.slice(0, -2));
    out.add(w.slice(0, -1));
  }
  if (w.endsWith('ing') && w.length > 5) {
    out.add(w.slice(0, -3));
    out.add(w.slice(0, -3) + 'e');
  }
  if (w.endsWith('er') && w.length > 4) out.add(w.slice(0, -2));
  if (w.endsWith('est') && w.length > 5) out.add(w.slice(0, -3));

  return [...out];
}
