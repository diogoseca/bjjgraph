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

function authHarness() {
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
  const storage = { getItem: key => /-auth-token$/.test(key) && userId ? JSON.stringify({ access_token: 'synthetic-token' }) : null };
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
