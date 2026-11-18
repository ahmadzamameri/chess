/**
 * أنواع التحكم بالوقت المسموحة (قائمة بيضاء).
 * لا نقبل قيمًا حرة من العميل — فقط معرّفًا من هذه القائمة.
 */

export interface TimeControl {
  id: string;
  /** الوقت الابتدائي لكل لاعب بالثواني. */
  initial: number;
  /** الزيادة بعد كل نقلة بالثواني. */
  increment: number;
  /** التصنيف المعروض (رصاصة/خاطف/سريع). */
  category: 'bullet' | 'blitz' | 'rapid';
}

export const TIME_CONTROLS: readonly TimeControl[] = [
  { id: '1+0', initial: 60, increment: 0, category: 'bullet' },
  { id: '3+0', initial: 180, increment: 0, category: 'blitz' },
  { id: '3+2', initial: 180, increment: 2, category: 'blitz' },
  { id: '5+0', initial: 300, increment: 0, category: 'blitz' },
  { id: '10+0', initial: 600, increment: 0, category: 'rapid' },
  { id: '15+10', initial: 900, increment: 10, category: 'rapid' },
] as const;

export const DEFAULT_TIME_CONTROL_ID = '5+0';

/** إيجاد تحكم زمني بمعرّفه، مع الرجوع للافتراضي عند أي قيمة غير صالحة. */
export function resolveTimeControl(id: unknown): TimeControl {
  if (typeof id === 'string') {
    const found = TIME_CONTROLS.find((tc) => tc.id === id);
    if (found) return found;
  }
  return TIME_CONTROLS.find((tc) => tc.id === DEFAULT_TIME_CONTROL_ID)!;
}
