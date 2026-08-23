CREATE TABLE IF NOT EXISTS shares (
  share_key TEXT PRIMARY KEY,
  data TEXT NOT NULL,          -- JSON: { expiresAt, tokenLimit, createdAt, name }
  created_at REAL NOT NULL DEFAULT (unixepoch()),
  expires_at REAL NOT NULL     -- unix timestamp for easy cleanup queries
);

CREATE TABLE IF NOT EXISTS share_index (
  share_key TEXT NOT NULL,
  pos INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (share_key, pos)
);

CREATE TABLE IF NOT EXISTS usage_buckets (
  share_key TEXT NOT NULL,
  window_end REAL NOT NULL,
  tokens INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (share_key, window_end)
);

CREATE TABLE IF NOT EXISTS request_details (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  share_key TEXT NOT NULL,
  window_end REAL NOT NULL,
  ts TEXT NOT NULL,
  input INTEGER DEFAULT 0,
  output INTEGER DEFAULT 0,
  cache_read INTEGER DEFAULT 0,
  cache_creation INTEGER DEFAULT 0,
  total INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS login_rate_limits (
  ip TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  expires_at REAL NOT NULL
);

-- Indexes for cleanup queries
CREATE INDEX IF NOT EXISTS idx_shares_expires ON shares(expires_at);
CREATE INDEX IF NOT EXISTS idx_details_share_window ON request_details(share_key, window_end);
CREATE INDEX IF NOT EXISTS idx_details_ts ON request_details(ts);
CREATE INDEX IF NOT EXISTS idx_login_expires ON login_rate_limits(expires_at);