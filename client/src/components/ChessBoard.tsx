/**
 * غلاف حول react-chessboard.
 * - العميل لا يحكم على قانونية النقلة: يرسلها للسيرفر ويعيد false، وتتحدث الرقعة من FEN السيرفر.
 * - chess.js هنا للعرض فقط: إظهار الوجهات القانونية عند حمل القطعة + دعم النقل بالضغط.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import type { Color } from '../types';

interface Props {
  fen: string;
  myColor: Color;
  /** هل يُسمح بالتفاعل الآن (دورك + المباراة نشطة). */
  interactive: boolean;
  /** آخر نقلة لُعبت — تُميَّز على الرقعة. */
  lastMove?: { from: string; to: string } | null;
  /** هل الملك في كش الآن (لتمييز مربّعه بالأحمر). */
  inCheck?: boolean;
  /** يُستدعى عند النقل — يرسل النقلة للسيرفر. */
  onMove: (from: string, to: string) => void;
}

type SquareStyles = Record<string, CSSProperties>;

const SELECT_STYLE: CSSProperties = { background: 'rgba(234, 179, 8, 0.45)' };
const MOVE_DOT: CSSProperties = {
  background: 'radial-gradient(circle, rgba(15,23,42,0.35) 22%, transparent 24%)',
  borderRadius: '50%',
};
const CAPTURE_RING: CSSProperties = {
  background: 'radial-gradient(circle, transparent 56%, rgba(220,38,38,0.55) 58%)',
  borderRadius: '50%',
};
/** تمييز مربّعي آخر نقلة (أصفر خافت). */
const LAST_MOVE_STYLE: CSSProperties = { background: 'rgba(234, 179, 8, 0.22)' };
/** تمييز ملك في كش. */
const CHECK_STYLE: CSSProperties = {
  background: 'radial-gradient(circle, rgba(239,68,68,0.85) 12%, rgba(239,68,68,0.25) 60%, transparent 72%)',
};

export default function ChessBoard({
  fen,
  myColor,
  interactive,
  lastMove = null,
  inCheck = false,
  onMove,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(400);
  const [highlights, setHighlights] = useState<SquareStyles>({});
  const [moveFrom, setMoveFrom] = useState<string>('');

  // عرض متجاوب: نقيس عرض الحاوية ونحدّه بحد أقصى.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(Math.min(el.clientWidth, 560));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // نسخة chess.js للقراءة فقط (وجهات قانونية) — تُعاد عند تغيّر الوضع.
  const chess = useMemo(() => {
    try {
      return new Chess(fen);
    } catch {
      return null;
    }
  }, [fen]);

  const myChar = myColor === 'white' ? 'w' : 'b';

  // امسح التحديد عند تبدّل الدور/الوضع أو تعطّل التفاعل.
  useEffect(() => {
    setHighlights({});
    setMoveFrom('');
  }, [fen, interactive]);

  /**
   * تمييزات دائمة (مستقلة عن تفاعل المستخدم): مربّعا آخر نقلة + ملك في كش.
   * تُدمج تحت تمييزات الاختيار حتى لا تحجبها.
   */
  const baseHighlights = useMemo(() => {
    const styles: SquareStyles = {};

    if (lastMove) {
      styles[lastMove.from] = LAST_MOVE_STYLE;
      styles[lastMove.to] = LAST_MOVE_STYLE;
    }

    if (inCheck && chess) {
      // ابحث عن مربّع ملك الجانب صاحب الدور.
      const turnChar = chess.turn();
      outer: for (const rank of ['1', '2', '3', '4', '5', '6', '7', '8']) {
        for (const file of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
          const sq = `${file}${rank}`;
          const piece = chess.get(sq as never) as { type: string; color: string } | undefined;
          if (piece && piece.type === 'k' && piece.color === turnChar) {
            styles[sq] = CHECK_STYLE;
            break outer;
          }
        }
      }
    }

    return styles;
  }, [lastMove, inCheck, chess]);

  /** الدمج: التمييزات الدائمة أولًا ثم تمييزات الاختيار فوقها. */
  const mergedStyles: SquareStyles = { ...baseHighlights, ...highlights };

  /** أظهر الوجهات القانونية لقطعة في خانة معيّنة. يعيد true إن وُجدت نقلات. */
  function highlightMoves(square: string): boolean {
    if (!interactive || !chess) return false;
    const moves = chess.moves({ square: square as never, verbose: true }) as Array<{
      to: string;
      captured?: string;
      flags: string;
    }>;
    if (moves.length === 0) return false;

    const styles: SquareStyles = { [square]: SELECT_STYLE };
    for (const m of moves) {
      const isCapture = Boolean(m.captured) || m.flags.includes('e');
      styles[m.to] = isCapture ? CAPTURE_RING : MOVE_DOT;
    }
    setHighlights(styles);
    return true;
  }

  function clearHighlights() {
    setHighlights({});
    setMoveFrom('');
  }

  /** النقل بالضغط: أول ضغطة تختار، والثانية تنقل إن كانت وجهة قانونية. */
  function handleSquareClick(square: string) {
    if (!interactive || !chess) return;

    if (moveFrom) {
      const legal = (chess.moves({ square: moveFrom as never, verbose: true }) as Array<{ to: string }>).some(
        (m) => m.to === square,
      );
      if (legal) {
        onMove(moveFrom, square);
        clearHighlights();
        return;
      }
    }
    // اختر خانة جديدة إن كان فيها قطعة لها نقلات.
    if (highlightMoves(square)) setMoveFrom(square);
    else clearHighlights();
  }

  return (
    <div className="board-wrap" ref={wrapRef}>
      <Chessboard
        position={fen}
        boardWidth={width}
        boardOrientation={myColor}
        arePiecesDraggable={interactive}
        isDraggablePiece={({ piece }) => interactive && piece[0] === myChar}
        onPieceDragBegin={(_piece, sourceSquare) => highlightMoves(sourceSquare)}
        onPieceDragEnd={() => clearHighlights()}
        onSquareClick={handleSquareClick}
        onPieceDrop={(from, to) => {
          onMove(from, to);
          clearHighlights();
          return false; // السيرفر هو من يحدّث الرقعة
        }}
        customSquareStyles={mergedStyles}
        animationDuration={220}
        customBoardStyle={{
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}
        customDarkSquareStyle={{ backgroundColor: '#769656' }}
        customLightSquareStyle={{ backgroundColor: '#eeeed2' }}
      />
    </div>
  );
}
