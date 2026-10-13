/* Backend tests. Run with: npm test  (Node 18+, no extra packages) */
"use strict";
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const PW = "a-strong-test-password";

function start(env) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shop-"));
  const child = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], {
    env: Object.assign({}, process.env, { PORT: "0", DATA_DIR: dir, ADMIN_PASSWORD: PW }, env), stdio: ["ignore", "pipe", "pipe"] });
  return new Promise((ok, bad) => {
    child.stdout.on("data", d => { const m = /localhost:(\d+)/.exec(d); if (m) ok({ base: "http://localhost:" + m[1], dir, stop: () => { child.kill(); fs.rmSync(dir, { recursive: true, force: true }); } }); });
    child.on("error", bad); setTimeout(() => bad(new Error("server did not start")), 5000);
  });
}
const J = { "Content-Type": "application/json" };
const msg = (o) => JSON.stringify(Object.assign({ name: "Amina", email: "amina@example.com", phone: "+237 600 111 222", message: "Is the backpack in stock today?" }, o));
const post = (s, url, body, headers) => fetch(s.base + url, { method: "POST", headers: Object.assign({}, J, headers), body });
const cookieOf = r => (r.headers.get("set-cookie") || "").split(";")[0];

describe("public site + contact form", () => {
  let s; before(async () => { s = await start({ CONTACT_LIMIT: "1000" }); }); after(() => s.stop());

  test("serves pages with security headers and a strict CSP", async () => {
    const r = await fetch(s.base + "/");
    assert.equal(r.status, 200);
    const csp = r.headers.get("content-security-policy");
    assert.match(csp, /default-src 'self'/); assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
    assert.equal(r.headers.get("x-frame-options"), "DENY"); assert.equal(r.headers.get("x-content-type-options"), "nosniff");
    assert.ok(r.headers.get("permissions-policy")); assert.ok(r.headers.get("referrer-policy"));
  });
  test("private files and traversal attempts are 404", async () => {
    for (const u of ["/server/server.js", "/%73erver/server.js", "/tests/server.test.js", "/data/messages.json", "/.env", "/.env.example", "/package.json", "/js/%00.js", "/%2e%2e/%2e%2e/etc/passwd", "/..%2f..%2fetc/passwd", "/%5c..%5cserver%5cserver.js", "/js/%zz"]) {
      const r = await fetch(s.base + u); assert.ok([400, 404].includes(r.status), u + " -> " + r.status);
    }
  });
  test("accepts a valid message and stores it", async () => {
    const r = await post(s, "/api/contact", msg()); assert.equal(r.status, 201);
    assert.equal(JSON.parse(fs.readFileSync(path.join(s.dir, "messages.json"))).length, 1);
  });
  test("rejects invalid input", async () => {
    for (const o of [{ name: "A" }, { email: "nope" }, { phone: "abc" }, { message: "short" }]) assert.equal((await post(s, "/api/contact", msg(o))).status, 400);
    assert.equal((await post(s, "/api/contact", "[1,2]")).status, 400);
    assert.equal((await post(s, "/api/contact", "{bad json")).status, 400);
  });
  test("blocks cross-site and non-JSON posts (CSRF)", async () => {
    assert.equal((await post(s, "/api/contact", msg(), { Origin: "https://evil.example" })).status, 403);
    assert.equal((await post(s, "/api/contact", msg(), { "Sec-Fetch-Site": "cross-site" })).status, 403);
    assert.equal((await post(s, "/api/contact", msg(), { "Content-Type": "text/plain" })).status, 415);
  });
  test("honeypot is silently ignored, oversize is refused, wrong method is 405", async () => {
    assert.equal((await post(s, "/api/contact", msg({ website: "http://spam" }))).status, 200);
    assert.equal((await post(s, "/api/contact", msg({ message: "a".repeat(20000) }))).status, 413);
    assert.equal((await fetch(s.base + "/api/contact", { method: "PUT" })).status, 405);
    assert.equal(JSON.parse(fs.readFileSync(path.join(s.dir, "messages.json"))).length, 1);
  });
  test("double submit is not stored twice", async () => {
    await post(s, "/api/contact", msg()); assert.equal(JSON.parse(fs.readFileSync(path.join(s.dir, "messages.json"))).length, 1);
  });
});

describe("rate limiting", () => {
  let s; before(async () => { s = await start(); }); after(() => s.stop());
  test("5 messages per visitor then 429", async () => {
    const codes = []; for (let i = 0; i < 7; i++) codes.push((await post(s, "/api/contact", msg({ message: "Message number " + i + " for the shop" }))).status);
    assert.deepEqual(codes, [201, 201, 201, 201, 201, 429, 429]);
  });
});

