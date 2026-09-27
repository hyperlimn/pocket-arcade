import * as THREE from 'three';
import './style.css';

const canvas = document.querySelector('#game');
const ui = {
  overlay: document.querySelector('#overlay'),
  startPanel: document.querySelector('#start-panel'),
  gameoverPanel: document.querySelector('#gameover-panel'),
  startButton: document.querySelector('#start-button'),
  restartButton: document.querySelector('#restart-button'),
  hud: document.querySelector('#hud'),
  score: document.querySelector('#score'),
  best: document.querySelector('#best'),
  combo: document.querySelector('#combo'),
  comboFill: document.querySelector('#combo-fill'),
  speed: document.querySelector('#speed'),
  speedBars: document.querySelector('#speed-bars'),
  speedLabel: document.querySelector('#speed-label'),
  callout: document.querySelector('#callout'),
  flash: document.querySelector('#flash'),
  finalScore: document.querySelector('#final-score'),
  finalBest: document.querySelector('#final-best'),
  finalGates: document.querySelector('#final-gates'),
  finalCombo: document.querySelector('#final-combo'),
  newBest: document.querySelector('#new-best'),
};

for (let i = 0; i < 10; i += 1) {
  const bar = document.createElement('i');
  bar.style.height = `${4 + i * 1.2}px`;
  bar.style.opacity = i < 3 ? '1' : '.15';
  ui.speedBars.appendChild(bar);
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x03040c);
scene.fog = new THREE.FogExp2(0x040512, 0.018);

const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.1, 180);
camera.position.set(0, 1.05, 8.8);
camera.lookAt(0, 0, -16);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;

scene.add(new THREE.HemisphereLight(0x82dfff, 0x110522, 1.7));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
keyLight.position.set(-3, 6, 5);
scene.add(keyLight);
const chaseLight = new THREE.PointLight(0x25dfff, 18, 20, 2);
chaseLight.position.set(0, 1, 5);
scene.add(chaseLight);

const COLORS = [0x4eeeff, 0xff3da8, 0xffb84d, 0x8f6cff];
const PLAY_BOUNDS = { x: 5.55, y: 3.35 };
const PLAYER_RADIUS = 0.34;
const gates = [];
const shards = [];
const trails = [];
const bursts = [];
const keys = new Set();

let state = 'idle';
let elapsed = 0;
let score = 0;
let displayedScore = 0;
let best = readBest();
let gatesPassed = 0;
let combo = 1;
let bestCombo = 1;
let comboTimer = 0;
let speed = 14;
let shake = 0;
let worldPulse = 0;
let trailTimer = 0;
let nextSpawnZ = -22;
let gateSequence = 0;
let inputMode = 'keyboard';
let pointerTarget = new THREE.Vector2();
let canRestartAt = 0;
let audio = null;

const player = createPlayer();
scene.add(player.group);

const starField = createStars();
scene.add(starField.points);

const horizon = createHorizon();
scene.add(horizon);

function createPlayer() {
  const group = new THREE.Group();
  group.position.set(0, 0, 0);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x6e91a8,
    emissive: 0x1ab8d8,
    emissiveIntensity: .48,
    metalness: 0.62,
    roughness: 0.22,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x101833, metalness: 0.8, roughness: 0.25, side: THREE.DoubleSide });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x70f7ff, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false });

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.25, 5), bodyMat);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -0.12;
  group.add(nose);

  const wingGeom = new THREE.BufferGeometry();
  wingGeom.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0.05, .22, -1.05, -.05, .5, -.28, .06, -.48,
    0, 0.05, .22, 1.05, -.05, .5, .28, .06, -.48,
  ], 3));
  wingGeom.computeVertexNormals();
  const wings = new THREE.Mesh(wingGeom, darkMat);
  group.add(wings);

  const core = new THREE.Mesh(new THREE.SphereGeometry(.105, 16, 10), new THREE.MeshBasicMaterial({ color: 0xeaffff }));
  core.position.z = .43;
  group.add(core);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(.25, 16, 10), glowMat);
  glow.position.z = .43;
  group.add(glow);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(.32, .025, 8, 28), glowMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.z = .34;
  group.add(ring);

  return { group, velocity: new THREE.Vector2(), core, glow, ring };
}

