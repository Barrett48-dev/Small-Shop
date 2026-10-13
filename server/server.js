/* ==========================================================
   server.js - small, hardened backend for the shop (Node 18+).
   - Serves the website files (allow-list of file types)
   - POST /api/contact   : customer sends a message (public)
   - POST /api/login     : seller logs in (HttpOnly session cookie)
   - GET/PATCH/DELETE /api/messages : seller inbox (needs login)
   Messages are stored in data/messages.json.
   Settings come from .env (see .env.example). No dependencies
   are required (nodemailer only if you want email alerts).
   ========================================================== */
"use strict";
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");
const ROOT = path.join(__dirname, "..");

/* ---------- settings (.env) ---------- */
try {
  fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/).forEach(l => {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  });
} catch (e) { /* no .env file */ }
const E = process.env;
const DATA = E.DATA_DIR ? path.resolve(E.DATA_DIR) : path.join(ROOT, "data"), FILE = path.join(DATA, "messages.json");
const PORT = E.PORT === undefined ? 3000 : +E.PORT;
const TRUST = E.TRUST_PROXY === "1";                       // only behind a reverse proxy you control
const FORCE_HTTPS = E.FORCE_HTTPS === "1" && TRUST;        // redirect http -> https (needs the proxy)
const CONTACT_LIMIT = +E.CONTACT_LIMIT || 5;                // messages per visitor per 10 minutes
const MAX_MESSAGES = +E.MAX_MESSAGES || 5000, RETENTION_DAYS = +E.RETENTION_DAYS || 0;
const SESSION_MS = 8 * 3600 * 1000;
let ADMIN = E.ADMIN_PASSWORD || "";
if (E.FORCE_HTTPS === "1" && !TRUST) console.warn("FORCE_HTTPS needs TRUST_PROXY=1 (a reverse proxy doing HTTPS). Ignoring it.");
if (!ADMIN) console.warn("ADMIN_PASSWORD is not set: the inbox is disabled. Copy .env.example to .env and set one.");
else if (ADMIN.length < 10 || ADMIN === "change-this-to-a-long-password") {
  console.warn("ADMIN_PASSWORD is too short or still the example value (use 10+ characters). The inbox is disabled.");
  ADMIN = "";
}
let SITE_ORIGIN = "";
try { if (E.SITE_URL) SITE_ORIGIN = new URL(E.SITE_URL).origin; } catch (e) { console.warn("SITE_URL is not a valid URL. Ignoring it."); }

/* ---------- optional email notifications ---------- */
let mailer = null;
if (E.SMTP_HOST) {
  try {
    const port = +E.SMTP_PORT || 587;
    mailer = require("nodemailer").createTransport({ host: E.SMTP_HOST, port, secure: port === 465, auth: { user: E.SMTP_USER, pass: E.SMTP_PASS } });
  } catch (e) { console.warn("SMTP is set but nodemailer is missing. Run: npm install"); }
}
function notify(m) {
  if (!mailer) return;
  mailer.sendMail({
    from: E.SMTP_USER, to: E.NOTIFY_EMAIL || E.SMTP_USER, replyTo: m.email,
    subject: "New website message from " + m.name,
    text: m.message + "\n\nName: " + m.name + "\nEmail: " + m.email + (m.phone ? "\nPhone: " + m.phone : "")
  }).catch(err => console.error("Email notification failed:", err.message));
}

/* ---------- storage ---------- */
function load() { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch (e) { return []; } }
function save(all) {
  fs.mkdirSync(DATA, { recursive: true, mode: 0o700 });
  fs.writeFileSync(FILE + ".tmp", JSON.stringify(all, null, 2), { mode: 0o600 });
  fs.renameSync(FILE + ".tmp", FILE);
}
function purge() {                                         // optional automatic deletion of old messages
  if (!RETENTION_DAYS) return;
  const cutoff = Date.now() - RETENTION_DAYS * 864e5, all = load(), keep = all.filter(m => Date.parse(m.createdAt) > cutoff);
  if (keep.length !== all.length) save(keep);
}
purge(); setInterval(purge, 864e5).unref();

/* ---------- rate limiting ---------- */
const hits = new Map();
const recent = (k, w) => (hits.get(k) || []).filter(t => Date.now() - t < w);
const count = (k, w) => recent(k, w).length;
const hit = k => hits.set(k, recent(k, 3600000).concat(Date.now()));
const limited = (k, max, w) => (hit(k), count(k, w) > max);
setInterval(() => { for (const [k, a] of hits) if (!a.some(t => Date.now() - t < 3600000)) hits.delete(k); }, 600000).unref();

