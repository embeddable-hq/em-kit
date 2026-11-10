import type { ComponentType } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  CHART_KINDS,
  ChartFromSpec,
  ChartsProvider,
  intentToPrompt,
  type ChartFromSpecProps,
  type ChartIntent,
  type ChartKind,
  type ChartSpec,
  type SpecRow,
} from '../src';

// Tests for <ChartFromSpec> and intentToPrompt, in the house style of
// components.test.tsx: renderToString inside <ChartsProvider>, jsdom, assertions
// on the HTML. Effects don't run, so chart.js never needs a canvas.
//
// chart.js draws categories and values onto a <canvas>, so the HTML alone can't
// show what a chart would plot. react-chartjs-2 is therefore wrapped (below)
// so each chart's labels and dataset values are echoed as data attributes; the
// real component still renders inside, so the <canvas> output is unchanged.

vi.mock('react-chartjs-2', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-chartjs-2')>();
  const { createElement, forwardRef } = await import('react');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyProps = any;
  const probe = (Inner: ComponentType<AnyProps>) =>
    forwardRef<unknown, AnyProps>((props, ref) =>
      createElement(
        'div',
        {
          'data-chart-labels': JSON.stringify(props.data?.labels ?? []),
          'data-chart-values': JSON.stringify(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (props.data?.datasets ?? []).map((dataset: any) => dataset.data),
          ),
        },
        createElement(Inner, { ...props, ref }),
      ),
    );
  return {
    ...actual,
    Bar: probe(actual.Bar as ComponentType<AnyProps>),
    Line: probe(actual.Line as ComponentType<AnyProps>),
    Pie: probe(actual.Pie as ComponentType<AnyProps>),
    Scatter: probe(actual.Scatter as ComponentType<AnyProps>),
    Bubble: probe(actual.Bubble as ComponentType<AnyProps>),
  };
});

// --- helpers ---------------------------------------------------------------

const ERROR_TITLE = 'Something went wrong';

const render = (spec: unknown, props: Omit<ChartFromSpecProps, 'spec'> = {}) =>
  renderToString(
    <ChartsProvider>
      <ChartFromSpec spec={spec as ChartSpec} {...props} />
    </ChartsProvider>,
  );

const decode = (value: string) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

type ProbedChart = { labels: unknown[]; values: unknown[][] };

/** The labels and dataset values of every chart.js chart in the output. */
const probed = (html: string): ProbedChart[] =>
  [...html.matchAll(/data-chart-labels="([^"]*)" data-chart-values="([^"]*)"/g)].map(
    ([, labels, values]) => ({
      labels: JSON.parse(decode(labels ?? '[]')) as unknown[],
      values: JSON.parse(decode(values ?? '[]')) as unknown[][],
    }),
  );

const onlyChart = (html: string): ProbedChart => {
  const charts = probed(html);
  expect(charts).toHaveLength(1);
  return charts[0]!;
};

// The header spinner sits in a wrapper that CSS hides when not loading; the
// wrapper's class carries "hidden" (the exact class name is hashed).
const spinnerVisible = (html: string) => {
  const wrapper = html.match(/<div class="([^"]*)"><svg[^>]*tabler-icon-loader-2/);
  return wrapper !== null && !(wrapper[1] ?? '').includes('hidden');
};

const hasSkeleton = (html: string) => /class="[^"]*skeleton/.test(html);
const hasMenuIcon = (html: string) => html.includes('tabler-icon-dots-vertical');
const hasCanvas = (html: string) => html.includes('<canvas');

const month = (n: number) => `2024-${String(n).padStart(2, '0')}-01T00:00:00.000`;

// --- fixtures --------------------------------------------------------------

const byRegion: SpecRow[] = [
  { region: 'EMEA', revenue: 120, orders: 12, size: 5 },
  { region: 'APAC', revenue: 80, orders: 9, size: 3 },
  { region: 'AMER', revenue: 200, orders: 20, size: 8 },
];

const byRegionPlan: SpecRow[] = [
  { region: 'EMEA', plan: 'Pro', revenue: 70 },
  { region: 'EMEA', plan: 'Free', revenue: 50 },
  { region: 'APAC', plan: 'Pro', revenue: 30 },
  { region: 'APAC', plan: 'Free', revenue: 50 },
];

const byMonth: SpecRow[] = [
  { month: '2024-01-01', revenue: 100, orders: 10 },
  { month: '2024-02-01', revenue: 140, orders: 14 },
  { month: '2024-03-01', revenue: 120, orders: 11 },
];

const byMonthPlan: SpecRow[] = [
  { month: '2024-01-01', plan: 'Pro', revenue: 60 },
  { month: '2024-01-01', plan: 'Free', revenue: 40 },
  { month: '2024-02-01', plan: 'Pro', revenue: 90 },
  { month: '2024-02-01', plan: 'Free', revenue: 50 },
  { month: '2024-03-01', plan: 'Pro', revenue: 70 },
];

