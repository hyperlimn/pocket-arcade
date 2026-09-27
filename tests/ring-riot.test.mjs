import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, spawnEnemy, step, pulse, CHARGE_TIME } from '../src/ring-riot/model.js';
const tick = (game, seconds, input = {}) => {
  for (let i = 0; i < Math.round(seconds * 120); i++) step(game, 1 / 120, typeof input === 'function' ? input(i) : input);
};
function emptyArena() { const g = createGame(() => .7); g.enemies = []; g.events = []; g.spawnTimer = 1000; return g; }

test('diagonal motion is normalized and charging imposes a real movement tradeoff', () => {
  const a = emptyArena(), b = emptyArena(), c = emptyArena();
  tick(a, .8, { x: 1 }); tick(b, .8, { x: 1, z: 1 }); tick(c, .8, { x: 1, held: true });
  assert.ok(Math.abs(Math.hypot(b.player.x, b.player.z - 1) - a.player.x) < .001);
  assert.ok(c.player.x < a.player.x * .55);
  assert.ok(Math.abs(c.charge - CHARGE_TIME) < 1e-10);
});
test('hold builds charge, release blasts once, cooldown prevents immediate second blast', () => {
  const g = emptyArena();
  tick(g, 1, { held: true }); assert.equal(g.blasts, 0);
  tick(g, .01); assert.equal(g.blasts, 1); assert.equal(g.charge, 0);
  tick(g, .1, { held: true }); tick(g, .01); assert.equal(g.blasts, 1);
  tick(g, .5, { held: true }); tick(g, .01); assert.equal(g.blasts, 2);
});
test('opening trio can be knocked out through normal timed input and score a chain', () => {
  const g = createGame(() => .7);
  tick(g, 2.6); tick(g, .85, { held: true }); tick(g, 1.3);
  assert.ok(g.kills >= 3); assert.ok(g.score >= 600); assert.ok(g.bestCombo >= 3);
  assert.equal(g.state, 'playing');
});
test('charge range is honest and heavies resist a full blast', () => {
  const g = emptyArena();
  const near = spawnEnemy(g, 0, false), far = spawnEnemy(g, 1, false), heavy = spawnEnemy(g, 2, true);
  Object.assign(near, { x: 2, z: 1, warning: 0 });
  Object.assign(far, { x: 5, z: 1, warning: 0 });
  Object.assign(heavy, { x: -2, z: 1, warning: 0 });
  g.charge = CHARGE_TIME; pulse(g);
  assert.ok(near.vx > 10); assert.equal(far.vx, 0);
  assert.ok(Math.abs(heavy.vx) < near.vx * .4);
});
test('untagged falls do not grant points; old chains expire', () => {
  const g = emptyArena();
  let e = spawnEnemy(g, 0); Object.assign(e, { x: 7.2, z: 0, warning: 0 });
  tick(g, .01); assert.equal(g.score, 0);
  e = spawnEnemy(g, 0); Object.assign(e, { x: 7.2, z: 0, warning: 0, tagged: g.time });
  tick(g, .01); assert.equal(g.score, 100);
  tick(g, 2.1);
  e = spawnEnemy(g, 0); Object.assign(e, { x: 7.2, z: 0, warning: 0, tagged: g.time });
  tick(g, .01); assert.equal(g.score, 200); assert.equal(g.combo, 1);
});
test('ring-out is terminal and a fresh game resets run state', () => {
  const g = emptyArena(); tick(g, 3, { x: 1 });
  assert.equal(g.state, 'dead');
  const time = g.time; tick(g, 3); assert.equal(g.time, time);
  const fresh = createGame(); assert.equal(fresh.time, 0); assert.equal(fresh.score, 0); assert.equal(fresh.state, 'playing');
});
test('long seeded run stays finite, enemies stay bounded, rounds progress', () => {
  let seed = 20;
  const g = createGame(() => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; });
  for (let i = 0; i < 180 * 120 && g.state === 'playing'; i++) {
    step(g, 1 / 120, { held: i % 180 < 100 });
    assert.ok(g.enemies.length <= 18);
    for (const b of [g.player, ...g.enemies]) assert.ok([b.x, b.z, b.vx, b.vz].every(Number.isFinite));
    g.events.length = 0;
  }
  assert.ok(g.wave >= 3); assert.ok(g.score > 0); assert.equal(g.state, 'dead');
});
