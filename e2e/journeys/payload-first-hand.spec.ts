import { test, expect } from "@playwright/test"
import { gzipSync } from "node:zlib"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { resolve } from "node:path"

/**
 * BYTES TO FIRST PLAYABLE HAND — the field-data gate. @curated
 *
 * Cloudflare Observatory, real users: LCP P75 13,764ms with 80% Poor, TTFB P75 2,461ms, CLS
 * 0.017 (100% Good). Perfect CLS with terrible LCP is the signature of a DELIVERY problem, not
 * a rendering one — and the delivery problem was that a first-time visitor pulled 39.3MB raw /
 * 10.1MB gzip of Neural data before they could make a single move.
 *
 * This spec measures that number the only way that cannot be argued with: it drives a REAL
 * boot (no DSL, no fulfilled buffers, no aborted payloads — those exist to make gameplay
 * journeys hermetic and would fake this measurement), and sums every byte the page requested
 * up to the instant the first hand of option cards exists in the DOM.
 *
 * WHY "REQUESTED", NOT "FINISHED": the app deals the hand without waiting for its deck payload,
 * so a finished-only metric would score a 16MB background download as free — while that download
 * is precisely what starves the visitor's connection and wrecks their LCP. Everything the page
 * asked for before the hand is on the bill.
 *
 * Ceilings live in tests/artifacts/budget_neural.json. Shrinking passes; raising a ceiling is a
 * deliberate, separately justified commit. The companion browserless ratchet is
 * scripts/check_payload_budget.py ("neural eager set"), which measures the same weight off the
 * built tree so CI gates without a browser.
 *
 * A LOCAL PASS IS NOT EVIDENCE OF A CI PASS (v1.139.3). This gate measures ~1KB LIGHTER on a
 * developer machine than in CI for the SAME commit, because the CI build bakes configuration a
 * local build has no secrets for — e2e/dsl.ts records the same asymmetry from the other side.
 * Measured on the merge that exposed it: 384,309 B gzip locally against 385,369 B in CI, a
 * 1,060 B gap under a 385,000 B ceiling. The local run therefore cleared it by 691 B while the
 * deploy it exists to protect went red by 369 B — and a red curated gate SKIPS the deploy step,
 * so it presents as a stale preview rather than as a failing test. Treat anything within ~1.5KB
 * of the ceiling as unknown until CI has spoken, and never read a local green here as clearance.
 *
 * PINNED, NOT RIGGED (v1.80.5). Everything about the DELIVERY stays real — real network, real
 * chunk fetches, no test mode, no fulfilled buffers. The only thing pinned is the app's first
 * random draws, via the production pre-boot rig hook (`window.__NEURAL_RIG`, see boot()): the
 * starting position decides which per-node chunks the boot pulls, so an unpinned draw made this
 * gate a dice roll against a ~4% margin — it would have flaked long before it caught a
 * regression. With the draw pinned the measurement repeats to the byte, and the margin in
 * budget_neural.json covers build-to-build content drift instead of paying for run-to-run noise.
 */

const BUDGET = resolve(__dirname, "../../tests/artifacts/budget_neural.json")
const REPORT = resolve(__dirname, "../../tests/artifacts/first_hand_payload.json")
const budget = JSON.parse(readFileSync(BUDGET, "utf8"))

// Payloads that must NEVER be on the boot path again. The ceilings alone are not enough of a
// guard: they are numbers and numbers drift, whereas "the 16MB monolith is back" is a fact.
// NB `flashcards.json` has not existed since v1.80.4 — the ban is on the MONOLITH ever
// coming back under any name, so it lists the retired filename AND the shape that would
// replace it. A pattern that can never match is not a gate.
const BANNED_ON_BOOT = [/\/flashcards\.json(\?|$)/, /\/technique-content\.js(\?|$)/]

