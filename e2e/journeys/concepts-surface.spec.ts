import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { journey } from "../dsl";

/**
 * CONCEPTS — Principles and Learning, inside the app.
 *
 * THE BUG THIS SPEC WAS WRITTEN FOR (owner, v1.152.0): "If I click a principle like Angles, it
 * goes to SEARCH mode — I see results like turtle to back take, rolling back take. I wasn't
 * searching. The intent was to open a content page on the side panel." And: "I remember seeing
 * 20-something or 30 principles. Now I'm just seeing 6."
 *
 * Both symptoms were ONE object. Explore's `curatedMap` held six hardcoded Principles rows and
 * four Learning rows, and every row was a SEARCH SHORTCUT — `["Angles", "back"]` wrote "back"
 * into the search box and re-rendered, so the reader who asked for a concept got a flat ranked
 * list of transitions containing that substring and no concept at all. Six visible and a click
 * that searches are the same six-entry literal, seen from two sides.
 *
 * The law, in one line: EVERY authored concept is listed, and clicking one opens that concept's
 * content in the pane — never a search.
 *
 * THE SEARCH CLAIM IS THE POINT, so it is asserted three ways and each one fails alone: the
 * search input still reads empty, the `_exQ` rail is still empty, and the flat results header
 * the search path emits is absent. A click that wrote the old term back would trip all three.
 *
 * Payload contract — source/quartz/static/neural/concepts.json, emitted by
 * scripts/regenerate_neural_data.py build_concepts(): `_meta.{count,principles,learning}` +
 * `concepts[].{id,key,name,cat,nodes}`. Each concept's READABLE BODY is a dossier in the
 * per-node content/ chunk space, addressed by fnv1a32(key) and read through the app's existing
 * `_ngc()` cache. Every expected count is read FROM the payload: a literal here would re-encode
 * the very bug (six shortcuts satisfies any hand-written number you pick).
 *
 * Rails: __neural.concepts, ._conceptsById, ._conceptId, ._exQ, ._focusIdxSet
 * Handles: [data-concept-row], [data-concept-detail], [data-concept-body], [data-concept-back],
 *          [data-concept-node], [data-concept-link], [data-concept-disclosure]
 * Beats (PostHog): neural_concept_opened
 *
 * THE REFERENCE SURFACES DO NOT PLAY — the owner's rule, and the reason this file exists twice
 * over. "Principles and systems should mean the roll is not on. It only starts if the player
 * clicks on a position, transition or submission. Clicking on principles and systems and learning
 * will only highlight techniques it references. That's the rule."
 *
 * So a Principle, a Learning entry and a System are things you READ. Opening one — by clicking its
 * row or by typing its address — lights the techniques it references and shows its body, and does
 * NOT seat the board, deal a hand, stage anything or start a roll. The roll starts when the player
 * clicks a POSITION, TRANSITION or SUBMISSION, and only then. Both halves are asserted here,
 * because the first half alone is indistinguishable from a broken app.
 *
 * HISTORY, so the reversal is legible. /Principles/<slug>, /Learning/<slug> and /Systems/<slug>
 * are real built pages and none is a graph node, so `_seedFromUrl` resolved nothing and all 129
 * booted the front-door weighted draw (fixed v1.155.3 by seating the board on a member position).
 * That seat is now itself the defect: it is a roll the reader never asked to start. v1.155.3's
 * assertions ("the board is seeded from the page", "the roll stands where the principle teaches")
 * were CORRECT for their contract and are deliberately inverted below.
 *
 * NON-KILLS, recorded so nobody reads this spec as covering them (CLAUDE.md section 6.3):
 *  · Learning's complete 26-page inventory, native disclosures and three migrated guide routes
 *    are covered by learning-reader.spec.ts and tests/learning_content.py.
 *  · nothing here asserts the concept flashcards reach a deck. They still do not — that is the
 *    UNACCOUNTED figure the emitter prints every run, and it is untouched by this surface.
 *  · disclosure fixtures prove interaction and layout; corpus editorial quality is checked
 *    separately against the authored principle JSON, not inferred from those fixtures.
 *  · film fixtures exercise the shared player through a local YouTube API stub; they do not
 *    verify third-party availability, instructional relevance, or real provider playback.
 */

type Concept = {
  id: string;
  key: string;
  name: string;
  cat: "Principle" | "Learning";
  nodes: string[];
  allNodes?: boolean;
  nodeMask?: string;
};

// The SERVED copy is what the app fetches; the emitted copy is what the build will serve next.
// Reading either keeps the spec honest before a build has copied the payload across.
const PAYLOAD_PATHS = [
  "../../source/public/static/neural/concepts.json",
  "../../source/quartz/static/neural/concepts.json",
];
let PAYLOAD: {
  _meta: { count: number; principles: number; learning: number };
  concepts: Concept[];
} | null = null;
const payload = () => {
  if (!PAYLOAD) {
    for (const rel of PAYLOAD_PATHS) {
      try {
        PAYLOAD = JSON.parse(readFileSync(resolve(__dirname, rel), "utf8"));
        break;
      } catch {
        /* next candidate */
      }
    }
    if (!PAYLOAD)
      throw new Error(
        "concepts.json is not emitted — run `npm run regenerate:neural`",
      );
    const lock = JSON.parse(
      readFileSync(resolve(__dirname, "../../node_ordinals.json"), "utf8"),
    ).ordinals;
    const graph = JSON.parse(
      readFileSync(
        // CI shards receive the built site, including its matching graph payload.
        resolve(__dirname, "../../source/public/static/neural/graph-data.json"),
        "utf8",
      ),
    );
    // The wire explicitly retires control-position aliases from the drawn graph.
    const live = graph.nodes
      .filter((n: any) => !n.cal?.stateAlias && n.cal?.avail?.gi !== false)
      .map((n: any) => n.id);
    const playable = new Set(live);
    const ids = new Map(
      Object.entries(lock).map(([id, ordinal]) => [ordinal, id]),
    );
    for (const c of PAYLOAD!.concepts) {
      if (c.allNodes) c.nodes = live;
      else if (c.nodeMask)
        c.nodes = [...ids]
          .filter(
            ([o]) =>
              (BigInt("0x" + c.nodeMask!) & (1n << BigInt(o as number))) !== 0n,
          )
          .map(([, id]) => id)
          .filter((id) => playable.has(id));
    }
  }
  return PAYLOAD;
};

/** systems.json, read the same way concepts.json is: the SERVED copy first, the emitted copy as
 *  the fallback before a build has copied it across. The rule covers all three libraries and
 *  Systems is a separate payload, so this journey cannot borrow the concepts one. */
let SYS: { systems: Array<{ id: string; nodes: string[] }> } | null = null;
const systemsPayload = () => {
  if (!SYS) {
    for (const rel of [
      "../../source/public/static/neural/systems.json",
      "../../source/quartz/static/neural/systems.json",
    ]) {
      try {
        SYS = JSON.parse(readFileSync(resolve(__dirname, rel), "utf8"));
        break;
      } catch {
        /* next candidate */
      }
    }
    if (!SYS)
      throw new Error(
        "systems.json is not emitted — run `npm run regenerate:neural`",
      );
  }
  return SYS;
};

