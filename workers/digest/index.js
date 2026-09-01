/**
 * THE TRAINING-DAY DIGEST WORKER (v1.105.7, owner-approved design 2026-08-16).
 *
 * A scheduled Cloudflare Worker that mails each opted-in player a digest of THEIR OWN DAY at
 * bjjgraph.org — after active days only. The data is the same v2 progress blob everything else
 * uses (the app records a per-day `dayLog` when `settings.emailDigest` is on; nothing here is a
 * second source of truth).
 *
 * PIPELINE, once a day (cron in wrangler.toml):
 *   0. The public deck manifest, ONCE per run — the allow-list every technique name is checked
 *      against. No manifest, no run (v1.164.2).
 *   1. Supabase (service role): rows of user_training_data where the blob opts in — only the
 *      four blob paths the run reads, paginated, the count asserted against Content-Range.
 *   2. For each: the latest `dayLog` day with allow-listed techniques that has NOT been mailed
 *      (digest_sent dedupes; the client writes LOCAL dates, so "today" needs no timezone math).
 *   3. Suppression check (one-click unsubscribe writes digest_suppress). Read PER USER, and a
 *      read that fails is a user that is not mailed — never an empty list.
 *   4. Compose: techniques · count · Game Knowledge % (+delta) · NEXT-BELT ETA at the recent
 *      pace · streak · the weak-spots MAGAZINE section (top spot with an attributed clip when
 *      the public content chunk carries one; the second as "an extra").
 *   5. Send via Cloudflare Email (the EMAIL binding), at most MAX_SENDS_PER_RUN per run. If the
 *      binding is absent or rejects arbitrary recipients (Email Sending still rolling out),
 *      every send fails LOUDLY with a clear log line — never silently — and the runbook's
 *      fallback question goes to the owner.
 *
 * THE BLOB IS HOSTILE INPUT (v1.164.2). `neural` is written by the row's owner with the public
 * anon key every browser ships, under an owner-writable RLS policy that checks no shape, and
 * signup is open with no captcha and auto-confirmed mail — so ANY address can own a row whose
 * blob says whatever its author likes, and this Worker then mails that address a DKIM-signed,
 * DMARC-passing message From coach@bjjgraph.org. Before v1.164.2 the subject, the <h1> and the
 * score line carried the blob's raw strings. The signup half is the owner's decision; this
 * half is that nothing read from a blob reaches a mail unchanged: numbers are coerced and
 * clamped, day keys must be dates, deck keys must be IN THE PUBLIC MANIFEST, arrays and
 * strings are capped, and a row whose score is not a number is skipped by name. FAIL CLOSED
 * everywhere: what this run cannot verify, this run does not send — the cron retries tomorrow.
 *
 * Secrets (wrangler secret put): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, UNSUB_HMAC_SECRET.
 * The service key lives ONLY here (Workers secrets) — never in the repo, never in the client.
 */

import {
  SITE, beltEta, streakOf, renderText, renderHtml, renderSubject,
} from "./render.js";
import { safeEqual } from "./safe-equal.js";

// THE TWO ADDRESSES THE MAIL CARRIES, and they are deliberately the same mailbox.
//   From:     who it is from, and where a reply goes when a client ignores Reply-To.
//   Reply-To: where a reply goes explicitly. Stated even though it duplicates From, because
//             the moment either changes (a no-reply sender, a different brand address) the
//             replies must keep landing in a human inbox — and a Reply-To that was never
//             there is the kind of omission nobody notices until the replies stop.
// coach@bjjgraph.org is Email Routing -> the owner's personal inbox. Replies are read by a
// person by design; there is no processing worker and must not be one without saying so.
// The binding also accepts { email, name } here if a display name is ever wanted.
const FROM = "coach@bjjgraph.org";
const REPLY_TO = "coach@bjjgraph.org";

