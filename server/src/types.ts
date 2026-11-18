/**
 * الأنواع المشتركة داخل السيرفر.
 * ملاحظة: نُبقي الأنواع المُرسَلة للواجهة "نظيفة" — لا نرسل أي بيانات داخلية غير ضرورية.
 */

export type Color = 'white' | 'black';

export type GameStatus = 'active' | 'finished';

/** سبب انتهاء المباراة — يُعرض للاعبين برسالة واضحة. */
export type GameEndReason =
  | 'checkmate'
  | 'stalemate'
  | 'draw_agreed'
  | 'threefold_repetition'
  | 'insufficient_material'
  | 'fifty_move'
  | 'resign'
  | 'disconnect'
  | 'timeout';

/** نتيجة المباراة من منظور اللون. */
export type GameResult = 'white' | 'black' | 'draw' | null;

/** لاعب مرتبط بجلسة ثابتة (sessionId) لا بـ socket.id المتغيّر. */
export interface Player {
  /** معرّف الحساب المسجّل، أو null للضيوف. مصدره التوكن لا العميل. */
  userId: number | null;
  /** معرّف جلسة ثابت يُخزَّن في localStorage لدى العميل — أساس إعادة الاتصال. */
  sessionId: string;
  /** socket.id الحالي — قد يتغيّر بعد إعادة الاتصال؛ لا نثق به وحده. */
  socketId: string | null;
  name: string;
  color: Color;
  connected: boolean;
}

/** نقلة كما تُخزَّن في التاريخ (SAN + from/to). */
export interface MoveRecord {
  san: string;
  from: string;
  to: string;
  color: Color;
}

/** حمولة عرض التعادل: من عرضه (بلون اللاعب) أو null إن لا عرض قائم. */
export type DrawOffer = Color | null;

/* ============ حمولات الأحداث (Client → Server) ============ */

export interface FindMatchPayload {
  name: string;
  sessionId: string;
  /** معرّف التحكم الزمني المطلوب (يُتحقق منه بقائمة بيضاء). */
  timeControlId?: string;
}

export interface RejoinPayload {
  sessionId: string;
  gameId: string;
}

export interface MakeMovePayload {
  gameId: string;
  from: string;
  to: string;
  /** الترقية — في النسخة الأولى نُثبّتها وزيرًا 'q' من العميل، والسيرفر يتحقق. */
  promotion?: 'q' | 'r' | 'b' | 'n';
}

export interface DrawResponsePayload {
  gameId: string;
  accept: boolean;
}

export interface SimpleGamePayload {
  gameId: string;
}

/* ============ حمولات الأحداث (Server → Client) ============ */

export interface MatchFoundPayload {
  gameId: string;
  color: Color;
  opponentName: string;
}

/** الحالة العامة للمباراة — هذا فقط ما يراه العميل (بلا تفاصيل داخلية). */
export interface GameStatePayload {
  gameId: string;
  fen: string;
  turn: Color;
  status: GameStatus;
  moves: MoveRecord[];
  whiteName: string;
  blackName: string;
  whiteConnected: boolean;
  blackConnected: boolean;
  drawOffer: DrawOffer;
  result: GameResult;
  endReason: GameEndReason | null;
  /** هل الملك في كش الآن. */
  inCheck: boolean;
  /** الوقت المتبقي لكل لاعب بالمللي ثانية (مرجعه السيرفر). */
  whiteMs: number;
  blackMs: number;
  /** معرّف التحكم الزمني (مثل "5+0"). */
  timeControlId: string;
  /** الزيادة بعد كل نقلة بالثواني (للعرض). */
  increment: number;
}
