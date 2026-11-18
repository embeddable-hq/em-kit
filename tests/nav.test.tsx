import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { chartEntries } from '../site/catalog/registry';
import { Layout } from '../site/components/Layout';
import { canonicalPath, componentPath } from '../site/content/routes';
import { docsNav, flatNav } from '../site/content/nav';
import { searchDocs, searchIndex } from '../site/search';
import { isKnownPath } from '../site/content/pages';
import { specificFieldOptions } from '../site/catalog/fieldOptionNotes';
import { componentProps } from '../site/generated/props';
import { guides } from '../site/content/guides';

const paths = docsNav.flatMap((s) => s.links.map((l) => l.path));

describe('sidebar', () => {
  it('has unique, canonical link paths', () => {
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) expect(canonicalPath(path)).toBe(path);
  });

  it('has at most three levels: section, group, link', () => {
    for (const section of docsNav) {
      for (const group of section.groups ?? []) {
        // Groups hold links only: nothing nests below them.
        for (const link of group.links) expect(link).not.toHaveProperty('links');
        expect(group.links.every((l) => section.links.some((s) => s.path === l.path))).toBe(true);
      }
    }
  });

  it('lists getting started, guides, then components with All components first', () => {
    const titles = docsNav.map((s) => s.title);
    expect(titles[titles.length - 1]).toBe('Components');
    expect(titles[0]).toBe('Getting started');
    const components = docsNav[docsNav.length - 1]!;
    expect(components.links[0]!.path).toBe('/docs/components');
    expect(components.groups!.length).toBeGreaterThan(1);
    expect(docsNav.length).toBeLessThanOrEqual(4);
  });

  it('covers every guide and every component once', () => {
    for (const g of guides) expect(paths).toContain(`/docs/${g.slug}`);
    expect(paths.length).toBe(guides.length + 1 + chartEntries.length);
  });

  it('pager order is the flattened sidebar order', () => {
    expect(flatNav.map((l) => l.path)).toEqual(paths);
  });
});

