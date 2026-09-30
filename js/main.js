document.documentElement.classList.add('js');

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
