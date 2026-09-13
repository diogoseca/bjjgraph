/**
 * THE SUPPRESSION POLICY, shared by the two sides that read `digest_suppress` (v1.164.3): the
 * unsubscribe Function writes it, the digest Worker reads it. One file, two deploy units,
 * imported across the tree the way `safe-equal.js` already is.
 *
 * WHY A LOCK EXISTS. The Worker lifts a suppression when the blob's `settingsAt.emailDigest`
 * stamp is newer than the row's `at` — that is how "turn it back on in Settings" works. The
 * stamp is written by the ROW OWNER with the public anon key. Under open signup the row owner
 * and the RECIPIENT are not the same person: anyone can own a row under any address. So the
 * red team (2026-09-01) unsubscribed as the recipient, re-stamped as the owner, and was mailed
 * again — five cycles, five mails — because the lift also DELETED the row, so every cycle was
 * the first. The blob cannot be the authority over the recipient's stop.
 *
 * THE RULE. The FIRST stop is liftable from Settings, as the page promises. A SECOND stop that
 * follows a mail sent AFTER the first stop is FINAL: the recipient was mailed after saying
 * stop and said stop again, which is the abuse's exact shape and also exactly what a person
 * means by clicking unsubscribe twice. The Function detects it (a `digest_sent` row with
 * `sent_at` later than the row's `at`) and writes LOCK_AT; the Worker reads LOCK_AT as
 * `suppressed_locked`; nothing in either lifts it. The owner lifts it by hand:
 *   delete from digest_suppress where user_id = '<uuid>';
 * The bound this buys: one extra mail per address, ever. A repeat click with NO mail in
 * between (a refresh of the done page, a double-submit) is the same stop, not a second one.
 *
 * WHY A SENTINEL `at` AND NOT A COLUMN. LOCK_AT is a timestamp no client stamp can outrank and
 * no clock can reach, so the Worker's ordinary lift rule (`stamp > at && stamp <= now`) is
 * false for it BY CONSTRUCTION — a Worker that never heard of the lock is still safe, and no
 * migration has to land before the next 04:00 for the protection to hold. A reader of the
 * table who sees `at` in the year 9999 is looking at a lock; this comment is where that is
 * written down. Pinned by tests/digest_suppress_sync.test.mjs ("bypass 2").
 */
export const LOCK_AT = "9999-12-31T00:00:00.000Z";
export const LOCK_MS = Date.parse(LOCK_AT);

/** The row's `at` as milliseconds — NaN when it cannot be read. Both sides fail CLOSED on NaN:
 *  the Worker treats it as a stop it cannot evaluate (a failure, never a lift), the Function
 *  treats it as a lift it cannot rule out (a lock). `Date.parse(x) || 0` was the bug: a garbage
 *  `at` read as the epoch, which every stamp outranks. */
export const atMs = (row) => (row && typeof row.at === "string" ? Date.parse(row.at) : NaN);

/** A lock is any `at` at or past the sentinel — `>=`, not `===`, because Postgres normalises
 *  the representation (`+00:00`, no fractional part) and the comparison must not care. */
export const isLocked = (row) => atMs(row) >= LOCK_MS;
