/**
 * THE EMAIL'S EDGE CASES, WRITTEN DOWN ONCE (v1.159.0).
 *
 * These are digest objects in exactly the shape `runDigest` composes, and they are the single
 * source for two things that must not drift apart: what `/dev/email/` shows you, and what
 * `tests/digest_render.test.mjs` asserts. A case you can see in the browser is a case the
 * suite is already checking, and vice versa — add one here and both gain it.
 *
 * They are deliberately AWKWARD. The typical email renders fine by construction; what breaks
 * copy is the first day, the empty weak-spot list, the forty-technique day, and the name with
 * an ampersand in it. Every branch in render.js is reachable from this list.
 */

const UNSUB = "https://bjjgraph.org/unsubscribe?u=00000000-0000-0000-0000-000000000000&t=0123456789abcdef0123456789abcdef";

/** Ten real-shaped deck keys, so the "…and N more" fold has something honest to fold. */
const SOME = [
  "Mount|Top", "Closed Guard|Bottom", "Kimura|Attacker", "Back Control|Top",
  "Triangle Choke|Attacker", "Half Guard|Bottom", "Knee Slice Pass|Attacker",
  "Armbar|Defender", "Side Control|Top", "Rear Naked Choke|Attacker",
];

const many = (n) =>
  Array.from({ length: n }, (_, i) => SOME[i % SOME.length].split("|")[0] + " " + (i + 1) + "|Top");

export const FIXTURES = [
  {
    id: "first-day",
    label: "First day",
    note: "One card, one technique, no history: no delta, no streak line, no weak spots, no ETA in days. The most common email a new opt-in will ever see, and the one most likely to read badly.",
    digest: {
      count: 1, techniques: ["Mount|Top"], score: 2.4, delta: null,
      eta: { belt: "white", days: null }, streak: 1, weakTop: [], clip: null, unsubUrl: UNSUB,
    },
  },
  {
    id: "typical",
    label: "Typical day",
    note: "The case the copy was written for — a handful of techniques, a positive delta, a weak spot with an attributed video, and a second spot for the road.",
    digest: {
      count: 24, techniques: SOME.slice(0, 6), score: 41.5, delta: 1.8,
      eta: { belt: "purple", days: 63 }, streak: 4,
      weakTop: ["Berimbolo|Attacker", "De La Riva Guard|Bottom"],
      clip: { id: "dQw4w9WgXcQ", title: "Berimbolo entries from DLR", who: "Mikey Musumeci", dur: "412s" },
      unsubUrl: UNSUB,
    },
  },
  {
    id: "long-streak-losing-ground",
    label: "Long streak, score slipping",
    note: "60 days in a row and a NEGATIVE delta. Proves the delta colour flips and that a long streak reads well beside bad news — the two are rendered independently and had never been seen together.",
    digest: {
      count: 96, techniques: SOME.slice(0, 9), score: 68.2, delta: -0.7,
      eta: { belt: "brown", days: 21 }, streak: 60,
      weakTop: ["Leg Drag|Attacker"], clip: null, unsubUrl: UNSUB,
    },
  },
  {
    id: "weak-spot-no-video",
    label: "Weak spot, no video",
    note: "The magazine section degrades to text when the public content chunk carries no clip. Common — most deck keys have none.",
    digest: {
      count: 31, techniques: SOME.slice(0, 4), score: 55.0, delta: 0,
      eta: { belt: "purple", days: 40 }, streak: 2,
      weakTop: ["Ezekiel Choke|Attacker", "Turtle|Bottom"], clip: null, unsubUrl: UNSUB,
    },
  },
  {
    id: "forty-techniques",
    label: "Forty techniques",
    note: "The list caps at ten and folds the rest. Checks the fold count is 30 and not 40, and that the headline still says forty.",
    digest: {
      count: 210, techniques: many(40), score: 72.9, delta: 3.1,
      eta: { belt: "black", days: 118 }, streak: 12,
      weakTop: ["Worm Guard|Bottom"], clip: null, unsubUrl: UNSUB,
    },
  },
  {
    id: "black-belt",
    label: "Past the last belt",
    note: "Above the black threshold there is no next belt, so `beltEta` returns null and BOTH ETA lines must vanish. The one case where a missing block is correct rather than broken.",
    digest: {
      count: 44, techniques: SOME.slice(0, 7), score: 84.0, delta: 0.4,
      eta: null, streak: 9,
      weakTop: ["Gogoplata|Attacker"], clip: null, unsubUrl: UNSUB,
    },
  },
  {
    id: "stalled",
    label: "Stalled — belt named, no pace",
    note: "Studying, but the score is not moving, so there is a next belt and no honest estimate of when. Renders the quieter 'Next stop' line instead of a promise it cannot keep.",
    digest: {
      count: 18, techniques: SOME.slice(0, 3), score: 39.0, delta: 0,
      eta: { belt: "blue", days: null }, streak: 3,
      weakTop: [], clip: null, unsubUrl: UNSUB,
    },
  },
  {
    id: "hostile-text",
    label: "Names that fight the markup",
    note: "Ampersands, angle brackets and a quote in the places that reach an HTML ATTRIBUTE as well as text. This is the fixture that proves the escaper, and it is why `esc` now covers quotes.",
    digest: {
      count: 7, techniques: ['Ude-Garami <"Kimura"> & Americana|Attacker', "Guard & Pass|Top"],
      score: 33.3, delta: -1.2, eta: { belt: "blue", days: 15 }, streak: 1,
      weakTop: ['S-Mount & "High" Mount|Top'],
      clip: { id: 'abc"onerror=alert(1)', title: 'A "great" video & more', who: "<script>x</script>", dur: null },
      unsubUrl: UNSUB,
    },
  },
];

export const byId = (id) => FIXTURES.find((f) => f.id === id) || null;
