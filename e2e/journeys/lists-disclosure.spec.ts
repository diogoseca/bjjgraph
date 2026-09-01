import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { journey } from "../dsl";

/**
 * YOUR OWN LISTS BECOME LEGIBLE (v1.99.4).
 *
 * Owner: "I should be able to see the listed techniques after adding under Your lists."
 *
 * The bug was an ASYMMETRY. A class a teammate shares with you renders every technique by its
 * full authored name (_sharedBlock → [data-shared-item]); the list YOU built rendered a name,
 * a count, and three buttons — and nothing whatsoever about what was in it. A coach could not
 * check their own class before posting it to the gym group.
 *
 * The contract, one test each:
 *
 *  1. DISCLOSURE. The count line ("3 techniques") is the control: chevron, aria-expanded,
 *     aria-controls, a real band, keyboard-operable. Collapsed means the items are not in the
 *     DOM at all, not merely hidden.
 *  2. THE QUALIFIED NAME. main + the dimmer `from <position>` half, exactly like the shared
 *     block — 648 of 1467 nodes carry a qualifier, "Kimura" alone is 35 techniques here.
 *  3. THE ITEM OPENS ITS DOSSIER, same as [data-shared-item].
 *  4. REMOVE (×, addressed at THAT list) persists, updates the count, and re-lights the
 *     reduced set on the graph when that list is the lit one.
 *  5. AUTO-EXPAND. The list + just made, and any list just added to, is already open — that
 *     is literally the ask ("see the listed techniques AFTER ADDING").
 *  6. THE EMPTY LIST says so, and says how.
 *  7. It works in the 390px drawer: names truncate, controls stay thumb-sized, no scroll trap.
 *  8. Expansion is SESSION state (a Set, not a settings map) — a reload comes back collapsed.
 *
 * Rails: __neural.lists, .activeListId, ._listExpanded(id), ._focusIdxSet, ._dossierIdx,
 *        .addToList, .removeListItem
 * Handles: [data-list-open] (the toggle), [data-list-items], [data-list-item],
 *          [data-list-item-remove], [data-list-empty], [data-list-count], [data-list-chevron]
 */

const SHOTS = resolve(__dirname, "../../tests/artifacts/chrome");
mkdirSync(SHOTS, { recursive: true });

/** Let the deferred systems.json land before touching the Lists section: its arrival
 *  re-renders the whole Explore body, and a click fired in that microsecond lands on a
 *  detached element — a machine-speed artifact, not a user experience. */
const settleSystems = async (page: Page) => {
  await page.evaluate(() => (window as any).__neural._ensureSystems());
  await expect
    .poll(() => page.evaluate(() => !!(window as any).__neural.systems), {
      timeout: 20_000,
    })
    .toBe(true);
  await page.waitForTimeout(80);
};

const openExplore = async (page: Page) => {
  await page.locator(".ng-logo").click();
  await page.locator("[data-view='explore']").click();
  await settleSystems(page);
};

/** A REAL reload with storage kept (the DSL wipes localStorage per navigation otherwise). */
const reloadKeepingStorage = async (page: Page) => {
  await page.evaluate(() => sessionStorage.setItem("__ng_keep", "1"));
  await page.reload();
  await page.waitForFunction(() => !!(window as any).__neural?.nodes?.length);
  await page.evaluate(() => (window as any).__neural.advance(1200));
};

/** Techniques whose authored name carries a `from <position>` qualifier — the disambiguator.
 *  Never hard-coded: picked from the live graph, ordinal-ordered so runs agree. */
const pickQualifiedNodes = (page: Page, n: number) =>
  page.evaluate((count) => {
    const a = (window as any).__neural;
    const usable = a.nodes
      .filter(
        (x: any) =>
          typeof x.o === "number" &&
          (x.ty === "transitions" || x.ty === "submissions") &&
          a.splitName(x.t).from,
      )
      .sort((p: any, q: any) => p.o - q.o);
    const step = Math.max(1, Math.floor(usable.length / count));
    const out: any[] = [];
    for (let i = 0; out.length < count && i * step < usable.length; i++)
      out.push(usable[i * step]);
    return out.map((x: any) => ({
      id: x.id,
      name: x.t,
      main: a.splitName(x.t).main,
      from: a.splitName(x.t).from,
    }));
  }, n);

/** Build a named list of real technique nodes through the app's own creation path. */
const seedList = (page: Page, name: string, ids: string[]) =>
  page.evaluate(
    ({ nm, list }: { nm: string; list: string[] }) => {
      const a = (window as any).__neural;
      const id = a.newList(nm);
      for (const nid of list) a.addToList(nid, id);
      return id;
    },
    { nm: name, list: ids },
  );

