import type { BubbleChartInputPoint } from '../../../../../generated-ui/index';
import type { ScatterChartProOptionsClickArg } from '../ScatterChartPro/ScatterChartPro.types';

export type BubblePoint = BubbleChartInputPoint & { rowIndex: number };

export type BubbleChartProOptionsClickArg = ScatterChartProOptionsClickArg & {
  sizeMeasureValue: string;
};
