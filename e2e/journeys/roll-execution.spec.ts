import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

// D-331 B1 diagnostics: a failing journey here keeps its trace for the CI artifact.
test.use({ trace: "retain-on-failure" })

// Real mouse/keyboard paths and rendered geometry. Probability/timer/cancellation units are
// in tests/roll_execution.test.mjs. These journeys do not accept the later turn/model changes.
const commits = (page: Page) => page.evaluate(() =>
  ((window as any).__neural.beats || []).filter((b: any) => b.beat === "commit").length)

async function ready(page: Page) {
  const j = journey(page)
  await j.boot("/")
  for (const [tag, value] of Object.entries({
    "opp-finish": .99, "opp-pick": 0, "opp-sub-pick": 0, escape: 0,
    "start-pos": .5, role: 0, "ai-skill": .5, "max-moves": .5,
    "land-mc-pick": 0, "land-mc-shuffle": .5, "mc-pick": 0, "mc-shuffle": .5,
    "panic-mc-pick": 0, "panic-mc-shuffle": .5, "checkpoint-pick": 0,
  })) await j.rig(tag, Array(32).fill(value))
  await j.land("Mount Top")
  return j
}

async function transition(page: Page) {
  const opt = await page.evaluate(() => {
    const a = (window as any).__neural
    const o = a._optList.find((o: any) => o.node.ty === "transitions"
      && o.node.cal.outcomes.find((r: any) => r.result !== "success")?.result === "failure"
      && o.node.cal.outcomes.at(-1).result === "counter")
    return o && { name: o.node.t, idx: o.idx }
  })
  expect(opt, "authored transition with a failure and a final counter row").toBeTruthy()
  return opt!
}

