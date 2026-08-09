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

/** Node ids of the lit set, sorted — the graph's own answer to "what is highlighted". */
const litIds = (page: Page) =>
  page.evaluate(() => {
    const a = (window as any).__neural;
    return Array.from(a._focusIdxSet || [])
      .map((i: any) => a.nodes[i].id)
      .sort();
  });

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

  // and the shell itself says so out loud
  const shell = await (await request.get("/l.html")).text();
  expect(shell, "the shell is noindex,nofollow").toMatch(
    /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i,
  );
  expect(shell, "and canonicalises to the site, never to itself").not.toMatch(
    /rel=["']canonical["'][^>]*\/l\.html/i,
  );
});
