import {
  IconAdjustmentsHorizontal,
  IconBrush,
  IconClick,
  IconDatabase,
  IconLanguage,
  IconLayoutCards,
  IconPalette,
  IconShieldCheck,
  IconSparkles,
  IconTimeline,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';
import { CHART_KINDS, defaultTheme } from '../../src';

// The full benefit list shown on the landing page, in one place. Each point
// says what the library does for you, not what you still configure or supply;
// where an option is involved, the point says so. No point repeats another
// one, here or elsewhere on the page. Counts are computed, so they can't go stale.

const tokenCount = Object.keys(defaultTheme.styles).length;

export type BenefitGroup = {
  title: string;
  lead: string;
  icon: ComponentType<{ size?: number; stroke?: number; 'aria-hidden'?: boolean }>;
  points: string[];
  wide?: boolean;
};

export const benefitGroups: BenefitGroup[] = [
  {
    title: 'Consistent colour, automatically',
    lead: 'Every value keeps one colour across the whole dashboard.',
    icon: IconPalette,
    points: [
      'A colour per value, shared by every chart on the page',
      'New values pick colours not already in use',
      'Assignments survive a page refresh',
      'Pin any value or measure to a colour you choose',
      'Reverse KPI change colours where lower is better',
    ],
  },
  {
    title: 'Time series done properly',
    lead: 'Dates are handled the way analysts expect.',
    icon: IconTimeline,
    points: [
      'Missing periods filled, so gaps show as gaps',
      'Granularity picker built in, from seconds to years',
      'Timezone-aware buckets, including ISO weeks and quarters',
      'Pass last period’s rows to get overlays and KPI deltas',
      'Option to connect gaps on line charts',
    ],
  },
  {
    title: 'Formatting and localisation',
    lead: 'Numbers and dates read right in every locale.',
    icon: IconLanguage,
    points: [
      'Locale-aware numbers, currencies and dates',
      'Prefixes, suffixes, decimals and compact "1.2M" per field',
      'Your translations reach titles, legends, axes, tooltips and table headers',
      'Dimension values translate too, not just labels',
    ],
  },
  {
    title: 'Sensible defaults, every state designed',
    lead: 'Pass fields and rows; the rest is already decided.',
    icon: IconAdjustmentsHorizontal,
    points: [
      'Every display prop is optional',
      'Loading, empty and error states, styled and consistent',
      'Keeps the chart on screen while it refetches',
      'Fills and resizes with its container',
      'Options to group long tails into "Other" and truncate labels',
    ],
  },
  {
    title: 'Card, chrome and export included',
    lead: 'Each chart arrives as a finished card.',
    icon: IconLayoutCards,
    points: [
      'Title, description and info tooltip on every card',
      'CSV, Excel and PNG export with no code',
      'Tooltips, legends, value and total labels',
      'Log scale, axis ranges and reversed axes',
      'Table cell styles and markdown cells',
    ],
  },
  {
    title: 'Events for every interaction',
    lead: 'Clicks come back as data you can act on.',
    icon: IconClick,
    points: [
      'Typed click events on bars, points, slices, cells and rows',
      'Payloads carry the clicked value and its time range',
      'Store the clicked value in state to cross-filter a dashboard',
      'Interaction events for your product analytics',
    ],
  },
  {
    title: 'Themeable to the pixel',
    lead: 'Match your product, not ours.',
    icon: IconBrush,
    points: [
      `${tokenCount.toLocaleString('en-US')} design tokens in three layers`,
      'One theme object restyles every chart',
      'Dark mode in a handful of overrides',
      'Per-chart Chart.js overrides and custom fonts',
    ],
  },
  {
    title: 'Bring your own data',
    lead: 'Keep your API, warehouse and caching as they are.',
    icon: IconDatabase,
    points: [
      'Rows from any API, warehouse or cache',
      'No query engine, server or vendor runtime',
      'One response shape for every chart',
      'Describe a field once, reuse it everywhere',
      'Tables that page and sort against your API, plus pivots and heat maps',
    ],
  },
  {
    title: 'Production-ready',
    lead: 'Built to be depended on.',
    icon: IconShieldCheck,
    points: [
      'Fully typed props, with a generated reference',
      'Tested across every component, data state and language',
      'Hardened in production dashboards',
      'React 19 is the only peer dependency',
    ],
  },
  {
    title: 'Built for AI chat',
    lead: 'A model picks the chart; the same components render it.',
    icon: IconSparkles,
    wide: true,
    points: [
      `${CHART_KINDS.length} chart kinds a model can choose from`,
      'Tool definitions for Anthropic and OpenAI, generated from the types',
      'Repairs common model mistakes in dates, keys and numbers',
      'Works out KPI totals, date ranges and donut centres the model left out',
      'Never renders a blank: a bad spec becomes a table or a clear error',
      'A bare mode that sits flat inside a chat bubble',
      'Draws while rows stream in, without flicker',
      'A click on the chart becomes the next prompt',
    ],
  },
];
