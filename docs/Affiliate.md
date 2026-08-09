# Affiliate Surface

The Systems library is BJJGraph's first revenue stream: a System is a combination of graph nodes
studied together, and the instructor who teaches that combination usually sells an instructional.
When we point a reader at one, we earn a commission.

This file is the canonical home for the three things that must never drift: the **disclosure
wording**, the **link-verification rule**, and the **funnel contract**. Commercial terms, partner
strategy and the tracking ref itself are deliberately NOT in this public repo.

Gated by `scripts/check_affiliate_surface.py` (deploy + `npm run validate:affiliate`) and by
`e2e/journeys/systems-surface.spec.ts` in a real browser.

---

## 1. The disclosure (canonical wording)

FTC 16 CFR Part 255 and the UK ASA/CAP code both require disclosure that is clear, conspicuous
and **close to the link**. The site-wide statement in `content/terms.md` is the backstop, never
the disclosure.

The exact sentence, byte-for-byte, is:

<!-- CANONICAL-DISCLOSURE:START -->

BJJGraph earns a commission if you buy through this link, at no extra cost to you. It never changes what the graph teaches.

<!-- CANONICAL-DISCLOSURE:END -->

It is rendered from **two** places, which must stay identical to the block above:

| Surface                                           | File                          | Handle                        |
| ------------------------------------------------- | ----------------------------- | ----------------------------- |
| Neural app CTA shelf (default variant)            | `neural/src/app.src.jsx`      | `[data-affiliate-disclosure]` |
| Generated System page (legacy variant / crawlers) | `templates/Systems.md.jinja2` | `p.affiliate-disclosure`      |

Rules both surfaces obey:

- The disclosure renders **above the first monetised link, inside the same block** as the links.
  In the app the disclosure node is appended to the shelf _before_ the loop that appends the
  anchors, so a paid link structurally cannot appear without it.
- Never inside a `<details>`, never behind a "show more", never scroll-gated away from the link.
- Editing the wording means editing this file **and** both copies in the same commit. The gate
  fails the build otherwise — that is the point.

## 2. No unverified URL ever renders

**Never invent, guess, or construct a product URL.** Every `affiliate_url` in
`content/Systems/*.json` must be opened and confirmed to resolve to _that exact instructional_
before it is committed. A fabricated vendor link earns nothing and breaks trust; an empty slot is
honest.

That rule is enforced by data, not by good intentions. Every product entry carries:

| Field          | Meaning                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `link_status`  | `live` (opened, confirmed, resolves to this instructional), `dead` (404 / wrong product / retired), `unverified` (nobody has checked) |
| `link_checked` | ISO date of that check                                                                                                                |

Both are **required** by `templates/Systems.json`, and **only `live` renders** — on the page
(`live_products` in the Jinja2 template) and in the app (filtered out of the Neural payload by
`scripts/regenerate_neural_data.py::_products`). A `dead` or `unverified` product degrades the
system to its no-product surface, which is a finished, teaching page (§4). A dead CTA and no CTA
earn exactly the same amount; only one of them costs the reader's trust.

Re-verify periodically: vendor handles get renamed and instructionals get retired. Verified
2026-08-09, two of three authored products were already 404 — one because the words in the handle
were in the wrong order, one because the product title did not exist in the vendor catalogue at all.

### Prices are not rendered

`price_usd` is reference data only. Vendor prices change and we cannot mirror them: on 2026-08-09
all three authored values were wrong, one by 3.6x ($97 on file, $349 at the vendor). A button
promising $97 that lands on a $349 checkout is the same broken promise as a dead link, so the CTA
label says "Get the instructional" and the vendor's own page is the only price surface.

## 3. The tracking ref and the funnel

### The ref is a deploy parameter, never content

Content ships the literal `?ref=REPLACE_ME`. `scripts/apply_affiliate_ref.py` substitutes
`$AFFILIATE_REF` into **emitted artifacts only** — `source/public/**` and the Neural
`source/quartz/static/neural/systems.json` — and hard-refuses anything under `content/`. No
secret set = WARNING, placeholder kept, exit 0, so forks and local builds work.
`scripts/check_systems_payload.py` runs _after_ the stamp and fails if a placeholder survives
once the secret IS set.

**`graph.json` is the exception that proves the rule.** It is a _committed_ artifact in a public
repo, so it must never carry an affiliate URL at all: stamping the real ref into a committed file
would publish the revenue identifier into git history forever. `regenerate_graph.py` therefore
emits products **without `affiliate_url`**, keeping `has_affiliate_url` (a boolean) so the fact
survives. Nothing read the URL from `graph.json` anyway — `renderPage.tsx` uses `len(products)`,
`trainingData.ts` ignores products entirely.

### Events (PostHog)

| Step | Event                       | Fired from                                                                                              |
| ---- | --------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1    | `related_system_card_click` | node page → system page (`affiliateTracking.inline.ts`)                                                 |
| 2    | `system_page_view`          | landed on a System page (`affiliateTracking.inline.ts`); the app's equivalent is `neural_system_opened` |
| 3    | `affiliate_clickout`        | **both** surfaces — delegated on `a[data-affiliate="true"]`                                             |

`affiliate_clickout` is the one cross-surface conversion event, with the same property shape
either way: `product_id`, `vendor`, `system_slug`, `system_name`, `affiliate_url`, `position`.
The app additionally keeps its own `neural_system_course_clicked` beat (app-shaped: `system`,
`course`, `instructor`, `product_id`, `position`) — use `affiliate_clickout` for conversion
counting, `neural_system_course_clicked` for app funnels.

Until v1.83.0 the app CTA carried neither `data-affiliate` nor UTM tags, so step 3 never fired in
the **default** variant and no campaign report could separate app clicks from page clicks.

### UTM convention

Both surfaces append exactly these, and never touch the vendor's existing query (so the `?ref=`
stamp still finds its placeholder):

```
utm_source=bjjgraph&utm_medium=affiliate&utm_campaign=systems&utm_content=<system-slug>&utm_term=<product-id>
```

`<system-slug>` is the lowercased page slug (`danaher-leg-lock-system`). The two implementations
are `scripts/regenerate_md_from_json.py::_with_utm` (page) and `app.affiliateHref()` (app).

## 4. A system with no product must still look finished

44 of 47 systems have no verified product. That is the normal case, not a defect, and neither
surface may render an empty region:

- **Page**: the `#unlock-this-system` slot is replaced by `#study-this-system` — "How do you drill
  X?" pointing at the implementation sequence, the member map and the interactive graph. All
  internal, all free. Deliberately **no** generic vendor link: a shop URL nobody verified is
  exactly the guess §2 forbids.
- **App**: no shelf, no anchor, and the detail view ends on **Drill this system** — a free action
  on our own product.

Nothing here is ever paywalled. The product stays free; affiliate links are an option the reader
can ignore without losing anything.

## 5. Open, owner-only decisions

These are commercial calls and belong to the owner — never fake them, never guess a URL to close
one:

1. Setting the `AFFILIATE_REF` repo secret (without it, every link earns nothing).
2. Which instructional attaches to which system, including replacing the two `dead` links.
3. Whether the generated page's "Mark whole system as known" button (`SystemProgress.tsx`) should
   survive, given the app deliberately refuses self-reported mastery.