/**
 * THE PER-RUN CEILING. Cloudflare Email Sending sets an account's sending quota from observed
 * behaviour — volume, bounces, complaints — so one runaway run (a bug that stops deduping, a
 * batch of fabricated opt-ins, a re-subscribe rule that lifts every suppression at once) is
 * not paid for that morning; it is paid for in every later morning's deliverability. 200 is
 * an order of magnitude above the largest day this Worker has ever sent and an order of
 * magnitude below anything a domain this size should emit unattended. When it trips, the run
 * logs it, records how many rows it left unevaluated in `failures`, and stops: those users are
 * still un-deduped, so tomorrow's run takes them first. It is a BRAKE, not a scheduler — if it
 * trips on an ordinary day, the owner raises it on purpose, in a commit that says why.
 */
export const MAX_SENDS_PER_RUN = 200;

/**
 * THE MANIFEST FLOOR. The public deck manifest lists every real deck (~2,900 as of v1.164.2:
 * two roles for each of ~1,450 positions and techniques). A fetch that yields fewer than this
 * is not a smaller corpus — it is a truncated file, a wrong URL, an error page that parsed, or
 * a build that broke — and a run that trusted it would mail every user "0 techniques" (or
 * nothing at all, silently). Below the floor the run sends NOTHING and says why (§6.6: absence
 * must never read as a pass).
 */
export const MANIFEST_MIN_DECKS = 1000;
export const MANIFEST_URL = SITE + "/static/neural/flashcards/_index.json";

// THE CAPS, one per field the blob can stretch. Each is well above what the app ever writes
// (`noteCardDone` stops `k` at 40; `w` is [n, word, top-2]; a deck key is at most 61 chars;
// the score is one decimal in 0..100) and well below anything that could make a mail heavy,
// a subject long, or a loop slow.
const CAP = { techniques: 40, weak: 4, keyLen: 120, count: 10000, streak: 3650, delta: 100 };
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Conservative: one @, no whitespace or control characters, a dot in the domain, RFC length.
// The auth admin API's own validation is upstream; this is the Worker refusing to put anything
// it cannot vouch for into a `To:` header.
const EMAIL_RE = /^[^\s@\x00-\x1f\x7f]{1,64}@[^\s@\x00-\x1f\x7f]+\.[^\s@\x00-\x1f\x7f]+$/;
const PAGE = 1000;               // PostgREST's default max-rows; one page is one request
const DRY_RUN_SAMPLE = 5;        // the trigger's dry run returns this many rendered digests

// fnv1a32, byte-identical to the app's qhash — content chunks are addressed by it. It stays
// HERE rather than in render.js: it addresses the content chunk the Worker fetches, so it
// belongs with the fetching, not with the pure view.
const fnv1a32 = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ("0000000" + h.toString(16)).slice(-8);
};

async function sbRaw(env, path, init = {}) {
  const r = await fetch(env.SUPABASE_URL + path, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!r.ok) throw new Error("supabase " + path.split("?")[0] + " -> " + r.status);
  return r;
}

async function sb(env, path, init = {}) {
  const r = await sbRaw(env, path, init);
  // PostgREST answers a plain POST with `Prefer: return=minimal` semantics — 201 and an EMPTY
  // body — so `r.json()` threw "Unexpected end of JSON input" on every successful digest_sent
  // write. The row landed and the mail had already gone, but the throw was caught per-user into
  // `failures`, so `sent` never incremented: a working run reported {sent:0, failures:[...]},
  // which is exactly the reading the runbook's dry-run tells the owner to trust. Parse only
  // when there is something to parse.
  if (r.status === 204) return null;
  const body = await r.text();
  return body ? JSON.parse(body) : null;
}

/** A GET that must answer with rows: anything but a JSON array is a failed read, and a failed
 *  read THROWS (v1.164.2). The old `.catch(() => [])` made an outage read as "nobody is
 *  suppressed" — the one answer a suppression check must never give by default. */
async function sbRows(env, path) {
  const rows = await sb(env, path);
  if (!Array.isArray(rows)) throw new Error("supabase " + path.split("?")[0] + " -> not a row set");
  return rows;
}

