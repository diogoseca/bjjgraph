import { test, expect, type Page, type BrowserContext } from "@playwright/test"

/**
 * OAUTH REDIRECT-BACK COMPLETION — the only gate on the only code that finishes a Google
 * sign-in. @curated
 *
 * WHY THIS FILE EXISTS, AND WHY IT DID NOT UNTIL NOW.
 *
 * `authUI.inline.ts` has two jobs. The first — installing the `window.__bjjAuth` façade by
 * being the sole static importer of `scripts/supabase.ts` — IS gated: legacy-gone.spec.ts has
 * three @curated tests that enumerate all eleven façade functions and call two of them.
 *
 * The second job is NOT, and it is the one that silently breaks real users:
 *
 *     authUI.inline.ts:35-48
 *       hasAuthRedirectParams()  →  /[?&#](code|access_token|error_description)=/
 *       document.addEventListener("nav", …)
 *         if (!window.__SUPABASE_URL) return
 *         if (isAuthenticated() || hasAuthRedirectParams()) await ensureClientInitialized()
 *
 * After a Google PKCE round-trip the browser lands back on the site with `?code=`. The Supabase
 * SDK exchanges that code only when a client EXISTS at that moment (`detectSessionInUrl`).
 * Neural's own `_initAuth` calls `ensureClientInitialized()` only when `isAuthenticated()` is
 * already true, and `isAuthenticated()` is a synchronous localStorage read — necessarily false
 * immediately after a redirect-back. So the `hasAuthRedirectParams()` arm is the entire
 * mechanism. Delete it and Google sign-in never completes, for everyone, forever.
 *
 * Before this file, a grep for `?code=|access_token|error_description|hasAuthRedirectParams`
 * across e2e/ and tests/ returned exactly ONE hit and it was the string "signInWithGoogle".
 * A replacement could ship the façade, drop lines 35-48, and pass the entire @curated gate.
 *
 * ── THE CONFIGURATION TRAP, which is WHY this branch was never gated ────────────────────
 *
 * `componentResources.ts:194` guards the config injection on `cfg.supabase?.url`, and
 * `quartz.config.ts:23` reads `process.env.SUPABASE_URL || ""`. Every local build, every dev
 * build and the programme's golden tree run with SUPABASE_URL unset, so
 * `window.__SUPABASE_URL` is NEVER EMITTED and the listener above early-returns on line 41.
 * Measured on the golden page: `grep -c '__SUPABASE_URL' build0/Positions/Mount/Top.html` → 0.
 *
 * DO NOT CONFIRM THIS AGAINST THE BUNDLE WITH THE OBVIOUS GREP — IT LIES (D-54). On the golden
 * `postscript.js`, `grep -c '__SUPABASE_URL'` returns **1**, which reads like confirmation that
 * the config is there. It is not. Two traps compound:
 *   - `grep -c` counts LINES, and a minified bundle is one long line (postscript.js is 21 lines
 *     total), so it returns 1 for four occurrences exactly as it would for four hundred. Use
 *     `grep -o … | wc -l`.
 *   - Even the honest count is misleading: there are **4** occurrences and **0** assignments.
 *     All four are READS, from supabase.ts via this file — `isConfigured()`, `authStorageKey()`,
 *     `createClient(...)`, and the nav listener. The CONSUMER is in the bundle; the PRODUCER at
 *     `componentResources.ts:194-199` never ran.
 * Only matching the assignment tells producer from consumer:
 *     grep -o 'window\.__SUPABASE_URL *=' postscript.js | wc -l   → 0
 * This is CLAUDE.md §6.6 with the polarity REVERSED: not absence producing a plausible answer,
 * but a DIFFERENT feature's presence producing a plausible answer for the one you asked about.
 * It beats the obvious check rather than the missing one.
 *
 * The branch is therefore UNREACHABLE on the build a test normally runs against. That is the
 * whole reason nobody could gate it, and it is the same shape as `validate:analytics:nokey`:
 * a direction no ordinary run can exercise, so it needs a fixture that supplies it. THIS SPEC
 * SUPPLIES THE CONFIG ITSELF, via addInitScript, before any page script runs. It therefore
 * gates `authUI.inline.ts`'s LOGIC on any build, keyed or keyless.
 *
 * ── WHAT THE HARNESS DOES AND DOES NOT SERVE (CLAUDE.md §6.4) ───────────────────────────
 *
 * Every cross-origin request is ABORTED except the one Supabase SDK URL, which is fulfilled
 * with a recording stub. Two consequences a reader must hold:
 *   - No real `@supabase/supabase-js` is ever loaded, so nothing here asserts anything about
 *     the SDK's behaviour. What is asserted is that OUR code creates a client, at the right
 *     moment, with `detectSessionInUrl` on — which is exactly and only what makes the SDK
 *     exchange the code.
 *   - If `supabase.ts:114`'s CDN URL ever changes, the stub route matches nothing, the real
 *     fetch is aborted, and these tests go RED rather than silently green. That is deliberate:
 *     a substitution rule whose `from` string is absent must fail loudly, never match nothing.
 *   - `sdkFetched` is asserted positively in test 1 for the same reason — a green here must
 *     never be reachable by "the harness never ran".
 *
 * ── WHY EACH TEST EARNS ITS PLACE (the mutants, in tests/artifacts/_presentation_mutants.sh) ──
 *
 * MEASURED, not predicted. Each mutant declares what must go red AND what must stay green, and
 * the script counts a mutant that reddens everything as a failure rather than a kill:
 *
 *   M1 `||hasAuthRedirectParams()` dropped (R4's exact defect)  → 1,2 RED · 3 GREEN
 *   M2 regex narrowed to `code` only                            → 2 RED · 1,3 GREEN
 *   M3 `isAuthenticated()||` dropped                            → 3 RED · 1,2 GREEN
 *   M4 `detectSessionInUrl: false`                              → 1 RED · 3 GREEN (2 unconstrained:
 *                                                                 it counts clients, not options)
 *   M5 the whole `nav` listener removed                         → 1,2,3 RED
 *
 * TWO OF THESE SURVIVED THE FIRST TIME, AND THAT IS RECORDED HERE BECAUSE IT CHANGED THE SPEC.
 * Against the page with the neural bundle running, M3 and M5 both left test 3 GREEN: the Neural
 * app independently calls ensureClientInitialized() on the signed-in path, so test 3 was passing
 * on a build with authUI's entire listener deleted. Test 3 now blocks the bundle. A third mutant
 * (an earlier M1 that turned the `||` into `&&`) was mis-written rather than survived — it is a
 * different defect and legitimately reddens test 3 too.
 *
 * ── NON-KILLS. What this spec does NOT cover (CLAUDE.md §6.9) ───────────────────────────
 *
 *  1. THE INJECTION SITE ITSELF IS STILL UNGATED. This spec supplies `window.__SUPABASE_URL`,
 *     so a replacement that drops `componentResources.ts:194-199` — never emitting the config
 *     on a REAL deploy — keeps this spec green. That surface belongs to the emitter stream and
 *     cannot be gated from a keyless build at all. Do not read this file as covering it.
 *  2. Nothing here proves the code is actually exchanged for a session: that is the SDK's job
 *     and the stub replaces the SDK. The claim is "a client exists, with the exchanging option
 *     set, at redirect-back time", which is the part this repo owns.
 *  3. No assertion about the `redirectTo` origin in `signInWithGoogle` (supabase.ts:197).
 *
 * These tests deliberately do NOT use the journey() DSL: the subject is the emitted page and
 * its script bundle, not the game loop. They run against the real built site.
 */

