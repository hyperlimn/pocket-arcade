import * as THREE from 'three';
import { createGame, aim, shoot, step, guide, LIMIT, LAUNCH_Z, RADIUS, BLOCK_W, BLOCK_D, ROW_STEP, MAX_ANGLE, SHOT_SECONDS } from './model.js';
import './style.css';

const $ = id => document.getElementById(id);
const canvas = $('table'), stage = $('stage');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#0c202a');
const camera = new THREE.OrthographicCamera(-8, 8, 8, -8, .1, 80);
camera.position.set(0, 17, 10); camera.lookAt(0, 0, 0);
scene.add(new THREE.HemisphereLight('#ffefd1', '#285566', 2.6));
const light = new THREE.DirectionalLight('#fff1ce', 2.8); light.position.set(-5, 10, 3); scene.add(light);
const box = new THREE.BoxGeometry(1, 1, 1), sphere = new THREE.SphereGeometry(1, 16, 10);
const disc = new THREE.CircleGeometry(1, 20);
const material = color => new THREE.MeshStandardMaterial({ color, roughness: .65 });
const felt = material('#163f4a'), railMat = material('#3c656a'), brass = material('#a88c5b');
const ivory = new THREE.MeshBasicMaterial({ color: '#ffefc8' });
const mint = new THREE.MeshBasicMaterial({ color: '#95efda' });
function cube(x, y, z, w, h, d, mat) {
  const mesh = new THREE.Mesh(box, mat); mesh.position.set(x, y, z); mesh.scale.set(w, h, d); scene.add(mesh); return mesh;
}
cube(0, -.33, 0, 9.9, .55, 11.85, material('#07161e'));
cube(0, -.08, 0, 9.05, .16, 11.3, felt);
for (const x of [-4.7, 4.7]) { cube(x, .18, -.04, .4, .55, 11.5, railMat); cube(x, .47, -.04, .22, .025, 11.4, brass); }
cube(0, .18, -5.7, 9.4, .55, .4, railMat); cube(0, .47, -5.7, 9.3, .025, .22, brass);
cube(0, -.04, 5.72, 9.4, .2, .3, brass);
const dangerMat = new THREE.MeshBasicMaterial({ color: '#e88c73', transparent: true, opacity: .8 });
const danger = new THREE.InstancedMesh(box, dangerMat, 24); scene.add(danger);
const dummy = new THREE.Object3D();
for (let i = 0; i < 24; i++) {
  dummy.position.set(-4.32 + i * .376, .015, LIMIT); dummy.rotation.set(0, -.4, 0); dummy.scale.set(.19, .02, .13); dummy.updateMatrix(); danger.setMatrixAt(i, dummy.matrix);
}
dummy.rotation.set(0, 0, 0);
const marks = new THREE.InstancedMesh(box, brass, 16); scene.add(marks);
for (let i = 0; i < 16; i++) {
  dummy.position.set(i < 8 ? -4.7 : 4.7, .49, -4.5 + i % 8 * 1.25); dummy.scale.set(.09, .015, .09); dummy.updateMatrix(); marks.setMatrixAt(i, dummy.matrix);
}
const blocks = new THREE.InstancedMesh(box, material('#ffffff'), 49); blocks.instanceMatrix.setUsage(THREE.DynamicDrawUsage); blocks.frustumCulled = false; scene.add(blocks);
const pips = new THREE.InstancedMesh(disc, ivory, 98); pips.instanceMatrix.setUsage(THREE.DynamicDrawUsage); pips.frustumCulled = false; scene.add(pips);
const softShadow = new THREE.MeshBasicMaterial({ color: '#04171e', transparent: true, opacity: .42 });
const shadows = new THREE.InstancedMesh(box, softShadow, 49); shadows.frustumCulled = false; scene.add(shadows);
const ball = new THREE.Mesh(sphere, material('#fff2ce')); ball.scale.setScalar(RADIUS); scene.add(ball);
const ballShadow = new THREE.Mesh(disc, softShadow); ballShadow.rotation.x = -Math.PI / 2; ballShadow.scale.set(.25, .25, .25); scene.add(ballShadow);
const socket = new THREE.Mesh(new THREE.RingGeometry(.3, .34, 32), mint); socket.rotation.x = -Math.PI / 2; scene.add(socket);
const aimGeometry = new THREE.BufferGeometry();
aimGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
const aimLine = new THREE.Line(aimGeometry, new THREE.LineDashedMaterial({ color: '#b6f7e3', dashSize: .12, gapSize: .09, transparent: true, opacity: .8 })); scene.add(aimLine);
const aimTip = new THREE.Mesh(new THREE.RingGeometry(.10, .14, 24), mint); aimTip.rotation.x = -Math.PI / 2; scene.add(aimTip);
const trail = new THREE.InstancedMesh(sphere, mint, 12); trail.frustumCulled = false; scene.add(trail);
const debris = new THREE.InstancedMesh(box, material('#ffc881'), 80); debris.frustumCulled = false; scene.add(debris);
const particles = [], trailPoints = [], flashes = new Map();
const colors = [new THREE.Color('#efa554'), new THREE.Color('#e77462')];
const white = new THREE.Color('#fff7d7'), color = new THREE.Color();
let game = createGame(), mode = 'idle', best = 0, bestRack = 1, muted = false, audio;
let last = performance.now(), accumulator = 0, bump = 0, messageTime = 0, pointerId = null, pointerAim = false;
const held = new Set(); let aimButton = 0;
try { best = Number(localStorage.getItem('bankshot-best')) || 0; bestRack = Number(localStorage.getItem('bankshot-rack')) || 1; muted = localStorage.getItem('bankshot-muted') === 'true'; } catch { /* Local records are optional. */ }
function initAudio() { try { audio ||= new AudioContext(); if (audio.state === 'suspended') audio.resume(); } catch { /* Silent play works. */ } }
function tone(hz, length = .1, volume = .035, end = hz, type = 'sine') {
  if (!audio || muted) return;
  const osc = audio.createOscillator(), gain = audio.createGain(), now = audio.currentTime;
  osc.type = type; osc.frequency.setValueAtTime(hz, now); osc.frequency.exponentialRampToValueAtTime(Math.max(30, end), now + length);
  gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(volume, now + .006); gain.gain.exponentialRampToValueAtTime(.0001, now + length);
  osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(now + length + .02);
  osc.onended = () => { osc.disconnect(); gain.disconnect(); };
}
function announce(title, detail, duration = 1.6) { $('callout').textContent = title; $('hint').textContent = detail; messageTime = duration; }
function hud() {
  $('score').textContent = game.score.toLocaleString(); $('best').textContent = Math.max(best, game.score).toLocaleString();
  $('round').textContent = `RACK ${String(game.round).padStart(2, '0')}`;
  const ready = game.state === 'aiming';
  for (const id of ['fire', 'aim-left', 'aim-right']) $(id).disabled = !ready;
  $('fire').innerHTML = ready ? 'FIRE SHOT <span>SPACE / ENTER</span>' : game.state === 'flying' ? 'BALL IN PLAY <span>FIND THE NEXT ANGLE</span>' : 'NEXT RACK <span>HERE THEY COME</span>';
}
function resetInput() { held.clear(); aimButton = 0; pointerId = null; pointerAim = false; }
function start() {
  if (mode !== 'idle' && mode !== 'dead') return;
  initAudio(); resetInput(); game = createGame(); mode = 'playing'; accumulator = 0; bump = 0;
  particles.length = 0; trailPoints.length = 0; flashes.clear();
  $('overlay').hidden = true; $('intro').hidden = true; $('results').hidden = true; $('pause-panel').hidden = true;
  $('hud').hidden = false; $('shot-ui').hidden = false; $('pause').hidden = false;
  canvas.focus({ preventScroll: true }); announce('FIND YOUR ANGLE.', 'Bank off the rails to get behind the blocks.', 3);
  tone(220, .22, .035, 440, 'triangle'); hud(); resize();
}
function fire() {
  if (mode !== 'playing' || !shoot(game)) return;
  initAudio(); trailPoints.length = 0; pointerId = null; pointerAim = false;
  announce('LET IT RICOCHET.', 'One shot. Make the whole table count.', .9);
  tone(120, .12, .06, 55, 'triangle'); hud();
}
function finish() {
  mode = 'dead'; resetInput();
  const record = game.score > best; best = Math.max(best, game.score); bestRack = Math.max(bestRack, game.round);
  try { localStorage.setItem('bankshot-best', String(best)); localStorage.setItem('bankshot-rack', String(bestRack)); } catch { /* Optional. */ }
  $('result-label').textContent = record ? 'A NEW HOUSE RECORD' : 'THE BLOCKS REACHED YOUR LINE';
  $('final-score').textContent = game.score.toLocaleString(); $('final-rack').textContent = game.round;
  $('final-breaks').textContent = game.broken; $('final-chain').textContent = game.bestChain;
  $('result-tip').textContent = `Best: ${best.toLocaleString()} / rack ${bestRack}. Try a rail shot to reach behind the lowest blocks.`;
  $('overlay').hidden = false; $('results').hidden = false; $('shot-ui').hidden = true; $('pause').hidden = true;
  tone(160, .38, .05, 35, 'triangle'); hud(); resize();
}
function pause() {
  if (mode !== 'playing' && mode !== 'paused') return;
  const resume = mode === 'paused'; mode = resume ? 'playing' : 'paused'; resetInput(); accumulator = 0;
  $('overlay').hidden = resume; $('pause-panel').hidden = resume;
  $('pause').textContent = resume ? 'Ⅱ' : '▶'; $('pause').setAttribute('aria-label', resume ? 'Pause game' : 'Resume game');
  if (resume) { initAudio(); canvas.focus({ preventScroll: true }); } else $('resume').focus({ preventScroll: true });
  resize();
}
function soundUI() { $('sound').textContent = muted ? 'SOUND OFF' : 'SOUND ON'; $('sound').setAttribute('aria-pressed', String(muted)); $('sound').setAttribute('aria-label', muted ? 'Enable sound' : 'Mute sound'); }
function spark(x, z, n) {
  if (reducedMotion) return;
  for (let i = 0; i < n && particles.length < 80; i++) particles.push({ x, z, y: .4, vx: (Math.random() - .5) * 5, vz: (Math.random() - .5) * 5, vy: 2 + Math.random() * 3, life: .35 + Math.random() * .35 });
}
function events(list) {
  for (const e of list) {
    if (e.type === 'bank') { tone(470, .06, .012, 390, 'triangle'); spark(e.x, e.z, 2); }
    if (e.type === 'break' || e.type === 'hit') {
      flashes.set(e.id, 1); spark(e.x, e.z, e.type === 'break' ? 10 : 4); bump = e.type === 'break' ? .065 : .025;
      tone(260 * 2 ** (Math.min(e.chain, 10) / 7), .15, .035, 390 * 2 ** (Math.min(e.chain, 10) / 7), 'triangle');
      announce(e.type === 'hit' ? 'CRACKED IT.' : e.chain > 1 ? `${e.chain} BREAK CHAIN!` : e.banked ? 'BANKSHOT!' : 'CLEAN BREAK.', `${e.banked && e.type === 'break' ? 'RAIL BONUS · ' : ''}+${e.points}`, 1.3);
      hud();
    }
    if (e.type === 'return') {
      announce(e.reason === 'clear' ? 'TABLE SWEPT.' : e.chain > 1 ? `${e.chain} BREAKS. NICE ANGLE.` : e.points ? 'MAKE SOME ROOM.' : 'TRY ANOTHER ANGLE.', e.points ? `+${e.points} THIS SHOT · NEXT RACK INCOMING` : 'Aim at a block or bank behind the row.', 2);
      hud();
    }
    if (e.type === 'ready') { trailPoints.length = 0; tone(140, .08, .02, 110, 'triangle'); hud(); }
    if (e.type === 'dead') finish();
  }
}

