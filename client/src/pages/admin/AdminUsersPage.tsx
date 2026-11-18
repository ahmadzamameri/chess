/** صفحة المستخدمين: بحث + جدول كامل باللاعبين. */
import { useCallback, useEffect, useState } from 'react';
import { adminApi, type AdminPlayer } from '../../services/adminApi';
import { fmtDate } from './adminHelpers';

export default function AdminUsersPage() {
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (term: string) => {
    const q = term.trim() ? `?search=${encodeURIComponent(term.trim())}` : '';
    const res = await adminApi.get<{ players: AdminPlayer[] }>(`/players${q}`);
    setPlayers(res.players);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load('');
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await load(search);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <>
      <h1 className="admin-page-title">المستخدمون</h1>
      {error && <div className="alert-error">{error}</div>}

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2 className="admin-panel-title">
            القائمة <span className="admin-count">{players.length}</span>
          </h2>
          <form className="admin-search" onSubmit={onSearch}>
            <input
              type="text"
              placeholder="بحث بالاسم أو البريد…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" className="btn-primary btn-sm">
              بحث
            </button>
          </form>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>الاسم</th>
                <th>البريد</th>
                <th>التصنيف</th>
                <th>ف/خ/ت</th>
                <th>المباريات</th>
                <th>انضمّ</th>
                <th>آخر دخول</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="muted center">
                    جارٍ التحميل…
                  </td>
                </tr>
              ) : players.length === 0 ? (
                <tr>
                  <td colSpan={8} className="muted center">
                    لا يوجد مستخدمون مطابقون.
                  </td>
                </tr>
              ) : (
                players.map((p) => (
                  <tr key={p.id}>
                    <td className="dim">{p.id}</td>
                    <td className="admin-cell-name">{p.username}</td>
                    <td className="muted">{p.email}</td>
                    <td>
                      <span className="elo-chip">{p.elo}</span>
                    </td>
                    <td className="dim">
                      {p.wins}/{p.losses}/{p.draws}
                    </td>
                    <td>{p.gamesPlayed}</td>
                    <td className="muted">{fmtDate(p.createdAt)}</td>
                    <td className="muted">{p.lastLoginAt ? fmtDate(p.lastLoginAt) : '—'}</td>
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
