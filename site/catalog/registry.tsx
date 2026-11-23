import type * as Charts from '../../src';
// The two values used here, from their own modules: the package's index would bring in every component.
import { dateRangePreset, measure } from '../../src/data';
import { TABLE_SCROLLABLE_SIZE } from '../../src/generated/components/charts/tables/TableScrollable/TableScrollable.utils';
import type { DataResponse, FieldInputs, Granularity } from '../../src';
import { datasets, extraField, fixedTime, shortenInputs, WINDOWS } from './datasets';
import type { Dataset, DateWindow, ExtraSlot, FieldSpec, Row } from './datasets';
import { chartTitle, fieldLabelKey, labelKey } from './translations';

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
  // One statement, or several.
  declare?: string | string[];
  // The declaration is sample data (a date range), printed with the rows after the component.
  data?: boolean;
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
  // `all` is every row behind a table that pages, as `allResults` takes them:
  // without it the card menu's downloads wait and never finish.
  table: { state: CodeRef; setState: CodeRef; rows: CodeRef; total: CodeRef; all: (rows: Row[]) => CodeRef };
  toggles: Record<string, boolean>;
  title: string;
  // A control's value, held in state: the preview keeps it and the code
  // declares it with useState. `type` is the state's type where the initial
  // value does not say it (import it from the package with `imports`), and
  // `initialCode` prints the initial value as a call.
  state: (name: string, initial: unknown, options?: StateOptions) => { value: CodeRef; set: CodeRef };
};

export type StateOptions = { type?: string; imports?: string[]; initialCode?: string };

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
  // A card this many pixels wide, for a preset about a small card: its code
  // gives the wrapper this width, and the page and playground draw it so.
  width?: number;
  // Shown on the component's docs page only, not as a gallery card, so the
  // gallery stays one screen per group.
  docsOnly?: boolean;
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
  // A card this many pixels wide in every example (a KPI tile): its code gives
  // the wrapper this width, and the page and playground draw it so. A preset's
  // own `width` wins.
  width?: number;
  // The preset the components index shows instead of the default, for a
  // component whose default needs a page's width (see cardExample in ComponentsIndex).
  cardVariant?: string;
};

// Each toggle starts at the component's own default (componentDefaults), so a
// usage example prints none of them: it shows the component as it comes.
const T = {
  legend: { key: 'showLegend', label: 'Legend', default: true },
  tooltips: { key: 'showTooltips', label: 'Tooltips', default: true },
  valueLabels: { key: 'showValueLabels', label: 'Value labels', default: true },
  log: { key: 'showLogarithmicScale', label: 'Log scale', default: false },
  reverseX: { key: 'reverseXAxis', label: 'Reverse x-axis', default: false },
  comparisonAxis: { key: 'showComparisonAxis', label: 'Comparison axis', default: true },
  totals: { key: 'showTotalLabels', label: 'Total labels', default: false },
  pointLabels: { key: 'showPointLabels', label: 'Point labels', default: false },
  values: { key: 'showValues', label: 'Cell values', default: true },
  index: { key: 'showIndex', label: 'Row index', default: true },
  changePercent: { key: 'displayChangeAsPercentage', label: 'Change as %', default: false },
  hideMenu: { key: 'hideMenu', label: 'Hide header', default: false },
  sectionLabels: { key: 'showSectionLabels', label: 'Step labels', default: false },
  stepPercent: { key: 'displayPercentages', label: 'Values as %', default: false },
} satisfies Record<string, Toggle>;

// Grouped and stacked bars leave their values off unless asked.
const noValueLabels = { ...T.valueLabels, default: false };

// The one default the usage examples turn off, on lines, areas and points: a
// value label sits centred over its point, so the first runs into the value
// axis's labels, and on a scatter "(x, y)" labels cover each other.
const quietPoints = { ...T.valueLabels, default: false };

// And on a bar and line combo the bars' labels: the line starts at the top of
// the tallest bar and runs through its label, so only the line is labelled.
const plainBars = { ...T.valueLabels, default: false };

const pick = (ctx: BuildContext, toggles: Toggle[]) =>
  Object.fromEntries(toggles.map((t) => [t.key, ctx.toggles[t.key] ?? t.default]));

const cartesian = [T.legend, T.tooltips, T.valueLabels, T.log, T.reverseX, T.hideMenu];
const lines = [T.legend, T.tooltips, quietPoints, T.log, T.reverseX, T.hideMenu];
const lineComparison = [T.legend, T.tooltips, quietPoints, T.log, T.reverseX, T.comparisonAxis, T.hideMenu];

// ---- Fields ------------------------------------------------------------------

// The column each field reads, by slot.
const names = (ds: Dataset) => ({
  category: ds.specs.category.name,
  group: ds.specs.group.name,
  time: ds.specs.time.name,
  primary: ds.specs.primary.name,
  secondary: ds.specs.secondary.name,
  stage: ds.specs.stage.name,
  segment: ds.extra.segment.name,
  pair: ds.extra.pair.name,
  activity: ds.extra.activity.name,
  rate: ds.extra.rate.name,
  funnel: ds.extra.funnel.name,
  entity: ds.extra.entity.name,
  cluster: ds.extra.cluster.name,
  x: ds.extra.x.name,
  y: ds.extra.y.name,
  bubble: ds.extra.bubble.name,
});

// One of the dataset's extra fields (see ExtraSlot in datasets.ts).
const extra = (ctx: BuildContext, slot: ExtraSlot): CodeRef => ({
  __code: ctx.ds.extra[slot].varName,
  value: extraField(ctx.ds, slot),
});

// The time dimension at a set granularity, with no picker in the card.
const timeAt = (ctx: BuildContext, granularity: Granularity): CodeRef => ({
  __code: ctx.ds.specs.time.varName,
  value: fixedTime(ctx.ds, granularity),
});

// Thousands and millions shortened (1.2M), on the axis, labels and tooltips alike.
const compact = (ref: CodeRef) => withInputs(ref, shortenInputs((ref.value as { inputs?: FieldInputs }).inputs));

// ---- Rows --------------------------------------------------------------------

// Rows holding only the named columns, as the query behind one chart would
// return them. A time column keeps its per-granularity twin (`name.month`).
const keep = (rows: Row[], ...columns: string[]): Row[] =>
  rows.map(
    (row) =>
      Object.fromEntries(
        Object.entries(row).filter(([key]) => columns.some((c) => key === c || key.startsWith(`${c}.`))),
      ) as Row,
  );

const sumOf = (rows: Row[], column: string) => rows.reduce((sum, row) => sum + Number(row[column] ?? 0), 0);

// One row of totals, for a KPI or a donut's centre.
const totalsRow = (rows: Row[], ...columns: string[]): Row =>
  Object.fromEntries(columns.map((column) => [column, sumOf(rows, column)]));

// A round number at or above `value`, for a pinned axis.
const roundUp = (value: number) => {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(value, 1)));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= value) ?? 10;
  return step * magnitude;
};

// A round number at or below `value`, for an axis that starts above zero.
const roundDown = (value: number) => {
  const step = 10 ** Math.floor(Math.log10(Math.max(value, 1))) / 2;
  return Math.floor(value / step) * step;
};

// A fixed window as the components take it: two dates. (A range can also
// carry relativeTimeString, a preset such as "Last 30 days"; fixed dates need none.)
const rangeRef = (varName: string, window: DateWindow): CodeRef => ({
  __code: varName,
  value: { from: new Date(window.from), to: new Date(window.to) },
  declare: `const ${varName} = { from: new Date('${window.from}'), to: new Date('${window.to}') };`,
  data: true,
});

// The earlier period is drawn in the same colour as the current one unless the
// measure says otherwise, so the comparison charts dash it and grey it.
const againstPrevious = (ref: CodeRef) => withInputs(ref, { previousLineDashed: true, previousLineColor: '#a1a1aa' });

// TableScrollable accumulates the pages it is given: it appends each new
// `results` and starts again when the sort or resetKey changes. So a page must
// keep its identity between builds (a rebuild with the same page would
// otherwise append it again), and a new query must be served from page 0.
const scrollablePages = new Map<string, Row[]>();
const scrollableQuery = { current: '' };

const scrollablePage = (ds: Dataset, state: TableState): Row[] => {
  const n = names(ds);
  // Ignore a sort left over from a dataset whose columns have other names.
  const first = ds.byTime('day')[0];
  const sort = state.sort && first && state.sort.id in first ? state.sort : undefined;
  const query = `${ds.id}|${sort?.id ?? ''}|${sort?.direction ?? ''}`;
  const page = query === scrollableQuery.current ? state.page : 0;
  scrollableQuery.current = query;
  const key = `${query}|${page}`;
  if (!scrollablePages.has(key)) {
    const all = keep(ds.byTime('day'), n.time, n.primary, n.secondary);
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
    const size = TABLE_SCROLLABLE_SIZE;
    scrollablePages.set(key, ordered.slice(page * size, (page + 1) * size));
  }
  return scrollablePages.get(key)!;
};

// The segment by group cross-tab, a segment at a time.
const bySegmentThenGroup = (ds: Dataset): Row[] => {
  const segment = ds.extra.segment.name;
  const order = ds.bySegment.map((row) => row[segment]);
  return [...ds.byGroupSegment].sort((a, b) => order.indexOf(a[segment]!) - order.indexOf(b[segment]!));
};