/**
 * EVERY ROW, OR THROW (v1.164.2). PostgREST serves at most `max-rows` per request (1,000 by
 * default) and says nothing when it truncates; a base of 1,001 opt-ins would have mailed 1,000
 * forever with no log line. Pages by Range, asks for the exact count, and refuses to return a
 * set whose size it cannot reconcile with Content-Range — a missing count is a throw, not a
 * guess. The path MUST carry a stable `order=` or pages can overlap or skip; the caller owns
 * that, and this checks it.
 */
async function sbAll(env, path) {
  if (!/[?&]order=/.test(path)) throw new Error("sbAll needs a stable order= in " + path.split("?")[0]);
  const all = [];
  let total = null;
  for (let from = 0; ; from += PAGE) {
    const r = await sbRaw(env, path, { headers: { Range: from + "-" + (from + PAGE - 1), Prefer: "count=exact" } });
    const body = await r.text();
    const rows = body ? JSON.parse(body) : [];
    if (!Array.isArray(rows)) throw new Error("supabase " + path.split("?")[0] + " -> not a row set");
    const cr = r.headers.get("content-range") || "";
    const m = /^(\*|\d+-\d+)\/(\d+|\*)$/.exec(cr);
    if (!m || m[2] === "*") throw new Error("supabase " + path.split("?")[0] + " -> no exact count (Content-Range " + JSON.stringify(cr) + ")");
    total = Number(m[2]);
    all.push(...rows);
    if (!rows.length || all.length >= total) break;
  }
  if (all.length !== total) throw new Error("supabase " + path.split("?")[0] + " -> " + all.length + " rows for a count of " + total);
  return all;
}

/**
 * THE ALLOW-LIST (v1.164.2). Every deck key a mail may name comes from here and nowhere else:
 * the same public manifest the app boots from. Fetched once per run; a fetch that fails,
 * parses to the wrong shape, or lists fewer than MANIFEST_MIN_DECKS decks throws, and the run
 * sends nothing. Never cached across runs — a stale allow-list after a content release would
 * silently drop the new decks from every mail.
 */
async function fetchManifest() {
  const r = await fetch(MANIFEST_URL);
  if (!r.ok) throw new Error("manifest " + MANIFEST_URL + " -> " + r.status);
  const j = await r.json();
  const decks = j && j.decks && typeof j.decks === "object" ? Object.keys(j.decks) : [];
  if (decks.length < MANIFEST_MIN_DECKS)
    throw new Error("manifest lists " + decks.length + " decks, floor is " + MANIFEST_MIN_DECKS + " — refusing to run on an implausible allow-list");
  return new Set(decks);
}

async function clipFor(deckKey) {
  const tryKeys = [deckKey, String(deckKey).split("|")[0]];
  for (const k of tryKeys) {
    try {
      const r = await fetch(SITE + "/static/neural/content/" + fnv1a32(k) + ".json", {
        cf: { cacheTtl: 86400 },
      });
      if (!r.ok) continue;
      const j = await r.json();
      const entry = j && (j[k] || j[Object.keys(j)[0]]);
      const clips = entry && entry.clips;
      if (Array.isArray(clips) && clips.length) {
        const c = clips[0];
        // the emitted clip shape carries `by` (instructor attribution) and has NO duration
        // field — real keys are by/id/title/vertical ± start/end. `start`/`end` give a length
        // when both exist; anything else and the duration is simply omitted.
        if (c && c.id && (c.by || c.title)) {
          const dur =
            typeof c.start === "number" && typeof c.end === "number" && c.end > c.start
              ? Math.round(c.end - c.start) + "s"
              : null;
          return { id: c.id, title: c.title || "", who: c.by || "", dur: dur };
        }
      }
    } catch (e) {
      /* content chunk miss — the magazine section degrades to text */
    }
  }
  return null;
}

async function hmacToken(env, userId) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.UNSUB_HMAC_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(userId));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

// ── ingest coercion: every value read from a blob passes through exactly one of these ────