// A minimal valid spec per kind. Fields are bare row keys for some kinds and
// { name, title } objects for others, so both FieldRef forms are exercised.
const SPECS: Record<ChartKind, ChartSpec> = {
  bar: {
    chart: 'bar',
    title: 'Title for bar',
    dimension: 'region',
    measures: ['revenue'],
    rows: byRegion,
  },
  barHorizontal: {
    chart: 'barHorizontal',
    title: 'Title for barHorizontal',
    dimension: { name: 'region', title: 'Region' },
    measures: { name: 'revenue', title: 'Revenue' },
    rows: byRegion,
  },
  barGrouped: {
    chart: 'barGrouped',
    title: 'Title for barGrouped',
    xAxis: 'region',
    groupBy: 'plan',
    measure: 'revenue',
    rows: byRegionPlan,
  },
  barGroupedHorizontal: {
    chart: 'barGroupedHorizontal',
    title: 'Title for barGroupedHorizontal',
    xAxis: { name: 'region', title: 'Region' },
    groupBy: { name: 'plan', title: 'Plan' },
    measure: { name: 'revenue', title: 'Revenue' },
    rows: byRegionPlan,
  },
  barStacked: {
    chart: 'barStacked',
    title: 'Title for barStacked',
    xAxis: 'region',
    groupBy: 'plan',
    measure: 'revenue',
    rows: byRegionPlan,
  },
  barStackedHorizontal: {
    chart: 'barStackedHorizontal',
    title: 'Title for barStackedHorizontal',
    xAxis: { name: 'region', title: 'Region' },
    groupBy: { name: 'plan', title: 'Plan' },
    measure: { name: 'revenue', title: 'Revenue' },
    rows: byRegionPlan,
  },
  line: {
    chart: 'line',
    title: 'Title for line',
    xAxis: 'month',
    measures: ['revenue', 'orders'],
    granularity: 'month',
    rows: byMonth,
  },
  lineGrouped: {
    chart: 'lineGrouped',
    title: 'Title for lineGrouped',
    xAxis: { name: 'month', title: 'Month' },
    groupBy: { name: 'plan', title: 'Plan' },
    measure: { name: 'revenue', title: 'Revenue' },
    granularity: 'month',
    rows: byMonthPlan,
  },
  lineWithKpiTabs: {
    chart: 'lineWithKpiTabs',
    title: 'Title for lineWithKpiTabs',
    xAxis: 'month',
    measures: ['revenue', 'orders'],
    granularity: 'month',
    rows: byMonth,
    // kpiRows omitted: derived by summing the rows per measure.
  },
  lineComparison: {
    chart: 'lineComparison',
    title: 'Title for lineComparison',
    xAxis: { name: 'month', title: 'Month' },
    measures: [{ name: 'revenue', title: 'Revenue' }],
    granularity: 'month',
    rows: byMonth,
    comparisonRows: [
      { month: '2023-01-01', revenue: 90 },
      { month: '2023-02-01', revenue: 100 },
      { month: '2023-03-01', revenue: 95 },
    ],
    comparisonLabel: 'Previous period',
    // date ranges omitted: derived from each row set's time extent.
  },
  lineComparisonWithKpiTabs: {
    chart: 'lineComparisonWithKpiTabs',
    title: 'Title for lineComparisonWithKpiTabs',
    xAxis: 'month',
    measures: ['revenue', 'orders'],
    granularity: 'month',
    rows: byMonth,
    comparisonRows: [
      { month: '2023-01-01', revenue: 90, orders: 9 },
      { month: '2023-02-01', revenue: 100, orders: 10 },
    ],
  },
  area: {
    chart: 'area',
    title: 'Title for area',
    xAxis: 'month',
    measure: 'revenue',
    granularity: 'month',
    rows: byMonth,
  },
  barLine: {
    chart: 'barLine',
    title: 'Title for barLine',
    dimension: { name: 'month', title: 'Month' },
    barMeasures: { name: 'revenue', title: 'Revenue' },
    lineMeasures: ['orders'],
    granularity: 'month',
    rows: byMonth,
  },
  pie: {
    chart: 'pie',
    title: 'Title for pie',
    dimension: 'region',
    measure: 'revenue',
    rows: byRegion,
  },
  donut: {
    chart: 'donut',
    title: 'Title for donut',
    dimension: { name: 'region', title: 'Region' },
    measure: { name: 'revenue', title: 'Revenue' },
    rows: byRegion,
  },
  donutLabel: {
    chart: 'donutLabel',
    title: 'Title for donutLabel',
    dimension: { name: 'region', title: 'Region' },
    measure: { name: 'revenue', title: 'Revenue' },
    innerLabel: { text: 'Total revenue' },
    rows: byRegion,
    // innerLabel.value omitted: derived by summing the rows.
  },
  scatter: {
    chart: 'scatter',
    title: 'Title for scatter',
    xMeasure: 'revenue',
    yMeasure: 'orders',
    pointDimension: 'region',
    rows: byRegion,
  },
  bubble: {
    chart: 'bubble',
    title: 'Title for bubble',
    xMeasure: { name: 'revenue', title: 'Revenue' },
    yMeasure: { name: 'orders', title: 'Orders' },
    bubbleSizeMeasure: { name: 'size', title: 'Size' },
    pointDimension: { name: 'region', title: 'Region' },
    rows: byRegion,
  },
  kpi: {
    chart: 'kpi',
    title: 'Title for kpi',
    measure: 'revenue',
    value: 1234.5,
  },
  kpiComparison: {
    chart: 'kpiComparison',
    title: 'Title for kpiComparison',
    measure: { name: 'revenue', title: 'Revenue' },
    value: 110,
    comparisonValue: 100,
  },
  table: {
    chart: 'table',
    title: 'Title for table',
    columns: ['region', { name: 'revenue', title: 'Revenue' }],
    rows: byRegion,
  },
  heatmap: {
    chart: 'heatmap',
    title: 'Title for heatmap',
    rowDimension: 'region',
    columnDimension: 'plan',
    measure: 'revenue',
    rows: byRegionPlan,
  },
  pivot: {
    chart: 'pivot',
    title: 'Title for pivot',
    rowDimension: 'region',
    columnDimension: 'plan',
    measures: ['revenue'],
    rows: byRegionPlan,
  },
};

