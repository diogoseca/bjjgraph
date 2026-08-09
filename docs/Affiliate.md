# Affiliate Revenue (Systems)

The **Systems** pages are the money surface. A system is a named game (Danaher Leg Locks, Gordon
Ryan Passing) plus the graph nodes it teaches; the instructional that *built* that system is the
natural thing to sell next to it. Everything else on the site earns nothing, by design.

**Positioning (do not drift from this):**

- The product stays **free for users**. No feature that exists today ever moves behind a paywall,
  and no content is ever gated behind an account.
- Revenue today = **affiliate commissions** on instructionals. Later: **gyms**. Later still:
  **subscriber-only expensive-compute** features (VLM, video processing) — new capability that costs
  real money per use, never a fence around something that used to be free.
- The affiliate link is a recommendation, not an ad slot. If the instructional would not genuinely
  teach the system on the page, it does not belong there.

---

## 1. What the owner must do (once)

**Step 1 — join the programme.** Open <https://bjjfanatics.com>, follow the affiliate /
partner link in the site footer, and apply. Take the sign-up URL from the live footer; do not use a
URL from memory or from an AI — affiliate networks move.

You will be issued **one of two things**:

| What you get | What to do |
|---|---|
| A **ref / tracking id** (an opaque token used as `?ref=<id>`) | Exactly what this pipeline expects. Continue to Step 2. |
| A **full per-link redirect URL** on a network domain (ShareASale/Refersion style, `...?urllink=<encoded product url>`) | The `?ref=` model does not fit. Say so before adding products — `affiliate_url` then has to hold the whole redirect URL per product, and `scripts/apply_affiliate_ref.py` has nothing to stamp. Do not improvise a hybrid. |

**Step 2 — store the id as a GitHub secret.** It is a deployment parameter, never a committed
value: this repo is public, so a committed ref would live in every fork and in git history forever.

```bash
gh secret set AFFILIATE_REF --repo diogoseca/bjjgraph   # paste the id, then Ctrl-D
```

or GitHub → Settings → Secrets and variables → Actions → New repository secret, name
`AFFILIATE_REF`.

One secret feeds **both** `deploy.yaml` (bjjgraph.org) and `deploy-dev.yaml` (the dev preview) —
the preview is publicly reachable, so its links must be attributable too. Preview traffic is
distinguishable downstream by `utm_content`.

Accepted values: 1–64 characters of `A-Z a-z 0-9 . _ ~ % -`. Anything else fails the deploy step on
purpose — the id is interpolated into an `href`, so a mis-pasted value would ship broken (or
injectable) product links.

**Step 3 — verify one deploy.**

```bash
curl -s https://bjjgraph.org/Systems/Danaher-Leg-Lock-System | grep -o 'bjjfanatics[^"]*' | head -1
```

The output must contain your ref and **must not** contain `REPLACE_ME`. Then click the link and
confirm the purchase lands in your affiliate dashboard. Until a real click is attributed, assume
nothing works.

---

## 2. How a product URL is formed

Three stages, three owners:

1. **Authored** — `content/Systems/<System>.json` → `products[].affiliate_url` holds the real vendor
   product URL with the literal placeholder:
   `https://bjjfanatics.com/products/enter-the-system-leglocks-by-john-danaher?ref=REPLACE_ME`
2. **Rendered** — `templates/Systems.md.jinja2` pipes it through the `with_utm` filter
   (`scripts/regenerate_md_from_json.py::_with_utm`), which appends only `utm_*` and never touches
   the vendor's own query:
   `&utm_source=bjjgraph&utm_medium=affiliate&utm_campaign=systems&utm_content=<system-slug>&utm_term=<product-id>`
3. **Deployed** — `scripts/apply_affiliate_ref.py` (a step in both deploy workflows, after the build
   and before the Cloudflare upload) swaps `REPLACE_ME` for `$AFFILIATE_REF` in the **emitted
   artifacts only**: `source/public/**` and `source/quartz/static/neural/systems.json`. It never
   rewrites `content/Systems/*.json`.

Result:
`https://bjjfanatics.com/products/enter-the-system-leglocks-by-john-danaher?ref=YOURREF&utm_source=bjjgraph&utm_medium=affiliate&utm_campaign=systems&utm_content=danaher-leg-lock-system&utm_term=danaher-leglocks-enter-the-system`

