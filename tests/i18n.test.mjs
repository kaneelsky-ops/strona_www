import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const project = fileURLToPath(new URL('../', import.meta.url));
const preview = fs.mkdtempSync(path.join(os.tmpdir(), 'kaneel-i18n-test-'));
const read = relative => fs.readFileSync(path.join(preview, 'public', relative), 'utf8');
const pages = { pl: ['index.html', 'oferta/index.html', 'kalkulator-numerologiczny/index.html', 'kacik-wiedzy/index.html', 'polityka-prywatnosci.html'],
  en: ['en/index.html', 'en/numerology-readings/index.html', 'en/numerology-calculator/index.html', 'en/numerology-knowledge/index.html', 'en/privacy-policy.html'] };

before(() => {
  for (const directory of ['src', 'scripts']) fs.cpSync(path.join(project, directory), path.join(preview, directory), { recursive: true });
  execFileSync(process.execPath, [path.join(preview, 'scripts/build-pages.cjs')], { cwd: preview, env: { ...process.env, SITE_URL: 'https://www.kaneel.pl' } });
});
after(() => {
  const target = fs.realpathSync(preview);
  if (path.dirname(target) !== fs.realpathSync(os.tmpdir()) || !path.basename(target).startsWith('kaneel-i18n-test-')) throw new Error('Unexpected cleanup directory');
  fs.rmSync(target, { recursive: true });
});

test('Every Polish page has an English counterpart linked with hreflang and a language switch', () => {
  for (const [lang, files] of Object.entries(pages)) {
    for (const file of files) {
      const html = read(file);
      assert.match(html, new RegExp(`<html lang="${lang}"`), file);
      assert.match(html, /hreflang="pl"/, file);
      assert.match(html, /hreflang="en"/, file);
      assert.match(html, /hreflang="x-default"/, file);
      assert.match(html, /class="lang-switch"/, file);
    }
  }
});
test('No page uses the text arrow that iOS renders as an emoji', () => {
  for (const file of [...pages.pl, ...pages.en]) assert.doesNotMatch(read(file), /↗/, file);
});
test('English form submits the same service values the server accepts', () => {
  const services = JSON.parse(fs.readFileSync(path.join(project, 'src/data/services.json'), 'utf8'));
  const html = read('en/index.html');
  assert.deepEqual([...html.matchAll(/name="services" value="([^"]+)"/g)].map(match => match[1]), services);
  assert.match(html, /id="name-harmonization"/);
  assert.match(read('index.html'), /id="harmonizacja-imienia"/);
});
test('Sitemap lists both languages', () => {
  const sitemap = read('sitemap.xml');
  for (const url of ['https://www.kaneel.pl/', 'https://www.kaneel.pl/en/', 'https://www.kaneel.pl/en/numerology-calculator']) assert.ok(sitemap.includes(`<loc>${url}</loc>`), url);
});
test('Prices are shown only on the offer pages, which link every service to the contact form', () => {
  const services = JSON.parse(fs.readFileSync(path.join(project, 'src/data/services.json'), 'utf8'));
  for (const home of ['index.html', 'en/index.html']) {
    assert.doesNotMatch(read(home), /offer-price|\d\s?zł|€\d/, home);
  }
  for (const [file, home] of [['oferta/index.html', '/'], ['en/numerology-readings/index.html', '/en/']]) {
    const html = read(file);
    assert.match(html, /class="offer-price"/, file);
    const ordered = [...html.matchAll(/href="([^"]*\?usluga=[^"#]+)#kontakt"/g)].map(match => {
      assert.ok(match[1].startsWith(home + '?'), file);
      return decodeURIComponent(match[1].split('usluga=')[1]);
    });
    for (const value of ordered) assert.ok(services.includes(value), value);
    assert.ok(ordered.length >= 11, file);
  }
  assert.match(read('oferta/index.html'), /id="harmonizacja-imienia"/);
  assert.match(read('index.html'), /href="\/oferta#harmonizacja-imienia"/);
});