/** supabase.ts:114 — the exact URL loadSDK() appends. Changing it there must redden this file. */
const SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"

/** Values the spec injects. The ref ("authspec") is what authStorageKey() derives the
 *  localStorage key from: `sb-authspec-auth-token` (supabase.ts:101-104). */
const SUPABASE_URL = "https://authspec.supabase.co"
const SUPABASE_ANON_KEY = "auth-redirect-back-spec-anon-key"
const SESSION_KEY = "sb-authspec-auth-token"

/** The recording stub served in place of the real SDK. It does NOT reset the recorder the
 *  init script created — a reset here would silently drop any earlier call. */
const SDK_STUB = `
window.__authSpec = window.__authSpec || { createClient: [] };
window.supabase = {
  createClient: function (url, key, options) {
    window.__authSpec.createClient.push({
      url: url,
      key: key,
      options: JSON.parse(JSON.stringify(options || {})),
    });
    return {
      auth: {
        onAuthStateChange: function () {
          return { data: { subscription: { unsubscribe: function () {} } } };
        },
        getSession: async function () { return { data: { session: null }, error: null } },
        getUser: async function () { return { data: { user: null }, error: null } },
      },
      from: function () {
        var q = {};
        ["select", "insert", "upsert", "update", "eq"].forEach(function (m) { q[m] = function () { return q } });
        q.single = async function () { return { data: null, error: null } };
        q.maybeSingle = async function () { return { data: null, error: null } };
        return q;
      },
    };
  },
};
`

