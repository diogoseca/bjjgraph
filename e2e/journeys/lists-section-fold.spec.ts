import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { journey } from "../dsl";

/**
 * "YOUR LISTS" FOLDS LIKE EVERY OTHER EXPLORE SECTION (v1.196.1).
 *
 * Owner, 2026-09-23: "fix Your lists being collapsed pls … like other categories where it's
 * collapsed by default unless we expand it." Systems, Principles, Positions, Transitions,
 * Submissions and Learning have folded through the persisted `exploreOpenSections` map since
 * v1.99.3 ("showing all categories should be collapsed"). Your lists was rendered OUTSIDE that
 * mechanism and was always open — the asymmetry was the bug.
 *
 * TWO OWNER RULES, AND THIS FILE PINS BOTH:
 *   · the newer one — Your lists starts COLLAPSED, for a fresh profile AND for an existing user
 *     who already has lists and no fold key (no migration: an absent key IS closed), expands on
 *     a header press, and that choice persists in the same map, under the key "Your lists";
 *   · the older one (v1.99.4) — "I should be able to see the listed techniques after adding under
 *     Your lists". A successful add (and a list you just made, or just got back from Undo) opens
 *     the section for THIS SESSION, so what you did is on screen where you did it. It never writes
 *     the map: a reload comes back to whatever the header last said. A deliberate fold beats the
 *     reveal until the next add, which reveals again.
 *   The rejected alternative (leave the section shut, trust the toast and the header count) is
 *   argued at `_revealLists` in app.src.jsx: the header counts LISTS, so an add to an existing
 *   list moves nothing there at all, and the toast is the single `setEvent` slot the roll
 *   overwrites within seconds (CLAUDE.md §6.5).
 *
 * The same reveal covers the saved-class share arrival, which opens the pane precisely so "the
 * list is read first" (`_offerShare`): a lit list folded out of sight is a selection the reader
 * cannot see.
 *
 * HOW "COLLAPSED" IS ASSERTED — the way explore-sections.spec.ts asserts it, not visually:
 * aria-expanded on the header, the folded rows ABSENT from the DOM (count 0, not "hidden"), and
 * the neighbour below reachable by a real mouse (`clickByMouse` fails if anything folded still
 * owns the point — CLAUDE.md §6.1: opacity:0 is not hidden).
 *
 * Handles: [data-explore-section="Your lists"] (the header toggle, aria-expanded/-controls),
 *          [data-lists-head], [data-lists-body], [data-lists-new], [data-lists-empty],
 *          [data-list-row], [data-list-items], [data-list-item], [data-list-pick]
 * Rails:   __neural.get("exploreOpenSections"), .newList, .addToList, .lists, ._listFocusId
 *
 * RED FIRST: against the pre-change bundle all 7 fail — but on the missing header handle, which
 * proves the handle is new and nothing about behaviour. The behaviour is proved by the mutants.
 *
 * MUTANTS (v1.196.1 red-proof pass, one at a time in app.src.jsx; each row names the assertion
 * that went red). A kill at a PREMISE is noted as such.
 *   M1  an absent key reads OPEN                 → "…and it starts collapsed" + "an existing user gets the fold"
 *   M2  the header press sets the session latch, never the map → "the header press writes the same map"
 *   M3  _expandList stops revealing              → "the add opened the section" + the pane-closed add
 *   M4  the reveal WRITES the map                → the add test's reload PREMISE ("premise: folded"): the
 *                                                  seeding session's persisted reveal reopened it
 *   M5  a header press keeps the reveal          → the fold after an add stays open (line "a deliberate fold")
 *   M6  rows rendered while folded               → "no fold body under a closed header" + "no list row…"
 *   M7  folded by opacity:0/height:0             → the same two DOM-absence assertions
 *   M8  the count hides at zero                  → "Your lists (0)"
 *   M9  the + only on an open header             → the + box (never visible)
 *   M10 the + hit box shrunk to 28px             → "44px hit target"
 *   M11 no focus restore after a toggle          → "focus survives the re-render"
 *   M12 the toggle is a <div>                    → "a real button" + "Enter opens it"
 *   M13 the saved-class arrival does not reveal  → "the arrival reveals the section"
 *   M15a ◉ (relightShare) does not reveal        → "…and the lit list is waiting, open"
 *   M15b Class ▸ (openShareCue) does not reveal  → "Class ▸ reads the class, so its section opens"
 *   M16 the caret no longer forwards to the toggle → the caret fold (aria-expanded stays true)
 *   M17 aria-controls dropped                    → "aria-controls names the region"
 *   M18 boot writes "Your lists": false          → "nothing was written at boot" + the existing-user premise
 *   M19 focus restored for Your lists ONLY       → "one code path for all seven headers" (Positions)
 *   M20 the caret joins the tab order            → "the fold holds no tab stops"
 *   M22 the received class folds with the section → share-lists.spec.ts: [data-shared-list] never visible
 *                                                  + "the thing they came for is read FIRST"
 * (No M14: a focusList reveal was written, found unreachable — its one caller is a row inside an
 *  open section — and deleted rather than claimed.)
 * NOT MUTATED, so NOT claimed by this file: the Undo path's reveal (it rides _expandList, the M3
 * seam, but no journey here restores a deleted list), and the phone form factor of the reveal.
 * The ◉ half is exercised on desktop only.
 */