const of = (cat: "Principle" | "Learning") =>
  payload().concepts.filter((c) => c.cat === cat);

/** concepts.json is a DEFERRED payload: only the Explore tab's two concept sections read it, so
 *  boot does not fetch it and there is deliberately no idle warm. Asking for it here is what the
 *  first reader does. A timeout means the SERVED site is missing concepts.json, or serves a
 *  bundle that never asks for it (`npm run dev:neural` + a build). */
const awaitConcepts = async (page: Page) => {
  await page.evaluate(() => (window as any).__neural._ensureConcepts());
  return expect
    .poll(
      () =>
        page.evaluate(
          () => ((window as any).__neural.concepts || []).length > 0,
        ),
      {
        timeout: 20_000,
        message:
          "concepts.json reached the app (needs `npm run regenerate:neural` + a build so source/public serves both the payload and a bundle that fetches it)",
      },
    )
    .toBe(true);
};

/** WHAT THE HARNESS DOES NOT SERVE, named beside the assertions that need it (CLAUDE.md 6.4).
 *  `dsl.ts` fulfils EVERY per-node dossier chunk with `{}` on purpose, so journeys run without
 *  authored content — which would make "the concept body is absent" a statement about the DSL
 *  and not about the app. This journey is about that content, so it serves the real chunk for a
 *  CONCEPT key and leaves every other chunk exactly as the DSL had it.
 *
 *  The concept's chunk is identified by READING the emitted file and looking for a key the
 *  payload names — never by recomputing fnv1a32 here, which would be a second implementation of
 *  the addressing scheme under test (6.3).
 *
 *  Registered AFTER boot() so it sits above the DSL's own handler (Playwright matches
 *  last-first); nothing fetches a concept chunk before a row is clicked. */
const serveConceptChunks = async (page: Page) => {
  const keys = new Set(payload().concepts.map((c) => c.key));
  const roots = [
    "../../source/public/static/neural/content",
    "../../source/quartz/static/neural/content",
  ];
  await page.route("**/static/neural/content/*.json", (r) => {
    const name = new URL(r.request().url()).pathname.split("/").pop()!;
    for (const root of roots) {
      try {
        const raw = readFileSync(resolve(__dirname, root, name), "utf8");
        if (Object.keys(JSON.parse(raw)).some((k) => keys.has(k)))
          return r.fulfill({ body: raw, contentType: "application/json" });
        break;
      } catch {
        /* next root */
      }
    }
    return r.fulfill({ body: "{}", contentType: "application/json" }); // the DSL's default
  });
};

/** Graph ids of the nodes currently lit — the canvas has no DOM, so the fog gate the draw loop
 *  reads (_focusIdxSet) is the seam, mapped back to payload ids. */
const litIds = (page: Page): Promise<string[] | null> =>
  page.evaluate(() => {
    const a = (window as any).__neural;
    const set = a._focusIdxSet;
    return set
      ? Array.from(
          new Set(Array.from(set).map((i: any) => a.siteIdOf(a.nodes[i].id))),
        ).sort()
      : null;
  });

const watchErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.stack || e.message));
  return errors;
};

/** The DSL aborts remote video requests. Record player creation/destruction and capture-listener
 *  lifetimes locally, so navigation cannot pass merely because a detached player is invisible. */
const stubPrincipleVideos = (page: Page) => page.evaluate(() => {
  const w = window as any;
  w.__principlePlayers = [];
  w.__principleVideoListeners = new Set();
  const add = document.addEventListener.bind(document);
  const remove = document.removeEventListener.bind(document);
  document.addEventListener = ((type: string, listener: any, options: any) => {
    if (type === "pointerdown" && options === true) w.__principleVideoListeners.add(listener);
    add(type, listener, options);
  }) as typeof document.addEventListener;
  document.removeEventListener = ((type: string, listener: any, options: any) => {
    if (type === "pointerdown" && options === true) w.__principleVideoListeners.delete(listener);
    remove(type, listener, options);
  }) as typeof document.removeEventListener;
  function Player(this: any, host: HTMLElement, options: any) {
    this.id = options.videoId;
    this.destroyed = false;
    this.plays = 0;
    this.mute = () => {};
    this.seekTo = () => {};
    this.getCurrentTime = () => 0;
    this.playVideo = () => {
      this.plays++;
      options.events.onStateChange({ target: this, data: 1 });
    };
    this.destroy = () => { this.destroyed = true; host.remove(); };
    host.textContent = "Synthetic video player";
    w.__principlePlayers.push(this);
    queueMicrotask(() => options.events.onReady({ target: this }));
  }
  w.YT = { Player, PlayerState: { ENDED: 0 } };
});

const principleStudyState = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural;
  return {
    current: a.currentPos ?? null, staged: a._staged ?? null, played: !!a._played,
    options: (a.optionIdxs || []).length, log: (a.rollLog || []).length,
    prep: a.prep || {}, days: a._days || {}, cardsToday: a.cardsToday || 0,
    filmLook: a._filmLook || {}, challenges: a.challenges || {},
    badges: a.badges || {}, coins: a.coins || {},
  };
});

test("opening a reference before the landing prefetch runs leaves the roll retired @curated", async ({ page }) => {
  const errors = watchErrors(page);
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await awaitConcepts(page);
  const id = of("Principle")[0].id;
  const state = await page.evaluate((id) => {
    const a = (window as any).__neural;
    const pending: (() => void)[] = [];
    const nativeTimeout = window.setTimeout;
    // Hold zero-delay work for one navigation: the browser may dispatch the next
    // reference click before the landing's deferred neighbourhood prefetch.
    window.setTimeout = ((fn: TimerHandler, delay?: number, ...args: any[]) => {
      if (typeof fn === "function" && delay === 0) {
        pending.push(() => fn(...args));
        return 0;
      }
      return nativeTimeout(fn, delay, ...args);
    }) as typeof window.setTimeout;
    try {
      a.stageRollAt(a.currentPos);
      a.openConcept(id);
    } finally {
      window.setTimeout = nativeTimeout;
    }
    for (const callback of pending) callback();
    return { deferred: pending.length, current: a.currentPos, paused: a.paused, options: a.optionIdxs.length };
  }, id);
  expect(state.deferred, "the landing actually scheduled deferred work").toBeGreaterThan(0);
  expect(state).toMatchObject({ current: null, paused: true, options: 0 });
  await expect(page.locator(`[data-concept-detail="${id}"]`)).toBeVisible();
  expect(errors, "late landing work must not throw on the reference page").toEqual([]);
});

/** Open the pane on Explore the way a reader does, then expand ONE section (every Explore
 *  section defaults collapsed since v1.99.3 — explore-sections.spec.ts owns that contract). */
const openSection = async (page: Page, label: "Principles" | "Learning") => {
  await page.locator(".ng-logo").click();
  await page.locator("[data-view='explore']").click();
  const hdr = page.locator(`[data-explore-section="${label}"]`);
  await expect(hdr).toBeVisible();
  if ((await hdr.getAttribute("aria-expanded")) !== "true") await hdr.click();
  return hdr;
};

/** THE THREE-WAY SEARCH CLAIM. `_exQ` is the rail the render branches on, the input is what the
 *  reader sees, and the results header is what the search path actually emits — a regression that
 *  only re-armed one of the three would still be caught by the other two. */
