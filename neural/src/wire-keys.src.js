// wire-keys.src.js — the ORDINAL-KEYED eager wire (v1.204.3). PURE. No DOM, no globals.
//
// Two payloads on the boot path used to SPELL graph node names that graph-data.json already
// carries, once per deck and once per score weight:
//
//   · flashcards/_index.json `decks`   — 2,896 keys "<Name>|<Role>": 15,427 B of a 20,552 B gzip.
//   · curriculum.json score table `k`  — 266 "<Position>|<Role>" + 1,310 technique names: ~9,600 B.
//
// Every graph node carries a PERMANENT share ordinal `o` (node_ordinals.json — append-only,
// never renumbered, never reused, retired-not-removed, hard-gated by `validate:ordinals`). So both
// payloads now key by it, and the NAME is derived HERE, at the reader, from the node the ordinal
// names. An ordinal is the only id that may cross files: a node's ARRAY INDEX in graph-data.json
// is filesystem-ordered and renumbers when one content file is added (CLAUDE.md §6.6).
//
// THE WIRE
//
//   flashcards/_index.json, format 4:
//     deckOrd.o  ordinals, ASCENDING, delta-coded exactly like the share-link codec:
//                d0 = o0, di = oi - o(i-1) - 1 — so a duplicate or an out-of-order ordinal is
//                unrepresentable, and a dense run of ordinals is a run of zeros.
//     deckOrd.n  two card counts per ordinal, [rep seat, partner seat] = [Top, Bottom] on a
//                position, [Attacker, Defender] on a technique. 0 = no deck in that seat (the
//                emitter never writes an empty deck, and refuses to, so 0 is unambiguous).
//     shared     unchanged: fnv1a32(question) -> indexes into the decoded deck list, which is in
//                NAME order — the order format 3 shipped — so those indexes did not move.
//
//   curriculum.json `scoreWeightsByOrd` (a NEW key — see _compact_score_weights for why a
//   changed shape never reuses an old key):
//     {div, p: {o, r, gi, nogi}, t: {o, gi, nogi}} — `p.o[i]` a position's ordinal and `p.r[i]`
//     its seat (0 Top, 1 Bottom); `t.o[i]` a technique's ordinal, carrying BOTH seats at one
//     value, as `scoreWeightsByRuleset` did. Order is the emitter's (weight descending, name as
//     the tiebreak) and is preserved, because gameScore and startPosTraffic SUM in key order.
//
// A STALE BUNDLE MEETING THIS WIRE finds no `decks` and no `scoreWeightsByRuleset`: it boots with
// zero decks and a zero belt until the next reload fetches the fresh bundle (/static/* is cached
// 4h + 1d stale-while-revalidate, and both files ride it). That is the failure v1.145.13 and
// v1.146.0 chose for their own key changes, and the reason both keys are NEW rather than reused:
// an old reader finds nothing instead of misreading something. Nothing in it deletes progress —
// grades are pruned only by a chunk that hydrated for a deck the manifest knows.
//
// THE NAME RULE is the app's `deckKeyFor` `fam`, verbatim: a position's title minus its " Top" /
// " Bottom" (posFamily — all 133 position hub titles end "… Top" as an artifact of the visual
// collapse), a technique's full title. It is written a second time here because this file must
// run where the app class does not (the digest Worker, e2e/decks.ts, the unit suite). The two are
// pinned equal by tests/neural_seat_decks.test.mjs (every shipped deck mintable by deckKeyFor, and
// the reverse); tests/neural_wire_keys.test.mjs pins the whole decode against NAME-keyed truths
// that never pass through an ordinal. The Python reader is scripts/_neural_decks.py.
//
// NOTHING HERE THROWS, AND NOTHING IS GUESSED: an ordinal that names no node is COUNTED
// (`unresolved`) and skipped — never mapped to a neighbour, never filled with a default. The app
// announces a non-zero count as a `wire_key_unresolved` beat (§6.6: a fallback that never says it
// fired is worse than a crash).
//
// THREE CONSUMERS, ONE SOURCE, like lists-codec.src.js: `node --test` imports it, the digest
// Worker bundles it across the tree, and neural/build/build.mjs strips the `export`s when it
// concatenates it into the browser IIFE. It shares ONE top-level scope with lists-codec, lists
// and flow there, so every name is `NG_WIRE_*` / `ngWire*` (build.mjs's duplicate scan enforces it).

