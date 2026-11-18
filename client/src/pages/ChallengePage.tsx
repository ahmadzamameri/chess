/**
 * صفحة قبول تحدٍّ عبر رابط: /challenge/:challengeId
 * من يفتح الرابط يرى اسم المتحدّي ونوع الوقت، ويضغط "قبول" فتبدأ المباراة.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { getSessionId, setActiveGameId } from '../services/socket';
import type { MatchFound } from '../types';

interface ChallengeInfo {
  challengeId: string;
  creatorName: string;
  timeControlId: string;
  isMine: boolean;
}

function randomName(): string {
  return `لاعب-${Math.floor(1000 + Math.random() * 9000)}`;
}

export default function ChallengePage() {
  const { challengeId = '' } = useParams();
  const { socket, connected } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();
  const sessionId = useMemo(() => getSessionId(), []);

  const [info, setInfo] = useState<ChallengeInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [name, setName] = useState(randomName);
  const [accepting, setAccepting] = useState(false);

  // اطلب معلومات التحدي عند الاتصال.
  useEffect(() => {
    if (!connected) return;
    socket.emit('get_challenge', { challengeId });
  }, [socket, connected, challengeId]);

  useEffect(() => {
    const onInfo = (data: ChallengeInfo) => {
      if (data.challengeId !== challengeId) return;
      setInfo(data);
      setNotFound(false);
    };
    const onNotFound = () => {
      setNotFound(true);
      setAccepting(false);
    };
    const onMatchFound = (data: MatchFound) => {
      setActiveGameId(data.gameId);
      navigate(`/game/${data.gameId}`);
    };
    const onError = (data: { message: string }) => {
      setAccepting(false);
      if (data?.message) alert(data.message);
    };

    socket.on('challenge_info', onInfo);
    socket.on('challenge_not_found', onNotFound);
    socket.on('match_found', onMatchFound);
    socket.on('error_message', onError);

    return () => {
      socket.off('challenge_info', onInfo);
      socket.off('challenge_not_found', onNotFound);
      socket.off('match_found', onMatchFound);
      socket.off('error_message', onError);
    };
  }, [socket, challengeId, navigate]);

  const handleAccept = () => {
    if (accepting || !connected) return;
    setAccepting(true);
    socket.emit('accept_challenge', {
      challengeId,
      sessionId,
      name: user ? user.username : name.trim(),
    });
  };

  if (notFound) {
    return (
      <div className="page">
        <div className="card auth-card center">
          <h1 className="section-title">التحدي غير متاح</h1>
          <p className="muted">
            انتهت صلاحية الرابط، أو أُلغي التحدي، أو غادر صاحبه.
          </p>
          <Link to="/" className="btn-primary block">
            العودة للرئيسية
          </Link>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="page">
        <div className="searching">
          <div className="spinner" aria-hidden />
          <p>جارٍ تحميل التحدي…</p>
        </div>
      </div>
    );
  }

  // صاحب التحدي نفسه فتح الرابط.
  if (info.isMine) {
    return (
      <div className="page">
        <div className="card auth-card center">
          <h1 className="section-title">هذا تحدّيك أنت</h1>
          <p className="muted">
            أرسل الرابط لصديقك ليقبله. ستنتقلان للمباراة تلقائيًا عند قبوله.
          </p>
          <div className="challenge-meta">
            <span className="tc-badge">{info.timeControlId}</span>
          </div>
          <Link to="/" className="btn-ghost block" style={{ marginTop: 14 }}>
            العودة للرئيسية
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card auth-card center">
        <h1 className="section-title">دعوة لمباراة</h1>

        <div className="challenge-box">
          <span className="challenger-name">{info.creatorName}</span>
          <span className="muted">يتحدّاك في مباراة</span>
          <div className="challenge-meta">
            <span className="tc-badge">{info.timeControlId}</span>
          </div>
        </div>

        {!user && (
          <div className="field" style={{ marginTop: 16 }}>
            <label htmlFor="cname">اسمك</label>
            <input
              id="cname"
              type="text"
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        )}

        <button
          className="btn-primary block big"
          onClick={handleAccept}
          disabled={!connected || accepting}
        >
          {accepting ? 'جارٍ البدء…' : 'قبول التحدي'}
        </button>

        <Link to="/" className="muted small-note" style={{ display: 'block', marginTop: 14 }}>
          رفض والعودة للرئيسية
        </Link>
      </div>
    </div>
  );
}
