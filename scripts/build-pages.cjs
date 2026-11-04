const fs = require('node:fs');
const path = require('node:path');

const project = path.resolve(__dirname, '..');
const config = require('../src/data/site.json');
const faqs = require('../src/data/faq.json');
const output = path.join(project, 'public');
const services = { pl: require('../src/data/services.json'), en: require('../src/data/services-en.json') };
const certificateMeta = require('../src/data/certificates.json');
const instagram = config.instagramUrl;
const layout = fs.readFileSync(path.join(project, 'src/layout.html'), 'utf8');
const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const site = new URL(process.env.SITE_URL || config.siteUrl).origin;
const email = process.env.CONTACT_EMAIL || process.env.NEXT_PUBLIC_CONTACT_EMAIL || config.contactEmail;
if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email)) {
  throw new Error('CONTACT_EMAIL must be a valid email address');
}

const svg = inner => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`;
const instagramIcon = svg('<rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.3" cy="6.7" r=".6" fill="currentColor" stroke="none"></circle>');
const mailIcon = svg('<rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="m3.5 6.5 8.5 6 8.5-6"></path>');
// The text arrow "↗" turns into a coloured emoji on iPhone/Safari and some Android browsers,
// so every arrow is replaced with the same thin vector arrow at build time.
const arrow = '<span class="icon-arrow" aria-hidden="true">' + svg('<path d="M7 17 17 7"></path><path d="M8 7h9v9"></path>') + '</span>';

// Interface strings shared by the layout, per language.
const ui = {
  pl: {
    T_SKIP: 'Przejdź do treści', T_LOGO_LABEL: 'KANEEL — strona główna', T_TAG: 'numerologia',
    T_NAV_LABEL: 'Główna nawigacja', T_MOBILE_LABEL: 'Menu mobilne', T_NAV_OFFER: 'Oferta', T_NAV_ABOUT: 'O mnie',
    T_NAV_CALC: 'Kalkulator', T_NAV_KNOW: 'Kącik Wiedzy', T_NAV_TALK: 'Porozmawiajmy', T_NAV_CONTACT: 'Kontakt',
    T_MENU_OPEN: 'Otwórz menu', T_MENU_CLOSE: 'Zamknij menu',
    T_FOOTER_ABOUT: 'Indywidualne analizy i spotkania z numerologią. W Twoim tempie, z uważnością i bez oceniania.',
    T_FOOTER_NAV_LABEL: 'Nawigacja w stopce', T_FOOTER_DISCOVER: 'Odkrywaj KANEEL', T_FOOTER_OFFER: 'Spotkania i analizy',
    T_FOOTER_CALC: 'Kalkulator numerologiczny', T_FOOTER_FAQ: 'Pytania i odpowiedzi', T_PRIVACY: 'Polityka prywatności',
    T_FOOTER_CONSULT: 'W cenie wybranej analizy otrzymujesz <span class="nowrap">1-godzinną</span> konsultację online.',
    T_DISCLAIMER: 'Numerologia, astrologia i Human Design mają charakter symboliczny i rozwojowy; nie zastępują porady lekarza, psychologa ani terapeuty.',
    langSwitch: 'Wybór języka', emailLabel: 'Napisz e-mail do KANEEL', instagramLabel: 'Instagram KANEEL – numerologia (otwiera się w nowej karcie)',
    certTitle: 'Certyfikaty i kwalifikacje', certAlt: 'Certyfikat numerolog Alexandra Orin', certDialog: 'Podgląd certyfikatu', certClose: 'Zamknij podgląd',
    ogLocale: 'pl_PL',
  },
  en: {
    T_SKIP: 'Skip to content', T_LOGO_LABEL: 'KANEEL — home page', T_TAG: 'numerology',
    T_NAV_LABEL: 'Main navigation', T_MOBILE_LABEL: 'Mobile menu', T_NAV_OFFER: 'Readings', T_NAV_ABOUT: 'About me',
    T_NAV_CALC: 'Calculator', T_NAV_KNOW: 'Knowledge Corner', T_NAV_TALK: 'Let’s talk', T_NAV_CONTACT: 'Contact',
    T_MENU_OPEN: 'Open menu', T_MENU_CLOSE: 'Close menu',
    T_FOOTER_ABOUT: 'Personal numerology readings and consultations online – worldwide, at your pace, mindfully and without judgement.',
    T_FOOTER_NAV_LABEL: 'Footer navigation', T_FOOTER_DISCOVER: 'Discover KANEEL', T_FOOTER_OFFER: 'Numerology readings',
    T_FOOTER_CALC: 'Numerology calculator', T_FOOTER_FAQ: 'Questions and answers', T_PRIVACY: 'Privacy policy',
    T_FOOTER_CONSULT: 'Every reading includes a 1-hour online consultation.',
    T_DISCLAIMER: 'Numerology, astrology and Human Design are symbolic tools for personal growth; they do not replace the advice of a doctor, psychologist or therapist.',
    langSwitch: 'Choose language', emailLabel: 'Email KANEEL', instagramLabel: 'KANEEL numerology on Instagram (opens in a new tab)',
    certTitle: 'Certificates and qualifications', certAlt: 'Certificate of numerologist Alexandra Orin', certDialog: 'Certificate preview', certClose: 'Close preview',
    ogLocale: 'en_GB',
  },
};
const pathsFor = lang => Object.fromEntries(config.pages.filter(page => page.lang === lang).map(page => [page.kind, page.path]));
const alternatesFor = page => config.pages.filter(other => other.kind === page.kind);

const paragraphs = text => text.split(/\n\n+/).map(part => `<p>${escape(part)}</p>`).join('');
const faqItems = list => (list || []).map(([question, answer]) => `<details class="faq-item">
<summary><h3>${escape(question)}</h3><span class="faq-plus" aria-hidden="true">+</span></summary>
<div class="faq-answer">${paragraphs(answer)}</div>
</details>`).join('\n');

// Certificates: every image placed in public/images/certyfikaty/ is shown automatically.
// Titles and alt texts come from src/data/certificates.json (fallback: the file name).
const certificateDir = path.join(output, 'images', 'certyfikaty');
const certificateFiles = fs.existsSync(certificateDir)
  ? fs.readdirSync(certificateDir).filter(name => /\.(jpe?g|png|webp|avif)$/i.test(name)).sort((a, b) => a.localeCompare(b, 'pl'))
  : [];
const certificateTitle = name => {
  const base = name.replace(/\.[^.]+$/, '').replace(/^\d+[-_ ]*/, '').replace(/[-_]+/g, ' ').trim();
  return base.charAt(0).toUpperCase() + base.slice(1);
};
const certificatesHtml = lang => {
  if (!certificateFiles.length) return '';
  const t = ui[lang];
  const items = certificateFiles.map(name => {
    const meta = (lang === 'en' ? certificateMeta[name]?.en : certificateMeta[name]) || {};
    const title = meta.title || certificateTitle(name);
    return { src: `/images/certyfikaty/${encodeURIComponent(name)}`, title, alt: meta.alt || `${t.certAlt} – ${title}` };
  });
  return `<div class="certificates">