/** The deck NAME a node's decks are keyed by (the app's `deckKeyFor` `fam`). */
export function ngWireDeckName(node) {
  const t = String((node && node.t) || "");
  return node && node.ty === "positions" ? t.replace(/\s+(Top|Bottom)\s*$/i, "").trim() : t;
}

/** The two seats, [rep, partner] — the order `deckOrd.n` pairs and `p.r` indexes are written in. */
export function ngWireSeats(node) {
  return node && node.ty === "positions" ? ["Top", "Bottom"] : ["Attacker", "Defender"];
}

/** A deck's category, from its node (the app's `deckCat`). */
export function ngWireCat(node) {
  const ty = node && node.ty;
  return ty === "positions" ? "Position" : ty === "submissions" ? "Submission" : "Transition";
}

/** ordinal -> node. Only the REP of a derived pair carries `o` (the partner mints `o: null`), so
 *  in the app this is the hub either way. A second node claiming an ordinal is a broken wire:
 *  it is COUNTED and ignored, never allowed to replace the first. */
export function ngWireByOrd(nodes) {
  const byOrd = new Map();
  let dupes = 0;
  for (const n of nodes || []) {
    if (!n || typeof n.o !== "number") continue;
    if (byOrd.has(n.o)) { dupes++; continue; }
    byOrd.set(n.o, n);
  }
  return { byOrd, dupes };
}

/**
 * Decode the deck manifest into `{decks: {"<Name>|<Role>": {cat, n}}, format, unresolved, dupes}`,
 * `decks` in NAME order. Formats, oldest to newest — a stale manifest on a CDN edge must never
 * break a fresh bundle, so every one still decodes: {file,cat,role,n} (1) · [file,cat,n] (2) ·
 * [cat,n] (3, the chunk address derived from the key) · deckOrd (4, the key derived from `o`).
 * `nodes` is needed for format 4 only: graph-data.json's nodes, or the app's own after ingest.
 */
export function ngWireDecks(j, nodes) {
  const out = { decks: {}, format: 0, unresolved: 0, dupes: 0 };
  if (!j) return out;
  const w = j.deckOrd;
  if (w && Array.isArray(w.o) && Array.isArray(w.n)) {
    out.format = 4;
    const { byOrd, dupes } = ngWireByOrd(nodes);
    out.dupes = dupes;
    const rows = [];
    let o = -1;
    for (let i = 0; i < w.o.length; i++) {
      o += w.o[i] + 1;
      const node = byOrd.get(o);
      if (!node) { out.unresolved++; continue; }
      const name = ngWireDeckName(node), seats = ngWireSeats(node), cat = ngWireCat(node);
      for (let s = 0; s < 2; s++) {
        const n = w.n[2 * i + s];
        if (n > 0) rows.push([name + "|" + seats[s], cat, n]);
      }
    }
    // NAME order, compared by UTF-16 code unit — the emitter's sorted() by code point agrees on
    // every BMP string, and it refuses a key outside the BMP rather than ship a different order.
    rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    for (const [k, cat, n] of rows) {
      if (Object.prototype.hasOwnProperty.call(out.decks, k)) { out.dupes++; continue; }
      out.decks[k] = { cat: cat, n: n };
    }
    return out;
  }
  const src = j.decks && typeof j.decks === "object" ? j.decks : {};
  out.format = (j._meta && j._meta.format) || 0;
  for (const k in src) {
    const e = src[k];
    out.decks[k] = Array.isArray(e)
      ? (e.length >= 3 ? { file: e[0], cat: e[1], n: e[2] || 0 } : { cat: e[0], n: e[1] || 0 })
      : { file: e.file, cat: e.cat, n: e.n || 0 };
  }
  return out;
}

