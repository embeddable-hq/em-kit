import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import * as library from '../src';
import * as aiExports from '../src/ai';
import * as buildExports from '../src/build';
import { chartEntries } from '../site/catalog/registry';
import { BRAND } from '../site/config';
import { agentFiles, forOrigin, llmsFullTxt, llmsTxt, robotsTxt, sitemapXml } from '../site/content/llms';
import { docsNav } from '../site/content/nav';
import { markdownAnchor } from '../site/content/guides';
import { markdownPath, pageForMarkdownPath, sitePages } from '../site/content/pages';
import { canonicalPath, componentPath } from '../site/content/routes';
import { headFor, headTags } from '../site/head';

const ORIGIN = 'https://example.test';
const pages = sitePages();
const llms = llmsTxt(ORIGIN);
const lines = llms.split('\n');
const links = [...llms.matchAll(/^- \[([^\]]+)\]\(([^)]+)\): (.+)$/gm)];

describe('llms.txt structure', () => {
  it('starts with an H1 then a blockquote', () => {
    expect(lines[0]).toBe(`# ${BRAND.name}`);
    expect(lines.findIndex((l) => l.startsWith('> '))).toBe(2);
  });

  it('has only H1 and H2 headings, and ends with ## Optional', () => {
    const headings = lines.filter((l) => l.startsWith('#'));
    expect(headings.filter((h) => h.startsWith('# '))).toHaveLength(1);
    expect(headings.every((h) => /^#{1,2} /.test(h))).toBe(true);
    expect(headings.at(-1)).toBe('## Optional');
  });

  it('every list line is "- [title](url): description"', () => {
    const list = lines.filter((l) => l.startsWith('- '));
    expect(list.length).toBeGreaterThan(30);
    for (const l of list) expect(l).toMatch(/^- \[[^\]]+\]\(https:\/\/example\.test\/[^)]*\): \S.*$/);
  });

  it('sections mirror the sidebar: the same sections in order, each with the same pages in order', () => {
    const twin = (url: string) => new URL(url).pathname.replace(/\.md$/, '');
    const sections = llms
      .split(/^## /m)
      .slice(1)
      .map((block) => ({ title: block.split('\n')[0]!, paths: [...block.matchAll(/^- \[[^\]]+\]\(([^)]+)\)/gm)].map((m) => twin(m[1]!)) }));
    // The sidebar, section by section; the components section's sub-headings are sections of their own.
    const sidebar = docsNav.flatMap((section) => {
      const grouped = new Set((section.groups ?? []).flatMap((g) => g.links.map((l) => l.path)));
      return [
        { title: section.title, paths: section.links.map((l) => l.path).filter((p) => !grouped.has(p)) },
        ...(section.groups ?? []).map((g) => ({ title: g.title, paths: g.links.map((l) => l.path) })),
      ];
    });
    expect(sections.slice(0, -1)).toEqual(sidebar);
    // Optional: what the sidebar does not list (the example apps), and the whole set in one file.
    expect(sections.at(-1)).toEqual({ title: 'Optional', paths: ['/examples', '/examples/ai-chat', '/llms-full.txt'] });
    expect(sidebar.find((s) => s.title === 'Getting started')!.paths).toContain('/docs/why');
    expect(sidebar.find((s) => s.title === 'Guides')!.paths).toContain('/docs/build-your-own-chart');
  });
});