/** A finite number inside [lo, hi] with `dp` decimals, or null. A string that parses ("41.5",
 *  " 12 ", "0x10") is a number; "", "1e309", "NaN", "12<b>", true, [], {} are not (`Number("")`
 *  is 0, which is why the empty string is refused by name). `hit` is called when the clamp
 *  changed the value, so the run can count how often a blob needed capping. */
function num(v, lo, hi, dp, hit) {
  if (v == null || typeof v === "boolean" || typeof v === "object") return null;
  const t = typeof v === "number" ? v : String(v).trim();
  if (t === "") return null;
  const n = typeof t === "number" ? t : Number(t);
  if (!Number.isFinite(n)) return null;
  const c = Math.min(hi, Math.max(lo, n));
  const r = dp === 0 ? Math.round(c) : Math.round(c * 10 ** dp) / 10 ** dp;
  if (c !== n && hit) hit();
  return r;
}

/** Deck keys, allow-listed: a string, at most CAP.keyLen long, PRESENT IN THE MANIFEST, deduped,
 *  at most `cap` of them — in the order the blob gave them. Anything else is dropped, counted. */
function keys(v, allow, cap, hit) {
  if (!Array.isArray(v)) { if (v != null && hit) hit(); return []; }
  const out = [];
  const seen = new Set();
  for (const k of v) {
    if (typeof k === "string" && k.length <= CAP.keyLen && allow.has(k) && !seen.has(k)) {
      if (out.length < cap) { out.push(k); seen.add(k); continue; }
    }
    if (hit) hit();
  }
  return out;
}

/** `days` / `dayLog` keyed by date only: a key that is not YYYY-MM-DD is dropped, counted. The
 *  result has no prototype, so a key like `__proto__` or `constructor` in the blob can neither
 *  survive the filter nor reach a lookup. */
function byDay(obj, hit) {
  const out = Object.create(null);
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) { if (obj != null && hit) hit(); return out; }
  for (const k of Object.keys(obj)) {
    if (DAY_RE.test(k)) out[k] = obj[k];
    else if (hit) hit();
  }
  return out;
}

/**
 * ONE USER'S DIGEST, OR A NAMED REASON NOT TO SEND. Pure over the row and the run context —
 * no send, no write; the caller decides both. `lift` is the suppression this user has
 * legitimately turned back on (Settings after unsubscribing), which the caller DELETES only on
 * a live send — a dry run must leave the row exactly as it found it.
 */
