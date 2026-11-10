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

// Components: generated from scripts/components.manifest.mjs
export * from './components.generated';

// Hand-written wrappers (status 'wrapped' in the manifest)
export {
  TableScrollable,
  TABLE_SCROLLABLE_SIZE,
  type TableScrollableProps,
  type TableScrollableState,
} from './TableScrollable';