describe('llms.txt links', () => {
  it('links are all .md twins of a known page with real Markdown', () => {
    for (const [, , url] of links) {
      const path = new URL(url!).pathname;
      if (path === '/llms-full.txt') continue;
      const page = pageForMarkdownPath(path);
      expect(page, `${url} maps to a page`).toBeDefined();
      const md = page!.markdown();
      expect(md.length, url).toBeGreaterThan(40);
      expect(md.startsWith('# '), `${url} starts with an H1`).toBe(true);
      expect(md, url).not.toMatch(/<!doctype/i);
      // Code samples may contain JSX; page markup outside code fences is a leak.
      expect(md.replace(/```[\s\S]*?```/g, ''), url).not.toContain('<div');
      expect(md, url).not.toContain('…');
      expect(md, url).not.toMatch(/\btitles\./);
      // A template's leftover, not the word as code: payload types say `undefined`.
      expect(md.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, ''), url).not.toContain('undefined');
    }
  });

  it('every page of the site is listed', () => {
    // The landing page is the overview; llms.txt itself is the index.
    for (const page of pages.filter((p) => p.path !== '/')) expect(llms, page.path).toContain(`(${ORIGIN}${markdownPath(page.path)})`);
  });

  it('every sidebar page is a site page and in llms.txt', () => {
    const paths = new Set(pages.map((p) => p.path));
    for (const link of docsNav.flatMap((s) => s.links)) {
      expect(paths.has(link.path), link.path).toBe(true);
      expect(llms, link.path).toContain(`${ORIGIN}${markdownPath(link.path)}`);
    }
  });
});

describe('component Markdown is self-contained', () => {
  for (const entry of chartEntries) {
    it(`${entry.name}`, () => {
      const md = pages.find((p) => p.path === componentPath(entry.id))!.markdown();
      expect(md).toMatch(/npm install|pnpm add|yarn add|bun add/);
      expect(md).toMatch(new RegExp(`import \\{[^}]*\\b${String(entry.exportName)}\\b[^}]*\\} from`));
      expect(md).toContain('```');
      expect(md).toMatch(/\n\|[^\n]*\|\n\|[\s:|-]+\|/);
    });
  }
});

