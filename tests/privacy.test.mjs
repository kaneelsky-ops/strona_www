import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const project = fileURLToPath(new URL('../', import.meta.url));
const preview = fs.mkdtempSync(path.join(os.tmpdir(), 'kaneel-privacy-test-'));
const policyPath = '/polityka-prywatnosci.html';
const read = relative => fs.readFileSync(path.join(preview, 'public', relative), 'utf8');

before(() => {
  for (const directory of ['src', 'scripts']) {
    fs.cpSync(path.join(project, directory), path.join(preview, directory), { recursive: true });
  }
  execFileSync(process.execPath, [path.join(preview, 'scripts/build-pages.cjs')], {
    cwd: preview,
    env: { ...process.env, SITE_URL: 'https://www.kaneel.pl', CONTACT_EMAIL: 'kaneelsky@gmail.com' },
  });
});
after(() => {
  const target = fs.realpathSync(preview);
  const parent = fs.realpathSync(os.tmpdir());
  if (path.dirname(target) !== parent || !path.basename(target).startsWith('kaneel-privacy-test-')) {
    throw new Error('Unexpected test cleanup directory');
  }
  fs.rmSync(target, { recursive: true });
});

test('Policy is a real .html file, with Polish metadata and all eleven sections in static HTML', () => {
  const html = read(policyPath);
  assert.ok(fs.statSync(path.join(preview, 'public', policyPath)).isFile());
  assert.match(html, /<html lang="pl"/);
  assert.match(html, /<title>Polityka prywatności KANEEL<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.kaneel\.pl\/polityka-prywatnosci\.html">/);
  assert.equal((html.match(/<h2 id=/g) || []).length, 11);
  assert.match(html, /Wróć do strony głównej/);
  assert.doesNotMatch(html, /\{\{[A-Z_]+\}\}|\[Przed publikacją|\[wstaw|DO UZUPEŁNIENIA/);
});
test('Every page has a regular policy link in the shared footer', () => {
  for (const file of ['index.html', 'kalkulator-numerologiczny/index.html', 'kacik-wiedzy/index.html', policyPath]) {
    const footer = read(file).match(/<footer[\s\S]*?<\/footer>/)[0];
    assert.ok(footer.includes(`<a href="${policyPath}">Polityka prywatności</a>`), file);
  }
});
test('Contact disclosure links to the policy without adding a consent requirement', () => {
  const form = read('index.html').match(/<form id="contact-form"[\s\S]*?<\/form>/)[0];
  assert.match(form, /Administratorem danych jest Alexandra Orin, prowadząca KANEEL/);
  assert.ok(form.includes(`<a href="${policyPath}">Polityce prywatności</a>`));
  assert.match(form, /action="\/api\/contact" method="post"/);
  assert.match(form, /Formularz wysyła wiadomość bezpośrednio do KANEEL przez Gmail API/);
  assert.equal((form.match(/type="checkbox"/g) || []).length, JSON.parse(fs.readFileSync(path.join(project, 'src/data/services.json'), 'utf8')).length);
  assert.equal((form.match(/required=""/g) || []).length, 2);
});
test('Server-side Gmail delivery, optional fields and local calculator are clearly distinguished', () => {
  const html = read(policyPath);
  assert.match(html, /Automatyczna wysyłka przez Gmail API/);
  assert.match(html, /Potwierdzenie pojawia się dopiero po przyjęciu wiadomości przez Gmail API/);
  assert.doesNotMatch(html, /Planowana automatyczna|Formularz przygotowuje wiadomość w Twojej aplikacji/);
  assert.match(html, /https:\/\/www.googleapis.com\/auth\/gmail.send/);
  assert.match(html, /Wybór usług, data urodzenia i treść wiadomości są opcjonalne/);
  assert.match(html, /nie uruchamia automatycznego usuwania wiadomości ze skrzynki/);
  assert.match(html, /nie zapisuje własnych plików cookies/);
  assert.match(html, /lokalnie w przeglądarce/);
});
test('Sitemap advertises the exact .html URL and all original pages remain generated', () => {
  assert.ok(read('sitemap.xml').includes(`<loc>https://www.kaneel.pl${policyPath}</loc>`));
  assert.match(read('index.html'), /id="oferta"/);
  assert.match(read('kalkulator-numerologiczny/index.html'), /id="calculator-form"/);
  assert.match(read('kacik-wiedzy/index.html'), /Kącik Wiedzy/);
});
