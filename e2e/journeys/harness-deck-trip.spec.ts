import { test, expect, type Page } from "@playwright/test";
import { journey } from "../dsl";

/**
 * THE HARNESS ITSELF, UNDER TEST: `j.hydrateAll()` carries every deck chunk in ONE trip and leaves the
 * app exactly as the route did (v1.262.4, GATE2).
 *
 * Why it changed: 2,862 one-deck fetches through the harness's routes cost 10.2 s a call on the dev box
 * and about 6 s on a CI runner, and 26 @curated tests call it: about 2.6 of the deploy gate's 36.7
 * minutes (reports/gatetime.md). The one-trip load measured 2.9 s a call here, with the same
 * 2,862 decks and 21,269 cards resident. The mechanism is at `hydrateAll` in e2e/dsl.ts.
 *
 * THE CLAIMS, each against the shipped path as its control (`hydrateAll({ via: "route" })`, which is the
 * old body: `hydrate(every key)` over the routes):
 *   SAME      every deck's cards, category, role and error count hash identically both ways;
 *   OWN PATH  the app's own fill seam ran: `_onDeckHydrated` fired once per deck the call filled, so
 *             (resident before) + (fired during) = every deck, both ways;
 *   NO WIRE   every deck the trip had to fetch (cold when the answer was installed) was answered in the
 *             page, exactly once, and none of them crossed the network stack (the control sends hundreds).
 *             The app keeps prefetching on its own (a dealt option's deck), and hydrateDeck JOINS such an
 *             in-flight fetch instead of asking again, so those few cross the wire as before: the
 *             first run found 10 (2,851 of 2,862 answered in the page), all the app's own, from before;
 *   RESTORED  `window.fetch` is the browser's own again afterwards, so a later deck takes the normal path;
 *   RULES     a chunk under an armed payload rule is NOT carried: it travels the route and keeps its timing.
 * WHAT THE HARNESS DOES NOT SERVE, beside these: dossier chunks (`{}`), so nothing here reads content.
 * NOT HERE: the network path itself for an ordinary deck. Every boot's landing deck takes it, and
 * url-arrival.spec.ts's held-deck case proves such a fetch crosses the delay layer.
 *
 * MUTANTS (2026-11-12, each patched into e2e/dsl.ts's hydrateAll alone, run under the build lock on this green spec,
 * then reverted; the first failing assertion is the kill):
 *   the app's fill bypassed (the trip writes cards/cat/role itself)  → "OWN PATH: _onDeckHydrated fired once for every
 *     deck…". Every deck's hash still MATCHED: equal bytes alone could not have told this from the real seam.
 *   window.fetch left as the trip's answer                            → "RESTORED: window.fetch is the browser's own again"
 *   one chunk's last card dropped                                     → "the same number of cards"
 *   one chunk's first card changed by a single space (same count)     → "SAME: every deck's cards, category, role and
 *     errors hash identically both ways"
 *   payload rules ignored (the held chunk carried too)                → "RULES: the held file was left to the route"
 *   the answer matches no URL (the trip silently falls back to the wire, the old 10 s) → "NO WIRE: the page answered the
 *     trip's decks…": nothing else in the suite would turn red, only slower, so this line is that fallback's only guard.
 */

const ROUTE = "/Positions/Half-Guard/Bottom";

/** Count the app's own fill hook from now on; report how many decks were already resident. */
const instrument = (page: Page) =>
  page.evaluate(() => {
    const a = (window as any).__neural, decks = a.flashcards.decks;
    const own = a._onDeckHydrated;
    a.__deckFills = 0;
    a._onDeckHydrated = function (...args: any[]) {
      a.__deckFills++;
      return own.apply(this, args);
    };
    const keys = Object.keys(decks);
    return { total: keys.length, resident: keys.filter((k) => Array.isArray(decks[k].cards)).length };
  });