// What each kind's body looks like in the HTML: chart.js kinds draw a canvas,
// the KPIs a value container, the rest a <table>. The donut is the exception
// among the chart.js kinds: it withholds the <canvas> until a resize observer
// has measured its container (>= 10px), which never happens without layout, so
// only its empty chart container is visible in server-rendered output.
const BODY: Record<ChartKind, RegExp> = {
  bar: /<canvas/,
  barHorizontal: /<canvas/,
  barGrouped: /<canvas/,
  barGroupedHorizontal: /<canvas/,
  barStacked: /<canvas/,
  barStackedHorizontal: /<canvas/,
  line: /<canvas/,
  lineGrouped: /<canvas/,
  lineWithKpiTabs: /<canvas/,
  lineComparison: /<canvas/,
  lineComparisonWithKpiTabs: /<canvas/,
  area: /<canvas/,
  barLine: /<canvas/,
  pie: /<canvas/,
  donut: /chartContainer/,
  donutLabel: /chartContainer/,
  scatter: /<canvas/,
  bubble: /<canvas/,
  kpi: /kpiChartContainer/,
  kpiComparison: /kpiChartContainer/,
  table: /<table/,
  heatmap: /<table/,
  pivot: /<table/,
};

// --- 1. every chart kind renders -------------------------------------------

describe('every chart kind renders from a minimal spec', () => {
  it('has a fixture for each of the 23 kinds', () => {
    expect(CHART_KINDS).toHaveLength(23);
    expect(Object.keys(SPECS).sort()).toEqual([...CHART_KINDS].sort());
    expect(Object.keys(BODY).sort()).toEqual([...CHART_KINDS].sort());
  });

  it.each(CHART_KINDS)('%s', (kind) => {
    const spec = SPECS[kind];
    // The spec is what an LLM tool call returns, so it must survive JSON.
    const html = render(JSON.parse(JSON.stringify(spec)));
    expect(html).not.toBe('');
    expect(html).toContain(spec.title);
    expect(html).toMatch(BODY[kind]);
    expect(html).not.toContain(ERROR_TITLE);
    expect(hasSkeleton(html)).toBe(false);
  });

  it('pivot with subRowDimension and subRows renders expandable rows', () => {
    const html = render({
      chart: 'pivot',
      title: 'Pivot with sub rows',
      rowDimension: 'region',
      columnDimension: 'plan',
      subRowDimension: 'country',
      measures: [{ name: 'revenue', title: 'Revenue' }],
      rows: byRegionPlan,
      subRows: [
        { region: 'EMEA', country: 'France', plan: 'Pro', revenue: 40 },
        { region: 'EMEA', country: 'Spain', plan: 'Pro', revenue: 30 },
      ],
    });
    expect(html).toContain('Pivot with sub rows');
    expect(html).toContain('<table');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain(ERROR_TITLE);
  });

  it('shows a field object title in place of the row key', () => {
    const html = render(SPECS.table);
    expect(html).toContain('Sort by Revenue');
    expect(html).not.toContain('Sort by revenue');
  });

  it('area charts render with and without groupBy', () => {
    const single = render(SPECS.area);
    expect(onlyChart(single).values).toEqual([[100, 140, 120]]);

    const stacked = render({
      chart: 'area',
      title: 'Stacked area',
      xAxis: 'month',
      groupBy: 'plan',
      measure: 'revenue',
      granularity: 'month',
      rows: byMonthPlan,
    });
    // Series are ordered by group value (Free, Pro), not row order.
    expect(onlyChart(stacked).values).toEqual([
      [40, 50, null],
      [60, 90, 70],
    ]);
  });

  it('kpi with the value shortcut shows the formatted value', () => {
    expect(render(SPECS.kpi)).toContain('1,234.5');
  });

  it('kpi accepts numeric-string values', () => {
    const html = render({ chart: 'kpi', title: 'KPI', measure: 'revenue', value: '1234.5' });
    expect(html).toContain('1,234.5');
  });

  it('kpiComparison shows the change when a comparison period is given', () => {
    const html = render({
      ...SPECS.kpiComparison,
      comparisonDateRange: { from: '2024-01-01', to: '2024-01-31' },
    });
    expect(html).toContain('<span>+10</span>');
  });

  it('kpiComparison shows a known comparison label', () => {
    const html = render({
      ...SPECS.kpiComparison,
      comparisonLabel: 'Previous period',
      comparisonDateRange: { from: '2024-01-01', to: '2024-01-31' },
    });
    expect(html).toContain('vs Previous period');
  });

  // BUG: KpiChartNumberComparisonPro drops resultsComparison unless
  // comparisonDateRange is truthy, and ChartFromSpec only sets that from
  // spec.comparisonDateRange. So the documented `value` + `comparisonValue`
  // shortcut (and `comparisonRows`) renders the plain KPI with no change badge.
  // The renderer should pass a truthy TimeRange whenever comparison data exists.
  it('kpiComparison shows the change for the comparisonValue shortcut alone', () => {
    const html = render(SPECS.kpiComparison);
    expect(html).toContain('<span>+10</span>');
  });

  // BUG: spec.comparisonLabel is passed as `comparisonPeriod`, which the
  // component only resolves against the theme's fixed period names. Any other
  // label ("Prior quarter") renders as an empty "vs ".
  it('kpiComparison shows a free-form comparisonLabel', () => {
    const html = render({
      ...SPECS.kpiComparison,
      comparisonLabel: 'Prior quarter',
      comparisonDateRange: { from: '2024-01-01', to: '2024-01-31' },
    });
    expect(html).toContain('vs Prior quarter');
  });
});

