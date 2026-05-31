import { render } from "preact-render-to-string"
import { QuartzComponent, QuartzComponentProps } from "./types"
import HeaderConstructor from "./Header"
import BodyConstructor from "./Body"
import { JSResourceToScriptElement, StaticResources } from "../util/resources"
import {
  clone,
  FullSlug,
  SimpleSlug,
  RelativeURL,
  joinSegments,
  normalizeHastElement,
  simplifySlug,
} from "../util/path"
import { visit, EXIT } from "unist-util-visit"
import { Root, Element, ElementContent } from "hast"
import { GlobalConfiguration } from "../cfg"
import { i18n } from "../i18n"
import { QuartzPluginData } from "../plugins/vfile"
import fs from "fs"
import path from "path"
import { forceSimulation, forceManyBody, forceCenter, forceLink, forceCollide } from "d3-force"

// === Build-time graph data injection ===
// Per-page slices are inlined here (page-graph-data, roll positions, content
// stats). Large blobs (questionBank, graphAdjacency, contentIndex, graph.json)
// go through static emitters and are fetched lazily at runtime.

// Cached content stats (computed once at build time by counting .json files)
let _contentStatsJson: string | null = null

function getContentStatsJson(): string {
  if (_contentStatsJson !== null) return _contentStatsJson

  const contentDir = path.join(process.cwd(), "..", "content")
  const countJsonFiles = (dir: string): number => {
    const full = path.join(contentDir, dir)
    if (!fs.existsSync(full)) return 0
    return fs.readdirSync(full, { recursive: true }).filter((f) => String(f).endsWith(".json"))
      .length
  }

  _contentStatsJson = JSON.stringify({
    positions: countJsonFiles("Positions"),
    transitions: countJsonFiles("Transitions"),
    submissions: countJsonFiles("Submissions"),
    principles: countJsonFiles("Principles"),
    systems: countJsonFiles("Systems"),
  })
  return _contentStatsJson
}

// Cached roll positions JSON (computed once across all pages at build time)
let _rollPositionsJson: string | null = null

function getRollPositionsJson(allFiles: QuartzPluginData[]): string {
  if (_rollPositionsJson !== null) return _rollPositionsJson

  const rolePages = allFiles
    .filter((f) => {
      const slug = f.slug ?? ""
      const lower = slug.toLowerCase()
      return lower.startsWith("positions/") && (lower.endsWith("/top") || lower.endsWith("/bottom"))
    })
    .map((f) => {
      const title = (f.frontmatter?.title as string) ?? ""
      const name = title.split(" | ")[0] || f.slug!.split("/").pop() || ""
      return { s: f.slug!, n: name }
    })

  _rollPositionsJson = JSON.stringify(rolePages)
  return _rollPositionsJson
}

// === Build-time graph layout pre-computation ===
// Pre-compute D3 force layouts for all pages so the client renders instantly
// without running D3 force simulation at all.

// Global graph data (computed once from allFiles)
let _allSimpleSlugs: Set<string> | null = null
// Adjacency index for fast BFS: slug → set of connected slugs
let _adjacency: Map<string, Set<string>> | null = null

// Title lookup: slug → display title (computed once)
let _titleIndex: Map<string, string> | null = null
// Tags lookup: slug → tags array (computed once)
let _tagsIndex: Map<string, string[]> | null = null

function ensureGlobalGraphData(allFiles: QuartzPluginData[]) {
  if (_allSimpleSlugs !== null) return

  _allSimpleSlugs = new Set<string>()
  _titleIndex = new Map()
  _tagsIndex = new Map()
  for (const f of allFiles) {
    const slug = simplifySlug((f.slug ?? "") as FullSlug)
    _allSimpleSlugs.add(slug)
    const title = (f.frontmatter?.title as string) ?? slug.split("/").pop() ?? slug
    _titleIndex.set(slug, title.split(" | ")[0])
    _tagsIndex.set(slug, (f.frontmatter?.tags as string[]) ?? [])
  }

  _adjacency = new Map()
  for (const f of allFiles) {
    const source = simplifySlug((f.slug ?? "") as FullSlug)
    const outgoing = (f.links ?? []) as SimpleSlug[]
    for (const target of outgoing) {
      if (_allSimpleSlugs.has(target)) {
        if (!_adjacency.has(source)) _adjacency.set(source, new Set())
        if (!_adjacency.has(target)) _adjacency.set(target, new Set())
        _adjacency.get(source)!.add(target)
        _adjacency.get(target)!.add(source)
      }
    }
  }
}