test("@curated a first-time visitor reaches a playable hand inside the payload budget", async ({
  page,
}) => {
  type Rec = { url: string; raw: number; gzip: number }
  const requested = new Set<string>()
  const snapshotMethods: string[] = []
  const bodies: Promise<Rec | null>[] = []
  let frozen = false

  // pin the first roll's draws (see the header): index 0 of the deck-bearing positions, top,
  // fixed clock and opponent skill. Nothing about the network is faked by this.
  await page.addInitScript(() => {
    ;(window as any).__NEURAL_RIG = {
      "start-pos": [0],
      role: [0],
      "ai-skill": [0.5],
      "max-moves": [0.5],
    }
  })

  // hermetic, and honest about it: only localhost bytes are counted, so blocking third parties
  // (PostHog/Supabase/Google Fonts are baked into CI builds) cannot flatter the number. Fonts
  // FULFILL rather than abort — a failed neural.css @import makes prescript drop the stylesheet.
  await page.route("**/*", (r) => {
    const u = r.request().url()
    if (/^(http:\/\/localhost|http:\/\/127\.|data:|blob:|about:)/.test(u)) return r.continue()
    if (/fonts\.(googleapis|gstatic)\.com/.test(u))
      return r.fulfill({ status: 200, contentType: "text/css", body: "" })
    return r.abort()
  })

  // status per URL, first response wins — read below to prove the boot path fetches nothing that
  // does not exist. Cheap here, and the only place that can see it.
  const status = new Map<string, number>()
  page.on("request", (req) => {
    if (!frozen) requested.add(req.url())
    if (new URL(req.url()).pathname === "/__snapshot/ping") snapshotMethods.push(req.method())
  })
  page.on("response", (res) => {
    const url = res.url()
    if (!/^http:\/\/(localhost|127\.)/.test(url)) return
    if (!status.has(url)) status.set(url, res.status())
    bodies.push(
      res
        .body()
        .then((b) => ({ url, raw: b.length, gzip: gzipSync(b, { level: 9 }).length }))
        .catch(() => null),
    )
  })

  await page.goto("/", { waitUntil: "commit" })
  // the hand: option cards carry data-tech (journeys click them by technique title). Its
  // presence IS "playable" — the user can now make a move.
  await page.locator("[data-tech]").first().waitFor({ state: "attached", timeout: 180_000 })
  frozen = true
  // which state the pinned draw landed on — recorded so a moved number can be explained rather
  // than guessed at (a content pass that reorders the position list changes the pinned start)
  const startPosition = await page.evaluate(() => {
    const a = (window as any).__neural
    return a && a.nodes && a.nodes[a.currentPos] ? a.nodes[a.currentPos].t : null
  })

  // let the in-flight bodies (counted above) resolve before we add them up
  await page.waitForTimeout(2_000)
  const settled = (await Promise.all(bodies)).filter((r): r is Rec => !!r)

  // one row per URL, and only URLs the page asked for before the hand existed
  const byUrl = new Map<string, Rec>()
  for (const r of settled) if (requested.has(r.url) && !byUrl.has(r.url)) byUrl.set(r.url, r)

  const path = (u: string) => u.replace(/^http:\/\/[^/]+/, "")

  // A request whose body we could not read must NEVER score as free — that is how a 16MB
  // monolith hides. (It happened on the first RED run: Playwright's response.body() rejects for
  // a response still streaming when we stop watching, and flashcards.json — requested well
  // before the hand — silently vanished from the total.) Charge it at its on-disk size instead:
  // that is exactly what the server was in the middle of sending.
  const unmeasured = [...requested].filter(
    (u) => /^http:\/\/(localhost|127\.)/.test(u) && !byUrl.has(u),
  )
  const estimated: string[] = []
  for (const u of unmeasured) {
    const rel = path(u).split("?")[0].replace(/^\//, "")
    try {
      const buf = readFileSync(resolve(__dirname, "../../source/public", rel || "index.html"))
      byUrl.set(u, { url: u, raw: buf.length, gzip: gzipSync(buf, { level: 9 }).length })
      estimated.push(path(u))
    } catch {
      /* not a static file (e.g. the dev-serve snapshot endpoint) — nothing was sent from disk */
    }
  }
  const rows = [...byUrl.values()].sort((a, b) => b.raw - a.raw)
  const raw = rows.reduce((s, r) => s + r.raw, 0)
  const gzip = rows.reduce((s, r) => s + r.gzip, 0)

  mkdirSync(resolve(REPORT, ".."), { recursive: true })
  writeFileSync(
    REPORT,
    JSON.stringify(
      {
        _meta: {
          note: "Written by e2e/journeys/payload-first-hand.spec.ts. Observed only — the ceilings live in budget_neural.json.",
          measured_at: new Date().toISOString(),
        },
        request_count: rows.length,
        first_hand_raw_bytes: raw,
        first_hand_gzip_bytes: gzip,
        start_position: startPosition,
        charged_from_disk: estimated,
        heaviest: rows.slice(0, 15).map((r) => ({ path: path(r.url), raw: r.raw, gzip: r.gzip })),
      },
      null,
      1,
    ) + "\n",
  )

  const heaviest = rows
    .slice(0, 6)
    .map((r) => `${path(r.url)} ${r.raw.toLocaleString()}B`)
    .join(", ")
  console.log(
    `[first-hand] start "${startPosition}" · ${rows.length} requests · raw ${raw.toLocaleString()} B · gzip ${gzip.toLocaleString()} B\n` +
      `[first-hand] heaviest: ${heaviest}` +
      (estimated.length ? `\n[first-hand] charged from disk: ${estimated.join(", ")}` : ""),
  )

  const banned = rows.filter((r) => BANNED_ON_BOOT.some((re) => re.test(r.url))).map((r) => path(r.url))
  // ── NOTHING ON THE BOOT PATH MAY 404 ────────────────────────────────────────────────────────
  // The byte total cannot carry this claim on its own. A 404 here is served as 404.html — 27,788 B
  // that LOOKS like a real payload — so a doomed fetch reads as weight rather than as a mistake,
  // and removing one reads as an optimisation. Worse, the budget is a ceiling: whether a wasted
  // fetch turns the gate red depends entirely on how much headroom happens to exist that week.
  // When `richContentFor` was hashing a position's display title (all 136 position hub titles end
  // "… Top", so the chunk key never resolved — §6.2), reverting the fix moved the total by 5,759 B
  // against 5,497 B of headroom: red by 262 B in CI and GREEN LOCALLY, inside this spec's own
  // documented ~1,060 B local-vs-CI gap. A gate whose mutant passes on the machine the work
  // happens on is not a gate, so the claim gets its own assertion, which is exact and free.
  //
  // The snapshot probe is the one legitimate 404: `ensureButton` is hostname-gated on isDevHost()
  // and short-circuits BEFORE the probe in production, but `localhost` is a dev host, so under
  // `npx serve` it receives 404. HEAD checks availability without downloading 404.html. It is excluded BY NAME and counted, so the
  // exclusion can never silently swallow a real one (§6.6 — a positive count, never a bare filter).
  // Build-gating the snapshot button out of production is expected to take this to 0; that is a
  // deliberate edit here, not a surprise.
  const notFound = [...requested].filter((u) => status.get(u) === 404).map(path)
  const harnessOnly = notFound.filter((p) => p.startsWith("/__snapshot/"))
  const realNotFound = notFound.filter((p) => !p.startsWith("/__snapshot/"))
  expect(harnessOnly, "the harness-only snapshot probe 404s exactly once").toHaveLength(1)
  expect(snapshotMethods, "the availability probe must not download the custom 404 page").toEqual(["HEAD"])
  expect(realNotFound, "no request on the boot path may 404").toEqual([])

  expect(banned, "a monolith payload is back on the boot path").toEqual([])
  expect(raw, `raw bytes to first hand (heaviest: ${heaviest})`).toBeLessThanOrEqual(
    budget.first_hand_raw_bytes,
  )
  expect(gzip, "gzip bytes to first hand").toBeLessThanOrEqual(budget.first_hand_gzip_bytes)
})
