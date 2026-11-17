import { chartEntries, chartGroups } from '../catalog/registry';
import { guides } from './guides';
import { componentPath } from './routes';

// The docs sidebar, built from the guides and the chart registry, so a new
// guide or component shows up in it. The ⌘K search index (site/search.ts) is
// built from the same two, but only when the dialog first opens.

export type NavLink = { title: string; path: string };
/** A nested sub-heading inside a section (the component types). */
export type NavGroup = { title: string; links: NavLink[] };
/**
 * `links` is every page in the section, in reading order. `groups` says how
 * some of those links nest under sub-headings; the rest sit directly under
 * the section title. Sidebar depth: section, group, link.
 */
export type NavSection = { title: string; links: NavLink[]; groups?: NavGroup[] };

export { componentPath };

const guideSections = [...new Set(guides.map((g) => g.section as string))];

const componentGroups: NavGroup[] = chartGroups.map((group) => ({
  title: group,
  links: chartEntries.filter((e) => e.group === group).map((e) => ({ title: e.name, path: componentPath(e.id) })),
}));
const allComponentsLink: NavLink = { title: 'All components', path: '/docs/components' };

export const docsNav: NavSection[] = [
  ...guideSections.map((section) => ({
    title: section,
    links: guides.filter((g) => g.section === section).map((g) => ({ title: g.title, path: `/docs/${g.slug}` })),
  })),
  {
    title: 'Components',
    links: [allComponentsLink, ...componentGroups.flatMap((g) => g.links)],
    groups: componentGroups,
  },
];

/** Every docs page in sidebar order: the order of the previous and next links. */
export const flatNav: NavLink[] = docsNav.flatMap((s) => s.links);
