-- =====================================================================
-- قاعدة بيانات الشطرنج — منفصلة تمامًا عن agrtravel_app
-- التشغيل:  mysql -u root -p < schema.sql
-- =====================================================================

CREATE DATABASE IF NOT EXISTS chess_app
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE chess_app;

-- ---------------------------------------------------------------------
-- المستخدمون
-- elo: تصنيف يبدأ من 1200 (المعيار الشائع)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  username       VARCHAR(20)  NOT NULL,
  email          VARCHAR(190) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  elo            INT          NOT NULL DEFAULT 1200,
  wins           INT          NOT NULL DEFAULT 0,
  losses         INT          NOT NULL DEFAULT 0,
  draws          INT          NOT NULL DEFAULT 0,
  games_played   INT          NOT NULL DEFAULT 0,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at  DATETIME     NULL,
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_elo (elo DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- سجل المباريات المنتهية
-- user_id يقبل NULL لأن الضيوف يلعبون بلا حساب.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS games (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  game_uid         CHAR(36)     NOT NULL,
  white_user_id    INT          NULL,
  black_user_id    INT          NULL,
  white_name       VARCHAR(30)  NOT NULL,
  black_name       VARCHAR(30)  NOT NULL,
  result           ENUM('white','black','draw') NOT NULL,
  end_reason       VARCHAR(32)  NOT NULL,
  move_count       INT          NOT NULL DEFAULT 0,
  moves_san        TEXT         NOT NULL,
  final_fen        VARCHAR(120) NOT NULL,
  white_elo_before INT          NULL,
  white_elo_after  INT          NULL,
  black_elo_before INT          NULL,
  black_elo_after  INT          NULL,
  started_at       DATETIME     NOT NULL,
  ended_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_games_uid (game_uid),
  KEY idx_games_white (white_user_id),
  KEY idx_games_black (black_user_id),
  KEY idx_games_ended (ended_at DESC),
  CONSTRAINT fk_games_white FOREIGN KEY (white_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_games_black FOREIGN KEY (black_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
