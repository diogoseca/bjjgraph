// Supabase Auth + Cloud Sync — shared utility module
// Lazy-loads Supabase SDK from CDN, syncs localStorage training data to cloud

import { SRSCard, loadSRSCards, saveSRSCards } from "./srs"
import {
  BJJSettings,
  DailyProgress,
  StreakData,
  loadSettings,
  saveSettings,
  loadDailyProgress,
  saveDailyProgress,
  loadStreak,
  DEFAULT_SETTINGS,
} from "./settings"

// ── Types ──────────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    __SUPABASE_URL?: string
    __SUPABASE_ANON_KEY?: string
    supabase?: {
      createClient: (url: string, key: string, options?: SupabaseClientOptions) => SupabaseClient
    }
  }
}

interface SupabaseClientOptions {
  auth?: {
    flowType?: "pkce" | "implicit"
    autoRefreshToken?: boolean
    persistSession?: boolean
    detectSessionInUrl?: boolean
    storageKey?: string
  }
}

interface SupabaseClient {
  auth: {
    signUp: (opts: { email: string; password: string }) => Promise<AuthResult>
    signInWithPassword: (opts: { email: string; password: string }) => Promise<AuthResult>
    signInWithOAuth: (opts: {
      provider: string
      options?: { redirectTo?: string }
    }) => Promise<{ error: AuthError | null }>
    signOut: () => Promise<{ error: AuthError | null }>
    getUser: () => Promise<{ data: { user: AuthUser | null }; error: AuthError | null }>
    getSession: () => Promise<{ data: { session: AuthSession | null }; error: AuthError | null }>
    onAuthStateChange: (cb: (event: string, session: AuthSession | null) => void) => {
      data: { subscription: { unsubscribe: () => void } }
    }
    resetPasswordForEmail: (
      email: string,
      opts?: { redirectTo?: string },
    ) => Promise<{ error: AuthError | null }>
  }
  from: (table: string) => SupabaseQuery
}

interface SupabaseQuery {
  select: (columns?: string) => SupabaseQuery
  insert: (data: Record<string, unknown> | Record<string, unknown>[]) => SupabaseQuery
  upsert: (data: Record<string, unknown>, opts?: { onConflict?: string }) => SupabaseQuery
  update: (data: Record<string, unknown>) => SupabaseQuery
  eq: (column: string, value: unknown) => SupabaseQuery
  single: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>
  maybeSingle: () => Promise<{
    data: Record<string, unknown> | null
    error: { code?: string; message?: string } | null
  }>
}

interface AuthResult {
  data: { user: AuthUser | null; session: AuthSession | null }
  error: AuthError | null
}

interface AuthUser {
  id: string
  email?: string
  user_metadata?: { avatar_url?: string; full_name?: string; name?: string }
  app_metadata?: { provider?: string; providers?: string[] }
  identities?: Array<{ provider: string; id: string }>
}

interface AuthSession {
  access_token: string
  user: AuthUser
}

interface AuthError {
  message: string
}

interface LifetimeStats {
  totalRolls: number
  totalVictories: number
  totalMoves: number
  diceRolls: { total: number; successes: number }
  flashcards: { total: number; correct: number }
  opponentTurns: { total: number; defended: number }
  techniques: Record<string, unknown>
}

type AuthStateCallback = (event: string, user: AuthUser | null) => void

// ── State ──────────────────────────────────────────────────────────────────────

let _client: SupabaseClient | null = null
let _sdkLoading: Promise<void> | null = null
let _syncTimeout: ReturnType<typeof setTimeout> | null = null
let _syncing = false
let _lastSyncTime = ""
let _authListeners: AuthStateCallback[] = []
let _syncRetryTimeout: ReturnType<typeof setTimeout> | null = null
let _syncFailureCount = 0
let _syncFailureNotified = false
let _pulledThisSession = false
let _onlineListenerWired = false

const SYNC_DEBOUNCE_MS = 500
const SYNC_RETRY_MAX_MS = 30000
const STREAK_KEY = "bjj-streak"
const LIFETIME_KEY = "bjj-lifetime-stats"
const VOTES_KEY = "bjj-move-votes"

// ── SDK Loading ────────────────────────────────────────────────────────────────

function isConfigured(): boolean {
  return !!(window.__SUPABASE_URL && window.__SUPABASE_ANON_KEY)
}

