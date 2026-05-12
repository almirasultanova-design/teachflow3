import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export interface AuthUser {
  id: number;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

interface JwtPayload {
  sub: number;
  email: string;
}

function readToken(req: Request): string | null {
  const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.[
    config.auth.cookieName
  ];
  if (cookieToken) return cookieToken;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);
  return null;
}

function verify(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret) as unknown as JwtPayload;
    if (typeof decoded.sub !== 'number' || typeof decoded.email !== 'string') return null;
    return { id: decoded.sub, email: decoded.email };
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = readToken(req);
  if (!token) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const user = verify(token);
  if (!user) {
    res.status(401).json({ error: 'invalid token' });
    return;
  }
  req.user = user;
  next();
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = readToken(req);
  if (token) {
    const user = verify(token);
    if (user) req.user = user;
  }
  next();
}

export function signToken(user: AuthUser): string {
  const payload: JwtPayload = { sub: user.id, email: user.email };
  return jwt.sign(payload, config.auth.jwtSecret, {
    expiresIn: config.auth.tokenTtlSeconds,
  });
}
