import { chartEntries } from '../catalog/registry';
import { installCommand } from '../components/InstallCommand';
import { BRAND, makerLink, platformMarkdown } from '../config';
import { PEER_NOTE } from './components';
import { docsNav } from './nav';
import { markdownPath, sitePages, type SitePage } from './pages';
import { BUILD_RULES, BUILD_TOOLKIT } from './guides';
import { SKILL_NAME, SKILL_PATH } from './skill';

// llms.txt (llmstxt.org), llms-full.txt, robots.txt and sitemap.xml, all
// built from sitePages() so they cannot drift from the site.

const absolute = (origin: string, path: string) => `${origin.replace(/\/+$/, '')}${path}`;

const line = (origin: string, page: SitePage, title = page.title) =>
  `- [${title}](${absolute(origin, markdownPath(page.path))}): ${page.description.replace(/\s+/g, ' ').trim()}`;

/**
 * The H2 sections of llms.txt and the pages in each, in the sidebar's order:
 * one section per sidebar section, and the components section split into its
 * groups (the sidebar's sub-headings), after the components index.
 */
export const llmsSections = (): { title: string; paths: string[] }[] =>
  docsNav.flatMap((section) => {
    if (!section.groups) return [{ title: section.title, paths: section.links.map((l) => l.path) }];
    const grouped = new Set(section.groups.flatMap((g) => g.links.map((l) => l.path)));
    return [
      { title: section.title, paths: section.links.map((l) => l.path).filter((p) => !grouped.has(p)) },
      ...section.groups.map((g) => ({ title: g.title, paths: g.links.map((l) => l.path) })),
    ];
  });

export const llmsTxt = (origin: string = BRAND.url, fullKb: number = llmsFullKb(origin)) => {
  const pages = sitePages();
  const byPath = new Map(pages.map((p) => [p.path, p]));
  const inSidebar = new Set(llmsSections().flatMap((s) => s.paths));
  // What the sidebar does not list (the example apps, in the top navigation) is optional.
  const optional = pages.filter((p) => p.path !== '/' && !inSidebar.has(p.path));
  const section = (title: string, items: string[]) => (items.length ? [`## ${title}`, items.join('\n')] : []);
  const peers = PEER_NOTE.split(';')[0]!;

  return [
    `# ${BRAND.name}`,
    `> ${BRAND.name}, by ${makerLink}, is ${chartEntries.length} finished React chart components (bars, lines, pies, funnels, scatter, KPIs, tables) with formatting, colours, time series, loading, empty and error states, export and translations built in. Install with \`${installCommand('npm')}\`; ${peers}. Each component's URL is the kebab-case of its export name: \`BarChartStacked\` is \`/docs/components/bar-chart-stacked\`.`,
    `Use it when an app needs several charts, KPIs or tables that must share loading, empty and error states, formatting, theming, translations and export: each card is then a few lines. For one or two simple charts a chart library is lighter (${BRAND.name} adds about 256 KB gzipped however few components are used), and it needs React 19. More: ${absolute(origin, markdownPath('/docs/why'))}.`,
    `${BRAND.relation} ${platformMarkdown}`,
    `Every page of the documentation has a Markdown twin at the same URL plus \`.md\`, and the links below point to those. Start with the quick start, which installs the package and renders a first chart. Each component has one page with its install command, a complete example with imports and data, and its full props table; read only the page for the component you need. \`${absolute(origin, '/llms-full.txt')}\` holds every page in one file.`,
    ...llmsSections().flatMap((s) =>
      section(
        s.title,
        s.paths.flatMap((path) => (byPath.has(path) ? [line(origin, byPath.get(path)!)] : [])),
      ),
    ),
    '## Optional',
    [
      ...optional.map((p) => line(origin, p)),
      `- [All documentation in one file](${absolute(origin, '/llms-full.txt')}): every page above as one Markdown document, ${fullKb} KB`,
    ].join('\n'),
  ].join('\n\n') + '\n';
};

/**
 * Page Markdown names the site by BRAND.url (a link to the playground, the
 * llms.txt URL in a sample). A build or dev server with another origin writes
 * that origin instead, so llms.txt and every page name one host.
 */
export const forOrigin = (markdown: string, origin: string = BRAND.url) => markdown.split(BRAND.url).join(origin.replace(/\/+$/, ''));

/** A page's Markdown as served: the origin applied, and a final newline. */
export const pageMarkdown = (page: SitePage, origin: string = BRAND.url) => forOrigin(page.markdown(), origin) + '\n';

