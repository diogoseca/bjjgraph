// Background Graph — persistent PixiJS app that renders the full knowledge graph
// behind page content. Never destroyed, survives SPA navigations via data-persist.
// Uses viewport culling + LOD for performance with ~1,500+ nodes.

import { Text, Graphics, Application, Container } from "pixi.js"
import {
  select,
  zoom,
  zoomIdentity,
  interpolateZoom,
  type ZoomBehavior,
  type ZoomTransform,
} from "d3"
import { Group as TweenGroup, Tween as Tweened } from "@tweenjs/tween.js"
import { FullSlug, SimpleSlug, getFullSlug, resolveRelative, simplifySlug } from "../../util/path"
import { crossfadeNavigate } from "./trainingSession"

// --- Types ---
type GlobalNode = { id: string; x: number; y: number; t: string; tags: string[] }
type GlobalLink = { source: string; target: string }
type LayoutData = { nodes: GlobalNode[]; links: GlobalLink[] }
type NodeEntry = {
  gfx: Graphics
  label: Text
  data: GlobalNode
}

// --- Persistent module state (never destroyed) ---
let bgApp: Application | null = null
let layoutData: LayoutData | null = null
let nodesMap: Map<string, NodeEntry> = new Map()
let adjacency: Map<string, Set<string>> = new Map()
let linksGfx: Graphics | null = null
let stage: Container | null = null
let labelsContainer: Container | null = null
let currentHighlight: string | null = null
let currentTransform: ZoomTransform = zoomIdentity
let d3ZoomBehavior: ZoomBehavior<HTMLCanvasElement, unknown> | null = null

// Animation
let animationRunning = false
let animFrameHandle: number | null = null
// First-reveal: zoom-out animation only fires once per page load
let firstRevealDone = false
let userHasInteractedWithZoom = false
let tweens: Map<string, { update: (t: number) => void; stop: () => void }> = new Map()

// --- Helpers ---
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

function getContentTypeColor(nodeId: string, styles: Record<string, string>): string {
  const lower = nodeId.toLowerCase()
  if (lower.startsWith("positions/")) return styles["--graphPosition"]
  if (lower.startsWith("transitions/")) return styles["--graphTransition"]
  if (lower.startsWith("submissions/")) return styles["--graphSubmission"]
  if (lower.startsWith("principles/")) return styles["--graphPrinciple"]
  if (lower.startsWith("systems/")) return styles["--graphSystem"]
  if (lower.startsWith("tags/")) return styles["--graphTag"]
  return styles["--gray"]
}

function startAnimation() {
  if (!animationRunning && bgApp) {
    animationRunning = true
    animFrameHandle = requestAnimationFrame(animate)
  }
}

function animate(time: number) {
  if (!bgApp || !stage) return
  tweens.forEach((t) => t.update(time))
  bgApp.renderer.render(stage)
  if (tweens.size > 0) {
    animFrameHandle = requestAnimationFrame(animate)
  } else {
    animationRunning = false
    animFrameHandle = null
    // One final render
    bgApp.renderer.render(stage)
  }
}

// --- LOD: show/hide labels based on zoom level ---
function updateLOD(scale: number) {
  if (!labelsContainer) return
  const showLabels = scale > 0.5

  for (const [id, node] of nodesMap) {
    if (showLabels) {
      // Show labels for current node's neighborhood + nearby visible
      node.label.visible = id === currentHighlight || isNeighbor(currentHighlight, id)
    } else {
      node.label.visible = false
    }

    // Scale labels inversely to zoom so they stay readable
    if (node.label.visible) {
      const labelScale = Math.min(1.5, 1 / scale)
      node.label.scale.set(labelScale, labelScale)
    }
  }
}

function isNeighbor(a: string | null, b: string): boolean {
  if (!a) return false
  return adjacency.get(a)?.has(b) ?? false
}

function getNeighborIds(nodeId: string): Set<string> {
  return adjacency.get(nodeId) ?? new Set()
}

