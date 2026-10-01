// Deferred study input capture. No solver, RNG consumption, grades or live writes.
import { NG_KNOWLEDGE_SCENARIO_CAPS as CAPS } from './knowledge-scenarios.src.js';
const need = (ok, reason) => { if (!ok) throw new Error(reason); };
const clone = x => structuredClone(x);
function freeze(x) { if (x && typeof x === 'object' && !Object.isFrozen(x)) { Object.values(x).forEach(freeze); Object.freeze(x); } return x; }
const unavailable = error => freeze({ status: 'unavailable', reason: error?.message || String(error) });
const sorted = rows => rows.slice().sort((a,b) => a.stateId < b.stateId ? -1 : a.stateId > b.stateId ? 1 : 0);
const roles = ['Top','Bottom','Attacker','Defender'];
function rational(n, d = 1n) { need(d > 0n, 'invalid-start-rational'); let a = n < 0n ? -n : n, b = d; while (b) [a,b] = [b,a%b]; return [n/(a||1n),d/(a||1n)]; }
const add = (a,b) => rational(a[0]*b[1]+b[0]*a[1],a[1]*b[1]);
const sub = (a,b) => rational(a[0]*b[1]-b[0]*a[1],a[1]*b[1]);
const fraction = a => a[0] + '/' + a[1];
function binary64(x) {
  need(Number.isFinite(x) && x >= 0, 'invalid-start-threshold'); if (x === 0) return [0n,1n];
  const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0,x);
  const bits = view.getBigUint64(0), exponent = Number((bits>>52n)&2047n);
  const mantissa = (bits&((1n<<52n)-1n))+(exponent ? 1n<<52n : 0n), power = (exponent || 1)-1023-52;
  return power >= 0 ? rational(mantissa<<BigInt(power)) : rational(mantissa,1n<<BigInt(-power));
}
function intervalMasses(rows, increments) {
  let acc = 0, prior = [0n,1n];
  return rows.map((row,i) => {
    acc += increments[i]; need(Number.isFinite(acc) && acc >= 0, 'invalid-start-cumulative');
    const end = i === rows.length-1 ? [1n,1n] : binary64(Math.min(1,acc));
    const mass = sub(end,prior); need(mass[0] >= 0n, 'nonmonotone-start-cumulative');
    const result = { ...row, mass, interval: [fraction(prior),fraction(end)] }; prior = end; return result;
  });
}
function shadow(app) {
  const view = Object.create(app);
  // Existing source readers only assign these caches; no live Map/object writes.
  view._scoreW = { ...(app._scoreW || {}) }; view._keyNode = app._keyNode ? new Map(app._keyNode) : null;
  view.fx = () => {}; view.rng = () => { throw new Error('study-must-not-consume-rng'); };
  view.set = view._saveProgress = () => { throw new Error('study-must-not-write-live-state'); };
  return view;
}

