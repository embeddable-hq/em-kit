import type { ComponentType } from 'react';
import * as Charts from '../../src';
import { measure } from '../../src';
import type { DataResponse, FieldInputs, Granularity } from '../../src';
import type { Dataset, DateWindow, FieldSpec, Row } from './datasets';
import { labelKey } from './translations';

export type DataState = 'ready' | 'loading' | 'empty' | 'error';

export type TableState = {
  page: number;
  pageSize?: number;
  sort?: { id: string; direction: 'asc' | 'desc' };
  isLoadingDownloadData: boolean;
};

// A value that renders one way in the preview and prints as `code` in the snippet.
export type CodeRef = {
  __code: string;
  value: unknown;
  declare?: string;
  // Set by withInputs: the declared field it spreads and the inputs layered on top.
  field?: { base: string; inputs: FieldInputs };
  // Which dataset field this is, so the snippet declares only the fields in use.
  slot?: FieldSlot;
};
export const isCodeRef = (v: unknown): v is CodeRef => typeof v === 'object' && v !== null && '__code' in v;

const printInputValue = (v: unknown): string => {
  if (typeof v === 'string') return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  if (Array.isArray(v)) return `[${v.map(printInputValue).join(', ')}]`;
  return JSON.stringify(v);
};

// A field with extra per-field options, printed as a spread of the declared
// field. Applying it again to its own result merges rather than nests.
export const withInputs = (ref: CodeRef, inputs: FieldInputs): CodeRef => {
  const field = ref.value as { inputs?: FieldInputs };
  const base = ref.field?.base ?? ref.__code;
  const layered = { ...ref.field?.inputs, ...inputs };
  const printed = Object.entries(layered)
    .map(([k, v]) => `${k}: ${printInputValue(v)}`)
    .join(', ');
  return {
    __code: `{ ...${base}, inputs: { ...${base}.inputs, ${printed} } }`,
    value: { ...field, inputs: { ...field.inputs, ...inputs } },
    field: { base, inputs: layered },
    slot: ref.slot,
  };
};

export type FieldSlot = 'category' | 'group' | 'primary' | 'secondary' | 'size' | 'stage' | 'time';

export type BuildContext = {
  ds: Dataset;
  field: (slot: FieldSlot) => CodeRef;
  rows: (varName: string, rows: Row[]) => CodeRef;
  handler: (name: string) => CodeRef;
  granularity: Granularity;
  setGranularity: CodeRef;
  table: { state: CodeRef; setState: CodeRef; rows: CodeRef; total: CodeRef };
  toggles: Record<string, boolean>;
  title: string;
};

export type Toggle = { key: string; label: string; default: boolean };

// A preset of the same component: props layered over the entry's own, built
// from the same context so the gallery card, its copied code and the
// playground all agree.
export type ChartVariant = {
  id: string;
  name: string;
  description: string;
  // The chart's own title, in English; other languages live in translations.ts.
  title: string;
  // Shown beside the code: what the preset changes and why.
  notes?: string[];
  // Spans the full gallery row.
  wide?: boolean;
  props: (ctx: BuildContext) => Record<string, unknown>;
};

export type ChartEntry = {
  id: string;
  name: string;
  exportName: keyof typeof Charts;
  group: (typeof chartGroups)[number];
  description: string;
  defaultTitle: string;
  toggles: Toggle[];
  usesGranularity?: boolean;
  usesTableState?: boolean;
  props: (ctx: BuildContext) => Record<string, unknown>;
  variants?: ChartVariant[];
  // Shown beside the code in the gallery.
  notes?: string[];
  // Spans the full gallery row.
  wide?: boolean;
};

const T = {
  legend: { key: 'showLegend', label: 'Legend', default: true },
  tooltips: { key: 'showTooltips', label: 'Tooltips', default: true },
  valueLabels: { key: 'showValueLabels', label: 'Value labels', default: false },
  log: { key: 'showLogarithmicScale', label: 'Log scale', default: false },
  reverseX: { key: 'reverseXAxis', label: 'Reverse x-axis', default: false },
  comparisonAxis: { key: 'showComparisonAxis', label: 'Comparison axis', default: false },
  totals: { key: 'showTotalLabels', label: 'Total labels', default: false },
  percent: { key: 'showValueLabelsAsPercentage', label: 'Labels as %', default: false },
  pointLabels: { key: 'showPointLabels', label: 'Point labels', default: false },
  values: { key: 'showValues', label: 'Cell values', default: true },
  index: { key: 'showIndex', label: 'Row index', default: false },
  changePercent: { key: 'displayChangeAsPercentage', label: 'Change as %', default: true },
  hideMenu: { key: 'hideMenu', label: 'Hide header', default: false },
  sectionLabels: { key: 'showSectionLabels', label: 'Step labels', default: true },
  stepPercent: { key: 'displayPercentages', label: 'Values as %', default: false },
} satisfies Record<string, Toggle>;

