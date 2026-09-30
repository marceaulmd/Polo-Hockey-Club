// Point d'entrée de la 3D : chaque scène est chargée séparément,
// et la page reste complète si la 3D n'est pas disponible.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

// En cas d'échec, on masque le cadre 3D vide
function guard(promise, ...hide) {
  return promise.catch((err) => {
    hide.forEach((el) => el && el.classList.add('is-failed'));
    console.warn('3D :', err);
  });
}

function start() {
  if (!hasWebGL()) return;
  document.documentElement.classList.add('has-3d');
  const opts = { reduceMotion };

  const crest = document.getElementById('crest');
  if (crest) guard(import('./crest.js').then((m) => m.initCrest(crest, opts)), document.querySelector('.crest-hint'));

  const kit = document.getElementById('kit3d');
  if (kit) {
    guard(
      import('./kit.js').then((m) => m.initKit(
        kit,
        [...document.querySelectorAll('[data-kit]')],
        document.getElementById('kit-caption'),
        opts,
      )),
      kit, document.querySelector('.kit-toggle'),
    );
  }

  const map = document.getElementById('map3d');
  if (map) {
    // les panneaux de la maquette utilisent la police du site
    guard(document.fonts.ready.then(() => import('./map.js')).then((m) => m.initMap(map, opts)), map);
  }

  // La balle voyageuse bouge beaucoup : pas pour ceux qui réduisent les animations
  const layer = document.getElementById('ball-layer');
  if (layer && !reduceMotion) guard(import('./ball.js').then((m) => m.initTravelBall(layer)), layer);
}

start();
