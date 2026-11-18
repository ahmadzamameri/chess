/**
 * عمليات لوحة التحكم على قاعدة البيانات.
 * كل الدوال آمنة الفشل: تُرجع null/قيمة فارغة عند تعذّر القاعدة بدل رمي استثناء.
 */
import type { RowDataPacket } from 'mysql2';
import { execute, isDbReady, query } from '../db/pool.js';
import { verifyPassword } from '../auth/credentials.js';

export interface AdminRow extends RowDataPacket {
  id: number;
  username: string;
  password_hash: string;
  role: 'super' | 'admin';
  is_active: number;
  created_at: Date;
  last_login_at: Date | null;
}

export async function findAdminById(id: number): Promise<AdminRow | null> {
  const rows = await query<AdminRow[]>('SELECT * FROM admins WHERE id = ? LIMIT 1', [id]);
  return rows && rows.length ? rows[0] : null;
}

export async function findAdminByUsername(username: string): Promise<AdminRow | null> {
  const rows = await query<AdminRow[]>('SELECT * FROM admins WHERE username = ? LIMIT 1', [username]);
  return rows && rows.length ? rows[0] : null;
}

export type AdminLoginResult =
  | { ok: true; admin: AdminRow }
  | { ok: false; reason: 'db_unavailable' | 'invalid' | 'disabled' };

/**
 * دخول المشرف. رسالة الخطأ موحّدة عمدًا (لا نكشف وجود المستخدم من عدمه)،
 * ويُسجَّل كل محاولة في admin_login_log.
 */
export async function loginAdmin(
  username: string,
  password: string,
  ip: string | null,
): Promise<AdminLoginResult> {
  if (!isDbReady()) return { ok: false, reason: 'db_unavailable' };

  const admin = await findAdminByUsername(username.trim());

  const record = (adminId: number | null, success: boolean) =>
    execute(
      'INSERT INTO admin_login_log (admin_id, username, success, ip) VALUES (?, ?, ?, ?)',
      [adminId, username.trim().slice(0, 30), success ? 1 : 0, ip ? ip.slice(0, 45) : null],
    );

  if (!admin) {
    await record(null, false);
    return { ok: false, reason: 'invalid' };
  }

  const okPassword = await verifyPassword(password, admin.password_hash);
  if (!okPassword) {
    await record(admin.id, false);
    return { ok: false, reason: 'invalid' };
  }

  if (!admin.is_active) {
    await record(admin.id, false);
    return { ok: false, reason: 'disabled' };
  }

  await record(admin.id, true);
  await execute('UPDATE admins SET last_login_at = NOW() WHERE id = ?', [admin.id]);
  return { ok: true, admin };
}

/* ----------------------------- الإحصاءات ----------------------------- */

export interface AdminStats {
  totalPlayers: number;
  totalGames: number;
  gamesToday: number;
  newPlayersToday: number;
}

interface CountRow extends RowDataPacket {
  n: number;
}

async function countOne(sql: string): Promise<number> {
  const rows = await query<CountRow[]>(sql);
  return rows && rows.length ? Number(rows[0].n) : 0;
}

export async function getAdminStats(): Promise<AdminStats> {
  const [totalPlayers, totalGames, gamesToday, newPlayersToday] = await Promise.all([
    countOne('SELECT COUNT(*) AS n FROM users'),
    countOne('SELECT COUNT(*) AS n FROM games'),
    countOne('SELECT COUNT(*) AS n FROM games WHERE DATE(ended_at) = CURDATE()'),
    countOne('SELECT COUNT(*) AS n FROM users WHERE DATE(created_at) = CURDATE()'),
  ]);
  return { totalPlayers, totalGames, gamesToday, newPlayersToday };
}

/* --------------------------- قائمة اللاعبين --------------------------- */

export interface PlayerListRow extends RowDataPacket {
  id: number;
  username: string;
  email: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  games_played: number;
  created_at: Date;
  last_login_at: Date | null;
}

export interface AdminPlayer {
  id: number;
  username: string;
  email: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
  createdAt: string;
  lastLoginAt: string | null;
}