/** The localStorage key the Supabase SDK uses for the session. We pass this
 * explicitly to createClient (equal to the SDK's historical default) so a
 * future SDK default change can't silently move it, and isAuthenticated()
 * reads this same single source of truth instead of re-deriving the shape. */
function authStorageKey(): string {
  const ref = (window.__SUPABASE_URL || "").replace("https://", "").split(".")[0]
  return `sb-${ref}-auth-token`
}

function loadSDK(): Promise<void> {
  if (_sdkLoading) return _sdkLoading
  _sdkLoading = new Promise((resolve, reject) => {
    if (window.supabase) {
      resolve()
      return
    }
    const script = document.createElement("script")
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Failed to load Supabase SDK"))
    document.head.appendChild(script)
  })
  return _sdkLoading
}

async function getClient(): Promise<SupabaseClient> {
  if (_client) return _client
  if (!isConfigured()) throw new Error("Supabase not configured")
  await loadSDK()
  // Explicit auth options so behaviour does not depend on SDK defaults that a
  // CDN minor bump could change. detectSessionInUrl lets the SDK exchange the
  // OAuth redirect code/token on client creation.
  _client = window.supabase!.createClient(window.__SUPABASE_URL!, window.__SUPABASE_ANON_KEY!, {
    auth: {
      flowType: "pkce",
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: authStorageKey(),
    },
  })

  // Listen for auth state changes and notify listeners
  _client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") _pulledThisSession = false
    const user = session?.user ?? null
    for (const cb of _authListeners) {
      try {
        cb(event, user)
      } catch {
        /* ignore */
      }
    }
  })

  wireOnlineRetry()
  return _client
}

/** Eagerly create the client on page load so the SDK can process an OAuth
 * redirect (detectSessionInUrl) and the onAuthStateChange subscription is live
 * even for currently signed-out users. Without this, the client is only created
 * lazily behind an isAuthenticated() gate, so a Google redirect-back is never
 * exchanged and sign-in silently never completes. Safe no-op when unconfigured
 * or on SDK load failure. */
export async function ensureClientInitialized(): Promise<void> {
  if (!isConfigured()) return
  try {
    await getClient()
  } catch (e) {
    console.error("[supabase] client init failed:", e)
  }
}

// ── Auth Functions ─────────────────────────────────────────────────────────────

export async function signUp(
  email: string,
  password: string,
): Promise<{ user: AuthUser | null; error: string | null }> {
  const client = await getClient()
  const { data, error } = await client.auth.signUp({ email, password })
  if (error) return { user: null, error: error.message }
  if (data.user) await initialSync()
  return { user: data.user, error: null }
}

export async function signIn(
  email: string,
  password: string,
): Promise<{ user: AuthUser | null; error: string | null }> {
  const client = await getClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) return { user: null, error: error.message }
  if (data.user) await initialSync()
  return { user: data.user, error: null }
}

export async function signInWithGoogle(): Promise<{ error: string | null }> {
  const client = await getClient()
  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    // /Training was removed when the embedded training UX shipped; route to home.
    options: { redirectTo: window.location.origin + "/" },
  })
  return { error: error?.message ?? null }
}

export async function signOut(): Promise<{ error: string | null }> {
  const client = await getClient()
  const { error } = await client.auth.signOut()
  return { error: error?.message ?? null }
}

export async function getUser(): Promise<AuthUser | null> {
  if (!isConfigured()) return null
  try {
    const client = await getClient()
    const { data } = await client.auth.getUser()
    return data.user
  } catch {
    return null
  }
}

export async function getSession(): Promise<{ user: AuthUser | null; accessToken: string | null }> {
  if (!isConfigured()) return { user: null, accessToken: null }
  try {
    const client = await getClient()
    const { data } = await client.auth.getSession()
    return {
      user: data.session?.user ?? null,
      accessToken: data.session?.access_token ?? null,
    }
  } catch {
    return { user: null, accessToken: null }
  }
}

export async function resetPassword(email: string): Promise<{ error: string | null }> {
  const client = await getClient()
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + "/",
  })
  return { error: error?.message ?? null }
}

export function onAuthChange(cb: AuthStateCallback) {
  _authListeners.push(cb)
}

