/** أدوات عرض مشتركة بين صفحات لوحة التحكم. */
import type { AdminRecentGame } from '../../services/adminApi';

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('ar', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const RESULT_META: Record<AdminRecentGame['result'], { label: string; cls: string }> = {
  white: { label: 'فوز الأبيض', cls: 'badge-win' },
  black: { label: 'فوز الأسود', cls: 'badge-win' },
  draw: { label: 'تعادل', cls: 'badge-draw' },
};
