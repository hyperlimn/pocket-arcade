import assert from 'node:assert/strict';
import { serveStatic } from './static-server.mjs';
import { bankShot } from './bankshot-browser.mjs';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function exerciseOfflineUpdate({browser, base, monitor, record}) {
  // Two artifact revisions under the same Pages path. No files in dist/ are changed.
  let revision = 0;
  const host = await serveStatic({basePath:new URL(base).pathname, transform(name, body) {
    if (name === 'sw.js') return body.toString().replace(/const CACHE = PREFIX \+ '[^']+';/, `const CACHE = PREFIX + 'test-${revision ? 'update' : 'previous'}';`);
    if (name === 'index.html') return body.toString().replace('<body>', `<body data-test-revision="${revision}">`);
    return body;
  }});
  try {
    const subBase = host.url;
    const subPage = await browser.newPage();
    monitor(subPage, subBase);
    await subPage.goto(subBase,{waitUntil:'networkidle0'});
    await subPage.waitForFunction(()=>navigator.serviceWorker.controller);
    const scope = await subPage.evaluate(async()=>(await navigator.serviceWorker.ready).scope); assert.equal(scope,subBase);
    assert.equal(await subPage.$eval('body', e => e.dataset.testRevision), '0');
    // Cache storage belongs to the whole origin: other Pages projects must survive cleanup.
    const unrelated = `pocket-arcade-${new URL('/another-project/', subBase).href}|keep`;
    await subPage.evaluate(async key => { await caches.open(key); }, unrelated);
    // Simulate an old document asking for a hashed script removed from the host.
    const staleAsset = `${subBase}assets/arcade-old-build.js`;
    await subPage.evaluate(async url => {
      const key = (await caches.keys()).find(name => name.endsWith('test-previous'));
      await (await caches.open(key)).put(url, new Response('old-script-still-available',
        { headers: { 'Content-Type': 'text/javascript' } }));
    }, staleAsset);
    const oldGame = await browser.newPage(); monitor(oldGame, subBase);
    await oldGame.goto(`${subBase}ring-riot.html?test`, {waitUntil:'networkidle0'});
    await oldGame.click('#start');
    revision = 1;
    await subPage.evaluate(async()=>{ await (await navigator.serviceWorker.ready).update(); });
    await subPage.bringToFront();
    await subPage.waitForFunction(async()=>Boolean((await navigator.serviceWorker.getRegistration()).waiting), {polling:100});
    await subPage.reload({waitUntil:'networkidle0'});
    assert.equal(await subPage.$eval('body', e => e.dataset.testRevision), '1');
    await subPage.waitForFunction(()=>document.querySelector('#offline-status').textContent.includes('Update ready'));
    assert.equal(await subPage.evaluate(async()=>(await caches.keys()).length),3);
    await subPage.close();
    assert.ok(await oldGame.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration()).waiting)));
    await oldGame.bringToFront();
    if (await oldGame.evaluate(()=>arcadeSnapshot().mode === 'paused')) await oldGame.click('#resume');
    await oldGame.keyboard.down('Space'); await delay(850); await oldGame.keyboard.up('Space');
    assert.equal(await oldGame.evaluate(()=>arcadeSnapshot().mode),'playing');
    // Observe the waiting worker before closing the last client, avoiding a new-tab race.
    const observer = await browser.newPage();
    const lifecycleClient = await observer.createCDPSession();
    const activation = new Promise((resolve, reject) => {
      const timeout = setTimeout(()=>reject(new Error('Updated worker did not activate after last tab closed')), 15000);
      let waitingVersion;
      const listener = ({versions}) => {
        waitingVersion ||= versions.find(version=>version.scriptURL === `${subBase}sw.js` && version.status === 'installed')?.versionId;
        if (versions.some(version=>version.versionId === waitingVersion && version.status === 'activated')) {
          clearTimeout(timeout); lifecycleClient.off('ServiceWorker.workerVersionUpdated', listener); resolve();
        }
      };
      lifecycleClient.on('ServiceWorker.workerVersionUpdated', listener);
    });
    await lifecycleClient.send('ServiceWorker.enable');
    await oldGame.close();
    await activation;
    await lifecycleClient.detach(); await observer.close();
    revision = 2;
    const online = await browser.newPage(); monitor(online, subBase);
    await online.goto(subBase, {waitUntil:'networkidle0'});
    assert.equal(await online.$eval('body', e => e.dataset.testRevision), '2', 'Online navigation must revalidate HTML');
    await online.close();
    revision = 1;
    const updated=await browser.newPage(); monitor(updated, subBase);
    await updated.setCacheEnabled(false); await updated.setOfflineMode(true);
    let response=await updated.goto(subBase,{waitUntil:'networkidle0'});assert.ok(response.fromServiceWorker());
    await updated.waitForFunction(async()=>{const k=await caches.keys();return k.length===3&&k.some(key=>key.endsWith('test-update'))&&k.some(key=>key.endsWith('test-previous'));});
    assert.ok(await updated.evaluate(async key=>(await caches.keys()).includes(key), unrelated));
    assert.equal(await updated.$eval('body', e => e.dataset.testRevision), '1');
    assert.equal(await updated.evaluate(async url => (await fetch(url)).text(), staleAsset), 'old-script-still-available');
    assert.equal(await updated.evaluate(async()=>Boolean(await navigator.serviceWorker.getRegistration(new URL('/',location.href)))), new URL(base).pathname === '/');
    response=await updated.goto(subBase+'ring-riot.html?test',{waitUntil:'networkidle0'});assert.ok(response.fromServiceWorker());
    await updated.click('#start'); await delay(2700);
    await updated.keyboard.down('Space'); await delay(850); await updated.keyboard.up('Space');
    await updated.waitForFunction(()=>arcadeSnapshot().score>0);
    response=await updated.goto(subBase+'voidline.html',{waitUntil:'networkidle0'});assert.ok(response.fromServiceWorker());
    await updated.click('#start-button'); await updated.waitForFunction(()=>Number(document.querySelector('#score').textContent)>0);
    response=await updated.goto(subBase+'skyslice.html?test',{waitUntil:'networkidle0'});assert.ok(response.fromServiceWorker());
    await updated.click('#start');
    await updated.waitForFunction(()=>Math.abs(arcadeSnapshot().active.offset)<.08);
    await updated.keyboard.press('Space');
    assert.ok(await updated.evaluate(()=>arcadeSnapshot().height)>0);
    response=await updated.goto(subBase+'bankshot.html?test',{waitUntil:'networkidle0'}); assert.ok(response.fromServiceWorker());
    await updated.click('#start'); await bankShot(updated);
    assert.ok(await updated.evaluate(()=>arcadeSnapshot().score)>0);
    await updated.close();
    record({name:'Pages update waits for old tabs; online HTML refreshes; prior hashed assets and sibling cache survive; all four score offline on new worker',passed:true});

  } finally { host.server.closeAllConnections(); await new Promise(resolve=>host.server.close(resolve)); }
}
