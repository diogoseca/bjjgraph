import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { journey } from "../dsl";

/**
 * THE GYM-WHATSAPP SHARE LINK.
 *
 * The acquisition thesis, in the owner's words: a coach posts into a gym WhatsApp group —
 * "these are the techniques we learned in today's class" — with a link. Recipients open it,
 * see exactly those techniques lit up on the knowledge graph, and can drill them.
 *
 * Four rungs of degradation are designed; the one that MATTERS is rung 3, and it is what most
 * of this file tests: with NO Cloudflare Function deployed at all, a `/l/* /l.html 200`
 * rewrite plus client-side decode delivers the whole focused experience. The Function only
 * ever adds the social preview (og:title naming the techniques), which no local test can
 * prove — that is a real-deploy check, deliberately not faked here.
 *
 * Rails: __neural.lists, .activeListId, .listShareCode(id), .listShareUrl(id),
 *        ._sharedIncoming, ._focusIdxSet, ._listFocusId
 * Beats: list_item_added, list_shared, list_opened
 * Wire:  neural/src/lists-codec.src.js (ordinals from node_ordinals.json, never array indices)
 */

const PUBLIC = resolve(__dirname, "../../source/public");
const shellPath = resolve(PUBLIC, "l.html");

/** The production rewrite, emulated. `npx serve` knows nothing about Cloudflare's
 *  `_redirects`, so the fixture serves what Cloudflare would serve for /l/<code>: the built
 *  static shell, byte for byte, with NO Function in the path. The rule itself is asserted
 *  from the emitted `_redirects` in the SEO test below, so this emulation cannot drift from
 *  production without a test going red. */
const serveShellWithoutFunction = async (page: Page) => {
  const shell = readFileSync(shellPath);
  await page.route("**/l/*", (r) =>
    r.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: shell,
    }),
  );
};

/** Open the pane on Explore the way a user does: the logo, then the tab. */
const openExplore = async (page: Page) => {
  await page.locator(".ng-logo").click();
  await page.locator("[data-view='explore']").click();
};

/** Same, but tolerant of the pane ALREADY being open (the logo is a toggle, so clicking it on
 *  an open pane closes it — and the app itself opens the pane on some share-link arrivals). */
const ensureExplore = async (page: Page) => {
  if (!(await page.evaluate(() => !!(window as any).__neural.deckShown)))
    await page.locator(".ng-logo").click();
  await page.locator("[data-view='explore']").click();
};

/** A REAL browser reload of the current URL, with storage kept.
 *  The DSL's init script wipes localStorage on every navigation unless a one-shot
 *  sessionStorage flag is set — so without this the "reload" would arrive as a brand-new
 *  device and could never test whether a code is remembered. `performance` navigation type
 *  stays "reload", which is exactly the distinction under test: a reload is the same visit. */
const reloadKeepingStorage = async (page: Page) => {
  await page.evaluate(() => sessionStorage.setItem("__ng_keep", "1"));
  await page.reload();
  await page.waitForFunction(() => !!(window as any).__neural?.nodes?.length);
  await page.evaluate(() => (window as any).__neural.advance(1200)); // let the boot settle
};

/** Node ids of the lit set, sorted — the graph's own answer to "what is highlighted". */
const litIds = (page: Page) =>
  page.evaluate(() => {
    const a = (window as any).__neural;
    return Array.from(a._focusIdxSet || [])
      .map((i: any) => a.nodes[i].id)
      .sort();
  });

/** Techniques whose name carries a `from <position>` qualifier — in BJJ that qualifier IS the
 *  disambiguator ("Kimura" alone is 35 different techniques in this corpus, "Americana" 16), so
 *  a coach's list is meaningless without it. Never hard-coded: picked from the live graph. */
const pickQualifiedNodes = (page: Page, n: number) =>
  page.evaluate((count) => {
    const a = (window as any).__neural;
    const usable = a.nodes
      .filter(
        (x: any) =>
          typeof x.o === "number" &&
          (x.ty === "transitions" || x.ty === "submissions") &&
          / from /i.test(x.t) &&
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
      o: x.o,
    }));
  }, n);

/** Pick a deterministic class-sized set of real technique nodes (never hard-coded names:
 *  content churns, and a share link must work for whatever the corpus holds today). */
