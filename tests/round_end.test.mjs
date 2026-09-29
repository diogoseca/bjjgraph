// How a roll ends, through the real `endRound`: the belt-test verdict and the banner it shows.
// Rendering is stubbed; the verdict, the saved belt record and the banner text are the app's own.
// Mutation evidence (v1.204.5): `wonByPoints = kind !== "win" && …` (a submission counted as a
// points win) fails the first test; restoring the "Scramble / Roll reset" banner fails the last.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../neural/src/app.src.jsx', import.meta.url), 'utf8');
const Component = new Function('DCLogic', 'React', `${source}\nreturn Component;`)(
  class {}, { createRef: () => ({ current: null }) },
);

const BELT = 'fixture-belt';
function app({ dominance, belt = true }) {
  const a = Object.create(Component.prototype);
  a.events = []; a.banners = [];
  a.fx = (beat, data) => a.events.push({ beat, ...data });
  a.showCenter = (kicker, big, name, tone) => a.banners.push({ kicker, big, name, tone });
  for (const k of ['clearTimers', 'clearOptions', '_flushSave', 'flare', 'ladderMove', 'applyDeckVisibility',
    'setEvent', 'hideCenter', 'startRoll', 'track', 'after']) a[k] = () => {};
  a.anim = () => false;
  a.evRef = { current: null };
  a.nodes = [{ x: 0, y: 0 }]; a.currentPos = 0; a.rollLog = [];
  a.myVal = () => dominance;              // the board's verdict at the moment the roll ends
  a.belts = {}; a.moveCount = 9;
  if (belt) a._beltTest = { beltId: BELT, pointsWin: 0.3 };
  return a;
}
const beats = a => a.events.map(e => e.beat).filter(b => b.startsWith('belt_test_'));

test('a submission is always a loss in a belt test, however far ahead the board had you', () => {
  const a = app({ dominance: 0.9 });
  a.endRound('lose', 'Rear Naked Choke from Back Control', 0);
  assert.deepEqual(beats(a), ['belt_test_lost']);
  assert.equal(a.belts.won, undefined, 'no belt is awarded when you were submitted');
  assert.equal(a.belts.attempts[BELT], 1);
  assert.deepEqual(a.banners.at(-1), { kicker: 'Tapped out', big: 'You got caught', name: 'Rear Naked Choke from Back Control', tone: 'bad' });
});

test('a belt test that ends with nobody tapped is still judged on points, both ways', () => {
  const ahead = app({ dominance: 0.9 });
  ahead.endRound('reset');
  assert.deepEqual(beats(ahead), ['belt_test_won']);
  assert.equal(ahead.belts.won[BELT].byPoints, true);
  assert.equal(ahead.banners.at(-1).name, 'Won on points');
  const behind = app({ dominance: 0.1 });
  behind.endRound('reset');
  assert.deepEqual(beats(behind), ['belt_test_lost']);
  assert.equal(behind.belts.won, undefined);
  assert.equal(behind.banners.at(-1).kicker, 'Tapped out');
});

test('a finish wins the belt outright, never on points', () => {
  const a = app({ dominance: -0.5 });
  a.endRound('win', 'Armbar from Mount', 0);
  assert.deepEqual(beats(a), ['belt_test_won']);
  assert.equal(a.belts.won[BELT].byPoints, false);
});

test('a roll that ends with nobody tapped says so', () => {
  const a = app({ dominance: 0, belt: false });
  a.endRound('reset');
  assert.deepEqual(a.banners, [{ kicker: 'No submission', big: 'Roll complete', name: '', tone: 'muted' }]);
});
