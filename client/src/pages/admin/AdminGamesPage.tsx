/** صفحة المباريات: جدول كامل بآخر المباريات المنتهية. */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, type AdminRecentGame } from '../../services/adminApi';
import { fmtDate, RESULT_META } from './adminHelpers';

export default function AdminGamesPage() {
  const navigate = useNavigate();
  const [games, setGames] = useState<AdminRecentGame[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await adminApi.get<{ games: AdminRecentGame[] }>('/games');
        if (!cancelled) setGames(res.games);
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

  return (
    <>
      <h1 className="admin-page-title">المباريات</h1>
      {error && <div className="alert-error">{error}</div>}

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2 className="admin-panel-title">
            آخر المباريات <span className="admin-count">{games.length}</span>
          </h2>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>الأبيض</th>
                <th>الأسود</th>
                <th>النتيجة</th>
                <th>السبب</th>
                <th>النقلات</th>
                <th>انتهت</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="muted center">
                    جارٍ التحميل…
                  </td>
                </tr>
              ) : games.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted center">
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
                    <td className="muted">{g.endReason}</td>
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
