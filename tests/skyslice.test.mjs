import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, place, MAX_WIDTH, TRAVEL } from '../src/skyslice/model.js';
const tick = (g, seconds) => { for (let i = 0; i < Math.round(seconds * 120); i++) step(g, 1 / 120); };
function land(g, delta = 0) { tick(g, .25); g.active[g.active.axis] = g.top[g.active.axis] + delta; return place(g); }

test('slab bounces at rail ends and identical input is independent of render frame rate', () => {
  const a = createGame(() => .2), b = createGame(() => .2);
  for (let i = 0; i < 600; i++) step(a, 1 / 60);
  for (let i = 0; i < 1200; i++) step(b, 1 / 120);
  assert.ok(Math.abs(a.active.x - b.active.x) < 1e-10);
  assert.ok(Math.abs(a.active.offset) <= TRAVEL);
  assert.ok(a.active.direction === -1 || a.active.direction === 1);
});
test('normal timed input lands flush; alternates axes and scores a streak', () => {
  const g = createGame(() => .2);
  tick(g, 1.5); const first = place(g);
  assert.equal(first.perfect, true); assert.equal(g.score, 150); assert.equal(g.height, 1);
  assert.equal(g.active.axis, 'z'); assert.equal(g.top.w, MAX_WIDTH);
  tick(g, .25);
  while (Math.abs(g.active.offset) > .06) step(g, 1 / 120);
  assert.equal(place(g).perfect, true); assert.equal(g.score, 350); assert.equal(g.streak, 2);
});
test('positive and negative overhangs conserve width and have exact adjacent cut edges', () => {
  for (const delta of [-.8, .8]) {
    const g = createGame(); const event = land(g, delta);
    assert.equal(event.perfect, false);
    assert.ok(Math.abs(event.slab.w + event.cut.w - MAX_WIDTH) < 1e-10);
    assert.ok(Math.abs(event.slab.x - delta / 2) < 1e-10);
    assert.ok(Math.abs(Math.abs(event.cut.x - event.slab.x) - MAX_WIDTH / 2) < 1e-10);
    assert.equal(g.top.d, MAX_WIDTH); assert.equal(g.score, 100);
    const second = land(g, delta); assert.equal(second.slab.w, event.slab.w);
    assert.ok(Math.abs(second.slab.d - (MAX_WIDTH - Math.abs(delta))) < 1e-10);
  }
});
test('three perfects regrow a damaged top, stay bounded, and a cut breaks the streak', () => {
  const g = createGame(); land(g, .8);
  land(g); land(g); const repair = land(g);
  assert.equal(repair.repair, true); assert.equal(g.repairs, 1); assert.equal(g.streak, 3);
  assert.ok(Math.abs(g.top.w - 3.28) < 1e-10); assert.equal(g.top.d, MAX_WIDTH);
  for (let i = 0; i < 20; i++) land(g);
  assert.equal(g.top.w, MAX_WIDTH); assert.equal(g.top.d, MAX_WIDTH);
  land(g, .2); assert.equal(g.streak, 0); assert.equal(g.bestStreak, 23);
});
test('settling rejects double placement and a total miss is terminal', () => {
  const g = createGame(); land(g); const score = g.score;
  assert.equal(place(g), null); assert.equal(g.score, score);
  tick(g, .25); g.active.z = g.top.z + MAX_WIDTH;
  assert.equal(place(g).type, 'miss'); assert.equal(g.state, 'dead'); assert.equal(g.height, 1);
  const frozen = JSON.stringify(g); tick(g, 2); place(g); assert.equal(JSON.stringify(g), frozen);
  const next = createGame(); assert.equal(next.score, 0); assert.equal(next.height, 0); assert.equal(next.streak, 0); assert.equal(next.top.w, MAX_WIDTH);
});
test('progressive imperfect landings narrow both axes and end the run', () => {
  const g = createGame();
  while (g.state === 'playing') { land(g, .48); assert.ok(g.height < 20); }
  assert.equal(g.height, 14); assert.ok(g.top.w > 0 && g.top.d > 0);
  assert.ok(g.speed > 3.2); assert.equal(g.perfects, 0);
});
test('long perfect run caps speed, keeps scores finite, and cannot gain oversized slabs', () => {
  const g = createGame();
  for (let i = 0; i < 500; i++) land(g);
  assert.equal(g.height, 500); assert.equal(g.speed, 7.8);
  assert.equal(g.top.w, MAX_WIDTH); assert.equal(g.top.d, MAX_WIDTH);
  assert.ok(Number.isFinite(g.score) && g.score > 50000);
});
