import { BRAND } from '../site/config';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPage, pageSource } from '../site/App';
import { applyHead, headFor } from '../site/head';
import { legacyRedirects, markdownRedirectTarget, sitePages } from '../site/content/pages';
import { canonicalPath } from '../site/content/routes';
import { renderRoute } from '../site/prerender';

// The static build's page HTML: the real content is in the server render and
// the head is the page's own. (npm run site:check runs the same over every page.)
const template =
  '<!doctype html><html><head><title>EmKit · default</title><meta name="description" content="x" /><meta property="og:title" content="x" /></head><body><div id="root"></div></body></html>';
const render = (path: string) => applyHead(template, headFor(path)).replace('<div id="root"></div>', `<div id="root">${renderRoute(path)}</div>`);
const text = (html: string) => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ');

describe('prerendered pages', () => {
  it.each(['/', '/docs/quick-start', '/docs/components', '/docs/components/bar-chart'])('%s has its content and head', (path) => {
    const html = render(path);
    expect((html.match(/<h1[\s>]/g) ?? []).length).toBe(1);
    expect(html).toContain(`<link rel="canonical" href="${headFor(path).canonical}" />`);
    expect(html).toMatch(/<link rel="alternate" type="text\/markdown" href="[^"]+\.md" \/>/);
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html.match(/name="description"/g)).toHaveLength(1);
    expect(html).toContain('property="og:url"');
  });

  it.each(['/', '/docs/quick-start'])('%s has every package manager’s install command in the HTML', (path) => {
    const body = text(render(path));
    for (const command of ['npm install', 'pnpm add', 'yarn add', 'bun add']) expect(body, command).toContain(`${command} ${BRAND.packageName}`);
  });

  it('install tabs follow the tabs pattern, and hide inactive panels without removing them', () => {
    const html = render('/docs/quick-start');
    expect(html.match(/role="tablist"/g)).toHaveLength(1);
    const tabs = [...html.matchAll(/<button[^>]*role="tab"[^>]*>/g)].map((m) => m[0]);
    expect(tabs).toHaveLength(4);
    expect(tabs.filter((t) => t.includes('aria-selected="true"'))).toHaveLength(1);
    expect(tabs.filter((t) => t.includes('tabindex="-1"'))).toHaveLength(3);
    const panels = [...html.matchAll(/<div[^>]*role="tabpanel"[^>]*>/g)].map((m) => m[0]);
    expect(panels).toHaveLength(4);
    expect(panels.filter((p) => /\shidden(=|\s|>)/.test(p))).toHaveLength(3);
    // Each tab controls the panel that names it back.
    for (const tab of tabs) {
      const controls = tab.match(/aria-controls="([^"]+)"/)![1];
      const id = tab.match(/\sid="([^"]+)"/)![1];
      expect(panels.some((p) => p.includes(`id="${controls}"`) && p.includes(`aria-labelledby="${id}"`))).toBe(true);
    }
  });

  it('the not-found page says noindex and has no canonical or Markdown twin', () => {
    const html = render('/not-found');
    expect(html).toContain('<meta name="robots" content="noindex" />');
    expect(html).not.toContain('rel="alternate"');
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain('property="og:url"');
    expect(render('/docs/quick-start')).not.toContain('noindex');
  });

  it('a component page links to install and includes its props and usage code', () => {
    const body = text(render('/docs/components/bar-chart'));
    // Install is on the quick start, once; the component page links to it (its Markdown twin carries the command).
    expect(render('/docs/components/bar-chart')).toContain('href="/docs/quick-start"');
    expect(body).toContain('onBarClicked');
    expect(body).toContain("import { ChartsProvider, BarChart");
  });

  it('old URLs are redirected to pages that exist', () => {
    const paths = new Set(sitePages().map((p) => p.path));
    const redirects = legacyRedirects();
    expect(redirects.length).toBeGreaterThan(10);
    for (const { from, to } of redirects) {
      expect(canonicalPath(from)).toBe(to);
      expect(from === to).toBe(false);
      expect(paths.has(to) || to.includes('/playground'), to).toBe(true);
      // The Markdown redirect lands on a twin that exists: a playground has none, so its component's.
      expect(paths.has(markdownRedirectTarget(to).replace(/\.md$/, '').replace(/^\/index$/, '/')), markdownRedirectTarget(to)).toBe(true);
    }
    expect(redirects).toContainEqual({ from: '/docs/components/bar', to: '/docs/components/bar-chart' });
  });
});