// --- 2. normalization ------------------------------------------------------

describe('normalization', () => {
  it('accepts date-only, epoch-ms and Z-suffixed time values', () => {
    // Mid-month, mid-day values: whichever zone the machine runs in, they stay
    // inside their month, so the monthly buckets are the same everywhere.
    const html = render({
      chart: 'line',
      title: 'Mixed time formats',
      xAxis: 'when',
      measures: 'revenue',
      granularity: 'month',
      rows: [
        { when: '2024-01-15', revenue: 1 },
        { when: Date.UTC(2024, 1, 15, 12), revenue: 2 },
        { when: '2024-03-15T12:00:00Z', revenue: 3 },
      ],
    });
    expect(html).toContain('Mixed time formats');
    expect(html).not.toContain(ERROR_TITLE);
    expect(hasCanvas(html)).toBe(true);
    // All three forms parsed as dates: one category per month, no raw
    // epoch number or "Z" string left behind as a label.
    expect(onlyChart(html).labels).toEqual([month(1), month(2), month(3)]);
  });

  it('infers a time axis from granularity when the xAxis type is omitted', () => {
    const html = render({
      chart: 'line',
      title: 'No type',
      xAxis: { name: 'when', title: 'When' },
      measures: [{ name: 'revenue', title: 'Revenue' }],
      granularity: 'month',
      rows: byMonth.map((row) => ({ when: row.month, revenue: row.revenue })),
    });
    expect(html).not.toContain(ERROR_TITLE);
    expect(onlyChart(html)).toEqual({
      labels: [month(1), month(2), month(3)],
      values: [[100, 140, 120]],
    });
  });

  it('feeds grouping charts through the name.granularity row key', () => {
    // Grouped bars read `${xAxis}.${granularity}`; the producer only supplies
    // `month`. If the renderer didn't duplicate it, no datasets would be built.
    const html = render({
      chart: 'barGrouped',
      title: 'Grouped over time',
      xAxis: 'month',
      groupBy: 'plan',
      measure: 'revenue',
      granularity: 'month',
      rows: byMonthPlan,
    });
    expect(html).toContain('Grouped over time');
    expect(html).not.toContain(ERROR_TITLE);
    // chart.js formats tick labels on the canvas, so the HTML carries the
    // month buckets as ISO strings rather than "Jan 2024".
    expect(onlyChart(html)).toEqual({
      labels: [month(1), month(2), month(3)],
      // Series are ordered by group value (Free, Pro), not row order.
      values: [
        [40, 50, 0],
        [60, 90, 70],
      ],
    });
  });

  it('feeds the same buckets to every grouping chart kind', () => {
    for (const chart of ['barStacked', 'barGroupedHorizontal', 'barStackedHorizontal', 'lineGrouped'] as const) {
      const html = render({
        chart,
        title: `Grouped ${chart}`,
        xAxis: 'month',
        groupBy: 'plan',
        measure: 'revenue',
        granularity: 'month',
        rows: byMonthPlan,
      });
      const { labels, values } = onlyChart(html);
      expect(labels, chart).toEqual([month(1), month(2), month(3)]);
      expect(values, chart).toHaveLength(2);
    }
  });

  it('coerces numeric-string measures to numbers', () => {
    const html = render({
      chart: 'bar',
      title: 'String measures',
      dimension: 'region',
      measures: 'revenue',
      rows: [
        { region: 'EMEA', revenue: '42.5' },
        { region: 'APAC', revenue: ' 7 ' },
        { region: 'AMER', revenue: 10 },
      ],
    });
    expect(html).not.toContain(ERROR_TITLE);
    expect(onlyChart(html)).toEqual({
      labels: ['EMEA', 'APAC', 'AMER'],
      values: [[42.5, 7, 10]],
    });
  });

  it('coerces numeric-string KPI and pie values', () => {
    const pie = render({
      chart: 'pie',
      title: 'String pie',
      dimension: 'region',
      measure: 'revenue',
      rows: [
        { region: 'EMEA', revenue: '3' },
        { region: 'APAC', revenue: '4.5' },
      ],
    });
    expect(onlyChart(pie).values).toEqual([[3, 4.5]]);
  });

  it('infers table column roles from the row values', () => {
    const html = render({
      chart: 'table',
      title: 'Inferred',
      columns: ['region', 'revenue'],
      rows: byRegion,
    });
    // Numbers are measures and right-aligned; strings are dimensions, left.
    expect(html).toContain('text-align:right');
    expect(html).toContain('text-align:left');
  });

  it('honours an explicit measure role on a numeric-string table column', () => {
    const rows = [
      { region: 'EMEA', revenue: '42.5' },
      { region: 'APAC', revenue: '7' },
    ];
    // Without a role the strings look like a dimension: left-aligned text.
    const inferred = render({ chart: 'table', title: 'No role', columns: ['revenue'], rows });
    expect(inferred).toContain('text-align:left');
    expect(inferred).not.toContain('text-align:right');

    // role: 'measure' coerces them to numbers: right-aligned.
    const explicit = render({
      chart: 'table',
      title: 'Explicit role',
      columns: [{ name: 'revenue', role: 'measure' }],
      rows,
    });
    expect(explicit).toContain('text-align:right');
    expect(explicit).not.toContain('text-align:left');
  });

  it('ignores a granularity it does not know', () => {
    const html = render({
      chart: 'bar',
      title: 'Odd granularity',
      dimension: 'region',
      measures: 'revenue',
      granularity: 'fortnight',
      rows: byRegion,
    });
    expect(html).not.toContain(ERROR_TITLE);
    expect(onlyChart(html).labels).toEqual(['EMEA', 'APAC', 'AMER']);
  });

  it('drops rows that are not objects', () => {
    const html = render({
      chart: 'bar',
      title: 'Junk rows',
      dimension: 'region',
      measures: 'revenue',
      rows: ['junk', 7, ['x'], { region: 'EMEA', revenue: 1 }, true, { region: 'APAC', revenue: 2 }],
    });
    expect(html).not.toContain(ERROR_TITLE);
    expect(onlyChart(html)).toEqual({ labels: ['EMEA', 'APAC'], values: [[1, 2]] });
  });

  // BUG: normalizeRows filters out non-object rows, but the untyped-field type
  // inference (inferType -> firstValue) runs first over the raw rows and does
  // `r[name]` on every entry, so a null/undefined row throws a TypeError
  // ("Cannot read properties of null"). The spec still ends up as an error card
  // (the validated path is try/caught), but the data is lost to one stray null.
  it('drops null rows instead of failing', () => {
    const html = render({
      chart: 'bar',
      title: 'Null rows',
      dimension: 'region',
      measures: 'revenue',
      rows: [null, { region: 'EMEA', revenue: 1 }, undefined, { region: 'APAC', revenue: 2 }],
    });
    expect(html).not.toContain(ERROR_TITLE);
    expect(onlyChart(html)).toEqual({ labels: ['EMEA', 'APAC'], values: [[1, 2]] });
  });

  // BUG: time values are not snapped to the start of their granularity bucket,
  // and the components' gap filling only matches bucket-start keys exactly. A
  // monthly chart fed '2024-01-15' draws the right month labels but zero-height
  // bars, silently dropping the data. Date-only strings are an advertised input
  // format ("accepts YYYY-MM-DD"), so the normalizer should startOf(granularity).
  it('snaps time values to their granularity bucket', () => {
    const html = render({
      chart: 'bar',
      title: 'Mid-month dates',
      dimension: 'when',
      measures: 'revenue',
      granularity: 'month',
      rows: [
        { when: '2024-01-15', revenue: 1 },
        { when: '2024-02-15', revenue: 2 },
        { when: '2024-03-15', revenue: 3 },
      ],
    });
    expect(onlyChart(html).values).toEqual([[1, 2, 3]]);
  });

  // BUG: Z-suffixed strings and epoch milliseconds are formatted in the
  // machine's local zone (dayjs(v).format), but the components read zone-less
  // values as UTC (gap filling uses dayjs.utc). Month-start UTC timestamps are
  // shifted off the bucket start (zeroing the bars) or, west of UTC, into the
  // previous month (e.g. a "Dec 2023" bucket under America/New_York). The
  // result depends on the viewer's timezone; it should use dayjs.utc. Passes
  // today only when the test process runs with TZ=UTC.
  it('keeps the UTC wall-clock of Z-suffixed and epoch values', () => {
    const html = render({
      chart: 'bar',
      title: 'UTC month starts',
      dimension: 'when',
      measures: 'revenue',
      granularity: 'month',
      rows: [
        { when: '2024-01-01T00:00:00Z', revenue: 1 },
        { when: Date.UTC(2024, 1, 1), revenue: 2 },
        { when: '2024-03-01T00:00:00.000Z', revenue: 3 },
      ],
    });
    expect(onlyChart(html)).toEqual({
      labels: [month(1), month(2), month(3)],
      values: [[1, 2, 3]],
    });
  });
});

