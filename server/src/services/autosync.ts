import OpenAI, { toFile } from 'openai';
import { config, isOpenAIEnabled } from '../config.js';
import { getSong, setSongLyricsOffset } from './songs.js';
import { downloadYouTubeAudioPreview } from './ytaudio.js';

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: config.openai.apiKey });
  return client;
}

interface WhisperWord {
  word: string;
  start: number; // seconds
  end: number;
}
interface WhisperVerbose {
  words?: WhisperWord[];
  segments?: { start: number; end: number; text: string; words?: WhisperWord[] }[];
}

export interface AutoSyncResult {
  offsetMs: number;
  matchedWords: string[];
  whisperFirstWordSec: number;
  lrcFirstLineMs: number;
  audioBytes: number;
}

const WORD_RE = /[a-zA-Z']+/g;

function normWord(s: string): string {
  return s.toLowerCase().replace(/[^a-z']/g, '');
}

function tokensFromText(s: string): string[] {
  return (s.toLowerCase().match(WORD_RE) ?? []).map(normWord).filter(Boolean);
}

/**
 * Aligns the lrclib lyrics to the actual audio of the YouTube video by
 * transcribing the first ~minute with Whisper and matching the first
 * lrclib line against what was actually heard.
 *
 * Returns the inferred offset and persists it on the song.
 */
export async function autoSyncSong(songId: number): Promise<AutoSyncResult> {
  if (!isOpenAIEnabled()) {
    throw new Error('OpenAI key is required for auto-sync.');
  }
  const song = getSong(songId);
  if (!song) throw new Error('song not found');
  if (song.sourceType !== 'youtube' || !song.youtubeId) {
    throw new Error('auto-sync only works for songs with a YouTube video');
  }
  if (song.lines.length === 0) {
    throw new Error('song has no lyric lines');
  }

  const { data, mime, filename } = await downloadYouTubeAudioPreview(song.youtubeId, {
    maxBytes: 1_800_000, // ~90 s of opus
    maxMs: 35_000,
  });

  const file = await toFile(data, filename, { type: mime });

  const verbose = (await getClient().audio.transcriptions.create({
    model: 'whisper-1',
    file,
    response_format: 'verbose_json',
    timestamp_granularities: ['word'],
    language: 'en',
  })) as unknown as WhisperVerbose;

  const heardWords = collectWords(verbose);
  if (heardWords.length === 0) {
    throw new Error('whisper returned no words');
  }

  // Build a flat list of lrclib words (with their line index) so we can later
  // back-track which lrclib line matches what whisper heard.
  const lyricTokens: { word: string; lineIdx: number }[] = [];
  for (let i = 0; i < song.lines.length && lyricTokens.length < 40; i++) {
    for (const w of tokensFromText(song.lines[i].text)) {
      lyricTokens.push({ word: w, lineIdx: i });
    }
  }
  if (lyricTokens.length === 0) {
    throw new Error('no usable lyric tokens');
  }

  // Find the longest contiguous match of lrclib tokens inside the heard list.
  // This is robust against Whisper mishearing the first or last word.
  const heardTokens = heardWords.map((w) => normWord(w.word));
  const match = findBestRun(lyricTokens.map((l) => l.word), heardTokens);
  if (!match || match.length < 2) {
    throw new Error(
      'could not align lyrics to audio (transcription did not match the first lines)',
    );
  }

  const firstLyricIdx = match.lyricStart;
  const firstHeardIdx = match.heardStart;

  const lrclibStartMs = song.lines[lyricTokens[firstLyricIdx].lineIdx].startMs;
  const heardStartSec = heardWords[firstHeardIdx].start;
  const heardStartMs = Math.round(heardStartSec * 1000);

  // offset semantics: lyricTimeMs = audioTimeMs - offset. So when audio is
  // at heardStartMs we want lyricTime to be lrclibStartMs.
  const offsetMs = heardStartMs - lrclibStartMs;

  setSongLyricsOffset(songId, offsetMs);

  return {
    offsetMs,
    matchedWords: match.length
      ? lyricTokens.slice(firstLyricIdx, firstLyricIdx + match.length).map((l) => l.word)
      : [],
    whisperFirstWordSec: heardStartSec,
    lrcFirstLineMs: lrclibStartMs,
    audioBytes: data.length,
  };
}

function collectWords(v: WhisperVerbose): WhisperWord[] {
  if (v.words && v.words.length > 0) return v.words;
  const out: WhisperWord[] = [];
  for (const seg of v.segments ?? []) {
    if (seg.words?.length) out.push(...seg.words);
    else {
      // Fall back: distribute words across the segment time linearly.
      const ws = (seg.text.match(WORD_RE) ?? []) as string[];
      const dur = Math.max(0.001, seg.end - seg.start);
      const step = dur / Math.max(1, ws.length);
      ws.forEach((w, i) => out.push({ word: w, start: seg.start + i * step, end: seg.start + (i + 1) * step }));
    }
  }
  return out;
}

interface MatchRun {
  lyricStart: number;
  heardStart: number;
  length: number;
}

function findBestRun(lyric: string[], heard: string[]): MatchRun | null {
  // Slide lyric over heard, find the alignment offset with the most matches
  // among the first L lyric tokens. We prefer alignments that match the
  // earliest possible lyric token to avoid syncing on a chorus repeat.
  const L = Math.min(lyric.length, 25);
  let best: MatchRun | null = null;

  for (let li = 0; li < Math.min(lyric.length, 8); li++) {
    for (let hi = 0; hi < heard.length; hi++) {
      let matches = 0;
      let runLen = 0;
      for (let k = 0; k < L && li + k < lyric.length && hi + k < heard.length; k++) {
        if (lyric[li + k] === heard[hi + k]) {
          matches++;
          runLen = k + 1;
        } else {
          // tolerate a single mismatch (Whisper often misses a word)
          if (matches === 0) break;
          if (k + 1 < L && lyric[li + k] === heard[hi + k + 1]) continue;
          break;
        }
      }
      if (matches >= 2) {
        if (
          !best ||
          matches > best.length ||
          (matches === best.length && hi < best.heardStart)
        ) {
          best = { lyricStart: li, heardStart: hi, length: runLen };
        }
      }
    }
    if (best && best.length >= 4) break;
  }
  return best;
}
