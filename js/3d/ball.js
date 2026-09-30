// Balle 3D qui voyage de section en section au fil du défilement,
// en partant de l'écusson du hero jusqu'au but du pied de page.
import * as THREE from 'three';
import { ballMaterial, softShadowTexture, makeEnvironment, easeInOut, easeOutBack, clamp01 } from './shared.js';

export function initTravelBall(layer) {
  const stops = [...document.querySelectorAll('[data-ball-stop]')];
  if (stops.length < 2) return;
  const goal = document.getElementById('footer-goal');

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  layer.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.environment = makeEnvironment(renderer);
  const camera = new THREE.OrthographicCamera(0, 1, 0, -1, 0.1, 4000);
  camera.position.z = 2000;

  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(-1, 1.2, 1.6);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, 0.45));

  const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), ballMaterial());
  ball.material.envMapIntensity = 0.6;
  scene.add(ball);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: softShadowTexture(), transparent: true, depthWrite: false }),
  );
  shadow.position.z = -800;
  scene.add(shadow);

  // Positions des arrêts dans la page, et défilement auquel la balle y arrive
  let pts = [];
  function measure() {
    const vw = window.innerWidth, vh = window.innerHeight;
    if (camera.right !== vw || camera.bottom !== -vh) {
      renderer.setSize(vw, vh, false);
      camera.right = vw; camera.bottom = -vh;
      camera.updateProjectionMatrix();
    }

    const maxS = Math.max(0, document.documentElement.scrollHeight - vh);
    pts = stops.map((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width) return null;
      return {
        x: r.left + r.width / 2 + window.scrollX,
        y: r.top + r.height / 2 + window.scrollY,
        d: r.width,
      };
    }).filter(Boolean);
    pts.forEach((p) => { p.s = Math.min(maxS, Math.max(0, p.y - vh * 0.5)); });
    for (let i = 1; i < pts.length; i++) pts[i].s = Math.max(pts[i].s, pts[i - 1].s + 80);
    pts[pts.length - 1].s = Math.min(pts[pts.length - 1].s, maxS);
    for (let i = pts.length - 2; i >= 0; i--) pts[i].s = Math.min(pts[i].s, pts[i + 1].s - 80);
    dirty = true;
  }

  // Où est la balle pour un défilement donné ?
  function locate(S) {
    const last = pts.length - 1;
    if (S <= pts[0].s) return { ...pts[0], hop: 0, seg: -1 };
    for (let i = 0; i < last; i++) {
      const a = pts[i], b = pts[i + 1];
      if (S < b.s) {
        const t = (S - a.s) / (b.s - a.s);
        // la balle reste posée un moment sur chaque arrêt, puis rebondit vers le suivant
        const u = easeInOut(clamp01((t - 0.14) / 0.72));
        const hop = u > 0 && u < 1 ? Math.abs(Math.sin(u * Math.PI * 3)) * (1 - u * 0.45) : 0;
        return {
          x: a.x + (b.x - a.x) * u,
          y: a.y + (b.y - a.y) * u,
          d: a.d + (b.d - a.d) * u,
          hop,
          seg: i,
        };
      }
    }
    return { ...pts[last], hop: 0, seg: last };
  }

  const q = new THREE.Quaternion();
  const axis = new THREE.Vector3();
  let prev = null, arrived = false, dirty = true, lastS = -1;
  const start = performance.now();

  let lastMeasure = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    // la mise en page peut bouger (polices, images, apparitions) : on remesure régulièrement
    if (now - lastMeasure > 500) { lastMeasure = now; measure(); }
    const S = window.scrollY;
    const intro = clamp01((now - start) / 1000 - 1.2);
    if (S === lastS && !dirty && intro >= 1) return;
    lastS = S; dirty = false;

    const st = locate(S);

    // roule dans le sens du déplacement
    if (prev) {
      const dx = st.x - prev.x, dy = st.y - prev.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.05) {
        axis.set(dy, dx, 0).normalize();
        q.setFromAxisAngle(axis, dist / (st.d / 2));
        ball.quaternion.premultiply(q);
      }
    }
    prev = st;

    const pop = easeOutBack(intro);
    const r = (st.d / 2) * (1 + st.hop * 0.35) * pop;
    const groundY = st.y - S;
    const sx = st.x - window.scrollX;
    const sy = groundY - st.hop * 28;

    ball.scale.setScalar(Math.max(0.001, r));
    ball.position.set(sx, -sy, 0);

    const sr = (st.d / 2) * pop;
    shadow.position.set(sx + sr * 0.3 + st.hop * 18, -(groundY + sr * 0.45 + st.hop * 10), -800);
    shadow.scale.setScalar(Math.max(0.001, sr * 2.6 * (1 + st.hop * 0.4)));
    shadow.material.opacity = 0.85 - st.hop * 0.5;

    // arrivée dans le but du pied de page
    const inGoal = st.seg === pts.length - 1;
    if (inGoal && !arrived && goal) {
      goal.classList.remove('is-goal');
      void goal.offsetWidth;
      goal.classList.add('is-goal');
    }
    arrived = inGoal;

    renderer.render(scene, camera);
  }

  measure();
  window.addEventListener('resize', measure);
  window.addEventListener('load', measure);
  document.fonts?.ready.then(measure);
  new ResizeObserver(() => measure()).observe(document.body);
  requestAnimationFrame(frame);
}
