/** قائمة النقلات مرتّبة بأزواج (أبيض/أسود) مع تمرير تلقائي لآخر نقلة. */
import { useEffect, useRef } from 'react';
import type { MoveRecord } from '../types';

interface Props {
  moves: MoveRecord[];
}

export default function MoveList({ moves }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // مرّر تلقائيًا لأسفل عند كل نقلة جديدة.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [moves.length]);

  // تجميع النقلات في أزواج: [أبيض, أسود].
  const rows: { num: number; white?: string; black?: string }[] = [];
  moves.forEach((move, i) => {
    const rowIndex = Math.floor(i / 2);
    if (!rows[rowIndex]) rows[rowIndex] = { num: rowIndex + 1 };
    if (move.color === 'white') rows[rowIndex].white = move.san;
    else rows[rowIndex].black = move.san;
  });

  const lastIndex = moves.length - 1;

  return (
    <div className="moves">
      <h3>
        النقلات
        {moves.length > 0 && <span className="move-count">{moves.length}</span>}
      </h3>

      <div className="moves-scroll" ref={scrollRef}>
        {moves.length === 0 ? (
          <p className="muted no-moves">لا نقلات بعد.</p>
        ) : (
          <div className="move-list">
            {rows.map((row, ri) => {
              const whiteIsLast = ri * 2 === lastIndex;
              const blackIsLast = ri * 2 + 1 === lastIndex;
              return (
                <div key={row.num} style={{ display: 'contents' }}>
                  <span className="move-num">{row.num}.</span>
                  <span className={whiteIsLast ? 'move-cell last' : 'move-cell'}>
                    {row.white ?? ''}
                  </span>
                  <span className={blackIsLast ? 'move-cell last' : 'move-cell'}>
                    {row.black ?? ''}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
