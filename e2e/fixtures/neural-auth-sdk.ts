import { expect, type Page } from '@playwright/test'

// Browser-only SDK fixture. The emitted SSG supabase.ts facade and real app/owner
// host are never replaced. This does not exercise Supabase, PKCE, RLS or database CAS.
export async function installNeuralAuthSDK(page: Page) {
  await page.addInitScript(() => {
    const w = window as any
    const copy = (value: any) => JSON.parse(JSON.stringify(value))
    const sdkListeners = new Set<(event: string, session: any) => void>()
    // The synthetic backend outlives a reload, as a real one does (sessionStorage, like the failure
    // switches); reads/writes/order below are still per document.
    const cloudKey = '__authOwnerCloud'
    const cloud = new Map<string, any>(Object.entries(JSON.parse(sessionStorage.getItem(cloudKey) || '{}')))
    const persistCloud = () => sessionStorage.setItem(cloudKey, JSON.stringify(Object.fromEntries(cloud)))
    const reads: any[] = [], writes: any[] = [], events: any[] = [], sessionReads: { failed: boolean }[] = []
    const tokenKey = 'sb-auth-owner-fixture-auth-token'
    const sessionFailureKey = '__authOwnerFailSessions'
    // A real reload keeps the SDK-only failure switch. Capture progress bytes
    // before any real facade/app script, including legitimate outgoing flushes.
    const initialProgress = Object.fromEntries(Object.keys(localStorage)
      .filter(key => key.startsWith('bjj-neural-owner:') || key === 'bjj-neural-progress')
      .sort().map(key => [key, localStorage.getItem(key)]))
    let user: any = null, failReads = false, clientsCreated = 0
    let failSessions = sessionStorage.getItem(sessionFailureKey) === '1'
    // Like the real SDK, a reload restores the session this device stored (local-only play needs
    // the same account to verify again when the SDK comes back). A token with no user restores none.
    try { const stored = JSON.parse(localStorage.getItem(tokenKey) || 'null'); if (stored?.user?.id) user = stored.user } catch {}
    // LOCAL-ONLY PLAY: an UNREACHABLE SDK. While blocked, `window.supabase` is never defined, so the
    // real facade injects the CDN script, which the journey harness aborts (non-localhost).
    const sdkBlockedKey = '__authOwnerSdkBlocked'
    const order: string[] = []
    const session = () => user ? { user: copy(user), access_token: 'synthetic-token-only' } : null
    const emit = (event: string, id: string | null, profile?: { email?: string, name?: string }) => {
      user = id ? { id, email: profile?.email || id + '@example.invalid', user_metadata: { full_name: profile?.name || id } } : null
      if (user) localStorage.setItem(tokenKey, JSON.stringify(session()))
      else localStorage.removeItem(tokenKey)
      events.push({ event, userId: user?.id || null })
      for (const listener of [...sdkListeners]) listener(event, session())
    }
    const client = {
      auth: {
        getSession: async () => {
          sessionReads.push({ failed: failSessions })
          return failSessions
            ? { data: { session: null }, error: { message: 'Synthetic identity read failure' } }
            : { data: { session: session() }, error: null }
        },
        getUser: async () => ({ data: { user: user && copy(user) }, error: null }),
        onAuthStateChange: (listener: (event: string, session: any) => void) => {
          sdkListeners.add(listener)
          return { data: { subscription: { unsubscribe: () => sdkListeners.delete(listener) } } }
        },
        signOut: async () => { emit('SIGNED_OUT', null); return { error: null } },
      },
      from: (table: string) => {
        if (table !== 'user_training_data') throw new Error('Unexpected fixture table: ' + table)
        let userId: string | null = null, pendingWrite: any = null
        const query = {
          select: (column: string) => {
            if (column !== 'neural') throw new Error('Unexpected fixture column: ' + column)
            return query
          },
          eq: (column: string, value: string) => {
            if (column !== 'user_id') throw new Error('Unexpected fixture account selector')
            userId = value
            return query
          },
          maybeSingle: async () => {
            reads.push({ userId, failed: failReads }); order.push('read')
            if (failReads) return { data: null, error: { message: 'Synthetic offline read' } }
            return { data: userId && cloud.has(userId) ? { neural: copy(cloud.get(userId)) } : null, error: null }
          },
          upsert: (row: any, options: any) => {
            if (!user || row.user_id !== user.id || options?.onConflict !== 'user_id') throw new Error('Unpinned fixture write')
            pendingWrite = copy(row)
            return query
          },
          single: async () => {
            if (!pendingWrite) throw new Error('Unexpected fixture write completion')
            writes.push(copy(pendingWrite)); order.push('write'); cloud.set(pendingWrite.user_id, copy(pendingWrite.neural)); persistCloud()
            return { data: null, error: null }
          },
        }
        return query
      },
    }
    // Override configuration, never the real facade. The site may assign its public
    // build config later; these setters keep every identity/data operation synthetic.
    Object.defineProperty(w, '__SUPABASE_URL', { configurable: true, get: () => 'https://auth-owner-fixture.supabase.invalid', set: () => {} })
    Object.defineProperty(w, '__SUPABASE_ANON_KEY', { configurable: true, get: () => 'synthetic-public-key', set: () => {} })
    // Counted: a signed-out guest must never create a client (QREV7 M1, auth-owner.spec.ts).
    const sdk = { createClient: () => { clientsCreated++; return client } }
    if (sessionStorage.getItem(sdkBlockedKey) !== '1') w.supabase = sdk
    w.__authOwnerFixture = {
      emit,
      seedCloud: (id: string, blob: any) => { cloud.set(id, copy(blob)); persistCloud() },
      failReads: (value: boolean) => { failReads = value },
      failSessions: (value: boolean) => {
        failSessions = value
        if (value) sessionStorage.setItem(sessionFailureKey, '1')
        else sessionStorage.removeItem(sessionFailureKey)
      },
      // Blocks the SDK for the NEXT document (a reload); unblocking makes it reachable now.
      blockSdk: () => sessionStorage.setItem(sdkBlockedKey, '1'),
      unblockSdk: () => { sessionStorage.removeItem(sdkBlockedKey); w.supabase = sdk },
      cloudOf: (id: string) => cloud.has(id) ? copy(cloud.get(id)) : null,
      snapshot: () => copy({ reads, writes, events, sessionReads, initialProgress, order, userId: user?.id || null, clients: clientsCreated }),
    }
  })
}