const pickClassNodes = (page: Page, n: number) =>
  page.evaluate((count) => {
    const a = (window as any).__neural;
    const usable = a.nodes
      .filter(
        (x: any) =>
          typeof x.o === "number" &&
          (x.ty === "transitions" || x.ty === "submissions"),
      )
      .sort((p: any, q: any) => p.o - q.o);
    // spread across the ordinal space so the wire test exercises multi-byte varint deltas
    const step = Math.max(1, Math.floor(usable.length / count));
    const out: any[] = [];
    for (let i = 0; out.length < count && i * step < usable.length; i++)
      out.push(usable[i * step]);
    return out.map((x: any) => ({ id: x.id, name: x.t, o: x.o }));
  }, n);

// ────────────────────────────────────────────────────────────── 1. the coach builds a list

test("a coach collects today's class into a list from the surfaces they are already using @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");

  await openExplore(page);
  await expect(
    page.locator("[data-lists-section]"),
    "Lists is the FIRST thing in Explore — it is what the acquisition loop is built on",
  ).toBeVisible();
  await expect(
    page.locator("[data-lists-empty]"),
    "an empty state, not a phantom list",
  ).toBeVisible();

  // add from an Explore row: search, then the row's + affordance
  const picks = await pickClassNodes(page, 2);
  await page.locator(".ng-explorer-search input").fill(picks[0].name);
  const row = page.locator(`[data-list-add="${picks[0].id}"]`).first();
  await expect(
    row,
    "every Explore result carries an add affordance",
  ).toBeVisible();
  await row.click();

  expect(
    await page.evaluate(() => {
      const a = (window as any).__neural;
      const id = a.activeListId;
      return { id, items: (a.lists[id] || {}).items };
    }),
    "the first add creates today's list and puts the technique in it",
  ).toMatchObject({ items: [picks[0].id] });
  await j.expectBeat("list_item_added");

  // add the second from the node dossier ("More ▸" is how a reader gets there mid-roll).
  // On desktop the dossier is not a panel — it is a camera FLIGHT into the in-node card
  // (openDossier -> updateNodeCard), so the card only exists once the flight lands: pump.
  await page.evaluate((id: string) => {
    const a = (window as any).__neural;
    a.openDossier(a._idIndex.get(id));
  }, picks[1].id);
  const dossierAdd = page.locator(
    `[data-list-add="${picks[1].id}"][data-list-surface="dossier"]`,
  );
  // Pump until the card is not just PRESENT but on screen. The card is positioned at the
  // node's screen point from the first frame of the flight, so it exists (and reports itself
  // visible) while still off-viewport — measured at x=1611 in a 1440px window, where
  // document.elementFromPoint returns null and a real mouse can never reach it. Waiting on
  // count() alone made Playwright "click" a button no user could have clicked.
  const onScreen = async () => {
    if (!(await dossierAdd.count())) return false;
    const b = await dossierAdd.boundingBox();
    return (
      !!b &&
      b.x >= 0 &&
      b.y >= 0 &&
      b.x + b.width <= 1440 &&
      b.y + b.height <= 900
    );
  };
  for (let i = 0; i < 30 && !(await onScreen()); i++) await j.advance(400);
  expect(
    await onScreen(),
    "the dossier's add affordance lands on screen after the flight",
  ).toBe(true);
  await dossierAdd.click();

  const stored = await page.evaluate(() => {
    const a = (window as any).__neural;
    const blob = JSON.parse(
      localStorage.getItem("bjj-neural-progress") || "{}",
    );
    return {
      v: blob.v,
      lists: blob.lists,
      active: a.activeListId,
      live: a.lists, // carried into the failure message: which list got which technique
      count: (a.lists[a.activeListId] || {}).items.length,
    };
  });
  expect(
    stored.count,
    `both techniques land in ONE list: ${JSON.stringify(stored.live)}`,
  ).toBe(2);
  expect(
    stored.v,
    "lists ride the EXISTING v2 progress blob — no version bump, no migration",
  ).toBe(2);
  expect(
    Object.keys(stored.lists || {}).length,
    "and they are persisted, not in-memory only",
  ).toBe(1);

  // survives a reload: a coach builds the list during class and shares it after
  await j.boot("/", { preserveStorage: true });
  expect(
    await page.evaluate(() => {
      const a = (window as any).__neural;
      const id = Object.keys(a.lists)[0];
      return a.lists[id].items.length;
    }),
    "the list is still there after a reload",
  ).toBe(2);
});