// Hub slug helper (mirrors client-side getHubSlug — only bottom/top)
function getHubSlug(nodeId: string): string {
  const lower = nodeId.toLowerCase()
  if (
    lower.endsWith("/bottom") ||
    lower.endsWith("/top") ||
    lower.endsWith("/attacker") ||
    lower.endsWith("/defender")
  ) {
    return nodeId.split("/").slice(0, -1).join("/")
  }
  return nodeId
}

const categoryHubSet = new Set([
  "positions",
  "transitions",
  "submissions",
  "systems",
  "principles",
  "learning",
])

// Cache per-page: slug → JSON string or null
const _pageGraphPositionsCache: Record<string, string | null> = {}

function computePageGraphLayout(allFiles: QuartzPluginData[], slug: FullSlug): string | null {
  const simpleSlug = simplifySlug(slug).replace(/\/$/, "")
  if (simpleSlug in _pageGraphPositionsCache) {
    return _pageGraphPositionsCache[simpleSlug]
  }

  ensureGlobalGraphData(allFiles)
  const allSlugs = _allSimpleSlugs!

  const slugLower = simpleSlug.toLowerCase()
  const isHomepage = simpleSlug === "index"
  const isCategoryHub = categoryHubSet.has(slugLower)

  // Build neighbourhood (mirrors client-side logic in graph.inline.ts)
  const neighbourhood = new Set<string>()

  if (isHomepage) {
    for (const hub of categoryHubSet) {
      for (const nodeSlug of allSlugs) {
        if (nodeSlug.toLowerCase() === hub) {
          neighbourhood.add(nodeSlug)
          break
        }
      }
    }
  } else if (isCategoryHub) {
    neighbourhood.add(simpleSlug)
    const prefix = slugLower + "/"
    for (const nodeSlug of allSlugs) {
      const lower = nodeSlug.toLowerCase()
      if (
        lower.startsWith(prefix) &&
        !lower.endsWith("/bottom") &&
        !lower.endsWith("/top") &&
        !lower.endsWith("/attacker") &&
        !lower.endsWith("/defender")
      ) {
        neighbourhood.add(nodeSlug)
      }
    }
  } else {
    // Depth-1 BFS
    const wl: (string | "__SENTINEL")[] = [simpleSlug, "__SENTINEL"]
    let depth = 1

    // For hub pages, also seed BFS with their role pages to aggregate links
    const isPositionHub =
      slugLower.startsWith("positions/") &&
      !slugLower.endsWith("/bottom") &&
      !slugLower.endsWith("/top")
    const isTransitionOrSubmissionHub =
      (slugLower.startsWith("transitions/") || slugLower.startsWith("submissions/")) &&
      !slugLower.endsWith("/attacker") &&
      !slugLower.endsWith("/defender")

    const roleSuffixes: string[] = []
    if (isPositionHub) {
      roleSuffixes.push("/bottom", "/top")
    } else if (isTransitionOrSubmissionHub) {
      roleSuffixes.push("/attacker", "/defender")
    }

    if (roleSuffixes.length > 0) {
      const rolePagesToAdd: string[] = []
      const roleSlugsToFind = roleSuffixes.map((s) => slugLower + s)
      for (const nodeSlug of allSlugs) {
        const lower = nodeSlug.toLowerCase()
        if (roleSlugsToFind.includes(lower)) {
          rolePagesToAdd.push(nodeSlug)
        }
      }
      const sentinelIdx = wl.indexOf("__SENTINEL")
      wl.splice(sentinelIdx, 0, ...rolePagesToAdd)
    }

    while (depth >= 0 && wl.length > 0) {
      const cur = wl.shift()!
      if (cur === "__SENTINEL") {
        depth--
        wl.push("__SENTINEL")
      } else {
        neighbourhood.add(cur)
        const neighbours = _adjacency!.get(cur)
        if (neighbours) {
          for (const n of neighbours) wl.push(n)
        }
      }
    }

    // Remove category hub pages from regular page neighbourhoods
    for (const hub of categoryHubSet) {
      neighbourhood.delete(hub)
    }
  }

  // Filter out role pages from final nodes (mirrors client-side)
  const nodeIds: string[] = []
  for (const url of neighbourhood) {
    const lower = url.toLowerCase()
    if (
      !lower.endsWith("/bottom") &&
      !lower.endsWith("/top") &&
      !lower.endsWith("/attacker") &&
      !lower.endsWith("/defender")
    ) {
      nodeIds.push(url)
    }
  }

  if (nodeIds.length === 0) {
    _pageGraphPositionsCache[simpleSlug] = null
    return null
  }

  // Build links with hub slug redirection (mirrors client-side)
  const nodeIdSet = new Set(nodeIds)
  const linkSet = new Set<string>()
  type LinkDatum = { source: string; target: string }
  const graphLinks: LinkDatum[] = []

  // Only scan links originating from neighbourhood members (via adjacency)
  for (const source of neighbourhood) {
    const neighbours = _adjacency!.get(source)
    if (!neighbours) continue
    for (const target of neighbours) {
      if (!neighbourhood.has(target)) continue
      const actualSource = getHubSlug(source)
      const actualTarget = getHubSlug(target)
      if (!nodeIdSet.has(actualSource) || !nodeIdSet.has(actualTarget)) continue
      if (actualSource === actualTarget) continue
      const key = `${actualSource}|${actualTarget}`
      if (!linkSet.has(key)) {
        linkSet.add(key)
        graphLinks.push({ source: actualSource, target: actualTarget })
      }
    }
  }

  // Run D3 force simulation synchronously
  type NodeDatum = { id: string; x?: number; y?: number; index?: number }
  const nodes: NodeDatum[] = nodeIds.map((id) => ({ id }))
  const sim = forceSimulation(nodes)
    .force("charge", forceManyBody().strength(-100).distanceMax(200))
    .force("center", forceCenter())
    .force(
      "link",
      forceLink(graphLinks)
        .id((d: any) => d.id)
        .distance(30),
    )
    .force("collide", forceCollide(4).iterations(1))
    .stop()

  sim.tick(300)
  sim.stop()

  const result = JSON.stringify({
    nodes: nodes.map((n) => ({
      id: n.id,
      x: Math.round((n.x ?? 0) * 10) / 10,
      y: Math.round((n.y ?? 0) * 10) / 10,
      t: _titleIndex!.get(n.id) || n.id.split("/").pop() || n.id,
      tags: _tagsIndex!.get(n.id) || [],
    })),
    links: graphLinks,
  })

  _pageGraphPositionsCache[simpleSlug] = result
  return result
}

