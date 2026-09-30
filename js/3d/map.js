// Maquette 3D stylisée des installations du Chemin Poivré
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeRenderer, fit, loop, COLORS } from './shared.js';

const SPOTS = {
  terrain: {
    pos: [-2.5, 0, -0.5],
    title: 'Terrain synthétique',
    text: 'Terrain synthétique arrosé, inauguré en septembre 2020 après quatre ans de travaux. Depuis 2024, le Chemin Poivré est Centre de préparation officiel des Jeux olympiques de Paris 2024.',
  },
  clubhouse: {
    pos: [6.5, 1.6, -5.5],
    title: 'Club-house',
    text: 'Construit en 1990, au cœur des deux hectares que le club occupe au Chemin Poivré depuis 1987.',
  },
  parking: {
    pos: [6.5, 0, 4.5],
    title: 'Parking',
    text: 'Aménagé lors de la rénovation des installations, entre 2016 et 2020.',
  },
  entree: {
    pos: [10.6, 1, 0],
    title: 'Entrée',
    text: '200 Chemin Poivré, 59700 Marcq-en-Barœul, au sein de l\'Hippodrome des Flandres.',
  },
};

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...extra });

function textTexture(text, { bg = '#0B416F', fg = '#F5B315', w = 512, h = 128, size = 76 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = fg;
  g.font = `900 ${size}px "Big Shoulders Display", "Arial Narrow", sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function shadowsOn(obj) {
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return obj;
}

// Ligne blanche peinte au sol
function paint(group, x1, z1, x2, z2, w = 0.05, y = 0.075, color = 0xffffff) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.01, w), mat(color, { roughness: 0.6 }));
  m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
  m.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
  m.receiveShadow = true;
  group.add(m);
}

function pitch() {
  const g = new THREE.Group();
  const runoff = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.06, 7.4), mat(0x2F6DB5, { roughness: 0.9 }));
  runoff.position.y = 0.03;
  const turf = new THREE.Mesh(new THREE.BoxGeometry(9.14, 0.06, 5.5), mat(COLORS.gazon, { roughness: 0.95 }));
  turf.position.y = 0.045;
  runoff.receiveShadow = turf.receiveShadow = true;
  g.add(runoff, turf);

  const hx = 4.57, hz = 2.75;
  paint(g, -hx, -hz, hx, -hz); paint(g, -hx, hz, hx, hz);
  paint(g, -hx, -hz, -hx, hz); paint(g, hx, -hz, hx, hz);
  paint(g, 0, -hz, 0, hz);
  paint(g, -2.28, -hz, -2.28, hz); paint(g, 2.28, -hz, 2.28, hz);

  // Cercles de tir
  [[-hx, -Math.PI / 2], [hx, Math.PI / 2]].forEach(([x, start]) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.43, 1.49, 48, 1, start, Math.PI), mat(0xffffff, { side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.08, 0);
    g.add(ring);
  });

  // Buts
  [[-hx, -1], [hx, 1]].forEach(([x, dir]) => {
    const goal = new THREE.Group();
    const white = mat(0xffffff, { roughness: 0.4 });
    const post = new THREE.BoxGeometry(0.04, 0.22, 0.04);
    const p1 = new THREE.Mesh(post, white); p1.position.set(0, 0.19, -0.19);
    const p2 = new THREE.Mesh(post, white); p2.position.set(0, 0.19, 0.19);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.42), white); bar.position.set(0, 0.3, 0);
    const net = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.38), mat(0xffffff, { transparent: true, opacity: 0.35 }));
    net.position.set(0.08 * dir, 0.19, 0);
    goal.add(p1, p2, bar, net);
    goal.position.x = x;
    g.add(shadowsOn(goal));
  });

  // Grillage autour du terrain
  const fence = mat(0x1E4D33, { transparent: true, opacity: 0.4, side: THREE.DoubleSide });
  [[0, -3.7, 11.4, 0], [0, 3.7, 11.4, 0], [-5.7, 0, 7.4, Math.PI / 2], [5.7, 0, 7.4, Math.PI / 2]].forEach(([x, z, len, rot]) => {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.4), fence);
    f.position.set(x, 0.26, z);
    f.rotation.y = rot;
    g.add(f);
  });

  // Projecteurs aux quatre coins
  const lamps = [];
  [[-5.9, -3.9], [5.9, -3.9], [-5.9, 3.9], [5.9, 3.9]].forEach(([x, z]) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.2, 10), mat(0x8A96A3, { metalness: 0.5, roughness: 0.4 }));
    pole.position.set(x, 1.6, z);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.12), mat(0xffffff, { emissive: 0xFFF2C0, emissiveIntensity: 0.9 }));
    head.position.set(x, 3.25, z);
    head.lookAt(0, 0, 0);
    lamps.push(head);
    g.add(shadowsOn(pole), head);
  });
  g.userData.lamps = lamps;

  g.position.set(-2.5, 0, -0.5);
  return g;
}

function clubhouse() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(4, 1.1, 2.4), mat(0xEEF1F4));
  body.position.y = 0.55;
  g.add(body);

  const tri = new THREE.Shape([new THREE.Vector2(-1.4, 0), new THREE.Vector2(1.4, 0), new THREE.Vector2(0, 0.8)]);
  const roofGeo = new THREE.ExtrudeGeometry(tri, { depth: 4.3, bevelEnabled: false });
  roofGeo.translate(0, 0, -2.15);
  const roof = new THREE.Mesh(roofGeo, mat(COLORS.marine, { roughness: 0.6 }));
  roof.rotation.y = Math.PI / 2;
  roof.position.y = 1.1;
  g.add(roof);

  const door = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.06), mat(COLORS.maillot));
  door.position.set(0, 0.38, 1.21);
  g.add(door);
  [-1.3, -0.7, 0.7, 1.3].forEach((x) => {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.05), mat(0x9FD0F5, { roughness: 0.2, metalness: 0.2 }));
    win.position.set(x, 0.62, 1.21);
    g.add(win);
  });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(2, 0.34, 0.06), [
    mat(COLORS.marine), mat(COLORS.marine), mat(COLORS.marine), mat(COLORS.marine),
    new THREE.MeshStandardMaterial({ map: textTexture('POLO HOCKEY CLUB', { size: 64 }), roughness: 0.5 }),
    mat(COLORS.marine),
  ]);
  sign.position.set(0, 1.0, 1.23);
  g.add(sign);

  // Mât et drapeau du club
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.6, 8), mat(0xD9DEE4, { metalness: 0.6, roughness: 0.3 }));
  mast.position.set(2.4, 1.3, 1.1);
  g.add(mast);
  const flagTex = textTexture('POLO', { bg: '#F5B315', fg: '#0B416F', w: 256, h: 160, size: 96 });
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5, 12, 1), new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.7 }));
  flag.geometry.translate(0.4, 0, 0);
  flag.position.set(2.43, 2.35, 1.1);
  g.add(flag);
  g.userData.flag = flag;

  shadowsOn(g);
  g.position.set(6.5, 0, -5.5);
  return g;
}

function parking() {
  const g = new THREE.Group();
  const asphalt = new THREE.Mesh(new THREE.BoxGeometry(5, 0.04, 4), mat(0x59606B, { roughness: 0.95 }));
  asphalt.position.y = 0.02;
  asphalt.receiveShadow = true;
  g.add(asphalt);
  for (let i = 0; i <= 5; i++) {
    const x = -2.2 + i * 0.88;
    paint(g, x, -1.9, x, -0.6, 0.04, 0.05);
    paint(g, x, 0.6, x, 1.9, 0.04, 0.05);
  }
  const colors = [COLORS.maillot, COLORS.marine, 0xffffff, 0xE4572E, 0x7FB3E0];
  [[-1.76, -1.25], [-0.88, -1.25], [0.88, -1.25], [-1.76, 1.25], [0, 1.25], [1.76, 1.25]].forEach(([x, z], i) => {
    const car = new THREE.Group();
    const c = mat(colors[i % colors.length], { roughness: 0.35, metalness: 0.2 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.26, 1.1), c);
    body.position.y = 0.2;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.22, 0.6), mat(0xCFE6F7, { roughness: 0.2, metalness: 0.3 }));
    cabin.position.set(0, 0.42, -0.05);
    car.add(body, cabin);
    car.position.set(x, 0, z);
    g.add(shadowsOn(car));
  });
  g.position.set(6.5, 0, 4.5);
  return g;
}

function road() {
  const g = new THREE.Group();
  const asphalt = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.04, 20), mat(0x3F4650, { roughness: 0.95 }));
  asphalt.position.set(11.8, 0.02, 0);
  asphalt.receiveShadow = true;
  g.add(asphalt);
  for (let z = -9.5; z < 10; z += 1.2) paint(g, 11.8, z, 11.8, z + 0.6, 0.06, 0.05);

  // Chemins d'accès depuis l'entrée
  const path = mat(0xD8CFC0, { roughness: 1 });
  const p1 = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.03, 1.1), path);
  p1.position.set(7.5, 0.015, 0);
  const p2 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.03, 3.4), path);
  p2.position.set(6.5, 0.015, -2.6);
  p1.receiveShadow = p2.receiveShadow = true;
  g.add(p1, p2);

  // Portail d'entrée
  const gate = new THREE.Group();
  [-0.85, 0.85].forEach((z) => {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.3, 0.3), mat(COLORS.marine));
    pillar.position.set(0, 0.65, z);
    gate.add(pillar);
  });
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.34, 2.1), [
    new THREE.MeshStandardMaterial({ map: textTexture('CHEMIN POIVRÉ', { size: 58 }), roughness: 0.5 }),
    mat(COLORS.marine), mat(COLORS.marine), mat(COLORS.marine), mat(COLORS.marine), mat(COLORS.marine),
  ]);
  board.position.set(0, 1.35, 0);
  gate.add(board);
  gate.position.set(10.6, 0, 0);
  g.add(shadowsOn(gate));
  return g;
}

function trees() {
  const g = new THREE.Group();
  const greens = [0x3E8E4E, 0x2F7A45, 0x4FA35B];
  const trunkMat = mat(0x7A5230);
  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const spots = [];
  for (let x = -12; x <= 9; x += 1.6) spots.push([x, -9 + rand() * 0.8]);
  for (let z = -7.5; z <= 9; z += 1.7) spots.push([-12 + rand() * 0.8, z]);
  for (let x = -10; x <= 2; x += 2.2) spots.push([x, 7.4 + rand() * 1.6]);
  spots.push([3.2, -7.2], [2.4, 6.4], [9.4, -8.2], [9.4, 8.6]);
  spots.forEach(([x, z], i) => {
    const s = 0.7 + rand() * 0.6;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * s, 0.1 * s, 0.7 * s, 6), trunkMat);
    trunk.position.set(x, 0.35 * s, z);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62 * s, 0), mat(greens[i % 3], { flatShading: true }));
    crown.position.set(x, 0.95 * s, z);
    crown.rotation.set(rand() * 3, rand() * 3, 0);
    g.add(trunk, crown);
  });
  return shadowsOn(g);
}

function markers() {
  const g = new THREE.Group();
  const pins = {};
  Object.entries(SPOTS).forEach(([id, spot]) => {
    const pin = new THREE.Group();
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 16), mat(COLORS.maillot, { roughness: 0.3, metalness: 0.2 }));
    head.position.y = 0.75;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 16), mat(COLORS.marine));
    tip.rotation.x = Math.PI;
    tip.position.y = 0.36;
    pin.add(head, tip);
    pin.position.set(spot.pos[0], spot.pos[1] + 0.6, spot.pos[2]);
    pin.userData.baseY = pin.position.y;
    g.add(shadowsOn(pin));
    pins[id] = pin;
  });
  return { group: g, pins };
}

export function initMap(container, { reduceMotion }) {
  const renderer = makeRenderer(container, { shadows: true });
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(34, 16 / 11, 0.1, 200);
  camera.position.set(20.5, 19, 25.5);

  const hemi = new THREE.HemisphereLight(0xE3F1FF, 0x4B6B3A, 1.3);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xFFF4DE, 2.2);
  sun.position.set(-10, 18, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 14, bottom: -14, near: 1, far: 60 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  // Socle de la maquette : gazon dessus, terre sur les côtés
  const earth = mat(0x8A6A48);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(26, 1.4, 20), [earth, earth, mat(0x6DAA55, { roughness: 1 }), mat(0x5A4330), earth, earth]);
  slab.position.y = -0.7;
  slab.receiveShadow = true;
  scene.add(slab);

  const pitchGroup = pitch();
  const club = clubhouse();
  scene.add(pitchGroup, club, parking(), road(), trees());
  const { group: pinGroup, pins } = markers();
  scene.add(pinGroup);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(1, 0, 0);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = 1.2;
  controls.autoRotate = !reduceMotion;
  controls.autoRotateSpeed = 0.5;
  controls.addEventListener('start', () => { controls.autoRotate = false; });
  renderer.domElement.style.touchAction = 'pan-y';

  fit(container, renderer, camera);

  // Repères HTML, placés au-dessus des épingles 3D
  const buttons = [...container.querySelectorAll('.pin')];
  const info = document.getElementById('map-info');
  const infoTitle = document.getElementById('map-info-title');
  const infoText = document.getElementById('map-info-text');
  const v = new THREE.Vector3();

  const fly = { active: false, t: 0, fromT: new THREE.Vector3(), toT: new THREE.Vector3(), fromC: new THREE.Vector3(), toC: new THREE.Vector3() };
  function focus(id) {
    const spot = SPOTS[id];
    buttons.forEach((b) => b.setAttribute('aria-pressed', b.dataset.spot === id));
    infoTitle.textContent = spot.title;
    infoText.textContent = spot.text;
    info.classList.remove('flash'); void info.offsetWidth; info.classList.add('flash');

    controls.autoRotate = false;
    const target = new THREE.Vector3(spot.pos[0], 0, spot.pos[2]);
    const dir = camera.position.clone().sub(controls.target).normalize();
    fly.fromT.copy(controls.target); fly.toT.copy(target);
    fly.fromC.copy(camera.position); fly.toC.copy(target).addScaledVector(dir, 20);
    fly.t = 0; fly.active = true;
    if (reduceMotion) fly.t = 1;
  }
  buttons.forEach((b) => b.addEventListener('click', () => focus(b.dataset.spot)));

  // Un clic sur une épingle 3D fonctionne aussi
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downAt = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = Object.entries(pins).find(([, pin]) => ray.intersectObject(pin, true).length);
    if (hit) focus(hit[0]);
  });

  loop(container, (dt, t) => {
    if (fly.active) {
      fly.t = Math.min(1, fly.t + dt / 1.1);
      const e = 1 - Math.pow(1 - fly.t, 3);
      controls.target.lerpVectors(fly.fromT, fly.toT, e);
      camera.position.lerpVectors(fly.fromC, fly.toC, e);
      if (fly.t >= 1) fly.active = false;
    }
    controls.update();

    if (!reduceMotion) {
      Object.values(pins).forEach((pin, i) => { pin.position.y = pin.userData.baseY + Math.sin(t * 2 + i) * 0.12; });
      club.userData.flag.rotation.y = Math.sin(t * 2.4) * 0.35;
    }

    const w = container.clientWidth, h = container.clientHeight;
    buttons.forEach((b) => {
      const pin = pins[b.dataset.spot];
      v.set(pin.position.x, pin.position.y + 1.25, pin.position.z).project(camera);
      const hidden = v.z > 1;
      b.classList.toggle('is-hidden', hidden);
      b.style.setProperty('--px', `${((v.x + 1) / 2) * w}px`);
      b.style.setProperty('--py', `${((1 - v.y) / 2) * h}px`);
    });

    renderer.render(scene, camera);
  });
}
