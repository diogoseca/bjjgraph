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
// Eliminates all runtime fetches of the 3.5MB graph.json

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

function ensureGlobalGraphData(allFiles: QuartzPluginData[]) {
  if (_allSimpleSlugs !== null) return

  _allSimpleSlugs = new Set<string>()
  for (const f of allFiles) {
    _allSimpleSlugs.add(simplifySlug((f.slug ?? "") as FullSlug))
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
  if (lower.endsWith("/bottom") || lower.endsWith("/top")) {
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
        !lower.endsWith("/top")
      ) {
        neighbourhood.add(nodeSlug)
      }
    }
  } else {
    // Depth-1 BFS
    const wl: (string | "__SENTINEL")[] = [simpleSlug, "__SENTINEL"]
    let depth = 1

    // For position hubs, also seed with role pages
    const isPositionHub =
      slugLower.startsWith("positions/") &&
      !slugLower.endsWith("/bottom") &&
      !slugLower.endsWith("/top")

    if (isPositionHub) {
      const bottomToFind = slugLower + "/bottom"
      const topToFind = slugLower + "/top"
      const rolePagesToAdd: string[] = []
      for (const nodeSlug of allSlugs) {
        const lower = nodeSlug.toLowerCase()
        if (lower === bottomToFind || lower === topToFind) {
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

  // Filter out Bottom/Top role pages from final nodes (mirrors client-side)
  const nodeIds: string[] = []
  for (const url of neighbourhood) {
    const lower = url.toLowerCase()
    if (!lower.endsWith("/bottom") && !lower.endsWith("/top")) {
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
    })),
  })

  _pageGraphPositionsCache[simpleSlug] = result
  return result
}

// Cached graph.json data and lookup index (read once at build time)
let _graphJson: any = null
// Maps lowercase slug (without section prefix) → { section, key }
let _slugIndex: Record<
  string,
  { section: "positions" | "transitions" | "submissions"; key: string }
> = {}

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

  return _graphJson
}

function getPageGraphData(slug: FullSlug): string | null {
  const graph = loadGraphData()
  if (!graph || Object.keys(graph).length === 0) return null

  // Strip section prefix and lowercase to match index
  // e.g. "Positions/Mount/Top" → "mount/top"
  // e.g. "Transitions/Hip-Bump-Sweep" → "hip-bump-sweep"
  const slugLower = slug.toLowerCase()
  let lookupKey: string | null = null

  if (slugLower.startsWith("positions/")) {
    lookupKey = slugLower.slice("positions/".length)
  } else if (slugLower.startsWith("transitions/")) {
    lookupKey = slugLower.slice("transitions/".length)
  } else if (slugLower.startsWith("submissions/")) {
    lookupKey = slugLower.slice("submissions/".length)
  }

  if (!lookupKey) return null

  // Detect attacker/defender role suffix and strip to find parent entry
  let role: "attacker" | "defender" | null = null
  if (lookupKey.endsWith("/attacker")) {
    role = "attacker"
    lookupKey = lookupKey.slice(0, -"/attacker".length)
  } else if (lookupKey.endsWith("/defender")) {
    role = "defender"
    lookupKey = lookupKey.slice(0, -"/defender".length)
  }

  const entry = _slugIndex[lookupKey]
  if (!entry) return null

  const data = graph[entry.section]?.[entry.key]
  if (!data) return null

  // Return only the fields each page type needs
  if (entry.section === "positions") {
    return JSON.stringify({
      type: "position",
      name: data.name,
      transitions: data.transitions,
      defenses: data.defenses,
      knowledgeAssessment: data.knowledgeAssessment || [],
    })
  } else if (entry.section === "transitions") {
    const ka =
      role === "defender"
        ? data.defenderKnowledgeAssessment || []
        : role === "attacker"
          ? data.knowledgeAssessment || []
          : [...(data.knowledgeAssessment || []), ...(data.defenderKnowledgeAssessment || [])]
    return JSON.stringify({
      type: "transition",
      name: data.name,
      endingPosition: data.endingPosition,
      endingPositionPath: data.endingPositionPath,
      knowledgeAssessment: ka,
    })
  } else if (entry.section === "submissions") {
    const ka =
      role === "defender"
        ? data.defenderKnowledgeAssessment || []
        : role === "attacker"
          ? data.knowledgeAssessment || []
          : [...(data.knowledgeAssessment || []), ...(data.defenderKnowledgeAssessment || [])]
    return JSON.stringify({
      type: "submission",
      name: data.name,
      isTerminal: data.isTerminal,
      knowledgeAssessment: ka,
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

  // Try to load gzipped version first (much smaller), fallback to uncompressed
  const contentIndexScript = `
    const fetchData = (async () => {
      try {
        // Try gzipped version first (saves ~70-80% bandwidth)
        const gzResponse = await fetch("${contentIndexGzPath}")
        if (gzResponse.ok) {
          const compressed = await gzResponse.arrayBuffer()
          // Use browser's native DecompressionStream API (supported in modern browsers)
          const ds = new DecompressionStream('gzip')
          const decompressedStream = new Response(compressed).body.pipeThrough(ds)
          const decompressed = await new Response(decompressedStream).text()
          return JSON.parse(decompressed)
        }
      } catch (e) {
        console.warn('Failed to load compressed content index, falling back to uncompressed:', e)
      }

      // Fallback to uncompressed version
      return fetch("${contentIndexPath}").then(data => data.json())
    })()`

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

  // Inject content stats on homepage (build-time counts of .json files per category)
  if (slug === ("index" as FullSlug)) {
    const stats = getContentStatsJson()
    pageResources.js.push({
      loadTime: "beforeDOMReady",
      contentType: "inline",
      spaPreserve: true,
      script: `window.__contentStats=${stats};document.addEventListener("nav",()=>{const s=window.__contentStats;if(!s)return;document.querySelectorAll("[data-stat]").forEach(el=>{const k=el.getAttribute("data-stat");if(k&&s[k]!=null)el.textContent=s[k]})})`,
    })
  }

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
  const doc = (
    <html lang={lang}>
      <Head {...componentData} />
      <body data-slug={slug}>
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
        <div id="quartz-root" class="page">
          <Body {...componentData}>
            {LeftComponent}
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
      </body>
      {pageResources.js
        .filter((resource) => resource.loadTime === "afterDOMReady")
        .map((res) => JSResourceToScriptElement(res))}
    </html>
  )

  return "<!DOCTYPE html>\n" + render(doc)
}
