// ===========================================================================
// OpusMax Proxy — Cloudflare Pages Function (D1-backed)
// Handles: proxy relay, admin API, and serves the dashboard.
// ===========================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization,Content-Type,X-Share-Key",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders },
  });
}

function esc(s) {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// --- D1 Data Layer ---
const db = require("./db.js");

const ADMIN_LOGIN_LIMIT = 5;

// ===========================================================================
// Proxy relay — forwards to Anthropic API via opusmax.pro
// ===========================================================================

async function proxyRelay(request, env, ctx) {
  const shareKey = request.headers.get("x-share-key")
    || request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim()
    || new URL(request.url).searchParams.get("shareKey");

  if (!shareKey) return json({ error: "Missing X-Share-Key header or shareKey param" }, 401);

  const record = await db.getShare(env, shareKey);
  if (!record) return json({ error: "Invalid share key" }, 403);
  if (new Date(record.expiresAt) < new Date()) {
    await db.deleteShare(env, shareKey);
    return json({ error: "Share key expired" }, 403);
  }

  const windowUsage = await db.getWindowUsage(env, shareKey);
  if (windowUsage >= record.tokenLimit) {
    return json({ error: "Token limit reached for this window", used: windowUsage, limit: record.tokenLimit, reset: new Date(db.getCurrentWindowEnd()).toISOString() }, 429);
  }

  const body = await request.text();
  let isStream = false;
  try { isStream = JSON.parse(body).stream === true; } catch { }

  const upstream = await fetch("https://api.opusmax.pro/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body,
  });

  const contentType = upstream.headers.get("content-type") || "";

  // --- Streaming (SSE) ---
  if (isStream && contentType.includes("text/event-stream") && upstream.body) {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    const reader = upstream.body.getReader();
    let inputTokens = 0, outputTokens = 0, cacheReadTokens = 0, cacheCreationTokens = 0;
    let totalTokens = 0;
    let buffer = "";

    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          await writer.write(encoder.encode(chunk));

          buffer += chunk;
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data: ") && line.includes('"usage"')) {
              try {
                const evt = JSON.parse(line.slice(6));
                if (evt.type === "message_start" && evt.message?.usage) {
                  inputTokens = evt.message.usage.input_tokens || 0;
                  outputTokens = evt.message.usage.output_tokens || 0;
                  cacheReadTokens = evt.message.usage.cache_read_input_tokens || 0;
                  cacheCreationTokens = evt.message.usage.cache_creation_input_tokens || 0;
                  totalTokens = inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens;
                } else if (evt.type === "message_delta" && evt.usage) {
                  outputTokens += evt.usage.output_tokens || 0;
                  totalTokens = inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens;
                }
              } catch { }
            }
          }
        }
        if (totalTokens > 0) {
          ctx.waitUntil(db.incrementWindowUsage(env, shareKey, totalTokens));
          ctx.waitUntil(db.storeDetail(env, shareKey, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, totalTokens));
        }
      } catch { /* stream interrupted */ }
      finally { await writer.close(); }
    })();

    const headers = new Headers(upstream.headers);
    headers.set("X-RateLimit-Limit", String(record.tokenLimit));
    headers.set("X-RateLimit-Remaining", String(Math.max(0, record.tokenLimit - windowUsage - totalTokens)));
    headers.set("X-RateLimit-Reset", new Date(db.getCurrentWindowEnd()).toISOString());
    headers.set("X-Tokens-Charged", String(totalTokens));
    headers.set("X-Tokens-Input", String(inputTokens));
    headers.set("X-Tokens-Output", String(outputTokens));
    headers.set("X-Tokens-Cache-Read", String(cacheReadTokens));
    headers.set("X-Tokens-Cache-Creation", String(cacheCreationTokens));
    return new Response(readable, { status: upstream.status, headers });
  }

  // --- Non-streaming ---
  const respBody = await upstream.text();
  let inputTokens = 0, outputTokens = 0, cacheReadTokens = 0, cacheCreationTokens = 0;
  try {
    const parsed = JSON.parse(respBody);
    if (parsed.usage) {
      inputTokens = parsed.usage.input_tokens || 0;
      outputTokens = parsed.usage.output_tokens || 0;
      cacheReadTokens = parsed.usage.cache_read_input_tokens || 0;
      cacheCreationTokens = parsed.usage.cache_creation_input_tokens || 0;
    }
  } catch { }

  const total = inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens;

  if (total > 0) {
    ctx.waitUntil(db.incrementWindowUsage(env, shareKey, total));
    ctx.waitUntil(db.storeDetail(env, shareKey, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, total));
  }

  const headers = new Headers();
  const allowed = new Set(["content-type", "date", "cache-control", "retry-after", "x-request-id"]);
  for (const [key, val] of upstream.headers) {
    if (allowed.has(key.toLowerCase())) headers.set(key, val);
  }
  headers.set("X-RateLimit-Limit", String(record.tokenLimit));
  headers.set("X-RateLimit-Remaining", String(Math.max(0, record.tokenLimit - windowUsage - total)));
  headers.set("X-RateLimit-Reset", new Date(db.getCurrentWindowEnd()).toISOString());
  headers.set("X-Tokens-Charged", String(total));
  headers.set("X-Tokens-Input", String(inputTokens));
  headers.set("X-Tokens-Output", String(outputTokens));
  headers.set("X-Tokens-Cache-Read", String(cacheReadTokens));
  headers.set("X-Tokens-Cache-Creation", String(cacheCreationTokens));
  return new Response(respBody, { status: upstream.status, headers });
}

// ===========================================================================
// Admin handler — serves dashboard + JSON API
// ===========================================================================

