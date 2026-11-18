/**
 * تشفير كلمات المرور (bcrypt) وتوقيع توكن الدخول (JWT).
 * لا تُخزَّن كلمة المرور نصًّا أبدًا — فقط hash.
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

const SALT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

export interface TokenPayload {
  userId: number;
  username: string;
}

/** هل ضُبط سرّ التوقيع؟ بدونه تُعطَّل الحسابات (فشل آمن، لا أسرار افتراضية). */
export function isAuthConfigured(): boolean {
  return config.jwtSecret.length >= 16;
}

export function signToken(payload: TokenPayload): string | null {
  if (!isAuthConfigured()) return null;
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload | null {
  if (!isAuthConfigured()) return null;
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as TokenPayload;
    if (typeof decoded?.userId !== 'number' || typeof decoded?.username !== 'string') return null;
    return { userId: decoded.userId, username: decoded.username };
  } catch {
    return null;
  }
}

/* ---------------- التحقق من صحة المدخلات ---------------- */

/** اسم المستخدم: 3–20 محرفًا، حروف/أرقام/شرطة سفلية/عربية. */
export function validateUsername(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  if (name.length < 3 || name.length > 20) return null;
  if (!/^[\p{L}\p{N}_]+$/u.test(name)) return null;
  return name;
}

/** بريد إلكتروني بصيغة معقولة وطول آمن. */
export function validateEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (email.length < 5 || email.length > 190) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null;
  return email;
}

/** كلمة المرور: 6 أحرف فأكثر (وحد أعلى يمنع إساءة الاستخدام). */
export function validatePassword(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (value.length < 6 || value.length > 100) return null;
  return value;
}
