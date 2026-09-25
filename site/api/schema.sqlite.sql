-- Та же схема для SQLite: нужна для локальной проверки и тестов.
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id INTEGER NULL UNIQUE,
  tg_username TEXT NULL,
  max_user_id INTEGER NULL UNIQUE,
  max_link_token TEXT NULL,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NULL,
  is_staff INTEGER NOT NULL DEFAULT 0,
  consent_pd_at TEXT NULL,
  consent_news INTEGER NOT NULL DEFAULT 0,
  notify_tg INTEGER NOT NULL DEFAULT 1,
  notify_max INTEGER NOT NULL DEFAULT 1,
  notify_24h INTEGER NOT NULL DEFAULT 1,
  notify_2h INTEGER NOT NULL DEFAULT 1,
  in_chat INTEGER NOT NULL DEFAULT 0,
  note TEXT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  client_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  format TEXT NOT NULL,
  title TEXT NOT NULL,
  host TEXT NOT NULL DEFAULT '',
  description TEXT NULL,
  starts_at TEXT NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 120,
  capacity INTEGER NOT NULL DEFAULT 40,
  price INTEGER NULL,
  included INTEGER NOT NULL DEFAULT 1,
  cancelled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_starts ON events(starts_at);
CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_payment_id TEXT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  paid_at TEXT NULL
);
CREATE TABLE IF NOT EXISTS memberships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  plan TEXT NOT NULL,
  month TEXT NOT NULL,
  club TEXT NULL,
  status TEXT NOT NULL,
  price INTEGER NOT NULL,
  purchase_id INTEGER NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  event_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  paid_by TEXT NULL,
  membership_id INTEGER NULL,
  purchase_id INTEGER NULL,
  refund_due INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (client_id, event_id)
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  UNIQUE (client_id, kind, ref_id)
);
