document.documentElement.classList.add('js');

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// Menu mobile
const toggle = document.querySelector('.nav-toggle');
const nav = document.getElementById('nav');

toggle.addEventListener('click', () => {
  const open = nav.classList.toggle('is-open');
  toggle.setAttribute('aria-expanded', open);
  toggle.textContent = open ? 'Fermer' : 'Menu';
});

nav.addEventListener('click', (e) => {
  if (e.target.closest('a') && nav.classList.contains('is-open')) toggle.click();
});

// Défilement : navigation en verre, barre de progression, parallaxe du hero
const header = document.querySelector('.site-header');
const progress = document.querySelector('.progress span');
const hero = document.querySelector('.hero');
const heroPitch = document.querySelector('.hero-pitch');
const heroText = document.querySelector('.hero-text');
const heroArt = document.querySelector('.hero-figure svg');
const heroPhoto = document.querySelector('.hero-photo');

let ticking = false;

function onScroll() {
  const y = window.scrollY;
  const max = document.documentElement.scrollHeight - window.innerHeight;

  header.classList.toggle('is-scrolled', y > 24);
  progress.style.setProperty('--p', max > 0 ? Math.min(1, y / max) : 0);

  if (!reduceMotion && y < hero.offsetHeight) {
    heroPitch.style.transform = `translate3d(0, ${y * 0.35}px, 0)`;
    heroText.style.transform = `translate3d(0, ${y * 0.18}px, 0)`;
    heroText.style.opacity = Math.max(0, 1 - y / (hero.offsetHeight * 0.9));
    heroArt.style.transform = `translate3d(0, ${y * 0.08}px, 0)`;
    heroPhoto.style.transform = `translateY(${Math.min(30, y * 0.06)}px)`;
  }
  ticking = false;
}

window.addEventListener('scroll', () => {
  if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
}, { passive: true });
window.addEventListener('resize', onScroll);
onScroll();

// Badges du hero : légère profondeur qui suit la souris
if (!reduceMotion && finePointer) {
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

// Apparitions au scroll, en cascade à l'intérieur d'un même groupe
if (!reduceMotion && 'IntersectionObserver' in window) {
  const groups = [
    ['.section h2, .section-lead, .history-title', 'reveal'],
    ['.prose p, .facts > div', 'reveal'],
    ['.timeline li', 'reveal-line'],
    ['.labels > .card, .teams > .card, .steps > .card, .extras > .card, .people > .card', 'reveal'],
    ['.docs, .bag, .kit li, .checklist li, .team-links, .map, .contact-form, address', 'reveal'],
    ['.partners li', 'reveal'],
  ];

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.add('is-in');
      observer.unobserve(el);
      // Une fois apparu, l'élément retrouve ses transitions normales (survol des cartes)
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
      el.style.setProperty('--d', `${Math.min(index, 8) * 0.08}s`);
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

// Balle qui suit le curseur
if (!reduceMotion && finePointer) {
  const ball = document.querySelector('.cursor-ball');
  let x = -100, y = -100, bx = -100, by = -100;

  window.addEventListener('pointermove', (e) => {
    x = e.clientX; y = e.clientY;
    ball.classList.add('is-visible');
    ball.classList.toggle('is-hover', !!e.target.closest('a, button, input, select, textarea, label, .card'));
  }, { passive: true });
  document.addEventListener('pointerleave', () => ball.classList.remove('is-visible'));
  window.addEventListener('pointerdown', () => ball.classList.add('is-down'));
  window.addEventListener('pointerup', () => ball.classList.remove('is-down'));

  (function follow() {
    bx += (x - bx) * 0.2;
    by += (y - by) * 0.2;
    ball.style.transform = `translate3d(${bx}px, ${by}px, 0)`;
    requestAnimationFrame(follow);
  })();
}

// Formulaire de contact : ouvre la messagerie avec un message prérempli
const form = document.getElementById('contact-form');
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