const pick = (ctx: BuildContext, toggles: Toggle[]) =>
  Object.fromEntries(toggles.map((t) => [t.key, ctx.toggles[t.key] ?? t.default]));

const cartesian = [T.legend, T.tooltips, T.valueLabels, T.log, T.reverseX, T.hideMenu];
const lineComparison = [T.legend, T.tooltips, T.valueLabels, T.log, T.reverseX, T.comparisonAxis, T.hideMenu];

// Comparison line charts: the dataset ends 2026-06-30, so the current period is
// its last half-year and the comparison the half-year before it.
const WINDOWS = {
  current: { from: '2026-01-01', to: '2026-06-30' },
  previous: { from: '2025-07-01', to: '2025-12-31' },
} satisfies Record<string, DateWindow>;

const rangeRef = (varName: string, window: DateWindow): CodeRef => ({
  __code: varName,
  value: { from: new Date(window.from), to: new Date(window.to), relativeTimeString: undefined },
  declare: `const ${varName} = { from: new Date('${window.from}'), to: new Date('${window.to}'), relativeTimeString: undefined };`,
});

// The generated snippet only defines `rows` (the granularity hook) and `pageRows`
// (the table hook), so a result set beyond those must print a self-contained
// expression instead of `results(<varName>)`. Loading, empty and error states
// reference no variable and are left untouched.
const printedAs = (ref: CodeRef, varName: string, expression: string, declare?: string): CodeRef =>
  ref.__code === `results(${varName})` ? { ...ref, __code: `results(${expression})`, declare } : ref;

const rowLiteral = (row: Row) =>
  `{ ${Object.entries(row)
    .map(([key, value]) => `${/^[A-Za-z_$][\w$]*$/.test(key) ? key : `'${key}'`}: ${value}`)
    .join(', ')} }`;

// KPI tabs read one row holding each measure's total over the plotted period.
const kpiTotals = (ctx: BuildContext, varName: string, rows: Row[]): CodeRef => {
  const names = [ctx.ds.specs.primary.name, ctx.ds.specs.secondary.name];
  const totals: Row = Object.fromEntries(names.map((n) => [n, rows.reduce((sum, r) => sum + Number(r[n] ?? 0), 0)]));
  return printedAs(ctx.rows(varName, [totals]), varName, varName, `const ${varName} = [${rowLiteral(totals)}];`);
};

const comparisonRows = (ctx: BuildContext): CodeRef =>
  printedAs(
    ctx.rows('comparisonRows', ctx.ds.byTimeWindow(ctx.granularity, WINDOWS.previous)),
    'comparisonRows',
    'useRows({ granularity, range: previousRange })',
  );

// TableScrollable accumulates the pages it is given: it appends each new
// `results` and starts again when the sort or resetKey changes. So a page must
// keep its identity between builds (a rebuild with the same page would
// otherwise append it again), and a new query must be served from page 0.
const scrollablePages = new Map<string, Row[]>();
const scrollableQuery = { current: '' };

const scrollablePage = (ds: Dataset, state: TableState): Row[] => {
  const all = ds.byTimeGroup('day');
  // Ignore a sort left over from a dataset whose columns have other names.
  const sort = state.sort && all[0] && state.sort.id in all[0] ? state.sort : undefined;
  const query = `${ds.id}|${sort?.id ?? ''}|${sort?.direction ?? ''}`;
  const page = query === scrollableQuery.current ? state.page : 0;
  scrollableQuery.current = query;
  const key = `${query}|${page}`;
  if (!scrollablePages.has(key)) {
    const factor = sort?.direction === 'desc' ? -1 : 1;
    const ordered = sort
      ? [...all].sort((a, b) => {
          const av = a[sort.id];
          const bv = b[sort.id];
          if (av == null) return 1;
          if (bv == null) return -1;
          return (av < bv ? -1 : av > bv ? 1 : 0) * factor;
        })
      : all;
    const size = Charts.TABLE_SCROLLABLE_SIZE;
    scrollablePages.set(key, ordered.slice(page * size, (page + 1) * size));
  }
  return scrollablePages.get(key)!;
};