// --- CSS variables (PixiJS can't read them directly) ---
function readCssVars(): Record<string, string> {
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
  return cssVars.reduce(
    (acc, key) => {
      acc[key] = getComputedStyle(document.documentElement).getPropertyValue(key)
      return acc
    },
    {} as Record<string, string>,
  )
}

// --- Van Wijk smooth zoom (Google Earth fly-to) ---
function animateVanWijk(
  fromCam: [number, number, number],
  toCam: [number, number, number],
  duration: number,
): Promise<void> {
  return new Promise((resolve) => {
    const interp = interpolateZoom(fromCam, toCam)
    const start = performance.now()
    const w = bgApp!.canvas.width / (window.devicePixelRatio || 1)
    const h = bgApp!.canvas.height / (window.devicePixelRatio || 1)

    function frame(now: number) {
      const t = Math.min(1, (now - start) / duration)
      // Ease-in-out cubic for smoother feel
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      const [x, y, viewportWidth] = interp(eased)
      const scale = w / viewportWidth

      const tx = w / 2 - x * scale
      const ty = h / 2 - y * scale
      stage!.position.set(tx, ty)
      stage!.scale.set(scale, scale)
      currentTransform = zoomIdentity.translate(tx, ty).scale(scale)
      updateLOD(scale)

      // Sync CSS background grid with camera
      const bgEl = document.getElementById("background-graph")
      if (bgEl) {
        const gridSize = 60 * scale
        bgEl.style.backgroundSize = `${gridSize}px ${gridSize}px`
        bgEl.style.backgroundPosition = `${tx}px ${ty}px`
      }

      bgApp!.renderer.render(stage!)

      if (t < 1) {
        requestAnimationFrame(frame)
      } else {
        // Sync D3 zoom state
        if (d3ZoomBehavior && bgApp) {
          select(bgApp.canvas as HTMLCanvasElement).call(d3ZoomBehavior.transform, currentTransform)
        }
        resolve()
      }
    }
    requestAnimationFrame(frame)
  })
}

// --- Neighborhood emphasis (graphics scale/alpha, NOT position) ---
function emphasizeNeighborhood(centerId: string, duration: number): Promise<void> {
  return new Promise((resolve) => {
    tweens.get("emphasis")?.stop()
    const tweenGroup = new TweenGroup()
    const neighborIds = getNeighborIds(centerId)

    for (const [id, node] of nodesMap) {
      if (id === centerId) {
        tweenGroup.add(new Tweened(node.gfx.scale).to({ x: 2.5, y: 2.5 }, duration))
        tweenGroup.add(new Tweened<Graphics>(node.gfx).to({ alpha: 1 }, duration))
        node.label.visible = true
      } else if (neighborIds.has(id)) {
        tweenGroup.add(new Tweened(node.gfx.scale).to({ x: 1.8, y: 1.8 }, duration))
        tweenGroup.add(new Tweened<Graphics>(node.gfx).to({ alpha: 1 }, duration))
        node.label.visible = true
      } else {
        tweenGroup.add(new Tweened<Graphics>(node.gfx).to({ alpha: 0.08 }, duration))
      }
    }

    tweenGroup.getAll().forEach((tw) => tw.start())
    tweens.set("emphasis", {
      update(time: number) {
        tweenGroup.update(time)
        if (tweenGroup.allStopped()) {
          tweens.delete("emphasis")
          resolve()
        }
      },
      stop() {
        tweenGroup.getAll().forEach((tw) => tw.stop())
        tweens.delete("emphasis")
        resolve()
      },
    })
    startAnimation()

    // Safety timeout
    setTimeout(resolve, duration + 100)
  })
}

// --- Reset emphasis after navigation ---
function resetEmphasis() {
  tweens.get("emphasis")?.stop()
  for (const [_id, node] of nodesMap) {
    node.gfx.alpha = 1
    node.gfx.scale.set(1, 1)
    node.label.visible = false
  }
}

