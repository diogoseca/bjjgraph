// Track section visibility with proportional opacity based on how much of the SECTION is visible
let lastBestId: string | null = null

function updateActiveSection() {
  const headers = Array.from(
    document.querySelectorAll("h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]"),
  ).filter((h) => (h as HTMLElement).offsetParent !== null)
  if (headers.length === 0) return

  const viewportHeight = window.innerHeight

  // --- BATCH ALL READS ---
  const rects: DOMRect[] = new Array(headers.length)
  for (let i = 0; i < headers.length; i++) {
    rects[i] = headers[i].getBoundingClientRect()
  }
  const articleBottom =
    document.querySelector("article")?.getBoundingClientRect().bottom ??
    document.body.getBoundingClientRect().bottom

  // --- COMPUTE (no DOM access) ---
  const minOpacity = 0.35
  const maxOpacity = 0.85
  let bestSlug: string | null = null
  let bestVisibility = 0
  const updates: Array<{ slug: string; opacity: string }> = []

  for (let i = 0; i < headers.length; i++) {
    const sectionTop = rects[i].top
    const sectionBottom = i + 1 < headers.length ? rects[i + 1].top : articleBottom
    const sectionHeight = sectionBottom - sectionTop

    const visibleTop = Math.max(sectionTop, 0)
    const visibleBottom = Math.min(sectionBottom, viewportHeight)
    const visibleHeight = Math.max(0, visibleBottom - visibleTop)
    const denominator = Math.min(sectionHeight, viewportHeight)
    const visibility = denominator > 0 ? visibleHeight / denominator : 0

    const opacity = minOpacity + visibility * (maxOpacity - minOpacity)
    const slug = headers[i].id

    updates.push({ slug, opacity: opacity.toFixed(2) })

    if (visibility > bestVisibility) {
      bestVisibility = visibility
      bestSlug = slug
    }
  }

  // Pre-read scroll target before any writes (avoids forced reflow)
  const tocContent = document.getElementById("toc-content")
  let targetScrollTop: number | null = null
  if (bestSlug && bestSlug !== lastBestId && tocContent) {
    const bestEntry = tocContent.querySelector(`a[data-for="${bestSlug}"]`)
    const li = (bestEntry as HTMLElement)?.parentElement
    if (li) {
      targetScrollTop =
        li.offsetTop - tocContent.offsetTop - tocContent.clientHeight / 2 + li.clientHeight / 2
    }
  }

  // --- BATCH ALL WRITES ---
  const tocEntries = document.querySelectorAll("#toc-content a[data-for]")
  tocEntries.forEach((entry) => {
    const slug = entry.getAttribute("data-for")
    const update = updates.find((u) => u.slug === slug)
    if (update) {
      ;(entry as HTMLElement).style.opacity = update.opacity
    }
  })

  // Auto-scroll TOC only when the active section changes
  if (bestSlug !== lastBestId && targetScrollTop !== null && tocContent) {
    lastBestId = bestSlug
    tocContent.scrollTop = targetScrollTop
  }
}

// Module-scope refs to the live inner listeners so repeated setupToc() calls
// (fired on every resize, e.g. mobile address-bar show/hide or rotate) tear down
// the previous run's listeners before re-adding, instead of stacking them.
let tocWheelTarget: HTMLElement | null = null
let tocWheelHandler: ((e: WheelEvent) => void) | null = null
let tocScrollHandler: ((e: Event) => void) | null = null
let tocRafId = 0

function teardownTocListeners() {
  if (tocWheelTarget && tocWheelHandler) {
    tocWheelTarget.removeEventListener("wheel", tocWheelHandler)
  }
  tocWheelTarget = null
  tocWheelHandler = null
  if (tocScrollHandler) {
    window.removeEventListener("scroll", tocScrollHandler)
  }
  tocScrollHandler = null
  cancelAnimationFrame(tocRafId)
  tocRafId = 0
}

function setupToc() {
  // Idempotent: remove any listeners from a prior setup before re-adding.
  teardownTocListeners()

  // Prevent page scroll when scrolling TOC content
  const tocContent = document.getElementById("toc-content")
  if (tocContent) {
    const preventPageScroll = (e: WheelEvent) => {
      e.stopPropagation()
    }
    tocContent.addEventListener("wheel", preventPageScroll, { passive: true })
    tocWheelTarget = tocContent
    tocWheelHandler = preventPageScroll
  }

  // Set up scroll-based section tracking with rAF coalescing
  lastBestId = null
  updateActiveSection()

  const onScroll = () => {
    if (!tocRafId) {
      tocRafId = requestAnimationFrame(() => {
        tocRafId = 0
        updateActiveSection()
      })
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true })
  tocScrollHandler = onScroll
}

window.addEventListener("resize", setupToc)
document.addEventListener("nav", () => {
  setupToc()
  // Drain the listeners added by this setup on the next SPA navigation. Registered
  // only here (not inside setupToc) so resize re-runs don't stack cleanup closures.
  window.addCleanup(teardownTocListeners)
})