// --- 3. fallbacks: never blank ---------------------------------------------

describe('fallbacks', () => {
  it('renders an unknown chart kind with rows as a table', () => {
    const html = render({
      chart: 'sparkline',
      title: 'Unknown kind',
      rows: [
        { alpha: 1, beta: 'x' },
        { alpha: 2, beta: 'y' },
      ],
    });
    expect(html).toContain('Unknown kind');
    expect(html).toContain('<table');
    expect(html).toContain('Sort by alpha');
    expect(html).toContain('Sort by beta');
    expect(html).toContain('title="x"');
    expect(html).not.toContain(ERROR_TITLE);
  });

  // BUG: the unknown-kind table fallback runs outside the try/catch that guards
  // the validated path, and only checks `typeof rows[0] === 'object'` (true for
  // null). `Object.keys(null)` or a null entry anywhere in rows (inferType) then
  // throws out of the render, so React unmounts the tree: no card at all. The
  // fallback should be guarded like the rest ("a bad spec must always produce
  // something visible").
  it('does not throw for an unknown kind whose rows contain null', () => {
    expect(() => render({ chart: 'sparkline', title: 'Null first row', rows: [null] })).not.toThrow();
    expect(() =>
      render({ chart: 'sparkline', title: 'Null later row', rows: [{ alpha: 1 }, null] }),
    ).not.toThrow();
    expect(render({ chart: 'sparkline', title: 'Null first row', rows: [null] })).toContain(ERROR_TITLE);
  });

  it('forwards spec.error through the table fallback', () => {
    const html = render({
      chart: 'sparkline',
      title: 'Unknown kind',
      error: 'upstream failed',
      rows: [{ alpha: 1 }],
    });
    expect(html).toContain(ERROR_TITLE);
    expect(html).toContain('upstream failed');
  });

  it('renders an error card for an unknown kind without rows', () => {
    const html = render({ chart: 'sparkline', title: 'Unknown kind' });
    expect(html).toContain('Unknown kind');
    expect(html).toContain(ERROR_TITLE);
    expect(decode(html)).toContain('Unknown chart kind "sparkline"');
  });

  it('renders an error card for an unknown kind with empty rows', () => {
    const html = render({ chart: 'sparkline', rows: [] });
    expect(html).toContain(ERROR_TITLE);
  });

  it('renders an error card when the chart kind is missing entirely', () => {
    const html = render({ title: 'No kind', dimension: 'region' });
    expect(html).toContain(ERROR_TITLE);
    expect(html).toContain('No kind');
  });

  it('renders an error card naming the missing required field', () => {
    const html = render({ chart: 'bar', title: 'Missing dimension', measures: ['x'] });
    expect(html).toContain('Missing dimension');
    expect(html).toContain(ERROR_TITLE);
    expect(decode(html)).toContain('Invalid "bar" spec: missing "dimension"');
  });

  it('lists every missing required field', () => {
    const html = render({ chart: 'barGrouped', rows: byRegionPlan });
    const text = decode(html);
    expect(html).toContain(ERROR_TITLE);
    for (const field of ['xAxis', 'groupBy', 'measure']) expect(text).toContain(`missing "${field}"`);
  });

  it('treats an empty measures array as missing', () => {
    const html = render({ chart: 'bar', dimension: 'region', measures: [], rows: byRegion });
    expect(html).toContain(ERROR_TITLE);
    expect(decode(html)).toContain('missing "measures"');
  });

  it.each(CHART_KINDS)('%s: a spec with only its kind is an error card, not a throw', (kind) => {
    const html = render({ chart: kind });
    expect(html).not.toBe('');
    expect(html).toContain(ERROR_TITLE);
  });

  it('renders an error card when rows is not an array', () => {
    const html = render({
      chart: 'bar',
      title: 'Bad rows',
      dimension: 'region',
      measures: 'revenue',
      rows: 'nonsense' as never,
    });
    expect(html).toContain('Bad rows');
    expect(html).toContain(ERROR_TITLE);
    expect(decode(html)).toContain('"rows" must be an array of objects');
  });

  it('renders an error card when the spec is not an object', () => {
    for (const spec of [null, undefined, 'bar', 42]) {
      const html = render(spec);
      expect(html, String(spec)).toContain(ERROR_TITLE);
      expect(decode(html), String(spec)).toContain('The chart spec must be an object.');
    }
  });

  it('shows spec.error as the error card message', () => {
    const html = render({ ...SPECS.bar, error: 'query timed out' });
    expect(html).toContain(ERROR_TITLE);
    expect(html).toContain('query timed out');
    expect(hasCanvas(html)).toBe(false);
  });

  it('spec.error wins over rows on every table-like kind too', () => {
    for (const kind of ['table', 'heatmap', 'pivot', 'kpi'] as const) {
      const html = render({ ...SPECS[kind], error: 'query timed out' });
      expect(html, kind).toContain('query timed out');
    }
  });

  it('shows the empty state for an empty rows array', () => {
    const html = render({ ...SPECS.bar, rows: [] });
    expect(html).toContain('No results');
    expect(html).not.toContain(ERROR_TITLE);
  });
});