const SHOTS = resolve(__dirname, "../../tests/artifacts/chrome");
mkdirSync(SHOTS, { recursive: true });

const LISTS = '[data-explore-section="Your lists"]';

/** Systems, Principles and Learning are DEFERRED payloads; each arrival re-renders the whole
 *  Explore body. Settle all of them before measuring, as explore-sections.spec.ts does. */
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
  await page.waitForTimeout(80);
};

/** Open the pane on Explore the way a user does — tolerant of an already-open pane (the logo is
 *  a toggle, and a share arrival opens the pane by itself on desktop). */
const openExplore = async (page: Page) => {
  if (!(await page.evaluate(() => !!(window as any).__neural.deckShown)))
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

/** The persisted fold map's value for Your lists: true / false / undefined (never written). */
const storedFold = (page: Page) =>
  page.evaluate(() => {
    const m = (window as any).__neural.get("exploreOpenSections", null);
    return m && Object.prototype.hasOwnProperty.call(m, "Your lists") ? !!m["Your lists"] : undefined;
  });

/** Real technique ids, ordinal-ordered so runs agree — never hard-coded names. */
const pickNodes = (page: Page, n: number) =>
  page.evaluate((count) => {
    const a = (window as any).__neural;
    return a.nodes
      .filter((x: any) => x.rep && typeof x.o === "number" && (x.ty === "transitions" || x.ty === "submissions"))
      .sort((p: any, q: any) => p.o - q.o)
      .slice(0, count)
      .map((x: any) => x.id as string);
  }, n);

/** Lists made through the app's own creation path, each with an EXPLICIT destination. */
const seedLists = (page: Page, lists: { name: string; ids: string[] }[]) =>
  page.evaluate((ls) => {
    const a = (window as any).__neural;
    return ls.map((l: { name: string; ids: string[] }) => {
      const id = a.newList(l.name);
      for (const nid of l.ids) a.addToList(nid, id);
      return id as string;
    });
  }, lists);

/** Does this element own the point at its own centre, inside the viewport? The mouse's answer
 *  to "can the player see and reach it", which a visibility check is not. */
const ownsItsCentre = (page: Page, sel: string) =>
  page.evaluate((s) => {
    const el = document.querySelector(s) as HTMLElement | null;
    if (!el) return { ok: false, why: "absent" };
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (r.width < 1 || r.height < 1) return { ok: false, why: "zero-sized" };
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return { ok: false, why: `centre ${Math.round(x)},${Math.round(y)} off-screen` };
    const top = document.elementFromPoint(x, y);
    const ok = !!top && (top === el || el.contains(top));
    return { ok, why: ok ? "" : `elementFromPoint is <${top ? top.tagName.toLowerCase() : "nothing"}>` };
  }, sel);

// ─────────────────────────────────────────────── 1. the default, for everyone

test("fresh boot: Your lists is a folded section like its neighbours — its header, an explicit (0), a live + and nothing else @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await openExplore(page);

  const hdr = page.locator(LISTS);
  await expect(hdr, "the lists header is a section header of the same kind").toHaveCount(1);
  await expect(hdr, "…and it starts collapsed, like all six neighbours").toHaveAttribute("aria-expanded", "false");
  expect(await hdr.evaluate((e) => e.tagName), "a real button — keyboard-operable for free").toBe("BUTTON");
  for (const s of ["Systems", "Principles", "Positions", "Transitions", "Submissions", "Learning"])
    await expect(page.locator(`[data-explore-section="${s}"]`), `${s} is folded too`).toHaveAttribute("aria-expanded", "false");

  // the count stays explicit at zero (owner's call, v1.95.0) — a folded header still says it
  await expect(page.locator("[data-lists-head]")).toContainText(/Your lists\s*\(0\)/);
  // folded means NOT IN THE DOM, the way the other sections fold: not even the explainer line
  await expect(page.locator("[data-lists-body]"), "no fold body under a closed header").toHaveCount(0);
  await expect(page.locator("[data-lists-empty]"), "the empty-state line lives inside the fold").toHaveCount(0);

  // the + keeps its 44px hit area and stays live on a folded header — creating a list is the
  // header's own verb, it does not wait for the section to be opened first
  const plus = await j.boxOf("[data-lists-new]", "the New list +");
  expect(plus.width, "44px hit target").toBeGreaterThanOrEqual(44);
  expect(plus.height, "44px hit target").toBeGreaterThanOrEqual(44);
  const chip = await j.boxOf("[data-lists-new] .ng-lists-new-chip", "the + chip");
  expect(chip.height, "the chip is the compact visual, not the hit area").toBeLessThan(plus.height);

  expect(await storedFold(page), "the default is the ABSENCE of a key — nothing was written at boot").toBeUndefined();

  // the header toggles by a real mouse where it sits, and the explainer is what it reveals
  await j.clickByMouse(LISTS, "the Your lists header");
  await expect(hdr).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("[data-lists-empty]")).toBeVisible();
  expect(
    await page.evaluate(() => document.querySelector('[data-explore-section="Your lists"]')!.getAttribute("aria-controls") ===
      document.querySelector("[data-lists-body]")!.id),
    "aria-controls names the region the header opens",
  ).toBe(true);
  await page.locator("[data-lists-section]").screenshot({ path: resolve(SHOTS, "lists-section-open-empty.png") });
});

