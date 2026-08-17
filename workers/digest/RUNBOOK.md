# Training-day digest — owner runbook (v1.105.7)

Everything code-side is committed. These are the steps only you can do, in order.
Total time ≈ 20 minutes. Nothing sends until step 6, and nothing sends to anyone
who has not flipped the Beta toggle in Settings.

## 1. THE GATE: Cloudflare Email Sending availability
Dashboard → your account → **Email** → look for **Email Sending** (the 2025-beta
service for sending to arbitrary recipients — NOT classic "Email Routing", which
only forwards inbound). If it exists:
- Add sender domain `bjjgraph.org`, verify (it adds DKIM/SPF DNS records — your
  DNS is already on Cloudflare, so it's one click each).
- Create sender address `coach@bjjgraph.org`.

**If Email Sending is NOT available on the account yet**: stop here and tell me —
that is the fallback decision you kept for yourself (a third-party provider or
waiting for the rollout). The Worker fails loudly, never silently, until then.

## 2. Supabase tables (2 min)
Supabase dashboard → SQL editor → paste and run `supabase/digest_v1.sql`
(creates `digest_sent` + `digest_suppress`, service-role-only).

## 3. Deploy the Worker (3 min)
```
cd workers/digest
npx wrangler deploy
npx wrangler secret put SUPABASE_URL                 # https://<project>.supabase.co
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY    # Supabase → Settings → API → service_role
npx wrangler secret put UNSUB_HMAC_SECRET            # any long random string, e.g. `openssl rand -hex 32`
```
The cron (04:00 UTC daily) is in wrangler.toml. If `wrangler deploy` rejects the
`send_email` binding, that's the step-1 gate again.

## 4. Unsubscribe Function env vars (2 min)
Cloudflare dashboard → Pages → bjjgraph → Settings → Environment variables →
add the SAME three values (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`UNSUB_HMAC_SECRET`) for Production. The function is `functions/unsubscribe.js`,
already in the repo, deployed with the next Pages deploy.

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
