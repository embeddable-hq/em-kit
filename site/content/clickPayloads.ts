// Click handlers that pass more than the shared payload: BarChart,
// BarChartHorizontal, LineChart and LineChartWithKpiTabs build theirs with
// createSimpleClickHandler (src/generated/components/charts/charts.utils.ts),
// which adds `measureValues` (the comparison line chart sets `measureValue`
// instead). Their exported types now declare both (a rewrite
// in scripts/sync.mjs), so the pages have nothing to apologise for.
// tests/payloads.test.tsx clicks each component to hold this to the code.

export const MEASURE_VALUES_HANDLERS: Record<string, string> = {};
export const MEASURE_VALUE_UNSET: string[] = [];

// What a click reports for the value clicked, said once for every page.
// createSimpleClickHandler and createGroupedClickHandler upstream (charts.utils.ts),
// and the combo and area charts' own handlers, build `dimensionTimeRange` from
// the clicked label and then clear `dimensionValue` whenever there is one.
// tests/payloads.test.tsx clicks a category axis and a time axis of each.

/** The value half of a bar, line or area click payload. */
export const CLICK_VALUE =
  '`dimensionValue` on a category axis; on a time axis `dimensionValue` is `undefined` and `dimensionTimeRange` holds the period';

/** A click handler's note: "Called with the clicked bar: …". */
export const clickNote = (what: string) => `Called with the clicked ${what}: ${CLICK_VALUE}.`;

/** The Events guide's rows for the same two keys. */
export const CLICK_VALUE_ROW = 'The clicked category, such as `\'EMEA\'`. `undefined` when the axis is a time dimension.';
export const CLICK_TIME_RANGE_ROW = 'On a time axis, the clicked period as a `TimeRange`. `undefined` on a category axis.';

// `TimeRange` is declared with `from` and `to` required, each allowed to be
// unset, `relativeTimeString` optional, and the whole may be `undefined`: the shape is printed as declared
// (typeDefinitions, from scripts/props.mjs), and this says what that means
// when you write one and when you read one. getTimeRangeFromDimensionValue
// upstream returns `undefined` off a time axis and never sets `relativeTimeString`.
export const TIME_RANGE_NOTE =
  'A click payload’s `TimeRange` is `undefined` unless the clicked field is a time dimension, and its `relativeTimeString` is always `undefined`, so read it as `range?.from`. When you pass one, `from` and `to` are enough.';
