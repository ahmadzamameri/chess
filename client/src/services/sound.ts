/**
 * أصوات النقلات — مولّدة عبر Web Audio API (بلا ملفات صوت خارجية).
 * تُنشأ AudioContext عند أول تشغيل (بعد تفاعل المستخدم، فلا تمنعها سياسة التشغيل التلقائي).
 */

let ctx: AudioContext | null = null;

function ensureCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** نغمة قصيرة واحدة. */
function tone(freq: number, duration: number, type: OscillatorType = 'triangle', gain = 0.18): void {
  const audio = ensureCtx();
  if (!audio) return;
  const osc = audio.createOscillator();
  const vol = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  vol.gain.setValueAtTime(gain, audio.currentTime);
  vol.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
  osc.connect(vol);
  vol.connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + duration);
}

/** نقلة عادية — نقرة خفيفة. */
export function playMove(): void {
  tone(210, 0.11, 'triangle', 0.2);
}

/** أخذ قطعة — نغمة أخفض أوضح. */
export function playCapture(): void {
  tone(130, 0.15, 'sawtooth', 0.22);
}

/** كش — نغمتان أعلى للتنبيه. */
export function playCheck(): void {
  tone(520, 0.1, 'square', 0.16);
  setTimeout(() => tone(520, 0.12, 'square', 0.16), 120);
}

/** نهاية المباراة — نغمتان صاعدتان. */
export function playEnd(): void {
  tone(330, 0.14, 'triangle', 0.2);
  setTimeout(() => tone(494, 0.22, 'triangle', 0.2), 150);
}
