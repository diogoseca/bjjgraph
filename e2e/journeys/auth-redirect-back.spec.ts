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
 * `quartz.config.ts:23` reads `process.env.SUPABASE_URL || ""`. Every local build, the PR
 * gate's build (e2e-full.yml) and the programme's golden trees run with SUPABASE_URL unset, so
 * `window.__SUPABASE_URL` is NEVER EMITTED and the listener above early-returns on line 41.
 * (Both DEPLOYS build keyed, from secrets, and there it IS emitted: see THE KEYED DIRECTION.)
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
 * SUPPLIES THE CONFIG ITSELF, via addInitScript, before any page script runs.
 *
 * ── THE KEYED DIRECTION, and the false red it produced (v1.204.3) ──────────────────────
 *
 * This file used to say that supplying the config "gates authUI's LOGIC on any build, keyed or
 * keyless". On a KEYED build that was false. The init script runs first and the build's own
 * `window.__SUPABASE_URL = …` in postscript.js runs after it, so the page ends up configured
 * for the REAL project. `authStorageKey()` then derives `sb-<real ref>-auth-token`, the session
 * this spec had stored under `sb-authspec-auth-token` is invisible, and the signed-in test
 * reads 0 clients. That happened on deploy-dev run 36586966681, which was this file's FIRST
 * keyed run: it reached dev with the engine cutover (PR #222), so no earlier keyed deploy ever
 * ran it, and every run before that was keyless. A real signed-in visitor was never affected,
 * because their session sits under the key their own deploy's config derives.
 *
 * So the config now FOLLOWS THE BUILD, and the session follows the config. `__SUPABASE_URL` is
 * an accessor. A keyless build never writes it, so the spec's value stands and nothing differs
 * from before. A keyed build's write goes through, and a signed-in visitor's session is filed
 * under the key that write derives, as it is for a real returning user of that deploy. The
 * accessor also records whether the build's write came BEFORE the page first read the config.
 * A keyed build that injects late would leave real users with no client at all: the listener's
 * `!window.__SUPABASE_URL` guard returns before the injection lands. The spec's own fallback
 * config would hide that, so the ordering is asserted directly (`expectBuildConfigFirst`).
 * Which direction a run exercised is annotated on every test as `supabase-config`, so a keyless
 * green is never read as keyed coverage. The build's values never leave the page: only
 * booleans and counts are returned to the runner, so no log can print a deploy's config.
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
 *   M14 KEYED build only: the config injection moved after the  → 1,2,3 RED (only the ordering
 *       router's nav dispatch                                     check can see it; skipped,
 *                                                                 loudly, on a keyless build)
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
 *  1. THE INJECTION SITE'S PRESENCE IS STILL UNGATED; ONLY ITS ORDER IS. On a keyed build, an
 *     injection that lands after the page first reads the config goes red here. An injection
 *     that is DROPPED does not: a keyed build that stops emitting `componentResources.ts:194-199`
 *     looks exactly like a keyless build to this spec, whose fallback config keeps it green.
 *     This spec cannot tell which kind of build it was served, so it asserts no presence. Do
 *     not read this file as covering it.
 *  2. Nothing here proves the code is actually exchanged for a session: that is the SDK's job
 *     and the stub replaces the SDK. The claim is "a client exists, with the exchanging option
 *     set, at redirect-back time", which is the part this repo owns.
 *  3. No assertion about the `redirectTo` origin in `signInWithGoogle` (supabase.ts:197).
 *
 * ── ONE CLIENT PER PAGE (AUTHDBL1, 2026-10-01) ────────────────────────────────────────────
 *
 * The dev deploy's curated gate (run 36926507281, keyed) saw TWO clients on `?error_description=`.
 * getClient() (supabase.ts) checked `_client`, awaited the SDK and only then created. A redirect-back
 * routinely has two callers inside that window: authUI's arm, which starts the load, and the Neural
 * app's resolveNeuralUser(), which proceeds precisely because a load is in flight. Both created a
 * client. On `?code=` that is the single-use PKCE code exchanged twice. getClient() is now single-
 * flight. Two tests pin it, both DETERMINISTIC rather than timing-lucky (the unheld race was green
 * locally 30/30, by a 29-71 ms margin):
 *   - the held window: the SDK response waits until the app has asked (counted), on all three shapes;
 *   - the failed load: the first SDK request is aborted, and the next call must retry, not await the
 *     old failure.
 * Mutants on the built postscript.js, each killed at its own assertion:
 *   M-a  check-then-await restored (create on every call while `_client` is unset)
 *        → held window RED: "2 Supabase clients … must be single-flight"
 *   M-b  the failed creation promise never cleared
 *        → failed load RED: "0 Supabase clients after a failed SDK load and one retry"
 * WHICH DIRECTION PR CI SEES: only KEYLESS. PR builds carry no Supabase config, so the spec supplies
 * it; both deploys build KEYED. The race does not depend on the direction, because the config exists
 * in both. Both mutants were killed in both directions: a keyless build, and a local keyed build with
 * the real config.
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
  /** how many neural.js requests the blockNeural route aborted — a POSITIVE coverage count */
  neuralBlocked: number
  /** the options the FIRST createClient call was given, or null */
  options: { auth?: Record<string, unknown> } | null
  facade: string
  /** how many times the BUILD wrote window.__SUPABASE_URL: 0 on a keyless build, 1 on a keyed one */
  buildWrites: number
  /** page reads of window.__SUPABASE_URL that happened before the build's write */
  readsBeforeBuildWrite: number
  /** with holdSdkUntilAppResolves: the app's resolveNeuralUser() calls seen while the SDK was held */
  resolvedInWindow: number
}