function createStars() {
  const count = 650;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = THREE.MathUtils.randFloatSpread(32);
    positions[i * 3 + 1] = THREE.MathUtils.randFloatSpread(20);
    positions[i * 3 + 2] = THREE.MathUtils.randFloat(-150, 8);
    sizes[i] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0x8ddcff, size: .055, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false });
  return { points: new THREE.Points(geometry, material), positions, count };
}

function createHorizon() {
  const group = new THREE.Group();
  const material = new THREE.LineBasicMaterial({ color: 0x204276, transparent: true, opacity: .16, blending: THREE.AdditiveBlending });
  for (let i = 0; i < 12; i += 1) {
    const z = -8 - i * 10;
    const points = [
      new THREE.Vector3(-11, -5.2, z), new THREE.Vector3(11, -5.2, z),
      new THREE.Vector3(11, 5.2, z), new THREE.Vector3(-11, 5.2, z), new THREE.Vector3(-11, -5.2, z),
    ];
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material));
  }
  return group;
}

function gateMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color: 0x02030a,
    emissive: color,
    emissiveIntensity: .028,
    metalness: .72,
    roughness: .42,
  });
}

function createGate(z, index) {
  const sequence = gateSequence++;
  const difficulty = Math.min(sequence / 32, 1);
  const intro = sequence < 3;
  const holeW = intro ? 4.2 : THREE.MathUtils.randFloat(2.7, 3.9) - difficulty * .25;
  const holeH = intro ? 2.9 : THREE.MathUtils.randFloat(2.15, 3.05) - difficulty * .18;
  const centerX = intro ? (sequence - 1) * 1.1 : THREE.MathUtils.randFloat(-2.35, 2.35);
  const centerY = intro ? 0 : THREE.MathUtils.randFloat(-1.55, 1.55);
  const color = COLORS[index % COLORS.length];
  const rotation = intro ? 0 : THREE.MathUtils.randFloat(-.42, .42);
  const rotates = !intro && sequence > 5 && Math.random() < .42;
  const moves = sequence > 8 && Math.random() < .26;
  const material = gateMaterial(color);
  const group = new THREE.Group();
  group.position.set(centerX, centerY, z);
  group.rotation.z = rotation;

  const outerW = 14;
  const outerH = 9;
  const depth = .72;
  const left = new THREE.Mesh(new THREE.BoxGeometry((outerW - holeW) / 2, outerH, depth), material);
  const right = left.clone();
  left.position.x = -(holeW / 2 + (outerW - holeW) / 4);
  right.position.x = -left.position.x;
  const top = new THREE.Mesh(new THREE.BoxGeometry(holeW, (outerH - holeH) / 2, depth), material);
  const bottom = top.clone();
  top.position.y = holeH / 2 + (outerH - holeH) / 4;
  bottom.position.y = -top.position.y;
  group.add(left, right, top, bottom);

  const edgeMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .88, blending: THREE.AdditiveBlending });
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(holeW, holeH, depth + .12)), edgeMat);
  group.add(edge);

  const innerGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(holeW + .16, holeH + .16),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .025, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }),
  );
  innerGlow.position.z = -.4;
  group.add(innerGlow);
  scene.add(group);

  const gate = {
    group, material, edgeMat, innerGlow, holeW, holeH, baseX: centerX, baseY: centerY,
    rotation, spin: rotates ? THREE.MathUtils.randFloat(.12, .28) * (Math.random() < .5 ? -1 : 1) : 0,
    moveAmp: moves ? THREE.MathUtils.randFloat(.35, .85) : 0,
    movePhase: Math.random() * Math.PI * 2,
    passed: false,
    color,
  };

  const shardSide = Math.floor(Math.random() * 4);
  if (!intro || gatesPassed === 2) createShardForGate(gate, shardSide);
  gates.push(gate);
}

