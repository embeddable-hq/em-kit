// The serializable chart spec: what an LLM tool call (or any JSON source)
// returns, and what <ChartFromSpec> renders. Everything here must survive
// JSON.stringify/parse — no functions, Dates, or class instances.
//
// Conventions, chosen for producers that only see a schema:
// - Fields are a bare row-key string or a SpecField object (`FieldRef`).
// - Options use the component prop names, but always in vertical orientation:
//   `xAxis`/`xAxisLabel` is the category axis and `yAxisRange*` the value
//   range even for horizontal variants — the renderer swaps axes.
// - `granularity` is set once, on the chart, never on a field.

import type { Granularity, NativeDataType } from './runtime/core';
import type { FieldInputs } from './fieldInputs';

export type SpecRow = Record<string, unknown>;

/**
 * Per-field options, applied via the field's `inputs`: formatting (prefix,
 * suffix, decimalPlaces, …) plus chart-specific ones such as a pivot table's
 * columnAggregation/rowAggregation. Time-axis settings live on the chart.
 */
export type SpecFieldFormat = Omit<FieldInputs, 'granularity' | 'showGranularityDropdown' | 'dateBounds'>;

export type SpecField = {
  /** Row key: values are read from `rows[i][name]`. */
  name: string;
  /** Display name. Defaults to `name`. */
  title?: string;
  /** Inferred from the row values when omitted. */
  type?: NativeDataType;
  /**
   * Only meaningful where a chart takes mixed columns (`table`): whether the
   * field is a category (`dimension`) or a numeric value (`measure`).
   * Inferred from `type`/row values when omitted.
   */
  role?: 'dimension' | 'measure';
  format?: SpecFieldFormat;
};

/** A field is a bare row-key string or a full descriptor. */
export type FieldRef = string | SpecField;

/** ISO date strings (`YYYY-MM-DD` or full timestamps), no zone suffix. */
export type DateRangeSpec = { from?: string; to?: string };

type BaseSpec = {
  title?: string;
  description?: string;
  /**
   * The data, long format: one row per category (× group) combination.
   * Omit while loading. Time values are zone-less ISO strings — the renderer
   * also accepts `YYYY-MM-DD` and epoch milliseconds and normalizes.
   */
  rows?: SpecRow[];
  /** Force the loading state, e.g. while more rows stream in. */
  loading?: boolean;
  /** Render the error state with this message instead of data. */
  error?: string;
};

type LegendOptions = {
  showLegend?: boolean;
  maxLegendItems?: number;
};

type CartesianOptions = LegendOptions & {
  showTooltips?: boolean;
  showValueLabels?: boolean;
  showLogarithmicScale?: boolean;
  /** Category-axis label (vertical orientation; see header). */
  xAxisLabel?: string;
  /** Value-axis label. */
  yAxisLabel?: string;
  /** Value-axis range. */
  yAxisRangeMin?: number;
  yAxisRangeMax?: number;
  /** Reverse the category order. */
  reverseXAxis?: boolean;
  /** Cap on rendered categories. */
  xAxisMaxItems?: number;
};

type StackableOptions = CartesianOptions & {
  showTotalLabels?: boolean;
};

export type BarSpec = BaseSpec & {
  chart: 'bar' | 'barHorizontal';
  /** Category dimension. */
  dimension: FieldRef;
  /** One measure per bar series. */
  measures: FieldRef | FieldRef[];
  /** When `dimension` is a time field: its bucket size. */
  granularity?: Granularity;
  options?: CartesianOptions;
};

export type BarGroupedSpec = BaseSpec & {
  chart: 'barGrouped' | 'barGroupedHorizontal' | 'barStacked' | 'barStackedHorizontal';
  /** Category axis dimension (renders on y for horizontal variants). */
  xAxis: FieldRef;
  /** Dimension that splits each category into grouped/stacked bars. */
  groupBy: FieldRef;
  measure: FieldRef;
  /** When `xAxis` is a time field: its bucket size. */
  granularity?: Granularity;
  options?: StackableOptions;
};

export type LineSpec = BaseSpec & {
  chart: 'line';
  xAxis: FieldRef;
  /** One measure per line. */
  measures: FieldRef | FieldRef[];
  /** When `xAxis` is a time field: its bucket size. */
  granularity?: Granularity;
  options?: CartesianOptions;
};

export type LineGroupedSpec = BaseSpec & {
  chart: 'lineGrouped';
  xAxis: FieldRef;
  /** Dimension that splits the measure into one line per value. */
  groupBy: FieldRef;
  measure: FieldRef;
  granularity?: Granularity;
  options?: CartesianOptions;
};