// ─────────────────────── 1b. the in-roll add, proved with a REAL MOUSE at real coordinates

/**
 * `.ng-landcard` is a FIXED overlay with `max-height:min(320px,40vh); overflow-y:auto`, and this
 * repo's most expensive recurring bug lives in exactly that shape: `pointer-events` is
 * inherited, the overlay root disables it, the canvas hit-tests above anything that does not
 * re-enable it — and keyboard-driven tests mask all of it (the coach's Next button and the
 * landing card's MC options were dead to the mouse until v1.69.1).
 *
 * So this test uses `page.mouse.click(x, y)` at measured coordinates, NOT locator.click():
 * Playwright's click scrolls the element into view first, which would hide a footer clipped by
 * the card's own overflow, and its hit-target check reports a failure that reads like flake.
 * `document.elementFromPoint` is asserted separately so a failure names the thief.
 */
test("the in-roll add affordance survives a REAL mouse click on a full-height landing card @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");

  // Make the card as TALL as production: definition + a film row + the MC question. The DSL
  // aborts technique-content.js (a 20MB payload no journey needs), so the dossier content is
  // injected here — the CARD is the surface under test, not the fetch.
  const nodeId = await page.evaluate(() => {
    const a = (window as any).__neural;
    const node = a.nodes[a.currentPos];
    const key = a.deckKeyFor(node).key;
    (window as any).NG_CONTENT = (window as any).NG_CONTENT || { decks: {} };
    (window as any).NG_CONTENT.decks[key] = {
      def: "A dominant top position where the hips ride above the opponent's belt line, both knees pinched to the ribs, chest low and elbows tight to the head.",
      clips: [
        { id: "aaaaaaaaaaa", title: "Mount control fundamentals", by: "Legend", vertical: true, start: 0, end: 42 },
        { id: "bbbbbbbbbbb", title: "Staying heavy", by: "Legend", vertical: true, start: 0, end: 51 },
        { id: "ccccccccccc", title: "Hip pressure", by: "Legend", vertical: false, start: 0, end: 38 },
      ],
    };
    a.renderLandCard(node, "land", null); // re-render the same landing with content present
    return node.id;
  });

  const card = page.locator(".ng-landcard");
  await expect(card, "the landing card is up").toBeVisible();
  const add = card.locator('[data-list-add][data-list-surface="land"]');
  await expect(add, "…and it carries the add-to-class affordance").toHaveCount(1);

  const geom = await page.evaluate(() => {
    const c = document.querySelector(".ng-landcard") as HTMLElement;
    const b = c.querySelector("[data-list-add]") as HTMLElement;
    const cr = c.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    const x = Math.round(br.x + br.width / 2);
    const y = Math.round(br.y + br.height / 2);
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    return {
      x,
      y,
      scrolls: c.scrollHeight > c.clientHeight + 1,
      cardBottom: Math.round(cr.bottom),
      btnBottom: Math.round(br.bottom),
      belowCard: Math.round(br.bottom - cr.bottom),
      inViewport: br.x >= 0 && br.y >= 0 && br.right <= window.innerWidth && br.bottom <= window.innerHeight,
      pe: getComputedStyle(b).pointerEvents,
      hit: !el ? "NOTHING (the canvas is above it)" : el === b || b.contains(el) ? "the button" : `${el.tagName}.${el.className}`,
    };
  });

  expect(
    geom.scrolls,
    "premise: with film + a question the card really does overflow its 320px box — otherwise " +
      "this test proves nothing about a clipped footer",
  ).toBe(true);
  expect(geom.pe, "pointer-events must be re-enabled INLINE on the button").toBe("auto");
  expect(
    geom.belowCard,
    `the add button is clipped ${geom.belowCard}px below the card's own scroll box ` +
      `(card bottom ${geom.cardBottom}, button bottom ${geom.btnBottom}) — a real mouse cannot ` +
      `reach it without scrolling inside the card first`,
  ).toBeLessThanOrEqual(1);
  expect(geom.inViewport, "and it is on screen").toBe(true);
  expect(geom.hit, `elementFromPoint(${geom.x},${geom.y}) must be the button itself`).toBe("the button");

  // the proof: a real trusted mouse click at those coordinates, no scrolling, no keyboard
  await page.mouse.click(geom.x, geom.y);

  expect(
    await page.evaluate(() => {
      const a = (window as any).__neural;
      const id = a.activeListId;
      return { items: (a.lists[id] || {}).items || [] };
    }),
    "one mouse click on the landing card puts the state you are standing in into today's class",
  ).toMatchObject({ items: [nodeId] });
  await j.expectBeat("list_item_added");
});

