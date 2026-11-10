// Setup
export { ChartsProvider, type ChartsProviderProps } from './ChartsProvider';
export type { Theme } from './generated/theme/theme.types';
export { remarkableTheme as defaultTheme } from './generated/theme/theme.constants';

// AI chat: serializable specs in, charts out
export { ChartFromSpec, type ChartFromSpecProps } from './ChartFromSpec';
export { intentToPrompt, type ChartIntent, type ChartIntentType } from './intents';
export { CHART_KINDS, isChartKind } from './spec';
export type {
  ChartSpec,
  ChartKind,
  SpecField,
  SpecFieldFormat,
  SpecRow,
  FieldRef,
  DateRangeSpec,
  BarSpec,
  BarGroupedSpec,
  LineSpec,
  LineGroupedSpec,
  AreaSpec,
  BarLineSpec,
  PieSpec,
  ScatterSpec,
  BubbleSpec,
  KpiSpec,
  KpiComparisonSpec,
  TableSpec,
  HeatMapSpec,
  PivotSpec,
} from './spec';

// Data contract
export { dimension, measure, results } from './data';
export type { FieldInputs } from './fieldInputs';
export type {
  DataResponse,
  Dimension,
  Measure,
  DimensionOrMeasure,
  Granularity,
  TimeRange,
} from './runtime/core';

// Bars
export { default as BarChart, type BarChartDefaultProProps as BarChartProps } from './generated/components/charts/bars/BarChartDefaultPro';
export { default as BarChartHorizontal, type BarChartDefaultHorizontalProProps as BarChartHorizontalProps } from './generated/components/charts/bars/BarChartDefaultHorizontalPro';
export { default as BarChartGrouped, type BarChartGroupedProProps as BarChartGroupedProps } from './generated/components/charts/bars/BarChartGroupedPro';
export { default as BarChartGroupedHorizontal, type BarChartGroupedHorizontalProProps as BarChartGroupedHorizontalProps } from './generated/components/charts/bars/BarChartGroupedHorizontalPro';
export { default as BarChartStacked, type BarChartStackedProProps as BarChartStackedProps } from './generated/components/charts/bars/BarChartStackedPro';
export { default as BarChartStackedHorizontal, type BarChartStackedHorizontalProProps as BarChartStackedHorizontalProps } from './generated/components/charts/bars/BarChartStackedHorizontalPro';

// Combo
export { default as BarLineChart, type BarLineChartProProps as BarLineChartProps } from './generated/components/charts/combo/BarLineChartPro';

// Lines
export { default as LineChart, type LineChartProProps as LineChartProps } from './generated/components/charts/lines/LineChartDefaultPro';
export { default as LineChartGrouped, type LineChartGroupedProProp as LineChartGroupedProps } from './generated/components/charts/lines/LineChartGroupedPro';
export { default as LineChartComparison, type LineChartComparisonDefaultProProps as LineChartComparisonProps } from './generated/components/charts/lines/LineChartComparisonDefaultPro';
export { default as LineChartWithKpiTabs, type LineChartWithKpiTabsProProps as LineChartWithKpiTabsProps } from './generated/components/charts/lines/LineChartWithKpiTabsPro';
export { default as LineChartComparisonWithKpiTabs, type LineChartComparisonWithKpiTabsProProps as LineChartComparisonWithKpiTabsProps } from './generated/components/charts/lines/LineChartComparisonWithKpiTabsPro';
export { default as AreaChart, type AreaChartProProps as AreaChartProps } from './generated/components/charts/lines/AreaChartPro';

// Pies
export { default as PieChart, type PieChartProProps as PieChartProps } from './generated/components/charts/pies/PieChartPro';
export { default as DonutChart, type DonutChartProProps as DonutChartProps } from './generated/components/charts/pies/DonutChartPro';
export { default as DonutLabelChart, type DonutLabelChartProProps as DonutLabelChartProps } from './generated/components/charts/pies/DonutLabelChartPro';

// Scatter
export { default as ScatterChart, type ScatterChartProProps as ScatterChartProps } from './generated/components/charts/scatter/ScatterChartPro';
export { default as BubbleChart, type BubbleChartProProps as BubbleChartProps } from './generated/components/charts/scatter/BubbleChartPro';

// KPIs
export { default as KpiNumber, type KpiChartNumberProProp as KpiNumberProps } from './generated/components/charts/kpis/KpiChartNumberPro';
export { default as KpiNumberComparison, type KpiChartNumberComparisonProProp as KpiNumberComparisonProps } from './generated/components/charts/kpis/KpiChartNumberComparisonPro';

// Tables
export { default as HeatMap, type HeatMapProProps as HeatMapProps } from './generated/components/charts/tables/HeatMapPro';
export { default as PivotTable, type PivotTableProProps as PivotTableProps } from './generated/components/charts/tables/PivotTablePro';
export { default as TablePaginated, type TableChartPaginatedProProps as TablePaginatedProps } from './generated/components/charts/tables/TableChartPaginated';
export {
  TableScrollable,
  TABLE_SCROLLABLE_SIZE,
  type TableScrollableProps,
  type TableScrollableState,
} from './TableScrollable';
