import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { journey } from "../dsl";

// A network-controlled regression for the New list press at 390px (v1.198.2). Both genuine
// reference payloads stay in flight until the physical MOUSE is down; releasing exactly one
// must not remove the pressed button before the browser delivers its click.
// No application methods are wrapped, no click events are dispatched, and no list
// is created through the test rail. The DSL only controls response timing.
//
// WHY IT EXISTS: share-lists.spec.ts's "+ works at 390px" went red in CI (shard 4/4,
// `Your lists(0)+`) with no app change. `_onSystems` / `_onConcepts` rebuild the whole Explore
// body when their payload lands, and a mouse click needs pointerdown and pointerup on the SAME
// element — a rebuild between them destroys the button and Chromium dispatches no click at all.
// It is an APP defect, fixed in the app (`_afterPress`, the pane press guard), not a harness wait.
// MEASURED, same held payload, same press: a TOUCH tap already survived (Chromium re-hit-tests
// the tap and clicks the rebuilt button), a MOUSE press lost the list. So this drives a mouse.
// MUTANTS (v1.198.2): the v1.198.1 bundle (no guard) → both kinds RED; the guard's flush run
// synchronously at pointerup instead of one task later → both kinds RED (the repaint overtakes the
// click). NOT COVERED: the alias-index repaint (same seam, no held-payload journey here) and pen.
const PUBLIC = resolve(__dirname, "../../source/public/static/neural");
const digest = (body: Buffer) => createHash("sha256").update(body).digest("hex");

