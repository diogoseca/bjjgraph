// == HARNESS CONSTRAINT: NO TESTED CONFIGURATION REPRODUCES PRODUCTION (D-D-05, corrected D-D-06) ==
//
// This spec requests 1 route(s) emitted TWICE - as `X.html` AND `X/index.html` - and the two are
// DIFFERENT DOCUMENTS, not copies (different `data-slug`; the folder copy usually lacks
// `#page-graph-data`). Which one you get depends on the server, and NO server we have tested
// serves what production serves:
//
//   production                  /X -> FLAT     /X/ -> FOLDER    both 200, NEITHER redirects
//   `serve` (ALL TEN configs)   /X -> FOLDER   /X/ -> FOLDER    /X.html -> 301 to /X -> FOLDER
//   `dev-serve.mjs`, NORMALLY   /X -> FOLDER   /X/ -> FOLDER    IDENTICAL - see below
//   `dev-serve.mjs`, PAIRED     /X -> FLAT     /X/ -> FOLDER    <- this one MATCHES production
//
// DEV-SERVE DOES NOT MATCH PRODUCTION, AND READING ITS SOURCE SUGGESTS IT DOES. `resolveHtml`
// (`scripts/dev-serve.mjs:352-363`) really does try `X.html` first for a bare route - but it has
// exactly ONE call site, `:387`, inside the paired-session branch guarded by `pairedToken()`. The
// normal static path is `:415`, `serveHandler(req, res, {public: STATIC_ROOT, etag: true})` -
// serve-handler, the SAME library `serve` uses, with cleanUrls left at default on purpose
// (`:412-413`: "cleanUrls and directoryListing are already serve-handler defaults - don't
// override"). THREE PEOPLE READ THAT FUNCTION AND NONE CHECKED WHETHER IT RUNS. CLAUDE.md 6.8:
// verifying that code says the right thing is not verifying that it executes.
//
// AND IT IS NOT A STABLE PROPERTY OF A MODE - IT IS A LIVE FLIP ON A 2-SECOND POLL.
// `pairedToken()` (`:211-217`) caches for 2000 ms and re-reads `e2e/paired/.session/bridge-token`
// on expiry, so dev-serve's URL RESOLUTION CHANGES WITHIN TWO SECONDS of that file appearing or
// vanishing, on a running server, with no restart. Note the DIRECTION: paired ON -> resolveHtml ->
// bare serves the FLAT file -> MATCHES PRODUCTION. Paired OFF -> serve-handler -> bare serves the
// FOLDER copy. SO ATTACHING THE DEBUGGER MAKES THE SERVER MORE FAITHFUL, NOT LESS - a defect that
// exists only in the folder copy would VANISH the moment someone attached paired debugging to
// investigate it, and return when they detached. The discrepancy hides from the one tool that
// would find it.
//
// SO THE ASSERTIONS BELOW RUN AGAINST THE FOLDER COPY, a strictly degraded clone - 1,506 of 1,518
// folder copies carry no `#page-graph-data` and pair deltas reach 35,637 bytes. No exposed spec
// references `#page-graph-data` or `__rollPositions`, so the known-missing block is asserted
// nowhere; but the documents differ by 6-25 KB, so anything asserting layout, element counts or
// positions could move if the resolver changes.
//
// Affected route(s) here: /Positions/Mount
//
// DO NOT "FIX" THIS BY ADDING A TRAILING SLASH OR A `.html` SUFFIX. Under the CURRENT config both
// still land on the folder copy. Under `cleanUrls:false` the `.html` form DOES reach the flat file
// (200, no redirect) - but bare `/X` and `/X/` then return a DIRECTORY LISTING (~19 KB, "Files
// within ..."), trading an unreachable document for a canonical URL that serves a file index. A
// faithful harness needs rewrite rules, a different server, or a tree without the duplicates.
// None of those is measured yet; quartz-cto is not naming a fix until one is.
import { test, expect } from '@playwright/test';
import { journey } from '../dsl';