With no `AFFILIATE_REF` set (local build, fork, someone else's PR) the placeholder simply survives:
the step prints a WARNING and exits 0. A missing ref costs one deploy's attribution; a failed build
costs the deploy.

---

## 3. Adding a product to a system

Edit the system's **JSON** (never the generated `.md`) and add to the `products` array:

```json
"products": [
  {
    "id": "danaher-leglocks-enter-the-system",
    "title": "Enter The System: Leglocks",
    "instructor": "John Danaher",
    "vendor": "BJJFanatics",
    "affiliate_url": "https://bjjfanatics.com/products/enter-the-system-leglocks-by-john-danaher?ref=REPLACE_ME",
    "image": "https://placehold.co/640x360/1e293b/ffffff?text=Enter+The+System%3A+Leglocks",
    "blurb": "The complete leg-lock system that defined modern no-gi — ashi garami entries, controls, and breaking mechanics, taught step by step.",
    "price_usd": 77
  }
]
```

Rules:

- **Every product URL is verified by hand, never generated.** Open it in a browser, confirm it
  resolves to that exact instructional by that exact instructor, then paste it. Do not assemble one
  from a slug pattern and do not let an LLM produce one. A fabricated `bjjfanatics.com` link is a
  broken promise to someone who trusted the recommendation — and it earns nothing.
- **Keep `?ref=REPLACE_ME` in the JSON.** Pasting the real ref here commits it to a public repo.
- `id` — stable slug; it becomes `utm_term` and the PostHog `product_id`. Renaming it after launch
  breaks funnel history.
- `image` — `placehold.co` is a placeholder; `validate_json.py` warns until a real cover is used.
  Only use an image you are permitted to hotlink (the vendor's own product image).
- `price_usd` — optional integer, rendered as "Get it · $77". Stores change prices; re-check when
  you touch the entry, or drop the field.
- The card advertises "Unlocks N techniques in this system", where N comes from `related_content` —
  so a system with a thin `related_content` list undersells itself.

Then:

```bash
python3 scripts/validate_json.py --file "content/Systems/Danaher Leg Lock System.json"
npm run regenerate:md        # regenerate the page from JSON
```

---

## 4. Disclosure is mandatory

US **FTC** endorsement guides (16 CFR Part 255) and the UK **ASA/CAP** code both require a
disclosure that is *clear, conspicuous, and close to the link*. A terms page is **not** sufficient
on its own — `content/terms.md` §8 and `content/privacy.md` already carry the site-wide statement,
and that is the backstop, not the disclosure.

**Render this sentence, verbatim, on every surface that shows an affiliate link:**

> BJJGraph earns a commission if you buy through this link, at no extra cost to you. It never
> changes what the graph teaches.

Where it must live:

- **System pages** — inside the `Unlock This System` section, directly under the heading and
  **above** the product card, so it cannot be missed by someone who only reads the card
  (`templates/Systems.md.jinja2`).
- **Neural app** — in the same block as the product call-to-action in the system sheet
  (`neural/src/app.src.jsx`), visible without expanding anything.
- **Terms / privacy** — already present; keep them consistent with the sentence above.

Also required and already in place on the page template: `rel="sponsored nofollow noopener"` on
every affiliate anchor (Google's link-attribution requirement). Keep it on any new surface.

Check the current state before shipping a ref:

```bash
grep -rn -i "commission" templates/ neural/src/ content/terms.md
```

As of v1.77.x this returns **only** `content/terms.md` — the proximate disclosure on the page and in
the app does not exist yet. Ship it before the first real ref goes live, not after.

---

## 5. The backlog

**3 of 47 systems carry a product** (Danaher Leg Lock, Gordon Ryan Passing, Marcelo Garcia
X-Guard). The other 44 have none, so 44 pages currently monetise nothing:

```bash
python3 - <<'PY'
import json, pathlib
missing = [p.stem for p in sorted(pathlib.Path("content/Systems").glob("*.json"))
           if not json.loads(p.read_text()).get("products")]
print(len(missing), "systems with no product:"); print("\n".join(missing))
PY
```

Fill them in order of traffic (PostHog → Content Performance), one verified link at a time. A system
with no matching instructional keeps an empty `products` array — an unrelated course is worse than
nothing.
