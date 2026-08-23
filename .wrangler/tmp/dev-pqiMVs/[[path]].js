(() => {
  var __defProp = Object.defineProperty;
  var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

  // ../../../Users/91906/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
  var __facade_middleware__ = [];
  function __facade_register__(...args) {
    __facade_middleware__.push(...args.flat());
  }
  __name(__facade_register__, "__facade_register__");
  function __facade_registerInternal__(...args) {
    __facade_middleware__.unshift(...args.flat());
  }
  __name(__facade_registerInternal__, "__facade_registerInternal__");
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
  function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
    return __facade_invokeChain__(request, env, ctx, dispatch, [
      ...__facade_middleware__,
      finalMiddleware
    ]);
  }
  __name(__facade_invoke__, "__facade_invoke__");

  // ../../../Users/91906/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/loader-sw.ts
  var __FACADE_EVENT_TARGET__;
  if (globalThis.MINIFLARE) {
    __FACADE_EVENT_TARGET__ = new (Object.getPrototypeOf(WorkerGlobalScope))();
  } else {
    __FACADE_EVENT_TARGET__ = new EventTarget();
  }
  function __facade_isSpecialEvent__(type) {
    return type === "fetch" || type === "scheduled";
  }
  __name(__facade_isSpecialEvent__, "__facade_isSpecialEvent__");
  var __facade__originalAddEventListener__ = globalThis.addEventListener;
  var __facade__originalRemoveEventListener__ = globalThis.removeEventListener;
  var __facade__originalDispatchEvent__ = globalThis.dispatchEvent;
  globalThis.addEventListener = function(type, listener, options) {
    if (__facade_isSpecialEvent__(type)) {
      __FACADE_EVENT_TARGET__.addEventListener(
        type,
        listener,
        options
      );
    } else {
      __facade__originalAddEventListener__(type, listener, options);
    }
  };
  globalThis.removeEventListener = function(type, listener, options) {
    if (__facade_isSpecialEvent__(type)) {
      __FACADE_EVENT_TARGET__.removeEventListener(
        type,
        listener,
        options
      );
    } else {
      __facade__originalRemoveEventListener__(type, listener, options);
    }
  };
  globalThis.dispatchEvent = function(event) {
    if (__facade_isSpecialEvent__(event.type)) {
      return __FACADE_EVENT_TARGET__.dispatchEvent(event);
    } else {
      return __facade__originalDispatchEvent__(event);
    }
  };
  globalThis.addMiddleware = __facade_register__;
  globalThis.addMiddlewareInternal = __facade_registerInternal__;
  var __facade_waitUntil__ = /* @__PURE__ */ Symbol("__facade_waitUntil__");
  var __facade_response__ = /* @__PURE__ */ Symbol("__facade_response__");
  var __facade_dispatched__ = /* @__PURE__ */ Symbol("__facade_dispatched__");
  var __Facade_ExtendableEvent__ = class ___Facade_ExtendableEvent__ extends Event {
    static {
      __name(this, "__Facade_ExtendableEvent__");
    }
    [__facade_waitUntil__] = [];
    waitUntil(promise) {
      if (!(this instanceof ___Facade_ExtendableEvent__)) {
        throw new TypeError("Illegal invocation");
      }
      this[__facade_waitUntil__].push(promise);
    }
  };
  var __Facade_FetchEvent__ = class ___Facade_FetchEvent__ extends __Facade_ExtendableEvent__ {
    static {
      __name(this, "__Facade_FetchEvent__");
    }
    #request;
    #passThroughOnException;
    [__facade_response__];
    [__facade_dispatched__] = false;
    constructor(type, init) {
      super(type);
      this.#request = init.request;
      this.#passThroughOnException = init.passThroughOnException;
    }
    get request() {
      return this.#request;
    }
    respondWith(response) {
      if (!(this instanceof ___Facade_FetchEvent__)) {
        throw new TypeError("Illegal invocation");
      }
      if (this[__facade_response__] !== void 0) {
        throw new DOMException(
          "FetchEvent.respondWith() has already been called; it can only be called once.",
          "InvalidStateError"
        );
      }
      if (this[__facade_dispatched__]) {
        throw new DOMException(
          "Too late to call FetchEvent.respondWith(). It must be called synchronously in the event handler.",
          "InvalidStateError"
        );
      }
      this.stopImmediatePropagation();
      this[__facade_response__] = response;
    }
    passThroughOnException() {
      if (!(this instanceof ___Facade_FetchEvent__)) {
        throw new TypeError("Illegal invocation");
      }
      this.#passThroughOnException();
    }
  };
  var __Facade_ScheduledEvent__ = class ___Facade_ScheduledEvent__ extends __Facade_ExtendableEvent__ {
    static {
      __name(this, "__Facade_ScheduledEvent__");
    }
    #scheduledTime;
    #cron;
    #noRetry;
    constructor(type, init) {
      super(type);
      this.#scheduledTime = init.scheduledTime;
      this.#cron = init.cron;
      this.#noRetry = init.noRetry;
    }
    get scheduledTime() {
      return this.#scheduledTime;
    }
    get cron() {
      return this.#cron;
    }
    noRetry() {
      if (!(this instanceof ___Facade_ScheduledEvent__)) {
        throw new TypeError("Illegal invocation");
      }
      this.#noRetry();
    }
  };
  __facade__originalAddEventListener__("fetch", (event) => {
    const ctx = {
      waitUntil: event.waitUntil.bind(event),
      passThroughOnException: event.passThroughOnException.bind(event)
    };
    const __facade_sw_dispatch__ = /* @__PURE__ */ __name(function(type, init) {
      if (type === "scheduled") {
        const facadeEvent = new __Facade_ScheduledEvent__("scheduled", {
          scheduledTime: Date.now(),
          cron: init.cron ?? "",
          noRetry() {
          }
        });
        __FACADE_EVENT_TARGET__.dispatchEvent(facadeEvent);
        event.waitUntil(Promise.all(facadeEvent[__facade_waitUntil__]));
      }
    }, "__facade_sw_dispatch__");
    const __facade_sw_fetch__ = /* @__PURE__ */ __name(function(request, _env, ctx2) {
      const facadeEvent = new __Facade_FetchEvent__("fetch", {
        request,
        passThroughOnException: ctx2.passThroughOnException
      });
      __FACADE_EVENT_TARGET__.dispatchEvent(facadeEvent);
      facadeEvent[__facade_dispatched__] = true;
      event.waitUntil(Promise.all(facadeEvent[__facade_waitUntil__]));
      const response = facadeEvent[__facade_response__];
      if (response === void 0) {
        throw new Error("No response!");
      }
      return response;
    }, "__facade_sw_fetch__");
    event.respondWith(
      __facade_invoke__(
        event.request,
        globalThis,
        ctx,
        __facade_sw_dispatch__,
        __facade_sw_fetch__
      )
    );
  });
  __facade__originalAddEventListener__("scheduled", (event) => {
    const facadeEvent = new __Facade_ScheduledEvent__("scheduled", {
      scheduledTime: event.scheduledTime,
      cron: event.cron,
      noRetry: event.noRetry.bind(event)
    });
    __FACADE_EVENT_TARGET__.dispatchEvent(facadeEvent);
    event.waitUntil(Promise.all(facadeEvent[__facade_waitUntil__]));
  });

  // ../../../Users/91906/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
  var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
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

  // ../../../Users/91906/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
  function reduceError(e) {
    return {
      name: e?.name,
      message: e?.message ?? String(e),
      stack: e?.stack,
      cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
    };
  }
  __name(reduceError, "reduceError");
  var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
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

  // .wrangler/tmp/bundle-nRpCoN/middleware-insertion-facade.js
  __facade_registerInternal__([middleware_ensure_req_body_drained_default, middleware_miniflare3_json_error_default]);

  // functions/[[path]].js
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
  function getShareKey(key) {
    return `share:${key}`;
  }
  __name(getShareKey, "getShareKey");
  function getBucketKey(key, windowEnd) {
    return `bucket:${key}:${windowEnd}`;
  }
  __name(getBucketKey, "getBucketKey");
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
  async function recordLoginSuccess(env, ip) {
    await env.SHARE_KV.delete(`loginfail:${ip}`);
  }
  __name(recordLoginSuccess, "recordLoginSuccess");
  async function getShare(env, key) {
    return env.SHARE_KV.get(getShareKey(key), "json");
  }
  __name(getShare, "getShare");
  async function deleteShare(env, key) {
    await env.SHARE_KV.delete(getShareKey(key));
    const index = await env.SHARE_KV.get("share:index", "json") || [];
    await env.SHARE_KV.put("share:index", JSON.stringify(Array.isArray(index) ? index.filter((k) => k !== key) : []));
  }
  __name(deleteShare, "deleteShare");
  async function addToIndex(env, key) {
    let index = await env.SHARE_KV.get("share:index", "json") || [];
    if (!Array.isArray(index)) index = [];
    if (!index.includes(key)) {
      await env.SHARE_KV.put("share:index", JSON.stringify([...index, key]));
    }
  }
  __name(addToIndex, "addToIndex");
  async function getWindowUsage(env, shareKey) {
    const bucketKey = getBucketKey(shareKey, getCurrentWindowEnd());
    return parseInt(await env.SHARE_KV.get(bucketKey) || "0", 10);
  }
  __name(getWindowUsage, "getWindowUsage");
  async function incrementWindowUsage(env, shareKey, tokens) {
    const windowEnd = getCurrentWindowEnd();
    const bucketKey = getBucketKey(shareKey, windowEnd);
    const current = parseInt(await env.SHARE_KV.get(bucketKey) || "0", 10);
    const finalTotal = current + tokens;
    const ttlSec = Math.max(60, Math.ceil((windowEnd + 36e5 - Date.now()) / 1e3));
    await env.SHARE_KV.put(bucketKey, String(finalTotal), { expirationTtl: ttlSec });
  }
  __name(incrementWindowUsage, "incrementWindowUsage");
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
  async function serveAdminPage(env, origin) {
    return new Response("", {
      status: 302,
      headers: { Location: `${origin}/dashboard.html` }
    });
  }
  __name(serveAdminPage, "serveAdminPage");
})();
//# sourceMappingURL=%5B%5Bpath%5D%5D.js.map
