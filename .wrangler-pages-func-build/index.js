var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/stats/archetypes.ts
async function onRequestGet(context) {
  const { DB } = context.env;
  try {
    const snapshot = await DB.prepare(
      "SELECT value_json, updated_at FROM stats_snapshot WHERE key = ?"
    ).bind("archetypes").first();
    if (!snapshot) {
      return new Response(JSON.stringify({
        data: { items: [] },
        updatedAt: null
      }), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=120"
        }
      });
    }
    const data = JSON.parse(snapshot.value_json);
    return new Response(JSON.stringify({
      data,
      updatedAt: snapshot.updated_at
    }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=120"
      }
    });
  } catch (err) {
    console.error("Stats archetypes error:", err);
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(onRequestGet, "onRequestGet");

// api/stats/characters.ts
async function onRequestGet2(context) {
  const { DB } = context.env;
  try {
    const snapshot = await DB.prepare(
      "SELECT value_json, updated_at FROM stats_snapshot WHERE key = ?"
    ).bind("characters").first();
    if (!snapshot) {
      return new Response(JSON.stringify({
        data: { items: [] },
        updatedAt: null
      }), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=120"
        }
      });
    }
    const data = JSON.parse(snapshot.value_json);
    return new Response(JSON.stringify({
      data,
      updatedAt: snapshot.updated_at
    }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=120"
      }
    });
  } catch (err) {
    console.error("Stats characters error:", err);
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(onRequestGet2, "onRequestGet");

// api/stats/overview.ts
async function onRequestGet3(context) {
  const { DB } = context.env;
  try {
    const snapshot = await DB.prepare(
      "SELECT value_json, updated_at FROM stats_snapshot WHERE key = ?"
    ).bind("overview").first();
    if (!snapshot) {
      return new Response(JSON.stringify({
        data: {
          totalSubmissions: 0,
          todaySubmissions: 0,
          last24hSubmissions: 0
        },
        updatedAt: null
      }), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60"
        }
      });
    }
    const data = JSON.parse(snapshot.value_json);
    return new Response(JSON.stringify({
      data,
      updatedAt: snapshot.updated_at
    }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60"
      }
    });
  } catch (err) {
    console.error("Stats overview error:", err);
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(onRequestGet3, "onRequestGet");

// api/config.ts
async function onRequestGet4(context) {
  const viteSiteKey = String(context.env.VITE_TURNSTILE_SITE_KEY ?? "").trim();
  const legacySiteKey = String(context.env.TURNSTILE_SITE_KEY ?? "").trim();
  const siteKey = viteSiteKey || legacySiteKey;
  console.log("[api/config] Turnstile key diagnostics", {
    source: viteSiteKey ? "VITE_TURNSTILE_SITE_KEY" : legacySiteKey ? "TURNSTILE_SITE_KEY" : "none",
    viteKeyLength: viteSiteKey.length,
    legacyKeyLength: legacySiteKey.length,
    hasSiteKey: siteKey.length > 0
  });
  return new Response(
    JSON.stringify({
      turnstileSiteKey: siteKey || void 0
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      }
    }
  );
}
__name(onRequestGet4, "onRequestGet");

// api/_shared.ts
function str(val, maxLen = 64) {
  return typeof val === "string" ? val.slice(0, maxLen) : "";
}
__name(str, "str");
function num(val, min, max) {
  return typeof val === "number" && Number.isFinite(val) && val >= min && val <= max ? val : null;
}
__name(num, "num");
function isValidMbti(val) {
  return /^[EI][SN][TF][JP]$/i.test(val);
}
__name(isValidMbti, "isValidMbti");
function isValidCode(val) {
  return /^[A-Za-z0-9_-]{1,32}$/.test(val);
}
__name(isValidCode, "isValidCode");
function isValidUuid(val) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
}
__name(isValidUuid, "isValidUuid");
function validateAnswers(answers, expectedCount) {
  if (!Array.isArray(answers)) return null;
  if (expectedCount !== void 0 && answers.length !== expectedCount) return null;
  const result = [];
  for (const a of answers) {
    if (typeof a !== "object" || a === null || typeof a.questionId !== "string" || typeof a.answerValue !== "number") return null;
    const qid = str(a.questionId, 16);
    const val = num(a.answerValue, -2, 2);
    if (!qid || val === null) return null;
    result.push({ questionId: qid, answerValue: val });
  }
  return result;
}
__name(validateAnswers, "validateAnswers");
async function verifyTurnstile(token, ip, env) {
  const secret = env.TURNSTILE_SECRET;
  if (!secret) {
    console.warn("Turnstile secret not configured, skipping verification");
    return true;
  }
  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  if (ip) form.set("remoteip", ip);
  try {
    const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form
    });
    const data = await resp.json();
    return !!data.success;
  } catch (err) {
    console.error("Turnstile verify error:", err);
    return false;
  }
}
__name(verifyTurnstile, "verifyTurnstile");
async function checkRateLimit(DB, ip, limit = 10) {
  const windowKey = `rl:${ip}:${Math.floor(Date.now() / 6e4)}`;
  try {
    const row = await DB.prepare(
      "SELECT cnt FROM _rate_limit WHERE k = ?"
    ).bind(windowKey).first();
    const current = row?.cnt ?? 0;
    if (current >= limit) return false;
    await DB.prepare(
      "INSERT INTO _rate_limit (k, cnt, exp) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET cnt = cnt + 1"
    ).bind(windowKey, Math.floor(Date.now() / 1e3) + 120).run();
    return true;
  } catch {
    return true;
  }
}
__name(checkRateLimit, "checkRateLimit");

