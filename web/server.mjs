// Production web server: serves the built SPA and renders the <head> of public pages on the server, so search
// engines and link previews see their title, description and image. Pages opened through an owner's own domain are
// found by host name.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RESERVED_PUBLIC_PAGE_SLUGS } from '@meetli/shared/public-page';
import { publicPageHead } from '@meetli/shared/public-page-seo';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), 'dist');
const port = Number(process.env.PORT ?? 5173);
const apiUrl = (process.env.VITE_API_URL ?? 'http://localhost:3003').replace(/\/+$/, '');
const publicOrigin = process.env.VITE_PUBLIC_PAGE_ORIGIN?.replace(/\/+$/, '');
const appHosts = new Set(['localhost', '127.0.0.1', '[::1]', ...(publicOrigin ? [new URL(publicOrigin).hostname] : [])]);
const CACHE_MS = 30_000;
const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.map': 'application/json; charset=utf-8',
};

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
));
const inlineJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

const lookups = new Map();
/** Answers of the API are cached briefly: crawlers and link previews hit the same page in bursts. */
async function lookup(path) {
  const cached = lookups.get(path);
  if (cached && cached.expires > Date.now()) return cached.value;
  let value = null;
  try {
    const response = await fetch(`${apiUrl}${path}`, { signal: AbortSignal.timeout(3000) });
    value = response.ok ? await response.json() : null;
  } catch {
    value = null;
  }
  lookups.set(path, { value, expires: Date.now() + CACHE_MS });
  if (lookups.size > 500) lookups.delete(lookups.keys().next().value);
  return value;
}

let template;
async function indexHtml() {
  template ??= await readFile(join(root, 'index.html'), 'utf8');
  return template;
}

function renderPage(html, page, canonical, ownDomain) {
  const head = publicPageHead(page, canonical);
  const tags = [
    `<title>${escapeHtml(head.title)}</title>`,
    `<link rel="canonical" href="${escapeHtml(head.canonical)}" />`,
    ...head.meta.map(({ attribute, key, content }) => `<meta ${attribute}="${escapeHtml(key)}" content="${escapeHtml(content)}" />`),
    ...(ownDomain ? [`<script>window.__PUBLIC_PAGE_DOMAIN__=${inlineJson(ownDomain)};window.__PUBLIC_PAGE_SLUG__=${inlineJson(page.slug)};</script>`] : []),
  ].join('\n    ');
  return html.replace(/<title>.*?<\/title>/s, '').replace('<html lang="en">', `<html lang="${page.locale}">`).replace('</head>', `    ${tags}\n  </head>`);
}

function send(res, status, body, type, cache = 'no-cache') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' });
  res.end(body);
}

async function serveFile(res, pathname) {
  const file = normalize(join(root, pathname));
  if (!file.startsWith(root)) return false;
  try {
    if (!(await stat(file)).isFile()) return false;
    const immutable = pathname.startsWith('/assets/');
    send(res, 200, await readFile(file), contentTypes[extname(file)] ?? 'application/octet-stream', immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
    return true;
  } catch {
    return false;
  }
}

function requestOrigin(req) {
  if (publicOrigin) return publicOrigin;
  const protocol = req.headers['x-forwarded-proto']?.split(',')[0] ?? 'http';
  return `${protocol}://${req.headers.host}`;
}

async function handle(req, res) {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  const host = (req.headers.host ?? '').split(':')[0].toLowerCase();

  if (!appHosts.has(host)) {
    const page = await lookup(`/api/public-pages/by-domain/${encodeURIComponent(host)}`);
    if (page) {
      const origin = `https://${host}`;
      if (pathname === '/robots.txt') return send(res, 200, `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`, contentTypes['.txt']);
      if (pathname === '/sitemap.xml') return send(res, 200, sitemap([`${origin}/`]), contentTypes['.xml']);
      if (pathname === '/' || !(await serveFile(res, pathname))) {
        return send(res, 200, renderPage(await indexHtml(), page, `${origin}/`, host), contentTypes['.html']);
      }
      return undefined;
    }
  }

  if (pathname === '/robots.txt') {
    return send(res, 200, `User-agent: *\nAllow: /\nSitemap: ${requestOrigin(req)}/sitemap.xml\n`, contentTypes['.txt']);
  }
  if (pathname === '/sitemap.xml') {
    const origin = requestOrigin(req);
    const slugs = (await lookup('/api/public-pages/sitemap'))?.slugs ?? [];
    return send(res, 200, sitemap(slugs.map((slug) => `${origin}/${encodeURIComponent(slug)}`)), contentTypes['.xml']);
  }
  if (await serveFile(res, pathname)) return undefined;
  if (extname(pathname)) return send(res, 404, 'Not found', contentTypes['.txt']);

  const slug = /^\/([a-z0-9-]+)\/?$/.exec(pathname)?.[1];
  if (slug && !RESERVED_PUBLIC_PAGE_SLUGS.has(slug)) {
    const page = await lookup(`/api/public-pages/by-slug/${encodeURIComponent(slug)}`);
    if (page) return send(res, 200, renderPage(await indexHtml(), page, `${requestOrigin(req)}/${encodeURIComponent(page.slug)}`, null), contentTypes['.html']);
  }
  return send(res, 200, await indexHtml(), contentTypes['.html']);
}

const sitemap = (urls) => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${escapeHtml(url)}</loc></url>`).join('\n')}\n</urlset>\n`;

createServer((req, res) => {
  handle(req, res).catch(() => send(res, 500, 'Internal Server Error', contentTypes['.txt']));
}).listen(port, '0.0.0.0', () => console.log(`web listening on ${port}`));
