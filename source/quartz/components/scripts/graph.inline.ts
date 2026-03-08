import type { ContentDetails } from "../../plugins/emitters/contentIndex"
import {
  SimulationNodeDatum,
  SimulationLinkDatum,
  Simulation,
  forceSimulation,
  forceManyBody,
  forceCenter,
  forceLink,
  forceCollide,
  zoomIdentity,
  select,
  drag,
  zoom,
} from "d3"
import { Text, Graphics, Application, Container, Circle } from "pixi.js"
import { Group as TweenGroup, Tween as Tweened } from "@tweenjs/tween.js"
import { registerEscapeHandler, removeAllChildren } from "./util"
import { FullSlug, SimpleSlug, getFullSlug, resolveRelative, simplifySlug } from "../../util/path"
import { D3Config } from "../Graph"

type GraphicsInfo = {
  color: string
  gfx: Graphics
  alpha: number
  active: boolean
}

type NodeData = {
  id: SimpleSlug
  text: string
  tags: string[]
} & SimulationNodeDatum

type SimpleLinkData = {
  source: SimpleSlug
  target: SimpleSlug
}

type LinkData = {
  source: NodeData
  target: NodeData
} & SimulationLinkDatum<NodeData>

type LinkRenderData = GraphicsInfo & {
  simulationData: LinkData
}

type NodeRenderData = GraphicsInfo & {
  simulationData: NodeData
  label: Text
}

const localStorageKey = "graph-visited"
function getVisited(): Set<SimpleSlug> {
  return new Set(JSON.parse(localStorage.getItem(localStorageKey) ?? "[]"))
}

function addToVisited(slug: SimpleSlug) {
  const visited = getVisited()
  visited.add(slug)
  localStorage.setItem(localStorageKey, JSON.stringify([...visited]))
}

// Graph performance mode from URL param or session storage
// "default" = fast settling, "legacy" = old slow settling
function getGraphMode(): "default" | "legacy" {
  const urlParams = new URLSearchParams(window.location.search)
  const urlMode = urlParams.get("graph")
  if (urlMode === "legacy") {
    sessionStorage.setItem("graphMode", "legacy")
    return "legacy"
  }
  // Clear legacy mode if explicitly set to default
  if (urlMode === "default") {
    sessionStorage.removeItem("graphMode")
  }
  return (sessionStorage.getItem("graphMode") as "legacy") || "default"
}

const isTouchDevice = "ontouchstart" in window

type TweenNode = {
  update: (time: number) => void
  stop: () => void
}

// Helper to get hub slug from Bottom/Top role pages (playing_as model)
function getHubSlug(nodeId: SimpleSlug): SimpleSlug {
  const lowerNodeId = nodeId.toLowerCase()
  if (lowerNodeId.endsWith("/bottom") || lowerNodeId.endsWith("/top")) {
    return nodeId.split("/").slice(0, -1).join("/") as SimpleSlug
  }
  return nodeId
}

