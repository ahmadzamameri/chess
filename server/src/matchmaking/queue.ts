/**
 * قائمة انتظار المطابقة.
 * قواعد مهمة:
 * - لا يُضاف نفس اللاعب (نفس sessionId أو نفس socket) مرتين.
 * - لا يُطابَق اللاعب مع نفسه.
 * - تُزال الإدخالات القديمة/المنقطعة قبل المطابقة.
 */
import type { Color } from '../types.js';

export interface QueueEntry {
  socketId: string;
  sessionId: string;
  name: string;
  /** حساب مسجّل (من التوكن) أو null للضيف. */
  userId: number | null;
  /** التحكم الزمني المطلوب — لا يُطابَق إلا مع نفس النوع. */
  timeControlId: string;
}

export interface MatchPair {
  white: QueueEntry;
  black: QueueEntry;
}

export class MatchmakingQueue {
  private entries: QueueEntry[] = [];

  /** هل اللاعب (بأي من معرّفيه) موجود في الانتظار؟ */
  has(sessionId: string, socketId: string): boolean {
    return this.entries.some(
      (e) => e.sessionId === sessionId || e.socketId === socketId,
    );
  }

  /**
   * إضافة لاعب ثم محاولة المطابقة فورًا.
   * يعيد زوج المطابقة إن نجحت، وإلا null (يبقى في الانتظار).
   */
  enqueue(entry: QueueEntry): MatchPair | null {
    // منع الازدواج: أزل أي إدخال قديم لنفس الجلسة أو نفس السوكت (socket قديم).
    this.removeBySession(entry.sessionId);
    this.removeBySocket(entry.socketId);

    this.entries.push(entry);
    return this.tryMatch();
  }

  /**
   * محاولة مطابقة أول لاعبين مختلفين **بنفس التحكم الزمني**.
   * نبدأ من أقدم إدخال، ونبحث عن شريك مطابق له في نوع الوقت.
   */
  private tryMatch(): MatchPair | null {
    if (this.entries.length < 2) return null;

    let first: QueueEntry | null = null;
    let second: QueueEntry | null = null;

    for (let i = 0; i < this.entries.length && !second; i++) {
      const candidate = this.entries[i];
      const partnerIndex = this.entries.findIndex(
        (e, j) =>
          j > i &&
          e.sessionId !== candidate.sessionId &&
          e.timeControlId === candidate.timeControlId,
      );
      if (partnerIndex !== -1) {
        first = candidate;
        second = this.entries[partnerIndex];
      }
    }

    if (!first || !second) return null;

    // أزلهما من الانتظار.
    this.entries = this.entries.filter(
      (e) => e !== first && e !== second,
    );

    // اختيار اللون عشوائيًا.
    const firstIsWhite = Math.random() < 0.5;
    const white = firstIsWhite ? first : second;
    const black = firstIsWhite ? second : first;

    return { white, black };
  }

  removeBySocket(socketId: string): void {
    this.entries = this.entries.filter((e) => e.socketId !== socketId);
  }

  removeBySession(sessionId: string): void {
    this.entries = this.entries.filter((e) => e.sessionId !== sessionId);
  }

  size(): number {
    return this.entries.length;
  }
}

export const matchmakingQueue = new MatchmakingQueue();

/** أداة صغيرة لتوليد لون معاكس. */
export function opposite(color: Color): Color {
  return color === 'white' ? 'black' : 'white';
}
