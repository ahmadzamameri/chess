/**
 * منطق مباراة واحدة — chess.js هو المرجع الوحيد لقانونية النقلات وحالة المباراة.
 * هذه الطبقة معزولة عن Socket.IO ليسهُل اختبارها واستبدال التخزين بـ MySQL لاحقًا.
 */
import { Chess } from 'chess.js';
import type {
  Color,
  DrawOffer,
  GameEndReason,
  GameResult,
  GameStatePayload,
  GameStatus,
  MoveRecord,
  Player,
} from '../types.js';
import type { TimeControl } from '../timeControls.js';

export interface MoveInput {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
}

export type MoveOutcome =
  | { ok: true; state: GameStatePayload }
  | { ok: false; reason: string };

export class GameSession {
  readonly gameId: string;
  readonly createdAt: number;
  lastActivityAt: number;

  private chess: Chess;
  private status: GameStatus = 'active';
  private result: GameResult = null;
  private endReason: GameEndReason | null = null;
  private drawOffer: DrawOffer = null;

  readonly white: Player;
  readonly black: Player;

  /* ---------- الساعة (مرجعها السيرفر وحده) ---------- */
  readonly timeControl: TimeControl;
  /** الرصيد المخزَّن لكل لاعب بالمللي ثانية (لا يشمل الوقت الجاري الآن). */
  private whiteMs: number;
  private blackMs: number;
  /** لحظة بدء دور اللاعب الحالي — منها نحسب الوقت المنقضي. */
  private turnStartedAt: number;

  constructor(gameId: string, white: Player, black: Player, timeControl: TimeControl) {
    this.gameId = gameId;
    this.white = white;
    this.black = black;
    this.chess = new Chess();
    this.createdAt = Date.now();
    this.lastActivityAt = this.createdAt;

    this.timeControl = timeControl;
    this.whiteMs = timeControl.initial * 1000;
    this.blackMs = timeControl.initial * 1000;
    this.turnStartedAt = this.createdAt;
  }

  /* ---------- حسابات الوقت ---------- */

  /** الوقت المتبقي لِلون معيّن الآن (يخصم الوقت الجاري لصاحب الدور). */
  remainingMs(color: Color): number {
    const stored = color === 'white' ? this.whiteMs : this.blackMs;
    if (this.status !== 'active') return Math.max(0, stored);
    if (color !== this.turnColor()) return Math.max(0, stored);
    const elapsed = Date.now() - this.turnStartedAt;
    return Math.max(0, stored - elapsed);
  }

  /** كم يتبقى لصاحب الدور قبل سقوط الراية (لجدولة المؤقّت). */
  msUntilFlag(): number {
    if (this.status !== 'active') return Infinity;
    return this.remainingMs(this.turnColor());
  }

  /**
   * إنهاء المباراة بانتهاء وقت لاعب — يُستدعى من المؤقّت المجدول.
   * يتحقق فعليًا من انتهاء الوقت قبل الحسم (لا يثق بالمؤقّت وحده).
   */
  flagFall(): boolean {
    if (this.status !== 'active') return false;
    const loser = this.turnColor();
    if (this.remainingMs(loser) > 0) return false; // لم ينتهِ الوقت فعلًا

    // تُطبَّق قاعدة "عدم كفاية القطع للمات": لو الخصم لا يستطيع كش مات ⇒ تعادل.
    const winner: Color = loser === 'white' ? 'black' : 'white';
    if (this.chess.isInsufficientMaterial()) {
      this.finish('draw', 'timeout');
    } else {
      this.finish(winner, 'timeout');
    }
    if (loser === 'white') this.whiteMs = 0;
    else this.blackMs = 0;
    return true;
  }

  /* ---------- مساعدات داخلية ---------- */

  private touch(): void {
    this.lastActivityAt = Date.now();
  }

  private turnColor(): Color {
    return this.chess.turn() === 'w' ? 'white' : 'black';
  }

  getPlayer(color: Color): Player {
    return color === 'white' ? this.white : this.black;
  }

  /** إيجاد لون لاعب من sessionId — مصدر الثقة الوحيد لتحديد الهوية. */
  colorOfSession(sessionId: string): Color | null {
    if (this.white.sessionId === sessionId) return 'white';
    if (this.black.sessionId === sessionId) return 'black';
    return null;
  }

  isActive(): boolean {
    return this.status === 'active';
  }

  private buildMoveHistory(): MoveRecord[] {
    return this.chess.history({ verbose: true }).map((m) => ({
      san: m.san,
      from: m.from,
      to: m.to,
      color: m.color === 'w' ? 'white' : 'black',
    }));
  }

  /** الحالة العامة الآمنة التي تُرسل للعميل. */
  getState(): GameStatePayload {
    return {
      gameId: this.gameId,
      fen: this.chess.fen(),
      turn: this.turnColor(),
      status: this.status,
      moves: this.buildMoveHistory(),
      whiteName: this.white.name,
      blackName: this.black.name,
      whiteConnected: this.white.connected,
      blackConnected: this.black.connected,
      drawOffer: this.drawOffer,
      result: this.result,
      endReason: this.endReason,
      inCheck: this.chess.inCheck(),
      whiteMs: this.remainingMs('white'),
      blackMs: this.remainingMs('black'),
      timeControlId: this.timeControl.id,
      increment: this.timeControl.increment,
    };
  }

