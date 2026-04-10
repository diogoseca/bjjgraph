// Add-to-Training bookmark icon after content page titles
// Outline bookmark (gray) → click → counter up (green) → filled bookmark (green)
// Filled bookmark (green) → click → counter down (red) → outline bookmark (gray)

const SRS_KEY = "bjj-srs-cards"

const BOOKMARK_OUTLINE =
  '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 2h10v13l-5-3.5L3 15V2z"/></svg>'
const BOOKMARK_FILLED =
  '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor" stroke="none"><path d="M3 2h10v13l-5-3.5L3 15V2z"/></svg>'

interface PageData {
  type: string
  name: string
}

function getPageInfo(): { name: string; type: "transition" | "submission" } | null {
  const el = document.getElementById("page-graph-data")
  if (el?.textContent) {
    try {
      const data: PageData = JSON.parse(el.textContent)
      if (data.name) {
        const type = data.type === "submission" ? "submission" : "transition"
        return { name: data.name, type }
      }
    } catch {
      /* fall through */
    }
  }
  const h1 = document.querySelector("h1.article-title")
  if (!h1) return null
  const name = h1.childNodes[0]?.textContent?.trim()
  if (!name) return null
  const slug = document.body.dataset.slug || ""
  const type = slug.toLowerCase().startsWith("submissions/") ? "submission" : "transition"
  return { name, type }
}

function isAlreadyAdded(name: string): boolean {
  try {
    const cards = JSON.parse(localStorage.getItem(SRS_KEY) || "[]")
    return cards.some((c: { technique: string }) => c.technique === name)
  } catch {
    return false
  }
}

function getCardCount(): number {
  try {
    return JSON.parse(localStorage.getItem(SRS_KEY) || "[]").length
  } catch {
    return 0
  }
}

function addCardToSRS(name: string, type: "transition" | "submission", slug: string) {
  try {
    const cards = JSON.parse(localStorage.getItem(SRS_KEY) || "[]")
    if (cards.find((c: { technique: string }) => c.technique === name)) return
    const d = new Date().toISOString().slice(0, 10)
    cards.push({
      technique: name,
      type,
      slug,
      easeFactor: 2.5,
      interval: 1,
      nextReview: d,
      repetitions: 0,
      lastReview: d,
      history: [],
      questionsMastered: [],
    })
    localStorage.setItem(SRS_KEY, JSON.stringify(cards))
  } catch {
    /* ignore */
  }
}

function removeCardFromSRS(name: string) {
  try {
    const cards = JSON.parse(localStorage.getItem(SRS_KEY) || "[]")
    const filtered = cards.filter((c: { technique: string }) => c.technique !== name)
    localStorage.setItem(SRS_KEY, JSON.stringify(filtered))
  } catch {
    /* ignore */
  }
}

function removeAllChildren(el: HTMLElement) {
  while (el.firstChild) el.removeChild(el.firstChild)
}

document.addEventListener("nav", () => {
  const container = document.getElementById("title-add-training")
  if (!container) return

  removeAllChildren(container)

  const info = getPageInfo()
  if (!info) return

  let animTimeout: ReturnType<typeof setTimeout> | null = null
  let fadeTimeout: ReturnType<typeof setTimeout> | null = null

  function clearTimeouts() {
    if (animTimeout) {
      clearTimeout(animTimeout)
      animTimeout = null
    }
    if (fadeTimeout) {
      clearTimeout(fadeTimeout)
      fadeTimeout = null
    }
  }

  // Run counter animation: direction "up" (add, green) or "down" (remove, red)
  function runCounterAnimation(
    oldCount: number,
    newCount: number,
    direction: "up" | "down",
    onComplete: () => void,
  ) {
    removeAllChildren(container!)

    const counter = document.createElement("span")
    counter.className = "title-add-counter"
    if (direction === "down") counter.classList.add("counter-remove")

    const firstSpan = document.createElement("span")
    firstSpan.className = direction === "up" ? "count-old" : "count-new"
    firstSpan.textContent = String(oldCount)

    const secondSpan = document.createElement("span")
    secondSpan.className = direction === "up" ? "count-new" : "count-old"
    secondSpan.textContent = String(newCount)

    if (direction === "up") {
      counter.appendChild(firstSpan)
      counter.appendChild(secondSpan)
    } else {
      // For down: new (lower) number is below, we slide down to reveal it
      counter.appendChild(firstSpan)
      counter.appendChild(secondSpan)
    }

    container!.appendChild(counter)

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        counter.classList.add("animate")
      })
    })

    animTimeout = setTimeout(() => {
      counter.style.transition = "opacity 0.3s"
      counter.style.opacity = "0"
      fadeTimeout = setTimeout(onComplete, 300)
    }, 3000)
  }

  function renderOutline() {
    removeAllChildren(container!)
    const btn = document.createElement("button")
    btn.className = "title-add-btn"
    btn.innerHTML = BOOKMARK_OUTLINE
    btn.title = "Add to training"
    btn.addEventListener("click", handleAdd)
    container!.appendChild(btn)
  }

  function renderFilled() {
    removeAllChildren(container!)
    const btn = document.createElement("button")
    btn.className = "title-add-btn title-add-btn--added"
    btn.innerHTML = BOOKMARK_FILLED
    btn.title = "Remove from training"
    btn.addEventListener("click", handleRemove)
    container!.appendChild(btn)
  }

  function handleAdd() {
    clearTimeouts()
    const oldCount = getCardCount()
    addCardToSRS(info!.name, info!.type, window.location.pathname)
    runCounterAnimation(oldCount, oldCount + 1, "up", renderFilled)
  }

  function handleRemove() {
    clearTimeouts()
    const oldCount = getCardCount()
    removeCardFromSRS(info!.name)
    runCounterAnimation(oldCount, oldCount - 1, "down", renderOutline)
  }

  // Initial state
  if (isAlreadyAdded(info.name)) {
    renderFilled()
  } else {
    renderOutline()
  }

  window.addCleanup(() => {
    clearTimeouts()
  })
})
