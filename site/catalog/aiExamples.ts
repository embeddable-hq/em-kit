import type { ChartSpec } from '../../src';

// Example specs for the "Use with AI" playground. The valid ones are checked
// against ChartSpec at compile time; the last two are deliberately not.

export type AiExample = { id: string; label: string; hint: string; spec: unknown };

const money = { prefix: '$', decimalPlaces: 0 };

const regionRevenue = [
  { region: 'North America', revenue: 420600 },
  { region: 'Europe', revenue: 360100 },
  { region: 'Asia Pacific', revenue: 250500 },
  { region: 'Latin America', revenue: 82000 },
  { region: 'Middle East', revenue: 36400 },
  { region: 'Africa', revenue: 23900 },
];

const donut = {
  chart: 'donut',
  title: 'Revenue by region',
  description: 'Last quarter',
  dimension: { name: 'region', title: 'Region' },
  measure: { name: 'revenue', title: 'Revenue', format: money },
  rows: regionRevenue,
  options: { showLegend: true, showTooltips: true },
} satisfies ChartSpec;

// Date-only strings on a time axis: the renderer normalizes them.
const barOverTime = {
  chart: 'bar',
  title: 'Orders per month',
  dimension: { name: 'ordered_at', title: 'Month' },
  measures: [{ name: 'orders', title: 'Orders' }],
  granularity: 'month',
  rows: [
    { ordered_at: '2026-04-01', orders: 1840 },
    { ordered_at: '2026-05-01', orders: 2015 },
    { ordered_at: '2026-06-01', orders: 1960 },
    { ordered_at: '2026-07-01', orders: 2230 },
    { ordered_at: '2026-08-01', orders: 2410 },
    { ordered_at: '2026-09-01', orders: 2675 },
  ],
  options: { showTooltips: true, showValueLabels: true },
} satisfies ChartSpec;

const kpiComparison = {
  chart: 'kpiComparison',
  title: 'Revenue',
  description: 'Last 30 days',
  measure: { name: 'revenue', title: 'Revenue', format: money },
  value: 128400,
  comparisonValue: 114900,
  comparisonLabel: 'Previous 30 days',
  dateRange: { from: '2026-09-02', to: '2026-10-01' },
  comparisonDateRange: { from: '2026-08-03', to: '2026-09-01' },
  options: { displayChangeAsPercentage: true },
} satisfies ChartSpec;

const table = {
  chart: 'table',
  title: 'Top accounts',
  columns: [
    { name: 'account', title: 'Account' },
    { name: 'region', title: 'Region' },
    { name: 'seats', title: 'Seats' },
    { name: 'revenue', title: 'Revenue', format: money },
  ],
  rows: [
    { account: 'Northwind', region: 'Europe', seats: 240, revenue: 96400 },
    { account: 'Globex', region: 'North America', seats: 310, revenue: 88200 },
    { account: 'Initech', region: 'North America', seats: 180, revenue: 61500 },
    { account: 'Hooli', region: 'Asia Pacific', seats: 150, revenue: 54800 },
    { account: 'Umbrella', region: 'Europe', seats: 95, revenue: 39100 },
    { account: 'Soylent', region: 'Latin America', seats: 60, revenue: 22700 },
    { account: 'Stark Industries', region: 'North America', seats: 420, revenue: 118900 },
    { account: 'Wayne Enterprises', region: 'Europe', seats: 275, revenue: 101300 },
  ],
} satisfies ChartSpec;

