import { expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Big data payloads served from a per-worker buffer: on a saturated CI box, `npx serve`
// streaming 13.5MB per fresh browser context can stall a boot past any reasonable budget.
// Fulfilling from memory makes every boot deterministic (locally it's a no-op speedup).
const PAYLOADS: Record<string, Buffer> = {};
const payload = (rel: string) => {
  if (!PAYLOADS[rel])
    PAYLOADS[rel] = readFileSync(
      resolve(__dirname, "../source/public/static/neural", rel),
    );
  return PAYLOADS[rel];
};

/**
 * Journey DSL — Playwright plays AS the user through the Neural Graph app.
 *
 * Contract with the app's TEST RAILS (implemented in neural/src/app.src.jsx, P0):
 *   window.__neural.rig(tag, values[])  — queue deterministic values for a tagged RNG site;
 *                                         every Math.random in the app is `this.rng(tag)`.
 *   window.__neural.testMode(true)      — stop the free-running rAF loop; frames advance only
 *                                         via advance().
 *   window.__neural.advance(ms)         — the frame pump: steps timers (after()), travel,
 *                                         camera, halo smoothing and draw in fixed 16.6ms ticks.
 *   window.__neural.beats               — array of fx beat events ({t, beat, ...props}) emitted
 *                                         by the fx() facade: land, options_dealt, bonus_pumped,
 *                                         commit, impact_success, impact_fail, defend_start,
 *                                         escape, finish, roll_end.
 *
 * Journeys click REAL UI surfaces (option cards, drill buttons) — internal methods are used
 * only where canvas hit-testing has no DOM (documented per call).
 */

type W = Window & { __neural?: any; NG_CONTENT?: any };

/**
 * ── LATE PAYLOADS ── how a spec says "this file does not arrive yet".
 *
 * The whole cold-start journey is about a SKEW: on a Fast-4G load of the real build the first
 * playable hand is dealt at 7.0s and the comprehension payloads land at 25.3s / 27.0s
 * (tests/artifacts/coldstart/probe-throttled-timeline.json). Every spec here served those payloads
 * from an in-memory buffer, instantly — so the 18-second window that IS the subject was invisible
 * to the harness, and two rounds of green tests said nothing about it. A test that cannot express
 * the defect cannot defend the fix.
 *
 *   afterSim  release once N SIMULATED seconds have been pumped through advance() SINCE THIS BOOT.
 *             This is the honest unit: in test mode the roll loop runs on the advance() pump, so a
 *             payload arrival is a statement about sim time and stays deterministic on any machine.
 *             MIND THE ORIGIN — it is boot, the same origin the measured timeline uses, NOT the first
 *             hand. On Fast-4G the hand is dealt at ~7.0s and the decks land at 25.3s, so the
 *             18-second skew between them is `afterSim: 25`; `afterSim: 18` would model ~11s of it.
 *   afterMs   release N real milliseconds after the request. For things measured on the wall clock
 *             (CSS entry animations, `setTimeout` retries) rather than the roll loop.
 *   never     never release: the request stays open for the whole test, exactly like a stalled
 *             connection. NOT the same as a 404 — an aborted fetch takes the app's `.catch()`
 *             branch, which is a different (and much better tested) story than silence.
 *
 * The rule is armed BEFORE the navigation that requests the payload, so it covers the very first
 * boot; `releasePayload(pattern)` lands the held ones it NAMES early (and only those — a bare
 * `releasePayload()` means everything). Rules belong to the boot that declared them: boot() clears
 * the table, so a `never` in one boot cannot silently govern the next.
 */
export type PayloadRule = {
  afterSim?: number;
  afterMs?: number;
  never?: boolean;
};

type PayloadEvent = {
  /** the rule's own pattern, so a timeline row names what the spec asked for */
  pattern: string;
  url: string;
  rule: PayloadRule;
  /** sim ms pumped / real ms elapsed since boot when the app ASKED for it */
  requestedAtSim: number;
  requestedAtMs: number;
  /** ...and when the harness let it through (null = still held when the test ended) */
  releasedAtSim: number | null;
  releasedAtMs: number | null;
};

/** "flashcards/_index.json", "**\/decks/*.json", "curriculum" — a glob over the request URL. A bare
 *  filename matches anywhere in the URL, so specs need not spell out the origin. */
const globToRe = (pattern: string) => {
  const esc = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  // `**` spans path separators, `*` does not — expanded via a sentinel so the `[^/]*` produced by
  // the single-star pass is never re-scanned by the double-star one.
  const body = esc
    .replace(/\*\*/g, "\u0001")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0001/g, ".*");
  return new RegExp(pattern.includes("*") ? `^.*${body}$` : body);
};

/** Harness state that belongs to the PAGE, not to a `journey(page)` wrapper. Several specs build two
 *  or more wrappers over the same page (golden-path's determinism replay, the Challenge journeys) and
 *  the routes are registered once per page — so a rule armed through one wrapper must be visible to
 *  the handler and to every other wrapper, and `simMs` must be ONE clock however many wrappers pump
 *  it. `bootSeq` moved here for the same class of bug: two wrappers each counting from zero mint the
 *  SAME boot nonce, and with an `initialState` hash that makes the second boot a same-document
 *  navigation — no reload, no storage wipe, silently. */
