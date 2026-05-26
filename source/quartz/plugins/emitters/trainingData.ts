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

function buildBankAndAdjacency(
  graph: any,
  slugLookup: Record<string, string>,
): { bank: BankEntry[]; adjacency: { positions: Record<string, number[]>; outcomes: string[][] } } {
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

  const positions: Record<string, number[]> = {}
  const outcomes: string[][] = []
  for (let i = 0; i < bank.length; i++) {
    const { key, section } = bankGraphKeys[i]
    const data = graph[section]?.[key]
    if (!data) {
      outcomes.push([])
      continue
    }
    const startPositions: string[] = []
    if (data.startingPosition) startPositions.push(data.startingPosition)
    if (data.fromPositions) {
      for (const fp of data.fromPositions) {
        if (!startPositions.includes(fp)) startPositions.push(fp)
      }
    }
    for (const pos of startPositions) {
      if (!positions[pos]) positions[pos] = []
      if (!positions[pos].includes(i)) positions[pos].push(i)
    }
    const outPos: string[] = []
    for (const o of data.outcomes || []) {
      if (!o.to || o.to === "game-over") continue
      const hub = o.to.includes("/") ? o.to.split("/")[0] : o.to
      if (!outPos.includes(hub)) outPos.push(hub)
    }
    outcomes.push(outPos)
  }

  return { bank, adjacency: { positions, outcomes } }
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