// ────────────────────────────────────────────────────────────── 2. sharing it

test("sharing produces a canonical, WhatsApp-short link that decodes back to the same class @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");

  const picks = await pickClassNodes(page, 5);
  await page.evaluate(
    (ids: string[]) => {
      const a = (window as any).__neural;
      for (const id of ids) a.addToList(id);
    },
    picks.map((p) => p.id),
  );

  await openExplore(page);
  const listId = await page.evaluate(
    () => (window as any).__neural.activeListId,
  );
  await expect(
    page.locator(`[data-list-row="${listId}"] [data-list-count]`),
  ).toHaveText(/5/);

  await page.locator(`[data-list-row="${listId}"] [data-list-share]`).click();

  const share = await page.evaluate(() => {
    const a = (window as any).__neural;
    const url = a._lastShareUrl;
    const code = a.listShareCode(a.activeListId);
    const back = (window as any).NGLists.ngListDecodeIds(
      code,
      a._ordinalIndex(),
    );
    return {
      url,
      code,
      ids: back.ids,
      unknown: back.unknown,
      shareId: (window as any).NGLists.ngListShareId(code),
    };
  });

  expect(share.url, "the link is a /l/<code> URL").toMatch(
    /\/l\/[A-Za-z0-9_-]+$/,
  );
  expect(
    share.url.length,
    `a 5-technique link must be paste-short (got ${share.url.length}: ${share.url})`,
  ).toBeLessThan(70);
  expect(
    [...share.ids].sort(),
    "it decodes back to exactly the techniques of the class",
  ).toEqual(picks.map((p) => p.id).sort());
  expect(share.unknown, "every technique resolved — no silent drop").toEqual(
    [],
  );
  expect(
    share.shareId,
    "share_id is the first 12 chars — the creator/recipient analytics join",
  ).toBe(share.code.slice(0, 12));
  await j.expectBeat("list_shared");

  // canonicality: the SAME class shared from a differently-ordered list is the same string,
  // which is the only reason the funnel joins without server state
  const reordered = await page.evaluate(
    (ids: string[]) => {
      const a = (window as any).__neural;
      const id = a.newList("Reversed");
      for (const nid of ids.slice().reverse()) a.addToList(nid, id);
      return a.listShareCode(id);
    },
    picks.map((p) => p.id),
  );
  expect(reordered, "one set of techniques has exactly one spelling").toBe(
    share.code,
  );

  // and the code is ORDINAL-based, not index-based: the ordinals are what got committed
  const wire = await page.evaluate((code: string) => {
    const a = (window as any).__neural;
    return (window as any).NGLists.ngListDecodeOrdinals(code).ordinals.map(
      (o: number) => a.nodes.find((n: any) => n.o === o).id,
    );
  }, share.code);
  expect(
    [...wire].sort(),
    "the wire carries permanent ordinals, resolved back through them",
  ).toEqual(picks.map((p) => p.id).sort());
});

// ─────────────────────────────────────── 3. THE RUNG THAT MATTERS: no Function, full experience