const searchState = (page: Page) =>
  page.evaluate(() => {
    const a = (window as any).__neural;
    const inp = document.querySelector(
      ".ng-explorer-search input",
    ) as HTMLInputElement | null;
    const body = document.querySelector(".ng-learning-list") || document.body;
    return {
      exQ: a._exQ || "",
      input: inp ? inp.value : "",
      resultsHeader: /\b\d+\s+results?\b/i.test(body.textContent || ""),
    };
  });

test("Explore lists every authored principle, and opening one opens content — never a search @curated", async ({
  page,
}) => {
  const errors = watchErrors(page);
  const principles = of("Principle");
  const j = journey(page);
  await j.boot("/");
  await serveConceptChunks(page);
  await j.land("Mount Top");
  await awaitConcepts(page);

  const hdr = await openSection(page, "Principles");

  const rows = page.locator('[data-concept-row][data-concept-cat="Principle"]');
  await expect(
    rows,
    "the whole authored library is listed, not a hand-picked shortlist of six",
  ).toHaveCount(principles.length);
  expect(
    principles.length,
    "and the library is the corpus, not a shortlist that merely grew",
  ).toBeGreaterThan(40);
  expect(
    await rows.evaluateAll((els) =>
      els.map((e) => e.getAttribute("data-concept-row")).sort(),
    ),
    "every emitted principle id has a row",
  ).toEqual(principles.map((c) => c.id).sort());
  expect(
    await hdr.textContent(),
    "and the section header counts what it lists",
  ).toContain(String(principles.length));
  const searchRow = page.locator(".ng-explorer-tools");
  await expect(
    searchRow,
    "the Explore root carries the search row",
  ).toBeVisible();

  // MOUSE REACHABILITY is claimed only where a real mouse can reach: the first row, at the top of
  // a freshly expanded section. The content claims below use the widest concept (chosen from the
  // payload, never named here) and click it as a locator — that assertion is about what renders,
  // not about hit-testing, and 59 rows put most of them below the fold.
  const first = [...principles].sort((a, b) => a.id.localeCompare(b.id))[0];
  await j.clickByMouse(
    `[data-concept-row="${first.id}"]`,
    `the ${first.name} principle row`,
  );
  await expect(
    page.locator(`[data-concept-detail="${first.id}"]`),
    "a principle row opens that principle",
  ).toBeVisible();

  let s = await searchState(page);
  expect(s.exQ, "the click did not run a query").toBe("");
  expect(s.input, "and the search box the reader can see is still empty").toBe(
    "",
  );
  expect(
    s.resultsHeader,
    "and the pane is not showing flat ranked search results",
  ).toBe(false);
  // The search row belongs to the Explore ROOT. A Principle owning the pane is a page, not a
  // list to filter — the row (and its "Search techniques…" placeholder) must be gone while the
  // detail renders, and back the moment ‹ Back returns the list (owner).
  await expect(
    searchRow,
    "no search row while a principle owns the pane",
  ).toBeHidden();
  // THE ADDRESS BAR FOLLOWS THE PAGE (owner: "clicking items in the explore should change the
  // url ... like it used to, similar to quartz"). A principle's id IS its built path — the one
  // `_seedPageFromUrl` opens on arrival — so opening it pushes that path. (Back/Forward are
  // Quartz's: its SPA router soft-navigates on EVERY popstate, so the app reboots on the previous
  // address rather than unwinding in place — asserted at the end of this journey, where a reboot
  // cannot eat the steps that follow.)
  const pathRe = (id: string) =>
    new RegExp("/" + id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(\\?|$)");
  await expect(page, "opening a principle pushes its own page path").toHaveURL(
    pathRe(first.id),
  );

  // back out, then the widest concept: the strongest highlight and content claim
  await page.locator("[data-concept-back]").click();
  await expect(rows).toHaveCount(principles.length);
  await expect(
    searchRow,
    "‹ Back restores the Explore root's search row",
  ).toBeVisible();

  const target = [...principles].sort(
    (a, b) => b.nodes.length - a.nodes.length,
  )[0];
  await page.locator(`[data-concept-row="${target.id}"]`).click();
  const detail = page.locator(`[data-concept-detail="${target.id}"]`);
  await expect(detail).toBeVisible();
  await expect(page, "the second principle pushed its path too").toHaveURL(
    pathRe(target.id),
  );
  await expect(detail, "the panel names the concept").toContainText(
    target.name,
  );

  // the readable body rides an on-demand chunk, so it lands after the row click
  const body = page.locator("[data-concept-body]");
  await expect(
    body,
    "the concept's own prose is what the panel is for",
  ).toBeVisible({ timeout: 20_000 });
  await expect(body.locator("[data-doc-section] > h3"),
    "all four parts of the principle are available").toHaveCount(4);

  expect(
    await litIds(page),
    "exactly the techniques this principle names are lit — none dropped, none extra",
  ).toEqual([...target.nodes].sort());
  await expect(
    page.locator("[data-concept-node]"),
    "the optional list retains its first batch",
  ).toHaveCount(Math.min(60, target.nodes.length));
  await expect(
    page.locator(`[data-concept-page][href="${"/" + target.id}"]`),
    "the principle is already open; it does not link to itself",
  ).toHaveCount(0);
  await expect(page.locator("[data-concept-node]").first()).toBeHidden();
  const techniques = page.locator('[data-concept-disclosure="techniques"] > summary');
  await techniques.scrollIntoViewIfNeeded();
  await j.clickByMouse('[data-concept-disclosure="techniques"] > summary');

  s = await searchState(page);
  expect(s.exQ, "still no query, on the second concept too").toBe("");
  expect(s.input, "still nothing typed into the search box").toBe("");
  expect(s.resultsHeader, "still not a results list").toBe(false);

  // A listed technique is a way IN to the graph, not decoration. `openDossier` STAGES the roll
  // there and closes the pane (v1.132.0: "when you click on a transition or on a submission, you
  // navigate to it") — the retired reading sheet is dead code (CLAUDE.md 6.8), so this asserts
  // where the app actually stands, normalised through the app's own `siteIdOf` because a pair
  // partner carries a different id from the hub the payload names (6.6).
  // Exercise an ordinary position. The first arbitrary technique can now be a
  // submission-control escape, whose navigation deliberately enters that submission state.
  const nodeRow = page.locator('[data-concept-node^="Positions/"]').first();
  await expect(nodeRow, "the principle lists a playable position").toHaveCount(1);
  const clickedId = await nodeRow.getAttribute("data-concept-node");
  await nodeRow.click();
  const landed = await page.evaluate((id: string) => {
    const a = (window as any).__neural;
    const site = (i: number) => (a.nodes[i] ? a.siteIdOf(a.nodes[i].id) : null);
    return {
      here: [
        a._stagedTech ? site(a._stagedTech.idx) : null,
        site(a.currentPos),
      ],
      want: a.siteIdOf(id),
      paneOpen: !!a.deckShown,
    };
  }, clickedId!);
  expect(
    landed.here,
    "clicking a listed technique takes the reader to it",
  ).toContain(landed.want);
  expect(landed.paneOpen, "and hands the graph back").toBe(false);
  // ...and the address bar followed the technique too (`rollFromPosition` -> `_syncUrl`: the
  // CHOSEN node, never its origin).
  await expect(
    page,
    "a technique row pushes the technique's own path",
  ).toHaveURL(pathRe(clickedId!));
  // Back is Quartz's: the SPA router soft-navigates on every popstate and the app reboots on the
  // previous address — so the URL unwinds to the page, and the page re-opens from its path the
  // way an arrival does (the arrival journeys below own what that boot shows).
  await page.goBack();
  await expect(page, "Back returns to the page the pane had open").toHaveURL(
    pathRe(target.id),
  );

  expect(errors, "no page error across the journey").toEqual([]);
});

test("Explore lists every authored Learning entry, and opening one opens content — never a search", async ({
  page,
}) => {
  const errors = watchErrors(page);
  const learning = of("Learning");
  const j = journey(page);
  await j.boot("/");
  await serveConceptChunks(page);
  await j.land("Mount Top");
  await awaitConcepts(page);

  const hdr = await openSection(page, "Learning");
  const rows = page.locator('[data-concept-row][data-concept-cat="Learning"]');
  await expect(
    rows,
    "every authored Learning page is listed, not four search shortcuts",
  ).toHaveCount(learning.length);
  expect(
    learning.length,
    "and the section is the library, not a shortlist",
  ).toBeGreaterThan(15);
  expect(
    await hdr.textContent(),
    "the section header counts what it lists",
  ).toContain(String(learning.length));

  // "Guard Passing searches 'pass' and finds all these transitions" was the owner's second
  // report. Whichever Learning row sorts first, the claim is the same one.
  const target = [...learning].sort((a, b) => a.id.localeCompare(b.id))[0];
  await j.clickByMouse(
    `[data-concept-row="${target.id}"]`,
    `the ${target.name} learning row`,
  );
  await expect(
    page.locator(`[data-concept-detail="${target.id}"]`),
  ).toBeVisible();

  const s = await searchState(page);
  expect(s.exQ, "a Learning row does not run a query either").toBe("");
  expect(s.input, "and leaves the search box alone").toBe("");
  expect(s.resultsHeader, "and does not render search results").toBe(false);

  await expect(
    page.locator("[data-concept-body]"),
    "it opens the entry's own content",
  ).toBeVisible({ timeout: 20_000 });
  expect(
    ((await page.locator("[data-concept-body]").textContent()) || "").trim()
      .length,
  ).toBeGreaterThan(400);

  expect(errors, "no page error across the journey").toEqual([]);
});

test("arriving on a principle's own page opens it and starts NOTHING @curated", async ({
  page,
}) => {
  const errors = watchErrors(page);
  // The widest principle that names at least one POSITION. Nothing is seated any more (see the
  // rule above), but the position half is still load-bearing for the SECOND half of this journey:
  // it is the member whose click has to start the roll the arrival refused to. Chosen from the
  // payload, never named here.
  const target = payload()
    .concepts.filter(
      (c) =>
        c.cat === "Principle" &&
        c.nodes.some((id) => id.indexOf("Positions/") === 0),
    )
    .sort((a, b) => b.nodes.length - a.nodes.length)[0];
  expect(
    target,
    "some principle names a position — without one this journey cannot make its claim",
  ).toBeTruthy();

  const j = journey(page);
  await j.boot("/" + target.id);

  // concepts.json is deferred, so the arrival kicks the fetch itself and the panel opens when it
  // lands. Nothing has advanced the game clock yet, so the intro is still running — which is the
  // window the board seed has to land in.
  await expect
    .poll(() => page.evaluate(() => (window as any).__neural._conceptId), {
      timeout: 20_000,
      message:
        "the concept page opened its own concept (needs `npm run regenerate:neural` + a build so source/public serves concepts.json)",
    })
    .toBe(target.id);
  await expect(
    page.locator(`[data-concept-detail="${target.id}"]`),
    "on the side panel, which is what the address named",
  ).toBeVisible();
  expect(await litIds(page), "and its techniques are lit on the graph").toEqual(
    [...target.nodes].sort(),
  );

  // ── THE RULE. Nothing is seated and nothing is dealt. The intro runs for 3.2s and then hands
  //    the board either to a URL seat or to `startRoll()`; a reference page must take NEITHER
  //    branch, so this advances well past that handoff before asking.
  await j.advance(4000);
  const idle = await page.evaluate(() => {
    const a = (window as any).__neural;
    return {
      seeded: !!a._urlSeeded,
      seedIdx: a._urlSeedIdx,
      pos: a.currentPos == null ? null : a.currentPos,
      staged: a._staged == null ? null : a._staged,
      played: !!a._played,
      landCard: !!a._landEl,
      rollLog: (a.rollLog || []).length,
    };
  });
  expect(idle.seeded, "a reference page seeds no board").toBe(false);
  expect(idle.pos, "nothing is standing anywhere").toBe(null);
  expect(idle.staged, "and nothing is staged").toBe(null);
  expect(idle.played, "and no roll has played").toBe(false);
  expect(idle.landCard, "and no landing card was built").toBe(false);
  expect(idle.rollLog, "and the roll log is empty").toBe(0);

  // The beat stream is the app's own record of a hand existing. `options_dealt` is what the
  // cold-start spine calls "the first actionable state" (app.src.jsx `hand_dealt`), and
  // `roll_staged` is what a stage fires — a reference arrival must emit neither.
  const beats = (await j.beats()).map((b) => b.beat);
  expect(
    beats.filter((b) => b === "options_dealt" || b === "roll_staged"),
    "no hand was dealt and nothing was staged",
  ).toEqual([]);

  // ── THE OTHER HALF OF THE RULE, and it is what keeps the first half from being "the app is
  //    broken": a POSITION, TRANSITION or SUBMISSION is what starts a roll, and the concept's own
  //    member list is full of them. Clicking one begins the roll the arrival refused to begin.
  // A position starts a staged roll; a submission escape may enter a live defense.
  const techniques = page.locator('[data-concept-disclosure="techniques"] > summary');
  await techniques.scrollIntoViewIfNeeded();
  await j.clickByMouse('[data-concept-disclosure="techniques"] > summary');
  const nodeRow = page.locator('[data-concept-node^="Positions/"]').first();
  await expect(nodeRow, "the principle lists a playable position").toHaveCount(1);
  const clickedId = await nodeRow.getAttribute("data-concept-node");
  await nodeRow.click();
  await j.advance(600);
  const after = await page.evaluate((id: string) => {
    const a = (window as any).__neural;
    const site = (i: number) => (a.nodes[i] ? a.siteIdOf(a.nodes[i].id) : null);
    return {
      here: [
        a._stagedTech ? site(a._stagedTech.idx) : null,
        site(a.currentPos),
      ],
      want: a.siteIdOf(id),
      staged: a._staged != null,
    };
  }, clickedId!);
  expect(
    after.here,
    "clicking a technique the principle names is what starts the roll",
  ).toContain(after.want);
  expect(after.staged, "and it is a real staged roll").toBe(true);

  expect(errors, "no page error across the journey").toEqual([]);
});

test("arriving on a System's own page opens it and starts NOTHING", async ({
  page,
}) => {
  const errors = watchErrors(page);
  // Systems are the OTHER payload and the OTHER open path (`openSystem`, `systems.json`), so the
  // rule has to be claimed for them separately — a fix applied only to concepts would leave half
  // the libraries playing. Read from the systems payload for the same reason concepts are.
  const sys = systemsPayload()
    .systems.filter((x) => (x.nodes || []).length > 0)
    .sort((a, b) => b.nodes.length - a.nodes.length)[0];
  expect(sys, "some system lights nodes").toBeTruthy();

  const j = journey(page);
  await j.boot("/" + sys.id);
  await expect
    .poll(() => page.evaluate(() => (window as any).__neural._systemId), {
      timeout: 20_000,
      message:
        "the system page opened its own system (needs `npm run regenerate:neural` + a build)",
    })
    .toBe(sys.id);

  await j.advance(4000);
  const idle = await page.evaluate(() => {
    const a = (window as any).__neural;
    return {
      pos: a.currentPos == null ? null : a.currentPos,
      staged: a._staged == null ? null : a._staged,
      played: !!a._played,
      lit: a._focusIdxSet ? a._focusIdxSet.size : 0,
    };
  });
  expect(idle.pos, "a System page stands the board nowhere").toBe(null);
  expect(idle.staged, "and stages nothing").toBe(null);
  expect(idle.played, "and plays nothing").toBe(false);
  expect(
    idle.lit,
    "but it DOES light the techniques it teaches — that is the whole of what it does",
  ).toBe(sys.nodes.length);

  const beats = (await j.beats()).map((b) => b.beat);
  expect(
    beats.filter((b) => b === "options_dealt" || b === "roll_staged"),
    "no hand, no stage",
  ).toEqual([]);

  expect(errors, "no page error across the journey").toEqual([]);
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`principle film study hydrates, plays on request, and stops on leaving at ${viewport.width}px @curated`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = watchErrors(page);
    const j = journey(page);
    await j.boot("/", { keepTutorial: true });
    await awaitConcepts(page);
    const concept = of("Principle").find((c) => c.id === "Principles/Base")!;
    const [longer, empty] = of("Principle").filter((c) => c.id !== concept.id);
    const clips = [
      { id: "abcdefghijk", title: "Balance in one minute", by: "Fixture instructor", vertical: true, start: 0, end: 45 },
      { id: "bcdefghijkl", title: "Recover your base", by: "Fixture instructor", vertical: true },
      { id: "cdefghijklm", title: "Base instructional", by: "Fixture instructor", vertical: false },
      { id: "defghijklmn", title: "Balance seminar", by: "Fixture instructor", vertical: false },
    ];
    // These bodies replace the DSL's empty chunks. A held response proves the row is added by
    // real deferred hydration, while the two other bodies cover longer-only and missing clips.
    const bodies = {
      [concept.key]: { overview: "Adjust your supports as pressure changes.", clips, related: [longer.id] },
      [longer.key]: { overview: "One longer explanation is still useful.", clips: [clips[2]], related: [empty.id] },
      [empty.key]: { overview: "This principle has no suitable video yet." },
    };
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let requests = 0;
    await page.route("**/static/neural/content/*.json", async (route) => {
      requests++;
      await held;
      await route.fulfill({ json: bodies });
    });
    await page.evaluate((id) => (window as any).__neural.openConcept(id), concept.id);
    await expect(page.locator(`[data-concept-detail="${concept.id}"]`)).toBeVisible();
    await expect.poll(() => requests, { message: "the dossier request actually reached the hold" }).toBeGreaterThan(0);
    await expect(page.locator("[data-concept-film]")).toHaveCount(0);
    await j.advance(4000);
    const idle = await principleStudyState(page);
    expect(idle).toMatchObject({ current: null, staged: null, played: false, options: 0, log: 0 });
    expect(await page.evaluate(() => (window as any).__neural.challengeProgress("white.film").done),
      "film challenge starts incomplete, so an accidental reward cannot pass vacuously").toBe(false);
    const highlighted = await litIds(page);
    release();

    const film = page.locator(`[data-concept-film="${concept.id}"]`);
    await expect(film).toHaveCount(1);
    await expect(film).toContainText("Film study");
    await expect(film.locator(".ng-clip")).toHaveCount(4);
    await expect(film.locator(".ng-clip").first()).toContainText(clips[0].title);
    await expect(film.locator(".ng-clip").first()).toHaveAccessibleName(`Play: ${clips[0].title} — ${clips[0].by}`);
    expect(await film.evaluate((el) => {
      const detail = document.querySelector("[data-concept-detail]")!;
      const body = document.querySelector("[data-concept-body]")!;
      return !!(detail.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
        && !!(el.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING);
    }), "film follows the summary and precedes the readable body").toBe(true);
    const widths = await film.locator(".ng-clip").evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().width));
    expect(widths[2], "longer landscape videos keep their wider thumbnails").toBeGreaterThan(widths[0]);
    const row = film.locator(".ng-cliprow");
    await row.scrollIntoViewIfNeeded();
    expect(await row.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeGreaterThan(0);
    await row.hover();
    await page.mouse.wheel(900, 0);
    await expect.poll(() => row.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    await page.mouse.wheel(-900, 0);
    await expect.poll(() => row.evaluate((el) => el.scrollLeft)).toBe(0);
    expect(await page.evaluate(() => !!(window as any).__neural._expandedClip)).toBe(false);
    await expect(page.locator(".ngPlayerHost, #yt-iframe-api")).toHaveCount(0);
    await stubPrincipleVideos(page);

    const first = `[data-concept-film="${concept.id}"] .ng-clip[data-i="0"]`;
    const play = async () => {
      await page.locator(first).scrollIntoViewIfNeeded();
      if (viewport.width > 600) await j.clickByMouse(first);
      else { await page.locator(first).focus(); await page.keyboard.press("Enter"); }
      await expect(film.locator(".ngPlayerHost")).toHaveCount(1);
      await expect.poll(() => page.evaluate(() => {
        const players = (window as any).__principlePlayers;
        return players.length && players[players.length - 1].plays > 0;
      })).toBe(true);
      expect(await page.evaluate(() => (window as any).__principlePlayers.at(-1).id)).toBe(clips[0].id);
      expect(await page.evaluate(() => (window as any).__principleVideoListeners.size)).toBe(1);
      await expect.poll(() => page.locator(first).evaluate((card) => {
        const pane = (window as any).__neural.explorerListRef.current.getBoundingClientRect();
        const rect = card.getBoundingClientRect();
        const finalHeight = parseFloat((card as HTMLElement).style.height);
        const mute = card.querySelector(".ngMuteBtn")!.getBoundingClientRect();
        return Math.abs(rect.height - finalHeight) < 1 && rect.top >= pane.top
          && rect.bottom <= pane.bottom && mute.bottom <= pane.bottom;
      }), { message: "the expanded portrait and mute control fit inside the reading pane" }).toBe(true);
    };
    const stopped = async () => {
      await expect(page.locator(".ngPlayerHost")).toHaveCount(0);
      expect(await page.evaluate(() => ({
        active: !!(window as any).__neural._expandedClip,
        alive: (window as any).__principlePlayers.filter((p: any) => !p.destroyed).length,
        listeners: (window as any).__principleVideoListeners.size,
      }))).toEqual({ active: false, alive: 0, listeners: 0 });
    };

    await play();
    const close = `${first} .ngClipX`;
    await page.locator(close).scrollIntoViewIfNeeded();
    if (viewport.width > 600) await j.clickByMouse(close);
    else { await page.locator(close).focus(); await page.keyboard.press("Enter"); }
    await stopped();
    await play();
    // No outside pointer event here: replacing the DOM itself must destroy the live player.
    await page.evaluate(() => (window as any).__neural.renderExplorer());
    await stopped();
    expect(await litIds(page)).toEqual(highlighted);
    expect(await principleStudyState(page)).toEqual(idle);
    await play();
    await page.evaluate(() => (window as any).__neural.setDeckOpen(false));
    await stopped();
    await page.evaluate((id) => (window as any).__neural.openConcept(id), concept.id);
    await play();
    const related = page.locator(`[data-concept-link="${longer.id}"]`);
    await related.scrollIntoViewIfNeeded();
    await related.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(`[data-concept-detail="${longer.id}"]`)).toBeVisible();
    await stopped();

    const longFilm = page.locator(`[data-concept-film="${longer.id}"]`);
    await expect(longFilm.locator(".ng-clip")).toHaveCount(1);
    await expect(longFilm).toContainText(clips[2].title);
    await longFilm.locator(".ng-clip").focus();
    await page.keyboard.press("Enter");
    await expect(longFilm.locator(".ngPlayerHost")).toHaveCount(1);
    expect(await page.evaluate(() => (window as any).__principlePlayers.at(-1).id)).toBe(clips[2].id);
    await page.keyboard.press("Escape");
    await stopped();
    await expect(longFilm.locator(".ng-clip")).toBeFocused();
    await expect(page.locator(`[data-concept-detail="${longer.id}"]`)).toBeVisible();
    const noVideo = page.locator(`[data-concept-link="${empty.id}"]`);
    await noVideo.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(`[data-concept-body="${empty.id}"]`)).toContainText("no suitable video");
    await expect(page.locator("[data-concept-film], .ng-cliprow")).toHaveCount(0);
    await expect(page.locator(".ng-learning-list")).not.toContainText("Film study");
    expect(await principleStudyState(page)).toEqual(idle);
    expect((await j.beats()).filter((b) => ["options_dealt", "roll_staged", "short_watched", "film_first_look", "lesson_done", "bonus_pumped"].includes(b.beat))).toEqual([]);
    // A study takeover hides the Explore list without changing the selected principle.
    // It must release the player even without the pointer event that normally closes it.
    await page.evaluate((id) => (window as any).__neural.openConcept(id), concept.id);
    await play();
    await page.evaluate(() => (window as any).__neural.openStudy("Half Guard|Top"));
    await stopped();
    await expect(film).toBeHidden();
    expect(errors).toEqual([]);
  });

  test(`principle sections expand independently and keep related concepts first at ${viewport.width}px @curated`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const j = journey(page);
    const errors = watchErrors(page);
    await j.boot("/");
    await awaitConcepts(page);
    const concept = of("Principle").find((c) => c.id === "Principles/Base")!;
    const related = of("Principle").find((c) => c.id !== concept.id)!;
    // The DSL's empty chunks cannot exercise disclosures. This complete body deliberately has
    // more than a preview in every section; production content may legitimately need no fold.
    await page.evaluate(({ concept, related }) => {
      const w = window as any;
      w.NG_CONTENT = w.NG_CONTENT || {};
      w.NG_CONTENT.decks = w.NG_CONTENT.decks || {};
      w.NG_CONTENT.decks[concept.key] = {
        overview: "Adjust your supports as pressure changes.",
        points: ["Keep your weight over your supports.", "Widen your base against a push.",
          "Move a support before you shift your weight.", "Recover balance before advancing.", "Keep <pressure> controlled."],
        contexts: ["Standing", "Top guard", "Mount", "Seated guard"].map((c) => ({ c, how: "Shift your support toward the incoming pressure." })),
        errors: ["Feet too narrow", "Weight too far forward", "Locked knees", "Late posting"].map((err) => ({ err, why: "Your weight moves outside your supports.", fix: "Recover a support under your weight." })),
        drills: ["Partner pushes", "Slow stepping", "Positional rounds"].map((name) => ({ name, how: "Keep your balance while a partner applies light pressure.", focus: "Move your supports before increasing effort." })),
        related: [related.id],
        applicability: "GENERIC COVERAGE MUST NOT BECOME ROW COPY",
      };
      w.__neural.openConcept(concept.id);
    }, { concept, related });

    const body = page.locator('[data-concept-body]');
    await expect(body).toBeVisible();
    await expect(body.locator("h3")).toHaveText([
      "Key principles", "Examples / where it applies", "What goes wrong", "How to train it",
    ]);
    await expect(page.locator("[data-concept-page], [data-principle-coverage]")).toHaveCount(0);
    await expect(body.locator("pressure")).toHaveCount(0);
    const spacing = await body.evaluate((el) => {
      const contexts = el.querySelector('[data-doc-section="contexts"]')!;
      const entries = contexts.querySelectorAll(".ng-doc-item");
      const first = entries[0], second = entries[1];
      return {
        labelGap: first.querySelector("dd")!.getBoundingClientRect().top - first.querySelector("dt")!.getBoundingClientRect().bottom,
        entryGap: second.getBoundingClientRect().top - first.getBoundingClientRect().bottom,
        sectionGap: contexts.querySelector("h3")!.getBoundingClientRect().top - el.querySelector('[data-doc-section="points"]')!.getBoundingClientRect().bottom,
      };
    });
    expect(spacing.labelGap).toBeGreaterThan(0);
    expect(spacing.entryGap).toBeGreaterThan(spacing.labelGap);
    expect(spacing.sectionGap).toBeGreaterThan(spacing.entryGap);

    for (const [key, preview, total] of [
      ["points", 3, 5], ["contexts", 2, 4], ["errors", 2, 4], ["drills", 1, 3],
    ] as const) {
      const section = body.locator(`[data-doc-section="${key}"]`);
      const disclosure = section.locator("details");
      const summary = disclosure.locator("summary");
      const selector = `[data-concept-disclosure="${key}"] > summary`;
      const items = key === "points" ? "li" : ".ng-doc-item";
      await expect(section.locator(`${items}:visible`)).toHaveCount(preview);
      await expect(disclosure).toHaveJSProperty("open", false);
      await expect(summary).toHaveAccessibleName(/^Show \d+ more\s*:/);
      await summary.scrollIntoViewIfNeeded();
      await j.clickByMouse(selector);
      await expect(disclosure).toHaveJSProperty("open", true);
      await expect(section.locator(`${items}:visible`)).toHaveCount(total);
      await expect(summary).toHaveAccessibleName(/^Show less\s*:/);
      await expect(body.locator("details[open]")).toHaveCount(1);
      await summary.focus();
      await page.keyboard.press("Enter");
      await expect(disclosure).toHaveJSProperty("open", false);
      await expect(section.locator(`${items}:visible`)).toHaveCount(preview);
    }

    // Keep two sections open together, and prove a pane rebuild preserves both choices.
    for (const key of ["points", "contexts"]) {
      const selector = `[data-concept-disclosure="${key}"] > summary`;
      await page.locator(selector).scrollIntoViewIfNeeded();
      await j.clickByMouse(selector);
    }
    await expect(body.locator("details[open]")).toHaveCount(2);
    await page.evaluate(() => (window as any).__neural.renderExplorer());
    await expect(body.locator("details[open]")).toHaveCount(2);
    const points = page.locator('[data-concept-disclosure="points"] > summary');
    await points.focus();
    await page.keyboard.press("Space");
    await expect(page.locator('[data-concept-disclosure="points"]')).toHaveJSProperty("open", false);
    await expect(page.locator('[data-concept-disclosure="contexts"]')).toHaveJSProperty("open", true);

    const graph = page.locator('[data-concept-disclosure="techniques"]');
    await expect(page.locator("[data-concept-related] [data-concept-link]")).toHaveCount(1);
    expect(await page.locator("[data-concept-related]").evaluate((el) => {
      const next = document.querySelector('[data-concept-disclosure="techniques"]')!;
      return !!(el.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING);
    })).toBe(true);
    await expect(graph).toHaveJSProperty("open", false);
    await expect(graph.locator("[data-concept-node]").first()).toBeHidden();
    await expect(graph.locator(".ng-system-role")).toHaveCount(0);
    await expect(graph).not.toContainText("GENERIC COVERAGE");
    await graph.locator("summary").scrollIntoViewIfNeeded();
    await j.clickByMouse('[data-concept-disclosure="techniques"] > summary');
    await expect(graph.locator("[data-concept-node]").first()).toBeVisible();
    await graph.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(graph.locator("[data-concept-node]").first()).toBeHidden();
    expect(errors).toEqual([]);
  });

  test(`principle overview fits the whole map and highlights both roles at ${viewport.width}px @curated`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const j = journey(page);
    await j.boot("/Principles/Compression-Locks");
    await expect(
      page.locator('[data-concept-detail="Principles/Compression-Locks"]'),
    ).toBeVisible();
    await j.advance(10000); // beyond the intro AND the camera lease
    const result = await page.evaluate(() => {
      const a = (window as any).__neural;
      const sites = a.nodes.filter((n: any) => n.rep && a.rsAllowsIdx(n.idx));
      const panel = a.drillRef.current;
      const origin = a.wrapRef.current.getBoundingClientRect();
      const obscured: string[] = [];
      const offscreen = sites
        .filter((n: any) => {
          const x = a.W / 2 + ((n.x - a.cam.cx) * a.W) / a.cam.vw;
          const y = a.H / 2 + ((a._LY(n) - a.cam.cy) * a.W) / a.cam.vw;
          const hit = document.elementFromPoint(
            origin.left + x,
            origin.top + y,
          );
          if (hit && panel.contains(hit)) obscured.push(n.id);
          return x < 0 || x > a.W || y < 0 || y > a.H;
        })
        .map((n: any) => n.id);
      const lit = Array.from(a._focusIdxSet) as number[];
      return {
        offscreen,
        obscured,
        sites: sites.length,
        lit: lit.length,
        missingTwins: lit.filter(
          (i) => !a._focusIdxSet.has(a._idIndex.get(a.nodes[i].pairId)),
        ),
        roles: [...new Set(lit.map((i) => a.nodes[i].role))].sort(),
        staged: a._staged != null,
      };
    });
    expect(result.sites).toBeGreaterThan(1000);
    expect(result.offscreen).toEqual([]);
    expect(
      result.obscured,
      "the reading pane must not cover graph nodes",
    ).toEqual([]);
    expect(result.lit).toBeGreaterThan(20);
    expect(result.missingTwins).toEqual([]);
    expect(result.roles).toEqual(["attacker", "bottom", "defender", "top"]);
    expect(result.staged).toBe(false);
    await expect(page.locator("[data-concept-node]")).toHaveCount(60);
    await expect(page.locator("[data-concept-node]").first()).toBeHidden();
    const techniques = page.locator('[data-concept-disclosure="techniques"] > summary');
    await techniques.scrollIntoViewIfNeeded();
    await j.clickByMouse('[data-concept-disclosure="techniques"] > summary');
    const more = page.locator("[data-concept-more]");
    await more.scrollIntoViewIfNeeded();
    const rect = await more.boundingBox();
    expect(rect).toBeTruthy();
    const scrollBefore = await page
      .locator(".ng-learning-list")
      .evaluate((el) => el.scrollTop);
    await j.clickByMouse("[data-concept-more]");
    expect(
      await page.locator(".ng-learning-list").evaluate((el) => el.scrollTop),
    ).toBeCloseTo(scrollBefore, 0);
    await expect(page.locator("[data-concept-node]")).toHaveCount(
      Math.min(120, result.lit / 2),
    );
    await expect(page.locator('[data-concept-disclosure="techniques"]')).toHaveJSProperty("open", true);
    expect(
      await page.evaluate(() => (window as any).__neural._focusIdxSet.size),
    ).toBe(result.lit);
    await page.locator("[data-concept-back]").scrollIntoViewIfNeeded();
    await j.clickByMouse("[data-concept-back]");
    await expect(page.locator("[data-principle-view]")).toHaveCount(0);
    await expect(page.locator(".ng-learning-nav")).toBeVisible();
  });
}