export function isAuthenticated(): boolean {
  // Quick synchronous check — Supabase stores session in localStorage
  if (!isConfigured()) return false
  try {
    const raw = localStorage.getItem(authStorageKey())
    if (!raw) return false
    const session = JSON.parse(raw)
    return !!session?.access_token
  } catch {
    return false
  }
}

export function getLastSyncTime(): string {
  return _lastSyncTime
}

// ── Sync Functions ─────────────────────────────────────────────────────────────

function loadLocalJSON(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function gatherLocalData() {
  return {
    srs_cards: loadSRSCards(),
    settings: loadSettings(),
    daily_progress: loadDailyProgress(),
    streak: loadLocalJSON(STREAK_KEY) ?? {},
    lifetime_stats: loadLocalJSON(LIFETIME_KEY) ?? {},
    move_votes: loadLocalJSON(VOTES_KEY) ?? {},
    explored: loadLocalJSON("bjj-explored") ?? [],
  }
}

// ── Sync status (surface failures, retry with backoff) ──────────────────────────

async function getUserId(client: SupabaseClient): Promise<string | null> {
  // Local session read (no network round-trip); the SDK keeps it fresh via
  // autoRefreshToken. Avoids a getUser() network call on every sync/nav.
  const { data } = await client.auth.getSession()
  return data.session?.user?.id ?? null
}

function markSyncSuccess() {
  _syncFailureCount = 0
  _syncFailureNotified = false
  _lastSyncTime = new Date().toISOString()
  if (_syncRetryTimeout) {
    clearTimeout(_syncRetryTimeout)
    _syncRetryTimeout = null
  }
}

function markSyncFailure() {
  // Surface once per failure streak so the user knows sync is paused, then
  // retry with exponential backoff instead of silently diverging from cloud.
  if (!_syncFailureNotified) {
    _syncFailureNotified = true
    ;(window as any).showSnackbar?.({
      message: "Sync paused — changes are saved on this device",
      type: "info",
    })
  }
  scheduleSyncRetry()
}

function scheduleSyncRetry() {
  if (_syncRetryTimeout) return
  const delay = Math.min(SYNC_RETRY_MAX_MS, 1000 * 2 ** Math.min(_syncFailureCount, 5))
  _syncFailureCount++
  _syncRetryTimeout = setTimeout(() => {
    _syncRetryTimeout = null
    if (isAuthenticated()) void pushToCloud()
  }, delay)
}

function wireOnlineRetry() {
  if (_onlineListenerWired) return
  _onlineListenerWired = true
  window.addEventListener("online", () => {
    if (isAuthenticated()) void pushToCloud()
  })
}

export async function pushToCloud(): Promise<boolean> {
  if (_syncing) return false
  _syncing = true
  try {
    const client = await getClient()
    const userId = await getUserId(client)
    if (!userId) return false

    const localData = gatherLocalData()
    const { error } = await client
      .from("user_training_data")
      .upsert({ user_id: userId, ...localData }, { onConflict: "user_id" })
      .single()

    if (error) {
      console.error("[supabase] push failed:", error)
      markSyncFailure()
      return false
    }

    markSyncSuccess()
    return true
  } catch (e) {
    console.error("[supabase] push error:", e)
    markSyncFailure()
    return false
  } finally {
    _syncing = false
  }
}

export async function pullFromCloud(): Promise<boolean> {
  if (_syncing) return false
  _syncing = true
  try {
    const client = await getClient()
    const userId = await getUserId(client)
    if (!userId) return false

    const { data, error } = await client
      .from("user_training_data")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()

    if (error) {
      // A real read error (network/permission/5xx) — NOT "no data". Do not push
      // local up, or we could overwrite good cloud state with empty/regressed
      // local state. Leave cloud untouched and retry later.
      console.error("[supabase] pull read failed:", error)
      _syncing = false
      markSyncFailure()
      return false
    }

    if (!data) {
      // Genuinely no row yet (legitimate first sync) — push local data up.
      _syncing = false
      return pushToCloud()
    }

    // Merge and apply
    const localCards = loadSRSCards()
    const cloudCards = (data.srs_cards as SRSCard[]) || []
    const merged = mergeCards(localCards, cloudCards)
    saveSRSCardsLocal(merged)

    // Settings: cloud wins if non-empty
    const cloudSettings = data.settings as Record<string, unknown>
    if (cloudSettings && Object.keys(cloudSettings).length > 0) {
      // Migrate legacy opponentOnFail from cloud data
      if ("opponentOnFail" in cloudSettings && !("gameMode" in cloudSettings)) {
        cloudSettings.gameMode = cloudSettings.opponentOnFail ? "normal" : "off"
        delete cloudSettings.opponentOnFail
      }
      saveSettingsLocal({ ...DEFAULT_SETTINGS, ...(cloudSettings as unknown as BJJSettings) })
    }

    // Daily progress: cloud wins if same date, otherwise keep local
    const cloudProgress = data.daily_progress as DailyProgress
    const localProgress = loadDailyProgress()
    if (cloudProgress?.date === localProgress.date) {
      // Take higher counts
      saveDailyProgressLocal({
        date: localProgress.date,
        learned: Math.max(localProgress.learned, cloudProgress.learned || 0),
        reviewed: Math.max(localProgress.reviewed, cloudProgress.reviewed || 0),
      })
    }

    // Streak: take higher values
    const localStreak = loadStreak()
    const cloudStreak = (data.streak as StreakData) || {}
    const mergedStreak: StreakData = {
      currentStreak: Math.max(localStreak.currentStreak, cloudStreak.currentStreak || 0),
      longestStreak: Math.max(localStreak.longestStreak, cloudStreak.longestStreak || 0),
      lastActiveDate:
        (localStreak.lastActiveDate || "") > (cloudStreak.lastActiveDate || "")
          ? localStreak.lastActiveDate
          : cloudStreak.lastActiveDate || "",
    }
    localStorage.setItem(STREAK_KEY, JSON.stringify(mergedStreak))

    // Lifetime stats: take cloud if it has more total rolls
    const localLifetime = loadLocalJSON(LIFETIME_KEY) as LifetimeStats | null
    const cloudLifetime = data.lifetime_stats as LifetimeStats | null
    if (
      cloudLifetime?.totalRolls &&
      (!localLifetime || cloudLifetime.totalRolls > localLifetime.totalRolls)
    ) {
      localStorage.setItem(LIFETIME_KEY, JSON.stringify(cloudLifetime))
    }

    // Move votes: cloud wins (simple overwrite)
    const cloudVotes = data.move_votes
    if (cloudVotes && Object.keys(cloudVotes as object).length > 0) {
      localStorage.setItem(VOTES_KEY, JSON.stringify(cloudVotes))
    }

    // Explored: union of cloud + local, deduplicated by slug, keep earliest firstVisited
    const localExplored = (loadLocalJSON("bjj-explored") ?? []) as Array<{
      slug: string
      firstVisited: string
    }>
    const cloudExplored = ((data as any).explored ?? []) as Array<{
      slug: string
      firstVisited: string
    }>
    const exploredMap = new Map<string, any>()
    for (const e of [...localExplored, ...cloudExplored]) {
      const existing = exploredMap.get(e.slug)
      if (!existing || e.firstVisited < existing.firstVisited) {
        exploredMap.set(e.slug, e)
      }
    }
    localStorage.setItem("bjj-explored", JSON.stringify([...exploredMap.values()]))

    markSyncSuccess()
    return true
  } catch (e) {
    console.error("[supabase] pull error:", e)
    markSyncFailure()
    return false
  } finally {
    _syncing = false
  }
}

/** Called on first sign-in — pull cloud data, merge, then push merged result */
async function initialSync() {
  _pulledThisSession = true
  const pulled = await pullFromCloud()
  if (pulled) await pushToCloud()
}

// ── Debounced Sync ─────────────────────────────────────────────────────────────

/** Called by srs.ts, settings.ts, etc. after every localStorage write */
export function syncAfterWrite() {
  if (!isAuthenticated()) return
  if (_syncTimeout) clearTimeout(_syncTimeout)
  _syncTimeout = setTimeout(() => pushToCloud(), SYNC_DEBOUNCE_MS)
}

// ── Merge Logic ────────────────────────────────────────────────────────────────

function mergeCards(local: SRSCard[], cloud: SRSCard[]): SRSCard[] {
  const merged = new Map<string, SRSCard>()

  for (const card of cloud) {
    merged.set(card.technique, card)
  }

  for (const card of local) {
    const existing = merged.get(card.technique)
    if (!existing || card.lastReview > existing.lastReview) {
      // Local card is newer or doesn't exist in cloud
      if (existing) {
        // Union flashcardsMastered from both
        const allMastered = new Set([
          ...(existing.flashcardsMastered || []),
          ...(card.flashcardsMastered || []),
        ])
        card.flashcardsMastered = Array.from(allMastered).sort((a, b) => a - b)
      }
      merged.set(card.technique, card)
    } else if (existing) {
      // Cloud card is newer — union flashcardsMastered from local
      const allMastered = new Set([
        ...(existing.flashcardsMastered || []),
        ...(card.flashcardsMastered || []),
      ])
      existing.flashcardsMastered = Array.from(allMastered).sort((a, b) => a - b)
    }
  }

  return Array.from(merged.values())
}

// ── Local-only save (avoids sync loops during pull) ────────────────────────────

function saveSRSCardsLocal(cards: SRSCard[]) {
  localStorage.setItem("bjj-srs-cards", JSON.stringify(cards))
}

function saveSettingsLocal(settings: BJJSettings) {
  localStorage.setItem("bjj-settings", JSON.stringify(settings))
}

function saveDailyProgressLocal(progress: DailyProgress) {
  localStorage.setItem("bjj-daily-progress", JSON.stringify(progress))
}

// ── On Page Load (for authenticated users) ─────────────────────────────────────

export async function syncOnLoad() {
  if (!isAuthenticated()) return
  if (_pulledThisSession) return
  _pulledThisSession = true
  try {
    await pullFromCloud()
  } catch {
    // Silent failure — data is still in localStorage (pull schedules a retry)
  }
}

// ── Neural progress blob ────────────────────────────────────────────────────────
// The Neural app stores its per-user progress as a single JSONB column (`neural`)
// on the same user_training_data row the legacy sync uses. Both writers upsert on
// user_id with column-scoped payloads: Postgres ON CONFLICT DO UPDATE only touches
// the columns present in the payload, and pushToCloud's payload never includes
// `neural` (nor does this one include the training columns), so the two syncs
// coexist on one row without clobbering each other.
// Requires the `neural` column — apply supabase/neural_v1.sql before shipping.

export async function pullNeural(): Promise<Record<string, unknown> | null> {
  if (!isConfigured()) return null
  try {
    const client = await getClient()
    const userId = await getUserId(client)
    if (!userId) return null

    const { data, error } = await client
      .from("user_training_data")
      .select("neural")
      .eq("user_id", userId)
      .maybeSingle()

    if (error) {
      console.error("[supabase] neural pull failed:", error)
      return null
    }
    // No row yet (first visit before any push) → null; caller starts fresh.
    return (data?.neural as Record<string, unknown> | undefined) ?? null
  } catch (e) {
    console.error("[supabase] neural pull error:", e)
    return null
  }
}

export async function pushNeural(blob: Record<string, unknown>): Promise<boolean> {
  if (!isConfigured()) return false
  try {
    const client = await getClient()
    const userId = await getUserId(client)
    if (!userId) return false

    const { error } = await client
      .from("user_training_data")
      .upsert({ user_id: userId, neural: blob }, { onConflict: "user_id" })
      .single()

    if (error) {
      console.error("[supabase] neural push failed:", error)
      return false
    }
    return true
  } catch (e) {
    console.error("[supabase] neural push error:", e)
    return false
  }
}

// ── Window façade for the Neural bundle ─────────────────────────────────────────
// The Neural app is a separate no-eval IIFE bundle that cannot import TS modules;
// it reaches auth + cloud persistence exclusively through this façade so zero
// supabase-js bytes enter the neural bundle. Installed at module top-level:
// supabase.ts is statically imported by authUI.inline.ts, whose bundle runs as
// Component.AuthUI()'s afterDOMLoaded script in sharedPageComponents.afterBody —
// i.e. on EVERY page, before any auth/config gate — so the façade is present
// regardless of sign-in state. Each function degrades gracefully when Supabase
// is unconfigured (null/false/no-op), matching the module's existing behaviour.

if (typeof window !== "undefined") {
  ;(window as any).__bjjAuth = {
    ensureClientInitialized,
    isAuthenticated,
    getSession,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    onAuthChange,
    resetPassword,
    pullNeural,
    pushNeural,
  }
}
