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

export class Journey {
  constructor(private page: Page) {}
  private bootSeq = 0;

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
      /** keep the 20 White Challenge compatibility objectives incomplete */
      keepTutorial?: boolean;
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
    // unique URL per boot: a hash-only (or identical-URL) goto is a SAME-DOCUMENT navigation —
    // no reload, no init scripts, no wipe/seed. The nonce forces a real navigation every time.
    path += (path.includes("?") ? "&" : "?") + "ngb=" + ++this.bootSeq;
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
      // never aborted by the catch-all, never streamed off-box
      await this.page.route("**/curriculum.json", (r) => {
        try {
          r.fulfill({
            body: payload("curriculum.json"),
            contentType: "application/json",
          });
        } catch {
          r.fulfill({ status: 404, contentType: "application/json", body: "" });
        }
      });
      (this.page as any).__ngRouted = true;
    }
    if (opts.noCurriculum && !(this.page as any).__ngNoCurriculum) {
      // registered AFTER the default handler → matches first (Playwright routes are last-first)
      (this.page as any).__ngNoCurriculum = true;
      await this.page.route("**/curriculum.json", (r) =>
        r.fulfill({ status: 404, contentType: "application/json", body: "" }),
      );
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
    try {
      await this.page.goto(path, { waitUntil: "commit" });
    } catch {
      await this.page.goto(path, { waitUntil: "commit" }); // one retry: teardown races are transient
    }
    const ready = () => {
      const a = (window as W).__neural;
      return !!(
        a &&
        a.nodes &&
        a.nodes.length &&
        typeof a.advance === "function" &&
        a.flashcards &&
        a.flashcards.decks
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
      await this.page.waitForFunction(ready, undefined, { timeout: 120_000 });
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
        await this.page.waitForFunction(ready, undefined, { timeout: 120_000 });
      } catch {
        // still stuck after a reload — this is no longer plausibly a transient flake; fail
        // for real, carrying BOTH snapshots so the log shows whether the reload changed anything
        const diag2 = await snapshot();
        throw new Error(
          `boot readiness timeout (after 1 reload); before=${JSON.stringify(diag1)} after=${JSON.stringify(diag2)}`,
        );
      }
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
    return this;
  }

  /** Land the roll at a named position (rigged start), completing the intro.
   *  The guided first-roll coach fires on every fresh boot (storage is cleared), freezing the
   *  decision clock — most journeys test post-onboarding play, so the DSL dismisses it unless
   *  a test opts in with keepCoach. */
  async land(position: string, opts: { keepCoach?: boolean } = {}) {
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
    if (!opts.keepCoach)
      await this.page.evaluate(() => (window as W).__neural?.dismissCoach?.());
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
      if (dealt > dealt0 && n > 0) return this;
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
    for (let i = 0; i < n; i++) {
      await this.page.evaluate(
        ([idx, dk]) => {
          const a = (window as W).__neural;
          const key = (dk as string) || a.deckKeyFor(a.nodes[a.currentPos]).key;
          const deck = a.flashcards?.decks?.[key];
          if (!deck || !deck.cards.length)
            throw new Error(`no deck for ${key}`);
          const card =
            deck.cards[Math.min(idx as number, deck.cards.length - 1)];
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