type PageState = {
  bootSeq: number;
  /** simulated ms pumped through advance() since the last boot — the clock afterSim is measured on */
  simMs: number;
  wallT0: number;
  rules: Array<{ pattern: string; re: RegExp; rule: PayloadRule }>;
  log: PayloadEvent[];
  /** every held request's escape hatch (true = serve it now, false = the test is over), REMEMBERING
   *  which rule armed it and which URL it is holding — `releasePayload(pattern)` must land only the
   *  payloads it names, and a gate that has forgotten its own identity cannot be selected. */
  gates: Set<{
    pattern: string;
    url: string;
    done: (serve: boolean) => void;
  }>;
  disposed: boolean;
  noCurriculum: boolean;
};

export class Journey {
  constructor(private page: Page) {}
  private get st(): PageState {
    const p = this.page as any;
    return (p.__ngState =
      p.__ngState ||
      ({
        bootSeq: 0,
        simMs: 0,
        wallT0: Date.now(),
        rules: [],
        log: [],
        gates: new Set(),
        disposed: false,
        noCurriculum: false,
      } as PageState));
  }

  /** Boot the app fresh on a route with the deterministic rails engaged.
   *  preserveStorage skips the localStorage wipe for THIS boot — for persistence journeys
   *  (ladder, coach) that assert state SURVIVES a reload. Implemented via a one-shot
   *  sessionStorage flag because addInitScript registrations accumulate across boots. */
  async boot(
    path = "/",
    opts: {
      seedRolls?: Record<string, number[]>;
      preserveStorage?: boolean;
      /** synthetic bjj-neural-progress blob, applied post-wipe pre-app-read (hash-carried) */
      initialState?: Record<string, unknown>;
      /** force the curriculum fetch to 404 (fallback-path journeys) */
      noCurriculum?: boolean;
      /** payloads that land LATE (or never) on THIS boot — see PayloadRule. Armed before the
       *  navigation, so it covers the app's own first fetch of each file. Declaring flashcards.json
       *  late also relaxes the readiness gate below, which would otherwise wait for the very decks
       *  the spec is holding back. */
      payloads?: Record<string, PayloadRule>;
      /** keep the 20 White Challenge compatibility objectives incomplete */
      keepTutorial?: boolean;
      /** stop waiting as soon as the app instance exists, instead of waiting for a full graph
       *  ingest. For journeys about the PRE-PAINT window (a visitor who leaves while the loader
       *  is still up) — the readiness gate is downstream of everything such a test observes. */
      unready?: boolean;
    } = {},
  ) {
    if (!(this.page as any).__ngInit) {
      (this.page as any).__ngInit = true;
      await this.page.addInitScript(() => {
        try {
          const keep = sessionStorage.getItem("__ng_keep");
          sessionStorage.removeItem("__ng_keep");
          if (!keep) {
            localStorage.clear();
            sessionStorage.clear();
          }
        } catch {}
        // engage test mode BEFORE the bundle boots: the app checks this flag at construction
        (window as any).__NEURAL_TEST__ = true;
        // record every WebGL context at creation — boot()'s pre-navigation sweep loses them
        // (probing canvases with getContext would CREATE contexts, paying the very SwiftShader
        // init/teardown cost the sweep exists to avoid)
        const origGetContext = HTMLCanvasElement.prototype.getContext;
        (HTMLCanvasElement.prototype as any).getContext = function (
          ...args: any[]
        ) {
          const ctx = (origGetContext as any).apply(this, args);
          if (ctx && /webgl/i.test(String(args[0]))) {
            ((window as any).__glCtxs = (window as any).__glCtxs || []).push(
              ctx,
            );
          }
          return ctx;
        };
      });
      // initialState seeding: the blob rides the navigation's own hash, so it lands AFTER the
      // wipe above and BEFORE any page script, and a later boot can never replay a stale seed
      // (addInitScript args are frozen at registration — a mutable-holder design would leak).
      await this.page.addInitScript(() => {
        try {
          const m = location.hash.match(/ngseed=([^&]+)/);
          if (m) {
            // NOTE: the hash is left in place — history.replaceState here can wake the
            // Quartz SPA router mid-boot and remount a fresh (pre-ingest) app instance
            localStorage.setItem(
              "bjj-neural-progress",
              decodeURIComponent(m[1]),
            );
          }
        } catch {}
      });
    }
    if (opts.preserveStorage) {
      await this.page
        .evaluate(() => sessionStorage.setItem("__ng_keep", "1"))
        .catch(() => {});
    }
    // Rules belong to THIS boot, as PayloadRule says: a `never` declared for one boot must not
    // silently govern the next (afterSim/afterMs are already re-based per boot below — the table was
    // the one piece of the declaration that outlived it). Any request still held from the previous
    // boot is released here too, so nothing is left waiting on a rule that no longer exists.
    if (this.st.rules.length) this.releasePayload();
    if (opts.payloads)
      for (const [pattern, rule] of Object.entries(opts.payloads))
        this.delayPayload(pattern, rule);
    if (opts.noCurriculum) this.st.noCurriculum = true; // latches, as the old second route did
    // unique URL per boot: a hash-only (or identical-URL) goto is a SAME-DOCUMENT navigation —
    // no reload, no init scripts, no wipe/seed. The nonce forces a real navigation every time.
    path += (path.includes("?") ? "&" : "?") + "ngb=" + ++this.st.bootSeq;
    if (opts.initialState) {
      path += `#ngseed=${encodeURIComponent(JSON.stringify(opts.initialState))}`;
    }
    // journeys don't need the 20MB dossier payload — abort it (the app is absence-guarded).
    // Register ONCE per page: duplicate handlers + a prior boot's in-flight aborts can cancel
    // the next navigation (net::ERR_ABORTED on the second boot of a determinism replay).
    if (!(this.page as any).__ngRouted) {
      // HERMETIC: journeys never leave the local fixture server. The CI build (unlike the
      // local one) bakes PostHog/Supabase config + a Google-Fonts @import into pages; one
      // hanging external request on a loaded runner stalls boot past any budget. Registered
      // FIRST so the specific handlers below take precedence (Playwright matches last-first).
      await this.page.route("**/*", (r) => {
        const u = r.request().url();
        if (/^(http:\/\/localhost|http:\/\/127\.|data:|blob:|about:)/.test(u))
          return r.continue();
        // Fonts must FULFILL (empty CSS), never abort: aborting the neural.css @import fires
        // the <link>'s error event, prescript.js removes the WHOLE stylesheet, and the
        // unstyled .ng-landcard then flows over the explorer's first rows — clicks on
        // [data-lesson] rows time out on an interception no real user ever sees.
        if (/fonts\.(googleapis|gstatic)\.com/.test(u))
          return r.fulfill({ status: 200, contentType: "text/css", body: "" });
        return r.abort();
      });
      // Per-node dossier chunks (v1.80.4, replacing the aborted 21MB technique-content.js):
      // journeys run WITHOUT authored dossier content, exactly as they did when the monolith was
      // aborted — an empty map makes the app negative-cache that node and render its fallbacks.
      // A journey that wants real dossier content routes this itself.
      await this.page.route("**/static/neural/content/*.json", (r) =>
        r.fulfill({ body: "{}", contentType: "application/json" }),
      );
      // Deck manifest + per-deck chunks, from the same per-worker buffers as graph-data. This is
      // the app's REAL on-demand residency path, not a monolith stand-in, so journeys exercise
      // what ships: a deck exists as a stub first and its cards arrive after a fetch.
      await this.page.route("**/flashcards/_index.json", (r) =>
        r.fulfill({
          body: payload("flashcards/_index.json"),
          contentType: "application/json",
        }),
      );
      await this.page.route("**/flashcards/*.json", (r) => {
        const name = new URL(r.request().url()).pathname.split("/").pop()!;
        try {
          r.fulfill({ body: payload("flashcards/" + name), contentType: "application/json" });
        } catch {
          r.fulfill({ status: 404, contentType: "application/json", body: "" });
        }
      });
      await this.page.route("**/graph-data.json", (r) =>
        r.fulfill({
          body: payload("graph-data.json"),
          contentType: "application/json",
        }),
      );
      // hermetic curriculum: the emitted file when present (Phase 1+), a clean 404 before —
      // never aborted by the catch-all, never streamed off-box. `noCurriculum` is a FLAG read here
      // rather than a second route: a route registered later would sit ABOVE the delay layer below
      // (Playwright matches last-first) and a curriculum-late journey would silently lose its delay.
      await this.page.route("**/curriculum.json", (r) => {
        if (this.st.noCurriculum)
          return r.fulfill({
            status: 404,
            contentType: "application/json",
            body: "",
          });
        try {
          r.fulfill({
            body: payload("curriculum.json"),
            contentType: "application/json",
          });
        } catch {
          r.fulfill({ status: 404, contentType: "application/json", body: "" });
        }
      });
      // ── THE DELAY LAYER ── registered LAST, so it sees every request first (Playwright matches
      // last-first) and `fallback()`s to whichever handler above would have served it. That
      // separation is the point: WHEN a payload lands is orthogonal to WHAT its body is, so the
      // same rule works for flashcards.json, graph-data.json, curriculum.json and any
      // not-yet-existing per-deck chunk served straight off the fixture server. It also removes the
      // reason coldstart-spine needed a throwaway boot: the rules live in a table this handler
      // reads at request time, so a spec can arm one before its FIRST navigation.
      await this.page.route("**/*", async (r) => {
        const url = r.request().url();
        const hit = this.ruleFor(url);
        if (!hit) return r.fallback();
        const ev: PayloadEvent = {
          pattern: hit.pattern,
          url,
          rule: hit.rule,
          requestedAtSim: this.st.simMs,
          requestedAtMs: Date.now() - this.st.wallT0,
          releasedAtSim: null,
          releasedAtMs: null,
        };
        this.st.log.push(ev);
        if (!(await this.holdFor(hit.rule, hit.pattern, url))) {
          // still held when the page went away: leave the request as it is (a stalled connection
          // never answers). abort() would hand the app its `.catch()` branch, a different story.
          return;
        }
        ev.releasedAtSim = this.st.simMs;
        ev.releasedAtMs = Date.now() - this.st.wallT0;
        try {
          return await r.fallback();
        } catch {
          return; // the page navigated away while this was held — nothing to serve it to
        }
      });
      this.page.on("close", () => this.dispose());
      (this.page as any).__ngRouted = true;
    }
    // ── GL teardown pre-pay ── headless Chromium (SwiftShader) defers a navigation's COMMIT
    // while it destroys the OLD page's WebGL context: 8-75s on this suite, scaling with how
    // much was drawn (worst right after a victory). Every CDP signal (goto resolution,
    // frameNavigated, evaluate against the new context) waits on it together — the entire
    // "second boot stalls / boot readiness timeout" flake class. Losing the context first
    // makes the commit instant (measured 0.02s). graph.inline also skips Pixi entirely under
    // __NEURAL_TEST__; this sweep is the belt for any page that still created a context.
    await this.page
      .evaluate(() => {
        for (const gl of ((window as any).__glCtxs ||
          []) as WebGLRenderingContext[]) {
          try {
            gl.getExtension("WEBGL_lose_context")?.loseContext();
          } catch {}
        }
        (window as any).__glCtxs = [];
      })
      .catch(() => {});
    // afterSim/afterMs are measured from THIS boot, so a second boot's late payload is late by the
    // same amount again rather than arriving instantly on the previous boot's accumulated clock.
    this.st.simMs = 0;
    this.st.wallT0 = Date.now();
    try {
      await this.page.goto(path, { waitUntil: "commit" });
    } catch {
      await this.page.goto(path, { waitUntil: "commit" }); // one retry: teardown races are transient
    }
    if (opts.unready) {
      // the app instance and its constructor-time rails exist; the graph does not. Nothing below
      // (readiness wait, objective completion, seedRolls) can run without an ingest, so return.
      await this.page.waitForFunction(
        () => !!(window as W).__neural,
        undefined,
        {
          timeout: 60_000,
        },
      );
      return this;
    }
    // A spec that holds flashcards.json back cannot ALSO be made to wait for it: the app's own boot
    // does not (the fetch is fire-and-forget, app_ready fires right after the graph ingest), and the
    // whole point of the delay is to play the first hand without decks, exactly as a 4G visitor does.
    const needDecks = !this.delayedNow("flashcards/_index.json");
    const ready = (want: boolean) => {
      const a = (window as W).__neural;
      return !!(
        a &&
        a.nodes &&
        a.nodes.length &&
        typeof a.advance === "function" &&
        (!want || (a.flashcards && a.flashcards.decks))
      );
    };
    const snapshot = async () =>
      Promise.race([
        this.page.evaluate(() => ({
          readyState: document.readyState,
          hasNeural: !!(window as any).__neural,
          nodes: (window as any).__neural?.nodes?.length ?? null,
          hasFlashcards: !!(window as any).__neural?.flashcards,
          hasDecks: !!(window as any).__neural?.flashcards?.decks, // every predicate clause, so a stall names its blocker exactly
          advanceType: typeof (window as any).__neural?.advance,
          pending: performance
            .getEntriesByType("resource")
            .filter((r: any) => !r.responseEnd)
            .map((r: any) => r.name)
            .slice(0, 10),
        })),
        new Promise((res) => setTimeout(() => res("diag-evaluate-hung"), 5000)),
      ]).catch((x) => String(x));
    try {
      await this.page.waitForFunction(ready, needDecks, {
        timeout: 120_000,
      });
    } catch {
      // BOOT-SCOPED RETRY: a readiness timeout is INFRA (CPU starvation on a contended 2-core
      // CI runner — the page load itself stalls: readyState "interactive", nothing pending,
      // app never ingests), never a gameplay regression. Reload ONCE and wait again — this
      // retries the BOOT only, so retries=0 still catches real assertion bugs. preserveStorage
      // is honored by re-arming __ng_keep before the reload (the first navigation consumed it).
      const diag1 = await snapshot();
      try {
        if (opts.preserveStorage) {
          await this.page
            .evaluate(() => sessionStorage.setItem("__ng_keep", "1"))
            .catch(() => {});
        }
        await this.page.reload({ waitUntil: "commit" });
        await this.page.waitForFunction(ready, needDecks, {
          timeout: 120_000,
        });
      } catch {
        // still stuck after a reload — this is no longer plausibly a transient flake; fail
        // for real, carrying BOTH snapshots so the log shows whether the reload changed anything
        const diag2 = await snapshot();
        throw new Error(
          `boot readiness timeout (after 1 reload); before=${JSON.stringify(diag1)} after=${JSON.stringify(diag2)}`,
        );
      }
    }
    // ── LET THE DEFERRED CURRICULUM LAND BEFORE WE PLANT ANY EVIDENCE ──────────────────────
    // `ready()` above waits for graph + flashcards, but NOT for curriculum.json, which the app
    // fetches in the background and finishes with `_onCurriculum() -> _refreshChallengeEvidence()`
    // — a challenge-evidence pass that CALLS `_saveProgress()` whenever it finds durable change
    // (app.src.jsx: `if (!durableChanged) return; … this._saveProgress()`).
    //
    // If that pass lands AFTER the tutorial step below, it sees 20 completed White objectives
    // and a freshly minted badge, so it saves — silently overwriting whatever the spec seeded
    // into localStorage, on nothing but a machine-speed race. Measured (v1.81.2): with
    // curriculum.json delayed 2s, `_refreshChallengeEvidence -> noteChallenges -> _saveProgress`
    // wrote a 1,654-byte valid blob over a seeded corrupt one; undelayed, no write happened at
    // all. That is the whole mechanism behind
    // `corrupt-blob-settings-persist-cleanly-after-heal` passing alone and failing at spec #7
    // of a 112-spec run — order-dependent on TIME, not on state.
    //
    // Waiting here (before the tutorial step, so the fast ordering every spec was validated
    // under becomes the ONLY ordering) means boot() leaves no in-flight progress write behind.
    // Bounded and swallowed: the `noCurriculum` journeys 404 on purpose and a missing payload
    // must never hang a boot.
    if (!opts.noCurriculum) {
      await this.page
        .waitForFunction(() => !!(window as W).__neural?.curriculum, undefined, {
          timeout: 15_000,
        })
        .catch(() => {});
    }
    // Most gameplay journeys are not about foundational Challenge progression, so they begin
    // with the 20 White compatibility objectives complete unless a test explicitly opts in.
    if (!opts.keepTutorial) {
      await this.page
        .evaluate(() => {
          const a = (window as W).__neural;
          if (!a || !a.TUTORIAL) return;
          a.tut = { done: {} };
          for (const s of a.TUTORIAL) a.tut.done[s.id] = 1;
          a._syncWhiteChallengeCompatibility(Date.now());
          a.tutHidden = true;
          a.renderTutorial();
        })
        .catch(() => {});
    }
    if (opts.seedRolls) {
      for (const [tag, values] of Object.entries(opts.seedRolls))
        await this.rig(tag, values);
    }
    return this;
  }

