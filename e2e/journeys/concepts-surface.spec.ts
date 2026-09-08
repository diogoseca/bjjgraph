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
 *          [data-concept-node], [data-concept-link], [data-concept-page]
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
 *  · the .md-only Learning pages (3 today, `_meta.mdOnlyPages`) are deliberately NOT rows — this
 *    spec asserts the count matches the JSON-authored set, so deleting the .md skip would not
 *    turn it red.
 *  · nothing here asserts the concept flashcards reach a deck. They still do not — that is the
 *    UNACCOUNTED figure the emitter prints every run, and it is untouched by this surface.
 */

type Concept = {
  id: string;
  key: string;
  name: string;
  cat: "Principle" | "Learning";
  nodes: string[];
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
      ? Array.from(set)
          .map((i: any) => a.nodes[i].id)
          .sort()
      : null;
  });

const watchErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
};

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
  await expect(searchRow, "the Explore root carries the search row").toBeVisible();

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
  await expect(searchRow, "‹ Back restores the Explore root's search row").toBeVisible();

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
  const prose = ((await body.textContent()) || "").trim();
  expect(
    prose.length,
    "and it is real authored content, not a title and a shrug",
  ).toBeGreaterThan(400);

  expect(
    await litIds(page),
    "exactly the techniques this principle names are lit — none dropped, none extra",
  ).toEqual([...target.nodes].sort());
  await expect(
    page.locator("[data-concept-node]"),
    "and they are readable as a list too",
  ).toHaveCount(target.nodes.length);
  await expect(
    page.locator(`[data-concept-page][href="${"/" + target.id}"]`),
    "the full authored page is one click away",
  ).toHaveCount(1);

  s = await searchState(page);
  expect(s.exQ, "still no query, on the second concept too").toBe("");
  expect(s.input, "still nothing typed into the search box").toBe("");
  expect(s.resultsHeader, "still not a results list").toBe(false);

  // A listed technique is a way IN to the graph, not decoration. `openDossier` STAGES the roll
  // there and closes the pane (v1.132.0: "when you click on a transition or on a submission, you
  // navigate to it") — the retired reading sheet is dead code (CLAUDE.md 6.8), so this asserts
  // where the app actually stands, normalised through the app's own `siteIdOf` because a pair
  // partner carries a different id from the hub the payload names (6.6).
  const nodeRow = page.locator("[data-concept-node]").first();
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
  await expect(page, "a technique row pushes the technique's own path").toHaveURL(
    pathRe(clickedId!),
  );
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
  const nodeRow = page.locator("[data-concept-node]").first();
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