test("a student opens the WhatsApp link with NO Function deployed and the graph lights up @curated", async ({
  page,
}) => {
  const j = journey(page);
  // creator half — build the class and get the real link
  await j.boot("/");
  await j.land("Mount Top");
  const picks = await pickClassNodes(page, 5);
  const code = await page.evaluate(
    (ids: string[]) => {
      const a = (window as any).__neural;
      for (const id of ids) a.addToList(id);
      return a.listShareCode(a.activeListId);
    },
    picks.map((p) => p.id),
  );

  // recipient half — a stranger, storage wiped by boot(), arriving on the STATIC SHELL only
  await serveShellWithoutFunction(page);
  await j.boot(`/l/${code}`);

  expect(
    await page.evaluate(() =>
      document.documentElement.hasAttribute("data-share-og"),
    ),
    "no Function touched this response — the shell alone is doing the work",
  ).toBe(false);

  const arrival = await page.evaluate(() => {
    const a = (window as any).__neural;
    return {
      incoming: a._sharedIncoming && a._sharedIncoming.ids,
      unknown: a._sharedIncoming && a._sharedIncoming.unknown,
      paneShown: !!a.deckShown,
      view: a._viewMode,
      lit: !!(a._focusIdxSet && a._focusIdxSet.size),
      hasLists: Object.keys(a.lists || {}).length,
    };
  });
  expect(
    [...(arrival.incoming || [])].sort(),
    "the link resolved to exactly the coach's techniques",
  ).toEqual(picks.map((p) => p.id).sort());
  expect(arrival.unknown, "nothing unresolved on the same build").toEqual([]);
  expect(
    arrival.paneShown,
    "the pane is open on arrival — the list is the first thing you read",
  ).toBe(true);
  expect(arrival.view, "on Explore, where Lists live").toBe("explore");
  expect(arrival.lit, "and the graph is lit").toBe(true);
  expect(
    arrival.hasLists,
    "a received link is not silently adopted — it is offered",
  ).toBe(0);

  expect(
    await litIds(page),
    "exactly the shared techniques are lit — none dropped, none extra",
  ).toEqual(picks.map((p) => p.id).sort());

  // the received list is READABLE as a list, every technique named
  await expect(page.locator("[data-shared-list]")).toBeVisible();
  await expect(page.locator("[data-shared-item]")).toHaveCount(5);
  for (const p of picks)
    await expect(page.locator(`[data-shared-item="${p.id}"]`)).toBeVisible();
  await j.expectBeat("list_opened");

  // the fog: a non-member is dimmed, and it is the SELECTION that dimmed it (not the path view)
  const fog = await page.evaluate(
    (ids: string[]) => {
      const a = (window as any).__neural;
      const outsider = a.nodes.find((n: any) => ids.indexOf(n.id) < 0);
      return {
        dimsOutsider: !a._focusIdxSet.has(outsider.idx),
        pathDim: !!a._pathDim,
      };
    },
    picks.map((p) => p.id),
  );
  expect(fog.dimsOutsider).toBe(true);
  expect(fog.pathDim).toBe(false);

  // …and they can DRILL them, which is the point of the whole link
  await page.locator("[data-shared-drill]").click();
  expect(
    await page.evaluate(() => {
      const a = (window as any).__neural;
      return { studying: a._paneStudyActive(), deckKey: a.deck && a.deck.key };
    }),
    "one click from a shared link into studying the class",
  ).toMatchObject({ studying: true });

  // keeping it is one deliberate click, and then it is an ordinary list of theirs
  await page.evaluate(() => (window as any).__neural.openPane("explore"));
  await page.locator("[data-shared-save]").click();
  const saved = await page.evaluate(() => {
    const a = (window as any).__neural;
    const id = Object.keys(a.lists)[0];
    return {
      count: Object.keys(a.lists).length,
      items: a.lists[id].items.length,
      blob: !!JSON.parse(localStorage.getItem("bjj-neural-progress") || "{}")
        .lists,
    };
  });
  expect(saved, "saved once, persisted, still five techniques").toMatchObject({
    count: 1,
    items: 5,
    blob: true,
  });
});

/** The creator half, factored out: build a class from `picks` and return the real share code. */
const codeFor = (page: Page, ids: string[]) =>
  page.evaluate((list: string[]) => {
    const a = (window as any).__neural;
    for (const id of list) a.addToList(id);
    return a.listShareCode(a.activeListId);
  }, ids);

// ─────────────── 3b. what the recipient can READ, RE-LIGHT and be asked only once

test("a received technique is named the way a coach named it: WITH the position it comes from @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  // deliberately all-qualified: "Americana" is not a technique a coach taught,
  // "Americana from Mount" is — and this corpus holds 16 different Americanas.
  const picks = await pickQualifiedNodes(page, 4);
  expect(picks.length, "the corpus must contain qualified technique names").toBe(4);
  const code = await codeFor(
    page,
    picks.map((p) => p.id),
  );

  await serveShellWithoutFunction(page);
  await j.boot(`/l/${code}`);

  for (const p of picks) {
    const row = page.locator(`[data-shared-item="${p.id}"]`);
    await expect(row).toBeVisible();
    const text = ((await row.textContent()) || "").replace(/\s+/g, " ").trim();
    expect(
      text,
      `the recipient sees "${text}" — the class drilled "${p.name}", and "${p.main}" alone ` +
        `matches ${"many"} other techniques in the graph`,
    ).toContain(p.from.replace(/^from /, ""));
    expect(text, "…without losing the technique's own name").toContain(p.main);
  }

  // the same qualifier must survive into the toast a coach sees when adding/removing
  const toast = await page.evaluate((id: string) => {
    const a = (window as any).__neural;
    a.toggleListItem(id, "shared");
    const el = document.querySelector(".ng-event") || document.body;
    return (el.textContent || "").replace(/\s+/g, " ");
  }, picks[0].id);
  expect(toast, `the confirmation names the technique in full (got: ${toast})`).toContain(
    picks[0].from.replace(/^from /, ""),
  );
});