  /**
   * DECK RESIDENCY (v1.80.4). The app boots from a manifest of deck STUBS and fetches a deck's
   * cards on demand, so `flashcards.decks[key].cards` is absent until something asks for that
   * deck. The app asks for what it needs (the state it lands on, each dealt option, a study
   * surface, a checkpoint's unit) — but a journey that reaches into an ARBITRARY deck must say
   * so, which is what these are for. They drive the real fill seam (`hydrateDeck`), so nothing
   * here fakes residency; they only decide WHEN.
   */
  async hydrate(keys: string[]) {
    await this.page.evaluate(
      (ks) => (window as W).__neural.hydrateDecks(ks as string[]),
      keys as unknown as string[],
    );
    return this;
  }
  /** Full residency, for journeys whose subject is not residency (a deck scan, a corpus pick). */
  async hydrateAll() {
    const keys = await this.page.evaluate(() =>
      Object.keys(((window as W).__neural.flashcards || {}).decks || {}),
    );
    await this.hydrate(keys);
    return this;
  }
  /**
   * Wait until the LANDING QUESTION HAS STOPPED MOVING — mounted, or definitively not coming.
   *
   * Since the payload was chunked (v1.80.4) the landing card paints identity + film immediately
   * and docks its question one fetch later (the deck chunk, then its distractor pool). A spec
   * that reads `__neural._mc` / `[data-land-q]` the instant a hand exists is racing the network,
   * and the race is SILENT: it reads null and goes on to assert something else.
   *
   * The app publishes the signal — `landSettled()` chases the whole chain (v1.80.5) — so the wait
   * lives HERE, in the choke points every journey already goes through (`land`, `nextHand`),
   * instead of being sprinkled through 140 spec files. This replaced a 20s `waitForFunction` poll
   * for `_mc`, which could not tell "not here yet" from "this state asks nothing" and so paid the
   * full timeout on every proven deck.
   */
  async landSettled() {
    await this.page.evaluate(async () => {
      const a = (window as W).__neural;
      if (a && typeof a.landSettled === "function") await a.landSettled();
    });
    return this;
  }

