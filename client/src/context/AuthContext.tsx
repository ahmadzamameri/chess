/**
 * سياق المصادقة: المستخدم الحالي، تسجيل الدخول/الخروج/إنشاء حساب.
 * يعمل بلطف عندما تكون الحسابات معطّلة على السيرفر (وضع الضيوف).
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
import { api, clearToken, setToken, getToken, type UserProfile } from '../services/api';
import { reconnectSocket } from '../services/socket';

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  /** هل نظام الحسابات مفعّل على السيرفر؟ */
  accountsEnabled: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountsEnabled, setAccountsEnabled] = useState(false);

  // عند الإقلاع: اعرف إن كانت الحسابات مفعّلة، واستعد الجلسة إن وُجد توكن.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const status = await api.get<{ accountsEnabled: boolean }>('/status');
        if (!cancelled) setAccountsEnabled(Boolean(status.accountsEnabled));
      } catch {
        if (!cancelled) setAccountsEnabled(false);
      }

      if (getToken()) {
        try {
          const me = await api.get<{ user: UserProfile }>('/auth/me');
          if (!cancelled) setUser(me.user);
        } catch {
          clearToken(); // توكن منتهٍ أو غير صالح
        }
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const data = await api.post<{ token: string; user: UserProfile }>('/auth/login', {
      identifier,
      password,
    });
    setToken(data.token);
    setUser(data.user);
    reconnectSocket(); // ليعرف السيرفر الهوية الجديدة
  }, []);

  const register = useCallback(
    async (username: string, email: string, password: string) => {
      const data = await api.post<{ token: string; user: UserProfile }>('/auth/register', {
        username,
        email,
        password,
      });
      setToken(data.token);
      setUser(data.user);
      reconnectSocket();
    },
    [],
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    reconnectSocket(); // يعود ضيفًا
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) return;
    try {
      const me = await api.get<{ user: UserProfile }>('/auth/me');
      setUser(me.user);
    } catch {
      /* تجاهل */
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, accountsEnabled, login, register, logout, refresh }),
    [user, loading, accountsEnabled, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth يجب أن يُستخدم داخل AuthProvider');
  return ctx;
}