function createShardForGate(gate, side) {
  const geometry = new THREE.OctahedronGeometry(.24, 0);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffc857, emissiveIntensity: 3, roughness: .15 });
  const mesh = new THREE.Mesh(geometry, material);
  const margin = .52;
  let lx = 0;
  let ly = 0;
  if (side === 0) { lx = -gate.holeW / 2 + margin; ly = THREE.MathUtils.randFloat(-gate.holeH * .28, gate.holeH * .28); }
  if (side === 1) { lx = gate.holeW / 2 - margin; ly = THREE.MathUtils.randFloat(-gate.holeH * .28, gate.holeH * .28); }
  if (side === 2) { ly = -gate.holeH / 2 + margin; lx = THREE.MathUtils.randFloat(-gate.holeW * .28, gate.holeW * .28); }
  if (side === 3) { ly = gate.holeH / 2 - margin; lx = THREE.MathUtils.randFloat(-gate.holeW * .28, gate.holeW * .28); }
  mesh.position.set(lx, ly, -.65);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(.46, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffc857, transparent: true, opacity: .16, blending: THREE.AdditiveBlending, depthWrite: false }));
  mesh.add(halo);
  gate.group.add(mesh);
  shards.push({ mesh, gate, collected: false });
}

function resetWorld() {
  for (const gate of gates) {
    scene.remove(gate.group);
    gate.material.dispose();
    gate.edgeMat.dispose();
  }
  gates.length = 0;
  shards.length = 0;
  for (const trail of trails) scene.remove(trail.mesh);
  trails.length = 0;
  for (const burst of bursts) scene.remove(burst.points);
  bursts.length = 0;

  player.group.visible = true;
  player.group.position.set(0, 0, 0);
  player.group.rotation.set(0, 0, 0);
  player.velocity.set(0, 0);
  pointerTarget.set(0, 0);
  elapsed = 0;
  score = 0;
  displayedScore = 0;
  gatesPassed = 0;
  combo = 1;
  bestCombo = 1;
  comboTimer = 0;
  speed = 14;
  shake = 0;
  worldPulse = 0;
  trailTimer = 0;
  nextSpawnZ = -22;
  gateSequence = 0;
  for (let i = 0; i < 7; i += 1) {
    createGate(nextSpawnZ, i);
    nextSpawnZ -= i < 2 ? 15 : THREE.MathUtils.randFloat(15, 19);
  }
  updateUI(true);
}

function startGame() {
  if (state === 'playing') return;
  if (state === 'dead' && performance.now() < canRestartAt) return;
  initAudio();
  resetWorld();
  state = 'playing';
  ui.overlay.classList.add('off');
  ui.startPanel.classList.add('hidden');
  ui.gameoverPanel.classList.add('hidden');
  ui.hud.classList.remove('hidden');
  ui.speed.classList.remove('hidden');
  setTimeout(() => { if (state === 'playing') ui.overlay.classList.add('hidden'); }, 360);
  tone(220, .07, 'sine', .035, 440);
}

function endGame() {
  if (state !== 'playing') return;
  state = 'dead';
  canRestartAt = performance.now() + 700;
  shake = 1.4;
  worldPulse = 1;
  spawnBurst(player.group.position, 0xff3d87, 55, 7);
  player.group.visible = false;
  flash('#ff3d87', .58);
  crashSound();

  const previousBest = best;
  best = Math.max(best, score);
  writeBest(best);
  ui.finalScore.textContent = score.toLocaleString();
  ui.finalBest.textContent = best.toLocaleString();
  ui.finalGates.textContent = gatesPassed;
  ui.finalCombo.textContent = `×${bestCombo}`;
  ui.newBest.classList.toggle('hidden', !(score > previousBest && score > 0));
  ui.gameoverPanel.classList.remove('hidden');
  ui.overlay.classList.remove('hidden', 'off');
  ui.hud.classList.add('hidden');
  ui.speed.classList.add('hidden');
}

