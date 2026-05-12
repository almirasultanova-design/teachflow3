import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { config, isOpenAIEnabled, isYouTubeEnabled } from './config.js';
import { getDb } from './db/index.js';
import authRouter from './routes/auth.js';
import songsRouter from './routes/songs.js';
import translateRouter from './routes/translate.js';
import quizRouter from './routes/quiz.js';
import progressRouter from './routes/progress.js';
import catalogRouter from './routes/catalog.js';
import teacherRouter from './routes/teacher.js';
import { ensureSeedData } from './scripts/seedFn.js';

async function main() {
  // Initialize DB and seed demo data on first run.
  getDb();
  ensureSeedData();

  const app = express();
  app.use(
    cors({
      origin: config.clientOrigin,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '4mb' }));

  app.use('/uploads', express.static(config.uploadsDir, { maxAge: '7d' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      openai: isOpenAIEnabled(),
      youtube: isYouTubeEnabled(),
      time: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/catalog', catalogRouter);
  app.use('/api/songs', songsRouter);
  app.use('/api/translate', translateRouter);
  app.use('/api/quiz', quizRouter);
  app.use('/api/progress', progressRouter);
  app.use('/api/teacher', teacherRouter);

  app.use((_req, res) => res.status(404).json({ error: 'not found' }));

  app.listen(config.port, () => {
    const banner = [
      '',
      '  TeachFlow API',
      `   listening on http://localhost:${config.port}`,
      `   client:    ${config.clientOrigin}`,
      `   db:        ${path.relative(process.cwd(), config.databasePath)}`,
      `   uploads:   ${path.relative(process.cwd(), config.uploadsDir)}`,
      `   openai:    ${isOpenAIEnabled() ? 'enabled (' + config.openai.model + ')' : 'mock (no OPENAI_API_KEY)'}`,
      `   youtube:   ${isYouTubeEnabled() ? 'enabled' : 'disabled (no YOUTUBE_API_KEY)'}`,
      '',
    ].join('\n');
    console.log(banner);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