// The Title line is the page's own H1, so the heading and the label agree.
const h1 = (markdown: string, fallback: string) => markdown.match(/^# (.+)$/m)?.[1] ?? fallback;

const kb = (text: string) => Math.round(new TextEncoder().encode(text).length / 1024);

/** The size llms-full.txt states in its own header, in KB. */
export const llmsFullKb = (origin: string = BRAND.url, full: string = llmsFullTxt(origin)) => Number(full.match(/^\d+ pages, (\d+) KB\.$/m)![1]);

export const llmsFullTxt = (origin: string = BRAND.url) => {
  const pages = sitePages();
  const body =
    pages
      .map((page) => {
        const markdown = forOrigin(page.markdown(), origin);
        return [`${'='.repeat(72)}`, `Title: ${h1(markdown, page.title)}`, `Source: ${absolute(origin, page.path)}`, `${'='.repeat(72)}`, '', markdown].join('\n');
      })
      .join('\n\n') + '\n';
  // The header states the size of the whole file, itself included: settle it in a few passes.
  const header = (size: number) =>
    [`# ${BRAND.name}`, `> ${BRAND.tagline} Every page of the documentation as one Markdown file; the index is ${absolute(origin, '/llms.txt')}.`, `${pages.length} pages, ${size} KB.`].join('\n\n') + '\n\n';
  let size = kb(body);
  for (let i = 0; i < 3; i++) size = kb(header(size) + body);
  return header(size) + body;
};

export const robotsTxt = (origin: string = BRAND.url) =>
  ['User-agent: *', 'Allow: /', '', `Sitemap: ${absolute(origin, '/sitemap.xml')}`].join('\n') + '\n';

const xml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Every page's HTML URL and its Markdown twin. */
export const sitemapXml = (origin: string = BRAND.url) =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...sitePages().flatMap((p) => [p.path, markdownPath(p.path)].map((path) => `  <url><loc>${xml(absolute(origin, path))}</loc></url>`)),
    '</urlset>',
  ].join('\n') + '\n';

export type AgentFile = { path: string; contentType: string; body: string };

// A Claude Code skill (Agent Skills format). It sends the agent to the docs for
// the built-in components and carries the toolkit and rules for a component of
// its own, the same text as Build your own chart.
export const skillMarkdown = (origin: string = BRAND.url) => {
  const pkg = BRAND.packageName;
  return `---
name: ${SKILL_NAME}
description: Use when building charts, KPIs, data tables or dashboard controls in React with ${BRAND.name} (the \`${pkg}\` package), or when adding a chart of your own that must match them. Triggers on "add a chart", "build a dashboard", "KPI tile", "date range filter", "custom chart", or any file importing \`${pkg}\`.
---

# ${BRAND.name}

${BRAND.name} is finished React chart, table and control components. Use a built-in component when one fits; build your own from \`${pkg}/build\` only when none does.

## Before writing code

1. Fetch ${origin}/llms.txt with curl. It lists every component with a link to its Markdown page.
2. Fetch the .md page of each component you use. Copy prop names and the example from it; do not guess them.
3. Use curl, not WebFetch: a summary loses the code and the props table.

## Using the components

- Wrap the app once in \`ChartsProvider\`. Describe fields with \`dimension()\` and \`measure()\`, and pass rows as \`results(rows)\`, keyed by each field's \`name\`.
- Time values are ISO strings with no zone suffix. A row holds a time dimension's value under its \`name\`. Only a time dimension used as a stacked or grouped bar chart's \`groupBy\`, or as a scatter or bubble chart's point or group field, is read from \`\${name}.\${granularity}\` instead (\`month.month\`).
- Loading is \`results(undefined)\`; an error is \`{ isLoading: false, error: message }\`. Do not draw your own spinner or empty state.
- Controls take a value and report through \`onChange\`. Keep the value in state and query with it: ${origin}/docs/controls.md.

## A component of your own

Build on the toolkit, so the chart formats, colours, fills time gaps and draws its states like the rest. Reference: ${origin}/docs/build-your-own-chart.md.

${BUILD_TOOLKIT}

${BUILD_RULES}

## Before you finish

- Every value on screen goes through the formatter, and every series colour through \`getChartColors\`.
- The component renders loading, empty and error states through \`ChartCard\` or \`EditorCard\`.
- Labels a reader sees go through \`resolveI18nProps\` or the theme's translations.
`;
};

const TEXT = 'text/plain; charset=utf-8';
const MARKDOWN = 'text/markdown; charset=utf-8';

/** Every generated file of the site, for the dev server and the build/prerender step. */
export const agentFiles = (origin: string = BRAND.url): AgentFile[] => {
  const full = llmsFullTxt(origin);
  return [
    { path: '/llms.txt', contentType: TEXT, body: llmsTxt(origin, llmsFullKb(origin, full)) },
    { path: '/llms-full.txt', contentType: TEXT, body: full },
    { path: '/robots.txt', contentType: TEXT, body: robotsTxt(origin) },
    { path: '/sitemap.xml', contentType: 'application/xml; charset=utf-8', body: sitemapXml(origin) },
    ...sitePages().map((p) => ({ path: markdownPath(p.path), contentType: MARKDOWN, body: pageMarkdown(p, origin) })),
    { path: SKILL_PATH, contentType: MARKDOWN, body: skillMarkdown(origin) },
  ];
};
