// Écusson 3D : le logo original du club, mis en relief.
// La forme du bouclier suit exactement le contour du logo, et toutes les parties
// jaunes (liseré, textes, fer à cheval, crosse, balle) ressortent en or.
import * as THREE from 'three';
import { makeRenderer, makeEnvironment, fit, loop, dragRotate, easeOutBack, clamp01, crestState, COLORS } from './shared.js';

const LOGO_URL = 'assets/logo-polo.png';
const SIZE = 567;                 // taille de l'image du logo, en pixels
const WORLD = 4.6;                // taille de l'image dans la scène
const S = WORLD / SIZE;
const BALL = { x: 283, y: 390, r: 18.5 }; // balle du logo, en pixels
const DEPTH = 0.32;               // épaisseur du bouclier
const RELIEF = 0.09;              // hauteur des parties jaunes

const toWorld = (px, py) => [(px - SIZE / 2) * S, (SIZE / 2 - py) * S];

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Lit l'image : transparence (forme du bouclier) et parties jaunes (relief)
function analyse(img) {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, SIZE, SIZE);
  const { data } = g.getImageData(0, 0, SIZE, SIZE);

  const alpha = new Float32Array(SIZE * SIZE);
  const gold = document.createElement('canvas');
  gold.width = gold.height = SIZE;
  const gg = gold.getContext('2d');
  const goldData = gg.createImageData(SIZE, SIZE);
  // carte matière : vert = rugosité, bleu = métal (convention three.js)
  const matter = document.createElement('canvas');
  matter.width = matter.height = SIZE;
  const mg = matter.getContext('2d');
  const matterData = mg.createImageData(SIZE, SIZE);

  for (let i = 0; i < SIZE * SIZE; i++) {
    const r = data[i * 4], gr = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3] / 255;
    alpha[i] = a;
    // part de jaune : 0 sur le marine, 1 sur le jaune
    const y = a > 0.5 ? clamp01(((r + gr) / 2 - b - 40) / 130) : 0;
    goldData.data[i * 4] = goldData.data[i * 4 + 1] = goldData.data[i * 4 + 2] = y * 255;
    goldData.data[i * 4 + 3] = 255;
    matterData.data[i * 4] = 0;
    matterData.data[i * 4 + 1] = (0.5 - y * 0.2) * 255;   // rugosité : émail 0.5, or 0.3
    matterData.data[i * 4 + 2] = (0.05 + y * 0.5) * 255;  // métal : émail 0.05, or 0.55
    matterData.data[i * 4 + 3] = 255;
  }
  gg.putImageData(goldData, 0, 0);
  mg.putImageData(matterData, 0, 0);

  // relief adouci : les bords des parties jaunes forment un petit biseau
  const soft = document.createElement('canvas');
  soft.width = soft.height = SIZE;
  const sg = soft.getContext('2d', { willReadFrequently: true });
  sg.filter = 'blur(1.4px)';
  sg.drawImage(gold, 0, 0);
  const height = sg.getImageData(0, 0, SIZE, SIZE).data;

  // contour du bouclier, ligne par ligne
  const left = [], right = [];
  for (let y = 0; y < SIZE; y += 3) {
    let lx = -1, rx = -1;
    for (let x = 0; x < SIZE; x++) if (alpha[y * SIZE + x] > 0.5) { lx = x; break; }
    for (let x = SIZE - 1; x >= 0; x--) if (alpha[y * SIZE + x] > 0.5) { rx = x; break; }
    if (lx >= 0) { left.push([lx + 1.5, y]); right.push([rx - 1.5, y]); }
  }

  return { alpha, height, left, right, matter };
}

function shieldShape({ left, right }) {
  const shape = new THREE.Shape();
  left.forEach(([px, py], i) => {
    const [x, y] = toWorld(px, py);
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  });
  for (let i = right.length - 1; i >= 0; i--) shape.lineTo(...toWorld(right[i][0], right[i][1]));
  shape.closePath();
  return shape;
}

// Face avant : un maillage fin, soulevé là où le logo est jaune
function faceGeometry({ alpha, height }, segments) {
  const geo = new THREE.PlaneGeometry(WORLD, WORLD, segments, segments);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const sample = (u, v) => {
    const x = Math.min(SIZE - 1, Math.max(0, Math.round(u * (SIZE - 1))));
    const y = Math.min(SIZE - 1, Math.max(0, Math.round((1 - v) * (SIZE - 1))));
    return y * SIZE + x;
  };
  for (let i = 0; i < pos.count; i++) {
    const k = sample(uv.getX(i), uv.getY(i));
    pos.setZ(i, (height[k * 4] / 255) * RELIEF);
  }
  // on ne garde que les triangles à l'intérieur du bouclier
  const index = geo.index.array;
  const keep = [];
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t], b = index[t + 1], c = index[t + 2];
    const inside = [a, b, c].some((i) => alpha[sample(uv.getX(i), uv.getY(i))] > 0.05);
    if (inside) keep.push(a, b, c);
  }
  geo.setIndex(keep);
  geo.computeVertexNormals();
  return geo;
}

