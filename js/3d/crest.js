// Écusson 3D : le fer à cheval doré et la crosse, comme sur le logo du club
import * as THREE from 'three';
import { makeRenderer, makeEnvironment, fit, loop, dragRotate, easeOutBack, easeOutCubic, clamp01, COLORS } from './shared.js';

function horseshoeGeometry() {
  const Ro = 1.55, Ri = 0.98, cy = 0.35, foot = -1.55;
  const shape = new THREE.Shape();
  shape.moveTo(-Ro - 0.14, foot);
  shape.lineTo(-Ro, cy);
  shape.absarc(0, cy, Ro, Math.PI, 0, true);
  shape.lineTo(Ro + 0.14, foot);
  shape.lineTo(Ri - 0.06, foot);
  shape.lineTo(Ri, cy);
  shape.absarc(0, cy, Ri, 0, Math.PI, false);
  shape.lineTo(-Ri + 0.06, foot);
  shape.closePath();

  // Trous des clous, alignés le long du fer
  const Rm = (Ro + Ri) / 2;
  const hole = (x, y, rot) => {
    const w = 0.065, h = 0.15;
    const c = Math.cos(rot), s = Math.sin(rot);
    const pts = [[-w, -h], [w, -h], [w, h], [-w, h]]
      .map(([px, py]) => new THREE.Vector2(x + px * c - py * s, y + px * s + py * c));
    shape.holes.push(new THREE.Path(pts));
  };
  [30, 62, 118, 150].forEach((deg) => {
    const a = THREE.MathUtils.degToRad(deg);
    hole(Math.cos(a) * Rm, cy + Math.sin(a) * Rm, a);
  });
  [-0.3, -1.05].forEach((y) => { hole(-Rm, y, 0); hole(Rm, y, 0); });

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.42, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.08,
    bevelSegments: 6, curveSegments: 64,
  });
  geo.translate(0, 0, -0.21);
  return geo;
}

function stickGroup() {
  const group = new THREE.Group();
  const z = 0.62;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(2.05, 2.15, z),
    new THREE.Vector3(0.9, 1.0, z),
    new THREE.Vector3(-0.6, -0.5, z),
    new THREE.Vector3(-1.3, -1.2, z),
    new THREE.Vector3(-1.55, -1.5, z),
    new THREE.Vector3(-1.9, -1.62, z),
    new THREE.Vector3(-2.15, -1.45, z),
    new THREE.Vector3(-2.12, -1.22, z),
  ], false, 'centripetal');
  const shaft = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 260, 0.09, 20, false),
    new THREE.MeshStandardMaterial({ color: COLORS.craie, roughness: 0.3, metalness: 0.1 }),
  );
  group.add(shaft);

  // Grip marine et ruban jaune en haut du manche
  const grip = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(2.05, 2.15, z), new THREE.Vector3(1.25, 1.33, z)), 20, 0.108, 20, false),
    new THREE.MeshStandardMaterial({ color: COLORS.marine, roughness: 0.7 }),
  );
  group.add(grip);
  [0.25, 0.55].forEach((t) => {
    const p = new THREE.Vector3(2.05, 2.15, z).lerp(new THREE.Vector3(1.25, 1.33, z), t);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.11, 0.025, 10, 32),
      new THREE.MeshStandardMaterial({ color: COLORS.maillot, roughness: 0.4 }),
    );
    ring.position.copy(p);
    ring.lookAt(p.clone().add(new THREE.Vector3(-1, -1, 0)));
    group.add(ring);
  });
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.108, 20, 12), grip.material);
  cap.position.set(2.05, 2.15, z);
  group.add(cap);
  const toe = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 12), shaft.material);
  toe.position.set(-2.12, -1.22, z);
  group.add(toe);
  return group;
}

export function initCrest(container, { reduceMotion }) {
  const renderer = makeRenderer(container);
  const scene = new THREE.Scene();
  scene.environment = makeEnvironment(renderer);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 10.5);

  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(3, 5, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xFFD36B, 2.2);
  rim.position.set(-5, 3, -4);
  scene.add(rim);
  scene.add(new THREE.AmbientLight(0x9CC0E0, 0.35));

  const crest = new THREE.Group();
  crest.position.y = 0.05;
  scene.add(crest);

  const shoe = new THREE.Mesh(
    horseshoeGeometry(),
    new THREE.MeshStandardMaterial({ color: COLORS.maillot, metalness: 0.78, roughness: 0.26 }),
  );
  crest.add(shoe);

  const stick = stickGroup();
  crest.add(stick);

  const drag = dragRotate(renderer.domElement, { maxTilt: 0.6 });

  // Survol : l'écusson se penche légèrement vers la souris
  const hover = { x: 0, y: 0, tx: 0, ty: 0 };
  container.addEventListener('pointermove', (e) => {
    const r = container.getBoundingClientRect();
    hover.tx = ((e.clientX - r.left) / r.width - 0.5) * 0.5;
    hover.ty = ((e.clientY - r.top) / r.height - 0.5) * 0.35;
  });
  container.addEventListener('pointerleave', () => { hover.tx = 0; hover.ty = 0; });

  fit(container, renderer, camera);
  container.classList.add('is-ready');

  // Assemblage au chargement : le fer tombe, la crosse arrive en glissant
  const intro = reduceMotion ? 10 : 0;

  loop(container, (dt, t) => {
    const k = intro + t;
    const a = easeOutBack(clamp01(k / 1.1));
    const b = easeOutCubic(clamp01((k - 0.5) / 0.9));
    shoe.position.y = (1 - a) * 4;
    shoe.rotation.z = (1 - a) * -0.6;
    shoe.scale.setScalar(0.6 + 0.4 * clamp01(k / 0.6));
    stick.position.set((1 - b) * 5, (1 - b) * 4, 0);
    stick.rotation.z = (1 - b) * 0.5;

    drag.update(dt);
    hover.x += (hover.tx - hover.x) * (1 - Math.pow(0.02, dt));
    hover.y += (hover.ty - hover.y) * (1 - Math.pow(0.02, dt));
    const idle = reduceMotion ? 0 : Math.sin(t * 0.6) * 0.22;
    crest.rotation.y = drag.yaw + idle + hover.x;
    crest.rotation.x = drag.pitch + hover.y;
    crest.position.y = 0.05 + (reduceMotion ? 0 : Math.sin(t * 1.3) * 0.06);

    renderer.render(scene, camera);
  });
}
