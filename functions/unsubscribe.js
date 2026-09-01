/**
 * Digest unsubscribe (v1.105.7; method-aware since v1.164.0) — the List-Unsubscribe target and
 * the body link, /unsubscribe?u=<user_id>&t=<hmac>. Verifies the HMAC (so an address can only
 * unsubscribe itself), then — ONLY for a request with a human behind it — writes
 * digest_suppress via the service key, TURNS THE BLOB'S OWN KEY OFF, and answers with a tiny
 * page.
 *
 * WHO IS BEHIND THE REQUEST. The signed URL is fetched by things that are not the recipient:
 * link prefetchers, corporate mail gateways and security scanners follow the body's <a href>
 * (GET), and `List-Unsubscribe-Post` invites mailbox providers — and any scanner imitating one
 * — to POST it. From v1.105.7 to v1.163.0 this Function never read `request.method`, so each
 * of those unsubscribed the recipient silently; the token is per-user, so the blast radius was
 * one recipient per scanned mail — a bug, not an emergency, and not a reason to leave it.
 * RFC 8058 §3.2 is the discriminator, and the RFC's own motivation is this exact failure
 * ("anti-spam software often fetches all resources in mail header fields automatically"):
 *   · POST whose FORM BODY carries `List-Unsubscribe=One-Click` — urlencoded or multipart, the
 *     two encodings the RFC names — is the receiver asserting its user pressed its button.
 *     Honoured. (§3.2: the receiver "MUST NOT perform a POST on the HTTPS URI without user
 *     consent"; the POST carries no cookies and no auth, so the URL itself is the capability.)
 *   · POST carrying `confirm=1` is the button on OUR page below. Honoured. A browser posts the
 *     form's inputs and the RFC marker is the receiver's word, not ours, so the page has its own.
 *   · anything else — GET, HEAD, a bare POST, a POST with the wrong body or a body that is not a
 *     form — MUTATES NOTHING and gets the confirm page, whose only act is that one button. So a
 *     scanner that does exactly what a mailbox provider does, minus the body, changes nothing,
 *     and a human whose client sent an odd request still has one click to go.
 *   · a wrong token is 400 before any of that, on every method.
 * Owner's ruling 2026-09-01: safety over compliance friction, one confirming click is the
 * ceiling. RFC 8058 §3.1: never a redirect — a receiver reads 200 as done.
 *
 * An already-suppressed user gets the same confirm page, deliberately. Saying "already
 * unsubscribed" truthfully would need the Worker's re-subscribe rule copied here (row `at`
 * against the blob's LWW stamp — see runDigest), and a bare row-exists check LIES to whoever
 * turned it back on in Settings this afternoon, before the 04:00 run lifts the row. Confirming
 * twice is idempotent (merge-duplicates on the row, a fresh stamp on the blob), so the page just
 * asks. What no confirm page can guard: a sandbox that renders the page and presses its button
 * — stopping that needs a second click or a challenge, which the ruling forbids.
 *
 * Secrets come from the Pages project's environment variables (Settings > Environment
 * variables): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, UNSUB_HMAC_SECRET — same values as the
 * Worker's. Pinned by tests/digest_suppress_sync.test.mjs ("the method half").
 */
import { safeEqual } from "../workers/digest/safe-equal.js";

// The 6 site-wide security headers, BYTE-IDENTICAL to `_headers` /* and to the /l/ Function —
// a Pages Function response never inherits `_headers`, and check_headers_cache derives this
// route from the filename and fails the build if the block is missing or drifts.
const SHARE_STATIC_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=(), interest-cohort=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Content-Security-Policy-Report-Only": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; img-src 'self' data: https: blob:; font-src 'self' data: https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://*.posthog.com https://*.i.posthog.com https://www.clarity.ms; connect-src 'self' https://api.github.com https://*.supabase.co https://*.posthog.com https://*.i.posthog.com https://www.clarity.ms; worker-src 'self' blob:; manifest-src 'self'; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
};

const token = async (secret, userId) => {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(userId));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
};

const page = (body) =>
  new Response("<!doctype html><body style=\"font-family:sans-serif;max-width:420px;margin:80px auto;text-align:center;\">" + body + "</body>",
    { headers: { "content-type": "text/html; charset=utf-8", ...SHARE_STATIC_HEADERS } });
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The one button. It posts back to the SAME signed URL (path + query, token included) with the
 *  page's own marker; nothing on this page reaches Supabase, and it never says "Unsubscribed". */
