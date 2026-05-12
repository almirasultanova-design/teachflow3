import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// server/src/config.ts -> server/
const SERVER_ROOT = path.resolve(__dirname, '..');

function resolvePath(p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(SERVER_ROOT, p);
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databasePath: resolvePath(process.env.DATABASE_PATH ?? './data/lyricling.db'),
  uploadsDir: resolvePath(process.env.UPLOADS_DIR ?? './data/uploads'),
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:4000',
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  auth: {
    jwtSecret: process.env.JWT_SECRET ?? 'dev-insecure-secret-change-me',
    cookieName: process.env.AUTH_COOKIE_NAME ?? 'tf_auth',
    cookieSecure: (process.env.COOKIE_SECURE ?? 'false').toLowerCase() === 'true',
    tokenTtlSeconds: Number(process.env.AUTH_TOKEN_TTL_SECONDS ?? 60 * 60 * 24 * 30),
  },
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY ?? '',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  },
  serverRoot: SERVER_ROOT,
} as const;

export const isOpenAIEnabled = (): boolean => Boolean(config.openai.apiKey);
export const isYouTubeEnabled = (): boolean => Boolean(config.youtube.apiKey);
