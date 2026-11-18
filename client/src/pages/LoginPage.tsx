/** صفحة تسجيل الدخول (بالاسم أو البريد). */
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, accountsEnabled } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await login(identifier, password);
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!accountsEnabled) {
    return (
      <div className="page">
        <div className="card auth-card">
          <h1 className="section-title">الحسابات غير مفعّلة</h1>
          <p className="muted">يمكنك اللعب كضيف من الصفحة الرئيسية.</p>
          <Link to="/" className="btn-primary block">
            العودة للرئيسية
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1 className="section-title">تسجيل الدخول</h1>

        <div className="field">
          <label htmlFor="identifier">اسم المستخدم أو البريد</label>
          <input
            id="identifier"
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="password">كلمة المرور</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        {error && <div className="alert-error">{error}</div>}

        <button type="submit" className="btn-primary block" disabled={busy}>
          {busy ? 'جارٍ الدخول…' : 'دخول'}
        </button>

        <p className="muted center">
          ليس لديك حساب؟ <Link to="/register">أنشئ حسابًا</Link>
        </p>
      </form>
    </div>
  );
}
