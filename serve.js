#!/usr/bin/env node
/* ==========================================================================
   Glyphforge — tiny static server.

   Glyphforge runs fine by double-clicking index.html, but a few browser
   features (camera, screen capture, clipboard images) are only offered on
   http://localhost. Run this and open the printed URL to get all of them.

     node serve.js            → http://localhost:8777
     node serve.js 3000       → http://localhost:3000

   No dependencies. Sends no-store so edits show up on refresh.
   ========================================================================== */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = parseInt(process.argv[2], 10) || 8777;
const ROOT = __dirname;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(url.parse(req.url).pathname);
  } catch (e) {
    res.writeHead(400).end('Bad request');
    return;
  }

  if (pathname === '/') pathname = '/index.html';

  // Resolve inside ROOT only — no climbing out with ../
  const filePath = path.join(ROOT, path.normalize(pathname).replace(/^(\.\.[\/\\])+/, ''));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found: ' + pathname);
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-store, must-revalidate'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log('\n  Glyphforge → http://localhost:' + PORT + '\n');
  console.log('  Serving ' + ROOT);
  console.log('  Ctrl+C to stop.\n');
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error('\n  Port ' + PORT + ' is busy. Try:  node serve.js ' + (PORT + 1) + '\n');
  } else {
    console.error(e);
  }
  process.exit(1);
});