export async function initCrest(container, { reduceMotion }) {
  const img = await loadImage(LOGO_URL);
  const info = analyse(img);

  const renderer = makeRenderer(container);
  // pas de compression des tons : le jaune et le marine restent ceux du logo
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  scene.environment = makeEnvironment(renderer);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 9.6);

  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 4, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xFFD36B, 1.4);
  rim.position.set(-5, 3, -3);
  scene.add(rim);
  scene.add(new THREE.AmbientLight(0x9CC0E0, 0.12));

  const crest = new THREE.Group();
  scene.add(crest);

  // Corps du bouclier : tranche marine biseautée
  const body = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shieldShape(info), {
      depth: DEPTH, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 4, curveSegments: 4,
    }),
    new THREE.MeshStandardMaterial({ color: COLORS.marine, metalness: 0.3, roughness: 0.45 }),
  );
  body.geometry.translate(0, 0, -DEPTH / 2);
  crest.add(body);

  // Faces avant et arrière : le logo original, en relief
  const logo = new THREE.Texture(img);
  logo.colorSpace = THREE.SRGBColorSpace;
  logo.anisotropy = renderer.capabilities.getMaxAnisotropy();
  logo.needsUpdate = true;
  const matter = new THREE.CanvasTexture(info.matter);
  const faceMat = new THREE.MeshStandardMaterial({
    map: logo,
    alphaTest: 0.5,
    metalnessMap: matter,
    roughnessMap: matter,
    metalness: 1,
    roughness: 1,
    envMapIntensity: 0.5,
  });
  const segments = window.innerWidth < 760 ? 260 : 380;
  const faceGeo = faceGeometry(info, segments);
  const front = new THREE.Mesh(faceGeo, faceMat);
  front.position.z = DEPTH / 2 + 0.061;
  crest.add(front);
  const back = new THREE.Mesh(faceGeo, faceMat);
  back.rotation.y = Math.PI;
  back.position.z = -DEPTH / 2 - 0.061;
  crest.add(back);

  // La balle 3D voyageuse part de la balle du logo : on place son point de départ dessus
  const stop = container.querySelector('.ball-stop-hero');
  const [bx, by] = toWorld(BALL.x, BALL.y);
  const ballPoint = new THREE.Vector3(bx, by, front.position.z + RELIEF);
  const edgePoint = new THREE.Vector3(bx + BALL.r * S, by, front.position.z + RELIEF);
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
  function placeStop() {
    if (!stop) return;
    const w = container.clientWidth, h = container.clientHeight;
    v1.copy(ballPoint).applyMatrix4(crest.matrixWorld).project(camera);
    v2.copy(edgePoint).applyMatrix4(crest.matrixWorld).project(camera);
    const cx = ((v1.x + 1) / 2) * w, cy = ((1 - v1.y) / 2) * h;
    const d = Math.abs(((v2.x + 1) / 2) * w - cx) * 2;
    stop.style.left = `${cx}px`;
    stop.style.top = `${cy}px`;
    stop.style.width = stop.style.height = `${d}px`;
  }

  const drag = dragRotate(renderer.domElement, { maxTilt: 0.6 });
  const hover = { x: 0, y: 0, tx: 0, ty: 0 };
  container.addEventListener('pointermove', (e) => {
    const r = container.getBoundingClientRect();
    hover.tx = ((e.clientX - r.left) / r.width - 0.5) * 0.4;
    hover.ty = ((e.clientY - r.top) / r.height - 0.5) * 0.25;
  });
  container.addEventListener('pointerleave', () => { hover.tx = 0; hover.ty = 0; });

  fit(container, renderer, camera);
  container.classList.add('is-ready');

  // Entrée : l'écusson fait un tour sur lui-même et se pose face à nous
  const intro = reduceMotion ? 10 : 0;

  loop(container, (dt, t) => {
    const k = clamp01((intro + t) / 1.4);
    const spin = (1 - easeOutBack(k)) * Math.PI * 2;
    crest.scale.setScalar(0.75 + 0.25 * Math.min(1, k * 1.6));

    drag.update(dt);
    const damp = 1 - Math.pow(0.02, dt);
    hover.x += (hover.tx - hover.x) * damp;
    hover.y += (hover.ty - hover.y) * damp;
    const idle = reduceMotion ? 0 : Math.sin(t * 0.6) * 0.1;
    crest.rotation.y = drag.yaw + idle + hover.x - spin;
    crest.rotation.x = drag.pitch + hover.y;
    crest.updateMatrixWorld();

    // quand l'écusson est bien tourné, la balle voyageuse s'efface pour laisser voir celle du logo
    const turn = Math.abs(Math.atan2(Math.sin(crest.rotation.y), Math.cos(crest.rotation.y)));
    crestState.tilt = Math.max(turn, Math.abs(crest.rotation.x));
    crestState.ready = k >= 1;
    placeStop();

    renderer.render(scene, camera);
  });
}
