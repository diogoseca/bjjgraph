// Census of actual ingest + ordinal manifest. Run after npm run regenerate:neural.
import fs from 'node:fs';
import { knowledgeSource } from '../_knowledge_profile_harness.mjs';
import { ngWireDecks } from '../../neural/src/wire-keys.src.js';
import { ngGoldDeckKey as halfDeckKey } from '../../neural/src/mastery-gold.src.js';
export const root = process.cwd();
export const source = fs.readFileSync(root + '/neural/src/app.src.jsx', 'utf8');
export const Component = new Function('DCLogic','React', knowledgeSource + '\n' + source + '\nreturn Component;')(class {}, { createRef: () => ({current:null}) });
export const app = Object.create(Component.prototype);
app.settings = {}; app.beats = []; app.track = () => {}; app._saveProgress = () => {};
export const wire = JSON.parse(fs.readFileSync(root + '/source/quartz/static/neural/graph-data.json'));
app.ingest(structuredClone(wire));
export const decoded = ngWireDecks(JSON.parse(fs.readFileSync(root + '/source/quartz/static/neural/flashcards/_index.json')), app.nodes);
if (decoded.unresolved || decoded.dupes || app.nodes.length < 2500) throw new Error('Invalid survey population');
app.flashcards = decoded;
app.stage = {};
export function survey() {
  const result = { sites: app.nodes.filter(n=>n.rep).length, halves: app.nodes.length, manifestDecks: Object.keys(decoded.decks).length, unresolved: decoded.unresolved, dupes: decoded.dupes, categories: {}, rulesets: {}, missing: [], pairSigns: {}, strengthFallbacks: [], reads: [] };
  for (const n of app.nodes) {
    const row = result.categories[n.ty] ||= { halves:0, withDeck:0, noDeck:0, cards:0, missingStrength:0 };
    row.halves++;
    const key = halfDeckKey(n), d = decoded.decks[key];
    if (d?.n > 0) { row.withDeck++; row.cards += d.n; } else { row.noDeck++; result.missing.push({ id:n.id, key }); }
    if (!n.s) { row.missingStrength++; result.strengthFallbacks.push({half:n.t+" — "+n.role, id:n.id, strength:n.dom, base:app.hex(n.col)}); }
  }
  for (const frame of ['gi','nogi']) {
    app._giMode = frame;
    const counts = {};
    for (const n of app.nodes) {
      const row = counts[n.ty] ||= { visible:0, withDeck:0, noDeck:0, hidden:0 };
      if (!app.rsAllows(n)) { row.hidden++; continue; }
      row.visible++;
      if (decoded.decks[halfDeckKey(n)]?.n > 0) row.withDeck++; else row.noDeck++;
    }
    result.rulesets[frame] = counts;
  }
  for (const n of app.nodes.filter(n=>n.rep)) {
    const p = app.nodes[n.pi];
    const signs = [n.dom,p.dom].map(x=>x>0?'blue':x<0?'red':'grey').join('/');
    const row = result.pairSigns[n.ty] ||= {}; row[signs]=(row[signs]||0)+1;
  }
  let method = '';
  source.split('\n').forEach((s,i)=> {
    const m = s.match(/^  (?:async )?([A-Za-z_$][\w$]*)\([^]*\)\s*\{/); if(m) method=m[1];
    if (/\.col\b|\.colU\b/.test(s) && !s.trim().startsWith('//')) result.reads.push({line:i+1,method,text:s.trim()});
  });
  return result;
}
if (process.argv[1]?.endsWith('mastery_gold_survey.mjs')) console.log(JSON.stringify(survey(),null,2));