// --- Get camera state as [x, y, viewportWidth] ---
function getCameraState(): [number, number, number] {
  if (!bgApp || !stage) return [0, 0, 1000]
  const w = bgApp.canvas.width / (window.devicePixelRatio || 1)
  const scale = currentTransform.k || 1
  const cx = (w / 2 - (stage.position.x || 0)) / scale
  const cy =
    (bgApp.canvas.height / (window.devicePixelRatio || 1) / 2 - (stage.position.y || 0)) / scale
  return [cx, cy, w / scale]
}

// --- Calculate the padded bounding box of all graph nodes ---
// paddingFraction controls how much margin to add on each side (as a fraction
// of the raw width/height). Default 0.05 (5%) gives a tight fit-all view;
// callers wanting generous pan room pass a larger value (e.g., 0.5).
function calculateBounds(paddingFraction: number = 0.05): {
  minX: number
  maxX: number
  minY: number
  maxY: number
  cx: number
  cy: number
  graphW: number
  graphH: number
} | null {
  if (!layoutData) return null
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity
  for (const n of layoutData.nodes) {
    if (n.x < minX) minX = n.x
    if (n.x > maxX) maxX = n.x
    if (n.y < minY) minY = n.y
    if (n.y > maxY) maxY = n.y
  }
  const rawW = maxX - minX || 1
  const rawH = maxY - minY || 1
  const padX = rawW * paddingFraction
  const padY = rawH * paddingFraction
  return {
    minX: minX - padX,
    maxX: maxX + padX,
    minY: minY - padY,
    maxY: maxY + padY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    graphW: rawW + 2 * padX,
    graphH: rawH + 2 * padY,
  }
}

// --- Calculate zoom scale that fits the entire (padded) graph in the viewport ---
function calculateFitScale(): { scale: number; cx: number; cy: number } {
  if (!bgApp) return { scale: 1, cx: 0, cy: 0 }
  const bounds = calculateBounds()
  if (!bounds) return { scale: 1, cx: 0, cy: 0 }
  const w = bgApp.canvas.width / (window.devicePixelRatio || 1)
  const h = bgApp.canvas.height / (window.devicePixelRatio || 1)
  // Scale that exactly fits the padded bbox; this is also our minimum zoom-out
  const scale = Math.min(w / bounds.graphW, h / bounds.graphH)
  return { scale, cx: bounds.cx, cy: bounds.cy }
}

// --- First-reveal zoom-out: from 10x (tight on current node) to fit-all ---
function zoomOutReveal(): Promise<void> {
  if (firstRevealDone || userHasInteractedWithZoom || !bgApp || !stage) {
    return Promise.resolve()
  }
  firstRevealDone = true

  const fit = calculateFitScale()
  const currentCam = getCameraState()
  const w = bgApp.canvas.width / (window.devicePixelRatio || 1)
  // Target: entire graph fits in viewport
  const targetViewportWidth = w / fit.scale
  const targetCam: [number, number, number] = [fit.cx, fit.cy, targetViewportWidth]

  return animateVanWijk(currentCam, targetCam, 1200)
}

// --- Fit-all (sibling of zoomOutReveal, but no once-only guard) ---
// Animates the camera to the fit-all view. Used by the #fit-all-btn click handler.
function fitAll(durationMs = 800): Promise<void> {
  if (!bgApp || !stage) return Promise.resolve()
  const fit = calculateFitScale()
  const currentCam = getCameraState()
  const w = bgApp.canvas.width / (window.devicePixelRatio || 1)
  const targetViewportWidth = w / fit.scale
  const targetCam: [number, number, number] = [fit.cx, fit.cy, targetViewportWidth]
  return animateVanWijk(currentCam, targetCam, durationMs)
}

// --- Toggle #fit-all-btn visibility based on graph-mode + zoom level ---
function updateFitAllBtnVisibility() {
  const btn = document.getElementById("fit-all-btn")
  if (!btn) return
  const inGraphMode = document.body.classList.contains("graph-focused")
  // Show only when in graph mode AND user is zoomed past the fit-all level
  const shouldShow = inGraphMode && !isAtMinZoom()
  btn.classList.toggle("visible", shouldShow)
}

