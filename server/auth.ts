import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const SESSION_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

export interface AuthPayload {
  uid: string;
  role: 'member' | 'admin';
  email: string;
  name: string;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

export function safeCompareStrings(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function signToken(payload: Omit<AuthPayload, 'exp'>): string {
  const fullPayload: AuthPayload = {
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 24,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyToken(token: string): AuthPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');

  if (!safeCompareStrings(sig, expectedSig)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as AuthPayload;
    if (!parsed.uid || !parsed.role || !parsed.exp || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Sesi autentikasi diperlukan. Silakan masuk terlebih dahulu.' });
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Sesi tidak valid atau telah berakhir. Silakan masuk ulang.' });
    return;
  }
  req.user = payload;
  next();
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Akses ditolak. Fitur ini khusus pengelola (Admin).' });
    return;
  }
  next();
}
