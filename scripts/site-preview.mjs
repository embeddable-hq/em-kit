// Serves dist-site/ the way a static host would: directory indexes, real
// content types, the headers dist-site/_headers sets for a path (as Netlify and
// Cloudflare Pages apply them), and a 404 status with 404.html for unknown paths.
//   npm run site:preview            on PORT, default 5311
// startPreview() is the same server for scripts and tests; port 0 picks a free one.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const defaultRoot = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'dist-site');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** `_headers` as { path: { name: value } }: a path on its own line, then its headers indented under it. */
export const parseHeaders = (text) => {
  const rules = {};
  let path;
  for (const line of text.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      path = line.trim();
      rules[path] ??= {};
    } else if (path) {
      const at = line.indexOf(':');
      if (at > 0) rules[path][line.slice(0, at).trim()] = line.slice(at + 1).trim();
    }
  }
  return rules;
};

/** Starts the server; resolves with it and the port it listens on. */
export const startPreview = ({ root = defaultRoot, port = Number(process.env.PORT ?? 5311) } = {}) =>
  new Promise((resolveServer, reject) => {
    const headersFile = join(root, '_headers');
    const rules = existsSync(headersFile) ? parseHeaders(readFileSync(headersFile, 'utf-8')) : {};

    const find = (pathname) => {
      const clean = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
      const file = join(root, clean);
      if (!file.startsWith(root)) return undefined;
      if (existsSync(file) && statSync(file).isFile()) return file;
      const index = join(file, 'index.html');
      return existsSync(index) ? index : undefined;
    };

    const server = createServer((req, res) => {
      const { pathname } = new URL(req.url ?? '/', 'http://localhost');
      const file = find(pathname);
      const target = file ?? join(root, '404.html');
      if (!existsSync(target)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found. Run npm run site:build first.\n');
        return;
      }
      const headers = { 'Content-Type': types[extname(target)] ?? 'application/octet-stream', ...(file ? rules[pathname] : {}) };
      res.writeHead(file ? 200 : 404, headers);
      res.end(req.method === 'HEAD' ? undefined : readFileSync(target));
    });
    server.on('error', reject);
    server.listen(port, () => resolveServer({ server, port: server.address().port }));
  });

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { port } = await startPreview();
  console.log(`dist-site on http://localhost:${port}`);
}
