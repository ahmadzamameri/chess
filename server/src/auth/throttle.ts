/**
 * مصنع محدِّد معدّل عام (sliding window) لكل مفتاح (عادةً IP).
 * تخزين داخل الذاكرة (السيرفر عملية fork واحدة في pm2)، ينظّف نفسه تلقائيًا.
 *
 * استخدامان:
 *  - حماية تخمين الدخول: record() عند الفشل، clear() عند النجاح.
 *  - حماية سبام إجراء (تسجيل): record() عند كل محاولة، بلا clear.
 */
export interface Throttle {
  /** هل تجاوز هذا المفتاح الحد المسموح ضمن النافذة؟ */
  isBlocked(key: string): boolean;
  /** سجّل حدثًا (محاولة/فشل) للمفتاح. */
  record(key: string): void;
  /** امسح عدّاد المفتاح (بعد نجاح مثلًا). */
  clear(key: string): void;
}

export function createThrottle(windowMs: number, max: number): Throttle {
  /** key -> طوابع زمنية للأحداث الأخيرة ضمن النافذة. */
  const hits = new Map<string, number[]>();

  const recent = (key: string, now: number): number[] => {
    const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (arr.length) hits.set(key, arr);
    else hits.delete(key);
    return arr;
  };

  // تنظيف دوري احترازي حتى لا تنمو الخريطة بلا حدود.
  setInterval(() => {
    const now = Date.now();
    for (const [key, arr] of hits) {
      if (arr.every((t) => now - t >= windowMs)) hits.delete(key);
    }
  }, windowMs).unref?.();

  return {
    isBlocked(key: string): boolean {
      return recent(key, Date.now()).length >= max;
    },
    record(key: string): void {
      const now = Date.now();
      const arr = recent(key, now);
      arr.push(now);
      hits.set(key, arr);
    },
    clear(key: string): void {
      hits.delete(key);
    },
  };
}