// REAL BREAK (CI run 38841236610, e26cbba02; three local phone reproductions):
// reader layout cleared Inspect's closing transform before its completion
// callback restored the row. Native scrolling then moved the execution target,
// so the second click reached the map and key 1 committed again. The forced
// case checks transform ownership directly, before releasing that callback;
// an assertion failure, never a delivery timeout, is its regression control.
for (const [width, height, heldClose] of [[1440, 900, false], [390, 844, false], [390, 844, true]] as const) {
  test(`@curated Inspect and execute are distinct real mouse actions at ${width}px${heldClose ? ' with reader layout during close' : ''}`, async ({ page }) => {
    if (heldClose) await page.addInitScript(() => {
      const w = window as any, native = w.setTimeout;
      w.setTimeout = function (fn: any, ms: number, ...args: any[]) {
        if (ms === 400 && String(fn).includes('justifyContent') && String(fn).includes('scrollLeft')) {
          w.__finishInspectClose = () => fn(...args);
          return native(() => {}, 0);
        }
        return native(fn, ms, ...args);
      };
    });
    await page.setViewportSize({ width, height })
    const j = await ready(page), opt = await transition(page)
    const sel = `[data-tech="${opt.name}"]`
    await page.locator(sel).scrollIntoViewIfNeeded()
    const printed = await page.locator(`${sel} .ngodds`).textContent()
    const title = await page.locator(`${sel} .ngchoice-title`).textContent()
    const before = await commits(page)
    await j.clickByMouse(`${sel} [data-choice-inspect]`, "Inspect")
    await expect(page.locator("[data-go]")).toBeVisible()
    expect(await commits(page)).toBe(before)
    await page.keyboard.press("Escape")
    if (heldClose) {
      const closing = await page.evaluate(() => {
        const w = window as any, a = w.__neural, row = a.optionsRef.current;
        const before = row.style.transform;
        a._reader.layoutNow();
        return { callback: typeof w.__finishInspectClose, before, after: row.style.transform };
      });
      expect(closing.callback).toBe('function');
      expect(closing.before).not.toBe('none');
      expect(closing.after, 'reader must leave the closing row transform to Inspect').toBe(closing.before);
      await page.evaluate(() => (window as any).__finishInspectClose());
    }
    await expect.poll(() => page.evaluate(() => {
      const a = (window as any).__neural
      return !a._detailCtx && a.optionsRef.current.style.transform === "none"
    })).toBe(true)
    await page.locator(sel).scrollIntoViewIfNeeded()
    const groups = await page.evaluate(() => {
      const root = (window as any).__neural.optionsRef.current
      const own = root.querySelector('[data-choice-group="you"]').getBoundingClientRect()
      const other = root.querySelector('[data-choice-group="opponent"]').getBoundingClientRect()
      return { ownRight: own.right, opponentLeft: other.left }
    })
    expect(groups.ownRight, "Inspect must not collapse whole hand groups into a card slot")
      .toBeLessThanOrEqual(groups.opponentLeft)
    await j.rig("resolve", [0]); await j.rig("outcome", Array(32).fill(0))
    const click = await page.locator(`${sel} .ngchoice-title`).boundingBox()
    expect(click).toBeTruthy()
    await j.clickByMouse(`${sel} .ngchoice-title`, "execute the technique")
    const status = page.locator("[data-executing-tech]")
    await expect(status).toHaveAttribute("data-execution-status", "executing")
    await expect(status.locator(".ngchoice-title")).toHaveText(title!)
    await expect(status.locator("[data-cat]")).toHaveText("Executing…")
    await expect(status.locator("button, [data-choice-execute], [data-choice-inspect]")).toHaveCount(0)
    await expect(status.locator(".ngodds")).toHaveText(printed!)
    expect(await commits(page)).toBe(before + 1)
    expect(await page.evaluate(() => !!(window as any).__neural._detailCtx)).toBe(false)
    await expect(page.locator("[data-tech]")).toHaveCount(0)
    await page.mouse.click(click!.x + click!.width / 2, click!.y + click!.height / 2)
    await page.keyboard.press("1")
    expect(await commits(page)).toBe(before + 1)
    await expect(status).toHaveAttribute("data-execution-status", "executing")
    await j.advanceUntil("sweep_start", 20000, 40)
    await j.advance(1081)
    await expect(status).toHaveAttribute("data-execution-status", "landed")
    await expect(status.locator("[data-cat]")).toHaveText("Landed")
    await expect(status.locator(".ngchoice-title")).toHaveText(title!)
    await expect(page.locator(".ng-evtoast")).toContainText("Transition lands")
    await j.nextHand()
    await expect(status).toHaveCount(0)
  })
}

test("@curated shifted digits inspect, plain digits commit, and hidden hands ignore both", async ({ page }) => {
  const j = await ready(page), before = await commits(page)
  await page.keyboard.press("Shift+Digit1")
  await expect(page.locator("[data-go]")).toBeVisible()
  expect(await commits(page)).toBe(before)
  await page.keyboard.press("Escape")
  await page.evaluate(() => (window as any).__neural.setLayer("hand", false, "test"))
  await page.keyboard.press("1"); await page.keyboard.press("Shift+Digit1")
  expect(await commits(page)).toBe(before)
  expect(await page.evaluate(() => !!(window as any).__neural._detailCtx)).toBe(false)
  await page.evaluate(() => (window as any).__neural.setLayer("hand", true, "test"))
  await j.rig("resolve", [0]); await j.rig("outcome", Array(32).fill(0))
  await page.keyboard.press("1")
  expect(await commits(page)).toBe(before + 1)
  await expect(page.locator("[data-executing-tech]")).toHaveCount(1)
})

