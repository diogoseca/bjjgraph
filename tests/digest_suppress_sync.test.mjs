// THE UNSUBSCRIBE ROUND-TRIP TELLS THE TRUTH — both halves of it.
//
// The bug this pins (found 2026-08-31, shipped since v1.105.7): `functions/unsubscribe.js`
// wrote `digest_suppress` and NOTHING ELSE. `settings.emailDigest` stayed `true`, so after a
// one-click unsubscribe:
//   · Settings still read "On" — while the confirmation page says "turn them back on any time
//     in Settings", which is a dead end: there is nothing there to turn back on.
//   · `noteCardDone` kept writing the per-day `dayLog` ("no consent, no data" — but consent
//     had been withdrawn, and the writer never heard).
// Mail did stop, so nothing looked broken from the outside. That is the §6.6 shape exactly:
// the state that was WRONG produced the same observable as the state that was right.
//
// The invariant, in one line: THE BLOB CARRIES THE USER'S INTENT, `digest_suppress` CARRIES
// THE STOP. Unsubscribe writes both; the app only ever sees the blob.
//
// Re-subscribing is the half that is easy to get wrong in the other direction. A suppression
// row must NOT be permanent (the page promises otherwise) and must NOT be lifted by anything
// except a deliberate act. The discriminator is the per-key LWW stamp the settings sync
// already maintains: `settingsAt.emailDigest` LATER than `digest_suppress.at` means the user
// turned it back on AFTER unsubscribing. Two guards keep that honest:
//   · a legacy row (suppressed while the blob still said `true`, i.e. every user suppressed
//     before this fix) has `at` NEWER than the stamp, so it stays suppressed — no deploy-day
//     resurrection of people who unsubscribed;
//   · a stamp in the FUTURE is refused, so a stale device with a fast clock cannot re-arm a
//     subscription its owner never asked for. `set()` stamps `Date.now()` on the CLIENT.
//
// Run: node --test tests/digest_suppress_sync.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { runDigest } from "../workers/digest/index.js";
import { onRequest } from "../functions/unsubscribe.js";

const SB = "https://sb.test";
const USER = "11111111-2222-3333-4444-555555555555";
const SECRET = "test-secret-not-a-real-one";

/** The HMAC the Function checks — computed the same way it does, so the test cannot pass by
 *  agreeing with a copy of the implementation (§6.3: never re-implement the thing under test;
 *  here the token is an INPUT, and it is derived from the same primitive the app uses). */
const tokenFor = async (userId) => {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(userId));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
};

const iso = (ms) => new Date(ms).toISOString();
/** A day key at least one UTC date behind today — the worker refuses the in-progress day. */
const YESTERDAY = iso(Date.now() - 36e5 * 30).slice(0, 10);

/** A blob whose owner studied yesterday, opted in at `optInAt`. */
const blobFor = (optInAt) => ({
  v: 2,
  settings: { emailDigest: true },
  settingsAt: { emailDigest: optInAt },
  days: { [YESTERDAY]: 4 },
  dayLog: { [YESTERDAY]: { s: 41.5, k: ["Mount|Top"], w: [3, "thin", "Guard|Bottom"] } },
});

/**
 * A PostgREST + Email double. Records every call so the assertions can read what the code
 * actually DID, not what it returned (§6.3: assert on what was emitted).
 */
