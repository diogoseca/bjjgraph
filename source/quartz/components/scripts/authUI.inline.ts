// Auth UI — sign-up prompt, auth modal, account section
import { registerEscapeHandler } from "./util"
import {
  signUp,
  signIn,
  signInWithGoogle,
  signOut,
  getSession,
  resetPassword,
  isAuthenticated,
  onAuthChange,
  syncOnLoad,
  getLastSyncTime,
} from "./supabase"

// ── State ──────────────────────────────────────────────────────────────────────

let _modalOpen = false
let _modalMode: "signin" | "signup" = "signup"
let _loading = false
let _renderVersion = 0 // Incremented on each render to discard stale async results

// ── Helpers ────────────────────────────────────────────────────────────────────

function showSnackbar(opts: { message: string; type: "success" | "failure" | "info" }) {
  ;(window as any).showSnackbar?.(opts)
}

function formatSyncTime(iso: string): string {
  if (!iso) return "Never"
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return "Just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(iso).toLocaleDateString()
}

function escapeHtml(str: string): string {
  const div = document.createElement("div")
  div.textContent = str
  return div.innerHTML
}

function getInitial(email?: string, name?: string): string {
  const src = name || email || "?"
  return src.charAt(0).toUpperCase()
}

function getProviderLabel(provider: string): string {
  const labels: Record<string, string> = { google: "Google", email: "Email", github: "GitHub" }
  return labels[provider] || provider.charAt(0).toUpperCase() + provider.slice(1)
}

function isSafeImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:" || parsed.protocol === "http:"
  } catch {
    return false
  }
}

function initialAvatarHtml(email: string, name: string): string {
  return `<div class="auth-profile-avatar auth-profile-avatar--initial">${escapeHtml(getInitial(email, name))}</div>`
}

// ── Auth Prompt / Profile Strip (above Today's Session) ─────────────────────

async function renderAuthPrompt() {
  const container = document.getElementById("training-auth-prompt")
  if (!container) return

  if (!isAuthenticated()) {
    container.style.display = ""
    container.innerHTML = `
      <div class="auth-prompt">
        <div class="auth-prompt-text">
          <strong>Save your progress across devices</strong>
          <span>Sign up to keep your training data safe.</span>
        </div>
        <div class="auth-prompt-actions">
          <button class="auth-prompt-btn auth-prompt-signup" id="auth-prompt-signup">Sign up</button>
          <button class="auth-prompt-btn auth-prompt-signin" id="auth-prompt-signin">Sign in</button>
        </div>
      </div>
    `
    document
      .getElementById("auth-prompt-signup")
      ?.addEventListener("click", () => openModal("signup"))
    document
      .getElementById("auth-prompt-signin")
      ?.addEventListener("click", () => openModal("signin"))
    return
  }

  // Authenticated — show profile strip
  const version = ++_renderVersion
  container.style.display = ""
  container.innerHTML = `<div class="auth-profile auth-profile--loading" role="status" aria-live="polite"><span class="auth-profile-loading">Loading...</span></div>`

  const { user } = await getSession()

  // Discard if a newer render started while we were waiting
  if (version !== _renderVersion) return

  if (!user) {
    // Session read failed — still show sign-out so user can recover
    container.innerHTML = `
      <div class="auth-profile">
        <div class="auth-profile-info">
          <span class="auth-profile-error">Could not load profile</span>
        </div>
        <button class="auth-profile-signout" id="auth-profile-signout">Sign out</button>
      </div>
    `
    attachSignOutHandler()
    return
  }

  renderProfileStrip(container, user)
}