test("the recipient can re-light the received class on the graph after the fog clears @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const picks = await pickClassNodes(page, 5);
  const want = picks.map((p) => p.id).sort();
  const code = await codeFor(
    page,
    picks.map((p) => p.id),
  );

  await serveShellWithoutFunction(page);
  await j.boot(`/l/${code}`);
  expect(await litIds(page), "lit on arrival").toEqual(want);

  // the recipient closes the pane to actually play — every focus source is cleared here
  await page.locator(".ng-explorer-close").click();
  expect(
    await page.evaluate(() => {
      const a = (window as any).__neural;
      return !!(a._focusIdxSet && a._focusIdxSet.size);
    }),
    "closing the pane clears the fog (this is the existing, intended behaviour)",
  ).toBe(false);

  // …and now they want it back. Every OTHER focus source in the app can be re-lit.
  await openExplore(page);
  const relight = page.locator("[data-shared-relight]");
  await expect(
    relight,
    "the received class — the one visual that made the link worth opening — must be re-lightable",
  ).toBeVisible();
  await relight.click();
  expect(await litIds(page), "re-lit, exactly the coach's set").toEqual(want);

  // and it survives an Explore re-render (a keystroke in the search box resets the fog)
  await page.locator(".ng-explorer-search input").fill("mount");
  expect(await litIds(page), "a search keystroke does not drop the re-lit selection").toEqual(want);
});

test("a saved or dismissed link stops asking: a reload is not a fresh offer @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const picks = await pickClassNodes(page, 3);
  const code = await codeFor(
    page,
    picks.map((p) => p.id),
  );

  // ── dismissed, then reloaded: the recipient said no once
  await serveShellWithoutFunction(page);
  await j.boot(`/l/${code}`);
  await expect(page.locator("[data-shared-list]")).toBeVisible();
  await page.locator("[data-shared-dismiss]").click();
  await reloadKeepingStorage(page);
  await ensureExplore(page);
  await expect(
    page.locator("[data-shared-list]"),
    "a dismissed link does not come back on reload — that is nagging, forever",
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => (window as any).__neural._sharedIncoming),
    "and it is not sitting in memory waiting for the next render either",
  ).toBeNull();

  // ── saved, then reloaded: it is already theirs; offering it again is a duplicate trap
  await j.boot(`/l/${code}`);
  await page.locator("[data-shared-save]").click();
  const savedIds = await page.evaluate(() => Object.keys((window as any).__neural.lists));
  await reloadKeepingStorage(page);
  await ensureExplore(page);
  await expect(
    page.locator("[data-shared-list]"),
    "a saved link is not re-offered — the list is already in their Lists",
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => Object.keys((window as any).__neural.lists).length),
    "and reloading did not duplicate it",
  ).toBe(savedIds.length);
  expect(
    await litIds(page),
    "instead the saved list is what lights up — the link still does its visual job",
  ).toEqual(picks.map((p) => p.id).sort());
});

test("Lists never contradicts itself in front of a first-time recipient @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const picks = await pickClassNodes(page, 5);
  const code = await codeFor(
    page,
    picks.map((p) => p.id),
  );

  await serveShellWithoutFunction(page);
  await j.boot(`/l/${code}`);

  const read = await page.evaluate(() => {
    const sec = document.querySelector("[data-lists-section]") as HTMLElement;
    const shared = sec.querySelector("[data-shared-list]") as HTMLElement;
    const head = sec.querySelector("[data-lists-head]") as HTMLElement;
    const order = shared && head ? shared.compareDocumentPosition(head) : 0;
    return {
      sharedFirst: !!(order & Node.DOCUMENT_POSITION_FOLLOWING),
      headText: (head ? head.textContent || "" : "").replace(/\s+/g, " ").trim(),
      emptyText: (sec.querySelector("[data-lists-empty]")?.textContent || "").replace(/\s+/g, " ").trim(),
    };
  });
  expect(
    read.sharedFirst,
    "the thing they came for is read FIRST; their own (empty) Lists cannot be printed above it",
  ).toBe(true);
  expect(
    read.headText,
    `a first-time recipient must not read "Lists (0)" above "Shared with you · 5 techniques" ` +
      `(got: "${read.headText}")`,
  ).not.toMatch(/\(\s*0\s*\)/);
});