test("an existing user's lists come back folded — rows absent from the DOM, and nothing folded eats a click @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const picks = await pickNodes(page, 3);
  await seedLists(page, [
    { name: "Monday fundamentals", ids: picks.slice(0, 2) },
    { name: "Open mat", ids: picks.slice(2) },
  ]);
  // THE UPGRADE CASE: lists in the blob, no "Your lists" key in the fold map
  await reloadKeepingStorage(page);
  await openExplore(page);
  expect(await storedFold(page), "premise: this user never touched the fold").toBeUndefined();

  await expect(page.locator(LISTS), "an existing user gets the fold too — no migration").toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("[data-lists-head]"), "…and still reads how many lists they have").toContainText(/Your lists\s*\(2\)/);
  await expect(page.locator("[data-list-row]"), "no list row under a closed header").toHaveCount(0);
  await expect(page.locator("[data-list-item]"), "nor any technique").toHaveCount(0);
  await expect(page.locator("[data-lists-body]")).toHaveCount(0);

  // the section below owns its own pixels: nothing from the fold sits over it (§6.1)
  await j.clickByMouse('[data-explore-section="Systems"]', "the Systems header, directly below the fold");
  await expect(page.locator('[data-explore-section="Systems"]')).toHaveAttribute("aria-expanded", "true");
  await page.locator(".ng-drill").screenshot({ path: resolve(SHOTS, "lists-section-folded.png") });
});

// ─────────────────────────────────────────────── 2. opening it, and keeping it open

test("expanding Your lists shows its lists and their techniques, persists across reload, and folding persists too", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const picks = await pickNodes(page, 3);
  const [first] = await seedLists(page, [
    { name: "Monday fundamentals", ids: picks.slice(0, 2) },
    { name: "Open mat", ids: picks.slice(2) },
  ]);
  await reloadKeepingStorage(page);
  await openExplore(page);
  await expect(page.locator(LISTS)).toHaveAttribute("aria-expanded", "false");

  await j.clickByMouse(LISTS, "the Your lists header");
  await expect(page.locator(LISTS)).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("[data-list-row]"), "both lists are in the DOM now").toHaveCount(2);
  expect((await ownsItsCentre(page, `[data-list-row="${first}"] [data-list-name]`)).ok, "…and really on screen").toBe(true);
  // one level further: a list's own disclosure (session state, v1.99.4) shows its techniques
  await j.clickByMouse(`[data-list-open="${first}"]`, "the list's count line");
  await expect(page.locator(`[data-list-items="${first}"] [data-list-item]`)).toHaveCount(2);
  expect(await storedFold(page), "the header press writes the same map the other six use").toBe(true);

  await reloadKeepingStorage(page);
  await openExplore(page);
  await expect(page.locator(LISTS), "the expansion is remembered").toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("[data-list-row]")).toHaveCount(2);
  for (const s of ["Positions", "Submissions"])
    await expect(page.locator(`[data-explore-section="${s}"]`), `${s} keeps its own fold`).toHaveAttribute("aria-expanded", "false");

  // the map stores intent, not first touch: folding persists as well. Folded from the CARET, which
  // sits outside the toggle button (the + between them may not be nested in it) — the row forwards
  // a press anywhere but the + to the toggle, as the neighbours' full-width rows do.
  await j.clickByMouse("[data-lists-caret]", "the Your lists caret");
  await expect(page.locator(LISTS)).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("[data-list-row]")).toHaveCount(0);
  await reloadKeepingStorage(page);
  await openExplore(page);
  await expect(page.locator(LISTS)).toHaveAttribute("aria-expanded", "false");
  expect(await storedFold(page)).toBe(false);
});