// --- 4. chrome modes -------------------------------------------------------

describe('chrome', () => {
  const spec = { ...SPECS.bar, title: 'Quarterly revenue' } as ChartSpec;

  it('card (default) shows the title and the export menu', () => {
    const html = render(spec);
    expect(html).toContain('Quarterly revenue');
    expect(hasMenuIcon(html)).toBe(true);
    expect(hasCanvas(html)).toBe(true);
  });

  it('card is the default chrome', () => {
    expect(render(spec, { chrome: 'card' })).toBe(render(spec));
  });

  it('plain keeps the title but drops the export menu', () => {
    const html = render(spec, { chrome: 'plain' });
    expect(html).toContain('Quarterly revenue');
    expect(hasMenuIcon(html)).toBe(false);
    expect(hasCanvas(html)).toBe(true);
  });

  it('bare removes the header but still renders the chart body', () => {
    const html = render(spec, { chrome: 'bare' });
    expect(html).not.toContain('Quarterly revenue');
    expect(html).not.toContain('<h1');
    expect(hasMenuIcon(html)).toBe(false);
    expect(hasCanvas(html)).toBe(true);
  });

  it('bare flattens the card from a wrapper using card CSS variables', () => {
    const html = render(spec, { chrome: 'bare' });
    expect(html.startsWith('<div style="')).toBe(true);
    expect(html).toContain('--em-card-padding:0');
    expect(html).toContain('--em-card-border-width:0');
    expect(html).toContain('--em-card-background:transparent');
  });

  it('bare still renders tables and KPIs', () => {
    const table = render(SPECS.table, { chrome: 'bare' });
    expect(table).toContain('<table');
    expect(table).not.toContain(SPECS.table.title!);

    const kpi = render(SPECS.kpi, { chrome: 'bare' });
    expect(kpi).toContain('1,234.5');
  });

  it('plain and bare keep the error card readable', () => {
    for (const chrome of ['plain', 'bare'] as const) {
      const html = render({ chart: 'bar', measures: ['x'] }, { chrome });
      expect(html, chrome).toContain(ERROR_TITLE);
    }
  });

  it('height sets a fixed-height wrapper', () => {
    const html = render(spec, { height: 320 });
    expect(html).toContain('style="height:320px"');
    expect(html).toContain('Quarterly revenue');
  });

  it('has no wrapper element without height or bare chrome', () => {
    expect(render(spec).startsWith('<div class="')).toBe(true);
    expect(render(spec)).not.toContain('style="height');
  });

  it('height combines with bare chrome on one wrapper', () => {
    const html = render(spec, { chrome: 'bare', height: 240 });
    expect(html).toContain('height:240px');
    expect(html).toContain('--em-card-padding:0');
    expect(html.match(/<div style=/g)).toHaveLength(1);
  });
});

