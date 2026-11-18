/**
 * سياق مصادقة لوحة التحكم — منفصل تمامًا عن سياق اللاعب (AuthContext).
 * مشرف الموقع كيان مستقل بجلسته وتوكنه الخاص.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  adminApi,
  clearAdminToken,
  getAdminToken,
  setAdminToken,
  type AdminInfo,
} from '../services/adminApi';

interface AdminAuthContextValue {
  admin: AdminInfo | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // عند الإقلاع: استعد الجلسة إن وُجد توكن مشرف صالح.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (getAdminToken()) {
        try {
          const me = await adminApi.get<{ admin: AdminInfo }>('/me');
          if (!cancelled) setAdmin(me.admin);
        } catch {
          clearAdminToken(); // توكن منتهٍ أو غير صالح
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const data = await adminApi.post<{ token: string; admin: AdminInfo }>('/login', {
      username,
      password,
    });
    setAdminToken(data.token);
    setAdmin(data.admin);
  }, []);

  const logout = useCallback(() => {
    clearAdminToken();
    setAdmin(null);
  }, []);

  const value = useMemo(
    () => ({ admin, loading, login, logout }),
    [admin, loading, login, logout],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth يجب أن يُستخدم داخل AdminAuthProvider');
  return ctx;
}