function toAdminPlayer(r: PlayerListRow): AdminPlayer {
  return {
    id: r.id,
    username: r.username,
    email: r.email,
    elo: r.elo,
    wins: r.wins,
    losses: r.losses,
    draws: r.draws,
    gamesPlayed: r.games_played,
    createdAt: new Date(r.created_at).toISOString(),
    lastLoginAt: r.last_login_at ? new Date(r.last_login_at).toISOString() : null,
  };
}

/** قائمة اللاعبين مع بحث اختياري بالاسم/البريد. */
export async function getPlayers(search: string, limit = 50): Promise<AdminPlayer[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 200);
  const term = search.trim().slice(0, 50);

  let rows: PlayerListRow[] | null;
  if (term) {
    const like = `%${term}%`;
    rows = await query<PlayerListRow[]>(
      `SELECT * FROM users WHERE username LIKE ? OR email LIKE ?
       ORDER BY created_at DESC LIMIT ${safeLimit}`,
      [like, like],
    );
  } else {
    rows = await query<PlayerListRow[]>(
      `SELECT * FROM users ORDER BY created_at DESC LIMIT ${safeLimit}`,
    );
  }
  return rows ? rows.map(toAdminPlayer) : [];
}

/* --------------------------- آخر المباريات --------------------------- */

export interface RecentGameRow extends RowDataPacket {
  id: number;
  white_name: string;
  black_name: string;
  result: 'white' | 'black' | 'draw';
  end_reason: string;
  move_count: number;
  ended_at: Date;
}

export interface AdminRecentGame {
  id: number;
  whiteName: string;
  blackName: string;
  result: 'white' | 'black' | 'draw';
  endReason: string;
  moveCount: number;
  endedAt: string;
}

export async function getRecentGames(limit = 20): Promise<AdminRecentGame[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const rows = await query<RecentGameRow[]>(
    `SELECT id, white_name, black_name, result, end_reason, move_count, ended_at
     FROM games ORDER BY ended_at DESC LIMIT ${safeLimit}`,
  );
  return rows
    ? rows.map((g) => ({
        id: g.id,
        whiteName: g.white_name,
        blackName: g.black_name,
        result: g.result,
        endReason: g.end_reason,
        moveCount: g.move_count,
        endedAt: new Date(g.ended_at).toISOString(),
      }))
    : [];
}

/* --------------------- تفاصيل مباراة واحدة (للإعادة) --------------------- */

export interface GameDetailRow extends RowDataPacket {
  id: number;
  white_name: string;
  black_name: string;
  result: 'white' | 'black' | 'draw';
  end_reason: string;
  move_count: number;
  moves_san: string;
  final_fen: string;
  white_elo_before: number | null;
  white_elo_after: number | null;
  black_elo_before: number | null;
  black_elo_after: number | null;
  started_at: Date;
  ended_at: Date;
}

export interface AdminGameDetail {
  id: number;
  whiteName: string;
  blackName: string;
  result: 'white' | 'black' | 'draw';
  endReason: string;
  moveCount: number;
  /** نقلات المباراة بصيغة SAN، مقسّمة كمصفوفة (بلا أرقام النقلات). */
  movesSan: string[];
  finalFen: string;
  whiteEloBefore: number | null;
  whiteEloAfter: number | null;
  blackEloBefore: number | null;
  blackEloAfter: number | null;
  startedAt: string;
  endedAt: string;
}

export async function getGameById(id: number): Promise<AdminGameDetail | null> {
  const rows = await query<GameDetailRow[]>('SELECT * FROM games WHERE id = ? LIMIT 1', [id]);
  if (!rows || !rows.length) return null;
  const g = rows[0];
  return {
    id: g.id,
    whiteName: g.white_name,
    blackName: g.black_name,
    result: g.result,
    endReason: g.end_reason,
    moveCount: g.move_count,
    movesSan: g.moves_san ? g.moves_san.trim().split(/\s+/).filter(Boolean) : [],
    finalFen: g.final_fen,
    whiteEloBefore: g.white_elo_before,
    whiteEloAfter: g.white_elo_after,
    blackEloBefore: g.black_elo_before,
    blackEloAfter: g.black_elo_after,
    startedAt: new Date(g.started_at).toISOString(),
    endedAt: new Date(g.ended_at).toISOString(),
  };
}
