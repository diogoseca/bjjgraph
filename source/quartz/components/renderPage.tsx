import { render } from "preact-render-to-string"
import { QuartzComponent, QuartzComponentProps } from "./types"
import HeaderConstructor from "./Header"
import BodyConstructor from "./Body"
import { JSResourceToScriptElement, StaticResources } from "../util/resources"
import { clone, FullSlug, RelativeURL, joinSegments, normalizeHastElement } from "../util/path"
import { visit } from "unist-util-visit"
import { Root, Element, ElementContent } from "hast"
import { GlobalConfiguration } from "../cfg"
import { i18n } from "../i18n"
import { QuartzPluginData } from "../plugins/vfile"
import fs from "fs"
import path from "path"

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
    return JSON.stringify({
      type: "transition",
      name: data.name,
      endingPosition: data.endingPosition,
      endingPositionPath: data.endingPositionPath,
      knowledgeAssessment: data.knowledgeAssessment,
    })
  } else if (entry.section === "submissions") {
    return JSON.stringify({
      type: "submission",
      name: data.name,
      isTerminal: data.isTerminal,
      knowledgeAssessment: data.knowledgeAssessment,
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
      script: `window.__contentStats=${stats}`,
    })
  }

  // make a deep copy of the tree so we don't remove the transclusion references
  // for the file cached in contentMap in build.ts
  const root = clone(componentData.tree) as Root

  // process transcludes in componentData
  visit(root, "element", (node, _index, _parent) => {
    if (node.tagName === "blockquote") {
      const classNames = (node.properties?.className ?? []) as string[]
      if (classNames.includes("transclude")) {
        const inner = node.children[0] as Element
        const transcludeTarget = inner.properties["data-slug"] as FullSlug
        const page = componentData.allFiles.find((f) => f.slug === transcludeTarget)
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
                properties: { href: inner.properties?.href, class: ["internal", "transclude-src"] },
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
