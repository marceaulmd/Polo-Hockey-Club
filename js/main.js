document.documentElement.classList.add('js');

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const desktopMenu = window.matchMedia('(min-width: 1081px)');

// Menu mobile
const toggle = document.querySelector('.nav-toggle');
const nav = document.getElementById('nav');

toggle.addEventListener('click', () => {
  const open = nav.classList.toggle('is-open');
  toggle.setAttribute('aria-expanded', open);
  toggle.textContent = open ? 'Fermer' : 'Menu';
});

// Sous-menus : clic ou clavier partout, survol en plus sur ordinateur
const subs = [...document.querySelectorAll('.has-sub')];

function setSub(li, open) {
  li.classList.toggle('is-open', open);
  li.querySelector('.menu-btn').setAttribute('aria-expanded', open);
}
function closeSubs(except) { subs.forEach((li) => { if (li !== except) setSub(li, false); }); }

subs.forEach((li) => {
  const btn = li.querySelector('.menu-btn');
  btn.addEventListener('click', () => {
    const open = !li.classList.contains('is-open');
    closeSubs(li);
    setSub(li, open);
  });
  let timer;
  li.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'mouse' || !desktopMenu.matches) return;
    clearTimeout(timer); closeSubs(li); setSub(li, true);
  });
  li.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'mouse' || !desktopMenu.matches) return;
    timer = setTimeout(() => setSub(li, false), 180);
  });
  li.addEventListener('focusout', (e) => {
    if (!li.contains(e.relatedTarget)) setSub(li, false);
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const open = subs.find((li) => li.classList.contains('is-open'));
  if (open) { setSub(open, false); open.querySelector('.menu-btn').focus(); }
});
document.addEventListener('click', (e) => { if (!e.target.closest('.has-sub')) closeSubs(); });

// Un lien du menu ferme le menu mobile
nav.addEventListener('click', (e) => {
  if (!e.target.closest('a')) return;
  closeSubs();
  if (nav.classList.contains('is-open')) toggle.click();
});

// Défilement : navigation en verre, barre de progression, parallaxe du hero
const header = document.querySelector('.site-header');
const progress = document.querySelector('.progress');
const hero = document.querySelector('.hero');
const heroPitch = document.querySelector('.hero-pitch');
const heroText = document.querySelector('.hero-text');

let ticking = false;

function onScroll() {
  const y = window.scrollY;
  const max = document.documentElement.scrollHeight - window.innerHeight;

  header.classList.toggle('is-scrolled', y > 24);
  progress.style.setProperty('--p', max > 0 ? Math.min(1, y / max) : 0);

  if (hero && !reduceMotion && y < hero.offsetHeight) {
    heroPitch.style.transform = `translate3d(0, ${y * 0.35}px, 0)`;
    heroText.style.transform = `translate3d(0, ${y * 0.18}px, 0)`;
    heroText.style.opacity = Math.max(0, 1 - y / (hero.offsetHeight * 0.9));
  }
  ticking = false;
}

window.addEventListener('scroll', () => {
  if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
}, { passive: true });
window.addEventListener('resize', onScroll);
onScroll();

// Badges du hero : légère profondeur qui suit la souris
if (hero && !reduceMotion && finePointer) {
  const badges = document.querySelectorAll('.badge');
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    const dx = (e.clientX - r.left) / r.width - 0.5;
    const dy = (e.clientY - r.top) / r.height - 0.5;
    badges.forEach((b) => {
      const depth = Number(b.dataset.depth);
      b.style.setProperty('--mx', `${dx * depth}px`);
      b.style.setProperty('--my', `${dy * depth}px`);
    });
  });
  hero.addEventListener('pointerleave', () => {
    badges.forEach((b) => { b.style.setProperty('--mx', '0px'); b.style.setProperty('--my', '0px'); });
  });
}

