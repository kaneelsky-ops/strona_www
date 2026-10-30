const fs = require('node:fs');
const path = require('node:path');

const project = path.resolve(__dirname, '..');
const config = require('../src/data/site.json');
const faqs = require('../src/data/faq.json');
const output = path.join(project, 'public');
const layout = fs.readFileSync(path.join(project, 'src/layout.html'), 'utf8');
const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const site = new URL(process.env.SITE_URL || config.siteUrl).origin;
const email = process.env.CONTACT_EMAIL || process.env.NEXT_PUBLIC_CONTACT_EMAIL || config.contactEmail;
if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email)) {
  throw new Error('CONTACT_EMAIL must be a valid email address');
}

for (const page of config.pages) {
  const content = fs.readFileSync(path.join(project, `src/pages/${page.template}.html`), 'utf8');
  const graph = [];
  if (page.template === 'home') graph.push({
    '@type': 'ProfessionalService', name: 'Kaneel – Numerolog Alexandra Orin', url: site,
    description: 'Numerologia, astrologia i Human Design – indywidualne analizy i konsultacje online.',
    areaServed: 'PL', founder: { '@type': 'Person', name: 'Alexandra Orin' },
  });
  if (page.template === 'calculator') graph.push({
    '@type': 'WebApplication', name: 'Kalkulator numerologiczny nazwy', url: site + page.path,
    applicationCategory: 'LifestyleApplication', operatingSystem: 'Any', inLanguage: 'pl',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'PLN' },
    publisher: { '@type': 'Organization', name: 'Kaneel' },
  });
  if (faqs[page.template]) graph.push({
    '@type': 'FAQPage', mainEntity: faqs[page.template].map(([question, answer]) => ({
      '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  });
  const values = {
    TITLE: escape(page.title), DESCRIPTION: escape(page.description),
    CANONICAL: escape(site + page.path), SITE_URL: escape(site),
    CONTACT_EMAIL: escape(email), YEAR: new Date().getFullYear(),
    PAGE_CLASS: `${page.template}-page`,
    PAGE_SCRIPT: page.template === 'calculator' ? '<script type="module" src="/assets/calculator.js"></script>' : '',
    STRUCTURED_DATA: JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replaceAll('<', '\\u003c'),
  };
  const fill = template => template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
    if (!(key in values)) throw new Error('Unknown template token: ' + key);
    return values[key];
  });
  values.CONTENT = fill(content);
  const destination = path.join(output, page.path.slice(1), 'index.html');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, fill(layout).replace(/[\t ]+$/gm, ''));
}
fs.writeFileSync(path.join(output, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${site}/sitemap.xml\n`);
fs.writeFileSync(path.join(output, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  config.pages.map(page => `  <url><loc>${escape(site + page.path)}</loc></url>`).join('\n') + '\n</urlset>\n');
console.log(`Rendered ${config.pages.length} pages.`);
