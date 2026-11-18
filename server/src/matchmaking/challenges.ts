/**
 * تحدّيات الأصدقاء عبر رابط.
 * اللاعب ينشئ تحديًا فيحصل على رابط، ومن يفتحه ويقبله تبدأ المباراة بينهما.
 * التخزين في الذاكرة (مثل المباريات) مع انتهاء صلاحية تلقائي.
 */
import { randomBytes } from 'node:crypto';

export interface Challenge {
  id: string;
  creatorSessionId: string;
  creatorSocketId: string;
  creatorName: string;
  creatorUserId: number | null;
  timeControlId: string;
  createdAt: number;
}

/** مدة صلاحية التحدي قبل اعتباره منتهيًا. */
const CHALLENGE_TTL_MS = 15 * 60 * 1000;

/** معرّف قصير سهل المشاركة. */
function generateChallengeId(): string {
  return randomBytes(9).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
}

class ChallengeStore {
  private challenges = new Map<string, Challenge>();

  create(input: Omit<Challenge, 'id' | 'createdAt'>): Challenge {
    // لاعب واحد = تحدٍّ واحد فقط؛ نزيل أي تحدٍّ سابق له.
    this.removeBySession(input.creatorSessionId);

    let id = generateChallengeId();
    while (this.challenges.has(id)) id = generateChallengeId();

    const challenge: Challenge = { ...input, id, createdAt: Date.now() };
    this.challenges.set(id, challenge);
    return challenge;
  }

  get(id: unknown): Challenge | null {
    if (typeof id !== 'string') return null;
    const challenge = this.challenges.get(id);
    if (!challenge) return null;

    // منتهي الصلاحية ⇒ نحذفه ونعتبره غير موجود.
    if (Date.now() - challenge.createdAt > CHALLENGE_TTL_MS) {
      this.challenges.delete(id);
      return null;
    }
    return challenge;
  }

  remove(id: string): void {
    this.challenges.delete(id);
  }

  removeBySession(sessionId: string): void {
    for (const [id, c] of this.challenges) {
      if (c.creatorSessionId === sessionId) this.challenges.delete(id);
    }
  }

  removeBySocket(socketId: string): void {
    for (const [id, c] of this.challenges) {
      if (c.creatorSocketId === socketId) this.challenges.delete(id);
    }
  }

  /** تحديث سوكت المنشئ بعد إعادة اتصاله. */
  updateSocket(sessionId: string, socketId: string): void {
    for (const c of this.challenges.values()) {
      if (c.creatorSessionId === sessionId) c.creatorSocketId = socketId;
    }
  }
}

export const challengeStore = new ChallengeStore();
