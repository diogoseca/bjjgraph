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

// --- Types ---
// `s` = precomputed per-role strength pair injected by scripts/enrich_graph_strength.py:
//   positions → [top, bottom]; transitions/submissions → [attacker, defender].
type GlobalNode = { id: string; x: number; y: number; t: string; tags: string[]; s?: number[] }
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
// The viewer's current role ("top"|"bottom"|"attacker"|"defender"), from
// <body data-current-role>. Drives which half of each node's strength pair
// colours it. Re-read on every SPA nav (highlightCurrentNode).
let currentRole = "top"

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

// --- Per-role strength colouring (plan §6.7): map strength ∈ [-1,+1] onto a
// red↔neutral↔blue ramp. Replaces category fill; type is now signalled by shape
// (drawNode). Nodes without a strength pair (tags, stale/merged) fall back to
// the category colour so the graph never shows an undrawn node. ---
function parseColor(c: string): [number, number, number] {
  const s = (c || "").trim()
  if (s.startsWith("#")) {
    let h = s.slice(1)
    if (h.length === 3)
      h = h
        .split("")
        .map((x) => x + x)
        .join("")
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  }
  const m = s.match(/[\d.]+/g)
  if (m && m.length >= 3) return [+m[0], +m[1], +m[2]]
  return [128, 128, 128]
}

function rampColor(strength: number, styles: Record<string, string>): string {
  const stops: Array<[number, string]> = [
    [-1, styles["--strengthMinus1"]],
    [-0.5, styles["--strengthMinusHalf"]],
    [0, styles["--strengthZero"]],
    [0.5, styles["--strengthPlusHalf"]],
    [1, styles["--strengthPlus1"]],
  ]
  const v = Math.max(-1, Math.min(1, strength))
  let lo = stops[0]
  let hi = stops[stops.length - 1]
  for (let i = 0; i < stops.length - 1; i++) {
    if (v >= stops[i][0] && v <= stops[i + 1][0]) {
      lo = stops[i]
      hi = stops[i + 1]
      break
    }
  }
  const span = hi[0] - lo[0] || 1
  const t = (v - lo[0]) / span
  const a = parseColor(lo[1])
  const b = parseColor(hi[1])
  const mix = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t)
  return `rgb(${mix(0)},${mix(1)},${mix(2)})`
}

function pickStrength(node: GlobalNode, role: string): number | null {
  if (!node.s || node.s.length < 2) return null
  return role === "bottom" || role === "defender" ? node.s[1] : node.s[0]
}

function nodeTypeOf(id: string): "position" | "transition" | "submission" | "other" {
  const l = id.toLowerCase()
  if (l.startsWith("positions/")) return "position"
  if (l.startsWith("transitions/")) return "transition"
  if (l.startsWith("submissions/")) return "submission"
  return "other"
}

function strengthColor(node: GlobalNode, role: string, styles: Record<string, string>): string {
  const s = pickStrength(node, role)
  return s === null ? getContentTypeColor(node.id, styles) : rampColor(s, styles)
}

