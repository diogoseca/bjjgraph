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
 *      read that fails is a user that is not mailed — never an empty list. A LOCKED row
 *      (suppress.js) is never lifted by anything in this Worker.
 *   4. The auth user: the owner's kill switches (banned, deleted, unconfirmed) are skips by
 *      name, and the address must pass an ASCII allow-list before it reaches a To: header.
 *   5. Compose: techniques · count · Game Knowledge % (+delta) · NEXT-BELT ETA at the recent
 *      pace · streak · the weak-spots MAGAZINE section (top spot with an attributed clip when
 *      the public content chunk carries one; the second as "an extra").
 *   6. CLAIM the (user, day) in digest_sent — BEFORE the send (v1.164.3) — then send via
 *      Cloudflare Email (the EMAIL binding), at most MAX_SENDS_PER_RUN ATTEMPTS per run. A
 *      claim that fails or cannot be verified STOPS THE RUN: mail this run cannot record is
 *      mail this run does not send. A claimed day is never retried, delivered or not — a lost
 *      digest beats a repeated one. SEND_FAILURES_STOP consecutive send failures stop the run.
 *      If the binding is absent, the run stops before any claim, LOUDLY.
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
 * THE SECOND PASS (v1.164.3). With the blob unable to carry a payload, the red team went
 * through four other doors, each closed here and pinned by a test named after it in
 * tests/digest_suppress_sync.test.mjs: the per-run ceiling counted RECORDED sends (a dedupe
 * write that failed after the send made 1,500 rows 1,500 mails, sent=0, every run); the row
 * owner could lift the RECIPIENT's unsubscribe by re-stamping the blob (suppress.js); a
 * banned, deleted or unconfirmed auth user was still mailed; and EMAIL_RE was a deny-list.
 *
 * Secrets (wrangler secret put): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, UNSUB_HMAC_SECRET.
 * The service key lives ONLY here (Workers secrets) — never in the repo, never in the client.
 */

import {
  SITE, beltEta, streakOf, renderText, renderHtml, renderSubject,
} from "./render.js";
import { safeEqual } from "./safe-equal.js";
import { atMs, isLocked } from "./suppress.js";

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
 *
 * IT COUNTS ATTEMPTS (v1.164.3). It used to read `sent`, which was incremented as the LAST
 * statement after the dedupe write — so the one scenario its own first sentence names, "a
 * bug that stops deduping", was the one where it did nothing: the send had already happened,
 * the write threw, the per-user catch filed a failure the brake never read, and 1,500 rows
 * were 1,500 mails with sent=0, and the same 1,500 again the next morning. `attempted` now
 * increments immediately BEFORE `EMAIL.send`, and the brake reads that.
 */
export const MAX_SENDS_PER_RUN = 200;

/**
 * CONSECUTIVE SEND FAILURES THAT STOP THE RUN. A send that throws or returns no messageId is a
 * send the Worker cannot tell from a delivery (the binding may throw AFTER handing the mail
 * off), so its day stays claimed and is never retried. Three in a row is a dead binding, a
 * revoked quota or a broken payload, not three unlucky recipients — and every further attempt
 * would burn one more user's digest for nothing. Three, not one: a single bad address must
 * not be able to stop the whole base's mail every morning it trains.
 */
export const SEND_FAILURES_STOP = 3;

/**
 * HOW FRESH A CLAIM MUST BE. The dedupe row is inserted with `resolution=ignore-duplicates`
 * and read back with `return=representation`: Postgres's RETURNING yields only the row this
 * statement inserted, so a conflict answers `[]` and a claim is ours only if the body holds
 * OUR (user_id, day) — and its `sent_at` is within this window of now. The window guards a
 * server that answered an OLD row (a proxy's cached response, a PostgREST that behaved
 * differently from its documentation): such a row is somebody else's send, and treating it as
 * ours would mail twice. Ten minutes covers any clock skew between the Worker and the
 * database many times over.
 */
