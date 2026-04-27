// Content Panel — JS-driven state machine for graph ↔ content toggle.
// Two states: content (normal view, graph peeks 60px above) ↔ graph (full graph, title peeks ~50px at bottom).
// Toggle via scroll-up at top, Ctrl+G, Escape, or button.

// Graph mode shows full graph but the page title always peeks at the bottom
const GRAPH_PEEK_PX = 50
// Content mode: card offset slightly so graph peeks above
const INITIAL_PEEK_PX = 60

type PanelState = "content" | "dragging" | "graph"
let state: PanelState = "content"
let dragProgress = 0 // 0 = content, 1 = graph

// Exposed for backgroundGraph.inline.ts via (window as any).__snapToContent / __snapToGraph

function getGraphProgress(): number {
  // Graph position as a fraction of viewport
  return (window.innerHeight - GRAPH_PEEK_PX) / window.innerHeight
}

document.addEventListener("nav", () => {
  state = "content"
  const initProg = INITIAL_PEEK_PX / window.innerHeight
  dragProgress = initProg

  const page = document.getElementById("quartz-root") as HTMLElement
  const overlay = document.getElementById("graph-overlay") as HTMLElement
  const toggleBtn = document.getElementById("panel-toggle") as HTMLElement
  if (!page || !overlay) return

  // Apply initial state: content card offset 60px so graph peeks above
  page.style.transition = "none"
  page.style.transform = `translateY(${INITIAL_PEEK_PX}px)`
  overlay.style.opacity = String(1 - initProg)
  document.body.classList.remove("graph-focused")
  requestAnimationFrame(() => {
    page.style.transition = "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
  })

  // --- Transform ---
  function applyTransform(progress: number) {
    page.style.transform = `translateY(${progress * 100}vh)`
    overlay.style.opacity = String(1 - progress)
    if (toggleBtn) {
      toggleBtn.setAttribute(
        "aria-label",
        progress > 0.5 ? "Show content" : "Show graph",
      )
    }
  }

  // --- Snap to graph (title always peeks at bottom) ---
  function snapToGraph() {
    const graphProg = getGraphProgress()
    state = "graph"
    dragProgress = graphProg
    page.style.transition = "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
    applyTransform(graphProg)
    document.body.classList.add("graph-focused")
    // Trigger first-reveal zoom-out animation (10x → fit-all)
    const reveal = (window as any).__zoomOutReveal
    if (reveal) reveal()
  }

  function snapToContent() {
    state = "content"
    const initProg = INITIAL_PEEK_PX / window.innerHeight
    dragProgress = initProg
    page.style.transition = "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
    // Return to initial offset (graph peeking above the card)
    page.style.transform = `translateY(${INITIAL_PEEK_PX}px)`
    overlay.style.opacity = String(1 - initProg)
    document.body.classList.remove("graph-focused")
  }

  // Expose globally
  ;(window as any).__snapToContent = snapToContent
  ;(window as any).__snapToGraph = snapToGraph

  // --- Wheel handler ---
  let wheelTimer: ReturnType<typeof setTimeout> | null = null

  function onWheel(e: WheelEvent) {
    if (state === "content" && window.scrollY <= 0 && e.deltaY < 0) {
      // Start dragging from content (scroll up at top)
      e.preventDefault()
      state = "dragging"
      page.style.transition = "none"
      dragProgress = Math.min(1, dragProgress + Math.abs(e.deltaY) / window.innerHeight)
      applyTransform(dragProgress)
    } else if (state === "dragging") {
      e.preventDefault()
      dragProgress += -e.deltaY / window.innerHeight
      dragProgress = Math.max(0, Math.min(1, dragProgress))
      applyTransform(dragProgress)
    } else if (state === "graph" && e.deltaY > 0) {
      // Scroll down from graph → return toward content
      e.preventDefault()
      state = "dragging"
      page.style.transition = "none"
      dragProgress = Math.max(0, dragProgress - e.deltaY / window.innerHeight)
      applyTransform(dragProgress)
    }

    if (state === "dragging") {
      if (wheelTimer) clearTimeout(wheelTimer)
      wheelTimer = setTimeout(onRelease, 150)
    }
  }

  // --- Touch handlers ---
  let touchStartY = 0
  let touchStartScrollY = 0

  function onTouchStart(e: TouchEvent) {
    touchStartY = e.touches[0].clientY
    touchStartScrollY = window.scrollY
  }

  function onTouchMove(e: TouchEvent) {
    const currentY = e.touches[0].clientY
    const deltaY = touchStartY - currentY // positive = finger moved up

    if (state === "content" && touchStartScrollY <= 0 && deltaY < 0) {
      e.preventDefault()
      state = "dragging"
      page.style.transition = "none"
      dragProgress = Math.min(1, Math.abs(deltaY) / window.innerHeight)
      applyTransform(dragProgress)
    } else if (state === "dragging") {
      e.preventDefault()
      const totalDelta = touchStartY - currentY
      if (touchStartScrollY <= 0) {
        dragProgress = Math.max(0, Math.min(1, -totalDelta / window.innerHeight))
      } else {
        dragProgress = Math.max(0, Math.min(1, totalDelta / window.innerHeight))
      }
      applyTransform(dragProgress)
    } else if (state === "graph" && deltaY > 0) {
      e.preventDefault()
      state = "dragging"
      page.style.transition = "none"
      dragProgress = Math.max(0, dragProgress - deltaY / window.innerHeight)
      applyTransform(dragProgress)
    }
  }

  function onTouchEnd() {
    onRelease()
  }

  // --- Snap decision (2 snap points: content + graph) ---
  function onRelease() {
    if (state !== "dragging") return
    // Low threshold (15%) to snap to graph — scroll gestures produce small deltas
    if (dragProgress > 0.15) {
      snapToGraph()
    } else {
      snapToContent()
    }
  }

  // --- Keyboard shortcuts ---
  function onKeydown(e: KeyboardEvent) {
    if (e.key === "g" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault()
      state === "graph" ? snapToContent() : snapToGraph()
    }
    if (e.key === "Escape" && state === "graph") {
      e.preventDefault()
      snapToContent()
    }
  }

  // --- Button click ---
  function onToggleClick() {
    state === "graph" ? snapToContent() : snapToGraph()
  }

  // --- Register events ---
  window.addEventListener("wheel", onWheel, { passive: false })
  window.addEventListener("touchstart", onTouchStart, { passive: true })
  window.addEventListener("touchmove", onTouchMove, { passive: false })
  window.addEventListener("touchend", onTouchEnd)
  document.addEventListener("keydown", onKeydown)
  toggleBtn?.addEventListener("click", onToggleClick)

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    overlay.style.backdropFilter = "none"
    ;(overlay.style as any).webkitBackdropFilter = "none"
  }

  window.addCleanup(() => {
    window.removeEventListener("wheel", onWheel)
    window.removeEventListener("touchstart", onTouchStart)
    window.removeEventListener("touchmove", onTouchMove)
    window.removeEventListener("touchend", onTouchEnd)
    document.removeEventListener("keydown", onKeydown)
    toggleBtn?.removeEventListener("click", onToggleClick)
    if (wheelTimer) clearTimeout(wheelTimer)
  })
})