// Each page is a chunk of its own (site/App.tsx): the browser loads the page it
// is on, and the static build preloads that page's chunk from its HTML.
describe('code splitting', () => {
  it.each([
    ['/', 'pages/Landing.tsx'],
    ['/docs/quick-start', 'pages/DocPage.tsx'],
    ['/docs/components', 'pages/ComponentsIndex.tsx'],
    ['/docs/components/bar-chart', 'pages/ComponentDocPage.tsx'],
    ['/docs/components/bar-chart/playground', 'pages/ChartPage.tsx'],
    ['/docs/components/bar-chart/playground/monthly', 'pages/ChartPage.tsx'],
    ['/examples', 'pages/Examples.tsx'],
    ['/examples/ai-chat', 'pages/Examples.tsx'],
  ])('%s is the chunk of %s', (route, source) => {
    expect(pageSource(route)).toBe(source);
    expect(existsSync(join(__dirname, '../site', source))).toBe(true);
  });

  it('the not-found page is in the entry, with nothing to load', () => {
    expect(pageSource('/no-such-page')).toBeUndefined();
    expect(pageSource('/examples/no-such-example')).toBeUndefined();
    expect(loadPage('/no-such-page')).toBeUndefined();
  });

  it('the prerender has every page loaded, so it renders the page, not a loading state', () => {
    for (const route of ['/', '/docs/quick-start', '/docs/components', '/docs/components/bar-chart', '/examples']) {
      expect(loadPage(route), route).toBeUndefined();
    }
    const html = render('/docs/components/bar-chart/playground');
    expect(html).not.toContain('Loading…');
    expect((html.match(/<h1[\s>]/g) ?? []).length).toBe(1);
    expect(text(html)).toContain('Bar chart playground');
    expect(text(html)).toContain('onBarClicked');
    expect(text(render('/examples/ai-chat'))).toContain('Try your own spec');
  });

  // The export libraries are most of the package's weight and only a click on
  // a chart's export menu needs them, so they load then (scripts/sync.mjs
  // rewrites the upstream file to do this; site:check asserts no page loads them).
  it('xlsx and dom-to-image-more are imported only when an export runs', () => {
    const source = readFileSync(join(__dirname, '../src/generated/theme/utils/export.utils.ts'), 'utf-8');
    expect(source).not.toMatch(/^import [^;]* from '(xlsx|dom-to-image-more)';/m);
    expect(source).toContain("await import('xlsx')");
    expect(source).toContain("await import('dom-to-image-more')");
  });
});

// Vercel reads vercel.json, not the _headers and _redirects files the build
// writes for other hosts: it must name the site build and the folder it fills,
// and repeat the content types (a .md is Markdown, not a download).
describe('hosting on Vercel', () => {
  const read = (file: string) => JSON.parse(readFileSync(join(process.cwd(), file), 'utf-8'));
  const vercel = read('vercel.json') as { buildCommand: string; outputDirectory: string; headers: { source: string; headers: { key: string; value: string }[] }[] };

  it('runs the site build, and serves the folder it writes', () => {
    const script = vercel.buildCommand.replace(/^npm run /, '');
    expect(read('package.json').scripts[script]).toContain('site-build.mjs');
    expect(vercel.outputDirectory).toBe('dist-site');
  });

  it('serves Markdown twins and the agent files as text in UTF-8', () => {
    const typeFor = (source: string) => vercel.headers.find((rule) => rule.source === source)?.headers.find((h) => h.key === 'Content-Type')?.value;
    expect(typeFor('/(.*).md')).toBe('text/markdown; charset=utf-8');
    expect(typeFor('/(llms|llms-full|robots).txt')).toBe('text/plain; charset=utf-8');
    expect(typeFor('/sitemap.xml')).toBe('application/xml; charset=utf-8');
  });
});
