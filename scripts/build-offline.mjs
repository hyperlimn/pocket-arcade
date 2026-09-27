import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const dist = new URL('../dist/', import.meta.url);
async function walk(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => entry.isDirectory()
    ? walk(new URL(`${entry.name}/`, dir), `${prefix}${entry.name}/`)
    : `${prefix}${entry.name}`));
  return files.flat().filter((file) => file !== 'sw.js').sort();
}
const files = await walk(dist);
const hash = createHash('sha256');
for (const file of files) hash.update(file).update(await readFile(new URL(file, dist)));
const version = hash.digest('hex').slice(0, 16);
await writeFile(new URL('sw.js', dist), `
const PREFIX = 'pocket-arcade-' + self.registration.scope + '|';
const CACHE = PREFIX + '${version}';
const ASSETS = ${JSON.stringify(files)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(file => new URL(file, self.registration.scope).href))));
  // Updates wait until all old tabs close; never swap code during a run.
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // A browser may still have an older HTML document open (or in HTTP cache)
    // after this worker activates. Keep two prior builds for its hashed assets.
    const versions = (await caches.keys()).filter(key => key.startsWith(PREFIX));
    const keep = new Set([CACHE, ...versions.filter(key => key !== CACHE).slice(-2)]);
    for (const key of versions) if (!keep.has(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!url.href.startsWith(self.registration.scope)) return;
  url.search = '';
  if (url.pathname.endsWith('/')) url.pathname += 'index.html';
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (event.request.mode === 'navigate') {
      // Prefer the latest HTML online; fall back to this complete build offline.
      try {
        const response = await fetch(event.request, { cache: 'no-store' });
        if (response.ok) return response;
      } catch { /* Offline: use the precached document below. */ }
      return (await cache.match(url.href)) || Response.error();
    }
    const current = await cache.match(url.href);
    if (current) return current;
    // A stale tab can still request a hash from the previous deployment.
    for (const key of (await caches.keys()).filter(key => key.startsWith(PREFIX) && key !== CACHE).reverse()) {
      const previous = await (await caches.open(key)).match(url.href);
      if (previous) return previous;
    }
    return fetch(event.request);
  })());
});
`);
console.log(`Offline cache: ${files.length} local files, version ${version}`);
