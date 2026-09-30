import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const COLORS = {
  marine: 0x0B416F,
  marineDeep: 0x072C4C,
  maillot: 0xF5B315,
  craie: 0xF7F9FB,
  gazon: 0x2E7D4F,
};

export function makeRenderer(container, { alpha = true, shadows = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  if (shadows) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  container.prepend(renderer.domElement);
  return renderer;
}

// Reflets doux « studio » pour les matières brillantes
export function makeEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return env;
}

// Adapte le rendu à la taille du conteneur
export function fit(container, renderer, camera, onResize) {
  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    if (camera.isPerspectiveCamera) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    if (onResize) onResize(w, h);
  };
  new ResizeObserver(resize).observe(container);
  resize();
}

// Boucle d'animation qui ne tourne que lorsque la scène est visible
export function loop(el, frame) {
  let running = false, last = 0, raf = 0, time = 0;
  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    frame(dt, time);
    if (running) raf = requestAnimationFrame(tick);
  };
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !running) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    } else if (!entry.isIntersecting && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  }, { rootMargin: '120px' }).observe(el);
}

// Rotation à la souris ou au doigt, avec inertie
export function dragRotate(el, { maxTilt = 0.5 } = {}) {
  const state = { yaw: 0, pitch: 0, vYaw: 0, vPitch: 0, dragging: false, lastInput: -10 };
  let px = 0, py = 0;
  el.addEventListener('pointerdown', (e) => {
    state.dragging = true; px = e.clientX; py = e.clientY;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', (e) => {
    if (!state.dragging) return;
    const dx = e.clientX - px, dy = e.clientY - py;
    px = e.clientX; py = e.clientY;
    state.vYaw = dx * 0.012;
    state.vPitch = dy * 0.008;
    state.yaw += state.vYaw;
    state.pitch = THREE.MathUtils.clamp(state.pitch + state.vPitch, -maxTilt, maxTilt);
    state.lastInput = performance.now() / 1000;
  });
  const end = () => { state.dragging = false; state.lastInput = performance.now() / 1000; };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  state.update = (dt) => {
    if (!state.dragging) {
      state.yaw += state.vYaw;
      state.pitch = THREE.MathUtils.clamp(state.pitch + state.vPitch, -maxTilt, maxTilt);
      const damp = Math.pow(0.02, dt);
      state.vYaw *= damp; state.vPitch *= damp;
      // après quelques secondes sans contact, l'objet revient doucement face à nous
      if (performance.now() / 1000 - state.lastInput > 2.5) {
        const back = 1 - Math.pow(0.25, dt);
        state.yaw += (Math.round(state.yaw / (Math.PI * 2)) * Math.PI * 2 - state.yaw) * back;
        state.pitch += (0 - state.pitch) * back;
      }
    }
  };
  return state;
}

// Balle de hockey : jaune, avec ses alvéoles
let ballTextures;
function makeBallTextures() {
  const h = 512, w = 1024;
  const color = document.createElement('canvas');
  const bump = document.createElement('canvas');
  color.width = bump.width = w; color.height = bump.height = h;
  const gc = color.getContext('2d');
  const gb = bump.getContext('2d');
  gc.fillStyle = '#F5B315'; gc.fillRect(0, 0, w, h);
  gb.fillStyle = '#fff'; gb.fillRect(0, 0, w, h);

  const rows = 13;
  for (let r = 1; r < rows; r++) {
    const lat = (r / rows - 0.5) * Math.PI;
    const y = (r / rows) * h;
    const stretch = 1 / Math.max(0.18, Math.cos(lat));
    const count = Math.max(3, Math.round(26 * Math.cos(lat)));
    for (let i = 0; i < count; i++) {
      const x = ((i + (r % 2) * 0.5) / count) * w;
      const rad = h * 0.024;
      for (const [g, inner, outer] of [[gc, 'rgba(160,100,0,.55)', 'rgba(160,100,0,0)'], [gb, '#000', '#fff']]) {
        g.save();
        g.translate(x, y);
        g.scale(stretch, 1);
        const grad = g.createRadialGradient(0, 0, 0, 0, 0, rad);
        grad.addColorStop(0, inner);
        grad.addColorStop(1, outer);
        g.fillStyle = grad;
        g.beginPath(); g.arc(0, 0, rad, 0, Math.PI * 2); g.fill();
        g.restore();
      }
    }
  }
  const map = new THREE.CanvasTexture(color);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const bumpMap = new THREE.CanvasTexture(bump);
  return { map, bumpMap };
}

export function ballMaterial() {
  if (!ballTextures) ballTextures = makeBallTextures();
  return new THREE.MeshStandardMaterial({
    map: ballTextures.map,
    bumpMap: ballTextures.bumpMap,
    bumpScale: 4,
    roughness: 0.38,
    metalness: 0.02,
  });
}

// Ombre douce posée au sol (texture radiale)
let shadowTexture;
export function softShadowTexture() {
  if (shadowTexture) return shadowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(7,44,76,.55)');
  grad.addColorStop(1, 'rgba(7,44,76,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  shadowTexture = new THREE.CanvasTexture(c);
  return shadowTexture;
}

export const easeOutBack = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const clamp01 = (t) => Math.min(1, Math.max(0, t));