// Unlike the arrival cases above, these start with a live hand and authored film. The DSL's
// empty dossier default cannot prove that selecting a reference tears down existing videos.
for (const category of ["Principles", "Systems", "Learning"] as const) {
  test(`clicking ${category} retires the current node and its surfaces @curated`, async ({ page }) => {
    const errors = watchErrors(page);
    const j = journey(page);
    await j.boot("/");
    await page.evaluate(() => {
      const w = window as any;
      w.NG_CONTENT ||= {}; w.NG_CONTENT.decks ||= {};
      w.NG_CONTENT.decks["Half Guard|Top"] = {
        clips: [{ id: "aQ2vFXXBn-o", title: "Half guard demonstration" }],
      };
    });
    await j.land("Half Guard Top");
    await expect(page.locator("[data-land-film]")).toBeVisible();
    await expect(page.locator("[data-landcard]")).toBeVisible();
    expect(await page.evaluate(() => (window as any).__neural.optionIdxs.length)).toBeGreaterThan(0);
    await page.locator(".ng-logo").click();
    await page.locator("[data-view='explore']").click();
    const header = page.locator(`[data-explore-section="${category}"]`);
    await expect(header).toBeVisible();
    if (await header.getAttribute("aria-expanded") !== "true") await header.click();
    if (category === "Systems") {
      const group = page.locator("[data-system-category]").first();
      await expect(group).toBeVisible();
      if (await group.getAttribute("aria-expanded") !== "true") await group.click();
    }
    const kind = category === "Systems" ? "system" : "concept";
    const row = page.locator(`[data-${kind}-row]`).first();
    const id = await row.getAttribute(`data-${kind}-row`);
    expect(id).toBeTruthy();
    await row.scrollIntoViewIfNeeded();
    await j.clickByMouse(`[data-${kind}-row="${id}"]`);
    await expect(page.locator(`[data-${kind}-detail="${id}"]`)).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/" + id);
    expect((await litIds(page))!.length).toBeGreaterThan(0);
    const assertIdle = async () => {
      expect(await page.evaluate(() => {
        const a = (window as any).__neural;
        return { current: a.currentPos ?? null, focus: a.focusIdx, staged: a._staged ?? null,
          options: a.optionIdxs.length, land: !!a._landEl, film: !!a._landFilmEl,
          more: !!a._landMoreEl, pulse: !!a.pulse, decision: !!a._decision, played: !!a._played };
      })).toEqual({ current: null, focus: -1, staged: null, options: 0, land: false,
        film: false, more: false, pulse: false, decision: false, played: false });
      await expect(page.locator("[data-landcard], [data-land-film]")).toHaveCount(0);
      expect(new URL(page.url()).pathname).toBe("/" + id);
    };
    await assertIdle();
    await page.locator(".ng-logo").click(); // closing the reading pane must not resume the old roll
    await j.advance(12000);
    await assertIdle();
    await page.evaluate(() => {
      const a = (window as any).__neural;
      a.stageRollAt(a.nodes.findIndex((n: any) => n.id === "Positions/Mount"));
    });
    await j.advance(600);
    expect(await page.evaluate(() => (window as any).__neural.currentPos)).toBeGreaterThanOrEqual(0);
    await expect(page.locator("[data-landcard]")).toBeVisible();
    expect(errors).toEqual([]);
  });
}