// Note: Global graph layout (background graph node positions) is now computed by
// scripts/regenerate_graph_layout.py via node2vec + UMAP. The output file at
// source/quartz/static/globalGraphLayout.json is copied through the build to
// public/static/ and fetched at runtime by backgroundGraph.inline.ts.

// Cached graph.json data and lookup index (read once at build time)
let _graphJson: any = null
type GraphSection = "positions" | "transitions" | "submissions" | "principles" | "systems"
// Maps lowercase slug (without section prefix) → { section, key }
let _slugIndex: Record<string, { section: GraphSection; key: string }> = {}

function loadGraphData(): any {
  if (_graphJson !== null) return _graphJson

  try {
    const graphPath = path.join(process.cwd(), "..", "graph.json")
    _graphJson = JSON.parse(fs.readFileSync(graphPath, "utf-8"))
  } catch {
    _graphJson = {}
  }

  // Build lookup index from Quartz slug → graph key
  _slugIndex = {}

  if (_graphJson.positions) {
    for (const [key, pos] of Object.entries<any>(_graphJson.positions)) {
      if (pos.path) {
        // path: "Ashi Garami/50-50 Guard/Top" → "ashi-garami/50-50-guard/top"
        const normalized = pos.path.toLowerCase().replace(/\s+/g, "-")
        _slugIndex[normalized] = { section: "positions", key }
      }
    }
  }

  if (_graphJson.transitions) {
    for (const key of Object.keys(_graphJson.transitions)) {
      // key is already lowercase hyphenated: "hip-bump-sweep"
      _slugIndex[key] = { section: "transitions", key }
    }
  }

  if (_graphJson.submissions) {
    for (const key of Object.keys(_graphJson.submissions)) {
      _slugIndex[key] = { section: "submissions", key }
    }
  }

  if (_graphJson.principles) {
    for (const key of Object.keys(_graphJson.principles)) {
      _slugIndex[key] = { section: "principles", key }
    }
  }

  if (_graphJson.systems) {
    for (const key of Object.keys(_graphJson.systems)) {
      _slugIndex[key] = { section: "systems", key }
    }
  }

  return _graphJson
}

type RoleFilter = "attacker" | "defender" | "top" | "bottom" | null

