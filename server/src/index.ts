/**
 * نقطة تشغيل السيرفر: Express + HTTP + Socket.IO.
 */
import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { config } from './config.js';
import { registerSocketHandlers } from './socket.js';
import { initDb, isDbReady } from './db/pool.js';
import { apiRouter } from './routes/apiRoutes.js';
import { adminRouter } from './routes/adminRoutes.js';

const app = express();

app.use(cors({ origin: config.clientOrigin }));
app.use(express.json({ limit: '64kb' }));

// فحص صحة بسيط.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', db: isDbReady(), time: new Date().toISOString() });
});

// مسارات REST (مصادقة/ملف شخصي/متصدرين).
app.use('/api', apiRouter);

// مسارات لوحة التحكم (دخول المشرف + إحصاءات + إدارة اللاعبين).
app.use('/api/admin', adminRouter);

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: config.clientOrigin,
    methods: ['GET', 'POST'],
  },
});

registerSocketHandlers(io);

// معالجة أخطاء مركزية على مستوى العملية.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

// مهم: ننهي العملية عند خطأ غير ملتقط بدل ابتلاعه — وإلا بقيت العملية "online"
// في pm2 بلا استماع فعلي (فشل صامت يصعب تشخيصه)، ويتولّى pm2 إعادة التشغيل.
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException] إنهاء العملية:', err);
  process.exit(1);
});

// خطأ في فتح المنفذ (مثل EADDRINUSE) يجب أن يُنهي العملية بوضوح.
httpServer.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[fatal] المنفذ ${config.port} مشغول بالفعل — أوقف العملية التي تستخدمه أو غيّر PORT.`);
  } else {
    console.error('[fatal] خطأ في تشغيل السيرفر:', err);
  }
  process.exit(1);
});

// نحاول الاتصال بقاعدة البيانات ثم نُقلع في كل الأحوال (فشل آمن).
await initDb();

httpServer.listen(config.port, () => {
  console.log(`♟️  سيرفر الشطرنج يعمل على المنفذ ${config.port}`);
  console.log(`   الأصل المسموح (CORS): ${config.clientOrigin}`);
  console.log(`   الحسابات والحفظ: ${isDbReady() ? 'مفعّلة' : 'معطّلة (وضع الضيوف)'}`);
});
