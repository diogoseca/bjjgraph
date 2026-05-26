// Snackbar notification system
interface SnackbarOptions {
  type: "success" | "failure" | "info"
  message: string
  from?: string // Previous URL for undo
}

function showSnackbar(options: SnackbarOptions) {
  const container = document.getElementById("snackbar-container")
  if (!container) return

  const snackbar = document.createElement("div")
  snackbar.className = `snackbar ${options.type}`

  let html = `<span class="snackbar-message">${options.message}</span>`

  if (options.from) {
    html += `<button class="snackbar-undo" data-url="${options.from}">Undo</button>`
  }

  html += `<button class="snackbar-close">&times;</button>`

  snackbar.innerHTML = html

  // Event handlers
  const undoBtn = snackbar.querySelector(".snackbar-undo")
  if (undoBtn) {
    undoBtn.addEventListener("click", (e) => {
      const url = (e.target as HTMLElement).dataset.url
      if (url) {
        window.spaNavigate(new URL(url, window.location.toString()), false)
      }
    })
  }

  const closeBtn = snackbar.querySelector(".snackbar-close")
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      snackbar.remove()
    })
  }

  container.appendChild(snackbar)

  // Auto-dismiss after 5 seconds using transform transition (not animation replay)
  setTimeout(() => {
    snackbar.style.transition = "transform 0.3s ease-out, opacity 0.3s ease-out"
    snackbar.style.transform = "translateY(100%)"
    snackbar.style.opacity = "0"
    setTimeout(() => snackbar.remove(), 300)
  }, 5000)
}

// Expose globally for other scripts
;(window as any).showSnackbar = showSnackbar

// Check for pending snackbar from navigation, and clear lingering snackbars
document.addEventListener("nav", () => {
  // Remove any lingering snackbars from previous page
  const container = document.getElementById("snackbar-container")
  if (container) {
    while (container.firstChild) container.firstChild.remove()
  }

  // Then show pending snackbar
  const pending = sessionStorage.getItem("snackbar")
  if (pending) {
    sessionStorage.removeItem("snackbar")
    showSnackbar(JSON.parse(pending))
  }
})