// --- Initialization (first nav event only) ---
async function initializeBackgroundGraph(container: HTMLElement, slug: string) {
  // Fetch global layout data
  try {
    const resp = await fetch(new URL("/static/globalGraphLayout.json", window.location.origin).href)
    if (!resp.ok) return
    layoutData = await resp.json()
  } catch {
    return // silently fail — no background graph
  }

  if (!layoutData || layoutData.nodes.length === 0) return

  // Build adjacency from links
  adjacency = new Map()
  for (const link of layoutData.links) {
    if (!adjacency.has(link.source)) adjacency.set(link.source, new Set())
    if (!adjacency.has(link.target)) adjacency.set(link.target, new Set())
    adjacency.get(link.source)!.add(link.target)
    adjacency.get(link.target)!.add(link.source)
  }

  // Create PixiJS app
  bgApp = new Application()
  await bgApp.init({
    backgroundAlpha: 0,
    resizeTo: container,
    preference: "webgpu",
    resolution: window.devicePixelRatio,
    antialias: true,
    autoDensity: true,
  })
  container.appendChild(bgApp.canvas)
  bgApp.canvas.style.touchAction = "manipulation"
  bgApp.canvas.style.position = "absolute"
  bgApp.canvas.style.top = "0"
  bgApp.canvas.style.left = "0"

  // Create containers with culling
  stage = new Container()
  const linkContainer = new Container()
  const nodesContainer = new Container()
  labelsContainer = new Container()

  nodesContainer.cullable = true
  nodesContainer.cullableChildren = true
  labelsContainer.cullable = true
  labelsContainer.cullableChildren = true

  stage.addChild(linkContainer, nodesContainer, labelsContainer)
  bgApp.stage.addChild(stage)

  // Start invisible — will fade in after all nodes/links are created
  stage.alpha = 0

  // Read CSS vars
  const styles = readCssVars()

  // Render all nodes
  for (const node of layoutData.nodes) {
    const nodeColor = getContentTypeColor(node.id, styles)
    const gfx = new Graphics()
    gfx.circle(0, 0, 3).fill({ color: nodeColor })
    gfx.position.set(node.x, node.y)
    gfx.eventMode = "static"
    gfx.cursor = "pointer"
    gfx.label = node.id

    const label = new Text({
      text: node.t,
      style: {
        fontFamily: styles["--bodyFont"] || "sans-serif",
        fontSize: 10,
        fill: styles["--dark"] || "#e0e0e0",
      },
    })
    label.anchor.set(0, 1.2)
    label.position.set(node.x, node.y)
    label.visible = false // LOD: hidden at overview zoom

    nodesContainer.addChild(gfx)
    labelsContainer.addChild(label)
    nodesMap.set(node.id, { gfx, label, data: node })

    // Hover
    gfx.on("pointerover", () => {
      label.visible = true
      label.alpha = 1
      gfx.scale.set(1.5, 1.5)
      bgApp!.renderer.render(stage!)
    })
    gfx.on("pointerleave", () => {
      label.visible = false
      gfx.scale.set(1, 1)
      bgApp!.renderer.render(stage!)
    })

    // Click → Spore animation → navigate
    gfx.on("pointerup", () => onNodeClick(node))
  }

  // Render all links as a single batched Graphics
  linksGfx = new Graphics({ interactive: false, eventMode: "none" })
  for (const link of layoutData.links) {
    const source = nodesMap.get(link.source)
    const target = nodesMap.get(link.target)
    if (!source || !target) continue
    linksGfx
      .moveTo(source.data.x, source.data.y)
      .lineTo(target.data.x, target.data.y)
      .stroke({ width: 0.5, color: styles["--lightgray"] || "#393639", alpha: 0.3 })
  }
  linkContainer.addChild(linksGfx)

  // D3 zoom/pan
  setupZoomPan()

  // Center on current node
  highlightCurrentNode(slug)

  // Fade in: stage alpha 0 → 1 over 4s. Completes instantly if user goes to graph mode.
  const fadeDuration = 4000
  const fadeStart = performance.now()
  function fadeIn(now: number) {
    if (!stage) return
    // If user triggered graph/peek mode, jump to fully visible
    if (document.body.classList.contains("graph-focused")) {
      stage.alpha = 1
      bgApp!.renderer.render(bgApp!.stage)
      return
    }
    const t = Math.min(1, (now - fadeStart) / fadeDuration)
    stage.alpha = t
    bgApp!.renderer.render(bgApp!.stage)
    if (t < 1) requestAnimationFrame(fadeIn)
  }
  requestAnimationFrame(fadeIn)

  // Expose zoom-out reveal for contentPanel to trigger on first scroll-up
  ;(window as any).__zoomOutReveal = zoomOutReveal
  // Expose for overscroll detection in contentPanel
  ;(window as any).__isGraphAtMinZoom = isAtMinZoom
  // Expose fit-all (also used by #fit-all-btn click handler below)
  ;(window as any).__fitAll = fitAll

  // Wire up fit-all button click + observe body class changes for visibility
  const fitBtn = document.getElementById("fit-all-btn")
  if (fitBtn) {
    fitBtn.addEventListener("click", () => fitAll(800))
  }
  // Observe body.graph-focused toggling so we update visibility when entering/leaving graph mode
  const bodyObserver = new MutationObserver(() => updateFitAllBtnVisibility())
  bodyObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["class"],
  })
  // Initial state
  updateFitAllBtnVisibility()

  // Theme change listener
  document.addEventListener("themechange", () => {
    const newStyles = readCssVars()
    for (const [id, node] of nodesMap) {
      const color = getContentTypeColor(id, newStyles)
      node.gfx.clear()
      node.gfx.circle(0, 0, 3).fill({ color })
    }
    bgApp!.renderer.render(stage!)
  })

  // Resize handler
  window.addEventListener("resize", () => {
    if (bgApp) bgApp.renderer.render(stage!)
  })
}

