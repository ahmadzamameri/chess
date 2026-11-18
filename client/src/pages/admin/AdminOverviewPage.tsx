/** نظرة عامة: بطاقات إحصاء + معاينة سريعة لأحدث المباريات. */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminApi, type AdminRecentGame, type AdminStats } from '../../services/adminApi';
import { fmtDate, RESULT_META } from './adminHelpers';

export default function AdminOverviewPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [games, setGames] = useState<AdminRecentGame[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, g] = await Promise.all([
          adminApi.get<{ stats: AdminStats }>('/stats'),
          adminApi.get<{ games: AdminRecentGame[] }>('/games'),
        ]);
        if (cancelled) return;
        setStats(s.stats);
        setGames(g.games.slice(0, 5));
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <p className="muted center admin-loading">جارٍ التحميل…</p>;

  const statCards = stats
    ? [
        { value: stats.totalPlayers, label: 'إجمالي اللاعبين', accent: 'a-blue' },
        { value: stats.totalGames, label: 'إجمالي المباريات', accent: 'a-green' },
        { value: stats.gamesToday, label: 'مباريات اليوم', accent: 'a-gold' },
        { value: stats.newPlayersToday, label: 'لاعبون جدد اليوم', accent: 'a-green' },
      ]
    : [];

  return (
    <>
      {error && <div className="alert-error">{error}</div>}

      <h1 className="admin-page-title">نظرة عامة</h1>
      <div className="admin-stats">
        {statCards.map((c) => (
          <div key={c.label} className={`admin-stat ${c.accent}`}>
            <div className="admin-stat-value">{c.value.toLocaleString('ar')}</div>
            <div className="admin-stat-label">{c.label}</div>
          </div>
        ))}
      </div>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2 className="admin-panel-title">أحدث المباريات</h2>
          <Link to="/admin/games" className="btn-ghost btn-sm">
            عرض الكل
          </Link>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>الأبيض</th>
                <th>الأسود</th>
                <th>النتيجة</th>
                <th>النقلات</th>
                <th>انتهت</th>
              </tr>
            </thead>
            <tbody>
              {games.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted center">
                    لا توجد مباريات بعد.
                  </td>
                </tr>
              ) : (
                games.map((g) => (
                  <tr
                    key={g.id}
                    className="admin-row-link"
                    onClick={() => navigate(`/admin/games/${g.id}`)}
                    title="عرض المباراة"
                  >
                    <td className="dim">{g.id}</td>
                    <td className="admin-cell-name">{g.whiteName}</td>
                    <td className="admin-cell-name">{g.blackName}</td>
                    <td>
                      <span className={`badge ${RESULT_META[g.result].cls}`}>
                        {RESULT_META[g.result].label}
                      </span>
                    </td>
                    <td>{g.moveCount}</td>
                    <td className="muted">{fmtDate(g.endedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
