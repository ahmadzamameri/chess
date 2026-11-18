/**
 * القطع المأسورة + فارق النقاط لكل لاعب (مثل chess.com).
 * تُحسب من الـ FEN بمقارنة القطع الموجودة بالعدد الابتدائي — لا حاجة لبيانات إضافية من السيرفر.
 */
import { useMemo } from 'react';
import type { Color } from '../types';

/** قيمة كل قطعة بالنقاط. */
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };

/** العدد الابتدائي لكل نوع. */
const INITIAL: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };

/** رموز القطع للعرض. */
const GLYPH: Record<string, { white: string; black: string }> = {
  p: { white: '♙', black: '♟' },
  n: { white: '♘', black: '♞' },
  b: { white: '♗', black: '♝' },
  r: { white: '♖', black: '♜' },
  q: { white: '♕', black: '♛' },
};

const ORDER = ['q', 'r', 'b', 'n', 'p'];

interface Props {
  fen: string;
  /** لون اللاعب صاحب هذا الشريط (نعرض ما أسره هو). */
  color: Color;
}

/** عدّ القطع الموجودة على الرقعة من الـ FEN. */
function countPieces(fen: string): { white: Record<string, number>; black: Record<string, number> } {
  const board = fen.split(' ')[0] ?? '';
  const white: Record<string, number> = {};
  const black: Record<string, number> = {};

  for (const ch of board) {
    if (ch === '/' || (ch >= '1' && ch <= '8')) continue;
    const lower = ch.toLowerCase();
    if (!(lower in VALUE)) continue; // نتجاهل الملك
    if (ch === lower) black[lower] = (black[lower] ?? 0) + 1;
    else white[lower] = (white[lower] ?? 0) + 1;
  }
  return { white, black };
}

export default function CapturedPieces({ fen, color }: Props) {
  const { captured, advantage } = useMemo(() => {
    const counts = countPieces(fen);

    // ما أسره اللاعب = قطع الخصم الناقصة.
    const opponent = color === 'white' ? 'black' : 'white';
    const opponentCounts = counts[opponent];

    const taken: { type: string; count: number }[] = [];
    let takenPoints = 0;
    let lostPoints = 0;

    for (const type of ORDER) {
      const missing = INITIAL[type] - (opponentCounts[type] ?? 0);
      if (missing > 0) {
        taken.push({ type, count: missing });
        takenPoints += missing * VALUE[type];
      }
      const myMissing = INITIAL[type] - (counts[color][type] ?? 0);
      lostPoints += myMissing * VALUE[type];
    }

    return { captured: taken, advantage: takenPoints - lostPoints };
  }, [fen, color]);

  if (captured.length === 0 && advantage <= 0) {
    return <div className="captured empty" />;
  }

  const glyphColor: Color = color === 'white' ? 'black' : 'white';

  return (
    <div className="captured">
      {captured.map(({ type, count }) => (
        <span key={type} className="captured-group">
          {Array.from({ length: count }).map((_, i) => (
            <span key={i} className={`captured-piece ${glyphColor}`}>
              {GLYPH[type][glyphColor]}
            </span>
          ))}
        </span>
      ))}
      {advantage > 0 && <span className="advantage">+{advantage}</span>}
    </div>
  );
}