export type AreaSpec = BaseSpec & {
  chart: 'area';
  xAxis: FieldRef;
  /** Stacking dimension. Omit for a single-series area. */
  groupBy?: FieldRef;
  measure: FieldRef;
  granularity?: Granularity;
  options?: CartesianOptions;
};

export type LineWithKpiTabsSpec = BaseSpec & {
  chart: 'lineWithKpiTabs';
  xAxis: FieldRef;
  /** One measure per KPI tab; each tab plots its measure as the line. */
  measures: FieldRef | FieldRef[];
  /**
   * One row holding each measure's headline number for the tabs.
   * Derived by summing `rows` when omitted.
   */
  kpiRows?: SpecRow[];
  granularity?: Granularity;
  options?: CartesianOptions;
};

export type LineComparisonSpec = BaseSpec & {
  chart: 'lineComparison';
  xAxis: FieldRef;
  measures: FieldRef | FieldRef[];
  /** Rows for the comparison period, same shape as `rows`; aligned by position. */
  comparisonRows?: SpecRow[];
  /** Label for the comparison, e.g. 'Previous period'. */
  comparisonLabel?: string;
  /** Periods covered; derived from each row set's time extent when omitted. */
  dateRange?: DateRangeSpec;
  comparisonDateRange?: DateRangeSpec;
  granularity?: Granularity;
  options?: CartesianOptions & {
    /** Second x-axis showing the comparison period's dates. */
    showComparisonAxis?: boolean;
  };
};

export type LineComparisonWithKpiTabsSpec = BaseSpec & {
  chart: 'lineComparisonWithKpiTabs';
  xAxis: FieldRef;
  measures: FieldRef | FieldRef[];
  comparisonRows?: SpecRow[];
  /** See LineWithKpiTabsSpec.kpiRows; derived from `rows` when omitted. */
  kpiRows?: SpecRow[];
  /** Headline numbers for the comparison period; derived from `comparisonRows`. */
  kpiComparisonRows?: SpecRow[];
  comparisonLabel?: string;
  dateRange?: DateRangeSpec;
  comparisonDateRange?: DateRangeSpec;
  granularity?: Granularity;
  options?: CartesianOptions & {
    showComparisonAxis?: boolean;
  };
};

export type BarLineSpec = BaseSpec & {
  chart: 'barLine';
  dimension: FieldRef;
  /** Measures drawn as bars (left axis). */
  barMeasures: FieldRef | FieldRef[];
  /** Measures drawn as lines (right axis). */
  lineMeasures?: FieldRef | FieldRef[];
  granularity?: Granularity;
  options?: CartesianOptions & {
    showValueLabelsLine?: boolean;
    /** Right (line) axis. */
    yAxisSecondaryLabel?: string;
    yAxisSecondaryMin?: number;
    yAxisSecondaryMax?: number;
  };
};

type PieOptions = LegendOptions & {
  showTooltips?: boolean;
  showValueLabels?: boolean;
  showValueLabelsAsPercentage?: boolean;
};

export type PieSpec = BaseSpec & {
  chart: 'pie' | 'donut';
  dimension: FieldRef;
  measure: FieldRef;
  options?: PieOptions;
};

export type DonutLabelSpec = BaseSpec & {
  chart: 'donutLabel';
  dimension: FieldRef;
  measure: FieldRef;
  /**
   * The headline number in the donut's center. Omitted fields are derived:
   * `measure` defaults to the main measure, `value` to the sum of the rows.
   */
  innerLabel?: { text?: string; measure?: FieldRef; value?: number | string };
  options?: PieOptions;
};

type PointChartOptions = LegendOptions & {
  showTooltips?: boolean;
  /** Label each point with its dimension value. */
  showPointLabels?: boolean;
  showValueLabels?: boolean;
  showLogarithmicScale?: boolean;
  xAxisLabel?: string;
  yAxisLabel?: string;
  xAxisRangeMin?: number;
  xAxisRangeMax?: number;
  yAxisRangeMin?: number;
  yAxisRangeMax?: number;
  reverseXAxis?: boolean;
  /** CSS color for ungrouped points. */
  pointColor?: string;
};

export type ScatterSpec = BaseSpec & {
  chart: 'scatter';
  xMeasure: FieldRef;
  yMeasure: FieldRef;
  /** Dimension identifying each point. */
  pointDimension: FieldRef;
  /** Optional dimension that colors points by group. */
  groupByDimension?: FieldRef;
  options?: PointChartOptions;
};

