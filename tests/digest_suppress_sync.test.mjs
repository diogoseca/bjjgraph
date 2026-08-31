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

const unsubRequest = async (userId) =>
  new Request("https://bjjgraph.org/unsubscribe?u=" + userId + "&t=" + (await tokenFor(userId)));

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
