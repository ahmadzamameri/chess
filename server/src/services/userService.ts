/**
 * عمليات المستخدمين على قاعدة البيانات.
 * كل الدوال آمنة: تُرجع null عند تعذّر القاعدة بدل رمي استثناء.
 */
import type { RowDataPacket } from 'mysql2';
import { execute, isDbReady, query } from '../db/pool.js';
import { config } from '../config.js';
import { hashPassword, verifyPassword } from '../auth/credentials.js';

export interface UserRow extends RowDataPacket {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  games_played: number;
  created_at: Date;
}

/** الملف العام للمستخدم — ما يُرسل للواجهة (بلا بريد أو hash). */
export interface PublicProfile {
  id: number;
  username: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
  createdAt: string;
}

export function toPublicProfile(row: UserRow): PublicProfile {
  return {
    id: row.id,
    username: row.username,
    elo: row.elo,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    gamesPlayed: row.games_played,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function findByUsername(username: string): Promise<UserRow | null> {
  const rows = await query<UserRow[]>('SELECT * FROM users WHERE username = ? LIMIT 1', [username]);
  return rows && rows.length ? rows[0] : null;
}

export async function findByEmail(email: string): Promise<UserRow | null> {
  const rows = await query<UserRow[]>('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  return rows && rows.length ? rows[0] : null;
}

export async function findById(id: number): Promise<UserRow | null> {
  const rows = await query<UserRow[]>('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  return rows && rows.length ? rows[0] : null;
}

export type RegisterResult =
  | { ok: true; user: UserRow }
  | { ok: false; reason: 'db_unavailable' | 'username_taken' | 'email_taken' | 'failed' };

export async function registerUser(
  username: string,
  email: string,
  password: string,
): Promise<RegisterResult> {
  if (!isDbReady()) return { ok: false, reason: 'db_unavailable' };

  if (await findByUsername(username)) return { ok: false, reason: 'username_taken' };
  if (await findByEmail(email)) return { ok: false, reason: 'email_taken' };

  const hash = await hashPassword(password);
  const result = await execute(
    'INSERT INTO users (username, email, password_hash, elo) VALUES (?, ?, ?, ?)',
    [username, email, hash, config.eloStart],
  );
  if (!result) return { ok: false, reason: 'failed' };

  const user = await findById(result.insertId);
  if (!user) return { ok: false, reason: 'failed' };
  return { ok: true, user };
}

export type LoginResult =
  | { ok: true; user: UserRow }
  | { ok: false; reason: 'db_unavailable' | 'invalid' };

/** الدخول بالاسم أو البريد. رسالة الخطأ موحّدة عمدًا حتى لا تكشف وجود الحساب. */
export async function loginUser(identifier: string, password: string): Promise<LoginResult> {
  if (!isDbReady()) return { ok: false, reason: 'db_unavailable' };

  const id = identifier.trim();
  const user = id.includes('@')
    ? await findByEmail(id.toLowerCase())
    : await findByUsername(id);

  if (!user) return { ok: false, reason: 'invalid' };

  const okPassword = await verifyPassword(password, user.password_hash);
  if (!okPassword) return { ok: false, reason: 'invalid' };

  await execute('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
  return { ok: true, user };
}

/** أفضل اللاعبين حسب التصنيف. */
export async function getLeaderboard(limit = 50): Promise<PublicProfile[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const rows = await query<UserRow[]>(
    `SELECT * FROM users WHERE games_played > 0
     ORDER BY elo DESC, wins DESC LIMIT ${safeLimit}`,
  );
  return rows ? rows.map(toPublicProfile) : [];
}
