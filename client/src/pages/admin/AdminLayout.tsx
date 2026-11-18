/**
 * هيكل لوحة التحكم: هيدر علوي ثابت (شعار + تنقّل + المستخدم) + محتوى بعرض كامل.
 * يعمل كـ layout route: الصفحات الفرعية تُعرض داخل <Outlet/>.
 */
import { NavLink, Outlet } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';

export default function AdminLayout() {
  const { admin, logout } = useAdminAuth();

  return (
    <div className="admin-layout">
      <header className="admin-header">
        <div className="admin-brand">
          <span className="admin-brand-icon">♟</span>
          <span>لوحة تحكم الشطرنج</span>
        </div>

        <nav className="admin-nav">
          {/* end: حتى لا يبقى "نظرة عامة" نشطًا على المسارات الفرعية */}
          <NavLink to="/admin" end>
            نظرة عامة
          </NavLink>
          <NavLink to="/admin/users">المستخدمون</NavLink>
          <NavLink to="/admin/games">المباريات</NavLink>
        </nav>

        <div className="admin-user">
          <span className="admin-user-name">
            {admin?.username}
            {admin?.role === 'super' && <span className="admin-role-badge">مدير عام</span>}
          </span>
          <button className="btn-ghost btn-sm" onClick={logout}>
            خروج
          </button>
        </div>
      </header>

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
