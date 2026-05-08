-- IMWallet Console mock schema (for migration baseline)
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS policies (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  scope TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tx_queue (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  flow TEXT NOT NULL,
  asset TEXT NOT NULL,
  amount REAL NOT NULL,
  usd_value REAL NOT NULL,
  network TEXT NOT NULL,
  status TEXT NOT NULL,
  risk_score INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
