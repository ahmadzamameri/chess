/**
 * مسارات لوحة التحكم (‎/api/admin‎).
 * الدخول عام؛ بقية المسارات محميّة بتوكن مشرف صالح (requireAdmin).
 * كل شيء يتعامل بلطف مع غياب قاعدة البيانات (503 برسالة واضحة).
 */
import { Router, type NextFunction, type Request, type Response } from 'express';
import { config } from '../config.js';
import { isAuthConfigured } from '../auth/credentials.js';
import { signAdminToken, verifyAdminToken, type AdminTokenPayload } from '../auth/adminAuth.js';
import { clearLoginFails, isLoginBlocked, recordLoginFail } from '../auth/loginThrottle.js';
import { isDbReady } from '../db/pool.js';
import {
  findAdminById,
  getAdminStats,
  getGameById,
  getPlayers,
  getRecentGames,
  loginAdmin,
} from '../services/adminService.js';

export const adminRouter = Router();

// مفتاح الإيقاف الكلّي: عند التعطيل تُخفى كل مسارات الإدارة (404) فلا يمكن حتى استكشافها.
adminRouter.use((_req: Request, res: Response, next: NextFunction) => {
  if (!config.adminPanelEnabled) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  next();
});

/** يوسّع الطلب بحمولة المشرف بعد التحقق. */
interface AdminRequest extends Request {
  admin?: AdminTokenPayload;
}

/** هل لوحة التحكم جاهزة (قاعدة + سرّ توقيع)؟ */
function adminEnabled(): boolean {
  return isDbReady() && isAuthConfigured();
}

/** أفضل تقدير لعنوان العميل (خلف بروكسي أو مباشرة). */
function clientIp(req: Request): string | null {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress ?? null;
}

/** حارس: يتطلب توكن مشرف صالح في ترويسة Authorization. */
function requireAdmin(req: AdminRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const payload = token ? verifyAdminToken(token) : null;
  if (!payload) {
    res.status(401).json({ error: 'غير مصرّح.' });
    return;
  }
  req.admin = payload;
  next();
}

/* ----------------------------- الدخول ----------------------------- */
adminRouter.post('/login', async (req: Request, res: Response) => {
  if (!adminEnabled()) {
    return res.status(503).json({ error: 'لوحة التحكم غير مفعّلة حاليًا.' });
  }

  const ip = clientIp(req) ?? 'unknown';
  // حماية من التخمين: احجب الـIP بعد تجاوز حدّ المحاولات الفاشلة.
  if (isLoginBlocked(ip)) {
    return res.status(429).json({ error: 'محاولات دخول كثيرة. انتظر قليلًا ثم حاول مجددًا.' });
  }

  const username = typeof req.body?.username === 'string' ? req.body.username : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!username || !password) {
    return res.status(400).json({ error: 'أدخل اسم المستخدم وكلمة المرور.' });
  }

  const result = await loginAdmin(username, password, ip);
  if (!result.ok) {
    recordLoginFail(ip); // عدّ الفشل نحو حدّ الحجب
    // رسالة موحّدة عمدًا لكل الأسباب حتى لا نكشف تفاصيل الحساب.
    return res.status(401).json({ error: 'بيانات الدخول غير صحيحة.' });
  }

  clearLoginFails(ip); // دخول ناجح يمسح عدّاد الـIP

  const token = signAdminToken({
    adminId: result.admin.id,
    username: result.admin.username,
    role: result.admin.role,
  });
  res.json({
    token,
    admin: { id: result.admin.id, username: result.admin.username, role: result.admin.role },
  });
});

/* -------------------------- المشرف الحالي -------------------------- */
adminRouter.get('/me', requireAdmin, async (req: AdminRequest, res: Response) => {
  const admin = await findAdminById(req.admin!.adminId);
  if (!admin || !admin.is_active) return res.status(401).json({ error: 'غير مصرّح.' });
  res.json({ admin: { id: admin.id, username: admin.username, role: admin.role } });
});

/* ---------------------------- الإحصاءات ---------------------------- */
adminRouter.get('/stats', requireAdmin, async (_req: AdminRequest, res: Response) => {
  const stats = await getAdminStats();
  res.json({ stats });
});

/* --------------------------- قائمة اللاعبين --------------------------- */
adminRouter.get('/players', requireAdmin, async (req: AdminRequest, res: Response) => {
  const search = typeof req.query.search === 'string' ? req.query.search : '';
  const players = await getPlayers(search, 100);
  res.json({ players });
});

/* --------------------------- آخر المباريات --------------------------- */
adminRouter.get('/games', requireAdmin, async (_req: AdminRequest, res: Response) => {
  const games = await getRecentGames(30);
  res.json({ games });
});

/* ----------------------- تفاصيل مباراة (للإعادة) ----------------------- */
adminRouter.get('/games/:id', requireAdmin, async (req: AdminRequest, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'معرّف مباراة غير صالح.' });
  }
  const game = await getGameById(id);
  if (!game) return res.status(404).json({ error: 'المباراة غير موجودة.' });
  res.json({ game });
});
