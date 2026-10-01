// Balle 3D qui voyage de section en section au fil du défilement,
// en partant de la balle du logo jusqu'au but du pied de page.
import * as THREE from 'three';
import { ballMaterial, softShadowTexture, makeEnvironment, easeInOut, easeOutBack, clamp01, crestState } from './shared.js';

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
  ball.material.transparent = true;
  scene.add(ball);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: softShadowTexture(), transparent: true, depthWrite: false }),
  );
  shadow.position.z = -800;
  scene.add(shadow);

  // Positions des arrêts dans la page, et défilement auquel la balle y arrive
  let pts = [];
  const rectOf = (el) => {
    const r = el.getBoundingClientRect();
    if (!r.width) return null;
    return { x: r.left + r.width / 2 + window.scrollX, y: r.top + r.height / 2 + window.scrollY, d: r.width };
  };
  function measure() {
    const vw = window.innerWidth, vh = window.innerHeight;
    if (camera.right !== vw || camera.bottom !== -vh) {
      renderer.setSize(vw, vh, false);
      camera.right = vw; camera.bottom = -vh;
      camera.updateProjectionMatrix();
    }
    const maxS = Math.max(0, document.documentElement.scrollHeight - vh);
    pts = stops.map((el) => { const p = rectOf(el); if (p) p.el = el; return p; }).filter(Boolean);
    pts.forEach((p) => { p.s = Math.min(maxS, Math.max(0, p.y - vh * 0.5)); });
    for (let i = 1; i < pts.length; i++) pts[i].s = Math.max(pts[i].s, pts[i - 1].s + 80);
    pts[pts.length - 1].s = Math.min(pts[pts.length - 1].s, maxS);
    for (let i = pts.length - 2; i >= 0; i--) pts[i].s = Math.min(pts[i].s, pts[i + 1].s - 80);
  }

  // Où est la balle (dans la page) pour un défilement donné ?
  function locate(S) {
    const last = pts.length - 1;
    if (S <= pts[0].s) return { x: pts[0].x, y: pts[0].y, d: pts[0].d, hop: 0, seg: -1 };
    for (let i = 0; i < last; i++) {
      const a = pts[i], b = pts[i + 1];
      if (S < b.s) {
        const t = (S - a.s) / (b.s - a.s);
        // la balle reste posée un moment sur chaque arrêt, puis rebondit vers le suivant
        const u = easeInOut(clamp01((t - 0.12) / 0.76));
        const hop = Math.sin(u * Math.PI * 2) ** 2 * (1 - u * 0.35);
        return {
          x: a.x + (b.x - a.x) * u,
          y: a.y + (b.y - a.y) * u,
          d: a.d + (b.d - a.d) * u,
          hop,
          seg: i,
        };
      }
    }
    return { x: pts[last].x, y: pts[last].y, d: pts[last].d, hop: 0, seg: last };
  }

  const q = new THREE.Quaternion();
  const axis = new THREE.Vector3();
  let prev = null, arrived = false;
  let smooth = window.scrollY;    // défilement lissé que suit la balle
  let lastMeasure = 0, lastTime = performance.now(), introStart = null;
  let lastDrawn = '';
  const bootTime = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    // la mise en page peut bouger (polices, images, apparitions) : on remesure régulièrement
    if (now - lastMeasure > 500) { lastMeasure = now; measure(); }

    const S = window.scrollY;
    const vh = window.innerHeight;
    // un saut de défilement très long (touche Fin, lien du menu) n'oblige pas la balle à tout parcourir
    if (Math.abs(S - smooth) > vh * 1.5) smooth = S - Math.sign(S - smooth) * vh * 1.5;
    // amortissement souple : la balle glisse au lieu de sauter d'un cran de molette à l'autre
    smooth += (S - smooth) * (1 - Math.exp(-dt * 6));
    if (Math.abs(S - smooth) < 0.3) smooth = S;

    // tant qu'elle est sur l'écusson, la balle suit exactement la balle du logo
    if (pts.length > 1 && smooth < pts[1].s) {
      const p0 = rectOf(pts[0].el);
      if (p0) Object.assign(pts[0], p0);
    }
    // la balle apparaît une fois l'écusson posé (ou après 3 s si l'écusson n'a pas pu se charger)
    if ((crestState.ready || now - bootTime > 3000) && introStart === null) introStart = now;
    const intro = introStart === null ? 0 : clamp01((now - introStart) / 500);

    const st = locate(smooth);

    // près de l'écusson, la balle s'efface quand on fait tourner celui-ci
    const nearCrest = clamp01(1 - Math.hypot(st.x - pts[0].x, st.y - pts[0].y) / 120);
    const fade = 1 - nearCrest * clamp01((crestState.tilt - 0.12) / 0.2);

    const key = `${Math.round(st.x * 2)}|${Math.round((st.y - S) * 2)}|${Math.round(st.d)}|${st.hop.toFixed(3)}|${fade.toFixed(2)}|${intro}`;
    if (key === lastDrawn) return;
    lastDrawn = key;

    // roule dans le sens du déplacement
    if (prev) {
      const dx = st.x - prev.x, dy = st.y - prev.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.05) {
        axis.set(dy, dx, 0).normalize();
        q.setFromAxisAngle(axis, dist / Math.max(4, st.d / 2));
        ball.quaternion.premultiply(q);
      }
    }
    prev = st;

    const pop = introStart === null ? 0 : easeOutBack(intro);
    const r = (st.d / 2) * (1 + st.hop * 0.3) * pop;
    const groundY = st.y - S;
    const sx = st.x - window.scrollX;
    const sy = groundY - st.hop * 24;

    ball.scale.setScalar(Math.max(0.001, r));
    ball.position.set(sx, -sy, 0);
    ball.material.opacity = fade;

    const sr = (st.d / 2) * pop;
    shadow.position.set(sx + sr * 0.3 + st.hop * 16, -(groundY + sr * 0.45 + st.hop * 8), -800);
    shadow.scale.setScalar(Math.max(0.001, sr * 2.6 * (1 + st.hop * 0.35)));
    shadow.material.opacity = (0.85 - st.hop * 0.45) * fade;

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
