import * as THREE from 'three';
import { createGame, step, place, SLAB_HEIGHT, TRAVEL } from './model.js';
import './style.css';

const $ = id => document.getElementById(id);
const canvas = $('tower');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#e9ded0');
const camera = new THREE.OrthographicCamera(-10, 10, 8, -8, .1, 180);
scene.add(new THREE.HemisphereLight('#fff5db', '#4c7979', 2.6));
const light = new THREE.DirectionalLight('#fff0d7', 3);
light.position.set(-4, 9, 5); scene.add(light);
const box = new THREE.BoxGeometry(1, 1, 1);
const edges = new THREE.EdgesGeometry(box);
const whiteLine = new THREE.LineBasicMaterial({ color: '#fff7df', transparent: true, opacity: .75 });
const palette = ['#347b79', '#58968a', '#9eaf8c', '#d8b47b', '#e2926c', '#c47b77', '#9b8eaa', '#5c9ea3'].map(c => new THREE.Color(c));
// A fixed palette and one shared box keep long runs inexpensive.
const materials = Array.from({ length: 64 }, (_, i) => new THREE.MeshStandardMaterial({
  color: palette[Math.floor(i / 8)].clone().lerp(palette[(Math.floor(i / 8) + 1) % palette.length], i % 8 / 8), roughness: .72,
}));
const materialFor = height => materials[(height % materials.length + materials.length) % materials.length];
const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.4, .55, 12), new THREE.MeshStandardMaterial({ color: '#cebc9d', roughness: 1 }));
pedestal.position.y = -.58; pedestal.rotation.y = Math.PI / 12; scene.add(pedestal);
const halo = new THREE.Mesh(new THREE.RingGeometry(4.4, 4.42, 80), new THREE.MeshBasicMaterial({ color: '#628c84', side: THREE.DoubleSide, transparent: true, opacity: .25 }));
halo.rotation.x = -Math.PI / 2; halo.position.y = -.9; scene.add(halo);
const slabGroup = new THREE.Group(); scene.add(slabGroup);
const active = new THREE.Mesh(box, materialFor(1)); scene.add(active);
const outline = new THREE.LineSegments(edges, whiteLine); active.add(outline);
outline.scale.setScalar(1.006);
const rail = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: '#356c69', transparent: true, opacity: .16 })); scene.add(rail);
const targetOutline = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: '#fff6d8', transparent: true, opacity: .65 })); scene.add(targetOutline);
const dust = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: '#fff7db' }), 60);
dust.frustumCulled = false; dust.instanceMatrix.setUsage(THREE.DynamicDrawUsage); dust.count = 0; scene.add(dust);
const dummy = new THREE.Object3D();
const particles = [], falling = [], slabs = [];
let game = createGame(), mode = 'idle', best = 0, bestHeight = 0, muted = false;
try {
  best = Number(localStorage.getItem('skyslice-best')) || 0;
  bestHeight = Number(localStorage.getItem('skyslice-height')) || 0;
  muted = localStorage.getItem('skyslice-muted') === 'true';
} catch { /* Storage is optional. */ }
let audio, cameraY = 0, cameraX = 0, cameraZ = 0, bump = 0, endDelay = -1, feedbackTime = 0;
let last = performance.now(), accumulator = 0, demoTime = 0;