// --- Check if camera is at the minimum zoom-out (fit-all) within tolerance ---
function isAtMinZoom(): boolean {
  const fit = calculateFitScale()
  // 5% tolerance — wheel events can produce sub-pixel rounding
  return currentTransform.k <= fit.scale * 1.05
}

// --- D3 zoom/pan attached to canvas ---
function setupZoomPan() {
  if (!bgApp || !stage) return

  const bgContainer = document.getElementById("background-graph")

  // Fit-all uses tight bounds (5% margins, default) — graph fills viewport neatly.
  // Pan extent uses generous bounds (50% margins) — user can drag well beyond the graph.
  const fit = calculateFitScale() // uses default 0.05 padding internally
  const panBounds = calculateBounds(0.5)
  const minScale = fit.scale // can't zoom out further than fit-all
  const maxScale = 6 // user can zoom in 6x past fit-all

  d3ZoomBehavior = zoom<HTMLCanvasElement, unknown>()
    .scaleExtent([minScale, maxScale])
    .translateExtent(
      panBounds
        ? [
            [panBounds.minX, panBounds.minY],
            [panBounds.maxX, panBounds.maxY],
          ]
        : [
            [-Infinity, -Infinity],
            [Infinity, Infinity],
          ],
    )
    .on("zoom", ({ transform, sourceEvent }) => {
      // Mark user interaction to skip the first-reveal zoom-out animation
      if (sourceEvent) userHasInteractedWithZoom = true
      currentTransform = transform
      stage!.position.set(transform.x, transform.y)
      stage!.scale.set(transform.k, transform.k)
      updateLOD(transform.k)
      bgApp!.renderer.render(stage!)

      // Sync CSS background grid with zoom/pan
      if (bgContainer) {
        const gridSize = 60 * transform.k
        bgContainer.style.backgroundSize = `${gridSize}px ${gridSize}px`
        bgContainer.style.backgroundPosition = `${transform.x}px ${transform.y}px`
      }

      // Show/hide fit-all button based on whether we're zoomed past fit-all
      updateFitAllBtnVisibility()
    })

  select(bgApp.canvas as HTMLCanvasElement).call(d3ZoomBehavior)
}

