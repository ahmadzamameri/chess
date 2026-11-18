/** ترويسة الموقع: الشعار + التنقل + حالة المستخدم. */
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AppHeader() {
  const { user, accountsEnabled, logout } = useAuth();
  const { pathname } = useLocation();

  // نُخفي الترويسة داخل صفحة المباراة حتى لا تشتّت اللاعب.
  if (pathname.startsWith('/game/')) return null;

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link to="/" className="brand">
          <span className="brand-icon">♞</span>
          <span className="brand-text">شطرنج أونلاين</span>
        </Link>

        <nav className="nav">
        <Link to="/" className={pathname === '/' ? 'nav-link active' : 'nav-link'}>
          اللعب
        </Link>
        <Link
          to="/leaderboard"
          className={pathname === '/leaderboard' ? 'nav-link active' : 'nav-link'}
        >
          المتصدرون
        </Link>

        {user ? (
          <>
            <Link
              to={`/u/${user.username}`}
              className={pathname.startsWith('/u/') ? 'nav-link active' : 'nav-link'}
            >
              {user.username}
              <span className="elo-chip">{user.elo}</span>
            </Link>
            <button className="btn-ghost btn-sm" onClick={logout}>
              خروج
            </button>
          </>
        ) : accountsEnabled ? (
          <>
            <Link to="/login" className="nav-link">
              دخول
            </Link>
            <Link to="/register" className="btn-primary btn-sm">
              إنشاء حساب
            </Link>
          </>
        ) : null}
        </nav>
      </div>
    </header>
  );
}
