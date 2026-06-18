// Outcome Cards — interactive outcome navigation on Transition/Submission pages
import { removeAllChildren } from "./util"
import { appendToRollHistory, fetchExplorerTree } from "./explorerGraphExpand"

interface Outcome {
  to: string
  probability: number
  result: string
  toName?: string
  toPath?: string
}

interface TransitionPageData {
  type: "transition" | "submission"
  name: string
  startingPosition?: string
  startingPositionPath?: string
  startingPositionRole?: string
  outcomes?: Outcome[]
  endingPosition?: string
  endingPositionPath?: string
}

function getPageData(): TransitionPageData | null {
  const el = document.getElementById("page-graph-data")
  if (!el?.textContent) return null
  try {
    const data = JSON.parse(el.textContent)
    if (data.type === "transition" || data.type === "submission") return data
    return null
  } catch {
    return null
  }
}

function buildPositionUrl(toPath: string): string {
  if (toPath === "Game-Over" || toPath === "game-over") {
    return "/Game-Over"
  }
  // Submission outcomes already carry the "Submissions/" prefix from renderPage
  if (toPath.startsWith("Submissions/")) {
    return `/${toPath.replace(/\s+/g, "-")}`
  }
  // Quartz URLs use hyphens instead of spaces
  return `/Positions/${toPath.replace(/\s+/g, "-")}`
}

// Only accept leading-slash relative paths (no protocol, no javascript:, no "<").
function safeRelPath(p: string): string {
  return typeof p === "string" && /^\/[A-Za-z0-9/_%.-]*$/.test(p) ? p : "#"
}

function resultLabel(result: string): string {
  switch (result) {
    case "success":
      return "Success"
    case "failure":
      return "Failure"
    case "counter":
      return "Counter"
    default:
      return result
  }
}

document.addEventListener("nav", () => {
  const container = document.querySelector(".outcome-cards-container") as HTMLElement | null
  if (!container) return

  const data = getPageData()
  if (!data || !data.outcomes || data.outcomes.length === 0) {
    container.style.display = "none"
    return
  }

  container.style.display = "block"

  // Render "From: Position" link
  const fromLink = document.getElementById("outcome-from-link")
  if (fromLink) {
    removeAllChildren(fromLink)
    if (data.startingPositionPath) {
      const role = data.startingPositionRole
      const roleSuffix = role ? `/${role.charAt(0).toUpperCase() + role.slice(1)}` : ""
      const url = `/Positions/${data.startingPositionPath.replace(/\s+/g, "-")}${roleSuffix}`
      const displayRole = role ? ` (${role.charAt(0).toUpperCase() + role.slice(1)})` : ""
      // Derive display name from path
      const posName = data.startingPositionPath.split("/")[0]

      const label = document.createElement("span")
      label.className = "outcome-from-label"
      label.textContent = "From "
      const link = document.createElement("a")
      link.className = "outcome-from-position internal"
      link.setAttribute("href", safeRelPath(url))
      link.textContent = `${posName}${displayRole}`
      fromLink.appendChild(label)
      fromLink.appendChild(link)
    }
  }

  // Render outcome cards
  const cardsContainer = document.getElementById("outcome-cards")
  if (!cardsContainer) return
  removeAllChildren(cardsContainer)

  for (const outcome of data.outcomes) {
    const card = document.createElement("div")
    card.className = `outcome-card outcome-${outcome.result}`
    card.setAttribute("tabindex", "0")
    card.setAttribute("role", "button")

    const targetUrl = buildPositionUrl(outcome.toPath || outcome.to)
    const displayName = outcome.toName || outcome.to

    const resultEl = document.createElement("div")
    resultEl.className = `outcome-card-result ${outcome.result}`
    resultEl.textContent = resultLabel(outcome.result)

    const targetEl = document.createElement("div")
    targetEl.className = "outcome-card-target"
    targetEl.textContent = displayName

    const probEl = document.createElement("div")
    probEl.className = "outcome-card-probability"
    probEl.textContent = `${outcome.probability}%`

    const bar = document.createElement("div")
    bar.className = "probability-bar"
    const fill = document.createElement("div")
    fill.className = "probability-fill"
    fill.style.width = `${outcome.probability}%`
    bar.appendChild(fill)

    card.appendChild(resultEl)
    card.appendChild(targetEl)
    card.appendChild(probEl)
    card.appendChild(bar)

    const navigate = async () => {
      // Add to journey (localStorage)
      try {
        const journey = JSON.parse(localStorage.getItem("bjj-journey") || "[]")
        journey.push({
          slug: window.location.pathname,
          name: data.name,
          type: data.type,
          success: outcome.result === "success",
          action: "dice-roll",
        })
        localStorage.setItem("bjj-journey", JSON.stringify(journey))
      } catch {
        // ignore
      }

      try {
        const tree = await fetchExplorerTree()
        const toSlug = outcome.to.split("/")[0]
        const pos = tree.positions[toSlug]
        if (pos?.id) appendToRollHistory(pos.id)
      } catch {
        // network failure — skip roll history, continue navigation
      }

      // Set snackbar
      sessionStorage.setItem(
        "snackbar",
        JSON.stringify({
          type: outcome.result === "success" ? "success" : "info",
          message:
            outcome.result === "success"
              ? `${data.name} \u2192 ${displayName}`
              : outcome.result === "counter"
                ? `Countered! \u2192 ${displayName}`
                : `Back to ${displayName}`,
        }),
      )

      window.spaNavigate(new URL(targetUrl, window.location.toString()), false)
    }

    card.addEventListener("click", navigate)
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        navigate()
      }
    })

    cardsContainer.appendChild(card)
  }
})
