/**
 * حفظ المباريات المنتهية + تحديث إحصاءات اللاعبين وتصنيف Elo.
 * كل شيء هنا "أفضل جهد": أي فشل يُسجَّل ولا يؤثر على سير اللعبة.
 */
import type { RowDataPacket } from 'mysql2';
import { execute, isDbReady, query } from '../db/pool.js';
import { newElo, scoresFromResult } from './elo.js';
import { findById } from './userService.js';
import type { GameEndReason, GameResult } from '../types.js';

export interface FinishedGame {
  gameUid: string;
  whiteUserId: number | null;
  blackUserId: number | null;
  whiteName: string;
  blackName: string;
  result: Exclude<GameResult, null>;
  endReason: GameEndReason;
  movesSan: string[];
  finalFen: string;
  startedAt: Date;
}

export interface GameRow extends RowDataPacket {
  id: number;
  game_uid: string;
  white_name: string;
  black_name: string;
  white_user_id: number | null;
  black_user_id: number | null;
  result: 'white' | 'black' | 'draw';
  end_reason: string;
  move_count: number;
  white_elo_after: number | null;
  black_elo_after: number | null;
  ended_at: Date;
}

/**
 * تسجيل مباراة منتهية.
 * - يُحفظ صف المباراة دائمًا (حتى لو كان اللاعبان ضيفين) للأرشيف.
 * - تُحدَّث إحصاءات (فوز/خسارة/تعادل) لكل لاعب **مسجّل**.
 * - يُحدَّث Elo فقط عندما يكون **كلاهما مسجّلًا** (منع رفع التصنيف على الضيوف).
 */
export async function recordFinishedGame(game: FinishedGame): Promise<void> {
  if (!isDbReady()) return;

  const scores = scoresFromResult(game.result);

  // اجلب تصنيفات اللاعبين المسجّلين قبل التحديث.
  const whiteUser = game.whiteUserId ? await findById(game.whiteUserId) : null;
  const blackUser = game.blackUserId ? await findById(game.blackUserId) : null;

  const bothRegistered = Boolean(whiteUser && blackUser);

  let whiteEloBefore: number | null = whiteUser ? whiteUser.elo : null;
  let blackEloBefore: number | null = blackUser ? blackUser.elo : null;
  let whiteEloAfter: number | null = whiteEloBefore;
  let blackEloAfter: number | null = blackEloBefore;

  if (bothRegistered && whiteUser && blackUser) {
    whiteEloAfter = newElo(whiteUser.elo, blackUser.elo, scores.white);
    blackEloAfter = newElo(blackUser.elo, whiteUser.elo, scores.black);
  }

  // 1) صف المباراة
  await execute(
    `INSERT INTO games
       (game_uid, white_user_id, black_user_id, white_name, black_name,
        result, end_reason, move_count, moves_san, final_fen,
        white_elo_before, white_elo_after, black_elo_before, black_elo_after, started_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      game.gameUid,
      game.whiteUserId,
      game.blackUserId,
      game.whiteName,
      game.blackName,
      game.result,
      game.endReason,
      game.movesSan.length,
      game.movesSan.join(' '),
      game.finalFen,
      whiteEloBefore,
      whiteEloAfter,
      blackEloBefore,
      blackEloAfter,
      game.startedAt,
    ],
  );

  // 2) إحصاءات + Elo لكل لاعب مسجّل
  if (whiteUser) {
    await updatePlayer(whiteUser.id, scores.white, bothRegistered ? whiteEloAfter : null);
  }
  if (blackUser) {
    await updatePlayer(blackUser.id, scores.black, bothRegistered ? blackEloAfter : null);
  }
}

async function updatePlayer(userId: number, score: number, eloAfter: number | null): Promise<void> {
  const winInc = score === 1 ? 1 : 0;
  const drawInc = score === 0.5 ? 1 : 0;
  const lossInc = score === 0 ? 1 : 0;

  if (eloAfter !== null) {
    await execute(
      `UPDATE users SET wins = wins + ?, draws = draws + ?, losses = losses + ?,
              games_played = games_played + 1, elo = ? WHERE id = ?`,
      [winInc, drawInc, lossInc, eloAfter, userId],
    );
  } else {
    await execute(
      `UPDATE users SET wins = wins + ?, draws = draws + ?, losses = losses + ?,
              games_played = games_played + 1 WHERE id = ?`,
      [winInc, drawInc, lossInc, userId],
    );
  }
}

/** آخر مباريات لاعب معيّن (لصفحة الملف الشخصي). */
export async function getUserGames(userId: number, limit = 20): Promise<GameRow[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
  const rows = await query<GameRow[]>(
    `SELECT * FROM games
     WHERE white_user_id = ? OR black_user_id = ?
     ORDER BY ended_at DESC LIMIT ${safeLimit}`,
    [userId, userId],
  );
  return rows ?? [];
}
