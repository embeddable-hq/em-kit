import { TimeRange } from '../../../../../runtime/core';

export type ScatterChartProOptionsClickArg = {
  xMeasureValue: string;
  yMeasureValue: string;
  pointDimensionValue: string | undefined;
  groupByDimensionValue: string | null | undefined;
  pointDimensionTimeRange: TimeRange;
  groupByDimensionTimeRange: TimeRange;
};