for (const [outcome, result] of [[0, "failed"], [.999, "countered"]] as const) {
  test(`@curated the card reports the actual ${result} outcome and yields at opponent handoff`, async ({ page }) => {
    const j = await ready(page), opt = await transition(page)
    const title = await page.locator(`[data-tech="${opt.name}"] .ngchoice-title`).textContent()
    await j.rig("resolve", [.999]); await j.rig("outcome", [outcome, ...Array(32).fill(0)])
    await j.pick(opt.name)
    await j.advanceUntil("sweep_start", 20000, 40)
    await j.advance(1081)
    await expect(page.locator("[data-executing-tech]")).toHaveAttribute("data-execution-status", result)
    await expect(page.locator("[data-executing-tech] .ngchoice-title")).toHaveText(title!)
    await expect(page.locator("[data-executing-tech] [data-cat]")).toHaveText(result === "failed" ? "Failed" : "Countered")
    await expect(page.locator(".ng-evtoast")).toContainText(result === "failed" ? "Failed" : "Countered")
    await j.nextHand()
    await expect(page.locator("[data-executing-tech]")).toHaveCount(0)
  })
}

test("@curated pause holds the sweep and teardown prevents a stale verdict", async ({ page }) => {
  const j = await ready(page), opt = await transition(page)
  await j.rig("resolve", [0]); await j.rig("outcome", Array(32).fill(0))
  await j.pick(opt.name)
  await j.advanceUntil("sweep_start", 20000, 40)
  const elapsed = await page.evaluate(() => {
    const a = (window as any).__neural
    a.setPaused(true)
    return a.sweepElapsed(a._sweep)
  })
  await j.advance(5000)
  expect(await page.evaluate(() => {
    const a = (window as any).__neural
    return a.sweepElapsed(a._sweep)
  })).toBe(elapsed)
  await expect(page.locator("[data-executing-tech]")).toHaveAttribute("data-execution-status", "executing")
  await page.evaluate(() => {
    const a = (window as any).__neural
    a.rollFromPosition(a.currentPos, true, a.playerRole)
  })
  await j.advance(3000)
  await expect(page.locator("[data-executing-tech]")).toHaveCount(0)
  expect((await j.beats()).filter(b => b.beat === "sweep_land")).toHaveLength(0)
})

test("@curated a modal owns digits and Enter until dismissed", async ({ page }) => {
  await ready(page)
  const before = await commits(page)
  await page.evaluate(() => (window as any).__neural.openModal())
  await page.keyboard.press("1"); await page.keyboard.press("Shift+Digit1"); await page.keyboard.press("Enter")
  expect(await commits(page)).toBe(before)
  expect(await page.evaluate(() => !!(window as any).__neural._detailCtx)).toBe(false)
  await page.keyboard.press("Escape")
  expect(await page.evaluate(() => (window as any).__neural.modalRef.current.style.display)).toBe("none")
})

test("@curated submission entry retains its printed odds and reaches Finish without a resolution draw", async ({ page }) => {
  const j = await ready(page)
  const name = await page.evaluate(() => (window as any).__neural._optList.find((o: any) => o.node.ty === "submissions").node.t)
  const card = page.locator(`[data-tech="${name}"]`), printed = await card.locator(".ngodds").textContent()
  const title = await card.locator(".ngchoice-title").textContent()
  await page.evaluate(() => {
    const a = (window as any).__neural, rng = a.rng.bind(a)
    a._phase1Draws = []
    a.rng = (tag: string) => { a._phase1Draws.push(tag); return rng(tag) }
  })
  await j.pick(name)
  await expect(page.locator("[data-executing-tech]")).toHaveAttribute("data-execution-status", "entering")
  await expect(page.locator("[data-executing-tech] .ngchoice-title")).toHaveText(title!)
  await expect(page.locator("[data-executing-tech] [data-cat]")).toHaveText("Entering…")
  await expect(page.locator("[data-executing-tech] .ngodds")).toHaveText(printed!)
  await j.nextHand()
  await expect(page.locator('[data-choice-group="you"] [data-choice-action="finish"]')).toHaveCount(1)
  await expect(page.locator("[data-executing-tech]")).toHaveCount(0)
  expect(await page.evaluate(() => (window as any).__neural._phase1Draws.filter((t: string) => t === "resolve" || t === "outcome"))).toEqual([])
})

