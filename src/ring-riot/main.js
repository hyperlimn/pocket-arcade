import * as THREE from 'three';
import { createGame, step, ARENA_RADIUS, CHARGE_TIME } from './model.js';
import './style.css';

const $ = (id) => document.getElementById(id);
const canvas = $('arena');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#241d32');
scene.fog = new THREE.Fog('#241d32', 25, 65);
const camera = new THREE.OrthographicCamera(-12, 12, 10, -10, .1, 80);
const baseCamera = new THREE.Vector3(0, 15, 12.5);
camera.position.copy(baseCamera);
camera.lookAt(0, 0, 0);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
scene.add(new THREE.HemisphereLight(0xf4dfff, 0x57405e, 2.8));
const light = new THREE.DirectionalLight(0xffedd0, 3);
light.position.set(-5, 12, 6);
scene.add(light);
const standard = (color, roughness = .65) => new THREE.MeshStandardMaterial({ color, roughness });
const materials = {
  floor: standard('#e4ccb0'), side: standard('#9e7489'), rim: standard('#ffe2ab'),
  player: standard('#a47ceb', .25), rival: standard('#f08851', .45), heavy: standard('#df507a', .35),
  visor: standard('#382740', .4), eyes: new THREE.MeshBasicMaterial({ color: '#fff4dc' }),
  shadow: new THREE.MeshBasicMaterial({ color: '#674962', transparent: true, opacity: .23, depthWrite: false }),
  stripe: new THREE.MeshBasicMaterial({ color: '#b89079' }),
};
const sphere = new THREE.SphereGeometry(1, 20, 14);
const visorGeometry = new THREE.BoxGeometry(1.18, .27, .2);
const eyeGeometry = new THREE.BoxGeometry(.11, .15, .04);
const shadowGeometry = new THREE.CircleGeometry(1, 24);
const markerGeometry = new THREE.RingGeometry(.78, .9, 32);
const bandGeometry = new THREE.TorusGeometry(.97, .055, 6, 24);
const markerMaterial = new THREE.MeshBasicMaterial({ color: '#ffab70', side: THREE.DoubleSide, transparent: true, opacity: .9 });

// A floating toy arena; blob shadows keep the whole scene inexpensive.
const platform = new THREE.Mesh(new THREE.CylinderGeometry(ARENA_RADIUS, ARENA_RADIUS - .25, .6, 80), materials.side);
platform.position.y = -.4;
scene.add(platform);
const floor = new THREE.Mesh(new THREE.CylinderGeometry(ARENA_RADIUS, ARENA_RADIUS, .12, 80), materials.floor);
floor.position.y = -.04;
scene.add(floor);
const rimMaterial = standard('#fbd397');
const rim = new THREE.Mesh(new THREE.TorusGeometry(ARENA_RADIUS - .07, .055, 6, 96), rimMaterial);
rim.rotation.x = Math.PI / 2;
rim.position.y = .06;
scene.add(rim);
for (const radius of [2.3, 4.6]) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(radius - .014, radius + .014, 80), materials.stripe);
  ring.rotation.x = -Math.PI / 2; ring.position.y = .027; scene.add(ring);
}
const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(.065, .015, .28), materials.stripe, 48);
const dummy = new THREE.Object3D();
for (let i = 0; i < 48; i++) {
  const angle = i / 48 * Math.PI * 2;
  dummy.position.set(Math.sin(angle) * 6.35, .04, Math.cos(angle) * 6.35);
  dummy.rotation.set(0, angle, 0); dummy.updateMatrix(); ticks.setMatrixAt(i, dummy.matrix);
}
scene.add(ticks);
const underRing = new THREE.Mesh(new THREE.TorusGeometry(5.4, .045, 6, 80), new THREE.MeshBasicMaterial({ color: '#9779bc' }));
underRing.rotation.x = Math.PI / 2; underRing.position.y = -1; scene.add(underRing);
const starsGeometry = new THREE.BufferGeometry();
const stars = new Float32Array(75 * 3);
for (let i = 0; i < 75; i++) { stars[i * 3] = (Math.random() - .5) * 48; stars[i * 3 + 1] = -4 - Math.random() * 12; stars[i * 3 + 2] = (Math.random() - .5) * 40; }
starsGeometry.setAttribute('position', new THREE.BufferAttribute(stars, 3));
scene.add(new THREE.Points(starsGeometry, new THREE.PointsMaterial({ color: '#ac88c9', size: .06 })));
const rangeMaterial = new THREE.MeshBasicMaterial({ color: '#ab80e5', transparent: true, opacity: .2, depthWrite: false, side: THREE.DoubleSide });
const range = new THREE.Mesh(new THREE.CircleGeometry(1, 64), rangeMaterial);
range.rotation.x = -Math.PI / 2; range.position.y = .055; range.visible = false; scene.add(range);
const rangeEdge = new THREE.Mesh(new THREE.RingGeometry(.97, 1, 64), new THREE.MeshBasicMaterial({ color: '#9767c9', side: THREE.DoubleSide }));
range.add(rangeEdge);