export type BubbleSpec = BaseSpec & {
  chart: 'bubble';
  xMeasure: FieldRef;
  yMeasure: FieldRef;
  bubbleSizeMeasure: FieldRef;
  pointDimension: FieldRef;
  groupByDimension?: FieldRef;
  options?: PointChartOptions & {
    bubbleRadiusMin?: number;
    bubbleRadiusMax?: number;
  };
};

export type KpiSpec = BaseSpec & {
  chart: 'kpi';
  measure: FieldRef;
  /** Shortcut for `rows: [{ [measure.name]: value }]`. Ignored when `rows` is set. */
  value?: number | string;
  options?: {
    fontSize?: number;
    displayNullAs?: string;
  };
};

export type KpiComparisonSpec = BaseSpec & {
  chart: 'kpiComparison';
  measure: FieldRef;
  /** Shortcut for `rows`; see KpiSpec.value. */
  value?: number | string;
  /** The value compared against. Shortcut for `comparisonRows`. */
  comparisonValue?: number | string;
  /** Rows for the comparison period, same shape as `rows`. */
  comparisonRows?: SpecRow[];
  /** Label for the comparison, e.g. 'Previous period'. */
  comparisonLabel?: string;
  /** Period the main value covers. */
  dateRange?: DateRangeSpec;
  /** Period the comparison value covers. */
  comparisonDateRange?: DateRangeSpec;
  options?: {
    fontSize?: number;
    changeFontSize?: number;
    displayChangeAsPercentage?: boolean;
    /** When a decrease is good (costs, churn). */
    reversePositiveNegativeColors?: boolean;
    percentageDecimalPlaces?: number;
    displayNullAs?: string;
  };
};

export type TableSpec = BaseSpec & {
  chart: 'table';
  /** Columns, in display order. `role` disambiguates dimension vs measure. */
  columns: FieldRef[];
  options?: {
    /** Number the rows. */
    showIndex?: boolean;
    displayNullAs?: string;
  };
};

export type HeatMapSpec = BaseSpec & {
  chart: 'heatmap';
  rowDimension: FieldRef;
  columnDimension: FieldRef;
  measure: FieldRef;
  options?: {
    /** Print the measure value in each cell. */
    showValues?: boolean;
    /** CSS colors for the value scale. */
    minColor?: string;
    midColor?: string;
    maxColor?: string;
    /** Values at/below this render as minColor. */
    minThreshold?: string;
    /** Values at/above this render as maxColor. */
    maxThreshold?: string;
    displayNullAs?: string;
    columnWidth?: number;
    firstColumnWidth?: number;
  };
};

export type PivotSpec = BaseSpec & {
  chart: 'pivot';
  rowDimension: FieldRef;
  columnDimension: FieldRef;
  measures: FieldRef | FieldRef[];
  /** Expandable second row level. Requires `subRows`. */
  subRowDimension?: FieldRef;
  /** Rows for the sub-row level, long format including the parent row key. */
  subRows?: SpecRow[];
  options?: {
    displayNullAs?: string;
    columnWidth?: number;
    firstColumnWidth?: number;
  };
};

export type ChartSpec =
  | BarSpec
  | BarGroupedSpec
  | LineSpec
  | LineGroupedSpec
  | LineWithKpiTabsSpec
  | LineComparisonSpec
  | LineComparisonWithKpiTabsSpec
  | AreaSpec
  | BarLineSpec
  | PieSpec
  | DonutLabelSpec
  | ScatterSpec
  | BubbleSpec
  | KpiSpec
  | KpiComparisonSpec
  | TableSpec
  | HeatMapSpec
  | PivotSpec;

export type ChartKind = ChartSpec['chart'];

export const CHART_KINDS = [
  'bar',
  'barHorizontal',
  'barGrouped',
  'barGroupedHorizontal',
  'barStacked',
  'barStackedHorizontal',
  'line',
  'lineGrouped',
  'lineWithKpiTabs',
  'lineComparison',
  'lineComparisonWithKpiTabs',
  'area',
  'barLine',
  'pie',
  'donut',
  'donutLabel',
  'scatter',
  'bubble',
  'kpi',
  'kpiComparison',
  'table',
  'heatmap',
  'pivot',
] as const satisfies readonly ChartKind[];

export const isChartKind = (value: unknown): value is ChartKind =>
  typeof value === 'string' && (CHART_KINDS as readonly string[]).includes(value);