function sound(frequency, duration = .14, volume = .04, end = frequency, type = 'sine') {
  if (!audio || muted) return;
  const osc = audio.createOscillator(), gain = audio.createGain(), now = audio.currentTime;
  osc.type = type; osc.frequency.setValueAtTime(frequency, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(30, end), now + duration);
  gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(volume, now + .008);
  gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
  osc.connect(gain); gain.connect(audio.destination); osc.start(now); osc.stop(now + duration + .02);
  osc.onended = () => { osc.disconnect(); gain.disconnect(); };
}
function initAudio() {
  try { audio ||= new AudioContext(); if (audio.state === 'suspended') audio.resume(); } catch { /* Silent play works. */ }
}
function setSlab(mesh, slab, height) {
  mesh.position.set(slab.x, height * SLAB_HEIGHT, slab.z);
  mesh.scale.set(slab.w, SLAB_HEIGHT * .965, slab.d);
}
function addSlab(slab, height) {
  const mesh = new THREE.Mesh(box, materialFor(height));
  setSlab(mesh, slab, height); slabGroup.add(mesh); slabs.push(mesh);
  if (slabs.length > 48) slabGroup.remove(slabs.shift());
  return mesh;
}
function clearWorld() {
  slabGroup.clear(); slabs.length = 0;
  for (const bit of falling) scene.remove(bit.mesh);
  falling.length = 0; particles.length = 0; dust.count = 0;
  feedbackTime = 0; $('feedback').classList.remove('show'); bump = 0; endDelay = -1;
}
function demo() {
  clearWorld();
  for (let h = 0; h < 8; h++) addSlab({ x: h * .025, z: h * -.025, w: 3.8 - h * .14, d: 3.8 - h * .1 }, h);
  cameraY = 1.3;
}
function hud() {
  $('score').textContent = game.score.toLocaleString();
  $('height').textContent = game.height;
  $('best').textContent = Math.max(best, game.score).toLocaleString();
  $('chapter').textContent = `RISE ${String(1 + Math.floor(game.height / 10)).padStart(2, '0')}`;
  const dots = game.streak > 0 ? (game.streak - 1) % 3 + 1 : 0;
  document.querySelectorAll('.streak i').forEach((dot, i) => dot.classList.toggle('lit', i < dots));
  $('streak-label').textContent = game.streak ? `STREAK ${game.streak} · ${3 - game.streak % 3} TO GROW` : '3 PERFECTS = GROWTH';
}
function start() {
  if (mode === 'playing' || mode === 'paused' || mode === 'falling') return;
  initAudio(); clearWorld(); game = createGame(); mode = 'playing'; accumulator = 0;
  cameraY = 0; cameraX = cameraZ = 0;
  addSlab(game.top, 0);
  $('overlay').hidden = true; $('intro').hidden = true; $('results').hidden = true; $('pause-panel').hidden = true;
  $('hud').hidden = false; $('play-ui').hidden = false; $('pause').hidden = false;
  active.visible = true; rail.visible = true; targetOutline.visible = true;
  canvas.focus({ preventScroll: true });
  sound(220, .22, .04, 440, 'triangle'); hud(); resize();
}
function announce(title, detail) {
  $('callout').textContent = title; $('callout-detail').textContent = detail;
  $('feedback').classList.add('show'); feedbackTime = 1.35;
}
function sparks(slab, y, count) {
  if (reducedMotion) return;
  for (let i = 0; i < count && particles.length < 60; i++) {
    particles.push({ x: slab.x + (Math.random() - .5) * slab.w, y, z: slab.z + (Math.random() - .5) * slab.d,
      vx: (Math.random() - .5) * 2, vy: 1.2 + Math.random() * 2, vz: (Math.random() - .5) * 2, life: .5 + Math.random() * .4 });
  }
}
function dropPiece(slab, height, miss = false) {
  const mesh = new THREE.Mesh(box, materialFor(height)); setSlab(mesh, slab, height); scene.add(mesh);
  const sign = Math.sign(slab.offset) || 1;
  falling.push({ mesh, life: 0, vy: miss ? 0 : 1, vx: slab.axis === 'x' ? sign * 1.6 : 0, vz: slab.axis === 'z' ? sign * 1.6 : 0 });
  if (falling.length > 10) scene.remove(falling.shift().mesh);
}
function doPlace() {
  if (mode !== 'playing') return;
  const event = place(game); if (!event) return;
  if (event.type === 'miss') {
    mode = 'falling'; active.visible = false; rail.visible = false; targetOutline.visible = false;
    $('play-ui').hidden = true; $('pause').hidden = true;
    dropPiece(event.slab, event.height, true); endDelay = .65;
    announce('MISSED IT.', 'ONE MORE TOWER?'); sound(180, .45, .06, 35, 'triangle');
    return;
  }
  addSlab(event.slab, event.height);
  if (event.cut) dropPiece(event.cut, event.height);
  sparks(event.slab, event.height * SLAB_HEIGHT + .3, event.perfect ? 18 : 6);
  bump = event.perfect ? .13 : .055;
  const note = 261.63 * 2 ** ([0, 2, 4, 7, 9][Math.max(0, Math.min(4, event.streak - 1))] / 12);
  sound(100, .09, .055, 50, 'triangle');
  if (event.perfect) {
    sound(note, .3, .045); sound(note * 2, .2, .02);
    announce(event.repair ? 'ROOM TO GROW.' : `PERFECT${event.streak > 1 ? ` ×${event.streak}` : '.'}`, event.repair ? `TOP RESTORED · +${event.points}` : `FLUSH LANDING · +${event.points}`);
  } else {
    sound(360, .09, .017, 160, 'triangle');
    announce(event.height % 10 === 0 ? `RISE ${1 + Math.floor(event.height / 10)}` : 'NICE SLICE.', `+${event.points} · ${Math.round(game.top.w * game.top.d / 3.8 ** 2 * 100)}% TOP LEFT`);
  }
  hud();
}
function results() {
  mode = 'dead';
  const record = game.score > best;
  best = Math.max(best, game.score); bestHeight = Math.max(bestHeight, game.height);
  try { localStorage.setItem('skyslice-best', String(best)); localStorage.setItem('skyslice-height', String(bestHeight)); } catch { /* Optional. */ }
  $('result-label').textContent = record ? 'A NEW HIGH POINT' : 'ONE SLICE TOO FAR';
  $('final-score').textContent = game.score.toLocaleString(); $('final-height').textContent = game.height;
  $('final-perfects').textContent = game.perfects; $('final-streak').textContent = game.bestStreak;
  $('result-tip').textContent = game.height === 0 ? 'Wait for the slab to line up, then place it.' : `Best: ${best.toLocaleString()} points / ${bestHeight} slabs. A little higher?`;
  $('feedback').classList.remove('show'); $('overlay').hidden = false; $('results').hidden = false;
  hud(); resize();
}
function pause() {
  if (mode !== 'playing' && mode !== 'paused') return;
  const resume = mode === 'paused'; mode = resume ? 'playing' : 'paused';
  $('overlay').hidden = resume; $('pause-panel').hidden = resume; $('play-ui').hidden = !resume;
  $('pause').textContent = resume ? 'Ⅱ' : '▶'; $('pause').setAttribute('aria-label', resume ? 'Pause game' : 'Resume game');
  if (resume) { initAudio(); canvas.focus({ preventScroll: true }); }
  else $('resume').focus({ preventScroll: true });
  accumulator = 0; resize();
}
function updateSound() {
  $('sound').textContent = muted ? 'SOUND OFF' : 'SOUND ON';
  $('sound').setAttribute('aria-label', muted ? 'Enable sound' : 'Mute sound'); $('sound').setAttribute('aria-pressed', String(muted));
}
$('start').addEventListener('click', start); $('restart').addEventListener('click', start);
$('place').addEventListener('pointerdown', event => { if (event.button === 0) { event.preventDefault(); doPlace(); } });
// Assistive-technology activation still works without a pointer event.
$('place').addEventListener('click', event => { if (event.detail === 0) doPlace(); });
canvas.addEventListener('pointerdown', event => { if (event.isPrimary && event.button === 0) { event.preventDefault(); doPlace(); } });
$('pause').addEventListener('click', pause); $('resume').addEventListener('click', pause);
$('sound').addEventListener('click', event => {
  muted = !muted; initAudio(); updateSound();
  if (event.detail > 0 && mode === 'playing') canvas.focus({ preventScroll: true });
  try { localStorage.setItem('skyslice-muted', String(muted)); } catch { /* Optional. */ }
});
addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.code === 'KeyP' || event.code === 'Escape') { event.preventDefault(); if (!event.repeat) pause(); return; }
  if (!['Space', 'Enter'].includes(event.code)) return;
  // Preserve normal keyboard activation of navigation, sound and pause controls.
  if (event.target.closest('a, #sound, #pause, #resume')) return;
  event.preventDefault(); if (event.repeat) return;
  if (mode === 'idle' || mode === 'dead') start(); else doPlace();
});
addEventListener('blur', () => { if (mode === 'playing') pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'playing') pause(); });

