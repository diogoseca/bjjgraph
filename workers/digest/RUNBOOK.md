# Training-day digest — owner runbook (v1.105.7)

Everything code-side is committed. These are the steps only you can do, in order.
Total time ≈ 10 minutes (step 1 already done). Nothing sends until step 6, and nothing sends to anyone
who has not flipped the Beta toggle in Settings.

## 1. ~~THE GATE~~ — DONE (owner, 2026-08-17)
Email Service is enabled; any from-address on the verified domain may send (no
per-address creation needed). `coach@bjjgraph.org` is set to FORWARD inbound to
the owner's personal inbox — replies are human-read by design, no processing
worker. The Worker sends via the simple binding API
(`env.EMAIL.send({to, from, subject, html, text})` → `{messageId}`).

ONE CHECK at deploy: if `wrangler deploy` rejects the `send_email` binding
stanza in wrangler.toml, copy the exact binding block from the dashboard's
"Connect to Email Service → Workers → wrangler" tab over it — the dashboard's
snippet is authoritative for the binding key's current spelling.

## 2. Supabase tables (2 min)
Supabase dashboard → SQL editor → paste and run `supabase/digest_v1.sql`
(creates `digest_sent` + `digest_suppress`, service-role-only).

**Then `supabase/digest_v2.sql` (v1.164.3, 1 min, idempotent).** It makes
`user_training_data.user_id` cascade on delete, so HARD-deleting an abusive auth user takes
its row — blob, opt-in and all — with it. Until it runs, a hard delete is refused by the
foreign key (the red team's finding). Nothing sends differently before or after it: the
Worker already refuses to mail a banned, soft-deleted or unconfirmed user.

## 3+4. Worker deploy + ALL secrets — AUTOMATED (2026-08-17)
One GitHub secret is the whole remaining setup:
```
gh secret set SUPABASE_SERVICE_ROLE_KEY    # paste from Supabase → Settings → API → service_role
```
(`UNSUB_HMAC_SECRET` was generated and set on 2026-08-17; `SUPABASE_URL` was
already there.) The next prod deploy then does everything: deploys the Worker,
pushes its three secrets, and syncs the same three into the Pages project for
the unsubscribe Function. Until the key exists the step SKIPS with a loud
notice and never fails the deploy. If wrangler rejects the `send_email` binding
stanza, copy the block from the dashboard's "Connect to Email Service" wrangler
tab — its spelling is authoritative.

## 5. Dry-run before the cron ever fires (v1.164.2 — the trigger is a dry run BY DEFAULT)
Until v1.164.2 this step called a LIVE SEND to every pending user a "dry-run". It is not
any more: a bare GET builds every digest, sends nothing, writes nothing, and shows you what
would go out.
```
# the whole base, nothing sent, nothing written — what tomorrow's cron would do
curl -s https://bjjgraph-digest.<your-workers-subdomain>.workers.dev \
  -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>"

# one user, still a dry run
curl -s "https://bjjgraph-digest.<your-workers-subdomain>.workers.dev/?user=<uuid>" \
  -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>"

# ONE live send, to ONE user (your own account). `send=1` without `user=` is refused —
# the base is the cron's, behind its 200-per-run ceiling; the trigger mails one person at a time.
curl -s "https://bjjgraph-digest.<your-workers-subdomain>.workers.dev/?send=1&user=<uuid>" \
  -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>"
```
A dry run returns `{mode:"dry-run", would_send, sample:[{user_id_prefix, day, subject, text}], rows,
manifest_decks, suppress_rows_seen, sent_rows_seen, attempted, capped, skipped:{reason:count}, failures}`
— the sample is at most 5 rendered mails. A live send returns the same summary with `sent`
(a returned messageId) and `attempted` (every call to the binding).
With no opt-ins yet: `rows:0, would_send:0`. A run that cannot verify something —
the public deck manifest unreachable or implausibly small, a Supabase read that fails, a row
count PostgREST will not confirm — answers 500 with the reason and sends nothing; the same
condition at 04:00 is logged as `[digest] RUN ABORTED, nothing sent: …` and the cron retries
the next morning.

Flip the toggle on your own account (Settings → Training-day email · Beta), review a few cards,
wait past local midnight, run the one-user dry run, read the sample, then `send=1&user=` —
you should get one email.

**The bearer is still the service-role key.** That is the database's master credential and
the wrong thing to be typing into a curl line. The swap to a separate `DIGEST_TRIGGER_TOKEN`
needs a new Workers secret only you can set:
```
openssl rand -hex 32 | npx wrangler secret put DIGEST_TRIGGER_TOKEN   # in workers/digest
```
and then a one-line change in `fetch()` (index.js) to compare against it — ask for that commit
once the secret exists; nothing in the repo can mint it.

## 6. Done
The cron takes over. Sends only for days with activity, only once per day per
user, at most 200 ATTEMPTS per run (a brake against one runaway run costing the
domain's deliverability — raise it in a commit that says why), honours one-click
unsubscribe (List-Unsubscribe + `/unsubscribe`), and skips the still-in-progress
day so local midnights are always respected. Every run logs one summary line:
`[digest] run mode=cron rows=N manifest_decks=N suppress_rows_seen=N
sent_rows_seen=N sent=N attempted=N capped=N deferred=N skipped={…} failures=N`.

**How a run stops itself (v1.164.3).** Each (user, day) is CLAIMED in `digest_sent`
BEFORE its mail is sent. A claim that fails — the table down, a 409, a body the Worker
cannot verify as its own insert — stops the run on the spot: `[digest] RUN STOPPED — …;
N rows left`, and the rows left are `deferred` for tomorrow. Three consecutive send
failures stop it the same way. A claimed day is never retried, even when the send then
failed: the binding may have delivered before it threw, and a lost digest is the cheap
failure. So `sent=0 attempted=0 failures=1` with a STOPPED line means "look at Supabase",
and `sent=0 attempted=3` means "look at the Email binding".

**The owner's kill switches.** A banned auth user (`banned_until` in the future — the
dashboard's Ban action), a soft-deleted one (`deleted_at`) and one whose address was
never confirmed (`email_confirmed_at` null) are never mailed; each is counted in
`skipped` by that name. After `digest_v2.sql`, a hard delete takes the row too.

**The second unsubscribe is final.** A recipient who unsubscribes, is mailed again (the
Settings toggle — or, under open signup, the row owner re-stamping the blob, which is
the abuse this closes) and unsubscribes AGAIN is locked: `digest_suppress.at` is set to
the year 9999, the run counts them as `suppressed_locked`, and nothing in the code lifts
it. The page tells them so and names coach@bjjgraph.org. To lift one by hand:
`delete from digest_suppress where user_id = '<uuid>';` (also at the foot of
`digest_v2.sql`). A refresh of the done page, or a double-click, is NOT a second
unsubscribe — only a stop that follows a mail is.

## What the email contains
Count + techniques reviewed · Game Knowledge % (+today's delta) · "at this pace:
<NEXT BELT> in ~N days" · streak line · weak-spots magazine block: the top spot
with an attributed YouTube clip when the public content chunk carries one
("Here's a great video from <who> explaining <X>"), the second spot as a
one-line extra. All numbers come from the player's own synced blob (`dayLog`,
written only while the toggle is on).