function harness({ rows = [], suppress = [], sent = [] } = {}) {
  const calls = [];
  const state = { rows: JSON.parse(JSON.stringify(rows)), suppress: [...suppress], sent: [...sent] };
  const mails = [];
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  const fetchImpl = async (url, init = {}) => {
    const u = String(url);
    const method = (init.method || "GET").toUpperCase();
    calls.push({ method, url: u, body: init.body ? JSON.parse(init.body) : null });

    // the public content chunk the magazine section tries — a miss is a supported path
    if (u.startsWith("https://bjjgraph.org/")) return new Response("", { status: 404 });

    const path = u.slice(SB.length);
    if (path.startsWith("/rest/v1/user_training_data")) {
      if (method === "GET") return json(state.rows);
      if (method === "PATCH") {
        const id = /user_id=eq\.([^&]+)/.exec(path);
        const row = state.rows.find((r) => r.user_id === (id && id[1]));
        if (row && init.body) Object.assign(row, JSON.parse(init.body));
        return new Response(null, { status: 204 });
      }
    }
    if (path.startsWith("/rest/v1/digest_suppress")) {
      if (method === "GET") return json(state.suppress);
      if (method === "POST") { state.suppress.push({ user_id: JSON.parse(init.body).user_id, at: iso(Date.now()) }); return new Response(null, { status: 201 }); }
      if (method === "DELETE") {
        const id = /user_id=eq\.([^&]+)/.exec(path);
        state.suppress = state.suppress.filter((s) => s.user_id !== (id && id[1]));
        return new Response(null, { status: 204 });
      }
    }
    if (path.startsWith("/rest/v1/digest_sent")) {
      if (method === "GET") return json(state.sent);
      if (method === "POST") { state.sent.push(JSON.parse(init.body)); return new Response(null, { status: 201 }); }
    }
    if (path.startsWith("/auth/v1/admin/users/")) return json({ email: "player@example.test" });
    throw new Error("unstubbed request: " + method + " " + u);
  };

  const env = {
    SUPABASE_URL: SB,
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
    UNSUB_HMAC_SECRET: SECRET,
    EMAIL: { send: async (m) => { mails.push(m); return { messageId: "msg-" + mails.length }; } },
  };
  return { env, calls, state, mails, fetchImpl };
}

/** Swap global fetch for one call. The Worker and the Function both use the global. */
async function withFetch(fetchImpl, fn) {
  const real = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try { return await fn(); } finally { globalThis.fetch = real; }
}

const unsubUrl = async (userId) =>
  "https://bjjgraph.org/unsubscribe?u=" + userId + "&t=" + (await tokenFor(userId));

/** The one-click POST a mailbox provider sends (RFC 8058 §3.2): the marker in a form body,
 *  no cookies, no auth. Since v1.164.0 this — or the confirm page's own button — is the ONLY
 *  request that unsubscribes; the three tests right below ask what an unsubscribe DOES, and
 *  the method half further down asks WHICH requests are one. */
const oneClick = (url) =>
  new Request(url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "List-Unsubscribe=One-Click" });
const unsubRequest = async (userId) => oneClick(await unsubUrl(userId));

// ── the unsubscribe half ────────────────────────────────────────────────────────────────

test("unsubscribe writes the suppression row AND turns the blob's own key off", async () => {
  const h = harness({ rows: [{ user_id: USER, neural: blobFor(Date.now() - 864e5) }] });
  const req = await unsubRequest(USER);
  const res = await withFetch(h.fetchImpl, () => onRequest({ request: req, env: h.env }));
  assert.equal(res.status, 200);

  assert.equal(h.state.suppress.length, 1, "the authoritative stop must still be written");

  const blob = h.state.rows[0].neural;
  assert.equal(blob.settings.emailDigest, false,
    "the blob still says the user wants mail — this is the desync the fix exists for");
  assert.ok(blob.settingsAt.emailDigest > Date.now() - 6e4,
    "the LWW stamp must be refreshed, or the next push from any device revives `true`");
});

test("unsubscribe still succeeds when the blob write fails — the stop is what matters", async () => {
  const h = harness({ rows: [{ user_id: USER, neural: blobFor(Date.now() - 864e5) }] });
  const inner = h.fetchImpl;
  const failing = async (url, init = {}) => {
    if (String(url).includes("user_training_data") && (init.method || "GET").toUpperCase() === "PATCH")
      return new Response("nope", { status: 500 });
    return inner(url, init);
  };
  const req = await unsubRequest(USER);
  const res = await withFetch(failing, () => onRequest({ request: req, env: h.env }));
  assert.equal(res.status, 200, "mail is already stopped; a stale toggle must not fail the unsubscribe");
  assert.equal(h.state.suppress.length, 1);
});