/**
 * THE PRESSED EXPLORE TAB IS THE WAY HOME (v1.195.8). Owner: "this is also affecting every
 * systems page, principles page, and every page that renders on the sidebar. If I click the
 * Explore tab even though it's open, it should go to the Explore root. Right now clicking the
 * Explore tab doesn't do anything if the Explore is already open."
 *
 * `setViewMode` early-returns on the current tab by design — it is the transition seam, and a
 * transition to where you already are is nothing — so a page owning the pane had no way home but
 * its own ‹ Back. The tab CLICK now decides (`_paneTabClick`): the pressed Explore tab goes home
 * (`_exploreHome`: clear the selection and the search rail, re-list), any other tab is the
 * transition it always was. RED first on the shipped bundle: the detail stayed up and the root
 * stayed absent after a mouse click on the pressed tab.
 *
 * Mouse, never `locator.click()`: the pane is a fixed overlay (CLAUDE.md §6.1). Named mutant:
 * route the tab click straight back to `setViewMode` -> every root claim below reds.
 *
 * ALSO ASSERTED, as controls: going home starts nothing (reference law — the roll state is
 * byte-identical before and after), and the pressed Challenges tab is still the no-op it was.
 * A LIT LIST SURVIVES GOING HOME — pinned by share-lists.spec.ts ("a saved or dismissed link
 * stops asking"), whose helper clicks the pressed tab over a freshly saved class: the first cut
 * of `_exploreHome` cleared every focus source and un-lit it. Home clears only what a PAGE owns.
 * NOT COVERED, declared: the address bar. Like ‹ Back, going home leaves the page path where the
 * page put it; a reload reopens the page. The swipe path is untouched and not re-asserted here.
 */