// ─────────────────────────────────────────────── 1. the disclosure itself

test("a list's techniques live behind its count line — the chevron opens them in place @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const picks = await pickQualifiedNodes(page, 3);
  const id = await seedList(page, "Monday fundamentals", picks.map((p) => p.id));
  await openExplore(page);

  const toggle = page.locator(`[data-list-open="${id}"]`);
  const items = page.locator(`[data-list-items="${id}"]`);

  // it starts OPEN, because seeding used addToList — the auto-expand contract (test 5 proves
  // it deliberately). Close it first: a disclosure that cannot close is not a disclosure.
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(items).toHaveCount(1);
  await j.clickByMouse(`[data-list-open="${id}"]`, "the count line");

  await expect(toggle, "collapsed").toHaveAttribute("aria-expanded", "false");
  await expect(
    items,
    "collapsed means the techniques are NOT in the DOM — not merely painted out",
  ).toHaveCount(0);
  await expect(page.locator("[data-list-item]")).toHaveCount(0);
  // v1.113.5: the chevron is a STROKED, ROTATING caret, not a filled triangle glyph — the whole
  // point being that a filled triangle is what the play button is. Closed = rotated -90deg.
  await expect(toggle.locator(".ng-caret")).toHaveAttribute("data-open", "0");
  // the count itself never hides: it is the label of the control
  await expect(page.locator(`[data-list-row="${id}"] [data-list-count]`)).toHaveText(/3/);

  // …and open again, by mouse, where it sits
  await j.clickByMouse(`[data-list-open="${id}"]`, "the count line");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(toggle.locator(".ng-caret")).toHaveAttribute("data-open", "1");
  await expect(items).toHaveCount(1);
  await expect(page.locator(`[data-list-items="${id}"] [data-list-item]`)).toHaveCount(3);

  // 24px, NOT 44 — the pane's own figure. `_listAddButton` states the policy these rows live
  // under: thumb size (44) on the IN-ROLL surfaces (option hand, escape hand, landing card),
  // hit one-handed on a moving screen; the compact glyph (24) in the pane, which is a scroller
  // you read with your eyes and hit at leisure. Explore's `+` is 24 on all 136 Positions rows
  // one row below these. Pinning 44 here made the Lists section the ONE part of the pane on a
  // different rhythm, which is exactly what the owner saw. 24 is also WCAG 2.2 AA (2.5.8).
  // and it names what it does for a screen reader
  const box = await j.boxOf(`[data-list-open="${id}"]`, "the disclosure toggle");
  expect(box.height, "pane-sized target").toBeGreaterThanOrEqual(24);
  await expect(toggle).toHaveAttribute("aria-label", /Hide the techniques in “Monday fundamentals”/);
  expect(
    await page.evaluate(
      (lid) =>
        document
          .querySelector(`[data-list-open="${lid}"]`)!
          .getAttribute("aria-controls") ===
        document.querySelector(`[data-list-items="${lid}"]`)!.id,
      id,
    ),
    "aria-controls points at the region it opens",
  ).toBe(true);

  // KEYBOARD: focus the toggle and press Enter — a <button>, so the browser does the rest.
  // The SECOND Enter is the real assertion: toggling rebuilds the whole Explore body, so
  // without deliberate focus restoration the button that was just pressed no longer exists
  // and every further keystroke goes to <body> — invisible by mouse, a dead end by keyboard.
  await page.evaluate(
    (lid) => (document.querySelector(`[data-list-open="${lid}"]`) as HTMLElement).focus(),
    id,
  );
  await page.keyboard.press("Enter");
  await expect(toggle, "Enter collapses it").toHaveAttribute("aria-expanded", "false");
  expect(
    await page.evaluate(
      () =>
        (document.activeElement as HTMLElement | null)?.getAttribute("data-list-open") ||
        null,
    ),
    "focus survives the re-render the toggle itself caused",
  ).toBe(id);
  await page.keyboard.press("Enter");
  await expect(toggle, "…and opens it again").toHaveAttribute("aria-expanded", "true");

  await page
    .locator("[data-lists-section]")
    .screenshot({ path: resolve(SHOTS, "lists-expanded-desktop.png") });
});

// ─────────────────────────────────────────────── 2. the name a coach used