// Pass through Journey.boot({ beforeNavigate }) so this route is installed AFTER
// the DSL catch-all. The actual owner host and emitted SSG auth facade still run.
export async function beforeNeuralAuthNavigate(page: Page) {
  await installNeuralAuthSDK(page)
  await page.route(/\/app\/game-values\.js(?:\?|$)/, route => route.abort('failed'))
}

export async function waitNeuralAuthOwner(page: Page, id: string | null) {
  await expect.poll(() => page.evaluate(() => {
    const a = (window as any).__neural, auth = (window as any).__bjjAuth
    return { version: auth?.neuralSyncVersion, owner: a?._progressOwner?.id || null,
      kind: a?._progressOwner?.kind, ready: !!a?._progressLoaded && !!a?.nodes?.length && !!a?.flashcards?.decks && !!a?.curriculum,
      current: !!a?._progressCurrent?.(), subscribed: !!a?._authSubscribed, user: a?._authUserId || null }
  }), { timeout: 30_000 }).toEqual({ version: 2, owner: id, kind: id ? 'account' : 'guest', ready: true, current: true, subscribed: true, user: id })
  await expect(page.locator('#neural-progress-recovery')).toHaveCount(0)
}

// A real in-page sign-in goes through the facade (account menu -> signIn / Google), which loads
// the SDK first. Since QREV7 M1 a guest boot creates no client, so an SDK event fired with no
// client has no listener: initialise through the REAL facade, exactly as signIn does, then emit.
export async function signInNeuralAuthSDK(page: Page, id: string, profile?: { email?: string, name?: string }) {
  await page.evaluate(async ({ id, profile }) => {
    const w = window as any
    await w.__bjjAuth.ensureClientInitialized()
    w.__authOwnerFixture.emit('SIGNED_IN', id, profile)
  }, { id, profile })
  await waitNeuralAuthOwner(page, id)
  await expect.poll(() => page.evaluate(() => (window as any).__neural._pulledUserId)).toBe(id)
}
