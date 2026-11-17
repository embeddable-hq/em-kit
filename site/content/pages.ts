import { chartEntries, getVariant } from '../catalog/registry';
import { installMarkdown } from '../components/InstallCommand';
import { BRAND } from '../config';
import { chatSource, dashboardSource } from './exampleSources';
import { componentPageMarkdown, componentsIndexMarkdown, PEER_NOTE } from './components';
import { guideAliases, guideMarkdown, guides } from './guides';
import { canonicalPath, componentPath, getEntryBySlug } from './routes';

// Every page of the site, once. The sidebar, llms.txt, the sitemap, the
// Markdown twins, the head tags and the prerender step all read this list.

export type SitePage = {
  path: string;
  title: string;
  description: string;
  /** The sidebar section: used to group the page in llms.txt. */
  section: string;
  /** The page as Markdown, served at markdownPath(path). */
  markdown: () => string;
};

const landingMarkdown = () =>
  [
    `# ${BRAND.name}`,
    `> ${BRAND.tagline}`,
    `${BRAND.name} is ${chartEntries.length} finished React chart components: bars, lines, pies, funnels, scatter, KPIs and tables. Describe your data once (dimensions and measures) and each component handles formatting, colours, time series, loading, empty and error states, export and translations. Install \`${BRAND.packageName}\`; ${PEER_NOTE.split(';')[0]}.`,
    '## Install',
    installMarkdown(),
    '## Start here',
    [
      `- [Quick start](/docs/quick-start.md): the first chart on screen`,
      `- [Components](/docs/components.md): every component, grouped by type`,
      `- [Why ${BRAND.name}](/docs/why.md): what it adds over a chart library`,
      `- [Documentation index](/llms.txt): every page, one line each`,
      `- [All documentation in one file](/llms-full.txt)`,
    ].join('\n'),
    `Each page of this site has a Markdown twin at the same URL plus \`.md\`. A component's page is the export name in kebab-case, for example \`BarChartStacked\` is \`/docs/components/bar-chart-stacked\`.`,
  ].join('\n\n');

const examplesMarkdown = () =>
  [
    '# Dashboard example',
    'A complete sales dashboard built only from RKit components: KPIs, a time series, a breakdown by region and a table, sharing one set of filters. This is the whole file; the dashboard runs in the browser at [/examples](/examples).',
    '```tsx title="Dashboard.tsx"\n' + dashboardSource + '\n```',
    'There is a second example, [an AI chat that answers with charts](/examples/ai-chat.md), and a guide to [charts from a model](/docs/charts-from-a-model.md).',
  ].join('\n\n');

const aiChatMarkdown = () =>
  [
    '# AI chat example',
    'A chat where each answer is a chart. The model is given the schema of your data and returns a JSON spec; `ChartFromSpec` turns the spec into a live component, and each click comes back as a sentence to send as the next message. This is the whole message component; the interactive chat is in the browser at [/examples/ai-chat](/examples/ai-chat).',
    '```tsx title="AssistantMessage.tsx"\n' + chatSource + '\n```',
    'See [Charts from a model](/docs/charts-from-a-model.md) for the tool definition, the schema and the prompt, and [the dashboard example](/examples.md) for the other example app.',
  ].join('\n\n');

export const sitePages = (): SitePage[] => [
  {
    path: '/',
    title: `${BRAND.name} · React charts for your own data`,
    description: BRAND.tagline,
    section: 'Home',
    markdown: landingMarkdown,
  },
  ...guides.map((guide) => ({
    path: `/docs/${guide.slug}`,
    title: guide.title,
    description: guide.description,
    section: guide.section as string,
    markdown: () => guideMarkdown(guide),
  })),
  {
    path: '/docs/components',
    title: 'Components',
    description: `All ${chartEntries.length} components, grouped by type, with live previews.`,
    section: 'Components',
    markdown: componentsIndexMarkdown,
  },
  ...chartEntries.map((entry) => ({
    path: componentPath(entry.id),
    title: entry.name,
    description: entry.description,
    section: entry.group as string,
    markdown: () => componentPageMarkdown(entry),
  })),
  {
    path: '/examples',
    title: 'Dashboard example',
    description: 'A complete sales dashboard built from RKit components, with the full source.',
    section: 'Examples',
    markdown: examplesMarkdown,
  },
  {
    path: '/examples/ai-chat',
    title: 'AI chat example',
    description: 'A chat that answers questions with live charts from a JSON spec.',
    section: 'Examples',
    markdown: aiChatMarkdown,
  },
];

/**
 * Where a redirect's Markdown twin goes: the target's `.md`, or for a
 * playground (which has no twin) its component's `.md`.
 */
export const markdownRedirectTarget = (to: string) =>
  markdownPath(to.replace(/\/playground(?:\/[\w-]+)?$/, ''));

/** `/` is `/index.md`; every other page is its path plus `.md`. */
export const markdownPath = (path: string) => (path === '/' ? '/index.md' : `${path}.md`);

export const pageForPath = (path: string) => sitePages().find((p) => p.path === path);

export const pageForMarkdownPath = (mdPath: string) => {
  if (!mdPath.endsWith('.md')) return undefined;
  const path = mdPath === '/index.md' ? '/' : mdPath.slice(0, -3);
  return pageForPath(path);
};

/**
 * Whether a canonical path is a real page of the site: a listed page, or a
 * component's playground (optionally on one of its presets).
 */
export const isKnownPath = (path: string) => {
  if (pageForPath(path)) return true;
  const playground = path.match(/^\/docs\/components\/([\w-]+)\/playground(?:\/([\w-]+))?$/);
  const entry = playground ? getEntryBySlug(playground[1]!) : undefined;
  return Boolean(entry && (!playground![2] || getVariant(entry, playground![2])));
};

// Old URLs that canonicalPath sends somewhere else: the static aliases, the
// old guide slugs, and every component by its old id, export name or display
// name. The static build writes a redirect for each.
export type Redirect = { from: string; to: string };

export const legacyRedirects = (): Redirect[] => {
  const kebab = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const candidates = [
    '/sample-app',
    '/ai',
    '/docs',
    '/charts',
    '/gallery',
    '/components',
    ...Object.keys(guideAliases).map((slug) => `/docs/${slug}`),
    ...chartEntries.flatMap((e) =>
      [e.id, String(e.exportName).toLowerCase(), kebab(e.name)].flatMap((alias) => [`/docs/components/${alias}`, `/charts/${alias}`]),
    ),
    // The old playground URL of each preset: /charts/bar/monthly.
    ...chartEntries.flatMap((e) => (e.variants ?? []).map((variant) => `/charts/${e.id}/${variant.id}`)),
  ];
  const seen = new Set<string>();
  return candidates.flatMap((from) => {
    const to = canonicalPath(from);
    if (to === from || seen.has(from) || !pageForPath(to) && !isKnownPath(to)) return [];
    seen.add(from);
    return [{ from, to }];
  });
};
