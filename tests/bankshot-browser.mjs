import assert from 'node:assert/strict';
import { aim, shoot, step, MAX_ANGLE } from '../src/bankshot/model.js';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const snap = page => page.evaluate(() => arcadeSnapshot());

// Plan from read-only observations; play via the browser's real input pipeline.
function chooseAngle(snapshot, worst = false) {
  let choice = { angle: 0, value: worst ? Infinity : -Infinity };
  for (let a = -MAX_ANGLE; a <= MAX_ANGLE; a += .026) {
    const trial = { ...structuredClone(snapshot), random: () => .4 };
    aim(trial, a); shoot(trial);
    for (let t = 0; t < 800 && trial.state === 'flying'; t++) step(trial, 1 / 120);
    const ids = new Set(trial.blocks.map(b => b.id));
    const value = trial.score - snapshot.score + snapshot.blocks.filter(b => !ids.has(b.id)).reduce((v, b) => v + (b.z + 6) * 160, 0);
    if (worst ? value < choice.value : value > choice.value) choice = { angle: a, value };
  }
  return choice.angle;
}
function screenPoint(s, angle) {
  const [o, ex, ez] = s.tableFrame;
  const distance = Math.min(4, Math.abs((Math.sign(Math.sin(angle)) * 5.15 - s.launchX) / (Math.sin(angle) || .001)));
  const x = s.launchX + Math.sin(angle) * distance, z = 4.7 - Math.cos(angle) * distance;
  return { x: o.x + (ex.x - o.x) * x + (ez.x - o.x) * z, y: o.y + (ex.y - o.y) * x + (ez.y - o.y) * z };
}
export async function bankShot(page, input = 'pointer', worst = false) {
  await page.waitForFunction(() => arcadeSnapshot().state === 'aiming');
  const s = await snap(page), angle = chooseAngle(s, worst);
  if (input === 'keyboard') {
    const key = angle > s.angle ? 'ArrowRight' : 'ArrowLeft';
    await page.keyboard.down(key);
    await page.waitForFunction((target, right) => right ? arcadeSnapshot().angle >= target : arcadeSnapshot().angle <= target, { polling: 'raf' }, angle, key === 'ArrowRight');
    await page.keyboard.up(key); await page.keyboard.press('Space');
  } else {
    const p = screenPoint(s, angle);
    if (input === 'touch') {
      const client = await page.createCDPSession();
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y + 15, id: 1 }] });
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y: p.y, id: 1 }] });
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await client.detach();
    } else { await page.mouse.move(p.x, p.y + 15); await page.mouse.down(); await page.mouse.move(p.x, p.y); await page.mouse.up(); }
  }
  await page.waitForFunction(n => arcadeSnapshot().shots > n, {}, s.shots);
  await page.waitForFunction(n => arcadeSnapshot().round > n || arcadeSnapshot().state === 'dead', { timeout: 15000 }, s.round);
  return snap(page);
}