// D-322: native scrolling can leave the clicked card at y68 while the announcer
// ends at70.59. Exact e26 and D-318 paint intersected the announcer in both motion
// modes (ci-e26/execution-camera-geometry-ruling.md). Keep the <=2px card handoff,
// fit the painted pair/name in free 2-D space, and retain the above-card bound
// wherever its vertical band exists. This is an APP fix, not a readiness repair.
// D-326 (claude-verify/step2-report.md): on a phone the clicked card can sit at y78
// under an announcer ending at y67. That 11px band counted as existing, rejected
// every candidate and returned the unfitted target onto the card. A band now
// exists only if it holds the reserved pair box; the 390px scrolled case pins it.
// D-331 B1: the 390px reduced-motion scrolled case moved its card 4px, then 7px, on CI only (0 of 18
// locally at 1x, 4x CDP, a 50% CPU quota; nor with the win chance held pending across the click).
// Diagnostics only: the handoff record below is attached BEFORE the 2px assertion, and a failing
// run keeps its trace (file-level: Playwright allows `trace` only there). No bound, step or fixture changed.
for (const [width, height, pane, scrolled] of [[390, 844, false, false], [390, 844, false, true], [1440, 900, false, false], [1440, 900, true, false], [1440, 900, false, true]] as const) {
for (const reduced of [false, true]) {
  test(`@curated execution camera frames the technique at ${width}px; pane ${pane}; reduced motion ${reduced}${scrolled ? (width > 640 ? " after native wheel" : " scrolled to the top") : ""}`, async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as any, proto = CanvasRenderingContext2D.prototype, text = proto.fillText, fill = proto.fillRect;
      proto.fillRect = function (x, y, width, height) {
        if (this === w.__neural?.ctx && x === 0 && y === 0 && width === w.__neural.W && height === w.__neural.H) w.__executionPaint = [];
        return fill.call(this, x, y, width, height);
      };
      proto.fillText = function (value, x, y, ...args) {
        if (this === w.__neural?.ctx && w.__neural._execution) {
          const m = this.measureText(value), t = this.getTransform(), d = devicePixelRatio || 1;
          const lo = t.transformPoint({ x: x - m.actualBoundingBoxLeft, y: y - m.actualBoundingBoxAscent });
          const hi = t.transformPoint({ x: x + m.actualBoundingBoxRight, y: y + m.actualBoundingBoxDescent });
          (w.__executionPaint ||= []).push({ text: value, left: lo.x / d, right: hi.x / d, top: lo.y / d, bottom: hi.y / d });
        }
        return text.call(this, value, x, y, ...args);
      };
      // D-331 diagnostics: every layout shift with its sources, from the first paint.
      w.__shifts = [];
      try {
        new PerformanceObserver(list => { for (const e of list.getEntries() as any[]) w.__shifts.push({ t: Math.round(e.startTime), v: e.value,
          sources: (e.sources || []).map((s: any) => ({ node: s.node ? s.node.nodeName + "." + String(s.node.className || "").slice(0, 30) : null, from: s.previousRect?.toJSON?.(), to: s.currentRect?.toJSON?.() })) }) })
          .observe({ type: "layout-shift", buffered: true });
      } catch {}
    });
    await page.setViewportSize({ width, height })
    const j = await ready(page), opt = await transition(page)
    await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" })
    await j.rig("resolve", [0]); await j.rig("outcome", Array(32).fill(0))
    if (scrolled && width < 640) {
      // A phone has no floating index, and a wheel over its deck or hand pages or
      // glides them. Bring the card to the reader's top as the pick path's own
      // scrollIntoView does when the hand starts below the fold, and to the hand's
      // start, under the unfitted pair: the thin-band premise is asserted below.
      await expect(page.locator('[data-reader][data-reader-ready="true"]')).toBeVisible();
      await page.evaluate(name => (window as any).__neural._optionCards.find((c: any) => c.opt.node.t === name)
        .card.scrollIntoView({ block: "start", inline: "start" }), opt.name);
      await j.readerLayoutSettled();
    } else if (scrolled) {
      await expect(page.locator('[data-reader][data-reader-ready="true"]')).toBeVisible();
      await j.clickByMouse('.ng-reader-toc-row:has([data-toc-eye="overview"]) a');
      await j.readerLayoutSettled();
      const scroll = await page.evaluate(name => {
        const a = (window as any).__neural, root = a._reader.root;
        const card = a._optionCards.find((c: any) => c.opt.node.t === name).card;
        const delta = card.getBoundingClientRect().top - root.getBoundingClientRect().top;
        return { delta, target: root.scrollTop + delta };
      }, opt.name);
      await page.mouse.move(width / 2, height * .7);
      await page.mouse.wheel(0, scroll.delta);
      await page.waitForFunction(target => Math.abs((window as any).__neural._reader.root.scrollTop - target) < 1, scroll.target);
    }
    // Capture the rectangle at the delivered pointerdown, after the original
    // pick path's native auto-scroll, never from an earlier fixture position.
    await page.evaluate(name => {
      const w = window as any, a = w.__neural, rec = (at: string) => {
        const card = a._optionCards.find((c: any) => c.opt.node.t === name)?.card, stand = document.querySelector('[data-executing-tech]')
        return { at, t: Math.round(performance.now()), card: card?.isConnected ? card.getBoundingClientRect().toJSON() : null, stand: stand ? stand.getBoundingClientRect().toJSON() : null,
          scrollTop: a._reader?.root?.scrollTop, layoutFrame: !!a._reader?.layoutFrame, press: !!a._readerPress,
          win: document.querySelector('[data-choice-value-status]')?.textContent || null, fonts: document.fonts.status }
      }
      w.__handoff = []
      document.addEventListener('pointerdown', () => {
        w.__clickedExecutionRect = a._optionCards.find((c: any) => c.opt.node.t === name).card.getBoundingClientRect().toJSON();
        w.__handoff.push(rec('pointerdown'))
      }, { capture: true, once: true });
      document.addEventListener('click', () => w.__handoff.push(rec('click')), { capture: true, once: true });
      new MutationObserver((_, obs) => { if (document.querySelector('[data-executing-tech]')) { w.__handoff.push(rec('stand-in mount')); obs.disconnect() } })
        .observe(document.body, { childList: true, subtree: true });
    }, opt.name);
    if (scrolled) await j.clickByMouse(`[data-tech="${opt.name}"] .ngchoice-title`);
    else await j.pick(opt.name);
    await j.advanceUntil("sweep_start", 20000, 40)
    await j.advance(350)
    const handoff = await page.evaluate(() => ({ before: (window as any).__clickedExecutionRect,
      after: document.querySelector('[data-executing-tech]')!.getBoundingClientRect().toJSON() }));
    await test.info().attach('execution-handoff-diagnostics', { contentType: 'application/json', body: JSON.stringify(await page.evaluate(() => {
      const w = window as any, a = w.__neural
      return { records: w.__handoff, shifts: w.__shifts, fonts: document.fonts.status, scrollTop: a._reader?.root?.scrollTop, execFrame: a._execFrame || null }
    }), null, 2) });
    for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(handoff.before[key] - handoff.after[key]), 'clicked-card ' + key).toBeLessThanOrEqual(2);
    if (scrolled && width > 640) expect(handoff.before.y).toBeCloseTo(68, 0);
    if (pane) {
      await j.clickByMouse(".ng-logo", "open the learning pane during execution")
      await j.advance(1500); await j.advance(1500)
      expect(await page.evaluate(() => (window as any).__neural.paused)).toBe(true)
    }
    const point = await page.evaluate((idx) => {
      const a = (window as any).__neural, n = a.nodes[idx], s = a.W / a.cam.vw
      const toast = document.querySelector(".ng-evtoast")!.getBoundingClientRect()
      const card = document.querySelector("[data-executing-tech]")!.getBoundingClientRect()
      const pane = a.deckShown && !a.isMobile() ? a.drillRef.current.getBoundingClientRect().right : 0
      return { x: a.W / 2 + (n.x - a.cam.cx) * s, y: a.H / 2 + (a._LY(n) - a.cam.cy) * s,
        mid: a.H / 2 + (a.pairMid(n).y - a.cam.cy) * s, left: pane, width: a.W, top: toast.bottom, bottom: card.top }
    }, opt.idx)
    const paint = await page.evaluate(idx => {
      const w = window as any, a = w.__neural, n = a.nodes[idx], scale = a.W / a.cam.vw;
      const words = [a.graphName(n), a.splitName(n.t).from, a.activeMove?.verb?.toUpperCase(), a.seatWord(n.ty, n.z > 0)].filter(Boolean);
      const labels = (w.__executionPaint || []).filter((r: any) => words.includes(r.text));
      const k = Math.max(.4, Math.min(1, a.cam.vw / (a.graphW * .5)));
      const orbs = [n, n.pi >= 0 ? a.nodes[n.pi] : null].filter(Boolean).map(q => {
        const x = a.W / 2 + (q.x - a.cam.cx) * scale, y = a.H / 2 + (a._LY(q) - a.cam.cy) * scale;
        const r = a._nodeHalfW(q, scale, k, a._lodK ?? 1);
        return { left: x - r, right: x + r, top: y - r, bottom: y + r };
      });
      const selectors = '[data-executing-tech],.ng-evtoast,.ng-reader-article,.ng-reader-toc,.ng-reader-head,.ng-reader-tools,.ng-reader-game-heading,.ng-landcard,.ng-land-film,[data-layer-dock],.ng-logo,.ng-winbar,.ng-challenge-reward';
      const surfaces = [...document.querySelectorAll(selectors), a.accountRef.current, a.shareCueRef.current, a._handCloseEl].filter(Boolean);
      const occupied = surfaces.flatMap((el: any) => {
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        if (!r.width || !r.height || cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return [];
        const clip = a._reader.root.contains(el) ? a._reader.root.getBoundingClientRect() : { top: 0, bottom: a.H };
        const box = { left: r.left, right: r.right, top: Math.max(0, r.top, clip.top), bottom: Math.min(a.H, r.bottom, clip.bottom) };
        return box.bottom > box.top ? [{ surface: el.className, ...box }] : [];
      });
      const intersections = occupied.flatMap((r: any) => [...labels, ...orbs].filter((p: any) => p.left < r.right && p.right > r.left && p.top < r.bottom && p.bottom > r.top).map((paint: any) => ({ surface: r, paint })));
      return { name: a.graphName(n), labels, orbs, occupied, intersections };
    }, opt.idx);
    await test.info().attach('execution-painted-clearance', { body: JSON.stringify({ point, handoff, ...paint }, null, 2), contentType: 'application/json' });
    // D-331 S1: frameExecution's no-fit fallback counts; a slot exists in every case here.
    const execFrame = await page.evaluate(() => (window as any).__neural._execFrame || { noFrame: 0, noFit: 0 });
    expect(execFrame.noFit, 'no execution frame fell back to the unfitted target').toBe(0);
    expect(paint.labels.some((p: any) => p.text === paint.name), 'the actual frame paints the executing name').toBe(true);
    expect(paint.orbs).toHaveLength(2);
    expect(paint.intersections, 'the full painted pair and label clear every occupied rectangle').toEqual([]);
    expect(point.x).toBeGreaterThan(point.left); expect(point.x).toBeLessThan(point.width)
    // The above-card bound holds where the band can hold the reserved pair box:
    // the orbs plus role and qualifier rows at either naming anchor, with 12px
    // clearances (the premise frameExecution states; the clearance above is the claim).
    const reserve = Math.max(...paint.orbs.map((o: any) => o.bottom), point.y + 40, point.mid + 40)
      - Math.min(...paint.orbs.map((o: any) => o.top), point.y - 36, point.mid - 36)
    const holds = point.bottom - point.top >= reserve + 24
    if (scrolled && width < 640) expect(point.bottom > point.top && !holds, 'the scrolled phone leaves a positive band too thin for the pair').toBe(true)
    if (holds) {
      expect(point.y).toBeGreaterThan(point.top); expect(point.y).toBeLessThan(point.bottom)
    }
    // Keep the real graph-pan/lease claim even when the old vertical band is
    // empty. Both ends must hit canvas in the remaining two-dimensional space.
    const drag = await page.evaluate(({ left, width }) => {
      const canvas = (window as any).__neural.canvasRef.current;
      for (const fy of [.5, .65, .35, .2, .8]) for (const fx of [.8, .5, .2]) {
        const x = left + (width - left) * fx, y = innerHeight * fy;
        if (document.elementFromPoint(x, y) === canvas
          && document.elementFromPoint(x - 60, y + 25) === canvas) return { x, y };
      }
      return null;
    }, point)
    expect(drag, "a real graph pan starts and ends on unobstructed canvas").toBeTruthy()
    await page.mouse.move(drag!.x, drag!.y); await page.mouse.down()
    await page.mouse.move(drag!.x - 60, drag!.y + 25, { steps: 6 }); await page.mouse.up()
    expect(await page.evaluate(() => (window as any).__neural._execution?.camera)).toBe(false)
  })
}
}