  /** The live LANDING question's MC truth, once its block has settled (see landSettled).
   *  Returns null if this state asks nothing (a fully proven deck legitimately does). */
  async landQuestion(): Promise<{ correct: number; n: number } | null> {
    await this.landSettled();
    return this.page.evaluate(() => {
      const m = (window as W).__neural._mc;
      return m && m.surface === "land" ? { correct: m.correct, n: m.n } : null;
    });
  }

  /** Wait for every in-flight deck/pool fetch to settle (hydration is real async). */
  async decksSettled() {
    await this.page.evaluate(async () => {
      const a = (window as W).__neural;
      for (let i = 0; i < 8; i++) await Promise.all(Object.values(a._deckWaits || {}));
    });
    return this;
  }

  /** Queue deterministic values for a tagged RNG site. */
  async rig(tag: string, values: number[]) {
    await this.page.evaluate(
      ([t, v]) => (window as W).__neural.rig(t as string, v as number[]),
      [tag, values] as const,
    );
    return this;
  }

  /** Pump simulated time through the app in fixed ticks. */
  async advance(ms: number) {
    await this.page.evaluate((m) => (window as W).__neural.advance(m), ms);
    this.st.simMs += ms; // the clock a late payload's afterSim is measured against
    return this;
  }

  // ─────────────────────────── LATE PAYLOADS (see PayloadRule) ───────────────────────────

