import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// خادم Vite للتطوير على المنفذ 5173.
// proxy: يمرّر اتصال Socket.IO داخليًا إلى السيرفر (4001) — فلا حاجة لتمرير منفذ
// ثانٍ للمتصفح ولا لإعداد CORS، ويعمل كل شيء عبر منفذ 5173 فقط.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:4001',
        ws: true,
        changeOrigin: false,
      },
      // مسارات REST (تسجيل/دخول/متصدرين/ملف شخصي)
      '/api': {
        target: 'http://localhost:4001',
        changeOrigin: false,
      },
    },
  },
});
