import { type Chunk, chunk } from '../chunks';
import type { Markdown } from '../components/Markdown';
import { type Guide, type LiveBlockId, providerNote } from '../content/guides';
import type { ChartDemos } from './guideChartDemos';
import { lightMarkdown } from './guideMarkdown';

// What a guide loads besides its page (see App.tsx). Most guides are text and
// code, and load neither of these:
// - Its live charts: the examples and the chart library, a chunk its text does
//   not wait for (guideChartDemos.tsx).
// - The Markdown parser, for a block lightMarkdown() does not draw
//   (guideMarkdown.tsx). Its text needs it, so the page waits for it.

// The live blocks that draw a chart. Listed here rather than read from
// guideChartDemos.tsx, so the route map can tell which guides draw charts
// without loading them; a mismatch is a type error there.
export const chartBlockIds = [
  'quick-start-chart',
  'plan-chart',
  'signups-by-week',
  'orders-over-time',
  'revenue-by-plan-and-month',
  'chart-states',
  'region-filter',
  'customers-table',
  'signups-filters',
  'answer-chart',
  'target-line-demo',
] as const satisfies readonly LiveBlockId[];

export type ChartBlockId = (typeof chartBlockIds)[number];

export const isChartBlock = (id: LiveBlockId): id is ChartBlockId => (chartBlockIds as readonly LiveBlockId[]).includes(id);

export const guideChartDemos = chunk<ChartDemos>('pages/guideChartDemos.tsx', () =>
  import('./guideChartDemos').then((m) => m.chartDemos),
);

export const fullMarkdown = chunk<typeof Markdown>('components/Markdown.tsx', () =>
  import('../components/Markdown').then((m) => m.Markdown),
);

/** The Markdown a guide's page draws: its note and its prose blocks (a live block's text is for its Markdown twin). */
const prose = (guide: Guide) => [
  ...(providerNote(guide) ? [providerNote(guide)!] : []),
  ...guide.blocks.flatMap((block) => ('md' in block && !('live' in block) ? [block.md] : [])),
];

export const guideDrawsCharts = (guide: Guide) => guide.blocks.some((block) => 'live' in block && isChartBlock(block.live));

/** The chunks a guide's page needs: `now` before it renders, `later` alongside, shown when they arrive. */
export const guideChunks = (guide: Guide): { now: Chunk<unknown>[]; later: Chunk<unknown>[] } => ({
  now: prose(guide).some((md) => !lightMarkdown(md)) ? [fullMarkdown] : [],
  later: guideDrawsCharts(guide) ? [guideChartDemos] : [],
});
