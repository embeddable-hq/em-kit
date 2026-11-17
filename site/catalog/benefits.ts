import {
  IconClick,
  IconCurrencyDollar,
  IconDownload,
  IconLanguage,
  IconLoader,
  IconPalette,
  IconTable,
  IconTimeline,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';

// What every component already does, as the landing page tells it: the
// reason to use this rather than a chart library. Each item says exactly what
// is handled, in a sentence or two, and is only listed if the page proves it:
// `proof` is the place on the landing page where the visitor can see or try
// it, and is the item's one link. `path` is the guide that documents it; the
// landing does not link it (the docs do). The comparison with a chart
// library, need by need and in code, is on /docs/why.

export type Benefit = {
  title: string;
  text: string;
  /** Where on the landing page it can be seen: an anchor on the page, the link's words, and which way it is. */
  proof: { href: string; label: string; direction: 'above' | 'below' };
  /** The guide that documents it. */
  path: string;
  guide: string;
  icon: ComponentType<{ size?: number; stroke?: number; 'aria-hidden'?: boolean }>;
};

export const benefits: Benefit[] = [
  {
    title: 'Formatting',
    text: 'Set a currency, a prefix, decimals or compact numbers once on a field. Axis ticks, value labels, tooltips and exports all follow, in the reader’s locale.',
    proof: { href: '#live-card', label: 'Hover a bar on the card below', direction: 'below' },
    path: '/docs/describing-your-data',
    guide: 'Describing your data',
    icon: IconCurrencyDollar,
  },
  {
    title: 'Colours and themes',
    text: 'One theme object sets the colours, fonts, corner radius and spacing of every component. A value such as “Enterprise” keeps its colour from one chart to the next.',
    proof: { href: '#charts', label: 'Try the themes above', direction: 'above' },
    path: '/docs/theming',
    guide: 'Theming',
    icon: IconPalette,
  },
  {
    title: 'Time series',
    text: 'Dates are labelled for their granularity, and periods missing from your rows are added, so a gap shows as a gap. A picker in the card switches between weeks, months and quarters.',
    proof: { href: '#time-series', label: 'In the area chart above', direction: 'above' },
    path: '/docs/time-series',
    guide: 'Time series',
    icon: IconTimeline,
  },
  {
    title: 'Loading, empty and error states',
    text: 'Every card draws its own skeleton, empty state and error message from the one `results` prop, so you design none of them.',
    proof: { href: '#states', label: 'Try them on the card below', direction: 'below' },
    path: '/docs/loading-empty-and-errors',
    guide: 'Loading, empty and errors',
    icon: IconLoader,
  },
  {
    title: 'Export',
    text: 'The menu in each card’s corner downloads its data as CSV or Excel, saves the chart as a PNG and opens it full screen.',
    proof: { href: '#live-card', label: 'Open the menu on the card below', direction: 'below' },
    path: '/docs/tables',
    guide: 'Tables',
    icon: IconDownload,
  },
  {
    title: 'Translations',
    text: 'Titles, field names, values, dates and numbers follow the provider’s language. English, German and French are built in, and you can add your own.',
    proof: { href: '#charts', label: 'Try DE or FR above', direction: 'above' },
    path: '/docs/localisation',
    guide: 'Localisation',
    icon: IconLanguage,
  },
  {
    title: 'Click events',
    text: 'A click hands your handler the value or the period that was clicked, typed, ready to use as a filter.',
    proof: { href: '#clicks', label: 'Click a bar below', direction: 'below' },
    path: '/docs/events',
    guide: 'Events',
    icon: IconClick,
  },
  {
    title: 'Charts and tables from one description',
    text: 'Describe a field once. The same fields and rows drive bars, lines, pies, KPIs, tables, pivot tables and heat maps.',
    proof: { href: '#charts', label: 'See eight of them above', direction: 'above' },
    path: '/docs/describing-your-data',
    guide: 'Describing your data',
    icon: IconTable,
  },
];
