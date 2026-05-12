/**
 * One-shot script that converts the raw MUSE en->ru dictionary plus the
 * Google top-10k English frequency list into a compact JSON used by the
 * server to seed `word_cache` on first start.
 *
 * Run with:  npx tsx server/scripts/build-word-seed.ts
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'server', 'data', 'seed');
const MUSE = path.join(ROOT, 'muse-en-ru.txt');
const FREQ = path.join(ROOT, 'google-10000.txt');
const OUT = path.join(ROOT, 'word_seed.json');

if (!fs.existsSync(MUSE)) throw new Error(`missing ${MUSE}`);
if (!fs.existsSync(FREQ)) throw new Error(`missing ${FREQ}`);

const muse = fs.readFileSync(MUSE, 'utf8');
const freq = fs.readFileSync(FREQ, 'utf8');

interface Entry {
  word: string;
  translation: string;
  alternatives: string[];
}

const dict = new Map<string, string[]>();
for (const line of muse.split(/\r?\n/)) {
  const [en, ru] = line.split(/\s+/, 2);
  if (!en || !ru) continue;
  const key = en.toLowerCase().trim();
  const val = ru.trim();
  if (!/^[a-z'-]+$/.test(key)) continue;
  if (!val) continue;
  const arr = dict.get(key) ?? [];
  if (!arr.includes(val)) arr.push(val);
  dict.set(key, arr);
}

const TARGET = 10000;
const seen = new Set<string>();
const entries: Entry[] = [];

const push = (w: string) => {
  if (seen.has(w)) return false;
  if (!/^[a-z'-]+$/.test(w)) return false;
  const ru = dict.get(w);
  if (!ru || ru.length === 0) return false;
  seen.add(w);
  entries.push({
    word: w,
    translation: ru[0],
    alternatives: ru.slice(1, 5),
  });
  return true;
};

// 1) Frequency-ordered words first, so the most common ones land at the top.
for (const line of freq.split(/\r?\n/)) {
  const w = line.trim().toLowerCase();
  if (!w) continue;
  push(w);
  if (entries.length >= TARGET) break;
}

// 2) Curated song favorites (in case any are missing from the freq list).
const songFavorites = [
  'baby', 'girl', 'boy', 'eyes', 'kiss', 'hand', 'hold', 'gone', 'crying',
  'dancing', 'shining', 'breath', 'soul', 'heaven', 'wild', 'free', 'lonely',
  'forever', 'tonight', 'broken', 'fallen', 'angel', 'devil', 'shadow',
];
for (const w of songFavorites) push(w);

// 3) If we still have room, top up from the rest of MUSE alphabetically so
//    that we hit roughly TARGET total entries.
if (entries.length < TARGET) {
  const remaining = [...dict.keys()].sort();
  for (const w of remaining) {
    push(w);
    if (entries.length >= TARGET) break;
  }
}

fs.writeFileSync(OUT, JSON.stringify(entries));
console.log(`wrote ${entries.length} entries to ${OUT}`);
console.log(`size: ${fs.statSync(OUT).size} bytes`);