// --- 5. streaming ----------------------------------------------------------

describe('streaming', () => {
  const base = {
    chart: 'bar',
    title: 'Streaming revenue',
    dimension: 'region',
    measures: 'revenue',
  } as const;

  it('renders the chart, not the skeleton, when loading with rows present', () => {
    const html = render({ ...base, rows: byRegion, loading: true });
    expect(hasSkeleton(html)).toBe(false);
    expect(hasCanvas(html)).toBe(true);
    expect(html).toContain('Streaming revenue');
    expect(html).not.toContain(ERROR_TITLE);
    expect(onlyChart(html).labels).toEqual(['EMEA', 'APAC', 'AMER']);
  });

  it('shows the header spinner while loading with rows, and hides it when done', () => {
    expect(spinnerVisible(render({ ...base, rows: byRegion, loading: true }))).toBe(true);
    expect(spinnerVisible(render({ ...base, rows: byRegion, loading: false }))).toBe(false);
    expect(spinnerVisible(render({ ...base, rows: byRegion }))).toBe(false);
  });

  it('shows the skeleton when there are no rows yet', () => {
    const html = render({ ...base, rows: undefined });
    expect(hasSkeleton(html)).toBe(true);
    expect(hasCanvas(html)).toBe(false);
    expect(html).toContain('Streaming revenue');
    expect(html).not.toContain(ERROR_TITLE);
  });

  it('shows the skeleton when loading without rows', () => {
    const html = render({ ...base, loading: true });
    expect(hasSkeleton(html)).toBe(true);
    expect(hasCanvas(html)).toBe(false);
  });

  it('shows the skeleton when loading with an empty rows array', () => {
    const html = render({ ...base, rows: [], loading: true });
    expect(hasSkeleton(html)).toBe(true);
    expect(hasCanvas(html)).toBe(false);
  });

  it('streams rows into a chart across three frames, then settles', () => {
    const frames: { rows: SpecRow[]; loading: boolean }[] = [
      { rows: byRegion.slice(0, 1), loading: true },
      { rows: byRegion.slice(0, 2), loading: true },
      { rows: byRegion, loading: false },
    ];
    const expectedLabels = [['EMEA'], ['EMEA', 'APAC'], ['EMEA', 'APAC', 'AMER']];

    let spec: ChartSpec = { ...base, rows: [], loading: true };
    frames.forEach((frame, index) => {
      spec = { ...spec, ...frame };
      const html = render(spec);
      expect(html, `frame ${index}`).not.toBe('');
      expect(html, `frame ${index}`).not.toContain(ERROR_TITLE);
      expect(html, `frame ${index}`).toContain('Streaming revenue');
      expect(hasSkeleton(html), `frame ${index}`).toBe(false);
      expect(onlyChart(html).labels, `frame ${index}`).toEqual(expectedLabels[index]);
      expect(spinnerVisible(html), `frame ${index}`).toBe(frame.loading);
    });
  });

  it('streams every chart kind that takes rows without erroring', () => {
    for (const kind of CHART_KINDS) {
      const spec = SPECS[kind];
      if (!('rows' in spec) || !spec.rows) continue;
      const partial = render({ ...spec, rows: spec.rows.slice(0, 1), loading: true });
      expect(partial, kind).not.toContain(ERROR_TITLE);
      expect(hasSkeleton(partial), kind).toBe(false);
      const done = render({ ...spec, loading: false });
      expect(done, kind).not.toContain(ERROR_TITLE);
    }
  });

  it('streams a table: rows appear while loading', () => {
    const html = render({ ...SPECS.table, rows: byRegion.slice(0, 2), loading: true });
    expect(html).toContain('<table');
    expect(hasSkeleton(html)).toBe(false);
    expect(spinnerVisible(html)).toBe(true);
  });

  it('streams a time series: later batches add buckets', () => {
    const line = (rows: SpecRow[], loading: boolean) =>
      render({ ...SPECS.line, rows, loading });

    const first = onlyChart(line(byMonth.slice(0, 1), true));
    expect(first.labels).toEqual([month(1)]);

    const second = onlyChart(line(byMonth.slice(0, 2), true));
    expect(second.labels).toEqual([month(1), month(2)]);

    const done = onlyChart(line(byMonth, false));
    expect(done.labels).toEqual([month(1), month(2), month(3)]);
    expect(done.values).toEqual([
      [100, 140, 120],
      [10, 14, 11],
    ]);
  });

  it('spec.error overrides loading', () => {
    const html = render({ ...base, rows: byRegion, loading: true, error: 'stream aborted' });
    expect(html).toContain(ERROR_TITLE);
    expect(html).toContain('stream aborted');
    expect(hasCanvas(html)).toBe(false);
  });
});