export const chartEntries: ChartEntry[] = [
  {
    id: 'kpi',
    name: 'KPI number',
    exportName: 'KpiNumber',
    group: 'KPIs',
    description: 'A single headline figure, formatted with the measure’s prefix, suffix and locale.',
    defaultTitle: 'Last 30 days',
    toggles: [T.hideMenu],
    props: (ctx) => ({
      title: ctx.title,
      measure: ctx.field('primary'),
      results: ctx.rows('totalRows', [ctx.ds.total]),
      ...pick(ctx, [T.hideMenu]),
    }),
  },
  {
    id: 'kpi-comparison',
    name: 'KPI with comparison',
    exportName: 'KpiNumberComparison',
    group: 'KPIs',
    description: 'A headline figure with its change against a comparison period, coloured by direction.',
    defaultTitle: 'Last 30 days',
    toggles: [T.changePercent, T.hideMenu],
    props: (ctx) => ({
      title: ctx.title,
      measure: ctx.field('primary'),
      results: ctx.rows('currentRows', [ctx.ds.total]),
      resultsComparison: ctx.rows('previousRows', [ctx.ds.previousTotal]),
      comparisonPeriod: 'Previous period',
      primaryDateRange: {
        __code: 'currentRange',
        value: { from: new Date('2026-06-01'), to: new Date('2026-06-30'), relativeTimeString: undefined },
        declare: "const currentRange = { from: new Date('2026-06-01'), to: new Date('2026-06-30'), relativeTimeString: undefined };",
      },
      comparisonDateRange: {
        __code: 'previousRange',
        value: { from: new Date('2026-05-02'), to: new Date('2026-05-31'), relativeTimeString: undefined },
        declare: "const previousRange = { from: new Date('2026-05-02'), to: new Date('2026-05-31'), relativeTimeString: undefined };",
      },
      ...pick(ctx, [T.changePercent, T.hideMenu]),
    }),
  },
  {
    id: 'bar',
    name: 'Bar chart',
    exportName: 'BarChart',
    group: 'Bars',
    description: 'Compare one or more measures across the values of a dimension.',
    notes: [
      'Each row in `results` is one bar: the dimension\'s value plus each measure.',
      'Format values through the measure\'s `inputs` (prefix, decimalPlaces, …): see Field options on the chart page.',
    ],
    defaultTitle: 'By category',
    toggles: cartesian,
    props: (ctx) => ({
      title: ctx.title,
      dimension: ctx.field('category'),
      measures: [ctx.field('primary')],
      results: ctx.rows('rows', ctx.ds.byCategory),
      onBarClicked: ctx.handler('onBarClicked'),
      ...pick(ctx, cartesian),
    }),
    variants: [
      {
        id: 'monthly',
        title: 'Monthly',
        name: 'Bar chart · monthly columns',
        description: 'A year of months as columns, each labelled with its abbreviated value.',
        notes: [
          'The x-axis is a time dimension: pass `granularity` so the chart buckets and labels by month.',
          '`abbreviateLargeNumber` on the measure keeps labels short ($123K), and `showValueLabels` prints them.',
        ],
        props: (ctx) => ({
          dimension: ctx.field('time'),
          measures: [withInputs(ctx.field('primary'), { abbreviateLargeNumber: true })],
          results: ctx.rows('rows', ctx.ds.byTime('month')),
          granularity: 'month',
          showValueLabels: true,
          showLegend: false,
        }),
      },
      {
        id: 'growth',
        title: 'Monthly growth',
        name: 'Bar chart · growth, up and down',
        description: 'Month-on-month change as a percentage, with bars below zero for the months that fell.',
        notes: [
          '`growth` isn\'t in your data source: compute it per month in your query or data hook, then describe it with its own `measure()`.',
          '`suffix: \'%\'` and `decimalPlaces: 1` format it; negative values draw below the zero line.',
        ],
        props: (ctx) => {
          const { primary, time } = ctx.ds.specs;
          const months = ctx.ds.byTime('month');
          // Only the time keys and the derived measure, as the user's query would return.
          const rows = months.slice(1).map((row, i) => {
            const prev = Number(months[i]![primary.name]);
            const change = prev ? ((Number(row[primary.name]) - prev) / prev) * 100 : 0;
            const timeKeys = Object.fromEntries(Object.entries(row).filter(([k]) => k.startsWith(time.name)));
            return { ...timeKeys, growth: Math.round(change * 10) / 10 };
          });
          const growth = measure({
            name: 'growth',
            title: `${primary.title} growth`,
            inputs: { suffix: '%', decimalPlaces: 1 },
          });
          return {
            dimension: ctx.field('time'),
            measures: [
              {
                __code: 'growth',
                value: growth,
                declare: `const growth = measure({ name: 'growth', title: '${primary.title} growth', inputs: { suffix: '%', decimalPlaces: 1 } });`,
              },
            ],
            results: ctx.rows('rows', rows),
            granularity: 'month',
            showValueLabels: true,
            showLegend: false,
          };
        },
      },
    ],
  },
  {
    id: 'bar-horizontal',
    name: 'Horizontal bar chart',
    exportName: 'BarChartHorizontal',
    group: 'Bars',
    description: 'Bars laid out horizontally, for long category labels or ranked lists.',
    defaultTitle: 'Ranked by value',
    toggles: [T.legend, T.tooltips, T.valueLabels, T.log, T.hideMenu],
    props: (ctx) => ({
      title: ctx.title,
      dimension: ctx.field('category'),
      measures: [ctx.field('primary')],
      results: ctx.rows('rows', ctx.ds.byCategory),
      onBarClicked: ctx.handler('onBarClicked'),
      ...pick(ctx, [T.legend, T.tooltips, T.valueLabels, T.log, T.hideMenu]),
    }),
  },
  {
    id: 'bar-stacked',
    name: 'Stacked bar chart',
    exportName: 'BarChartStacked',
    group: 'Stacked',
    description: 'Show the composition of each bar by a second dimension.',
    notes: [
      'Rows are long format: one per bar and segment, with the `groupBy` value on each.',
      '`showTotalLabels` prints each stack\'s total above it.',
    ],
    defaultTitle: 'Composition',
    toggles: [T.legend, T.tooltips, T.valueLabels, T.totals, T.hideMenu],
    props: (ctx) => ({
      title: ctx.title,
      xAxis: ctx.field('category'),
      groupBy: ctx.field('group'),
      measure: ctx.field('primary'),
      results: ctx.rows('rows', ctx.ds.byCategoryGroup),
      onBarClicked: ctx.handler('onBarClicked'),
      ...pick(ctx, [T.legend, T.tooltips, T.valueLabels, T.totals, T.hideMenu]),
    }),
  },
  {
    id: 'bar-stacked-horizontal',
    name: 'Stacked horizontal bar chart',
    exportName: 'BarChartStackedHorizontal',
    group: 'Stacked',
    description: 'The composition of each bar by a second dimension, laid out horizontally for long labels.',
    defaultTitle: 'Composition',
    toggles: [T.legend, T.tooltips, T.valueLabels, T.totals, T.hideMenu],
    props: (ctx) => ({
      title: ctx.title,
      yAxis: ctx.field('category'),
      groupBy: ctx.field('group'),
      measure: ctx.field('primary'),
      results: ctx.rows('rows', ctx.ds.byCategoryGroup),
      onBarClicked: ctx.handler('onBarClicked'),
      ...pick(ctx, [T.legend, T.tooltips, T.valueLabels, T.totals, T.hideMenu]),
    }),
  },
  {
    id: 'bar-grouped',
    name: 'Grouped bar chart',
    exportName: 'BarChartGrouped',
    group: 'Bars',
    description: 'Side-by-side bars for each value of a second dimension.',
    defaultTitle: 'Side by side',
    toggles: [T.legend, T.tooltips, T.valueLabels, T.hideMenu],
    props: (ctx) => ({
      title: ctx.title,
      xAxis: ctx.field('category'),
      groupBy: ctx.field('group'),
      measure: ctx.field('primary'),
      results: ctx.rows('rows', ctx.ds.byCategoryGroup),
      onBarClicked: ctx.handler('onBarClicked'),
      ...pick(ctx, [T.legend, T.tooltips, T.valueLabels, T.hideMenu]),
    }),
  },
  {
    id: 'bar-grouped-horizontal',
    name: 'Grouped horizontal bar chart',
    exportName: 'BarChartGroupedHorizontal',
    group: 'Bars',
    description: 'Side-by-side bars for each value of a second dimension, laid out horizontally.',
    defaultTitle: 'Side by side',
    toggles: [T.legend, T.tooltips, T.valueLabels, T.hideMenu],
    props: (ctx) => ({
      title: ctx.title,
      yAxis: ctx.field('category'),
      groupBy: ctx.field('group'),
      measure: ctx.field('primary'),
      results: ctx.rows('rows', ctx.ds.byCategoryGroup),
      onBarClicked: ctx.handler('onBarClicked'),
      ...pick(ctx, [T.legend, T.tooltips, T.valueLabels, T.hideMenu]),
    }),
  },
  {
    id: 'bar-line',
    name: 'Bar and line combo',
    exportName: 'BarLineChart',
    group: 'Bars',
    wide: true,
    description: 'Bars and a line on independent axes, for volume against a rate or count.',
    defaultTitle: 'Over time',
    usesGranularity: true,
    toggles: [T.legend, T.tooltips, T.valueLabels, T.hideMenu],
    props: (ctx) => ({
      title: ctx.title,
      dimension: ctx.field('time'),
      measures: [ctx.field('primary')],
      lineMeasures: [ctx.field('secondary')],
      results: ctx.rows('rows', ctx.ds.byTime(ctx.granularity)),
      granularity: { __code: 'granularity', value: ctx.granularity },
      setGranularity: ctx.setGranularity,
      onBarClicked: ctx.handler('onBarClicked'),
      ...pick(ctx, [T.legend, T.tooltips, T.valueLabels, T.hideMenu]),
    }),
  },
  {
    id: 'line',
    name: 'Line chart',
    exportName: 'LineChart',
    group: 'Lines',
    description: 'A time series with gap filling and a built-in granularity switcher.',
    notes: [
      '`granularity` and `setGranularity` make it controlled: refetch your rows when the user picks a new granularity.',
      'Rows are long format, one per time bucket, with zone-less ISO time strings.',
    ],
    defaultTitle: 'Trend',
    usesGranularity: true,
    toggles: cartesian,
    props: (ctx) => ({
      title: ctx.title,
      xAxis: ctx.field('time'),
      measures: [ctx.field('primary')],
      results: ctx.rows('rows', ctx.ds.byTime(ctx.granularity)),
      granularity: { __code: 'granularity', value: ctx.granularity },
      setGranularity: ctx.setGranularity,
      onLineClicked: ctx.handler('onLineClicked'),
      ...pick(ctx, cartesian),
    }),
    variants: [
      {
        id: 'filled',
        title: 'Volume over time',
        name: 'Line chart · filled',
        description: 'A shaded area under the line, for a sense of volume over time.',
        notes: [
          '`fillUnderLine` is a field option on the measure, so each measure in `measures` can choose its own.',
        ],
        props: (ctx) => ({
          measures: [withInputs(ctx.field('primary'), { fillUnderLine: true })],
          showLegend: false,
        }),
      },
      {
        id: 'dashed-labels',
        title: 'Month by month',
        name: 'Line chart · dashed with labels',
        description: 'A dashed line with an abbreviated value at every point.',
        notes: [
          '`dashedLine` and `abbreviateLargeNumber` are field options on the measure, not chart props.',
          '`showValueLabels` labels every point; at daily granularity that gets crowded.',
        ],
        props: (ctx) => ({
          measures: [withInputs(ctx.field('primary'), { dashedLine: true, abbreviateLargeNumber: true })],
          showValueLabels: true,
          showLegend: false,
        }),
      },
    ],
  },
  {
    id: 'line-grouped',
    name: 'Multi-series line chart',
    exportName: 'LineChartGrouped',
    group: 'Lines',
    description: 'One line per value of a dimension, over time.',
    defaultTitle: 'Trend by segment',
    usesGranularity: true,
    toggles: cartesian,
    props: (ctx) => ({
      title: ctx.title,
      xAxis: ctx.field('time'),
      groupBy: ctx.field('group'),
      measure: ctx.field('primary'),
      results: ctx.rows('rows', ctx.ds.byTimeGroup(ctx.granularity)),
      granularity: { __code: 'granularity', value: ctx.granularity },
      setGranularity: ctx.setGranularity,
      onLineClicked: ctx.handler('onLineClicked'),
      ...pick(ctx, cartesian),
    }),
    variants: [
      {
        id: 'filled',
        title: 'Segments over time',
        name: 'Multi-series line chart · filled',
        description: 'Every segment shaded under its line, so the biggest reads at a glance.',
        notes: ['`fillUnderLine` on the measure shades under every line the chart draws for it.'],
        props: (ctx) => ({
          measure: withInputs(ctx.field('primary'), { fillUnderLine: true, abbreviateLargeNumber: true }),
        }),
      },
    ],
  },
  {
    id: 'line-comparison',
    name: 'Line chart with comparison',
    exportName: 'LineChartComparison',
    group: 'Lines',
    description: 'The current period against an earlier one, with an optional second axis for the earlier dates.',
    defaultTitle: 'Against the previous period',
    usesGranularity: true,
    toggles: lineComparison,
    props: (ctx) => ({
      title: ctx.title,
      xAxis: ctx.field('time'),
      measures: [ctx.field('primary')],
      results: ctx.rows('rows', ctx.ds.byTimeWindow(ctx.granularity, WINDOWS.current)),
      resultsComparison: comparisonRows(ctx),
      comparisonPeriod: 'Previous period',
      primaryDateRange: rangeRef('currentRange', WINDOWS.current),
      comparisonDateRange: rangeRef('previousRange', WINDOWS.previous),
      granularity: { __code: 'granularity', value: ctx.granularity },
      setGranularity: ctx.setGranularity,
      onLineClicked: ctx.handler('onLineClicked'),
      ...pick(ctx, lineComparison),
    }),
  },
  {
    id: 'line-with-kpi-tabs',
    name: 'Line chart with KPI tabs',
    exportName: 'LineChartWithKpiTabs',
    group: 'Lines',
    wide: true,
    description: 'A tab per measure showing its total; selecting a tab switches the plotted line.',
    defaultTitle: 'Trend by measure',
    usesGranularity: true,
    toggles: cartesian,
    props: (ctx) => {
      const rows = ctx.ds.byTime(ctx.granularity);
      return {
        title: ctx.title,
        xAxis: ctx.field('time'),
        measures: [ctx.field('primary'), ctx.field('secondary')],
        results: ctx.rows('rows', rows),
        resultsKpis: kpiTotals(ctx, 'kpiRows', ctx.ds.byTime('month')),
        granularity: { __code: 'granularity', value: ctx.granularity },
        setGranularity: ctx.setGranularity,
        onLineClicked: ctx.handler('onLineClicked'),
        ...pick(ctx, cartesian),
      };
    },
  },
  {
    id: 'line-comparison-with-kpi-tabs',
    name: 'Line chart with comparison and KPI tabs',
    exportName: 'LineChartComparisonWithKpiTabs',
    group: 'Lines',
    wide: true,
    description: 'KPI tabs showing each measure’s change against the previous period, over a line chart that overlays both.',
    defaultTitle: 'Previous period by measure',
    usesGranularity: true,
    toggles: lineComparison,
    props: (ctx) => ({
      title: ctx.title,
      xAxis: ctx.field('time'),
      measures: [ctx.field('primary'), ctx.field('secondary')],
      results: ctx.rows('rows', ctx.ds.byTimeWindow(ctx.granularity, WINDOWS.current)),
      resultsComparison: comparisonRows(ctx),
      resultsKpis: kpiTotals(ctx, 'kpiRows', ctx.ds.byTimeWindow('month', WINDOWS.current)),
      resultsKpisComparison: kpiTotals(ctx, 'kpiComparisonRows', ctx.ds.byTimeWindow('month', WINDOWS.previous)),
      comparisonPeriod: 'Previous period',
      primaryDateRange: rangeRef('currentRange', WINDOWS.current),
      comparisonDateRange: rangeRef('previousRange', WINDOWS.previous),
      granularity: { __code: 'granularity', value: ctx.granularity },
      setGranularity: ctx.setGranularity,
      onLineClicked: ctx.handler('onLineClicked'),
      ...pick(ctx, lineComparison),
    }),
  },
  {
    id: 'area',
    name: 'Stacked area chart',
    exportName: 'AreaChart',
    group: 'Stacked',
    description: 'Stacked areas showing how segments contribute to a total over time.',
    defaultTitle: 'Contribution over time',
    usesGranularity: true,
    toggles: [T.legend, T.tooltips, T.valueLabels, T.hideMenu],
    props: (ctx) => ({
      title: ctx.title,
      xAxis: ctx.field('time'),
      groupBy: ctx.field('group'),
      measure: ctx.field('primary'),
      results: ctx.rows('rows', ctx.ds.byTimeGroup(ctx.granularity)),
      granularity: { __code: 'granularity', value: ctx.granularity },
      setGranularity: ctx.setGranularity,
      onPointClicked: ctx.handler('onPointClicked'),
      ...pick(ctx, [T.legend, T.tooltips, T.valueLabels, T.hideMenu]),
    }),
  },
  {
    id: 'pie',
    name: 'Pie chart',
    exportName: 'PieChart',
    group: 'Pies',
    description: 'Share of a total across a small number of categories.',
    defaultTitle: 'Share of total',
    toggles: [T.legend, T.tooltips, T.valueLabels, T.percent, T.hideMenu],
    props: (ctx) => ({
      title: ctx.title,
      dimension: ctx.field('category'),
      measure: ctx.field('primary'),
      results: ctx.rows('rows', ctx.ds.byCategory),
      onSegmentClick: ctx.handler('onSegmentClick'),
      ...pick(ctx, [T.legend, T.tooltips, { ...T.valueLabels, default: true }, T.percent, T.hideMenu]),
    }),
  },
  {
    id: 'donut',
    name: 'Donut chart',
    exportName: 'DonutChart',
    group: 'Pies',
    description: 'A pie with the centre cut out, for a lighter visual weight.',
    defaultTitle: 'Share of total',
    toggles: [T.legend, T.tooltips, T.valueLabels, T.percent, T.hideMenu],
    props: (ctx) => ({
      title: ctx.title,
      dimension: ctx.field('category'),
      measure: ctx.field('primary'),
      results: ctx.rows('rows', ctx.ds.byCategory),
      onSegmentClick: ctx.handler('onSegmentClick'),
      ...pick(ctx, [T.legend, T.tooltips, T.valueLabels, T.percent, T.hideMenu]),
    }),
  },
  {
    id: 'donut-label',
    name: 'Donut with total',
    exportName: 'DonutLabelChart',
    group: 'Pies',
    description: 'A donut with a headline figure in the centre.',
    defaultTitle: 'Share of total',
    toggles: [T.legend, T.tooltips, T.valueLabels, T.hideMenu],
    props: (ctx) => ({
      title: ctx.title,
      dimension: ctx.field('category'),
      measure: ctx.field('primary'),
      results: ctx.rows('rows', ctx.ds.byCategory),
      innerLabelMeasure: ctx.field('primary'),
      innerLabelText: labelKey('total'),
      resultsInnerLabel: ctx.rows('totalRows', [
        { [ctx.ds.specs.primary.name]: ctx.ds.byCategory.reduce((s, r) => s + Number(r[ctx.ds.specs.primary.name] ?? 0), 0) },
      ]),
      onSegmentClick: ctx.handler('onSegmentClick'),
      ...pick(ctx, [T.legend, T.tooltips, T.valueLabels, T.hideMenu]),
    }),
  },
  {
    id: 'funnel',
    name: 'Funnel chart',
    exportName: 'FunnelChart',
    group: 'Funnels',
    description: 'How much of a total survives each step of a process, in order.',
    defaultTitle: 'Funnel',
    toggles: [T.legend, T.tooltips, T.valueLabels, T.sectionLabels, T.stepPercent, T.hideMenu],
    notes: [
      'Steps sort largest first. When a later step can outgrow an earlier one, pass `orderDimension`: a field holding each step’s position.',
    ],
    props: (ctx) => ({
      title: ctx.title,
      sectionDimension: ctx.field('stage'),
      countMeasure: ctx.field('primary'),
      results: ctx.rows('rows', ctx.ds.byStage),
      ...pick(ctx, [
        { ...T.legend, default: false },
        T.tooltips,
        { ...T.valueLabels, default: true },
        T.sectionLabels,
        T.stepPercent,
        T.hideMenu,
      ]),
    }),
  },
  {
    id: 'scatter',
    name: 'Scatter chart',
    exportName: 'ScatterChart',
    group: 'Scatter',
    description: 'Plot two measures against each other, one point per dimension value.',
    defaultTitle: 'Correlation',
    toggles: [T.legend, T.tooltips, T.pointLabels, T.log, T.hideMenu],
    props: (ctx) => ({
      title: ctx.title,
      pointDimension: ctx.field('category'),
      groupByDimension: ctx.field('group'),
      xMeasure: ctx.field('secondary'),
      yMeasure: ctx.field('primary'),
      results: ctx.rows('rows', ctx.ds.byPoint),
      onPointClick: ctx.handler('onPointClick'),
      ...pick(ctx, [T.legend, T.tooltips, T.pointLabels, T.log, T.hideMenu]),
    }),
  },
  {
    id: 'bubble',
    name: 'Bubble chart',
    exportName: 'BubbleChart',
    group: 'Scatter',
    description: 'A scatter chart with a third measure encoded as bubble size.',
    defaultTitle: 'Three measures at once',
    toggles: [T.legend, T.tooltips, T.pointLabels, T.hideMenu],
    props: (ctx) => ({
      title: ctx.title,
      pointDimension: ctx.field('category'),
      groupByDimension: ctx.field('group'),
      xMeasure: ctx.field('secondary'),
      yMeasure: ctx.field('primary'),
      bubbleSizeMeasure: ctx.field('size'),
      results: ctx.rows('rows', ctx.ds.byPoint),
      bubbleRadiusMin: 4,
      bubbleRadiusMax: 16,
      onPointClick: ctx.handler('onPointClick'),
      ...pick(ctx, [T.legend, T.tooltips, T.pointLabels, T.hideMenu]),
    }),
  },
  {
    id: 'table',
    name: 'Paginated table',
    exportName: 'TablePaginated',
    group: 'Tables',
    description: 'A controlled table: you own paging and sorting and pass in the current page of rows.',
    defaultTitle: 'Breakdown',
    usesTableState: true,
    toggles: [T.index, T.hideMenu],
    props: (ctx) => ({
      title: ctx.title,
      dimensionsAndMeasures: [ctx.field('category'), ctx.field('primary'), ctx.field('secondary')],
      results: ctx.table.rows,
      totalResults: ctx.table.total,
      state: ctx.table.state,
      setState: ctx.table.setState,
      ...pick(ctx, [T.index, T.hideMenu]),
    }),
  },
  {
    id: 'table-scrollable',
    name: 'Scrollable table',
    exportName: 'TableScrollable',
    group: 'Tables',
    description:
      'An infinite-scroll table: you serve pages of 50 rows and it appends each as the reader scrolls. Sorting or a new resetKey starts again from page 0. The gallery serves one page per state.page, as your query would.',
    defaultTitle: 'Daily detail',
    usesTableState: true,
    toggles: [T.index, T.hideMenu],
    props: (ctx) => {
      // The rows are daily, whatever granularity the rest of the gallery is set to.
      const day: CodeRef = {
        __code: ctx.ds.specs.time.varName,
        value: Charts.dimension({ name: ctx.ds.specs.time.name, title: ctx.ds.specs.time.title, type: 'time', granularity: 'day' }),
        declare: `const ${ctx.ds.specs.time.varName} = dimension({ name: '${ctx.ds.specs.time.name}', title: '${ctx.ds.specs.time.title}', type: 'time', granularity: 'day' });`,
      };
      return {
        title: ctx.title,
        dimensionsAndMeasures: [day, ctx.field('group'), ctx.field('primary')],
        clickDimension: day,
        results: ctx.rows('pageRows', scrollablePage(ctx.ds, ctx.table.state.value as TableState)),
        resetKey: { __code: `{ dataset: '${ctx.ds.id}' }`, value: { dataset: ctx.ds.id } },
        state: ctx.table.state,
        setState: ctx.table.setState,
        onRowClicked: ctx.handler('onRowClicked'),
        ...pick(ctx, [T.index, T.hideMenu]),
      };
    },
  },
  {
    id: 'pivot',
    name: 'Pivot table',
    exportName: 'PivotTable',
    group: 'Tables',
    description: 'Measures cross-tabulated by a row and a column dimension, with totals.',
    notes: [
      'Totals are per measure: `columnAggregation` and `rowAggregation` in the measure\'s `inputs`.',
      '`expandedRowKeys` and `setExpandedRowKey` drive the optional sub-row level (`subRowDimension`).',
    ],
    defaultTitle: 'Cross-tab',
    toggles: [T.hideMenu],
    props: (ctx) => ({
      title: ctx.title,
      rowDimension: ctx.field('category'),
      columnDimension: ctx.field('group'),
      measures: [
        withInputs(ctx.field('primary'), { columnAggregation: ['sum'], rowAggregation: ['sum'] }),
        ctx.field('secondary'),
      ],
      results: ctx.rows('rows', ctx.ds.byCategoryGroup),
      expandedRowKeys: { __code: '[]', value: [] },
      setExpandedRowKey: { __code: '() => {}', value: () => {} },
      ...pick(ctx, [T.hideMenu]),
    }),
    variants: [
      {
        id: 'summary-stats',
        title: 'Average, min and max',
        name: 'Pivot table · average, min and max',
        description: 'One measure with row statistics instead of plain totals.',
        notes: [
          '`rowAggregation` adds a column per statistic, in the order you list them; `columnAggregation` adds rows.',
          'Both take any of `\'sum\'`, `\'min\'`, `\'max\'`, `\'average\'`.',
        ],
        props: (ctx) => ({
          measures: [
            withInputs(ctx.field('primary'), {
              columnAggregation: ['average'],
              rowAggregation: ['average', 'min', 'max'],
              abbreviateLargeNumber: true,
            }),
          ],
        }),
      },
      {
        id: 'share',
        title: 'Share of total',
        name: 'Pivot table · share of total',
        description: 'Each cell as a percentage, with column totals.',
        notes: [
          '`showAsPercentage` shows each cell as its share; other measures may be ignored when it\'s on.',
          '`columnAggregation: [\'sum\']` adds the totals row.',
        ],
        props: (ctx) => ({
          measures: [withInputs(ctx.field('primary'), { showAsPercentage: true, columnAggregation: ['sum'] })],
        }),
      },
    ],
  },
  {
    id: 'heatmap',
    name: 'Heat map',
    exportName: 'HeatMap',
    group: 'Tables',
    description: 'A grid of cells coloured by value, for spotting hot and cold combinations.',
    defaultTitle: 'Hot spots',
    toggles: [T.values, T.hideMenu],
    props: (ctx) => ({
      title: ctx.title,
      rowDimension: ctx.field('category'),
      columnDimension: ctx.field('group'),
      measure: ctx.field('primary'),
      results: ctx.rows('rows', ctx.ds.byCategoryGroup),
      onCellClicked: ctx.handler('onCellClicked'),
      ...pick(ctx, [T.values, T.hideMenu]),
    }),
  },
];

export const chartGroups = ['KPIs', 'Bars', 'Stacked', 'Lines', 'Pies', 'Funnels', 'Scatter', 'Tables'] as const;

export const getEntry = (id: string) => chartEntries.find((e) => e.id === id);

// Translation id for a chart's title: the entry's, or its preset's.
export const titleId = (entry: ChartEntry, variant?: ChartVariant) =>
  variant ? `${entry.id}--${variant.id}` : entry.id;

export const getVariant = (entry: ChartEntry, id: string | undefined) =>
  id ? entry.variants?.find((v) => v.id === id) : undefined;

export const getComponent = (entry: ChartEntry) =>
  Charts[entry.exportName] as unknown as ComponentType<Record<string, unknown>>;

export const applyDataState = (response: DataResponse, state: DataState): DataResponse => {
  if (state === 'loading') return { isLoading: true };
  if (state === 'empty') return { isLoading: false, data: [] };
  if (state === 'error') return { isLoading: false, error: 'The query timed out after 30 seconds.' };
  return response;
};

export const fieldSpec = (ds: Dataset, slot: FieldSlot): FieldSpec => ds.specs[slot];