test("a forged unsubscribe token changes nothing", async () => {
  const h = harness({ rows: [{ user_id: USER, neural: blobFor(Date.now() - 864e5) }] });
  const req = new Request("https://bjjgraph.org/unsubscribe?u=" + USER + "&t=deadbeef");
  const res = await withFetch(h.fetchImpl, () => onRequest({ request: req, env: h.env }));
  assert.equal(res.status, 400);
  assert.equal(h.state.suppress.length, 0);
  assert.equal(h.state.rows[0].neural.settings.emailDigest, true, "an invalid link must not touch the blob");
});

// ── the method half (v1.164.0) ──────────────────────────────────────────────────────────
//
// WHO IS BEHIND THE REQUEST. The signed URL sits in the body as an ordinary <a href> and in
// the List-Unsubscribe header, and both are fetched by things that are not the recipient:
// link prefetchers, corporate mail gateways and security scanners follow the link (GET), and
// `List-Unsubscribe-Post` invites mailbox providers — and any scanner imitating one — to POST
// it. From v1.105.7 to v1.163.0 the Function never read `request.method`, so each of those
// unsubscribed the recipient silently. RFC 8058 §3.2 is the discriminator (its stated
// motivation is exactly this: "anti-spam software often fetches all resources in mail header
// fields automatically"): the one-click POST carries the form body `List-Unsubscribe=One-Click`.
// A request without it has no human behind it that the Function can see, so it MUTATES
// NOTHING and answers a page whose only act is one button. That button's own submission
// cannot carry the RFC marker (a browser posts the form's inputs; the marker is the
// receiver's word, not ours), so the page carries its own, `confirm=1`, and either is
// honoured. Owner's ruling 2026-09-01: safety over compliance friction; one confirming click
// is the ceiling.
//
// Every "nothing happened" claim below is `h.calls.length === 0` — NOT reaching Supabase at
// all — never a state comparison alone, so a write that happened to be a no-op still fails.
//
// Mutants (v1.164.0): 23 run, 22 killed by a named test. THE ONE NON-KILL, so nobody reads
// this as covering it: dropping `esc()` on the form's action survives — and it is equivalent,
// not a gap: `url.search` is the URL parser's output, which percent-encodes `"`, `<`, `>` and
// `'` in a query, so the only character `esc` ever rewrites there is `&` → `&amp;`. No signed
// id can break the attribute; `esc` stays for well-formed HTML, not for safety.

const BAD_URL = "https://bjjgraph.org/unsubscribe?u=" + USER + "&t=" + "0".repeat(32);
const SECURITY_HEADERS = ["X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy",
  "Permissions-Policy", "Strict-Transport-Security", "Content-Security-Policy-Report-Only"];

/** The confirm form READ BACK OUT OF THE PAGE the way a browser would: its method, its action
 *  (attribute-decoded), its named inputs, and whether it has a submit control. Test (d) then
 *  submits exactly that, so a renamed input, a wrong action or a GET form is a red test, not a
 *  dead button in production (§6.3: drive the emitted output, never a copy of it). */
const decodeAttr = (s) => s.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
function formOf(html) {
  const f = /<form\b([^>]*)>([\s\S]*?)<\/form>/i.exec(html);
  assert.ok(f, "the page has no <form>");
  const attr = (tag, name) => {
    const m = new RegExp("\\b" + name + "\\s*=\\s*\"([^\"]*)\"", "i").exec(tag);
    return m ? decodeAttr(m[1]) : null;
  };
  const inputs = [...f[2].matchAll(/<input\b([^>]*)>/gi)]
    .map((m) => [attr(m[1], "name"), attr(m[1], "value") || ""])
    .filter(([n]) => n);
  const hasSubmit = /<button\b[^>]*type="submit"|<input\b[^>]*type="submit"/i.test(f[2]);
  return { method: (attr(f[1], "method") || "get").toLowerCase(), action: attr(f[1], "action"), inputs, hasSubmit };
}

