/**
 * CONSTANT-TIME STRING EQUALITY, shared by the two places a secret is compared to a request
 * (v1.164.2): the digest Worker's manual-trigger bearer (`workers/digest/index.js`) and the
 * unsubscribe Function's HMAC token (`functions/unsubscribe.js`). Both used `===`, which
 * returns at the first differing byte — a timing side channel on the one value each endpoint
 * exists to protect. Over Cloudflare's edge the leak is noisy to the point of impractical,
 * and that is not the standard: a compare that CAN leak is a compare that will be measured
 * one day by someone with more patience than the author.
 *
 * XOR-fold: every byte of both inputs is visited whatever the inputs are, the lengths are
 * folded in as one more term rather than short-circuiting, and the result is read once at
 * the end. Length is not hidden (it never is with this shape — and neither the 32-hex token
 * nor the service key has a secret length).
 *
 * One file, two deploy units: the Worker bundles it from beside itself; the Pages Function
 * imports it across the tree the same way `functions/l/[[path]].js` already imports
 * `neural/src/lists-codec.src.js` — a cross-directory import wrangler's Pages build has
 * shipped for a year. Pure, no globals beyond TextEncoder, so `node --test` runs it as-is.
 */
export function safeEqual(a, b) {
  const enc = new TextEncoder();
  const A = enc.encode(String(a));
  const B = enc.encode(String(b));
  let diff = A.length ^ B.length;
  const n = Math.max(A.length, B.length);
  for (let i = 0; i < n; i++) diff |= (i < A.length ? A[i] : 0) ^ (i < B.length ? B[i] : 0);
  return diff === 0;
}