test("an expanded item is named the way a coach named it: WITH the position it comes from @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const picks = await pickQualifiedNodes(page, 4);
  expect(picks.length, "the corpus must contain qualified technique names").toBe(4);
  const id = await seedList(page, "Wednesday", picks.map((p) => p.id));
  await openExplore(page);

  for (const p of picks) {
    const row = page.locator(`[data-list-items="${id}"] [data-list-item="${p.id}"]`);
    await expect(row).toBeVisible();
    const text = ((await row.textContent()) || "").replace(/\s+/g, " ").trim();
    expect(
      text,
      `your own list must be as readable as a received one — "${p.main}" alone matches many ` +
        `other techniques in this graph`,
    ).toContain(p.from.replace(/^from /, ""));
    expect(text, "…without losing the technique's own name").toContain(p.main);
    // the full authored name survives the 390px ellipsis via title/aria
    await expect(row).toHaveAttribute("title", p.name);
  }
});

// ─────────────────────────────────────────────── 3. reading one

test("clicking a listed technique opens its dossier — the same move as a shared item", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const picks = await pickQualifiedNodes(page, 3);
  const id = await seedList(page, "Reading", picks.map((p) => p.id));
  await openExplore(page);

  const want = await page.evaluate(
    (nid) => (window as any).__neural._idIndex.get(nid),
    picks[1].id,
  );
  expect(
    await page.evaluate(() => (window as any).__neural.currentPos),
    "premise: we are not already standing on this node",
  ).not.toBe(want);

  await j.clickByMouse(
    `[data-list-items="${id}"] [data-list-item="${picks[1].id}"]`,
    "a listed technique",
  );
  // v1.132.0: opening a technique NAVIGATES — the exchange stages on it and the card arrives
  // with the landing (~0.6s sim), so the read pumps the clock first. `_dossierIdx` stays null
  // because nothing separate was "opened"; the game's own card is the surface.
  await j.advance(1500);
  await j.landQuestion();
  expect(
    await page.evaluate(() => (window as any).__neural._dossierIdx ?? null),
    "no separate dossier surface is opened",
  ).toBeNull();
  expect(
    await page.evaluate(() => {
      const a = (window as any).__neural;
      const el = a._landEl;
      const body = el ? el.querySelector("[data-land-more-body]") : null;
      return {
        card: !!el,
        idx: a._landIdx,
        unfolded: body ? body.style.display : null,
      };
    }),
    "the item opens the node it names, in the game's own card",
  ).toMatchObject({ card: true, idx: want });
});

// ─────────────────────────────────────────────── 4. removing one

test("× removes that technique from THAT list: count, storage and the lit graph all follow @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const picks = await pickQualifiedNodes(page, 3);
  const id = await seedList(page, "Trim me", picks.map((p) => p.id));
  await openExplore(page);

  // light it on the graph first — the removal has to shrink what is lit, not leave a ghost
  await page.evaluate((lid) => (window as any).__neural.focusList(lid), id);
  expect(await page.evaluate(() => (window as any).__neural._focusIdxSet.size)).toBe(3);

  const victim = picks[1];
  const rm = `[data-list-items="${id}"] [data-list-item-remove="${victim.id}"]`;
  const rmBox = await j.boxOf(rm, "the item remove button");   // pane figure, see the note above
  expect(rmBox.width, "pane-sized target").toBeGreaterThanOrEqual(24);
  expect(rmBox.height, "pane-sized target").toBeGreaterThanOrEqual(24);
  await expect(page.locator(rm)).toHaveAttribute("aria-label", `Remove ${victim.name} from this list`);

  await j.clickByMouse(rm, "the item's ×");

  await expect(
    page.locator(`[data-list-items="${id}"] [data-list-item]`),
    "the row goes",
  ).toHaveCount(2);
  await expect(page.locator(`[data-list-row="${id}"] [data-list-count]`)).toHaveText(/2/);
  await expect(
    page.locator(`[data-list-item="${victim.id}"]`),
    "…and stays gone",
  ).toHaveCount(0);

  const model = await page.evaluate(
    (lid) => {
      const a = (window as any).__neural;
      const lit = Array.from(a._focusIdxSet || []).map((i: any) => a.nodes[i].id).sort();
      return { items: a.lists[lid].items, lit };
    },
    id,
  );
  expect(model.items, "the model lost exactly that technique").toEqual([
    picks[0].id,
    picks[2].id,
  ]);
  expect(
    model.lit,
    "the lit set re-lights REDUCED — a removed technique must not stay glowing",
  ).toEqual([picks[0].id, picks[2].id].sort());

  // it persisted immediately: a reload is the same device coming back
  await reloadKeepingStorage(page);
  expect(
    await page.evaluate((lid) => (window as any).__neural.lists[lid].items, id),
    "the removal lives in the v2 blob, no explicit save needed",
  ).toEqual([picks[0].id, picks[2].id]);
});

// ─────────────────────────────────────────────── 5. auto-expand: the actual ask

