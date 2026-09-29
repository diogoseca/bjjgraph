// Supabase Auth + Cloud Sync — shared utility module
// Lazy-loads Supabase SDK from CDN, syncs localStorage training data to cloud

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

type AuthStateCallback = (event: string, user: AuthUser | null) => void

// ── State ──────────────────────────────────────────────────────────────────────

let _client: SupabaseClient | null = null
let _sdkLoading: Promise<void> | null = null
let _authListeners: AuthStateCallback[] = []
let _neuralAuthRevision = 0

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
    // A failed load must not stay cached for the page's life: local-only play (owner, 2026-09-29)
    // re-tries it when the player asks or the browser comes back online. The code lets the Neural
    // progress host tell "the SDK is unreachable" from "the account could not be verified".
    script.onerror = () => {
      _sdkLoading = null
      script.remove()
      reject(Object.assign(new Error("Failed to load Supabase SDK"), { code: "sdk-unavailable" }))
    }
    document.head.appendChild(script)
  })
  return _sdkLoading
}

/** The account id the stored session names, UNVERIFIED (no SDK to check it). Used only to pick
 * this device's local cache for local-only play, never to read or write the cloud. */
function storedSessionUserId(): string | null {
  try {
    const id = JSON.parse(localStorage.getItem(authStorageKey()) || "null")?.user?.id
    return typeof id === "string" && id ? id : null
  } catch {
    return null
  }
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
    _neuralAuthRevision++
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
  return { user: data.user, error: null }
}

export async function signIn(
  email: string,
  password: string,
): Promise<{ user: AuthUser | null; error: string | null }> {
  const client = await getClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) return { user: null, error: error.message }
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

// Strict identity read for owner cache selection. Advisory local storage and the
// forgiving public getSession helper cannot establish that an account signed out.
export async function resolveNeuralUser(): Promise<AuthUser | null> {
  if (!isConfigured()) return null
  // No stored session and no SDK load in flight = a guest, by the SDK's own rule: getSession reads
  // this same storage key, and an OAuth return has already started loadSDK in authUI's redirect-back
  // arm. Loading the SDK to learn "guest" put a third-party fetch on every visitor's boot, with mount
  // waiting on it (QREV7 M1; auth-redirect-back.spec.ts test 1's control counts 0 clients).
  if (!isAuthenticated() && !_sdkLoading) return null
  let client: SupabaseClient
  try {
    client = await getClient()
  } catch (error) {
    // LOCAL-ONLY PLAY (owner, 2026-09-29): this device holds a session but the SDK cannot load.
    // Say so, with the account the stored session names, so the app plays on this device's copy
    // and pushes nothing until identity is verified again. Any other failure is unchanged.
    if ((error as { code?: string })?.code === "sdk-unavailable")
      throw Object.assign(new Error("Account service unreachable"), {
        code: "sdk-unavailable",
        storedUserId: storedSessionUserId(),
      })
    throw error
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const revision = _neuralAuthRevision
    const { data, error } = await client.auth.getSession()
    if (revision !== _neuralAuthRevision) continue
    if (error || !data || !("session" in data)) throw new Error("Unable to verify progress owner")
    if (data.session === null) return null
    const user = data.session?.user
    if (!user || typeof user.id !== "string" || !user.id) throw new Error("Invalid progress owner")
    return user
  }
  throw new Error("Progress owner changed during verification")
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

export function onAuthChange(cb: AuthStateCallback): () => void {
  _authListeners.push(cb)
  return () => {
    _authListeners = _authListeners.filter((listener) => listener !== cb)
  }
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

// ── Cloud sync ─────────────────────────────────────────────────────────────────
// v1.80.0 deleted the LEGACY sync half of this module (pushToCloud/pullFromCloud/
// syncOnLoad/syncAfterWrite/mergeCards and their retry+backoff machinery). It mirrored the
// legacy front-end's localStorage keys — bjj-srs-cards, bjj-settings, bjj-daily-progress,
// bjj-streak, bjj-lifetime-stats, bjj-move-votes, bjj-explored — into the per-column fields
// of user_training_data. Nothing writes those keys any more: the legacy UI that owned them is
// gone, and the Neural app persists everything through the `neural` JSONB blob below.
//
// The rows themselves are untouched. Those columns still hold whatever a signed-in user last
// pushed, so restoring the legacy sync (or migrating those columns into the neural blob) is
// still possible server-side — we stopped writing them, we did not drop them.

async function getUserId(client: SupabaseClient): Promise<string | null> {
  // Local session read (no network round-trip); the SDK keeps it fresh via
  // autoRefreshToken. Avoids a getUser() network call on every sync/nav.
  const { data, error } = await client.auth.getSession()
  if (error) throw new Error("Unable to verify cloud sync account")
  return data.session?.user?.id ?? null
}

// ── Neural progress blob ────────────────────────────────────────────────────────
// The Neural app stores its per-user progress as a single JSONB column (`neural`)
// on the same user_training_data row the legacy sync uses. Both writers upsert on
// user_id with column-scoped payloads: Postgres ON CONFLICT DO UPDATE only touches
// the columns present in the payload, and pushToCloud's payload never includes
// `neural` (nor does this one include the training columns), so the two syncs
// coexist on one row without clobbering each other.
// Requires the `neural` column — apply supabase/neural_v1.sql before shipping.

// v2: only a successful, account-pinned read can authorize an app write. A failure
// rejects; null is reserved for an authoritative empty neural column/absent row.
export async function pullNeural(expectedUserId: string): Promise<{
  userId: string
  blob: Record<string, unknown> | null
}> {
  if (!isConfigured() || !expectedUserId) throw new Error("Cloud sync is unavailable")
  const client = await getClient()
  const userId = await getUserId(client)
  if (!userId || userId !== expectedUserId) throw new Error("Cloud sync account changed")
  const { data, error } = await client
    .from("user_training_data")
    .select("neural")
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw new Error("Cloud progress could not be read")
  if ((await getUserId(client)) !== userId) throw new Error("Cloud sync account changed")
  if (
    data !== null &&
    (!data || typeof data !== "object" || Array.isArray(data) || !("neural" in data))
  )
    throw new Error("Invalid cloud progress row")
  return { userId, blob: (data?.neural ?? null) as Record<string, unknown> | null }
}

export async function pushNeural(
  blob: Record<string, unknown>,
  expectedUserId: string,
): Promise<boolean> {
  if (!isConfigured() || !expectedUserId) return false
  try {
    const client = await getClient()
    const userId = await getUserId(client)
    if (!userId || userId !== expectedUserId) return false

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
// regardless of sign-in state. Auth helpers remain optional; the v2 progress pull
// rejects unavailable/failed reads so they cannot authorize a destructive overwrite.

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
    neuralSyncVersion: 2,
    resolveNeuralUser,
    pullNeural,
    pushNeural,
  }
}