// api/feedback.ts
async function ensureFeedbackAnswerColumns(DB) {
  try {
    const info = await DB.prepare("PRAGMA table_info(mbti_feedback)").all();
    const names = new Set((info?.results ?? []).map((col) => String(col.name)));
    if (!names.has("answers_json")) {
      await DB.exec("ALTER TABLE mbti_feedback ADD COLUMN answers_json TEXT;");
    }
    if (!names.has("answer_count")) {
      await DB.exec("ALTER TABLE mbti_feedback ADD COLUMN answer_count INTEGER;");
    }
  } catch (err) {
    console.warn("ensureFeedbackAnswerColumns failed:", err);
  }
}
__name(ensureFeedbackAnswerColumns, "ensureFeedbackAnswerColumns");
function isMissingFeedbackAnswerColumns(err) {
  const text = String(err ?? "").toLowerCase();
  return text.includes("no such column") && (text.includes("answers_json") || text.includes("answer_count"));
}
__name(isMissingFeedbackAnswerColumns, "isMissingFeedbackAnswerColumns");
async function insertFeedbackWithAnswers(DB, params) {
  return DB.prepare(
    `INSERT INTO mbti_feedback (id, submission_id, created_at, app_version, self_mbti, confidence, note, answers_json, answer_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    params.feedbackId,
    params.submissionId,
    params.now,
    params.appVersion,
    params.selfMbti,
    params.confidence,
    params.note,
    params.answersJson,
    params.answerCount
  ).run();
}
__name(insertFeedbackWithAnswers, "insertFeedbackWithAnswers");
async function insertFeedbackLegacy(DB, params) {
  return DB.prepare(
    `INSERT INTO mbti_feedback (id, submission_id, created_at, app_version, self_mbti, confidence, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    params.feedbackId,
    params.submissionId,
    params.now,
    params.appVersion,
    params.selfMbti,
    params.confidence,
    params.note
  ).run();
}
__name(insertFeedbackLegacy, "insertFeedbackLegacy");
async function onRequestPost(context) {
  const { DB } = context.env;
  const ip = context.request.headers.get("CF-Connecting-IP") || "unknown";
  const allowed = await checkRateLimit(DB, ip, 5);
  if (!allowed) return new Response(null, { status: 429 });
  let raw;
  try {
    raw = await context.request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const turnstileToken = str(raw.turnstileToken, 2048);
  const turnstileSecret = String(context.env.TURNSTILE_SECRET ?? "").trim();
  if (turnstileSecret && !turnstileToken) {
    return new Response("Missing Turnstile token", { status: 400 });
  }
  if (turnstileToken) {
    const turnstileOk = await verifyTurnstile(turnstileToken, ip, context.env);
    if (!turnstileOk) {
      return new Response("Forbidden", { status: 403 });
    }
  }
  const submissionId = str(raw.submissionId, 64);
  const selfMbti = str(raw.selfMbti, 4);
  const confidence = num(raw.confidence, 1, 5);
  const note = typeof raw.note === "string" ? raw.note.slice(0, 200) : null;
  const appVersion = str(raw.appVersion, 16);
  const validatedAnswers = raw.answers === void 0 ? null : validateAnswers(raw.answers);
  if (raw.answers !== void 0 && !validatedAnswers) {
    return new Response("Invalid answers", { status: 400 });
  }
  const answersJson = validatedAnswers && validatedAnswers.length > 0 ? JSON.stringify(validatedAnswers) : null;
  const answerCount = validatedAnswers?.length ?? null;
  if (!selfMbti || confidence === null || !appVersion) {
    return new Response("Missing required fields", { status: 400 });
  }
  if (!isValidMbti(selfMbti)) {
    return new Response("Invalid MBTI format", { status: 400 });
  }
  if (submissionId && !isValidUuid(submissionId)) {
    return new Response("Invalid submissionId", { status: 400 });
  }
  const feedbackId = crypto.randomUUID();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const submissionIdOrNull = submissionId || null;
  const selfMbtiUpper = selfMbti.toUpperCase();
  try {
    await insertFeedbackWithAnswers(DB, {
      feedbackId,
      submissionId: submissionIdOrNull,
      now,
      appVersion,
      selfMbti: selfMbtiUpper,
      confidence,
      note,
      answersJson,
      answerCount
    });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    if (isMissingFeedbackAnswerColumns(err)) {
      try {
        await ensureFeedbackAnswerColumns(DB);
        await insertFeedbackWithAnswers(DB, {
          feedbackId,
          submissionId: submissionIdOrNull,
          now,
          appVersion,
          selfMbti: selfMbtiUpper,
          confidence,
          note,
          answersJson,
          answerCount
        });
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      } catch (retryErr) {
        try {
          await insertFeedbackLegacy(DB, {
            feedbackId,
            submissionId: submissionIdOrNull,
            now,
            appVersion,
            selfMbti: selfMbtiUpper,
            confidence,
            note
          });
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        } catch (legacyErr) {
          console.error("Feedback error after legacy fallback:", legacyErr);
          return new Response(JSON.stringify({ ok: false, error: "internal" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }
      }
    }
    console.error("Feedback error:", err);
    return new Response(JSON.stringify({ ok: false, error: "internal" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(onRequestPost, "onRequestPost");

// api/submit.ts
function formatError(err) {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack
    };
  }
  return err;
}
__name(formatError, "formatError");
async function ensureSubmissionColumns(DB) {
  try {
    const info = await DB.prepare("PRAGMA table_info(submissions)").all();
    const names = new Set((info?.results ?? []).map((col) => String(col.name)));
    if (!names.has("predicted_mbti")) {
      await DB.exec("ALTER TABLE submissions ADD COLUMN predicted_mbti TEXT;");
    }
  } catch (err) {
    console.warn("ensureSubmissionColumns failed:", formatError(err));
  }
}
__name(ensureSubmissionColumns, "ensureSubmissionColumns");
function isMissingSubmissionColumns(err) {
  const text = JSON.stringify(formatError(err)).toLowerCase();
  return text.includes("no such column") && text.includes("predicted_mbti");
}
__name(isMissingSubmissionColumns, "isMissingSubmissionColumns");
async function insertSubmissionWithPredicted(DB, params) {
  return DB.prepare(
    `INSERT OR IGNORE INTO submissions
      (id, created_at, app_version, archetype_code, character_code,
       ei_score, sn_score, tf_score, jp_score, duration_ms,
       predicted_mbti)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    params.submissionId,
    params.now,
    params.appVersion,
    params.archetypeCode,
    params.characterCode,
    params.ei,
    params.sn,
    params.tf,
    params.jp,
    params.durationMs,
    params.predictedMbti
  ).run();
}
__name(insertSubmissionWithPredicted, "insertSubmissionWithPredicted");
async function insertSubmissionLegacy(DB, params) {
  return DB.prepare(
    `INSERT OR IGNORE INTO submissions
      (id, created_at, app_version, archetype_code, character_code,
       ei_score, sn_score, tf_score, jp_score, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    params.submissionId,
    params.now,
    params.appVersion,
    params.archetypeCode,
    params.characterCode,
    params.ei,
    params.sn,
    params.tf,
    params.jp,
    params.durationMs
  ).run();
}
__name(insertSubmissionLegacy, "insertSubmissionLegacy");
async function onRequestPost2(context) {
  const { DB } = context.env;
  const ip = context.request.headers.get("CF-Connecting-IP") || "unknown";
  const allowed = await checkRateLimit(DB, ip, 10);
  if (!allowed) return new Response(null, { status: 429 });
  let raw;
  try {
    raw = await context.request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  console.log("\u{1F4CA} Submit payload received:", JSON.stringify(raw, null, 2));
  const submissionId = str(raw.submissionId, 64);
  const appVersion = str(raw.appVersion, 16);
  const archetypeCode = str(raw.archetypeCode, 32);
  const characterCode = str(raw.characterCode, 32);
  const predictedMbti = str(raw.predictedMbti, 4);
  const durationMs = num(raw.durationMs, 1e3, 36e5);
  if (!submissionId || !appVersion || !archetypeCode || !characterCode) {
    console.error("\u274C Missing required fields:", { submissionId, appVersion, archetypeCode, characterCode });
    return new Response("Missing required fields", { status: 400 });
  }
  if (!isValidUuid(submissionId)) {
    console.error("\u274C Invalid submissionId format:", submissionId);
    return new Response("Invalid submissionId", { status: 400 });
  }
  if (!isValidCode(archetypeCode) || !isValidCode(characterCode)) {
    console.error("\u274C Invalid code format:", { archetypeCode, characterCode });
    return new Response("Invalid code format", { status: 400 });
  }
  if (predictedMbti && !isValidMbti(predictedMbti)) {
    console.error("\u274C Invalid predictedMbti format:", predictedMbti);
    return new Response("Invalid predictedMbti", { status: 400 });
  }
  if (durationMs === null) {
    console.error("\u274C Invalid durationMs:", raw.durationMs);
    return new Response("Invalid durationMs", { status: 400 });
  }
  console.log("\u{1F4E6} Submit payload summary:", {
    submissionId,
    appVersion,
    archetypeCode,
    characterCode,
    predictedMbti: predictedMbti || null,
    durationMs
  });
  const ds = raw.dimensionScores;
  const ei = num(ds?.ei, 0, 100);
  const sn = num(ds?.sn, 0, 100);
  const tf = num(ds?.tf, 0, 100);
  const jp = num(ds?.jp, 0, 100);
  if (ei === null || sn === null || tf === null || jp === null) {
    console.error("\u274C Invalid dimensionScores:", {
      ei: [raw.dimensionScores?.ei, "validated to", ei],
      sn: [raw.dimensionScores?.sn, "validated to", sn],
      tf: [raw.dimensionScores?.tf, "validated to", tf],
      jp: [raw.dimensionScores?.jp, "validated to", jp]
    });
    return new Response("Invalid dimensionScores", { status: 400 });
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  try {
    await insertSubmissionWithPredicted(DB, {
      submissionId,
      now,
      appVersion,
      archetypeCode,
      characterCode,
      ei,
      sn,
      tf,
      jp,
      durationMs,
      predictedMbti: predictedMbti || null
    });
    console.log("\u2705 submission stored", {
      submissionId
    });
    return new Response(null, { status: 204 });
  } catch (err) {
    if (isMissingSubmissionColumns(err)) {
      try {
        await ensureSubmissionColumns(DB);
        await insertSubmissionWithPredicted(DB, {
          submissionId,
          now,
          appVersion,
          archetypeCode,
          characterCode,
          ei,
          sn,
          tf,
          jp,
          durationMs,
          predictedMbti: predictedMbti || null
        });
        console.log("\u2705 submission stored after schema repair", {
          submissionId
        });
        return new Response(null, { status: 204 });
      } catch (retryErr) {
        try {
          await insertSubmissionLegacy(DB, {
            submissionId,
            now,
            appVersion,
            archetypeCode,
            characterCode,
            ei,
            sn,
            tf,
            jp,
            durationMs
          });
          console.log("\u2705 submission stored with legacy schema", {
            submissionId
          });
          return new Response(null, { status: 204 });
        } catch (legacyErr) {
          console.error("Submit legacy fallback error:", formatError(legacyErr));
        }
      }
    }
    console.error("Submit error:", formatError(err));
    return new Response(null, { status: 204 });
  }
}
__name(onRequestPost2, "onRequestPost");

// api/ping.ts
async function onRequest() {
  return new Response("pong", { status: 200 });
}
__name(onRequest, "onRequest");

// ../.wrangler/tmp/pages-FrZj6u/functionsRoutes-0.19412438058172543.mjs
var routes = [
  {
    routePath: "/api/stats/archetypes",
    mountPath: "/api/stats",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/stats/characters",
    mountPath: "/api/stats",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/stats/overview",
    mountPath: "/api/stats",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/api/config",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet4]
  },
  {
    routePath: "/api/feedback",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/submit",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/ping",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest]
  }
];

// ../node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str2) {
  var tokens = [];
  var i = 0;
  while (i < str2.length) {
    var char = str2[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str2[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str2[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str2[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str2[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str2.length) {
        var code = str2.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str2[j++];
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
      if (str2[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str2.length) {
        if (str2[j] === "\\") {
          pattern += str2[j++] + str2[j++];
          continue;
        }
        if (str2[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str2[j] === "(") {
          count++;
          if (str2[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str2[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str2[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str2, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str2);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
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
function match(str2, options) {
  var keys = [];
  var re = pathToRegexp(str2, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
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
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
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
function escapeString(str2) {
  return str2.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
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
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
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
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../node_modules/wrangler/templates/pages-template-worker.ts
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
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
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
          passThroughOnException: /* @__PURE__ */ __name(() => {
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
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
