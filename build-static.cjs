const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, 'public');
const index = path.join(root, 'index.html');
if (!fs.existsSync(index)) throw new Error('Missing public/index.html');
let files = 0;
let bytes = 0;
const textFiles = [];
function inspect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Unexpected symlink: ' + full);
    if (entry.isDirectory()) inspect(full);
    else {
      const size = fs.statSync(full).size;
      if (!size) throw new Error('Empty file: ' + full);
      files++;
      bytes += size;
      if (/\.(html|css)$/.test(entry.name)) textFiles.push(full);
    }
  }
}
inspect(root);
const missing = new Set();
let references = 0;
function checkReference(value, source) {
  value = value.trim().replace(/&amp;/g, '&');
  if (!value || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value)) return;
  const pathname = decodeURIComponent(value.split(/[?#]/)[0]);
  const target = pathname.startsWith('/')
    ? path.join(root, pathname.slice(1))
    : path.resolve(path.dirname(source), pathname);
  references++;
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    missing.add(path.relative(__dirname, source) + ': ' + value);
  }
}
for (const file of textFiles) {
  const text = fs.readFileSync(file, 'utf8');
  if (file.endsWith('.html')) {
    for (const match of text.matchAll(/\b(?:src|href|poster)="([^"]+)"/g)) {
      checkReference(match[1], file);
    }
    for (const match of text.matchAll(/\bsrcset="([^"]+)"/g)) {
      for (const candidate of match[1].split(',')) {
        checkReference(candidate.trim().split(/\s+/)[0], file);
      }
    }
    if (/\/_next\/image\?/.test(text)) {
      throw new Error('Static hosting cannot serve the Next.js image optimizer. Use image files directly.');
    }
  } else {
    for (const match of text.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)) {
      checkReference(match[1], file);
    }
  }
}
if (missing.size) throw new Error('Missing static assets:\n' + [...missing].join('\n'));
console.log('Static site ready: ' + files + ' files, ' + bytes + ' bytes in public/');
console.log('Validated ' + references + ' local asset references.');
