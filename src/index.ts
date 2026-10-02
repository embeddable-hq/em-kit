// Setup
export { ChartsProvider, type ChartsProviderProps } from './ChartsProvider';
export type { Theme } from './generated/theme/theme.types';
export { remarkableTheme as defaultTheme } from './generated/theme/theme.constants';

// Data contract
export { dimension, measure, results } from './data';
export type {
  DataResponse,
  Dimension,
  Measure,
  DimensionOrMeasure,
  Granularity,
  TimeRange,
  ValueOperation,
} from './runtime/core';

// Bars
export { default as BarChartDefaultPro, type BarChartDefaultProProps } from './generated/components/charts/bars/BarChartDefaultPro';
export { default as BarChartDefaultHorizontalPro, type BarChartDefaultHorizontalProProps } from './generated/components/charts/bars/BarChartDefaultHorizontalPro';
export { default as BarChartGroupedPro, type BarChartGroupedProProps } from './generated/components/charts/bars/BarChartGroupedPro';
export { default as BarChartGroupedHorizontalPro, type BarChartGroupedHorizontalProProps } from './generated/components/charts/bars/BarChartGroupedHorizontalPro';
export { default as BarChartStackedPro, type BarChartStackedProProps } from './generated/components/charts/bars/BarChartStackedPro';
export { default as BarChartStackedHorizontalPro, type BarChartStackedHorizontalProProps } from './generated/components/charts/bars/BarChartStackedHorizontalPro';

// Combo
export { default as BarLineChartPro } from './generated/components/charts/combo/BarLineChartPro';

// Lines
export { default as LineChartDefaultPro, type LineChartProProps } from './generated/components/charts/lines/LineChartDefaultPro';
export { default as LineChartGroupedPro, type LineChartGroupedProProp } from './generated/components/charts/lines/LineChartGroupedPro';
export { default as LineChartComparisonDefaultPro, type LineChartComparisonDefaultProProps } from './generated/components/charts/lines/LineChartComparisonDefaultPro';
export { default as LineChartWithKpiTabsPro, type LineChartWithKpiTabsProProps } from './generated/components/charts/lines/LineChartWithKpiTabsPro';
export { default as LineChartComparisonWithKpiTabsPro, type LineChartComparisonWithKpiTabsProProps } from './generated/components/charts/lines/LineChartComparisonWithKpiTabsPro';
export { default as AreaChartPro, type AreaChartProProps } from './generated/components/charts/lines/AreaChartPro';

// Pies
export { default as PieChartPro, type PieChartProProps } from './generated/components/charts/pies/PieChartPro';
export { default as DonutChartPro, type DonutChartProProps } from './generated/components/charts/pies/DonutChartPro';
export { default as DonutLabelChartPro, type DonutLabelChartProProps } from './generated/components/charts/pies/DonutLabelChartPro';

// Scatter
export { default as ScatterChartPro, type ScatterChartProProps } from './generated/components/charts/scatter/ScatterChartPro';
export { default as BubbleChartPro, type BubbleChartProProps } from './generated/components/charts/scatter/BubbleChartPro';

// KPIs
export { default as KpiChartNumberPro, type KpiChartNumberProProp } from './generated/components/charts/kpis/KpiChartNumberPro';
export { default as KpiChartNumberComparisonPro, type KpiChartNumberComparisonProProp } from './generated/components/charts/kpis/KpiChartNumberComparisonPro';

// Tables
export { default as HeatMapPro, type HeatMapProProps } from './generated/components/charts/tables/HeatMapPro';
export { default as PivotTablePro, type PivotTableProProps } from './generated/components/charts/tables/PivotTablePro';
export { default as TableChartPaginatedPro, type TableChartPaginatedProProps } from './generated/components/charts/tables/TableChartPaginated';
export { default as TableScrollablePro, type TableScrollableProProps } from './generated/components/charts/tables/TableScrollable';