// Two measures, six months and the six before them. `kpiRows` (the tab
// numbers) and both date ranges are left out: the renderer derives them from
// the rows.
const tabbedComparison = {
  chart: 'lineComparisonWithKpiTabs',
  title: 'Revenue and orders',
  description: 'Last 6 months against the 6 before',
  xAxis: { name: 'ordered_at', title: 'Month' },
  measures: [
    { name: 'revenue', title: 'Revenue', format: money },
    { name: 'orders', title: 'Orders' },
  ],
  granularity: 'month',
  comparisonLabel: 'Previous period',
  rows: [
    { ordered_at: '2026-04-01', revenue: 98200, orders: 1840 },
    { ordered_at: '2026-05-01', revenue: 104500, orders: 2015 },
    { ordered_at: '2026-06-01', revenue: 101300, orders: 1960 },
    { ordered_at: '2026-07-01', revenue: 115800, orders: 2230 },
    { ordered_at: '2026-08-01', revenue: 124600, orders: 2410 },
    { ordered_at: '2026-09-01', revenue: 138900, orders: 2675 },
  ],
  comparisonRows: [
    { ordered_at: '2025-10-01', revenue: 81400, orders: 1520 },
    { ordered_at: '2025-11-01', revenue: 88700, orders: 1685 },
    { ordered_at: '2025-12-01', revenue: 96300, orders: 1810 },
    { ordered_at: '2026-01-01', revenue: 84900, orders: 1590 },
    { ordered_at: '2026-02-01', revenue: 90200, orders: 1730 },
    { ordered_at: '2026-03-01', revenue: 95100, orders: 1795 },
  ],
  options: { showTooltips: true },
} satisfies ChartSpec;

// The center number is `innerLabel.value`, which defaults to the sum of the
// rows, so only the caption is written out.
const donutWithTotal = {
  chart: 'donutLabel',
  title: 'Revenue by region',
  description: 'Last quarter',
  dimension: { name: 'region', title: 'Region' },
  measure: { name: 'revenue', title: 'Revenue', format: money },
  innerLabel: { text: 'Total revenue' },
  rows: regionRevenue,
  options: { showLegend: true, showTooltips: true },
} satisfies ChartSpec;

// An unknown `chart` with rows still shows the data: the renderer falls back
// to a table over the row keys.
const unknownKind = {
  chart: 'sparkline',
  title: 'Signups per week',
  rows: [
    { week: '2026-09-07', signups: 120 },
    { week: '2026-09-14', signups: 138 },
    { week: '2026-09-21', signups: 151 },
    { week: '2026-09-28', signups: 177 },
  ],
};

// A bar chart with no `dimension`: the renderer names the missing field in the
// error card instead of throwing.
const broken = {
  chart: 'bar',
  title: 'Orders by month',
  measures: ['orders'],
  rows: [
    { month: '2026-08-01', orders: 2410 },
    { month: '2026-09-01', orders: 2675 },
  ],
};

export const aiExamples: AiExample[] = [
  { id: 'donut', label: 'Donut', hint: 'Shares of a whole', spec: donut },
  { id: 'bar', label: 'Bar over time', hint: 'Time axis with granularity', spec: barOverTime },
  { id: 'kpi', label: 'KPI comparison', hint: 'One number against another period', spec: kpiComparison },
  { id: 'table', label: 'Table', hint: 'Row-level detail', spec: table },
  {
    id: 'tabbedComparison',
    label: 'Tabbed comparison',
    hint: 'KPI tabs, this period against the last',
    spec: tabbedComparison,
  },
  { id: 'donutTotal', label: 'Donut with total', hint: 'A headline number in the center', spec: donutWithTotal },
  { id: 'unknown', label: 'Unknown kind', hint: 'Falls back to a table', spec: unknownKind },
  { id: 'broken', label: 'Broken spec', hint: 'Shows the error card', spec: broken },
];

const isPrimitive = (value: unknown) => value === null || typeof value !== 'object';

// JSON.stringify with one line per row: flat objects and arrays of primitives
// stay inline, so a spec with a dozen rows is a dozen lines, not sixty.
export const toJson = (value: unknown, depth = 0): string => {
  const pad = '  '.repeat(depth);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.every(isPrimitive)) return `[${value.map((v) => JSON.stringify(v)).join(', ')}]`;
    return `[\n${value.map((v) => `${pad}  ${toJson(v, depth + 1)}`).join(',\n')}\n${pad}]`;
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value);
    if (entries.length === 0) return '{}';
    if (entries.every(([, v]) => isPrimitive(v))) {
      return `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ')} }`;
    }
    return `{\n${entries.map(([k, v]) => `${pad}  ${JSON.stringify(k)}: ${toJson(v, depth + 1)}`).join(',\n')}\n${pad}}`;
  }
  return JSON.stringify(value);
};
