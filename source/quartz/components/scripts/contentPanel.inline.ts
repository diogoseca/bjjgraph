// Content Panel — scroll-driven drawer mechanic.
// Body scrollY is the source of truth. A passive scroll listener writes
// --drawer-progress (0..1) to :root; CSS transforms paint the drawer. JS
// handles only: SPA scroll restoration, mode-latch toggling, keyboard shortcuts,
// the panel-toggle button, canvas overscroll-dismiss in graph mode, and BFCache
// recovery. No wheel handlers, no intent thresholds, no snap state machine.
//
// Layout contract:
// - <div id="scroll-runway" /> (100svh, above #quartz-root) gives the body
//   scrollable height that the drawer transform latches onto.
// - scrollY = 0           → graph mode (drawer slid down to a --graph-peek title peek)
// - scrollY = innerHeight → content mode (drawer docked at translateY(--content-peek))
// - in between            → continuous transitioning state

const CONTENT_PEEK_PX = 60

const MODE_GRAPH_ENTER = 0.97
const MODE_GRAPH_LEAVE = 0.94
const MODE_CONTENT_ENTER = 0.03
const MODE_CONTENT_LEAVE = 0.06

type Mode = "content" | "transitioning" | "graph"

function dockY(): number {
  return window.innerHeight
}

function getProgress(): number {
  // 1 = graph (top of page), 0 = content (drawer docked)
  return Math.min(1, Math.max(0, 1 - window.scrollY / dockY()))
}

// Disable native scroll-restoration once; we land users at the dock on every nav.
if (typeof history !== "undefined" && "scrollRestoration" in history) {
  history.scrollRestoration = "manual"
}

// Pre-paint initial drawer-progress so the first frame is in content mode and
// doesn't flash from translateY(0) before JS runs.
if (typeof document !== "undefined") {
  document.documentElement.style.setProperty("--drawer-progress", "0")
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  return el.isContentEditable
}

