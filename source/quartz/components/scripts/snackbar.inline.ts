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

  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    snackbar.style.animation = "slideUp 0.3s ease-out reverse"
    setTimeout(() => snackbar.remove(), 300)
  }, 5000)
}

// Expose globally for other scripts
;(window as any).showSnackbar = showSnackbar

// Check for pending snackbar from navigation
document.addEventListener("nav", () => {
  const pending = sessionStorage.getItem("snackbar")
  if (pending) {
    sessionStorage.removeItem("snackbar")
    const data = JSON.parse(pending)
    showSnackbar(data)
  }
})
