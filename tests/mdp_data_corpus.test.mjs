// Full structural/mechanical corpus differential. This executes actual app source
// methods, independently of the Python producer, including real ingest and every
// strict/fallback/submission hand. It is not a browser or a full game solver pass.
// Root runs this after neural emission under the shared resource guard.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SOURCE = process.env.MDP_SOURCE_ROOT || ROOT;
const DATA = process.env.MDP_DATA_ROOT || resolve(SOURCE, 'source/quartz/static/neural');
const stable = v => v === null || typeof v !== 'object' ? JSON.stringify(v) : Array.isArray(v)
  ? '[' + v.map(stable).join(',') + ']' : '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
const sha = v => createHash('sha256').update(v).digest('hex');
const json = path => JSON.parse(readFileSync(path, 'utf8'));
// The metadata boundary is JSON (also the reference capture's serialization).
// JSON.stringify canonicalizes -0 to 0; no gameplay branch distinguishes them.
const boundary = value => JSON.parse(stable(value));

function response(sub, choice, body) {
  const authored = Object.fromEntries(Object.entries(choice).filter(([k]) => !['contentHash', 'defenseId'].includes(k)));
  authored.detail = null;
  if (Object.hasOwn(choice, 'detail')) {
    assert.ok(body.details[choice.detail], 'source response detail is present');
    authored.detail = body.details[choice.detail] || null;
  }
  const contentHash = sha(stable(authored));
  return { id: choice.id ?? 'defense:' + contentHash, contentHash, to: choice.to,
    ...(Object.hasOwn(choice, 'detail') ? { detail: choice.detail } : {}) };
}

