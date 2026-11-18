/** الملف الشخصي: إحصاءات اللاعب + آخر مبارياته. */
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, type GameSummary, type UserProfile } from '../services/api';

const REASON_AR: Record<string, string> = {
  checkmate: 'كش مات',
  stalemate: 'جمود',
  draw_agreed: 'تعادل بالاتفاق',
  threefold_repetition: 'تكرار ثلاثي',
  insufficient_material: 'قطع غير كافية',
  fifty_move: 'قاعدة الخمسين',
  resign: 'استسلام',
  disconnect: 'انقطاع',
};

export default function ProfilePage() {
  const { username = '' } = useParams();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<{ user: UserProfile; games: GameSummary[] }>(`/users/${encodeURIComponent(username)}`)
      .then((data) => {
        if (cancelled) return;
        setUser(data.user);
        setGames(data.games);
      })
      .catch((err) => !cancelled && setError((err as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [username]);

  if (loading) {
    return (
      <div className="page">
        <p className="muted center">جارٍ التحميل…</p>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="page">
        <div className="card auth-card">
          <h1 className="section-title">تعذّر العرض</h1>
          <p className="muted">{error ?? 'المستخدم غير موجود.'}</p>
          <Link to="/leaderboard" className="btn-primary block">
            لوحة المتصدرين
          </Link>
        </div>
      </div>
    );
  }

  const winRate =
    user.gamesPlayed > 0 ? Math.round((user.wins / user.gamesPlayed) * 100) : 0;

  return (
    <div className="page">
      <div className="card wide-card">
        <div className="profile-head">
          <div className="avatar">{user.username.slice(0, 1)}</div>
          <div>
            <h1 className="section-title no-margin">{user.username}</h1>
            <p className="muted">
              عضو منذ {new Date(user.createdAt).toLocaleDateString('ar')}
            </p>
          </div>
          <div className="elo-badge">
            <span className="elo-value">{user.elo}</span>
            <span className="elo-label">تصنيف</span>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat">
            <span className="stat-value win">{user.wins}</span>
            <span className="stat-label">فوز</span>
          </div>
          <div className="stat">
            <span className="stat-value">{user.draws}</span>
            <span className="stat-label">تعادل</span>
          </div>
          <div className="stat">
            <span className="stat-value loss">{user.losses}</span>
            <span className="stat-label">خسارة</span>
          </div>
          <div className="stat">
            <span className="stat-value">{winRate}%</span>
            <span className="stat-label">نسبة الفوز</span>
          </div>
        </div>

        <h2 className="subsection-title">آخر المباريات</h2>
        {games.length === 0 ? (
          <p className="muted center">لا مباريات مسجّلة بعد.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>النتيجة</th>
                  <th>الخصم</th>
                  <th>اللون</th>
                  <th>السبب</th>
                  <th>النقلات</th>
                  <th>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {games.map((g) => {
                  const opponent = g.myColor === 'white' ? g.blackName : g.whiteName;
                  const outcome =
                    g.result === 'draw' ? 'draw' : g.result === g.myColor ? 'win' : 'loss';
                  const label =
                    outcome === 'win' ? 'فوز' : outcome === 'loss' ? 'خسارة' : 'تعادل';
                  return (
                    <tr key={g.id}>
                      <td>
                        <span className={`badge badge-${outcome}`}>{label}</span>
                      </td>
                      <td>{opponent}</td>
                      <td>{g.myColor === 'white' ? 'أبيض' : 'أسود'}</td>
                      <td>{REASON_AR[g.endReason] ?? g.endReason}</td>
                      <td>{g.moveCount}</td>
                      <td className="dim">
                        {new Date(g.endedAt).toLocaleDateString('ar')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
