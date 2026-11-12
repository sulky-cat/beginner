/* Простой статический сервер для локального просмотра. Node 18+, без зависимостей. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8'
};

function createServer() {
  return http.createServer((req, res) => {
    try {
      const u = new URL(req.url, 'http://localhost');
      let file = path.normalize(path.join(ROOT, decodeURIComponent(u.pathname)));
      if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
      if (u.pathname === '/' || u.pathname === '') file = path.join(ROOT, 'index.html');
      fs.stat(file, (err, st) => {
        if (err || !st.isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Не найдено: ' + u.pathname);
          return;
        }
        res.writeHead(200, {
          'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff'
        });
        fs.createReadStream(file).pipe(res);
      });
    } catch {
      res.writeHead(400); res.end('Bad request');
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 5173);
  createServer().listen(port, '0.0.0.0', () => {
    console.log('Новичок запущен: http://localhost:' + port + ' (слушает 0.0.0.0)');
  });
}
module.exports = { createServer };