// --- Draw a node: fill = per-role strength colour, shape/outline = type
// (plan §6.8). Submissions wear a white "game-over portal" outline; transitions
// are rounded rectangles ("verbs"); positions are plain circles ("states"). ---
function drawNode(
  gfx: Graphics,
  node: GlobalNode,
  role: string,
  styles: Record<string, string>,
): void {
  gfx.clear()
  const color = strengthColor(node, role, styles)
  switch (nodeTypeOf(node.id)) {
    case "submission":
      gfx.circle(0, 0, 3).fill({ color })
      gfx.circle(0, 0, 3).stroke({ width: 1.2, color: styles["--light"] || "#ffffff", alpha: 0.95 })
      break
    case "transition":
      gfx.roundRect(-3.4, -2.2, 6.8, 4.4, 1.3).fill({ color })
      break
    default:
      gfx.circle(0, 0, 3).fill({ color })
  }
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
    "--strengthMinus1",
    "--strengthMinusHalf",
    "--strengthZero",
    "--strengthPlusHalf",
    "--strengthPlus1",
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
        tweenGroup.add(new Tweened(node.gfx.scale).to({ x: 2.1, y: 2.1 }, duration))
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

// --- Animated settle: ease nodes from a click emphasis back toward rest,
// keeping the just-navigated node at its 1.8x highlight (no instant pop). ---
function settleEmphasis(keepId: string, duration: number) {
  tweens.get("emphasis")?.stop()
  const tweenGroup = new TweenGroup()
  for (const [id, node] of nodesMap) {
    const targetScale = id === keepId ? 1.8 : 1
    if (node.gfx.scale.x !== targetScale) {
      tweenGroup.add(new Tweened(node.gfx.scale).to({ x: targetScale, y: targetScale }, duration))
    }
    if (node.gfx.alpha !== 1) {
      tweenGroup.add(new Tweened<Graphics>(node.gfx).to({ alpha: 1 }, duration))
    }
  }

  // Current node label stays visible; the rest hide once the settle finishes.
  const keep = nodesMap.get(keepId)
  if (keep) keep.label.visible = true

  if (tweenGroup.getAll().length === 0) {
    for (const [id, node] of nodesMap) {
      if (id !== keepId) node.label.visible = false
    }
    return
  }

  tweenGroup.getAll().forEach((tw) => tw.start())
  tweens.set("emphasis", {
    update(time: number) {
      tweenGroup.update(time)
      if (tweenGroup.allStopped()) {
        for (const [id, node] of nodesMap) {
          if (id !== keepId) node.label.visible = false
        }
        tweens.delete("emphasis")
      }
    },
    stop() {
      tweenGroup.getAll().forEach((tw) => tw.stop())
      tweens.delete("emphasis")
    },
  })
  startAnimation()
}

// --- Controlled drawer rise after a graph-click nav. The drawer position is a
// CSS transform over --drawer-progress (scroll-driven), but tweening scrollY
// per-frame paints two frames late (via contentPanel's scroll→rAF chain) and
// stutters. Instead, set an <html data-drawer-rising> marker and let CSS
// transition .page's transform to its content value on the compositor — smooth,
// and immune to the main-thread graph render. On transitionend we reconcile
// scrollY + --drawer-progress to the content dock before clearing the marker, so
// the base var-driven rules resume seamlessly. ---
function riseToContent() {
  const de = document.documentElement
  const dockTo = () =>
    window.scrollTo({ top: window.innerHeight, behavior: "instant" as ScrollBehavior })

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    de.style.setProperty("--drawer-progress", "0")
    dockTo()
    return
  }

  const page = document.getElementById("quartz-root")
  de.dataset.drawerRising = "1" // CSS transitions .page transform + overlay opacity to content

  let done = false
  const finish = () => {
    if (done) return
    done = true
    // Reconcile the scroll-driven source of truth to content BEFORE clearing the
    // marker, so the base (var-driven) rules resume at the identical position.
    de.style.setProperty("--drawer-progress", "0")
    dockTo() // instant: window.scrollY becomes innerHeight synchronously
    delete de.dataset.drawerRising
    page?.removeEventListener("transitionend", onEnd)
  }
  const onEnd = (e: TransitionEvent) => {
    if (e.propertyName === "transform") finish()
  }
  page?.addEventListener("transitionend", onEnd)
  setTimeout(finish, 650) // safety fallback if transitionend doesn't fire
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

  // Viewer's role drives per-role strength colouring (re-read on nav below).
  currentRole = document.body.dataset.currentRole || "top"

  // Render all nodes
  for (const node of layoutData.nodes) {
    const gfx = new Graphics()
    drawNode(gfx, node, currentRole, styles)
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

  // Home: graph IS the hero — center via fit-all on first paint. Article pages
  // don't need this; they center via __zoomOutReveal() when the user enters
  // graph-focused mode.
  if (document.body.dataset.slug === "index") {
    fitAll(0)
  }

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
    for (const [, node] of nodesMap) {
      drawNode(node.gfx, node.data, currentRole, newStyles)
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
  // Re-entrancy guard: ignore extra clicks while a graph-click nav is in flight.
  if ((window as any).__graphClickNav) return

  const fullSlug = getFullSlug(window)
  const targ = resolveRelative(fullSlug, node.id as SimpleSlug)
  const url = new URL(targ, window.location.toString())

  // Warm the HTTP cache in parallel with the Van Wijk pan so spaNavigate's
  // fetch below hits cache (~10ms) instead of the network — the new content
  // morphs in immediately, with no stall before the drawer rise.
  fetch(url.toString(), { credentials: "same-origin" }).catch(() => {})

  const currentCam = getCameraState()
  const targetCam: [number, number, number] = [node.x, node.y, 400]

  // Parallel: Van Wijk camera fly-to + neighborhood emphasis
  await Promise.all([
    animateVanWijk(currentCam, targetCam, 800),
    emphasizeNeighborhood(node.id, 800),
  ])

  // Keep the WebGL graph live (no view transition): morph the new article into
  // the drawer while it stays docked at the bottom (the bottom title peek shows
  // the new page), then animate the drawer up with a controlled rise. The
  // __graphClickNav flag tells contentPanel's nav handler to stay in graph mode
  // and highlightCurrentNode to skip its own snap, so we own the single rise.
  const spa = (window as any).spaNavigate as
    | ((u: URL, isBack?: boolean) => Promise<void>)
    | undefined
  if (typeof spa !== "function") {
    window.location.href = url.toString()
    return
  }
  ;(window as any).__graphClickNav = true
  try {
    await spa(url, false)
  } finally {
    ;(window as any).__graphClickNav = false
  }
  riseToContent()
}

// --- Highlight current page's node + pan camera ---
// Zooms 10x into the current node so it shows in the peek strip above the content card.
function highlightCurrentNode(slug: string) {
  const graphClick = !!(window as any).__graphClickNav

  const simpleSlug = simplifySlug(slug as FullSlug).replace(/\/$/, "")
  const hubSlug = getHubSlug(simpleSlug)
  currentHighlight = hubSlug

  // Re-read the viewer's role on nav; recolour all nodes when it flips (e.g.
  // navigating /Mount/Top → /Mount/Bottom turns the Mount node blue → red).
  const role = document.body.dataset.currentRole || "top"
  if (role !== currentRole && stage && bgApp) {
    currentRole = role
    const styles = readCssVars()
    for (const [, node] of nodesMap) drawNode(node.gfx, node.data, currentRole, styles)
    bgApp.renderer.render(stage)
  }

  // Reset first-reveal flag on each navigation
  firstRevealDone = false
  userHasInteractedWithZoom = false

  if (graphClick) {
    // Graph-click nav: ease the click emphasis (clicked node 2.1x) down to the
    // 1.8x highlight and neighbors back to rest — no instant pop. onNodeClick
    // owns the camera framing (already panned) and the drawer rise, so skip the
    // re-pan and the snap here.
    settleEmphasis(hubSlug, 350)
    const settled = nodesMap.get(hubSlug)
    if (settled) settled.label.visible = true
    return
  }

  resetEmphasis()

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