test("deleting a list asks first, and can be taken back @curated", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const picks = await pickClassNodes(page, 3);
  await codeFor(
    page,
    picks.map((p) => p.id),
  );
  await openExplore(page);
  const listId = await page.evaluate(() => (window as any).__neural.activeListId);
  const del = page.locator(`[data-list-row="${listId}"] [data-list-delete]`);
  const share = page.locator(`[data-list-row="${listId}"] [data-list-share]`);

  const gap = await page.evaluate(
    ([a, b]: string[]) => {
      const r1 = (document.querySelector(a) as HTMLElement).getBoundingClientRect();
      const r2 = (document.querySelector(b) as HTMLElement).getBoundingClientRect();
      return Math.round(r2.left - r1.right);
    },
    [`[data-list-row="${listId}"] [data-list-share]`, `[data-list-row="${listId}"] [data-list-delete]`],
  );
  expect(
    gap,
    `delete sits ${gap}px from Share — one slip destroys the class the coach just built`,
  ).toBeGreaterThanOrEqual(10);

  // first click ARMS, it does not destroy
  await del.click();
  expect(
    await page.evaluate(() => Object.keys((window as any).__neural.lists).length),
    "one click on × must not delete a coach's class outright",
  ).toBe(1);
  await expect(del, "…it asks").toHaveAttribute("data-list-delete-armed", "1");

  // second click deletes — and leaves a way back
  await del.click();
  expect(await page.evaluate(() => Object.keys((window as any).__neural.lists).length)).toBe(0);
  const undo = page.locator("[data-list-undo]");
  await expect(undo, "a delete with no undo is a trap next to a Share button").toBeVisible();
  await undo.click();
  expect(
    await page.evaluate(() => {
      const a = (window as any).__neural;
      const id = Object.keys(a.lists)[0];
      return { lists: Object.keys(a.lists).length, items: (a.lists[id] || {}).items };
    }),
    "undo restores the list, with its techniques",
  ).toMatchObject({ lists: 1, items: picks.map((p) => p.id) });
});

test("a hostile or stale link degrades: nothing crashes, nothing lies", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  const good = await page.evaluate(() => {
    const a = (window as any).__neural;
    const nodes = a.nodes
      .filter((n: any) => typeof n.o === "number")
      .slice(0, 3);
    for (const n of nodes) a.addToList(n.id);
    return {
      code: a.listShareCode(a.activeListId),
      ids: nodes.map((n: any) => n.id),
    };
  });
  // a code from a NEWER build: an ordinal this build has never heard of, alongside real ones
  const futureCode = await page.evaluate((ids: string[]) => {
    const a = (window as any).__neural;
    const os = ids.map((id: string) => a.nodes[a._idIndex.get(id)].o);
    return (window as any).NGLists.ngListEncodeOrdinals([...os, 9_000_000]);
  }, good.ids);

  await serveShellWithoutFunction(page);
  await j.boot(`/l/${futureCode}`);
  const forward = await page.evaluate(() => {
    const a = (window as any).__neural;
    return { ids: a._sharedIncoming.ids, unknown: a._sharedIncoming.unknown };
  });
  expect(
    [...forward.ids].sort(),
    "the techniques this build knows still open",
  ).toEqual([...good.ids].sort());
  expect(
    forward.unknown,
    "and the one it cannot resolve is reported, not invented",
  ).toEqual([9_000_000]);
  await expect(
    page.locator("[data-shared-unresolved]"),
    "the recipient is told, in the UI",
  ).toBeVisible();

  // a code that is PERFECTLY VALID but resolves to nothing this build knows: "the link is
  // fine, your app is older" is a different sentence from "that is not a link", and the
  // recipient can act on one of them (wait for the next deploy) and not the other.
  const staleCode = await page.evaluate(() =>
    (window as any).NGLists.ngListEncodeOrdinals([9_000_001, 9_000_002]),
  );
  await j.boot(`/l/${staleCode}`);
  const stale = await page.evaluate(() => {
    const a = (window as any).__neural;
    return {
      incoming: a._sharedIncoming,
      told: !!document.querySelector("[data-shared-stale]"),
      text: (document.querySelector("[data-shared-stale]")?.textContent || "").replace(/\s+/g, " ").trim(),
      beat: (a.beats || []).filter((b: any) => b.beat === "list_stale").length,
    };
  });
  expect(
    stale.told,
    "a valid code this build cannot resolve must SAY the link is fine and the app is behind",
  ).toBe(true);
  expect(stale.text, `and say how many (got: "${stale.text}")`).toMatch(/2/);
  expect(stale.incoming, "there is nothing to offer, so nothing is offered").toBeNull();
  expect(stale.beat, "and it is measurable: a stale open is not a failed open").toBe(1);

  // garbage: the app is a normal app, no focus set, no phantom list, no thrown error
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await j.boot("/l/not!a!code");
  expect(
    await page.evaluate(() => {
      const a = (window as any).__neural;
      return {
        incoming: a._sharedIncoming,
        lit: !!(a._focusIdxSet && a._focusIdxSet.size),
      };
    }),
    "an unparseable code is simply not a share link",
  ).toEqual({ incoming: null, lit: false });
  await expect(
    page.locator("[data-shared-stale]"),
    "…and garbage is NOT dressed up as a stale-build message",
  ).toHaveCount(0);
  expect(errors, "and it did not throw").toEqual([]);
});