describe("seller inbox", () => {
  let s, cookie; before(async () => { s = await start({ CONTACT_LIMIT: "1000" }); await post(s, "/api/contact", msg()); }); after(() => s.stop());
  test("needs login", async () => {
    assert.equal((await fetch(s.base + "/api/messages")).status, 401);
    assert.equal((await fetch(s.base + "/api/messages", { headers: { Authorization: "Bearer " + PW } })).status, 401);
    assert.equal((await post(s, "/api/login", JSON.stringify({ password: "wrong" }))).status, 401);
  });
  test("login sets an HttpOnly SameSite=Strict cookie", async () => {
    const r = await post(s, "/api/login", JSON.stringify({ password: PW })); assert.equal(r.status, 200);
    const raw = r.headers.get("set-cookie"); assert.match(raw, /HttpOnly/); assert.match(raw, /SameSite=Strict/); cookie = cookieOf(r);
  });
  test("list, mark read, delete", async () => {
    const H = { Cookie: cookie };
    const list = await (await fetch(s.base + "/api/messages", { headers: H })).json(); assert.equal(list.length, 1); assert.equal(list[0].read, false);
    const id = list[0].id;
    const p = await fetch(s.base + "/api/messages/" + id, { method: "PATCH", headers: Object.assign({}, J, H), body: JSON.stringify({ read: true }) });
    assert.equal((await p.json()).read, true);
    assert.equal((await fetch(s.base + "/api/messages/not-an-id", { method: "DELETE", headers: H })).status, 404);
    assert.equal((await fetch(s.base + "/api/messages/" + id, { method: "DELETE", headers: Object.assign({}, H, { Origin: "https://evil.example" }) })).status, 403);
    assert.equal((await fetch(s.base + "/api/messages/" + id, { method: "DELETE", headers: H })).status, 200);
    assert.equal((await (await fetch(s.base + "/api/messages", { headers: H })).json()).length, 0);
  });
  test("logout ends the session", async () => {
    await post(s, "/api/logout", "{}", { Cookie: cookie });
    assert.equal((await fetch(s.base + "/api/messages", { headers: { Cookie: cookie } })).status, 401);
  });
  test("forged or malformed cookies are refused", async () => {
    for (const c of ["sid=" + "a".repeat(64), "sid=abc", "sid=../../etc"]) assert.equal((await fetch(s.base + "/api/messages", { headers: { Cookie: c } })).status, 401);
  });
});

describe("login brute-force protection", () => {
  let s; before(async () => { s = await start(); }); after(() => s.stop());
  test("locks out after 8 wrong passwords, even for the right one", { timeout: 20000 }, async () => {
    for (let i = 0; i < 8; i++) assert.equal((await post(s, "/api/login", JSON.stringify({ password: "guess" + i }))).status, 401);
    assert.equal((await post(s, "/api/login", JSON.stringify({ password: PW }))).status, 429);
  });
});

describe("weak admin password", () => {
  let s; before(async () => { s = await start({ ADMIN_PASSWORD: "short" }); }); after(() => s.stop());
  test("keeps the inbox disabled", async () => {
    assert.equal((await post(s, "/api/login", JSON.stringify({ password: "short" }))).status, 503);
    assert.equal((await fetch(s.base + "/api/messages")).status, 503);
  });
});

describe("HTTPS, proxy and SITE_URL settings", () => {
  let s; before(async () => { s = await start({ TRUST_PROXY: "1", FORCE_HTTPS: "1", SITE_URL: "https://shop.example", CONTACT_LIMIT: "1000", SMTP_HOST: "smtp.invalid" }); }); after(() => s.stop());
  test("redirects http to https behind a proxy", async () => {
    const r = await fetch(s.base + "/products.html", { redirect: "manual" });
    assert.equal(r.status, 308); assert.match(r.headers.get("location"), /^https:\/\/localhost:\d+\/products\.html$/);
  });
  test("sends HSTS and a Secure cookie when the proxy says https", async () => {
    const S = { "X-Forwarded-Proto": "https" };
    const page = await fetch(s.base + "/", { headers: S }); assert.match(page.headers.get("strict-transport-security"), /max-age=31536000/);
    const r = await post(s, "/api/login", JSON.stringify({ password: PW }), Object.assign({ Origin: "https://shop.example" }, S));
    assert.equal(r.status, 200); assert.match(r.headers.get("set-cookie"), /; Secure/);
  });
  test("only accepts forms from SITE_URL", async () => {
    const S = { "X-Forwarded-Proto": "https" };
    assert.equal((await post(s, "/api/contact", msg(), Object.assign({ Origin: "https://shop.example" }, S))).status, 201);
    assert.equal((await post(s, "/api/contact", msg(), Object.assign({ Origin: "https://other.example" }, S))).status, 403);
  });
  test("missing email package does not break the site", async () => {
    assert.equal((await fetch(s.base + "/", { headers: { "X-Forwarded-Proto": "https" } })).status, 200);
  });
});