document.addEventListener("nav", () => {
  // Home page: ContentPanel hidden, skip all wiring.
  if (document.body.dataset.slug === "index") {
    document.body.removeAttribute("data-mode")
    document.body.classList.remove("graph-focused")
    document.documentElement.style.setProperty("--drawer-progress", "0")
    return
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const toggleBtn = document.getElementById("panel-toggle") as HTMLElement | null
  const canvas = document.getElementById("background-graph") as HTMLElement | null

  let currentMode: Mode = "content"
  let zoomOutRevealFired = false

  function setMode(next: Mode) {
    if (currentMode === next) return
    currentMode = next
    document.body.dataset.mode = next
    // Maintain `graph-focused` class as a backward-compat alias so existing CSS
    // and the backgroundGraph MutationObserver continue to work.
    if (next === "graph") {
      document.body.classList.add("graph-focused")
      if (!zoomOutRevealFired) {
        zoomOutRevealFired = true
        const reveal = (window as any).__zoomOutReveal
        if (typeof reveal === "function") reveal()
      }
    } else {
      document.body.classList.remove("graph-focused")
    }
    if (toggleBtn) {
      toggleBtn.setAttribute("aria-label", next === "graph" ? "Show content" : "Show graph")
      toggleBtn.setAttribute("aria-pressed", next === "graph" ? "true" : "false")
    }
  }

  function updateProgress() {
    const p = getProgress()
    document.documentElement.style.setProperty("--drawer-progress", String(p))
    // Mode latch with hysteresis (dead-band on both edges to prevent oscillation).
    // Commit to an end state whenever progress reaches an extreme, regardless of
    // the current mode — single-pass, so a lone settle event (e.g. `scrollend`
    // after a programmatic smooth/instant snap) latches all the way to graph or
    // content instead of stalling in "transitioning". The dead-band only governs
    // when an already-committed mode releases back to "transitioning".
    if (p >= MODE_GRAPH_ENTER) setMode("graph")
    else if (p <= MODE_CONTENT_ENTER) setMode("content")
    else if (currentMode === "graph" && p < MODE_GRAPH_LEAVE) setMode("transitioning")
    else if (currentMode === "content" && p > MODE_CONTENT_LEAVE) setMode("transitioning")
  }

  let rafPending = false
  function onScroll() {
    if (rafPending) return
    rafPending = true
    requestAnimationFrame(() => {
      rafPending = false
      updateProgress()
    })
  }

  // Initial state: land at dock (content mode visible) — unless this nav came
  // from a graph-node click, in which case stay docked at the bottom (graph
  // mode) so onNodeClick can animate the controlled drawer rise after the new
  // content morphs in. The new page's title shows in the bottom peek first.
  if ((window as any).__graphClickNav) {
    zoomOutRevealFired = true // suppress the 1200ms zoom-out reveal for this nav
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior })
    setMode("graph")
    updateProgress()
  } else {
    window.scrollTo({ top: dockY(), behavior: "instant" as ScrollBehavior })
    setMode("content")
    updateProgress()
  }

  // Snap helpers — JS-driven smooth scroll-to. The transform follows naturally.
  function snapToGraph() {
    window.scrollTo({
      top: 0,
      behavior: (reducedMotion ? "instant" : "smooth") as ScrollBehavior,
    })
  }
  function snapToContent() {
    window.scrollTo({
      top: dockY(),
      behavior: (reducedMotion ? "instant" : "smooth") as ScrollBehavior,
    })
  }
  ;(window as any).__snapToContent = snapToContent
  ;(window as any).__snapToGraph = snapToGraph

  // Scroll listener — coalesce per frame via rAF; never preventDefault.
  window.addEventListener("scroll", onScroll, { passive: true })
  // Settle guarantee: a programmatic smooth/instant snap (panel toggle, Ctrl+G,
  // graph-node click, title-bar resume) may not emit a scroll event exactly at
  // the resting progress, leaving the latch stuck mid-transition. `scrollend`
  // fires once after motion stops; re-running updateProgress there commits the
  // final mode. Harmless on browsers that fire it after manual scrolls too.
  window.addEventListener("scrollend", onScroll, { passive: true })

  // Keyboard shortcuts
  function onKeydown(e: KeyboardEvent) {
    if (isTypingTarget(e.target)) return
    if (e.key === "g" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault()
      currentMode === "graph" ? snapToContent() : snapToGraph()
      return
    }
    if (e.key === "Escape" && currentMode === "graph") {
      e.preventDefault()
      snapToContent()
    }
  }
  document.addEventListener("keydown", onKeydown)

  // Panel toggle button
  function onToggleClick() {
    currentMode === "graph" ? snapToContent() : snapToGraph()
  }
  toggleBtn?.addEventListener("click", onToggleClick)

  // Stripe click: tapping the peeking strip (anywhere except the chrome buttons)
  // toggles modes, same as the panel-toggle chevron.
  //  - content mode: the 60px graph peek above the drawer → expand to graph.
  //  - graph mode:   the title bar at the bottom (the only on-screen part of
  //                  #quartz-root, lifted above the drawer via the z4 rule in
  //                  custom.scss) → resume (snap back to content).
  const TOP_STRIPE_BTN_SELECTOR =
    "#tree-toggle, #search-button, #flashcards-header, #roll-session-btn, #panel-toggle, #topbar-auth, #graph-close-btn, #fit-all-btn"
  function onStripeClick(e: MouseEvent) {
    const target = e.target as HTMLElement | null
    if (!target) return
    if (target.closest(TOP_STRIPE_BTN_SELECTOR)) return
    if (currentMode === "content" && e.clientY < CONTENT_PEEK_PX) {
      snapToGraph()
    } else if (currentMode === "graph" && target.closest("#quartz-root")) {
      // Only the bottom title bar of #quartz-root is on screen in graph mode;
      // gating on it avoids hijacking graph clicks in the side gaps.
      snapToContent()
    }
  }
  document.addEventListener("click", onStripeClick)

  // Canvas overscroll-dismiss (iOS Maps pattern): while in graph mode at min
  // zoom, a wheel-down on the canvas exits to content. D3 doesn't process
  // wheel-down past min zoom (it clamps), so we intercept here and dismiss.
  function onCanvasWheel(e: WheelEvent) {
    if (currentMode !== "graph") return
    if (e.deltaY <= 30) return
    const atMin = (window as any).__isGraphAtMinZoom
    if (typeof atMin === "function" && atMin()) {
      e.preventDefault()
      snapToContent()
    }
  }
  canvas?.addEventListener("wheel", onCanvasWheel, { passive: false })

  // BFCache: if the browser restored a mid-runway scroll position, snap to dock.
  function onPageShow(e: PageTransitionEvent) {
    if (!e.persisted) return
    const sy = window.scrollY
    if (sy > 0 && sy < dockY()) {
      window.scrollTo({ top: dockY(), behavior: "instant" as ScrollBehavior })
    }
  }
  window.addEventListener("pageshow", onPageShow)

  window.addCleanup(() => {
    window.removeEventListener("scroll", onScroll)
    window.removeEventListener("scrollend", onScroll)
    document.removeEventListener("keydown", onKeydown)
    document.removeEventListener("click", onStripeClick)
    toggleBtn?.removeEventListener("click", onToggleClick)
    canvas?.removeEventListener("wheel", onCanvasWheel)
    window.removeEventListener("pageshow", onPageShow)
  })
})
