// Test-only static host: no Vite fallback, API, or application server behavior.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

export async function serveStatic({ basePath, transform = (_name, body) => body }) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (basePath !== '/' && path === basePath.slice(0, -1)) {
        res.writeHead(301, { Location: basePath }); res.end(); return;
      }
      if (!path.startsWith(basePath)) throw new Error('Outside project');
      const name = path.slice(basePath.length) || 'index.html';
      if (name.split('/').some(part => !part || part === '.' || part === '..') || name.includes('\\')) throw new Error('Invalid path');
      const body = await transform(name, await readFile(new URL(`../dist/${name}`, import.meta.url)));
      res.writeHead(200, { 'Content-Type': types[extname(name)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(body);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return { server, url: `http://127.0.0.1:${server.address().port}${basePath}` };
}