test("the list you just made, and the list you just added to, are already open @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await openExplore(page);

  // (a) the newborn from + — open, and saying what to do next
  await j.clickByMouse("[data-lists-new]", "the New list +");
  await page.keyboard.press("Enter"); // keep the default name (the v1.99.3 "+ then rename" flow)
  const id = await page.evaluate(() => (window as any).__neural.activeListId);
  await expect(
    page.locator(`[data-list-items="${id}"]`),
    "a list you just made opens itself — there is nothing to fold away",
  ).toHaveCount(1);
  await expect(page.locator(`[data-list-open="${id}"]`)).toHaveAttribute(
    "aria-expanded",
    "true",
  );

  // (b) fold it by hand, then add a technique from an Explore row with the pane still open:
  //     the add REOPENS it, so the thing you just did is visible where you did it
  await j.clickByMouse(`[data-list-open="${id}"]`, "the count line");
  await expect(page.locator(`[data-list-items="${id}"]`)).toHaveCount(0);

  await page.locator('[data-explore-section="Positions"]').click();
  const leaf = page.locator('[data-list-add][data-list-surface="explore"]').first();
  const nodeId = (await leaf.getAttribute("data-list-add"))!;
  await leaf.click();
  // v1.102.0: the capture star always asks where it goes — nothing is filed into a list nobody picked
  await page.locator(`[data-list-pick="${id}"]`).click();

  await expect(
    page.locator(`[data-list-items="${id}"] [data-list-item="${nodeId}"]`),
    "adding while the pane is open lands VISIBLY in the list — the owner's ask, literally",
  ).toHaveCount(1);
  await expect(page.locator(`[data-list-row="${id}"] [data-list-count]`)).toHaveText(/1/);
});

// ─────────────────────────────────────────────── 6. the empty list

test("an empty list says it is empty, and says which star fills it", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await openExplore(page);

  await j.clickByMouse("[data-lists-new]", "the New list +");
  await page.keyboard.press("Enter");
  const id = await page.evaluate(() => (window as any).__neural.activeListId);

  const empty = page.locator(`[data-list-empty="${id}"]`);
  await expect(empty, "the newborn explains itself instead of showing a bare 0").toBeVisible();
  const copy = ((await empty.textContent()) || "").replace(/\s+/g, " ").trim();
  expect(copy).toContain("No techniques yet");
  // it must name the GLYPH the control actually wears (a star since v1.129.8) and surfaces that
  // REALLY carry [data-list-add]. The old copy named a `+` on "an option card" and "a
  // technique's dossier" — the option cards lost their capture in v1.101.1 and the dossier
  // renderer has been unreachable since v1.101.5, so it pointed at two controls nobody can find.
  expect(copy, "the glyph it names is the glyph on screen").toMatch(/star/i);
  expect(copy, "the in-roll capture path is the one this feature is for").toMatch(
    /card you land on/i,
  );
  expect(copy).toMatch(/detail sheet/i);
  expect(copy).toMatch(/Explore row/i);
  expect(copy, "and it no longer sends anyone to a control that was deleted").not.toMatch(
    /option card|dossier/i,
  );

  // and those surfaces exist: the Explore one is right here, one section-fold away
  await page.locator('[data-explore-section="Positions"]').click();
  await expect(
    page.locator('[data-list-add][data-list-surface="explore"]').first(),
    "the copy points at a control that is actually on this screen",
  ).toBeVisible();

  await page
    .locator("[data-lists-section]")
    .screenshot({ path: resolve(SHOTS, "lists-empty-state.png") });
});

// ─────────────────────────────────────────────── 7. the 390px drawer

