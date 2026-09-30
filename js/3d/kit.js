// Tenue du Polo en 3D, façon jouet : maillot, short, chaussettes et chaussures
import * as THREE from 'three';
import { makeRenderer, makeEnvironment, fit, loop, dragRotate, COLORS } from './shared.js';

const puffy = { depth: 0.42, bevelEnabled: true, bevelThickness: 0.16, bevelSize: 0.12, bevelSegments: 8, curveSegments: 32 };

function jersey() {
  const s = new THREE.Shape();
  s.moveTo(-0.34, 1.12);
  s.quadraticCurveTo(-0.6, 1.1, -0.82, 1.04);
  s.lineTo(-1.58, 0.56);
  s.quadraticCurveTo(-1.5, 0.3, -1.3, 0.12);
  s.lineTo(-0.96, 0.36);
  s.lineTo(-0.98, -1.1);
  s.quadraticCurveTo(0, -1.2, 0.98, -1.1);
  s.lineTo(0.96, 0.36);
  s.lineTo(1.3, 0.12);
  s.quadraticCurveTo(1.5, 0.3, 1.58, 0.56);
  s.lineTo(0.82, 1.04);
  s.quadraticCurveTo(0.6, 1.1, 0.34, 1.12);
  s.quadraticCurveTo(0, 0.72, -0.34, 1.12);
  const geo = new THREE.ExtrudeGeometry(s, puffy);
  geo.translate(0, 0, -puffy.depth / 2);
  return geo;
}

function shorts() {
  const s = new THREE.Shape();
  s.moveTo(-0.92, 0.3);
  s.lineTo(0.92, 0.3);
  s.lineTo(1.08, -0.62);
  s.quadraticCurveTo(0.6, -0.72, 0.12, -0.64);
  s.lineTo(0, -0.28);
  s.lineTo(-0.12, -0.64);
  s.quadraticCurveTo(-0.6, -0.72, -1.08, -0.62);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, puffy);
  geo.translate(0, 0, -puffy.depth / 2);
  return geo;
}

function shield() {
  const s = new THREE.Shape();
  s.moveTo(-0.17, 0.2);
  s.lineTo(0.17, 0.2);
  s.lineTo(0.17, 0);
  s.quadraticCurveTo(0.15, -0.16, 0, -0.24);
  s.quadraticCurveTo(-0.15, -0.16, -0.17, 0);
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 });
}

export function initKit(container, toggleButtons, caption, { reduceMotion }) {
  const renderer = makeRenderer(container);
  // pas de compression des tons : les couleurs du club restent franches
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  scene.environment = makeEnvironment(renderer);

  const camera = new THREE.PerspectiveCamera(30, 0.8, 0.1, 100);
  camera.position.set(0, 0.3, 13);

  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(4, 6, 8);
  scene.add(key);
  scene.add(new THREE.AmbientLight(0xffffff, 0.2));

  const fabric = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, envMapIntensity: 0.45 });
  const yellow = fabric(COLORS.maillot);
  const navy = fabric(COLORS.marine);
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const front = puffy.depth / 2 + puffy.bevelThickness;

  const kit = new THREE.Group();
  scene.add(kit);

  // Maillot
  const top = new THREE.Group();
  top.add(new THREE.Mesh(jersey(), yellow));
  const collar = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.36, 1.1, front), new THREE.Vector3(0, 0.66, front + 0.02), new THREE.Vector3(0.36, 1.1, front),
    ), 32, 0.055, 12, false),
    navy,
  );
  top.add(collar);
  [[-1.56, 0.56, -1.3, 0.12], [1.56, 0.56, 1.3, 0.12]].forEach(([x1, y1, x2, y2]) => {
    const cuff = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(x1, y1, front - 0.03), new THREE.Vector3(x2, y2, front - 0.03)), 8, 0.06, 10, false),
      navy,
    );
    top.add(cuff);
  });
  const badge = new THREE.Mesh(shield(), navy);
  badge.position.set(0.5, 0.52, front - 0.02);
  top.add(badge);
  const mini = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 8, 24, Math.PI * 1.3), yellow);
  mini.rotation.z = -Math.PI * 0.15; // ouverture vers le bas, comme sur le logo
  mini.position.set(0.5, 0.5, front + 0.07);
  top.add(mini);
  top.position.y = 1.85;
  kit.add(top);

  // Short
  const bottom = new THREE.Group();
  bottom.add(new THREE.Mesh(shorts(), navy));
  const band = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(-0.9, 0.24, front), new THREE.Vector3(0.9, 0.24, front)), 8, 0.045, 10, false),
    yellow,
  );
  bottom.add(band);
  bottom.position.y = 0.3;
  kit.add(bottom);

  // Chaussettes et chaussures
  const sockMat = fabric(COLORS.maillot);
  const sockBandMat = fabric(COLORS.marine);
  const feet = new THREE.Group();
  [-0.48, 0.48].forEach((x) => {
    const sock = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 1.0, 8, 24), sockMat);
    sock.position.set(x, -1.25, 0);
    feet.add(sock);
    const sBand = new THREE.Mesh(new THREE.CylinderGeometry(0.255, 0.255, 0.14, 24), sockBandMat);
    sBand.position.set(x, -0.84, 0);
    feet.add(sBand);
    const shoe = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.34, 8, 20), white);
    shoe.rotation.x = Math.PI / 2;
    shoe.position.set(x, -2.02, 0.16);
    shoe.scale.set(1.15, 1, 0.85);
    feet.add(shoe);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.76), navy);
    sole.position.set(x, -2.2, 0.16);
    feet.add(sole);
  });
  kit.add(feet);

  const drag = dragRotate(renderer.domElement, { maxTilt: 0.35 });
  fit(container, renderer, camera);

  // Match ou entraînement : les chaussettes changent de couleur
  const target = { sock: new THREE.Color(COLORS.maillot), band: new THREE.Color(COLORS.marine) };
  const captions = {
    match: 'Tenue de match : maillot jaune, short marine et chaussettes jaunes.',
    training: 'À l\'entraînement, on garde le short marine et on passe aux chaussettes marine.',
  };
  toggleButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.kit;
      toggleButtons.forEach((b) => b.setAttribute('aria-pressed', b === btn));
      target.sock.set(mode === 'match' ? COLORS.maillot : COLORS.marine);
      target.band.set(mode === 'match' ? COLORS.marine : COLORS.maillot);
      if (caption) caption.textContent = captions[mode];
      drag.vYaw += 0.25; // petit tour sur lui-même pour montrer le changement
    });
  });

  loop(container, (dt, t) => {
    drag.update(dt);
    const idle = reduceMotion ? 0 : Math.sin(t * 0.7) * 0.45;
    kit.rotation.y = drag.yaw + idle;
    kit.rotation.x = drag.pitch;
    if (!reduceMotion) {
      top.position.y = 1.85 + Math.sin(t * 1.6) * 0.05;
      bottom.position.y = 0.3 + Math.sin(t * 1.6 + 0.8) * 0.05;
      feet.position.y = Math.sin(t * 1.6 + 1.6) * 0.05;
    }
    const k = 1 - Math.pow(0.001, dt);
    sockMat.color.lerp(target.sock, k);
    sockBandMat.color.lerp(target.band, k);
    renderer.render(scene, camera);
  });
}
