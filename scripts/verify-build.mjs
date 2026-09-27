// Fail the build if a page, install asset, or precache URL escapes the project.
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../vite.config.js';

const dist = new URL('../dist/', import.meta.url);
const files = (await readdir(dist, { recursive: true, withFileTypes: true }))
  .filter(entry => entry.isFile())
  .map(entry => relative(fileURLToPath(dist), join(entry.parentPath || entry.path, entry.name)).replaceAll('\\', '/'))
  .sort();
const project = new URL(config.base === './' ? '/portable-check/' : config.base, 'https://pages.example');
const pages = ['index.html', 'voidline.html', 'ring-riot.html', 'skyslice.html', 'bankshot.html'];
function localFile(reference, from = project) {
  const url = new URL(reference, from);
  assert.ok(url.href.startsWith(project.href), `URL escapes project: ${reference} from ${from}`);
  const file = url.pathname.slice(project.pathname.length) || 'index.html';
  assert.ok(files.includes(file), `Missing static file: ${file}`);
  return url;
}
for (const name of pages) {
  const html = await readFile(new URL(name, dist), 'utf8');
  for (const [, reference] of html.matchAll(/(?:src|href)="([^"]+)"/g)) localFile(reference, new URL(name, project));
  assert.match(html, /rel="manifest"/);
  assert.match(html, /rel="icon"/);
}
const manifestURL = localFile('manifest.webmanifest');
const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', dist), 'utf8'));
for (const key of ['id', 'start_url', 'scope']) assert.equal(new URL(manifest[key], manifestURL).href, project.href, key);
assert.equal(manifest.display, 'standalone');
assert.ok(manifest.name && manifest.short_name && manifest.theme_color && manifest.background_color);
for (const size of [192, 512]) {
  const icon = manifest.icons.find(icon => icon.sizes === `${size}x${size}`);
  assert.ok(icon, `Missing ${size}px install icon`);
  const url = localFile(icon.src, manifestURL);
  const png = await readFile(new URL(url.pathname.slice(project.pathname.length), dist));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), size);
  assert.equal(png.readUInt32BE(20), size);
}
const worker = await readFile(new URL('sw.js', dist), 'utf8');
const precache = JSON.parse(worker.match(/const ASSETS = (\[[^;]+\]);/)[1]);
const application = files.filter(file => file !== 'sw.js');
assert.deepEqual(precache, application, 'Precache must contain every application file exactly once');
const hash = createHash('sha256');
for (const file of application) {
  assert.ok(!file.startsWith('/') && !file.includes('..'), `Nonrelative cache entry: ${file}`);
  localFile(file);
  hash.update(file).update(await readFile(new URL(file, dist)));
}
assert.ok(worker.includes(`const CACHE = PREFIX + '${hash.digest('hex').slice(0, 16)}';`), 'Cache version must match build contents');
assert.ok(worker.includes('self.registration.scope'), 'Cache paths must use worker scope');
const scripts = await Promise.all(files.filter(file => file.endsWith('.js') && file !== 'sw.js').map(file => readFile(new URL(file, dist), 'utf8')));
assert.ok(scripts.some(code => code.includes(JSON.stringify(`${config.base}sw.js`))), 'Registration must use the configured base');
console.log(`Static artifact verified: ${pages.length} pages, install metadata/icons, ${precache.length} precached files; base ${config.base}`);