// ────────────────────────────────────────────────────────────── 4. SEO: /l is not content

test("/l leaks into NOTHING a crawler reads: not the sitemap, not llms.txt, not the index @curated", async ({
  page,
  request,
}) => {
  // the emitted rewrite rule — this is what makes the no-Function rung real in production,
  // and what the fixture emulation above stands in for
  const redirects = readFileSync(resolve(PUBLIC, "_redirects"), "utf8");
  expect(
    redirects,
    "the /l/* -> /l.html 200 rewrite is emitted for Cloudflare",
  ).toMatch(/^\/l\/\*\s+\/l\.html\s+200\s*$/m);

  const sitemap = await (await request.get("/sitemap.xml")).text();
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(
    locs.length,
    "the sitemap is the real one, not an empty file",
  ).toBeGreaterThan(4000);
  expect(
    locs.filter((u) =>
      /\/l(\.html|\/|$)/.test(u.replace(/^https?:\/\/[^/]+/, "")),
    ),
    "a share URL is not content — it must never be offered to a crawler",
  ).toEqual([]);

  const llms = await (await request.get("/llms.txt")).text();
  expect(llms.length, "llms.txt is the real one").toBeGreaterThan(1000);
  expect(
    /\/l\.html|\]\(\/l\/|https?:\/\/[^\s)]*\/l\//.test(llms),
    "nor to an AI crawler",
  ).toBe(false);

  // the edge preview names techniques from the SAME manifest, so it must carry the qualifier
  // too: a WhatsApp preview reading "Kimura, Armbar, Sweep" names nothing at all.
  const manifest = JSON.parse(readFileSync(resolve(PUBLIC, "l-manifest.json"), "utf8"));
  const qualified = Object.entries(manifest.names as Record<string, string>).filter(([, n]) =>
    / from /i.test(n),
  );
  expect(
    qualified.length,
    "the manifest holds the qualified names (648 of 1467 nodes carry a `from <position>`)",
  ).toBeGreaterThan(500);
  const { ogTitle } = await import("../../neural/src/lists.src.js").then((m) => ({
    ogTitle: m.ngShareOgTitle,
  }));
  const sample = qualified[0][1];
  expect(
    ogTitle([sample], 1),
    `the preview text keeps the position qualifier (from "${sample}")`,
  ).toContain(sample.replace(/^.*? from /i, ""));

  // and the shell itself says so out loud
  const shell = await (await request.get("/l.html")).text();
  expect(shell, "the shell is noindex,nofollow").toMatch(
    /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i,
  );
  expect(shell, "and canonicalises to the site, never to itself").not.toMatch(
    /rel=["']canonical["'][^>]*\/l\.html/i,
  );
});
