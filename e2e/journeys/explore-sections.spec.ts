import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { journey } from "../dsl";

/**
 * EXPLORE SECTIONS DEFAULT COLLAPSED (v1.99.3, owner: opening the pane showed Systems
 * already expanded — "showing all categories should be collapsed").
 *
 * The contract:
 *  - EVERY top-level Explore section — Systems, Principles, Positions, Transitions,
 *    Submissions, Learning — starts COLLAPSED on a fresh profile. Collapse is
 *    presentation only; nothing locks.
 *  - Expanding persists per section, reload-stable, in ONE settings map
 *    (`exploreOpenSections` — the challengeOpenSections pattern).
 *  - Search must never hide a match behind a fold: a query renders FLAT ranked results
 *    (the pre-existing design), so an item inside a collapsed group is always reachable
 *    by typing its name.
 *  - ARRIVING ON A CATEGORY HUB URL (v1.169.0) — /Positions, /Transitions, /Submissions,
 *    /Systems, /Principles, /Learning — opens the pane on Explore with THAT section
 *    expanded (written through the same exploreOpenSections map a header click uses;
 *    neighbours keep their folds) and starts NOTHING: a hub is a reference surface, so
 *    the owner's rule from concepts-surface.spec.ts applies — no seat, no hand, no roll.
 *
 * Handles: [data-explore-section="<label>"] (header buttons, aria-expanded),
 *          [data-system-row], [data-list-add][data-list-surface="explore"] (leaf rows)
 */

const SHOTS = resolve(__dirname, "../../tests/artifacts/chrome");
mkdirSync(SHOTS, { recursive: true });

const SECTIONS = [
  "Systems",
  "Principles",
  "Positions",
  "Transitions",
  "Submissions",
  "Learning",
];

/** THREE of these six sections are DEFERRED payloads, and the header only exists once the
 *  payload lands — Systems (systems.json) and, since v1.152.0, Principles AND Learning, which
 *  are both rendered from concepts.json (they used to be hardcoded literals that needed no
 *  fetch, which is exactly why this helper only ever named Systems). Each arrival re-renders the
 *  whole Explore body and can replace an element between a test's measure and its next step, so
 *  settle ALL of them before asserting — one un-awaited payload is a flake, not a failure. */
const awaitSections = async (page: Page) => {
  await page.evaluate(() => {
    const a = (window as any).__neural;
    a._ensureSystems();
    a._ensureConcepts();
  });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const a = (window as any).__neural;
          return !!a.systems && (a.concepts || []).length > 0;
        }),
      { timeout: 20_000 },
    )
    .toBe(true);
  await page.waitForTimeout(80); // the arrival re-render settles
};

/** Open the pane on Explore the way a user does: the logo, then the tab. */
const openExplore = async (page: Page) => {
  await page.locator(".ng-logo").click();
  await page.locator("[data-view='explore']").click();
  await awaitSections(page);
};

/** A REAL reload with storage kept (the DSL wipes localStorage per navigation otherwise). */
const reloadKeepingStorage = async (page: Page) => {
  await page.evaluate(() => sessionStorage.setItem("__ng_keep", "1"));
  await page.reload();
  await page.waitForFunction(() => !!(window as any).__neural?.nodes?.length);
  await page.evaluate(() => (window as any).__neural.advance(1200));
};

test("fresh boot: every Explore section starts collapsed — no rows leak below a folded header @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await openExplore(page); // settles the deferred payloads — three headers exist only once they land

  for (const s of SECTIONS)
    await expect(
      page.locator(`[data-explore-section="${s}"]`),
      `${s} starts collapsed`,
    ).toHaveAttribute("aria-expanded", "false");

  await expect(
    page.locator("[data-system-row]"),
    "no system rows under a folded Systems header",
  ).toHaveCount(0);
  await expect(
    page.locator("[data-concept-row]"),
    "nor concept rows under folded Principles / Learning headers (v1.152.0: these two sections\n     became payload-driven lists, so they can leak the same way Systems can)",
  ).toHaveCount(0);
  await expect(
    page.locator('[data-list-add][data-list-surface="explore"]'),
    "no technique leaf rows under folded groups",
  ).toHaveCount(0);

  await page
    .locator(".ng-drill")
    .screenshot({ path: resolve(SHOTS, "explore-collapsed-after.png") });
});

test("expanding a section persists across reload; its neighbours stay folded", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await openExplore(page);

  const positions = page.locator('[data-explore-section="Positions"]');
  await j.clickByMouse('[data-explore-section="Positions"]', "the Positions header");
  await expect(positions).toHaveAttribute("aria-expanded", "true");
  expect(
    await page.locator('[data-list-add][data-list-surface="explore"]').count(),
    "expanding really shows the rows",
  ).toBeGreaterThan(0);

  await reloadKeepingStorage(page);
  await openExplore(page);
  await expect(
    page.locator('[data-explore-section="Positions"]'),
    "the expansion is remembered (exploreOpenSections, per-key LWW settings)",
  ).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.locator('[data-explore-section="Submissions"]'),
    "…without dragging any other section open",
  ).toHaveAttribute("aria-expanded", "false");

  // and folding it again persists too — the map stores intent, not just first-touch
  await page.locator('[data-explore-section="Positions"]').click();
  await expect(positions).toHaveAttribute("aria-expanded", "false");
  await reloadKeepingStorage(page);
  await openExplore(page);
  await expect(
    page.locator('[data-explore-section="Positions"]'),
  ).toHaveAttribute("aria-expanded", "false");
});