const fresh = () => harness({ rows: [{ user_id: USER, neural: blobFor(Date.now() - 864e5) }] });
const untouched = (h, why) => {
  assert.equal(h.calls.length, 0, why + " — it reached Supabase");
  assert.equal(h.state.suppress.length, 0, why);
  assert.equal(h.state.rows[0].neural.settings.emailDigest, true, why + " — the blob was written");
};

test("(a) GET mutates nothing and answers a page whose only act is a form that POSTs back to the same signed URL", async () => {
  const h = fresh();
  const url = await unsubUrl(USER);
  const res = await withFetch(h.fetchImpl, () => onRequest({ request: new Request(url), env: h.env }));
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") || "", /text\/html/);
  untouched(h, "a GET is what prefetchers and scanners send");
  const html = await res.text();
  assert.ok(!/Unsubscribed\b/.test(html), "the GET page must not claim the unsubscribe happened");
  const form = formOf(html);
  assert.equal(form.method, "post", "a GET form would loop back to this page forever");
  assert.equal(new URL(form.action, url).href, url, "the form must post back to the SAME signed URL, token included");
  assert.ok(form.hasSubmit, "no submit control — the page is a dead end");
  assert.equal(form.inputs.filter(([n]) => n === "confirm").length, 1, "the page must carry its own marker exactly once");
});

test("(b) POST with the RFC 8058 body is the one-click path: urlencoded or multipart, it unsubscribes and never redirects", async () => {
  const multipart = (url) => {
    const fd = new FormData();
    fd.append("List-Unsubscribe", "One-Click");
    return new Request(url, { method: "POST", body: fd });
  };
  for (const [label, mk] of [["urlencoded", oneClick], ["multipart", multipart]]) {
    const h = fresh();
    const res = await withFetch(h.fetchImpl, async () => onRequest({ request: mk(await unsubUrl(USER)), env: h.env }));
    assert.equal(res.status, 200, label + ": RFC 8058 §3.1 forbids a redirect, and 200 is what the receiver reads as done");
    assert.equal(h.state.suppress.length, 1, label + ": the receiver's one-click must be honoured");
    assert.equal(h.state.rows[0].neural.settings.emailDigest, false, label + ": the blob half must still run");
    const html = await res.text();
    assert.ok(/Unsubscribed\b/.test(html), label + ": the done page must say so");
    assert.ok(!/<form\b/i.test(html), label + ": done means done — no second ask");
  }
});

test("(c) a POST without the RFC 8058 body — a scanner's — does not unsubscribe, and neither does any other method", async () => {
  const url = await unsubUrl(USER);
  const form = { "content-type": "application/x-www-form-urlencoded" };
  const posts = {
    "no body": new Request(url, { method: "POST" }),
    "another key": new Request(url, { method: "POST", headers: form, body: "unsubscribe=1" }),
    "another value": new Request(url, { method: "POST", headers: form, body: "List-Unsubscribe=Yes" }),
    "the page's marker saying no": new Request(url, { method: "POST", headers: form, body: "confirm=0" }),
    "the marker in the query, not the body": new Request(url + "&List-Unsubscribe=One-Click", { method: "POST" }),
    "a JSON body, which is not a form": new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ "List-Unsubscribe": "One-Click" }) }),
  };
  for (const [label, req] of Object.entries(posts)) {
    const h = fresh();
    const res = await withFetch(h.fetchImpl, () => onRequest({ request: req, env: h.env }));
    untouched(h, "POST with " + label);
    assert.equal(res.status, 200, label + ": not an error — a human whose client did this still needs a way through");
    assert.ok(formOf(await res.text()).hasSubmit, label + ": and that way is the confirm button");
  }
  for (const method of ["PUT", "DELETE", "PATCH"]) {
    const h = fresh();
    const res = await withFetch(h.fetchImpl, () => onRequest({ request: new Request(url, { method }), env: h.env }));
    untouched(h, method);
    assert.equal(res.status, 405, method + " is not a way to unsubscribe");
  }
  {
    const h = fresh();   // HEAD is what a link checker sends first; it is a GET without the body
    const res = await withFetch(h.fetchImpl, () => onRequest({ request: new Request(url, { method: "HEAD" }), env: h.env }));
    untouched(h, "HEAD");
    assert.equal(res.status, 200);
  }
});

