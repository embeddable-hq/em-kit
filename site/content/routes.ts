import { ChartEntry, chartEntries } from '../catalog/registry';
import { guideAliases } from './guides';

// Every URL on the site, in one place. A component's page lives at the
// kebab-case of its export name (BarChartStacked → /docs/components/bar-chart-stacked),
// so the URL can be worked out from the import. Older URLs redirect.

const kebab = (name: string) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .toLowerCase();

export const componentSlug = (entry: ChartEntry) => kebab(String(entry.exportName));

const slugById = new Map(chartEntries.map((e) => [e.id, componentSlug(e)]));
const entryBySlug = new Map(chartEntries.map((e) => [componentSlug(e), e]));

// Other names a component might be asked for by: its old id, its export name
// and its display name.
const slugByAlias = new Map<string, string>(
  chartEntries.flatMap((e) => {
    const slug = componentSlug(e);
    return [e.id, String(e.exportName).toLowerCase(), kebab(e.name)].map((alias) => [alias, slug] as [string, string]);
  }),
);

export const componentPath = (id: string) => `/docs/components/${slugById.get(id) ?? id}`;

export const playgroundPath = (id: string, variantId?: string) =>
  `${componentPath(id)}/playground${variantId ? `/${variantId}` : ''}`;

export const getEntryBySlug = (slug: string) => entryBySlug.get(slug);

const staticAliases: Record<string, string> = {
  '/sample-app': '/examples',
  '/ai': '/examples/ai-chat',
  '/docs': '/docs/quick-start',
  '/charts': '/docs/components',
  '/gallery': '/docs/components',
  '/components': '/docs/components',
};

/** The one URL a page lives at: trailing slashes dropped, old URLs mapped to new. */
export const canonicalPath = (path: string): string => {
  const trimmed = path.replace(/\/+$/, '') || '/';
  if (staticAliases[trimmed]) return staticAliases[trimmed];

  // /charts/bar/monthly was the playground before it moved under the component.
  const chart = trimmed.match(/^\/charts\/([\w-]+)(?:\/([\w-]+))?$/);
  if (chart && slugByAlias.has(chart[1]!.toLowerCase())) {
    return `/docs/components/${slugByAlias.get(chart[1]!.toLowerCase())}/playground${chart[2] ? `/${chart[2]}` : ''}`;
  }

  const component = trimmed.match(/^\/docs\/components\/([\w-]+)(\/playground(?:\/[\w-]+)?)?$/);
  if (component && !entryBySlug.has(component[1]!)) {
    const slug = slugByAlias.get(component[1]!.toLowerCase());
    if (slug) return `/docs/components/${slug}${component[2] ?? ''}`;
  }

  const guide = trimmed.match(/^\/docs\/([\w-]+)$/);
  if (guide && guideAliases[guide[1]!]) return `/docs/${guideAliases[guide[1]!]}`;

  return trimmed;
};
