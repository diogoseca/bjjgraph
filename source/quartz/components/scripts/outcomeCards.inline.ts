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
      fromLink.innerHTML = `<span class="outcome-from-label">From </span><a href="${url}" class="outcome-from-position internal">${posName}${displayRole}</a>`
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

    card.innerHTML = `
      <div class="outcome-card-result ${outcome.result}">${resultLabel(outcome.result)}</div>
      <div class="outcome-card-target">${displayName}</div>
      <div class="outcome-card-probability">${outcome.probability}%</div>
      <div class="probability-bar">
        <div class="probability-fill" style="width: ${outcome.probability}%"></div>
      </div>
    `

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