/**
 * Load one URL as a fresh visitor and report what the auth boot did.
 *
 * `signedIn` writes the session blob `isAuthenticated()` reads (supabase.ts:245-256) — that is
 * the OTHER arm of the `||`, and giving it its own switch is what lets a mutant be told apart.
 * On a keyed build the session is ALSO filed under the key the build's config derives (see THE
 * KEYED DIRECTION in the header). That derivation is restated here on purpose rather than read
 * from supabase.ts: a mutant of authStorageKey() must disagree with it and go red.
 */
async function arrive(
  ctx: BrowserContext,
  url: string,
  {
    signedIn = false,
    blockNeural = false,
    holdSdkUntilAppResolves = false,
    sdkFailFirst = false,
    retryAfterFailure = false,
  }: {
    signedIn?: boolean
    blockNeural?: boolean
    holdSdkUntilAppResolves?: boolean
    sdkFailFirst?: boolean
    retryAfterFailure?: boolean
  } = {},
): Promise<Arrival> {
  const page: Page = await ctx.newPage()

  await page.addInitScript(`
    (function () {
      var rec = (window.__authSpec = { createClient: [], buildWrites: 0, readsBeforeBuildWrite: 0 });
      var signedIn = ${signedIn};
      var session = JSON.stringify({ access_token: "auth-spec-token" });
      function file(key) { if (signedIn) try { localStorage.setItem(key, session) } catch (e) {} }
      file(${JSON.stringify(SESSION_KEY)});
      var url = ${JSON.stringify(SUPABASE_URL)};
      Object.defineProperty(window, "__SUPABASE_URL", {
        configurable: true,
        enumerable: true,
        get: function () {
          if (rec.buildWrites === 0) rec.readsBeforeBuildWrite++;
          return url;
        },
        set: function (v) {
          url = v;
          rec.buildWrites++;
          file("sb-" + String(v || "").replace("https://", "").split(".")[0] + "-auth-token");
        },
      });
      window.__SUPABASE_ANON_KEY = ${JSON.stringify(SUPABASE_ANON_KEY)};
      // Count the Neural app's identity calls, the second caller of getClient() on a redirect-back.
      // supabase.ts installs the facade by assignment, so a setter sees it; the wrapper is transparent.
      rec.resolve = 0;
      var facade;
      Object.defineProperty(window, "__bjjAuth", {
        configurable: true,
        enumerable: true,
        get: function () { return facade },
        set: function (v) {
          facade = v;
          if (v && typeof v.resolveNeuralUser === "function") {
            var orig = v.resolveNeuralUser;
            v.resolveNeuralUser = function () { rec.resolve++; return orig.apply(this, arguments) };
          }
        },
      });
    })();
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
  // `*`: the loader requests neural.js?v=<build stamp> since v1.204.6. An exact-URL glob stopped
  // matching then and would have let the bundle run, silently: test 3 is only a gate while the
  // block holds, so it COUNTS its hits and test 3 asserts the block fired.
  let neuralBlocked = 0
  if (blockNeural)
    await page.route("**/static/neural/app/neural.js*", (r) => {
      neuralBlocked++
      return r.abort()
    })
  let sdkFetched = 0
  let resolvedInWindow = 0
  await page.route(SDK_URL, async (route) => {
    sdkFetched++
    // a dropped SDK request (AUTHDBL1's retry test): the first load fails, every later one succeeds
    if (sdkFailFirst && sdkFetched === 1) return route.abort()
    // THE WINDOW, HELD OPEN (AUTHDBL1): the SDK does not arrive until the Neural app has asked for
    // the user, so authUI's redirect-back arm and the app are BOTH inside the SDK-loading window on
    // every run, not by timing. Bounded: a hold that never sees the call releases and is reported.
    if (holdSdkUntilAppResolves) {
      const until = Date.now() + 15_000
      while (Date.now() < until && !resolvedInWindow) {
        resolvedInWindow = await page.evaluate(() => (window as any).__authSpec?.resolve || 0).catch(() => 0)
        if (!resolvedInWindow) await new Promise((r) => setTimeout(r, 50))
      }
    }
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
  // the retry local-only play makes when the player asks or the browser comes back online
  if (retryAfterFailure) {
    await page.evaluate(() => (window as any).__bjjAuth.ensureClientInitialized())
    await page.waitForTimeout(1_000)
  }

  // Only counts, options and a typeof leave the page. The recorder also holds the url and key
  // createClient() was given, and on a keyed build those are the deploy's own config.
  const out = await page.evaluate(() => {
    const spec = (window as any).__authSpec
    const rec = spec.createClient as Array<{ options: unknown }>
    return {
      clients: rec.length,
      options: (rec[0]?.options ?? null) as Arrival["options"],
      facade: typeof (window as any).__bjjAuth,
      buildWrites: spec.buildWrites as number,
      readsBeforeBuildWrite: spec.readsBeforeBuildWrite as number,
    }
  })
  await page.close()
  const arrival = { ...out, sdkFetched, neuralBlocked, resolvedInWindow }
  noteConfig(arrival)
  expectBuildConfigFirst(arrival, url.replace(/^https?:\/\/[^/]+/, "") || "/")
  return arrival
}

/** Records which direction this run exercised, on the test and in the log. */
function noteConfig(a: Arrival) {
  const description =
    a.buildWrites > 0
      ? "KEYED build: the page's own injected config was used"
      : "KEYLESS build: the spec supplied the config"
  const annotations = test.info().annotations
  if (annotations.some((x) => x.type === "supabase-config" && x.description === description)) return
  annotations.push({ type: "supabase-config", description })
  console.log(`# supabase-config: ${description}`)
}

/**
 * On a keyed build, the build's config must be in place before the page first reads it. If it
 * is not, the nav listener's `!window.__SUPABASE_URL` guard returns first, and on a real deploy
 * nobody gets a client. The spec's fallback config would otherwise hide that. On a keyless build
 * there is no build write, so there is nothing to order.
 */
function expectBuildConfigFirst(a: Arrival, where: string) {
  if (a.buildWrites === 0) return
  expect(
    a.readsBeforeBuildWrite,
    `${where}: the page read window.__SUPABASE_URL ${a.readsBeforeBuildWrite} time(s) before this ` +
      "KEYED build's own injection ran. On the real deploy the nav listener finds no config and " +
      "returns, so no visitor gets a Supabase client (componentResources.ts must inject first)",
  ).toBe(0)
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
    `?code= arrival created ${back.clients} Supabase clients, expected exactly 1. 0: ` +
      "hasAuthRedirectParams() (authUI.inline.ts:35) no longer reaches ensureClientInitialized(), so " +
      "Google sign-in never completes. 2 or more: two callers each created one (getClient() in " +
      "supabase.ts must be single-flight), so the single-use code is exchanged twice",
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
      `${label}: ${a.clients} Supabase clients were created for ${suffix}, expected exactly 1. 0: ` +
        "hasAuthRedirectParams() no longer matches this redirect-back shape. 2 or more: two callers " +
        "each created one (getClient() in supabase.ts must be single-flight; see the held-window test)",
    ).toBe(1)
  }

  // …and the listener is on EVERY page, not only the site root: AuthUI is registered in
  // sharedPageComponents.afterBody, so a redirect that lands deep must behave identically.
  const deep = await arrive(ctx, `${baseURL}/Positions/Mount/Top?code=spec-pkce-code`)
  expect(
    deep.clients,
    `a deep-page redirect-back created ${deep.clients} clients, expected exactly 1 (0: AuthUI is no ` +
      "longer on every page; 2 or more: getClient() is not single-flight)",
  ).toBe(1)

  await ctx.close()
})