/**
 * THE CANONICAL DECK INDEX (v1.207.0): `{decks: {"<Name>|<Role>": {cat, n}}, shared}` from an
 * `ngWireDecks` result plus the manifest's own `shared`. This is the ONE definition of "what the
 * manifest says" for the two readers that must agree on it byte for byte: the app's knowledge
 * content revision at ingest, and the Gameplan study-manifest producer, which recomputes that
 * revision from verified bytes in a worker. Fingerprinting the RAW manifest instead made the
 * revision a property of the wire format, so format 4 would have changed it with no content change.
 * Only `cat` and `n` survive per deck (format 2's `file` is transport, not content). `shared` is
 * passed through as shipped: its indexes point into the NAME order `decks` is decoded in. Fresh
 * objects, so the app's hydration (`d.cards = …` on ITS deck objects) never reaches this copy.
 */
export function ngWireDeckIndex(dec, shared) {
  const decks = {};
  for (const k in (dec && dec.decks) || {}) decks[k] = { cat: dec.decks[k].cat, n: dec.decks[k].n };
  return { decks: decks, shared: shared && typeof shared === "object" ? shared : {} };
}

/**
 * THE ONE EXPANSION OF THE SCORE TABLE: `{w: {deckKey: weight} | null, unresolved}` for one
 * ruleset frame. Reads, newest first: `scoreWeightsByOrd` (v1.204.3) · `scoreWeightsByRuleset`
 * (v1.146.0) · `scoreWeights` (v1.145.13) · a flat `weights` (the unit fixtures still carry it).
 * A zero in a frame's array means "not attemptable in this ruleset" and is SKIPPED, never stored,
 * or gameScore's own denominator would carry mass for a deck the player can never be dealt. A
 * `p` ordinal that lands on a technique, or a `t` ordinal on a position, is counted unresolved:
 * that is a remapped wire, and naming it with the wrong seat set would be a plausible lie.
 */
export function ngWireScoreWeights(c, frame, nodes) {
  if (!c) return { w: null, unresolved: 0 };
  const bo = c.scoreWeightsByOrd;
  if (bo && bo.p && bo.t && Array.isArray(bo.p.o) && Array.isArray(bo.t.o) && bo.p[frame] && bo.t[frame]) {
    const { byOrd } = ngWireByOrd(nodes);
    const d = bo.div || 1e7, pv = bo.p[frame], tv = bo.t[frame], w = {};
    let unresolved = 0;
    for (let i = 0; i < bo.p.o.length; i++) {
      if (!pv[i]) continue;
      const node = byOrd.get(bo.p.o[i]);
      const seat = node && node.ty === "positions" ? ngWireSeats(node)[bo.p.r[i]] : null;
      if (!seat) { unresolved++; continue; }
      w[ngWireDeckName(node) + "|" + seat] = pv[i] / d;
    }
    for (let i = 0; i < bo.t.o.length; i++) {
      if (!tv[i]) continue;
      const node = byOrd.get(bo.t.o[i]);
      if (!node || node.ty === "positions") { unresolved++; continue; }
      const v = tv[i] / d, name = ngWireDeckName(node), seats = ngWireSeats(node);
      w[name + "|" + seats[0]] = v;
      w[name + "|" + seats[1]] = v;
    }
    return { w, unresolved };
  }
  const br = c.scoreWeightsByRuleset;
  const sw = (br && br.t && br.t[frame]) ? br : c.scoreWeights;
  if (!sw || !sw.t) return { w: c.weights || null, unresolved: 0 };
  const pv = sw.p[frame] || sw.p.v, tv = sw.t[frame] || sw.t.v;
  if (!pv || !tv) return { w: c.weights || null, unresolved: 0 };
  const d = sw.div || 1e7, w = {};
  for (let i = 0; i < sw.p.k.length; i++) if (pv[i]) w[sw.p.k[i]] = pv[i] / d;
  for (let i = 0; i < sw.t.k.length; i++) {
    const v = tv[i] / d;
    if (tv[i]) { w[sw.t.k[i] + "|Attacker"] = v; w[sw.t.k[i] + "|Defender"] = v; }
  }
  return { w, unresolved: 0 };
}