test("(d) the confirm page's own button works — its form, submitted as a browser would, unsubscribes", async () => {
  const h = fresh();
  const url = await unsubUrl(USER);
  const page = await withFetch(h.fetchImpl, () => onRequest({ request: new Request(url), env: h.env }));
  const form = formOf(await page.text());
  untouched(h, "rendering the page");
  // exactly what a browser sends for <form method=post>: the inputs, urlencoded, to the action
  const submit = new Request(new URL(form.action, url).href, {
    method: form.method.toUpperCase(),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form.inputs).toString(),
  });
  const res = await withFetch(h.fetchImpl, () => onRequest({ request: submit, env: h.env }));
  assert.equal(res.status, 200);
  assert.equal(h.state.suppress.length, 1, "the confirm button is a dead end — the page's own marker is not honoured");
  assert.equal(h.state.rows[0].neural.settings.emailDigest, false, "the blob half must run on the confirm path too");
  assert.ok(!/<form\b/i.test(await res.text()), "after confirming, no second ask");
});

test("(e) a forged token changes nothing on either method — GET, one-click POST, confirm POST, and a real token for the wrong user", async () => {
  const confirmPost = (u) => new Request(u, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "confirm=1" });
  const other = "https://bjjgraph.org/unsubscribe?u=" + USER + "&t=" + (await tokenFor("99999999-8888-7777-6666-555555555555"));
  const cases = [
    ["GET, wrong token", new Request(BAD_URL)],
    ["one-click, wrong token", oneClick(BAD_URL)],
    ["confirm, wrong token", confirmPost(BAD_URL)],
    ["one-click, another user's real token", oneClick(other)],
  ];
  for (const [label, req] of cases) {
    const h = fresh();
    const res = await withFetch(h.fetchImpl, () => onRequest({ request: req, env: h.env }));
    assert.equal(res.status, 400, label);
    untouched(h, label);
    assert.ok(!/<form\b/i.test(await res.text()), label + ": a forged link is not offered a button either");
  }
});

test("(f) every response — confirm page, done page, refusal, wrong method — carries the same six security headers", async () => {
  const h = fresh();
  const url = await unsubUrl(USER);
  const responses = await withFetch(h.fetchImpl, async () => [
    await onRequest({ request: new Request(url), env: h.env }),
    await onRequest({ request: oneClick(url), env: h.env }),
    await onRequest({ request: new Request(url, { method: "PUT" }), env: h.env }),
    await onRequest({ request: new Request(BAD_URL), env: h.env }),
  ]);
  assert.deepEqual(responses.map((r) => r.status), [200, 200, 405, 400]);
  // `_headers` /* never applies to a Function response, and check_headers_cache can only read
  // the declared block — whether it is WRITTEN into each response is what this pins.
  for (const name of SECURITY_HEADERS) {
    const vals = responses.map((r) => r.headers.get(name));
    assert.ok(vals[0], name + " is missing from the confirm page");
    assert.ok(vals.every((v) => v === vals[0]), name + " differs across responses: " + JSON.stringify(vals));
  }
});

// ── the re-subscribe half ───────────────────────────────────────────────────────────────

