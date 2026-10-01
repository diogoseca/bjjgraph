// Real facade source, synthetic SDK only; no backend or private account access.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
const authSource = readFileSync(new URL('../source/quartz/components/scripts/supabase.ts', import.meta.url), 'utf8');
test('SDK facade emits a User and unsubscribe removes only its listener', async () => {
  const h = authHarness(), seen = [];
  const stop = h.api.onAuthChange((event, user) => seen.push([event, user.id]));
  h.api.onAuthChange(event => seen.push(['retained', event]));
  await h.api.ensureClientInitialized();
  h.emit('SIGNED_IN', { user: { id: 'account-a' } });
  assert.deepEqual(seen, [['SIGNED_IN', 'account-a'], ['retained', 'SIGNED_IN']]);
  stop(); h.emit('SIGNED_OUT', null);
  assert.deepEqual(seen.at(-1), ['retained', 'SIGNED_OUT']);
  assert.equal(seen.length, 3);
});

function authHarness({ storedUser = null } = {}) {
  let userId = 'account-a', sdkListener, read = { data: null, error: null }, sessionError = null, sessionRead = null;
  const writes = [], reads = [];
  const client = {
    auth: {
      onAuthStateChange: cb => { sdkListener = cb; return { data: { subscription: { unsubscribe() {} } } }; },
      getSession: async () => sessionRead ? sessionRead() : ({ data: { session: userId ? { user: { id: userId } } : null }, error: sessionError }),
    },
    from: table => {
      const query = { select: () => query, eq: (key, value) => { reads.push({ table, key, value }); return query; },
        maybeSingle: async () => typeof read === 'function' ? await read() : read,
        upsert: row => { writes.push(row); return query; }, single: async () => ({ data: {}, error: null }) };
      return query;
    },
  };
  let clients = 0;
  const window = { __SUPABASE_URL: 'https://synthetic.supabase.invalid', __SUPABASE_ANON_KEY: 'synthetic-public-key', supabase: { createClient: () => { clients++; return client; } } };
  // Like the real SDK, a signed-in user leaves its session token under the facade's own storage key
  // (isAuthenticated reads it). A guest has none (QREV7 M1: then no client is ever created).
  const js = stripTypeScriptTypes(authSource).replace(/^export /gm, '');
  // `storedUser`: the account the stored session names (the SDK writes `user` into the token), which
  // local-only play reads when the session cannot be verified.
  const storage = { getItem: key => /-auth-token$/.test(key) && userId ? JSON.stringify({ access_token: 'synthetic-token', ...(storedUser ? { user: { id: storedUser } } : {}) }) : null };
  const api = new Function('window', 'localStorage', 'console', `${js}\nreturn window.__bjjAuth;`)(window, storage, { error() {} });
  return { api, writes, reads, emit: (...args) => sdkListener(...args), clients: () => clients,
    setSessionRead: fn => { sessionRead = fn; }, setUser: id => { userId = id; }, setRead: value => { read = value; }, setSessionError: error => { sessionError = error; } };
}

test('real facade distinguishes failed reads from authoritative absence', async () => {
  const h = authHarness();
  assert.deepEqual(await h.api.pullNeural('account-a'), { userId: 'account-a', blob: null });
  h.setRead({ data: null, error: { message: 'synthetic offline' } });
  await assert.rejects(h.api.pullNeural('account-a')); assert.equal(h.writes.length, 0);
  h.setRead({ data: {}, error: null }); await assert.rejects(h.api.pullNeural('account-a'));
  h.setRead({ data: { neural: {} }, error: null });
  assert.deepEqual((await h.api.pullNeural('account-a')).blob, {});
});

test('real facade refuses absent, changed and unverifiable account at read/write boundaries', async () => {
  const h = authHarness();
  for (const id of [null, 'account-b']) {
    h.setUser(id); await assert.rejects(h.api.pullNeural('account-a'));
    assert.equal(await h.api.pushNeural({ v: 2 }, 'account-a'), false);
  }
  h.setUser('account-a'); h.setSessionError({ message: 'synthetic session error' });
  await assert.rejects(h.api.pullNeural('account-a')); assert.equal(await h.api.pushNeural({ v: 2 }, 'account-a'), false);
  assert.equal(h.writes.length, 0);
});

test('real facade refuses account change during read and pins accepted writes to expected user', async () => {
  const h = authHarness();
  h.setRead(async () => { h.setUser('account-b'); return { data: { neural: { v: 2 } }, error: null }; });
  await assert.rejects(h.api.pullNeural('account-a'));
  assert.equal(await h.api.pushNeural({ v: 2 }, 'account-a'), false);
  assert.equal(await h.api.pushNeural({ v: 2 }, 'account-b'), true);
  assert.deepEqual(h.writes, [{ user_id: 'account-b', neural: { v: 2 } }]);
});