async function compose(env, row, ctx) {
  const uid = row.user_id;
  if (typeof uid !== "string" || !UUID_RE.test(uid)) return { skip: "bad_user_id" };
  let capped = 0;
  const hit = () => { capped++; };

  // RE-SUBSCRIBING. Every row here already has `emailDigest === true` (it is the query's
  // filter), so intent alone cannot distinguish "turned it back on" from "unsubscribed and
  // the blob was never told" — which is every user suppressed before the blob write below
  // existed. The per-key LWW stamp the settings sync already maintains is the discriminator:
  // a stamp LATER than the suppression is a deliberate flip that came after it. Two guards
  // keep that honest — a legacy row's `at` is newer than its stale stamp, so it keeps
  // blocking; and `set()` stamps the CLIENT clock, so a stamp in the FUTURE is refused
  // rather than trusted (a fast device must not be able to re-subscribe its owner).
  // The row is read PER USER, here, and a failed read throws out of compose: this user is then
  // a `failures` entry, never a send (v1.164.2 — it used to `.catch(() => [])`).
  const sup = await sbRows(env, "/rest/v1/digest_suppress?select=user_id,at&user_id=eq." + uid);
  ctx.suppressRowsSeen += sup.length;
  let lift = null;
  if (sup.length) {
    const at = Date.parse(sup[0].at) || 0;
    const stamp = row.settingsAt && row.settingsAt.emailDigest;
    if (!(typeof stamp === "number" && stamp > at && stamp <= Date.now())) return { skip: "suppressed" };
    lift = uid;   // lifted — the caller clears it on a live send, or tomorrow's run blocks them again
  }

  const dayLog = byDay(row.dayLog, hit);
  const days = byDay(row.days, hit);
  // only days with at least one technique THE MANIFEST KNOWS — a day of fabricated keys is not
  // an active day, and a blob with no real day has nothing to be mailed about.
  const entries = Object.create(null);
  for (const d of Object.keys(dayLog)) {
    const e = dayLog[d];
    if (!e || typeof e !== "object" || Array.isArray(e)) { hit(); continue; }
    const k = keys(e.k, ctx.allow, CAP.techniques, hit);
    if (!k.length) continue;
    entries[d] = { k, s: num(e.s, 0, 100, 1, hit), w: keys(Array.isArray(e.w) ? e.w.slice(2) : null, ctx.allow, CAP.weak, hit) };
  }
  const valid = Object.keys(entries).sort();
  const day = valid[valid.length - 1];
  if (!day) return { skip: "no_valid_day", capped };
  // never mail about the day still in progress somewhere: only days at least 1 behind the
  // NEWEST utc date — the client's local midnight has certainly passed by then.
  if (day >= new Date().toISOString().slice(0, 10)) return { skip: "day_in_progress", capped };
  const e = entries[day];
  if (e.s == null) return { skip: "bad_score", capped };

  // the dedupe row, read PER USER and PER DAY — exact, unpaginated, and a throw on failure
  const sentRows = await sbRows(env, "/rest/v1/digest_sent?select=day&user_id=eq." + uid + "&day=eq." + day);
  ctx.sentRowsSeen += sentRows.length;
  if (sentRows.length) return { skip: "already_sent", capped };

  // the address: auth admin API, service role only
  const user = await sb(env, "/auth/v1/admin/users/" + uid);
  const email = user && user.email;
  if (typeof email !== "string" || email.length > 254 || !EMAIL_RE.test(email)) return { skip: "no_email", capped };

  const prevDay = valid[valid.length - 2];
  const prevS = prevDay ? entries[prevDay].s : null;
  const delta = prevS != null ? num(e.s - prevS, -CAP.delta, CAP.delta, 1, hit) : null;
  const deltas = [];
  const recent = valid.slice(-7).slice(0, -1);
  for (let i = 1; i < recent.length; i++) {
    const a = entries[recent[i - 1]].s, b = entries[recent[i]].s;
    if (a != null && b != null && b > a) deltas.push((b - a) / 100);
  }
  const count = num(days[day], 0, CAP.count, 0, hit);
  const digest = {
    count: count == null || count === 0 ? e.k.length : count,
    techniques: e.k,
    score: e.s,
    delta,
    eta: beltEta(e.s / 100, deltas),
    streak: num(streakOf(days, day), 0, CAP.streak, 0, hit) || 0,
    weakTop: e.w,
    clip: e.w[0] ? await clipFor(e.w[0]) : null,
    unsubUrl: SITE + "/unsubscribe?u=" + uid + "&t=" + (await hmacToken(env, uid)),
  };
  return { digest, day, email, lift, capped };
}

/**
 * Exported for `tests/digest_suppress_sync.test.mjs`, which drives it against a PostgREST
 * double. The Workers runtime only ever reaches it through the two handlers below.
 *
 *   opts.send  — true (the cron's default) sends and writes; false builds every digest, sends
 *                nothing, WRITES nothing (no dedupe row, no lifted suppression), and returns a
 *                sample. The cron never passes false; the trigger never passes true without a
 *                user (see `fetch`).
 *   opts.user  — a UUID scopes the rows query to one user; null is the whole base.
 *
 * Returns, and logs as ONE line, the run summary — every counter positive, every skip named,
 * so "sent 0" can always be told apart from "looked at nothing" (§6.6).
 */