test("a legacy suppression (blob never turned off) keeps blocking — no deploy-day resurrection", async () => {
  const optIn = Date.now() - 7 * 864e5;          // opted in a week ago
  const h = harness({
    rows: [{ user_id: USER, neural: blobFor(optIn) }],
    suppress: [{ user_id: USER, at: iso(Date.now() - 2 * 864e5) }], // unsubscribed two days ago
  });
  const out = await withFetch(h.fetchImpl, () => runDigest(h.env));
  assert.equal(h.mails.length, 0, "this user unsubscribed and never re-opted-in");
  assert.equal(out.sent, 0);
  assert.equal(h.state.suppress.length, 1, "the row must survive");
});

test("turning it back on in Settings after unsubscribing resumes, and clears the row", async () => {
  const h = harness({
    rows: [{ user_id: USER, neural: blobFor(Date.now() - 36e5) }],   // re-opted-in an hour ago
    suppress: [{ user_id: USER, at: iso(Date.now() - 2 * 864e5) }],  // unsubscribed two days ago
  });
  const out = await withFetch(h.fetchImpl, () => runDigest(h.env));
  assert.equal(h.mails.length, 1, "the page promises Settings can turn it back on");
  assert.equal(out.sent, 1);
  assert.equal(h.state.suppress.length, 0, "a lifted suppression must not linger and re-block tomorrow");
});

test("a future-dated opt-in stamp is refused — a fast clock cannot re-subscribe anyone", async () => {
  const h = harness({
    rows: [{ user_id: USER, neural: blobFor(Date.now() + 30 * 864e5) }], // clock 30 days ahead
    suppress: [{ user_id: USER, at: iso(Date.now() - 864e5) }],
  });
  const out = await withFetch(h.fetchImpl, () => runDigest(h.env));
  assert.equal(h.mails.length, 0, "an impossible stamp is not evidence of consent");
  assert.equal(out.sent, 0);
  assert.equal(h.state.suppress.length, 1);
});

test("an ordinary opted-in user with no suppression is unaffected", async () => {
  const h = harness({ rows: [{ user_id: USER, neural: blobFor(Date.now() - 864e5) }] });
  const out = await withFetch(h.fetchImpl, () => runDigest(h.env));
  assert.equal(h.mails.length, 1);
  assert.equal(out.sent, 1);
  assert.equal(h.state.sent.length, 1, "and the per-day dedupe row is written");
});

// ── the envelope ────────────────────────────────────────────────────────────────────────

test("the mail carries From, Reply-To and a one-click List-Unsubscribe", async () => {
  const h = harness({ rows: [{ user_id: USER, neural: blobFor(Date.now() - 864e5) }] });
  await withFetch(h.fetchImpl, () => runDigest(h.env));
  assert.equal(h.mails.length, 1);
  const m = h.mails[0];

  assert.equal(m.from, "coach@bjjgraph.org", "From must stay the human mailbox");
  // CAMELCASE. The REST API spells this `reply_to`; on the binding an unknown key is ignored
  // and the mail still sends, so the wrong spelling drops the header with nothing going red.
  assert.equal(m.replyTo, "coach@bjjgraph.org", "Reply-To missing or spelled the REST way");
  assert.ok(!("reply_to" in m), "reply_to is the REST spelling — the binding will ignore it");

  // RFC 8058: the URL goes in angle brackets, and the Post header is what makes it one click.
  assert.ok(m.headers, "no headers object — the provider's own unsubscribe button stays dumb");
  assert.equal(m.headers["List-Unsubscribe"], "<" + UNSUB_OF(m) + ">",
    "List-Unsubscribe must carry the same signed URL as the body link");
  assert.equal(m.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
});

/** The signed unsubscribe URL the body actually shipped — read back out of the mail, so the
 *  header and the body link cannot drift apart. */
function UNSUB_OF(mail) {
  const m = /(https:\/\/bjjgraph\.org\/unsubscribe\?u=[^"\s<]+)/.exec(mail.text);
  assert.ok(m, "the plaintext body lost its unsubscribe URL");
  return m[1];
}