// The sample period by month for the auto-height table: few enough rows to
// show whole. One array per dataset, because the table appends any new page it is given.
const monthPages = new Map<string, Row[]>();
const monthRows = (ds: Dataset): Row[] => {
  const n = names(ds);
  if (!monthPages.has(ds.id)) monthPages.set(ds.id, keep(ds.byTime('month'), n.time, n.primary, n.secondary));
  return monthPages.get(ds.id)!;
};

// ---- Components ----------------------------------------------------------------

// What each default preview plots is chosen to read at the size of a card on
// the components index (from about 340px wide): four or five short labels on a
// category axis, four months on a time axis, compact numbers on value axes.
// The components tilt axis labels that do not fit before they drop any.

// A KPI is a tile, not a banner: at a page's full width its number sits alone
// in a band of nothing.
const KPI_WIDTH = 360;

// A control is a field in a filter bar, not a card.
const CONTROL_WIDTH = 320;
// A filter builder lays its filters out in a row.
const FILTER_BUILDER_WIDTH = 640;

// A filter builder's options: a stand-in for an API that returns a field's
// distinct values, declared beside the example as sample data.
const filterOptions = (ctx: BuildContext): CodeRef => {
  const n = names(ctx.ds);
  const rows = [
    ...ctx.ds.byCategory.map((r) => ({ [n.category]: String(r[n.category]) })),
    ...[...new Set(ctx.ds.byGroup.map((r) => String(r[n.group])))].map((v) => ({ [n.group]: v })),
  ];
  return {
    __code: 'loadOptions',
    data: true,
    declare: [
      `const options = ${JSON.stringify(rows).replace(/"([a-zA-Z_]+)":/g, '$1: ').replace(/"/g, "'").replace(/,/g, ', ')};`,
      'const loadOptions = (field: Dimension, search: string) => optionsOf(options, field, search).data!;',
    ],
    // What optionsOf returns, without loading the library into the site's shell.
    value: (field: { name: string }, search: string) =>
      rows.filter((r) => r[field.name]?.toLowerCase().includes(search.toLowerCase())),
  };
};

const FILTER_STATE = { type: 'FilterBuilderClause | null', imports: ['FilterBuilderClause', 'Dimension'] };

const filterBuilderProps = (ctx: BuildContext) => {
  const filters = ctx.state('filters', null, FILTER_STATE);
  return {
    title: ctx.title,
    dimensionsAndMeasures: [ctx.field('category'), ctx.field('group'), ctx.field('primary')],
    loadOptions: filterOptions(ctx),
    value: filters.value,
    onChange: filters.set,
  };
};

// Filters saved from an earlier visit: the builder starts from them.
const savedFilters = (ctx: BuildContext) => {
  const filters = ctx.state('filters', { operator: 'and', clauses: [{ property: names(ctx.ds).primary, operator: 'gte', value: 1000 }] }, FILTER_STATE);
  return { value: filters.value, onChange: filters.set };
};

type VariantDef = Omit<ChartVariant, 'title'>;
type EntryDef = Omit<ChartEntry, 'defaultTitle' | 'variants'> & { variants?: VariantDef[] };

