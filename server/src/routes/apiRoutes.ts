/**
 * مسارات REST: المصادقة + الملف الشخصي + لوحة المتصدرين.
 * كل المسارات تتعامل بلطف مع غياب قاعدة البيانات (503 برسالة واضحة).
 */
import { Router, type Request, type Response } from 'express';
import {
  isAuthConfigured,
  signToken,
  validateEmail,
  validatePassword,
  validateUsername,
  verifyToken,
} from '../auth/credentials.js';
import { isDbReady } from '../db/pool.js';
import {
  findById,
  findByUsername,
  getLeaderboard,
  loginUser,
  registerUser,
  toPublicProfile,
} from '../services/userService.js';
import { getUserGames } from '../services/gameRecords.js';
import { config } from '../config.js';
import { createThrottle } from '../auth/throttle.js';

export const apiRouter = Router();

// حماية دخول اللاعب من التخمين (عدّ الفشل، مسح عند النجاح).
const loginThrottle = createThrottle(
  config.playerLoginRateLimit.windowMs,
  config.playerLoginRateLimit.maxFails,
);
// حماية التسجيل من السبام (عدّ كل محاولة لكل IP).
const registerThrottle = createThrottle(
  config.registerRateLimit.windowMs,
  config.registerRateLimit.max,
);

/** أفضل تقدير لعنوان العميل (خلف بروكسي أو مباشرة). */
function clientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress ?? 'unknown';
}

/** هل نظام الحسابات جاهز (قاعدة + سرّ توقيع)؟ */
function accountsEnabled(): boolean {
  return isDbReady() && isAuthConfigured();
}

/** تُخبر الواجهة بما هو متاح، فتُخفي أزرار التسجيل إن كانت معطّلة. */
apiRouter.get('/status', (_req: Request, res: Response) => {
  res.json({ accountsEnabled: accountsEnabled() });
});

/* ------------------------- التسجيل ------------------------- */
apiRouter.post('/auth/register', async (req: Request, res: Response) => {
  if (!accountsEnabled()) {
    return res.status(503).json({ error: 'نظام الحسابات غير مفعّل حاليًا.' });
  }

  // حماية من سبام إنشاء الحسابات: احجب الـIP بعد تجاوز الحد، وعُدّ كل محاولة.
  const ip = clientIp(req);
  if (registerThrottle.isBlocked(ip)) {
    return res.status(429).json({ error: 'محاولات تسجيل كثيرة. حاول بعد قليل.' });
  }
  registerThrottle.record(ip);

  const username = validateUsername(req.body?.username);
  const email = validateEmail(req.body?.email);
  const password = validatePassword(req.body?.password);

  if (!username) return res.status(400).json({ error: 'اسم المستخدم يجب أن يكون 3–20 حرفًا (حروف وأرقام وشرطة سفلية).' });
  if (!email) return res.status(400).json({ error: 'صيغة البريد الإلكتروني غير صحيحة.' });
  if (!password) return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.' });

  const result = await registerUser(username, email, password);
  if (!result.ok) {
    const messages: Record<string, string> = {
      username_taken: 'اسم المستخدم مستخدم بالفعل.',
      email_taken: 'البريد الإلكتروني مسجّل بالفعل.',
      db_unavailable: 'قاعدة البيانات غير متاحة حاليًا.',
      failed: 'تعذّر إنشاء الحساب، حاول لاحقًا.',
    };
    return res.status(400).json({ error: messages[result.reason] ?? 'فشل التسجيل.' });
  }

  const token = signToken({ userId: result.user.id, username: result.user.username });
  res.json({ token, user: toPublicProfile(result.user) });
});

/* ------------------------- الدخول ------------------------- */
apiRouter.post('/auth/login', async (req: Request, res: Response) => {
  if (!accountsEnabled()) {
    return res.status(503).json({ error: 'نظام الحسابات غير مفعّل حاليًا.' });
  }

  // حماية من تخمين كلمة السر: احجب الـIP بعد تجاوز حدّ المحاولات الفاشلة.
  const ip = clientIp(req);
  if (loginThrottle.isBlocked(ip)) {
    return res.status(429).json({ error: 'محاولات دخول كثيرة. انتظر قليلًا ثم حاول مجددًا.' });
  }

  const identifier = typeof req.body?.identifier === 'string' ? req.body.identifier : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!identifier || !password) {
    return res.status(400).json({ error: 'أدخل اسم المستخدم/البريد وكلمة المرور.' });
  }

  const result = await loginUser(identifier, password);
  if (!result.ok) {
    loginThrottle.record(ip); // عدّ الفشل نحو حدّ الحجب
    // رسالة موحّدة عمدًا حتى لا نكشف وجود الحساب من عدمه.
    return res.status(401).json({ error: 'بيانات الدخول غير صحيحة.' });
  }

  loginThrottle.clear(ip); // دخول ناجح يمسح عدّاد الـIP
  const token = signToken({ userId: result.user.id, username: result.user.username });
  res.json({ token, user: toPublicProfile(result.user) });
});

/* --------------------- المستخدم الحالي --------------------- */
apiRouter.get('/auth/me', async (req: Request, res: Response) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const payload = token ? verifyToken(token) : null;
  if (!payload) return res.status(401).json({ error: 'غير مصرّح.' });

  const user = await findById(payload.userId);
  if (!user) return res.status(401).json({ error: 'غير مصرّح.' });
  res.json({ user: toPublicProfile(user) });
});

/* ------------------- لوحة المتصدرين ------------------- */
apiRouter.get('/leaderboard', async (req: Request, res: Response) => {
  if (!isDbReady()) return res.json({ players: [] });
  const limit = Number(req.query.limit) || 50;
  const players = await getLeaderboard(limit);
  res.json({ players });
});

/* ---------------- الملف الشخصي العام ---------------- */
apiRouter.get('/users/:username', async (req: Request, res: Response) => {
  if (!isDbReady()) return res.status(503).json({ error: 'غير متاح حاليًا.' });

  const username = validateUsername(req.params.username);
  if (!username) return res.status(400).json({ error: 'اسم مستخدم غير صالح.' });

  const user = await findByUsername(username);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود.' });

  const games = await getUserGames(user.id, 20);
  res.json({
    user: toPublicProfile(user),
    games: games.map((g) => ({
      id: g.id,
      whiteName: g.white_name,
      blackName: g.black_name,
      result: g.result,
      endReason: g.end_reason,
      moveCount: g.move_count,
      endedAt: new Date(g.ended_at).toISOString(),
      myColor: g.white_user_id === user.id ? 'white' : 'black',
    })),
  });
});
