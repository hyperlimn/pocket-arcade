import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, aim, shoot, step, guide, MAX_ANGLE, HALF_WIDTH, RADIUS, SHOT_SECONDS, LIMIT, BLOCK_D } from '../src/bankshot/model.js';

const seeded = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const resolve = (game, dt = 1 / 120) => {
  const events = [];
  for (let i = 0; i < 1200 && ['flying', 'settling'].includes(game.state); i++) events.push(...step(game, dt));
  assert.ok(['aiming', 'dead'].includes(game.state)); return events;
};

test('opening, aim limits, guide, shot start and repeated input rejection', () => {
  const g = createGame(seeded(7)); assert.equal(g.blocks.length, 6); assert.equal(g.state, 'aiming');
  aim(g, 99); assert.equal(g.angle, MAX_ANGLE); aim(g, NaN); assert.equal(g.angle, MAX_ANGLE);
  const points = guide(g); assert.ok(points.length >= 2 && points.length <= 4);
  assert.deepEqual(points[0], { x: 0, z: 4.7 });
  assert.equal(shoot(g), true); assert.equal(shoot(g), false); assert.equal(g.shots, 1);
  aim(g, -1); assert.equal(g.angle, MAX_ANGLE);
  resolve(g); assert.equal(g.round, 2); assert.equal(g.shots, 1);
});

test('straight hit, score, block removal, return location and advance happen through flight', () => {
  const g = createGame(seeded(2));
  g.blocks = [{ id: 1, x: 0, z: -1, hp: 1 }, { id: 2, x: 3, z: -4.55, hp: 1 }];
  aim(g, 0); shoot(g); const events = resolve(g);
  assert.equal(g.broken, 1); assert.equal(g.score, 100); assert.equal(g.bestChain, 1);
  assert.equal(events.filter(e => e.type === 'break').length, 1); assert.equal(g.launchX, 0);
  assert.ok(Math.abs(g.blocks.find(b => b.id === 2).z + 3.39) < 1e-10); assert.equal(g.round, 2);
});

test('a deliberate side-rail shot earns a bank bonus and a multi-break chain', () => {
  const g = createGame(seeded(19));
  // Search legal inputs, then reproduce the chosen angle without state intervention.
  let chosen;
  for (let angle = -MAX_ANGLE; angle <= MAX_ANGLE; angle += .025) {
    const trial = createGame(seeded(19)); aim(trial, angle); shoot(trial); const events = resolve(trial);
    if (trial.banked > 0 && trial.bestChain >= 2) { chosen = { angle, score: trial.score, events }; break; }
  }
  assert.ok(chosen); aim(g, chosen.angle); shoot(g); resolve(g);
  assert.equal(g.score, chosen.score); assert.ok(g.score >= 350); assert.ok(g.bestChain >= 2);
  assert.ok(chosen.events.some(e => e.type === 'bank'));
});

test('two-hit blocks reflect each collision and only break on their second hit', () => {
  const g = createGame(seeded(4)); g.blocks = [{ id: 1, x: 0, z: -1, hp: 2 }];
  aim(g, 0); shoot(g); const events = resolve(g);
  assert.equal(events.filter(e => e.type === 'hit').length, 1); assert.equal(g.score, 25);
  assert.equal(g.blocks.find(b => b.id === 1).hp, 1); assert.equal(g.broken, 0);
  aim(g, 0); shoot(g); resolve(g); assert.equal(g.broken, 1); assert.equal(g.score, 125);
});

test('flight is consistent at common frame rates and terminates within its charge', () => {
  const outcomes = [1 / 30, 1 / 60, 1 / 120].map(dt => {
    const g = createGame(seeded(23)); aim(g, .8); shoot(g); resolve(g, dt); return g;
  });
  for (const g of outcomes) {
    assert.equal(g.score, outcomes[0].score); assert.equal(g.broken, outcomes[0].broken);
    assert.ok(Math.abs(g.launchX - outcomes[0].launchX) < .015); assert.ok(g.shotTime <= SHOT_SECONDS + 1 / 240 + 1e-6);
  }
  const g = createGame(seeded(2)); shoot(g); g.ball.vz = 0; g.ball.vx = 14;
  resolve(g); assert.equal(g.state, 'aiming'); assert.ok(g.shotTime >= SHOT_SECONDS);
});

test('crossing the striped line ends the run; terminal state is immutable and restart clean', () => {
  const g = createGame(seeded(8)); g.blocks = [{ id: 1, x: -3.6, z: 2.4, hp: 2 }];
  aim(g, 0); shoot(g); const events = resolve(g);
  assert.equal(g.state, 'dead'); assert.ok(events.some(e => e.type === 'dead'));
  const before = JSON.stringify(g); assert.equal(shoot(g), false); aim(g, 1); step(g, .1); assert.equal(JSON.stringify(g), before);
  const fresh = createGame(); assert.equal(fresh.score, 0); assert.equal(fresh.round, 1); assert.equal(fresh.shots, 0);
});

test('racks escalate density and armor; 200 independent runs keep finite, bounded state', () => {
  let armor = false, dense = false, deaths = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const random = seeded(seed), g = createGame(random);
    for (let shot = 0; shot < 30 && g.state !== 'dead'; shot++) {
      aim(g, (random() * 2 - 1) * MAX_ANGLE); shoot(g); resolve(g);
      assert.ok(g.blocks.length <= 40);
      assert.ok(Math.abs(g.launchX) <= HALF_WIDTH - RADIUS);
      assert.ok(Number.isFinite(g.ball.x) && Number.isFinite(g.ball.z));
      assert.ok(g.blocks.every(b => b.hp > 0 && b.hp <= 2 && b.z + BLOCK_D / 2 < LIMIT + 1.17));
      assert.ok(g.bestChain <= g.broken); assert.ok(g.score >= 0);
      if (g.round >= 6) { armor ||= g.blocks.some(b => b.hp === 2); dense ||= g.blocks.filter(b => b.z === -4.55).length >= 4; }
    }
    if (g.state === 'dead') deaths++;
  }
  assert.ok(armor && dense); assert.ok(deaths > 190);
});
