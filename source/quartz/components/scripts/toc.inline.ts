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

function setupToc() {
  // Prevent page scroll when scrolling TOC content
  const tocContent = document.getElementById("toc-content")
  if (tocContent) {
    const preventPageScroll = (e: WheelEvent) => {
      e.stopPropagation()
    }
    tocContent.addEventListener("wheel", preventPageScroll, { passive: true })
    window.addCleanup(() => tocContent.removeEventListener("wheel", preventPageScroll))
  }

  // Set up scroll-based section tracking with rAF coalescing
  lastBestId = null
  updateActiveSection()

  let rafId = 0
  const onScroll = () => {
    if (!rafId) {
      rafId = requestAnimationFrame(() => {
        rafId = 0
        updateActiveSection()
      })
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true })
  window.addCleanup(() => {
    window.removeEventListener("scroll", onScroll)
    cancelAnimationFrame(rafId)
  })
}

window.addEventListener("resize", setupToc)
document.addEventListener("nav", () => {
  setupToc()
})
