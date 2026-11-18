/**
 * الصفحة الرئيسية: إدخال اسم مؤقت + "العب الآن" + حالة البحث + عدد المتصلين.
 * منع الضغط المتكرر: الزر يُعطَّل أثناء البحث، والحالة تُدار محليًا.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import {
  getSessionId,
  setActiveGameId,
} from '../services/socket';
import MatchmakingStatus from '../components/MatchmakingStatus';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { TIME_CONTROLS, CATEGORY_AR, type MatchFound } from '../types';
import ChessPieceIcon, { type PieceType } from '../components/ChessPieceIcon';

const TC_STORAGE_KEY = 'chess_time_control';

/** وضع بداية تزييني للرقعة (FEN مبسّط: حرف كبير = أبيض، صغير = أسود). */
const DECOR_BOARD: string[][] = [
  ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
  ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
  ['', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', ''],
  ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
  ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
];

/** نص عدد المتصلين مع مراعاة المفرد/المثنى/الجمع بالعربية. */
function onlineText(n: number): string {
  if (n <= 0) return 'لا أحد متصل الآن';
  if (n === 1) return 'لاعب واحد متصل الآن';
  if (n === 2) return 'لاعبان متصلان الآن';
  if (n <= 10) return `${n} لاعبين متصلين الآن`;
  return `${n} لاعبًا متصلًا الآن`;
}

/** اسم مؤقت افتراضي مقترح. */
function randomName(): string {
  return `لاعب-${Math.floor(1000 + Math.random() * 9000)}`;
}

export default function HomePage() {
  const { socket, connected, onlineCount } = useSocket();
  const { user, accountsEnabled } = useAuth();
  const navigate = useNavigate();
  const sessionId = useMemo(() => getSessionId(), []);

  const [name, setName] = useState(randomName);
  const [searching, setSearching] = useState(false);
  // نتذكّر آخر اختيار للتحكم الزمني.
  const [timeControlId, setTimeControlId] = useState(
    () => localStorage.getItem(TC_STORAGE_KEY) || '5+0',
  );
  /** رابط التحدي بعد إنشائه (وضع انتظار الصديق). */
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onSearching = () => setSearching(true);
    const onCancelled = () => setSearching(false);
    const onMatchFound = (data: MatchFound) => {
      setSearching(false);
      setActiveGameId(data.gameId);
      navigate(`/game/${data.gameId}`);
    };
    const onError = (data: { message: string }) => {
      setSearching(false);
      if (data?.message) alert(data.message);
    };

    const onChallengeCreated = (data: { challengeId: string }) => {
      setChallengeId(data.challengeId);
      setCopied(false);
    };
    const onChallengeCancelled = () => setChallengeId(null);

    socket.on('searching', onSearching);
    socket.on('search_cancelled', onCancelled);
    socket.on('match_found', onMatchFound);
    socket.on('error_message', onError);
    socket.on('challenge_created', onChallengeCreated);
    socket.on('challenge_cancelled', onChallengeCancelled);

    return () => {
      socket.off('searching', onSearching);
      socket.off('search_cancelled', onCancelled);
      socket.off('match_found', onMatchFound);
      socket.off('error_message', onError);
      socket.off('challenge_created', onChallengeCreated);
      socket.off('challenge_cancelled', onChallengeCancelled);
    };
  }, [socket, navigate]);

  const handlePlay = () => {
    if (searching || !connected) return; // منع الضغط المتكرر
    setSearching(true);
    localStorage.setItem(TC_STORAGE_KEY, timeControlId);
    socket.emit('find_match', { name: name.trim(), sessionId, timeControlId });
  };

  const handleCancel = () => {
    socket.emit('cancel_match');
    setSearching(false);
  };

  const handleCreateChallenge = () => {
    if (!connected) return;
    localStorage.setItem(TC_STORAGE_KEY, timeControlId);
    socket.emit('create_challenge', {
      sessionId,
      name: name.trim(),
      timeControlId,
    });
  };

  const challengeLink = challengeId
    ? `${window.location.origin}/challenge/${challengeId}`
    : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(challengeLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // بعض المتصفحات تمنع الحافظة بلا تفاعل مباشر — يبقى النص قابلًا للتحديد يدويًا.
    }
  };

  const handleCancelChallenge = () => {
    socket.emit('cancel_challenge', { challengeId });
    setChallengeId(null);
  };

  return (
    <div className="home-hero">
      <div className="home-hero-inner">
        {/* الجهة البصرية: عنوان + تسويق + رقعة تزيينية */}
        <section className="home-visual">
          <h1 className="home-hero-title">
            شطرنج أونلاين <span className="home-hero-accent">مباشر</span>
          </h1>
          <p className="home-hero-tag">
            العب مع لاعبين حقيقيين، تحدَّ أصدقاءك برابط، وطوّر تصنيفك — مباشرةً من متصفحك بلا تحميل.
          </p>

          <div className="home-board" aria-hidden="true">
            {DECOR_BOARD.map((row, r) =>
              row.map((code, c) => (
                <div key={`${r}-${c}`} className={`home-sq ${(r + c) % 2 === 0 ? 'light' : 'dark'}`}>
                  {code && (
                    <ChessPieceIcon
                      type={code.toLowerCase() as PieceType}
                      color={code === code.toUpperCase() ? 'w' : 'b'}
                    />
                  )}
                </div>
              )),
            )}
          </div>

          <ul className="home-features">
            <li><span className="hf-ic">⚡</span> مباريات فورية بعدة أنماط زمنية</li>
            <li><span className="hf-ic">🏆</span> تصنيف Elo ولوحة متصدرين</li>
            <li><span className="hf-ic">🔗</span> تحدَّ صديقًا برابط مباشر</li>
          </ul>
        </section>

        {/* بطاقة بدء المباراة (نفس الوظائف تمامًا) */}
        <div className="card home-card">
          <div className="home-card-head">
            <h2 className="home-card-title">ابدأ اللعب</h2>
            <div className="online-badge">
              <span className={`dot ${connected ? 'on' : ''}`} />
              {onlineText(onlineCount)}
            </div>
          </div>

          {challengeId ? (
          /* وضع انتظار الصديق بعد إنشاء رابط التحدي */
          <div className="challenge-wait">
            <div className="spinner" aria-hidden />
            <p style={{ margin: 0 }}>بانتظار صديقك…</p>
            <p className="muted small-note" style={{ marginTop: 0 }}>
              أرسل له هذا الرابط — ستبدأ المباراة تلقائيًا عند قبوله.
            </p>

            <div className="link-box">
              <input type="text" readOnly value={challengeLink} onFocus={(e) => e.target.select()} />
              <button className="btn-primary btn-sm" onClick={handleCopy}>
                {copied ? '✓ نُسخ' : 'نسخ'}
              </button>
            </div>

            <button className="btn-ghost" onClick={handleCancelChallenge}>
              إلغاء التحدي
            </button>
          </div>
        ) : !searching ? (
          <>
            {user ? (
              /* لاعب مسجّل: يلعب باسم حسابه، ومبارياته تُحفظ ويتغيّر تصنيفه. */
              <div className="logged-box">
                <span className="logged-label">تلعب باسم</span>
                <div className="logged-name">
                  {user.username}
                  <span className="elo-chip">{user.elo}</span>
                </div>
                <small className="hint">مبارياتك تُحفظ ويُحدَّث تصنيفك.</small>
              </div>
            ) : (
              <div className="field">
                <label htmlFor="name">اسمك المؤقت</label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  maxLength={20}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePlay()}
                  placeholder="اكتب اسمك…"
                />
              </div>
            )}

            {/* اختيار التحكم الزمني — مثل lichess */}
            <div className="tc-section">
              <span className="tc-title">التحكم بالوقت</span>
              <div className="tc-grid">
                {TIME_CONTROLS.map((tc) => (
                  <button
                    key={tc.id}
                    type="button"
                    className={`tc-btn ${timeControlId === tc.id ? 'selected' : ''}`}
                    onClick={() => setTimeControlId(tc.id)}
                  >
                    <span className="tc-value">{tc.label}</span>
                    <span className="tc-cat">{CATEGORY_AR[tc.category]}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              className="btn-primary block big"
              onClick={handlePlay}
              disabled={!connected}
            >
              العب الآن
            </button>

            <button
              className="btn-ghost block btn-with-ic"
              style={{ marginTop: 12 }}
              onClick={handleCreateChallenge}
              disabled={!connected}
            >
              <svg className="btn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <path d="M9.5 13.5a3.5 3.5 0 0 1 0-5l2-2a3.5 3.5 0 0 1 5 5l-1 1" />
                <path d="M14.5 10.5a3.5 3.5 0 0 1 0 5l-2 2a3.5 3.5 0 0 1-5-5l1-1" />
              </svg>
              تحدَّ صديقًا برابط
            </button>

            {!connected && (
              <p className="alert-inline">جارٍ الاتصال بالسيرفر…</p>
            )}

            {!user && accountsEnabled && (
              <p className="muted center small-note">
                تلعب كضيف — <Link to="/register">أنشئ حسابًا</Link> لحفظ مبارياتك وتصنيفك.
              </p>
            )}
          </>
          ) : (
            <MatchmakingStatus onCancel={handleCancel} />
          )}
        </div>
      </div>
    </div>
  );
}