/* ---------- sessions (seller login) ---------- */
const sessions = new Map();                                // token -> expiry time
function newSession() {
  const t = crypto.randomBytes(32).toString("hex");
  sessions.set(t, Date.now() + SESSION_MS);
  if (sessions.size > 50) sessions.delete(sessions.keys().next().value);
  return t;
}
const sidOf = req => { const m = (req.headers.cookie || "").match(/(?:^|;\s*)sid=([a-f0-9]{64})/); return m && m[1]; };
function authed(req) {
  const t = sidOf(req), exp = t && sessions.get(t);
  if (exp && exp > Date.now()) return true;
  if (t) sessions.delete(t);
  return false;
}
const isHttps = req => !!req.socket.encrypted || (TRUST && req.headers["x-forwarded-proto"] === "https");
const cookieStr = (req, v, secs) => "sid=" + v + "; HttpOnly; SameSite=Strict; Path=/; Max-Age=" + secs + (isHttps(req) ? "; Secure" : "");

/* ---------- helpers ---------- */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sha = s => crypto.createHash("sha256").update(s).digest();
const ip = req => ((TRUST && req.headers["x-forwarded-for"]) || req.socket.remoteAddress || "").toString().split(",")[0].trim();
const str = (v, max, multi) => String(v == null ? "" : v).replace(multi ? /[^\S\n]+$/gm : /[\r\n]+/g, " ").trim().slice(0, max);
function send(res, code, obj, headers) {
  res.writeHead(code, Object.assign({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, headers));
  res.end(JSON.stringify(obj));
}
function jsonBody(req, max) {                              // JSON only: blocks cross-site "simple" form posts
  if (!/^application\/json\b/i.test(req.headers["content-type"] || "")) return Promise.reject(Object.assign(new Error("Send JSON."), { status: 415 }));
  return new Promise((ok, bad) => {
    let n = 0, big = false; const c = [];
    req.on("data", d => { n += d.length; if (n > max) big = true; else c.push(d); });
    req.on("end", () => {
      if (big) return bad(Object.assign(new Error("Message too large."), { status: 413 }));
      try { const d = JSON.parse(Buffer.concat(c).toString()); d && typeof d === "object" && !Array.isArray(d) ? ok(d) : bad(new Error("bad")); }
      catch (e) { bad(Object.assign(new Error("Invalid request."), { status: 400 })); }
    });
    req.on("error", bad);
  });
}
function sameOrigin(req) {
  const site = req.headers["sec-fetch-site"];
  if (site && site !== "same-origin" && site !== "none") return false;
  const o = req.headers.origin;
  if (!o) return true;
  if (SITE_ORIGIN) return o === SITE_ORIGIN;
  try { return new URL(o).host === req.headers.host; } catch (e) { return false; }
}
function secureHeaders(req, res) {
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src https://www.google.com; form-action 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  if (isHttps(req)) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
}
function validate(m) {
  if (m.name.length < 2) return "Enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email)) return "Enter a valid email address.";
  if (m.phone && !/^\+?[\d\s()-]{7,}$/.test(m.phone)) return "Enter a valid phone number, or leave it empty.";
  if (m.message.length < 10) return "Write at least 10 characters.";
  return "";
}

/* ---------- API routes ---------- */
async function contact(req, res) {
  if (limited("c:" + ip(req), CONTACT_LIMIT, 600000) || limited("c:all", 60, 3600000))
    return send(res, 429, { error: "Too many messages. Please wait a few minutes and try again." });
  let d;
  try { d = await jsonBody(req, 10240); } catch (e) { return send(res, e.status || 400, { error: e.status ? e.message : "Invalid request." }); }
  if (d.website) return send(res, 200, { ok: true });                  // honeypot: bots fill this hidden field
  const m = { name: str(d.name, 100), email: str(d.email, 200), phone: str(d.phone, 40), message: str(d.message, 2000, true) };
  const err = validate(m);
  if (err) return send(res, 400, { error: err });
  const all = load();
  if (all.slice(-20).some(x => x.email === m.email && x.message === m.message && Date.now() - Date.parse(x.createdAt) < 600000))
    return send(res, 200, { ok: true });                               // accidental double submit
  if (all.length >= MAX_MESSAGES) return send(res, 503, { error: "The shop inbox is full right now. Please contact us by phone or WhatsApp." });
  const rec = Object.assign({ id: crypto.randomUUID() }, m, { createdAt: new Date().toISOString(), read: false });
  all.push(rec); save(all); notify(rec);
  send(res, 201, { ok: true });
}

async function login(req, res) {
  if (!ADMIN) return send(res, 503, { error: "The inbox is disabled. Set a strong ADMIN_PASSWORD in .env and restart the server." });
  const k = "a:" + ip(req);
  if (count(k, 900000) >= 8) return send(res, 429, { error: "Too many attempts. Try again in 15 minutes." });
  let d;
  try { d = await jsonBody(req, 1024); } catch (e) { return send(res, e.status || 400, { error: e.status ? e.message : "Invalid request." }); }
  const pw = typeof d.password === "string" ? d.password : "";
  if (!crypto.timingSafeEqual(sha(pw), sha(ADMIN))) {
    hit(k); console.warn(new Date().toISOString(), "Failed admin login from", ip(req));
    await sleep(500);                                                   // slows down guessing
    return send(res, 401, { error: "Wrong password." });
  }
  send(res, 200, { ok: true }, { "Set-Cookie": cookieStr(req, newSession(), SESSION_MS / 1000) });
}

function logout(req, res) {
  const t = sidOf(req); if (t) sessions.delete(t);
  send(res, 200, { ok: true }, { "Set-Cookie": cookieStr(req, "", 0) });
}

async function admin(req, res, p) {
  if (!ADMIN) return send(res, 503, { error: "The inbox is disabled. Set a strong ADMIN_PASSWORD in .env and restart the server." });
  if (!authed(req)) return send(res, 401, { error: "Please log in." });
  const id = p.split("/")[3], all = load();
  if (req.method === "GET" && !id) return send(res, 200, all.reverse());
  if (!/^[0-9a-f-]{36}$/.test(id || "")) return send(res, 404, { error: "Message not found." });
  const i = all.findIndex(m => m.id === id);
  if (i < 0) return send(res, 404, { error: "Message not found." });
  if (req.method === "DELETE") { all.splice(i, 1); save(all); return send(res, 200, { ok: true }); }
  if (req.method === "PATCH") {
    let d; try { d = await jsonBody(req, 1024); } catch (e) { return send(res, e.status || 400, { error: e.status ? e.message : "Invalid request." }); }
    all[i].read = !!d.read; save(all); return send(res, 200, all[i]);
  }
  send(res, 405, { error: "Method not allowed." });
}

/* ---------- static files (allow-list) ---------- */
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".gif": "image/gif", ".ico": "image/x-icon", ".woff2": "font/woff2" };
function serveStatic(p, req, res) {
  const missing = () => { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); res.end("Not found"); };
  if (p.includes("\0") || p.includes("\\")) return missing();
  if (p === "/") p = "/index.html";
  if (p === "/admin") { p = "/admin.html"; res.setHeader("X-Robots-Tag", "noindex"); }
  const file = path.join(ROOT, p), rel = path.relative(ROOT, file), parts = rel.split(path.sep);
  const type = TYPES[path.extname(file).toLowerCase()];
  const ok = rel && !rel.startsWith("..") && !path.isAbsolute(rel) && !["server", "tests", "data", "node_modules"].includes(parts[0]) && !parts.some(s => s.startsWith("."));
  if (!ok || !type) return missing();
  fs.readFile(file, (err, buf) => {
    if (err) return missing();
    res.writeHead(200, { "Content-Type": type, "Cache-Control": type.startsWith("image/") ? "public, max-age=86400" : "no-cache" });
    res.end(req.method === "HEAD" ? undefined : buf);
  });
}