test("@curated two callers inside the SDK-loading window still create ONE client, on every shape", async ({
  browser,
  baseURL,
}) => {
  // ONE CLIENT PER PAGE (AUTHDBL1, 2026-10-01). On a redirect-back, getClient() has two callers:
  // authUI's arm, which starts the SDK load, and the Neural app's resolveNeuralUser(), which goes on
  // to getClient() precisely because a load is in flight. getClient() used to check `_client`, await
  // the SDK and only then create, so both callers created one. On `?code=` that is the single-use
  // PKCE code exchanged twice. The dev deploy's curated gate caught 2 on `?error_description=` (run
  // 36926507281) once B2's heavier wire moved the app's boot into the window; locally the stubbed
  // SDK arrived 29-71 ms before the app asked, so it stayed green by that margin alone. This test
  // HOLDS the SDK until the app has asked (counted), so the race is entered on every run.
  // Mutant, recorded at the fix's PR: getClient() not single-flight -> 2 clients on all three shapes.
  const ctx = await browser.newContext()
  for (const [label, suffix] of [
    ["pkce (?code=)", "/?code=spec-pkce-code"],
    ["implicit (#access_token=)", "/#access_token=spec-implicit-token"],
    ["error (?error_description=)", "/?error_description=access_denied"],
  ] as const) {
    const a = await arrive(ctx, baseURL + suffix, { holdSdkUntilAppResolves: true })
    expect(
      a.resolvedInWindow,
      `${label}: the Neural app never asked for the user while the SDK was held, so the window was ` +
        "never shared and this measures nothing",
    ).toBeGreaterThan(0)
    expect(
      a.clients,
      `${label}: ${a.clients} Supabase clients for ${suffix} with both callers inside the SDK-loading ` +
        "window, expected exactly 1: getClient() (supabase.ts) must be single-flight",
    ).toBe(1)
  }
  await ctx.close()
})