async function handleAdmin(request, env, adminSecret) {
  const url = new URL(request.url);
  const path = url.pathname;
  const isFormAuth = request.method === "POST" && path === "/admin/view";

  // GET /admin or /admin/view → redirect to the SPA dashboard (public)
  if ((request.method === "GET" && (path === "/admin" || path === "/admin/")) || path === "/admin/view") {
    return serveAdminPage(env, new URL(request.url).origin);
  }

  // POST /admin/view → validate secret from form, then redirect
  if (isFormAuth) {
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (!(await db.checkLoginRateLimit(env, ip))) return json({ error: "Too many failed attempts" }, 429);
    const form = await request.formData().catch(() => null);
    const secret = form ? form.get("secret") : "";
    if (!secret || secret !== adminSecret) return json({ error: "unauthorized" }, 401);
    await db.recordLoginSuccess(env, ip);
    return serveAdminPage(env, new URL(request.url).origin);
  }

  // All remaining admin routes need Bearer auth
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) {
    return json({ error: "unauthorized" }, 401);
  }
  const token = auth.slice(7);
  if (token !== adminSecret) return json({ error: "unauthorized" }, 401);

  // List keys
  if (request.method === "GET" && path === "/admin/keys") {
    const index = await db.getIndex(env);
    const rawShares = await Promise.all(index.map(k => db.getShare(env, k)));
    const keys = [];
    for (let i = 0; i < index.length; i++) {
      if (!rawShares[i]) continue;
      keys.push({ ...rawShares[i], shareKey: index[i], id: index[i] });
    }
    return json({ keys });
  }

  // Create key
  if (request.method === "POST" && path === "/admin/create") {
    try {
      const body = await request.json().catch(() => ({}));
      const days = Math.min(30, Math.max(1, parseInt(body.days) || 1));
      const tokenLimit = Math.min(100_000_000, Math.max(1000, parseInt(body.tokenLimit) || 100000));
      const name = (body.name || "shared").slice(0, 50);
      const shareKey = generateKey(16);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + days * 86400000);
      const record = { expiresAt: expiresAt.toISOString(), tokenLimit, createdAt: now.toISOString(), name };
      await db.putShare(env, shareKey, record, Math.ceil((days + 1) * 86400));
      await db.addToIndex(env, shareKey);
      return json({ shareKey, expiresAt: record.expiresAt, tokenLimit, name, curl: `curl -X POST https://${request.headers.get("host")}/v1/messages -H "X-Share-Key: ${shareKey}" -H "Content-Type: application/json" -d '{...}'` }, 201);
    } catch (err) {
      const msg = err.message && err.message.includes("QUOTA")
        ? "D1 write limit exceeded."
        : err.message || "Unknown error";
      return json({ error: "Create key failed", message: msg }, 500);
    }
  }

  // Revoke key
  if (request.method === "POST" && path === "/admin/revoke") {
    const body = await request.json().catch(() => ({}));
    if (!body.shareKey) return json({ error: "shareKey required" }, 400);
    await db.deleteShare(env, body.shareKey);
    return json({ ok: true });
  }

  // Stats (with per-request details + token breakdown)
  if (request.method === "GET" && path.startsWith("/admin/stats")) {
    const key = new URL(request.url).searchParams.get("key");
    if (!key) return json({ error: "?key=<shareKey> required" }, 400);
    const data = await db.getShare(env, key);
    if (!data) return json({ error: "Key not found" }, 404);

    const currentWindowUsed = await db.getWindowUsage(env, key);
    const windowUsage = await db.getHistoricalUsage(env, key);
    const { details, breakdown } = await db.getCurrentDetails(env, key);

    return json({
      shareKey: key, expiresAt: data.expiresAt, tokenLimit: data.tokenLimit,
      createdAt: data.createdAt, name: data.name,
      currentWindowUsed, windowUsage,
      windowEnd: db.getCurrentWindowEnd(),
      percentUsed: Math.round((currentWindowUsed / data.tokenLimit) * 100),
      breakdown,
      details: details.reverse(),
    });
  }

  return json({ error: "not found" }, 404);
}

// ===========================================================================
// Pages Function entry point
// ===========================================================================

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (path === "/v1/messages" && request.method === "POST") {
    return proxyRelay(request, env, context);
  }

  if (path === "/v1/models" && request.method === "GET") {
    const upstream = await fetch("https://api.opusmax.pro/v1/models", {
      headers: { "anthropic-version": "2023-06-01", "x-api-key": env.ANTHROPIC_API_KEY },
    });
    const body = await upstream.text();
    const headers = new Headers(upstream.headers);
    headers.set("content-type", "application/json");
    return new Response(body, { status: upstream.status, headers });
  }

  if (path === "/health" && request.method === "GET") {
    return json({ status: "ok" });
  }

  if (path.startsWith("/admin")) {
    const adminSecret = env.ADMIN_SECRET;
    if (!adminSecret) return json({ error: "Set ADMIN_SECRET env var" }, 503);
    return handleAdmin(request, env, adminSecret);
  }

  if (request.method === "GET" && path === "/dashboard.html" && env.ASSETS) {
    return env.ASSETS.fetch(request);
  }

  if (env.ASSETS) return env.ASSETS.fetch(request);

  return json({ error: "not found" }, 404);
}

// ===========================================================================
// Key generation (unchanged)
// ===========================================================================

function generateKey(length) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const max = 256 - (256 % chars.length);
  const result = [];
  while (result.length < length) {
    const arr = new Uint8Array(1);
    crypto.getRandomValues(arr);
    if (arr[0] < max) result.push(chars[arr[0] % chars.length]);
  }
  return result.join("");
}

// ===========================================================================
// Serve the admin SPA
// ===========================================================================

function serveAdminPage(env, origin) {
  return new Response("", {
    status: 302,
    headers: { Location: `${origin}/dashboard.html` },
  });
}