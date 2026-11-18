/**
 * إعادة عرض مباراة: نعيد تركيب المواضع من نقلات SAN المحفوظة (chess.js)،
 * ونعرض رقعة للقراءة فقط مع تنقّل خطوة‑بخطوة وقائمة نقلات قابلة للنقر.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { adminApi, type AdminGameDetail } from '../../services/adminApi';
import { fmtDate, RESULT_META } from './adminHelpers';
import { playMove, playCapture, playCheck, playEnd } from '../../services/sound';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const END_REASON_LABEL: Record<string, string> = {
  checkmate: 'كش مات',
  resign: 'استسلام',
  timeout: 'انتهاء الوقت',
  stalemate: 'تعادل (لا نقلة قانونية)',
  draw: 'تعادل',
  agreement: 'تعادل بالاتفاق',
  threefold: 'تكرار ثلاثي',
  insufficient: 'مواد غير كافية',
  abandoned: 'انسحاب',
};

interface Ply {
  fen: string;
  san: string;
  from: string;
  to: string;
}

export default function AdminGamePage() {
  const { id } = useParams<{ id: string }>();
  const [game, setGame] = useState<AdminGameDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [ply, setPly] = useState(0); // 0 = وضع البداية، N = بعد النقلة N

  const wrapRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState(420);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setBoardWidth(Math.min(el.clientWidth, 460));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [game]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await adminApi.get<{ game: AdminGameDetail }>(`/games/${id}`);
        if (!cancelled) setGame(res.game);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // أعد تركيب المواضع من نقلات SAN.
  const { plies, truncated } = useMemo(() => {
    const out: Ply[] = [];
    if (!game) return { plies: out, truncated: false };
    const chess = new Chess();
    let broke = false;
    for (const san of game.movesSan) {
      try {
        const mv = chess.move(san);
        if (!mv) {
          broke = true;
          break;
        }
        out.push({ fen: chess.fen(), san: mv.san, from: mv.from, to: mv.to });
      } catch {
        broke = true;
        break;
      }
    }
    return { plies: out, truncated: broke };
  }, [game]);

  const maxPly = plies.length;
  const clampedPly = Math.min(ply, maxPly);
  const currentFen = clampedPly === 0 ? START_FEN : plies[clampedPly - 1].fen;
  const currentMove = clampedPly === 0 ? null : plies[clampedPly - 1];

  // تنقّل بلوحة المفاتيح (يمين = التالي، يسار = السابق).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setPly((p) => Math.min(p + 1, maxPly));
      else if (e.key === 'ArrowLeft') setPly((p) => Math.max(p - 1, 0));
      else if (e.key === 'Home') setPly(0);
      else if (e.key === 'End') setPly(maxPly);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [maxPly]);

  // صوت النقلة عند الوصول لأي نقلة (نميّز الأخذ/الكش/الكش‑مات من صيغة SAN).
  useEffect(() => {
    if (clampedPly === 0) return;
    const mv = plies[clampedPly - 1];
    if (!mv) return;
    if (mv.san.includes('#')) playEnd();
    else if (mv.san.includes('+')) playCheck();
    else if (mv.san.includes('x')) playCapture();
    else playMove();
  }, [clampedPly, plies]);

  const squareStyles = useMemo(() => {
    if (!currentMove) return {};
    const s = { background: 'rgba(234, 179, 8, 0.28)' };
    return { [currentMove.from]: s, [currentMove.to]: s };
  }, [currentMove]);

  if (loading) return <p className="muted center admin-loading">جارٍ تحميل المباراة…</p>;
  if (error || !game) {
    return (
      <>
        <div className="alert-error">{error ?? 'تعذّر تحميل المباراة.'}</div>
        <Link to="/admin/games" className="btn-ghost btn-sm">
          ← رجوع للمباريات
        </Link>
      </>
    );
  }

  // اقسم النقلات لأزواج (أبيض/أسود) لعرضها كجدول نقلات.
  const rows: { n: number; white?: Ply & { idx: number }; black?: Ply & { idx: number } }[] = [];
  plies.forEach((p, i) => {
    const n = Math.floor(i / 2);
    if (i % 2 === 0) rows[n] = { n: n + 1, white: { ...p, idx: i } };
    else rows[n] = { ...rows[n], black: { ...p, idx: i } };
  });

  const eloText = (before: number | null, after: number | null) =>
    before !== null && after !== null ? `${before} ← ${after} (${after - before >= 0 ? '+' : ''}${after - before})` : '—';

  return (
    <>
      <div className="admin-crumb">
        <Link to="/admin/games">المباريات</Link>
        <span className="dim"> / </span>
        <span>مباراة #{game.id}</span>
      </div>

      <div className="replay-head">
        <div className="replay-players">
          <span className="admin-cell-name">♔ {game.whiteName}</span>
          <span className="dim">ضد</span>
          <span className="admin-cell-name">♚ {game.blackName}</span>
        </div>
        <span className={`badge ${RESULT_META[game.result].cls}`}>{RESULT_META[game.result].label}</span>
        <span className="muted">{END_REASON_LABEL[game.endReason] ?? game.endReason}</span>
      </div>

      <div className="replay-layout">
        {/* الرقعة */}
        <div className="replay-board" ref={wrapRef}>
          <Chessboard
            position={currentFen}
            boardWidth={boardWidth}
            arePiecesDraggable={false}
            customSquareStyles={squareStyles}
            customBoardStyle={{ borderRadius: '6px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
            customDarkSquareStyle={{ backgroundColor: '#769656' }}
            customLightSquareStyle={{ backgroundColor: '#eeeed2' }}
          />

          <div className="replay-controls">
            <button className="btn-ghost btn-sm" onClick={() => setPly(0)} disabled={clampedPly === 0}>
              ⏮
            </button>
            <button
              className="btn-ghost btn-sm"
              onClick={() => setPly((p) => Math.max(p - 1, 0))}
              disabled={clampedPly === 0}
            >
              ◀ السابقة
            </button>
            <span className="replay-counter">
              {clampedPly} / {maxPly}
            </span>
            <button
              className="btn-ghost btn-sm"
              onClick={() => setPly((p) => Math.min(p + 1, maxPly))}
              disabled={clampedPly === maxPly}
            >
              التالية ▶
            </button>
            <button
              className="btn-ghost btn-sm"
              onClick={() => setPly(maxPly)}
              disabled={clampedPly === maxPly}
            >
              ⏭
            </button>
          </div>
          <p className="dim center replay-hint">استخدم أسهم لوحة المفاتيح ← → للتنقّل</p>
        </div>

        {/* قائمة النقلات + معلومات */}
        <div className="replay-side">
          <div className="admin-panel replay-moves">
            <div className="admin-panel-head">
              <h2 className="admin-panel-title">النقلات</h2>
              <span className="admin-count">{plies.length}</span>
            </div>
            {plies.length === 0 ? (
              <p className="muted">لا توجد نقلات مسجّلة لهذه المباراة.</p>
            ) : (
              <div className="move-grid">
                {rows.map((r) => (
                  <div className="move-row" key={r.n}>
                    <span className="move-num">{r.n}.</span>
                    {r.white && (
                      <button
                        className={`move-btn ${clampedPly === r.white.idx + 1 ? 'active' : ''}`}
                        onClick={() => setPly(r.white!.idx + 1)}
                      >
                        {r.white.san}
                      </button>
                    )}
                    {r.black ? (
                      <button
                        className={`move-btn ${clampedPly === r.black.idx + 1 ? 'active' : ''}`}
                        onClick={() => setPly(r.black!.idx + 1)}
                      >
                        {r.black.san}
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                ))}
              </div>
            )}
            {truncated && (
              <p className="alert-inline">⚠ تعذّرت قراءة بعض النقلات — العرض حتى آخر نقلة صالحة.</p>
            )}
          </div>

          <div className="admin-panel replay-info">
            <div className="replay-info-row">
              <span className="muted">عدد النقلات</span>
              <span>{game.moveCount}</span>
            </div>
            <div className="replay-info-row">
              <span className="muted">تصنيف الأبيض</span>
              <span>{eloText(game.whiteEloBefore, game.whiteEloAfter)}</span>
            </div>
            <div className="replay-info-row">
              <span className="muted">تصنيف الأسود</span>
              <span>{eloText(game.blackEloBefore, game.blackEloAfter)}</span>
            </div>
            <div className="replay-info-row">
              <span className="muted">بدأت</span>
              <span>{fmtDate(game.startedAt)}</span>
            </div>
            <div className="replay-info-row">
              <span className="muted">انتهت</span>
              <span>{fmtDate(game.endedAt)}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
