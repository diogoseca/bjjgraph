import { test, expect } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { journey } from "../dsl";

/**
 * COLD-START PROBES — measurement instruments, not gates. OPT-IN only:
 *
 *   COLDSTART_PROBE=1 npx playwright test -c e2e/playwright.coldstart.config.ts coldstart-probe
 *
 * They are excluded from every gate on purpose: the last one loads ~10MB of real payload over a
 * throttled connection (~30s) and reports timings, which is exactly what a deterministic gate
 * must never assert on. Their output is the evidence in tests/artifacts/coldstart/.
 *
 * Run them with playwright.coldstart.config.ts (a private port) — see that file for why.
 */

const OUT = resolve(__dirname, "../../tests/artifacts/coldstart");
const save = (name: string, data: unknown) => {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(resolve(OUT, name), JSON.stringify(data, null, 2));
};

test.skip(!process.env.COLDSTART_PROBE, "opt-in: set COLDSTART_PROBE=1");

// ── 1. what pool does a first-ever visitor's opening position come out of? ──
test("probe: first-roll position pool + the chrome a newcomer sees", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/", { keepTutorial: true });
  const pool = await page.evaluate(() => {
    const a = (window as any).__neural;
    // the exact filter startRoll() uses for a first roll
    const positions = a.nodes
      .filter(
        (n: any) =>
          n.ty === "positions" &&
          a.adj[n.idx].some((k: number) => a.nodes[k].ty !== "positions"),
      )
      .map((n: any) => n.idx);
    const withDeck = positions.filter(
      (i: number) => a.flashcards?.decks?.[a.deckKeyFor(a.nodes[i]).key],
    );
    const names = withDeck.map((i: number) => a.nodes[i].t);
    const picks: Record<string, string> = {};
    for (let d = 0; d < 20; d++) {
      const u = d / 20;
      picks[u.toFixed(2)] = names[(u * names.length) | 0]; // what each decile of the uniform draw yields
    }
    return {
      playable: positions.length,
      withDeck: withDeck.length,
      picks,
      all: names,
    };
  });
  save("probe-first-roll-pool.json", pool);

  await j.rig("start-pos", [0.42]);
  await j.rig("role", [0]);
  await j.rig("ai-skill", [0.5]);
  await j.rig("max-moves", [0.5]);
  for (let i = 0; i < 12; i++) {
    await j.advance(1000);
    if (
      (await page.evaluate(
        () => ((window as any).__neural.optionIdxs || []).length,
      )) > 0
    )
      break;
  }
  await page.evaluate(() => (window as any).__neural.dismissCoach());
  await page.waitForTimeout(400);
  const chrome = await page.evaluate(() => {
    const out: any = {};
    for (const sel of [
      ".ng-status",
      ".ng-transport",
      ".ng-account",
      ".ng-legend",
      ".ng-logo",
      ".ng-sharecue", // standalone share cue (v1.99.0; the drill pill is deleted)
      "[data-tut-copy]",
      ".ng-optionrow",
    ]) {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) {
        out[sel] = "MISSING";
        continue;
      }
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      out[sel] = {
        display: s.display,
        opacity: s.opacity,
        rect: [Math.round(r.width), Math.round(r.height)],
        text: (el.innerText || "").slice(0, 240),
      };
    }
    return out;
  });
  save("probe-chrome.json", chrome);
  expect(pool.playable).toBeGreaterThan(0);
});

// ── 2. the landing card when the deck payload has not landed yet (the PRODUCTION case on 4G) ──
test("probe: the landing card before, and after, the deck payload lands", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/", { keepTutorial: true });
  // neural.js + graph-data.json have landed; the 4.3MB flashcards payload has not
  await page.evaluate(() => {
    const a = (window as any).__neural;
    (window as any).__savedDecks = a.flashcards;
    a.flashcards = null;
  });
  await j.rig("start-pos", [0.42]);
  await j.rig("role", [0]);
  await j.rig("ai-skill", [0.5]);
  await j.rig("max-moves", [0.5]);
  for (let i = 0; i < 12; i++) {
    await j.advance(1000);
    if (
      (await page.evaluate(
        () => ((window as any).__neural.optionIdxs || []).length,
      )) > 0
    )
      break;
  }
  await page.evaluate(() => (window as any).__neural.dismissCoach());
  await page.waitForTimeout(400);
  const read = () =>
    page.evaluate(() => {
      const a = (window as any).__neural;
      const el = document.querySelector(".ng-landcard") as HTMLElement | null;
      return {
        text: el ? el.innerText : null,
        hasQ: !!document.querySelector("[data-land-q]"),
        hasDef: !!document.querySelector("[data-land-def]"),
        hasFilm: !!document.querySelector("[data-land-film]"),
        chip: (
          document.querySelector("[data-land-count]") as HTMLElement
        )?.getAttribute("data-land-count"),
        drilltab: (document.querySelector(".ng-sharecue") as HTMLElement)
          ?.innerText,
        funnel: (a.csBeats || [])
          .filter((b: any) => b.beat === "funnel")
          .map((b: any) => b.step),
      };
    });
  const before = await read();
  // the payload lands, through the same hook production uses
  await page.evaluate(() => {
    const a = (window as any).__neural;
    a.flashcards = (window as any).__savedDecks;
    a.onFlashcardsReady();
  });
  const after = await read();
  save("probe-late-payload.json", { before, after });
  expect(before.hasQ).toBe(false);
});