function renderProfileStrip(
  container: HTMLElement,
  user: { email?: string; user_metadata?: Record<string, any>; app_metadata?: Record<string, any> },
) {
  const name = user.user_metadata?.full_name || user.user_metadata?.name || ""
  const email = user.email || ""
  const rawAvatarUrl = user.user_metadata?.avatar_url || ""
  const avatarUrl = rawAvatarUrl && isSafeImageUrl(rawAvatarUrl) ? rawAvatarUrl : ""
  const providers: string[] = user.app_metadata?.providers || []
  const syncTime = formatSyncTime(getLastSyncTime())

  const altText = escapeHtml(name || email || "User avatar")
  const avatarHtml = avatarUrl
    ? `<img class="auth-profile-avatar" src="${escapeHtml(avatarUrl)}" alt="${altText}" referrerpolicy="no-referrer" id="auth-profile-avatar-img" />`
    : initialAvatarHtml(email, name)

  const displayName = name ? escapeHtml(name) : ""
  const displayEmail = escapeHtml(email)

  const providerBadges = providers
    .map(
      (p: string) =>
        `<span class="auth-profile-provider">${escapeHtml(getProviderLabel(p))}</span>`,
    )
    .join("")

  container.innerHTML = `
    <div class="auth-profile">
      ${avatarHtml}
      <div class="auth-profile-info">
        <div class="auth-profile-identity">
          ${displayName ? `<span class="auth-profile-name">${displayName}</span>` : ""}
          <span class="auth-profile-email">${displayEmail || "Signed in"}</span>
        </div>
        <div class="auth-profile-meta">
          ${providerBadges ? `<span class="auth-profile-providers">${providerBadges}</span>` : ""}
          <span class="auth-profile-sync">Synced: ${syncTime}</span>
        </div>
      </div>
      <button class="auth-profile-signout" id="auth-profile-signout">Sign out</button>
    </div>
  `

  // Avatar onerror fallback — replace broken img with initial circle
  const avatarImg = document.getElementById("auth-profile-avatar-img") as HTMLImageElement | null
  if (avatarImg) {
    avatarImg.onerror = () => {
      const fallback = document.createElement("div")
      fallback.className = "auth-profile-avatar auth-profile-avatar--initial"
      fallback.textContent = getInitial(email, name)
      avatarImg.replaceWith(fallback)
    }
  }

  attachSignOutHandler()
}

function attachSignOutHandler() {
  document.getElementById("auth-profile-signout")?.addEventListener("click", async () => {
    const { error } = await signOut()
    if (error) {
      showSnackbar({ message: `Sign out failed: ${error}`, type: "failure" })
      return
    }
    showSnackbar({ message: "Signed out", type: "info" })
    renderAuthPrompt()
    renderAccountSection()
  })
}

// ── Account Section (inside Settings) ──────────────────────────────────────────

async function renderAccountSection() {
  const container = document.getElementById("training-account-info")
  if (!container) return

  if (!isAuthenticated()) {
    container.style.display = "none"
    container.innerHTML = ""
    return
  }

  const { user } = await getSession()
  if (!user) {
    container.style.display = "none"
    return
  }

  const syncTime = formatSyncTime(getLastSyncTime())
  container.style.display = ""
  container.innerHTML = `
    <div class="auth-account">
      <div class="auth-account-info">
        <span class="auth-account-email">${escapeHtml(user.email || "Signed in")}</span>
        <span class="auth-account-sync">Last synced: ${syncTime}</span>
      </div>
      <button class="auth-account-signout" id="auth-signout-btn">Sign out</button>
    </div>
  `

  document.getElementById("auth-signout-btn")?.addEventListener("click", async () => {
    const { error } = await signOut()
    if (error) {
      showSnackbar({ message: `Sign out failed: ${error}`, type: "failure" })
      return
    }
    showSnackbar({ message: "Signed out", type: "info" })
    renderAuthPrompt()
    renderAccountSection()
  })
}

// ── Auth Modal ─────────────────────────────────────────────────────────────────

function openModal(mode: "signin" | "signup") {
  if (_modalOpen) return
  _modalMode = mode
  _modalOpen = true
  renderModal()
}

// Expose globally so other scripts (flashcard, victory) can trigger auth
;(window as any).openAuthModal = openModal

function closeModal() {
  _modalOpen = false
  const overlay = document.getElementById("auth-overlay")
  if (overlay) overlay.remove()
}

