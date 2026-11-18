// Setup
export { ChartsProvider, type ChartsProviderProps } from './ChartsProvider';
export type { Theme } from './generated/theme/theme.types';
export { remarkableTheme as defaultTheme } from './generated/theme/theme.constants';
// An entry in a card's menu: theme.defaults.chartMenuOptions is a list of these.
export type { ChartCardMenuOption } from './generated/theme/defaults/defaults.ChartCardMenu.constants';

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

// Event payloads and controlled state, under the names the props reference
// uses for them (the upstream `Pro` infix dropped, as for the components).
export type {
  BarChartProOptionsClickArg as BarChartOptionsClickArg,
  BarChartStackedProOptionsClickArg as BarChartStackedOptionsClickArg,
} from './generated/components/charts/bars/bars.types';
export type { BarLineChartProClickArg as BarLineChartClickArg } from './generated/components/charts/combo/combo.types';
export type {
  LineChartProOptionsClickArg as LineChartOptionsClickArg,
  LineChartGroupedProOptionsClickArg as LineChartGroupedOptionsClickArg,
  AreaChartProPointClickArg as AreaChartPointClickArg,
  AreaChartProAreaClickArg as AreaChartAreaClickArg,
} from './generated/components/charts/lines/lines.types';
export type { PieChartClickArg } from './generated/components/charts/pies/pies.types';
export type { ScatterChartProOptionsClickArg as ScatterChartOptionsClickArg } from './generated/components/charts/scatter/ScatterChartPro/ScatterChartPro.types';
export type { BubbleChartProOptionsClickArg as BubbleChartOptionsClickArg } from './generated/components/charts/scatter/BubbleChartPro/BubbleChartPro.types';
export type { HeatMapProOptionsClickArg as HeatMapOptionsClickArg } from './generated/components/charts/tables/HeatMapPro/HeatMapPro.types';
export type {
  TableChartPaginatedProState as TablePaginatedState,
  TableChartPaginatedProOnRowClickArg as TablePaginatedOnRowClickArg,
} from './generated/components/charts/tables/TableChartPaginated';
export type { TableScrollableProOnRowClickArg as TableScrollableOnRowClickArg } from './generated/components/charts/tables/TableScrollable';

// Components: generated from scripts/components.manifest.mjs
export * from './components.generated';

// Hand-written wrappers (status 'wrapped' in the manifest)
export {
  TableScrollable,
  TABLE_SCROLLABLE_SIZE,
  type TableScrollableProps,
  type TableScrollableState,
} from './TableScrollable';