// D-326: a reward notice yields while a move executes and shows once it lands,
// never dropped. A full-width phone notice (x12-378, y82-184) left the execution
// camera nowhere to frame the move. Both real earn paths run: a notice already
// showing at the click, and a coin minted mid-execution, as a move lands.
test("@curated 390px a reward notice yields while a move executes and shows once it lands", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const j = await ready(page), opt = await transition(page)
  await j.rig("resolve", [0]); await j.rig("outcome", Array(32).fill(0))
  const reward = page.locator(".ng-challenge-reward")
  const held = () => page.evaluate(() => {
    const a = (window as any).__neural
    return [a._challengeRewardActive, ...(a._challengeRewardQueue || [])].filter(Boolean).map((r: any) => r.id)
  })
  // The harness's own patch runs a real 4.8s timer; dismiss it the way a player
  // would, so the held notice is the fresh one the three real escapes mint.
  for (let i = 0; i < 4 && await reward.count(); i++) await j.clickByMouse("[data-reward-close]", "dismiss an earlier notice")
  await page.evaluate(() => { const a = (window as any).__neural; for (let i = 0; i < 3; i++) a.fx("escape", { via: "Elbow Escape" }) })
  await expect(reward, "a reward notice shows before the move").toContainText("Houdini")
  const before = await held()
  expect(before).toEqual(["houdini"])
  await j.pick(opt.name)
  await j.advanceUntil("sweep_start", 20000, 40)
  await expect(page.locator("[data-executing-tech]")).toHaveCount(1)
  // Read once, never retried: a retrying wait outlives the notice's own 4.8s
  // timer and would pass on a build that never held it.
  expect(await reward.count(), "the showing notice yields to the executing move").toBe(0)
  await page.evaluate(() => (window as any).__neural.fx("escape_odds_pumped", {}))
  expect(await reward.count(), "a coin minted mid-execution waits").toBe(0)
  expect(await held(), "every notice is held in order, none dropped").toEqual([...before, "frame-job"])
  for (let spent = 0; spent < 20000 && await page.locator("[data-executing-tech]").count(); spent += 100) await j.advance(100)
  await expect(page.locator("[data-executing-tech]"), "the move landed").toHaveCount(0)
  await expect(reward, "the first held notice shows once the move lands").toHaveCount(1)
  await expect(reward, "the notice that yielded shows again").toContainText("Houdini")
  // A landing may mint its own reward; it queues behind the held ones.
  expect((await held()).slice(0, 2), "the landed queue starts with the held queue").toEqual([...before, "frame-job"])
  await j.clickByMouse("[data-reward-close]", "dismiss the first held notice")
  await expect(reward, "the coin minted mid-execution shows next").toContainText("Frame Job")
})