function renderModal() {
  // Remove existing
  document.getElementById("auth-overlay")?.remove()

  const overlay = document.createElement("div")
  overlay.id = "auth-overlay"
  overlay.className = "auth-overlay"

  const isSignUp = _modalMode === "signup"

  overlay.innerHTML = `
    <div class="auth-panel">
      <button class="auth-close" id="auth-close">&times;</button>
      <h2 class="auth-title">${isSignUp ? "Create an Account" : "Sign In"}</h2>
      <form class="auth-form" id="auth-form">
        <div class="auth-field">
          <label for="auth-email">Email</label>
          <input type="email" id="auth-email" class="auth-input" placeholder="you@example.com" required autocomplete="email" />
        </div>
        <div class="auth-field">
          <label for="auth-password">Password</label>
          <input type="password" id="auth-password" class="auth-input" placeholder="${isSignUp ? "Create a password" : "Your password"}" required autocomplete="${isSignUp ? "new-password" : "current-password"}" minlength="6" />
        </div>
        <div class="auth-error" id="auth-error" style="display:none"></div>
        <button type="submit" class="auth-btn auth-btn-primary" id="auth-submit">
          ${isSignUp ? "Create Account" : "Sign In"}
        </button>
      </form>
      <div class="auth-divider"><span>or</span></div>
      <button class="auth-btn auth-btn-google" id="auth-google">
        Continue with Google
      </button>
      <div class="auth-footer">
        ${
          isSignUp
            ? `Already have an account? <button class="auth-link" id="auth-switch">Sign in</button>`
            : `Don't have an account? <button class="auth-link" id="auth-switch">Sign up</button>
               <br/><button class="auth-link" id="auth-forgot">Forgot password?</button>`
        }
      </div>
    </div>
  `

  document.body.appendChild(overlay)

  // Escape / click-outside to close
  registerEscapeHandler(overlay, closeModal)

  // Close button
  document.getElementById("auth-close")?.addEventListener("click", closeModal)

  // Switch mode
  document.getElementById("auth-switch")?.addEventListener("click", () => {
    _modalMode = _modalMode === "signup" ? "signin" : "signup"
    renderModal()
  })

  // Forgot password
  document.getElementById("auth-forgot")?.addEventListener("click", async () => {
    const emailInput = document.getElementById("auth-email") as HTMLInputElement
    const email = emailInput?.value?.trim()
    if (!email) {
      showError("Enter your email address first")
      return
    }
    const { error } = await resetPassword(email)
    if (error) {
      showError(error)
    } else {
      showSnackbar({ message: "Password reset email sent", type: "success" })
      closeModal()
    }
  })

  // Google sign-in
  document.getElementById("auth-google")?.addEventListener("click", async () => {
    if (_loading) return
    setLoading(true)
    const { error } = await signInWithGoogle()
    setLoading(false)
    if (error) showError(error)
    // Success: redirects to Google, then back
  })

  // Form submit
  document.getElementById("auth-form")?.addEventListener("submit", async (e) => {
    e.preventDefault()
    if (_loading) return

    const email = (document.getElementById("auth-email") as HTMLInputElement)?.value?.trim()
    const password = (document.getElementById("auth-password") as HTMLInputElement)?.value

    if (!email || !password) {
      showError("Please fill in all fields")
      return
    }

    setLoading(true)
    hideError()

    if (_modalMode === "signup") {
      const { user, error } = await signUp(email, password)
      setLoading(false)
      if (error) {
        showError(error)
        return
      }
      if (user) {
        showSnackbar({ message: "Account created! Your progress is now saved.", type: "success" })
        closeModal()
        renderAuthPrompt()
        renderAccountSection()
      } else {
        showSnackbar({ message: "Check your email to confirm your account", type: "info" })
        closeModal()
      }
    } else {
      const { user, error } = await signIn(email, password)
      setLoading(false)
      if (error) {
        showError(error)
        return
      }
      if (user) {
        showSnackbar({ message: "Signed in! Your progress is synced.", type: "success" })
        closeModal()
        renderAuthPrompt()
        renderAccountSection()
      }
    }
  })

  // Focus email field
  setTimeout(() => (document.getElementById("auth-email") as HTMLInputElement)?.focus(), 100)
}

function showError(msg: string) {
  const el = document.getElementById("auth-error")
  if (el) {
    el.textContent = msg
    el.style.display = ""
  }
}

function hideError() {
  const el = document.getElementById("auth-error")
  if (el) el.style.display = "none"
}

function setLoading(loading: boolean) {
  _loading = loading
  const btn = document.getElementById("auth-submit") as HTMLButtonElement
  const google = document.getElementById("auth-google") as HTMLButtonElement
  if (btn) {
    btn.disabled = loading
    btn.textContent = loading ? "..." : _modalMode === "signup" ? "Create Account" : "Sign In"
  }
  if (google) google.disabled = loading
}

// ── Init ───────────────────────────────────────────────────────────────────────

document.addEventListener("nav", async () => {
  // Only render on Training page
  const slug = document.body.dataset.slug
  if (slug?.toLowerCase() !== "training") return

  // Check if Supabase is configured
  if (!window.__SUPABASE_URL) return

  await Promise.all([renderAuthPrompt(), renderAccountSection()])

  // Sync on load for authenticated users
  if (isAuthenticated()) {
    await syncOnLoad()
    // Re-render to update sync time (renderVersion handles stale cancellation)
    await Promise.all([renderAuthPrompt(), renderAccountSection()])
  }
})

// Listen for auth state changes (e.g. Google OAuth redirect return)
onAuthChange(async (event, _user) => {
  if (event === "SIGNED_IN") {
    await Promise.all([renderAuthPrompt(), renderAccountSection()])
  }
})