test("the header is on the same focus ladder as its neighbours: Enter and Space toggle, focus survives, Tab walks header → + → next header", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await openExplore(page);

  const focused = () =>
    page.evaluate(() => {
      const e = document.activeElement as HTMLElement | null;
      return e ? e.getAttribute("data-explore-section") || (e.hasAttribute("data-lists-new") ? "+" : e.tagName) : null;
    });

  await page.locator(LISTS).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(LISTS), "Enter opens it").toHaveAttribute("aria-expanded", "true");
  // toggling rebuilds the whole Explore body; without restoration the pressed button is gone and
  // the next key goes to <body> (the defect lists-disclosure.spec.ts pins for a list's own toggle)
  expect(await focused(), "focus survives the re-render the toggle caused").toBe("Your lists");
  await page.keyboard.press("Space");
  await expect(page.locator(LISTS), "Space folds it").toHaveAttribute("aria-expanded", "false");
  expect(await focused()).toBe("Your lists");

  // folded: nothing inside the fold is in the tab order — header, its +, then the next header
  await page.keyboard.press("Tab");
  expect(await focused(), "the + is the header's own control, next on the ladder").toBe("+");
  await page.keyboard.press("Tab");
  expect(await focused(), "then straight to the next section — the fold holds no tab stops").toBe("Systems");

  // THE SAME LADDER, literally: a neighbour's header keeps focus through its own toggle too
  await page.locator('[data-explore-section="Positions"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-explore-section="Positions"]')).toHaveAttribute("aria-expanded", "true");
  expect(await focused(), "one code path for all seven headers").toBe("Positions");
});

// ─────────────────────────────────────────────── 3. the older rule: see what you just added

test("adding a technique opens the folded section so the addition is SEEN — for this session, never persisted @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const picks = await pickNodes(page, 1);
  const [id] = await seedLists(page, [{ name: "Tuesday takedowns", ids: picks }]);
  await reloadKeepingStorage(page);
  await openExplore(page);
  await expect(page.locator(LISTS), "premise: folded").toHaveAttribute("aria-expanded", "false");

  // capture from an Explore row, through the star and the picker — the pane stays open
  await page.locator('[data-explore-section="Positions"]').click();
  const leaves = page.locator('[data-list-add][data-list-surface="explore"]');
  const nodeId = (await leaves.nth(0).getAttribute("data-list-add"))!;
  await leaves.nth(0).click();
  await page.locator(`[data-list-pick="${id}"]`).click();

  await expect(page.locator(LISTS), "the add opened the section").toHaveAttribute("aria-expanded", "true");
  const landed = `[data-list-items="${id}"] [data-list-item="${nodeId}"]`;
  await expect(page.locator(landed), "the technique is IN the list, on screen").toHaveCount(1);
  const seen = await ownsItsCentre(page, landed);
  expect(seen.ok, `the added technique is visible and reachable where it landed (${seen.why})`).toBe(true);
  expect(await storedFold(page), "the reveal is session posture — it wrote nothing").toBeUndefined();
  await page.locator("[data-lists-section]").screenshot({ path: resolve(SHOTS, "lists-section-revealed-by-add.png") });

  // a deliberate fold beats the reveal…
  await j.clickByMouse(LISTS, "the Your lists header");
  await expect(page.locator(LISTS)).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("[data-list-item]")).toHaveCount(0);
  expect(await storedFold(page), "…and it IS a choice, so it persists").toBe(false);

  // …until the next add, which reveals again: the older rule holds on every add, not the first
  const second = (await leaves.nth(1).getAttribute("data-list-add"))!;
  await leaves.nth(1).click();
  await page.locator(`[data-list-pick="${id}"]`).click();
  await expect(page.locator(LISTS)).toHaveAttribute("aria-expanded", "true");
  expect((await ownsItsCentre(page, `[data-list-items="${id}"] [data-list-item="${second}"]`)).ok).toBe(true);

  // and the next session starts from what the HEADER last said, not from the adds
  await reloadKeepingStorage(page);
  await openExplore(page);
  await expect(page.locator(LISTS), "a reload comes back folded — the reveal was never persisted").toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("[data-list-row]")).toHaveCount(0);
});

