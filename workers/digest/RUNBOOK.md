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

## 5. Dry-run before the cron ever fires
```
curl -s https://bjjgraph-digest.<your-workers-subdomain>.workers.dev \
  -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>"
```
Returns `{sent, of, failures}`. With no opt-ins yet: `{"sent":0,...,"reason":"nobody opted in"}`.
Flip the toggle on your own account (Settings → Training-day email · Beta),
review a few cards, wait past local midnight, re-run — you should get one email.

## 6. Done
The cron takes over. Sends only for days with activity, only once per day per
user, honours one-click unsubscribe (List-Unsubscribe + `/unsubscribe`), and
skips the still-in-progress day so local midnights are always respected.

## What the email contains
Count + techniques reviewed · Game Knowledge % (+today's delta) · "at this pace:
<NEXT BELT> in ~N days" · streak line · weak-spots magazine block: the top spot
with an attributed YouTube clip when the public content chunk carries one
("Here's a great video from <who> explaining <X>"), the second spot as a
one-line extra. All numbers come from the player's own synced blob (`dayLog`,
written only while the toggle is on).