// Lignes de terrain en perspective : elles suivent doucement la souris
if (!reduceMotion && finePointer) {
  document.querySelectorAll('.pitch-3d').forEach((layer) => {
    const section = layer.parentElement;
    const svg = layer.querySelector('svg');
    section.addEventListener('pointermove', (e) => {
      const r = section.getBoundingClientRect();
      svg.style.setProperty('--tx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      svg.style.setProperty('--ty', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    });
    section.addEventListener('pointerleave', () => {
      svg.style.setProperty('--tx', 0); svg.style.setProperty('--ty', 0);
    });
  });
}

// Tuiles : elles s'inclinent en 3D vers la souris
if (finePointer && !reduceMotion) {
  document.querySelectorAll('.tile').forEach((tile) => {
    tile.addEventListener('pointermove', (e) => {
      const r = tile.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const strength = tile.classList.contains('tile-main') ? 8 : 14;
      tile.style.setProperty('--ry', `${(px - 0.5) * strength}deg`);
      tile.style.setProperty('--rx', `${(0.5 - py) * strength}deg`);
      tile.style.setProperty('--gx', `${px * 100}%`);
      tile.style.setProperty('--gy', `${py * 100}%`);
    });
    tile.addEventListener('pointerleave', () => {
      tile.style.setProperty('--rx', '0deg');
      tile.style.setProperty('--ry', '0deg');
    });
  });
}

// Apparitions au scroll, en cascade à l'intérieur d'un même groupe
if (!reduceMotion && 'IntersectionObserver' in window) {
  const groups = [
    ['.section h2, .section-lead, .history-title', 'reveal'],
    ['.prose p, .facts > div', 'reveal'],
    ['.timeline li', 'reveal-line'],
    ['.tiles > .tile, .labels > .card, .teams > .card, .steps > .card, .extras > .card, .people > .card', 'reveal'],
    ['.kit-stage, .map-wrap, .docs, .bag, .kit li, .team-links, .contact-form, address', 'reveal'],
    ['.partners li', 'reveal'],
    ['.page-section h2, .page-section > .wrap > .section-lead', 'reveal'],
    ['.blocks > .block, .slots > .slot, .shops > .shop, .quotes > .quote, .gallery > li, .docs-list > li, .dates > li, .table-wrap, .note', 'reveal'],
  ];

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.add('is-in');
      observer.unobserve(el);
      // Une fois apparu, l'élément retrouve ses transitions normales (survol)
      const delay = parseFloat(el.style.getPropertyValue('--d')) || 0;
      setTimeout(() => {
        el.classList.remove('reveal', 'reveal-line', 'is-in');
        el.style.removeProperty('--d');
      }, 1000 + delay * 1000);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

  groups.forEach(([selector, cls]) => {
    document.querySelectorAll(selector).forEach((el) => {
      if (el.closest('.hero') || el.parentElement.closest('.reveal')) return;
      const siblings = [...el.parentElement.children].filter((c) => c.matches(selector));
      const index = siblings.indexOf(el);
      el.classList.add(cls);
      el.style.setProperty('--d', `${Math.min(index, 8) * 0.07}s`);
      observer.observe(el);
    });
  });
}

// Cartes : le reflet suit la souris
if (finePointer) {
  document.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--hx', `${e.clientX - r.left}px`);
      card.style.setProperty('--hy', `${e.clientY - r.top}px`);
    });
  });
}

// Formulaire de contact : ouvre la messagerie avec un message prérempli
const form = document.getElementById('contact-form');
if (form) {
  const error = form.querySelector('.form-error');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const missing = [];

    form.querySelectorAll('[required]').forEach((field) => {
      const invalid = !field.value.trim() || (field.type === 'email' && !field.checkValidity());
      field.setAttribute('aria-invalid', invalid);
      if (invalid) missing.push(field.closest('label').firstChild.textContent.trim());
    });

    if (missing.length) {
      error.textContent = `Complétez ces champs pour envoyer votre message : ${missing.join(', ')}.`;
      error.hidden = false;
      form.querySelector('[aria-invalid="true"]').focus();
      return;
    }
    error.hidden = true;

    const d = Object.fromEntries(new FormData(form));
    const subject = `${d.demande} – ${d.prenom} ${d.nom}`.trim();
    const body = `${d.message}\n\n${d.prenom} ${d.nom}\n${d.email}`;
    window.location.href = `mailto:polohockeyclub@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
}

// Planning : trouver le créneau de son enfant selon son année de naissance
const finder = document.getElementById('finder-year');
if (finder) {
  const out = document.getElementById('finder-result');
  const slots = [...document.querySelectorAll('.slot[data-years]')];
  finder.addEventListener('change', () => {
    const year = finder.value;
    const matches = slots.filter((s) => s.dataset.years.split(' ').includes(year));
    slots.forEach((s) => s.classList.toggle('is-match', matches.includes(s)));
    document.querySelectorAll('.slots').forEach((g) => g.classList.toggle('is-filtered', !!year));
    if (!year) { out.textContent = ''; return; }
    out.textContent = matches.length
      ? `${matches.length} créneau${matches.length > 1 ? 'x' : ''} pour les enfants nés en ${year}.`
      : `Aucun créneau jeunes pour ${year} : voyez avec le club pour les équipes seniors et loisirs.`;
    if (matches[0]) matches[0].scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  });
}

// Stages : les dates déjà passées sont signalées automatiquement
document.querySelectorAll('.dates li[data-end]').forEach((li) => {
  const end = new Date(`${li.dataset.end}T23:59:59`);
  if (end < new Date()) {
    li.classList.add('is-past');
    const tag = li.querySelector('.tag');
    if (tag) tag.textContent = 'Terminé';
  }
});

// Galerie : agrandir une photo
const lightbox = document.getElementById('lightbox');
if (lightbox && typeof lightbox.showModal === 'function') {
  const img = lightbox.querySelector('img');
  const caption = lightbox.querySelector('p');
  document.querySelectorAll('.gallery button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const thumb = btn.querySelector('img');
      img.src = thumb.src;
      img.alt = thumb.alt;
      caption.textContent = thumb.alt;
      lightbox.showModal();
    });
  });
  lightbox.querySelector('.btn').addEventListener('click', () => lightbox.close());
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) lightbox.close(); });
}
