const english = document.documentElement.lang === 'en';
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
  toggle.setAttribute('aria-label', toggle.dataset.labelOpen);
  document.body.classList.remove('menu-open');
  if (restoreFocus) toggle.focus();
}
toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  menu.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? toggle.dataset.labelClose : toggle.dataset.labelOpen);
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

const certificateDialog = document.querySelector('.certificate-dialog');
if (certificateDialog?.showModal) {
  const preview = certificateDialog.querySelector('img');
  for (const link of document.querySelectorAll('[data-certificate]')) {
    link.addEventListener('click', event => {
      event.preventDefault();
      const image = link.querySelector('img');
      preview.src = link.href;
      preview.alt = image.alt;
      certificateDialog.showModal();
    });
  }
  certificateDialog.addEventListener('click', event => { if (event.target === certificateDialog) certificateDialog.close(); });
}

const messages = english ? {
  sending: 'Sending…', sendingStatus: 'Sending your message…',
  failed: 'We could not confirm that your message was sent. Your details are still in the form.',
  sent: 'Your message has been accepted for delivery. Thank you for getting in touch.',
  network: 'We could not confirm the delivery because of a connection error. Your details are still in the form. The message may have been accepted — please do not resend it right away. If needed, write to kaneelsky@gmail.com.',
} : {
  sending: 'Wysyłanie…', sendingStatus: 'Wysyłanie wiadomości…',
  failed: 'Nie udało się potwierdzić wysłania wiadomości. Dane pozostały w formularzu.',
  sent: 'Wiadomość została przyjęta do wysyłki. Dziękuję za kontakt.',
  network: 'Nie udało się potwierdzić wysłania z powodu błędu połączenia. Dane pozostały w formularzu. Wiadomość mogła zostać przyjęta — nie wysyłaj jej ponownie od razu. W razie potrzeby napisz na kaneelsky@gmail.com.',
};
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
  let sending = false;
  contact.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending || !contact.reportValidity()) return;
    const data = new FormData(contact);
    const status = document.querySelector('#contact-status');
    const button = contact.querySelector('button[type="submit"]');
    const label = button.innerHTML;
    const controls = [...contact.elements].map(element => [element, element.disabled]);
    sending = true;
    contact.setAttribute('aria-busy', 'true');
    controls.forEach(([element]) => { element.disabled = true; });
    button.textContent = messages.sending;
    status.hidden = false;
    status.setAttribute('aria-live', 'polite');
    status.textContent = messages.sendingStatus;
    try {
      const response = await fetch('/api/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin', signal: AbortSignal.timeout(25000),
        body: JSON.stringify({
          name: data.get('name').trim(), email: data.get('email').trim(),
          services: data.getAll('services'), birth: data.get('birth') || '',
          msg: data.get('msg') || '', website: data.get('website') || '',
        }),
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) {
        status.setAttribute('aria-live', 'assertive');
        // Server messages are written in Polish, so the English page shows its own wording.
        status.textContent = !english && typeof result.message === 'string' ? result.message : messages.failed;
        return;
      }
      contact.reset();
      status.textContent = messages.sent;
    } catch {
      status.setAttribute('aria-live', 'assertive');
      status.textContent = messages.network;
    } finally {
      controls.forEach(([element, wasDisabled]) => { element.disabled = wasDisabled; });
      button.innerHTML = label;
      contact.removeAttribute('aria-busy');
      sending = false;
    }
  });
}