describe('search', () => {
  it('finds a component by export name', () => {
    expect(searchDocs('BarChartStacked')[0]?.path).toBe('/docs/components/bar-chart-stacked');
  });

  it('finds a component by plain words', () => {
    const results = searchDocs('stacked bar').map((r) => r.path);
    expect(results).toContain('/docs/components/bar-chart-stacked');
  });

  it('finds a guide section', () => {
    expect(searchDocs('dark mode').map((r) => r.path)).toContain('/docs/theming#dark');
  });

  it('finds export and csv', () => {
    expect(searchDocs('export').length).toBeGreaterThan(0);
    expect(searchDocs('csv').length).toBeGreaterThan(0);
  });

  it('puts an exact prop name first, on the component that has it', () => {
    const first = searchDocs('xAxisMaxItems')[0]!;
    expect(first.title).toBe('xAxisMaxItems');
    expect(first.kind).toBe('Props');
    expect(first.hint).toBe('Bar chart');
    expect(first.path).toBe('/docs/components/bar-chart#props');
    expect(searchDocs('x axis max items')[0]?.title).toBe('xAxisMaxItems');
  });

  it('finds a field option on the component that reads it, and the common ones in the guide', () => {
    const taken = (e: (typeof chartEntries)[number]) => new Set(componentProps[String(e.exportName)]!.map((p) => p.name));
    const entry = chartEntries.find((e) => specificFieldOptions(String(e.exportName)).some((r) => !taken(e).has(r.option.name)))!;
    const option = specificFieldOptions(String(entry.exportName)).find((r) => !taken(entry).has(r.option.name))!.option.name;
    expect(searchIndex().some((i) => i.title === option && i.path === `${componentPath(entry.id)}#field-options`)).toBe(true);
    expect(searchDocs(option).some((r) => r.title === option && r.kind === 'Props')).toBe(true);
    expect(searchDocs('decimalPlaces')[0]).toMatchObject({ kind: 'Props', path: '/docs/describing-your-data#field-options' });
  });

  it('matches csv on what a page says, not on shared keywords', () => {
    const results = searchDocs('csv');
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThan(9);
    expect(results.some((r) => r.kind === 'Guides')).toBe(true);
    for (const r of results.filter((x) => x.kind === 'Components')) {
      const entry = chartEntries.find((e) => componentPath(e.id) === r.path);
      expect(`${entry?.name} ${entry?.description}`.toLowerCase()).toContain('csv');
    }
  });

  it('leads with the card menu guide for export, csv, excel, xlsx, png and download', () => {
    for (const q of ['export', 'csv', 'excel', 'xlsx', 'png', 'download', 'CSV']) {
      const first = searchDocs(q)[0]!;
      expect(first.path, q).toBe('/docs/card-menu');
      expect(first.kind, q).toBe('Guides');
    }
    // Other queries are not touched by it.
    expect(searchDocs('csv donut')[0]?.path).not.toBe('/docs/card-menu');
  });

  it('finds the export menu from its formats: menuOptions and the guide section, without a flood', () => {
    for (const q of ['csv', 'xlsx', 'png', 'export']) {
      const results = searchDocs(q);
      expect(results.some((r) => r.kind === 'Props' && r.title === 'menuOptions'), q).toBe(true);
      expect(results.filter((r) => r.title === 'menuOptions').length, q).toBeLessThanOrEqual(2);
      expect(results.length, q).toBeLessThan(12);
    }
    // The accessibility section on the menu is still found by a format's name.
    expect(searchDocs('xlsx').some((r) => r.path === '/docs/accessibility#card')).toBe(true);
    // Words every prop's type has are not keywords.
    expect(searchDocs('boolean').filter((r) => r.kind === 'Props')).toHaveLength(0);
  });

  it('finds both donut components', () => {
    const titles = searchDocs('donut')
      .filter((r) => r.kind === 'Components')
      .map((r) => r.title);
    expect(titles).toEqual(expect.arrayContaining(['Donut chart', 'Donut with total']));
  });

  it('finds the dark mode section of the theming guide', () => {
    const hit = searchDocs('dark mode')[0];
    expect(hit?.path).toBe('/docs/theming#dark');
  });

  it('capitalises example titles and names their component', () => {
    const examples = searchDocs('percentages').filter((r) => r.kind === 'Examples');
    expect(examples.length).toBeGreaterThan(0);
    for (const e of examples) {
      expect(e.title.charAt(0)).toBe(e.title.charAt(0).toUpperCase());
      expect(e.hint).toBeTruthy();
    }
  });

  it('caps each group and lists them in a fixed vocabulary', () => {
    const results = searchDocs('title');
    expect(results.filter((r) => r.kind === 'Props').length).toBeLessThanOrEqual(6);
    for (const r of results) expect(['Components', 'Props', 'Examples', 'Guides']).toContain(r.kind);
  });

  it('only links to pages that exist', () => {
    const queries = ['', 'csv', 'donut', 'dark mode', 'xAxisMaxItems', 'granularity', 'prefix', 'chart', 'title', 'export', 'playground', 'example'];
    for (const q of queries) {
      for (const r of searchDocs(q)) expect(isKnownPath(r.path.split('#')[0]!), `${q} -> ${r.path}`).toBe(true);
    }
  });

  it('names a preset once, with its component as the hint', () => {
    const preset = searchDocs('growth').find((r) => r.kind === 'Examples');
    expect(preset).toBeDefined();
    expect(preset!.title.toLowerCase()).not.toContain('bar chart');
    expect(preset!.hint).toBe('Bar chart');
  });

  it('keeps each group together', () => {
    const kinds = searchDocs('chart').map((r) => r.kind);
    const runs = kinds.filter((k, i) => k !== kinds[i - 1]);
    expect(new Set(runs).size).toBe(runs.length);
  });
});

describe('layout chrome', () => {
  it('opens the quick start from Docs and keeps Docs lit on every guide', () => {
    const html = (route: string) => renderToString(<Layout route={route}>x</Layout>);
    expect(html('/docs/theming')).toContain('href="/docs/quick-start"');
    const active = (route: string, href: string) =>
      new RegExp(`<a[^>]*href="${href}"[^>]*aria-current="page"|<a[^>]*aria-current="page"[^>]*href="${href}"`).test(html(route).split('mobile-menu')[0]!);
    expect(active('/docs/theming', '/docs/quick-start')).toBe(true);
    expect(active('/docs/theming', '/docs/components')).toBe(false);
    expect(active('/docs/components/bar-chart', '/docs/components')).toBe(true);
    expect(active('/docs/components/bar-chart', '/docs/quick-start')).toBe(false);
    expect(active('/docs/components', '/docs/components')).toBe(true);
  });

  it('shows three top-level links and marks the current one', () => {
    const html = renderToString(<Layout route="/examples">content</Layout>);
    expect(html).toMatch(/aria-current="page"[^>]*href="\/examples"|href="\/examples"[^>]*aria-current="page"/);
    expect(html).toContain('href="/llms.txt"');
    expect(html).not.toMatch(/gallery/i);
  });

  it('has no nav call to action: Docs already goes to the quick start, and the landing hero has its own', () => {
    expect(renderToString(<Layout route="/">x</Layout>)).not.toContain('nav__cta');
    expect(renderToString(<Layout route="/examples">x</Layout>)).not.toContain('nav__cta');
  });
});

describe('search dialog', () => {
  it('renders through a portal on the body, so no sticky ancestor can trap its overlay', () => {
    const src = readFileSync(join(__dirname, '../site/components/SearchDialog.tsx'), 'utf8');
    expect(src).toContain("createPortal(");
    expect(src).toContain('document.body');
  });
});