async function renderGraph(container: string, fullSlug: FullSlug) {
  const slug = simplifySlug(fullSlug)
  const graph = document.getElementById(container)
  if (!graph) return
  removeAllChildren(graph)

  let {
    drag: enableDrag,
    zoom: enableZoom,
    depth,
    scale,
    repelForce,
    centerForce,
    linkDistance,
    fontSize,
    opacityScale,
    removeTags,
    showTags,
    focusOnHover,
  } = JSON.parse(graph.dataset["cfg"]!) as D3Config

  const data: Map<SimpleSlug, ContentDetails> = new Map(
    Object.entries<ContentDetails>(await fetchData).map(([k, v]) => [
      simplifySlug(k as FullSlug),
      v,
    ]),
  )
  const links: SimpleLinkData[] = []
  const tags: SimpleSlug[] = []
  const validLinks = new Set(data.keys())

  const tweens = new Map<string, TweenNode>()
  for (const [source, details] of data.entries()) {
    const outgoing = details.links ?? []

    for (const dest of outgoing) {
      if (validLinks.has(dest)) {
        links.push({ source: source, target: dest })
      }
    }

    if (showTags) {
      const localTags = details.tags
        .filter((tag) => !removeTags.includes(tag))
        .map((tag) => simplifySlug(("tags/" + tag) as FullSlug))

      tags.push(...localTags.filter((tag) => !tags.includes(tag)))

      for (const tag of localTags) {
        links.push({ source: source, target: tag })
      }
    }
  }

  const neighbourhood = new Set<SimpleSlug>()

  // Define the 6 main category hub pages
  const categoryHubs = new Set<SimpleSlug>([
    "positions" as SimpleSlug,
    "transitions" as SimpleSlug,
    "submissions" as SimpleSlug,
    "systems" as SimpleSlug,
    "principles" as SimpleSlug,
    "learning" as SimpleSlug,
  ])

  // Determine page type and apply appropriate graph logic
  // Strip trailing slash from slug to avoid double slashes when concatenating
  const slugClean = slug.replace(/\/$/, "")
  const slugLower = slugClean.toLowerCase()
  const isHomepage = slugClean === "index"
  const isCategoryHub = categoryHubs.has(slugLower as SimpleSlug)

  if (isHomepage) {
    // Homepage: Show only the 6 main category nodes
    categoryHubs.forEach((hub) => {
      // Find the actual slug (any case) that matches this hub
      for (const [nodeSlug] of data.entries()) {
        if (nodeSlug.toLowerCase() === hub) {
          neighbourhood.add(nodeSlug)
          break
        }
      }
    })
  } else if (isCategoryHub) {
    // Category hub page: Show only items within that category

    // Add the category hub page itself
    neighbourhood.add(slugClean as SimpleSlug)

    // Add all children in this category
    const categoryPrefix = slugLower + "/"
    let childCount = 0
    for (const [nodeSlug] of data.entries()) {
      const nodeLower = nodeSlug.toLowerCase()
      // Include items that start with category prefix, but exclude Bottom/Top variants
      if (
        nodeLower.startsWith(categoryPrefix) &&
        !nodeLower.endsWith("/bottom") &&
        !nodeLower.endsWith("/top")
      ) {
        neighbourhood.add(nodeSlug)
        childCount++
      }
    }
  } else {
    // All other pages: Show depth-1 connections, excluding category hubs
    const wl: (SimpleSlug | "__SENTINEL")[] = [slugClean as SimpleSlug, "__SENTINEL"]

    // For position hubs, aggregate links from Bottom and Top role pages
    const isPositionHub =
      slugLower.startsWith("positions/") &&
      !slugLower.endsWith("/bottom") &&
      !slugLower.endsWith("/top")

    if (isPositionHub) {
      const bottomSlugToFind = slugLower + "/bottom"
      const topSlugToFind = slugLower + "/top"

      // Find and collect role pages first (to avoid sentinel index shifting)
      const rolePagesToAdd: SimpleSlug[] = []
      for (const [nodeSlug] of data.entries()) {
        const nodeLower = nodeSlug.toLowerCase()
        if (nodeLower === bottomSlugToFind || nodeLower === topSlugToFind) {
          rolePagesToAdd.push(nodeSlug)
        }
      }

      // Insert all role pages at once before sentinel
      const sentinelIndex = wl.indexOf("__SENTINEL")
      wl.splice(sentinelIndex, 0, ...rolePagesToAdd)
    }

    if (depth >= 0) {
      while (depth >= 0 && wl.length > 0) {
        // compute neighbours
        const cur = wl.shift()!
        if (cur === "__SENTINEL") {
          depth--
          wl.push("__SENTINEL")
        } else {
          neighbourhood.add(cur)
          const outgoing = links.filter((l) => l.source === cur)
          const incoming = links.filter((l) => l.target === cur)
          wl.push(...outgoing.map((l) => l.target), ...incoming.map((l) => l.source))
        }
      }
    } else {
      validLinks.forEach((id) => neighbourhood.add(id))
      if (showTags) tags.forEach((tag) => neighbourhood.add(tag))
    }

    // Remove category hub pages from neighbourhood for regular pages
    categoryHubs.forEach((hub) => neighbourhood.delete(hub))
  }

  const nodes = [...neighbourhood]
    .filter((url) => {
      // Filter out Bottom/Top role pages (playing_as model) - show only hub pages
      const lowerUrl = url.toLowerCase()
      return !lowerUrl.endsWith("/bottom") && !lowerUrl.endsWith("/top")
    })
    .map((url) => {
      let text = url.startsWith("tags/") ? "#" + url.substring(5) : data.get(url)?.title

      // If no title found, extract from URL path
      if (!text) {
        // Get the last part of the path (the actual filename)
        const parts = url.split("/")
        text = parts[parts.length - 1] || url
      }

      // Strip everything after the first " | " for cleaner graph display
      if (text.includes(" | ")) {
        text = text.split(" | ")[0]
      }
      return {
        id: url,
        text,
        tags: data.get(url)?.tags ?? [],
      }
    })
  const graphData: { nodes: NodeData[]; links: LinkData[] } = {
    nodes,
    links: links
      .filter((l) => neighbourhood.has(l.source) && neighbourhood.has(l.target))
      .map((l) => {
        // Redirect Bottom/Top sources/targets to hub pages (playing_as model)
        const actualSource = getHubSlug(l.source)
        const actualTarget = getHubSlug(l.target)

        return {
          source: nodes.find((n) => n.id === actualSource),
          target: nodes.find((n) => n.id === actualTarget),
        }
      })
      .filter((l) => l.source && l.target && l.source !== l.target) as LinkData[], // Remove self-loops and invalid links
  }

  // Check for pre-computed graph positions (injected at build time)
  const positionsEl = document.getElementById("graph-positions")
  let precomputed: Record<string, { x: number; y: number }> | null = null
  if (positionsEl) {
    try {
      const parsed = JSON.parse(positionsEl.textContent!)
      precomputed = {}
      for (const n of parsed.nodes) {
        precomputed[n.id] = { x: n.x, y: n.y }
      }
    } catch {
      precomputed = null
    }
  }

  // If pre-computed positions exist, assign them to nodes and skip simulation
  let simulation: Simulation<NodeData, LinkData> | null = null
  if (precomputed) {
    for (const node of graphData.nodes) {
      const pos = precomputed[node.id]
      if (pos) {
        node.x = pos.x
        node.y = pos.y
      }
    }
  } else {
    // we virtualize the simulation and use pixi to actually render it
    // Performance mode: default = fast settling, legacy = old slow settling
    const graphMode = getGraphMode()
    const isLegacy = graphMode === "legacy"
    const effectiveAlphaDecay = isTouchDevice ? 0.1 : isLegacy ? 0.0228 : 0.05
    const effectiveVelocityDecay = isTouchDevice ? 0.5 : 0.4

    simulation = forceSimulation<NodeData>(graphData.nodes)
      .force(
        "charge",
        forceManyBody()
          .strength(-100 * repelForce)
          .distanceMax(200),
      )
      .force("center", forceCenter().strength(centerForce))
      .force("link", forceLink(graphData.links).distance(linkDistance))
      .force("collide", forceCollide<NodeData>((n) => nodeRadius(n)).iterations(1))
      .alphaDecay(effectiveAlphaDecay)
      .velocityDecay(effectiveVelocityDecay)
  }

  // Animation state tracking for stopping RAF when settled
  let animationRunning = false
  let graphAnimationFrameHandle: number | null = null

  function startAnimation() {
    if (!animationRunning) {
      animationRunning = true
      graphAnimationFrameHandle = requestAnimationFrame(animate)
    }
  }

  const width = graph.offsetWidth
  const height = Math.max(graph.offsetHeight, 250)

  // Skip rendering if container has zero dimensions (not laid out yet)
  if (width === 0 || height === 0) {
    return
  }

  // precompute style prop strings as pixi doesn't support css variables
  const cssVars = [
    "--secondary",
    "--tertiary",
    "--gray",
    "--light",
    "--lightgray",
    "--dark",
    "--darkgray",
    "--bodyFont",
    "--graphPosition",
    "--graphTransition",
    "--graphSubmission",
    "--graphPrinciple",
    "--graphSystem",
    "--graphTag",
  ] as const
  const computedStyleMap = cssVars.reduce(
    (acc, key) => {
      acc[key] = getComputedStyle(document.documentElement).getPropertyValue(key)
      return acc
    },
    {} as Record<(typeof cssVars)[number], string>,
  )

  // helper function to detect content type from node slug
  function getContentTypeColor(nodeId: SimpleSlug): string {
    const lowerNodeId = nodeId.toLowerCase()
    if (lowerNodeId.startsWith("positions/")) return computedStyleMap["--graphPosition"]
    if (lowerNodeId.startsWith("transitions/")) return computedStyleMap["--graphTransition"]
    if (lowerNodeId.startsWith("submissions/")) return computedStyleMap["--graphSubmission"]
    if (lowerNodeId.startsWith("principles/")) return computedStyleMap["--graphPrinciple"]
    if (lowerNodeId.startsWith("systems/")) return computedStyleMap["--graphSystem"]
    if (lowerNodeId.startsWith("tags/")) return computedStyleMap["--graphTag"]
    return computedStyleMap["--gray"]
  }

  // calculate color based on content type and state
  const color = (d: NodeData) => {
    const isCurrent = d.id === slug

    // Get base color for this content type
    const baseColor = getContentTypeColor(d.id)

    // For current page, return base color (will be highlighted by node styling)
    if (isCurrent) {
      return baseColor
    }

    // For visited pages, we'll handle dimming in the node styling
    // For now, return the base color
    return baseColor
  }

  function nodeRadius(d: NodeData) {
    const numLinks = graphData.links.filter(
      (l) => l.source.id === d.id || l.target.id === d.id,
    ).length
    return 2 + Math.sqrt(numLinks)
  }

  let hoveredNodeId: string | null = null
  let hoveredNeighbours: Set<string> = new Set()
  const linkRenderData: LinkRenderData[] = []
  const nodeRenderData: NodeRenderData[] = []
  function updateHoverInfo(newHoveredId: string | null) {
    hoveredNodeId = newHoveredId

    if (newHoveredId === null) {
      hoveredNeighbours = new Set()
      for (const n of nodeRenderData) {
        n.active = false
      }

      for (const l of linkRenderData) {
        l.active = false
      }
    } else {
      hoveredNeighbours = new Set()
      for (const l of linkRenderData) {
        const linkData = l.simulationData
        if (linkData.source.id === newHoveredId || linkData.target.id === newHoveredId) {
          hoveredNeighbours.add(linkData.source.id)
          hoveredNeighbours.add(linkData.target.id)
        }

        l.active = linkData.source.id === newHoveredId || linkData.target.id === newHoveredId
      }

      for (const n of nodeRenderData) {
        n.active = hoveredNeighbours.has(n.simulationData.id)
      }
    }
  }

  let dragStartTime = 0
  let dragging = false

  function renderLinks() {
    tweens.get("link")?.stop()
    const tweenGroup = new TweenGroup()

    for (const l of linkRenderData) {
      let alpha = 1

      // if we are hovering over a node, we want to highlight the immediate neighbours
      // with full alpha and the rest with default alpha
      if (hoveredNodeId) {
        alpha = l.active ? 1 : 0.2
      }

      l.color = l.active ? computedStyleMap["--gray"] : computedStyleMap["--lightgray"]
      tweenGroup.add(new Tweened<LinkRenderData>(l).to({ alpha }, 200))
    }

    tweenGroup.getAll().forEach((tw) => tw.start())
    tweens.set("link", {
      update(time: number) {
        tweenGroup.update(time)
        if (tweenGroup.getAll().length === 0) tweens.delete("link")
      },
      stop() {
        tweenGroup.getAll().forEach((tw) => tw.stop())
        tweens.delete("link")
      },
    })
  }

  function renderLabels() {
    tweens.get("label")?.stop()
    const tweenGroup = new TweenGroup()

    const defaultScale = 1 / scale
    const activeScale = defaultScale * 1.1
    for (const n of nodeRenderData) {
      const nodeId = n.simulationData.id

      if (hoveredNodeId === nodeId) {
        tweenGroup.add(
          new Tweened<Text>(n.label).to(
            {
              alpha: 1,
              scale: { x: activeScale, y: activeScale },
            },
            100,
          ),
        )
      } else {
        tweenGroup.add(
          new Tweened<Text>(n.label).to(
            {
              alpha: n.label.alpha,
              scale: { x: defaultScale, y: defaultScale },
            },
            100,
          ),
        )
      }
    }

    tweenGroup.getAll().forEach((tw) => tw.start())
    tweens.set("label", {
      update(time: number) {
        tweenGroup.update(time)
        if (tweenGroup.getAll().length === 0) tweens.delete("label")
      },
      stop() {
        tweenGroup.getAll().forEach((tw) => tw.stop())
        tweens.delete("label")
      },
    })
  }

  function renderNodes() {
    tweens.get("hover")?.stop()

    const tweenGroup = new TweenGroup()
    for (const n of nodeRenderData) {
      let alpha = 1

      // if we are hovering over a node, we want to highlight the immediate neighbours
      if (hoveredNodeId !== null && focusOnHover) {
        alpha = n.active ? 1 : 0.2
      }

      tweenGroup.add(new Tweened<Graphics>(n.gfx, tweenGroup).to({ alpha }, 200))
    }

    tweenGroup.getAll().forEach((tw) => tw.start())
    tweens.set("hover", {
      update(time: number) {
        tweenGroup.update(time)
        if (tweenGroup.getAll().length === 0) tweens.delete("hover")
      },
      stop() {
        tweenGroup.getAll().forEach((tw) => tw.stop())
        tweens.delete("hover")
      },
    })
  }

  function renderPixiFromD3() {
    renderNodes()
    renderLinks()
    renderLabels()
  }

  tweens.forEach((tween) => tween.stop())
  tweens.clear()

  const app = new Application()
  await app.init({
    width,
    height,
    antialias: true,
    autoStart: false,
    autoDensity: true,
    backgroundAlpha: 0,
    preference: "webgpu",
    resolution: window.devicePixelRatio,
    eventMode: "static",
  })
  graph.appendChild(app.canvas)

  const stage = app.stage
  stage.interactive = false

  const labelsContainer = new Container<Text>({ zIndex: 3 })
  const nodesContainer = new Container<Graphics>({ zIndex: 2 })
  const linkContainer = new Container<Graphics>({ zIndex: 1 })
  stage.addChild(nodesContainer, labelsContainer, linkContainer)

  for (const n of graphData.nodes) {
    const nodeId = n.id

    const label = new Text({
      interactive: false,
      eventMode: "none",
      text: n.text,
      alpha: 0,
      anchor: { x: 0.5, y: 1.2 },
      style: {
        fontSize: fontSize * 15,
        fill: computedStyleMap["--dark"],
        fontFamily: computedStyleMap["--bodyFont"],
      },
      resolution: window.devicePixelRatio * 4,
    })
    label.scale.set(1 / scale)

    let oldLabelOpacity = 0
    const isTagNode = nodeId.startsWith("tags/")
    const nodeColor = color(n)
    const gfx = new Graphics({
      interactive: true,
      label: nodeId,
      eventMode: "static",
      hitArea: new Circle(0, 0, nodeRadius(n)),
      cursor: "pointer",
    })
      .circle(0, 0, nodeRadius(n))
      .fill({ color: isTagNode ? computedStyleMap["--light"] : nodeColor })
      .stroke({ width: isTagNode ? 2 : 0, color: nodeColor })

    gfx
      .on("pointerover", (e) => {
        updateHoverInfo(e.target.label)
        oldLabelOpacity = label.alpha
        if (!dragging) {
          renderPixiFromD3()
          startAnimation() // Restart animation for tween updates
        }
      })
      .on("pointerleave", () => {
        updateHoverInfo(null)
        label.alpha = oldLabelOpacity
        if (!dragging) {
          renderPixiFromD3()
          startAnimation() // Restart animation for tween updates
        }
      })

    nodesContainer.addChild(gfx)
    labelsContainer.addChild(label)

    const nodeRenderDatum: NodeRenderData = {
      simulationData: n,
      gfx,
      label,
      color: color(n),
      alpha: 1,
      active: false,
    }

    nodeRenderData.push(nodeRenderDatum)
  }

  for (const l of graphData.links) {
    const gfx = new Graphics({ interactive: false, eventMode: "none" })
    linkContainer.addChild(gfx)

    const linkRenderDatum: LinkRenderData = {
      simulationData: l,
      gfx,
      color: computedStyleMap["--lightgray"],
      alpha: 1,
      active: false,
    }

    linkRenderData.push(linkRenderDatum)
  }

  let currentTransform = zoomIdentity
  if (enableDrag && !precomputed) {
    // Drag enabled only for live simulation (not pre-computed layouts)
    select<HTMLCanvasElement, NodeData | undefined>(app.canvas).call(
      drag<HTMLCanvasElement, NodeData | undefined>()
        .container(() => app.canvas)
        .subject(() => graphData.nodes.find((n) => n.id === hoveredNodeId))
        .on("start", function dragstarted(event) {
          if (!event.active) simulation!.alphaTarget(1).restart()
          startAnimation() // Restart animation loop when dragging
          event.subject.fx = event.subject.x
          event.subject.fy = event.subject.y
          event.subject.__initialDragPos = {
            x: event.subject.x,
            y: event.subject.y,
            fx: event.subject.fx,
            fy: event.subject.fy,
          }
          dragStartTime = Date.now()
          dragging = true
        })
        .on("drag", function dragged(event) {
          const initPos = event.subject.__initialDragPos
          event.subject.fx = initPos.x + (event.x - initPos.x) / currentTransform.k
          event.subject.fy = initPos.y + (event.y - initPos.y) / currentTransform.k
        })
        .on("end", function dragended(event) {
          if (!event.active) simulation!.alphaTarget(0)
          event.subject.fx = null
          event.subject.fy = null
          dragging = false

          // if the time between mousedown and mouseup is short, we consider it a click
          if (Date.now() - dragStartTime < 500) {
            const node = graphData.nodes.find((n) => n.id === event.subject.id) as NodeData
            const targ = resolveRelative(fullSlug, node.id)
            window.spaNavigate(new URL(targ, window.location.toString()))
          }
        }),
    )
  } else {
    for (const node of nodeRenderData) {
      node.gfx.on("click", () => {
        const targ = resolveRelative(fullSlug, node.simulationData.id)
        window.spaNavigate(new URL(targ, window.location.toString()))
      })
    }
  }

  if (enableZoom) {
    select<HTMLCanvasElement, NodeData>(app.canvas).call(
      zoom<HTMLCanvasElement, NodeData>()
        .extent([
          [0, 0],
          [width, height],
        ])
        .scaleExtent([0.25, 4])
        .on("zoom", ({ transform }) => {
          currentTransform = transform
          stage.scale.set(transform.k, transform.k)
          stage.position.set(transform.x, transform.y)

          // zoom adjusts opacity of labels too
          const scale = transform.k * opacityScale
          let scaleOpacity = Math.max((scale - 1) / 3.75, 0)
          const activeNodes = nodeRenderData.filter((n) => n.active).flatMap((n) => n.label)

          for (const label of labelsContainer.children) {
            if (!activeNodes.includes(label)) {
              label.alpha = scaleOpacity
            }
          }
        }),
    )
  }

  function animate(time: number) {
    const isActive = simulation ? simulation.alpha() > simulation.alphaMin() : false

    // Only update positions when simulation is active
    if (isActive) {
      for (const n of nodeRenderData) {
        const { x, y } = n.simulationData
        if (!x || !y) continue
        n.gfx.position.set(x + width / 2, y + height / 2)
        if (n.label) {
          n.label.position.set(x + width / 2, y + height / 2)
        }
      }

      for (const l of linkRenderData) {
        const linkData = l.simulationData
        l.gfx.clear()
        l.gfx.moveTo(linkData.source.x! + width / 2, linkData.source.y! + height / 2)
        l.gfx
          .lineTo(linkData.target.x! + width / 2, linkData.target.y! + height / 2)
          .stroke({ alpha: l.alpha, width: 1, color: l.color })
      }
    }

    tweens.forEach((t) => t.update(time))

    app.renderer.render(stage)

    // Continue animation only if simulation is active or tweens are running
    if (isActive || tweens.size > 0) {
      graphAnimationFrameHandle = requestAnimationFrame(animate)
    } else {
      animationRunning = false
      graphAnimationFrameHandle = null
    }
  }

  // For pre-computed layouts, set positions and draw once immediately
  if (precomputed) {
    for (const n of nodeRenderData) {
      const { x, y } = n.simulationData
      if (x == null || y == null) continue
      n.gfx.position.set(x + width / 2, y + height / 2)
      if (n.label) {
        n.label.position.set(x + width / 2, y + height / 2)
      }
    }
    for (const l of linkRenderData) {
      const linkData = l.simulationData
      l.gfx.clear()
      l.gfx.moveTo(linkData.source.x! + width / 2, linkData.source.y! + height / 2)
      l.gfx
        .lineTo(linkData.target.x! + width / 2, linkData.target.y! + height / 2)
        .stroke({ alpha: l.alpha, width: 1, color: l.color })
    }
    app.renderer.render(stage)
  }

  // Start the animation loop
  startAnimation()

  window.addCleanup(() => {
    if (graphAnimationFrameHandle !== null) {
      cancelAnimationFrame(graphAnimationFrameHandle)
    }
    if (simulation) simulation.stop()
    tweens.clear()
    app.destroy(true, { children: true, texture: true })
  })
}

