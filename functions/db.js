// ===========================================================================
// D1 Data Layer — replaces KV for all share key, usage, and rate-limit ops
// ===========================================================================

const WINDOW_MS = 5 * 60 * 60 * 1000;
const WINDOW_ANCHOR_HOURS = 18;
const WINDOW_ANCHOR_MINUTES = 28;

function getCurrentWindowEnd() {
  const now = new Date();
  const anchor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), WINDOW_ANCHOR_HOURS, WINDOW_ANCHOR_MINUTES, 0, 0));
  if (now <= anchor) return anchor.getTime();
  const elapsed = now - anchor;
  const periods = Math.ceil(elapsed / WINDOW_MS);
  return anchor.getTime() + periods * WINDOW_MS;
}

// --- Share CRUD ---

async function getShare(env, shareKey) {
  const row = await env.SHARE_DB.prepare("SELECT data FROM shares WHERE share_key = ?").bind(shareKey).first();
  if (!row) return null;
  try { return JSON.parse(row.data); } catch { return null; }
}

async function putShare(env, shareKey, record, ttlSec) {
  const expiresAt = Date.parse(record.expiresAt) / 1000;
  await env.SHARE_DB.prepare(
    "INSERT INTO shares (share_key, data, expires_at) VALUES (?, ?, ?)"
  ).bind(shareKey, JSON.stringify(record), expiresAt).run();
}

async function deleteShare(env, shareKey) {
  const db = env.SHARE_DB;
  await db.prepare("DELETE FROM usage_buckets WHERE share_key = ?").bind(shareKey).run();
  await db.prepare("DELETE FROM request_details WHERE share_key = ?").bind(shareKey).run();
  await db.prepare("DELETE FROM share_index WHERE share_key = ?").bind(shareKey).run();
  await db.prepare("DELETE FROM shares WHERE share_key = ?").bind(shareKey).run();
}

async function addToIndex(env, shareKey) {
  const exists = await env.SHARE_DB.prepare("SELECT 1 FROM share_index WHERE share_key = ?").bind(shareKey).first();
  if (!exists) {
    const maxPos = await env.SHARE_DB.prepare("SELECT MAX(pos) as m FROM share_index").first();
    const nextPos = (maxPos?.m ?? -1) + 1;
    await env.SHARE_DB.prepare("INSERT INTO share_index (share_key, pos) VALUES (?, ?)").bind(shareKey, nextPos).run();
  }
}

async function getIndex(env) {
  const { results } = await env.SHARE_DB.prepare("SELECT share_key FROM share_index ORDER BY pos ASC").all();
  return results.map(r => r.share_key);
}

// --- Usage tracking (atomic increment, no race condition) ---

async function getWindowUsage(env, shareKey) {
  const windowEnd = getCurrentWindowEnd();
  const row = await env.SHARE_DB.prepare(
    "SELECT tokens FROM usage_buckets WHERE share_key = ? AND window_end = ?"
  ).bind(shareKey, windowEnd).first();
  return row ? row.tokens : 0;
}

async function incrementWindowUsage(env, shareKey, tokens) {
  const windowEnd = getCurrentWindowEnd();
  const ttlSec = Math.max(60, Math.ceil((windowEnd + 3600000 - Date.now()) / 1000));
  // D1 UPSERT with atomic increment — fixes the KV read-modify-write race condition
  await env.SHARE_DB.prepare(
    "INSERT INTO usage_buckets (share_key, window_end, tokens) VALUES (?, ?, ?) " +
    "ON CONFLICT(share_key, window_end) DO UPDATE SET tokens = tokens + excluded.tokens"
  ).bind(shareKey, windowEnd, tokens).run();
}

// --- Per-request detail logs ---

async function storeDetail(env, shareKey, input, output, cacheRead, cacheCreation, total) {
  const windowEnd = getCurrentWindowEnd();
  await env.SHARE_DB.prepare(
    "INSERT INTO request_details (share_key, window_end, ts, input, output, cache_read, cache_creation, total) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    shareKey, windowEnd, new Date().toISOString(),
    input, output, cacheRead, cacheCreation, total
  ).run();

  // Trim to last 200 entries for this share+window
  await env.SHARE_DB.prepare(
    "DELETE FROM request_details WHERE share_key = ? AND window_end = ? AND id NOT IN " +
    "(SELECT id FROM request_details WHERE share_key = ? AND window_end = ? ORDER BY id DESC LIMIT 200)"
  ).bind(shareKey, windowEnd, shareKey, windowEnd).run();
}

// --- Admin login rate limit ---

async function checkLoginRateLimit(env, ip) {
  const row = await env.SHARE_DB.prepare(
    "SELECT count, expires_at FROM login_rate_limits WHERE ip = ?"
  ).bind(ip).first();

  const now = Date.now() / 1000;

  if (row) {
    if (row.expires_at > now) {
      if (row.count >= 5) return false;
      await env.SHARE_DB.prepare(
        "UPDATE login_rate_limits SET count = ? WHERE ip = ?"
      ).bind(row.count + 1, ip).run();
      return true;
    }
    // Expired — reset
  }

  await env.SHARE_DB.prepare(
    "INSERT INTO login_rate_limits (ip, count, expires_at) VALUES (?, 1, ?) " +
    "ON CONFLICT(ip) DO UPDATE SET count = 1, expires_at = excluded.expires_at"
  ).bind(ip, now + 60).run();
  return true;
}

async function recordLoginSuccess(env, ip) {
  await env.SHARE_DB.prepare("DELETE FROM login_rate_limits WHERE ip = ?").bind(ip).run();
}

// --- Helpers for admin stats ---

async function getHistoricalUsage(env, shareKey) {
  const windowEnd = getCurrentWindowEnd();
  const windowUsage = {};
  for (let i = 0; i < 6; i++) {
    const we = windowEnd - (i + 1) * WINDOW_MS;
    const row = await env.SHARE_DB.prepare(
      "SELECT tokens FROM usage_buckets WHERE share_key = ? AND window_end = ?"
    ).bind(shareKey, we).first();
    if (row) {
      windowUsage[new Date(we).toISOString().split("T")[0]] = row.tokens;
    }
  }
  return windowUsage;
}

async function getCurrentDetails(env, shareKey) {
  const windowEnd = getCurrentWindowEnd();
  const { results } = await env.SHARE_DB.prepare(
    "SELECT ts, input, output, cache_read, cacheCreation, cache_creation, total " +
    "FROM request_details WHERE share_key = ? AND window_end = ? ORDER BY id DESC"
  ).bind(shareKey, windowEnd).all();

  const details = results.map(r => ({
    timestamp: r.ts,
    input: r.input,
    output: r.output,
    cacheRead: r.cache_read,
    cacheCreation: r.cache_creation,
    total: r.total,
  }));

  const breakdown = details.reduce(
    (acc, d) => ({
      input: acc.input + d.input,
      output: acc.output + d.output,
      cacheRead: acc.cacheRead + d.cacheRead,
      cacheCreation: acc.cacheCreation + d.cacheCreation,
    }),
    { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 }
  );

  return { details, breakdown };
}

module.exports = {
  getShare, putShare, deleteShare, addToIndex, getIndex,
  getWindowUsage, incrementWindowUsage, storeDetail,
  checkLoginRateLimit, recordLoginSuccess,
  getHistoricalUsage, getCurrentDetails,
};