// --- Spore-style node click ---
async function onNodeClick(node: GlobalNode) {
  // Only respond if in graph-focused mode
  if (!document.body.classList.contains("graph-focused")) return

  const fullSlug = getFullSlug(window)
  const targ = resolveRelative(fullSlug, node.id as SimpleSlug)
  const url = new URL(targ, window.location.toString())

  // Warm the HTTP cache in parallel with the Van Wijk pan so that when
  // crossfadeNavigate fires below, spaNavigate's internal fetch hits cache
  // (~10ms) instead of waiting on the network. Without this, the view
  // transition stalls between snapshot and animation while the fetch
  // resolves, producing a visible pause before the drawer slides up.
  fetch(url.toString(), { credentials: "same-origin" }).catch(() => {})

  const currentCam = getCameraState()
  const targetCam: [number, number, number] = [node.x, node.y, 400]

  // Parallel: Van Wijk camera fly-to + neighborhood emphasis
  await Promise.all([
    animateVanWijk(currentCam, targetCam, 800),
    emphasizeNeighborhood(node.id, 800),
  ])

  // crossfadeNavigate wraps spaNavigate in document.startViewTransition so
  // the .page drawer auto-interpolates its translateY (graph-mode bottom-peek
  // → content-mode top) and cross-fades the article body to the new page in
  // one smooth gesture.
  crossfadeNavigate(url)
}

// --- Highlight current page's node + pan camera ---
// Zooms 10x into the current node so it shows in the peek strip above the content card.
function highlightCurrentNode(slug: string) {
  resetEmphasis()

  const simpleSlug = simplifySlug(slug as FullSlug).replace(/\/$/, "")
  const hubSlug = getHubSlug(simpleSlug)
  currentHighlight = hubSlug

  // Reset first-reveal flag on each navigation
  firstRevealDone = false
  userHasInteractedWithZoom = false

  const current = nodesMap.get(hubSlug)
  if (current) {
    current.gfx.scale.set(1.8, 1.8)
    current.label.visible = true

    // Zoom 10x into current node: viewportWidth = fitViewport / 10
    // This gives a tight focus showing the node and its immediate neighbors
    const fit = calculateFitScale()
    const w = bgApp!.canvas.width / (window.devicePixelRatio || 1)
    const fitViewportWidth = w / fit.scale
    const zoomedViewportWidth = fitViewportWidth / 10 // 10x zoom

    const currentCam = getCameraState()
    const targetCam: [number, number, number] = [
      current.data.x,
      current.data.y,
      zoomedViewportWidth,
    ]
    animateVanWijk(currentCam, targetCam, 400)
  }

  // Snap back to content mode (after navigation from graph click)
  const snapToContent = (window as any).__snapToContent
  if (snapToContent) snapToContent()
}

// --- Nav event handler ---
document.addEventListener("nav", async (e: CustomEventMap["nav"]) => {
  const slug = e.detail.url as string
  const container = document.getElementById("background-graph")
  if (!container) return

  if (!bgApp) {
    await initializeBackgroundGraph(container, slug)
  } else {
    // Micromorph replaces the #background-graph div on each navigation,
    // orphaning our canvas. Re-attach it to the new container if needed.
    if (bgApp.canvas.parentElement !== container) {
      container.appendChild(bgApp.canvas)
      bgApp.renderer.render(bgApp.stage)
    }
    // Re-attach the fit-all button click handler (button is replaced on each nav)
    const fitBtn = document.getElementById("fit-all-btn")
    if (fitBtn && !(fitBtn as any).__fitAllBound) {
      fitBtn.addEventListener("click", () => fitAll(800))
      ;(fitBtn as any).__fitAllBound = true
    }
    updateFitAllBtnVisibility()
    highlightCurrentNode(slug)
  }
})
