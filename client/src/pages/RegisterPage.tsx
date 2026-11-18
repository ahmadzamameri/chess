/** صفحة إنشاء حساب جديد. */
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { register, accountsEnabled } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);

    if (password !== confirm) {
      setError('كلمتا المرور غير متطابقتين.');
      return;
    }

    setBusy(true);
    try {
      await register(username, email, password);
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
        <h1 className="section-title">إنشاء حساب</h1>

        <div className="field">
          <label htmlFor="username">اسم المستخدم</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            minLength={3}
            maxLength={20}
            autoComplete="username"
            required
          />
          <small className="hint">3–20 حرفًا: حروف وأرقام وشرطة سفلية.</small>
        </div>

        <div className="field">
          <label htmlFor="email">البريد الإلكتروني</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
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
            minLength={6}
            autoComplete="new-password"
            required
          />
          <small className="hint">6 أحرف على الأقل.</small>
        </div>

        <div className="field">
          <label htmlFor="confirm">تأكيد كلمة المرور</label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={6}
            autoComplete="new-password"
            required
          />
        </div>

        {error && <div className="alert-error">{error}</div>}

        <button type="submit" className="btn-primary block" disabled={busy}>
          {busy ? 'جارٍ الإنشاء…' : 'إنشاء الحساب'}
        </button>

        <p className="muted center">
          لديك حساب؟ <Link to="/login">سجّل الدخول</Link>
        </p>
      </form>
    </div>
  );
}
