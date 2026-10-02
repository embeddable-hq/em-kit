import { TimeRange } from '../../../../../runtime/core';

export type DateRangeSelectFieldProOption = {
  label: string;
  value: string;
  dateFormat: string;
  getRange: (timezone?: string) => TimeRange;
};
