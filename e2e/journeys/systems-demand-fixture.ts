import { createHash } from 'node:crypto';
import type { Page } from '@playwright/test';

// Real wire hashes, including exact response bytes; no loader bypass in browser fixtures.
export function systemsDemandFixture(catalogue: { _meta?: any; systems: any[] }) {
  const records = new Map<string, string>();
  const systems = catalogue.systems.map(input => {
    const record = { nodes: [], glue: [], products: [], ...input };
    const body = JSON.stringify(record), detailHash = createHash('sha256').update(body).digest('hex');
    records.set(detailHash, body);
    const row: any = {};
    for (const key of ['id', 'name', 'display_title', 'aliases', 'type', 'difficulty'])
      if (Object.prototype.hasOwnProperty.call(record, key)) row[key] = record[key];
    row.products = record.products.map((p: any) => {
      const value: any = {};
      for (const key of ['name', 'instructor']) if (Object.prototype.hasOwnProperty.call(p, key)) value[key] = p[key];
      return value;
    });
    return { ...row, detailHash };
  });
  return { index: { version: 1, _meta: catalogue._meta || { count: systems.length }, systems }, records };
}

export async function routeSystemsDemand(page: Page, catalogue: { _meta?: any; systems: any[] }, beforeIndex?: () => Promise<void>) {
  const fixture = systemsDemandFixture(catalogue);
  await page.route('**/systems-index.json', async route => {
    if (beforeIndex) await beforeIndex();
    await route.fulfill({ json: fixture.index });
  });
  await page.route('**/content/system-records/*.json', route => {
    const hash = new URL(route.request().url()).pathname.split('/').pop()!.replace(/\.json$/, '');
    const body = fixture.records.get(hash);
    return route.fulfill(body == null ? { status: 404, body: 'unknown system record' } : { contentType: 'application/json', body });
  });
  return fixture;
}
