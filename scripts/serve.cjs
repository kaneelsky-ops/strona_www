const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
require('../build-static.cjs');

const root = path.resolve(__dirname, '../public');
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
};
http.createServer((request, response) => {
  let file;
  try { file = path.resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname)); }
  catch { response.writeHead(400); response.end('Bad request'); return; }
  if (file !== root && !file.startsWith(root + path.sep)) {
    response.writeHead(403); response.end('Forbidden'); return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('Nie znaleziono strony.'); return;
  }
  response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  if (request.method === 'HEAD') response.end(); else fs.createReadStream(file).pipe(response);
}).listen(Number(process.env.PORT || 4173), '127.0.0.1', () => {
  console.log(`Kaneel: http://127.0.0.1:${process.env.PORT || 4173}`);
});