function updatePlayer(dt) {
  const p = player.group.position;
  if (inputMode === 'pointer') {
    const pull = 14;
    player.velocity.x += (pointerTarget.x - p.x) * pull * dt;
    player.velocity.y += (pointerTarget.y - p.y) * pull * dt;
    player.velocity.multiplyScalar(Math.exp(-6.5 * dt));
  } else {
    let dx = 0;
    let dy = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) dx -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) dx += 1;
    if (keys.has('ArrowUp') || keys.has('KeyW')) dy += 1;
    if (keys.has('ArrowDown') || keys.has('KeyS')) dy -= 1;
    const length = Math.hypot(dx, dy) || 1;
    const acceleration = 31;
    player.velocity.x += dx / length * acceleration * dt;
    player.velocity.y += dy / length * acceleration * dt;
    player.velocity.multiplyScalar(Math.exp(-5.6 * dt));
  }

  player.velocity.x = THREE.MathUtils.clamp(player.velocity.x, -7.8, 7.8);
  player.velocity.y = THREE.MathUtils.clamp(player.velocity.y, -7.8, 7.8);
  p.x += player.velocity.x * dt;
  p.y += player.velocity.y * dt;

  if (Math.abs(p.x) > PLAY_BOUNDS.x) {
    p.x = Math.sign(p.x) * PLAY_BOUNDS.x;
    player.velocity.x *= -.32;
  }
  if (Math.abs(p.y) > PLAY_BOUNDS.y) {
    p.y = Math.sign(p.y) * PLAY_BOUNDS.y;
    player.velocity.y *= -.32;
  }

  player.group.rotation.z = THREE.MathUtils.lerp(player.group.rotation.z, -player.velocity.x * .085, 1 - Math.exp(-9 * dt));
  player.group.rotation.x = THREE.MathUtils.lerp(player.group.rotation.x, player.velocity.y * .035, 1 - Math.exp(-8 * dt));
  player.group.rotation.y = Math.sin(elapsed * 5) * .025;
  const throb = 1 + Math.sin(elapsed * 14) * .08;
  player.glow.scale.setScalar(throb);
  player.ring.rotation.z += dt * (3 + speed * .08);

  trailTimer -= dt;
  if (trailTimer <= 0) {
    spawnTrail();
    trailTimer = Math.max(.022, .052 - speed * .0009);
  }
}

