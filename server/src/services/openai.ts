import OpenAI from 'openai';
import { config, isOpenAIEnabled } from '../config.js';
import type { LineTranslation, WordTranslation } from '@lyricling/shared';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: config.openai.apiKey });
  return client;
}

const WORD_SYSTEM = `You are a precise English-to-Russian dictionary tuned for song lyrics learners.
Given a single English word and the line it appears in, return STRICT JSON:
{
  "word": string,
  "lemma": string,
  "partOfSpeech": "noun" | "verb" | "adjective" | "adverb" | "pronoun" | "preposition" | "conjunction" | "interjection" | "phrase" | "other",
  "ipa": string,
  "translation": string,           // best Russian translation IN THIS CONTEXT (1-3 words)
  "alternatives": string[],        // up to 4 other common Russian translations
  "slang": boolean,                // true if the word is slang or colloquial in this line
  "explanation": string,           // 1-2 sentences in Russian explaining nuance/usage in this line
  "examples": [ { "en": string, "ru": string }, ... up to 2 ]
}
No prose, only JSON.`;

const LINE_SYSTEM = `You are an English-to-Russian translator specialized in song lyrics.
Given an English line and surrounding context, return STRICT JSON:
{
  "literal": string,        // word-for-word literal translation (Russian)
  "natural": string,        // natural, idiomatic Russian translation
  "notes": string,          // optional: cultural/grammatical notes in Russian (or empty string)
  "slang": [ { "phrase": string, "meaning": string } ]  // slang/idioms in the line, meaning in Russian
}
No prose, only JSON.`;

const QUIZ_SYSTEM = `You generate compact JSON quizzes that test understanding of English song lyrics for Russian learners.
Always return STRICT JSON of the exact shape requested. No prose.`;

export interface TranslationOutcome<T> {
  result: T;
  /** True only when the result came from OpenAI; false for any local/mock fallback. */
  fromOpenAI: boolean;
  /** Optional human-readable degradation reason (rate limit, quota, network, etc.). */
  reason?: string;
}

