-- =====================================================================
-- جدول مشرفي لوحة التحكم — منفصل تمامًا عن جدول اللاعبين (users).
-- اللاعب لا يصبح مشرفًا بتعديل عمود؛ المشرف كيان مستقل بصلاحياته.
-- التشغيل:  mysql -u root -p chess_app < admin-schema.sql
-- =====================================================================

USE chess_app;

CREATE TABLE IF NOT EXISTS admins (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  username       VARCHAR(30)  NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  -- الدور: super = صلاحية كاملة، admin = إدارة عامة (تُوسَّع لاحقًا بنظام صلاحيات كامل).
  role           ENUM('super','admin') NOT NULL DEFAULT 'admin',
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at  DATETIME     NULL,
  UNIQUE KEY uq_admins_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- سجل دخول المشرفين — من دخل ومتى ومن أي عنوان (شفافية ومساءلة).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_login_log (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  admin_id    INT          NULL,
  username    VARCHAR(30)  NOT NULL,
  success     TINYINT(1)   NOT NULL,
  ip          VARCHAR(45)  NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_admin_login_admin (admin_id),
  KEY idx_admin_login_time (created_at DESC),
  CONSTRAINT fk_admin_login_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
