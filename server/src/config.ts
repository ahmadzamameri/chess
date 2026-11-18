/**
 * قراءة الإعدادات من البيئة + الثوابت التشغيلية في مكان واحد.
 */
import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 4000,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',

  /** الحد الأقصى لطول اسم اللاعب بعد التنظيف. */
  maxNameLength: 20,

  /** مهلة عودة اللاعب المنقطع قبل اعتباره خاسرًا (بالمللي ثانية). */
  reconnectGraceMs: 30_000,

  /** حماية بسيطة من الإغراق: أقصى عدد أحداث مسموح خلال نافذة زمنية. */
  rateLimit: {
    windowMs: 1_000,
    maxEvents: 15,
  },

  /** اتصال MySQL. إن نقصت القيم يعمل الموقع بوضع الضيوف فقط (فشل آمن). */
  db: {
    host: process.env.DB_HOST || '',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '',
  },

  /**
   * مفتاح إيقاف لوحة التحكم كليًا. true افتراضيًا؛ اضبط ADMIN_PANEL_ENABLED=false
   * لإخفاء كل مسارات ‎/api/admin‎ (تُرجع 404 كأنها غير موجودة).
   */
  adminPanelEnabled: process.env.ADMIN_PANEL_ENABLED !== 'false',

  /** سرّ توقيع توكن الدخول — يجب ضبطه في .env على الإنتاج. */
  jwtSecret: process.env.JWT_SECRET || '',
  /** مدة صلاحية توكن الدخول (لاعبون). */
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
  /** مدة صلاحية توكن المشرف — أقصر عمدًا (صلاحيات حسّاسة). */
  adminJwtExpiresIn: process.env.ADMIN_JWT_EXPIRES_IN || '2d',

  /** حماية دخول المشرف من التخمين: أقصى محاولات فاشلة لكل IP ضمن النافذة. */
  adminLoginRateLimit: {
    windowMs: 15 * 60 * 1000, // 15 دقيقة
    maxFails: 8,
  },

  /** حماية دخول اللاعب من التخمين: أقصى محاولات فاشلة لكل IP ضمن النافذة. */
  playerLoginRateLimit: {
    windowMs: 15 * 60 * 1000, // 15 دقيقة
    maxFails: 10,
  },

  /** حماية التسجيل من السبام: أقصى عدد حسابات يُنشأ من نفس IP ضمن النافذة.
     كريم عمدًا حتى لا نحبس أعضاء ناديٍ يسجّلون من نفس شبكة (IP واحد). */
  registerRateLimit: {
    windowMs: 60 * 60 * 1000, // ساعة
    max: 15,
  },

  /** معامل K في حساب Elo (32 = المعيار الشائع للاعبين الجدد). */
  eloK: 32,
  /** تصنيف البداية لأي حساب جديد. */
  eloStart: 1200,
} as const;
