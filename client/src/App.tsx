import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import GamePage from './pages/GamePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import LeaderboardPage from './pages/LeaderboardPage';
import ProfilePage from './pages/ProfilePage';
import ChallengePage from './pages/ChallengePage';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminOverviewPage from './pages/admin/AdminOverviewPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminGamesPage from './pages/admin/AdminGamesPage';
import AdminGamePage from './pages/admin/AdminGamePage';
import RequireAdmin from './pages/admin/RequireAdmin';
import AppHeader from './components/AppHeader';
import Footer from './components/Footer';

export default function App() {
  const location = useLocation();
  // لوحة التحكم لها هيكلها الخاص بعرض كامل (بلا رأس/تذييل اللاعبين).
  const isAdminArea = location.pathname.startsWith('/admin');

  if (isAdminArea) {
    return (
      <Routes>
        <Route path="/admin/login" element={<AdminLoginPage />} />
        {/* layout route: الهيدر مشترك، والصفحات تُعرض داخل <Outlet/> */}
        <Route
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route path="/admin" element={<AdminOverviewPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/games" element={<AdminGamesPage />} />
          <Route path="/admin/games/:id" element={<AdminGamePage />} />
        </Route>
        <Route path="/admin/*" element={<Navigate to="/admin" replace />} />
      </Routes>
    );
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/game/:gameId" element={<GamePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/u/:username" element={<ProfilePage />} />
          <Route path="/challenge/:challengeId" element={<ChallengePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
