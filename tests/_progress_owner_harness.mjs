// Pure source fixtures choose an explicit guest owner, through the real lifecycle.
// This does not replace SDK resolution in browser/host integration tests.
import { ngProgressCreateHost, ngProgressOwner } from '../neural/src/progress-owner.src.js';
export function bindProgressGuestForTest(app) {
  const rows = new Map();
  const host = ngProgressCreateHost({
    storage: { getItem: key => rows.get(key) ?? null, setItem: (key, value) => rows.set(key, String(value)) },
    resolveUser: async () => null,
    mount(boot) { host.bind(app, boot); },
    hold(result) { throw new Error('Unexpected fixture owner hold: ' + result.reason); },
  });
  const restored = host.controller.restore(ngProgressOwner());
  if (restored.status !== 'ready' || !host.current(app)) throw new Error('Fixture guest owner was not installed');
  return host;
}