for (const kind of ["systems", "concepts"] as const) {
  test(`390px New list survives ${kind} hydration during a real mouse press`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const j = journey(page);
    const file = `${kind}.json`;
    const other = kind === "systems" ? "concepts" : "systems";
    const evidence: Record<string, unknown> = { kind, viewport: { width: 390, height: 844 } };
    let pressed = false;
    let observing = false;
    try {
      await j.boot("/", {
        payloads: { "systems.json": { never: true }, "concepts.json": { never: true } },
      });
      await j.land("Mount Top");
      await page.locator(".ng-logo").click();
      await expect(page.locator(".ng-drill")).toBeVisible();
      await page.locator('.ng-learning-nav [data-view="explore"]').click();
      const plus = page.locator("[data-lists-new]");
      await expect(plus).toBeVisible();
      await expect(page.locator("[data-lists-head]")).toContainText(/Your lists\s*\(0\)/);
      for (const name of ["systems.json", "concepts.json"]) {
        await expect.poll(() => j.payloadTimeline().filter((row) => row.pattern === name).length,
          { message: `the genuine ${name} request is held` }).toBe(1);
      }
      expect(j.payloadTimeline().every((row) => row.releasedAtMs === null)).toBe(true);
      // Alias hydration also repaints Explore. Let that separate genuine request finish
      // before starting this observation, so it cannot be mistaken for the chosen cause.
      await expect.poll(() => page.evaluate(() => !!(window as any).__neural._aliasesReady),
        { message: "unrelated alias hydration has completed before the controlled press" }).toBe(true);
      evidence.aliasesReadyBeforePress = true;

      const point = await page.evaluate(() => {
        const w = window as any;
        const app = w.__neural;
        const original = document.querySelector("[data-lists-new]") as HTMLElement;
        const host = app.explorerListRef.current as HTMLElement;
        const ids = new WeakMap<object, number>();
        let nextId = 0;
        const id = (node: object | null) => node ? (ids.get(node) || (ids.set(node, ++nextId), nextId)) : null;
        const box = original.getBoundingClientRect();
        const x = box.left + box.width / 2, y = box.top + box.height / 2;
        const describe = (node: EventTarget | null) => {
          const el = node instanceof Element ? node : null;
          return { id: id(el), tag: el?.tagName || null,
            className: el?.getAttribute("class") || null,
            plusId: id(el?.closest("[data-lists-new]") || null) };
        };
        const state = (stage: string) => {
          const current = document.querySelector("[data-lists-new]");
          const listIds = app.listsArray();
          return { stage, at: performance.now(), originalId: id(original),
            currentId: id(current), originalConnected: original.isConnected,
            sameButton: current === original, hit: describe(document.elementFromPoint(x, y)),
            listIds, listCount: listIds.length, listSeq: app._listSeq || 0,
            editId: app._listEditId || null, focusId: app._listFocusId || null,
            systems: app.systems?.length || 0, concepts: app.concepts?.length || 0,
            view: app._viewMode, paneShown: !!app.deckShown, study: app._paneStudyActive() };
        };
        const events: unknown[] = [];
        const snapshots: unknown[] = [];
        const capture = (event: Event) => {
          const e = event as PointerEvent;
          events.push({ type: e.type, at: performance.now(), trusted: e.isTrusted,
            target: describe(e.target), button: e.button, buttons: e.buttons,
            state: state(e.type) });
        };
        const types = ["pointerdown", "mousedown", "pointerup", "mouseup", "click", "pointercancel"];
        for (const type of types) document.addEventListener(type, capture, true);
        const observer = new MutationObserver(() => snapshots.push(state("DOM mutation")));
        observer.observe(host, { childList: true, subtree: true });
        w.__listHydrationPress = { original, events, snapshots, state,
          stop() { observer.disconnect(); for (const type of types) document.removeEventListener(type, capture, true); } };
        const initial = state("before press");
        return { x, y, width: box.width, height: box.height,
          inViewport: x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight,
          hitOriginal: initial.hit.plusId === initial.originalId, initial };
      });
      observing = true;
      evidence.point = point;
      expect(point.width).toBeGreaterThanOrEqual(44);
      expect(point.height).toBeGreaterThanOrEqual(44);
      expect(point.inViewport, "the real press is inside the viewport without forced scrolling").toBe(true);
      expect(point.hitOriginal, "elementFromPoint reaches the original button").toBe(true);
      expect(point.initial.listCount).toBe(0);
      expect(point.initial.systems).toBe(0);
      expect(point.initial.concepts).toBe(0);

      await page.mouse.move(point.x, point.y);
      await page.mouse.down();
      pressed = true;
      const down = await page.evaluate(() => {
        const p = (window as any).__listHydrationPress;
        return { state: p.state("after physical down"), events: p.events.slice() };
      });
      evidence.down = down;
      const actualDown = down.events.find((event: any) => event.type === "pointerdown");
      expect(actualDown?.trusted, "the browser received a trusted physical pointerdown").toBe(true);
      expect(actualDown?.target.plusId).toBe(point.initial.originalId);
      expect(down.state.listCount, "pressing down does not create early").toBe(0);

      const responsePromise = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith(`/static/neural/${file}`));
      j.releasePayload(file);
      const response = await responsePromise;
      expect(response.status(), "the original server response succeeds").toBe(200);
      const body = await response.body();
      const emitted = readFileSync(resolve(PUBLIC, file));
      expect(digest(body), "the released body is the genuine served artifact, not synthetic data").toBe(digest(emitted));
      const payload = JSON.parse(body.toString("utf8"));
      expect(payload[kind].length).toBeGreaterThan(0);
      evidence.response = { url: response.url(), status: response.status(), bytes: body.length,
        sha256: digest(body), records: payload[kind].length };
      // _onSystems/_onConcepts populate these indexes before their hydration repaint.
      // This observes real ingestion; it neither requests a repaint nor calls the callback.
      await page.waitForFunction((name) => {
        const a = (window as any).__neural;
        const index = name === "systems" ? a._systemsById : a._conceptsById;
        return a[name]?.length > 0 && index && Object.keys(index).length > 0;
      }, kind);
      const during = await page.evaluate(() => (window as any).__listHydrationPress.state("hydrated while mouse is down"));
      evidence.during = during;
      expect(j.payloadTimeline().find((row) => row.pattern === `${other}.json`)?.releasedAtMs,
        "only the selected response has landed").toBeNull();
      expect(during.listCount, "hydration itself does not create a list").toBe(0);

      await page.mouse.up();
      pressed = false;
      evidence.afterUp = await page.evaluate(() => (window as any).__listHydrationPress.state("after physical up"));
      // Soft identity assertions let the real release complete and retain outcome evidence
      // even on a regressed build. They are required assertions, not tolerated failures.
      expect.soft(during.originalConnected, "hydration must not detach the pressed target").toBe(true);
      expect.soft(during.sameButton, "the target remains the same DOM button through the press").toBe(true);
      await expect(page.locator("[data-lists-head]")).toContainText(/Your lists\s*\(1\)/);
      await expect(page.locator("[data-list-row]")).toHaveCount(1);
      await expect(page.locator("[data-list-rename]")).toBeVisible();
      const outcome = await page.evaluate(() => {
        const p = (window as any).__listHydrationPress;
        const a = (window as any).__neural;
        const ids = a.listsArray();
        return { state: p.state("settled outcome"), events: p.events.slice(),
          items: ids.length === 1 ? a._listsMap()[ids[0]].items : null,
          name: ids.length === 1 ? a._listsMap()[ids[0]].name : null };
      });
      evidence.outcome = outcome;
      expect(outcome.state.listCount).toBe(1);
      expect(outcome.state.listSeq).toBe(point.initial.listSeq + 1);
      expect(outcome.state.editId).toBe(outcome.state.listIds[0]);
      expect(outcome.state.focusId).toBe(outcome.state.listIds[0]);
      expect(outcome.items).toEqual([]);
      expect(outcome.name).toMatch(/^Class · /);
      const delivered = outcome.events.filter((event: any) => event.type === "click" && event.target.plusId === point.initial.originalId);
      expect(delivered, "one native click reaches the same pressed New list button").toHaveLength(1);
      expect(delivered[0].trusted).toBe(true);
    } finally {
      if (pressed) await page.mouse.up().catch(() => {});
      if (observing && !page.isClosed()) {
        evidence.final = await page.evaluate(() => {
          const p = (window as any).__listHydrationPress;
          const result = { state: p.state("final evidence"), events: p.events, snapshots: p.snapshots };
          p.stop(); delete (window as any).__listHydrationPress;
          return result;
        }).catch((error) => ({ observationError: String(error) }));
      }
      evidence.payloadTimeline = j.payloadTimeline();
      const evidencePath = testInfo.outputPath(`list-hydration-${kind}-press.json`);
      mkdirSync(dirname(evidencePath), { recursive: true });
      writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
      await testInfo.attach(`list-hydration-${kind}-press.json`, {
        path: evidencePath, contentType: "application/json",
      });
      // The other genuine payload stays held for the entire observation, then normal
      // teardown can finish. This is not a synthetic failure or a no-data fixture.
      j.releasePayload();
    }
  });
}