type Arrival = {
  /** how many times createClient() was called on that page load */
  clients: number
  /** how many times the stubbed SDK URL was actually requested — a POSITIVE coverage count */
  sdkFetched: number
  /** the options the FIRST createClient call was given, or null */
  options: { auth?: Record<string, unknown> } | null
  facade: string
}

/**
 * Load one URL as a fresh visitor and report what the auth boot did.
 *
 * `signedIn` writes the session blob `isAuthenticated()` reads (supabase.ts:245-256) — that is
 * the OTHER arm of the `||`, and giving it its own switch is what lets a mutant be told apart.
 */
async function arrive(
  ctx: BrowserContext,
  url: string,
  { signedIn = false, blockNeural = false }: { signedIn?: boolean; blockNeural?: boolean } = {},
): Promise<Arrival> {
  const page: Page = await ctx.newPage()

  await page.addInitScript(`
    window.__SUPABASE_URL = ${JSON.stringify(SUPABASE_URL)};
    window.__SUPABASE_ANON_KEY = ${JSON.stringify(SUPABASE_ANON_KEY)};
    window.__authSpec = { createClient: [] };
    ${
      signedIn
        ? `try { localStorage.setItem(${JSON.stringify(SESSION_KEY)}, JSON.stringify({ access_token: "auth-spec-token" })) } catch (e) {}`
        : ""
    }
  `)

  // ORDER IS LOAD-BEARING. Playwright matches routes LAST-REGISTERED-FIRST, so the broad
  // hermetic rule goes on FIRST and the specific SDK rule second, or the catch-all eats the
  // stub and every assertion below reads 0 clients — measured: all three tests red, for a
  // harness reason that looks exactly like a missing branch.
  //
  // Hermetic: everything off-origin is aborted, so a drifted SDK URL fails loudly instead of
  // quietly reaching the real CDN and bypassing the recorder.
  await page.route(/^https?:\/\//, async (route) => {
    const u = route.request().url()
    if (u.startsWith("http://localhost") || u.startsWith("http://127.0.0.1")) return route.continue()
    return route.abort()
  })
  if (blockNeural) await page.route("**/static/neural/app/neural.js", (r) => r.abort())
  let sdkFetched = 0
  await page.route(SDK_URL, async (route) => {
    sdkFetched++
    await route.fulfill({ status: 200, contentType: "application/javascript", body: SDK_STUB })
  })

  await page.goto(url, { waitUntil: "load" })

  // The client is created inside an async `nav` listener that awaits an injected <script>.
  // Poll rather than sleep so the negative cases are not merely "we did not wait long enough":
  // every positive case below settles well inside this window, and the controls are re-read
  // after it elapses.
  await expect
    .poll(() => page.evaluate(() => (window as any).__authSpec.createClient.length), {
      timeout: 8_000,
      intervals: [100, 200, 300, 500],
    })
    .toBeGreaterThanOrEqual(0)
  await page.waitForTimeout(2_000)

  const out = await page.evaluate(() => {
    const rec = (window as any).__authSpec.createClient as Array<{ options: unknown }>
    return {
      clients: rec.length,
      options: (rec[0]?.options ?? null) as Arrival["options"],
      facade: typeof (window as any).__bjjAuth,
    }
  })
  await page.close()
  return { ...out, sdkFetched }
}