/** Every deck's state, hashed in a fixed order, plus the counts a reader can check by eye. */
const deckState = (page: Page) =>
  page.evaluate(async () => {
    const a = (window as any).__neural, decks = a.flashcards.decks;
    const keys = Object.keys(decks).sort();
    const text = JSON.stringify(keys.map((k) => [k, decks[k].cards ?? null, decks[k].cat ?? null, decks[k].role ?? null, decks[k].err ?? 0]));
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return {
      hash: [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join(""),
      decks: keys.length,
      resident: keys.filter((k) => Array.isArray(decks[k].cards)).length,
      cards: keys.reduce((n, k) => n + (decks[k].cards?.length || 0), 0),
      fills: a.__deckFills as number,
      nativeFetch: /\[native code\]/.test(Function.prototype.toString.call(window.fetch)),
    };
  });

/** Chunk requests the browser itself issues (an in-page answer never becomes one). */
const watchChunks = (page: Page) => {
  const seen: string[] = [];
  const on = (r: any) => {
    const u = r.url();
    if (/\/flashcards\/[^/]+\.json/.test(u) && !/_index\.json/.test(u)) seen.push(u);
  };
  page.on("request", on);
  return { seen, stop: () => page.off("request", on) };
};

test("one trip leaves every deck exactly as the route does, through the app's own fill", async ({ page }) => {
  const j = journey(page);

  // CONTROL: the shipped path, over the routes
  await j.boot(ROUTE);
  const before1 = await instrument(page);
  const wire1 = watchChunks(page);
  await j.hydrateAll({ via: "route" });
  wire1.stop();
  const viaRoute = await deckState(page);
  expect(j.lastDeckTrip, "the control took the route").toBeNull();
  expect(wire1.seen.length, "premise: the control's chunks cross the network stack").toBeGreaterThan(100);
  expect(viaRoute.resident, "premise: the route fills every deck").toBe(viaRoute.decks);
  expect(before1.resident + viaRoute.fills, "control: every deck filled exactly once").toBe(viaRoute.decks);

  // THE TRIP, on a fresh boot of the same route
  await j.boot(ROUTE);
  const before2 = await instrument(page);
  const wire2 = watchChunks(page);
  await j.hydrateAll();
  wire2.stop();
  const viaTrip = await deckState(page);
  const trip = j.lastDeckTrip!;

  expect(viaTrip.resident, "every deck is resident").toBe(viaTrip.decks);
  expect(viaTrip.cards, "the same number of cards").toBe(viaRoute.cards);
  expect(viaTrip.hash, "SAME: every deck's cards, category, role and errors hash identically both ways").toBe(viaRoute.hash);
  expect(before2.resident + viaTrip.fills, "OWN PATH: _onDeckHydrated fired once for every deck the trip filled").toBe(viaTrip.decks);
  expect(viaTrip.fills, "OWN PATH: the trip itself filled decks").toBeGreaterThan(100);
  expect(trip.ruled, "no payload rule was armed").toBe(0);
  expect(trip.carried, "every planned file was carried").toBe(trip.files);
  expect(trip.served.length, "NO WIRE: the page answered the trip's decks (a trip that quietly fell back to the wire answers none)").toBeGreaterThan(100);
  expect(new Set(trip.served).size, "each file was answered once").toBe(trip.served.length);
  expect([...trip.served].sort(), "NO WIRE: every cold deck's own fetch was answered in the page, and nothing else was").toEqual([...trip.cold].sort());
  const early = new Set([...trip.inflight, ...trip.landed]);
  const wired = wire2.seen.map((u) => u.split("/").pop()!);
  expect(wired.filter((f) => trip.cold.includes(f)), "NO WIRE: no deck the trip had to fetch crossed the network stack").toEqual([]);
  expect(wired.filter((f) => !early.has(f)), "what did cross is the app's own earlier fetches (in flight or landed before the answer existed)").toEqual([]);
  expect(viaTrip.nativeFetch, "RESTORED: window.fetch is the browser's own again").toBe(true);
});

test("a chunk under a payload rule is not carried: it travels the route and keeps its timing", async ({ page }) => {
  const j = journey(page);
  await j.boot(ROUTE);
  // a deck nothing has asked for yet, and its file name as the app itself computes it
  const pick = await page.evaluate(() => {
    const a = (window as any).__neural, decks = a.flashcards.decks;
    const key = Object.keys(decks).find((k) => !Array.isArray(decks[k].cards) && !(a._deckWaits || {})[k])!;
    return { key, file: decks[key].file || a.qhash(key) + ".json" };
  });
  j.delayPayload("flashcards/" + pick.file, { afterMs: 400 });
  const wire = watchChunks(page);
  await j.hydrateAll();
  wire.stop();
  const trip = j.lastDeckTrip!;
  expect(trip.ruled, "RULES: the held file was left to the route").toBe(1);
  expect(trip.carried, "...and everything else was carried").toBe(trip.files - 1);
  expect(trip.cold, "premise: the held deck was cold when the answer was installed").toContain(pick.file);
  expect(trip.served, "RULES: the page did not answer the held file").not.toContain(pick.file);
  expect([...trip.served].sort(), "every other cold deck was answered in the page").toEqual(trip.cold.filter((f) => f !== pick.file).sort());
  const wired = wire.seen.map((u) => u.split("/").pop()!);
  expect(wired.filter((f) => f === pick.file), "RULES: the held file crossed the network stack, once").toHaveLength(1);
  const early = new Set([...trip.inflight, ...trip.landed, pick.file]);
  expect(wired.filter((f) => !early.has(f)), "and nothing else the trip had to fetch did").toEqual([]);
  const held = j.payloadTimeline().filter((e) => e.url.endsWith("/" + pick.file));
  expect(held, "the delay layer saw it").toHaveLength(1);
  expect(held[0].releasedAtMs! - held[0].requestedAtMs, "it kept its 400 ms").toBeGreaterThanOrEqual(400);
  expect(await page.evaluate((k) => Array.isArray((window as any).__neural.flashcards.decks[k].cards), pick.key), "and it still landed").toBe(true);
});