export function ngStudyCreateInputs({ identity: M, knowledge: K, readDeclaration }) {
  need(M && ['ngMdpStable','ngMdpDigest','ngMdpStateId','ngMdpNormalizeRootSnapshot'].every(k => typeof M[k] === 'function')
    && typeof K?.ngKnowledgeFingerprint === 'function' && typeof readDeclaration === 'function', 'missing-study-input-dependency');
  const check = signal => need(!signal?.aborted, 'cancelled');
  function capture(app) {
    need(app && !app.__ngDestroyed && app._progressLoaded && (!app._progressCurrent || app._progressCurrent()), 'study-input-owner-not-ready');
    need(app._gameValueGraph?.status === 'verified', 'study-input-live-graph-unverified');
    const declaration = clone(readDeclaration(app));
    need(declaration && ['current-position','next-roll-current-conditions'].includes(declaration.mode), 'missing-declared-study-scope');
    need(declaration.targets && ['sharp-refresh','declared-joint'].includes(declaration.targets.kind), 'missing-declared-study-targets');
    need(['gi','nogi'].includes(app._giMode) && Number.isFinite(app.aiSkill) && Number.isSafeInteger(app.maxMoves) && app.maxMoves > 0, 'missing-sampled-roll-conditions');
    const view = shadow(app), mode = declaration.mode, nodes = app.nodes;
    need(Array.isArray(nodes) && typeof view.canonicalState === 'function' && typeof view.deckKeyFor === 'function', 'missing-live-start-source');
    const index = app._evLamIdx(), lambda = app._evLam?.[index];
    need(Number.isSafeInteger(index) && index >= 0 && Number.isFinite(lambda), 'missing-effective-loss-aversion');
    const base = { mode, graphHash: app._gameValueGraph.hash, frame: app._giMode, evFrame: app._evFrame, evIndex: index,
      lossAversion: lambda, cap: app.maxMoves, aiSkill: app.aiSkill, rollRevision: app._gameValueRollRevision,
      contextRevision: app._gameValueContextRevision, inputNode: nodes[app.currentPos]?.id || null, inputRole: app.playerRole,
      inputCount: app.moveCount, inputQMod: app._qMod || 0, inputCombo: app._combo || 0,
      startSetting: view.startFrom(), difficulty: view.get('difficulty','normal') };
    let starts, law;
    if (mode === 'current-position') {
      need(app._decision && !app._execution && !app._waitingSubmission && !app._sweep, 'no-current-study-decision');
      const node = nodes[view.canonicalState(app.currentPos,app.playerRole)], here = nodes[app.currentPos], submission = view.submissionNode(here);
      need(node?.id, 'missing-current-native-node');
      const snapshot = M.ngMdpNormalizeRootSnapshot({ nodeId: node.id, role: app.playerRole, phase: 'user', moveCount: app.moveCount,
        arrivalAge: 0, qMod: app._qMod || 0, combo: app._combo || 0, positionKey: app._posKey || null,
        panicKey: submission && app.playerRole !== submission.fromRole ? app._panicKey || null : null },
        { kind: 'actual-roll',episodeCap: app.maxMoves,moveCount: app.moveCount });
      const test = app._beltTest;
      const challenge = test ? { names: test.names?.slice(), pointsWin: test.pointsWin, maxMoves: test.maxMoves ?? null, beltId: test.beltId ?? null } : null;
      need(!challenge || Array.isArray(challenge.names) && challenge.names.every(s => typeof s === 'string') && Number.isFinite(challenge.pointsWin), 'invalid-study-challenge');
      starts = [{ snapshot, mass: [1n,1n] }]; law = { kind: 'current-physical-position', challenge,
        moveCount: snapshot.moveCount, observedMoveCount: app.moveCount, clockNormalization: 'native-root-cap-saturation' };
    } else {
      need(app.maxMoves >= 9 && app.maxMoves <= 12, 'current-cap-not-normal-roll-sample');
      need(app._rigStart == null && !['role','start-pos','max-moves','ai-skill'].some(k => app._rig?.[k]?.length), 'rigged-next-roll-law-unsupported');
      const mask = view._rulesetMask();
      const pool = (view._posIdx || nodes.filter(n => n.ty === 'positions' && n.rep && mask[n.idx]
        && view.adj[n.idx].some(k => nodes[k].ty !== 'positions' && mask[k])).map(n => n.idx)).slice();
      need(pool.length && new Set(pool).size === pool.length, 'no-complete-playable-start-pool');
      const setting = view.startFrom(); let weighted = null, fallback = null;
      if (setting === 'standing') {
        const at = view._standingStart(pool);
        if (at >= 0) weighted = [{ idx: at,mass: [1n,1n] }]; else fallback = 'standing-not-playable';
      }
      if (setting === 'weak') {
        const key = (app._stageVer || 0)+'/'+(app._flowVer || 0)+'/'+Math.max(0,view._evLamIdx())+'/'+view._epochDay()+'/'+app._giMode;
        need(app._flowScoreCache?.k === key, 'weak-start-ranking-not-captured');
        view.flowScore = () => app._flowScoreCache.out;
        const window = view._weakStates(pool);
        if (window.length) {
          let total = 0; for (const row of window) { need(Number.isFinite(row.w) && row.w > 0,'invalid-weak-start-weight'); total += row.w; }
          need(Number.isFinite(total) && total > 0,'invalid-weak-start-total');
          weighted = intervalMasses(window.map(({idx,role,deck}) => ({idx,role,deck})),window.map(row => row.w/total));
        } else fallback = app._flowScoreCache.out ? 'weak-no-mapped-state' : 'weak-no-ranking';
      }
      let freshness = null, traffic = null;
      if (!weighted) {
        const fresh = !view._firstRollDone && (view._firstImpressionOwed() || !view._returningVisitor());
        freshness = { firstRollDone: !!view._firstRollDone, fresh };
        if (fresh) {
          traffic = view.startPosTraffic(); const bias = view.START_BIAS;
          need(bias.gamma === 1.5 && bias.floor === .02,'unsupported-first-start-bias-law');
          const weights = pool.map(i => Math.pow(Math.max(0,traffic[i] || 0),bias.gamma));
          const total = weights.reduce((n,v) => n+v,0); need(Number.isFinite(total),'invalid-first-start-weights');
          if (total > 0) weighted = intervalMasses(pool.map(idx => ({idx})),weights.map(v => (1-bias.floor)*(v/total)+bias.floor/pool.length));
        }
        if (!weighted) weighted = pool.map(idx => ({idx,mass: rational(1n,BigInt(pool.length))}));
      }
      starts = [];
      for (const row of weighted) for (const role of row.role ? [row.role] : ['top','bottom']) {
        let at = row.idx; const selected = nodes[at]; need(selected?.id,'missing-selected-start-node');
        if (selected.pairId && selected.role !== role && selected.pi >= 0) at = selected.pi;
        at = view.canonicalState(at,role); const node = nodes[at]; need(node?.id && node.ty === 'positions','nonposition-new-roll-start');
        // playedRole special-cases the current index. Bind the selected future
        // seat on this shadow before asking the source for its actual deck key.
        const seat=Object.create(view); seat.currentPos=at; seat.playerRole=role;
        const snapshot = {nodeId:node.id,role,phase:'user',moveCount:0,arrivalAge:0,qMod:0,combo:0,positionKey:seat.deckKeyFor(node).key,panicKey:null};
        starts.push({snapshot,mass:row.role ? row.mass : rational(row.mass[0],row.mass[1]*2n)});
      }
      law = { kind:'source-next-roll-conditioned', setting, fallback, freshness, challenge:null, moveCount:0,
        pool:pool.map(i => nodes[i].id), selection:weighted.map(({mass,...row}) => ({...row,probability:fraction(mass)})),
        traffic:traffic ? pool.map(i => [nodes[i].id,traffic[i] || 0]) : null,
        probabilityConvention:'uniform-unit-draw-with-exact-binary64-cumulative-thresholds',
        conditions:{episodeCap:app.maxMoves,aiSkill:app.aiSkill}, integratesFutureCap:false,integratesFutureSkill:false,prngBitGridIntegrated:false };
    }
    const combined = new Map();
    for (const row of starts) if (row.mass[0] > 0n) { const id = M.ngMdpStateId(row.snapshot), old = combined.get(id);
      combined.set(id,{snapshot:row.snapshot,mass:old ? add(old.mass,row.mass) : row.mass}); }
    let total=[0n,1n]; const distribution=[],mapping=[];
    for (const [stateId,row] of combined) { total=add(total,row.mass); distribution.push({stateId,probability:fraction(row.mass)}); mapping.push({stateId,snapshot:row.snapshot}); }
    need(total[0] === total[1] && mapping.length,'non-normalized-start-law');
    const descriptors = Object.entries(app.flashcards?.decks || {}).map(([key,d]) => {
      const i=view.nodeForKey(key), node=nodes[i], suffix=key.slice(key.lastIndexOf('|')+1);
      return {key,role:suffix,count:view._deckCardCount(d),category:d.cat || view.deckCat(node),
        available:node ? view.giAllows(node) : null};
    });
    const shared = app._sharedQ instanceof Map ? [...app._sharedQ].map(([hash,keys]) => [hash,keys.slice()]) : null;
    const targetCapture={declaration:declaration.targets,contentRevision:app._knowledgeContentRevision,frame:app._giMode,descriptors,shared};
    return {base,law,declaration,distribution:sorted(distribution),mapping:sorted(mapping),targetCapture,
      startKey:M.ngMdpDigest({base,law,distribution:sorted(distribution),mapping:sorted(mapping)}),targetKey:M.ngMdpDigest(targetCapture)};
  }
  function registration(app,build,installation,captured) {
    need(build?.mechanics && build?.sources && captured.base.graphHash === build.sources.graphHash
      && installation?.graphHash === build.sources.graphHash && installation.indexHash === build.sources.indexHash
      && M.ngMdpStable(installation.lawHashes) === M.ngMdpStable(build.sources.lawHashes), 'stale-study-input-installation');
    const body={graphHash:installation.graphHash,indexHash:installation.indexHash,lawHashes:installation.lawHashes};
    need(installation.id === M.ngMdpDigest(body),'invalid-study-input-installation');
    const b=captured.base, variants=build.variants.filter(v => v.ruleset === b.frame && v.lossAversion === b.lossAversion && v.evFrame === b.evFrame);
    need(variants.length === 1 && variants[0].status === 'COMPLETE','unavailable-study-input-variant');
    const v=variants[0]; need(v.file === 'variant-'+v.sha256+'.json' && /^[a-f0-9]{64}$/.test(v.sha256)
      && build.lossAversions[b.evIndex] === b.lossAversion,'invalid-study-input-variant');
    need(build.mechanics.graphHash === installation.graphHash,'stale-study-mechanics-graph');
    return {modelHash:build.mechanics.modelHash,mechanicsHash:v.mechanicsHash,graphHash:installation.graphHash,
      opponentPolicyHash:build.mechanics.opponentPolicyHash,ruleset:b.frame};
  }
  function profileCheck(app,profile,runtime) {
    need(profile?.status === 'ready' && profile.contentRevision === app._knowledgeContentRevision,'stale-study-input-profile');
    const body={...profile}; delete body.fingerprint; need(K.ngKnowledgeFingerprint(body) === profile.fingerprint,'invalid-study-input-profile');
    const view=shadow(app); view._checkKnowledgeDay=()=>view._epochDay();
    need(typeof view.knowledgeProfile==='function' && view.knowledgeProfile().fingerprint===profile.fingerprint,'changed-live-study-profile');
    need(runtime?.residencyRevision === app._gameValueResidencyRevision && runtime.deckReady,'stale-study-input-residency');
    const actual=Object.fromEntries(Object.keys(app.flashcards?.decks || {}).filter(k => app._deckHasCards(k)).map(k => [k,true]));
    need(M.ngMdpStable(actual) === M.ngMdpStable(runtime.deckReady),'stale-study-input-residency');
  }
  function readInputIdentity(app) { try {const c=capture(app); return freeze({status:'ready',startKey:c.startKey,targetKey:c.targetKey});} catch(e){return unavailable(e);} }
  function produceStarts({app,build,installation,profile,runtime,requestId,revision},signal) {
    try {
      check(signal); const c=capture(app); profileCheck(app,profile,runtime); const reg=registration(app,build,installation,c);
      need(typeof requestId === 'string' && requestId && Number.isSafeInteger(revision) && revision >= 0,'invalid-study-input-request');
      const request={apiVersion:2,requestId,revision,...reg,profileHash:profile.fingerprint,objective:M.NG_MDP_OBJECTIVE,
        futureStudyPolicy:profile.studyPolicy,horizon:{kind:'actual-roll',episodeCap:c.base.cap,moveCount:c.law.moveCount},
        state:{id:'study-context:'+c.startKey,snapshot:c.mapping[0].snapshot,aiSkill:c.base.aiSkill,challenge:c.law.challenge}};
      check(signal); need(capture(app).startKey === c.startKey,'stale-study-start-input');
      return freeze({status:'ready',identity:c.startKey,request,startDistribution:c.distribution,startSnapshots:c.mapping,
        provenance:{kind:'source-bound-declared-study-starts',scope:c.base.mode,sourceLaw:c.law,graphHash:reg.graphHash,
          startDistributionHash:M.ngMdpDigest(c.distribution),startMappingHash:M.ngMdpDigest(c.mapping),noLiveMutation:true}});
    }catch(e){return unavailable(e);}
  }
  function produceTargets({app,build,installation,profile,runtime,starts},signal) {
    try {
      check(signal); const c=capture(app); profileCheck(app,profile,runtime); registration(app,build,installation,c);
      need(starts?.status === 'ready' && starts.identity === c.startKey,'stale-study-target-starts');
      const selection=c.declaration.targets, decks=new Map(c.targetCapture.descriptors.map(d=>[d.key,d]));
      const checked=(key,role)=>{const d=decks.get(key);need(d && roles.includes(d.role) && d.role===role && Number.isSafeInteger(d.count) && d.count>0,'invalid-declared-study-deck');return d;};
      const skipped=[],scenarios=[];
      if(selection.kind==='sharp-refresh') {
        need(Array.isArray(selection.deckKeys)&&selection.deckKeys.length&&new Set(selection.deckKeys).size===selection.deckKeys.length,'invalid-declared-sharp-decks');
        for(const key of selection.deckKeys) {const d=checked(key,key.slice(key.lastIndexOf('|')+1));need(d.available===true,'inactive-declared-sharp-deck');
          const from=profile.sharp[key] || 0;need(Number.isFinite(from)&&from>=0&&from<=CAPS.sharp,'invalid-sharp-profile');
          if(from===CAPS.sharp)skipped.push({deckKey:key,reason:'already-at-declared-sharp-target'});
          else scenarios.push({targets:[{deckKey:key,role:d.role,sharpTo:CAPS.sharp}]});}
      } else {
        need(Array.isArray(selection.scenarios)&&selection.scenarios.length,'missing-declared-joint-scenarios');
        need(c.targetCapture.shared,'missing-authoritative-shared-closure');
        const groups=c.targetCapture.shared.map(([,keys])=>keys), seenScenarios=new Set();
        for(const row of selection.scenarios) {
          need(Array.isArray(row.targets)&&row.targets.length,'empty-declared-joint-targets');const targets=new Map();let changed=false;
          for(const t of row.targets) {need(t&&Object.keys(t).every(k=>['deckKey','role','permanentTo','sharpTo'].includes(k))&&!targets.has(t.deckKey)
              && ('permanentTo'in t||'sharpTo'in t),'invalid-declared-joint-target');const d=checked(t.deckKey,t.role);
            for(const [field,map,cap] of [['permanentTo','permanent',CAPS.permanent],['sharpTo','sharp',CAPS.sharp]])if(field in t){const from=profile[map][t.deckKey]||0;
              need(Number.isFinite(t[field])&&t[field]>=from&&t[field]<=cap,'declared-target-outside-cap');
              if(t[field]>from){need(field!=='sharpTo'||d.available===true,'inactive-declared-sharp-deck');if(d.available===true)changed=true;}}
            targets.set(t.deckKey,clone(t));}
          const closure=new Set([...targets].filter(([key,t])=>decks.get(key).available===true && t.permanentTo>(profile.permanent[key]||0)).map(([key])=>key));
          let size;do{size=closure.size;for(const keys of groups)if(keys.some(k=>closure.has(k)))for(const key of keys)closure.add(key);}while(closure.size!==size);
          for(const key of closure)need(targets.has(key)&&'permanentTo'in targets.get(key),'incomplete-declared-permanent-closure');
          for(const [key,t]of targets)if(decks.get(key).available!==true)need(closure.has(key)&&t.permanentTo!=null,'inactive-independent-joint-target');
          need(changed,'no-declared-profile-change');const exact=[...targets.values()].sort((a,b)=>a.deckKey<b.deckKey?-1:1),id=M.ngMdpDigest(exact);
          need(!seenScenarios.has(id),'duplicate-declared-joint-scenario');seenScenarios.add(id);scenarios.push({targets:exact});
        }
      }
      need(scenarios.length,'no-declared-profile-change');check(signal);need(capture(app).targetKey===c.targetKey,'stale-study-target-input');
      return freeze({status:'ready',identity:c.targetKey,scenarios,provenance:{kind:'explicit-hypothetical-study-targets',
        declaration:clone(selection),targetSemantics:'declared-mechanics-input-no-earned-credit',sharpCap:CAPS.sharp,permanentCap:CAPS.permanent,
        contentRevision:profile.contentRevision,profileHash:profile.fingerprint,skipped,sharedClosure:'explicit-complete-permanent-closure; sharp-only-local'}});
    }catch(e){return unavailable(e);}
  }
  return Object.freeze({readInputIdentity,produceStarts,produceTargets});
}