export async function runDigest(env, opts = {}) {
  const send = opts.send !== false;
  const scope = opts.user || null;
  if (scope && !UUID_RE.test(scope)) throw new Error("user scope is not a UUID");
  const mode = send ? (scope ? "send-one" : "cron") : "dry-run";

  // 0. the allow-list, or nothing. Before the rows query on purpose: a run that cannot verify
  //    deck names has no business reading anybody's blob.
  const allow = await fetchManifest();
  console.log("[digest] manifest decks: " + allow.size);

  // 1. opted-in rows — ONLY the four blob paths the run reads. PostgREST projects each jsonb
  //    path to its own column; the aliases keep the names the composer expects. Whole-blob reads
  //    pulled every user's lists, SRS and coins across the wire to render four fields.
  const rows = await sbAll(
    env,
    "/rest/v1/user_training_data?select=user_id,settings:neural->settings,settingsAt:neural->settingsAt,dayLog:neural->dayLog,days:neural->days" +
      "&neural->settings->>emailDigest=eq.true&order=user_id.asc" + (scope ? "&user_id=eq." + scope : ""),
  );

  const ctx = { allow, suppressRowsSeen: 0, sentRowsSeen: 0 };
  const skipped = {};
  const failures = [];
  const sample = [];
  const sentUsers = new Set();
  let sent = 0, capped = 0, wouldSend = 0, deferred = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    // THE BRAKE. Rows past it are not evaluated at all (their suppress/sent/auth reads are the
    // cost the brake exists to stop), so the count is rows LEFT, not sends deferred.
    if (send && sent >= MAX_SENDS_PER_RUN) {
      deferred = rows.length - i;
      const msg = "ceiling: " + MAX_SENDS_PER_RUN + " sends reached, " + deferred + " rows left unevaluated for the next run";
      console.error("[digest] CEILING HIT — " + msg);
      failures.push(msg);
      break;
    }
    try {
      const c = await compose(env, row, ctx);
      capped += c.capped || 0;
      if (c.skip) { skipped[c.skip] = (skipped[c.skip] || 0) + 1; continue; }
      const { digest, day, email, lift } = c;
      const mail = {
        to: email,
        from: FROM,
        replyTo: REPLY_TO,
        subject: renderSubject(digest),
        html: renderHtml(digest),
        text: renderText(digest),
        headers: {
          "List-Unsubscribe": "<" + digest.unsubUrl + ">",
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      };
      if (!send) {
        wouldSend++;
        if (sample.length < DRY_RUN_SAMPLE)
          sample.push({ user_id_prefix: row.user_id.slice(0, 8), day, subject: mail.subject, text: mail.text });
        continue;
      }
      // ONE SEND PER USER PER RUN. The rows query is unique on user_id and the day dedupe holds
      // it anyway; this is the explicit form, so a future second row shape cannot double-mail.
      if (sentUsers.has(row.user_id)) { skipped.duplicate_row = (skipped.duplicate_row || 0) + 1; continue; }

      // 5. send — the Email Service binding's options API (owner's dashboard snippet,
      // 2026-08-17; field list confirmed against Cloudflare's Workers API reference 2026-09-01:
      // to/from/subject/html/text/cc/bcc/replyTo/headers/attachments, returns {messageId}).
      // `replyTo` is CAMELCASE on the binding — the REST API spells the same field `reply_to`,
      // and getting that backwards fails silently: an unknown key is simply ignored, the mail
      // still sends, and the header is quietly absent. LOUD on absence: the runbook's one gate.
      // Replies go to coach@bjjgraph.org, which Email Routing forwards to the owner's inbox —
      // deliberately human-read, no processing worker.
      //
      // LIST-UNSUBSCRIBE, finally. This comment used to say "when the simple API grows a headers
      // field, add List-Unsubscribe one-click there too" — it has one, so here it is. RFC 8058:
      // `List-Unsubscribe-Post` is what turns the mailbox provider's own Unsubscribe button into
      // a single click, and Gmail and Yahoo have required it of bulk senders since 2024. The URL
      // is the same HMAC-signed endpoint as the body link. Since v1.164.0 that endpoint honours
      // ONLY a POST whose form body carries the marker below (or its own confirm button); a GET
      // — a prefetcher's, a gateway's, a scanner's — renders a confirm page and mutates nothing,
      // and a bare POST is treated the same. So the header's silent-POST hazard is closed at
      // the endpoint, and the suppression stays LIFTABLE from Settings (since v1.149.1).
      if (!env.EMAIL || typeof env.EMAIL.send !== "function")
        throw new Error("EMAIL binding missing — connect Email Service and copy the binding stanza from the dashboard's wrangler tab (see RUNBOOK.md)");
      // the lifted suppression is cleared FIRST, and only on a live send: a mail that goes out
      // while the row stays would be re-blocked tomorrow, and a dry run must not touch the row
      if (lift) await sb(env, "/rest/v1/digest_suppress?user_id=eq." + lift, { method: "DELETE" });
      const sent1 = await env.EMAIL.send(mail);
      if (!sent1 || !sent1.messageId) throw new Error("send returned no messageId");
      sentUsers.add(row.user_id);

      await sb(env, "/rest/v1/digest_sent", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({ user_id: row.user_id, day }),
      });
      sent++;
    } catch (err) {
      failures.push(row.user_id + ": " + (err && err.message));
    }
  }
  const result = {
    mode, rows: rows.length, manifest_decks: allow.size,
    suppress_rows_seen: ctx.suppressRowsSeen, sent_rows_seen: ctx.sentRowsSeen,
    sent, capped, deferred, skipped, failures,
    ...(send ? {} : { would_send: wouldSend, sample }),
  };
  // the summary line — one per run, every counter present even when zero
  console.log("[digest] run mode=" + mode + " rows=" + rows.length + " manifest_decks=" + allow.size +
    " suppress_rows_seen=" + ctx.suppressRowsSeen + " sent_rows_seen=" + ctx.sentRowsSeen +
    " sent=" + sent + (send ? "" : " would_send=" + wouldSend) + " capped=" + capped + " deferred=" + deferred +
    " skipped=" + JSON.stringify(skipped) + " failures=" + failures.length);
  return result;
}