export const CLAIM_FRESH_MS = 10 * 60 * 1000;

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
// AN ALLOW-LIST, NOT A DENY-LIST (v1.164.3). The previous form, `[^\s@\x00-\x1f\x7f]`,
// refused C0 controls, DEL and JS `\s` — and admitted the C1 range (U+0085 NEL is a line
// terminator to some parsers), zero-width and soft-hyphen characters, and every RFC 5322
// special that a header parser reads as structure: `<>`, `,`, `;`, `"`, `\\`, `()`, `[]`, `:`.
// What is admitted now: a dot-atom local part over [A-Za-z0-9_+-] (no leading, trailing or
// double dots, at most 64 chars), an @, and a domain of alphanumeric labels (a hyphen inside
// a label only, each ≤ 63 chars) ending in an alphabetic TLD. Refused on purpose, and visible
// in the run summary as `no_email`: quoted local parts, IP literals, comments, the rarer atext
// specials (`!#$%&'*/=?^\x60{|}~`), and any non-ASCII (an IDN or EAI address the Worker cannot
// vouch for is a skip, not a guess). The auth admin API's own validation is upstream; this is
// the Worker refusing to put anything it cannot vouch for into a `To:` header.
const EMAIL_RE = /^[A-Za-z0-9_+-]+(?:\.[A-Za-z0-9_+-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;
const emailOk = (e) => typeof e === "string" && e.length <= 254 && e.indexOf("@") <= 64 && EMAIL_RE.test(e);
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

/** A throw that means "stop the run here": the loop records it, counts the rows left, and
 *  breaks. Everything else thrown inside the loop is one user's failure. */
class StopRun extends Error {
  constructor(msg) { super(msg); this.stopRun = true; }
}

/**
 * THE CLAIM (v1.164.3). Inserts the (user, day) dedupe row BEFORE the send and answers whether
 * this call is the one that inserted it. True: ours, send. False: the row was already there —
 * another writer (a concurrent trigger, a retried cron) claimed it between our read and our
 * write, so this user is `claimed_elsewhere` and the run goes on. A throw: the write failed,
 * or answered something this Worker cannot verify as its own insert (a non-JSON body, a
 * non-array, a row that is not ours, a row not stamped within CLAIM_FRESH_MS) — and the
 * caller turns that into a StopRun, because a run that cannot record a send must not send.
 */
async function claimDay(env, uid, day) {
  const r = await sbRaw(env, "/rest/v1/digest_sent?select=user_id,day,sent_at", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates, return=representation" },
    body: JSON.stringify({ user_id: uid, day }),
  });
  const text = await r.text();
  let rows;
  try { rows = JSON.parse(text); } catch (e) { throw new Error("claim answered a non-JSON body " + JSON.stringify(text.slice(0, 40))); }
  if (!Array.isArray(rows)) throw new Error("claim answered a non-row-set body");
  if (rows.length === 0) return false;
  const c = rows[0];
  if (rows.length !== 1 || !c || c.user_id !== uid || c.day !== day) throw new Error("claim answered a row that is not ours");
  const stamped = Date.parse(String(c.sent_at));
  if (!(Number.isFinite(stamped) && Math.abs(Date.now() - stamped) <= CLAIM_FRESH_MS))
    throw new Error("claim answered a row stamped " + JSON.stringify(c.sent_at) + " — not this run's insert");
  return true;
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
 * no send, no write; the caller decides both.
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
  //
  // AND THE LOCK (v1.164.3, the whole argument in suppress.js). The stamp is the ROW OWNER's
  // word, and under open signup the row owner is not necessarily the recipient — so the
  // stamp may lift a stop ONCE, and a second stop that follows a mail is final. The Function
  // writes it as a sentinel `at` that no stamp can outrank, so the rule below is false for it
  // by construction; the explicit check is what NAMES it in the summary. The row is never
  // DELETED on a lift any more: it is the memory that a stop happened, which the lock needs.
  const sup = await sbRows(env, "/rest/v1/digest_suppress?select=user_id,at&user_id=eq." + uid);
  ctx.suppressRowsSeen += sup.length;
  if (sup.length) {
    if (isLocked(sup[0])) return { skip: "suppressed_locked" };
    const at = atMs(sup[0]);
    // `Date.parse(at) || 0` was the previous line: a garbage `at` read as the epoch, which
    // every stamp outranks — an unreadable stop was a lift. Fail closed: a failure, by name.
    if (!Number.isFinite(at)) throw new Error("digest_suppress.at unreadable: " + JSON.stringify(sup[0].at));
    const stamp = row.settingsAt && row.settingsAt.emailDigest;
    if (!(typeof stamp === "number" && stamp > at && stamp <= Date.now())) return { skip: "suppressed" };
    // lifted — the row stays exactly as it is, and lifts again tomorrow by the same rule
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

  // the auth user: admin API, service role only. THE OWNER'S KILL SWITCHES FIRST (v1.164.3):
  // banning is the dashboard's one-click abuse response, and a banned, soft-deleted or
  // unconfirmed account was still mailed because only `email` was ever read. Each is a skip
  // by name; each fails CLOSED on a value it cannot read (a ban it cannot parse is a ban, a
  // confirmation it cannot parse is none). An EXPIRED ban is a lifted ban — GoTrue's reading.
  // `email_confirmed_at` is required, not merely checked: the day the owner turns
  // mailer_autoconfirm off, an address that never confirmed must not be mailed.
  const user = await sb(env, "/auth/v1/admin/users/" + uid);
  if (!user || typeof user !== "object") return { skip: "no_email", capped };
  if (user.deleted_at != null) return { skip: "deleted", capped };
  if (user.banned_until != null) {
    const until = Date.parse(String(user.banned_until));
    if (!(Number.isFinite(until) && until <= Date.now())) return { skip: "banned", capped };
  }
  if (user.email_confirmed_at == null || !Number.isFinite(Date.parse(String(user.email_confirmed_at)))) return { skip: "unconfirmed", capped };
  const email = user.email;
  if (!emailOk(email)) return { skip: "no_email", capped };

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
  return { digest, day, email, capped };
}

/**
 * Exported for `tests/digest_suppress_sync.test.mjs`, which drives it against a PostgREST
 * double. The Workers runtime only ever reaches it through the two handlers below.
 *
 *   opts.send  — true (the cron's default) claims and sends; false builds every digest, sends
 *                nothing, WRITES nothing (no claim, no row touched), and returns a sample. The
 *                cron never passes false; the trigger never passes true without a user (see
 *                `fetch`).
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
  const skip = (why) => { skipped[why] = (skipped[why] || 0) + 1; };
  let sent = 0, attempted = 0, capped = 0, wouldSend = 0, deferred = 0, sendFailStreak = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    // THE BRAKE — on ATTEMPTS (see MAX_SENDS_PER_RUN). Rows past it are not evaluated at all
    // (their suppress/sent/auth reads are the cost the brake exists to stop), so the count is
    // rows LEFT, not sends deferred.
    if (send && attempted >= MAX_SENDS_PER_RUN) {
      deferred = rows.length - i;
      const msg = "ceiling: " + MAX_SENDS_PER_RUN + " sends attempted, " + deferred + " rows left unevaluated for the next run";
      console.error("[digest] CEILING HIT — " + msg);
      failures.push(msg);
      break;
    }
    try {
      const c = await compose(env, row, ctx);
      capped += c.capped || 0;
      if (c.skip) { skip(c.skip); continue; }
      const { digest, day, email } = c;
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
      if (sentUsers.has(row.user_id)) { skip("duplicate_row"); continue; }

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
      // no binding, no run — checked BEFORE the claim, so a missing binding burns nobody's day
      if (!env.EMAIL || typeof env.EMAIL.send !== "function")
        throw new StopRun("EMAIL binding missing — connect Email Service and copy the binding stanza from the dashboard's wrangler tab (see RUNBOOK.md)");

      // THE ORDER IS THE FIX (v1.164.3): claim, count, send. Until now it was send, record,
      // count — and any throw between the send and the count was a mail the ceiling never
      // saw and the dedupe never held (the red team's 1,500-row run: 1,500 mails, sent=0,
      // 1,500 more the next morning). A claim that fails stops the run; a claim somebody
      // else holds is a named skip; only a claim that is verifiably ours is followed by a send.
      let claimed;
      try { claimed = await claimDay(env, row.user_id, day); }
      catch (e) { throw new StopRun("dedupe write failed for " + row.user_id + " — " + (e && e.message)); }
      if (!claimed) { skip("claimed_elsewhere"); continue; }

      attempted++;   // BEFORE the send: this is what the brake reads
      let sent1 = null, sendErr = null;
      try { sent1 = await env.EMAIL.send(mail); } catch (e) { sendErr = e; }
      if (!sent1 || !sent1.messageId) {
        // the day stays claimed: the binding may have delivered before it threw, and a lost
        // digest is the cheap failure — a repeated one is the expensive one
        const why = sendErr ? ((sendErr && sendErr.message) || String(sendErr)) : "send returned no messageId";
        if (++sendFailStreak >= SEND_FAILURES_STOP)
          throw new StopRun(SEND_FAILURES_STOP + " consecutive send failures, last: " + why + " (each day claimed, not retried)");
        throw new Error("send failed, day claimed and not retried: " + why);
      }
      sendFailStreak = 0;
      sentUsers.add(row.user_id);
      sent++;
    } catch (err) {
      if (err && err.stopRun) {
        deferred = rows.length - i - 1;
        const msg = "STOPPED — " + err.message + "; " + deferred + " rows left unevaluated for the next run";
        console.error("[digest] RUN STOPPED — " + err.message + "; " + deferred + " rows left");
        failures.push(row.user_id + ": " + msg);
        break;
      }
      failures.push(row.user_id + ": " + (err && err.message));
    }
  }
  const result = {
    mode, rows: rows.length, manifest_decks: allow.size,
    suppress_rows_seen: ctx.suppressRowsSeen, sent_rows_seen: ctx.sentRowsSeen,
    sent, attempted, capped, deferred, skipped, failures,
    ...(send ? {} : { would_send: wouldSend, sample }),
  };
  // the summary line — one per run, every counter present even when zero
  console.log("[digest] run mode=" + mode + " rows=" + rows.length + " manifest_decks=" + allow.size +
    " suppress_rows_seen=" + ctx.suppressRowsSeen + " sent_rows_seen=" + ctx.sentRowsSeen +
    " sent=" + sent + " attempted=" + attempted + (send ? "" : " would_send=" + wouldSend) + " capped=" + capped + " deferred=" + deferred +
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