function makeBall(body, player = false) {
  const root = new THREE.Group();
  const ball = new THREE.Group();
  const material = player ? materials.player : body.heavy ? materials.heavy : materials.rival;
  ball.add(new THREE.Mesh(sphere, material));
  const visor = new THREE.Mesh(visorGeometry, materials.visor);
  visor.position.set(0, .14, .83); ball.add(visor);
  for (const x of [-.28, .28]) {
    const eye = new THREE.Mesh(eyeGeometry, materials.eyes);
    eye.position.set(x, .14, .944); ball.add(eye);
  }
  if (body.heavy) {
    const band = new THREE.Mesh(bandGeometry, materials.rim);
    band.rotation.x = Math.PI / 2; ball.add(band);
  }
  ball.scale.setScalar(body.radius); root.add(ball);
  const shadow = new THREE.Mesh(shadowGeometry, materials.shadow);
  shadow.rotation.x = -Math.PI / 2; shadow.scale.setScalar(body.radius * 1.1); shadow.position.y = .035; root.add(shadow);
  const marker = new THREE.Mesh(markerGeometry, markerMaterial);
  marker.rotation.x = -Math.PI / 2; marker.position.y = .07; marker.visible = !player; root.add(marker);
  scene.add(root);
  return { root, ball, shadow, marker, body, falling: false, fallTime: 0, y: body.radius, player };
}
let game = createGame();
let mode = 'idle';
let playerView = makeBall(game.player, true);
const views = new Map();
const falling = [];
const rings = [];
const particleData = [];
const particles = new THREE.InstancedMesh(new THREE.BoxGeometry(.09, .09, .09), new THREE.MeshBasicMaterial(), 160);
particles.frustumCulled = false; // Instances move; do not reuse a stale aggregate bounding sphere.
particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage); particles.count = 0; scene.add(particles);
let best = 0, muted = false;
try { best = Number(localStorage.getItem('ring-riot-best')) || 0; muted = localStorage.getItem('ring-riot-muted') === 'true'; } catch { /* Optional local storage. */ }
let shake = 0, restartAt = 0, endDelay = -1;
let audio;
let chargeSoundAt = 0;
const keys = new Set();
let pointerHeld = false, spaceHeld = false, pointerMode = false, activePointer = null;
const pointer = new THREE.Vector2();
const pointerTarget = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let hasTarget = false;

