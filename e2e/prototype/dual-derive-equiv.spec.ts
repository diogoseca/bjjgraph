import { test, expect, Page } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * DOES THE INGEST-TIME DERIVATION REPRODUCE THE PROTOTYPE THE OWNER APPROVED? (v1.125.0)
 *
 * Boots the app TWICE against the same build — once on the DEFAULT path (`_deriveDualPairs`
 * splits the shipped 546KB wire at ingest) and once on `?dual=iso` (the 2.4MB pre-split
 * prototype payload, gitignored) — and diffs the two LIVE node sets after ingest has finished:
 * ids, roles, coordinates, radii, rSite, the pair links, and the dealt hand of every role.
 *
 * It lives in e2e/prototype/ and is NOT part of any gate, for the same reason the screenshot
 * driver does: it needs the gitignored payload. Run it the same way —
 *
 *   rm -rf .privserve && mkdir .privserve && cp -al source/public .privserve/public
 *   rm .privserve/public/static/neural/app/neural.js .privserve/public/static/neural/app/neural.css
 *   cp neural/dist/neural.js neural/dist/neural.css .privserve/public/static/neural/app/
 *   cp tests/artifacts/dualpair/payloads/graph-data-dual-*.json .privserve/public/static/neural/
 *
 *   flock /tmp/bjj-pw-dual.lock -c 'PW_PORT=8147 PW_TESTDIR=./prototype \
 *     npx playwright test -c e2e/playwright.chrome.config.ts -g "derivation"'
 */

const OUT = resolve(__dirname, "../../tests/artifacts/dualpair");
mkdirSync(OUT, { recursive: true });

type Dump = {
  n: number;
  links: number;
  nodes: { id: string; role: string | null; pairId: string | null; x: number; y: number; r: number; rSite: number; z: number; h: number; deg: number; sv: number | null; o: number | null; ty: string; colU: boolean }[];
  pairs: [string, string][];
  hands: Record<string, string[]>;
  derived: unknown;
};

async function dump(page: Page, url: string): Promise<Dump> {
  await page.goto(url);
  await page.waitForFunction(() => {
    const a = (window as any).__neural;
    return a && a.nodes && a.nodes.length > 1000;
  }, null, { timeout: 30000 });
  return await page.evaluate(() => {
    const a = (window as any).__neural;
    const nodes = a.nodes.map((n: any) => ({
      id: n.id, role: n.role || null, pairId: n.pairId || null,
      x: n.x, y: n.y, r: n.r, rSite: n.rSite, z: n.z, h: n.h, deg: n.deg,
      sv: typeof n.sv === "number" ? n.sv : null, o: typeof n.o === "number" ? n.o : null,
      ty: n.ty, colU: !!n.colU,
    }));
    const pairs: [string, string][] = [];
    for (const n of a.nodes) if (n.pairId && n.pi >= 0 && n.idx < n.pi) pairs.push([n.id, a.nodes[n.pi].id]);
    // The dealt hand of every position role, by TITLE (the thing the player reads).
    // `currentPos` and `playerRole` ARE inputs to optionsFor — moveChance reads
    // `oppVal(nodes[currentPos])` for the AI modifier and the ranking reads it back — so both are
    // set exactly as a real landing sets them, and restored. Without currentPos the ranking
    // dereferences `nodes[undefined]`, which is a harness error, not an app one.
    const hands: Record<string, string[]> = {};
    const savedRole = a.playerRole, savedPos = a.currentPos;
    for (const n of a.nodes) {
      if (n.ty !== "positions") continue;
      for (const role of ["top", "bottom"]) {
        if (n.role && n.role !== role) continue;      // a member answers only for its own side
        a.playerRole = role; a.currentPos = n.idx;
        // key by SITE and side, so the three builds (derived / pre-split prototype / hub-only
        // legacy) line up on one vocabulary
        hands[n.id.replace(/\/(Top|Bottom|Attacker|Defender)$/, "") + "#" + role] =
          a.optionsFor(n.idx).map((o: any) => o.node.t);
      }
    }
    a.playerRole = savedRole; a.currentPos = savedPos;
    return { n: a.nodes.length, links: a.links.length, nodes, pairs, hands, derived: a._pairsDerived || null };
  });
}

