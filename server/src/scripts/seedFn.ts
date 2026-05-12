import { getDb } from '../db/index.js';
import { createSong } from '../services/songs.js';

interface DemoSong {
  title: string;
  artist: string;
  level: string;
  description: string;
  youtubeId?: string;
  coverUrl?: string;
  lrc: string;
  translations: Record<number, { translation: string; notes?: string }>;
}

// Public-domain children's nursery rhyme. Self-contained demo so the app works
// out of the box without an audio file (sourceType=virtual; player runs on a timer).
const TWINKLE: DemoSong = {
  title: 'Twinkle, Twinkle, Little Star',
  artist: 'Traditional',
  level: 'A1',
  description:
    'Классический английский стишок-колыбельная. Простой словарь, отличный старт для новичков.',
  lrc: `[ti:Twinkle, Twinkle, Little Star]
[ar:Traditional]
[00:00.00]Twinkle, twinkle, little star,
[00:04.00]How I wonder what you are!
[00:08.00]Up above the world so high,
[00:12.00]Like a diamond in the sky.
[00:16.00]Twinkle, twinkle, little star,
[00:20.00]How I wonder what you are!
[00:24.00]When the blazing sun is gone,
[00:28.00]When he nothing shines upon,
[00:32.00]Then you show your little light,
[00:36.00]Twinkle, twinkle, all the night.
[00:40.00]Twinkle, twinkle, little star,
[00:44.00]How I wonder what you are!`,
  translations: {
    0: { translation: 'Мерцай, мерцай, маленькая звёздочка,' },
    1: { translation: 'Как же я гадаю, кто же ты!' },
    2: { translation: 'Высоко над миром,' },
    3: { translation: 'Словно алмаз в небе.' },
    4: { translation: 'Мерцай, мерцай, маленькая звёздочка,' },
    5: { translation: 'Как же я гадаю, кто же ты!' },
    6: { translation: 'Когда пылающее солнце уходит,', notes: '*blazing* — ярко горящий, пылающий.' },
    7: { translation: 'Когда оно ни на что не светит,' },
    8: { translation: 'Тогда ты показываешь свой маленький свет,' },
    9: { translation: 'Мерцай, мерцай всю ночь напролёт.' },
    10: { translation: 'Мерцай, мерцай, маленькая звёздочка,' },
    11: { translation: 'Как же я гадаю, кто же ты!' },
  },
};

// Original lyrics written for this app — useful for showcasing slang/idiom features
// without copyright concerns. Designed at B1 level with several idioms.
const CITY_LIGHTS: DemoSong = {
  title: 'City Lights (Demo)',
  artist: 'Techflow Demo',
  level: 'B1',
  description:
    'Авторский демо-трек, написанный для этого приложения. Содержит идиомы и разговорные обороты для тренировки.',
  lrc: `[ti:City Lights (Demo)]
[ar:Techflow Demo]
[00:00.00]I'm hanging out under the city lights
[00:04.50]Chasing dreams that I can't seem to hold
[00:09.00]My heart is racing, but I'm gonna be alright
[00:13.50]The night is young and the story's still untold
[00:18.00]Break a leg, my friend, the show is on
[00:22.50]We're gonna paint the town until the dawn
[00:27.00]Don't beat around the bush, just say it loud
[00:31.50]I'm on cloud nine, lost in this crazy crowd
[00:36.00]The city never sleeps and neither do I
[00:40.50]We're burning bridges, watching stars go by
[00:45.00]Tomorrow's just a word, today is real
[00:49.50]This is how it feels, this is how it feels`,
  translations: {
    0: {
      translation: 'Я тусуюсь под городскими огнями',
      notes: '*hang out* (sl.) — тусоваться, проводить время.',
    },
    1: {
      translation: 'Гоняюсь за мечтами, которые мне никак не удержать',
      notes: '*chase dreams* — устойчивое выражение «гнаться за мечтой».',
    },
    2: {
      translation: 'Сердце бьётся бешено, но всё будет в порядке',
      notes: '*gonna* (sl.) = *going to*; *alright* — «нормально, в порядке».',
    },
    3: { translation: 'Ночь только начинается, история ещё не рассказана' },
    4: {
      translation: 'Удачи, друг, шоу началось',
      notes: '*break a leg* (idiom) — «ни пуха, ни пера», пожелание удачи перед выступлением.',
    },
    5: {
      translation: 'Мы будем гулять до рассвета',
      notes: '*paint the town (red)* (idiom) — отрываться, шумно гулять.',
    },
    6: {
      translation: 'Не ходи вокруг да около, говори прямо',
      notes: '*beat around the bush* (idiom) — ходить вокруг да около, не говорить по сути.',
    },
    7: {
      translation: 'Я на седьмом небе, потерян в этой безумной толпе',
      notes: '*on cloud nine* (idiom) — «на седьмом небе от счастья».',
    },
    8: { translation: 'Город никогда не спит, как и я' },
    9: {
      translation: 'Сжигаем мосты, смотрим, как уходят звёзды',
      notes: '*burning bridges* (idiom) — сжигать мосты, рвать связи окончательно.',
    },
    10: { translation: 'Завтра — это просто слово, реально только сегодня' },
    11: { translation: 'Вот как это ощущается, вот как это ощущается' },
  },
};

function songExists(title: string, artist: string): boolean {
  const row = getDb()
    .prepare(`SELECT id FROM songs WHERE title = ? AND artist = ?`)
    .get(title, artist) as { id: number } | undefined;
  return Boolean(row);
}

function seedSong(demo: DemoSong) {
  if (songExists(demo.title, demo.artist)) return;

  const detail = createSong({
    title: demo.title,
    artist: demo.artist,
    sourceType: demo.youtubeId ? 'youtube' : 'virtual',
    youtubeId: demo.youtubeId ?? null,
    coverUrl: demo.coverUrl ?? null,
    level: demo.level,
    description: demo.description,
    lrc: demo.lrc,
  });

  const update = getDb().prepare(
    `UPDATE lyric_lines SET translation = ?, notes = ? WHERE song_id = ? AND line_index = ?`,
  );
  for (const [idxStr, t] of Object.entries(demo.translations)) {
    update.run(t.translation, t.notes ?? null, detail.id, Number(idxStr));
  }
}

export function ensureSeedData(): void {
  seedSong(TWINKLE);
  seedSong(CITY_LIGHTS);
}
