/** حارس مسارات لوحة التحكم: يحوّل غير المسجّل إلى صفحة دخول المشرف. */
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';

export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { admin, loading } = useAdminAuth();

  if (loading) {
    return (
      <div className="page">
        <div className="card">
          <p className="muted center">جارٍ التحقق…</p>
        </div>
      </div>
    );
  }

  if (!admin) return <Navigate to="/admin/login" replace />;

  return <>{children}</>;
}