document.addEventListener("nav", async (e: CustomEventMap["nav"]) => {
  const slug = e.detail.url
  addToVisited(simplifySlug(slug))
  await renderGraph("graph-container", slug)

  // Function to re-render the graph when the theme changes
  const handleThemeChange = () => {
    renderGraph("graph-container", slug)
  }

  // event listener for theme change
  document.addEventListener("themechange", handleThemeChange)

  // cleanup for the event listener
  window.addCleanup(() => {
    document.removeEventListener("themechange", handleThemeChange)
  })

  const container = document.getElementById("global-graph-outer")
  const sidebar = container?.closest(".sidebar") as HTMLElement

  function renderGlobalGraph() {
    const slug = getFullSlug(window)
    container?.classList.add("active")
    if (sidebar) {
      sidebar.style.zIndex = "1"
    }

    renderGraph("global-graph-container", slug)
    registerEscapeHandler(container, hideGlobalGraph)
  }

  function hideGlobalGraph() {
    container?.classList.remove("active")
    if (sidebar) {
      sidebar.style.zIndex = "unset"
    }
  }

  async function shortcutHandler(e: HTMLElementEventMap["keydown"]) {
    if (e.key === "g" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault()
      const globalGraphOpen = container?.classList.contains("active")
      globalGraphOpen ? hideGlobalGraph() : renderGlobalGraph()
    }
  }

  const containerIcon = document.getElementById("global-graph-icon")
  containerIcon?.addEventListener("click", renderGlobalGraph)
  window.addCleanup(() => containerIcon?.removeEventListener("click", renderGlobalGraph))

  document.addEventListener("keydown", shortcutHandler)
  window.addCleanup(() => document.removeEventListener("keydown", shortcutHandler))
})