// --- 6. intents ------------------------------------------------------------

describe('intentToPrompt', () => {
  it('describes a segment click with dimension, value and chart title', () => {
    const intent: ChartIntent = {
      type: 'segment-click',
      chart: 'donut',
      title: 'Revenue by region',
      dimension: 'region',
      value: 'EMEA',
    };
    expect(intentToPrompt(intent)).toBe(
      'The user clicked region "EMEA" on the "Revenue by region" chart. Drill into it.',
    );
  });

  it('describes a cell click with a group dimension and value', () => {
    const intent: ChartIntent = {
      type: 'cell-click',
      chart: 'heatmap',
      dimension: 'region',
      value: 'EMEA',
      groupDimension: 'plan',
      groupValue: 'Pro',
    };
    expect(intentToPrompt(intent)).toBe('The user clicked region "EMEA" × plan "Pro". Drill into it.');
  });

  it('describes a cell click on a titled chart', () => {
    const intent: ChartIntent = {
      type: 'cell-click',
      chart: 'heatmap',
      title: 'Usage',
      dimension: 'region',
      value: 'EMEA',
      groupDimension: 'plan',
      groupValue: 'Pro',
    };
    expect(intentToPrompt(intent)).toBe(
      'The user clicked region "EMEA" × plan "Pro" on the "Usage" chart. Drill into it.',
    );
  });

  it('includes the time range of a clicked bucket', () => {
    const intent: ChartIntent = {
      type: 'bar-click',
      chart: 'bar',
      title: 'Signups',
      dimension: 'month',
      timeRange: { from: '2024-03-01T00:00:00.000', to: '2024-03-31T23:59:59.999' },
    };
    expect(intentToPrompt(intent)).toBe(
      'The user clicked on the "Signups" chart (2024-03-01T00:00:00.000 to 2024-03-31T23:59:59.999). Drill into it.',
    );
  });

  it('puts the time range after the clicked value', () => {
    const intent: ChartIntent = {
      type: 'line-click',
      chart: 'line',
      title: 'Signups',
      dimension: 'month',
      value: '2024-03-01T00:00:00.000',
      timeRange: { from: '2024-03-01T00:00:00.000', to: '2024-03-31T23:59:59.999' },
    };
    expect(intentToPrompt(intent)).toBe(
      'The user clicked month "2024-03-01T00:00:00.000" on the "Signups" chart (2024-03-01T00:00:00.000 to 2024-03-31T23:59:59.999). Drill into it.',
    );
  });

  it('uses an ellipsis for an open-ended time range', () => {
    expect(
      intentToPrompt({ type: 'bar-click', chart: 'bar', timeRange: { from: '2024-03-01T00:00:00.000' } }),
    ).toBe('The user clicked (2024-03-01T00:00:00.000 to …). Drill into it.');
    expect(
      intentToPrompt({ type: 'bar-click', chart: 'bar', timeRange: { to: '2024-03-31T23:59:59.999' } }),
    ).toBe('The user clicked (… to 2024-03-31T23:59:59.999). Drill into it.');
  });

  it('falls back to a generic sentence with only a type and chart', () => {
    expect(intentToPrompt({ type: 'row-click', chart: 'table' })).toBe('The user clicked. Drill into it.');
  });

  it('keeps the chart title in the generic fallback', () => {
    expect(intentToPrompt({ type: 'row-click', chart: 'table', title: 'Orders' })).toBe(
      'The user clicked on the "Orders" chart. Drill into it.',
    );
  });

  it('does not quote numbers and booleans', () => {
    expect(intentToPrompt({ type: 'point-click', chart: 'scatter', dimension: 'count', value: 42 })).toBe(
      'The user clicked count 42. Drill into it.',
    );
    expect(intentToPrompt({ type: 'bar-click', chart: 'bar', dimension: 'active', value: false })).toBe(
      'The user clicked active false. Drill into it.',
    );
  });

  it('ignores a value without a dimension, and a null value', () => {
    expect(intentToPrompt({ type: 'bar-click', chart: 'bar', value: 'EMEA' })).toBe(
      'The user clicked. Drill into it.',
    );
    expect(intentToPrompt({ type: 'bar-click', chart: 'bar', dimension: 'region', value: null })).toBe(
      'The user clicked. Drill into it.',
    );
  });

  it('describes a group-only click', () => {
    expect(
      intentToPrompt({
        type: 'area-click',
        chart: 'area',
        title: 'Plans',
        groupDimension: 'plan',
        groupValue: 'Pro',
      }),
    ).toBe('The user clicked plan "Pro" on the "Plans" chart. Drill into it.');
  });
});
