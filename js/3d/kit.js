// Tenue de match officielle en 3D, à partir des visuels du club :
// chaque vêtement est découpé selon le contour de sa photo, puis légèrement
// gonflé comme un tissu. Un interrupteur passe de la tenue homme à la tenue femme.
import * as THREE from 'three';
import { makeRenderer, makeEnvironment, fit, loop, dragRotate, easeOutBack, easeInOut, clamp01 } from './shared.js';

const KITS = {
  homme: {
    top: 'assets/maillots/maillot-homme.jpg',
    bottom: 'assets/maillots/short-homme.jpg',
    caption: 'Tenue de match homme : maillot jaune à bande marine, col officier boutonné, et short marine.',
  },
  femme: {
    top: 'assets/maillots/maillot-femme.jpg',
    bottom: 'assets/maillots/jupe-femme.png',
    caption: 'Tenue de match femme : maillot jaune à bande marine, col en V, et jupe marine.',
  },
};

const A = 384;            // résolution d'analyse des photos
const INFLATE = 0.2;      // épaisseur du « gonflement » de chaque face
const TOP_WIDTH = 2.7;    // largeur du maillot dans la scène (manches comprises)
const BOTTOM_WIDTH = 1.75;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Image introuvable : ${src}`));
    img.src = src;
  });
}

// Flou rapide (boîte, trois passes) sur un tableau de valeurs
function blur(src, size, radius) {
  let a = Float32Array.from(src), b = new Float32Array(src.length);
  const pass = (from, to, horizontal) => {
    const win = radius * 2 + 1;
    for (let line = 0; line < size; line++) {
      let sum = 0;
      const at = (i) => (horizontal ? line * size + i : i * size + line);
      for (let i = -radius; i <= radius; i++) sum += from[at(Math.min(size - 1, Math.max(0, i)))];
      for (let i = 0; i < size; i++) {
        to[at(i)] = sum / win;
        sum += from[at(Math.min(size - 1, i + radius + 1))] - from[at(Math.max(0, i - radius))];
      }
    }
  };
  for (let k = 0; k < 3; k++) { pass(a, b, true); pass(b, a, false); }
  return a;
}

// Analyse d'une photo : où est le vêtement (fond blanc retiré), et son relief
function analyse(img) {
  const c = document.createElement('canvas');
  c.width = c.height = A;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff';
  g.fillRect(0, 0, A, A);
  g.drawImage(img, 0, 0, A, A);
  const { data } = g.getImageData(0, 0, A, A);

  // le fond : pixels presque blancs reliés au bord de l'image
  const nearWhite = (i) => data[i * 4] > 232 && data[i * 4 + 1] > 232 && data[i * 4 + 2] > 232;
  const bg = new Uint8Array(A * A);
  const stack = [];
  for (let i = 0; i < A; i++) stack.push(i, (A - 1) * A + i, i * A, i * A + A - 1);
  while (stack.length) {
    const p = stack.pop();
    if (bg[p] || !nearWhite(p)) continue;
    bg[p] = 1;
    const x = p % A, y = (p / A) | 0;
    if (x > 0) stack.push(p - 1);
    if (x < A - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - A);
    if (y < A - 1) stack.push(p + A);
  }

  const mask = new Float32Array(A * A);
  let minX = A, maxX = 0, minY = A, maxY = 0, r = 0, gr = 0, b = 0, n = 0;
  for (let p = 0; p < A * A; p++) {
    if (bg[p]) continue;
    mask[p] = 1;
    const x = p % A, y = (p / A) | 0;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    r += data[p * 4]; gr += data[p * 4 + 1]; b += data[p * 4 + 2]; n++;
  }

  // relief : un dôme doux qui retombe à zéro sur le contour
  const dome = blur(mask, A, Math.round(A * 0.035));
  const height = new Float32Array(A * A);
  for (let p = 0; p < A * A; p++) height[p] = mask[p] ? Math.sqrt(clamp01((dome[p] - 0.5) * 2)) : 0;

  // contour adouci pour la transparence
  const soft = blur(mask, A, 1);
  const alpha = document.createElement('canvas');
  alpha.width = alpha.height = A;
  const ag = alpha.getContext('2d');
  const ad = ag.createImageData(A, A);
  for (let p = 0; p < A * A; p++) {
    const v = Math.round(soft[p] * 255);
    ad.data[p * 4] = ad.data[p * 4 + 1] = ad.data[p * 4 + 2] = v;
    ad.data[p * 4 + 3] = 255;
  }
  ag.putImageData(ad, 0, 0);

  return {
    mask: soft,
    height,
    alpha,
    box: { minX, maxX, minY, maxY },
    color: new THREE.Color(`rgb(${Math.round(r / n)}, ${Math.round(gr / n)}, ${Math.round(b / n)})`),
  };
}

// Maillage d'une face : grille fine soulevée selon le relief, limitée au vêtement
function faceGeometry(info, size, segments, sign) {
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  const idx = (u, v) => {
    const x = Math.min(A - 1, Math.max(0, Math.round(u * (A - 1))));
    const y = Math.min(A - 1, Math.max(0, Math.round((1 - v) * (A - 1))));
    return y * A + x;
  };
  for (let i = 0; i < pos.count; i++) pos.setZ(i, sign * info.height[idx(uv.getX(i), uv.getY(i))] * INFLATE * size / 3);
  const index = geo.index.array, keep = [];
  for (let t = 0; t < index.length; t += 3) {
    const tri = [index[t], index[t + 1], index[t + 2]];
    if (tri.some((i) => info.mask[idx(uv.getX(i), uv.getY(i))] > 0.3)) {
      if (sign > 0) keep.push(...tri); else keep.push(tri[0], tri[2], tri[1]);
    }
  }
  geo.setIndex(keep);
  geo.computeVertexNormals();
  return geo;
}

async function garment(src, targetWidth, renderer) {
  const img = await loadImage(src);
  const info = analyse(img);
  const { minX, maxX, minY, maxY } = info.box;
  const size = targetWidth * A / (maxX - minX + 1);   // taille de toute l'image dans la scène
  const segments = window.innerWidth < 760 ? 150 : 220;

  const photo = new THREE.Texture(img);
  photo.colorSpace = THREE.SRGBColorSpace;
  photo.anisotropy = renderer.capabilities.getMaxAnisotropy();
  photo.needsUpdate = true;
  const alphaMap = new THREE.CanvasTexture(info.alpha);

  const front = new THREE.Mesh(
    faceGeometry(info, size, segments, 1),
    new THREE.MeshStandardMaterial({ map: photo, alphaMap, alphaTest: 0.5, roughness: 0.85, metalness: 0, envMapIntensity: 0.25 }),
  );
  const back = new THREE.Mesh(
    faceGeometry(info, size, segments, -1),
    new THREE.MeshStandardMaterial({ color: info.color, alphaMap, alphaTest: 0.5, roughness: 0.85, metalness: 0, envMapIntensity: 0.25 }),
  );

  // on recentre le vêtement : son centre visible au point (0, 0)
  const group = new THREE.Group();
  const inner = new THREE.Group();
  inner.add(front, back);
  const cx = ((minX + maxX) / 2 / A - 0.5) * size;
  const cy = (0.5 - (minY + maxY) / 2 / A) * size;
  inner.position.set(-cx, -cy, 0);
  group.add(inner);
  group.userData.height = ((maxY - minY + 1) / A) * size;
  return group;
}

async function buildKit(kit, renderer) {
  const [top, bottom] = await Promise.all([
    garment(kit.top, TOP_WIDTH, renderer),
    garment(kit.bottom, BOTTOM_WIDTH, renderer),
  ]);
  const hTop = top.userData.height, hBottom = bottom.userData.height;
  const overlap = 0.3;                       // le bas du maillot recouvre la taille
  const total = hTop + hBottom - overlap;
  top.position.y = total / 2 - hTop / 2;
  bottom.position.y = -total / 2 + hBottom / 2;
  bottom.position.z = -0.18;                 // le short ou la jupe passe derrière le maillot
  const group = new THREE.Group();
  group.add(top, bottom);
  group.userData = { top, bottom };
  return group;
}

export async function initKit(container, toggleButtons, caption, { reduceMotion }) {
  const renderer = makeRenderer(container);
  // pas de compression des tons : les couleurs des photos restent fidèles
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  scene.environment = makeEnvironment(renderer);

  const camera = new THREE.PerspectiveCamera(30, 0.8, 0.1, 100);
  camera.position.set(0, 0, 10.8);

  scene.add(new THREE.AmbientLight(0xffffff, 0.95));
  const key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(3, 4, 7);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xDCE8F5, 0.35);
  fill.position.set(-4, -1, 3);
  scene.add(fill);

  const stage = new THREE.Group();
  scene.add(stage);

  const cache = {};
  const get = (name) => (cache[name] ||= buildKit(KITS[name], renderer));
  let current = await get('homme');
  stage.add(current);
  get('femme'); // préchargé pour un changement instantané

  const drag = dragRotate(renderer.domElement, { maxTilt: 0.35 });
  fit(container, renderer, camera);

  // Changement de tenue : la tenue pivote sur la tranche, puis la nouvelle arrive
  const swap = { t: 1, from: null, to: null };
  toggleButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.kit;
      toggleButtons.forEach((b) => b.setAttribute('aria-pressed', b === btn));
      if (caption) caption.textContent = KITS[name].caption;
      const next = await get(name);
      if (next === current) return;
      if (reduceMotion) {
        stage.remove(current);
        next.rotation.y = 0; next.scale.setScalar(1);
        stage.add(next); current = next;
        return;
      }
      swap.from = current; swap.to = next; swap.t = 0;
      current = next;
    });
  });

  loop(container, (dt, t) => {
    drag.update(dt);

    if (swap.t < 1) {
      swap.t = Math.min(1, swap.t + dt / 0.7);
      if (swap.t < 0.5) {
        const k = easeInOut(swap.t * 2);
        swap.from.rotation.y = k * Math.PI / 2;
        swap.from.scale.setScalar(1 - k * 0.15);
        if (!swap.from.parent) stage.add(swap.from);
      } else {
        if (swap.from.parent) stage.remove(swap.from);
        if (!swap.to.parent) stage.add(swap.to);
        const k = easeOutBack((swap.t - 0.5) * 2);
        swap.to.rotation.y = (1 - k) * -Math.PI / 2;
        swap.to.scale.setScalar(0.85 + 0.15 * Math.min(1, k));
      }
    }

    const idle = reduceMotion ? 0 : Math.sin(t * 0.7) * 0.32;
    stage.rotation.y = drag.yaw + idle;
    stage.rotation.x = drag.pitch;
    if (!reduceMotion && current.userData.top) {
      current.userData.top.position.z = Math.sin(t * 1.4) * 0.04;
    }
    renderer.render(scene, camera);
  });
}