test("@curated a redirect-back arrival creates the Supabase client and a plain arrival does not", async ({
  browser,
  baseURL,
}) => {
  // THE CONJUNCTION. Both halves live in one test on purpose. A mutant that creates the client
  // unconditionally satisfies the positive half and fails the control; a mutant that never
  // creates it satisfies the control and fails the positive half. Neither half alone is a gate.
  const ctx = await browser.newContext()

  // ── control: an ordinary signed-out visitor. No client, by design — creating one on every
  //    page load would load the SDK for everybody.
  const plain = await arrive(ctx, `${baseURL}/`)
  expect(
    plain.facade,
    "window.__bjjAuth is missing — authUI.inline.ts is not importing supabase.ts at all, so " +
      "nothing below is measuring the redirect-back branch",
  ).toBe("object")
  expect(
    plain.clients,
    "a signed-out visitor with no redirect params got a Supabase client — the eager-create " +
      "guard (authUI.inline.ts:47) is gone, so every visitor now pays for the SDK",
  ).toBe(0)

  // ── the real thing: the URL Google hands back (signInWithGoogle redirects to origin + "/").
  const back = await arrive(ctx, `${baseURL}/?code=spec-pkce-code`)
  expect(
    back.sdkFetched,
    `the stubbed SDK at ${SDK_URL} was never requested — the harness rule matched nothing, so ` +
      "this test is measuring the harness, not the page (CLAUDE.md §6.4)",
  ).toBe(1)
  expect(
    back.clients,
    "?code= arrival created NO Supabase client — hasAuthRedirectParams() (authUI.inline.ts:35) " +
      "no longer reaches ensureClientInitialized(), so Google sign-in never completes and no " +
      "other test on this site would notice",
  ).toBe(1)

  // The client must be created with the option that actually performs the exchange. A client
  // built with detectSessionInUrl:false is created, is plausible, and still never signs anyone in.
  expect(
    back.options?.auth,
    "createClient was called with no auth options at all (supabase.ts:130-138)",
  ).toBeTruthy()
  expect(
    back.options!.auth!.detectSessionInUrl,
    "detectSessionInUrl is not true — the client exists but will never exchange the ?code=",
  ).toBe(true)
  expect(
    back.options!.auth!.flowType,
    "flowType is not pkce — signInWithGoogle starts a PKCE round-trip (supabase.ts:132)",
  ).toBe("pkce")

  await ctx.close()
})

test("@curated all three redirect-back shapes are recognised, not just ?code=", async ({
  browser,
  baseURL,
}) => {
  // hasAuthRedirectParams() matches THREE alternatives and reads search + hash together
  // (authUI.inline.ts:36-37). The implicit `#access_token=` form never reaches the server, and
  // `?error_description=` is how a denied or expired consent comes back — a client must exist
  // for the SDK to surface either. A regex narrowed to `code` keeps test 1 green.
  const ctx = await browser.newContext()

  for (const [label, suffix] of [
    ["pkce (?code=)", "/?code=spec-pkce-code"],
    ["implicit (#access_token=)", "/#access_token=spec-implicit-token"],
    ["error (?error_description=)", "/?error_description=access_denied"],
  ] as const) {
    const a = await arrive(ctx, baseURL + suffix)
    expect(
      a.clients,
      `${label}: no Supabase client was created for ${suffix} — hasAuthRedirectParams() no ` +
        "longer matches this redirect-back shape",
    ).toBe(1)
  }

  // …and the listener is on EVERY page, not only the site root: AuthUI is registered in
  // sharedPageComponents.afterBody, so a redirect that lands deep must behave identically.
  const deep = await arrive(ctx, `${baseURL}/Positions/Mount/Top?code=spec-pkce-code`)
  expect(
    deep.clients,
    "a deep-page redirect-back created no client — AuthUI is no longer on every page",
  ).toBe(1)

  await ctx.close()
})

test("@curated an already-signed-in visitor still gets a client with no neural bundle", async ({
  browser,
  baseURL,
}) => {
  // The other arm of the `||` — what keeps the onAuthStateChange subscription live for a
  // returning signed-in user, and what the storageKey derivation (supabase.ts:101-104) exists
  // to find. Test 1's control asserts a signed-out visitor gets NO client; this is the
  // counterpart.
  //
  // THE NEURAL BUNDLE IS BLOCKED HERE, AND THAT IS THE WHOLE POINT. Measured: with the bundle
  // running, this test passes even when authUI's entire `nav` listener is deleted, because the
  // Neural app is a SECOND caller of ensureClientInitialized() on exactly this path
  // (app.src.jsx `_initAuth`, which calls it when isAuthenticated() is already true). Mutants
  // M3 and M5 both survived against the unblocked page — a false green produced by redundancy,
  // not by the property holding.
  //
  // Blocking the bundle makes the subject the Quartz page-side boot on its own, which is also
  // the real case this protects: a visitor whose neural.js 404s still has a live auth client,
  // which is the same failure mode variant.inline.ts's revealStaticArticle() exists for. The
  // signed-in path WITH the bundle present remains covered by neural's own journeys, not here.
  const ctx = await browser.newContext()
  const returning = await arrive(ctx, `${baseURL}/`, { signedIn: true, blockNeural: true })
  expect(
    returning.clients,
    `a visitor holding a session in ${SESSION_KEY} got no client — either the isAuthenticated() ` +
      "arm of authUI.inline.ts:47 is gone, or authStorageKey() no longer derives that key from " +
      "window.__SUPABASE_URL, and cloud sync is dead for signed-in users",
  ).toBe(1)
  await ctx.close()
})
