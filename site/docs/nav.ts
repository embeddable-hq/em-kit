import { chartEntries, chartGroups } from '../catalog/registry';
import { guides, headingId } from './guides';

// The docs sidebar and the ⌘K search index, both built from the guides and
// the chart registry, so a new guide or component shows up in both.

export type NavLink = { title: string; path: string };
export type NavSection = { title: string; links: NavLink[] };

export const componentPath = (id: string) => `/docs/components/${id}`;

export const docsNav: NavSection[] = [
  ...(['Getting started', 'Guides'] as const).map((section) => ({
    title: section,
    links: guides.filter((g) => g.section === section).map((g) => ({ title: g.title, path: `/docs/${g.slug}` })),
  })),
  { title: 'Components', links: [{ title: 'All components', path: '/docs/components' }] },
  ...chartGroups.map((group) => ({
    title: group,
    links: chartEntries.filter((e) => e.group === group).map((e) => ({ title: e.name, path: componentPath(e.id) })),
  })),
];

export type SearchItem = {
  title: string;
  path: string;
  group: string;
  /** Extra text matched by the search but not shown. */
  keywords: string;
  hint?: string;
};

export const searchIndex: SearchItem[] = [
  ...guides.flatMap((g) => [
    { title: g.title, path: `/docs/${g.slug}`, group: g.section, keywords: g.description, hint: g.description },
    ...g.blocks
      .filter((b): b is { h2: string; id?: string } => 'h2' in b)
      .map((b) => ({
        title: b.h2,
        path: `/docs/${g.slug}#${headingId(b)}`,
        group: g.title,
        keywords: '',
        hint: g.title,
      })),
  ]),
  ...chartEntries.flatMap((e) => [
    {
      title: e.name,
      path: componentPath(e.id),
      group: 'Components',
      keywords: `${String(e.exportName)} ${e.group} ${e.description}`,
      hint: `<${String(e.exportName)} />`,
    },
    ...(e.variants ?? []).map((v) => ({
      title: `${e.name}: ${v.name}`,
      path: `${componentPath(e.id)}#${v.id}`,
      group: 'Examples',
      keywords: `${String(e.exportName)} ${v.description}`,
      hint: v.description,
    })),
  ]),
  { title: 'Chart gallery', path: '/charts', group: 'Pages', keywords: 'all charts playground', hint: 'Every chart, live' },
  { title: 'Dashboard example', path: '/examples', group: 'Pages', keywords: 'cross filter app', hint: 'A complete app' },
  { title: 'AI chat example', path: '/examples/ai-chat', group: 'Pages', keywords: 'llm model spec', hint: 'A complete app' },
];

// Every word of the query must appear somewhere in the item; title matches rank first.
export const searchDocs = (query: string): SearchItem[] => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return searchIndex.filter((i) => i.group !== 'Examples' && !i.path.includes('#'));
  const scored = searchIndex
    .map((item) => {
      const title = item.title.toLowerCase();
      const haystack = `${title} ${item.keywords.toLowerCase()} ${item.group.toLowerCase()}`;
      if (!words.every((w) => haystack.includes(w))) return null;
      const score = words.reduce((s, w) => s + (title.startsWith(w) ? 3 : title.includes(w) ? 2 : 0), 0);
      return { item, score };
    })
    .filter((x): x is { item: SearchItem; score: number } => x !== null)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, 30).map((x) => x.item);
};
