// Small fixed-step arena simulation. No rendering or browser dependencies.
export const ARENA_RADIUS = 6.8;
export const CHARGE_TIME = 0.8;
export function createGame(random = Math.random) {
  const game = {
    random, state: 'playing', time: 0, score: 0, kills: 0, combo: 0, bestCombo: 0,
    lastKill: -10, wave: 1, spawnTimer: 2, serial: 0, charge: 0, cooldown: 0,
    wasHeld: false, blasts: 0, enemies: [], events: [],
    player: { id: 'player', x: 0, z: 1, vx: 0, vz: 0, radius: .48, mass: 1 },
  };
  for (const angle of [-Math.PI / 2, -.3, -2.8]) spawnEnemy(game, angle, false);
  return game;
}
export function spawnEnemy(game, angle = game.random() * Math.PI * 2, heavy = game.wave >= 2 && game.random() < Math.min(.5, .26 + game.wave * .035)) {
  const enemy = {
    id: ++game.serial, x: Math.cos(angle) * 5.9, z: Math.sin(angle) * 5.9,
    vx: 0, vz: 0, radius: heavy ? .68 : .46, mass: heavy ? 2.5 : .85,
    heavy, warning: 1, stun: 0, tagged: -10,
  };
  game.enemies.push(enemy);
  game.events.push({ type: 'spawn', enemy });
  return enemy;
}
export function pulse(game) {
  const power = Math.min(1, game.charge / CHARGE_TIME);
  const radius = 1.35 + power * 2.25;
  let hits = 0;
  for (const enemy of game.enemies) {
    if (enemy.warning > 0) continue;
    let dx = enemy.x - game.player.x;
    let dz = enemy.z - game.player.z;
    const distance = Math.hypot(dx, dz);
    if (distance > radius + enemy.radius) continue;
    if (distance < .001) { dx = 1; dz = 0; }
    const length = Math.hypot(dx, dz);
    const force = (5 + power * 11) * (1 - Math.min(1, distance / (radius + enemy.radius)) * .22) / enemy.mass;
    enemy.vx += dx / length * force;
    enemy.vz += dz / length * force;
    enemy.stun = (.35 + power * .35) / (enemy.heavy ? 1.8 : 1);
    enemy.tagged = game.time;
    hits++;
  }
  game.blasts++;
  game.events.push({ type: 'pulse', x: game.player.x, z: game.player.z, radius, power, hits });
  game.cooldown = .48;
  game.charge = 0;
}
function collide(a, b, game) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const distance = Math.hypot(dx, dz);
  const overlap = a.radius + b.radius - distance;
  if (overlap <= 0) return;
  const nx = distance > .0001 ? dx / distance : 1;
  const nz = distance > .0001 ? dz / distance : 0;
  const invA = 1 / a.mass, invB = 1 / b.mass;
  const sum = invA + invB;
  a.x -= nx * overlap * invA / sum;
  a.z -= nz * overlap * invA / sum;
  b.x += nx * overlap * invB / sum;
  b.z += nz * overlap * invB / sum;
  const relative = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
  if (relative < 0) {
    const impulse = -(1.55 * relative) / sum;
    a.vx -= impulse * nx * invA; a.vz -= impulse * nz * invA;
    b.vx += impulse * nx * invB; b.vz += impulse * nz * invB;
    if (a.id === 'player' && relative < -1.5) game.events.push({ type: 'bump', strength: -relative });
    // Credit chain collisions from a recently blasted rival.
    if (a.id !== 'player' && Math.max(a.tagged, b.tagged) > game.time - 3) {
      a.tagged = b.tagged = game.time;
      a.stun = Math.max(a.stun, .15); b.stun = Math.max(b.stun, .15);
    }
  }
}
export function step(game, dt, input = {}) {
  if (game.state !== 'playing') return;
  game.time += dt;
  const wave = 1 + Math.floor(game.time / 18);
  if (wave !== game.wave) { game.wave = wave; game.events.push({ type: 'wave', wave }); }
  game.cooldown = Math.max(0, game.cooldown - dt);
  const held = Boolean(input.held);
  if (held && game.cooldown <= 0) game.charge = Math.min(CHARGE_TIME, game.charge + dt);
  if (!held && game.wasHeld && game.charge > 0) pulse(game);
  game.wasHeld = held;
  const player = game.player;
  let mx = input.x || 0, mz = input.z || 0;
  const length = Math.max(1, Math.hypot(mx, mz));
  const speed = game.charge > 0 ? 2.9 : 6.1;
  const steer = 1 - Math.exp(-7 * dt);
  player.vx += (mx / length * speed - player.vx) * steer;
  player.vz += (mz / length * speed - player.vz) * steer;
  player.x += player.vx * dt; player.z += player.vz * dt;
  for (const enemy of game.enemies) {
    if (enemy.warning > 0) { enemy.warning -= dt; continue; }
    enemy.stun = Math.max(0, enemy.stun - dt);
    if (enemy.stun === 0) {
      const dx = player.x - enemy.x, dz = player.z - enemy.z;
      const d = Math.hypot(dx, dz) || 1;
      const accel = (enemy.heavy ? 3.3 : 3.2) + Math.min(3.5, (game.wave - 1) * .4);
      enemy.vx += dx / d * accel * dt; enemy.vz += dz / d * accel * dt;
    }
    const drag = Math.exp(-(enemy.stun > 0 ? .85 : 1.25) * dt);
    enemy.vx *= drag; enemy.vz *= drag;
    enemy.x += enemy.vx * dt; enemy.z += enemy.vz * dt;
    collide(player, enemy, game);
  }
  for (let i = 0; i < game.enemies.length; i++) {
    const a = game.enemies[i];
    if (a.warning > 0) continue;
    for (let j = i + 1; j < game.enemies.length; j++) {
      const b = game.enemies[j];
      if (b.warning <= 0) collide(a, b, game);
    }
  }
  for (let i = game.enemies.length - 1; i >= 0; i--) {
    const enemy = game.enemies[i];
    if (enemy.warning > 0 || Math.hypot(enemy.x, enemy.z) < ARENA_RADIUS + .15) continue;
    let award = 0;
    if (enemy.tagged > game.time - 5) {
      game.combo = game.time - game.lastKill < 2 ? Math.min(8, game.combo + 1) : 1;
      game.bestCombo = Math.max(game.combo, game.bestCombo);
      game.lastKill = game.time;
      game.kills++;
      award = (enemy.heavy ? 200 : 100) * game.combo;
      game.score += award;
    }
    game.events.push({ type: 'knockout', enemy, award, combo: game.combo });
    game.enemies.splice(i, 1);
  }
  if (Math.hypot(player.x, player.z) > ARENA_RADIUS + .05) {
    game.state = 'dead';
    game.events.push({ type: 'end' });
    return;
  }
  game.spawnTimer -= dt;
  if (game.spawnTimer <= 0) {
    if (game.enemies.length < 18) {
      spawnEnemy(game);
      if (game.wave >= 2 && game.random() < .5 && game.enemies.length < 18) spawnEnemy(game);
    }
    game.spawnTimer = Math.max(.48, 1.8 - game.time * .021);
  }
}
