import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const root = fileURLToPath(new URL('.', import.meta.url));
const recoveryScript = readFileSync(new URL('./src/recovery-inline.js', import.meta.url), 'utf8');
const recoveryStyle = readFileSync(new URL('./src/recovery-inline.css', import.meta.url), 'utf8');
// Pages supplies /<repo>/ at build time; portable local builds keep relative URLs.
const base = process.env.PAGES_BASE_PATH || './';
if (base !== './' && !/^\/(?:[A-Za-z0-9_-][A-Za-z0-9._-]*\/)*$/.test(base)) {
  throw new Error('PAGES_BASE_PATH must be ./ or an absolute path ending in /, e.g. /pocket-arcade/');
}
export default defineConfig({
  base,
  plugins: [{
    name: 'inline-load-recovery',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        // This must work even when every compiled JavaScript or CSS request fails.
        return html.replace('</head>', `<style>${recoveryStyle}</style><script>${recoveryScript}</script></head>`);
      },
    },
  }],
  build: {
    rollupOptions: {
      input: {
        arcade: resolve(root, 'index.html'),
        voidline: resolve(root, 'voidline.html'),
        ringriot: resolve(root, 'ring-riot.html'),
        skyslice: resolve(root, 'skyslice.html'),
        bankshot: resolve(root, 'bankshot.html'),
      },
    },
  },
});
