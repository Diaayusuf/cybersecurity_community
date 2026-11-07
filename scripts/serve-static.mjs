import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReadStream, realpathSync, statSync } from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const canonicalRoot = realpathSync(root);
const host = '127.0.0.1';
const port = Number(process.env.PORT || 4174);
const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.avif', 'image/avif'],
  ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function send(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://' + host + ':' + port).pathname);
  } catch {
    send(res, 400, 'Bad request');
    return;
  }
  if (pathname === '/favicon.ico') {
    res.writeHead(204, { 'Cache-Control': 'no-store' });
    res.end();
    return;
  }
  if (pathname === '/') pathname = '/index.html';

  const relativePath = pathname.replace(/^\/+/, '');
  const resolvedPath = path.resolve(root, relativePath);
  const relativeToRoot = path.relative(root, resolvedPath);
  const segments = relativePath.split(/[\\/]/);
  const firstSegment = segments[0]?.toLowerCase();
  const allowedTopLevel = new Set([
    'admin.html', 'index.html', 'puzzle.html', 'awareness.html',
    'learning.html', 'dashboard.html', 'auth.html', 'pricing.html', 'profile.html',
    'leaderboard.html', 'community.html', 'resources.html', 'assistant.html',
    'script.js', 'style.css', 'image', 'img', 'assets',
  ]);
  if (
    !relativeToRoot ||
    relativeToRoot.startsWith('..' + path.sep) ||
    path.isAbsolute(relativeToRoot) ||
    segments.some(segment => segment === '..' || segment.startsWith('.')) ||
    !allowedTopLevel.has(firstSegment)
  ) {
    send(res, 404, 'Not found');
    return;
  }

  let realPath;
  let stat;
  try {
    realPath = realpathSync(resolvedPath);
    const relativeRealPath = path.relative(canonicalRoot, realPath);
    if (!relativeRealPath || relativeRealPath.startsWith('..' + path.sep) || path.isAbsolute(relativeRealPath)) {
      send(res, 404, 'Not found');
      return;
    }
    stat = statSync(realPath);
    if (!stat.isFile()) throw new Error('Not a file');
  } catch {
    send(res, 404, 'Not found');
    return;
  }

  const type = mimeTypes.get(path.extname(realPath).toLowerCase()) ?? 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stat.size,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  });
  if (req.method === 'HEAD') res.end();
  else createReadStream(realPath).pipe(res);
});

server.listen(port, host, () => {
  process.stdout.write('CyberX test server listening on http://' + host + ':' + port + '\n');
});
server.on('error', error => {
  process.stderr.write('CyberX test server failed to start (' + (error.code ?? 'unknown error') + ').\n');
  process.exitCode = 1;
});

function shutdown() {
  server.close(() => process.exit(0));
  server.closeAllConnections();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