test("clicking the pressed Explore tab returns a drilled Principle, then a System, to the Explore root @curated", async ({ page }) => {
  const errors = watchErrors(page);
  const principles = of("Principle");
  const j = journey(page);
  await j.boot("/");
  await serveConceptChunks(page);
  await j.land("Mount Top");
  await awaitConcepts(page);
  await openSection(page, "Principles");
  const tab = "[data-view='explore']";
  const rows = page.locator('[data-concept-row][data-concept-cat="Principle"]');
  const searchRow = page.locator(".ng-explorer-tools");

  // ── a Principle owns the pane ──
  const first = [...principles].sort((a, b) => a.id.localeCompare(b.id))[0];
  await j.clickByMouse(`[data-concept-row="${first.id}"]`, `the ${first.name} principle row`);
  await expect(page.locator(`[data-concept-detail="${first.id}"]`), "premise: the principle owns the pane").toBeVisible();
  await expect(searchRow, "premise: and the root's search row is gone with it").toBeHidden();
  await expect(page.locator(tab), "premise: Explore is the pressed tab").toHaveAttribute("aria-pressed", "true");
  const before = await principleStudyState(page);

  await j.clickByMouse(tab, "the pressed Explore tab");
  await expect(page.locator("[data-concept-detail]"), "the drilled body is gone").toHaveCount(0);
  await expect(rows, "the root list is back, whole").toHaveCount(principles.length);
  await expect(searchRow, "with its search row").toBeVisible();
  const s = await searchState(page);
  expect(s.exQ, "home is unfiltered: no query on the rail").toBe("");
  expect(s.input, "and none in the box").toBe("");
  expect(await page.evaluate(() => {
    const a = (window as any).__neural;
    return { concept: a._conceptId, system: a._systemId, view: a._viewMode, pane: !!a.deckShown, beat: (a.beats || []).filter((b: any) => b.beat === "pane_tab_home").length };
  }), "no page owns the list, the tab and the pane are as they were, and the way home left its beat").toEqual({ concept: null, system: null, view: "explore", pane: true, beat: 1 });
  expect(await principleStudyState(page), "going home starts nothing: the roll state is untouched").toEqual(before);

  // ── a System owns the pane ──
  await page.evaluate(() => (window as any).__neural._ensureSystems());
  await expect.poll(() => page.evaluate(() => Object.keys((window as any).__neural._systemsById || {}).length), { timeout: 20_000, message: "systems.json reached the app" }).toBeGreaterThan(0);
  const sysId = await page.evaluate(() => { const a = (window as any).__neural; const id = a.systems[0].id; a.openSystem(id); return id; });
  await expect(page.locator("[data-system-back]"), `premise: System ${sysId} owns the pane`).toBeVisible();
  await expect(rows, "premise: the root list is gone with it").toHaveCount(0);
  await j.clickByMouse(tab, "the pressed Explore tab, from a System");
  await expect(page.locator("[data-system-back]"), "the System's body is gone").toHaveCount(0);
  await expect(rows, "the root list is back").toHaveCount(principles.length);
  expect(await page.evaluate(() => (window as any).__neural._systemId), "no System owns the list").toBeNull();

  // ── the other tabs did not change: the pressed Challenges tab is still a no-op ──
  await j.clickByMouse("[data-view='challenges']", "the Challenges tab");
  await expect(page.locator("[data-view='challenges']")).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => {
    const a = (window as any).__neural;
    (window as any).__paneRenders = 0;
    const orig = a._renderPaneBody.bind(a);
    a._renderPaneBody = () => { (window as any).__paneRenders++; return orig(); };
  });
  await j.clickByMouse("[data-view='challenges']", "the pressed Challenges tab");
  await j.advance(200);
  expect(await page.evaluate(() => ({ renders: (window as any).__paneRenders, view: (window as any).__neural._viewMode })),
    "a pressed tab other than Explore is the no-op it always was").toEqual({ renders: 0, view: "challenges" });
  expect(errors, "no page errors along the way").toEqual([]);
});