test("search reveals a technique living inside a collapsed group — matches are never hidden by a fold", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await openExplore(page);

  await expect(
    page.locator('[data-explore-section="Submissions"]'),
    "premise: Submissions is folded",
  ).toHaveAttribute("aria-expanded", "false");

  const pick = await page.evaluate(() => {
    const a = (window as any).__neural;
    const n = a.nodes.find((x: any) => x.ty === "submissions");
    return { id: n.id, q: n.t.toLowerCase() };
  });
  await page.locator(".ng-explorer-search input").fill(pick.q);
  await expect(
    page.locator(`[data-list-add="${pick.id}"]`).first(),
    "the match renders flat, straight through the fold",
  ).toBeVisible();

  // clearing the query returns to the folded shelf — the fold state was untouched
  await page.locator(".ng-explorer-search input").fill("");
  await expect(
    page.locator('[data-explore-section="Submissions"]'),
  ).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(`[data-list-add="${pick.id}"]`)).toHaveCount(0);
});

/** The rails these two arrival journeys read — compile-time only, so the shape is safe to
 *  reference inside page.evaluate callbacks (nothing is captured at runtime). */
type HubRails = {
  deckShown?: boolean;
  _viewMode?: string;
  _urlSeeded?: boolean;
  currentPos?: number | null;
  _staged?: number | null;
  _played?: boolean;
  rollLog?: unknown[];
};

test("arriving on a category hub URL opens Explore with that section expanded — and starts nothing", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/Transitions");

  // the pane is up, on Explore — that is what the address asked for
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          // __neural is the app's own test rail; dsl.ts boot() gates on it existing
          const w = window as unknown as { __neural: HubRails };
          const a = w.__neural;
          return a.deckShown ? a._viewMode || "" : "";
        }),
      { message: "the hub arrival opened the pane on Explore" },
    )
    .toBe("explore");

  // …with the named section expanded and really showing its rows
  await expect(
    page.locator('[data-explore-section="Transitions"]'),
    "the section the address names is expanded",
  ).toHaveAttribute("aria-expanded", "true");
  expect(
    await page.locator('[data-list-add][data-list-surface="explore"]').count(),
    "and its technique rows are visible",
  ).toBeGreaterThan(0);

  // …without dragging any neighbour open (the two undeferred ones exist to be asked)
  for (const s of ["Positions", "Submissions"])
    await expect(
      page.locator(`[data-explore-section="${s}"]`),
      `${s} keeps its own fold`,
    ).toHaveAttribute("aria-expanded", "false");

  // THE REFERENCE RULE (concepts-surface.spec.ts): a hub is browsed, not played. The intro
  // hands the board off at 3.2s — advance well past that and nothing may have seated, dealt
  // or staged.
  await j.advance(4000);
  const idle = await page.evaluate(() => {
    // __neural is the app's own test rail; dsl.ts boot() gates on it existing
    const w = window as unknown as { __neural: HubRails };
    const a = w.__neural;
    return {
      seeded: !!a._urlSeeded,
      pos: a.currentPos == null ? null : a.currentPos,
      staged: a._staged == null ? null : a._staged,
      played: !!a._played,
      rollLog: (a.rollLog || []).length,
    };
  });
  expect(idle.seeded, "a hub page seeds no board").toBe(false);
  expect(idle.pos, "nothing is standing anywhere").toBe(null);
  expect(idle.staged, "and nothing is staged").toBe(null);
  expect(idle.played, "and no roll has played").toBe(false);
  expect(idle.rollLog, "and the roll log is empty").toBe(0);
  const beats = (await j.beats()).map((b) => b.beat);
  expect(
    beats.filter((b) => b === "options_dealt" || b === "roll_staged"),
    "no hand was dealt and nothing was staged",
  ).toEqual([]);
});

test("arriving on /Systems expands the DEFERRED Systems section once its payload lands", async ({
  page,
}) => {
  // Systems (like Principles and Learning) is a deferred payload: the header does not exist
  // until systems.json lands. The arrival writes the fold map BEFORE the first render asks,
  // so the section must materialise already expanded — a fix applied only to the three
  // graph-backed sections would leave the deferred half of the vocabulary folded.
  const j = journey(page);
  await j.boot("/Systems");
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          // __neural is the app's own test rail; dsl.ts boot() gates on it existing
          const w = window as unknown as { __neural: HubRails };
          const a = w.__neural;
          return a.deckShown ? a._viewMode || "" : "";
        }),
      { message: "the hub arrival opened the pane on Explore" },
    )
    .toBe("explore");
  await expect(
    page.locator('[data-explore-section="Systems"]'),
    "Systems renders expanded when its payload lands (needs `npm run regenerate:neural` + a build so systems.json is served)",
  ).toHaveAttribute("aria-expanded", "true", { timeout: 20_000 });
  expect(
    await page.locator("[data-system-row]").count(),
    "and its rows are visible",
  ).toBeGreaterThan(0);
});
