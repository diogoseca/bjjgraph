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
 * THE GZIP FIGURE IS NO LONGER A CEILING (v1.189.0, owner's call). It is governed by the
 * three-band policy in tests/artifacts/payload_policy.json — a target it may sit above, an action
 * threshold it may not cross, and a cap on how much ONE change may add. scripts/_payload_policy.py
 * carries the rationale and the owner's own words; scripts/_payload_policy.js is the twin this
 * spec calls, and tests/payload_policy.test.mjs pins the two equal. `first_hand_raw_bytes` and
 * `boot_chunk_requests` stay plain hard ceilings in budget_neural.json.
 *
 * WHAT THE DELTA IS MEASURED ON, AND WHY IT IS NOT THE TOTAL. The bands judge every byte. The
 * delta cap judges `first_hand_gzip_core_bytes` = the total MINUS /postscript.js MINUS the
 * per-node chunks, because those two are the only parts of this number that move without anybody
 * changing any code, and a cap that charges for them is a cap that false-reds — which here means
 * a skipped deploy and a stale preview, measured twice already (v1.173.1, v1.175.1).
 *   · /postscript.js — the deploy bakes the PostHog snippet into it and no local or PR build does:
 *     78,095 B there against 75,641 keyless, ~1,060 B of it in gzip. Its own hard ceiling lives in
 *     budget_site.json (bundles), so removing it from the DELTA loses no coverage.
 *   · the per-node chunks — which decks and dossier the pinned start draw pulls. Not hypothetical:
 *     between v1.175.0 and v1.177.0 the pinned start moved from "Gogoplata Control Top" to
 *     "K-Guard Top" and this measurement swung by ~12,900 B gzip with 6 fewer requests, for
 *     reasons that had nothing to do with payload weight. Their size is ratcheted by
 *     check_payload_budget.py (chunk_max_bytes) and their COUNT by `boot_chunk_requests` below,
 *     so removing them from the delta leaves nothing unwatched.
 * Both exclusions are COUNTED and asserted non-empty rather than silently filtered: a rule that
 * matches nothing must not read the same as a rule that matched and found nothing (CLAUDE.md §6.6).
 *
 * The companion browserless ratchet is scripts/check_payload_budget.py ("neural eager set"), which
 * measures the same weight off the built tree so CI gates without a browser.
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
const POLICY = resolve(__dirname, "../../tests/artifacts/payload_policy.json")
const budget = JSON.parse(readFileSync(BUDGET, "utf8"))
// CommonJS on purpose — the repo has no `"type": "module"`, so Playwright transpiles this file's
// imports to require() and an .mjs twin would fail at collection time.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const bands = require("../../scripts/_payload_policy.js")
const GATE = "e2e/journeys/payload-first-hand.spec.ts" // how this gate names itself in the policy

// The chunk space, spelled the same way scripts/check_payload_budget.py spells it (CHUNK_DIRS),
// minus the `_`-prefixed manifests, which the app cannot boot without and which are therefore
// EAGER on both sides. Three spellings of one rule would be two too many; if a fourth chunk
// directory is ever added it must be added in both places, and corpus_census will not catch it.
const CHUNK_RE = /^\/static\/neural\/(?:flashcards|content|submission-details)\/(?!_)[^/]+$/
const POSTSCRIPT = "/postscript.js"

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

  // ── the CORE subtotal the delta cap is measured on (see the header) ────────────────────────
  const bare = (u: string) => path(u).split("?")[0]
  const chunkRows = rows.filter((r) => CHUNK_RE.test(bare(r.url)))
  const postRows = rows.filter((r) => bare(r.url) === POSTSCRIPT)
  const excluded = [...chunkRows, ...postRows].reduce((s, r) => s + r.gzip, 0)
  const coreGzip = gzip - excluded

  mkdirSync(resolve(REPORT, ".."), { recursive: true })
  writeFileSync(
    REPORT,
    JSON.stringify(
      {
        _meta: {
          note:
            "Written by e2e/journeys/payload-first-hand.spec.ts. OBSERVED ONLY — nothing here is a " +
            "threshold. first_hand_raw_bytes and boot_chunk_requests are ceilinged in " +
            "budget_neural.json; first_hand_gzip_bytes is judged by the three-band policy in " +
            "payload_policy.json, whose delta cap reads first_hand_gzip_core_bytes from this file " +
            "when a baseline is accepted.",
          measured_at: new Date().toISOString(),
        },
        request_count: rows.length,
        first_hand_raw_bytes: raw,
        first_hand_gzip_bytes: gzip,
        // total minus /postscript.js (analytics injection differs local vs deploy) minus the
        // per-node chunks (which ones depends on where the pinned draw lands). The figure the
        // delta cap compares; the bands still judge first_hand_gzip_bytes above.
        first_hand_gzip_core_bytes: coreGzip,
        excluded_from_core: {
          postscript_gzip: postRows.reduce((s, r) => s + r.gzip, 0),
          chunk_gzip: chunkRows.reduce((s, r) => s + r.gzip, 0),
          chunk_requests: chunkRows.length,
          paths: [...postRows, ...chunkRows].map((r) => bare(r.url)).sort(),
        },
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
      `[first-hand] core (delta basis) ${coreGzip.toLocaleString()} B — excludes ${postRows.length} postscript + ` +
      `${chunkRows.length} per-node chunk request(s), ${excluded.toLocaleString()} B\n` +
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

  // Deferred classification is a behavior, not a budget exclusion. Even a small index that
  // fits under the byte ceiling must wait until the player opens Explore/search.
  expect(
    [...requested].filter((u) => /\/aliases\.json(?:\?|$)/.test(u)).map(path),
    "the alias index is never requested before the first playable hand",
  ).toEqual([])

  expect(banned, "a monolith payload is back on the boot path").toEqual([])
  expect(raw, `raw bytes to first hand (heaviest: ${heaviest})`).toBeLessThanOrEqual(
    budget.first_hand_raw_bytes,
  )

  // ── THE EXCLUSIONS, COUNTED ───────────────────────────────────────────────────────────────
  // Both subtractions above are asserted to have matched something. A filter that matches nothing
  // subtracts zero and reads exactly like a filter that matched and found nothing on the boot
  // path — the failure class with 17 recorded instances in this repo (CLAUDE.md §6.6). If either
  // count is 0 the core subtotal is not the number this spec says it is, whatever it sums to.
  expect(postRows.map((r) => bare(r.url)), "the boot path must fetch /postscript.js exactly once — the core subtotal subtracts it by name").toEqual([POSTSCRIPT])
  expect(chunkRows.length, "the boot path fetched NO per-node chunk — either the app stopped warming decks, or CHUNK_RE stopped matching the chunk space and the core subtotal is silently the total").toBeGreaterThan(0)
  // The COUNT of chunk requests is the piece the delta cap cannot see, so it gets its own hard
  // ceiling: a regression that warmed 30 decks at boot would add ~60 KB gzip, and the delta cap
  // — which excludes chunks by design — would report nothing. 12 = NG_PREFETCH_CAP (10, the deck
  // warm-up cap in app.src.jsx) plus the two non-deck chunk kinds a boot can pull (content,
  // submission-details). Observed: 4 today, 6 before the v1.177.0 start-position move.
  expect(typeof budget.boot_chunk_requests, "budget_neural.json must carry boot_chunk_requests — deleting it would leave the chunk-count guard comparing against undefined, which is a guard nobody can read").toBe("number")
  expect(chunkRows.length, `per-node chunk requests on the boot path (${chunkRows.map((r) => bare(r.url)).join(", ")})`).toBeLessThanOrEqual(budget.boot_chunk_requests)

  // ── THE THREE-BAND POLICY ─────────────────────────────────────────────────────────────────
  // budget_neural.json must NOT carry a gzip ceiling any more: a stale hard ceiling beside a soft
  // policy is silent shadowing — only the stricter of the two is ever seen, and which one that is
  // changes with every ship.
  expect(budget.first_hand_gzip_bytes, "first_hand_gzip_bytes moved to payload_policy.json; a ceiling left in budget_neural.json would shadow the policy").toBeUndefined()

  const doc = bands.load(POLICY)
  const mine = bands.metricsFor(doc, GATE)
  expect(Object.keys(mine), "the policy must assign exactly this metric to this gate").toEqual([
    "first_hand_gzip_bytes",
  ])
  const verdict = bands.evaluate("first_hand_gzip_bytes", mine.first_hand_gzip_bytes, gzip, coreGzip)
  // A warn is an indication, not a gate — it prints and passes, which is the whole point of the
  // soft ceiling. Anything in `failures` is the action threshold or the delta cap, both hard.
  for (const line of verdict.lines) console.log(`[first-hand] ${line}`)
  console.log(
    `[first-hand] policy: 1 metric checked against a committed baseline · verdict ${verdict.verdict}`,
  )
  expect(verdict.failures, "the payload policy").toEqual([])
  expect(verdict.delta, "the delta cap must have run against a real baseline, not been skipped").toEqual(
    expect.any(Number),
  )
})
