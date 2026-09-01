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
import worker, { runDigest, MAX_SENDS_PER_RUN, MANIFEST_MIN_DECKS, MANIFEST_URL } from "../workers/digest/index.js";
import { onRequest } from "../functions/unsubscribe.js";
import { byId } from "../workers/digest/fixtures.js";
import { safeEqual } from "../workers/digest/safe-equal.js";

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
 * THE DECK MANIFEST THE DOUBLE SERVES. The Worker allow-lists every deck key against the
 * public `flashcards/_index.json` and refuses to run below MANIFEST_MIN_DECKS, so the double
 * carries a plausible one: the keys the fixtures name, padded with generated real-shaped keys
 * past the floor. `REAL` is the set a mail may name — the assertions read it, never a copy.
 */
const REAL_KEYS = ["Mount|Top", "Mount|Bottom", "Guard|Bottom", "Kimura|Attacker", "Half Guard|Bottom", "Closed Guard|Bottom"];
const manifestOf = (n = MANIFEST_MIN_DECKS + 200) => {
  const decks = {};
  for (const k of REAL_KEYS) decks[k] = ["Position", 8];
  for (let i = 0; Object.keys(decks).length < n; i++) decks["Deck " + i + (i % 2 ? "|Top" : "|Bottom")] = ["Position", 4];
  return { _meta: { format: 3 }, decks, shared: {} };
};
const REAL = new Set(Object.keys(manifestOf().decks));

/** `key=eq.value` filters out of a PostgREST query string, applied to rows. */
const eqFilters = (qs) => [...qs.matchAll(/(?:^|[?&])([A-Za-z_]+)=eq\.([^&]*)/g)].map((m) => [m[1], decodeURIComponent(m[2])]);
const applyEq = (rows, qs) => eqFilters(qs).reduce((acc, [k, v]) => acc.filter((r) => String(r[k]) === v), rows);

/**
 * A PostgREST + Email double. Records every call so the assertions can read what the code
 * actually DID, not what it returned (§6.3: assert on what was emitted).
 *
 * What it models, because the Worker's claims depend on it (v1.164.2):
 *   · `select=` PROJECTION on the rows query — `alias:neural->key` becomes `alias`, a bare
 *     `neural` is the whole blob — so a test can see WHICH paths the Worker asked for;
 *   · `key=eq.value` filters on every table, and the opt-in filter on the rows query;
 *   · `Range` + `Prefer: count=exact` → `Content-Range: from-to/total` (`* /0` when empty,
 *     `/ *` when the count was not asked for), 206 for a partial page — PostgREST's contract;
 *   · `Prefer: resolution=merge-duplicates` on digest_suppress: an upsert on user_id that
 *     REPLACES the row's fields with the body's, `at` defaulting to now like the column does;
 *   · the public manifest, and the content-chunk miss;
 *   · `fail` — a set of table names whose GET answers 500, so a read can be made to fail.
 */