test("an add made with the pane CLOSED is waiting, open, the next time the pane opens", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const picks = await pickNodes(page, 2);
  const [id] = await seedLists(page, [{ name: "Wednesday", ids: [picks[0]] }]);
  await reloadKeepingStorage(page);
  expect(await page.evaluate(() => !!(window as any).__neural.deckShown), "premise: the pane is closed").toBe(false);

  // the in-roll surfaces (landing card, detail sheet) all file through addToList with the pane
  // shut; this is that call, with its destination explicit
  expect(
    await page.evaluate(({ nid, lid }) => (window as any).__neural.addToList(nid, lid).added, { nid: picks[1], lid: id }),
  ).toBe(true);
  await openExplore(page);
  await expect(page.locator(LISTS)).toHaveAttribute("aria-expanded", "true");
  expect((await ownsItsCentre(page, `[data-list-items="${id}"] [data-list-item="${picks[1]}"]`)).ok).toBe(true);
});

// ─────────────────────────────────────────────── 4. a saved class arriving by link is read first

test("a saved class arriving by link opens Your lists on its lit row — the list is read first", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const picks = await pickNodes(page, 3);
  const code = await page.evaluate((ids) => {
    const a = (window as any).__neural;
    const id = a.newList("Coach's class");
    for (const nid of ids) a.addToList(nid, id);
    return a.listShareCode(id) as string;
  }, picks);

  // the production /l/<code> rewrite, emulated with the built shell (share-lists.spec.ts)
  const shell = readFileSync(resolve(__dirname, "../../source/public/l.html"));
  await page.route("**/l/*", (r) => r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: shell }));

  // a fresh recipient saves it, then comes back to the same link
  await j.boot(`/l/${code}`);
  await page.locator("[data-shared-save]").click();
  const saved = await page.evaluate(() => Object.keys((window as any).__neural.lists)[0]);
  await reloadKeepingStorage(page);
  await openExplore(page);

  expect(await page.evaluate(() => (window as any).__neural._listFocusId), "premise: the arrival lit the saved list").toBe(saved);
  await expect(page.locator(LISTS), "the arrival reveals the section holding the lit list").toHaveAttribute("aria-expanded", "true");
  expect((await ownsItsCentre(page, `[data-list-row="${saved}"] [data-list-name]`)).ok, "its row is on screen").toBe(true);
  expect(await storedFold(page), "an arrival is not a preference either").toBeUndefined();

  // THE SHARE CUE'S TWO HALVES light that same saved list on the reader's behalf, so each reveals
  // too. The cue hides while the pane is open (`_renderShareCue`), so fold, close, then press.
  const foldAndClose = async () => {
    await j.clickByMouse(LISTS, "the Your lists header");
    await expect(page.locator(LISTS)).toHaveAttribute("aria-expanded", "false");
    await page.locator(".ng-logo").click();
    await expect.poll(() => page.evaluate(() => !!(window as any).__neural.deckShown)).toBe(false);
  };
  // "Class ▸" — read the class: opens the pane on it
  await foldAndClose();
  await j.clickByMouse("[data-share-open]", "the cue's Class ▸");
  await expect(page.locator(LISTS), "Class ▸ reads the class, so its section opens").toHaveAttribute("aria-expanded", "true");
  expect((await ownsItsCentre(page, `[data-list-row="${saved}"] [data-list-name]`)).ok).toBe(true);
  // ◉ — light it again WITHOUT opening anything; the section is open when the pane next is
  await foldAndClose();
  await j.clickByMouse("[data-share-cue]", "the cue's ◉");
  expect(await page.evaluate(() => !!(window as any).__neural.deckShown), "◉ covers nothing").toBe(false);
  await openExplore(page);
  await expect(page.locator(LISTS), "…and the lit list is waiting, open").toHaveAttribute("aria-expanded", "true");
  expect(await storedFold(page), "the reader's own fold is what persisted — the reveals wrote nothing").toBe(false);
});
