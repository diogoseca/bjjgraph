import { render } from "preact-render-to-string"
import { QuartzComponent, QuartzComponentProps } from "./types"
import HeaderConstructor from "./Header"
import BodyConstructor from "./Body"
import { JSResourceToScriptElement, StaticResources } from "../util/resources"
import { escapeScriptContent } from "../util/escape"
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

// === Build-time graph data injection ===
// Per-page slices are inlined here (page-graph-data, roll positions). Large blobs
// (contentIndex, graph.json, the Neural payloads) go through static emitters and are
// fetched lazily at runtime.

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

// NOTE: v1.80.0 removed the build-time per-page D3 force layout (computePageGraphLayout and
// its #graph-positions <script> emit). It pre-solved a force simulation for every page so the
// legacy sidebar graph could render without running D3 in the browser — 349,759,020 bytes
// across the site, 42.5% of every HTML byte emitted, for a single consumer
// (scripts/graph.inline.ts) that was display:none for 100% of real traffic and is now deleted.
// The Neural app draws its own graph from /static/neural/graph-data.json.
//
// The global (background) graph layout still lives in source/quartz/static/globalGraphLayout.json,
// computed by scripts/regenerate_graph_layout.py — it is an INPUT to
// scripts/regenerate_neural_data.py, not a page payload.

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

// Derive a position role's opponent moves at render time from the canonical role-split nodes
// (the opposite POSITION role's transitions, resolved through each technique's /attacker outcomes).
// This replaces the build-time `opponentTransitions` mirror that used to be baked onto graph.json.
// The in-browser game consumes the identical per-page slice, so behavior is preserved — except for
// family-hub submission targets (e.g. armbar/triangle-choke/far-side-armbar), which correctly resolve
// to game-over here instead of the stale mid-pipeline value the old synthesis captured.
function resolveOpponentMoves(graph: any, data: any, toUrlPath: (p: string) => string): any[] {
  const role = data.role
  if (role !== "top" && role !== "bottom") return []
  const hub = data.hub
  if (!hub) return []
  const oppositeRole = role === "top" ? "bottom" : "top"
  const opp = graph.positions?.[`${hub}/${oppositeRole}`]
  if (!opp || !Array.isArray(opp.transitions)) return []

  return opp.transitions.map((t: any) => {
    const m: any = {
      technique: t.technique || "",
      target: t.target || "",
      targetPath: t.targetPath || "",
      isSubmission: t.isSubmission || false,
      attemptProbability: t.attemptProbability ?? 0,
      successRate: t.successRate ?? 50,
    }
    const targetSlug = t.target || ""
    const attNode = graph.transitions?.[`${targetSlug}/attacker`]
    if (attNode) {
      const succ = (attNode.outcomes || []).find((o: any) => o.result === "success")
      if (succ) {
        const outcomeTo = succ.to || ""
        m.successOutcome = outcomeTo
        const outcomePos = outcomeTo ? outcomeTo.split("/")[0] : ""
        if (outcomePos) {
          if (!m.isSubmission) {
            const hubPos = graph.positions?.[outcomePos]
            m.successOutcomePath = hubPos?.path ? toUrlPath(hubPos.path) : outcomePos
          } else {
            m.successOutcomePath = ""
          }
        }
      }
    } else if (graph.submissions?.[targetSlug]) {
      m.successOutcome = "game-over"
      m.successOutcomePath = ""
    }
    // Mirror the old synthesis auto-fix: a success outcome of game-over implies a submission.
    if (m.successOutcome === "game-over" && !m.isSubmission) {
      m.isSubmission = true
    }
    return m
  })
}

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
      opponentTransitions: resolveOpponentMoves(graph, data, toUrlPath),
      flashcards: data.flashcards || [],
    })
  } else if (entry.section === "transitions" || entry.section === "submissions") {
    // Techniques are role-split: `data` (the bare key) is the edgeless hub. The outcomes / origin
    // live on the /attacker + /defender role-nodes. Resolve the right role-node (hub page → attacker
    // as the canonical perspective; family hubs have no role children → fall back to `data`).
    const sec: any = graph[entry.section] || {}
    const roleData =
      (role === "defender" ? sec[`${entry.key}/defender`] : sec[`${entry.key}/attacker`]) || data

    // Flashcards: role page → that role's deck; hub page → the hub's combined deck.
    let flashcards: Array<{ question: string; answer: string }> = []
    if (role === "attacker") {
      flashcards = (sec[`${entry.key}/attacker`] || {}).flashcards || data.attackerFlashcards || []
    } else if (role === "defender") {
      flashcards = (sec[`${entry.key}/defender`] || {}).flashcards || data.defenderFlashcards || []
    } else {
      flashcards = data.flashcards || []
    }

    // Resolve outcome slugs to display names and URL-safe paths (spaces → hyphens)
    const resolvedOutcomes = (roleData.outcomes || []).map((o: any) => {
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
      endingPosition: roleData.endingPosition,
      endingPositionPath: roleData.endingPositionPath,
      startingPosition: roleData.startingPosition || null,
      startingPositionPath: toUrlPath(roleData.startingPositionPath || ""),
      startingPositionRole: roleData.startingPositionRole || null,
      outcomes: resolvedOutcomes,
      flashcards,
    }

    if (entry.section === "submissions") {
      result.isTerminal = roleData.isTerminal ?? data.isTerminal
      if (data.isFamily) result.isFamily = true
    }

    return JSON.stringify(result)
  } else if (entry.section === "principles") {
    return JSON.stringify({
      type: "principle",
      name: data.name,
      flashcards: data.flashcards || [],
    })
  } else if (entry.section === "systems") {
    // Systems carry their resolved graph membership so the page can render the
    // "unlock this part of the graph" progress + mark-known checklist.
    return JSON.stringify({
      type: "system",
      name: data.name,
      flashcards: data.flashcards || [],
      members: (data.members || []).map((m: any) => ({
        slug: m.slug,
        path: m.path,
        type: m.type,
        name: m.name,
        relationship: m.relationship,
      })),
      productCount: (data.products || []).length,
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
    script: `window.__rollPositions=${escapeScriptContent(rollData)}`,
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
            dangerouslySetInnerHTML={{ __html: escapeScriptContent(pageGraphDataJson) }}
          />
        )}
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
        {/* Every page — including `/` — renders the article shell. The homepage used to
            branch to a bare #home-hero with no <article>, which left the site root with ~172
            characters of crawlable text; with the legacy chrome deleted that would have been an
            empty body on the most valuable route of a 4,600-URL site. The Neural app overlays
            this shell client-side (see scripts/variant.inline.ts), so humans still land in the
            app while crawlers and no-JS visitors get real prose. */}
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
      </body>
      {pageResources.js
        .filter((resource) => resource.loadTime === "afterDOMReady")
        .map((res) => JSResourceToScriptElement(res))}
    </html>
  )

  return "<!DOCTYPE html>\n" + render(doc)
}