/* ---------- server ---------- */
const server = http.createServer(async (req, res) => {
  try {
    secureHeaders(req, res);
    if (FORCE_HTTPS && !isHttps(req)) {
      const h = req.headers.host || "";
      if (!/^[a-z0-9.-]+(:\d+)?$/i.test(h)) { res.writeHead(400); return res.end(); }
      res.writeHead(308, { Location: "https://" + h + req.url }); return res.end();
    }
    let p;
    try { p = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch (e) { return send(res, 400, { error: "Bad request." }); }
    if (p.startsWith("/api/")) {
      if (req.method !== "GET" && !sameOrigin(req)) return send(res, 403, { error: "Cross-site requests are not allowed." });
      if (p === "/api/contact" && req.method === "POST") return await contact(req, res);
      if (p === "/api/login" && req.method === "POST") return await login(req, res);
      if (p === "/api/logout" && req.method === "POST") return logout(req, res);
      if (p === "/api/messages" || p.startsWith("/api/messages/")) return await admin(req, res, p);
      return send(res, req.method === "GET" || req.method === "POST" ? 404 : 405, { error: "Not found." });
    }
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { error: "Method not allowed." });
    serveStatic(p, req, res);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, { error: "Something went wrong." });
  }
});
server.headersTimeout = 10000; server.requestTimeout = 15000; server.keepAliveTimeout = 5000; server.maxHeadersCount = 50;
server.on("clientError", (err, socket) => { if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\n\r\n"); });
server.listen(PORT, () => console.log("Shop website running at http://localhost:" + server.address().port));