const entryDefs: EntryDef[] = [
  {
    id: 'kpi',
    name: 'KPI number',
    exportName: 'KpiNumber',
    group: 'KPIs',
    width: KPI_WIDTH,
    description: 'A single headline figure, formatted with the measure’s currency, prefix, suffix and locale.',
    toggles: [T.hideMenu],
    props: (ctx) => ({
      title: ctx.title,
      measure: ctx.field('secondary'),
      results: ctx.rows('totalRows', keep([ctx.ds.total], names(ctx.ds).secondary)),
      ...pick(ctx, [T.hideMenu]),
    }),
    variants: [
      {
        id: 'compact',
        name: 'KPI number · compact',
        description: 'A large figure shortened to “1.2M”, still in the reader’s locale.',
        notes: ['`abbreviateLargeNumber` is a field option on the measure; the currency stays.'],
        docsOnly: true,
        props: (ctx) => ({
          measure: compact(ctx.field('primary')),
          results: ctx.rows('totalRows', [totalsRow(ctx.ds.byCategory, names(ctx.ds).primary)]),
        }),
      },
      {
        id: 'fixed-size',
        name: 'KPI number · fixed font size',
        description: 'A set font size instead of auto-fitting the card, for a row of KPIs that should match.',
        notes: ['Without `fontSize` the number grows and shrinks to fill the card.'],
        docsOnly: true,
        props: () => ({ fontSize: 40 }),
      },
    ],
  },
  {
    id: 'kpi-comparison',
    name: 'KPI with comparison',
    exportName: 'KpiNumberComparison',
    group: 'KPIs',
    width: KPI_WIDTH,
    description: 'A headline figure with its change against a comparison period, coloured by direction.',
    toggles: [T.changePercent, T.hideMenu],
    props: (ctx) => {
      const n = names(ctx.ds);
      return {
        title: ctx.title,
        measure: ctx.field('primary'),
        results: ctx.rows('currentRows', keep([ctx.ds.total], n.primary)),
        resultsComparison: ctx.rows('previousRows', keep([ctx.ds.previousTotal], n.primary)),
        comparisonPeriod: 'Previous period',
        primaryDateRange: rangeRef('currentRange', WINDOWS.last30),
        comparisonDateRange: rangeRef('previousRange', WINDOWS.previous30),
        ...pick(ctx, [T.changePercent, T.hideMenu]),
      };
    },
    variants: [
      {
        id: 'percentage-change',
        name: 'KPI with comparison · change as a percentage',
        description: 'The change as a percentage of the earlier figure, instead of an amount in the measure’s own format.',
        notes: ['`displayChangeAsPercentage` switches to a percentage, to one decimal place.'],
        docsOnly: true,
        props: () => ({ displayChangeAsPercentage: true }),
      },
      {
        id: 'lower-is-better',
        name: 'KPI with comparison · lower is better',
        description: 'For costs, churn or response times: a rise shows red and a fall shows green.',
        notes: [
          '`reversePositiveNegativeColors` swaps the colours. `reverseTrendDirection={false}` keeps the arrow pointing the way the number moved; without it the arrow flips with the colours.',
        ],
        docsOnly: true,
        props: (ctx) => {
          const n = names(ctx.ds);
          return {
            measure: extra(ctx, 'rate'),
            results: ctx.rows('currentRows', keep([ctx.ds.total], n.rate)),
            resultsComparison: ctx.rows('previousRows', keep([ctx.ds.previousTotal], n.rate)),
            reversePositiveNegativeColors: true,
            reverseTrendDirection: false,
          };
        },
      },
      {
        id: 'precise',
        name: 'KPI with comparison · two decimals',
        description: 'A percentage change to two decimal places, for metrics that move by fractions of a percent.',
        notes: ['`percentageDecimalPlaces` only applies with `displayChangeAsPercentage`.'],
        docsOnly: true,
        props: () => ({ displayChangeAsPercentage: true, percentageDecimalPlaces: 2 }),
      },
    ],
  },
  {
    id: 'bar',
    name: 'Bar chart',
    exportName: 'BarChart',
    group: 'Bars',
    description: 'Compare one or more measures across the values of a dimension.',
    notes: [
      'Each row in `results` is one bar: the dimension\'s value plus each measure.',
      'Format values through the measure\'s `inputs`: here `abbreviateLargeNumber` shortens thousands to K.',
    ],
    toggles: cartesian,
    props: (ctx) => {
      const n = names(ctx.ds);
      return {
        title: ctx.title,
        dimension: extra(ctx, 'segment'),
        measures: [compact(ctx.field('secondary'))],
        results: ctx.rows('rows', keep(ctx.ds.bySegment, n.segment, n.secondary)),
        onBarClicked: ctx.handler('onBarClicked'),
        ...pick(ctx, cartesian),
      };
    },
    variants: [
      {
        id: 'monthly',
        name: 'Bar chart · monthly columns',
        description: 'Six months as columns, each labelled with its abbreviated value.',
        notes: [
          'A time dimension with `granularity: \'month\'` labels the axis and fills months with no row.',
        ],
        props: (ctx) => {
          const n = names(ctx.ds);
          return {
            dimension: timeAt(ctx, 'month'),
            measures: [compact(ctx.field('primary'))],
            results: ctx.rows('rows', keep(ctx.ds.byTimeWindow('month', WINDOWS.halfYear), n.time, n.primary)),
          };
        },
      },
      {
        id: 'growth',
        name: 'Bar chart · growth, up and down',
        description: 'Month-on-month change as a percentage, with bars below zero for the months that fell.',
        notes: [
          'Compute `growth` in your query and describe it with its own `measure()`, formatted by `suffix` and `decimalPlaces`.',
        ],
        props: (ctx) => {
          const { primary, time } = ctx.ds.specs;
          // December and the six months after it give six changes, January to
          // June: each against the month before it.
          const months = ctx.ds.byTimeWindow('month', { from: '2025-12-01', to: WINDOWS.sample.to });
          // Only the time keys and the derived measure, as the user's query would return.
          const rows = months.slice(1).map((row, i) => {
            const prev = Number(months[i]![primary.name]);
            const change = prev ? ((Number(row[primary.name]) - prev) / prev) * 100 : 0;
            return { ...keep([row], time.name)[0], growth: Math.round(change * 10) / 10 };
          });
          const growth = measure({
            name: 'growth',
            title: `${primary.title} growth`,
            inputs: { suffix: '%', decimalPlaces: 1 },
          });
          return {
            dimension: timeAt(ctx, 'month'),
            measures: [{ __code: 'growth', value: growth }],
            results: ctx.rows('rows', rows),
          };
        },
      },
      {
        id: 'axis-titles',
        name: 'Bar chart · axis titles',
        description: 'A caption on each axis, for a chart that has to stand on its own in a report.',
        docsOnly: true,
        props: (ctx) => ({
          xAxisLabel: fieldLabelKey(ctx.ds, 'segment'),
          yAxisLabel: fieldLabelKey(ctx.ds, 'secondary'),
          showValueLabels: false,
        }),
      },
      {
        id: 'fixed-range',
        name: 'Bar chart · fixed value range',
        description: 'A pinned value axis, so charts side by side share one scale.',
        notes: ['`yAxisRangeMin` and `yAxisRangeMax` pin the axis; values above the maximum are clipped.'],
        docsOnly: true,
        props: (ctx) => {
          const top = Math.max(...ctx.ds.bySegment.map((r) => Number(r[names(ctx.ds).secondary] ?? 0)));
          return { yAxisRangeMin: 0, yAxisRangeMax: roundUp(top * 1.6) };
        },
      },
      {
        id: 'other-bucket',
        name: 'Bar chart · long tail as “Other”',
        description: 'Rows sorted largest first: the top five as bars, and the rest added up into one “Other” bar.',
        notes: ['`xAxisMaxItems: 6` keeps the first five rows in your order and adds up the rest, so sort the query largest first.'],
        docsOnly: true,
        props: (ctx) => {
          const n = names(ctx.ds);
          // A measure that adds up (revenue, sessions, units): "Other" is the sum of the tail.
          const value = ctx.ds.extra.ranked.name;
          const largestFirst = [...ctx.ds.byPoint].sort((a, b) => Number(b[value]) - Number(a[value]));
          return {
            dimension: extra(ctx, 'entity'),
            measures: [compact(extra(ctx, 'ranked'))],
            results: ctx.rows('rows', keep(largestFirst, n.entity, value)),
            xAxisMaxItems: 6,
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
    toggles: [T.legend, T.tooltips, T.valueLabels, T.log, T.hideMenu],
    props: (ctx) => {
      const n = names(ctx.ds);
      return {
        title: ctx.title,
        dimension: ctx.field('category'),
        // Counts, not currency: a horizontal value axis has little room, and
        // German and French do not shorten thousands.
        measures: [compact(ctx.field('secondary'))],
        results: ctx.rows('rows', keep(ctx.ds.byCategory, n.category, n.secondary)),
        onBarClicked: ctx.handler('onBarClicked'),
        ...pick(ctx, [T.legend, T.tooltips, T.valueLabels, T.log, T.hideMenu]),
      };
    },
    variants: [
      {
        id: 'truncated',
        name: 'Horizontal bar chart · truncated labels',
        description: 'Long category names cut to eight characters on the axis; the tooltip shows them in full.',
        notes: ['`maxCharacters` is a field option on the dimension.'],
        docsOnly: true,
        props: (ctx) => ({ dimension: withInputs(ctx.field('category'), { maxCharacters: 8 }) }),
      },
    ],
  },
  {
    id: 'bar-stacked',
    name: 'Stacked bar chart',
    exportName: 'BarChartStacked',
    group: 'Stacked',
    description: 'Show the composition of each bar by a second dimension.',
    notes: [
      'Rows are long format: one per bar and segment, with the `groupBy` value on each.',
    ],
    toggles: [T.legend, T.tooltips, noValueLabels, T.totals, T.hideMenu],
    props: (ctx) => {
      const n = names(ctx.ds);
      return {
        title: ctx.title,
        xAxis: timeAt(ctx, 'month'),
        groupBy: ctx.field('group'),
        measure: compact(ctx.field('primary')),
        results: ctx.rows('rows', keep(ctx.ds.byTimeGroupWindow('month', WINDOWS.current), n.time, n.group, n.primary)),
        onBarClicked: ctx.handler('onBarClicked'),
        ...pick(ctx, [T.legend, T.tooltips, noValueLabels, T.totals, T.hideMenu]),
      };
    },
    variants: [
      {
        id: 'totals',
        name: 'Stacked bar chart · totals',
        description: 'Each stack’s total printed above it, in compact numbers.',
        notes: ['`showTotalLabels` adds the totals; the segments keep their own tooltips.'],
        docsOnly: true,
        props: () => ({ showTotalLabels: true }),
      },
      {
        id: 'segment-labels',
        name: 'Stacked bar chart · segment values',
        description: 'Every segment labelled, for reading the mix as well as the total.',
        docsOnly: true,
        props: () => ({ showValueLabels: true, showTotalLabels: true }),
      },
    ],
  },
  {
    id: 'bar-stacked-horizontal',
    name: 'Stacked horizontal bar chart',
    exportName: 'BarChartStackedHorizontal',
    group: 'Stacked',
    description: 'The composition of each bar by a second dimension, laid out horizontally for long labels.',
    toggles: [T.legend, T.tooltips, noValueLabels, T.totals, T.hideMenu],
    props: (ctx) => {
      const n = names(ctx.ds);
      return {
        title: ctx.title,
        yAxis: ctx.field('category'),
        groupBy: ctx.field('group'),
        measure: compact(ctx.field('secondary')),
        results: ctx.rows('rows', keep(ctx.ds.byCategoryGroup, n.category, n.group, n.secondary)),
        // Stacked and grouped charts sort the axis by name unless told the order.
        axisOrder: ctx.ds.byCategory.map((row) => String(row[n.category])),
        onBarClicked: ctx.handler('onBarClicked'),
        ...pick(ctx, [T.legend, T.tooltips, noValueLabels, T.totals, T.hideMenu]),
      };
    },
    variants: [
      {
        id: 'totals',
        name: 'Stacked horizontal bar chart · totals',
        description: 'Each stack’s total printed at its end, in compact numbers.',
        docsOnly: true,
        props: () => ({ showTotalLabels: true }),
      },
    ],
  },
  {
    id: 'bar-grouped',
    name: 'Grouped bar chart',
    exportName: 'BarChartGrouped',
    group: 'Bars',
    description: 'Side-by-side bars for each value of a second dimension.',
    toggles: [T.legend, T.tooltips, noValueLabels, T.hideMenu],
    props: (ctx) => {
      const n = names(ctx.ds);
      return {
        title: ctx.title,
        xAxis: extra(ctx, 'segment'),
        groupBy: extra(ctx, 'pair'),
        measure: compact(ctx.field('primary')),
        results: ctx.rows('rows', keep(ctx.ds.bySegmentPair, n.segment, n.pair, n.primary)),
        onBarClicked: ctx.handler('onBarClicked'),
        ...pick(ctx, [T.legend, T.tooltips, noValueLabels, T.hideMenu]),
      };
    },
    variants: [
      {
        id: 'labelled',
        name: 'Grouped bar chart · value labels',
        description: 'Every bar labelled with its compact value.',
        docsOnly: true,
        props: () => ({ showValueLabels: true }),
      },
      {
        id: 'axis-titles',
        name: 'Grouped bar chart · axis titles',
        description: 'A caption on each axis.',
        docsOnly: true,
        props: (ctx) => ({ xAxisLabel: fieldLabelKey(ctx.ds, 'segment'), yAxisLabel: fieldLabelKey(ctx.ds, 'primary') }),
      },
    ],
  },
  {
    id: 'bar-grouped-horizontal',
    name: 'Grouped horizontal bar chart',
    exportName: 'BarChartGroupedHorizontal',
    group: 'Bars',
    description: 'Side-by-side bars for each value of a second dimension, laid out horizontally.',
    toggles: [T.legend, T.tooltips, noValueLabels, T.hideMenu],
    props: (ctx) => {
      const n = names(ctx.ds);
      return {
        title: ctx.title,
        yAxis: ctx.field('group'),
        groupBy: extra(ctx, 'pair'),
        measure: compact(ctx.field('secondary')),
        results: ctx.rows('rows', keep(ctx.ds.byGroupPair, n.group, n.pair, n.secondary)),
        onBarClicked: ctx.handler('onBarClicked'),
        ...pick(ctx, [T.legend, T.tooltips, noValueLabels, T.hideMenu]),
      };
    },
    variants: [
      {
        id: 'labelled',
        name: 'Grouped horizontal bar chart · value labels',
        description: 'Every bar labelled with its value.',
        docsOnly: true,
        props: () => ({ showValueLabels: true }),
      },
    ],
  },
  {
    id: 'bar-line',
    name: 'Bar and line combo',
    exportName: 'BarLineChart',
    group: 'Bars',
    description: 'Bars and a line on independent axes, for volume against a rate or count.',
    notes: [
      '`useSecondaryAxis` on a line measure gives the line its own scale, on the right.',
      '`showValueLabels` labels the bars and `showValueLabelsLine` the line, both on by default. Here the bars are plain, so the line never runs through a bar’s label.',
    ],
    toggles: [T.legend, T.tooltips, plainBars, T.hideMenu],
    props: (ctx) => {
      const n = names(ctx.ds);
      return {
        title: ctx.title,
        dimension: ctx.field('group'),
        measures: [compact(ctx.field('secondary'))],
        lineMeasures: [withInputs(extra(ctx, 'rate'), { useSecondaryAxis: true })],
        results: ctx.rows('rows', keep(ctx.ds.byGroup, n.group, n.secondary, n.rate)),
        onBarClicked: ctx.handler('onBarClicked'),
        ...pick(ctx, [T.legend, T.tooltips, plainBars, T.hideMenu]),
      };
    },
    variants: [
      {
        id: 'axis-titles',
        name: 'Bar and line combo · axis titles',
        description: 'A caption on each value axis, so it’s clear which scale belongs to which series.',
        docsOnly: true,
        // yAxisSecondaryLabel is shown as given: unlike the other axis captions it is not a translation key.
        props: (ctx) => ({
          yAxisLabel: fieldLabelKey(ctx.ds, 'secondary'),
          yAxisSecondaryLabel: ctx.ds.extra.rate.title,
          yAxisSecondaryMin: 0,
        }),
      },
    ],
  },
  {
    id: 'line',
    name: 'Line chart',
    exportName: 'LineChart',
    group: 'Lines',
    description: 'A time series with gap filling and a built-in granularity switcher.',
    notes: [
      'The time field’s `granularity` labels the axis and fills periods with no row. For a picker in the card, set `showGranularityDropdown` on the field and pass `setGranularity` (both optional), then refetch at the granularity it reports.',
      'Rows are long format, one per time bucket, with zone-less ISO time strings.',
    ],
    usesGranularity: true,
    toggles: lines,
    props: (ctx) => {
      const n = names(ctx.ds);
      return {
        title: ctx.title,
        xAxis: ctx.field('time'),
        measures: [compact(extra(ctx, 'activity'))],
        results: ctx.rows('rows', keep(ctx.ds.byTimeWindow(ctx.granularity, WINDOWS.current), n.time, n.activity)),
        setGranularity: ctx.setGranularity,
        onLineClicked: ctx.handler('onLineClicked'),
        ...pick(ctx, lines),
      };
    },
    variants: [
      {
        id: 'filled',
        name: 'Line chart · filled',
        description: 'A shaded area under the line, for a sense of volume over time.',
        notes: [
          '`fillUnderLine` is a field option on the measure, so each measure in `measures` can choose its own.',
        ],
        props: (ctx) => ({ measures: [withInputs(compact(extra(ctx, 'activity')), { fillUnderLine: true })] }),
      },
      {
        id: 'dashed-labels',
        name: 'Line chart · dashed',
        description: 'A dashed line, for a forecast or a target, with compact numbers on the axis.',
        notes: ['`dashedLine` and `abbreviateLargeNumber` are field options on the measure, not chart props.'],
        props: (ctx) => ({
          measures: [withInputs(extra(ctx, 'activity'), { dashedLine: true, abbreviateLargeNumber: true })],
        }),
      },
      {
        id: 'fitted-axis',
        name: 'Line chart · fitted value axis',
        description: 'The value axis starts just below the lowest point instead of at zero, to bring out small changes.',
        notes: ['The axis starts at zero by default; `yAxisRangeMin` moves it, and `yAxisLabel` captions it.'],
        docsOnly: true,
        props: (ctx) => {
          const n = names(ctx.ds);
          const lowest = Math.min(
            ...ctx.ds.byTimeWindow(ctx.granularity, WINDOWS.current).map((row) => Number(row[n.activity] ?? 0)),
          );
          return { yAxisRangeMin: roundDown(lowest * 0.9), yAxisLabel: fieldLabelKey(ctx.ds, 'activity') };
        },
      },
      {
        id: 'granularity-picker',
        name: 'Line chart · granularity picker',
        description: 'A picker in the card switches between weeks, months and quarters.',
        notes: [
          '`showGranularityDropdown` shows it; `setGranularity` gets the choice, which you keep in state and query again at.',
        ],
        docsOnly: true,
        // Rows by day, which build.ts prints with a stand-in query that sums them into the period picked.
        props: (ctx) => {
          const days = { from: '2026-01-05', to: '2026-06-28' };
          return {
            xAxis: withInputs(ctx.field('time'), {
              showGranularityDropdown: true,
              dateBounds: { from: new Date(days.from), to: new Date(days.to) },
            }),
            results: ctx.rows('daily', keep(ctx.ds.byTimeWindow('day', days), names(ctx.ds).time, names(ctx.ds).activity)),
          };
        },
      },
    ],
  },
  {
    id: 'line-grouped',
    name: 'Multi-series line chart',
    exportName: 'LineChartGrouped',
    group: 'Lines',
    description: 'One line per value of a dimension, over time.',
    usesGranularity: true,
    toggles: lines,
    props: (ctx) => {
      const n = names(ctx.ds);
      return {
        title: ctx.title,
        xAxis: ctx.field('time'),
        groupBy: ctx.field('group'),
        measure: compact(ctx.field('primary')),
        results: ctx.rows(
          'rows',
          keep(ctx.ds.byTimeGroupWindow(ctx.granularity, WINDOWS.current), n.time, n.group, n.primary),
        ),
        setGranularity: ctx.setGranularity,
        onLineClicked: ctx.handler('onLineClicked'),
        ...pick(ctx, lines),
      };
    },
    variants: [
      {
        id: 'filled',
        name: 'Multi-series line chart · filled',
        description: 'Every segment shaded under its line, so the biggest reads at a glance.',
        notes: ['`fillUnderLine` on the measure shades under every line the chart draws for it.'],
        props: (ctx) => ({
          measure: withInputs(compact(ctx.field('primary')), { fillUnderLine: true }),
        }),
      },
    ],
  },
  {
    id: 'line-comparison',
    name: 'Line chart with comparison',
    exportName: 'LineChartComparison',
    group: 'Lines',
    description: 'The current period against an earlier one, each on its own date axis.',
    notes: [
      'Both lines are solid and take the measure’s colour unless the measure says otherwise: here `previousLineDashed` and `previousLineColor` set the earlier line apart.',
      '`comparisonPeriod` is needed: without it the earlier line is not drawn.',
    ],
    usesGranularity: true,
    toggles: lineComparison,
    props: (ctx) => {
      const n = names(ctx.ds);
      return {
        title: ctx.title,
        xAxis: ctx.field('time'),
        measures: [againstPrevious(compact(ctx.field('secondary')))],
        results: ctx.rows('rows', keep(ctx.ds.byTimeWindow(ctx.granularity, WINDOWS.current), n.time, n.secondary)),
        resultsComparison: ctx.rows(
          'comparisonRows',
          keep(ctx.ds.byTimeWindow(ctx.granularity, WINDOWS.previous), n.time, n.secondary),
        ),
        comparisonPeriod: 'Previous period',
        primaryDateRange: rangeRef('currentRange', WINDOWS.current),
        comparisonDateRange: rangeRef('previousRange', WINDOWS.previous),
        setGranularity: ctx.setGranularity,
        onLineClicked: ctx.handler('onLineClicked'),
        ...pick(ctx, lineComparison),
      };
    },
    variants: [
      {
        id: 'comparison-axis',
        name: 'Line chart with comparison · one date axis',
        description: 'Both lines against the current period’s dates, without the second x-axis.',
        notes: ['`showComparisonAxis={false}` drops the axis that carries the comparison period’s own dates.'],
        docsOnly: true,
        props: () => ({ showComparisonAxis: false }),
      },
      {
        id: 'styled',
        name: 'Line chart with comparison · styled lines',
        description: 'Each period in a colour of your choice, both drawn solid.',
        notes: [
          '`lineColor` and `previousLineColor` are field options on the measure. Either line is solid unless `lineDashed` or `previousLineDashed` is set.',
        ],
        docsOnly: true,
        props: (ctx) => ({
          measures: [withInputs(compact(ctx.field('secondary')), { lineColor: '#0ea5e9', previousLineColor: '#f59e0b' })],
        }),
      },
    ],
  },
  {
    id: 'line-with-kpi-tabs',
    name: 'Line chart with KPI tabs',
    exportName: 'LineChartWithKpiTabs',
    group: 'Lines',
    wide: true,
    description: 'A tab per measure showing its total; selecting a tab switches the plotted line.',
    usesGranularity: true,
    toggles: lines,
    props: (ctx) => {
      const n = names(ctx.ds);
      const rows = keep(ctx.ds.byTimeWindow(ctx.granularity, WINDOWS.current), n.time, n.primary, n.secondary);
      const months = ctx.ds.byTimeWindow('month', WINDOWS.current);
      return {
        title: ctx.title,
        xAxis: ctx.field('time'),
        measures: [compact(ctx.field('primary')), ctx.field('secondary')],
        results: ctx.rows('rows', rows),
        resultsKpis: ctx.rows('kpiRows', [totalsRow(months, n.primary, n.secondary)]),
        setGranularity: ctx.setGranularity,
        onLineClicked: ctx.handler('onLineClicked'),
        ...pick(ctx, lines),
      };
    },
    variants: [
      {
        id: 'filled',
        name: 'Line chart with KPI tabs · filled',
        description: 'Each measure shaded under its line when its tab is selected.',
        docsOnly: true,
        props: (ctx) => ({
          measures: [
            withInputs(compact(ctx.field('primary')), { fillUnderLine: true }),
            withInputs(ctx.field('secondary'), { fillUnderLine: true }),
          ],
        }),
      },
    ],
  },
  {
    id: 'line-comparison-with-kpi-tabs',
    name: 'Line chart with comparison and KPI tabs',
    exportName: 'LineChartComparisonWithKpiTabs',
    group: 'Lines',
    wide: true,
    description: 'KPI tabs showing each measure’s change against the previous period, over a line chart that overlays both.',
    usesGranularity: true,
    toggles: lineComparison,
    props: (ctx) => {
      const n = names(ctx.ds);
      const window = (w: DateWindow, granularity: Granularity) =>
        keep(ctx.ds.byTimeWindow(granularity, w), n.time, n.activity, n.secondary);
      return {
        title: ctx.title,
        xAxis: ctx.field('time'),
        measures: [againstPrevious(compact(extra(ctx, 'activity'))), againstPrevious(ctx.field('secondary'))],
        results: ctx.rows('rows', window(WINDOWS.current, ctx.granularity)),
        resultsComparison: ctx.rows('comparisonRows', window(WINDOWS.previous, ctx.granularity)),
        resultsKpis: ctx.rows('kpiRows', [totalsRow(window(WINDOWS.current, 'month'), n.activity, n.secondary)]),
        resultsKpisComparison: ctx.rows('kpiComparisonRows', [
          totalsRow(window(WINDOWS.previous, 'month'), n.activity, n.secondary),
        ]),
        comparisonPeriod: 'Previous period',
        primaryDateRange: rangeRef('currentRange', WINDOWS.current),
        comparisonDateRange: rangeRef('previousRange', WINDOWS.previous),
        setGranularity: ctx.setGranularity,
        onLineClicked: ctx.handler('onLineClicked'),
        ...pick(ctx, lineComparison),
      };
    },
    variants: [
      {
        id: 'comparison-axis',
        name: 'Line chart with comparison and KPI tabs · one date axis',
        description: 'Both lines against the current period’s dates, without the second x-axis.',
        notes: ['`showComparisonAxis={false}` drops the axis that carries the comparison period’s own dates.'],
        docsOnly: true,
        props: () => ({ showComparisonAxis: false }),
      },
    ],
  },
  {
    id: 'area',
    name: 'Stacked area chart',
    exportName: 'AreaChart',
    group: 'Stacked',
    description: 'Stacked areas showing how segments contribute to a total over time.',
    usesGranularity: true,
    toggles: [T.legend, T.tooltips, quietPoints, T.hideMenu],
    props: (ctx) => {
      const n = names(ctx.ds);
      return {
        title: ctx.title,
        xAxis: ctx.field('time'),
        groupBy: ctx.field('group'),
        measure: compact(ctx.field('secondary')),
        results: ctx.rows(
          'rows',
          keep(ctx.ds.byTimeGroupWindow(ctx.granularity, WINDOWS.current), n.time, n.group, n.secondary),
        ),
        setGranularity: ctx.setGranularity,
        onPointClicked: ctx.handler('onPointClicked'),
        ...pick(ctx, [T.legend, T.tooltips, quietPoints, T.hideMenu]),
      };
    },
    variants: [
      {
        id: 'axis-titles',
        name: 'Stacked area chart · axis titles',
        description: 'A caption on each axis.',
        docsOnly: true,
        props: (ctx) => ({ xAxisLabel: fieldLabelKey(ctx.ds, 'time'), yAxisLabel: fieldLabelKey(ctx.ds, 'secondary') }),
      },
    ],
  },
  {
    id: 'pie',
    name: 'Pie chart',
    exportName: 'PieChart',
    group: 'Pies',
    description: 'Share of a total across a small number of categories.',
    toggles: [T.legend, T.tooltips, T.valueLabels, T.hideMenu],
    props: (ctx) => {
      const n = names(ctx.ds);
      return {
        title: ctx.title,
        dimension: extra(ctx, 'segment'),
        measure: compact(ctx.field('primary')),
        results: ctx.rows('rows', keep(ctx.ds.bySegment, n.segment, n.primary)),
        onSegmentClick: ctx.handler('onSegmentClick'),
        ...pick(ctx, [T.legend, T.tooltips, T.valueLabels, T.hideMenu]),
      };
    },
    variants: [
      {
        id: 'percentages',
        name: 'Pie chart · percentages',
        description: 'Each slice labelled with its share of the total.',
        notes: [
          '`showValueAsPercentage` on the measure works out the shares from your rows; no extra query. `decimalPlaces` rounds them.',
        ],
        docsOnly: true,
        props: (ctx) => ({
          measure: withInputs(ctx.field('primary'), { showValueAsPercentage: true, decimalPlaces: 1 }),
        }),
      },
      {
        id: 'other',
        name: 'Pie chart · long tail as “Other”',
        description: 'At most three slices: the first two rows, and the rest added up into one “Other” slice.',
        notes: ['`maxLegendItems` keeps your rows’ order, so sort the query largest first.'],
        docsOnly: true,
        props: (ctx) => {
          const n = names(ctx.ds);
          const largestFirst = [...ctx.ds.bySegment].sort((a, b) => Number(b[n.primary]) - Number(a[n.primary]));
          return { results: ctx.rows('rows', keep(largestFirst, n.segment, n.primary)), maxLegendItems: 3 };
        },
      },
    ],
  },
  {
    id: 'donut',
    name: 'Donut chart',
    exportName: 'DonutChart',
    group: 'Pies',
    description: 'A pie with the centre cut out, for a lighter visual weight.',
    toggles: [T.legend, T.tooltips, T.valueLabels, T.hideMenu],
    props: (ctx) => {
      const n = names(ctx.ds);
      return {
        title: ctx.title,
        dimension: ctx.field('group'),
        measure: ctx.field('secondary'),
        results: ctx.rows('rows', keep(ctx.ds.byGroup, n.group, n.secondary)),
        onSegmentClick: ctx.handler('onSegmentClick'),
        ...pick(ctx, [T.legend, T.tooltips, T.valueLabels, T.hideMenu]),
      };
    },
    variants: [
      {
        id: 'percentages',
        name: 'Donut chart · percentages',
        description: 'Each segment labelled with its share of the total.',
        notes: ['`showValueAsPercentage` is a field option on the measure.'],
        docsOnly: true,
        props: (ctx) => ({
          measure: withInputs(ctx.field('secondary'), { showValueAsPercentage: true, decimalPlaces: 1 }),
        }),
      },
      {
        id: 'minimal',
        name: 'Donut chart · minimal',
        description: 'No legend and no labels: shape only, with the detail in the tooltips.',
        docsOnly: true,
        props: () => ({ showLegend: false, showValueLabels: false }),
      },
    ],
  },
  {
    id: 'donut-label',
    name: 'Donut with total',
    exportName: 'DonutLabelChart',
    group: 'Pies',
    description: 'A donut with a headline figure in the centre.',
    toggles: [T.legend, T.tooltips, T.valueLabels, T.hideMenu],
    props: (ctx) => {
      const n = names(ctx.ds);
      return {
        title: ctx.title,
        dimension: ctx.field('category'),
        measure: compact(ctx.field('primary')),
        results: ctx.rows('rows', keep(ctx.ds.byCategory, n.category, n.primary)),
        // The centre shows a figure in the millions, shortened so it fits the hole.
        innerLabelMeasure: compact(ctx.field('primary')),
        innerLabelText: labelKey('total'),
        resultsInnerLabel: ctx.rows('totalRows', [totalsRow(ctx.ds.byCategory, n.primary)]),
        onSegmentClick: ctx.handler('onSegmentClick'),
        ...pick(ctx, [T.legend, T.tooltips, T.valueLabels, T.hideMenu]),
      };
    },
    variants: [
      {
        id: 'percentages',
        name: 'Donut with total · percentages',
        description: 'The total in the centre and each segment’s share around it.',
        notes: ['`showValueAsPercentage` is a field option on the measure; the centre still shows the total.'],
        docsOnly: true,
        props: (ctx) => ({
          measure: withInputs(ctx.field('primary'), { showValueAsPercentage: true }),
        }),
      },
      {
        id: 'compact',
        name: 'Donut with total · a count in full',
        description: 'A smaller figure written out in full in the centre: the inner label takes its own measure and rows.',
        notes: ['`innerLabelMeasure` and `resultsInnerLabel` are separate from the donut’s own measure and rows.'],
        docsOnly: true,
        props: (ctx) => {
          const n = names(ctx.ds);
          return {
            measure: ctx.field('secondary'),
            results: ctx.rows('rows', keep(ctx.ds.byCategory, n.category, n.secondary)),
            innerLabelMeasure: ctx.field('secondary'),
            resultsInnerLabel: ctx.rows('totalRows', [totalsRow(ctx.ds.byCategory, n.secondary)]),
          };
        },
      },
    ],
  },
  {
    id: 'funnel',
    name: 'Funnel chart',
    exportName: 'FunnelChart',
    group: 'Funnels',
    description: 'How much of a total survives each step of a process, in order.',
    toggles: [T.legend, T.tooltips, T.valueLabels, T.sectionLabels, T.stepPercent, T.hideMenu],
    notes: [
      'Steps sort largest first. When a later step can outgrow an earlier one, pass the optional `orderDimension`: a field holding each step’s position.',
    ],
    props: (ctx) => ({
      title: ctx.title,
      sectionDimension: ctx.field('stage'),
      countMeasure: extra(ctx, 'funnel'),
      results: ctx.rows('rows', ctx.ds.byStage),
      ...pick(ctx, [T.legend, T.tooltips, T.valueLabels, T.sectionLabels, T.stepPercent, T.hideMenu]),
    }),
    variants: [
      {
        id: 'step-labels',
        name: 'Funnel chart · step names on the funnel',
        description: 'Each step named on the funnel beside its value, with no legend: for a wide card.',
        notes: ['`showSectionLabels` writes “Step: value” on each step, so a legend would repeat the names.'],
        docsOnly: true,
        props: () => ({ showSectionLabels: true, showLegend: false }),
      },
      {
        id: 'percentages',
        name: 'Funnel chart · share of all steps',
        description: 'Each step as a share of all steps added together, not a conversion rate.',
        notes: ['`displayPercentages` divides by the total of every step.'],
        docsOnly: true,
        props: () => ({ displayPercentages: true }),
      },
      {
        id: 'proportional',
        name: 'Funnel chart · proportional bars',
        description: 'No taper: plain bars whose widths are exactly proportional, at the cost of the funnel look.',
        notes: ['`shrinkAnchor="none"` turns the taper off.'],
        docsOnly: true,
        props: () => ({ shrinkAnchor: 'none' }),
      },
      {
        id: 'colours',
        name: 'Funnel chart · custom colour ramp',
        description: 'A ramp between two colours of your choice, from the first step to the last.',
        notes: ['Set `startColor` and `endColor`; with one of them, the other is generated.'],
        docsOnly: true,
        props: () => ({ startColor: '#0ea5e9', endColor: '#1e3a8a' }),
      },
      {
        id: 'small-card',
        name: 'Funnel chart · in a small card',
        description: 'A card 320px wide, with the steps in the legend and the counts in the tooltips.',
        notes: ['`showValueLabels={false}` keeps the narrow last steps clean.'],
        width: 320,
        props: () => ({ showValueLabels: false }),
      },
    ],
    cardVariant: 'small-card',
  },
  {
    id: 'scatter',
    name: 'Scatter chart',
    exportName: 'ScatterChart',
    group: 'Scatter',
    description: 'Plot two measures against each other, one point per dimension value.',
    notes: ['Each row is one point. `groupByDimension` colours the points and adds the legend.'],
    toggles: [T.legend, T.tooltips, quietPoints, T.pointLabels, T.log, T.hideMenu],
    props: (ctx) => {
      const n = names(ctx.ds);
      return {
        title: ctx.title,
        pointDimension: extra(ctx, 'entity'),
        groupByDimension: extra(ctx, 'cluster'),
        xMeasure: extra(ctx, 'x'),
        yMeasure: compact(extra(ctx, 'y')),
        results: ctx.rows('rows', keep(ctx.ds.byPoint, n.entity, n.cluster, n.x, n.y)),
        onPointClick: ctx.handler('onPointClick'),
        ...pick(ctx, [T.legend, T.tooltips, quietPoints, T.pointLabels, T.log, T.hideMenu]),
      };
    },
    variants: [
      {
        id: 'point-labels',
        name: 'Scatter chart · point labels',
        description: 'Each point labelled with its dimension value, so outliers name themselves.',
        notes: ['A label sits under its point, so both axes start at zero here to keep the labels clear of them.'],
        docsOnly: true,
        props: () => ({ showPointLabels: true, xAxisRangeMin: 0, yAxisRangeMin: 0 }),
      },
      {
        id: 'single-colour',
        name: 'Scatter chart · one colour',
        description: 'Every point in one colour with no grouping, for a plain correlation plot.',
        docsOnly: true,
        props: () => ({ groupByDimension: undefined, pointColor: '#0ea5e9', showLegend: false }),
      },
    ],
  },
  {
    id: 'bubble',
    name: 'Bubble chart',
    exportName: 'BubbleChart',
    group: 'Scatter',
    description: 'A scatter chart with a third measure encoded as bubble size.',
    toggles: [T.legend, T.tooltips, quietPoints, T.pointLabels, T.hideMenu],
    props: (ctx) => {
      const n = names(ctx.ds);
      return {
        title: ctx.title,
        pointDimension: extra(ctx, 'entity'),
        groupByDimension: extra(ctx, 'cluster'),
        xMeasure: extra(ctx, 'x'),
        yMeasure: compact(extra(ctx, 'y')),
        bubbleSizeMeasure: extra(ctx, 'bubble'),
        results: ctx.rows('rows', keep(ctx.ds.byPoint, n.entity, n.cluster, n.x, n.y, n.bubble)),
        // Bubbles sized for a card a third of a row wide (the default runs 3 to
        // 20px), from zero on both axes so no bubble is drawn over an axis.
        bubbleRadiusMin: 4,
        bubbleRadiusMax: 11,
        xAxisRangeMin: 0,
        yAxisRangeMin: 0,
        onPointClick: ctx.handler('onPointClick'),
        ...pick(ctx, [T.legend, T.tooltips, quietPoints, T.pointLabels, T.hideMenu]),
      };
    },
    variants: [
      {
        id: 'point-labels',
        name: 'Bubble chart · labels',
        description: 'Each bubble labelled with its dimension value.',
        docsOnly: true,
        props: () => ({ showPointLabels: true }),
      },
      {
        id: 'size-range',
        name: 'Bubble chart · wider size range',
        description: 'A wider spread between the smallest and largest bubble, to make the third measure stand out.',
        notes: ['Both radii are in pixels.'],
        docsOnly: true,
        props: () => ({ bubbleRadiusMin: 2, bubbleRadiusMax: 22 }),
      },
    ],
  },
  {
    id: 'table',
    name: 'Paginated table',
    exportName: 'TablePaginated',
    group: 'Tables',
    description: 'A controlled table: you own paging and sorting and pass in the current page of rows.',
    usesTableState: true,
    toggles: [T.index, T.hideMenu],
    props: (ctx) => ({
      title: ctx.title,
      dimensionsAndMeasures: [ctx.field('category'), ctx.field('primary'), ctx.field('secondary')],
      results: ctx.table.rows,
      totalResults: ctx.table.total,
      allResults: ctx.table.all(ctx.ds.byCategory),
      state: ctx.table.state,
      setState: ctx.table.setState,
      ...pick(ctx, [T.index, T.hideMenu]),
    }),
    variants: [
      {
        id: 'formatted',
        name: 'Paginated table · formatted columns',
        description: 'Formatting set per column: the names in bold, and the first measure in compact numbers, with thousands as K.',
        notes: ['`tableCellStyle` and `abbreviateLargeNumber` are field options on each column’s dimension or measure.'],
        docsOnly: true,
        props: (ctx) => ({
          dimensionsAndMeasures: [
            withInputs(ctx.field('category'), { tableCellStyle: 'Bold' }),
            compact(ctx.field('primary')),
            ctx.field('secondary'),
          ],
        }),
      },
    ],
  },
  {
    id: 'table-scrollable',
    name: 'Scrollable table',
    exportName: 'TableScrollable',
    group: 'Tables',
    description:
      'An infinite-scroll table: you serve pages of 50 rows and it appends each as the reader scrolls. Sorting, or a new `resetKey`, starts again from page 0.',
    usesTableState: true,
    toggles: [T.index, T.hideMenu],
    props: (ctx) => {
      // The rows are daily, whatever granularity the rest of the site is set to.
      const day = timeAt(ctx, 'day');
      const n = names(ctx.ds);
      return {
        title: ctx.title,
        dimensionsAndMeasures: [day, ctx.field('primary'), ctx.field('secondary')],
        clickDimension: day,
        results: ctx.rows('pageRows', scrollablePage(ctx.ds, ctx.table.state.value as TableState)),
        allResults: ctx.table.all(keep(ctx.ds.byTime('day'), n.time, n.primary, n.secondary)),
        // Here the query changes with the site's dataset. A reader's own changes
        // with their filters, so that is what the printed code hands over.
        resetKey: {
          __code: 'filters',
          value: { dataset: ctx.ds.id },
          declare: "const filters = { search: '' }; // identifies the query: when it changes, the table starts again from page 0",
        },
        state: ctx.table.state,
        setState: ctx.table.setState,
        onRowClicked: ctx.handler('onRowClicked'),
        ...pick(ctx, [T.index, T.hideMenu]),
      };
    },
    variants: [
      {
        id: 'auto-height',
        name: 'Scrollable table · auto height',
        description: 'The card grows to fit every row instead of scrolling: for printable reports and embedded summaries.',
        notes: [
          '`heightMode="auto"`: pass all the rows at once (up to your own cap) with `results.total`, and the table says when rows were left out.',
        ],
        docsOnly: true,
        props: (ctx) => {
          const month = timeAt(ctx, 'month');
          return {
            dimensionsAndMeasures: [month, ctx.field('primary'), ctx.field('secondary')],
            clickDimension: month,
            results: ctx.rows('pageRows', monthRows(ctx.ds)),
            allResults: ctx.table.all(monthRows(ctx.ds)),
            heightMode: 'auto',
          };
        },
      },
    ],
  },
  {
    id: 'pivot',
    name: 'Pivot table',
    exportName: 'PivotTable',
    group: 'Tables',
    description: 'Measures cross-tabulated by a row and a column dimension, with totals.',
    notes: [
      'Totals are per measure: `columnAggregation` and `rowAggregation` in the measure\'s `inputs`.',
    ],
    toggles: [T.hideMenu],
    props: (ctx) => {
      const n = names(ctx.ds);
      return {
        title: ctx.title,
        rowDimension: ctx.field('category'),
        columnDimension: ctx.field('group'),
        measures: [
          withInputs(compact(ctx.field('primary')), {
            columnAggregation: ['sum'],
            rowAggregation: ['sum'],
          }),
        ],
        results: ctx.rows('rows', keep(ctx.ds.byCategoryGroup, n.category, n.group, n.primary)),
        ...pick(ctx, [T.hideMenu]),
      };
    },
    variants: [
      {
        id: 'summary-stats',
        name: 'Pivot table · average, min and max',
        description: 'One measure with row statistics instead of plain totals.',
        notes: [
          '`rowAggregation` adds a column per statistic and `columnAggregation` a row, always in the order sum, min, max, average.',
          'Both take any of `\'sum\'`, `\'min\'`, `\'max\'`, `\'average\'`.',
        ],
        props: (ctx) => ({
          measures: [
            withInputs(compact(ctx.field('primary')), {
              columnAggregation: ['average'],
              rowAggregation: ['average', 'min', 'max'],
            }),
          ],
        }),
      },
      {
        id: 'share',
        name: 'Pivot table · share of total',
        description: 'Each cell as a percentage, with column totals.',
        notes: [
          '`showAsPercentage` shows each cell as its share; other measures may be ignored when it\'s on.',
          '`columnAggregation: [\'sum\']` adds the totals row.',
        ],
        props: (ctx) => ({
          // A share takes its decimals from the measure's, which are none for whole dollars.
          measures: [withInputs(ctx.field('primary'), { showAsPercentage: true, decimalPlaces: 1, columnAggregation: ['sum'] })],
        }),
      },
      {
        id: 'compact',
        name: 'Pivot table · full numbers',
        description: 'Every cell and total written out in full, in wider columns.',
        notes: ['`columnWidth` and `firstColumnWidth` are in pixels; the table scrolls sideways when the columns outgrow the card.'],
        docsOnly: true,
        props: (ctx) => ({
          measures: [withInputs(ctx.field('primary'), { columnAggregation: ['sum'], rowAggregation: ['sum'] })],
          columnWidth: 130,
          firstColumnWidth: 170,
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
    toggles: [T.values, T.hideMenu],
    props: (ctx) => {
      const n = names(ctx.ds);
      return {
        title: ctx.title,
        rowDimension: extra(ctx, 'segment'),
        columnDimension: ctx.field('group'),
        measure: ctx.field('secondary'),
        // Rows and columns appear in the order the rows first name them.
        results: ctx.rows('rows', keep(bySegmentThenGroup(ctx.ds), n.segment, n.group, n.secondary)),
        onCellClicked: ctx.handler('onCellClicked'),
        ...pick(ctx, [T.values, T.hideMenu]),
      };
    },
    variants: [
      {
        id: 'colours',
        name: 'Heat map · custom colour scale',
        description: 'Your own cold, middle and hot colours.',
        notes: ['`minColor`, `midColor` and `maxColor`; the cell text switches between dark and light for contrast.'],
        docsOnly: true,
        props: () => ({ minColor: '#ecfeff', midColor: '#22d3ee', maxColor: '#155e75' }),
      },
      {
        id: 'thresholds',
        name: 'Heat map · thresholds',
        description: 'Everything in the bottom fifth of the range fully cold and the top fifth fully hot, so outliers don’t wash out the rest.',
        notes: ['Thresholds take a raw value or a percentage of the range: `minThreshold: \'20%\'`, `maxThreshold: \'80%\'`.'],
        docsOnly: true,
        props: () => ({ minThreshold: '20%', maxThreshold: '80%' }),
      },
      {
        id: 'colours-only',
        name: 'Heat map · colours only',
        description: 'No numbers in the cells, for a compact pattern view; the values stay in the exports.',
        docsOnly: true,
        props: () => ({ showValues: false }),
      },
    ],
  },
  // ---- Controls: each holds one value. Your own state wires it to the charts:
  // the value goes into your query, and the query's rows into `results`.
  {
    id: 'date-range-picker',
    name: 'Date range picker',
    exportName: 'DateRangePicker',
    group: 'Controls',
    width: CONTROL_WIDTH,
    description: 'Preset ranges such as “Last 30 days”, with a calendar for any other range.',
    notes: [
      'A preset is named by `relativeTimeString`; the picker fills in its `from` and `to` and reports them through `onChange`, in the provider’s time zone.',
    ],
    toggles: [],
    props: (ctx) => {
      const range = ctx.state('range', dateRangePreset('Last 30 days'), {
        type: 'TimeRange',
        imports: ['TimeRange'],
        initialCode: "dateRangePreset('Last 30 days')",
      });
      return { title: ctx.title, selectedValue: range.value, onChange: range.set };
    },
    variants: [
      {
        id: 'two-months',
        name: 'Date range picker · two months',
        description: 'The calendar shows two months side by side, for ranges that cross a month.',
        docsOnly: true,
        props: () => ({ showTwoMonths: true }),
      },
      {
        id: 'calendar-only',
        name: 'Date range picker · calendar only',
        description: 'No preset list: the picker opens straight on the calendar.',
        docsOnly: true,
        props: (ctx) => {
          const range = ctx.state('range', undefined, { type: 'TimeRange', imports: ['TimeRange'] });
          return { showCustomRangeOptions: false, selectedValue: range.value, onChange: range.set };
        },
      },
    ],
  },
  {
    id: 'date-range-picker-custom',
    name: 'Custom date range picker',
    exportName: 'DateRangePickerCustom',
    group: 'Controls',
    width: CONTROL_WIDTH,
    description: 'A calendar for picking any start and end date, with no presets.',
    toggles: [],
    props: (ctx) => {
      const range = ctx.state('range', undefined, { type: 'TimeRange', imports: ['TimeRange'] });
      return { title: ctx.title, selectedValue: range.value, onChange: range.set };
    },
    variants: [
      {
        id: 'two-months',
        name: 'Custom date range picker · two months',
        description: 'The calendar shows two months side by side, for ranges that cross a month.',
        docsOnly: true,
        props: () => ({ showTwoMonths: true }),
      },
    ],
  },
  {
    id: 'granularity-select',
    name: 'Granularity select',
    exportName: 'GranularitySelect',
    group: 'Controls',
    width: CONTROL_WIDTH,
    description: 'Day, week, month, quarter or year: the period a time series is grouped by.',
    notes: ['Pass the value to your time dimension as `granularity`, and query rows at that granularity.'],
    toggles: [],
    props: (ctx) => {
      const granularity = ctx.state('granularity', 'month', { type: 'Granularity', imports: ['Granularity'] });
      return { title: ctx.title, granularity: granularity.value, onChange: granularity.set };
    },
    variants: [
      {
        id: 'limited',
        name: 'Granularity select · fewer options',
        description: 'Only the granularities your data supports.',
        docsOnly: true,
        props: () => ({ granularities: ['week', 'month', 'quarter'] }),
      },
    ],
  },
  {
    id: 'comparison-period-select',
    name: 'Comparison period select',
    exportName: 'ComparisonPeriodSelect',
    group: 'Controls',
    width: CONTROL_WIDTH,
    description: 'Previous period, previous year and the like: what the current figures are compared with.',
    notes: ['The value is the option’s name, such as “Previous period”.'],
    toggles: [],
    props: (ctx) => {
      const period = ctx.state('period', 'Previous period', { type: 'string | undefined' });
      return { title: ctx.title, comparisonPeriod: period.value, onChange: period.set };
    },
    variants: [
      {
        id: 'dates',
        name: 'Comparison period select · with dates',
        description: 'Each option shows the dates it covers, worked out from the range being compared.',
        notes: ['`primaryDateRange` is the range your date picker holds: pass its state here.'],
        docsOnly: true,
        props: () => ({
          primaryDateRange: { __code: "dateRangePreset('Last 30 days')", value: dateRangePreset('Last 30 days') } satisfies CodeRef,
        }),
      },
    ],
  },
  {
    id: 'single-select',
    name: 'Single select',
    exportName: 'SingleSelect',
    group: 'Controls',
    width: CONTROL_WIDTH,
    description: 'A searchable dropdown of a field’s values, one of which can be chosen.',
    notes: [
      '`results` holds one row per option. Labels are formatted like the field anywhere else, so translated values match the charts.',
    ],
    toggles: [],
    props: (ctx) => {
      const selected = ctx.state('selected', undefined, { type: 'string' });
      return {
        title: ctx.title,
        dimension: ctx.field('category'),
        results: ctx.rows('options', keep(ctx.ds.byCategory, names(ctx.ds).category)),
        selectedValue: selected.value,
        onChange: selected.set,
      };
    },
    variants: [
      {
        id: 'required',
        name: 'Single select · always a value',
        description: 'Not clearable: with nothing chosen, the first option is selected.',
        docsOnly: true,
        props: () => ({ clearable: false }),
      },
    ],
  },
  {
    id: 'multi-select',
    name: 'Multi select',
    exportName: 'MultiSelect',
    group: 'Controls',
    width: CONTROL_WIDTH,
    description: 'A searchable dropdown of a field’s values, any number of which can be chosen.',
    notes: ['`results` holds one row per option. The choice is reported when the reader presses Apply.'],
    toggles: [],
    props: (ctx) => {
      const selected = ctx.state('selected', [], { type: 'string[]' });
      return {
        title: ctx.title,
        dimension: ctx.field('group'),
        results: ctx.rows('options', keep(ctx.ds.byGroup, names(ctx.ds).group)),
        selectedValues: selected.value,
        onChange: selected.set,
      };
    },
    variants: [
      {
        id: 'select-all',
        name: 'Multi select · select all',
        description: 'A “select all” row, and each tick applied as it is made.',
        notes: ['“Select all” shows only when every value is loaded: fewer rows than the 200-option limit.'],
        docsOnly: true,
        props: () => ({ showSelectAll: true, autoApply: true }),
      },
    ],
  },
  {
    id: 'dimension-select',
    name: 'Dimension select',
    exportName: 'DimensionSelect',
    group: 'Controls',
    width: CONTROL_WIDTH,
    description: 'A dropdown of fields: which one a chart groups its rows by.',
    notes: ['Pass the chosen field to a chart as its `dimension`, and query rows grouped by it.'],
    toggles: [],
    props: (ctx) => {
      const selected = ctx.state('dimension', undefined, { type: 'Dimension', imports: ['Dimension'] });
      return {
        title: ctx.title,
        dimensionOptions: [ctx.field('category'), ctx.field('group')],
        selectedDimension: selected.value,
        onChange: selected.set,
      };
    },
    variants: [
      {
        id: 'clearable',
        name: 'Dimension select · clearable',
        description: 'The reader can clear the choice, and you fall back to a field of your own.',
        notes: ['Cleared, `onChange` reports `undefined`: pass `dimension ?? region` to the chart.'],
        docsOnly: true,
        props: () => ({ clearable: true }),
      },
    ],
  },
  {
    id: 'measure-select',
    name: 'Measure select',
    exportName: 'MeasureSelect',
    group: 'Controls',
    width: CONTROL_WIDTH,
    description: 'A dropdown of fields: which number a chart shows.',
    notes: ['Pass the chosen field to a chart as its `measure`.'],
    toggles: [],
    props: (ctx) => {
      const selected = ctx.state('measure', undefined, { type: 'Measure', imports: ['Measure'] });
      return {
        title: ctx.title,
        measureOptions: [ctx.field('primary'), ctx.field('secondary')],
        selectedMeasure: selected.value,
        onChange: selected.set,
      };
    },
    variants: [
      {
        id: 'clearable',
        name: 'Measure select · clearable',
        description: 'The reader can clear the choice, and you fall back to a field of your own.',
        notes: ['Cleared, `onChange` reports `undefined`: pass a default measure to the chart.'],
        docsOnly: true,
        props: () => ({ clearable: true }),
      },
    ],
  },
  {
    id: 'measure-multi-select',
    name: 'Measure multi select',
    exportName: 'MeasureMultiSelect',
    group: 'Controls',
    width: CONTROL_WIDTH,
    description: 'A dropdown of fields, any number of which can be chosen: the numbers a chart shows.',
    notes: ['Pass the chosen fields to a chart as its `measures`. The choice is reported when the reader presses Apply.'],
    toggles: [],
    props: (ctx) => {
      const selected = ctx.state('measures', [], { type: 'Measure[]', imports: ['Measure'] });
      return {
        title: ctx.title,
        measureOptions: [ctx.field('primary'), ctx.field('secondary')],
        selectedMeasures: selected.value,
        onChange: selected.set,
      };
    },
    variants: [
      {
        id: 'auto-apply',
        name: 'Measure multi select · applied at once',
        description: 'Each tick is reported as it is made, with no Apply button.',
        docsOnly: true,
        props: () => ({ autoApply: true }),
      },
    ],
  },
  {
    id: 'dimension-or-measure-multi-select',
    name: 'Field multi select',
    exportName: 'DimensionOrMeasureMultiSelect',
    group: 'Controls',
    width: CONTROL_WIDTH,
    description: 'A dropdown of dimensions and measures alike, any number of which can be chosen: the columns of a table.',
    notes: ['The choice is reported when the reader presses Apply.'],
    toggles: [],
    props: (ctx) => {
      const selected = ctx.state('fields', [], { type: 'DimensionOrMeasure[]', imports: ['DimensionOrMeasure'] });
      return {
        title: ctx.title,
        dimensionAndMeasureOptions: [ctx.field('category'), ctx.field('primary'), ctx.field('secondary')],
        selectedDimensionsAndMeasures: selected.value,
        onChange: selected.set,
      };
    },
    variants: [
      {
        id: 'auto-apply',
        name: 'Field multi select · applied at once',
        description: 'Each tick is reported as it is made, with no Apply button.',
        docsOnly: true,
        props: () => ({ autoApply: true }),
      },
    ],
  },
  {
    id: 'filter-builder',
    name: 'Filter builder',
    exportName: 'FilterBuilder',
    group: 'Controls',
    width: FILTER_BUILDER_WIDTH,
    description: 'Filters the reader puts together: a field, a condition and a value, joined by “and” or “or”.',
    notes: [
      'The reader’s filters come back as a clause tree through `onChange`: send it to your API, or keep the matching rows with `applyFilters(rows, clause)`.',
      '`loadOptions` gives a filter on a dimension its values to pick from.',
    ],
    toggles: [],
    props: filterBuilderProps,
    variants: [
      {
        id: 'starting-filters',
        name: 'Filter builder · starting filters',
        description: 'The builder opens with filters already set, such as ones saved from an earlier visit.',
        docsOnly: true,
        props: savedFilters,
      },
    ],
  },
  {
    id: 'filter-builder-with-grouping',
    name: 'Filter builder with groups',
    exportName: 'FilterBuilderWithGrouping',
    group: 'Controls',
    width: FILTER_BUILDER_WIDTH,
    description: 'The filter builder with groups of filters, each joined by its own “and” or “or”.',
    notes: ['The clause tree nests a group’s filters under it. `applyFilters(rows, clause)` reads it the same way.'],
    toggles: [],
    props: filterBuilderProps,
    variants: [
      {
        id: 'starting-filters',
        name: 'Filter builder with groups · starting filters',
        description: 'The builder opens with filters already set, such as ones saved from an earlier visit.',
        docsOnly: true,
        props: savedFilters,
      },
    ],
  },
  {
    id: 'text-field',
    name: 'Text field',
    exportName: 'TextField',
    group: 'Controls',
    width: CONTROL_WIDTH,
    description: 'A free-text input, reported once the reader pauses typing.',
    toggles: [],
    props: (ctx) => {
      const text = ctx.state('text', '');
      return { title: ctx.title, placeholder: 'Type to search', value: text.value, onChange: text.set };
    },
    variants: [
      {
        id: 'starting-text',
        name: 'Text field · starting text',
        description: 'The field opens with text already in it, such as a search carried over from another page.',
        notes: ['`value` is read once, when the field mounts.'],
        docsOnly: true,
        props: (ctx) => {
          const text = ctx.state('text', 'Enterprise');
          return { value: text.value, onChange: text.set };
        },
      },
    ],
  },
];

// A chart's title names the fields it plots, so it lives with the field names
// in translations.ts. The entry keeps the English for the first dataset.
export const chartEntries: ChartEntry[] = entryDefs.map((def) => ({
  ...def,
  defaultTitle: chartTitle(datasets.saas, def.id) ?? def.name,
  variants: def.variants?.map((variant) => ({
    ...variant,
    title: chartTitle(datasets.saas, `${def.id}--${variant.id}`) ?? variant.name,
  })),
}));

export const chartGroups = ['KPIs', 'Bars', 'Stacked', 'Lines', 'Pies', 'Funnels', 'Scatter', 'Tables', 'Controls'] as const;

export const getEntry = (id: string) => chartEntries.find((e) => e.id === id);

// Translation id for a chart's title: the entry's, or its preset's.
export const titleId = (entry: ChartEntry, variant?: ChartVariant) =>
  variant ? `${entry.id}--${variant.id}` : entry.id;

export const getVariant = (entry: ChartEntry, id: string | undefined) =>
  id ? entry.variants?.find((v) => v.id === id) : undefined;


export const applyDataState = (response: DataResponse, state: DataState): DataResponse => {
  if (state === 'loading') return { isLoading: true };
  if (state === 'empty') return { isLoading: false, data: [] };
  if (state === 'error') return { isLoading: false, error: 'The query timed out after 30 seconds.' };
  return response;
};

export const fieldSpec = (ds: Dataset, slot: FieldSlot): FieldSpec => ds.specs[slot];
