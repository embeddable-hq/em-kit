import { results } from './data';
import type { DataResponse, Dimension, TimeRange } from './runtime/core';
import { useTheme } from './runtime/react';
import type { Theme } from './generated/theme/theme.types';
import { getComparisonPeriodDateRange } from './generated/components/utils/timeRange.utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

/** A select's options from rows you already hold: one row per distinct value of the field, in first-seen order. */
export const optionsOf = (rows: Row[] | undefined, field: Dimension): DataResponse => {
  if (!rows) return results(undefined);
  const seen = new Map<unknown, Row>();
  for (const row of rows) {
    const value = row[field.name];
    if (value != null && !seen.has(value)) seen.set(value, { [field.name]: value });
  }
  return results([...seen.values()]);
};

/**
 * The dates a comparison period covers, worked out from the range it is
 * compared with (a preset or dates), in the provider's time zone and with the
 * provider's `defaults.comparisonPeriodsOptions`. `undefined` until both are set.
 */
export const useComparisonRange = (range: TimeRange | undefined, period: string | undefined): TimeRange | undefined => {
  const theme = useTheme() as Theme;
  return range ? getComparisonPeriodDateRange(range, period, theme) : undefined;
};
