import fs from "fs"
import path from "path"
import { gzip } from "zlib"
import { promisify } from "util"
import { FilePath, FullSlug, joinSegments } from "../../util/path"
import { QuartzEmitterPlugin } from "../types"
import { write } from "./helpers"
import DepGraph from "../../depgraph"

const gzipAsync = promisify(gzip)

type BankSection = "transitions" | "submissions" | "positions" | "principles" | "systems"

type BankEntry = {
  name: string
  type: string
  slug: string
  flashcards: Array<{ question: string; answer: string }>
}

// Editorial fundamentals floor (hub → relative weight, normalized in
// computeWeights). Guarantees the timeless / decisive positions stay weighted
// even where the stationary distribution under-rewards them (they are
// high-traffic but low-dwell, so markov thins out behind them).
//
// These NON-FLAT weights were validated against elite-instructor understanding
// (Danaher / Gordon Ryan / Gracie / IBJJF lenses), adversarially fact-checked,
// and finalized by a black-belt arbiter that scored each hub against actual
// graph routing (inbound-transition counts vs markov). Key findings:
//   • half-guard — most-transited node in the corpus (554 inbound), the
//     universal recovery/equalizer hub → top weight.
//   • back-control — decisiveness apex, unanimous #1 across lenses.
//   • turtle — most extreme transit/markov under-weight (ratio ~14).
//   • closed-guard — smallest core weight: markov already maxes it (0.224), so
//     the floor only insures it, it does not pile on.
// blend stays 0.15 (the defect was the flat structure, not the magnitude).
const FUNDAMENTALS: Record<string, number> = {
  "half-guard": 1.0,
  "back-control": 0.95,
  "open-guard": 0.8,
  turtle: 0.7,
  "front-headlock": 0.65,
  "standing-position": 0.6,
  "side-control": 0.55,
  mount: 0.55,
  "inside-sankaku": 0.45,
  "closed-guard": 0.35,
  "knee-on-belly": 0.35,
  "guillotine-control": 0.3,
}

// Editorial fraction in the blend W = (1 - b)·markov + b·editorial.
const EDITORIAL_BLEND = 0.15

// Neutral match-start positions used as the PageRank teleport/restart
// distribution (mass hitting game-over or a terminal/dangling node restarts
// here, like a new round). Filtered to those actually present in the graph.
const RESTART_ANCHORS = [
  "standing-position/top",
  "standing-position/bottom",
  "closed-guard/top",
  "closed-guard/bottom",
]

const round = (x: number, places: number) => {
  const f = Math.pow(10, places)
  return Math.round(x * f) / f
}

/**
 * PageRank-style stationary distribution over (position, role) nodes — the
 * long-run fraction of match time spent in each position-role. Edges are the
 * two-hop expansion position →(attemptProbability)→ technique
 * →(outcome probability)→ next position. `game-over`, terminal submissions
 * (no outcomes), and unmappable destinations teleport to the restart set.
 * Returns roleNodeKey ("hub/role") → π, summing to ~1.
 */
