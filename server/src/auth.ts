import type { NextFunction, Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Role } from './db.js';

export interface SessionUser {
  id: number;
  name: string;
  role: Role;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: SessionUser;
  }
}

const COOKIE = 'session';
// Without JWT_SECRET we use a random per-process key: safe by default, sessions just reset on restart.
const fallbackSecret = randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.warn('JWT_SECRET is not set; using a random key, so sessions reset on every restart.');
}
const secret = (): string => process.env.JWT_SECRET || fallbackSecret;

export function setSession(res: Response, user: SessionUser): void {
  const token = jwt.sign(user, secret(), { expiresIn: '8h' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && process.env.INSECURE_COOKIE !== '1',
    maxAge: 8 * 60 * 60 * 1000,
  });
}

export function clearSession(res: Response): void {
  res.clearCookie(COOKIE);
}

export function readSession(req: Request, _res: Response, next: NextFunction): void {
  const token: unknown = req.cookies?.[COOKIE];
  if (typeof token === 'string') {
    try {
      const { id, name, role } = jwt.verify(token, secret()) as SessionUser;
      req.user = { id, name, role };
    } catch {
      // expired or tampered token: treat as logged out
    }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Please sign in.' });
    return;
  }
  next();
}

export function requireRole(role: Role) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.user?.role !== role) {
      res.status(403).json({ error: 'You do not have access to this action.' });
      return;
    }
    next();
  };
}