const raycaster = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.2), target = new THREE.Vector3();
function pointAim(e) {
  if (mode !== 'playing' || game.state !== 'aiming') return false;
  const rect = canvas.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1), camera);
  if (!raycaster.ray.intersectPlane(plane, target) || target.z >= LAUNCH_Z - .3) return false;
  aim(game, Math.atan2(target.x - game.launchX, LAUNCH_Z - target.z)); return true;
}
canvas.addEventListener('pointerdown', e => {
  if (!e.isPrimary || e.button !== 0 || mode !== 'playing' || game.state !== 'aiming') return;
  e.preventDefault(); canvas.focus({ preventScroll: true }); pointerId = e.pointerId; pointerAim = pointAim(e); canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => { if (e.isPrimary && (pointerId === e.pointerId || e.pointerType === 'mouse') && !held.size) { const valid = pointAim(e); if (pointerId === e.pointerId) pointerAim = valid; } });
canvas.addEventListener('pointerup', e => {
  if (pointerId !== e.pointerId) return;
  const valid = pointerAim && pointAim(e); pointerId = null; pointerAim = false;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  if (valid) fire();
});
canvas.addEventListener('pointercancel', () => { pointerId = null; pointerAim = false; });
canvas.addEventListener('lostpointercapture', () => { pointerId = null; pointerAim = false; });
for (const [id, direction] of [['aim-left', -1], ['aim-right', 1]]) {
  $(id).addEventListener('pointerdown', e => { if (e.isPrimary && e.button === 0) { e.preventDefault(); aimButton = direction; aim(game, game.angle + direction * .025); $(id).setPointerCapture(e.pointerId); } });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) $(id).addEventListener(type, () => { aimButton = 0; });
  $(id).addEventListener('click', e => { if (e.detail === 0 && mode === 'playing') aim(game, game.angle + direction * .04); });
}
$('start').addEventListener('click', start); $('restart').addEventListener('click', start);
$('fire').addEventListener('click', () => { fire(); canvas.focus({ preventScroll: true }); });
$('pause').addEventListener('click', pause); $('resume').addEventListener('click', pause);
$('sound').addEventListener('click', e => {
  muted = !muted; initAudio(); soundUI();
  try { localStorage.setItem('bankshot-muted', String(muted)); } catch { /* Optional. */ }
  if (e.detail > 0 && mode === 'playing') canvas.focus({ preventScroll: true });
});
addEventListener('keydown', e => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.code === 'KeyP' || e.code === 'Escape') { e.preventDefault(); if (!e.repeat) pause(); return; }
  if (e.target.closest('a, #sound, #pause, #resume, #aim-left, #aim-right')) return;
  if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
    if (mode === 'playing') { e.preventDefault(); held.add(e.code); } return;
  }
  if (!['Space', 'Enter'].includes(e.code)) return;
  e.preventDefault(); if (e.repeat) return;
  if (mode === 'idle' || mode === 'dead') start(); else fire();
});
addEventListener('keyup', e => held.delete(e.code));
addEventListener('blur', () => { resetInput(); if (mode === 'playing') pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'playing') pause(); });

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight, aspect = w / h;
  const overlay = mode === 'idle' || mode === 'dead' || mode === 'paused';
  const size = Math.max(11.5, (overlay && innerWidth > 700 ? 18.5 : 10.8) / aspect);
  camera.left = -size * aspect / 2; camera.right = size * aspect / 2; camera.top = size / 2; camera.bottom = -size / 2;
  camera.setViewOffset(w, h, overlay && innerWidth > 700 ? -w * .23 : 0, 0, w, h); camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setSize(w, h);
}
addEventListener('resize', resize);
function draw(dt) {
  let n = 0;
  const shift = game.state === 'settling' ? (1 - game.transition / .48) ** 2 * ROW_STEP : 0;
  game.blocks.forEach((b, i) => {
    const flash = flashes.get(b.id) || 0;
    dummy.rotation.set(0, 0, 0); dummy.position.set(b.x, .34, b.z + shift); dummy.scale.set(BLOCK_W, .66 + flash * .14, BLOCK_D); dummy.updateMatrix(); blocks.setMatrixAt(i, dummy.matrix);
    blocks.setColorAt(i, color.copy(colors[b.hp - 1]).lerp(white, flash * .75));
    dummy.position.set(b.x + .075, .013, b.z + .075 + shift); dummy.scale.set(1.08, .012, .94); dummy.updateMatrix(); shadows.setMatrixAt(i, dummy.matrix);
    for (let j = 0; j < b.hp; j++) {
      dummy.position.set(b.x + (j - (b.hp - 1) / 2) * .32, .681 + flash * .07, b.z + shift); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.setScalar(.075); dummy.updateMatrix(); pips.setMatrixAt(n++, dummy.matrix);
    }
  });
  blocks.count = shadows.count = game.blocks.length; pips.count = n;
  blocks.instanceMatrix.needsUpdate = shadows.instanceMatrix.needsUpdate = pips.instanceMatrix.needsUpdate = true;
  if (blocks.instanceColor) blocks.instanceColor.needsUpdate = true;
  const aiming = game.state === 'aiming';
  ball.visible = ballShadow.visible = game.state !== 'dead';
  const bx = aiming ? game.launchX : game.ball.x, bz = aiming ? LAUNCH_Z : game.ball.z;
  ball.position.set(bx, .22, bz); ballShadow.position.set(bx + .035, .02, bz + .035);
  if (game.state === 'settling') { ball.position.x += (game.launchX - bx) * (1 - game.transition / .48); ball.position.z += (LAUNCH_Z - bz) * (1 - game.transition / .48); ballShadow.position.copy(ball.position); ballShadow.position.y = .02; }
  socket.position.set(game.launchX, .018, LAUNCH_Z);
  aimLine.visible = aimTip.visible = aiming && mode === 'playing';
  if (aimLine.visible) {
    const points = guide(game), pos = aimGeometry.attributes.position;
    points.forEach((p, i) => pos.setXYZ(i, p.x, .2, p.z));
    // Fill unused vertices so line distance computation never sees stale data.
    for (let i = points.length; i < 4; i++) pos.setXYZ(i, points.at(-1).x, .2, points.at(-1).z);
    pos.needsUpdate = true; aimGeometry.setDrawRange(0, points.length); aimGeometry.computeBoundingSphere(); aimLine.computeLineDistances();
    aimTip.position.set(points.at(-1).x, .205, points.at(-1).z);
  }
  if (mode !== 'paused') {
    if (game.state === 'flying' && !reducedMotion) { trailPoints.unshift({ x: game.ball.x, z: game.ball.z }); if (trailPoints.length > 12) trailPoints.pop(); }
    else if (trailPoints.length) trailPoints.pop();
    for (const [id, value] of flashes) { if (value <= dt * 5) flashes.delete(id); else flashes.set(id, value - dt * 5); }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.life -= dt; if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt; p.vy -= dt * 13;
    }
    bump *= Math.exp(-dt * 17);
  }
  trailPoints.forEach((p, i) => { dummy.position.set(p.x, .21, p.z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(.105 * (1 - i / 12)); dummy.updateMatrix(); trail.setMatrixAt(i, dummy.matrix); });
  trail.count = trailPoints.length; trail.instanceMatrix.needsUpdate = true;
  particles.forEach((p, i) => { dummy.position.set(p.x, Math.max(.04, p.y), p.z); dummy.rotation.set(p.life * 4, p.life * 3, 0); dummy.scale.setScalar(.12 * Math.min(1, p.life * 5)); dummy.updateMatrix(); debris.setMatrixAt(i, dummy.matrix); });
  debris.count = particles.length; debris.instanceMatrix.needsUpdate = true;
  const low = game.blocks.some(b => b.z > 1.5);
  dangerMat.opacity = low ? .85 + Math.sin(game.time * 5) * .15 : .6;
  $('charge').style.transform = `scaleX(${game.state === 'flying' ? Math.max(0, 1 - game.shotTime / SHOT_SECONDS) : aiming ? 1 : 0})`;
  camera.position.y = 17 + (reducedMotion ? 0 : bump); camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
}
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (mode === 'playing') {
    const direction = aimButton || (Number(held.has('ArrowRight') || held.has('KeyD')) - Number(held.has('ArrowLeft') || held.has('KeyA')));
    if (direction) aim(game, game.angle + direction * dt * (held.has('ShiftLeft') || held.has('ShiftRight') ? .25 : .85));
    accumulator += dt;
    while (accumulator >= 1 / 120 && mode === 'playing') { events(step(game, 1 / 120)); accumulator -= 1 / 120; }
    messageTime -= dt;
    if (messageTime <= 0 && game.state === 'aiming') {
      $('callout').textContent = game.blocks.some(b => b.z > 1.5) ? 'CLEAR THE LOW BLOCKS.' : 'FIND YOUR ANGLE.';
      $('hint').textContent = game.round === 1 ? 'Drag to aim / release to fire. Or use ← → and Space.' : 'Rail banks add bonuses. Chain breaks multiply points.';
    }
  }
  draw(mode === 'paused' ? 0 : dt);
}
soundUI(); resize(); requestAnimationFrame(animate);
document.body.dataset.arcadeReady = 'true';

// Read-only observation for browser validation. Input always uses the real controls.
if (new URLSearchParams(location.search).has('test')) {
  const project = (x, z) => { const p = new THREE.Vector3(x, .2, z).project(camera), rect = canvas.getBoundingClientRect(); return { x: rect.left + (p.x + 1) / 2 * rect.width, y: rect.top + (1 - p.y) / 2 * rect.height }; };
  window.arcadeSnapshot = () => ({ mode, ...JSON.parse(JSON.stringify(game)), drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, particles: particles.length,
    blockScreens: game.blocks.map(b => ({ id: b.id, ...project(b.x, b.z) })), launchScreen: project(game.launchX, LAUNCH_Z),
    tableFrame: [project(0, 0), project(1, 0), project(0, 1)],
    tableCorners: [[-5, -5.95], [5, -5.95], [-5, 5.95], [5, 5.95]].map(([x, z]) => project(x, z)),
    aimScreen: project(game.launchX + Math.sin(game.angle) * 4, LAUNCH_Z - Math.cos(game.angle) * 4), maxAngle: MAX_ANGLE });
}