  /** Declare that a payload lands late, or never. Safe to call before the first boot(); the last
   *  matching rule wins, so a later call overrides an earlier one for the same URL. */
  delayPayload(pattern: string, rule: PayloadRule) {
    this.st.rules.push({ pattern, re: globToRe(pattern), rule });
    return this;
  }

  /** Land a held payload NOW, whatever its rule said — "the connection finally came back".
   *
   *  SCOPED TO THE PATTERN. The pattern is matched against each held request's URL and against the
   *  rule pattern that armed it, so `releasePayload("flashcards.json")` lands the decks and leaves
   *  every other held payload exactly where it was. (It used to resolve EVERY gate: two payloads
   *  held, one released, both landed — which silently voided any claim about the ORDER of two late
   *  payloads, including the per-deck-chunk rules the chunking work needs.) A bare
   *  `releasePayload()` still means everything, which is what teardown uses. */
  releasePayload(pattern?: string) {
    const re = pattern ? globToRe(pattern) : null;
    // a gate is named either by its live URL ("flashcards.json" matches the request) or by the rule
    // pattern that armed it (so a spec can release exactly what it declared, however it spelled it)
    const named = (g: { pattern: string; url: string }) =>
      !re || re.test(g.url) || re.test(g.pattern);
    if (re) this.st.rules = this.st.rules.filter((r) => !re.test(r.pattern));
    else this.st.rules = [];
    for (const g of Array.from(this.st.gates)) if (named(g)) g.done(true); // this one falls through and is served
    return this;
  }

