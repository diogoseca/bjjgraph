// No I/O until explicit index/record demand. App owns navigation and rendering.
export function ngSystemsCreateLoader({ base = '', fetch: fetcher = globalThis.fetch, crypto: crypt = globalThis.crypto } = {}) {
  let dead = false, indexPromise = null, indexValue = null, indexPending = false, generation = 0, refreshed = false;
  const records = new Map(), controllers = new Set();
  const need = (ok, why) => { if (!ok) throw new Error(why); };
  const live = () => need(!dead, 'systems-disposed');
  const read = async (path, maximum, refresh = false) => {
    live(); const controller = new AbortController(); controllers.add(controller);
    try {
      const response = await fetcher(base + path, { signal: controller.signal, ...(refresh ? { cache: 'reload' } : {}) }); live();
      need(response.ok, 'systems-http');
      const bytes = new Uint8Array(await response.arrayBuffer()); live();
      need(bytes.length <= maximum, 'systems-size'); return bytes;
    } finally { controllers.delete(controller); }
  };
  const parse = bytes => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  const projected = s => {
    const row = {};
    for (const key of ['id', 'name', 'display_title', 'aliases', 'type', 'difficulty']) if (Object.prototype.hasOwnProperty.call(s, key)) row[key] = s[key];
    if (Object.prototype.hasOwnProperty.call(s, 'products')) row.products = s.products.map(p => {
      const item = {}; for (const key of ['name', 'instructor']) if (Object.prototype.hasOwnProperty.call(p, key)) item[key] = p[key]; return item;
    });
    return row;
  };
  const index = ({ retry = false } = {}) => {
    live();
    if (indexPending) return indexPromise;
    if (retry) { refreshed = true; indexPromise = null; indexValue = null; records.clear(); }
    if (indexValue) return Promise.resolve(indexValue);
    if (!indexPromise) {
      indexPending = true; const attempt = ++generation;
      indexPromise = (async () => {
      const value = parse(await read('systems-index.json', 500000, retry));
      need(value?.version === 1 && value._meta && Array.isArray(value.systems) && value.systems.length > 0, 'systems-index');
      const seen = new Set();
      for (const row of value.systems) {
        need(row && typeof row.id === 'string' && row.id && !seen.has(row.id) && typeof row.name === 'string' && /^[a-f0-9]{64}$/.test(row.detailHash), 'systems-index-row');
        need(row.aliases == null || (Array.isArray(row.aliases) && row.aliases.every(x => typeof x === 'string')), 'systems-index-aliases');
        need(row.products == null || (Array.isArray(row.products) && row.products.every(p => p && ['name', 'instructor'].every(k => p[k] == null || typeof p[k] === 'string'))), 'systems-index-products');
        seen.add(row.id);
      }
      live(); need(attempt === generation, 'systems-stale-generation'); indexValue = value; return value;
      })().finally(() => { if (attempt === generation) indexPending = false; });
    }
    return indexPromise;
  };
  const record = async (id, { retry = false } = {}) => {
    live(); const catalogue = await index({ retry }); live();
    const attempt = generation;
    const row = catalogue.systems.find(s => s.id === id); need(row, 'systems-unknown-id');
    const key = row.detailHash;
    if (!records.has(key)) records.set(key, (async () => {
      const bytes = await read('content/system-records/' + row.detailHash + '.json', 40000, refreshed);
      need(crypt?.subtle, 'systems-hash-unavailable');
      const hash = Array.from(new Uint8Array(await crypt.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join(''); live();
      need(attempt === generation && catalogue === indexValue, 'systems-stale-generation');
      need(hash === row.detailHash, 'systems-record-hash');
      const value = parse(bytes);
      need(value?.id === id && Array.isArray(value.nodes) && Array.isArray(value.glue) && Array.isArray(value.products), 'systems-record');
      need(JSON.stringify(projected(value)) === JSON.stringify(projected(row)), 'systems-record-index');
      return value;
    })());
    return records.get(key);
  };
  return { index, record, dispose() { dead = true; for (const controller of controllers) controller.abort(); controllers.clear(); records.clear(); indexValue = null; } };
}