test('full emitted corpus metadata equals real gameplay mechanics for both rulesets and every shipped lambda', () => {
  const work = mkdtempSync(resolve(tmpdir(), 'mdp-data-corpus-'));
  try {
    // Required assets fail loudly locally and in CI. No fixture silently stands in
    // for a missing corpus, and no empty iteration can count as a pass.
    const wireBytes = readFileSync(resolve(DATA, 'graph-data.json'));
    const wire = JSON.parse(wireBytes);
    assert.ok(wire.nodes.length > 1000, 'actual emitted corpus denominator');
    const appText = readFileSync(resolve(SOURCE, 'neural/src/app.src.jsx'), 'utf8');
    const knowledgeText = readFileSync(resolve(SOURCE, 'neural/src/knowledge-profile.src.js'), 'utf8').replace(/^export /gm, '');
    const Component = new Function('DCLogic', 'React', `${knowledgeText}\n${appText}\nreturn Component;`)(class {}, { createRef: () => ({ current: null }) });
    assert.equal(typeof Component.prototype.submissionOptions, 'function', 'candidate full-game source required');
    const details = {};
    for (const file of readdirSync(resolve(DATA, 'submission-details')).filter(f => f.endsWith('.json'))) {
      for (const [title, body] of Object.entries(json(resolve(DATA, 'submission-details', file)))) {
        assert.ok(!Object.hasOwn(details, title), 'unique details title');
        details[title] = body;
      }
    }
    assert.ok(Object.keys(details).length > 250, 'all emitted submission details');
    const script = `import sys,json,copy,hashlib\nfrom pathlib import Path\nsys.path.insert(0,sys.argv[1])\nfrom _mdp_mechanics import produce_metadata,stable\nroot,out=map(Path,sys.argv[2:4])\nw=json.loads((root/'graph-data.json').read_text())\nd={}\nfor p in sorted((root/'submission-details').glob('*.json')): d.update(json.loads(p.read_text()))\nfor f in ['gi','nogi']:\n for lam in w['evLam']:\n  m=produce_metadata(w,d,f,lam)\n  (out/(f+'-'+str(lam)+'.json')).write_text(stable(m))\np=copy.deepcopy(w)\norder=list(reversed(range(len(p['nodes']))))\ninv={old:new for new,old in enumerate(order)}\np['nodes']=[p['nodes'][i] for i in order]\np['links']=[[inv[l[0]],inv[l[1]],*l[2:]] for l in p['links']]\nfor n in p['nodes']:\n for block in (n.get('cal') or {}).get('ev',{}).values(): block[0]=[inv[i] for i in block[0]]\na=stable(produce_metadata(w,d,'gi',2))\nb=stable(produce_metadata(p,d,'gi',2))\nassert a==b,'storage permutation changed mechanics'\nprint(json.dumps({'nodePermutation':len(order),'projectionHash':hashlib.sha256(a.encode()).hexdigest()}))`;
    const python = execFileSync('python3', ['-B', '-c', script, resolve(ROOT, 'scripts'), DATA, work], { encoding: 'utf8', timeout: 60000 });
    const counts = { variants: 0, nodes: 0, hands: 0, actions: 0, canonical: 0, destinations: 0, evRows: 0, defenses: 0, rates: 0, zeroAttemptActions: 0, distinctSameDestinationDefenses: 0, maxHand: 0 };
    const captureHashes = [];
    for (const frame of ['gi', 'nogi']) for (const lam of wire.evLam) {
      const m = json(resolve(work, `${frame}-${lam}.json`));
      assert.equal(m.coverage.status, 'COMPLETE', JSON.stringify(m.coverage.issues));
      const app = Object.create(Component.prototype);
      Object.assign(app, { settings: {}, beats: [], track() {}, fx() {}, _saveProgress() {}, get(k, d) { return k === 'lossAversion' ? lam : d; }, set() {},
        _giMode: frame, playerRole: 'top', currentPos: 0, flashcards: { decks: {} }, prep: {}, rec: {}, stage: {}, srs: {}, _sharp: {}, aiSkill: .13 });
      app.ingest(structuredClone(wire));
      for (const n of app.nodes) if (n.ty === 'submissions' && n.role === 'attacker') {
        const body = details[n.t];
        assert.ok(body?.choices?.length, 'nonempty source defenses: ' + n.id);
        // Hydrate exactly the source body, as loadSubmissionChoices does. The pure
        // projection never receives this app or any runtime-captured node graph.
        n.cal.defenses = structuredClone(body.choices);
      }
      const id = i => app.nodes[i]?.id ?? null;
      const byId = new Map(m.nodes.map(n => [n.id, n]));
      const captured = { nodes: [], hands: {}, canonical: {}, destinations: {}, evHands: {} };
      for (const n of app.nodes) {
        const sub = app.submissionNode(n);
        const cal = n.cal == null ? null : Object.fromEntries(['successRate', 'successRateByRuleset', 'outcomes', 'stateMoves', 'stateAlias'].filter(k => Object.hasOwn(n.cal, k) && n.cal[k] !== undefined).map(k => [k, n.cal[k]]));
        if (n.cal?.defenses) {
          cal.defenses = n.cal.defenses.map(d => response(sub, d, details[sub.t]));
          counts.defenses += cal.defenses.length;
        }
        const expected = { id: n.id, t: n.t, ty: n.ty, role: n.role || null, fromRole: n.fromRole || null,
          pairId: id(n.pi), submissionId: sub?.id || null, posId: n.posId || null, fromPositionId: n.fromPositionId || null,
          s: n.s || null, dom: n.dom || 0, allowed: !!app.rsAllows(n), cal, deckKey: app.deckKeyFor(n).key,
          fallbackRole: app.performerRole(n.t, n.ty), poolName: app.splitName(n.t).main.toLowerCase() };
        assert.deepEqual(byId.get(n.id), boundary(expected), frame + ' node ' + n.id);
        captured.nodes.push(expected); counts.nodes++;
        if (n.role === 'attacker') {
          const actualRate = app.calSuccess(n), c = byId.get(n.id).cal;
          const v = c?.successRateByRuleset?.[frame] ?? c?.successRate;
          assert.equal(typeof v === 'number' ? Math.max(0, Math.min(1, v / 100)) : null, actualRate);
          counts.rates++;
        }
        for (const role of ['top', 'bottom']) {
          const key = stable([n.id, role]);
          captured.canonical[key] = id(app.canonicalState(n.idx, role));
          assert.equal(m.canonical[key], captured.canonical[key], 'canonical ' + key); counts.canonical++;
          if (!['positions', 'submissions'].includes(n.ty)) continue;
          app.currentPos = n.idx; app.playerRole = role;
          const options = app.optionsFor(n.idx, role).map(o => {
            const d = o.defense ? response(app.submissionNode(o.node), o.defense, details[o.node.t]) : null;
            return { techniqueId: o.node.id, destinationId: id(o.res), destinationRole: o.destinationRole || null,
              kind: o.action === 'enter' ? 'entry' : o.action || (o.node.ty === 'submissions' ? 'entry' : 'transition'),
              defense: d, relaxed: !!o.relaxed, ev: o.ev ? { e0: o.ev.e0, c1: o.ev.c1, att: o.ev.att } : null,
              ...(d ? { defenseId: 'defense:' + d.contentHash } : {}) };
          });
          const sort = rows => rows.slice().sort((a, b) => stable(a).localeCompare(stable(b), 'en'));
          assert.deepEqual(sort(m.hands[key]), boundary(sort(options)), `${frame} lambda=${lam} hand ${key}`);
          captured.hands[key] = sort(options);
          counts.hands++; counts.actions += options.length; counts.maxHand = Math.max(counts.maxHand, options.length);
          counts.zeroAttemptActions += options.filter(o => o.ev?.att === 0).length;
          const defenses = options.filter(o => o.defense);
          counts.distinctSameDestinationDefenses += defenses.length - new Set(defenses.map(o => o.destinationId)).size;
          const rows = app._ev.get(n.idx + '/' + role), k = app._evLamIdx();
          if (rows && k >= 0) {
            const expectedEv = [...rows].filter(([, r]) => r.lam[k]).map(([i, r]) => ({ techniqueId: id(i), att: r.att, c1: r.lam[k][1] }));
            assert.deepEqual(sort(m.evHands[key]), boundary(sort(expectedEv)), 'ev ' + key);
            counts.evRows += expectedEv.length; captured.evHands[key] = sort(expectedEv);
          } else assert.equal(m.evHands[key], undefined);
        }
      }
      for (const [to, r] of Object.entries(m.destinations)) {
        const actual = app.resolveOutcomeTo(to);
        const expected = { nodeId: id(actual.idx), role: actual.role || null, terminal: !!actual.terminal };
        assert.deepEqual(r, expected, frame + ' destination ' + to);
        captured.destinations[to] = expected; counts.destinations++;
      }
      captureHashes.push({ ruleset: frame, lossAversion: lam, referenceCaptureHash: sha(stable(captured)) });
      counts.variants++;
    }
    // PER VARIANT, because the variant count follows the wire: two frames x the shipped `evLam` blocks
    // (one since the loss-aversion dial was retired in v1.207.0; the 09-25 receipt measured 5,286
    // actions and 1,058 defenses per variant across six).
    assert.equal(counts.variants, 2 * wire.evLam.length, 'every frame x shipped lambda compared');
    assert.ok(counts.variants >= 2 && counts.actions / counts.variants > 5000 && counts.defenses / counts.variants > 1000 &&
      counts.maxHand > 10 && counts.distinctSameDestinationDefenses > 0, 'positive full-corpus comparison counts per variant');
    assert.equal(sha(readFileSync(resolve(DATA, 'graph-data.json'))), sha(wireBytes), 'wire unchanged during differential');
    assert.equal(sha(readFileSync(resolve(SOURCE, 'neural/src/app.src.jsx'))), sha(appText), 'gameplay source unchanged during differential');
    const receipt = { sourceHash: sha(appText), graphHash: sha(wireBytes), counts, permutation: JSON.parse(python), captureHashes,
      maxRSSKiB: process.resourceUsage().maxRSS, scope: 'real source mechanics in Node; no browser or trajectory/solver parity claim' };
    if (process.env.MDP_DATA_RECEIPT) writeFileSync(process.env.MDP_DATA_RECEIPT, JSON.stringify(receipt, null, 2) + '\n');
    console.log(JSON.stringify(receipt));
  } finally { rmSync(work, { recursive: true, force: true }); }
});
