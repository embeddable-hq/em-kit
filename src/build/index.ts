// Build entry point: the toolkit the built-in charts are made from, for
// building your own chart that formats, colours, fills gaps and handles
// loading/empty/error exactly like them. Render inside <ChartsProvider>.
//
// Names match remarkable-pro / remarkable-ui so their docs and the
// build-component skill carry over. A `…Pro…` builder is the value-formatting
// overlay; merge it onto the matching remarkable-ui `get…ChartOptions` base,
// never use it alone (see the "Build your own chart" docs).

import { useTheme } from '../runtime/react';
import type { Theme } from '../generated/theme/theme.types';

/** The resolved theme from the nearest <ChartsProvider>. */
export const useChartsTheme = (): Theme => useTheme() as Theme;
export type { Theme };

// Theme: i18n and value formatting
export { i18nSetup, i18n } from '../generated/theme/i18n/i18n';
export { resolveI18nProps, resolveI18nString } from '../generated/components/component.utils';
export { getThemeFormatter } from '../generated/theme/formatter/formatter.utils';
export type { ThemeFormatter } from '../generated/theme/formatter/formatter.types';

// Data: time series and comparison periods
export { useFillGaps } from '../generated/components/charts/charts.fillGaps.hooks';
export { getDimensionWithGranularity } from '../generated/components/charts/utils/granularity.utils';
export { getTimeRangeFromDimensionValue } from '../generated/components/utils/dimension.utils';
export { getClientContextTimezone } from '../generated/theme/utils/clientContext.utils';
export {
  defaultComparisonPeriodOptions,
  type ComparisonPeriodOption,
} from '../generated/theme/defaults/defaults.ComparisonPeriods.constants';
export { getComparisonPeriodDateRange } from '../generated/components/utils/timeRange.utils';
export { groupTailAsOther } from '../generated/components/charts/charts.utils';

// Colour and theme tokens
export { getChartColors } from '../generated-ui/components/charts/charts.constants';
export {
  getDimensionMeasureColor,
  type GetDimensionMeasureColorProps,
} from '../generated/theme/styles/styles.utils';
export { getStyle, getStyleNumber } from '../generated-ui/styles/styles.utils';

// Card chrome: header, loading, empty and error states, download menu
export {
  ChartCard,
  asChartCardHeaderProps,
  type ChartCardHeaderProps,
} from '../generated/components/charts/shared/ChartCard/ChartCard';
export { EditorCard, type EditorCardProps } from '../generated/components/editors/shared/EditorCard/EditorCard';

// Chart.js primitives and their themed option bases (remarkable-ui)
export { BarChart, type BarChartProps } from '../generated-ui/components/charts/bars/BarChart';
export { LineChart, type LineChartProps } from '../generated-ui/components/charts/lines/LineChart';
export { PieChart, type PieChartProps } from '../generated-ui/components/charts/pies/PieChart/PieChart';
export { DonutChart } from '../generated-ui/components/charts/pies/DonutChart/DonutChart';
export { KpiChart } from '../generated-ui/components/charts/kpis/KpiChart';
export type { KpiChartProps } from '../generated-ui/components/charts/kpis/KpiChart.types';
export { getBarChartOptions } from '../generated-ui/components/charts/bars/bars.utils';
export { getLineChartOptions } from '../generated-ui/components/charts/lines/lines.utils';
export { getPieChartOptions, getDonutChartOptions } from '../generated-ui/components/charts/pies/pies.utils';
export { getChartjsAxisOptions } from '../generated-ui/components/charts/chartjs.cartesian.constants';

// Data and option builders from dimensions/measures (remarkable-pro)
export {
  getBarChartProData,
  getBarChartProOptions,
  getBarStackedChartProData,
  getBarStackedChartProOptions,
} from '../generated/components/charts/bars/bars.utils';
export {
  getLineChartProData,
  getLineChartProOptions,
} from '../generated/components/charts/lines/LineChartDefaultPro/LineChartDefaultPro.utils';
export { getPieChartProData, getPieChartProOptions } from '../generated/components/charts/pies/pies.utils';
