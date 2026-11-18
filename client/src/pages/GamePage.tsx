/**
 * صفحة المباراة: الرقعة + معلومات اللاعبين + النقلات + الأفعال + نهاية المباراة.
 * تعتمد كليًا على حالة السيرفر (game_state)؛ العميل يعرض فقط ولا يحكم.
 * عند التحميل/التحديث تُرسل rejoin لإعادة الربط بالجلسة (لا بالـ socket.id).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import {
  clearActiveGameId,
  getSessionId,
} from '../services/socket';
import ChessBoard from '../components/ChessBoard';
import PlayerInfo from '../components/PlayerInfo';
import MoveList from '../components/MoveList';
import CapturedPieces from '../components/CapturedPieces';
import { playMove, playCapture, playCheck, playEnd } from '../services/sound';
import type { Color, GameEndReason, GameState, MatchFound } from '../types';

const REASON_TEXT: Record<GameEndReason, string> = {
  checkmate: 'كش مات',
  stalemate: 'تعادل بالجمود (Stalemate)',
  draw_agreed: 'تعادل بالاتفاق',
  threefold_repetition: 'تعادل بالتكرار الثلاثي',
  insufficient_material: 'تعادل لعدم كفاية القطع',
  fifty_move: 'تعادل بقاعدة الخمسين نقلة',
  resign: 'استسلام',
  disconnect: 'انقطاع الاتصال',
  timeout: 'انتهاء الوقت',
};

export default function GamePage() {
  const { gameId = '' } = useParams();
  const { socket, connected } = useSocket();
  const navigate = useNavigate();
  const sessionId = useMemo(() => getSessionId(), []);

  const [myColor, setMyColor] = useState<Color | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [opponentOnline, setOpponentOnline] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // لتتبّع تغيّر عدد النقلات وحالة المباراة لتشغيل الأصوات المناسبة.
  const prevMovesRef = useRef(0);
  const prevStatusRef = useRef<string>('active');

  // إعادة الربط عند التحميل + كلما عاد الاتصال.
  useEffect(() => {
    if (!connected) return;
    socket.emit('rejoin', { sessionId, gameId });
  }, [socket, connected, sessionId, gameId]);

  useEffect(() => {
    const onMatchFound = (data: MatchFound) => {
      if (data.gameId === gameId) setMyColor(data.color);
    };
    const onState = (s: GameState) => {
      if (s.gameId !== gameId) return;
      setState(s);
    };
    const onOpponentDisconnected = () => setOpponentOnline(false);
    const onOpponentReconnected = () => {
      setOpponentOnline(true);
      setNotice('عاد المنافس للاتصال.');
      setTimeout(() => setNotice(null), 2500);
    };
    const onNotFound = () => setNotFound(true);
    const onMoveRejected = (data: { reason: string }) => {
      setNotice(data?.reason || 'نقلة مرفوضة.');
      setTimeout(() => setNotice(null), 2000);
    };

    socket.on('match_found', onMatchFound);
    socket.on('game_state', onState);
    socket.on('opponent_disconnected', onOpponentDisconnected);
    socket.on('opponent_reconnected', onOpponentReconnected);
    socket.on('game_not_found', onNotFound);
    socket.on('move_rejected', onMoveRejected);

    return () => {
      socket.off('match_found', onMatchFound);
      socket.off('game_state', onState);
      socket.off('opponent_disconnected', onOpponentDisconnected);
      socket.off('opponent_reconnected', onOpponentReconnected);
      socket.off('game_not_found', onNotFound);
      socket.off('move_rejected', onMoveRejected);
    };
  }, [socket, gameId]);

  // مزامنة حالة اتصال المنافس من الحالة الرسمية.
  useEffect(() => {
    if (!state || !myColor) return;
    const oppConnected =
      myColor === 'white' ? state.blackConnected : state.whiteConnected;
    setOpponentOnline(oppConnected);
  }, [state, myColor]);

  // تشغيل الأصوات عند حدوث نقلة جديدة أو انتهاء المباراة.
  useEffect(() => {
    if (!state) return;
    if (state.moves.length > prevMovesRef.current) {
      const last = state.moves[state.moves.length - 1];
      if (state.inCheck) playCheck();
      else if (last && last.san.includes('x')) playCapture();
      else playMove();
    }
    prevMovesRef.current = state.moves.length;

    if (state.status === 'finished' && prevStatusRef.current !== 'finished') {
      playEnd();
    }
    prevStatusRef.current = state.status;
  }, [state]);

  const goHome = () => {
    clearActiveGameId();
    navigate('/');
  };

  if (notFound) {
    return (
      <div className="page">
        <div className="card home-card">
          <h2>لم يتم العثور على المباراة</h2>
          <p className="home-sub">ربما انتهت أو انتهت مهلتها.</p>
          <button className="btn-primary" style={{ width: '100%' }} onClick={goHome}>
            العودة للرئيسية
          </button>
        </div>
      </div>
    );
  }

  if (!state || !myColor) {
    return (
      <div className="page">
        <div className="searching">
          <div className="spinner" aria-hidden />
          <p>جارٍ الاتصال بالمباراة…</p>
        </div>
      </div>
    );
  }

  const isMyTurn = state.status === 'active' && state.turn === myColor;
  const interactive = isMyTurn;

  const handleMove = (from: string, to: string) => {
    socket.emit('make_move', { gameId, from, to, promotion: 'q' });
  };
  const handleResign = () => {
    if (window.confirm('هل أنت متأكد من الاستسلام؟')) {
      socket.emit('resign', { gameId });
    }
  };
  const handleOfferDraw = () => socket.emit('offer_draw', { gameId });
  const handleRespondDraw = (accept: boolean) =>
    socket.emit('respond_draw', { gameId, accept });

  const opponentColor: Color = myColor === 'white' ? 'black' : 'white';
  const topName = opponentColor === 'white' ? state.whiteName : state.blackName;
  const bottomName = myColor === 'white' ? state.whiteName : state.blackName;
  const topConnected =
    opponentColor === 'white' ? state.whiteConnected : state.blackConnected;
  const bottomConnected =
    myColor === 'white' ? state.whiteConnected : state.blackConnected;

  // عرض تعادل قائم من المنافس؟
  const opponentOfferedDraw =
    state.status === 'active' && state.drawOffer !== null && state.drawOffer !== myColor;
  const iOfferedDraw =
    state.status === 'active' && state.drawOffer === myColor;

  // رسالة النتيجة عند الانتهاء.
  const resultText = (() => {
    if (state.status !== 'finished') return null;
    const reason = state.endReason ? REASON_TEXT[state.endReason] : '';
    if (state.result === 'draw') return { title: 'تعادل', reason };
    if (state.result === myColor) return { title: '🎉 لقد فزت!', reason };
    return { title: 'خسرت', reason };
  })();

  return (
    <div className="page">
      <div className="game-layout">
        {/* عمود الرقعة */}
        <div className="board-col">
          <PlayerInfo
            name={topName}
            color={opponentColor}
            isYou={false}
            isActiveTurn={state.status === 'active' && state.turn === opponentColor}
            connected={topConnected}
            timeMs={opponentColor === 'white' ? state.whiteMs : state.blackMs}
            clockRunning={state.status === 'active' && state.turn === opponentColor}
          />

          <CapturedPieces fen={state.fen} color={opponentColor} />

          <ChessBoard
            fen={state.fen}
            myColor={myColor}
            interactive={interactive}
            lastMove={
              state.moves.length > 0
                ? {
                    from: state.moves[state.moves.length - 1].from,
                    to: state.moves[state.moves.length - 1].to,
                  }
                : null
            }
            inCheck={state.inCheck}
            onMove={handleMove}
          />

          <CapturedPieces fen={state.fen} color={myColor} />

          <PlayerInfo
            name={bottomName}
            color={myColor}
            isYou
            isActiveTurn={isMyTurn}
            connected={bottomConnected}
            timeMs={myColor === 'white' ? state.whiteMs : state.blackMs}
            clockRunning={isMyTurn}
          />

          {state.status === 'active' && (
            <div className={`turn-banner ${isMyTurn ? 'turn-you' : 'turn-them'}`}>
              {isMyTurn ? 'دورك' : 'دور المنافس'}
              {state.inCheck && ' — كش!'}
            </div>
          )}
        </div>

        {/* العمود الجانبي */}
        <div className="side-col">
          {!opponentOnline && state.status === 'active' && (
            <div className="banner banner-warn">
              انقطع اتصال المنافس… بانتظار عودته (خلال 30 ثانية).
            </div>
          )}
          {notice && <div className="banner banner-info">{notice}</div>}

          {opponentOfferedDraw && (
            <div className="banner banner-warn">
              عرض المنافس التعادل.
              <div className="actions" style={{ marginTop: 8 }}>
                <button className="btn-primary" onClick={() => handleRespondDraw(true)}>
                  قبول
                </button>
                <button className="btn-ghost" onClick={() => handleRespondDraw(false)}>
                  رفض
                </button>
              </div>
            </div>
          )}
          {iOfferedDraw && (
            <div className="banner banner-info">عرضت التعادل، بانتظار رد المنافس…</div>
          )}

          <MoveList moves={state.moves} />

          {state.status === 'active' && (
            <div className="actions">
              <button className="btn-danger" onClick={handleResign}>
                استسلام
              </button>
              <button
                className="btn-ghost"
                onClick={handleOfferDraw}
                disabled={iOfferedDraw}
              >
                عرض تعادل
              </button>
            </div>
          )}
        </div>
      </div>

      {/* نهاية المباراة */}
      {resultText && (
        <div className="overlay">
          <div className="card">
            <h2 className="result-title">{resultText.title}</h2>
            <p className="result-reason">{resultText.reason}</p>
            <button className="btn-primary" style={{ width: '100%' }} onClick={goHome}>
              العودة للرئيسية
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