test('QREV7 M1: a guest with no stored session and no SDK load resolves null without creating a client', async () => {
  const h=authHarness();h.setUser(null);
  assert.equal(await h.api.resolveNeuralUser(),null);assert.equal(h.clients(),0,'a guest never loads or creates the SDK client');
  h.setUser('account-a');assert.deepEqual(await h.api.resolveNeuralUser(),{id:'account-a'});assert.equal(h.clients(),1,'a stored session takes the strict SDK path');
});
test('strict owner resolver distinguishes explicit signout from unreadable identity', async () => {
  const h=authHarness();assert.deepEqual(await h.api.resolveNeuralUser(),{id:'account-a'});
  h.setUser(null);assert.equal(await h.api.resolveNeuralUser(),null);
  h.setSessionError({message:'offline'});await assert.rejects(h.api.resolveNeuralUser());assert.equal(h.writes.length,0);
});
test('strict owner resolver retries an auth revision change and returns the new identity', async () => {
  const h=authHarness();await h.api.ensureClientInitialized();let calls=0;
  h.setSessionRead(async()=>{calls++;if(calls===1){h.emit('SIGNED_IN',{user:{id:'account-b'}});return {data:{session:{user:{id:'account-a'}}},error:null};}return {data:{session:{user:{id:'account-b'}}},error:null};});
  assert.deepEqual(await h.api.resolveNeuralUser(),{id:'account-b'});assert.equal(calls,2);
});
test('strict owner resolver bounds revision retries and rejects malformed absence', async () => {
  const h=authHarness();await h.api.ensureClientInitialized();let calls=0;
  h.setSessionRead(async()=>{calls++;h.emit('TOKEN_REFRESHED',{user:{id:'account-a'}});return {data:{session:{user:{id:'account-a'}}},error:null};});
  await assert.rejects(h.api.resolveNeuralUser());assert.equal(calls,3);
  for(const bad of [{data:{},error:null},{data:{session:undefined},error:null},{data:{session:{user:{}}},error:null}]) {h.setSessionRead(async()=>bad);await assert.rejects(h.api.resolveNeuralUser());}
});

// LOCAL-ONLY PLAY (owner ruling 2026-09-29, FGLOCAL1): the SDK cannot load on a device that holds a
// session. The facade must (1) say so with a code and the account the STORED session names, and
// (2) not cache the failure, so "Try again" / `online` really re-tries. A document whose script
// element fails until the SDK is "available" stands in for the CDN. Mutant, recorded 2026-09-29:
// keeping the failed load cached (dropping `_sdkLoading = null` in loadSDK) turns this red on the
// second attempt.
function unloadableHarness() {
  let available = false, appended = 0, clients = 0;
  const client = { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    getSession: async () => ({ data: { session: { user: { id: 'account-a' } } }, error: null }) } };
  const window = { __SUPABASE_URL: 'https://synthetic.supabase.invalid', __SUPABASE_ANON_KEY: 'synthetic-public-key' };
  const document = { head: { appendChild(script) { appended++; setTimeout(() => {
    if (available) { window.supabase = { createClient: () => { clients++; return client; } }; script.onload(); } else script.onerror(); }, 0); } },
    createElement: () => ({ remove() {} }) };
  const storage = { getItem: key => /-auth-token$/.test(key) ? JSON.stringify({ access_token: 'synthetic-token', user: { id: 'account-a' } }) : null };
  const js = stripTypeScriptTypes(authSource).replace(/^export /gm, '');
  const api = new Function('window', 'localStorage', 'console', 'document', `${js}\nreturn window.__bjjAuth;`)(window, storage, { error() {}, warn() {} }, document);
  return { api, appended: () => appended, clients: () => clients, makeAvailable: () => { available = true; } };
}

test('local-only: an unloadable SDK names the stored account with a code, and a later attempt really re-tries', async () => {
  const h = unloadableHarness();
  await assert.rejects(h.api.resolveNeuralUser(), e => e.code === 'sdk-unavailable' && e.storedUserId === 'account-a');
  await assert.rejects(h.api.resolveNeuralUser(), e => e.code === 'sdk-unavailable', 'still unreachable');
  assert.equal(h.appended(), 2, 'the failed load was not cached: the second call loaded again');
  h.makeAvailable();
  assert.deepEqual(await h.api.resolveNeuralUser(), { id: 'account-a' }, 'once reachable, the same session verifies');
  assert.equal(h.clients(), 1);
});

// LOCAL-ONLY PLAY, D3 (owner, 2026-09-30): the SDK LOADED but its session check failed, by returning an
// error or by throwing (a network that did not answer). The facade says so with its own code and the
// account the stored session names, so the host plays local-only exactly as for an unreachable SDK. A
// malformed answer is not a network failure: it carries no code and still holds. Mutants, recorded
// 2026-09-30: throwing the plain error for a returned `error`, or letting a thrown read escape
// unwrapped, each turn this red on the code.
test('local-only D3: a failed session check names the stored account with its own code; a malformed answer does not', async () => {
  const h = authHarness({ storedUser: 'account-a' });
  h.setSessionError({ message: 'offline' });
  await assert.rejects(h.api.resolveNeuralUser(), e => e.code === 'session-unverified' && e.storedUserId === 'account-a');
  h.setSessionError(null); h.setSessionRead(async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(h.api.resolveNeuralUser(), e => e.code === 'session-unverified' && e.storedUserId === 'account-a');
  for (const bad of [{ data: {}, error: null }, { data: { session: { user: {} } }, error: null }]) {
    h.setSessionRead(async () => bad);
    await assert.rejects(h.api.resolveNeuralUser(), e => e.code === undefined, 'a malformed answer still holds');
  }
  h.setSessionRead(null);
  assert.deepEqual(await h.api.resolveNeuralUser(), { id: 'account-a' }, 'once the check answers, the same account verifies');
  assert.equal(h.writes.length, 0);
});
