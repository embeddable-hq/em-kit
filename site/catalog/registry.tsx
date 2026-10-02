import type { ComponentType } from 'react';
import * as Charts from '../../src';
import type { DataResponse, Granularity } from '../../src';
import type { Dataset, FieldSpec, Row } from './datasets';
import { labelKey } from './translations';

export type DataState = 'ready' | 'loading' | 'empty' | 'error';

export type TableState = {
  page: number;
  pageSize?: number;
  sort?: { id: string; direction: 'asc' | 'desc' };
  isLoadingDownloadData: boolean;
};

// A value that renders one way in the preview and prints as `code` in the snippet.
export type CodeRef = { __code: string; value: unknown; declare?: string };
export const isCodeRef = (v: unknown): v is CodeRef => typeof v === 'object' && v !== null && '__code' in v;

export type FieldSlot = 'category' | 'group' | 'primary' | 'secondary' | 'size' | 'time';

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

export type ChartEntry = {
  id: string;
  name: string;
  exportName: keyof typeof Charts;
  group: 'KPIs' | 'Bars' | 'Lines' | 'Pies' | 'Scatter' | 'Tables';
  description: string;
  defaultTitle: string;
  toggles: Toggle[];
  usesGranularity?: boolean;
  usesTableState?: boolean;
  props: (ctx: BuildContext) => Record<string, unknown>;
};

const T = {
  legend: { key: 'showLegend', label: 'Legend', default: true },
  tooltips: { key: 'showTooltips', label: 'Tooltips', default: true },
  valueLabels: { key: 'showValueLabels', label: 'Value labels', default: false },
  log: { key: 'showLogarithmicScale', label: 'Log scale', default: false },
  reverseX: { key: 'reverseXAxis', label: 'Reverse x-axis', default: false },
  totals: { key: 'showTotalLabels', label: 'Total labels', default: false },
  percent: { key: 'showValueLabelsAsPercentage', label: 'Labels as %', default: false },
  pointLabels: { key: 'showPointLabels', label: 'Point labels', default: false },
  values: { key: 'showValues', label: 'Cell values', default: true },
  index: { key: 'showIndex', label: 'Row index', default: false },
  changePercent: { key: 'displayChangeAsPercentage', label: 'Change as %', default: true },
  hideMenu: { key: 'hideMenu', label: 'Hide header', default: false },
} satisfies Record<string, Toggle>;

const pick = (ctx: BuildContext, toggles: Toggle[]) =>
  Object.fromEntries(toggles.map((t) => [t.key, ctx.toggles[t.key] ?? t.default]));

const cartesian = [T.legend, T.tooltips, T.valueLabels, T.log, T.reverseX, T.hideMenu];

export const chartEntries: ChartEntry[] = [
  {
    id: 'kpi',
    name: 'KPI number',
    exportName: 'KpiChartNumberPro',
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
    exportName: 'KpiChartNumberComparisonPro',
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
    exportName: 'BarChartDefaultPro',
    group: 'Bars',
    description: 'Compare one or more measures across the values of a dimension.',
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
  },
  {
    id: 'bar-horizontal',
    name: 'Horizontal bar chart',
    exportName: 'BarChartDefaultHorizontalPro',
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
    exportName: 'BarChartStackedPro',
    group: 'Bars',
    description: 'Show the composition of each bar by a second dimension.',
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
    id: 'bar-grouped',
    name: 'Grouped bar chart',
    exportName: 'BarChartGroupedPro',
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
    id: 'bar-line',
    name: 'Bar and line combo',
    exportName: 'BarLineChartPro',
    group: 'Bars',
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
    exportName: 'LineChartDefaultPro',
    group: 'Lines',
    description: 'A time series with gap filling and a built-in granularity switcher.',
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
  },
  {
    id: 'line-grouped',
    name: 'Multi-series line chart',
    exportName: 'LineChartGroupedPro',
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
  },
  {
    id: 'area',
    name: 'Stacked area chart',
    exportName: 'AreaChartPro',
    group: 'Lines',
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
    exportName: 'PieChartPro',
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
    exportName: 'DonutChartPro',
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
    exportName: 'DonutLabelChartPro',
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
    id: 'scatter',
    name: 'Scatter chart',
    exportName: 'ScatterChartPro',
    group: 'Scatter',
    description: 'Plot two measures against each other, one point per dimension value.',
    defaultTitle: 'Correlation',
    toggles: [T.legend, T.tooltips, T.pointLabels, T.log, T.hideMenu],
    props: (ctx) => ({
      title: ctx.title,
      pointDimension: ctx.field('category'),
      xMeasure: ctx.field('secondary'),
      yMeasure: ctx.field('primary'),
      results: ctx.rows('rows', ctx.ds.byCategory),
      onPointClick: ctx.handler('onPointClick'),
      ...pick(ctx, [T.legend, T.tooltips, { ...T.pointLabels, default: true }, T.log, T.hideMenu]),
    }),
  },
  {
    id: 'bubble',
    name: 'Bubble chart',
    exportName: 'BubbleChartPro',
    group: 'Scatter',
    description: 'A scatter chart with a third measure encoded as bubble size.',
    defaultTitle: 'Three measures at once',
    toggles: [T.legend, T.tooltips, T.pointLabels, T.hideMenu],
    props: (ctx) => ({
      title: ctx.title,
      pointDimension: ctx.field('category'),
      xMeasure: ctx.field('secondary'),
      yMeasure: ctx.field('primary'),
      bubbleSizeMeasure: ctx.field('size'),
      results: ctx.rows('rows', ctx.ds.byCategory),
      bubbleRadiusMin: 6,
      bubbleRadiusMax: 24,
      onPointClick: ctx.handler('onPointClick'),
      ...pick(ctx, [T.legend, T.tooltips, { ...T.pointLabels, default: true }, T.hideMenu]),
    }),
  },
  {
    id: 'table',
    name: 'Paginated table',
    exportName: 'TableChartPaginatedPro',
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
    id: 'pivot',
    name: 'Pivot table',
    exportName: 'PivotTablePro',
    group: 'Tables',
    description: 'Measures cross-tabulated by a row and a column dimension, with totals.',
    defaultTitle: 'Cross-tab',
    toggles: [T.hideMenu],
    props: (ctx) => ({
      title: ctx.title,
      rowDimension: ctx.field('category'),
      columnDimension: ctx.field('group'),
      measures: [ctx.field('primary'), ctx.field('secondary')],
      results: ctx.rows('rows', ctx.ds.byCategoryGroup),
      expandedRowKeys: { __code: '[]', value: [] },
      setExpandedRowKey: { __code: '() => {}', value: () => {} },
      ...pick(ctx, [T.hideMenu]),
    }),
  },
  {
    id: 'heatmap',
    name: 'Heat map',
    exportName: 'HeatMapPro',
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

export const chartGroups = ['KPIs', 'Bars', 'Lines', 'Pies', 'Scatter', 'Tables'] as const;

export const getEntry = (id: string) => chartEntries.find((e) => e.id === id);

export const getComponent = (entry: ChartEntry) =>
  Charts[entry.exportName] as unknown as ComponentType<Record<string, unknown>>;

export const applyDataState = (response: DataResponse, state: DataState): DataResponse => {
  if (state === 'loading') return { isLoading: true };
  if (state === 'empty') return { isLoading: false, data: [] };
  if (state === 'error') return { isLoading: false, error: 'The query timed out after 30 seconds.' };
  return response;
};

export const fieldSpec = (ds: Dataset, slot: FieldSlot): FieldSpec => ds.specs[slot];