test("@curated a failed SDK load leaves no stale client promise: the next call retries and creates exactly one", async ({
  browser,
  baseURL,
}) => {
  // getClient()'s single-flight promise is CLEARED when the SDK fails to load (AUTHDBL1), so a later
  // call retries instead of awaiting the old failure for the page's life. Local-only play (owner,
  // 2026-09-29) re-tries the SDK when the player asks or the browser comes back online. The first SDK
  // request is aborted; the facade's ensureClientInitialized() then retries once.
  const ctx = await browser.newContext()
  const a = await arrive(ctx, `${baseURL}/?code=spec-pkce-code`, { sdkFailFirst: true, retryAfterFailure: true })
  expect(a.sdkFetched, "the SDK was requested again after its first load failed (the retry happened)").toBe(2)
  expect(
    a.clients,
    `${a.clients} Supabase clients after a failed SDK load and one retry, expected exactly 1: getClient() ` +
      "must clear its failed creation promise, or every later call awaits the old failure",
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
    returning.neuralBlocked,
    "the neural.js block matched no request — the route pattern drifted from the loader's URL, so the " +
      "bundle ran and this test no longer isolates authUI (see THE NEURAL BUNDLE IS BLOCKED HERE)",
  ).toBeGreaterThanOrEqual(1)
  expect(
    returning.clients,
    "a visitor holding a session for the configured project (" +
      (returning.buildWrites > 0 ? "the KEYED build's own" : SESSION_KEY) +
      ") got no client — either the isAuthenticated() arm of authUI.inline.ts:47 is gone, or " +
      "authStorageKey() no longer derives that key from window.__SUPABASE_URL, and cloud sync " +
      "is dead for signed-in users",
  ).toBe(1)
  await ctx.close()
})