function resize() {
  const aspect = innerWidth / innerHeight;
  const size = Math.max(13.5, 13 / aspect);
  camera.left = -size * aspect / 2; camera.right = size * aspect / 2;
  camera.top = size / 2; camera.bottom = -size / 2;
  const overlay = mode === 'idle' || mode === 'dead' || mode === 'paused';
  // Place the sculpture alongside the copy, or below it on a phone.
  camera.setViewOffset(innerWidth, innerHeight, overlay && innerWidth > 700 ? -innerWidth * .22 : 0,
    overlay && innerWidth <= 700 ? -innerHeight * .24 : 0, innerWidth, innerHeight);
  camera.updateProjectionMatrix(); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', resize);
function effects(dt) {
  for (let i = falling.length - 1; i >= 0; i--) {
    const bit = falling[i]; bit.life += dt; bit.vy -= 17 * dt;
    bit.mesh.position.x += bit.vx * dt; bit.mesh.position.z += bit.vz * dt; bit.mesh.position.y += bit.vy * dt;
    if (!reducedMotion) { bit.mesh.rotation.x += bit.vz * dt; bit.mesh.rotation.z -= bit.vx * dt; }
    if (bit.life > 2) { scene.remove(bit.mesh); falling.splice(i, 1); }
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= dt * 7;
  }
  particles.forEach((p, i) => {
    dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(p.life * 3, 0, p.life * 4);
    dummy.scale.setScalar(.085 * Math.min(1, p.life * 4)); dummy.updateMatrix(); dust.setMatrixAt(i, dummy.matrix);
  });
  dust.count = particles.length; dust.instanceMatrix.needsUpdate = true;
  if (feedbackTime > 0) { feedbackTime -= dt; if (feedbackTime <= 0) $('feedback').classList.remove('show'); }
}
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - last) / 1000, .05); last = now;
  if (mode === 'playing') {
    accumulator += dt;
    while (accumulator >= 1 / 120) { step(game, 1 / 120); accumulator -= 1 / 120; }
  }
  if (mode === 'idle') {
    demoTime += dt;
    setSlab(active, { x: Math.sin(demoTime * .85) * 3.4, z: -.175, w: 2.82, d: 3.1 }, 8);
    active.material = materialFor(8); rail.visible = false; targetOutline.visible = false;
  } else {
    if (mode === 'playing' || mode === 'paused') {
      setSlab(active, game.active, game.height + 1); active.material = materialFor(game.height + 1);
      active.visible = game.cooldown === 0;
      rail.position.set(game.top.x, (game.height + 1) * SLAB_HEIGHT, game.top.z);
      rail.scale.set(game.active.axis === 'x' ? TRAVEL * 2 + game.top.w : .025, .012, game.active.axis === 'z' ? TRAVEL * 2 + game.top.d : .025);
      setSlab(targetOutline, game.top, game.height); targetOutline.scale.y = SLAB_HEIGHT * .985;
    }
    const follow = 1 - Math.exp(-dt * 6);
    cameraY += (game.height * SLAB_HEIGHT - .55 - cameraY) * follow;
    cameraX += (game.top.x - cameraX) * follow; cameraZ += (game.top.z - cameraZ) * follow;
  }
  if (mode !== 'paused') {
    effects(dt); bump *= Math.exp(-dt * 14);
    if (endDelay >= 0) { endDelay -= dt; if (endDelay < 0) results(); }
  }
  const squash = reducedMotion ? 0 : bump;
  if (mode !== 'idle' && slabs.length) slabs.at(-1).scale.y = SLAB_HEIGHT * (.965 - squash);
  camera.position.set(cameraX + 11, cameraY + 10, cameraZ + 12);
  camera.lookAt(cameraX, cameraY + (reducedMotion ? 0 : bump * .4), cameraZ);
  pedestal.visible = game.height < 42; halo.visible = game.height < 26;
  renderer.render(scene, camera);
}
demo(); updateSound(); resize(); requestAnimationFrame(animate);
document.body.dataset.arcadeReady = 'true';

// Read-only instrumentation; all browser tests act through normal input.
if (new URLSearchParams(location.search).has('test')) {
  window.arcadeSnapshot = () => ({ mode, time: game.time, score: game.score, height: game.height, streak: game.streak,
    bestStreak: game.bestStreak, perfects: game.perfects, repairs: game.repairs, cooldown: game.cooldown, speed: game.speed,
    top: { ...game.top }, active: { ...game.active }, drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries,
    visibleSlabs: slabs.length, fallingPieces: falling.length, particles: particles.length });
}
