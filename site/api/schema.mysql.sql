-- База данных Пространства (MySQL / MariaDB).
-- Все даты хранятся по московскому времени в формате 'ГГГГ-ММ-ДД ЧЧ:ММ:СС'.

CREATE TABLE IF NOT EXISTS clients (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  telegram_id    BIGINT NULL UNIQUE,
  tg_username    VARCHAR(64) NULL,
  max_user_id    BIGINT NULL UNIQUE,
  max_link_token VARCHAR(40) NULL,
  name           VARCHAR(120) NOT NULL DEFAULT '',
  phone          VARCHAR(20) NULL,
  is_staff       TINYINT(1) NOT NULL DEFAULT 0,
  consent_pd_at  DATETIME NULL,
  consent_news   TINYINT(1) NOT NULL DEFAULT 0,
  notify_tg      TINYINT(1) NOT NULL DEFAULT 1,
  notify_max     TINYINT(1) NOT NULL DEFAULT 1,
  notify_24h     TINYINT(1) NOT NULL DEFAULT 1,
  notify_2h      TINYINT(1) NOT NULL DEFAULT 1,
  in_chat        TINYINT(1) NOT NULL DEFAULT 0,
  note           TEXT NULL,
  created_at     DATETIME NOT NULL,
  INDEX (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) PRIMARY KEY,
  client_id  INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  INDEX (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS events (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  format       VARCHAR(16) NOT NULL,
  title        VARCHAR(200) NOT NULL,
  host         VARCHAR(200) NOT NULL DEFAULT '',
  description  TEXT NULL,
  starts_at    DATETIME NOT NULL,
  duration_min SMALLINT UNSIGNED NOT NULL DEFAULT 120,
  capacity     SMALLINT UNSIGNED NOT NULL DEFAULT 40,
  price        INT UNSIGNED NULL,          -- своя цена разового посещения (если пусто — общая)
  included     TINYINT(1) NOT NULL DEFAULT 1, -- 0: не входит в абонементы, только по билету
  cancelled    TINYINT(1) NOT NULL DEFAULT 0,
  created_at   DATETIME NOT NULL,
  INDEX (starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS purchases (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_id           INT UNSIGNED NOT NULL,
  kind                VARCHAR(16) NOT NULL,   -- membership | single
  amount              INT UNSIGNED NOT NULL,
  status              VARCHAR(16) NOT NULL,   -- pending | paid | cancelled
  provider            VARCHAR(16) NOT NULL,   -- yookassa | test | cash
  provider_payment_id VARCHAR(64) NULL,
  description         VARCHAR(255) NOT NULL DEFAULT '',
  created_at          DATETIME NOT NULL,
  paid_at             DATETIME NULL,
  INDEX (client_id), INDEX (provider_payment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS memberships (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_id   INT UNSIGNED NOT NULL,
  plan        VARCHAR(16) NOT NULL,      -- club1 | clubs | all
  month       CHAR(7) NOT NULL,          -- ГГГГ-ММ, абонемент действует календарный месяц
  club        VARCHAR(16) NULL,          -- для «Одного клуба»: lit | script
  status      VARCHAR(16) NOT NULL,      -- pending | active | cancelled
  price       INT UNSIGNED NOT NULL,
  purchase_id INT UNSIGNED NULL,
  created_at  DATETIME NOT NULL,
  INDEX (client_id, month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bookings (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_id     INT UNSIGNED NOT NULL,
  event_id      INT UNSIGNED NOT NULL,
  status        VARCHAR(16) NOT NULL,   -- booked | waitlist | pending_payment | cancelled | late_cancel | attended | noshow
  paid_by       VARCHAR(16) NULL,       -- membership | single | free
  membership_id INT UNSIGNED NULL,
  purchase_id   INT UNSIGNED NULL,
  refund_due    TINYINT(1) NOT NULL DEFAULT 0,
  created_at    DATETIME NOT NULL,
  updated_at    DATETIME NOT NULL,
  UNIQUE KEY one_per_event (client_id, event_id),
  INDEX (event_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notifications (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_id INT UNSIGNED NOT NULL DEFAULT 0,
  kind      VARCHAR(24) NOT NULL,
  ref_id    VARCHAR(32) NOT NULL,
  sent_at   DATETIME NOT NULL,
  UNIQUE KEY once_only (client_id, kind, ref_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