export default {
  async scheduled(_event, env, ctx) {
    // a throw here (no manifest, no exact count, no rows endpoint) is the run refusing to
    // start — log it as such rather than as an unhandled rejection with no prefix to grep
    ctx.waitUntil(runDigest(env).catch((e) => {
      console.error("[digest] RUN ABORTED, nothing sent: " + (e && e.message));
    }));
  },
  /**
   * THE MANUAL TRIGGER — DRY-RUN BY DEFAULT (v1.164.2). It used to send LIVE mail to every
   * pending user, and the runbook called that a "dry-run".
   *   GET /                      dry run over the whole base: every digest built, nothing sent,
   *                              nothing written; returns {would_send, sample:[{user_id_prefix,
   *                              day, subject, text}], …summary}.
   *   GET /?user=<uuid>          the same, scoped to one user (the sample is that user's mail).
   *   GET /?send=1&user=<uuid>   a LIVE send, one user. `send=1` without `user=` is refused:
   *                              a live send from the trigger is one person at a time, never
   *                              the base — the base is the cron's, with its ceiling.
   * Authenticated by the service-role key as bearer, compared constant-time. That key is the
   * database's master credential and the wrong thing to type into a curl line; replacing it
   * with a separate admin token (DIGEST_TRIGGER_TOKEN) needs a new Workers secret only the
   * owner can set, so the swap is a runbook step for them, not a change this commit can make.
   */
  async fetch(req, env) {
    const auth = req.headers.get("authorization") || "";
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key || !safeEqual(auth, "Bearer " + key)) return new Response("no", { status: 401 });
    const url = new URL(req.url);
    const send = url.searchParams.get("send") === "1";
    const user = url.searchParams.get("user") || null;
    if (user && !UUID_RE.test(user)) return Response.json({ error: "user must be a UUID" }, { status: 400 });
    if (send && !user) return Response.json({ error: "send=1 needs user=<uuid> — a live send from the trigger is one user at a time; the base is the cron's" }, { status: 400 });
    try {
      return Response.json(await runDigest(env, { send, user }));
    } catch (e) {
      return Response.json({ error: (e && e.message) || String(e), sent: 0 }, { status: 500 });
    }
  },
};