  /* ---------- إنهاء المباراة ---------- */

  private finish(result: GameResult, reason: GameEndReason): void {
    this.status = 'finished';
    this.result = result;
    this.endReason = reason;
    this.drawOffer = null;
    this.touch();
  }

  /** فحص أوضاع الانتهاء التلقائية بعد كل نقلة. */
  private checkAutoEnd(): void {
    if (this.chess.isCheckmate()) {
      // الفائز هو من نقل للتوّ = عكس دور اللاعب الحالي.
      const winner: Color = this.turnColor() === 'white' ? 'black' : 'white';
      this.finish(winner, 'checkmate');
      return;
    }
    if (this.chess.isStalemate()) {
      this.finish('draw', 'stalemate');
      return;
    }
    if (this.chess.isThreefoldRepetition()) {
      this.finish('draw', 'threefold_repetition');
      return;
    }
    if (this.chess.isInsufficientMaterial()) {
      this.finish('draw', 'insufficient_material');
      return;
    }
    if (this.chess.isDraw()) {
      // يشمل قاعدة الخمسين نقلة.
      this.finish('draw', 'fifty_move');
    }
  }

  /* ---------- الأفعال ---------- */

  /**
   * تنفيذ نقلة بعد التحقق من الدور واللون.
   * @param byColor لون اللاعب المُتحقّق منه عبر sessionId (لا من العميل).
   */
  applyMove(byColor: Color, move: MoveInput): MoveOutcome {
    if (this.status !== 'active') {
      return { ok: false, reason: 'المباراة انتهت.' };
    }
    if (byColor !== this.turnColor()) {
      return { ok: false, reason: 'ليس دورك.' };
    }

    // إن كان وقته قد نفد فعلًا قبل وصول النقلة ⇒ تُحسم بانتهاء الوقت لا بالنقلة.
    if (this.remainingMs(byColor) <= 0) {
      this.flagFall();
      return { ok: false, reason: 'انتهى وقتك.' };
    }

    // منع تحريك قطع الخصم: chess.js لن يسمح أصلًا بنقل قطعة ليست للجانب صاحب الدور،
    // والتحقق من الدور أعلاه يضمن أن byColor == صاحب الدور.
    let executed;
    try {
      executed = this.chess.move({
        from: move.from,
        to: move.to,
        promotion: move.promotion ?? 'q',
      });
    } catch {
      executed = null;
    }

    if (!executed) {
      return { ok: false, reason: 'نقلة غير قانونية.' };
    }

    // خصم الوقت المنقضي من صاحب النقلة + إضافة الزيادة، ثم بدء دور الخصم.
    const now = Date.now();
    const elapsed = now - this.turnStartedAt;
    const incrementMs = this.timeControl.increment * 1000;
    if (byColor === 'white') {
      this.whiteMs = Math.max(0, this.whiteMs - elapsed) + incrementMs;
    } else {
      this.blackMs = Math.max(0, this.blackMs - elapsed) + incrementMs;
    }
    this.turnStartedAt = now;

    // أي نقلة جديدة تُلغي عرض التعادل القائم.
    this.drawOffer = null;
    this.touch();
    this.checkAutoEnd();

    return { ok: true, state: this.getState() };
  }

  /** استسلام لاعب — الطرف الآخر يفوز. */
  resign(byColor: Color): boolean {
    if (this.status !== 'active') return false;
    const winner: Color = byColor === 'white' ? 'black' : 'white';
    this.finish(winner, 'resign');
    return true;
  }

  /** عرض تعادل — يُسجَّل من عرضه إن لم يكن هناك عرض قائم منه. */
  offerDraw(byColor: Color): boolean {
    if (this.status !== 'active') return false;
    if (this.drawOffer === byColor) return false; // عرض مكرّر
    this.drawOffer = byColor;
    this.touch();
    return true;
  }

  /** الرد على عرض التعادل من الطرف الآخر. */
  respondDraw(byColor: Color, accept: boolean): boolean {
    if (this.status !== 'active') return false;
    if (!this.drawOffer || this.drawOffer === byColor) return false; // لا عرض من الخصم
    if (accept) {
      this.finish('draw', 'draw_agreed');
    } else {
      this.drawOffer = null;
      this.touch();
    }
    return true;
  }

  /** حسم المباراة بالانقطاع بعد انتهاء المهلة — الطرف المتصل يفوز. */
  finishByDisconnect(loserColor: Color): boolean {
    if (this.status !== 'active') return false;
    const winner: Color = loserColor === 'white' ? 'black' : 'white';
    this.finish(winner, 'disconnect');
    return true;
  }

  /* ---------- إدارة الاتصال ---------- */

  setConnected(color: Color, connected: boolean, socketId: string | null): void {
    const player = this.getPlayer(color);
    player.connected = connected;
    player.socketId = socketId;
    this.touch();
  }
}