  /** What the harness actually did, per request: when the app asked and when it was let through,
   *  in BOTH clocks. This is the evidence a cold-start claim rests on — assert on it. */
  payloadTimeline(): PayloadEvent[] {
    return this.st.log.map((e) => ({ ...e }));
  }

  /** Simulated ms pumped since this boot. */
  simElapsed() {
    return this.st.simMs;
  }

  private ruleFor(url: string) {
    for (let i = this.st.rules.length - 1; i >= 0; i--)
      if (this.st.rules[i].re.test(url)) return this.st.rules[i];
    return null;
  }

  /** Is this payload under a rule that has NOT been satisfied yet? Used to relax boot()'s
   *  readiness gate — a spec cannot hold flashcards.json back and also be made to wait for it. */
  private delayedNow(name: string) {
    const hit = this.ruleFor(`http://localhost/static/neural/${name}`);
    if (!hit) return false;
    if (hit.rule.never) return true;
    if (hit.rule.afterMs != null) return hit.rule.afterMs > 0;
    return (hit.rule.afterSim || 0) * 1000 > this.st.simMs;
  }

  /** Resolve true when the rule says "land it now", false if the test ended first. Polling in real
   *  time is what lets the spec's own advance() calls (which run on the SAME event loop) move the
   *  simulated clock while a request sits held. */
  private holdFor(
    rule: PayloadRule,
    pattern: string,
    url: string,
  ): Promise<boolean> {
    if (this.st.disposed) return Promise.resolve(false);
    return new Promise<boolean>((res) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const gate = {
        pattern,
        url,
        // `gate` is referenced from its own method: the closure only runs when the gate is resolved,
        // long after the object exists, and holding the reference is what lets it de-register itself.
        done: (v: boolean) => {
          if (timer) clearTimeout(timer);
          this.st.gates.delete(gate);
          res(v);
        },
      };
      const done = gate.done;
      this.st.gates.add(gate);
      if (rule.never) return; // only releasePayload() or the page closing ends this one
      const started = Date.now();
      const need = (rule.afterSim || 0) * 1000;
      const poll = () => {
        if (this.st.disposed) return done(false);
        if (rule.afterMs != null) {
          if (Date.now() - started >= rule.afterMs) return done(true);
        } else if (this.st.simMs >= need) return done(true);
        timer = setTimeout(poll, 15);
      };
      poll();
    });
  }

  private dispose() {
    this.st.disposed = true;
    for (const g of Array.from(this.st.gates)) g.done(false);
    this.st.gates.clear();
  }

  /** Click at MEASURED COORDINATES, like a mouse. `locator.click()` scroll-into-views first, so it
   *  passes on a control that is off-screen where the user sits — and on a canvas app whose fixed
   *  overlays must each re-enable `pointer-events`, it also retries through interception. Both
   *  turned "proven clickable by mouse" into a claim the assertion did not make. This one refuses to
   *  scroll, and names the element that is actually under the cursor when something else is. */
  async clickByMouse(selector: string, what?: string) {
    const label = what || selector;
    const hit = await this.page.evaluate((sel) => {
      const out = { ok: false, x: 0, y: 0, why: "" };
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) {
        out.why = "no element matches";
        return out;
      }
      const r = el.getBoundingClientRect();
      out.x = r.left + r.width / 2;
      out.y = r.top + r.height / 2;
      const vw = window.innerWidth,
        vh = window.innerHeight;
      if (r.width < 1 || r.height < 1) {
        out.why = `zero-sized box ${JSON.stringify(r)}`;
        return out;
      }
      // NO SCROLLING. `locator.click()` scrolls the element into view before clicking, which is
      // exactly how "clickable by mouse" got claimed for a control sitting below the fold.
      if (out.x < 0 || out.y < 0 || out.x > vw || out.y > vh) {
        out.why = `centre (${Math.round(out.x)},${Math.round(out.y)}) is OUTSIDE the ${vw}x${vh} viewport — a real mouse cannot reach it without scrolling`;
        return out;
      }
      const top = document.elementFromPoint(out.x, out.y) as HTMLElement | null;
      // The target itself, or a DESCENDANT of it (the point is inside the target — a child label,
      // an icon span — so the click lands in the target and bubbles to it). Nothing else counts.
      //
      // `top.contains(el)` used to be accepted too, and it is the exact interception this helper
      // exists to catch: an ANCESTOR overlay owning the point means the click is delivered to the
      // overlay, the target never sees it, and (commonest shape of all) a `pointer-events:none`
      // control inside a `pointer-events:auto` panel passed as "reachable by mouse".
      out.ok = !!top && (top === el || el.contains(top));
      if (!out.ok) {
        const who = top
          ? `<${top.tagName.toLowerCase()}${top.id ? " id=" + JSON.stringify(top.id) : ""}${top.className ? " class=" + JSON.stringify(String(top.className)) : ""}>`
          : "nothing";
        out.why =
          `elementFromPoint(${Math.round(out.x)},${Math.round(out.y)}) is ${who} — ` +
          (top && top.contains(el)
            ? "an ANCESTOR of the target that owns the point, so the click is captured by IT and the target never sees it"
            : "the click would land on THAT");
      }
      return out;
    }, selector);
    expect(
      hit.ok,
      `${label} is reachable by mouse where it sits: ${hit.why}`,
    ).toBe(true);
    await this.page.mouse.click(hit.x, hit.y);
    return this;
  }

  /** Land the roll at a named position (rigged start), completing the intro.
   *  (v1.104.0: the first-roll coach is deleted, so there is nothing to dismiss here.) */
  async land(position: string, opts: { keepCoach?: boolean } = {}) {   // keepCoach: accepted-and-ignored since v1.104.0
    // rig the intro roll's ambient draws too — ai-skill/role/max-moves must not flake across runs
    await this.rig("ai-skill", [0.5]);
    await this.rig("role", [0]);
    await this.rig("max-moves", [0.5]);
    await this.page.evaluate((pos) => {
      const a = (window as W).__neural;
      const idx = a.nodes.findIndex(
        (n: any) => n.ty === "positions" && n.t === pos,
      );
      if (idx < 0) throw new Error(`position not found: ${pos}`);
      a.rigStart(idx); // test rail: next startRoll begins here (deterministic role=top)
    }, position);
    // intro (3.2s) + roll-start toast + landing + options dealt — pump until the hand exists
    for (let i = 0; i < 12; i++) {
      await this.advance(1000);
      const n = await this.page.evaluate(
        () => ((window as W).__neural.optionIdxs || []).length,
      );
      if (n > 0) break;
    }
    // settle before returning: from here on, the
    // landing question either exists or this state does not ask one
    await this.landQuestion();
    return this;
  }

  /** After a resolve, pump until the NEXT hand of options is dealt (a fresh options_dealt
   *  beat + a live tray) — travel legs and opponent turns make fixed advances flaky. */
  async nextHand(capMs = 20000) {
    const dealt0 = (await this.beats()).filter(
      (b) => b.beat === "options_dealt",
    ).length;
    let spent = 0;
    while (spent < capMs) {
      await this.advance(500);
      spent += 500;
      const dealt = (await this.beats()).filter(
        (b) => b.beat === "options_dealt",
      ).length;
      const n = await this.page.evaluate(
        () => (((window as W).__neural || {}).optionIdxs || []).length,
      );
      if (dealt > dealt0 && n > 0) return this.landQuestion();
    }
    throw new Error(`next hand not dealt within ${capMs}ms of sim time`);
  }

  /** Pump sim time in small steps until a beat appears — for sequences whose exact duration
   *  varies (travel legs, opponent turns) but whose expiry would fire under one long advance. */
  async advanceUntil(beat: string, capMs = 16000, stepMs = 400) {
    let spent = 0;
    while (spent < capMs) {
      await this.advance(stepMs);
      spent += stepMs;
      const bs = await this.beats();
      if (bs.some((b) => b.beat === beat)) return this;
    }
    throw new Error(`beat "${beat}" not seen within ${capMs}ms of sim time`);
  }

  /** The visible option cards (bottom tray), by title. */
  async optionTitles(): Promise<string[]> {
    return this.page.evaluate(() => {
      const a = (window as W).__neural;
      return (a.optionIdxs || [])
        .map((o: any) => a.nodes[typeof o === "number" ? o : o.idx]?.t)
        .filter(Boolean);
    });
  }

  /** Pick an option like a user: click its tray card (expand sheet opens), then confirm Go. */
  async pick(technique: string) {
    const card = this.page.locator(`[data-tech="${technique}"]`).first();
    await expect(card, `option card for "${technique}" visible`).toBeVisible();
    await card.click();
    const go = this.page.locator("[data-go]").first();
    await expect(go, "expand-sheet Execute button visible").toBeVisible();
    await go.click();
    return this;
  }

  /** Read the currently displayed success % for a technique's option card. */
  async displayedOdds(technique: string): Promise<number> {
    return this.page.evaluate((t) => {
      const a = (window as W).__neural;
      const idx = a.nodes.findIndex((n: any) => n.t === t);
      return Math.round(a.moveChance(a.nodes[idx]) * 100);
    }, technique);
  }

  /** Drill n cards via the same choke points the UI uses — the CURRENT position's deck by
   *  default, or an explicit deckKey (lesson drilling in Challenge journeys). */
  async drill(n: number, deckKey?: string) {
    // v1.80.4: a deck's cards arrive on demand, and drilling IS a study action — so ask for the
    // deck before grading it rather than requiring every caller to remember.
    await this.page.evaluate((dk) => {
      const a = (window as W).__neural;
      const key = (dk as string) || a.deckKeyFor(a.nodes[a.currentPos]).key;
      return a.hydrateDeck(key);
    }, deckKey ?? null);
    for (let i = 0; i < n; i++) {
      await this.page.evaluate(
        ([idx, dk]) => {
          const a = (window as W).__neural;
          const key = (dk as string) || a.deckKeyFor(a.nodes[a.currentPos]).key;
          const deck = a.flashcards?.decks?.[key];
          const cards = a._cardsOf(deck);
          if (!cards || !cards.length) throw new Error(`no deck for ${key}`);
          const card = cards[Math.min(idx as number, cards.length - 1)];
          if (!card) throw new Error(`no card ${idx} in ${key}`);
          // drill rail: grade the card correct through the same choke the UI uses
          a.prep[key] = (a.prep[key] || 0) + 1;
          a.noteCardDone(card, key);
          a.refreshOptionOdds();
        },
        [i, deckKey ?? null] as const,
      );
    }
    return this;
  }

  /** Beat events emitted since boot. */
  async beats(): Promise<Array<{ beat: string }>> {
    return this.page.evaluate(() =>
      ((window as W).__neural.beats || []).slice(),
    );
  }

  /** Sound voices logged since boot (test mode: the synth logs instead of playing). */
  async soundLog(): Promise<
    Array<{ beat: string; patch: string; volume: number }>
  > {
    return this.page.evaluate(() =>
      (((window as W).__neural || {}).sound?.soundLog || []).slice(),
    );
  }

  async expectBeat(beat: string) {
    const bs = await this.beats();
    expect(
      bs.map((b) => b.beat),
      `beat "${beat}" emitted`,
    ).toContain(beat);
    return this;
  }

  /** The visited-position trail of the current roll. */
  async rollTrail(): Promise<string[]> {
    return this.page.evaluate(() => {
      const a = (window as W).__neural;
      return (a.rollLog || []).map((h: any) => h.name + "/" + h.role);
    });
  }

  async currentPosition(): Promise<string> {
    return this.page.evaluate(() => {
      const a = (window as W).__neural;
      return a.nodes[a.currentPos]?.t || "";
    });
  }

  /** Outcome of the most recently ENDED roll — read from the durable beat stream (the live
   *  _lastOutcome field is cleared the moment the next roll auto-starts). */
  async lastOutcome(): Promise<string> {
    return this.page.evaluate(() => {
      const beats = ((window as W).__neural.beats || []).filter(
        (b: any) => b.beat === "roll_end",
      );
      return beats.length ? beats[beats.length - 1].outcome || "" : "";
    });
  }

  async keyframe(name: string) {
    // Gallery keyframes are for the owner's LOCAL review — CI never keeps them, and a
    // full-page screenshot of the software-WebGL canvas wedges the shared browser's raster
    // pipeline long enough to starve the NEXT test's boot on a 2-core runner (every CI boot
    // timeout across three runs followed a keyframe; screenshot-free tests never stalled).
    if (process.env.CI) return this;
    await this.page.screenshot({ path: `e2e/gallery/${name}.png` });
    return this;
  }
}

export const journey = (page: Page) => new Journey(page);