function spawnTrail() {
  const material = new THREE.MeshBasicMaterial({ color: combo > 2 ? 0xffc857 : 0x48eaff, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(.08 + Math.random() * .07, 0), material);
  mesh.position.set(
    player.group.position.x + THREE.MathUtils.randFloatSpread(.18),
    player.group.position.y + THREE.MathUtils.randFloatSpread(.14),
    .45,
  );
  scene.add(mesh);
  trails.push({ mesh, life: .5 });
}

function updateTrails(dt) {
  for (let i = trails.length - 1; i >= 0; i -= 1) {
    const trail = trails[i];
    trail.life -= dt;
    trail.mesh.position.z += speed * dt * .56;
    trail.mesh.scale.multiplyScalar(Math.exp(-2 * dt));
    trail.mesh.material.opacity = Math.max(0, trail.life * .9);
    if (trail.life <= 0) {
      scene.remove(trail.mesh);
      trail.mesh.geometry.dispose();
      trail.mesh.material.dispose();
      trails.splice(i, 1);
    }
  }
}

function updateGates(dt) {
  for (let i = gates.length - 1; i >= 0; i -= 1) {
    const gate = gates[i];
    gate.group.position.z += speed * dt;
    gate.group.rotation.z += gate.spin * dt;
    if (gate.moveAmp) gate.group.position.x = gate.baseX + Math.sin(elapsed * 1.15 + gate.movePhase) * gate.moveAmp;
    gate.innerGlow.material.opacity = .02 + Math.max(0, 1 - Math.abs(gate.group.position.z) / 8) * .055;

    for (const shard of shards) {
      if (shard.gate === gate && !shard.collected) {
        shard.mesh.rotation.x += dt * 2.5;
        shard.mesh.rotation.y += dt * 4.2;
      }
    }

    if (!gate.passed && gate.group.position.z >= 0) checkGate(gate);
    if (gate.group.position.z > 10) {
      scene.remove(gate.group);
      gate.material.dispose();
      gate.edgeMat.dispose();
      gates.splice(i, 1);
    }
  }

  while (gates.length < 7) {
    createGate(nextSpawnZ, gatesPassed + gates.length);
    nextSpawnZ -= THREE.MathUtils.randFloat(14.5, 18.5);
  }
  // Spawn coordinates are absolute, so keep the frontier behind the final live gate.
  if (gates.length) nextSpawnZ = Math.min(...gates.map((gate) => gate.group.position.z)) - THREE.MathUtils.randFloat(14.5, 18.5);
}

function checkGate(gate) {
  gate.passed = true;
  const angle = -gate.group.rotation.z;
  const dx = player.group.position.x - gate.group.position.x;
  const dy = player.group.position.y - gate.group.position.y;
  const lx = dx * Math.cos(angle) - dy * Math.sin(angle);
  const ly = dx * Math.sin(angle) + dy * Math.cos(angle);
  const clearanceX = gate.holeW / 2 - Math.abs(lx) - PLAYER_RADIUS;
  const clearanceY = gate.holeH / 2 - Math.abs(ly) - PLAYER_RADIUS;
  const minClearance = Math.min(clearanceX, clearanceY);

  if (clearanceX < 0 || clearanceY < 0) {
    endGame();
    return;
  }

  gatesPassed += 1;
  let award = 100 * combo;
  let message = 'CLEAR';
  if (minClearance < .22) {
    combo = Math.min(combo + 1, 8);
    bestCombo = Math.max(bestCombo, combo);
    comboTimer = 4.2;
    award += 300 * combo;
    message = minClearance < .09 ? 'RAZOR +FLOW' : 'NEAR MISS +FLOW';
    spawnBurst(player.group.position, gate.color, 18, 2.6);
    flash(`#${gate.color.toString(16).padStart(6, '0')}`, .16);
    shake = Math.max(shake, .18);
    tone(680 + combo * 70, .09, 'triangle', .045, 980 + combo * 80);
  } else {
    tone(300 + combo * 30, .045, 'sine', .018, 430 + combo * 25);
  }
  score += award;
  showCallout(message, gate.color);
}

function checkShards() {
  for (const shard of shards) {
    if (shard.collected || shard.gate.group.position.z < -.6 || shard.gate.group.position.z > .8) continue;
    shard.mesh.getWorldPosition(tempVec);
    const dx = player.group.position.x - tempVec.x;
    const dy = player.group.position.y - tempVec.y;
    const dz = tempVec.z;
    if (dx * dx + dy * dy + dz * dz < .48 * .48) {
      shard.collected = true;
      shard.mesh.visible = false;
      score += 175 * combo;
      comboTimer = Math.max(comboTimer, 2.2);
      spawnBurst(tempVec, 0xffc857, 14, 2.2);
      showCallout(`SHARD +${175 * combo}`, 0xffc857);
      tone(880, .12, 'sine', .04, 1320);
    }
  }
}

const tempVec = new THREE.Vector3();

function spawnBurst(position, color, count = 20, force = 3) {
  const positions = new Float32Array(count * 3);
  const velocities = [];
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = position.x;
    positions[i * 3 + 1] = position.y;
    positions[i * 3 + 2] = position.z;
    const velocity = new THREE.Vector3().randomDirection().multiplyScalar(THREE.MathUtils.randFloat(force * .35, force));
    velocity.z += speed * .12;
    velocities.push(velocity);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color, size: .13, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
  const points = new THREE.Points(geometry, material);
  scene.add(points);
  bursts.push({ points, velocities, life: .8 });
}

function updateBursts(dt) {
  for (let i = bursts.length - 1; i >= 0; i -= 1) {
    const burst = bursts[i];
    burst.life -= dt;
    const positions = burst.points.geometry.attributes.position.array;
    for (let p = 0; p < burst.velocities.length; p += 1) {
      positions[p * 3] += burst.velocities[p].x * dt;
      positions[p * 3 + 1] += burst.velocities[p].y * dt;
      positions[p * 3 + 2] += burst.velocities[p].z * dt;
      burst.velocities[p].multiplyScalar(Math.exp(-1.8 * dt));
    }
    burst.points.geometry.attributes.position.needsUpdate = true;
    burst.points.material.opacity = Math.max(0, burst.life / .8);
    if (burst.life <= 0) {
      scene.remove(burst.points);
      burst.points.geometry.dispose();
      burst.points.material.dispose();
      bursts.splice(i, 1);
    }
  }
}

function updateStars(dt, travelSpeed) {
  const positions = starField.points.geometry.attributes.position.array;
  for (let i = 0; i < starField.count; i += 1) {
    positions[i * 3 + 2] += travelSpeed * dt;
    if (positions[i * 3 + 2] > 9) positions[i * 3 + 2] -= 158;
  }
  starField.points.geometry.attributes.position.needsUpdate = true;
  starField.points.material.size = .045 + travelSpeed * .0012;
  horizon.position.z = ((horizon.position.z + travelSpeed * dt) % 10);
}

function updateCamera(dt) {
  shake *= Math.exp(-7 * dt);
  const sx = THREE.MathUtils.randFloatSpread(shake);
  const sy = THREE.MathUtils.randFloatSpread(shake);
  const targetX = player.group.visible ? player.group.position.x * .075 : 0;
  const targetY = 1.05 + (player.group.visible ? player.group.position.y * .07 : 0);
  camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX, 1 - Math.exp(-3 * dt)) + sx;
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, 1 - Math.exp(-3 * dt)) + sy;
  camera.position.z = 8.8 + THREE.MathUtils.randFloatSpread(shake * .35);
  const targetFov = state === 'playing' ? 64 + (speed - 14) * .28 : 64;
  camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 1 - Math.exp(-2.5 * dt));
  camera.updateProjectionMatrix();
  camera.lookAt(player.group.visible ? player.group.position.x * .05 : 0, player.group.visible ? player.group.position.y * .04 : 0, -15);
}

