/**
 * ساعة لاعب.
 * السيرفر هو مرجع الوقت؛ هنا نعرض عدًّا تنازليًا سلسًا محليًا،
 * ونعيد المزامنة مع كل حالة قادمة من السيرفر (فلا ينحرف العرض).
 */
import { useEffect, useRef, useState } from 'react';

interface Props {
  /** الوقت المتبقي كما أرسله السيرفر (مللي ثانية). */
  ms: number;
  /** هل هذه الساعة تعمل الآن (دور صاحبها والمباراة نشطة). */
  running: boolean;
  /** هل هي ساعتك أنت (لتمييزها). */
  isMine?: boolean;
}

function format(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  // تحت 20 ثانية نعرض عُشر الثانية لإحساس الضغط (كما في lichess).
  if (ms < 20_000) {
    const tenths = Math.max(0, Math.floor((ms % 1000) / 100));
    return `${m}:${String(s).padStart(2, '0')}.${tenths}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function Clock({ ms, running, isMine = false }: Props) {
  const [display, setDisplay] = useState(ms);
  // مرجع اللحظة التي وصلت فيها قيمة السيرفر، لحساب الانقضاء محليًا.
  const baseRef = useRef({ ms, at: Date.now() });

  // مزامنة عند كل تحديث من السيرفر.
  useEffect(() => {
    baseRef.current = { ms, at: Date.now() };
    setDisplay(ms);
  }, [ms]);

  // عدّ تنازلي سلس أثناء دور صاحب الساعة فقط.
  useEffect(() => {
    if (!running) {
      setDisplay(baseRef.current.ms);
      return;
    }
    const tick = () => {
      const elapsed = Date.now() - baseRef.current.at;
      setDisplay(Math.max(0, baseRef.current.ms - elapsed));
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [running]);

  const low = display < 30_000;

  return (
    <div
      className={[
        'clock',
        running ? 'clock-running' : '',
        low ? 'clock-low' : '',
        isMine ? 'clock-mine' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {format(display)}
    </div>
  );
}