// the device this feature ships to. `test.use` is scoped to the describe block so the rest of
// the file stays desktop — and hasTouch has to come from the CONTEXT (page.setViewportSize
// cannot grant it), which is why the tap below needs this wrapper at all.
test.describe("in the 390px drawer", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("expanded lists work in the 390px drawer: names truncate, controls stay thumb-sized, no nested scroller", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  // the longest qualified names in the corpus — the ones that must degrade gracefully
  const picks = await page.evaluate(() => {
    const a = (window as any).__neural;
    return a.nodes
      .filter((x: any) => a.splitName(x.t).from && typeof x.o === "number")
      .sort((p: any, q: any) => q.t.length - p.t.length || p.o - q.o)
      .slice(0, 3)
      .map((x: any) => ({ id: x.id, name: x.t }));
  });
  const id = await seedList(page, "Phone class", picks.map((p) => p.id));

  await page.locator(".ng-logo").click(); // the phone pane opener (the pill is gone, v1.99.0)
  await expect(page.locator(".ng-drill")).toBeVisible();
  await page.locator('.ng-learning-nav [data-view="explore"]').click();
  await settleSystems(page);

  await expect(page.locator(`[data-list-items="${id}"] [data-list-item]`)).toHaveCount(3);

  const geo = await page.evaluate(
    (lid) => {
      const pane = document.querySelector(".ng-drill") as HTMLElement;
      const items = document.querySelector(`[data-list-items="${lid}"]`) as HTMLElement;
      const row = document.querySelector(`[data-list-row="${lid}"]`) as HTMLElement;
      const names = Array.from(
        items.querySelectorAll("[data-list-item]"),
      ) as HTMLElement[];
      const rms = Array.from(
        items.querySelectorAll("[data-list-item-remove]"),
      ) as HTMLElement[];
      const cs = getComputedStyle(items);
      return {
        paneRight: pane.getBoundingClientRect().right,
        rowRight: row.getBoundingClientRect().right,
        truncated: names.map((n) => n.scrollWidth > n.clientWidth),
        nameRights: names.map((n) => Math.round(n.getBoundingClientRect().right)),
        rm: rms.map((r) => {
          const b = r.getBoundingClientRect();
          return { w: Math.round(b.width), h: Math.round(b.height) };
        }),
        overflowX: cs.overflowX,
        overflowY: cs.overflowY,
        scrolls: items.scrollHeight > items.clientHeight + 1,
      };
    },
    id,
  );

  expect(geo.rowRight, "the row stays inside the drawer").toBeLessThanOrEqual(
    geo.paneRight + 1,
  );
  for (const r of geo.nameRights)
    expect(r, "no name spills past the drawer edge").toBeLessThanOrEqual(geo.paneRight + 1);
  expect(
    geo.truncated.some(Boolean),
    "the longest names really do truncate here (otherwise this test proves nothing)",
  ).toBe(true);
  // the drawer does NOT get its own figure: the pane is the same scroller on both form factors,
  // and Explore's rows sit at 24 right beside these. The 44 rule is for surfaces hit MID-ROLL.
  for (const b of geo.rm) {
    expect(b.w, "pane-sized ×").toBeGreaterThanOrEqual(24);
    expect(b.h, "pane-sized ×").toBeGreaterThanOrEqual(24);
  }
  // NOT A SCROLL TRAP: a scroller inside the pane's scroller eats the drawer's own gesture
  expect(geo.overflowX).toBe("visible");
  expect(geo.overflowY).toBe("visible");
  expect(geo.scrolls, "the items region never becomes its own scroll box").toBe(false);

  // the toggle stays a real target in the drawer too (pane figure, not the in-roll one)
  const tb = await j.boxOf(`[data-list-open="${id}"]`, "the drawer toggle");
  expect(tb.height).toBeGreaterThanOrEqual(24);

  // and a real touch on the × removes, at MEASURED coordinates (never locator.click())
  const rb = (await page
    .locator(`[data-list-items="${id}"] [data-list-item-remove="${picks[0].id}"]`)
    .boundingBox())!;
  await page.touchscreen.tap(rb.x + rb.width / 2, rb.y + rb.height / 2);
  await expect(page.locator(`[data-list-items="${id}"] [data-list-item]`)).toHaveCount(2);

  await page.locator(".ng-drill").screenshot({ path: resolve(SHOTS, "lists-expanded-390.png") });
  });
});

// ─────────────────────────────────────────────── 8. the state's lifetime

test("expansion is a reading posture, not a preference: it lives for the session only", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const picks = await pickQualifiedNodes(page, 2);
  const id = await seedList(page, "Session only", picks.map((p) => p.id));
  await openExplore(page);
  await expect(page.locator(`[data-list-items="${id}"]`)).toHaveCount(1);

  await reloadKeepingStorage(page);
  await openExplore(page);

  await expect(
    page.locator(`[data-list-row="${id}"]`),
    "the list itself is durable — it is in the v2 blob",
  ).toHaveCount(1);
  await expect(
    page.locator(`[data-list-open="${id}"]`),
    "…its openness is not: list ids are per-device and die with the list, so a persisted " +
      "fold map would grow an unbounded tail of keys naming lists that no longer exist",
  ).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(`[data-list-items="${id}"]`)).toHaveCount(0);
  expect(
    Object.keys(
      (await page.evaluate(() =>
        (window as any).__neural.get("exploreOpenSections", null),
      )) || {},
    ),
    "and nothing about a list leaked into Explore's section-fold map (whose keys are a " +
      "fixed vocabulary of six section labels)",
  ).not.toContain(id);
});
