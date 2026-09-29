import { expect, type APIRequestContext } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export type SharedCoreArtifact = { file: string; sha256: string; bytes: number; sourceKey: string };
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

// Read the actual local build receipt; no hard-coded generation or old fixture.
export async function verifySharedCoreArtifact(request: APIRequestContext): Promise<SharedCoreArtifact> {
  const core = JSON.parse(readFileSync('neural/build/.tmp/game-bundles.json', 'utf8')).sharedCore;
  expect(core, 'fresh game build must name its ordinary shared worker core').toBeTruthy();
  expect(core.file).toMatch(/^game-worker-core-[a-f0-9]{64}\.js$/);
  expect(core.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(core.sourceKey).toMatch(/^[a-f0-9]{64}$/);
  expect(Number.isSafeInteger(core.bytes) && core.bytes > 0).toBe(true);
  expect(core.file).toBe('game-worker-core-' + core.sha256 + '.js');
  const built = readFileSync('neural/dist/' + core.file);
  expect(built.length).toBe(core.bytes);
  expect(digest(built), 'local shared core must match its build receipt').toBe(core.sha256);
  const response = await request.get('/static/neural/app/' + core.file);
  expect(response.ok(), 'shared core must be served: ' + core.file).toBe(true);
  const served = await response.body();
  expect(served.length).toBe(core.bytes);
  expect(digest(served), 'served shared core must match the current local build').toBe(core.sha256);
  return Object.freeze({ file: core.file, sha256: core.sha256, bytes: core.bytes, sourceKey: core.sourceKey });
}

export function isSharedCoreRequest(raw: string, core: SharedCoreArtifact): boolean {
  return new URL(raw).pathname === '/static/neural/app/' + core.file;
}