const confirmPage = (url) => page(
  "<h2>Stop the training-day emails?</h2>" +
  "<p>Nothing has changed yet. You can turn them back on any time in Settings.</p>" +
  "<form method=\"post\" action=\"" + esc(url.pathname + url.search) + "\">" +
  "<input type=\"hidden\" name=\"confirm\" value=\"1\">" +
  "<button type=\"submit\" style=\"font:inherit;font-weight:700;padding:10px 22px;border-radius:9px;border:0;background:#1c2130;color:#fff;cursor:pointer;\">Unsubscribe</button>" +
  "</form>");

/** What the POST body asserts: the RFC 8058 marker, our page's, or nothing. A body that is not a
 *  form — absent, JSON, anything formData() refuses — is "nothing", never an error: the marker
 *  must be IN THE FORM BODY, which is the one place a prefetcher, a scanner or a query string
 *  cannot put it by accident. */
async function intentOf(request) {
  let form;
  try { form = await request.formData(); } catch { return null; }
  if (form.get("List-Unsubscribe") === "One-Click") return "one-click";
  if (form.get("confirm") === "1") return "confirm";
  return null;
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const u = url.searchParams.get("u") || "";
  const t = url.searchParams.get("t") || "";
  // constant-time (v1.164.2): `===` returned at the first differing byte of the one value this
  // Function exists to check. Same helper as the digest Worker's trigger bearer.
  const ok = u && t && env.UNSUB_HMAC_SECRET && safeEqual(t, await token(env.UNSUB_HMAC_SECRET, u));
  if (!ok) return new Response("Invalid unsubscribe link.", { status: 400, headers: SHARE_STATIC_HEADERS });

  // ── the method gate: nothing below this line runs without a marker in a POST body ────────
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD") return confirmPage(url);
  if (method !== "POST") return new Response("Method not allowed.", { status: 405, headers: { Allow: "GET, HEAD, POST", ...SHARE_STATIC_HEADERS } });
  if (!(await intentOf(request))) return confirmPage(url);

  const r = await fetch(env.SUPABASE_URL + "/rest/v1/digest_suppress", {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    // `at` IN THE BODY (v1.164.2). merge-duplicates keeps the existing row's columns for every
    // key the body does not carry, and the column default fires only on insert — so a repeat
    // confirm used to leave the FIRST stop's timestamp. That mattered: the Worker lifts a
    // suppression when the blob's `settingsAt.emailDigest` is later than `at`, and the blob
    // write below is best-effort. A user who unsubscribed, turned it back on in Settings, and
    // unsubscribed again on a day the blob write failed was left with a stamp newer than a
    // stale `at` — and the next run mailed them. The second stop must be the one that counts.
    body: JSON.stringify({ user_id: u, at: new Date().toISOString() }),
  });
  if (!r.ok && r.status !== 409) return new Response("Could not unsubscribe — try again later.", { status: 502, headers: SHARE_STATIC_HEADERS });

  // ── and tell the APP, which is the only side the user can see ──────────────────────────
  // digest_suppress stops the mail, but it is service-role-only: the client never reads it, so
  // for the whole life of this Function the Settings toggle went on reading "On" after an
  // unsubscribe, and `noteCardDone` went on writing the per-day `dayLog` it gates on that key.
  // Nothing looked broken — mail had stopped — which is precisely why it survived.
  // BEST EFFORT, and deliberately after the write above: the stop is authoritative and must
  // never fail because a settings key could not be updated. Read-modify-write is safe enough
  // here (a lost race with a concurrent push leaves exactly today's behaviour, and the Worker
  // still refuses to mail), and the fresh `settingsAt` stamp is what stops the next push from
  // any signed-in device reviving `true` through the per-key LWW merge.
  try {
    const sel = await fetch(env.SUPABASE_URL + "/rest/v1/user_training_data?select=neural&user_id=eq." + encodeURIComponent(u), {
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY },
    });
    if (sel.ok) {
      const rows = await sel.json();
      const blob = (rows && rows[0] && rows[0].neural) || {};
      blob.settings = Object.assign({}, blob.settings, { emailDigest: false });
      blob.settingsAt = Object.assign({}, blob.settingsAt, { emailDigest: Date.now() });
      await fetch(env.SUPABASE_URL + "/rest/v1/user_training_data?user_id=eq." + encodeURIComponent(u), {
        method: "PATCH",
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ neural: blob }),
      });
    }
  } catch (e) {
    console.log("[unsubscribe] blob not updated for " + u + ": " + (e && e.message));
  }

  return page("<h2>Unsubscribed.</h2><p>No more training-day emails. You can turn them back on any time in Settings.</p>");
}
