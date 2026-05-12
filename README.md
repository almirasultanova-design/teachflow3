# TeachFlow

> Учи английский по любимой музыке. Синхронизированные субтитры с переводом каждого слова, разбором сленга и идиом, и тестами в конце прослушивания.

TeachFlow — фулл-стек веб-приложение, вдохновлённое 2sub для фильмов, но для музыки. Слушай трек, кликай по любому слову — получай контекстный перевод, транскрипцию, примеры. Кликни по строке — увидишь литературный и дословный переводы плюс разбор идиом. После прослушивания — мини-тест по словам и переводам.

## Возможности

- **Три источника аудио**: загрузка `mp3` + `LRC`, ссылка на YouTube, или режим без аудио (виртуальный плеер по таймеру).
- **Синхронизированная лирика**: автоскролл по таймингам LRC, активная строка подсвечивается, двойной клик — перемотка к строке.
- **Кликни по слову**: контекстный перевод, IPA, часть речи, альтернативные значения, примеры использования. Слова можно сохранять в личный словарь.
- **Кликни по строке**: дословный + литературный перевод, разбор сленга и идиом, культурные заметки.
- **Тесты**: fill-in-the-blank, match (слово ↔ перевод), полный перевод строки. История попыток сохраняется.
- **Личный словарь**: все сохранённые слова с тремя статусами (`new`/`learning`/`known`) и счётчиком повторений.
- **OpenAI или mock**: с ключом — умные контекстные переводы и разбор сленга. Без ключа — локальный мини-словарь и заглушки, чтобы UI работал.
- **Двуязычный интерфейс**: переключатель RU/EN в шапке.

## Технологии

| Слой | Стек |
| --- | --- |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, Zustand, React Router |
| Backend  | Node.js 18+, Express, TypeScript, better-sqlite3, multer, zod, OpenAI SDK |
| Структура | npm workspaces (`client`, `server`, `shared`) |

## Структура проекта

```
TeachFlow/
├── client/        # React + Vite приложение
├── server/        # Express API + SQLite
├── shared/        # Общие TypeScript-типы
├── package.json   # workspaces root
└── .env.example
```

## Быстрый старт

### 1. Требования

- Node.js **18.17+** (на 18 better-sqlite3 уже работает; на 20+ установка быстрее).
- npm 9+.
- Windows / macOS / Linux. На Windows для `better-sqlite3` нужен установленный VS Build Tools или быть под Node ≥ 20, где доступны pre-built бинарники.

### 2. Установка

```bash
npm install
```

Эта команда установит зависимости всех воркспейсов (`client`, `server`, `shared`).

### 3. Конфигурация

Скопируй `.env.example` в `server/.env`:

```bash
cp .env.example server/.env
```

Без правок сервер уже стартует — но переводы будут заглушечными. Чтобы получать настоящие умные переводы, добавь ключ:

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

### 4. Запуск

```bash
npm run dev
```

Эта команда параллельно запускает:

- backend на `http://localhost:4000`
- frontend на `http://localhost:5173`

При первом старте сервер автоматически создаст SQLite-базу и засеет две демо-песни:

1. **Twinkle, Twinkle, Little Star** (public domain) — простой A1, идеальный старт.
2. **City Lights (Demo)** — авторский трек с идиомами уровня B1 (`break a leg`, `paint the town`, `on cloud nine`, `burn bridges`, …).

Обе песни идут в режиме `virtual` — без аудиофайла, плеер прокручивает тайминги по таймеру. Можно сразу понажимать на слова и пройти тест.

### 5. Добавление своих песен

В библиотеке нажми «Добавить песню» и выбери способ:

- **Загрузить файл**: укажи `mp3/m4a/ogg` и `.lrc` (или вставь LRC текстом). Аудио сохраняется в `server/data/uploads`.
- **YouTube**: вставь ссылку или ID видео + текст лирики в формате LRC. Видео встраивается через iframe API.
- **Только текст**: лирика без аудио — плеер прокручивает тайминги по виртуальному часу.

Формат LRC поддерживается базовый:

```
[ti:Song Title]
[ar:Artist]
[00:12.50]First line
[00:16.00]Second line
[00:19.80]Third line
```

## Дополнительные команды

```bash
npm run dev:server    # только backend
npm run dev:client    # только frontend
npm run seed          # пересеять демо-песни
npm run build         # production-сборка обоих
npm start             # запуск собранного backend
```

## Эндпоинты API

| Метод | Путь | Описание |
| --- | --- | --- |
| GET | `/api/health` | Статус, флаг доступности OpenAI |
| GET | `/api/songs` | Список песен |
| GET | `/api/songs/:id` | Песня + строки лирики |
| POST | `/api/songs/upload` | multipart: `audio`, `lrc`, поля `title`, `artist`, … |
| POST | `/api/songs/youtube` | JSON: `title`, `artist`, `youtubeId`, `lrc` |
| POST | `/api/songs/virtual` | JSON: `title`, `artist`, `lrc` |
| DELETE | `/api/songs/:id` | Удалить песню |
| POST | `/api/translate/word` | `{ word, lineId?, lineText?, songId? }` → `WordTranslation` |
| POST | `/api/translate/line` | `{ lineId }` → `LineTranslation` (литературный + дословный + сленг) |
| GET | `/api/quiz/song/:id` | Сгенерированный тест по песне |
| POST | `/api/quiz/attempt` | Сохранить попытку |
| GET | `/api/quiz/attempts` | История попыток |
| GET, POST, PATCH, DELETE | `/api/progress/words[...]` | Личный словарь |
| GET | `/api/progress/summary` | Сводная статистика |

## Идеи для развития

- Word-level тайминги (Enhanced LRC) для подсветки слова в момент исполнения.
- Spaced-repetition (SM-2) для словаря.
- Импорт лирики из Genius/Musixmatch + автотайминг через Whisper.
- Аккаунты пользователей (сейчас приложение однопользовательское).
- Экспорт словаря в Anki.

## Лицензия

MIT.
