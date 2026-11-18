/**
 * اتصال MySQL — بمبدأ "الفشل الآمن":
 * إن لم تُضبط بيانات الاتصال أو تعذّر الوصول للقاعدة، يستمر السيرفر بالعمل
 * (لعب كضيوف بلا حفظ/حسابات) بدل أن يتعطّل. كل استدعاء يتحقق من التوفّر أولًا.
 */
import mysql from 'mysql2/promise';
import { config } from '../config.js';

let pool: mysql.Pool | null = null;
let dbReady = false;

/** هل قاعدة البيانات متاحة الآن؟ (تحدّد إتاحة الحسابات/الحفظ) */
export function isDbReady(): boolean {
  return dbReady;
}

/**
 * تهيئة الاتصال ومحاولة فحصه مرة واحدة عند الإقلاع.
 * لا ترمي استثناءً أبدًا — تُرجع true/false فقط.
 */
export async function initDb(): Promise<boolean> {
  if (!config.db.host || !config.db.user || !config.db.database) {
    console.warn('[db] بيانات الاتصال غير مكتملة — سيعمل الموقع بوضع الضيوف فقط (بلا حسابات/حفظ).');
    dbReady = false;
    return false;
  }

  try {
    pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4_unicode_ci',
    });

    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();

    dbReady = true;
    console.log(`[db] متصل بقاعدة ${config.db.database} — الحسابات والحفظ مفعّلة.`);
    return true;
  } catch (err) {
    dbReady = false;
    console.error('[db] تعذّر الاتصال بقاعدة البيانات — وضع الضيوف فقط:', (err as Error).message);
    return false;
  }
}

/** الأنواع المسموح تمريرها كمعاملات استعلام. */
export type SqlParam = string | number | boolean | Date | null;

/**
 * تنفيذ استعلام بأمان. يُرجع null عند عدم توفّر القاعدة أو عند خطأ،
 * فلا يُسقط السيرفر مهما حدث.
 */
export async function query<T = mysql.RowDataPacket[]>(
  sql: string,
  params: SqlParam[] = [],
): Promise<T | null> {
  if (!dbReady || !pool) return null;
  try {
    const [rows] = await pool.execute(sql, params);
    return rows as T;
  } catch (err) {
    console.error('[db] فشل استعلام:', (err as Error).message);
    return null;
  }
}

/** تنفيذ استعلام كتابة وإرجاع معلومات النتيجة (insertId/affectedRows). */
export async function execute(
  sql: string,
  params: SqlParam[] = [],
): Promise<mysql.ResultSetHeader | null> {
  if (!dbReady || !pool) return null;
  try {
    const [result] = await pool.execute(sql, params);
    return result as mysql.ResultSetHeader;
  } catch (err) {
    console.error('[db] فشل تنفيذ:', (err as Error).message);
    return null;
  }
}
