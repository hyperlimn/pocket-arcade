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
    for (const key of await caches.keys()) {
      if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    }
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
    return (await cache.match(url.href)) || fetch(event.request);
  })());
});
`);
console.log(`Offline cache: ${files.length} local files, version ${version}`);