describe('llms-full.txt, sitemap and robots', () => {
  const full = llmsFullTxt(ORIGIN);
  it('holds every page, with its title and source URL', () => {
    for (const page of pages) {
      expect(full).toContain(`Title: ${page.markdown().match(/^# (.+)$/m)![1]}`);
      expect(full).toContain(`Source: ${ORIGIN}${page.path}`);
    }
  });

  it('sitemap lists every page and its .md twin', () => {
    const xml = sitemapXml(ORIGIN);
    for (const page of pages) {
      expect(xml).toContain(`<loc>${ORIGIN}${page.path}</loc>`);
      expect(xml).toContain(`<loc>${ORIGIN}${markdownPath(page.path)}</loc>`);
    }
  });

  it('robots.txt allows all and names the sitemap', () => {
    expect(robotsTxt(ORIGIN)).toMatch(/User-agent: \*\nAllow: \//);
    expect(robotsTxt(ORIGIN)).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  });

  it('agentFiles has every generated file once', () => {
    const paths = agentFiles(ORIGIN).map((f) => f.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toEqual(expect.arrayContaining(['/llms.txt', '/llms-full.txt', '/robots.txt', '/sitemap.xml', '/index.md']));
    expect(paths.filter((p) => p.endsWith('.md'))).toHaveLength(pages.length);
  });
});

describe('pages and head tags', () => {
  it('paths are canonical and unique, and markdown paths round-trip', () => {
    expect(new Set(pages.map((p) => p.path)).size).toBe(pages.length);
    for (const page of pages) {
      expect(canonicalPath(page.path)).toBe(page.path);
      expect(pageForMarkdownPath(markdownPath(page.path))?.path).toBe(page.path);
    }
    expect(markdownPath('/')).toBe('/index.md');
  });

  it('headFor gives every page a unique title and a description', () => {
    const titles = pages.map((p) => headFor(p.path).title);
    expect(new Set(titles).size).toBe(titles.length);
    for (const page of pages) {
      const head = headFor(page.path);
      expect(head.description.length, page.path).toBeGreaterThan(10);
      expect(head.canonical).toBe(`${BRAND.url}${page.path}`);
      expect(head.markdown).toBe(`${BRAND.url}${markdownPath(page.path)}`);
      expect(head.ogUrl).toBe(head.canonical);
    }
    expect(headFor('/docs/quick-start').title).toBe('Quick start · RKit');
  });

  it('every page has the social card and a twitter:card, and no title names the site twice', () => {
    for (const page of pages) {
      const head = headFor(page.path);
      const tags = headTags(head);
      expect(tags, page.path).toContain(`<meta property="og:image" content="${BRAND.url}/og.png" />`);
      expect(tags, page.path).toContain('<meta property="og:image:width" content="1200" />');
      expect(tags, page.path).toContain('<meta name="twitter:card" content="summary_large_image" />');
      expect(head.title.split(BRAND.name).length - 1, head.title).toBe(1);
    }
    expect(headFor('/docs/why').title).toBe(`Why ${BRAND.name}`);
    // The card is a 1200 × 630 PNG, as the tags say.
    const png = readFileSync(join(__dirname, '../site/public/og.png'));
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  });
});

describe('llms-full.txt header and titles', () => {
  const full = llmsFullTxt(ORIGIN);
  const [h1, quote, count] = full.split('\n\n');

  it('opens with the H1, the blockquote and one line with the page count and size', () => {
    expect(h1).toBe(`# ${BRAND.name}`);
    expect(quote).toMatch(/^> \S/);
    expect(count).toMatch(new RegExp(`^${pages.length} pages, \\d+ KB\\.$`));
  });

  it('states its own size to the kilobyte', () => {
    const stated = Number(count!.match(/(\d+) KB/)![1]);
    expect(Math.abs(stated - new TextEncoder().encode(full).length / 1024)).toBeLessThanOrEqual(1);
  });

  it('the Title of each page is the H1 of its Markdown', () => {
    for (const page of pages) {
      const heading = page.markdown().match(/^# (.+)$/m)![1];
      expect(full, page.path).toContain(`Title: ${heading}\nSource: ${ORIGIN}${page.path}\n`);
    }
  });
});

describe('absolute URLs take the origin of llms.txt', () => {
  it('no page, twin or llms-full names the default host when another origin is built', () => {
    for (const file of agentFiles(ORIGIN)) {
      if (file.path === '/sitemap.xml') continue;
      expect(file.body, file.path).not.toContain(BRAND.url);
    }
  });

  it('forOrigin swaps only the host', () => {
    expect(forOrigin(`see ${BRAND.url}/docs/ai.md`, `${ORIGIN}/`)).toBe(`see ${ORIGIN}/docs/ai.md`);
  });

  it('the Markdown of the use-with-AI page names the same host as llms.txt', () => {
    const twin = agentFiles(ORIGIN).find((f) => f.path === '/docs/ai.md')!;
    expect(twin.body).toContain(`${ORIGIN}/llms.txt`);
  });
});

// An identifier in backticks that looks like a package export has to be one:
// `chartFromSpec` for `ChartFromSpec` sent agents to a name that does not exist.
describe('identifiers in the Markdown are package exports', () => {
  const root = join(__dirname, '..');
  // Types are erased at runtime, so read the names the three entry points export.
  const typeNames = ['src/index.ts', 'src/ai/index.ts', 'src/build/index.ts'].flatMap((file) => {
    const source = ts.createSourceFile(file, readFileSync(join(root, file), 'utf8'), ts.ScriptTarget.ES2022);
    return source.statements.flatMap((node) =>
      ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause) ? node.exportClause.elements.map((e) => e.name.text) : [],
    );
  });
  const exported = new Set([...Object.keys(library), ...Object.keys(aiExports), ...Object.keys(buildExports), ...typeNames]);
  // A name the page's own samples declare (`RevenueChart` in the quick start) is its own.
  const declaredIn = (markdown: string) =>
    new Set([...markdown.matchAll(/```[\s\S]*?```/g)].flatMap(([block]) => [...block.matchAll(/\b(?:function|const|class|type) ([A-Z]\w*)/g)].map((m) => m[1]!)));

  // PascalCase names the pages use that the package does not export: React and
  // Chart.js types, and the local names of the samples.
  const notExports = new Set(['ReactNode', 'ChartOptions', 'ChartJS', 'ChartCard', 'EditorCard']);
  const identifiers = (markdown: string) => [...markdown.replace(/```[\s\S]*?```/g, '').matchAll(/`([A-Za-z_]\w*)`/g)].map((m) => m[1]!);

  it('reads the exports', () => {
    expect(exported.has('ChartFromSpec')).toBe(true);
    expect(exported.has('ChartSpec')).toBe(true);
    expect(exported.size).toBeGreaterThan(100);
  });

  // The slip that was made: a component name with its first letter lowered.
  it.each(pages.map((p) => [p.path, p] as const))('%s: no export with its first letter in lower case', (_, page) => {
    const slips = identifiers(page.markdown()).filter((id) => /^[a-z]+[A-Z]/.test(id) && !exported.has(id) && exported.has(id[0]!.toUpperCase() + id.slice(1)));
    expect(slips).toEqual([]);
  });

  it.each(pages.filter((p) => p.path.startsWith('/docs/') && !p.path.startsWith('/docs/components')).map((p) => [p.path, p] as const))(
    '%s: every PascalCase name is an export',
    (_, page) => {
      const own = declaredIn(page.markdown());
      const missing = identifiers(page.markdown()).filter((id) => /^[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)+$/.test(id) && !exported.has(id) && !notExports.has(id) && !own.has(id));
      expect(missing).toEqual([]);
    },
  );
});

// A link with a fragment has to land on a heading of the twin it points at.
describe('fragments in the Markdown', () => {
  const headings = (markdown: string) =>
    new Set([...markdown.replace(/```[\s\S]*?```/g, '').matchAll(/^#{1,6} (.+)$/gm)].map((m) => markdownAnchor(m[1]!)));
  const byPath = new Map(pages.map((p) => [p.path, headings(p.markdown())]));

  it('every #fragment in a page, in llms.txt and in llms-full.txt matches a heading of its target', () => {
    const problems: string[] = [];
    for (const page of pages) {
      for (const [, target, fragment] of page.markdown().replace(/```[\s\S]*?```/g, '').matchAll(/\]\(([^)#\s]*)#([^)\s]+)\)/g)) {
        const path = target!.startsWith('http') ? new URL(target!).pathname : target || page.path;
        const twin = path === '/index.md' ? '/' : path.replace(/\.md$/, '');
        if (!byPath.has(twin)) {
          problems.push(`${page.path}: ${target}#${fragment} points at no page`);
        } else if (!byPath.get(twin)!.has(fragment!)) {
          problems.push(`${page.path}: ${target}#${fragment} matches no heading in ${twin}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('the home page link from "Why" goes to the landing twin, with no fragment', () => {
    const why = sitePages().find((p) => p.path === '/docs/why')!.markdown();
    expect(why).toContain('](/index.md)');
    expect(why).not.toContain('#lp-compare');
  });
});

describe('the example twins carry the source', () => {
  const md = (path: string) => pages.find((p) => p.path === path)!.markdown();

  it('/examples.md has the whole Dashboard module, in the full file too', () => {
    const source = readFileSync(join(__dirname, '../site/examples/Dashboard.tsx'), 'utf8').replace(/from '\.\.\/\.\.\/src'/g, `from '${BRAND.packageName}'`).trim();
    expect(md('/examples')).toContain(source);
    expect(llmsFullTxt(ORIGIN)).toContain(source);
    expect(md('/examples')).toContain('export function Dashboard');
  });

  it('/examples/ai-chat.md has the message component and names real exports', () => {
    expect(md('/examples/ai-chat')).toContain('export function AssistantMessage');
    expect(md('/examples/ai-chat')).toContain('`ChartFromSpec`');
    expect(md('/examples/ai-chat')).not.toContain('chartFromSpec');
  });
});