function harness({ rows = [], suppress = [], sent = [], manifest = manifestOf(), fail = new Set(), odd = new Set(), maxRows = 1000, emailOf = null } = {}) {
  const calls = [];
  const state = { rows: JSON.parse(JSON.stringify(rows)), suppress: [...suppress], sent: [...sent] };
  const mails = [];
  const json = (body, status = 200, headers = {}) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
  const hdr = (init, name) => {
    const h = init.headers || {};
    const k = Object.keys(h).find((x) => x.toLowerCase() === name);
    return k ? String(h[k]) : "";
  };

  const fetchImpl = async (url, init = {}) => {
    const u = String(url);
    const method = (init.method || "GET").toUpperCase();
    calls.push({ method, url: u, body: init.body ? JSON.parse(init.body) : null, headers: init.headers || {} });

    if (u === MANIFEST_URL) return manifest ? json(manifest) : new Response("", { status: 404 });
    // the public content chunk the magazine section tries — a miss is a supported path
    if (u.startsWith("https://bjjgraph.org/")) return new Response("", { status: 404 });

    const path = u.slice(SB.length);
    const table = (/^\/rest\/v1\/([a-z_]+)/.exec(path) || [])[1];
    if (method === "GET" && table && fail.has(table)) return new Response("boom", { status: 500 });
    // a 200 whose body is not a row set — a gateway's JSON error page, a misrouted request
    if (method === "GET" && table && odd.has(table)) return json({ message: "not rows" });

    if (path.startsWith("/rest/v1/user_training_data")) {
      if (method === "GET") {
        const qs = new URL(u).searchParams;
        let out = state.rows;
        if (qs.get("neural->settings->>emailDigest") === "eq.true")
          out = out.filter((r) => r.neural && r.neural.settings && r.neural.settings.emailDigest === true);
        out = applyEq(out, path);
        if (/order=user_id\.asc/.test(path)) out = [...out].sort((a, b) => (a.user_id < b.user_id ? -1 : 1));
        const sel = (qs.get("select") || "*").split(",");
        out = out.map((r) => {
          if (sel.includes("*")) return r;
          const o = {};
          for (const item of sel) {
            const [alias, pathExpr] = item.includes(":") ? item.split(":") : [item.split("->").pop(), item];
            if (pathExpr === "user_id") o.user_id = r.user_id;
            else if (pathExpr === "neural") o.neural = r.neural;
            else if (pathExpr.startsWith("neural->")) o[alias] = r.neural && r.neural[pathExpr.slice(8)] !== undefined ? r.neural[pathExpr.slice(8)] : null;
          }
          return o;
        });
        const range = /^(\d+)-(\d+)$/.exec(hdr(init, "range"));
        const exact = /count=exact/.test(hdr(init, "prefer"));
        const total = out.length;
        let from = 0, to = Math.min(total, maxRows) - 1;
        if (range) { from = Number(range[1]); to = Math.min(Number(range[2]), from + maxRows - 1, total - 1); }
        const page = out.slice(from, to + 1);
        const cr = page.length ? from + "-" + (from + page.length - 1) + "/" + (exact ? total : "*") : "*/" + (exact ? total : "*");
        return json(page, page.length && from + page.length < total ? 206 : 200, { "content-range": cr });
      }
      if (method === "PATCH") {
        const id = /user_id=eq\.([^&]+)/.exec(path);
        const row = state.rows.find((r) => r.user_id === (id && id[1]));
        if (row && init.body) Object.assign(row, JSON.parse(init.body));
        return new Response(null, { status: 204 });
      }
    }
    if (path.startsWith("/rest/v1/digest_suppress")) {
      if (method === "GET") return json(applyEq(state.suppress, path));
      if (method === "POST") {
        const body = JSON.parse(init.body);
        const row = { at: iso(Date.now()), ...body };
        const i = state.suppress.findIndex((s) => s.user_id === body.user_id);
        if (i < 0) state.suppress.push(row);
        else if (/merge-duplicates/.test(hdr(init, "prefer"))) state.suppress[i] = { ...state.suppress[i], ...body };
        else return new Response("duplicate key", { status: 409 });
        return new Response(null, { status: 201 });
      }
      if (method === "DELETE") {
        const id = /user_id=eq\.([^&]+)/.exec(path);
        state.suppress = state.suppress.filter((s) => s.user_id !== (id && id[1]));
        return new Response(null, { status: 204 });
      }
    }
    if (path.startsWith("/rest/v1/digest_sent")) {
      if (method === "GET") return json(applyEq(state.sent, path));
      if (method === "POST") { state.sent.push(JSON.parse(init.body)); return new Response(null, { status: 201 }); }
    }
    if (path.startsWith("/auth/v1/admin/users/")) {
      const id = path.slice("/auth/v1/admin/users/".length);
      return json({ email: emailOf ? emailOf(id) : "player+" + id.replace(/-/g, "") + "@example.test" });
    }
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

// ── the blob is hostile input (v1.164.2) ───────────────────────────────────────────────
//
// THE FINDING (verified live 2026-09-01): signup is open, auto-confirmed and uncaptcha'd, the
// `neural` blob is owner-writable under a policy that checks no shape, and this Worker mailed
// whatever the blob said — subject, <h1> and score line — DKIM-signed, From coach@bjjgraph.org,
// to whatever address the row's owner had signed up with. The signup half is the owner's call.
// This half: NOTHING read from a blob reaches a mail unchanged, and a run that cannot verify
// something sends nothing that run. Every claim below drives the real `runDigest` against the
// double and reads the mail it emitted — never a re-implementation of the coercion.
//
// Mutants (v1.164.2): 38 run against index.js, unsubscribe.js and safe-equal.js, 32 killed,
// each test naming the mutant it kills in its own comment. SIX NON-KILLS, so nobody reads
// them as covered:
//   · `duplicate_row` (a second row for one user_id) cannot happen — UNIQUE on user_id — so
//     the explicit `sentUsers` check is unobservable here and stands as belt-and-braces;
//   · CAP.weak (4) is unobservable: the renderer reads two weak spots, so a fifth never prints;
//     the cap bounds the digest object, nothing else;
//   · CAP.keyLen (120) is redundant with the allow-list for any key the manifest does not
//     hold; it exists so `allow.has()` never hashes a megabyte;
//   · `safeEqual` in place of `===` on the trigger bearer AND on the Function's token is
//     functionally identical — timing is not something `node --test` can see; the helper's
//     own test pins its arithmetic (the length term IS killable: "a\0" vs "a");
//   · `safeEqual` looping to the shorter length rather than the longer is equivalent while
//     the length term stands — again timing, again unobservable here.
// Not mutated, by reasoning: the delta clamp (±100) cannot trip while both scores are
// clamped to 0..100.

/** The fixture's hostile blob with its day placeholders bound to a date the Worker will mail. */
const hostileBlob = (optInAt = Date.now() - 864e5) => {
  const b = JSON.parse(JSON.stringify(byId("hostile-numbers").blob).split("%DAY%").join(YESTERDAY));
  b.settingsAt = { emailDigest: optInAt };
  return b;
};
/** Every string a blob carries, keys included — the set no output may contain. */
const stringsIn = (v, out = []) => {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => stringsIn(x, out));
  else if (v && typeof v === "object") for (const k of Object.keys(v)) { out.push(k); stringsIn(v[k], out); }
  return out;
};
/** Every deck key a mail names, read back out of its plaintext — the "What you reviewed" and
 *  weak-spot lines are the only places a key is printed, via prettyKey. */
const decksNamed = (mail) =>
  [...mail.text.matchAll(/^\s+· (.+)$|^Weak spot: (.+)$|^\s+And one for the road: (.+)$/gm)].map((m) => m[1] || m[2] || m[3]);
const prettyToKey = (p) => {
  const m = /^(.*) \((attacking|top|bottom|defender)\)$/.exec(p);
  return m ? m[1] + "|" + { attacking: "Attacker", top: "Top", bottom: "Bottom", defender: "Defender" }[m[2]] : p;
};

test("a hostile blob mails only what the manifest knows, and no attacker string reaches subject, bodies, headers or address", async () => {
  const h = harness({ rows: [{ user_id: USER, neural: hostileBlob() }] });
  const out = await withFetch(h.fetchImpl, () => runDigest(h.env));
  assert.equal(h.mails.length, 1, "a salvageable blob (real decks among the fakes, a score that parses) is still mailed");
  assert.equal(out.sent, 1);
  const m = h.mails[0];
  const everywhere = m.subject + "\n" + m.html + "\n" + m.text + "\n" + JSON.stringify(m.headers) + "\n" + m.to;

  // kills: drop the manifest allow-list in `keys` (the fake keys are then named)
  const named = decksNamed(m).map(prettyToKey);
  assert.ok(named.length >= 2, "the mail names no decks at all — the allow-list ate the real ones too");
  for (const k of named) assert.ok(REAL.has(k), "the mail names a deck the manifest does not list: " + JSON.stringify(k));
  assert.deepEqual(named.slice(0, 2), ["Mount|Top", "Kimura|Attacker"], "the real techniques, in the blob's order");
  // the weak spot: `w` is [n, word, ...keys]; the fakes drop, the real ones stay, capped at 4
  assert.ok(m.text.includes("Weak spot: Guard (bottom)"), "the first REAL weak spot is the one named");
  assert.ok(m.text.includes("And one for the road: Mount (top)"), "and the second");

  // kills: drop any one coercion — the blob's own strings, keys included, must appear nowhere
  const raw = stringsIn(byId("hostile-numbers").blob).filter((x) => /[<>"'\r\n]/.test(x) || x.length > 120);
  assert.ok(raw.length >= 6, "the fixture must carry hostile strings for this to test anything");
  for (const x of raw) assert.ok(!everywhere.includes(x), "an attacker string reached the mail: " + JSON.stringify(x.slice(0, 40)));
  assert.ok(!/[\r\n]/.test(m.subject), "CR/LF in the subject");
  assert.ok(!/\r/.test(m.text), "CR in the plaintext body");
  for (const v of Object.values(m.headers)) assert.ok(!/[\r\n]/.test(v), "CR/LF in a header");

  // kills: drop `num` on count (the "9e99" reads as 9e99 cards), on score (" 41.5 " is trimmed
  // and parsed), or the CAP.count clamp
  assert.ok(m.subject.endsWith(", 41.5%"), "the score must be the parsed number: " + m.subject);
  assert.ok(m.text.includes("10000 cards · 2 techniques"), "count must be clamped to the cap, techniques to the real ones: " + m.text.split("\n")[1]);
  // kills: drop `byDay` — the "2026-08-30<script>" day (score 99) would be the latest day
  assert.ok(!m.text.includes("99%"), "a day whose key is not a date was mailed");
  // the streak and the delta are computed over the clean days only; the 1999 entry's "1e309"
  // is not finite, so it is not a previous score — kills: coerce `s` to 0 instead of null
  assert.ok(!/% today\)/.test(m.text), "a delta was computed against a non-finite previous score: " + m.text);
  assert.ok(out.capped >= 8, "the run must count the caps it applied (" + out.capped + ")");
});

test("a blob whose score is not a number is skipped by name, not mailed with a placeholder", async () => {
  for (const bad of ["41.5<b>", "", " ", "Infinity", "NaN", true, [41.5], { s: 41.5 }, null]) {
    const b = hostileBlob();
    b.dayLog[YESTERDAY].s = bad;
    const h = harness({ rows: [{ user_id: USER, neural: b }] });
    const out = await withFetch(h.fetchImpl, () => runDigest(h.env));
    // kills: coerce NaN to 0 in `num`; drop the `bad_score` skip; let `Number("")` (0) through
    assert.equal(h.mails.length, 0, "fail closed: a score that does not parse is not a mail: " + JSON.stringify(bad));
    assert.deepEqual(out.skipped, { bad_score: 1 }, JSON.stringify(bad));
    assert.equal(out.sent, 0);
  }
});

test("a blob with no real deck on any day is not an active day", async () => {
  const b = hostileBlob();
  b.dayLog[YESTERDAY].k = ["<script>|Top", "Nope|Bottom"];
  b.dayLog["1999-01-01"].k = ["Fake|Top"];
  const h = harness({ rows: [{ user_id: USER, neural: b }] });
  const out = await withFetch(h.fetchImpl, () => runDigest(h.env));
  assert.equal(h.mails.length, 0);
  assert.deepEqual(out.skipped, { no_valid_day: 1 });
});

test("caps: forty-one techniques mail forty, a 500-character key is dropped, and the weak list stops at four", async () => {
  const b = blobFor(Date.now() - 864e5);
  const keys = Object.keys(manifestOf().decks);
  b.dayLog[YESTERDAY].k = keys.slice(0, 41);
  b.dayLog[YESTERDAY].w = [1, "thin", ...keys.slice(0, 6)];
  const h = harness({ rows: [{ user_id: USER, neural: b }] });
  await withFetch(h.fetchImpl, () => runDigest(h.env));
  assert.equal(h.mails.length, 1);
  // kills: drop CAP.techniques (41 techniques). CAP.weak is a recorded non-kill (header above).
  assert.ok(h.mails[0].text.includes("40 techniques"), h.mails[0].text.split("\n")[1]);
  assert.match(h.mails[0].subject, /40 techniques/);
});

test("the rows query asks for the four blob paths, never the whole blob", async () => {
  const h = harness({ rows: [{ user_id: USER, neural: blobFor(Date.now() - 864e5) }] });
  await withFetch(h.fetchImpl, () => runDigest(h.env));
  const q = h.calls.find((c) => c.method === "GET" && c.url.includes("/rest/v1/user_training_data"));
  assert.ok(q, "no rows query");
  const sel = new URL(q.url).searchParams.get("select").split(",");
  // kills: `select=user_id,neural`
  assert.ok(!sel.includes("neural") && !sel.includes("*"), "the whole blob is on the wire: " + sel.join(","));
  for (const p of ["neural->settings", "neural->settingsAt", "neural->dayLog", "neural->days"])
    assert.ok(sel.some((x) => x.endsWith(p)), "the query lost " + p);
  assert.ok(new URL(q.url).searchParams.get("order"), "a paginated query needs a stable order");
});

// ── fail-closed reads ───────────────────────────────────────────────────────────────────

test("a failed suppress read is a user NOT mailed — zero sends, a failure that names the read", async () => {
  const h = harness({
    rows: [{ user_id: USER, neural: blobFor(Date.now() - 864e5) }, { user_id: "22222222-2222-3222-8222-222222222222", neural: blobFor(Date.now() - 864e5) }],
    fail: new Set(["digest_suppress"]),
  });
  const out = await withFetch(h.fetchImpl, () => runDigest(h.env));
  // kills: restore `.catch(() => [])` on the suppress read
  assert.equal(h.mails.length, 0, "an outage on the suppression table must never read as 'nobody is suppressed'");
  assert.equal(out.sent, 0);
  assert.equal(out.failures.length, 2, "both users must be failures, not skips");
  assert.match(out.failures[0], /digest_suppress/);
  assert.equal(h.state.sent.length, 0, "and no dedupe row is written for a mail that did not go");
});

test("a 200 that is not a row set is a failed read too — an object where rows were expected mails nobody", async () => {
  for (const table of ["digest_suppress", "digest_sent"]) {
    const h = harness({ rows: [{ user_id: USER, neural: blobFor(Date.now() - 864e5) }], odd: new Set([table]) });
    const out = await withFetch(h.fetchImpl, () => runDigest(h.env));
    // kills: `return rows || []` in sbRows
    assert.equal(h.mails.length, 0, table);
    assert.match(out.failures[0] || "", /not a row set/, table);
  }
});

test("a failed dedupe read is the same — no mail, a named failure", async () => {
  const h = harness({ rows: [{ user_id: USER, neural: blobFor(Date.now() - 864e5) }], fail: new Set(["digest_sent"]) });
  const out = await withFetch(h.fetchImpl, () => runDigest(h.env));
  // kills: restore `.catch(() => [])` on the sent read
  assert.equal(h.mails.length, 0);
  assert.match(out.failures[0], /digest_sent/);
});

test("no manifest, no run: a 404 and an implausibly small manifest both throw before any row is read", async () => {
  for (const [label, manifest] of [["404", null], ["too small", manifestOf(MANIFEST_MIN_DECKS - 1)], ["wrong shape", { decks: "nope" }]]) {
    const h = harness({ rows: [{ user_id: USER, neural: blobFor(Date.now() - 864e5) }], manifest });
    // kills: drop the floor; swallow the manifest error; fetch the manifest after the rows
    await assert.rejects(withFetch(h.fetchImpl, () => runDigest(h.env)), /manifest/, label + ": the run must refuse");
    assert.equal(h.mails.length, 0, label);
    assert.ok(!h.calls.some((c) => c.url.includes("/rest/v1/")), label + ": nothing at Supabase may be read on a run that cannot verify deck names");
  }
});

test("the rows query is paginated and the count is asserted: 1,500 opt-ins are all evaluated, a count the pages do not add up to is a throw", async () => {
  const rows = Array.from({ length: 1500 }, (_, i) =>
    ({ user_id: "00000000-0000-4000-8000-" + String(i).padStart(12, "0"), neural: blobFor(Date.now() - 864e5) }));
  const h = harness({ rows });
  const out = await withFetch(h.fetchImpl, () => runDigest(h.env, { send: false }));
  // kills: drop the pagination loop (1,000 evaluated), drop `Prefer: count=exact`
  assert.equal(out.rows, 1500, "PostgREST serves 1,000 per request; the run must page");
  assert.equal(out.would_send, 1500);
  const pages = h.calls.filter((c) => c.method === "GET" && c.url.includes("/rest/v1/user_training_data"));
  assert.equal(pages.length, 2, "two Range requests for 1,500 rows");

  // a server that will not give an exact count — the run must not guess
  const noCount = harness({ rows: rows.slice(0, 3) });
  const inner = noCount.fetchImpl;
  noCount.fetchImpl = (url, init = {}) => {
    if (String(url).includes("/rest/v1/user_training_data")) {
      const h2 = { ...(init.headers || {}) };
      for (const k of Object.keys(h2)) if (k.toLowerCase() === "prefer") delete h2[k];
      return inner(url, { ...init, headers: h2 });
    }
    return inner(url, init);
  };
  // kills: accept a `*` total
  await assert.rejects(withFetch(noCount.fetchImpl, () => runDigest(noCount.env)), /exact count/);
  assert.equal(noCount.mails.length, 0);
});

// ── the ceiling ─────────────────────────────────────────────────────────────────────────

test("the ceiling: one more eligible user than the ceiling sends exactly the ceiling, and says so loudly", async () => {
  const N = MAX_SENDS_PER_RUN + 1;
  const rows = Array.from({ length: N }, (_, i) =>
    ({ user_id: "00000000-0000-4000-8000-" + String(i).padStart(12, "0"), neural: blobFor(Date.now() - 864e5) }));
  const h = harness({ rows });
  const errors = [];
  const realError = console.error;
  console.error = (...a) => errors.push(a.join(" "));
  let out;
  try { out = await withFetch(h.fetchImpl, () => runDigest(h.env)); } finally { console.error = realError; }
  // kills: drop the ceiling; count deferred as 0; log with console.log instead of error
  assert.equal(h.mails.length, MAX_SENDS_PER_RUN, "exactly the ceiling, not one more");
  assert.equal(out.sent, MAX_SENDS_PER_RUN);
  assert.equal(out.deferred, 1);
  assert.equal(h.state.sent.length, MAX_SENDS_PER_RUN, "a dedupe row per mail sent, none for the deferred");
  const entry = out.failures.find((f) => /ceiling/.test(f));
  assert.ok(entry && /\b1 rows? left/.test(entry), "failures must name how many were deferred: " + JSON.stringify(out.failures));
  assert.ok(errors.some((e) => /CEILING/.test(e)), "the ceiling must be logged loudly (console.error), got: " + JSON.stringify(errors));
  assert.equal(MAX_SENDS_PER_RUN, 200, "the ceiling is a documented constant — change it in its own commit");
  // one send per user per run, explicit: every recipient distinct
  assert.equal(new Set(h.mails.map((m) => m.to)).size, h.mails.length);
});

test("an address the Worker cannot vouch for is a skip, never a To: header", async () => {
  for (const [label, email] of [["CR LF", "x@y.test\r\nBcc: z@w.test"], ["no @", "nobody"], ["empty", ""], ["null", null], ["space", "a b@y.test"]]) {
    const h = harness({ rows: [{ user_id: USER, neural: blobFor(Date.now() - 864e5) }], emailOf: () => email });
    const out = await withFetch(h.fetchImpl, () => runDigest(h.env));
    // kills: drop EMAIL_RE
    assert.equal(h.mails.length, 0, label);
    assert.deepEqual(out.skipped, { no_email: 1 }, label);
  }
});

test("a row whose user_id is not a UUID is skipped before any read — it would otherwise be spliced into three URLs", async () => {
  const h = harness({ rows: [{ user_id: "not-a-uuid/../../x", neural: blobFor(Date.now() - 864e5) }] });
  const out = await withFetch(h.fetchImpl, () => runDigest(h.env));
  // kills: drop UUID_RE on row.user_id
  assert.equal(h.mails.length, 0);
  assert.deepEqual(out.skipped, { bad_user_id: 1 });
  assert.ok(!h.calls.some((c) => c.url.includes("not-a-uuid")), "the id reached a URL");
});

test("the streak is clamped: 3,700 consecutive days mail 3650", async () => {
  const b = blobFor(Date.now() - 864e5);
  b.days = {};
  for (let i = 0; i < 3700; i++) b.days[iso(Date.parse(YESTERDAY) - i * 864e5).slice(0, 10)] = 1;
  const h = harness({ rows: [{ user_id: USER, neural: b }] });
  await withFetch(h.fetchImpl, () => runDigest(h.env));
  // kills: drop CAP.streak
  assert.equal(h.mails.length, 1);
  assert.ok(h.mails[0].text.includes("3650 training days in a row"), h.mails[0].text);
});

test("already mailed and still-in-progress days are skips by name", async () => {
  const a = harness({ rows: [{ user_id: USER, neural: blobFor(Date.now() - 864e5) }], sent: [{ user_id: USER, day: YESTERDAY }] });
  const outA = await withFetch(a.fetchImpl, () => runDigest(a.env));
  assert.equal(a.mails.length, 0);
  assert.deepEqual(outA.skipped, { already_sent: 1 });
  assert.equal(outA.sent_rows_seen, 1, "the dedupe row the run read is counted");

  const today = iso(Date.now()).slice(0, 10);
  const b = blobFor(Date.now() - 864e5);
  b.days = { [today]: 4 }; b.dayLog = { [today]: b.dayLog[YESTERDAY] };
  const t = harness({ rows: [{ user_id: USER, neural: b }] });
  const outT = await withFetch(t.fetchImpl, () => runDigest(t.env));
  assert.equal(t.mails.length, 0);
  assert.deepEqual(outT.skipped, { day_in_progress: 1 });
});

// ── the manual trigger (v1.164.2) ───────────────────────────────────────────────────────

const trigger = (h, qs = "", auth = "Bearer " + h.env.SUPABASE_SERVICE_ROLE_KEY) =>
  withFetch(h.fetchImpl, () => worker.fetch(new Request("https://digest.test/" + qs, { headers: auth ? { authorization: auth } : {} }), h.env));
const writes = (h) => h.calls.filter((c) => c.method !== "GET");
const two = () => harness({ rows: [
  { user_id: USER, neural: blobFor(Date.now() - 864e5) },
  { user_id: "22222222-2222-4222-8222-222222222222", neural: blobFor(Date.now() - 864e5) },
] });

test("trigger: a bare GET is a DRY RUN — every digest built, nothing sent, nothing written, a sample returned", async () => {
  const h = two();
  const res = await trigger(h);
  assert.equal(res.status, 200);
  const body = await res.json();
  // kills: send by default; write the dedupe row on a dry run
  assert.equal(h.mails.length, 0, "a dry run must not send");
  assert.equal(writes(h).length, 0, "a dry run must not write: " + JSON.stringify(writes(h).map((c) => c.method + " " + c.url)));
  assert.equal(body.would_send, 2);
  assert.equal(body.sent, 0);
  assert.equal(body.mode, "dry-run");
  assert.equal(body.sample.length, 2);
  for (const s of body.sample) {
    assert.equal(s.user_id_prefix.length, 8, "the sample carries an 8-character prefix, never the id");
    assert.match(s.subject, /^Today at BJJGraph: /);
    assert.match(s.text, /TODAY AT BJJGRAPH/);
    assert.ok(!("html" in s), "the sample is subject + text, not the HTML");
  }
});

test("trigger: a dry run leaves a lifted suppression IN PLACE — the row is cleared only by a live send", async () => {
  const h = harness({
    rows: [{ user_id: USER, neural: blobFor(Date.now() - 36e5) }],
    suppress: [{ user_id: USER, at: iso(Date.now() - 2 * 864e5) }],
  });
  const body = await (await trigger(h)).json();
  // kills: DELETE the suppression as soon as the lift is detected
  assert.equal(body.would_send, 1, "the user re-opted-in, so a live run would mail them");
  assert.equal(h.state.suppress.length, 1, "but a dry run must not touch the row");
  assert.equal(writes(h).length, 0);
});

test("trigger: ?user= scopes the dry run to one user", async () => {
  const h = two();
  const body = await (await trigger(h, "?user=" + USER)).json();
  assert.equal(body.would_send, 1);
  assert.equal(body.sample[0].user_id_prefix, USER.slice(0, 8));
  assert.equal(h.mails.length, 0);
  const q = h.calls.find((c) => c.url.includes("/rest/v1/user_training_data"));
  assert.ok(q.url.includes("user_id=eq." + USER), "the scope must be in the query, not filtered after the read");
});

test("trigger: ?send=1 without ?user= is refused — a live send from the trigger is one person at a time", async () => {
  const h = two();
  const res = await trigger(h, "?send=1");
  // kills: allow a base-wide live send from the trigger
  assert.equal(res.status, 400);
  assert.equal(h.mails.length, 0);
  assert.equal(h.calls.length, 0, "refused before anything is read");
});

test("trigger: ?send=1&user=X sends exactly one, to X, and writes X's dedupe row", async () => {
  const h = two();
  const res = await trigger(h, "?send=1&user=" + USER);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(h.mails.length, 1);
  assert.equal(h.mails[0].to, "player+" + USER.replace(/-/g, "") + "@example.test");
  assert.equal(body.sent, 1);
  assert.equal(body.mode, "send-one");
  assert.deepEqual(h.state.sent.map((r) => r.user_id), [USER]);
});

test("trigger: a wrong or missing bearer is 401 and reaches nothing; a malformed ?user= is 400", async () => {
  for (const auth of ["Bearer wrong", "Bearer ", "", "Bearer service-role-test-ke", "Bearer service-role-test-keyx"]) {
    const h = two();
    const res = await trigger(h, "", auth);
    // kills: `===` → still 401 here, but see the safeEqual test; drop the auth check entirely
    assert.equal(res.status, 401, JSON.stringify(auth));
    assert.equal(h.calls.length, 0, "nothing may be read on a bad bearer");
    assert.equal(h.mails.length, 0);
  }
  const h = two();
  const res = await trigger(h, "?user=not-a-uuid");
  assert.equal(res.status, 400);
  assert.equal(h.calls.length, 0);
  // and no key configured is never "compare against 'Bearer undefined'"
  const bare = two();
  delete bare.env.SUPABASE_SERVICE_ROLE_KEY;
  assert.equal((await trigger(bare, "", "Bearer undefined")).status, 401);
});

test("trigger: a run that refuses (no manifest) answers 500 with the reason, and sends nothing", async () => {
  const h = harness({ rows: [{ user_id: USER, neural: blobFor(Date.now() - 864e5) }], manifest: null });
  const res = await trigger(h, "?send=1&user=" + USER);
  assert.equal(res.status, 500);
  assert.match((await res.json()).error, /manifest/);
  assert.equal(h.mails.length, 0);
});

// ── the run summary ─────────────────────────────────────────────────────────────────────

test("every run returns and logs one summary with every counter present, zero or not", async () => {
  const h = harness({
    rows: [{ user_id: USER, neural: blobFor(Date.now() - 864e5) }, { user_id: "22222222-2222-4222-8222-222222222222", neural: blobFor(Date.now() - 864e5) }],
    suppress: [{ user_id: "22222222-2222-4222-8222-222222222222", at: iso(Date.now() - 864e5) }],
  });
  const lines = [];
  const realLog = console.log;
  console.log = (...a) => lines.push(a.join(" "));
  let out;
  try { out = await withFetch(h.fetchImpl, () => runDigest(h.env)); } finally { console.log = realLog; }
  for (const k of ["mode", "rows", "manifest_decks", "suppress_rows_seen", "sent_rows_seen", "sent", "capped", "deferred", "skipped", "failures"])
    assert.ok(k in out, "summary lost " + k);
  assert.equal(out.rows, 2);
  assert.ok(out.manifest_decks >= MANIFEST_MIN_DECKS);
  assert.equal(out.suppress_rows_seen, 1, "the positive count of suppression rows the run actually read");
  assert.equal(out.sent, 1);
  assert.deepEqual(out.skipped, { suppressed: 1 });
  const line = lines.find((l) => /^\[digest\] run /.test(l));
  assert.ok(line, "no summary line logged: " + JSON.stringify(lines));
  for (const k of ["mode=cron", "rows=2", "manifest_decks=", "suppress_rows_seen=1", "sent_rows_seen=0", "sent=1", "capped=0", "deferred=0", 'skipped={"suppressed":1}', "failures=0"])
    assert.ok(line.includes(k), "summary line lost " + k + ": " + line);
  assert.ok(lines.some((l) => /^\[digest\] manifest decks: \d+/.test(l)), "the manifest coverage line");
});

// ── the Function: a repeat confirm refreshes `at` (v1.164.2) ───────────────────────────

test("unsubscribing twice refreshes the suppression's timestamp — the second stop is the one that counts", async () => {
  const h = harness({ rows: [{ user_id: USER, neural: blobFor(Date.now() - 864e5) }] });
  await withFetch(h.fetchImpl, async () => onRequest({ request: await unsubRequest(USER), env: h.env }));
  assert.equal(h.state.suppress.length, 1);
  h.state.suppress[0].at = iso(Date.now() - 3 * 864e5);   // as if the first stop were three days old
  await withFetch(h.fetchImpl, async () => onRequest({ request: await unsubRequest(USER), env: h.env }));
  // kills: upsert body `{user_id}` only (merge-duplicates then leaves the old `at`)
  assert.equal(h.state.suppress.length, 1, "still one row");
  assert.ok(Date.parse(h.state.suppress[0].at) > Date.now() - 6e4,
    "a repeat confirm must refresh `at` — otherwise a re-opt-in stamp between the two stops outranks the second one, and the Worker lifts a suppression the user just renewed");
  const post = h.calls.filter((c) => c.method === "POST" && c.url.includes("digest_suppress")).pop();
  assert.ok(post.body.at && /^\d{4}-\d{2}-\d{2}T/.test(post.body.at), "the body must carry `at`, the column default only fires on insert");
});

// ── the shared compare ──────────────────────────────────────────────────────────────────

test("safeEqual: equal is equal, and every way of differing is not — including a prefix, a suffix and a length-only difference", () => {
  assert.equal(safeEqual("Bearer abc", "Bearer abc"), true);
  assert.equal(safeEqual("", ""), true);
  assert.equal(safeEqual("ünïcödé", "ünïcödé"), true);
  // kills: compare only the shorter length; fold with `&&` and return early; drop the length term
  assert.equal(safeEqual("Bearer abc", "Bearer ab"), false, "a prefix is not equal");
  assert.equal(safeEqual("Bearer ab", "Bearer abc"), false, "a suffix is not equal");
  assert.equal(safeEqual("Bearer abc", "Bearer abd"), false, "a last-byte difference");
  assert.equal(safeEqual("Bearer abc", "Xearer abc"), false, "a first-byte difference");
  assert.equal(safeEqual("aa", "a\u0000"), false);
  // the case the length term exists for: zero-padding the shorter input makes "a\0" read as
  // "a" byte-for-byte — kills: drop `A.length ^ B.length`
  assert.equal(safeEqual("a\u0000", "a"), false, "a NUL suffix is not equal to nothing");
  assert.equal(safeEqual("a", "a\u0000"), false);
  assert.equal(safeEqual(undefined, "undefined"), true, "stringified, like `===` on a template — which is why the caller checks the key exists first");
});