function initAudio() {
  try { audio ||= new AudioContext(); if (audio.state === 'suspended') audio.resume(); } catch { /* Silent play is supported. */ }
}
function tone(freq, duration, volume = .04, end = freq, type = 'sine') {
  if (!audio || muted) return;
  const oscillator = audio.createOscillator(), gain = audio.createGain();
  const now = audio.currentTime;
  oscillator.type = type; oscillator.frequency.setValueAtTime(freq, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + duration);
  gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(volume, now + .01);
  gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
  oscillator.connect(gain).connect(audio.destination); oscillator.start(); oscillator.stop(now + duration + .02);
}
function soundLabel() { $('sound').textContent = muted ? 'SOUND OFF' : 'SOUND ON'; $('sound').setAttribute('aria-pressed', String(muted)); $('sound').setAttribute('aria-label', muted ? 'Enable sound' : 'Mute sound'); }
soundLabel();
$('sound').onclick = () => { muted = !muted; initAudio(); soundLabel(); try { localStorage.setItem('ring-riot-muted', String(muted)); } catch { /* optional */ } };
function callout(message) {
  $('callout').textContent = message; $('callout').classList.remove('pop'); void $('callout').offsetWidth; $('callout').classList.add('pop');
}
function burst(x, y, z, color, count = 20) {
  for (let i = 0; i < (reducedMotion ? 4 : count) && particleData.length < 160; i++) {
    particleData.push({ x, y, z, vx: (Math.random() - .5) * 6, vy: 2 + Math.random() * 5, vz: (Math.random() - .5) * 6, life: .5 + Math.random() * .4, color: new THREE.Color(color) });
  }
}
function addPulse(event) {
  const mesh = new THREE.Mesh(new THREE.RingGeometry(.93, 1, 64), new THREE.MeshBasicMaterial({ color: event.power > .95 ? '#fff1bc' : '#c49bf5', transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(event.x, .1, event.z); scene.add(mesh);
  rings.push({ mesh, life: .36, radius: event.radius });
  shake = Math.max(shake, .08 + event.power * .16);
  burst(event.x, .4, event.z, '#d7bcff', 16);
  tone(140 + event.power * 70, .22, .10, 35, 'triangle');
  tone(700, .12, .025, 160, 'sawtooth');
  if (event.hits >= 3) callout(`${event.hits} RIVALS · BIG PUSH!`);
}
function consumeEvents() {
  for (const event of game.events.splice(0)) {
    if (event.type === 'spawn') views.set(event.enemy.id, makeBall(event.enemy));
    if (event.type === 'pulse') addPulse(event);
    if (event.type === 'bump') { shake = Math.max(shake, .06); tone(90, .06, .018, 45, 'triangle'); }
    if (event.type === 'wave') { callout(event.wave === 2 ? 'ROUND 02 · HEAVIES JOIN' : `ROUND ${String(event.wave).padStart(2, '0')} · MORE COMPANY`); tone(330, .14, .035, 490); }
    if (event.type === 'knockout') {
      const view = views.get(event.enemy.id);
      if (view) { views.delete(event.enemy.id); view.falling = true; view.shadow.visible = false; view.marker.visible = false; falling.push(view); }
      burst(event.enemy.x, .6, event.enemy.z, event.enemy.heavy ? '#ee7fac' : '#ffd19a');
      if (event.award) {
        tone(360 + Math.min(8, event.combo) * 100, .16, .055, 700 + event.combo * 100, 'triangle');
        callout(event.combo >= 2 ? `×${event.combo} CHAIN! +${event.award}` : `RING OUT! +${event.award}`);
      }
    }
    if (event.type === 'end') {
      mode = 'falling'; restartAt = performance.now() + 650; endDelay = .7;
      playerView.falling = true; playerView.shadow.visible = false; range.visible = false;
      shake = .45; tone(180, .5, .10, 35, 'sawtooth');
      clearInput(); $('charge-ui').hidden = true;
    }
  }
}
consumeEvents();
function clearInput() { keys.clear(); pointerHeld = false; spaceHeld = false; activePointer = null; hasTarget = false; game.wasHeld = false; game.charge = 0; }
function start() {
  if (mode === 'playing' || mode === 'paused' || performance.now() < restartAt) return;
  initAudio(); clearInput();
  for (const view of [...views.values(), ...falling, playerView]) scene.remove(view.root);
  views.clear(); falling.length = 0;
  for (const ring of rings) { scene.remove(ring.mesh); ring.mesh.geometry.dispose(); ring.mesh.material.dispose(); }
  rings.length = 0; particleData.length = 0;
  game = createGame(); playerView = makeBall(game.player, true); consumeEvents();
  mode = 'playing'; endDelay = -1; shake = 0; accumulator = 0; pointerMode = false;
  $('overlay').hidden = true; $('intro').hidden = true; $('results').hidden = true; $('pause-panel').hidden = true;
  $('hud').hidden = false; $('charge-ui').hidden = false; $('callout').classList.remove('pop');
  document.activeElement?.blur();
  tone(260, .12, .04, 520, 'triangle');
  callout('HOLD. RELEASE. MAKE SPACE.');
}
function showResults() {
  const record = game.score > best;
  best = Math.max(best, game.score);
  try { localStorage.setItem('ring-riot-best', String(best)); } catch { /* optional */ }
  mode = 'dead'; $('hud').hidden = true; $('overlay').hidden = false; $('results').hidden = false;
  $('final-score').textContent = game.score.toLocaleString(); $('final-kills').textContent = game.kills;
  $('final-chain').textContent = `×${game.bestCombo}`; $('final-time').textContent = formatTime(game.time);
  $('result-label').textContent = record ? 'NEW HOUSE RECORD' : 'OVER THE EDGE';
  $('result-tip').textContent = game.kills === 0 ? 'Let rivals come close. Hold until full, then release.' : game.bestCombo < 3 ? 'Gather a bigger crowd for a bigger chain.' : `${game.bestCombo} in a chain. How many next time?`;
  $('callout').classList.remove('pop');
}
function pause() {
  if (mode !== 'playing') return;
  mode = 'paused'; clearInput(); $('overlay').hidden = false; $('pause-panel').hidden = false; $('charge-ui').hidden = true;
  $('callout').classList.remove('pop');
}
function resume() {
  if (mode !== 'paused') return;
  mode = 'playing'; $('overlay').hidden = true; $('pause-panel').hidden = true; $('charge-ui').hidden = false;
  document.activeElement?.blur(); last = performance.now(); accumulator = 0;
}
$('start').onclick = start; $('restart').onclick = start; $('resume').onclick = resume;
$('pause').onclick = () => mode === 'paused' ? resume() : pause();
const moveCodes = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
addEventListener('keydown', (event) => {
  if (event.target.closest?.('a, button') && ['Space', 'Enter'].includes(event.code)) return;
  if ([...moveCodes, 'Space', 'Enter', 'Escape', 'KeyP'].includes(event.code)) event.preventDefault();
  if (event.repeat && !moveCodes.includes(event.code)) return;
  if (event.code === 'Escape' || event.code === 'KeyP') { if (mode === 'paused') resume(); else pause(); return; }
  if (mode !== 'playing') { if (event.code === 'Space' || event.code === 'Enter' || event.code === 'KeyR') start(); return; }
  if (moveCodes.includes(event.code)) { keys.add(event.code); pointerMode = false; }
  if (event.code === 'Space') spaceHeld = true;
  if (moveCodes.includes(event.code)) $('play-tip').textContent = 'WASD / arrows to roll · hold SPACE, release to blast';
});
addEventListener('keyup', (event) => { keys.delete(event.code); if (event.code === 'Space') spaceHeld = false; });
function updatePointer(event) {
  pointer.set(event.clientX / innerWidth * 2 - 1, -(event.clientY / innerHeight * 2 - 1));
  raycaster.setFromCamera(pointer, camera);
  if (raycaster.ray.intersectPlane(plane, pointerTarget)) {
    // Pointer steering stops just inside the rim; physical bumps can still ring you out.
    const distance = Math.hypot(pointerTarget.x, pointerTarget.z);
    if (distance > ARENA_RADIUS - .65) pointerTarget.multiplyScalar((ARENA_RADIUS - .65) / distance);
    hasTarget = true; pointerMode = true;
  }
  if (event.pointerType === 'touch') $('play-tip').textContent = 'Drag to roll & charge · lift to blast';
  else $('play-tip').textContent = 'Move pointer to roll · hold click, release to blast';
}
canvas.addEventListener('pointerdown', (event) => {
  if (mode !== 'playing' || event.button !== 0 || activePointer !== null) return;
  initAudio(); activePointer = event.pointerId; pointerHeld = true; updatePointer(event); canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => {
  if (mode === 'playing' && (event.pointerType === 'mouse' || event.pointerId === activePointer)) updatePointer(event);
});
canvas.addEventListener('pointerup', (event) => { if (event.pointerId === activePointer) { pointerHeld = false; activePointer = null; if (event.pointerType === 'touch') hasTarget = false; } });
canvas.addEventListener('pointercancel', () => { clearInput(); });
canvas.addEventListener('lostpointercapture', () => { pointerHeld = false; activePointer = null; });
canvas.addEventListener('contextmenu', event => event.preventDefault());
addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
function input() {
  let x = 0, z = 0;
  if (pointerMode && hasTarget) { x = (pointerTarget.x - game.player.x) * 1.6; z = (pointerTarget.z - game.player.z) * 1.6; }
  else {
    x = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
    z = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
  }
  return { x, z, held: pointerHeld || spaceHeld };
}
function formatTime(time) { return `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`; }
function updateHud() {
  $('score').textContent = game.score.toLocaleString(); $('best').textContent = best.toLocaleString();
  $('timer').textContent = formatTime(game.time); $('wave').textContent = `ROUND ${String(game.wave).padStart(2, '0')}`;
  const power = game.charge / CHARGE_TIME;
  $('charge-fill').style.width = `${game.cooldown > 0 ? (1 - game.cooldown / .48) * 100 : power * 100}%`;
  $('charge-fill').style.background = game.cooldown > 0 ? '#786b89' : power >= 1 ? '#ffe8ac' : '#c9a7ff';
  $('charge-label').textContent = game.cooldown > 0 ? 'RECHARGING…' : power >= 1 ? 'FULL PULSE · RELEASE!' : power > 0 ? 'CHARGING · RELEASE TO BLAST' : 'HOLD TO CHARGE';
  $('chain').textContent = game.time - game.lastKill < 2 ? `×${game.combo} CHAIN` : 'PULSE';
}
function updateView(view, dt, time) {
  const b = view.body;
  if (view.falling) {
    view.fallTime += dt;
    view.root.position.x += b.vx * dt * .6; view.root.position.z += b.vz * dt * .6;
    view.ball.position.y = b.radius + 2 * view.fallTime - 13 * view.fallTime ** 2;
    view.ball.rotation.z += dt * 5; view.ball.rotation.x += dt * 3;
    return;
  }
  view.root.position.set(b.x, 0, b.z);
  const warning = b.warning > 0;
  view.marker.visible = warning;
  view.marker.rotation.z = time * 2;
  view.marker.scale.setScalar(.9 + Math.sin(time * 12) * .1);
  const power = view.player ? game.charge / CHARGE_TIME : 0;
  const squash = 1 - power * .22;
  view.ball.scale.set(b.radius * (1 + power * .14), b.radius * squash, b.radius * (1 + power * .14));
  view.ball.position.y = warning ? b.radius + b.warning * 3 : b.radius * squash + .06 + (power ? Math.sin(time * 45) * .02 * power : 0);
  if (Math.hypot(b.vx, b.vz) > .3) {
    const target = Math.atan2(b.vx, b.vz);
    const diff = Math.atan2(Math.sin(target - view.ball.rotation.y), Math.cos(target - view.ball.rotation.y));
    view.ball.rotation.y += diff * Math.min(1, dt * 12);
  }
  view.ball.rotation.z = -b.vx * .035; view.ball.rotation.x = b.vz * .035;
  view.shadow.scale.setScalar(b.radius * (warning ? .8 : 1.2));
}
function updateEffects(dt) {
  for (let i = rings.length - 1; i >= 0; i--) {
    const ring = rings[i]; ring.life -= dt;
    const progress = 1 - ring.life / .36;
    ring.mesh.scale.setScalar(.4 + ring.radius * (1 - (1 - progress) ** 3));
    ring.mesh.material.opacity = Math.max(0, ring.life / .36);
    if (ring.life <= 0) { scene.remove(ring.mesh); ring.mesh.geometry.dispose(); ring.mesh.material.dispose(); rings.splice(i, 1); }
  }
  for (let i = particleData.length - 1; i >= 0; i--) {
    const p = particleData[i]; p.life -= dt;
    if (p.life <= 0) { particleData.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= 12 * dt;
  }
  particleData.forEach((p, i) => {
    dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(p.life * 6, p.life * 5, 0); dummy.scale.setScalar(Math.min(1, p.life * 4)); dummy.updateMatrix();
    particles.setMatrixAt(i, dummy.matrix); particles.setColorAt(i, p.color);
  });
  particles.count = particleData.length; particles.instanceMatrix.needsUpdate = true;
  if (particles.instanceColor) particles.instanceColor.needsUpdate = true;
}
function resize() {
  const aspect = innerWidth / innerHeight;
  const height = Math.max(18.5, 16.7 / aspect);
  camera.left = -height * aspect / 2; camera.right = height * aspect / 2;
  camera.top = height / 2; camera.bottom = -height / 2; camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', resize); resize();
let last = performance.now(), accumulator = 0, hudTime = 0;
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - last) / 1000, .05); last = now;
  if (mode === 'playing') {
    accumulator += dt;
    while (accumulator >= 1 / 120 && mode === 'playing') { step(game, 1 / 120, input()); consumeEvents(); accumulator -= 1 / 120; }
    const power = game.charge / CHARGE_TIME;
    range.visible = power > 0;
    range.position.set(game.player.x, .065, game.player.z); range.scale.setScalar(1.35 + power * 2.25);
    rangeMaterial.opacity = .1 + power * .15;
    if (power > 0 && now > chargeSoundAt) { tone(160 + power * 420, .08, .012, 180 + power * 430, 'triangle'); chargeSoundAt = now + 110; }
    rimMaterial.color.set(Math.hypot(game.player.x, game.player.z) > 5.6 ? '#ff704e' : '#fbd397');
  } else range.visible = false;
  if (mode !== 'paused') {
    for (const view of views.values()) updateView(view, dt, now / 1000);
    updateView(playerView, dt, now / 1000);
    for (let i = falling.length - 1; i >= 0; i--) {
      updateView(falling[i], dt, now / 1000);
      if (falling[i].fallTime > 1.2) { scene.remove(falling[i].root); falling.splice(i, 1); }
    }
    updateEffects(dt);
    if (endDelay >= 0) { endDelay -= dt; if (endDelay < 0) showResults(); }
  }
  shake *= Math.exp(-dt * 12);
  camera.position.copy(baseCamera);
  if (!reducedMotion) { camera.position.x += (Math.random() - .5) * shake; camera.position.y += (Math.random() - .5) * shake; }
  camera.lookAt(0, 0, 0);
  hudTime += dt;
  if (hudTime > .07) { updateHud(); hudTime = 0; }
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);
document.body.dataset.arcadeReady = 'true';

// Read-only diagnostics for repeatable browser checks; no gameplay shortcuts.
if (new URLSearchParams(location.search).has('test')) {
  window.arcadeSnapshot = () => ({
    mode, score: game.score, kills: game.kills, combo: game.combo, wave: game.wave,
    time: game.time, charge: game.charge, blasts: game.blasts,
    player: { ...game.player }, enemies: game.enemies.map(e => ({ ...e })),
    drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
    geometries: renderer.info.memory.geometries,
    project: game.enemies.map(e => { const p = new THREE.Vector3(e.x, .5, e.z).project(camera); return { id: e.id, x: (p.x + 1) * innerWidth / 2, y: (1 - p.y) * innerHeight / 2 }; }),
  });
}
