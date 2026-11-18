/** لوحة المتصدرين — ترتيب اللاعبين حسب تصنيف Elo. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type UserProfile } from '../services/api';

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ players: UserProfile[] }>('/leaderboard')
      .then((data) => !cancelled && setPlayers(data.players))
      .catch((err) => !cancelled && setError((err as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const medal = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank);

  return (
    <div className="page">
      <div className="card wide-card">
        <h1 className="section-title">🏆 لوحة المتصدرين</h1>

        {loading && <p className="muted center">جارٍ التحميل…</p>}
        {error && <div className="alert-error">{error}</div>}

        {!loading && !error && players.length === 0 && (
          <p className="muted center">لا توجد نتائج بعد — كن أول من يلعب مباراة مسجّلة!</p>
        )}

        {players.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>اللاعب</th>
                  <th>التصنيف</th>
                  <th>فوز</th>
                  <th>تعادل</th>
                  <th>خسارة</th>
                  <th>المباريات</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p, i) => (
                  <tr key={p.id} className={i < 3 ? 'top-row' : ''}>
                    <td className="rank">{medal(i + 1)}</td>
                    <td>
                      <Link to={`/u/${p.username}`} className="player-link">
                        {p.username}
                      </Link>
                    </td>
                    <td className="elo-cell">{p.elo}</td>
                    <td className="win">{p.wins}</td>
                    <td>{p.draws}</td>
                    <td className="loss">{p.losses}</td>
                    <td>{p.gamesPlayed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
