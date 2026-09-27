import assert from 'node:assert/strict';
import { serveStatic } from './static-server.mjs';

export async function exerciseRecovery({ browser, base, record }) {
  // Simulate deployed HTML that references a hashed script the host no longer has.
  let breakScripts = false;
  const host = await serveStatic({ basePath: new URL(base).pathname, transform(name, body) {
    if (!breakScripts || !name.endsWith('.html')) return body;
    return body.toString().replace(/src="[^"]+\/assets\/[^\"]+\.js"/g, 'src="./assets/removed-build.js"');
  } });
  const context = await browser.createBrowserContext();
  try {
    const page = await context.newPage();
    await page.goto(host.url, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    breakScripts = true;
    for (const path of ['', 'voidline.html', 'ring-riot.html', 'skyslice.html', 'bankshot.html']) {
      await page.goto(host.url + path, { waitUntil: 'networkidle0' });
      await page.waitForSelector('#arcade-load-help', { visible: true, timeout: 10000 });
      assert.match(await page.$eval('#arcade-load-help', el => el.textContent), /Ctrl \+ Shift \+ R/);
    }
    const own = `pocket-arcade-${host.url}|stale`;
    const other = 'another-application-cache';
    await page.evaluate(async ({ own, other }) => {
      localStorage.setItem('arcade-recovery-test-score', '123');
      await caches.open(own);
      await caches.open(other);
    }, { own, other });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('#arcade-load-help button'),
    ]);
    assert.equal(await page.evaluate(() => localStorage.getItem('arcade-recovery-test-score')), '123');
    assert.deepEqual(await page.evaluate(async () => (await caches.keys()).sort()), [other]);
    assert.equal(await page.evaluate(async () => navigator.serviceWorker.getRegistration()), undefined);
    record({ name: 'missing scripts show recovery on all five pages; repair unregisters worker, keeps scores and unrelated caches', passed: true });
  } finally {
    await context.close();
    host.server.closeAllConnections();
    await new Promise(resolve => host.server.close(resolve));
  }
}