/** map a prototype id ("Positions/Mount/Top") to the derived id ("Positions/Mount"). */
const toDerived = (id: string) => id.replace(/\/(Top|Attacker)$/, "");

test("derivation reproduces the ?dual=iso prototype", async ({ page }) => {
  const derived = await dump(page, "/");
  const proto = await dump(page, "/?dual=iso");

  const report: string[] = [];
  const say = (s: string) => { report.push(s); console.log(s); };

  say(`derived : ${derived.n} nodes, ${derived.links} drawn links, sites=${JSON.stringify(derived.derived)}`);
  say(`prototype: ${proto.n} nodes, ${proto.links} drawn links`);

  const dById = new Map(derived.nodes.map((n) => [n.id, n]));
  const pById = new Map(proto.nodes.map((n) => [toDerived(n.id), n]));

  // ── ids ───────────────────────────────────────────────────────────────────────────────────
  const dOnly = [...dById.keys()].filter((k) => !pById.has(k));
  const pOnly = [...pById.keys()].filter((k) => !dById.has(k));
  say(`ids: shared ${dById.size - dOnly.length}, derived-only ${dOnly.length}, prototype-only ${pOnly.length}`);
  say(`  derived-only: ${JSON.stringify(dOnly.sort())}`);
  say(`  prototype-only: ${JSON.stringify(pOnly.sort())}`);

  // THE PROTOTYPE'S THREE SINGLES ARE ITS OWN SLUG BUG (the v1.115.0 class): `tech_key()` could
  // not spell `100%-Sweep` / `Fireman's-Carry` / `Counter-Entry-to-Opponent's-Leg`, so they never
  // found their `<key>/attacker` entry and shipped unpaired. graph.json has attacker AND defender
  // for all three. The derivation pairs them, which is +3 pairs = +6 nodes.
  expect(pOnly).toEqual([]);
  expect(dOnly.sort()).toEqual([
    "Transitions/100%-Sweep/Defender",
    "Transitions/Counter-Entry-to-Opponent's-Leg/Defender",
    "Transitions/Fireman's-Carry/Defender",
  ]);
  expect(derived.n).toBe(proto.n + 3);

  // ── roles, sv, ordinals, the underworld tone ──────────────────────────────────────────────
  // The three the prototype left UNPAIRED are the same three, and they are excused BY NAME rather
  // than by a tolerance: the derivation gives them role="attacker" and z=+1 where the prototype
  // had role=null and z=0, which is the whole point of pairing them.
  const UNPAIRED_IN_PROTOTYPE = new Set(dOnly.map((id) => id.replace(/\/Defender$/, "")));
  const roleBad: string[] = [], svBad: string[] = [], zBad: string[] = [], colBad: string[] = [];
  for (const [id, d] of dById) {
    const p = pById.get(id); if (!p) continue;
    const excused = UNPAIRED_IN_PROTOTYPE.has(id);
    if (d.role !== p.role && !excused) roleBad.push(id);
    if ((d.sv === null) !== (p.sv === null) || (d.sv !== null && Math.abs(d.sv - p.sv!) > 1e-12)) svBad.push(id);
    if (d.z !== p.z && !excused) zBad.push(id);
    if (d.colU !== p.colU) colBad.push(id);
  }
  say(`mismatches — role ${roleBad.length} · sv ${svBad.length} · z ${zBad.length} · underworld tone ${colBad.length} (3 newly-paired excused by name)`);
  expect({ roleBad, svBad, zBad, colBad }).toEqual({ roleBad: [], svBad: [], zBad: [], colBad: [] });
  for (const id of UNPAIRED_IN_PROTOTYPE) {
    expect(pById.get(id)!.role).toBe(null);       // prototype: an unpaired single
    expect(dById.get(id)!.role).toBe("attacker"); // derived: the attacker half of a real pair
  }

  // THE SHARE ORDINAL STAYS ON THE HUB. The prototype put `o` on NO member and would have needed
  // ~1,464 new ordinals minted into node_ordinals.json — irreversible, and it would not have
  // saved a single already-posted /l/<code>. The derived rep member IS the hub, so it keeps it.
  const withOrd = derived.nodes.filter((n) => n.o !== null);
  say(`derived nodes carrying a share ordinal: ${withOrd.length} (prototype: ${proto.nodes.filter((n) => n.o !== null).length})`);
  expect(withOrd.length).toBe(derived.derived ? (derived.derived as any).sites : 0);
  expect(withOrd.every((n) => n.pairId && (n.role === "top" || n.role === "attacker"))).toBe(true);

  // ── pair structure ────────────────────────────────────────────────────────────────────────
  const dPairs = new Set(derived.pairs.map((p) => p.map(toDerived).sort().join("|")));
  const pPairs = new Set(proto.pairs.map((p) => p.map(toDerived).sort().join("|")));
  const pairMissing = [...pPairs].filter((k) => !dPairs.has(k));
  say(`pairs: derived ${dPairs.size}, prototype ${pPairs.size}, prototype pairs NOT derived ${pairMissing.length}`);
  expect(pairMissing).toEqual([]);

  // ── geometry ──────────────────────────────────────────────────────────────────────────────
  // These are POST-de-overlap coordinates, and the de-overlap is where the two builds can
  // legitimately part company: it is 30 iterations of pairwise pushes whose gap is `r_a+r_b+3.5`,
  // so any radius difference at all rearranges the LOCAL neighbourhood. The radii differ exactly
  // where the prototype's graph.json rebuild lost real layout edges (738 Submissions, 724 of them
  // family-nested — the same slug class as its three unpaired singles). So the honest claim is a
  // DISTRIBUTION, not an equality: the global shape is preserved, individual crowded nodes settle
  // a little differently. The graph is ~1520u wide and the pair clearance is C = 2.0u.
  const dists: number[] = [];
  for (const [id, d] of dById) {
    const p = pById.get(id); if (!p) continue;
    dists.push(Math.hypot(d.x - p.x, d.y - p.y));
  }
  const pct = (a: number[]) => {
    const s = [...a].sort((x, y) => x - y);
    const q = (f: number) => s[Math.min(s.length - 1, Math.floor(s.length * f))];
    return `median ${q(0.5).toFixed(2)}u · p90 ${q(0.9).toFixed(2)}u · p99 ${q(0.99).toFixed(2)}u · max ${s[s.length - 1].toFixed(2)}u`;
  };
  say(`A→B displacement over ${dists.length} shared members: ${pct(dists)}`);

  // THE CONTROL. Both builds run the SAME de-overlap over the SAME ground plane; the only input
  // that differs is the radii. So the question is not "did the two agree" — 30 iterations of
  // pairwise pushes will not — but "did either MOVE THE GRAPH". Measure each build against the
  // ground truth it started from: the iso projection of globalGraphLayout's own coordinates, the
  // beloved global shape this whole feature promised to keep.
  const ground = await page.evaluate(async () => {
    const r = await fetch("/static/neural/graph-data.json");
    const j = await r.json();
    const CO = 0.8660254037844387, SI = 0.5;
    const out: Record<string, { x: number; y: number }> = {};
    for (const n of j.nodes) out[n.id] = { x: (n.x - n.y) * CO, y: (n.x + n.y) * SI };
    return out;
  });
  const off = (set: Dump, key: (id: string) => string) => {
    const v: number[] = [];
    for (const n of set.nodes) {
      const g = ground[key(n.id)]; if (!g) continue;
      v.push(Math.hypot(n.x - g.x, (n.y + n.z * n.h) - g.y));   // undo the lift; compare the GROUND point
    }
    return v;
  };
  const dOff = off(derived, (id) => id.replace(/\/(Bottom|Defender)$/, ""));
  const pOff = off(proto, (id) => toDerived(id).replace(/\/(Bottom|Defender)$/, ""));
  say(`drift from the layout's own ground point (the global shape):`);
  say(`  derived  : ${pct(dOff)}`);
  say(`  prototype: ${pct(pOff)}`);
  const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  // Neither build may wander further from the authored layout than the other does. This is the
  // claim that matters: the derivation settles as close to the beloved shape as the payload the
  // owner approved, and the A→B difference between them is the de-overlap's own local jitter.
  expect(med(dOff)).toBeLessThan(med(pOff) * 1.5 + 1);
  expect(med(dists)).toBeLessThan(Math.max(med(dOff), med(pOff)) * 1.5 + 1);

  // ── rSite: the collapsed site must draw at EXACTLY the size it has always drawn in production ──
  const bad: string[] = [];
  for (const n of derived.nodes) {
    if (!n.pairId || !(n.role === "top" || n.role === "attacker")) continue;
    const partner = dById.get(derived.pairs.find((p) => toDerived(p[0]) === n.id || toDerived(p[1]) === n.id)!.map(toDerived).find((x) => x !== n.id)!);
    if (!partner) continue;
    const want = 2.0 + Math.min(5.5, Math.sqrt(Math.max(1, n.deg + partner.deg - 2)) * 0.62);
    if (Math.abs(n.rSite - want) > 1e-9) bad.push(n.id);
  }
  say(`rSite self-consistency: ${bad.length} sites off`);
  expect(bad).toEqual([]);

  // ── THE HAND, vs THE PROTOTYPE: sets only ─────────────────────────────────────────────────
  // ORDER IS NOT COMPARABLE HERE, and that is a payload-version fact rather than a derivation
  // one: the prototype file was emitted before v1.117.0 put `ev` on the wire, so its position
  // `cal` is {moves, avail} with no EDGE table at all — `optionsFor` hands back `ev: null` for
  // every card and `_cmpDealt` cannot rank by the number the card prints. The ordered claim is
  // made against ?dual=legacy below, which reads the same wire this build reads.
  const keys = new Set([...Object.keys(derived.hands), ...Object.keys(proto.hands)]);
  let setSame = 0; const setDiff: string[] = [];
  for (const k of keys) {
    const a = derived.hands[k] || [], b = proto.hands[k] || [];
    const gained = a.filter((x) => !b.includes(x)), lost = b.filter((x) => !a.includes(x));
    if (!gained.length && !lost.length) setSame++;
    else setDiff.push(`${k}: derived ${a.length} vs proto ${b.length} | gained ${JSON.stringify(gained)} lost ${JSON.stringify(lost)}`);
  }
  say(`dealt hands, same CARD SET as the prototype: ${setSame}/${keys.size}`);
  for (const h of setDiff) say(`  ${h}`);
  // The differences run ONE WAY: the derivation recovers cards the prototype could not spell.
  // It must never lose one.
  for (const line of setDiff) expect(line).toContain("lost []");

  // ── THE HAND, vs PRODUCTION: ordered, and it must be identical ────────────────────────────
  // This is the gameplay-identity claim. Splitting the site must not change one card, or one
  // card's place in the tray, anywhere in the game.
  const legacy = await dump(page, "/?dual=legacy");
  say(`legacy   : ${legacy.n} nodes, ${legacy.links} drawn links, sites=${JSON.stringify(legacy.derived)}`);
  expect(legacy.n).toBe(derived.derived ? (derived.derived as any).sites : -1);   // the escape hatch really is hub-only
  const lKeys = new Set([...Object.keys(derived.hands), ...Object.keys(legacy.hands)]);
  let ordSame = 0; const ordDiff: string[] = [];
  for (const k of lKeys) {
    const a = derived.hands[k], b = legacy.hands[k];
    if (!a || !b) { ordDiff.push(`${k} (missing: derived ${!!a} legacy ${!!b})`); continue; }
    if (JSON.stringify(a) === JSON.stringify(b)) ordSame++;
    else ordDiff.push(`${k}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
  }
  say(`dealt hands identical to production, ORDER INCLUDED: ${ordSame}/${lKeys.size}`);
  for (const h of ordDiff.slice(0, 10)) say(`  ${h}`);
  writeFileSync(resolve(OUT, "derive-equivalence.txt"), report.join("\n") + "\n");
  expect(ordDiff).toEqual([]);
});

/**
 * WHAT THE SPLIT COSTS AT BOOT, and it is not free.
 *
 * `ingest()` runs on every visit before the first frame, so doubling its node count is a
 * main-thread bill on the one metric this project is worst at (real-user LCP P75 13.8s). This
 * prints it rather than leaving it to be discovered in the field. The derivation ITSELF is
 * cheap; the cost is the rest of ingest — overwhelmingly the de-overlap sweep — running over
 * 2,934 nodes instead of 1,467. `?dual=legacy` is the lever if it ever has to come off.
 *
 * Reported, not gated: absolute timings on a shared dev box are far too noisy to ratchet, and a
 * flaky perf gate teaches people to ignore gates.
 */
test("what the split costs at boot", async ({ page, context }) => {
  await page.goto("/");
  await page.waitForFunction(() => (window as any).__neural?.nodes?.length > 1000, null, { timeout: 30000 });
  const measure = () => page.evaluate(async () => {
    const a = (window as any).__neural;
    const raw = await (await fetch("/static/neural/graph-data.json")).text();
    const W: any = { s: "success", f: "failure", c: "counter" };
    // expand outcomes exactly as ingest does before the split, so each run sees real shapes
    const prep = () => {
      const d = JSON.parse(raw);
      for (const n of d.nodes) {
        const c = n.cal;
        if (c && Array.isArray(c.outcomes)) c.outcomes = c.outcomes.map((o: any) => Array.isArray(o) ? { to: o[0], probability: o[1], result: W[o[2]] || o[2] } : o);
      }
      return d;
    };
    const t = (fn: () => void) => { const s = performance.now(); fn(); return performance.now() - s; };
    const med = (v: number[]) => v.slice().sort((x, y) => x - y)[Math.floor(v.length / 2)];
    const real = a._dualVariant.bind(a);
    const derive: number[] = [], split: number[] = [], hub: number[] = [];
    for (let i = 0; i < 9; i++) {
      derive.push(t(() => a._deriveDualPairs(prep())));
      a._dualVariant = () => null;      const d2 = prep(); split.push(t(() => a.ingest(d2)));
      a._dualVariant = () => "legacy";  const d3 = prep(); hub.push(t(() => a.ingest(d3)));
    }
    a._dualVariant = real;
    return { derive: +med(derive).toFixed(1), split: +med(split).toFixed(1), hub: +med(hub).toFixed(1), delta: +(med(split) - med(hub)).toFixed(1) };
  });
  const fast = await measure();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });   // the phone this ships to
  const slow = await measure();
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  const line = (l: string, m: typeof fast) => `${l}: ingest ${m.hub}ms hub-only -> ${m.split}ms split (+${m.delta}ms), of which the derivation is ${m.derive}ms`;
  const txt = [line("desktop 1x", fast), line("throttled 4x", slow)].join("\n");
  console.log(txt);
  writeFileSync(resolve(OUT, "derive-cost.txt"), txt + "\n");
  // The only ASSERTION is the one that is structural rather than machine-dependent: the split
  // itself is a small fraction of the ingest it enables. If that ever inverts, the derivation
  // grew a real algorithm and deserves another look.
  expect(fast.derive).toBeLessThan(fast.split * 0.25);
});
