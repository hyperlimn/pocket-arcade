export const HALF_WIDTH = 4.5;
export const TOP = -5.5;
export const LAUNCH_Z = 4.7;
export const LIMIT = 3.65;
export const RADIUS = .18;
export const BLOCK_W = 1.0;
export const BLOCK_D = .86;
export const ROW_STEP = 1.16;
export const MAX_ANGLE = Math.PI * .39;
export const SHOT_SECONDS = 6;
const SPEED = 14;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function createGame(random = Math.random) {
  const game = { state: 'aiming', time: 0, round: 1, score: 0, shots: 0, broken: 0,
    chain: 0, bestChain: 0, banked: 0, angle: .24, launchX: 0,
    ball: { x: 0, z: LAUNCH_Z, vx: 0, vz: 0 }, shotTime: 0, banks: 0,
    blocks: [], nextId: 0, random, transition: 0, lastShot: 0 };
  addRow(game, -4.55);
  addRow(game, -3.39);
  return game;
}

function addRow(game, z = -4.55) {
  const columns = Array.from({ length: 7 }, (_, i) => i);
  for (let i = columns.length - 1; i > 0; i--) {
    const j = Math.floor(game.random() * (i + 1));
    [columns[i], columns[j]] = [columns[j], columns[i]];
  }
  const count = Math.min(5, 3 + Math.floor((game.round - 1) / 5));
  for (const col of columns.slice(0, count)) {
    const hp = game.round >= 6 && game.random() < Math.min(.5, (game.round - 4) * .045) ? 2 : 1;
    game.blocks.push({ id: game.nextId++, x: (col - 3) * 1.2, z, hp });
  }
}

export function aim(game, angle) {
  if (game.state === 'aiming' && Number.isFinite(angle)) game.angle = clamp(angle, -MAX_ANGLE, MAX_ANGLE);
}

export function shoot(game) {
  if (game.state !== 'aiming') return false;
  game.state = 'flying'; game.shots++; game.shotTime = 0; game.chain = 0; game.banks = 0; game.lastShot = 0;
  game.ball = { x: game.launchX, z: LAUNCH_Z, vx: Math.sin(game.angle) * SPEED, vz: -Math.cos(game.angle) * SPEED };
  return true;
}

function returnBall(game, events, reason) {
  game.launchX = clamp(game.ball.x, -HALF_WIDTH + .35, HALF_WIDTH - .35);
  game.state = 'settling'; game.transition = .48;
  events.push({ type: 'return', reason, points: game.lastShot, chain: game.chain });
}

// Small bounded substeps and circle/box contacts prevent fast shots tunnelling.
function moveBall(game, dt, events) {
  const b = game.ball;
  b.x += b.vx * dt; b.z += b.vz * dt;
  let bank = false;
  if (b.x < -HALF_WIDTH + RADIUS && b.vx < 0) { b.x = -HALF_WIDTH + RADIUS; b.vx *= -1; bank = true; }
  if (b.x > HALF_WIDTH - RADIUS && b.vx > 0) { b.x = HALF_WIDTH - RADIUS; b.vx *= -1; bank = true; }
  if (b.z < TOP + RADIUS && b.vz < 0) { b.z = TOP + RADIUS; b.vz *= -1; bank = true; }
  if (bank) { game.banks++; events.push({ type: 'bank', x: b.x, z: b.z }); }
  for (let i = game.blocks.length - 1; i >= 0; i--) {
    const block = game.blocks[i];
    const cx = clamp(b.x, block.x - BLOCK_W / 2, block.x + BLOCK_W / 2);
    const cz = clamp(b.z, block.z - BLOCK_D / 2, block.z + BLOCK_D / 2);
    let nx = b.x - cx, nz = b.z - cz;
    let length = Math.hypot(nx, nz);
    if (length >= RADIUS) continue;
    // Also recover finite state if a caller supplies an overlapping center.
    if (length < 1e-8) { nx = -Math.sign(b.vx) || 1; nz = 0; length = 1; }
    nx /= length; nz /= length;
    const dot = b.vx * nx + b.vz * nz;
    b.x += nx * (RADIUS - Math.min(RADIUS, length) + .001);
    b.z += nz * (RADIUS - Math.min(RADIUS, length) + .001);
    if (dot >= 0) continue;
    b.vx -= 2 * dot * nx; b.vz -= 2 * dot * nz;
    block.hp--;
    const broken = block.hp === 0;
    if (broken) { game.blocks.splice(i, 1); game.broken++; game.chain++; }
    const banked = game.banks > 0;
    const points = broken ? 100 * Math.min(8, game.chain) + 50 * Math.min(3, game.banks) : 25;
    game.score += points; game.lastShot += points;
    if (banked && broken) game.banked++;
    game.bestChain = Math.max(game.bestChain, game.chain); game.banks = 0;
    events.push({ type: broken ? 'break' : 'hit', id: block.id, x: block.x, z: block.z, points, chain: game.chain, banked });
  }
  if (b.z >= LAUNCH_Z + .25 && b.vz > 0) returnBall(game, events, 'drain');
}

export function step(game, dt) {
  const events = [];
  if (game.state === 'dead' || !Number.isFinite(dt) || dt <= 0) return events;
  dt = Math.min(dt, .1);
  game.time += dt;
  if (game.state === 'settling') {
    game.transition = Math.max(0, game.transition - dt);
    if (game.transition === 0) {
      for (const block of game.blocks) block.z += ROW_STEP;
      if (game.blocks.some(b => b.z + BLOCK_D / 2 >= LIMIT)) {
        game.state = 'dead'; events.push({ type: 'dead' });
      } else {
        game.round++; addRow(game); game.state = 'aiming';
        game.ball = { x: game.launchX, z: LAUNCH_Z, vx: 0, vz: 0 };
        events.push({ type: 'ready' });
      }
    }
    return events;
  }
  if (game.state !== 'flying') return events;
  const substeps = Math.ceil(dt / (1 / 240));
  for (let i = 0; i < substeps && game.state === 'flying'; i++) {
    game.shotTime += dt / substeps;
    moveBall(game, dt / substeps, events);
    if (game.state === 'flying' && (game.shotTime >= SHOT_SECONDS || game.blocks.length === 0)) {
      returnBall(game, events, game.blocks.length === 0 ? 'clear' : 'timeout');
    }
  }
  return events;
}

// A short, honest guide: first contact with a block or rail, then one rail bank.
export function guide(game) {
  let x = game.launchX, z = LAUNCH_Z;
  let vx = Math.sin(game.angle), vz = -Math.cos(game.angle), banks = 0;
  const points = [{ x, z }];
  for (let i = 0; i < 500; i++) {
    x += vx * .035; z += vz * .035;
    if (game.blocks.some(b => Math.hypot(x - clamp(x, b.x - BLOCK_W / 2, b.x + BLOCK_W / 2),
      z - clamp(z, b.z - BLOCK_D / 2, b.z + BLOCK_D / 2)) <= RADIUS)) { points.push({ x, z }); break; }
    if (Math.abs(x) >= HALF_WIDTH - RADIUS || z <= TOP + RADIUS) {
      points.push({ x, z });
      if (banks++ > 0) break;
      if (Math.abs(x) >= HALF_WIDTH - RADIUS) { x = clamp(x, -HALF_WIDTH + RADIUS, HALF_WIDTH - RADIUS); vx *= -1; }
      if (z <= TOP + RADIUS) { z = TOP + RADIUS; vz *= -1; }
    }
    if (z > LAUNCH_Z) { points.push({ x, z }); break; }
    if (i === 499) points.push({ x, z });
  }
  return points;
}
