// What a Last rolls row can name, COUNTED FROM THE WIRE (L3-R1, v1.293.0; CLAUDE.md §6.9: a number ships with the script that
// recomputes it). A probe, not a gate: it reads the generated payload (`python3 scripts/regenerate_neural_data.py` first).
//   node tests/artifacts/_last_rolls_places_count.mjs
// Two questions the PR's rulings turn on:
//   T1  a row that is not a position has "Show on the map" alone. How many decks is that? Every submission has an attacking
//       and a defending deck (`submissionDecks`); a roll logs the submission it enters on the side it was entered from.
//   T2  a place the ruleset no longer draws offers no actions. How many places can that be? The nodes one ruleset does not
//       draw (`cal.avail`, the reachability walk: CLAUDE.md §6.6, traps-wire.md): positions and submissions, which are the
//       two kinds of node a roll stands on. No-gi is the one excluding frame, so gi must read 0.
// The decks are decoded by the app's own decoder (neural/src/wire-keys.src.js), never by a copy of it.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { ngWireDecks, ngWireDeckName } = await import(resolve(ROOT, "neural/src/wire-keys.src.js"));
const wire = (f) => JSON.parse(readFileSync(resolve(ROOT, "source/quartz/static/neural", f), "utf8"));
const g = wire("graph-data.json"), out = ngWireDecks(wire("flashcards/_index.json"), g.nodes);
const keys = Object.keys(out.decks), kind = (ty) => g.nodes.filter((n) => n.ty === ty);
const subs = new Set(kind("submissions").map((n) => ngWireDeckName(n)));
const of = (role) => keys.filter((k) => k.endsWith("|" + role) && subs.has(k.slice(0, k.lastIndexOf("|"))));
const cards = (ks) => ks.reduce((a, k) => a + (out.decks[k].n || 0), 0);
const off = (ty, frame) => kind(ty).filter((n) => n.cal && n.cal.avail && n.cal.avail[frame] === false).length;
const A = of("Attacker"), D = of("Defender");
if (out.format !== 4 || out.unresolved || !keys.length) throw new Error("the manifest did not decode: " + JSON.stringify({ format: out.format, unresolved: out.unresolved, decks: keys.length }));
console.log(JSON.stringify({
  nodes: { positions: kind("positions").length, submissions: kind("submissions").length },
  submissionDecks: { attacker: A.length, defender: D.length, total: A.length + D.length, cards: cards(A) + cards(D) },
  notDrawn: { nogi: { positions: off("positions", "nogi"), submissions: off("submissions", "nogi") }, gi: { positions: off("positions", "gi"), submissions: off("submissions", "gi") } },
}, null, 1));
