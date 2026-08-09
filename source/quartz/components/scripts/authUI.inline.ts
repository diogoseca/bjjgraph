// Auth boot — the page-side half of Supabase auth.
//
// This file looks almost empty, and that is the point. It has exactly two jobs, both
// load-bearing, and NEITHER of them renders anything:
//
//  1. IT MAKES THE AUTH SEAM EXIST. scripts/supabase.ts installs `window.__bjjAuth` at module
//     top-level, and the only reason that module is ever evaluated in the browser is the
//     static import below: this script is Component.AuthUI()'s afterDOMLoaded bundle, and
//     AuthUI is registered in sharedPageComponents.afterBody, so it runs on EVERY page before
//     any auth/config gate. The Neural app (a separate no-eval IIFE that cannot import TS
//     modules) reaches auth and cloud persistence exclusively through that façade — see
//     neural/src/app.src.jsx `_auth()`. Drop this import and cloud sync dies silently for
//     every signed-in user while every headless test still passes.
//
//  2. IT COMPLETES THE OAUTH REDIRECT-BACK. This is the only code on the site that does.
//     After a Google PKCE round-trip the URL carries ?code=, and the SDK exchanges it only
//     when a client exists (detectSessionInUrl). Neural's `_initAuth` calls
//     ensureClientInitialized() ONLY when isAuthenticated() is already true — and
//     isAuthenticated() is a synchronous localStorage read, so it is necessarily false
//     immediately after the redirect. Without the hasAuthRedirectParams() branch below,
//     Google sign-in never completes for real users, and no absence-test would ever notice.
//
// v1.80.0 deleted this file's UI half — the email/password modal (window.openAuthModal, whose
// only callers were the legacy flashcard + victory screens) and the top-bar avatar slot
// (renderTopBarAuth, which drew into #topbar-auth, a legacy chrome div that no longer exists).
// The Neural app ships its own sign-in modal and account menu over the same façade, so those
// were a second, hidden copy. The legacy localStorage sync (pullFromCloud/pushToCloud over
// bjj-srs-cards + bjj-settings) went with them; Neural syncs its own progress blob through
// pullNeural/pushNeural and registers its own onAuthChange listener.

import { isAuthenticated, ensureClientInitialized } from "./supabase"

/** True when the current URL looks like an OAuth/recovery redirect-back that the
 * Supabase SDK must process (PKCE ?code=, implicit #access_token=, or an error). */
function hasAuthRedirectParams(): boolean {
  const q = window.location.search + window.location.hash
  return /[?&#](code|access_token|error_description)=/.test(q)
}

document.addEventListener("nav", async () => {
  if (!window.__SUPABASE_URL) return

  // Eagerly create the client when there's a session to track or an OAuth redirect to
  // process, so detectSessionInUrl exchanges the code and the onAuthStateChange subscription
  // is live. Without this a Google redirect-back is never processed and sign-in silently
  // never completes.
  if (isAuthenticated() || hasAuthRedirectParams()) {
    await ensureClientInitialized()
  }
})
