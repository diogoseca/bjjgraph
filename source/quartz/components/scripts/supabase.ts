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
    supabase?: { createClient: (url: string, key: string) => SupabaseClient }
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

const SYNC_DEBOUNCE_MS = 500
const STREAK_KEY = "bjj-streak"
const LIFETIME_KEY = "bjj-lifetime-stats"
const VOTES_KEY = "bjj-move-votes"

// ── SDK Loading ────────────────────────────────────────────────────────────────

function isConfigured(): boolean {
  return !!(window.__SUPABASE_URL && window.__SUPABASE_ANON_KEY)
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
  _client = window.supabase!.createClient(window.__SUPABASE_URL!, window.__SUPABASE_ANON_KEY!)

  // Listen for auth state changes and notify listeners
  _client.auth.onAuthStateChange((event, session) => {
    const user = session?.user ?? null
    for (const cb of _authListeners) {
      try {
        cb(event, user)
      } catch {
        /* ignore */
      }
    }
  })

  return _client
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
    options: { redirectTo: window.location.origin + "/Training" },
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
    redirectTo: window.location.origin + "/Training",
  })
  return { error: error?.message ?? null }
}

export function onAuthChange(cb: AuthStateCallback) {
  _authListeners.push(cb)
}

export function isAuthenticated(): boolean {
  // Quick synchronous check — Supabase stores session in localStorage
  if (!isConfigured()) return false
  const url = window.__SUPABASE_URL!
  const ref = url.replace("https://", "").split(".")[0]
  try {
    const raw = localStorage.getItem(`sb-${ref}-auth-token`)
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

export async function pushToCloud(): Promise<boolean> {
  if (_syncing) return false
  _syncing = true
  try {
    const client = await getClient()
    const { data: userData } = await client.auth.getUser()
    if (!userData.user) return false

    const localData = gatherLocalData()
    const { error } = await client
      .from("user_training_data")
      .upsert({ user_id: userData.user.id, ...localData }, { onConflict: "user_id" })
      .single()

    if (error) {
      console.error("[supabase] push failed:", error)
      return false
    }

    _lastSyncTime = new Date().toISOString()
    return true
  } catch (e) {
    console.error("[supabase] push error:", e)
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
    const { data: userData } = await client.auth.getUser()
    if (!userData.user) return false

    const { data, error } = await client
      .from("user_training_data")
      .select("*")
      .eq("user_id", userData.user.id)
      .single()

    if (error || !data) {
      // No cloud data yet — push local data up
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

    _lastSyncTime = new Date().toISOString()
    return true
  } catch (e) {
    console.error("[supabase] pull error:", e)
    return false
  } finally {
    _syncing = false
  }
}

/** Called on first sign-in — pull cloud data, merge, then push merged result */
async function initialSync() {
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
  try {
    await pullFromCloud()
  } catch {
    // Silent failure — data is still in localStorage
  }
}
