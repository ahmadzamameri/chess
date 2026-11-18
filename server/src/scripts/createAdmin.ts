/**
 * إنشاء (أو تحديث كلمة مرور) مشرف لوحة التحكم.
 *
 * التشغيل من مجلد server:
 *   npm run create-admin -- <username> <password> [role]
 * مثال:
 *   npm run create-admin -- admin "P@ssw0rd!" super
 *
 * إن كان الاسم موجودًا يُحدَّث تجزئة كلمة المرور (مفيد لإعادة تعيينها).
 */
import { initDb, execute, query, isDbReady } from '../db/pool.js';
import { hashPassword, validatePassword } from '../auth/credentials.js';
import type { RowDataPacket } from 'mysql2';

async function main(): Promise<void> {
  const [, , usernameArg, passwordArg, roleArg] = process.argv;

  if (!usernameArg || !passwordArg) {
    console.error('الاستخدام: npm run create-admin -- <username> <password> [super|admin]');
    process.exit(1);
  }

  const username = usernameArg.trim();
  if (username.length < 3 || username.length > 30) {
    console.error('اسم المستخدم يجب أن يكون 3–30 حرفًا.');
    process.exit(1);
  }

  const password = validatePassword(passwordArg);
  if (!password) {
    console.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
    process.exit(1);
  }

  const role = roleArg === 'super' ? 'super' : 'admin';

  await initDb();
  if (!isDbReady()) {
    console.error('تعذّر الاتصال بقاعدة البيانات — تأكد من إعدادات .env وأن admin-schema.sql مطبّق.');
    process.exit(1);
  }

  const hash = await hashPassword(password);

  const existing = await query<RowDataPacket[]>(
    'SELECT id FROM admins WHERE username = ? LIMIT 1',
    [username],
  );

  if (existing && existing.length) {
    await execute('UPDATE admins SET password_hash = ?, role = ?, is_active = 1 WHERE username = ?', [
      hash,
      role,
      username,
    ]);
    console.log(`✓ تم تحديث المشرف "${username}" (الدور: ${role}).`);
  } else {
    const result = await execute(
      'INSERT INTO admins (username, password_hash, role) VALUES (?, ?, ?)',
      [username, hash, role],
    );
    if (!result) {
      console.error('فشل إنشاء المشرف.');
      process.exit(1);
    }
    console.log(`✓ تم إنشاء المشرف "${username}" (الدور: ${role}).`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('خطأ غير متوقع:', err);
  process.exit(1);
});
