import { expect, type APIRequestContext } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export type SharedCoreArtifact = { file: string; sha256: string; bytes: number; sourceKey: string };
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

// The shared core the fresh workers ACTUALLY load, read from the packaged worker bundles themselves.
// Both workers name it (its content-addressed file) and pin its source key in their bootstrap. This
// used to read the build's intermediate receipt (neural/build/.tmp/game-bundles.json), which e2e-full
// does not ship to shards, so game-value-live and gameplan-study-live failed in beforeAll on PR 231's
// CI. neural/dist ships, and is cmp-checked against the served app by the package step.
export async function verifySharedCoreArtifact(request: APIRequestContext): Promise<SharedCoreArtifact> {
  const names = new Set<string>(), keys = new Set<string>()
  for (const worker of ['game-model.worker.js', 'game-study.worker.js']) {
    const text = readFileSync('neural/dist/' + worker, 'utf8')
    for (const m of text.matchAll(/game-worker-core-[a-f0-9]{64}\.js/g)) names.add(m[0])
    for (const m of text.matchAll(/sourceKey!==("[a-f0-9]{64}")/g)) keys.add(JSON.parse(m[1]))
  }
  expect([...names], 'both fresh workers name ONE shared core').toHaveLength(1)
  expect([...keys], 'and pin one source key').toHaveLength(1)
  const file = [...names][0], sha256 = file.slice('game-worker-core-'.length, -'.js'.length), sourceKey = [...keys][0]
  const built = readFileSync('neural/dist/' + file)
  expect(built.length > 0).toBe(true)
  expect(digest(built), 'the local shared core is content-addressed').toBe(sha256)
  const response = await request.get('/static/neural/app/' + file)
  expect(response.ok(), 'shared core must be served: ' + file).toBe(true)
  const served = await response.body()
  expect(served.length).toBe(built.length)
  expect(digest(served), 'served shared core must match the current local build').toBe(sha256)
  return Object.freeze({ file, sha256, bytes: built.length, sourceKey })
}

export function isSharedCoreRequest(raw: string, core: SharedCoreArtifact): boolean {
  return new URL(raw).pathname === '/static/neural/app/' + core.file;
}