<p class="eyebrow">${t.certTitle}</p>
<ul class="certificate-list">
${items.map(item => `<li><a class="certificate-thumb" href="${escape(item.src)}" target="_blank" rel="noopener" data-certificate>
<img src="${escape(item.src)}" alt="${escape(item.alt)}" title="${escape(item.title)}" decoding="async">
</a></li>`).join('\n')}
</ul>
</div>
<dialog class="certificate-dialog" aria-label="${t.certDialog}"><form method="dialog"><button class="certificate-close" type="submit" aria-label="${t.certClose}">×</button></form><img alt=""></dialog>`;
};
const instagramLink = lang => `<a class="icon-link instagram-link" href="${escape(instagram)}" target="_blank" rel="noopener me" aria-label="${ui[lang].instagramLabel}">${instagramIcon}<span>@orrinkaone</span></a>`;
const emailLink = lang => `<a class="icon-link email-link" href="mailto:${escape(email)}" aria-label="${ui[lang].emailLabel}: ${escape(email)}">${mailIcon}<span>${escape(email)}</span></a>`;
const langSwitch = page => `<nav class="lang-switch" aria-label="${ui[page.lang].langSwitch}">${alternatesFor(page).map(other =>
  `<a href="${escape(other.path)}" hreflang="${other.lang}" lang="${other.lang}"${other.lang === page.lang ? ' aria-current="true"' : ''}>${other.lang.toUpperCase()}</a>`).join('<span aria-hidden="true">/</span>')}</nav>`;
const hreflang = page => {
  const alternates = alternatesFor(page);
  const english = alternates.find(other => other.lang === 'en') || alternates[0];
  return alternates.map(other => `<link rel="alternate" hreflang="${other.lang}" href="${escape(site + other.path)}">`).join('\n  ')
    + `\n  <link rel="alternate" hreflang="x-default" href="${escape(site + english.path)}">`;
};

function structuredData(page) {
  const graph = [];
  const en = page.lang === 'en';
  if (page.kind === 'home') graph.push({
    '@type': 'ProfessionalService', name: en ? 'KANEEL – Numerologist Alexandra Orin' : 'KANEEL – Numerolog Alexandra Orin',
    url: site + page.path, inLanguage: page.lang,
    description: en
      ? 'Numerology, astrology and Human Design – personal online numerology readings with a 1-hour consultation, for clients worldwide.'
      : 'Numerologia (numerology), astrologia i Human Design – indywidualne analizy numerologiczne z 1-godzinną konsultacją online.',
    areaServed: 'Worldwide', availableLanguage: ['pl', 'en'],
    knowsAbout: ['Numerologia', 'Numerology', 'Astrologia', 'Astrology', 'Human Design'],
    image: site + '/images/hero-cynamon.png', sameAs: [instagram],
    founder: { '@type': 'Person', name: 'Alexandra Orin', jobTitle: en ? 'Numerologist' : 'Numerolog', sameAs: [instagram] },
    hasOfferCatalog: {
      '@type': 'OfferCatalog', name: en ? 'Numerology readings' : 'Analizy numerologiczne',
      itemListElement: services[page.lang].map(name => ({
        '@type': 'Offer', itemOffered: {
          '@type': 'Service', name,
          serviceType: en ? 'Numerology reading with a 1-hour online consultation' : 'Analiza numerologiczna z 1-godzinną konsultacją online',
        },
      })),
    },
  });
  if (page.kind === 'calculator') graph.push({
    '@type': 'WebApplication', name: en ? 'Numerology name calculator' : 'Kalkulator numerologiczny nazwy', url: site + page.path,
    applicationCategory: 'LifestyleApplication', operatingSystem: 'Any', inLanguage: page.lang,
    offers: { '@type': 'Offer', price: '0', priceCurrency: en ? 'EUR' : 'PLN' },
    publisher: { '@type': 'Organization', name: 'KANEEL' },
  });
  if (faqs[page.template]) graph.push({
    '@type': 'FAQPage', inLanguage: page.lang, mainEntity: faqs[page.template].map(([question, answer]) => ({
      '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer.replace(/\n\n+/g, ' ') },
    })),
  });
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replaceAll('<', '\\u003c');
}

for (const page of config.pages) {
  const content = fs.readFileSync(path.join(project, `src/pages/${page.template}.html`), 'utf8');
  const t = ui[page.lang];
  const links = pathsFor(page.lang);
  const other = alternatesFor(page).find(item => item.lang !== page.lang);
  const values = {
    ...Object.fromEntries(Object.entries(t).filter(([key]) => key.startsWith('T_'))),
    LANG: page.lang, OG_LOCALE: t.ogLocale, OG_LOCALE_ALT: other ? ui[other.lang].ogLocale : t.ogLocale,
    HREFLANG: hreflang(page), LANG_SWITCH: langSwitch(page),
    HOME: links.home, CALC: links.calculator, KNOW: links.knowledge, PRIVACY: links.privacy,
    TITLE: escape(page.title), DESCRIPTION: escape(page.description),
    CANONICAL: escape(site + page.path), SITE_URL: escape(site),
    CONTACT_EMAIL: escape(email), INSTAGRAM_LINK: instagramLink(page.lang), EMAIL_LINK: emailLink(page.lang),
    FAQ_ITEMS: faqItems(faqs[page.template]), CERTIFICATES: certificatesHtml(page.lang), YEAR: new Date().getFullYear(),
    PAGE_CLASS: `${page.kind}-page`,
    PAGE_SCRIPT: page.kind === 'calculator' ? '<script type="module" src="/assets/calculator.js"></script>' : '',
    STRUCTURED_DATA: structuredData(page),
  };
  const fill = template => template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
    if (!(key in values)) throw new Error('Unknown template token: ' + key);
    return values[key];
  });
  values.CONTENT = fill(content);
  const html = fill(layout).replaceAll('<span aria-hidden="true">↗</span>', arrow).replace(/[\t ]+$/gm, '');
  if (html.includes('↗')) throw new Error(`Text arrow left in ${page.path}; use <span aria-hidden="true">↗</span> so it becomes an icon.`);
  const destination = page.path.endsWith('.html')
    ? path.join(output, page.path.slice(1))
    : path.join(output, page.path.slice(1), 'index.html');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, html);
}
fs.writeFileSync(path.join(output, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${site}/sitemap.xml\n`);
fs.writeFileSync(path.join(output, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
  config.pages.map(page => `  <url><loc>${escape(site + page.path)}</loc>${alternatesFor(page).map(other =>
    `<xhtml:link rel="alternate" hreflang="${other.lang}" href="${escape(site + other.path)}"/>`).join('')}</url>`).join('\n') + '\n</urlset>\n');
console.log(`Rendered ${config.pages.length} pages.`);
