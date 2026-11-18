/**
 * قطع شطرنج SVG بسيطة وواضحة (للرقعة التزيينية في الصفحة الرئيسية).
 * القطعة تُملأ بلونها ولها حدّ بلون متباين، فتظهر واضحة على المربّع الفاتح والداكن معًا.
 */
import type { JSX } from 'react';

export type PieceType = 'p' | 'r' | 'n' | 'b' | 'q' | 'k';
export type PieceColor = 'w' | 'b';

/** أشكال القطع داخل مربّع 45×45 (تُورّث fill/stroke من المجموعة). */
const SHAPES: Record<PieceType, JSX.Element> = {
  p: (
    <>
      <circle cx="22.5" cy="15" r="5.6" />
      <path d="M18 20 h9 l2 8 h-13 z" />
      <path d="M13 28 h19 l2 5 h-23 z" />
    </>
  ),
  r: (
    <>
      <path d="M13 11 h3.5 v2.5 h3 v-2.5 h4 v2.5 h3 v-2.5 h3.5 v7 h-20 z" />
      <path d="M15 18 h15 l-1 10 h-13 z" />
      <path d="M13 28 h19 l2 5 h-23 z" />
    </>
  ),
  n: (
    <>
      <path d="M28 33 C29 26 29 20 27 16 C26 13 23 12 21 13 L21 10 C19 11 16 14 15 17 C13 18 12 20 13 22 C14 23 16 23 17 22 C16 25 15 29 16 33 Z" />
      <path d="M14 33 h16 l1.5 3 h-19 z" />
    </>
  ),
  b: (
    <>
      <circle cx="22.5" cy="8.5" r="1.8" />
      <path d="M22.5 10.5 C27 14 27 18 22.5 22 C18 18 18 14 22.5 10.5 z" />
      <path d="M17 22 h11 l2 6 h-15 z" />
      <path d="M13 28 h19 l2 5 h-23 z" />
    </>
  ),
  q: (
    <>
      <circle cx="13" cy="13" r="1.9" />
      <circle cx="22.5" cy="11" r="2.1" />
      <circle cx="32" cy="13" r="1.9" />
      <path d="M11 28 L13 14.5 L18 25 L22.5 12.5 L27 25 L32 14.5 L34 28 z" />
      <path d="M13 27 h19 l1.5 6 h-22 z" />
    </>
  ),
  k: (
    <>
      <path d="M21 6 h3 v3 h3 v3 h-3 v3 h-3 v-3 h-3 v-3 h3 z" />
      <path d="M14 33 C12 25 17 21 22.5 22 C28 21 33 25 31 33 z" />
      <path d="M13 30 h19 l1.5 4 h-22 z" />
    </>
  ),
};

export default function ChessPieceIcon({ type, color }: { type: PieceType; color: PieceColor }) {
  const fill = color === 'w' ? '#f6f6f1' : '#262421';
  const stroke = color === 'w' ? '#262421' : '#eceae3';
  return (
    <svg viewBox="0 0 45 45" className="home-pc" aria-hidden="true">
      <g
        fill={fill}
        stroke={stroke}
        strokeWidth={1.2}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {SHAPES[type]}
      </g>
    </svg>
  );
}
