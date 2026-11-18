/**
 * حساب تصنيف Elo القياسي.
 * القاعدة: يُحدَّث التصنيف فقط عندما يكون **كلا اللاعبين مسجّلًا**،
 * حتى لا يُستغَل اللعب ضد الضيوف لرفع التصنيف.
 */
import { config } from '../config.js';

/** نتيجة اللاعب: 1 فوز، 0.5 تعادل، 0 خسارة. */
export type Score = 0 | 0.5 | 1;

/** الاحتمال المتوقع للفوز بناءً على فارق التصنيف. */
function expectedScore(myElo: number, opponentElo: number): number {
  return 1 / (1 + Math.pow(10, (opponentElo - myElo) / 400));
}

/** التصنيف الجديد بعد مباراة واحدة. */
export function newElo(myElo: number, opponentElo: number, score: Score): number {
  const expected = expectedScore(myElo, opponentElo);
  const updated = myElo + config.eloK * (score - expected);
  // نُبقيه عددًا صحيحًا ولا ننزل تحت حدٍّ أدنى معقول.
  return Math.max(100, Math.round(updated));
}

/** تحويل نتيجة المباراة إلى نقاط لكل لون. */
export function scoresFromResult(result: 'white' | 'black' | 'draw'): {
  white: Score;
  black: Score;
} {
  if (result === 'draw') return { white: 0.5, black: 0.5 };
  if (result === 'white') return { white: 1, black: 0 };
  return { white: 0, black: 1 };
}
