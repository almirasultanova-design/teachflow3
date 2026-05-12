import { Router, type CookieOptions, type Response } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { createUser, findUserById, verifyPassword } from '../services/users.js';

const router = Router();

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.auth.cookieSecure,
    maxAge: config.auth.tokenTtlSeconds * 1000,
    path: '/',
  };
}

function setAuthCookie(res: Response, token: string) {
  res.cookie(config.auth.cookieName, token, cookieOptions());
}

function clearAuthCookie(res: Response) {
  res.clearCookie(config.auth.cookieName, { ...cookieOptions(), maxAge: 0 });
}

const registerBody = z.object({
  email: z.string().email().max(200),
  password: z.string().min(6).max(200),
  displayName: z.string().min(1).max(80).optional(),
  role: z.enum(['student', 'teacher']).optional(),
});

router.post('/register', async (req, res) => {
  const parsed = registerBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid body', details: parsed.error.flatten() });
  }
  try {
    const user = await createUser(parsed.data);
    const token = signToken({ id: user.id, email: user.email });
    setAuthCookie(res, token);
    res.status(201).json({ user });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'failed to register';
    if (msg.includes('UNIQUE') || msg.includes('users.email')) {
      return res.status(409).json({ error: 'email already registered' });
    }
    res.status(400).json({ error: msg });
  }
});

const loginBody = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

router.post('/login', async (req, res) => {
  const parsed = loginBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid body' });

  const user = await verifyPassword(parsed.data.email, parsed.data.password);
  if (!user) return res.status(401).json({ error: 'invalid email or password' });

  const token = signToken({ id: user.id, email: user.email });
  setAuthCookie(res, token);
  res.json({ user });
});

router.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.status(204).end();
});

router.get('/me', requireAuth, (req, res) => {
  const user = findUserById(req.user!.id);
  if (!user) {
    clearAuthCookie(res);
    return res.status(401).json({ error: 'unauthorized' });
  }
  res.json({ user });
});

export default router;
