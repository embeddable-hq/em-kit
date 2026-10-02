import { TimeRange } from '../../../../runtime/core';

export type ComparisonPeriodSelectFieldProOption = {
  label: string;
  value: string;
  dateFormat: string;
  getRange: (dateRange: TimeRange) => TimeRange;
};
