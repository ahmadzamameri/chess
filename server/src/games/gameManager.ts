/**
 * مدير المباريات — تخزين في الذاكرة (Map) في النسخة الأولى.
 * كل الوصول للمباريات يمرّ من هنا، بحيث يمكن لاحقًا استبدال التخزين بـ MySQL
 * دون تغيير بقية الكود (نفس الواجهة العامة).
 */
import { GameSession } from './gameSession.js';
import type { Color, Player } from '../types.js';
import type { TimeControl } from '../timeControls.js';
import { generateGameId } from '../utils.js';

interface DisconnectTimer {
  color: Color;
  timeout: NodeJS.Timeout;
}

export class GameManager {
  private games = new Map<string, GameSession>();

  /** فهرس sessionId → gameId لإيجاد مباراة اللاعب بسرعة عند إعادة الاتصال. */
  private sessionIndex = new Map<string, string>();

  /** مؤقّتات مهلة الانقطاع لكل مباراة. */
  private disconnectTimers = new Map<string, DisconnectTimer>();

  /** مؤقّتات سقوط الراية (انتهاء الوقت) لكل مباراة. */
  private flagTimers = new Map<string, NodeJS.Timeout>();

  create(white: Player, black: Player, timeControl: TimeControl): GameSession {
    const gameId = generateGameId();
    const game = new GameSession(gameId, white, black, timeControl);
    this.games.set(gameId, game);
    this.sessionIndex.set(white.sessionId, gameId);
    this.sessionIndex.set(black.sessionId, gameId);
    return game;
  }

  get(gameId: string): GameSession | undefined {
    return this.games.get(gameId);
  }

  /** إيجاد مباراة نشطة يخصّها sessionId (لإعادة الاتصال بعد تحديث الصفحة). */
  findBySession(sessionId: string): GameSession | undefined {
    const gameId = this.sessionIndex.get(sessionId);
    if (!gameId) return undefined;
    return this.games.get(gameId);
  }

  /* ---------- مؤقّتات الانقطاع ---------- */

  hasDisconnectTimer(gameId: string): boolean {
    return this.disconnectTimers.has(gameId);
  }

  startDisconnectTimer(gameId: string, color: Color, ms: number, onExpire: () => void): void {
    this.clearDisconnectTimer(gameId);
    const timeout = setTimeout(onExpire, ms);
    this.disconnectTimers.set(gameId, { color, timeout });
  }

  clearDisconnectTimer(gameId: string): void {
    const existing = this.disconnectTimers.get(gameId);
    if (existing) {
      clearTimeout(existing.timeout);
      this.disconnectTimers.delete(gameId);
    }
  }

  /* ---------- مؤقّت سقوط الراية ---------- */

  /**
   * يُعاد جدولته بعد كل نقلة: يستيقظ عند نفاد وقت صاحب الدور.
   * الجلسة تتحقق فعليًا من الوقت قبل الحسم، فلا ضرر من استيقاظ مبكر.
   */
  scheduleFlagTimer(game: GameSession, onFlag: () => void): void {
    this.clearFlagTimer(game.gameId);
    const ms = game.msUntilFlag();
    if (!Number.isFinite(ms)) return;
    const timeout = setTimeout(onFlag, Math.max(0, ms) + 50);
    this.flagTimers.set(game.gameId, timeout);
  }

  clearFlagTimer(gameId: string): void {
    const existing = this.flagTimers.get(gameId);
    if (existing) {
      clearTimeout(existing);
      this.flagTimers.delete(gameId);
    }
  }

  /* ---------- تنظيف ---------- */

  /** حذف مباراة منتهية وتحرير الفهارس (يُستدعى بعد فترة من الانتهاء). */
  remove(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game) return;
    this.clearDisconnectTimer(gameId);
    this.clearFlagTimer(gameId);
    this.sessionIndex.delete(game.white.sessionId);
    this.sessionIndex.delete(game.black.sessionId);
    this.games.delete(gameId);
  }
}

export const gameManager = new GameManager();