function getPageGraphData(slug: FullSlug): string | null {
  const graph = loadGraphData()
  if (!graph || Object.keys(graph).length === 0) return null

  // Strip section prefix and lowercase to match index
  // e.g. "Positions/Mount/Top"          → "mount/top"
  // e.g. "Transitions/Hip-Bump-Sweep"   → "hip-bump-sweep"
  // e.g. "Submissions/Americana/from-Mount" → "americana/from-mount" → normalized to "americana-from-mount"
  // e.g. "Principles/Base"              → "base"
  const slugLower = slug.toLowerCase()
  const SECTIONS: Array<{ prefix: string; section: GraphSection }> = [
    { prefix: "positions/", section: "positions" },
    { prefix: "transitions/", section: "transitions" },
    { prefix: "submissions/", section: "submissions" },
    { prefix: "principles/", section: "principles" },
    { prefix: "systems/", section: "systems" },
  ]

  let lookupKey: string | null = null
  let urlSection: GraphSection | null = null
  for (const s of SECTIONS) {
    if (slugLower.startsWith(s.prefix)) {
      lookupKey = slugLower.slice(s.prefix.length)
      urlSection = s.section
      break
    }
  }
  if (!lookupKey || !urlSection) return null

  // Detect role suffix and strip to find parent entry.
  // Positions: /top, /bottom
  // Transitions & Submissions: /attacker, /defender
  let role: RoleFilter = null
  if (urlSection === "positions") {
    if (lookupKey.endsWith("/top")) {
      // Keep slash — position role entries are keyed "mount/top"
      role = "top"
    } else if (lookupKey.endsWith("/bottom")) {
      role = "bottom"
    }
  } else if (urlSection === "transitions" || urlSection === "submissions") {
    if (lookupKey.endsWith("/attacker")) {
      role = "attacker"
      lookupKey = lookupKey.slice(0, -"/attacker".length)
    } else if (lookupKey.endsWith("/defender")) {
      role = "defender"
      lookupKey = lookupKey.slice(0, -"/defender".length)
    }
  }

  // Submission variant URL normalization: "americana/from-mount" → "americana-from-mount"
  // (family hub keys like "americana" are unchanged)
  if (urlSection === "submissions" && lookupKey.includes("/")) {
    const hyphenated = lookupKey.replace(/\//g, "-")
    if (graph.submissions?.[hyphenated]) {
      lookupKey = hyphenated
    }
  }

  // Prefer the section matching the URL prefix (avoids slug collisions
  // where e.g. both transitions["americana"] and submissions["americana"] exist)
  let entry = _slugIndex[lookupKey]
  if (entry && entry.section !== urlSection && graph[urlSection]?.[lookupKey]) {
    entry = { section: urlSection, key: lookupKey }
  }
  // Fall back to direct lookup in the URL-matching section (handles position
  // hub entries like "mount" that the index may not cover).
  if (!entry && graph[urlSection]?.[lookupKey]) {
    entry = { section: urlSection, key: lookupKey }
  }
  if (!entry) return null

  const data = graph[entry.section]?.[entry.key]
  if (!data) return null

  const toUrlPath = (p: string) => p.replace(/\s+/g, "-")

  // Return only the fields each page type needs
  if (entry.section === "positions") {
    return JSON.stringify({
      type: "position",
      name: data.name,
      role: data.role || null,
      transitions: data.transitions,
      defenses: data.defenses,
      opponentTransitions: data.opponentTransitions || [],
      flashcards: data.flashcards || [],
    })
  } else if (entry.section === "transitions" || entry.section === "submissions") {
    // Role-filtered flashcard selection
    let flashcards: Array<{ question: string; answer: string }> = []
    if (role === "attacker") {
      flashcards = data.attackerFlashcards || []
    } else if (role === "defender") {
      flashcards = data.defenderFlashcards || []
    } else {
      flashcards = data.flashcards || []
    }

    // Resolve outcome slugs to display names and URL-safe paths (spaces → hyphens)
    const resolvedOutcomes = (data.outcomes || []).map((o: any) => {
      const toSlug: string = o.to || ""
      if (toSlug === "game-over") {
        return { ...o, toName: "Game Over", toPath: "Game-Over" }
      }
      const posData = graph.positions?.[toSlug]
      if (posData) {
        return { ...o, toName: posData.name, toPath: toUrlPath(posData.path) }
      }
      const subSlug = toSlug.includes("/") ? toSlug.split("/")[0] : toSlug
      const subData = graph.submissions?.[subSlug]
      if (subData) {
        return { ...o, toName: subData.name, toPath: `Submissions/${toUrlPath(subData.name)}` }
      }
      return { ...o, toName: toSlug, toPath: toUrlPath(toSlug) }
    })

    const result: any = {
      type: entry.section === "transitions" ? "transition" : "submission",
      name: data.name,
      endingPosition: data.endingPosition,
      endingPositionPath: data.endingPositionPath,
      startingPosition: data.startingPosition || null,
      startingPositionPath: toUrlPath(data.startingPositionPath || ""),
      startingPositionRole: data.startingPositionRole || null,
      outcomes: resolvedOutcomes,
      flashcards,
    }

    if (entry.section === "submissions") {
      result.isTerminal = data.isTerminal
      if (data.isFamily) result.isFamily = true
    }

    return JSON.stringify(result)
  } else if (entry.section === "principles" || entry.section === "systems") {
    return JSON.stringify({
      type: entry.section === "principles" ? "principle" : "system",
      name: data.name,
      flashcards: data.flashcards || [],
    })
  }

  return null
}

interface RenderComponents {
  head: QuartzComponent
  header: QuartzComponent[]
  beforeBody: QuartzComponent[]
  pageBody: QuartzComponent
  afterBody: QuartzComponent[]
  left: QuartzComponent[]
  right: QuartzComponent[]
  footer: QuartzComponent
}

const headerRegex = new RegExp(/h[1-6]/)
export function pageResources(
  baseDir: FullSlug | RelativeURL,
  staticResources: StaticResources,
): StaticResources {
  const contentIndexPath = joinSegments(baseDir, "static/contentIndex.json")
  const contentIndexGzPath = joinSegments(baseDir, "static/contentIndex.json.gz")
  const questionBankPath = joinSegments(baseDir, "static/questionBank.json")
  const questionBankGzPath = joinSegments(baseDir, "static/questionBank.json.gz")
  const graphAdjacencyPath = joinSegments(baseDir, "static/graphAdjacency.json")
  const graphAdjacencyGzPath = joinSegments(baseDir, "static/graphAdjacency.json.gz")

  // Lazy content index: only fetched when search opens, global graph opens, or 404 page loads
  const contentIndexScript = `
    let __contentIndexPromise = null;
    const fetchData = new Promise(() => {});
    fetchData.__isLazy = true;
    window.loadContentIndex = function() {
      if (__contentIndexPromise) return __contentIndexPromise;
      __contentIndexPromise = (async () => {
        try {
          const gzResponse = await fetch("${contentIndexGzPath}");
          if (gzResponse.ok) {
            const compressed = await gzResponse.arrayBuffer();
            const ds = new DecompressionStream('gzip');
            const decompressedStream = new Response(compressed).body.pipeThrough(ds);
            const decompressed = await new Response(decompressedStream).text();
            return JSON.parse(decompressed);
          }
        } catch (e) {
          console.warn('Failed to load compressed content index, falling back to uncompressed:', e);
        }
        return fetch("${contentIndexPath}").then(data => data.json());
      })();
      return __contentIndexPromise;
    }`

  // Lazy training data: question bank + graph adjacency. Only fetched when the
  // user starts a training session or opens DecksModal.
  const trainingDataScript = `
    let __questionBankPromise = null;
    let __graphAdjacencyPromise = null;
    async function __fetchLazyJson(gzPath, plainPath) {
      try {
        const gzResponse = await fetch(gzPath);
        if (gzResponse.ok) {
          const compressed = await gzResponse.arrayBuffer();
          const ds = new DecompressionStream('gzip');
          const decompressedStream = new Response(compressed).body.pipeThrough(ds);
          const decompressed = await new Response(decompressedStream).text();
          return JSON.parse(decompressed);
        }
      } catch (e) {
        console.warn('Failed to load compressed lazy JSON, falling back:', e);
      }
      return fetch(plainPath).then(r => r.json());
    }
    window.loadQuestionBank = function() {
      if (__questionBankPromise) return __questionBankPromise;
      __questionBankPromise = __fetchLazyJson("${questionBankGzPath}", "${questionBankPath}");
      return __questionBankPromise;
    }
    window.loadGraphAdjacency = function() {
      if (__graphAdjacencyPromise) return __graphAdjacencyPromise;
      __graphAdjacencyPromise = __fetchLazyJson("${graphAdjacencyGzPath}", "${graphAdjacencyPath}");
      return __graphAdjacencyPromise;
    }`

  return {
    css: [joinSegments(baseDir, "index.css"), ...staticResources.css],
    js: [
      {
        src: joinSegments(baseDir, "prescript.js"),
        loadTime: "beforeDOMReady",
        contentType: "external",
      },
      {
        loadTime: "beforeDOMReady",
        contentType: "inline",
        spaPreserve: true,
        script: contentIndexScript,
      },
      {
        loadTime: "beforeDOMReady",
        contentType: "inline",
        spaPreserve: true,
        script: trainingDataScript,
      },
      ...staticResources.js,
      {
        src: joinSegments(baseDir, "postscript.js"),
        loadTime: "afterDOMReady",
        moduleType: "module",
        contentType: "external",
      },
    ],
  }
}

export function renderPage(
  cfg: GlobalConfiguration,
  slug: FullSlug,
  componentData: QuartzComponentProps,
  components: RenderComponents,
  pageResources: StaticResources,
): string {
  // Inject roll positions data (build-time, avoids 3.5MB graph.json fetch at runtime)
  const rollData = getRollPositionsJson(componentData.allFiles)
  pageResources.js.push({
    loadTime: "beforeDOMReady",
    contentType: "inline",
    spaPreserve: true,
    script: `window.__rollPositions=${rollData}`,
  })

  // Inject content stats on every page (build-time counts of .json files per
  // category). Populates `[data-folder-count]` spans next to top-level Explorer
  // folder titles (Positions / Transitions / Submissions / Principles / Systems).
  const stats = getContentStatsJson()
  pageResources.js.push({
    loadTime: "beforeDOMReady",
    contentType: "inline",
    spaPreserve: true,
    script: `window.__contentStats=${stats};document.addEventListener("nav",()=>{const s=window.__contentStats;if(!s)return;document.querySelectorAll("[data-folder-count]").forEach(el=>{const k=el.getAttribute("data-folder-count");if(k&&s[k]!=null)el.textContent=String(s[k])})})`,
  })

  // Only deep-clone the tree if transclusions exist (saves ~1-15ms per page)
  let hasTransclusions = false
  visit(componentData.tree as Root, "element", (node) => {
    if (node.tagName === "blockquote") {
      const classNames = (node.properties?.className ?? []) as string[]
      if (classNames.includes("transclude")) {
        hasTransclusions = true
        return EXIT
      }
    }
  })

  const root = hasTransclusions ? (clone(componentData.tree) as Root) : (componentData.tree as Root)

  // process transcludes in componentData
  if (hasTransclusions)
    visit(root, "element", (node, _index, _parent) => {
      if (node.tagName === "blockquote") {
        const classNames = (node.properties?.className ?? []) as string[]
        if (classNames.includes("transclude")) {
          const inner = node.children[0] as Element
          const transcludeTarget = inner.properties["data-slug"] as FullSlug
          const page = componentData.slugMap
            ? componentData.slugMap.get(transcludeTarget)
            : componentData.allFiles.find((f) => f.slug === transcludeTarget)
          if (!page) {
            return
          }

          let blockRef = node.properties.dataBlock as string | undefined
          if (blockRef?.startsWith("#^")) {
            // block transclude
            blockRef = blockRef.slice("#^".length)
            let blockNode = page.blocks?.[blockRef]
            if (blockNode) {
              if (blockNode.tagName === "li") {
                blockNode = {
                  type: "element",
                  tagName: "ul",
                  properties: {},
                  children: [blockNode],
                }
              }

              node.children = [
                normalizeHastElement(blockNode, slug, transcludeTarget),
                {
                  type: "element",
                  tagName: "a",
                  properties: {
                    href: inner.properties?.href,
                    class: ["internal", "transclude-src"],
                  },
                  children: [
                    { type: "text", value: i18n(cfg.locale).components.transcludes.linkToOriginal },
                  ],
                },
              ]
            }
          } else if (blockRef?.startsWith("#") && page.htmlAst) {
            // header transclude
            blockRef = blockRef.slice(1)
            let startIdx = undefined
            let startDepth = undefined
            let endIdx = undefined
            for (const [i, el] of page.htmlAst.children.entries()) {
              // skip non-headers
              if (!(el.type === "element" && el.tagName.match(headerRegex))) continue
              const depth = Number(el.tagName.substring(1))

              // lookin for our blockref
              if (startIdx === undefined || startDepth === undefined) {
                // skip until we find the blockref that matches
                if (el.properties?.id === blockRef) {
                  startIdx = i
                  startDepth = depth
                }
              } else if (depth <= startDepth) {
                // looking for new header that is same level or higher
                endIdx = i
                break
              }
            }

            if (startIdx === undefined) {
              return
            }

            node.children = [
              ...(page.htmlAst.children.slice(startIdx, endIdx) as ElementContent[]).map((child) =>
                normalizeHastElement(child as Element, slug, transcludeTarget),
              ),
              {
                type: "element",
                tagName: "a",
                properties: { href: inner.properties?.href, class: ["internal", "transclude-src"] },
                children: [
                  { type: "text", value: i18n(cfg.locale).components.transcludes.linkToOriginal },
                ],
              },
            ]
          } else if (page.htmlAst) {
            // page transclude
            node.children = [
              {
                type: "element",
                tagName: "h1",
                properties: {},
                children: [
                  {
                    type: "text",
                    value:
                      page.frontmatter?.title ??
                      i18n(cfg.locale).components.transcludes.transcludeOf({
                        targetSlug: page.slug!,
                      }),
                  },
                ],
              },
              ...(page.htmlAst.children as ElementContent[]).map((child) =>
                normalizeHastElement(child as Element, slug, transcludeTarget),
              ),
              {
                type: "element",
                tagName: "a",
                properties: { href: inner.properties?.href, class: ["internal", "transclude-src"] },
                children: [
                  { type: "text", value: i18n(cfg.locale).components.transcludes.linkToOriginal },
                ],
              },
            ]
          }
        }
      }
    })

  // set componentData.tree to the edited html that has transclusions rendered
  componentData.tree = root

  const {
    head: Head,
    header,
    beforeBody,
    pageBody: Content,
    afterBody,
    left,
    right,
    footer: Footer,
  } = components
  const Header = HeaderConstructor()
  const Body = BodyConstructor()

  const LeftComponent = (
    <div class="left sidebar">
      {left.map((BodyComponent) => (
        <BodyComponent {...componentData} />
      ))}
    </div>
  )

  const RightComponent = (
    <div class="right sidebar">
      {right.map((BodyComponent) => (
        <BodyComponent {...componentData} />
      ))}
    </div>
  )

  // Build-time per-page graph data (transitions, flashcard questions, etc.)
  const pageGraphDataJson = getPageGraphData(slug)

  // Build-time pre-computed graph layout (avoids D3 simulation at runtime)
  const graphPositionsJson = computePageGraphLayout(componentData.allFiles, slug)

  const lang = componentData.fileData.frontmatter?.lang ?? cfg.locale?.split("-")[0] ?? "en"
  // Viewer's role drives the graph's per-role strength colouring (red↔blue).
  // Role pages carry it in the URL suffix; hub pages default to "top".
  const currentRole = (() => {
    const s = String(slug).toLowerCase()
    if (s.endsWith("/top")) return "top"
    if (s.endsWith("/bottom")) return "bottom"
    if (s.endsWith("/attacker")) return "attacker"
    if (s.endsWith("/defender")) return "defender"
    return "top"
  })()
  const doc = (
    <html lang={lang}>
      <Head {...componentData} />
      <body data-slug={slug} data-current-role={currentRole}>
        {pageGraphDataJson && (
          <script
            type="application/json"
            id="page-graph-data"
            dangerouslySetInnerHTML={{ __html: pageGraphDataJson }}
          />
        )}
        {graphPositionsJson && (
          <script
            type="application/json"
            id="graph-positions"
            dangerouslySetInnerHTML={{ __html: graphPositionsJson }}
          />
        )}
        <div id="background-graph" data-persist></div>
        <div id="graph-overlay" data-persist></div>
        <button id="panel-toggle" data-persist aria-label="Reveal graph">
          {/* Content mode: wide chevron up — "swipe/scroll up to reveal graph" */}
          <svg
            class="toggle-icon-up"
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="3 16 12 7 21 16"></polyline>
          </svg>
          {/* Graph mode: wide chevron down — "swipe/scroll down to bring back content" */}
          <svg
            class="toggle-icon-down"
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="3 8 12 17 21 8"></polyline>
          </svg>
        </button>
        <button id="fit-all-btn" data-persist aria-label="Fit entire graph in view">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="4 14 4 20 10 20"></polyline>
            <polyline points="20 10 20 4 14 4"></polyline>
            <line x1="14" y1="10" x2="21" y2="3"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
        </button>
        <button id="tree-toggle" data-persist aria-label="Toggle explorer">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 3h6l2 2h10v4"></path>
            <path d="M3 7v12h18v-8"></path>
            <line x1="9" y1="13" x2="17" y2="13"></line>
            <line x1="9" y1="17" x2="13" y2="17"></line>
          </svg>
        </button>
        {/* Search trigger + fullscreen modal — wrapped in .search so the
            existing search.scss styles apply (modal positioning, hidden state).
            Our custom.scss #search-button rule overrides the button's position
            to make it a top-level floating button at top-left. */}
        <div class="search" data-persist>
          <button
            class="search-button"
            id="search-button"
            aria-label={i18n(cfg.locale).components.search.title}
          >
            <p>{i18n(cfg.locale).components.search.title}</p>
            <svg role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 19.9 19.7">
              <title>Search</title>
              <g class="search-path" fill="none">
                <path stroke-linecap="square" d="M18.5 18.3l-5.4-5.4" />
                <circle cx="8" cy="8" r="7" />
              </g>
            </svg>
          </button>
          <div id="search-container">
            <div id="search-space">
              <input
                autocomplete="off"
                id="search-bar"
                name="search"
                type="text"
                aria-label={i18n(cfg.locale).components.search.searchBarPlaceholder}
                placeholder={i18n(cfg.locale).components.search.searchBarPlaceholder}
              />
              <div id="search-layout" data-preview="true"></div>
            </div>
          </div>
        </div>
        <div id="sidebar-overlay" data-persist>
          {LeftComponent}
        </div>
        {/* Top-row buttons hoisted out of `.page` so they don't slide with the
            content card's transform when entering graph mode. */}
        <div id="flashcards-header" class="flashcards-header" data-persist>
          <button
            type="button"
            class="flashcards-header-label"
            id="flashcards-header-label"
            aria-label="Open flashcard decks"
          >
            <span class="flashcards-header-icon" aria-hidden="true">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </span>
            <span class="flashcards-header-text">Flashcards</span>
            <span class="flashcards-header-badge" aria-hidden="true"></span>
          </button>
        </div>
        <div id="topbar-auth" data-persist aria-label="Account"></div>
        <button
          id="roll-session-btn"
          data-persist
          type="button"
          aria-label="Start a roll — simulate a journey through positions"
          title="Roll — start a session"
        >
          {/* Outline play triangle */}
          <svg
            class="roll-session-icon-play"
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <polygon points="6 4 20 12 6 20"></polygon>
          </svg>
          {/* Outline stop square (active session) */}
          <svg
            class="roll-session-icon-stop"
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="6" y="6" width="12" height="12" rx="1"></rect>
          </svg>
        </button>
        {slug === ("index" as FullSlug) && (
          <button
            id="home-roll-fab"
            class="roll-trigger"
            data-persist
            aria-label="Roll — find a random position"
          >
            <img src="/static/dice-icon.svg" alt="" class="home-roll-fab-icon" />
            <span class="home-roll-fab-label">Roll a position</span>
          </button>
        )}
        {slug === ("index" as FullSlug) ? (
          <div id="home-hero" class="home-hero">
            <h1 class="article-title homepage-title">
              BJJ Graph<span class="title-tld">.org</span>
            </h1>
            <p class="tagline">
              <span class="tagline-line tagline-line-1">BJJ game, mapped.</span>
              <span class="tagline-line tagline-line-2">Find a position, or try random roll.</span>
            </p>
          </div>
        ) : (
          <>
            <div id="scroll-runway" aria-hidden="true" role="presentation"></div>
            <div id="quartz-root" class="page">
              <Body {...componentData}>
                <div class="center">
                  <div class="page-header">
                    <Header {...componentData}>
                      {header.map((HeaderComponent) => (
                        <HeaderComponent {...componentData} />
                      ))}
                    </Header>
                    <div class="popover-hint">
                      {beforeBody.map((BodyComponent) => (
                        <BodyComponent {...componentData} />
                      ))}
                    </div>
                  </div>
                  <Content {...componentData} />
                  <hr />
                  <div class="page-footer">
                    {afterBody.map((BodyComponent) => (
                      <BodyComponent {...componentData} />
                    ))}
                  </div>
                </div>
                {RightComponent}
                <Footer {...componentData} />
              </Body>
            </div>
          </>
        )}
      </body>
      {pageResources.js
        .filter((resource) => resource.loadTime === "afterDOMReady")
        .map((res) => JSResourceToScriptElement(res))}
    </html>
  )

  return "<!DOCTYPE html>\n" + render(doc)
}
