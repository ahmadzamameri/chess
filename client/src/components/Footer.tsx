/** تذييل الموقع. */
import { useLocation } from 'react-router-dom';

const SITE_YEAR = new Date().getFullYear();

export default function Footer() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/game/')) return null;

  return (
    <footer className="app-footer">
      <div className="app-footer-inner">
        <span className="footer-brand">
          <span className="footer-icon">♟️</span> شطرنج أونلاين
        </span>
        <span className="footer-meta">© {SITE_YEAR} — جميع الحقوق محفوظة</span>
      </div>
    </footer>
  );
}
