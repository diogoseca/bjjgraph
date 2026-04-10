// Draggable sidebar resizer (VS Code-style)
// Updates --sidebar-width CSS custom property on #quartz-body

const STORAGE_KEY = "bjj-sidebar-width"
const MIN_WIDTH = 200
const DEFAULT_WIDTH = 320

function getMaxWidth(): number {
  return Math.floor(window.innerWidth * 0.5)
}

function clampWidth(w: number): number {
  return Math.max(MIN_WIDTH, Math.min(w, getMaxWidth()))
}

document.addEventListener("nav", () => {
  const body = document.getElementById("quartz-body")
  const resizer = document.querySelector<HTMLElement>(".sidebar-resizer")
  if (!body || !resizer) return

  // Restore saved width
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    const w = clampWidth(parseInt(saved, 10))
    body.style.setProperty("--sidebar-width", w + "px")
  }

  let dragging = false
  let startX = 0
  let startWidth = 0

  function getCurrentWidth(): number {
    const val = body!.style.getPropertyValue("--sidebar-width")
    return val ? parseInt(val, 10) : DEFAULT_WIDTH
  }

  function onPointerDown(e: PointerEvent) {
    e.preventDefault()
    dragging = true
    startX = e.clientX
    startWidth = getCurrentWidth()
    resizer!.classList.add("dragging")
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
    resizer!.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return
    const delta = e.clientX - startX
    const newWidth = clampWidth(startWidth + delta)
    body!.style.setProperty("--sidebar-width", newWidth + "px")
  }

  function onPointerUp(e: PointerEvent) {
    if (!dragging) return
    dragging = false
    resizer!.classList.remove("dragging")
    document.body.style.cursor = ""
    document.body.style.userSelect = ""
    resizer!.releasePointerCapture(e.pointerId)
    // Save final width
    const finalWidth = getCurrentWidth()
    localStorage.setItem(STORAGE_KEY, String(finalWidth))
  }

  function onDblClick() {
    body!.style.setProperty("--sidebar-width", DEFAULT_WIDTH + "px")
    localStorage.removeItem(STORAGE_KEY)
  }

  resizer.addEventListener("pointerdown", onPointerDown)
  resizer.addEventListener("pointermove", onPointerMove)
  resizer.addEventListener("pointerup", onPointerUp)
  resizer.addEventListener("pointercancel", onPointerUp)
  resizer.addEventListener("dblclick", onDblClick)

  window.addCleanup(() => {
    resizer.removeEventListener("pointerdown", onPointerDown)
    resizer.removeEventListener("pointermove", onPointerMove)
    resizer.removeEventListener("pointerup", onPointerUp)
    resizer.removeEventListener("pointercancel", onPointerUp)
    resizer.removeEventListener("dblclick", onDblClick)
  })
})
