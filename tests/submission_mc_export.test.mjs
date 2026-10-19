import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { knowledgeSource } from './_knowledge_profile_harness.mjs';

const source = readFileSync(new URL('../neural/src/app.src.jsx', import.meta.url), 'utf8');
const Component = new Function('DCLogic', 'React', `${knowledgeSource}\n${source}\nreturn Component;`)(
  class {}, { createRef: () => ({ current: null }) });
const output = JSON.parse(execFileSync('python3', ['-B', fileURLToPath(new URL('./submission_mc_export_test.py', import.meta.url))],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 }));
function appFor(decks) {
  const app = Object.create(Component.prototype);
  app.flashcards = { decks };
  app.nodeForKey = () => { throw Error('Unexpected neighbor fallback'); };
  app._mcCold = () => { throw Error('Unexpected cold deck'); };
  return app;
}

test('D-321 exports only 30 reviewed submission decks; all 241 cards exercise authored choices', () => {
  assert.equal(output.pythonTests, 4);
  assert.equal(Object.keys(output.decks).length, 30);
  const app = appFor(output.decks);
  app.mcClip = () => { throw Error('Reviewed submission consulted the answer pool'); };
  let cards = 0, choices = 0, calls = 0;
  for (const [key, deck] of Object.entries(output.decks)) {
    for (const card of deck.cards) {
      const seen = new Set();
      assert.ok(!app._mcNorm(card.q).includes(app._mcNorm(card.a)), `${key}: answer in question`);
      for (const draw of [.25, .75]) {
        app.rng = () => draw;
        const result = app.mcDistractors(card, key);
        assert.ok(result, `${key}: no MC`);
        assert.equal(result.options.length, 3);
        assert.equal(result.options[result.correctIdx].text, card.a);
        assert.deepEqual(result.options.map(o => o.tier).sort(), ['correct', 'plausible', 'trap']);
        for (const [index, option] of result.options.entries()) {
          assert.ok(option.text.length <= 36, `${key}: ${option.text}`);
          if (index !== result.correctIdx) seen.add(option.text);
        }
        calls++;
      }
      assert.deepEqual([...seen].sort(), [...card.mc.p, ...card.mc.t].sort(), `${key}: authored wrong not exercised`);
      choices += seen.size + 1;
      cards++;
    }
  }
  assert.equal(cards, 241);
  assert.equal(choices, 964);
  assert.equal(calls, 482);
  console.log(`Submission export: 4 Python contracts; 30 decks / 241 cards / 964 choices / 482 production draws; ${output.outside.decks} other decks (${output.outside.cards} cards) retain legacy bytes.`);
});

function grade(app, card, key, result, index) {
  let recorded;
  app._gradeKnowledge = (_key, _card, correct, _format, tier) => {
    recorded = { correct, tier };
    return { status: 'observed' }; // stop after the real grading decision, before unrelated UI effects
  };
  const buttons = result.options.map(() => ({ style: {}, setAttribute() {} }));
  app._mcAnswer(index, card, key, { querySelectorAll: () => buttons }, {}, null,
    { correct: result.correctIdx, tiers: result.options.map(o => o.tier), surface: 'deck' });
  assert.ok(recorded, 'The real grading path must run');
  return recorded;
}

test('Aoki capture drill never grades another correct no-rotation precaution as a wrong pooled option', () => {
  const key = 'Aoki Lock from Ashi Garami|Attacker';
  const question = 'Aoki from Ashi: what should the forearm-and-hand enclosure avoid during a capture drill?';
  const pooledPrecaution = 'Load a rotational lock at the ankle and knee.';
  // Reproduce the pre-fix false grade with the real producer's legacy transport
  // and the unchanged app. This pins the failure, rather than just a field name.
  const legacy = appFor({ [key]: { cards: output.legacyAoki } });
  legacy.rng = () => .25;
  const oldCard = output.legacyAoki.find(c => c.q === question);
  assert.ok(oldCard);
  const oldResult = legacy.mcDistractors(oldCard, key);
  const falseGrade = oldResult.options.findIndex(o => o.text === pooledPrecaution);
  assert.ok(falseGrade >= 0, 'Legacy control must expose the confirmed false-grade option');
  assert.equal(grade(legacy, oldCard, key, oldResult, falseGrade).correct, false);

  const app = appFor(output.decks);
  const card = output.decks[key].cards.find(c => c.q === question);
  assert.ok(card);
  assert.equal(card.a, 'Finishing rotation through the foot');
  for (const draw of [.25, .75]) {
    app.rng = () => draw;
    const result = app.mcDistractors(card, key);
    assert.ok(result);
    assert.ok(result.options.every(o => o.tier !== 'pool'));
    assert.ok(result.options.every(o => o.text !== pooledPrecaution));
    const correct = result.options.findIndex(o => o.text === 'Finishing rotation through the foot');
    assert.equal(grade(app, card, key, result, correct).correct, true);
    for (let i = 0; i < result.options.length; i++) {
      if (i !== correct) assert.equal(grade(app, card, key, result, i).correct, false);
    }
  }
  console.log('Aoki regression: legacy false grade reproduced; two authored draws / six real grading decisions checked.');
});
