import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';

// Serves the site to LLMs and coding agents over plain HTTP: llms.txt,
// llms-full.txt, robots.txt, sitemap.xml, a Markdown twin of every page, and
// real 404s and redirects instead of the app shell for every URL.

export type AgentFile = { path: string; contentType: string; body: string };
type Loader = (id: string) => Promise<Record<string, any>>;

/**
 * Every generated file as { path, contentType, body }: llms files, robots,
 * sitemap and every .md. `load` is how to import a site module (in dev
 * server.ssrLoadModule; at build time any loader that handles TypeScript).
 */
export const generateAgentFiles = async (load: Loader, origin?: string): Promise<AgentFile[]> =>
  withDom(async () => {
    const { agentFiles } = await load('/content/llms.ts');
    return agentFiles(origin) as AgentFile[];
  });

const send = (res: ServerResponse, status: number, contentType: string, body: string, headers: Record<string, string> = {}) => {
  res.statusCode = status;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-cache');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(body);
};

const notFound = (res: ServerResponse, what: string) => send(res, 404, 'text/plain; charset=utf-8', `404 Not Found: ${what}\n`);

const redirect = (res: ServerResponse, location: string) => {
  res.statusCode = 301;
  res.setHeader('Location', location);
  res.end();
};

// Paths Vite itself serves (modules, HMR, deps, files with an extension).
const isViteRequest = (path: string) =>
  /^\/(@|__|node_modules\/|src\/)/.test(path) || /\.[A-Za-z0-9]+$/.test(path);

// The library imports and renders without a DOM, but the site's prerender still
// reads one (the search button's ⌘K label, the heat map's colours from the theme's
// CSS variables), so loading the content in Node needs a DOM. jsdom's globals are
// installed only while content is loaded or rendered, then removed, so Vite's own
// Node code never sees a fake window.
const domKeys = ['window', 'document', 'navigator', 'getComputedStyle', 'HTMLElement', 'Element', 'Node', 'ResizeObserver', 'sessionStorage', 'localStorage', 'MutationObserver', 'CustomEvent', 'Event', 'HTMLCanvasElement', 'SVGElement'] as const;
let domUsers = 0;
let saved: Record<string, PropertyDescriptor | undefined> = {};
let jsdomWindow: any;

export const withDom = async <T>(run: () => Promise<T> | T): Promise<T> => {
  if (domUsers++ === 0) {
    if (!jsdomWindow) {
      const jsdom: string = 'jsdom'; // untyped dev dependency
      const { JSDOM } = await import(/* @vite-ignore */ jsdom);
      jsdomWindow = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' }).window;
      jsdomWindow.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
      jsdomWindow.ResizeObserver ??= class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    }
    saved = {};
    for (const key of domKeys) {
      saved[key] = Object.getOwnPropertyDescriptor(globalThis, key);
      Object.defineProperty(globalThis, key, { value: jsdomWindow[key], configurable: true, writable: true });
    }
    saved.matchMedia = Object.getOwnPropertyDescriptor(globalThis, 'matchMedia');
    Object.defineProperty(globalThis, 'matchMedia', { value: jsdomWindow.matchMedia, configurable: true, writable: true });
  }
  try {
    return await run();
  } finally {
    if (--domUsers === 0) {
      for (const key of [...domKeys, 'matchMedia']) {
        if (saved[key]) Object.defineProperty(globalThis, key, saved[key]!);
        else delete (globalThis as any)[key];
      }
    }
  }
};

const agentExtension = /\.(md|txt|xml)$/;

export const agentPlugin = (options: { origin?: string } = {}): Plugin => ({
  name: 'emkit-agent-endpoints',
  configureServer(server: ViteDevServer) {
    // No return: registered before Vite's own middlewares, so it sees every request first.
    server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
      withDom(() => handle(req, res, next)).catch(next);
    });

    const handle = async (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
      try {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        const url = new URL(req.url ?? '/', 'http://localhost');
        const path = decodeURIComponent(url.pathname);
        const isAgentFile = agentExtension.test(path);
        if (!isAgentFile && isViteRequest(path)) return next();

        const origin = options.origin ?? `http://${req.headers.host ?? 'localhost'}`;
        const pages = (await server.ssrLoadModule('/content/pages.ts')) as typeof import('./content/pages');
        const routes = (await server.ssrLoadModule('/content/routes.ts')) as typeof import('./content/routes');
        const { agentFiles, pageMarkdown } = (await server.ssrLoadModule('/content/llms.ts')) as typeof import('./content/llms');

        if (isAgentFile) {
          const file = agentFiles(origin).find((f) => f.path === path);
          if (file) return send(res, 200, file.contentType, file.body);

          // An old URL's twin: /docs/components/bar.md goes to /docs/components/bar-chart.md.
          if (path.endsWith('.md')) {
            const htmlPath = path === '/index.md' ? '/' : path.slice(0, -3);
            const canonical = routes.canonicalPath(htmlPath);
            if (canonical !== htmlPath && pages.pageForPath(canonical)) {
              return redirect(res, pages.markdownPath(canonical) + url.search);
            }
          }
          return notFound(res, path);
        }

        // An HTML URL: pages, aliases, playgrounds, and anything else.
        const canonical = routes.canonicalPath(path);
        if (canonical !== path && routes.canonicalPath(canonical) === canonical) {
          return redirect(res, canonical + url.search);
        }

        const accept = String(req.headers.accept ?? '');
        res.setHeader('Vary', 'Accept');
        const page = pages.pageForPath(path);
        if (page && accept.includes('text/markdown') && !accept.includes('text/html')) {
          return send(res, 200, 'text/markdown; charset=utf-8', pageMarkdown(page, origin), { Vary: 'Accept' });
        }
        if (pages.isKnownPath(path)) return next();

        // Unknown page: the app shell (it renders its own not-found page) with a real 404.
        const shell = readFileSync(resolve(server.config.root, 'index.html'), 'utf-8');
        const html = await server.transformIndexHtml(req.url ?? path, shell);
        return send(res, 404, 'text/html; charset=utf-8', html);
      } catch (error) {
        if (error instanceof Error) server.ssrFixStacktrace(error);
        next(error);
      }
    };
  },
});
