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
  ensureClientInitialized,
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

function escapeHtml(str: string): string {
  const div = document.createElement("div")
  div.textContent = str
  return div.innerHTML
}

function getInitial(email?: string, name?: string): string {
  const src = name || email || "?"
  return src.charAt(0).toUpperCase()
}

function isSafeImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:" || parsed.protocol === "http:"
  } catch {
    return false
  }
}

// ── Top-bar Auth Slot (36×36 round, top-right of the top stripe) ───────────

let _topbarMenuOpen = false
let _topbarMenuCleanup: (() => void) | null = null

const PERSON_SVG = `<svg class="topbar-auth-silhouette" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`

function closeTopbarMenu() {
  const menu = document.getElementById("topbar-auth-menu")
  const trigger = document.getElementById("topbar-auth-trigger")
  _topbarMenuOpen = false
  menu?.setAttribute("hidden", "")
  trigger?.setAttribute("aria-expanded", "false")
}

function openTopbarMenu() {
  const menu = document.getElementById("topbar-auth-menu")
  const trigger = document.getElementById("topbar-auth-trigger")
  _topbarMenuOpen = true
  menu?.removeAttribute("hidden")
  trigger?.setAttribute("aria-expanded", "true")
}

function renderTopbarSignedOut(container: HTMLElement) {
  container.innerHTML = `
    <button type="button" class="topbar-auth-btn" id="topbar-auth-signin" aria-label="Sign in">
      ${PERSON_SVG}
      <span class="topbar-auth-dot" aria-hidden="true"></span>
    </button>
  `
  document
    .getElementById("topbar-auth-signin")
    ?.addEventListener("click", () => openModal("signin"))
}

async function renderTopBarAuth() {
  const container = document.getElementById("topbar-auth")
  if (!container) return

  _topbarMenuCleanup?.()
  _topbarMenuCleanup = null
  _topbarMenuOpen = false

  if (!isAuthenticated()) {
    renderTopbarSignedOut(container)
    return
  }

  const version = ++_renderVersion
  const { user } = await getSession()
  if (version !== _renderVersion) return
  if (!user) {
    renderTopbarSignedOut(container)
    return
  }

  const name = user.user_metadata?.full_name || user.user_metadata?.name || ""
  const email = user.email || ""
  const rawAvatarUrl = user.user_metadata?.avatar_url || ""
  const avatarUrl = rawAvatarUrl && isSafeImageUrl(rawAvatarUrl) ? rawAvatarUrl : ""
  const altText = escapeHtml(name || email || "User avatar")
  const avatarHtml = avatarUrl
    ? `<img class="topbar-auth-avatar" src="${escapeHtml(avatarUrl)}" alt="${altText}" referrerpolicy="no-referrer" id="topbar-auth-avatar-img" />`
    : `<div class="topbar-auth-avatar topbar-auth-avatar--initial">${escapeHtml(getInitial(email, name))}</div>`

  container.innerHTML = `
    <button type="button" class="topbar-auth-btn" id="topbar-auth-trigger" aria-haspopup="menu" aria-expanded="false" aria-label="Account menu">
      ${avatarHtml}
    </button>
    <div class="topbar-auth-menu" id="topbar-auth-menu" role="menu" hidden>
      <button role="menuitem" class="topbar-auth-menuitem" id="topbar-auth-signout">Sign out</button>
    </div>
  `

  const trigger = document.getElementById("topbar-auth-trigger")
  const menu = document.getElementById("topbar-auth-menu")

  trigger?.addEventListener("click", (e) => {
    e.stopPropagation()
    if (_topbarMenuOpen) closeTopbarMenu()
    else openTopbarMenu()
  })

  const avatarImg = document.getElementById("topbar-auth-avatar-img") as HTMLImageElement | null
  if (avatarImg) {
    avatarImg.onerror = () => {
      const fallback = document.createElement("div")
      fallback.className = "topbar-auth-avatar topbar-auth-avatar--initial"
      fallback.textContent = getInitial(email, name)
      avatarImg.replaceWith(fallback)
    }
  }

  document.getElementById("topbar-auth-signout")?.addEventListener("click", async () => {
    closeTopbarMenu()
    const { error } = await signOut()
    if (error) {
      showSnackbar({ message: `Sign out failed: ${error}`, type: "failure" })
      return
    }
    showSnackbar({ message: "Signed out", type: "info" })
    renderTopBarAuth()
  })

  const onDocClick = (e: MouseEvent) => {
    if (!_topbarMenuOpen) return
    const target = e.target as Node
    if (menu?.contains(target) || trigger?.contains(target)) return
    closeTopbarMenu()
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && _topbarMenuOpen) closeTopbarMenu()
  }
  document.addEventListener("click", onDocClick)
  document.addEventListener("keydown", onKey)
  _topbarMenuCleanup = () => {
    document.removeEventListener("click", onDocClick)
    document.removeEventListener("keydown", onKey)
  }
  ;(window as any).addCleanup?.(_topbarMenuCleanup)
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
        renderTopBarAuth()
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
        renderTopBarAuth()
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

/** True when the current URL looks like an OAuth/recovery redirect-back that the
 * Supabase SDK must process (PKCE ?code=, implicit #access_token=, or an error). */
function hasAuthRedirectParams(): boolean {
  const q = window.location.search + window.location.hash
  return /[?&#](code|access_token|error_description)=/.test(q)
}

document.addEventListener("nav", async () => {
  if (!window.__SUPABASE_URL) return

  // Eagerly create the client when there's a session to track or an OAuth
  // redirect to process, so detectSessionInUrl exchanges the code and the
  // onAuthStateChange subscription is live. Without this a Google redirect-back
  // is never processed and sign-in silently never completes.
  if (isAuthenticated() || hasAuthRedirectParams()) {
    await ensureClientInitialized()
  }

  await renderTopBarAuth()

  // Sync on load for authenticated users (pull runs once per session)
  if (isAuthenticated()) {
    await syncOnLoad()
    await renderTopBarAuth()
  }
})

// Listen for auth state changes (e.g. Google OAuth redirect return). On a fresh
// sign-in the PKCE code is exchanged asynchronously, so this is where the OAuth
// flow actually completes — pull cloud data and refresh the avatar.
onAuthChange(async (event) => {
  if (event === "SIGNED_IN") {
    await syncOnLoad()
    await renderTopBarAuth()
  } else if (event === "SIGNED_OUT") {
    await renderTopBarAuth()
  }
})
