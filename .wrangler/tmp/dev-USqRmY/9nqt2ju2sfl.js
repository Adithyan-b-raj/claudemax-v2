var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/pages-l07Qj0/functionsWorker-0.17668936040010874.mjs
var __defProp2 = Object.defineProperty;
var __name2 = /* @__PURE__ */ __name((target, value) => __defProp2(target, "name", { value, configurable: true }), "__name");
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization,Content-Type,X-Share-Key"
};
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders }
  });
}
__name(json, "json");
__name2(json, "json");
var WINDOW_MS = 5 * 60 * 60 * 1e3;
var WINDOW_ANCHOR_HOURS = 18;
var WINDOW_ANCHOR_MINUTES = 28;
function getCurrentWindowEnd() {
  const now = /* @__PURE__ */ new Date();
  const anchor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), WINDOW_ANCHOR_HOURS, WINDOW_ANCHOR_MINUTES, 0, 0));
  if (now <= anchor) return anchor.getTime();
  const elapsed = now - anchor;
  const periods = Math.ceil(elapsed / WINDOW_MS);
  return anchor.getTime() + periods * WINDOW_MS;
}
__name(getCurrentWindowEnd, "getCurrentWindowEnd");
__name2(getCurrentWindowEnd, "getCurrentWindowEnd");
function getShareKey(key) {
  return `share:${key}`;
}
__name(getShareKey, "getShareKey");
__name2(getShareKey, "getShareKey");
function getBucketKey(key, windowEnd) {
  return `bucket:${key}:${windowEnd}`;
}
__name(getBucketKey, "getBucketKey");
__name2(getBucketKey, "getBucketKey");
var ADMIN_LOGIN_LIMIT = 5;
var ADMIN_LOGIN_WINDOW_SEC = 60;
async function checkLoginRateLimit(env, ip) {
  const key = `loginfail:${ip}`;
  const raw = await env.SHARE_KV.get(key);
  const count = raw ? parseInt(raw, 10) : 0;
  if (count >= ADMIN_LOGIN_LIMIT) return false;
  await env.SHARE_KV.put(key, String(count + 1), { expirationTtl: ADMIN_LOGIN_WINDOW_SEC });
  return true;
}
__name(checkLoginRateLimit, "checkLoginRateLimit");
__name2(checkLoginRateLimit, "checkLoginRateLimit");
async function recordLoginSuccess(env, ip) {
  await env.SHARE_KV.delete(`loginfail:${ip}`);
}
__name(recordLoginSuccess, "recordLoginSuccess");
__name2(recordLoginSuccess, "recordLoginSuccess");
async function getShare(env, key) {
  return env.SHARE_KV.get(getShareKey(key), "json");
}
__name(getShare, "getShare");
__name2(getShare, "getShare");
async function deleteShare(env, key) {
  await env.SHARE_KV.delete(getShareKey(key));
  const index = await env.SHARE_KV.get("share:index", "json") || [];
  await env.SHARE_KV.put("share:index", JSON.stringify(Array.isArray(index) ? index.filter((k) => k !== key) : []));
}
__name(deleteShare, "deleteShare");
__name2(deleteShare, "deleteShare");
async function addToIndex(env, key) {
  let index = await env.SHARE_KV.get("share:index", "json") || [];
  if (!Array.isArray(index)) index = [];
  if (!index.includes(key)) {
    await env.SHARE_KV.put("share:index", JSON.stringify([...index, key]));
  }
}
__name(addToIndex, "addToIndex");
__name2(addToIndex, "addToIndex");
async function getWindowUsage(env, shareKey) {
  const bucketKey = getBucketKey(shareKey, getCurrentWindowEnd());
  return parseInt(await env.SHARE_KV.get(bucketKey) || "0", 10);
}
__name(getWindowUsage, "getWindowUsage");
__name2(getWindowUsage, "getWindowUsage");
async function incrementWindowUsage(env, shareKey, tokens) {
  const windowEnd = getCurrentWindowEnd();
  const bucketKey = getBucketKey(shareKey, windowEnd);
  const current = parseInt(await env.SHARE_KV.get(bucketKey) || "0", 10);
  const finalTotal = current + tokens;
  const ttlSec = Math.max(60, Math.ceil((windowEnd + 36e5 - Date.now()) / 1e3));
  await env.SHARE_KV.put(bucketKey, String(finalTotal), { expirationTtl: ttlSec });
}
__name(incrementWindowUsage, "incrementWindowUsage");
__name2(incrementWindowUsage, "incrementWindowUsage");
function generateKey(length) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const max = 256 - 256 % chars.length;
  const result = [];
  while (result.length < length) {
    const arr = new Uint8Array(1);
    crypto.getRandomValues(arr);
    if (arr[0] < max) result.push(chars[arr[0] % chars.length]);
  }
  return result.join("");
}
__name(generateKey, "generateKey");
__name2(generateKey, "generateKey");
async function proxyRelay(request, env, ctx) {
  const shareKey = request.headers.get("x-share-key") || request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim() || new URL(request.url).searchParams.get("shareKey");
  if (!shareKey) return json({ error: "Missing X-Share-Key header or shareKey param" }, 401);
  const record = await getShare(env, shareKey);
  if (!record) return json({ error: "Invalid share key" }, 403);
  if (new Date(record.expiresAt) < /* @__PURE__ */ new Date()) {
    await deleteShare(env, shareKey);
    return json({ error: "Share key expired" }, 403);
  }
  const windowUsage = await getWindowUsage(env, shareKey);
  if (windowUsage >= record.tokenLimit) {
    return json({ error: "Token limit reached for this window", used: windowUsage, limit: record.tokenLimit, reset: new Date(getCurrentWindowEnd()).toISOString() }, 429);
  }
  const body = await request.text();
  let isStream = false;
  try {
    isStream = JSON.parse(body).stream === true;
  } catch {
  }
  const upstream = await fetch("https://api.opusmax.pro/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body
  });
  const contentType = upstream.headers.get("content-type") || "";
  if (isStream && contentType.includes("text/event-stream") && upstream.body) {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    const reader = upstream.body.getReader();
    let inputTokens2 = 0, outputTokens2 = 0, cacheReadTokens2 = 0, cacheCreationTokens2 = 0;
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
                  inputTokens2 = evt.message.usage.input_tokens || 0;
                  outputTokens2 = evt.message.usage.output_tokens || 0;
                  cacheReadTokens2 = evt.message.usage.cache_read_input_tokens || 0;
                  cacheCreationTokens2 = evt.message.usage.cache_creation_input_tokens || 0;
                  totalTokens = inputTokens2 + outputTokens2 + cacheReadTokens2 + cacheCreationTokens2;
                } else if (evt.type === "message_delta" && evt.usage) {
                  outputTokens2 += evt.usage.output_tokens || 0;
                  totalTokens = inputTokens2 + outputTokens2 + cacheReadTokens2 + cacheCreationTokens2;
                }
              } catch {
              }
            }
          }
        }
        if (totalTokens > 0) {
          ctx.waitUntil(incrementWindowUsage(env, shareKey, totalTokens));
          ctx.waitUntil(storeDetail(env, shareKey, inputTokens2, outputTokens2, cacheReadTokens2, cacheCreationTokens2, totalTokens));
        }
      } catch {
      } finally {
        await writer.close();
      }
    })();
    const headers2 = new Headers(upstream.headers);
    headers2.set("X-RateLimit-Limit", String(record.tokenLimit));
    headers2.set("X-RateLimit-Remaining", String(Math.max(0, record.tokenLimit - windowUsage - totalTokens)));
    headers2.set("X-RateLimit-Reset", new Date(getCurrentWindowEnd()).toISOString());
    headers2.set("X-Tokens-Charged", String(totalTokens));
    headers2.set("X-Tokens-Input", String(inputTokens2));
    headers2.set("X-Tokens-Output", String(outputTokens2));
    headers2.set("X-Tokens-Cache-Read", String(cacheReadTokens2));
    headers2.set("X-Tokens-Cache-Creation", String(cacheCreationTokens2));
    return new Response(readable, { status: upstream.status, headers: headers2 });
  }
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
  } catch {
  }
  const total = inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens;
  if (total > 0) {
    ctx.waitUntil(incrementWindowUsage(env, shareKey, total));
    ctx.waitUntil(storeDetail(env, shareKey, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, total));
  }
  const headers = new Headers();
  const allowed = /* @__PURE__ */ new Set(["content-type", "date", "cache-control", "retry-after", "x-request-id"]);
  for (const [key, val] of upstream.headers) {
    if (allowed.has(key.toLowerCase())) headers.set(key, val);
  }
  headers.set("X-RateLimit-Limit", String(record.tokenLimit));
  headers.set("X-RateLimit-Remaining", String(Math.max(0, record.tokenLimit - windowUsage - total)));
  headers.set("X-RateLimit-Reset", new Date(getCurrentWindowEnd()).toISOString());
  headers.set("X-Tokens-Charged", String(total));
  headers.set("X-Tokens-Input", String(inputTokens));
  headers.set("X-Tokens-Output", String(outputTokens));
  headers.set("X-Tokens-Cache-Read", String(cacheReadTokens));
  headers.set("X-Tokens-Cache-Creation", String(cacheCreationTokens));
  return new Response(respBody, { status: upstream.status, headers });
}
__name(proxyRelay, "proxyRelay");
__name2(proxyRelay, "proxyRelay");
async function storeDetail(env, shareKey, input, output, cacheRead, cacheCreation, total) {
  const winEnd = getCurrentWindowEnd();
  const dk = `detail:${shareKey}:${winEnd}`;
  const existing = await env.SHARE_KV.get(dk);
  const arr = existing ? JSON.parse(existing) : [];
  arr.push({ timestamp: (/* @__PURE__ */ new Date()).toISOString(), input, output, cacheRead, cacheCreation, total });
  if (arr.length > 200) arr.splice(0, arr.length - 200);
  const ttl = Math.max(60, Math.ceil((winEnd + 36e5 - Date.now()) / 1e3));
  await env.SHARE_KV.put(dk, JSON.stringify(arr), { expirationTtl: ttl });
}
__name(storeDetail, "storeDetail");
__name2(storeDetail, "storeDetail");
async function onRequest(context) {
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
      headers: { "anthropic-version": "2023-06-01", "x-api-key": env.ANTHROPIC_API_KEY }
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
__name(onRequest, "onRequest");
__name2(onRequest, "onRequest");
async function handleAdmin(request, env, adminSecret) {
  const url = new URL(request.url);
  const path = url.pathname;
  const isFormAuth = request.method === "POST" && path === "/admin/view";
  if (request.method === "GET" && (path === "/admin" || path === "/admin/") || path === "/admin/view") {
    return serveAdminPage(env, new URL(request.url).origin);
  }
  if (isFormAuth) {
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (!await checkLoginRateLimit(env, ip)) return json({ error: "Too many failed attempts" }, 429);
    const form = await request.formData().catch(() => null);
    const secret = form ? form.get("secret") : "";
    if (!secret || secret !== adminSecret) return json({ error: "unauthorized" }, 401);
    await recordLoginSuccess(env, ip);
    return serveAdminPage(env, new URL(request.url).origin);
  }
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) {
    return json({ error: "unauthorized" }, 401);
  }
  const token = auth.slice(7);
  if (token !== adminSecret) return json({ error: "unauthorized" }, 401);
  if (request.method === "GET" && path === "/admin/keys") {
    let index = await env.SHARE_KV.get("share:index", "json") || [];
    if (!Array.isArray(index)) index = [];
    const rawShares = await Promise.all(index.map((k) => getShare(env, k)));
    const keys = [];
    for (let i = 0; i < index.length; i++) {
      if (!rawShares[i]) continue;
      keys.push({ ...rawShares[i], shareKey: index[i], id: index[i] });
    }
    return json({ keys });
  }
  if (request.method === "POST" && path === "/admin/create") {
    try {
      const body = await request.json().catch(() => ({}));
      const days = Math.min(30, Math.max(1, parseInt(body.days) || 1));
      const tokenLimit = Math.min(1e8, Math.max(1e3, parseInt(body.tokenLimit) || 1e5));
      const name = (body.name || "shared").slice(0, 50);
      const shareKey = generateKey(16);
      const now = /* @__PURE__ */ new Date();
      const expiresAt = new Date(now.getTime() + days * 864e5);
      const record = { expiresAt: expiresAt.toISOString(), tokenLimit, createdAt: now.toISOString(), name };
      await env.SHARE_KV.put(`share:${shareKey}`, JSON.stringify(record), { expirationTtl: Math.ceil((days + 1) * 86400) });
      await addToIndex(env, shareKey);
      return json({ shareKey, expiresAt: record.expiresAt, tokenLimit, name, curl: `curl -X POST https://${request.headers.get("host")}/v1/messages -H "X-Share-Key: ${shareKey}" -H "Content-Type: application/json" -d '{...}'` }, 201);
    } catch (err) {
      return json({ error: "Create key failed", message: err.message, stack: err.stack }, 500);
    }
  }
  if (request.method === "POST" && path === "/admin/revoke") {
    const body = await request.json().catch(() => ({}));
    if (!body.shareKey) return json({ error: "shareKey required" }, 400);
    await deleteShare(env, body.shareKey);
    return json({ ok: true });
  }
  if (request.method === "GET" && path.startsWith("/admin/stats")) {
    const key = new URL(request.url).searchParams.get("key");
    if (!key) return json({ error: "?key=<shareKey> required" }, 400);
    const data = await getShare(env, key);
    if (!data) return json({ error: "Key not found" }, 404);
    const currentWindowUsed = await getWindowUsage(env, key);
    const windowUsage = {};
    const windowPromises = [];
    for (let i = 0; i < 6; i++) {
      const windowEnd = getCurrentWindowEnd() - (i + 1) * WINDOW_MS;
      windowPromises.push(
        env.SHARE_KV.get(getBucketKey(key, windowEnd)).then((v) => {
          if (v) windowUsage[new Date(windowEnd).toISOString().split("T")[0]] = parseInt(v, 10);
        })
      );
    }
    await Promise.all(windowPromises);
    const detailRaw = await env.SHARE_KV.get(`detail:${key}:${getCurrentWindowEnd()}`);
    const details = detailRaw ? JSON.parse(detailRaw) : [];
    const breakdown = details.reduce(
      (acc, d) => ({ input: acc.input + d.input, output: acc.output + d.output, cacheRead: acc.cacheRead + d.cacheRead, cacheCreation: acc.cacheCreation + d.cacheCreation }),
      { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 }
    );
    return json({
      shareKey: key,
      expiresAt: data.expiresAt,
      tokenLimit: data.tokenLimit,
      createdAt: data.createdAt,
      name: data.name,
      currentWindowUsed,
      windowUsage,
      percentUsed: Math.round(currentWindowUsed / data.tokenLimit * 100),
      breakdown,
      details: details.reverse()
    });
  }
  return json({ error: "not found" }, 404);
}
__name(handleAdmin, "handleAdmin");
__name2(handleAdmin, "handleAdmin");
async function serveAdminPage(env, origin) {
  return new Response("", {
    status: 302,
    headers: { Location: `${origin}/dashboard.html` }
  });
}
__name(serveAdminPage, "serveAdminPage");
__name2(serveAdminPage, "serveAdminPage");
var routes = [
  {
    routePath: "/:path*",
    mountPath: "/",
    method: "",
    middlewares: [],
    modules: [onRequest]
  }
];
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
__name2(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name2(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name2(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name2(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name2(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name2(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
__name2(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
__name2(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name2(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
__name2(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
__name2(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
__name2(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
__name2(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
__name2(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
__name2(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
__name2(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");
__name2(pathToRegexp, "pathToRegexp");
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
__name2(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name2(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name2(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name2((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
var drainBody = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
__name2(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
__name2(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
__name2(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");
__name2(__facade_invoke__, "__facade_invoke__");
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  static {
    __name(this, "___Facade_ScheduledController__");
  }
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name2(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name2(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name2(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
__name2(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name2((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name2((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
__name2(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;

// ../../../Users/91906/AppData/Roaming/npm/node_modules/wrangler/templates/pages-dev-util.ts
function isRoutingRuleMatch(pathname, routingRule) {
  if (!pathname) {
    throw new Error("Pathname is undefined.");
  }
  if (!routingRule) {
    throw new Error("Routing rule is undefined.");
  }
  const ruleRegExp = transformRoutingRuleToRegExp(routingRule);
  return pathname.match(ruleRegExp) !== null;
}
__name(isRoutingRuleMatch, "isRoutingRuleMatch");
function transformRoutingRuleToRegExp(rule) {
  let transformedRule;
  if (rule === "/" || rule === "/*") {
    transformedRule = rule;
  } else if (rule.endsWith("/*")) {
    transformedRule = `${rule.substring(0, rule.length - 2)}(/*)?`;
  } else if (rule.endsWith("/")) {
    transformedRule = `${rule.substring(0, rule.length - 1)}(/)?`;
  } else if (rule.endsWith("*")) {
    transformedRule = rule;
  } else {
    transformedRule = `${rule}(/)?`;
  }
  transformedRule = `^${transformedRule.replaceAll(/\./g, "\\.").replaceAll(/\*/g, ".*")}$`;
  return new RegExp(transformedRule);
}
__name(transformRoutingRuleToRegExp, "transformRoutingRuleToRegExp");

// .wrangler/tmp/pages-l07Qj0/9nqt2ju2sfl.js
var define_ROUTES_default = {
  version: 1,
  include: [
    "/*"
  ],
  exclude: [
    "/dashboard.html"
  ]
};
var routes2 = define_ROUTES_default;
var pages_dev_pipeline_default = {
  fetch(request, env, context) {
    const { pathname } = new URL(request.url);
    for (const exclude of routes2.exclude) {
      if (isRoutingRuleMatch(pathname, exclude)) {
        return env.ASSETS.fetch(request);
      }
    }
    for (const include of routes2.include) {
      if (isRoutingRuleMatch(pathname, include)) {
        const workerAsHandler = middleware_loader_entry_default;
        if (workerAsHandler.fetch === void 0) {
          throw new TypeError("Entry point missing `fetch` handler");
        }
        return workerAsHandler.fetch(request, env, context);
      }
    }
    return env.ASSETS.fetch(request);
  }
};

// ../../../Users/91906/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default2 = drainBody2;

// ../../../Users/91906/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError2(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError2(e.cause)
  };
}
__name(reduceError2, "reduceError");
var jsonError2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError2(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default2 = jsonError2;

// .wrangler/tmp/bundle-64P29T/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__2 = [
  middleware_ensure_req_body_drained_default2,
  middleware_miniflare3_json_error_default2
];
var middleware_insertion_facade_default2 = pages_dev_pipeline_default;

// ../../../Users/91906/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__2 = [];
function __facade_register__2(...args) {
  __facade_middleware__2.push(...args.flat());
}
__name(__facade_register__2, "__facade_register__");
function __facade_invokeChain__2(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__2(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__2, "__facade_invokeChain__");
function __facade_invoke__2(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__2(request, env, ctx, dispatch, [
    ...__facade_middleware__2,
    finalMiddleware
  ]);
}
__name(__facade_invoke__2, "__facade_invoke__");

// .wrangler/tmp/bundle-64P29T/middleware-loader.entry.ts
var __Facade_ScheduledController__2 = class ___Facade_ScheduledController__2 {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__2)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler2(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__2(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__2(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler2, "wrapExportedHandler");
function wrapWorkerEntrypoint2(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__2(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__2(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint2, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY2;
if (typeof middleware_insertion_facade_default2 === "object") {
  WRAPPED_ENTRY2 = wrapExportedHandler2(middleware_insertion_facade_default2);
} else if (typeof middleware_insertion_facade_default2 === "function") {
  WRAPPED_ENTRY2 = wrapWorkerEntrypoint2(middleware_insertion_facade_default2);
}
var middleware_loader_entry_default2 = WRAPPED_ENTRY2;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__2 as __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default2 as default
};
//# sourceMappingURL=9nqt2ju2sfl.js.map
