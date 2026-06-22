// Tree drawer — togglable left sidebar (ChatGPT/Claude pattern).
// Auto-opens on desktop when entering graph mode; auto-closes on returning to content.
// On mobile, stays closed by default; user can explicitly open via tree button.
// No localStorage persistence — state is derived from current mode + user overrides.

const MOBILE_BREAKPOINT = 800
const isDesktop = () => window.innerWidth > MOBILE_BREAKPOINT

function setDrawerOpen(open: boolean): void {
  document.body.classList.toggle("drawer-open", open)
}

document.addEventListener("nav", () => {
  // Initial state: drawer closed on every page load (any breakpoint)
  setDrawerOpen(false)

  const treeBtn = document.getElementById("tree-toggle")

  function onTreeClick() {
    // Toggle (Claude-style): if drawer is open, close it; otherwise open.
    const isOpen = document.body.classList.contains("drawer-open")
    setDrawerOpen(!isOpen)
  }

  // data-persist makes buttons survive SPA navigations; avoid double-binding
  if (treeBtn && !(treeBtn as any).__treeBound) {
    treeBtn.addEventListener("click", onTreeClick)
    ;(treeBtn as any).__treeBound = true
  }

  // Backdrop click on mobile: tapping outside the drawer closes it
  function onBackdropClick(e: MouseEvent) {
    if (!document.body.classList.contains("drawer-open")) return
    if (isDesktop()) return // desktop: explicit close only (X button)
    const drawer = document.getElementById("sidebar-overlay")
    if (!drawer) return
    const target = e.target as Node
    if (
      !drawer.contains(target) &&
      target !== treeBtn &&
      !treeBtn?.contains(target)
    ) {
      setDrawerOpen(false)
    }
  }
  document.addEventListener("click", onBackdropClick)

  // Observe body class changes to auto-toggle the drawer on graph/content transitions.
  // - graph-focused added (entering graph mode):
  //     desktop → drawer auto-OPENS as a navigation aid
  //     mobile  → drawer stays closed (small screen, preserve graph real estate)
  // - graph-focused removed (returning to content mode):
  //     both → drawer auto-CLOSES (focus on reading)
  let wasGraphFocused = document.body.classList.contains("graph-focused")
  const observer = new MutationObserver(() => {
    const isGraphFocused = document.body.classList.contains("graph-focused")
    if (isGraphFocused === wasGraphFocused) return
    wasGraphFocused = isGraphFocused
    if (isGraphFocused) {
      if (isDesktop()) setDrawerOpen(true)
    } else {
      setDrawerOpen(false)
    }
  })
  observer.observe(document.body, { attributes: true, attributeFilter: ["class"] })

  window.addCleanup(() => {
    document.removeEventListener("click", onBackdropClick)
    observer.disconnect()
  })
})
