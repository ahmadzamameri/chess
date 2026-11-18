/**
 * توقيع/تحقق توكن المشرف — منفصل عن توكن اللاعب.
 * نضيف `kind: 'admin'` داخل الحمولة حتى لا يُقبل توكن لاعب على مسارات الإدارة
 * (ولا العكس)، حتى لو استُخدم نفس السرّ.
 */
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { isAuthConfigured } from './credentials.js';

export interface AdminTokenPayload {
  adminId: number;
  username: string;
  role: 'super' | 'admin';
}

interface AdminTokenClaims extends AdminTokenPayload {
  kind: 'admin';
}

export function signAdminToken(payload: AdminTokenPayload): string | null {
  if (!isAuthConfigured()) return null;
  const claims: AdminTokenClaims = { ...payload, kind: 'admin' };
  return jwt.sign(claims, config.jwtSecret, { expiresIn: config.adminJwtExpiresIn } as jwt.SignOptions);
}

export function verifyAdminToken(token: string): AdminTokenPayload | null {
  if (!isAuthConfigured()) return null;
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as Partial<AdminTokenClaims>;
    if (decoded?.kind !== 'admin') return null;
    if (typeof decoded.adminId !== 'number' || typeof decoded.username !== 'string') return null;
    if (decoded.role !== 'super' && decoded.role !== 'admin') return null;
    return { adminId: decoded.adminId, username: decoded.username, role: decoded.role };
  } catch {
    return null;
  }
}