function updateUI(force = false) {
  const step = Math.max(1, Math.ceil(Math.abs(score - displayedScore) * .16));
  displayedScore = force ? score : Math.min(score, displayedScore + step);
  ui.score.textContent = Math.floor(displayedScore).toString().padStart(6, '0');
  ui.best.textContent = best.toString().padStart(6, '0');
  ui.combo.textContent = `×${combo}`;
  ui.comboFill.style.width = `${Math.min(100, comboTimer / 4.2 * 100)}%`;
  ui.speedLabel.textContent = `RUSH ${String(Math.floor((speed - 12) / 2)).padStart(2, '0')}`;
  const litBars = Math.floor(THREE.MathUtils.mapLinear(speed, 14, 31, 2, 10));
  [...ui.speedBars.children].forEach((bar, i) => { bar.style.opacity = i < litBars ? '1' : '.15'; });
}

function showCallout(text, color) {
  ui.callout.textContent = text;
  ui.callout.style.color = `#${color.toString(16).padStart(6, '0')}`;
  ui.callout.classList.remove('pop');
  void ui.callout.offsetWidth;
  ui.callout.classList.add('pop');
}

function flash(color, opacity) {
  ui.flash.style.transition = 'none';
  ui.flash.style.background = color;
  ui.flash.style.opacity = opacity;
  requestAnimationFrame(() => {
    ui.flash.style.transition = 'opacity .2s ease-out';
    ui.flash.style.opacity = 0;
  });
}