const seedHalfGuardFilm = async (page: any) => page.evaluate(() => {
  const w = window as any;
  w.NG_CONTENT ||= {}; w.NG_CONTENT.decks ||= {};
  w.NG_CONTENT.decks['Half Guard|Top'] = {
    clips: [{ id: 'aQ2vFXXBn-o', title: 'Half guard demonstration' }],
  };
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test.describe(`${viewport.width}px landing reveal`, () => {
    test.use({ viewport });
    test('reveal updates the URL and highlight together; the entire flight clears the rows', async ({ page }, testInfo) => {
      const j = journey(page);
      await j.boot('/Positions/Side-Control/Bottom');
      await j.advance(8000);
      await seedHalfGuardFilm(page);
      const before = await page.evaluate(() => {
        const a = (window as any).__neural;
        const idx = a.nodes.findIndex((n: any) => n.id === 'Positions/Half-Guard');
        if (idx < 0) throw new Error('Half Guard Top missing');
        a.rigStart(idx); a.rig('role', [0]); a.lastInteract = a.now; a.resetRoll();
        return { path: location.pathname, focus: a.focusIdx, history: history.length, kicker: a.NG_ARRIVE_KICKER };
      });
      expect(before.focus).toBe(-1);
      await j.advance(before.kicker * 1000 - 100);
      expect(new URL(page.url()).pathname).toBe(before.path);
      expect(await page.evaluate(() => (window as any).__neural.focusIdx)).toBe(-1);
      await j.advance(150);
      const reveal = await page.evaluate(() => {
        const a = (window as any).__neural;
        return { path: location.pathname, focus: a.nodes[a.focusIdx].id, land: a.nodes[a._landIdx].id, history: history.length };
      });
      expect(reveal.focus).toBe('Positions/Half-Guard');
      expect(reveal.path).toBe('/' + reveal.focus);
      expect(reveal.land).toBe(reveal.focus);
      expect(reveal.history).toBe(before.history);
      await j.landSettled();
      await expect(page.locator('[data-land-film]')).toBeVisible();
      const heading = await page.evaluate(() => {
        const a = (window as any).__neural;
        return { bottom: a.evcSubRef.current.getBoundingClientRect().bottom,
          rowTop: Math.min(a._landEl.getBoundingClientRect().top, a._landFilmEl.getBoundingClientRect().top) };
      });
      expect(heading.bottom).toBeLessThan(heading.rowTop);
      await page.screenshot({ path: testInfo.outputPath(`reveal-${viewport.width}.jpg`), quality: 55 });
      const frames = await page.evaluate(() => {
        const a = (window as any).__neural;
        const result = [];
        for (let i = 0; i < 300; i++) {
          a.advance(1000 / 60);
          const n = a.nodes[a.focusIdx], scale = a.W / a.cam.vw;
          const nodeK = Math.max(.4, Math.min(1, a.cam.vw / (a.graphW * .5)));
          const lowerEdge = a.H / 2 + (a._LY(n) - a.cam.cy) * scale + n.r * nodeK * scale * 1.6;
          const boxes = [a._landEl, a._landFilmEl, a.optionsRef.current].filter((el: HTMLElement) => el && el.offsetHeight && getComputedStyle(el).display !== 'none');
          const top = Math.min(...boxes.map((el: HTMLElement) => el.getBoundingClientRect().top));
          const mid = a.pairMid(n);
          result.push({ lowerEdge, top, y: a.H / 2 + (mid.y - a.cam.cy) * scale });
        }
        return result;
      });
      for (const f of frames) expect(f.lowerEdge, JSON.stringify(f)).toBeLessThan(f.top - 2);
      const tail = frames.slice(-30).map(f => f.y);
      expect(Math.max(...tail) - Math.min(...tail)).toBeLessThan(3);
      await page.screenshot({ path: testInfo.outputPath(`settled-${viewport.width}.jpg`), quality: 55 });
    });

    test('staging and layer changes center the node in the current available space', async ({ page }) => {
      const j = journey(page);
      await j.boot('/Positions/Side-Control/Bottom');
      await j.advance(8000);
      await seedHalfGuardFilm(page);
      for (const layers of [[false, false, true], [true, false, true], [true, true, true], [false, false, false]]) {
        await page.evaluate(([card, film, hand]) => {
          const a = (window as any).__neural;
          a.setLayer('card', card); a.setLayer('film', film); a.setLayer('hand', hand);
          a.stageRollAt(a.nodes.findIndex((n: any) => n.id === 'Positions/Half-Guard'));
        }, layers);
        await j.landSettled();
        await j.advance(6500);
        const m = await page.evaluate(() => {
          const a = (window as any).__neural, n = a.nodes[a.focusIdx], mid = a.pairMid(n);
          const surfaces = [a._landEl, a._landFilmEl, a._handShown() && a.optionsRef.current].filter((el: HTMLElement) => el && el.offsetHeight && getComputedStyle(el).display !== 'none');
          const bottom = Math.min(a.H - 16, ...surfaces.map((el: HTMLElement) => a.H - parseFloat(getComputedStyle(el).bottom) - el.offsetHeight - 12));
          return { y: a.H / 2 + (mid.y - a.cam.cy) * a.W / a.cam.vw, want: (16 + bottom) / 2, path: location.pathname, id: n.id };
        });
        expect(m.path).toBe('/' + m.id);
        expect(Math.abs(m.y - m.want), JSON.stringify({ layers, ...m })).toBeLessThan(5);
      }
    });
  });
}

test('a played transition replaces the URL with its revealed landing', async ({ page }) => {
  const j = journey(page);
  await j.boot('/Positions/Mount');
  await j.advance(8000);
  const pick = await page.evaluate(() => {
    const a = (window as any).__neural;
    const opt = a._optList.find((o: any) => o.node.ty === 'transitions' && o.res >= 0 && o.res !== a.currentPos);
    if (!opt) throw new Error('No positional transition available');
    return { name: opt.node.t, path: location.pathname, history: history.length };
  });
  await j.rig('resolve', [0.01]); await j.rig('outcome', [0.01]);
  await j.pick(pick.name);
  await j.nextHand();
  const end = await page.evaluate(() => {
    const a = (window as any).__neural;
    return { path: location.pathname, id: a.nodes[a.focusIdx].id, land: a.nodes[a._landIdx].id, history: history.length };
  });
  expect(end.path).not.toBe(pick.path);
  expect(end.path).toBe('/' + end.id);
  expect(end.land).toBe(end.id);
  expect(end.history).toBe(pick.history);
});

test('a defensive arrival names the highlighted defending seat in the URL', async ({ page }) => {
  const j = journey(page);
  await j.boot('/Positions/Mount');
  await j.advance(8000);
  await page.evaluate(() => {
    const a = (window as any).__neural;
    a.enterDefense(a.nodes.findIndex((n: any) => n.ty === 'submissions'));
  });
  await expect.poll(() => page.evaluate(() => (window as any).__neural._defendSub != null)).toBe(true);
  const state = await page.evaluate(() => {
    const a = (window as any).__neural;
    return { path: location.pathname, id: a.nodes[a.focusIdx].id };
  });
  expect(state.path).toBe('/' + state.id);
});