export async function exerciseBankshot({ page, browser, base, output, record, back }) {
  const go = () => page.goto(`${base}bankshot.html?test`, { waitUntil: 'networkidle0' });
  const visible = selector => page.$eval(selector, e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.top >= 0 && b.left >= 0 && b.bottom <= innerHeight && b.right <= innerWidth; });
  for (const [width, height] of [[1440, 900], [1366, 768], [1024, 600], [390, 844], [375, 667]]) {
    await page.setViewport({ width, height, deviceScaleFactor: 1, hasTouch: width < 500 }); await go();
    assert.ok(await visible('#start')); assert.ok(await visible('.arcade-back'));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const boxes = await page.$$eval('#intro .eyebrow, #intro h1, #intro .tagline, #intro .premise, #intro .how, #intro .hook, #start', nodes => nodes.map(e => { const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom }; }));
    for (let i = 1; i < boxes.length; i++) assert.ok(boxes[i].top >= boxes[i - 1].bottom + 8);
    await page.screenshot({ path: `${output}/bankshot-start-${width}.png` });
    await page.click('#start'); assert.ok(await visible('#fire'));
    const board = await snap(page);
    const ui = await page.$eval('#shot-ui', e => e.getBoundingClientRect().top);
    assert.ok(board.tableCorners.every(p => p.x > 0 && p.x < width && p.y > 60 && p.y < ui));
    await page.screenshot({ path: `${output}/bankshot-play-${width}.png` });
  }
  record({ name: 'BANKSHOT opening hierarchy and complete table/control bounds at 1440×900, 1366×768, 1024×600, 390×844, 375×667', passed: true });

  await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1, hasTouch: false }); await go();
  await page.keyboard.press('Enter'); assert.equal((await snap(page)).shots, 0);
  const firstAngle = (await snap(page)).angle;
  await page.keyboard.down('KeyA'); await delay(220); await page.keyboard.up('KeyA'); assert.ok((await snap(page)).angle < firstAngle - .1);
  await page.keyboard.down('ShiftLeft'); const fine = (await snap(page)).angle;
  await page.keyboard.down('KeyD'); await delay(220); await page.keyboard.up('KeyD'); await page.keyboard.up('ShiftLeft');
  assert.ok((await snap(page)).angle > fine && (await snap(page)).angle < fine + .09);
  let run = await bankShot(page, 'keyboard'); assert.ok(run.score > 0);
  // Only one shot may occur while Space remains held, even after returning to aim.
  await page.keyboard.down('Space');
  await page.waitForFunction(n => arcadeSnapshot().round > n, { timeout: 15000 }, run.round);
  const shots = (await snap(page)).shots; await page.keyboard.down('Space'); await delay(150); await page.keyboard.up('Space');
  assert.equal((await snap(page)).shots, shots);
  let armored = false;
  while ((await snap(page)).round < 11) {
    run = await bankShot(page); assert.equal(run.mode, 'playing'); armored ||= run.blocks.some(b => b.hp === 2);
    if (run.round === 7) await page.screenshot({ path: `${output}/bankshot-rack7.png` });
  }
  assert.ok(run.bestChain >= 2); assert.ok(run.banked > 0); assert.ok(armored);
  assert.ok(run.blocks.filter(b => b.z === -4.55).length === 5);
  await page.screenshot({ path: `${output}/bankshot-rack11.png` });

  await page.keyboard.press('Space'); await delay(120); await page.keyboard.press('KeyP');
  const frozen = await snap(page); await delay(350); assert.equal((await snap(page)).time, frozen.time);
  assert.equal((await snap(page)).mode, 'paused'); await page.keyboard.press('Escape');
  await page.waitForFunction(() => arcadeSnapshot().state === 'aiming', { timeout: 15000 });
  const tab = await browser.newPage(); await tab.bringToFront(); await delay(150); await page.bringToFront();
  assert.equal((await snap(page)).mode, 'paused'); await page.click('#resume'); await tab.close();
  await page.click('#sound'); assert.equal(await page.$eval('#sound', e => e.getAttribute('aria-pressed')), 'true');
  for (let i = 0; i < 15 && (await snap(page)).mode === 'playing'; i++) await bankShot(page, 'pointer', true);
  const lost = await snap(page); assert.equal(lost.mode, 'dead'); assert.ok(await visible('#restart'));
  assert.equal(await page.$eval('#final-score', e => Number(e.textContent.replaceAll(',', ''))), lost.score);
  await page.screenshot({ path: `${output}/bankshot-results.png` });
  await page.keyboard.press('Enter'); const fresh = await snap(page);
  assert.equal(fresh.mode, 'playing'); assert.equal(fresh.score, 0); assert.equal(fresh.round, 1); assert.equal(fresh.shots, 0);
  await go(); await page.click('#start');
  assert.ok(await page.$eval('#best', e => Number(e.textContent.replaceAll(',', ''))) >= lost.score);
  assert.equal(await page.$eval('#sound', e => e.getAttribute('aria-pressed')), 'true');
  record({ name: 'BANKSHOT real keyboard/pointer: aiming, fine control, held-key rejection, rack 11 density/armor, chains, banks, flight pause, blur pause, failure, results, restart and local records', score: run.score, round: run.round, breaks: run.broken, bestChain: run.bestChain, banked: run.banked, drawCalls: run.drawCalls, triangles: run.triangles, geometries: run.geometries, finalScore: lost.score });

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, hasTouch: true }); await go(); await page.tap('#start');
  const touch = await bankShot(page, 'touch'); assert.ok(touch.score > 0);
  await page.screenshot({ path: `${output}/bankshot-touch.png` });
  const client = await page.createCDPSession(); let s = await snap(page), p = screenPoint(s, .2);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y, id: 1 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  assert.equal((await snap(page)).shots, s.shots);
  // A second contact cannot create a second shot.
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y, id: 1 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y, id: 1 }, { x: 240, y: 370, id: 2 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.equal((await snap(page)).shots, s.shots + 1);
  await page.tap('#pause'); const time = (await snap(page)).time; await delay(200);
  assert.equal((await snap(page)).time, time); assert.equal((await snap(page)).mode, 'paused');
  await page.screenshot({ path: `${output}/bankshot-pause-mobile.png` });
  await page.tap('#resume'); await page.waitForFunction(() => arcadeSnapshot().state === 'aiming', { timeout: 15000 });
  // Pointer capture clears on blur and holding an aim button never fires a shot.
  s = await snap(page); await page.mouse.move(p.x, p.y); await page.mouse.down();
  await page.keyboard.press('KeyP'); await page.keyboard.press('KeyP'); await page.mouse.up();
  assert.equal((await snap(page)).shots, s.shots);
  const beforeNudge = (await snap(page)).angle;
  const nudge = beforeNudge > 0 ? 'aim-left' : 'aim-right';
  await page.tap(`#${nudge}`);
  assert.ok(nudge === 'aim-left' ? (await snap(page)).angle < beforeNudge : (await snap(page)).angle > beforeNudge);
  await page.tap('#fire'); assert.equal((await snap(page)).shots, s.shots + 1);
  await page.waitForFunction(() => arcadeSnapshot().state === 'aiming', { timeout: 15000 });
  for (let i = 0; i < 12 && (await snap(page)).mode === 'playing'; i++) await bankShot(page, 'pointer', true);
  assert.equal((await snap(page)).mode, 'dead'); assert.ok(await visible('#restart'));
  await page.screenshot({ path: `${output}/bankshot-results-mobile.png` });
  await page.tap('#restart'); assert.equal((await snap(page)).score, 0); assert.equal((await snap(page)).shots, 0);
  await client.detach(); await back();
  record({ name: 'BANKSHOT portrait touch drag/release, cancel, multi-touch, pause/resume, aim/fire buttons, failure, restart and arcade return', passed: true });
}