function readBest() {
  try { return Number(sessionStorage.getItem('voidline-best')) || 0; } catch { return 0; }
}

function writeBest(value) {
  try { sessionStorage.setItem('voidline-best', String(value)); } catch { /* storage may be disabled */ }
}

function initAudio() {
  if (audio) {
    if (audio.state === 'suspended') audio.resume();
    return;
  }
  try { audio = new AudioContext(); } catch { audio = null; }
}

function tone(startFrequency, duration, type = 'sine', volume = .03, endFrequency = startFrequency) {
  if (!audio) return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const now = audio.currentTime;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(startFrequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + .02);
}

function crashSound() {
  if (!audio) return;
  const length = Math.floor(audio.sampleRate * .34);
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const gain = audio.createGain();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1200, audio.currentTime);
  filter.frequency.exponentialRampToValueAtTime(90, audio.currentTime + .34);
  gain.gain.value = .13;
  source.buffer = buffer;
  source.connect(filter).connect(gain).connect(audio.destination);
  source.start();
  tone(110, .34, 'sawtooth', .07, 35);
}

function updatePointer(event) {
  inputMode = 'pointer';
  const nx = event.clientX / innerWidth * 2 - 1;
  const ny = -(event.clientY / innerHeight * 2 - 1);
  pointerTarget.set(nx * PLAY_BOUNDS.x, ny * PLAY_BOUNDS.y);
}

addEventListener('keydown', (event) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) {
    inputMode = 'keyboard';
    keys.add(event.code);
  }
  if ((event.code === 'Space' || event.code === 'Enter' || event.code === 'KeyR') && state !== 'playing') startGame();
});
addEventListener('keyup', (event) => keys.delete(event.code));
addEventListener('pointermove', (event) => { if (state === 'playing') updatePointer(event); });
canvas.addEventListener('pointerdown', (event) => {
  if (state === 'playing') updatePointer(event);
  else startGame();
});
ui.startButton.addEventListener('click', startGame);
ui.restartButton.addEventListener('click', startGame);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
});

resetWorld();
ui.best.textContent = best.toString().padStart(6, '0');

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .05);

  if (state === 'playing') {
    elapsed += dt;
    speed = Math.min(31, 14 + elapsed * .19 + gatesPassed * .18);
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) combo = 1;
    }
    updatePlayer(dt);
    updateGates(dt);
    checkShards();
    updateTrails(dt);
    updateStars(dt, speed);
    updateUI();
  } else {
    elapsed += dt * .24;
    updateStars(dt, state === 'dead' ? 2 : 5);
    if (state === 'idle') {
      player.group.position.y = Math.sin(elapsed * 2.2) * .12;
      player.group.rotation.z = Math.sin(elapsed * 1.4) * .06;
      player.ring.rotation.z += dt * 1.2;
      for (const gate of gates) {
        gate.group.rotation.z += gate.spin * dt * .25;
        gate.innerGlow.material.opacity = .022 + Math.sin(elapsed * 2 + gate.group.position.z) * .009;
      }
    }
  }

  updateBursts(dt);
  updateCamera(dt);
  worldPulse *= Math.exp(-4 * dt);
  renderer.toneMappingExposure = 1.3 + worldPulse * .9;
  renderer.render(scene, camera);
}
animate();
document.body.dataset.arcadeReady = 'true';
