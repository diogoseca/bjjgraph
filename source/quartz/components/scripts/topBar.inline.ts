// Homepage training summary bar — dynamically updated with SRS stats
import { getDueCards, loadSRSCards } from "./srs"
import { loadSettings, loadDailyProgress } from "./settings"
import { addExplored } from "./explored"

const contentPrefixes: Array<{ prefix: string; type: string }> = [
  { prefix: "/Positions/", type: "position" },
  { prefix: "/Transitions/", type: "transition" },
  { prefix: "/Submissions/", type: "submission" },
  { prefix: "/Principles/", type: "principle" },
  { prefix: "/Systems/", type: "system" },
]

document.addEventListener("nav", () => {
  // Auto-track content page visits as "explored"
  const path = window.location.pathname
  const match = contentPrefixes.find((p) => path.startsWith(p.prefix))
  if (match) {
    // Strip role suffixes for consistent tracking
    let slug = path.slice(1) // remove leading "/"
    const lower = slug.toLowerCase()
    if (
      lower.endsWith("/top") ||
      lower.endsWith("/bottom") ||
      lower.endsWith("/attacker") ||
      lower.endsWith("/defender")
    ) {
      slug = slug.split("/").slice(0, -1).join("/")
    }

    // Get display name from page title (strip site suffix)
    const rawTitle = document.querySelector("h1")?.textContent?.trim() || ""
    const name = rawTitle.split(" | ")[0] || slug.split("/").pop()?.replace(/-/g, " ") || slug
    addExplored(slug, name, match.type)
  }

  const summaryText = document.getElementById("training-summary-text")
  if (!summaryText) return

  const allCards = loadSRSCards()
  const due = getDueCards()

  if (allCards.length > 0) {
    const memorized = allCards.length - due.length
    const settings = loadSettings()
    const progress = loadDailyProgress()
    const totalDone = progress.learned + progress.reviewed
    summaryText.textContent = `${memorized} Memorized \u00B7 ${totalDone}/${settings.dailyGoal} Today`
  } else {
    summaryText.textContent = "Start Training"
  }
})
