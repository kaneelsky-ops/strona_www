const fs = require('node:fs');
const path = require('node:path');

const project = path.resolve(__dirname, '..');
const config = require('../src/data/site.json');
const faqs = require('../src/data/faq.json');
const output = path.join(project, 'public');
const services = require('../src/data/services.json');
const certificateMeta = require('../src/data/certificates.json');
const instagram = config.instagramUrl;
const instagramIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.3" cy="6.7" r=".6" fill="currentColor" stroke="none"></circle></svg>';
const layout = fs.readFileSync(path.join(project, 'src/layout.html'), 'utf8');
const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const site = new URL(process.env.SITE_URL || config.siteUrl).origin;
const email = process.env.CONTACT_EMAIL || process.env.NEXT_PUBLIC_CONTACT_EMAIL || config.contactEmail;
if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email)) {
  throw new Error('CONTACT_EMAIL must be a valid email address');
}

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
const certificates = certificateFiles.map(name => {
  const meta = certificateMeta[name] || {};
  const title = meta.title || certificateTitle(name);
  return { src: `/images/certyfikaty/${encodeURIComponent(name)}`, title, alt: meta.alt || `Certyfikat numerolog Alexandra Orin – ${title}` };
});
const certificatesHtml = certificates.length ? `<div class="certificates">
<p class="eyebrow">Certyfikaty i kwalifikacje</p>
<ul class="certificate-list">
${certificates.map(item => `<li><a class="certificate-thumb" href="${escape(item.src)}" target="_blank" rel="noopener" data-certificate>
<img src="${escape(item.src)}" alt="${escape(item.alt)}" title="${escape(item.title)}" decoding="async">
</a></li>`).join('\n')}
</ul>
</div>
<dialog class="certificate-dialog" aria-label="Podgląd certyfikatu"><form method="dialog"><button class="certificate-close" type="submit" aria-label="Zamknij podgląd">×</button></form><img alt=""></dialog>` : '';
const instagramLink = `<a class="instagram-link" href="${escape(instagram)}" target="_blank" rel="noopener me" aria-label="Instagram KANEEL – numerologia (otwiera się w nowej karcie)">${instagramIcon}<span>@orrinkaone</span></a>`;

for (const page of config.pages) {
  const content = fs.readFileSync(path.join(project, `src/pages/${page.template}.html`), 'utf8');
  const graph = [];
  if (page.template === 'home') graph.push({
    '@type': 'ProfessionalService', name: 'KANEEL – Numerolog Alexandra Orin', url: site,
    description: 'Numerologia (numerology), astrologia i Human Design – indywidualne analizy numerologiczne z 1-godzinną konsultacją online.',
    areaServed: 'PL', knowsAbout: ['Numerologia', 'Numerology', 'Astrologia', 'Human Design'],
    image: site + '/images/hero-cynamon.png', sameAs: [instagram],
    founder: { '@type': 'Person', name: 'Alexandra Orin', jobTitle: 'Numerolog', sameAs: [instagram] },
    hasOfferCatalog: {
      '@type': 'OfferCatalog', name: 'Analizy numerologiczne',
      itemListElement: services.map(name => ({
        '@type': 'Offer', itemOffered: { '@type': 'Service', name, serviceType: 'Analiza numerologiczna z 1-godzinną konsultacją online' },
      })),
    },
  });
  if (page.template === 'calculator') graph.push({
    '@type': 'WebApplication', name: 'Kalkulator numerologiczny nazwy', url: site + page.path,
    applicationCategory: 'LifestyleApplication', operatingSystem: 'Any', inLanguage: 'pl',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'PLN' },
    publisher: { '@type': 'Organization', name: 'KANEEL' },
  });
  if (faqs[page.template]) graph.push({
    '@type': 'FAQPage', mainEntity: faqs[page.template].map(([question, answer]) => ({
      '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer.replace(/\n\n+/g, ' ') },
    })),
  });
  const values = {
    TITLE: escape(page.title), DESCRIPTION: escape(page.description),
    CANONICAL: escape(site + page.path), SITE_URL: escape(site),
    CONTACT_EMAIL: escape(email), INSTAGRAM_LINK: instagramLink,
    FAQ_ITEMS: faqItems(faqs[page.template]), CERTIFICATES: certificatesHtml, YEAR: new Date().getFullYear(),
    PAGE_CLASS: `${page.template}-page`,
    PAGE_SCRIPT: page.template === 'calculator' ? '<script type="module" src="/assets/calculator.js"></script>' : '',
    STRUCTURED_DATA: JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replaceAll('<', '\\u003c'),
  };
  const fill = template => template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
    if (!(key in values)) throw new Error('Unknown template token: ' + key);
    return values[key];
  });
  values.CONTENT = fill(content);
  const destination = page.path.endsWith('.html')
    ? path.join(output, page.path.slice(1))
    : path.join(output, page.path.slice(1), 'index.html');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, fill(layout).replace(/[\t ]+$/gm, ''));
}
fs.writeFileSync(path.join(output, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${site}/sitemap.xml\n`);
fs.writeFileSync(path.join(output, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  config.pages.map(page => `  <url><loc>${escape(site + page.path)}</loc></url>`).join('\n') + '\n</urlset>\n');
console.log(`Rendered ${config.pages.length} pages.`);