// ── 3. the identity line vs the side you are actually playing ──
test("probe: first-roll role vs the position node's own side", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/", { keepTutorial: true });
  await j.rig("start-pos", [0.42]);
  await j.rig("role", [0.9]); // startRoll coin-flips the role; it does NOT derive it from the node
  await j.rig("ai-skill", [0.5]);
  await j.rig("max-moves", [0.5]);
  for (let i = 0; i < 12; i++) {
    await j.advance(1000);
    if (
      (await page.evaluate(
        () => ((window as any).__neural.optionIdxs || []).length,
      )) > 0
    )
      break;
  }
  await page.evaluate(() => (window as any).__neural.dismissCoach());
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const a = (window as any).__neural;
    return {
      node: a.nodes[a.currentPos].t,
      playerRole: a.playerRole,
      roleLabel: a.roleLabel(),
      landcard: (
        document.querySelector(".ng-landcard") as HTMLElement
      )?.innerText.slice(0, 200),
      options: (a.optionIdxs || []).map((i: number) => a.nodes[i].t),
    };
  });
  save("probe-role-mismatch.json", r);
  expect(r.node).toBeTruthy();
});

// ── 4. the real thing: no rails, no interception, real timers, throttled to Fast 4G ──
test("probe: unrigged throttled cold-load timeline", async ({
  page,
  context,
}) => {
  test.setTimeout(180_000);
  await page.route("**/*", (r) => {
    const u = r.request().url();
    if (/^(http:\/\/localhost|http:\/\/127\.|data:|blob:|about:)/.test(u))
      return r.continue();
    if (/fonts\.(googleapis|gstatic)\.com/.test(u))
      return r.fulfill({ status: 200, contentType: "text/css", body: "" });
    return r.abort(); // hermetic: no PostHog, no Supabase, no font CDN
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 40,
    downloadThroughput: (4 * 1024 * 1024) / 8, // Fast 4G
    uploadThroughput: (3 * 1024 * 1024) / 8,
  });
  await page.goto("/?coldprobe=1", { waitUntil: "commit" });
  const timeline: any[] = [];
  for (let i = 0; i < 140; i++) {
    const s = await page
      .evaluate(() => {
        const a = (window as any).__neural;
        const lc = document.querySelector(".ng-landcard") as HTMLElement | null;
        return {
          ms: Math.round(performance.now()),
          app: !!a,
          nodes: a?.nodes?.length || 0,
          decks: !!a?.flashcards?.decks,
          content: !!(window as any).NG_CONTENT,
          pos: a && a.currentPos != null ? a.nodes?.[a.currentPos]?.t : null,
          hand: (a?.optionIdxs || []).length,
          coach: !!document.querySelector("[data-coach]"),
          landcard: !!lc,
          lcText: lc ? lc.innerText.replace(/\n/g, " | ").slice(0, 160) : null,
          q: !!document.querySelector("[data-land-q]"),
          def: !!document.querySelector("[data-land-def]"),
          film: !!document.querySelector("[data-land-film]"),
          drilltab: (
            document.querySelector(".ng-sharecue") as HTMLElement
          )?.innerText?.replace(/\n/g, " | "),
          funnel: (a?.csBeats || [])
            .filter((b: any) => b.beat === "funnel")
            .map((b: any) => `${b.step}@${b.ms_since_nav}`),
        };
      })
      .catch(() => null);
    if (s) timeline.push(s);
    if (s?.decks && s?.content && s?.hand) break;
    await page.waitForTimeout(500);
  }
  const resources = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter((r: any) => /neural/.test(r.name))
      .map((r: any) => ({
        name: r.name.split("/").slice(-1)[0],
        start: Math.round(r.startTime),
        end: Math.round(r.responseEnd),
        kb: Math.round((r.encodedBodySize || r.transferSize || 0) / 1024),
      }))
      .sort((a: any, b: any) => a.end - b.end),
  );
  const key = (s: any) =>
    JSON.stringify([
      s.app,
      s.decks,
      s.content,
      s.hand > 0,
      s.coach,
      s.landcard,
      s.q,
      s.def,
      s.film,
    ]);
  save("probe-throttled-timeline.json", {
    resources,
    changes: timeline.filter(
      (s, i) => i === 0 || key(s) !== key(timeline[i - 1]),
    ),
  });
  expect(resources.length).toBeGreaterThan(0);
});