function computeStationary(graph: any): Record<string, number> {
  const pos = graph.positions || {}
  const tr = graph.transitions || {}
  const sub = graph.submissions || {}

  // Node set: playable top/bottom role-nodes (hub aggregate nodes are excluded —
  // they are not real match states and outcomes never target them).
  const nodeKeys: string[] = []
  for (const [k, v] of Object.entries<any>(pos)) {
    if (v.role === "top" || v.role === "bottom") nodeKeys.push(k)
  }
  const N = nodeKeys.length
  if (N === 0) return {}
  const idx: Record<string, number> = {}
  nodeKeys.forEach((k, i) => (idx[k] = i))

  // hub → role-node indices, for splitting bare-hub (role-less) destinations.
  const hubRoleIdx: Record<string, number[]> = {}
  for (const k of nodeKeys) {
    const hub = pos[k].hub
    ;(hubRoleIdx[hub] ||= []).push(idx[k])
  }

  // Restart distribution r.
  const anchors = RESTART_ANCHORS.filter((a) => a in idx)
  const r = new Array<number>(N).fill(0)
  if (anchors.length > 0) {
    const w = 1 / anchors.length
    for (const a of anchors) r[idx[a]] = w
  } else {
    r.fill(1 / N)
  }

  // Sparse rows + per-source teleport mass (game-over / terminal / unmapped).
  const rows: Array<Map<number, number>> = nodeKeys.map(() => new Map())
  const teleportMass = new Array<number>(N).fill(0)

  for (let i = 0; i < N; i++) {
    const node = pos[nodeKeys[i]]
    const items: any[] = node.transitions || []
    let A = 0
    for (const it of items) A += it.attemptProbability || 0
    if (A <= 0) {
      teleportMass[i] = 1
      continue
    }
    for (const it of items) {
      const pAttempt = (it.attemptProbability || 0) / A
      if (pAttempt <= 0) continue
      const tech = it.isSubmission ? sub[it.target] : tr[it.target]
      const outs: any[] = tech && tech.outcomes ? tech.outcomes : []
      let O = 0
      for (const o of outs) O += o.probability || 0
      if (O <= 0) {
        // terminal submission / no outcomes → match ends → restart
        teleportMass[i] += pAttempt
        continue
      }
      for (const o of outs) {
        const pOut = (o.probability || 0) / O
        if (pOut <= 0) continue
        const flow = pAttempt * pOut
        const to: string = o.to
        if (!to || to === "game-over") {
          teleportMass[i] += flow
          continue
        }
        if (to.includes("/")) {
          const j = idx[to]
          if (j !== undefined) rows[i].set(j, (rows[i].get(j) || 0) + flow)
          else teleportMass[i] += flow // missing role-node (none in current data)
        } else {
          // bare hub: split across that hub's role-nodes; else (technique-slug
          // chains, unknown hubs) restart.
          const targets = hubRoleIdx[to]
          if (targets && targets.length > 0) {
            const share = flow / targets.length
            for (const j of targets) rows[i].set(j, (rows[i].get(j) || 0) + share)
          } else {
            teleportMass[i] += flow
          }
        }
      }
    }
  }

  // Power iteration with damping. Mass is conserved each step:
  //   π'[j] = (1-d)·r[j] + d·( Σ_i π[i]·P[i][j] ) + d·(Σ_i π[i]·teleport[i])·r[j]
  const d = 0.85
  let pi = new Array<number>(N).fill(1 / N)
  for (let iter = 0; iter < 200; iter++) {
    const next = new Array<number>(N).fill(0)
    for (let j = 0; j < N; j++) next[j] = (1 - d) * r[j]
    let teleportPool = 0
    for (let i = 0; i < N; i++) {
      const pii = pi[i]
      if (pii === 0) continue
      const row = rows[i]
      for (const [j, p] of row) next[j] += d * pii * p
      teleportPool += d * pii * teleportMass[i]
    }
    for (let j = 0; j < N; j++) next[j] += teleportPool * r[j]
    let diff = 0
    for (let j = 0; j < N; j++) diff += Math.abs(next[j] - pi[j])
    pi = next
    if (diff < 1e-9) break
  }

  let s = 0
  for (let j = 0; j < N; j++) s += pi[j]
  const out: Record<string, number> = {}
  for (let j = 0; j < N; j++) out[nodeKeys[j]] = s > 0 ? pi[j] / s : 0
  return out
}

/**
 * Position-importance weight W(hub) = (1-b)·markov + b·editorial. Markov
 * frequencies are aggregated from role-nodes up to hub and normalized to sum 1;
 * editorial is FUNDAMENTALS normalized to sum 1 (flat or weighted). Both halves
 * sum to 1, so the blend does too.
 */
function computeWeights(graph: any, pi: Record<string, number>): Record<string, number> {
  const pos = graph.positions || {}
  const markovHub: Record<string, number> = {}
  for (const [k, v] of Object.entries<any>(pos)) {
    if (v.role === "top" || v.role === "bottom") {
      markovHub[v.hub] = (markovHub[v.hub] || 0) + (pi[k] || 0)
    }
  }
  let ms = 0
  for (const h in markovHub) ms += markovHub[h]
  if (ms > 0) for (const h in markovHub) markovHub[h] /= ms

  const editorialTotal = Object.values(FUNDAMENTALS).reduce((a, b) => a + b, 0)
  const editorial: Record<string, number> = {}
  if (editorialTotal > 0) {
    for (const [h, w] of Object.entries(FUNDAMENTALS)) editorial[h] = w / editorialTotal
  }

  const b = EDITORIAL_BLEND
  const hubs = new Set<string>([...Object.keys(markovHub), ...Object.keys(FUNDAMENTALS)])
  const W: Record<string, number> = {}
  for (const h of hubs) {
    const blend = (1 - b) * (markovHub[h] || 0) + b * (editorial[h] || 0)
    // Floor any graph-present hub to a tiny positive weight. Orphan / dead-end
    // hubs have markov mass so small it rounds to 0, which would make the
    // client drop (via its `vCommon > 0` gate) every technique sourced only
    // from them — silently un-suggestable. The floor keeps them eligible but
    // ranked at the very bottom (MM-1).
    const w = round(blend, 9)
    W[h] = h in markovHub ? Math.max(w, 1e-9) : w
  }
  return W
}