export async function translateWord(params: {
  word: string;
  lineText: string;
  songTitle?: string;
}): Promise<TranslationOutcome<WordTranslation>> {
  if (!isOpenAIEnabled()) {
    return { result: mockWordTranslation(params.word), fromOpenAI: false };
  }

  const userPrompt = `Word: "${params.word}"
Line: "${params.lineText}"
Song: ${params.songTitle ?? 'unknown'}`;

  try {
    const resp = await getClient().chat.completions.create({
      model: config.openai.model,
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        { role: 'system', content: WORD_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
    });

    const raw = resp.choices[0]?.message?.content ?? '{}';
    try {
      const parsed = JSON.parse(raw) as WordTranslation;
      return { result: { ...parsed, word: parsed.word || params.word }, fromOpenAI: true };
    } catch {
      return { result: mockWordTranslation(params.word), fromOpenAI: false };
    }
  } catch (err) {
    const reason = formatOpenAIError(err);
    console.warn('openai word translate failed:', reason);
    return { result: mockWordTranslation(params.word, reason), fromOpenAI: false, reason };
  }
}

export async function translateLine(params: {
  text: string;
  contextBefore?: string;
  contextAfter?: string;
  songTitle?: string;
}): Promise<TranslationOutcome<LineTranslation>> {
  if (!isOpenAIEnabled()) {
    return { result: mockLineTranslation(params.text), fromOpenAI: false };
  }

  const userPrompt = `Line: "${params.text}"
Previous: "${params.contextBefore ?? ''}"
Next: "${params.contextAfter ?? ''}"
Song: ${params.songTitle ?? 'unknown'}`;

  try {
    const resp = await getClient().chat.completions.create({
      model: config.openai.model,
      response_format: { type: 'json_object' },
      temperature: 0.3,
      messages: [
        { role: 'system', content: LINE_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
    });

    const raw = resp.choices[0]?.message?.content ?? '{}';
    try {
      return { result: JSON.parse(raw) as LineTranslation, fromOpenAI: true };
    } catch {
      return { result: mockLineTranslation(params.text), fromOpenAI: false };
    }
  } catch (err) {
    const reason = formatOpenAIError(err);
    console.warn('openai line translate failed:', reason);
    return { result: mockLineTranslation(params.text, reason), fromOpenAI: false, reason };
  }
}

export async function generateQuizFromLines(params: {
  songTitle: string;
  lines: { text: string; translation?: string | null }[];
}): Promise<{
  fillBlanks: { lineIndex: number; prompt: string; answers: string[] }[];
  matches: { en: string; ru: string }[];
  translateLines: { lineIndex: number }[];
}> {
  if (!isOpenAIEnabled()) return mockQuiz(params.lines);

  const numbered = params.lines
    .map((l, i) => `${i}: ${l.text}`)
    .join('\n');

  const userPrompt = `Song: ${params.songTitle}
Lines (with index):
${numbered}

Build a learner quiz with:
- 4 fill-in-the-blank items (pick interesting/useful words). Replace 1 word per line with "___" and return the answer.
- 6 vocabulary pairs (en word -> Russian translation) drawn from the lyrics.
- 2 line indices to translate fully.

Return JSON:
{
  "fillBlanks": [ { "lineIndex": number, "prompt": string, "answers": string[] } ],
  "matches": [ { "en": string, "ru": string } ],
  "translateLines": [ { "lineIndex": number } ]
}`;

  try {
    const resp = await getClient().chat.completions.create({
      model: config.openai.model,
      response_format: { type: 'json_object' },
      temperature: 0.4,
      messages: [
        { role: 'system', content: QUIZ_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
    });

    const raw = resp.choices[0]?.message?.content ?? '{}';
    try {
      return JSON.parse(raw);
    } catch {
      return mockQuiz(params.lines);
    }
  } catch (err) {
    console.warn('openai quiz failed, falling back to mock:', formatOpenAIError(err));
    return mockQuiz(params.lines);
  }
}

function formatOpenAIError(err: unknown): string {
  if (!err || typeof err !== 'object') return 'OpenAI request failed.';
  const e = err as { status?: number; code?: string; message?: string };
  if (e.code === 'insufficient_quota' || e.status === 429) {
    return 'Достигнут лимит OpenAI (429). Проверь баланс на platform.openai.com/billing.';
  }
  if (e.status === 401) return 'OpenAI отклонил ключ (401). Проверь OPENAI_API_KEY.';
  if (e.status === 403) return 'OpenAI вернул 403 — нет доступа к модели.';
  if (e.status && e.status >= 500) return 'OpenAI временно недоступен. Попробуй позже.';
  return e.message ?? 'OpenAI request failed.';
}

// ---------- Mocks (used when OPENAI_API_KEY is not set) ---------- //

const FALLBACK_DICT: Record<string, Partial<WordTranslation>> = {
  love: { translation: 'любовь', partOfSpeech: 'noun', ipa: 'lʌv' },
  heart: { translation: 'сердце', partOfSpeech: 'noun', ipa: 'hɑːrt' },
  night: { translation: 'ночь', partOfSpeech: 'noun', ipa: 'naɪt' },
  day: { translation: 'день', partOfSpeech: 'noun', ipa: 'deɪ' },
  light: { translation: 'свет', partOfSpeech: 'noun', ipa: 'laɪt' },
  fire: { translation: 'огонь', partOfSpeech: 'noun', ipa: 'ˈfaɪər' },
  hold: { translation: 'держать', partOfSpeech: 'verb', ipa: 'hoʊld' },
  feel: { translation: 'чувствовать', partOfSpeech: 'verb', ipa: 'fiːl' },
  know: { translation: 'знать', partOfSpeech: 'verb', ipa: 'noʊ' },
  see: { translation: 'видеть', partOfSpeech: 'verb', ipa: 'siː' },
  go: { translation: 'идти', partOfSpeech: 'verb', ipa: 'ɡoʊ' },
  away: { translation: 'прочь', partOfSpeech: 'adverb', ipa: 'əˈweɪ' },
  again: { translation: 'снова', partOfSpeech: 'adverb', ipa: 'əˈɡen' },
  forever: { translation: 'навсегда', partOfSpeech: 'adverb', ipa: 'fərˈevər' },
  star: { translation: 'звезда', partOfSpeech: 'noun', ipa: 'stɑːr' },
  sky: { translation: 'небо', partOfSpeech: 'noun', ipa: 'skaɪ' },
  dream: { translation: 'мечта', partOfSpeech: 'noun', ipa: 'driːm' },
  tonight: { translation: 'сегодня вечером', partOfSpeech: 'adverb', ipa: 'təˈnaɪt' },
  high: { translation: 'высокий', partOfSpeech: 'adjective', ipa: 'haɪ' },
  on: { translation: 'на', partOfSpeech: 'preposition', ipa: 'ɒn' },
  little: { translation: 'маленький', partOfSpeech: 'adjective', ipa: 'ˈlɪtl' },
  twinkle: { translation: 'мерцать', partOfSpeech: 'verb', ipa: 'ˈtwɪŋkl' },
  wonder: { translation: 'удивляться', partOfSpeech: 'verb', ipa: 'ˈwʌndər' },
  what: { translation: 'что', partOfSpeech: 'pronoun', ipa: 'wɒt' },
  you: { translation: 'ты / вы', partOfSpeech: 'pronoun', ipa: 'juː' },
  i: { translation: 'я', partOfSpeech: 'pronoun', ipa: 'aɪ' },
  are: { translation: 'есть (мн.ч.)', partOfSpeech: 'verb', ipa: 'ɑːr' },
  am: { translation: 'есть (1 л.)', partOfSpeech: 'verb', ipa: 'æm' },
  the: { translation: 'определ. артикль', partOfSpeech: 'other', ipa: 'ðə' },
  a: { translation: 'неопр. артикль', partOfSpeech: 'other', ipa: 'ə' },
};

function mockWordTranslation(word: string, reason?: string): WordTranslation {
  const key = word.toLowerCase().replace(/[^a-z']/g, '');
  const known = FALLBACK_DICT[key];
  const baseExplanation = known
    ? `«${word}» — словарное значение из локального мини-словаря.`
    : `Перевод для «${word}» не найден в локальном словаре.`;
  return {
    word,
    lemma: key,
    partOfSpeech: known?.partOfSpeech ?? 'other',
    ipa: known?.ipa ?? '',
    translation: known?.translation ?? `(перевод недоступен)`,
    alternatives: [],
    slang: false,
    explanation: reason
      ? `${baseExplanation} ${reason}`
      : `${baseExplanation} Подключите OPENAI_API_KEY для контекстных переводов.`,
    examples: [],
  };
}

function mockLineTranslation(text: string, reason?: string): LineTranslation {
  return {
    literal: '(дословный перевод недоступен)',
    natural: '(литературный перевод недоступен)',
    notes:
      reason ??
      'Без OpenAI используются заглушки. Установите OPENAI_API_KEY в server/.env.',
    slang: [],
  };
}

function mockQuiz(lines: { text: string }[]) {
  const usable = lines.filter((l) => l.text.split(/\s+/).length >= 3).slice(0, 6);
  const fillBlanks = usable.slice(0, 4).map((line) => {
    const words = line.text.split(/\s+/);
    const target = words.find((w) => /^[A-Za-z]{4,}$/.test(w)) ?? words[0];
    const prompt = line.text.replace(target, '___');
    const cleanAnswer = target.replace(/[^A-Za-z']/g, '');
    return {
      lineIndex: lines.indexOf(line),
      prompt,
      answers: [cleanAnswer],
    };
  });

  const matches = usable.slice(0, 6).map((l) => {
    const word = l.text.match(/[A-Za-z]{4,}/)?.[0] ?? 'love';
    const ru = FALLBACK_DICT[word.toLowerCase()]?.translation ?? '(перевод)';
    return { en: word, ru };
  });

  const translateLines = usable.slice(0, 2).map((l) => ({ lineIndex: lines.indexOf(l) }));
  return { fillBlanks, matches, translateLines };
}
