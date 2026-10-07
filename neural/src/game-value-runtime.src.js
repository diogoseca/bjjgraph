// Deferred host installer. No import-time I/O, globals, graph capture or solver.
let ngGameValueInstanceSerial = 0;
// How many deadline-killed workers one runtime replaces before it holds the failure (see onTerminated).
// Two: one late worker is a slow moment and two in a row may be a slow device, but a third deadline
// means the solve does not fit this device, and an endless replace loop would burn its battery.
const NG_GAME_VALUE_WORKER_RECOVERIES = 2;
// How long the worker gets to ACKNOWLEDGE a cancel before the client calls it hung and terminates it
// (mdp-client's default is 1 s). Set from a MEASUREMENT (FGCANCEL1, 2026-10-01, dev a7bc58ce4), taken
// as the page sees it, post `cancel` -> receive `cancelled`, with the client's 1 s timer stretched so
// no long ack was cut off: 135 cancels, all acknowledged.
//   - Desktop, unthrottled, solves cancelled at varied depths: max 1,675 ms. 3 of 83 acks were over
//     1 s, and the 1 s grace would have turned each of those healthy workers into a dead one. A corpus
//     hydration's cancels: max 951 ms. The page's main thread was idle in the first scenario, so the
//     long acks are the worker's own synchronous stretches.
//   - CDP's 4x CPU throttle does not slow a dedicated worker: acks under it maxed at 121 ms, and
//     FGHYD1's hand-to-values time at 4x matched 1x. So a 4x-slower phone is estimated as the desktop
//     worst x 4, about 6.7 s.
// 10 s is ~1.5x that estimate. A hung worker still dies within 10 s and is replaced (onTerminated),
// and the 30 s computation deadline remains the backstop.
const NG_GAME_VALUE_CANCEL_GRACE_MS = 10000;
function ngGameValueRuntimeError(reason) { const e = new Error(reason); e.code = reason; return e; }
function ngGameValueInstallRuntime(app, deps) {
  const model = deps.model, build = model.NG_GAME_VALUE_BUILD, identity = model.NG_GAME_VALUE_IDENTITY;
  if (!build || build.version !== deps.version || !Array.isArray(build.variants)
    || !/^[a-f0-9]{64}$/.test(build.manifestHash)) throw ngGameValueRuntimeError('incompatible-game-value-build');
  for (const name of ['ngMdpCreateClient', 'ngGameValueCreateProvider'])
    if (typeof model[name] !== 'function') throw ngGameValueRuntimeError('missing-runtime-export:' + name);
  if (!identity || !deps.knowledge || typeof deps.createWorker !== 'function') throw ngGameValueRuntimeError('missing-runtime-dependency');
  const base = new URL(deps.dataBase || './', deps.documentURL);
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  const baseURL = base.href;
  const assetURL = (file) => new URL(file, baseURL).href;
  const manifestUrl = assetURL('mdp/manifest-' + build.manifestHash + '.json');
  let dead = false, held = null, preparing = null, residency = null, registration = null, recoveries = 0;
  const instanceId = 'game-values:' + (++ngGameValueInstanceSerial) + ':' + (deps.instanceId || deps.version) + ':' + deps.attempt;
  const status = (state, reason = null) => {
    if (dead || app.__ngDestroyed || app._choiceValueSource !== provider) return;
    app._gameValueState = state;
    app._gameValueReason = reason;
    app._gameValueRetryable = (state === 'unavailable' || state === 'error') && !/^live-graph-/.test(reason || '');
    app.paintChoiceValues();
  };
  const verifiedGraph = () => {
    const graph = app._gameValueGraph;
    if (graph?.status === 'pending') throw ngGameValueRuntimeError('live-graph-pending');
    if (graph?.status !== 'verified') throw ngGameValueRuntimeError(graph?.reason || 'live-graph-unverified');
    if (!/^[a-f0-9]{64}$/.test(graph.hash) || graph.hash !== build.graphHash) throw ngGameValueRuntimeError('live-graph-mismatch');
    return graph;
  };
  const graphStatus = error => status(error.code === 'live-graph-pending' ? 'preparing' : 'unavailable', error.code || error.message);
  const descriptor = () => {
    verifiedGraph(); // Check before the descriptor cache and on every capture.
    const index = app._evLamIdx(), lambda = app._evLam?.[index];
    if (!Number.isSafeInteger(index) || index < 0 || !Number.isFinite(lambda)) throw ngGameValueRuntimeError('unavailable-effective-lambda');
    const variants = build.variants.filter(v => v.ruleset === app._giMode && v.lossAversion === lambda && v.evFrame === app._evFrame);
    if (variants.length !== 1 || variants[0].status !== 'COMPLETE') throw ngGameValueRuntimeError('unavailable-mechanics-variant');
    const v = variants[0], key = identity.ngMdpStable([v.ruleset, v.lossAversion, v.evFrame, index, v.sha256]);
    if (registration?.key === key) return registration.value;
    if (!/^[a-f0-9]{64}$/.test(v.sha256) || v.file !== 'variant-' + v.sha256 + '.json') throw ngGameValueRuntimeError('invalid-mechanics-variant');
    const value = Object.freeze({ verified: true, coverage: Object.freeze({ status: 'COMPLETE' }),
      modelHash: build.modelHash, graphHash: build.graphHash, opponentPolicyHash: build.opponentPolicyHash,
      mechanicsHash: v.mechanicsHash, metadataHash: v.sha256, metadataUrl: assetURL('mdp/' + v.file),
      manifestHash: build.manifestHash, manifestBytes: build.manifestBytes, manifestUrl,
      ruleset: v.ruleset, evFrame: v.evFrame, evIndex: index, lossAversion: lambda });
    registration = { key, value }; return value;
  };
  const getResidency = () => {
    const revision = app._gameValueResidencyRevision, decks = app.flashcards?.decks || null;
    if (residency && residency.revision === revision && residency.decks === decks) return residency.value;
    const ready = Object.create(null);
    // The adapter treats missing keys as false. Only hydrated nonempty decks are
    // sent, never manifest stubs, question text, or per-question/account evidence.
    for (const key of Object.keys(decks || {})) if (app._deckHasCards(key)) Object.defineProperty(ready, key, { value: true, enumerable: true });
    const value = Object.freeze({ residencyRevision: revision, deckReady: Object.freeze(ready) });
    residency = { revision, decks, value }; return value;
  };
  const workerURL = new URL(assetURL('app/game-model.worker.js'));
  workerURL.searchParams.set('v', deps.version);
  workerURL.searchParams.set('content', build.manifestHash);
  workerURL.searchParams.set('attempt', String(deps.attempt));
  const provider = model.ngGameValueCreateProvider({ instanceId, mdp: identity, knowledge: deps.knowledge,
    getRegistration: descriptor, getResidency, getProfile: owner => owner.knowledgeProfile(),
    createClient: () => model.ngMdpCreateClient(deps.createWorker(workerURL.href), {
      cancellationGraceMilliseconds: NG_GAME_VALUE_CANCEL_GRACE_MS,
      onTerminated(reason) {
        if (dead || reason === 'destroyed') return;
        provider.resetClient(reason);
        // A WORKER KILLED BY A DEADLINE IS REPLACED, AT MOST NG_GAME_VALUE_WORKER_RECOVERIES TIMES
        // (FGCANCEL1). A deadline (registration, snapshot, cancellation or computation) proves only that
        // the worker was late, and a busy one on a slow phone is late without being broken. The
        // cancellation grace even times the PAGE's main thread, which has to deliver the ack. Holding
        // the failure cost Win chance for the session; the gate's own sequence hit it 2 times in 48
        // local runs (FGHYD2). resetClient already retires every request and makes the transport lazy,
        // so the refresh below IS the next request, and it creates a fresh worker. A crash
        // (`worker-error`) is still held, and so is the next deadline once the bound is spent. Retry is
        // the player's way out, and it installs a new runtime with a fresh bound.
        if (/^worker-[a-z]+-deadline$/.test(reason) && recoveries < NG_GAME_VALUE_WORKER_RECOVERIES) {
          recoveries++; app._gameValueRecoveries = recoveries;
          status('preparing'); app.refreshChoiceValues(); return;
        }
        held = ngGameValueRuntimeError(reason);
        status('unavailable', reason); app.refreshChoiceValues();
      },
    }),
  });
  const capture = provider.capture.bind(provider), evaluate = provider.evaluate.bind(provider), prepare = provider.prepare.bind(provider);
  const destroy = provider.destroy.bind(provider);
  provider.destroy = () => {
    if (dead) return;
    dead = true; destroy(); residency = null; registration = null;
  };
  provider.prepare = owner => {
    if (dead || held) return Promise.reject(held || ngGameValueRuntimeError('runtime-destroyed'));
    let graph;
    try { graph = verifiedGraph(); } catch (error) { graphStatus(error); return Promise.reject(error); }
    const key = identity.ngMdpStable([app.nodes?.[app.currentPos]?.id || null, app.playerRole || null,
      app._giMode, app._evFrame, app._evLamIdx()]);
    if (preparing?.key === key && preparing.graph === graph) return preparing.promise;
    status('preparing');
    const pending = { key, graph };
    const current = () => preparing === pending && app._gameValueGraph === graph;
    const promise = Promise.resolve().then(() => {
      if (app._gameValueGraph !== graph) throw ngGameValueRuntimeError('stale-live-graph');
      verifiedGraph(); return prepare(owner);
    }).then(() => {
      if (current()) { status('prepared'); if (!dead && !app.__ngDestroyed) app.refreshChoiceValues(); }
    }, error => {
      if (current()) {
        held = error; status('unavailable', error.code || error.message);
        if (!dead && !app.__ngDestroyed) app.refreshChoiceValues();
      }
      throw error;
    }).finally(() => { if (preparing === pending) preparing = null; });
    pending.promise = promise; preparing = pending; return promise;
  };
  provider.capture = (...args) => {
    if (dead || held) throw held || ngGameValueRuntimeError('runtime-destroyed');
    try { verifiedGraph(); const value = capture(...args); status('prepared'); return value; }
    catch (error) {
      if (error.code?.startsWith('live-graph-')) graphStatus(error);
      else if (error.code !== 'root-metadata-pending') status('unavailable', error.code || error.message);
      throw error;
    }
  };
  provider.evaluate = request => Promise.resolve().then(() => { verifiedGraph(); return evaluate(request); }).then(result => {
    if (provider.isCurrent(app, request, app._choiceHandId)) {
      if (['ready', 'bounded'].includes(result.root?.status) && app._gameValueFirstValuesAt == null)
        app._gameValueFirstValuesAt = (deps.now || (() => performance.now()))();
      status(result.root?.status === 'unavailable' ? 'unavailable' : 'prepared');
    }
    return result;
  }, error => {
    if (!dead && provider.isCurrent(app, request, app._choiceHandId)
      && !/cancel|supersed|stale|destroy/.test(error.code || error.message || '')) status('unavailable', error.code || error.message);
    throw error;
  });
  if (app.__ngDestroyed) { provider.destroy(); throw ngGameValueRuntimeError('runtime-destroyed'); }
  if (!app.setChoiceValueRuntime(deps.choice)) { provider.destroy(); throw ngGameValueRuntimeError('invalid-choice-runtime'); }
  app._gameValueInstalling = provider;
  try { app.setChoiceValueSource(provider); }
  finally { app._gameValueInstalling = null; }
  status('preparing');
  return {
    provider,
    changed(reason) { if (!dead) provider.invalidate(reason); },
    destroy() {
      provider.destroy();
      if (app._choiceValueSource === provider) app.setChoiceValueSource(null);
    },
  };
}
export { ngGameValueInstallRuntime };