type PosTech = { i: number; ap: number; role: "top" | "bottom" | "hub" }

type Adjacency = {
  version: number
  /** position hub → techniques attempted from it (both roles folded in). */
  posTechs: Record<string, PosTech[]>
  /** bank[i] → position hubs this technique can lead to (game-over stripped). */
  outcomes: string[][]
  /** position hub → importance weight W(hub) (0.85·markov + 0.15·editorial). */
  weights: Record<string, number>
  /** bank[i] → successRate/100 (effectiveness). */
  effectiveness: number[]
  /** bank[i] → the hub a technique primarily starts from. */
  startHub: string[]
}

function buildBankAndAdjacency(
  graph: any,
  slugLookup: Record<string, string>,
): { bank: BankEntry[]; adjacency: Adjacency } {
  const bank: BankEntry[] = []
  const bankGraphKeys: Array<{ key: string; section: BankSection }> = []

  const addEntries = (
    section: Record<string, any>,
    type: string,
    prefix: string,
    sectionName: BankSection,
  ) => {
    for (const [key, data] of Object.entries(section || {})) {
      if (data.isFamily) continue
      if (sectionName === "positions" && data.role === "hub") continue
      const cards = data.flashcards || []
      if (cards.length === 0) continue
      const fileSlug = slugLookup[data.name?.toLowerCase()] || `${prefix}/${data.name || key}`
      bank.push({ name: data.name || key, type, slug: fileSlug, flashcards: cards })
      bankGraphKeys.push({ key, section: sectionName })
    }
  }

  addEntries(graph.transitions, "transition", "Transitions", "transitions")
  addEntries(graph.submissions, "submission", "Submissions", "submissions")
  addEntries(graph.positions, "position", "Positions", "positions")
  addEntries(graph.principles, "principle", "Principles", "principles")
  addEntries(graph.systems, "system", "Systems", "systems")

  // Reverse lookup: graph key → bank index, kept per section so the 18
  // transition/submission key collisions (e.g. "clock-choke") resolve via the
  // position transition item's `isSubmission` flag rather than colliding.
  const idxByKey: Record<string, Record<string, number>> = {
    transitions: {},
    submissions: {},
    positions: {},
    principles: {},
    systems: {},
  }
  for (let i = 0; i < bank.length; i++) {
    const { key, section } = bankGraphKeys[i]
    idxByKey[section][key] = i
  }

  // posTechs: from each position role-node's transitions, record the technique's
  // bank index + attempt probability + role under its hub. Folds top+bottom.
  const posTechs: Record<string, PosTech[]> = {}
  for (const data of Object.values<any>(graph.positions || {})) {
    const role = data.role
    if (role !== "top" && role !== "bottom") continue
    const hub: string = data.hub
    for (const it of data.transitions || []) {
      const map = it.isSubmission ? idxByKey.submissions : idxByKey.transitions
      const bi = map[it.target]
      if (bi === undefined)
        continue // technique has no flashcards / not in bank
      ;(posTechs[hub] ||= []).push({ i: bi, ap: it.attemptProbability || 0, role })
    }
  }

  // The set of real position hubs, for resolving outcome targets.
  const validHubs = new Set<string>()
  for (const v of Object.values<any>(graph.positions || {})) {
    if (v.hub) validHubs.add(v.hub)
  }

  const outcomes: string[][] = []
  const effectiveness: number[] = []
  const startHub: string[] = []
  for (let i = 0; i < bank.length; i++) {
    const { key, section } = bankGraphKeys[i]
    const data = graph[section]?.[key]
    if (!data) {
      outcomes.push([])
      effectiveness.push(0)
      startHub.push("")
      continue
    }
    const outPos: string[] = []
    for (const o of data.outcomes || []) {
      if (!o.to || o.to === "game-over") continue
      let hub: string | undefined
      if (o.to.includes("/")) {
        hub = o.to.split("/")[0]
      } else if (validHubs.has(o.to)) {
        hub = o.to
      } else {
        // A role-less target that isn't a position hub is a chained *technique*
        // slug — resolve it to that technique's starting position so the
        // outcome graph stays positions-only (ADJ-1).
        const chained = graph.transitions?.[o.to] || graph.submissions?.[o.to]
        hub = chained?.startingPosition
        if (!hub || !validHubs.has(hub)) continue
      }
      if (hub && !outPos.includes(hub)) outPos.push(hub)
    }
    outcomes.push(outPos)
    effectiveness.push(round((data.successRate || 0) / 100, 4))
    startHub.push(typeof data.startingPosition === "string" ? data.startingPosition : "")
  }

  const stationary = computeStationary(graph)
  const weights = computeWeights(graph, stationary)

  return {
    bank,
    adjacency: { version: 2, posTechs, outcomes, weights, effectiveness, startHub },
  }
}

