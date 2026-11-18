/**
 * أدوات مساعدة: توليد المعرّفات، تنظيف الاسم، ومحدّد معدّل بسيط في الذاكرة.
 */
import { randomUUID } from 'node:crypto';
import { config } from './config.js';

/** معرّف فريد للمباريات. */
export function generateGameId(): string {
  return randomUUID();
}

/**
 * هل المحرف آمن للاسم؟ نرفض:
 * - محارف التحكم (كود < 32 أو == 127).
 * - الأقواس الزاوية < و > (منع أي محتوى شبيه بوسم).
 */
function isSafeNameChar(ch: string): boolean {
  const code = ch.charCodeAt(0);
  if (code < 32 || code === 127) return false;
  if (ch === '<' || ch === '>') return false;
  return true;
}

/**
 * تنظيف اسم اللاعب القادم من العميل — لا نثق به إطلاقًا.
 * - نحوّله نصًّا، نزيل محارف التحكم/الأقواس الخطيرة.
 * - نضغط الفراغات ونقصّه إلى الحد الأقصى.
 * - إن صار فارغًا نعطي اسمًا افتراضيًا عشوائيًا.
 */
export function sanitizeName(raw: unknown): string {
  const source = typeof raw === 'string' ? raw : '';

  let name = Array.from(source).filter(isSafeNameChar).join('');
  name = name.replace(/\s+/g, ' ').trim();

  if (name.length > config.maxNameLength) {
    name = name.slice(0, config.maxNameLength).trim();
  }

  if (name.length === 0) {
    name = `لاعب-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  return name;
}

/** التحقق أن قيمة نصية غير فارغة وطولها منطقي (للـ sessionId / gameId). */
export function isValidId(value: unknown, maxLen = 64): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLen;
}

/** التحقق من صيغة خانة الرقعة (مثل "e2"). */
export function isValidSquare(value: unknown): value is string {
  return typeof value === 'string' && /^[a-h][1-8]$/.test(value);
}

/**
 * محدّد معدّل بسيط لكل socket في الذاكرة.
 * نافذة منزلقة مبسّطة: نعُدّ الأحداث داخل النافذة الحالية.
 */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();

  allow(key: string): boolean {
    const now = Date.now();
    const entry = this.hits.get(key);

    if (!entry || now >= entry.resetAt) {
      this.hits.set(key, { count: 1, resetAt: now + config.rateLimit.windowMs });
      return true;
    }

    if (entry.count >= config.rateLimit.maxEvents) {
      return false;
    }

    entry.count += 1;
    return true;
  }

  clear(key: string): void {
    this.hits.delete(key);
  }
}
