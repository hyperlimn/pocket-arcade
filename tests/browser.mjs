// Optional integration check: PUPPETEER_MODULE may point to an external puppeteer-core install.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { exerciseOfflineUpdate } from './offline-update.mjs';
import { exerciseRecovery } from './recovery-browser.mjs';
import { bankShot, exerciseBankshot } from './bankshot-browser.mjs';
const { default: puppeteer } = await import(process.env.PUPPETEER_MODULE || 'puppeteer-core');
const base = process.env.ARCADE_URL || 'http://127.0.0.1:4173/';
const output = process.env.ARCADE_REPORT || '/tmp/pocket-arcade-validation';
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM || '/snap/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = [], external = [], checks = [];
const record = check => { checks.push(check); console.log(`PASS: ${check.name}`); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function monitor(target, allowedBase) {
  target.on('pageerror', e => errors.push(e.message));
  target.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  target.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  target.on('requestfailed', r => {
    // A tab can cancel its favicon request while navigating or closing.
    if (r.failure()?.errorText === 'net::ERR_ABORTED' && r.url().endsWith('/favicon.svg')) return;
    errors.push(`${r.failure()?.errorText} ${r.url()}`);
  });
  target.on('request', r => { if (!r.url().startsWith(allowedBase) && !r.url().startsWith('data:')) external.push(r.url()); });
}
monitor(page, base);
const go = path => page.goto(base + path, { waitUntil: 'networkidle0' });
const back = async () => { await Promise.all([page.waitForNavigation({waitUntil:'networkidle0'}), page.click('.arcade-back')]); assert.equal(await page.locator('.game-card').wait().then(()=>page.$$eval('.game-card', cards=>cards.length)), 4); };
const snap = () => page.evaluate(() => window.arcadeSnapshot());
const waitTime = time => page.waitForFunction(t => window.arcadeSnapshot().time >= t, {timeout:20000}, time);
async function skyLand(input = 'keyboard', target = 0) {
  const height = (await snap()).height;
  await page.waitForFunction(target => {
    const g = window.arcadeSnapshot();
    return g.mode === 'playing' && g.cooldown === 0 && Math.abs(g.active.offset - target) < .075;
  }, {polling:'raf', timeout:15000}, target);
  if (input === 'touch') await page.touchscreen.tap(195, 490);
  else if (input === 'pointer') await page.mouse.click(660, 520);
  else await page.keyboard.press('Space');
  await page.waitForFunction(h => window.arcadeSnapshot().height > h || window.arcadeSnapshot().mode === 'falling', {}, height);
  assert.equal((await snap()).mode, 'playing');
}
async function visibleWithin(selector) {
  return page.$eval(selector, e => {
    const b = e.getBoundingClientRect();
    return b.width > 0 && b.height > 0 && b.top >= 0 && b.left >= 0 && b.bottom <= innerHeight && b.right <= innerWidth;
  });
}
try {
  await page.setViewport({width:1366,height:768,deviceScaleFactor:1});
  await go('');
  await page.waitForFunction(() => document.querySelector('#offline-status').textContent === 'All four games ready offline');
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  const metadata = await page.evaluate(async () => {
    const manifestURL = document.querySelector('link[rel="manifest"]').href;
    const manifest = await (await fetch(manifestURL)).json();
    const registration = await navigator.serviceWorker.ready;
    const icons = await Promise.all(manifest.icons.map(async icon => {
      const img = new Image(); img.src = new URL(icon.src, manifestURL).href;
      await img.decode();
      return { url: img.src, width: img.naturalWidth, height: img.naturalHeight };
    }));
    return { manifestURL, scope: registration.scope, worker: registration.active.scriptURL,
      id: new URL(manifest.id, manifestURL).href, start: new URL(manifest.start_url, manifestURL).href,
      manifestScope: new URL(manifest.scope, manifestURL).href, display: manifest.display, icons,
      registrations: (await navigator.serviceWorker.getRegistrations()).map(r => r.scope) };
  });
  assert.equal(metadata.manifestURL, `${base}manifest.webmanifest`);
  for (const key of ['scope', 'id', 'start', 'manifestScope']) assert.equal(metadata[key], base);
  assert.equal(metadata.worker, `${base}sw.js`);
  assert.deepEqual(metadata.registrations, [base]);
  assert.equal(metadata.display, 'standalone');
  assert.deepEqual(metadata.icons.map(icon => [icon.width, icon.height]), [[192, 192], [512, 512]]);
  assert.ok(metadata.icons.every(icon => icon.url.startsWith(base)));
  const installClient = await page.createCDPSession();
  const installability = await installClient.send('Page.getInstallabilityErrors');
  assert.deepEqual(installability.installabilityErrors, []);
  await installClient.detach();
  record({name:'project-scoped manifest, decoded install icons, worker registration, Chrome installability', metadata, installability});
  await page.screenshot({path:`${output}/arcade.png`,fullPage:true});
  const cached = await page.evaluate(async () => { const cache = await caches.open((await caches.keys())[0]); return (await cache.keys()).map(r=>new URL(r.url).pathname); });
  assert.ok(cached.every(path => path.startsWith(new URL(base).pathname)));
  assert.ok(cached.some(p=>p.endsWith('voidline.html')) && cached.some(p=>p.endsWith('ring-riot.html')) && cached.some(p=>p.endsWith('skyslice.html')) && cached.some(p=>p.endsWith('bankshot.html')));
  record({name:'initial home load precaches all four unvisited games',files:cached.length});

  // Disable HTTP cache too: offline navigation must be supplied by the worker.
  await page.setCacheEnabled(false);
  await page.setOfflineMode(true);
  let response = await page.reload({waitUntil:'networkidle0'});
  assert.equal(response.fromServiceWorker(),true);
  await Promise.all([page.waitForNavigation({waitUntil:'networkidle0'}),page.click('.voidline')]);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => Number(document.querySelector('#score').textContent) > 0);
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => !document.querySelector('#gameover-panel').classList.contains('hidden'));
  await page.keyboard.up('ArrowRight');
  await delay(750); await page.click('#restart-button');
  await page.waitForFunction(() => !document.querySelector('#hud').classList.contains('hidden'));
  response = await page.reload({waitUntil:'networkidle0'}); assert.ok(response.fromServiceWorker());
  await page.click('#start-button');
  await page.waitForFunction(() => Number(document.querySelector('#score').textContent) > 0);
  await back();
  await Promise.all([page.waitForNavigation({waitUntil:'networkidle0'}),page.click('.ringriot')]);
  await page.click('#start');
  await delay(2700); await page.keyboard.down('Space'); await delay(850); await page.keyboard.up('Space');
  await page.waitForFunction(() => Number(document.querySelector('#score').textContent.replaceAll(',','')) > 0);
  response = await page.reload({waitUntil:'networkidle0'}); assert.ok(response.fromServiceWorker());
  await page.click('#start');
  await back();
  await page.$eval('.skyslice', e => e.href += '?test');
  await Promise.all([page.waitForNavigation({waitUntil:'networkidle0'}),page.click('.skyslice')]);
  await page.keyboard.press('Enter');
  await skyLand();
  assert.ok((await snap()).score > 0);
  response = await page.reload({waitUntil:'networkidle0'}); assert.ok(response.fromServiceWorker());
  await page.click('#start'); await skyLand();
  await back();
  await page.$eval('.bankshot', e => e.href += '?test');
  await Promise.all([page.waitForNavigation({waitUntil:'networkidle0'}),page.click('.bankshot')]);
  await page.keyboard.press('Enter'); await bankShot(page);
  assert.ok((await snap()).score > 0);
  response = await page.reload({waitUntil:'networkidle0'}); assert.ok(response.fromServiceWorker());
  await page.click('#start'); await bankShot(page, 'keyboard'); await back();
  record({name:'HTTP cache + network disabled: home reload, all four unvisited games launch and score, all game pages reload, all return paths',passed:true});
  await page.setOfflineMode(false);

  await go('ring-riot.html?test'); await page.keyboard.press('Enter');
  await waitTime(2.6); await page.keyboard.down('Space');
  await page.waitForFunction(() => window.arcadeSnapshot().charge >= .8);
  await page.screenshot({path:`${output}/ring-riot-charge.png`});
  await page.keyboard.up('Space');
  await page.waitForFunction(() => window.arcadeSnapshot().kills >= 3);
  const scoring = await snap(); assert.ok(scoring.score >= 600); assert.ok(scoring.combo >= 3);
  await page.screenshot({path:`${output}/ring-riot-chain.png`});
  await page.keyboard.down('KeyD'); await delay(350); await page.keyboard.up('KeyD');
  assert.ok((await snap()).player.x > scoring.player.x + .7);
  await page.keyboard.press('KeyP'); const frozen = (await snap()).time; await delay(350);
  assert.equal((await snap()).time,frozen); await page.keyboard.press('Escape');
  await page.mouse.move(470,400); const beforePointer = (await snap()).player.x; await delay(450);
  assert.ok((await snap()).player.x < beforePointer - .5);
  const beforeBlast = (await snap()).blasts;
  await page.mouse.down(); await delay(850); await page.mouse.up(); await delay(150);
  assert.ok((await snap()).blasts > beforeBlast);
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.arcadeSnapshot().mode === 'dead');
  await page.keyboard.up('ArrowRight');
  assert.equal(await page.$eval('#results',e=>e.hidden), false);
  assert.equal(await page.$eval('#final-score',e=>Number(e.textContent.replaceAll(',',''))),(await snap()).score);
  await page.screenshot({path:`${output}/ring-riot-results.png`});
  await page.keyboard.press('Enter');
  assert.equal((await snap()).mode,'playing'); assert.equal((await snap()).score,0);
  // Exercise later-round rendering with real repeated input, without changing game state.
  while ((await snap()).time < 23 && (await snap()).mode === 'playing') {
    await page.keyboard.down('Space'); await delay(850); await page.keyboard.up('Space'); await delay(600);
  }
  const laterRound = await snap(); assert.equal(laterRound.mode,'playing'); assert.ok(laterRound.wave >= 2);
  await page.screenshot({path:`${output}/ring-riot-round2.png`});
  record({name:'real-time round-two pressure with repeated keyboard pulses',wave:laterRound.wave,time:laterRound.time,score:laterRound.score,drawCalls:laterRound.drawCalls,geometries:laterRound.geometries});
  await page.keyboard.press('KeyP');
  await page.setViewport({width:1024,height:600,deviceScaleFactor:1});
  await page.screenshot({path:`${output}/ring-riot-1024.png`});
  assert.ok(await page.$eval('.arcade-back',e=>e.getBoundingClientRect().right<=innerWidth));
  await page.keyboard.press('KeyP');
  await back();
  record({name:'RING RIOT keyboard/pointer, chain scoring, pause, loss/results, restart, navigation',score:scoring.score,combo:scoring.combo,drawCalls:scoring.drawCalls,triangles:scoring.triangles});

  // A real touch pointer via Chrome's input pipeline.
  await page.setViewport({width:960,height:600,deviceScaleFactor:1,hasTouch:true});
  await go('ring-riot.html?test'); await page.tap('#start');
  const client = await page.createCDPSession();
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:550,y:315,id:1}]});
  await delay(900); const touchCharge = await snap(); assert.ok(touchCharge.charge >= .7); assert.ok(touchCharge.player.x > .5);
  await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:600,y:340,id:1}]});
  await delay(150); await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await delay(150); assert.ok((await snap()).blasts > 0);
  await page.keyboard.press('KeyP');
  await page.setViewport({width:390,height:844,deviceScaleFactor:1,hasTouch:true});
  await page.screenshot({path:`${output}/ring-riot-portrait.png`});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false);
  await back();
  await go('voidline.html');
  await page.setViewport({width:960,height:600,deviceScaleFactor:1,hasTouch:true});
  await page.tap('#start-button');
  await page.waitForFunction(()=>Number(document.querySelector('#score').textContent)>0);
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:15,y:300,id:2}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForFunction(()=>!document.querySelector('#gameover-panel').classList.contains('hidden'));
  await delay(750); await page.tap('#restart-button');
  await page.screenshot({path:`${output}/voidline-960.png`});
  await back();
  record({name:'real touch charge/steer/release + VOIDLINE touch steering/restart + 1024×600, 960×600, 390×844 layouts',passed:true});

  // All opening layouts, plus explicit order and separation of VOIDLINE instructions.
  for (const [width,height] of [[1440,900],[1366,768],[1024,600],[390,844],[375,667]]) {
    await page.setViewport({width,height,deviceScaleFactor:1,hasTouch:width<500});
    await go('voidline.html');
    await delay(650);
    assert.ok(await visibleWithin('#start-button'));
    const boxes = await page.$$eval('#start-panel h1, #start-panel .tagline, #start-panel .controls, #start-panel .scoring-hint, #start-button', nodes => nodes.map(e=>{ const b=e.getBoundingClientRect(); return {top:b.top,bottom:b.bottom}; }));
    for (let i=1;i<boxes.length;i++) assert.ok(boxes[i].top >= boxes[i-1].bottom + 10);
    assert.equal(await page.$eval('#rotate-hint',e=>getComputedStyle(e).display),'none');
    await page.screenshot({path:`${output}/voidline-start-${width}.png`});
    await go('skyslice.html?test');
    assert.ok(await visibleWithin('#start'));
    assert.ok(await visibleWithin('.arcade-back'));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false);
    await page.screenshot({path:`${output}/skyslice-start-${width}.png`});
    await back();
    await page.screenshot({path:`${output}/arcade-${width}.png`,fullPage:true});
  }
  record({name:'VOIDLINE opening hierarchy / no text overlap + SKYSLICE + home layouts at 1440×900, 1366×768, 1024×600, 390×844, 375×667',passed:true});

  await page.setViewport({width:1366,height:768,deviceScaleFactor:1});
  await go('skyslice.html?test'); await page.keyboard.press('Enter');
  // A real keyboard cut, then keyboard/pointer timing through increasing speed.
  await skyLand('keyboard', .5);
  assert.ok((await snap()).top.w < 3.5);
  await page.screenshot({path:`${output}/skyslice-cut.png`});
  for (let i=0;i<13;i++) await skyLand(i%3 === 0 ? 'pointer' : 'keyboard');
  const tower = await snap();
  assert.ok(tower.height >= 14); assert.ok(tower.speed > 4.5); assert.ok(tower.perfects > 0);
  assert.equal(await page.$eval('#chapter', e=>e.textContent),'RISE 02');
  await page.screenshot({path:`${output}/skyslice-rise2.png`});
  await page.keyboard.press('KeyP'); const skyFrozen = (await snap()).time; await delay(350);
  assert.equal((await snap()).time, skyFrozen);
  await page.keyboard.press('Escape');
  const secondTab = await browser.newPage(); await secondTab.bringToFront();
  await delay(150); await page.bringToFront();
  assert.equal((await snap()).mode,'paused');
  await page.click('#resume');
  await page.click('#sound'); assert.equal(await page.$eval('#sound', e=>e.getAttribute('aria-pressed')),'true');
  await secondTab.close();
  await page.waitForFunction(()=>{const g=arcadeSnapshot(); return g.cooldown===0 && Math.abs(g.active.offset)>4.3;});
  await page.keyboard.press('Space');
  await page.waitForFunction(()=>arcadeSnapshot().mode==='dead');
  assert.ok(await visibleWithin('#restart'));
  const lost = await snap();
  assert.equal(await page.$eval('#final-height', e=>Number(e.textContent)),lost.height);
  assert.equal(await page.$eval('#final-score',e=>Number(e.textContent.replaceAll(',',''))),lost.score);
  await page.screenshot({path:`${output}/skyslice-results.png`});
  await page.keyboard.press('Enter');
  assert.equal((await snap()).height,0); assert.equal((await snap()).score,0);
  await page.waitForFunction(()=>Math.abs(arcadeSnapshot().active.offset)<.08);
  await page.keyboard.down('Space'); await delay(400);
  await page.keyboard.down('Space'); await page.keyboard.up('Space');
  assert.equal((await snap()).height,1); assert.equal((await snap()).mode,'playing');
  await go('skyslice.html?test');
  assert.equal(await page.$eval('#sound',e=>e.getAttribute('aria-pressed')),'true');
  await page.click('#start'); assert.ok(await page.$eval('#best',e=>Number(e.textContent.replaceAll(',',''))) >= lost.score);
  record({name:'SKYSLICE real keyboard/pointer: cut, perfects, 14 slabs / rise 2, pause/resume, blur pause, loss/results, immediate restart, best/mute persistence',...tower});

  await page.setViewport({width:390,height:844,deviceScaleFactor:1,hasTouch:true});
  await go('skyslice.html?test'); await page.tap('#start');
  await skyLand('touch'); await skyLand('touch');
  assert.equal((await snap()).height,2);
  await page.screenshot({path:`${output}/skyslice-touch.png`});
  await page.tap('#pause'); const touchFrozen=(await snap()).time;
  assert.equal(await page.$eval('#feedback',e=>getComputedStyle(e).visibility),'hidden');
  assert.equal(await page.$eval('#hud',e=>getComputedStyle(e).visibility),'hidden');
  await page.touchscreen.tap(190,500); await delay(200); assert.equal((await snap()).time,touchFrozen);
  assert.equal((await snap()).mode,'paused');
  await page.screenshot({path:`${output}/skyslice-pause-mobile.png`});
  await page.tap('#resume');
  await page.waitForFunction(()=>{const g=arcadeSnapshot();return g.cooldown===0&&Math.abs(g.active.offset)>4.3;});
  await page.touchscreen.tap(190,500); await page.waitForFunction(()=>arcadeSnapshot().mode==='dead');
  assert.equal(await page.$eval('#feedback',e=>getComputedStyle(e).visibility),'hidden');
  assert.equal(await page.$eval('#hud',e=>getComputedStyle(e).visibility),'hidden');
  await page.screenshot({path:`${output}/skyslice-results-mobile.png`});
  await page.tap('#restart'); assert.equal((await snap()).mode,'playing'); assert.equal((await snap()).height,0);
  await back();
  record({name:'SKYSLICE real Chrome touch: placement, pause/resume, failure, immediate restart, portrait gameplay/results',passed:true});

  await exerciseBankshot({page, browser, base, output, record, back});

  await exerciseOfflineUpdate({browser, base, monitor, record});
  await exerciseRecovery({browser, base, record});

  assert.deepEqual(errors,[]); assert.deepEqual(external,[]);
  record({name:'console/page/resource errors and external runtime requests',errors,external});
  await writeFile(`${output}/report.json`,JSON.stringify({date:new Date().toISOString(),base,checks},null,2));
  console.log(JSON.stringify({checks,output},null,2));
} finally { await browser.close(); }