async function emitPair(
  ctx: Parameters<NonNullable<ReturnType<QuartzEmitterPlugin>["emit"]>>[0],
  slug: FullSlug,
  payload: string,
): Promise<FilePath[]> {
  const out: FilePath[] = []
  out.push(await write({ ctx, content: payload, slug, ext: ".json" }))
  const compressed = await gzipAsync(Buffer.from(payload, "utf-8"))
  out.push(await write({ ctx, content: compressed, slug, ext: ".json.gz" }))
  return out
}

export const TrainingData: QuartzEmitterPlugin = () => {
  return {
    name: "TrainingData",
    async getDependencyGraph(ctx, content, _resources) {
      const graph = new DepGraph<FilePath>()
      const qbPath = joinSegments(ctx.argv.output, "static/questionBank.json") as FilePath
      const adjPath = joinSegments(ctx.argv.output, "static/graphAdjacency.json") as FilePath
      for (const [_tree, file] of content) {
        const sourcePath = file.data.filePath!
        graph.addEdge(sourcePath, qbPath)
        graph.addEdge(sourcePath, adjPath)
      }
      return graph
    },
    async emit(ctx, content, _resources) {
      // Load graph.json from disk (same source as renderPage.tsx)
      const graphPath = path.join(process.cwd(), "..", "graph.json")
      let graph: any = {}
      try {
        graph = JSON.parse(fs.readFileSync(graphPath, "utf-8"))
      } catch {
        return []
      }

      // Build slug lookup from technique name → file slug
      const slugLookup: Record<string, string> = {}
      for (const [_tree, file] of content) {
        const fSlug = (file.data.slug ?? "") as string
        const title = (file.data.frontmatter?.title as string) ?? ""
        const name = title.split(" | ")[0].trim()
        if (name) slugLookup[name.toLowerCase()] = fSlug
      }

      const { bank, adjacency } = buildBankAndAdjacency(graph, slugLookup)

      // Sanity log: top position weights should be led by the fundamentals.
      const topW = Object.entries(adjacency.weights)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
      const sumW = Object.values(adjacency.weights).reduce((a, b) => a + b, 0)
      console.log(
        `[TrainingData] graphAdjacency v${adjacency.version}: ${Object.keys(adjacency.posTechs).length} hubs, ` +
          `ΣW=${sumW.toFixed(4)}. Top-20 W: ` +
          topW.map(([h, w]) => `${h}:${w.toFixed(4)}`).join(", "),
      )

      // Recurrence guard (MM-1): a hub at W==0 silently drops every technique
      // sourced only from it (the client's `vCommon > 0` candidacy gate). The
      // weight floor must keep this empty — warn loudly if a future change
      // (precision, topology) breaks the invariant.
      const zeroHubs = Object.entries(adjacency.weights)
        .filter(([, w]) => w <= 0)
        .map(([h]) => h)
      if (zeroHubs.length > 0) {
        console.warn(
          `[TrainingData] WARNING: ${zeroHubs.length} position hub(s) have W==0 ` +
            `(techniques sourced only from them become un-suggestable): ${zeroHubs.join(", ")}`,
        )
      }
      // Informational (distinct from the W==0 case): trainable techniques that
      // NO position routes to as an attempt option. They can't be recommended
      // until wired into a position's transitions[] — a content gap, shrinking
      // as orphan-connection work lands.
      const sourced = new Set<number>()
      for (const techs of Object.values(adjacency.posTechs)) {
        for (const t of techs) sourced.add(t.i)
      }
      const orphanTrainable = bank.filter(
        (b, i) => (b.type === "transition" || b.type === "submission") && !sourced.has(i),
      )
      if (orphanTrainable.length > 0) {
        console.log(
          `[TrainingData] note: ${orphanTrainable.length} trainable technique(s) are not referenced ` +
            `by any position, so they can't be suggested (e.g. ${orphanTrainable
              .slice(0, 6)
              .map((b) => b.name)
              .join(", ")})`,
        )
      }

      const emitted: FilePath[] = []
      emitted.push(
        ...(await emitPair(
          ctx,
          joinSegments("static", "questionBank") as FullSlug,
          JSON.stringify(bank),
        )),
      )
      emitted.push(
        ...(await emitPair(
          ctx,
          joinSegments("static", "graphAdjacency") as FullSlug,
          JSON.stringify(adjacency),
        )),
      )
      return emitted
    },
    getQuartzComponents: () => [],
  }
}
