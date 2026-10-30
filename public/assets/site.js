const header = document.querySelector('#site-header');
const toggle = document.querySelector('.menu-toggle');
const menu = document.querySelector('#menu-mobilne');

function updateHeader() {
  header.classList.toggle('is-top', document.body.classList.contains('home-page') && window.scrollY < 80);
}
updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

function closeMenu(restoreFocus = false) {
  menu.hidden = true;
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Otwórz menu');
  document.body.classList.remove('menu-open');
  if (restoreFocus) toggle.focus();
}
toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  menu.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Zamknij menu' : 'Otwórz menu');
  document.body.classList.toggle('menu-open', open);
});
menu.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', event => {
  if (menu.hidden) return;
  if (event.key === 'Escape') closeMenu(true);
  if (event.key === 'Tab') {
    const last = menu.querySelector('a:last-child');
    if (event.shiftKey && document.activeElement === toggle) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); toggle.focus(); }
  }
});
window.matchMedia('(min-width: 1024px)').addEventListener('change', event => { if (event.matches) closeMenu(); });

// Keep bookmarks from the previous page working after the section names changed.
const aliases = { '#spotkania': '#oferta', '#pytania': '#faq', '#kaneel': '#poznaj' };
if (aliases[window.location.hash]) {
  const hash = aliases[window.location.hash];
  history.replaceState(null, '', hash);
  document.querySelector(hash)?.scrollIntoView();
}
for (const link of document.querySelectorAll('a[href]')) {
  if (new URL(link.href).pathname === window.location.pathname && !new URL(link.href).hash) {
    link.setAttribute('aria-current', 'page');
  }
}

const contact = document.querySelector('#contact-form');
if (contact) {
  for (const link of document.querySelectorAll('[data-service]')) {
    link.addEventListener('click', () => {
      const checkbox = [...contact.querySelectorAll('[name="services"]')].find(input => input.value === link.dataset.service);
      if (checkbox) checkbox.checked = true;
    });
  }
  const birth = contact.elements.birth;
  const today = new Date();
  birth.max = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  contact.addEventListener('submit', event => {
    event.preventDefault();
    if (!contact.reportValidity()) return;
    const data = new FormData(contact);
    const body = [
      `Imię i nazwisko: ${data.get('name').trim()}`,
      `E-mail: ${data.get('email').trim()}`,
      `Data urodzenia: ${data.get('birth') || '-'}`,
      `Wybrane usługi: ${data.getAll('services').join('; ') || '-'}`,
      '', data.get('msg') || '',
    ].join('\n');
    const url = `mailto:${contact.dataset.email}?subject=${encodeURIComponent('Zamówienie analizy – Kaneel')}&body=${encodeURIComponent(body)}`;
    const fallback = document.querySelector('#contact-fallback');
    fallback.href = url;
    fallback.hidden = false;
    const status = document.querySelector('#contact-status');
    status.textContent = `Wiadomość jest przygotowana do otwarcia w aplikacji pocztowej. Wyślij ją z poczty. Jeśli aplikacja się nie otworzyła, skorzystaj z linku poniżej lub napisz na ${contact.dataset.email}.`;
    status.hidden = false;
    window.location.href = url;
  });
}
