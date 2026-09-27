export const SLAB_HEIGHT = .48;
export const MAX_WIDTH = 3.8;
export const TRAVEL = 4.8;
export const SETTLE_TIME = .23;

export function createGame(random = Math.random) {
  const game = {
    state: 'playing', time: 0, height: 0, score: 0, streak: 0, bestStreak: 0,
    perfects: 0, repairs: 0, cooldown: 0, random,
    top: { x: 0, z: 0, w: MAX_WIDTH, d: MAX_WIDTH },
  };
  spawn(game);
  return game;
}

function spawn(game) {
  const axis = game.height % 2 === 0 ? 'x' : 'z';
  const direction = game.random() < .5 ? 1 : -1;
  game.active = { ...game.top, axis, direction, offset: -direction * TRAVEL };
  game.active[axis] += game.active.offset;
  game.speed = Math.min(7.8, 3.2 + game.height * .12);
}

export function step(game, dt) {
  if (game.state !== 'playing') return;
  game.time += dt;
  if (game.cooldown > 0) {
    game.cooldown = Math.max(0, game.cooldown - dt);
    return;
  }
  const active = game.active;
  active.offset += active.direction * game.speed * dt;
  while (Math.abs(active.offset) > TRAVEL) {
    const sign = Math.sign(active.offset);
    active.offset = sign * TRAVEL * 2 - active.offset;
    active.direction = -sign;
  }
  active[active.axis] = game.top[active.axis] + active.offset;
}

// The landing and discarded piece are exact intersections of axis-aligned slabs.
export function place(game) {
  if (game.state !== 'playing' || game.cooldown > 0) return null;
  const active = game.active, axis = active.axis, size = axis === 'x' ? 'w' : 'd';
  const delta = active[axis] - game.top[axis];
  const width = game.top[size];
  const perfect = Math.abs(delta) <= Math.min(.13, width * .18);
  if (!perfect && width - Math.abs(delta) < .075) {
    game.state = 'dead';
    return { type: 'miss', slab: { ...active }, height: game.height + 1 };
  }
  let cut = null;
  const landing = { ...game.top };
  if (!perfect) {
    landing[size] = width - Math.abs(delta);
    landing[axis] += delta / 2;
    cut = { ...active, [size]: Math.abs(delta) };
    cut[axis] = landing[axis] + Math.sign(delta) * width / 2;
  }
  game.height++;
  game.streak = perfect ? game.streak + 1 : 0;
  game.bestStreak = Math.max(game.bestStreak, game.streak);
  if (perfect) game.perfects++;
  const repair = perfect && game.streak % 3 === 0 && (landing.w < MAX_WIDTH || landing.d < MAX_WIDTH);
  if (repair) {
    landing.w = Math.min(MAX_WIDTH, landing.w + .28);
    landing.d = Math.min(MAX_WIDTH, landing.d + .28);
    game.repairs++;
  }
  const points = 100 + Math.floor(game.height / 10) * 10 + (perfect ? 50 * Math.min(5, game.streak) : 0);
  game.score += points;
  game.top = landing;
  game.cooldown = SETTLE_TIME;
  const result = { type: 'land', slab: { ...landing }, cut, height: game.height, perfect, repair, points, streak: game.streak };
  spawn(game);
  return result;
}
