// One-line descriptions for the props reference, keyed by prop name. The prop
// list itself is generated from the types (site/generated/props.ts); these
// notes are the human layer on top. Every prop of every chart has one:
// tests/componentPages.test.tsx fails when a new prop arrives without a note.
// A note says what the code does: tests/accuracy.test.tsx renders the charts
// to hold the closed sets, the defaults and the ignored props to that.

/** The values `comparisonPeriod` accepts: the package's nine comparison periods, in its order. */
export const COMPARISON_PERIODS = [
  'Previous period',
  'Previous week',
  'Previous month',
  'Previous quarter',
  'Previous year',
  'Same period last week',
  'Same period last month',
  'Same period last quarter',
  'Same period last year',
];

/** The values of the exported `Granularity` type, smallest first. */
export const GRANULARITIES = ['second', 'minute', 'hour', 'day', 'week', 'month', 'quarter', 'year'];

const oneOf = (values: string[]) => values.map((value) => `\`"${value}"\``).join(', ');

// The same shape on both date-range props. relativeTimeString is optional:
// fixed dates need only from and to.
const TIME_RANGE = '`{ from: Date, to: Date }`, with an optional `relativeTimeString` naming a preset';

/**
 * Which granularity does what. Said in the same words on every page that has
 * both: the field's value drives the axis, the chart's prop only click ranges.
 */
export const GRANULARITY_RULE =
  'The axis labels and the gap filling come from the time field, `dimension({ granularity })`, and this prop follows the field when left out.';

const global: Record<string, string> = {
  // Data
  results:
    'Your query’s state: `{ isLoading, data, error }`, where `data` is your rows. `results(rows)` builds it from an array.',
  resultsComparison: 'Rows for the comparison period, with the same keys as `results`.',
  resultsInnerLabel: 'A one-row result whose value is shown in the centre of the donut.',
  resultsKpis: 'One row holding each measure’s total, shown as tabs above the chart. Clicking a tab plots that measure.',
  resultsKpisComparison: 'The same one row for the comparison period, so each tab can show its change.',
  resultsSubRows: 'Rows for the second level, loaded when a row is expanded.',
  resultsAxisOrder:
    'A separate result listing the axis values in the order to draw them, for example largest first. Reported back through `setAxisOrderAndCacheKey`.',
  resultsGroupOrder:
    'A separate result listing the `groupBy` values in the order you want, for example largest first. Reported back through `setGroupOrderAndCacheKey`.',
  resultsGroupOther:
    'Totals per axis value across every group. The chart subtracts the groups in `results` and draws what is left as an “Other” series.',
  allResults:
    'Every row, unpaged, for the downloads in the card menu. A download waits until this is set and not loading, so without it the menu spins for good. `state.isLoadingDownloadData` turns `true` when a reader asks, if you would rather fetch only then.',
  totalResults: 'A result carrying only `total`, the number of rows across all pages. The page count is worked out from it.',

  // Fields
  dimension: 'The field whose values label the axis or the segments. Its `name` is the row key.',
  measure: 'The numeric field to plot. Its `inputs` (`prefix`, `suffix`, `decimalPlaces`) set the formatting.',
  measures: 'The numeric fields to plot, one series each. Their `inputs` set the formatting.',
  lineMeasures: 'Measures drawn as lines over the bars. Set `useSecondaryAxis` on a measure to give it the right-hand axis.',
  dimensionsAndMeasures: 'The table columns, in order. Dimensions show as text, measures as formatted numbers.',
  xAxis: 'The dimension along the x-axis. A time dimension gets gap filling and date labels.',
  yAxis: 'The dimension down the y-axis of a horizontal chart.',
  groupBy: 'A second dimension that splits each axis value into one series per value.',
  groupByDimension: 'An optional dimension that colours the points by group.',
  pointDimension: 'The dimension that names each point, used in the tooltip and the point label.',
  xMeasure: 'The measure plotted along the x-axis.',
  yMeasure: 'The measure plotted along the y-axis.',
  bubbleSizeMeasure: 'A third measure, drawn as the size of each bubble.',
  bubbleRadiusMin: 'Radius in pixels of the smallest bubble.',
  bubbleRadiusMax: 'Radius in pixels of the largest bubble.',
  rowDimension: 'The dimension down the side of the grid.',
  columnDimension: 'The dimension across the top of the grid.',
  subRowDimension: 'A second row dimension, shown when a row is expanded.',
  innerLabelMeasure: 'The measure shown in the centre of the donut, read from `resultsInnerLabel`.',
  innerLabelText: 'The caption under the centre value.',
  clickDimension: 'The dimension whose value `onRowClicked` receives. Rows are only clickable when it is set.',
  sectionDimension: 'The dimension whose values are the funnel’s steps. Rows with the same step are added up.',
  countMeasure: 'The measure that sizes each step.',
  orderDimension: 'A numeric field giving each step’s position, lowest first. Without it, steps run largest to smallest.',

  // Time
  granularity: `Only sets the size of the date range a click reports (\`dimensionTimeRange\`). ${GRANULARITY_RULE} One of ${oneOf(GRANULARITIES)}.`,
  setGranularity:
    'Called with the granularity the reader picks in the card. The picker only shows when the time field sets `showGranularityDropdown: true` in its `inputs`. Store the value, set it as the field’s `granularity` and pass rows at that granularity.',
  primaryDateRange: `The dates \`results\` covers: ${TIME_RANGE}. The x-axis runs from \`from\` to \`to\`.`,
  comparisonDateRange: `The dates \`resultsComparison\` covers: ${TIME_RANGE}. The comparison’s axis runs from \`from\` to \`to\`.`,
  setComparisonDateRange:
    'If set, the chart works out the comparison dates from `primaryDateRange` and `comparisonPeriod` and calls this with them, so you can query them. When it cannot work them out, it calls this with no range.',
  comparisonPeriod: `Which period \`resultsComparison\` holds. One of ${oneOf(COMPARISON_PERIODS)}. Without it the comparison is not drawn. With \`setComparisonDateRange\` the comparison dates are worked out from it, and any other string gives no range.`,
  showComparisonAxis: 'Show a second x-axis with the comparison period’s dates. Set it to `false` to draw both lines against the current dates.',

  // Controlled tables
  state: 'Paging and sorting, controlled: keep it in `useState` and build your query from it. Without `state` and `setState` the table cannot page or sort; downloads need only `allResults`.',
  setState:
    'A function that stores the new state, such as the setter from `useState`. Called when the reader pages, sorts or downloads, and when the page size is first known or changes.',
  showIndex: 'Number the rows.',
  resetKey:
    'Any value that identifies the current query, such as your filters. When it changes (compared by value), the table goes back to the top and starts again from page 0.',
  heightMode:
    '`"fixed"` scrolls inside the card and loads pages as the reader scrolls. `"auto"` grows the card to fit every row you pass.',
  // PivotTable: called once per row, on first opening (see writtenExamples in content/components.ts).
  expandedRowKeys: 'The rows whose sub-rows you load, by `rowDimension` value: each key `setExpandedRowKey` has given you. Only needed with `subRowDimension`.',
  setExpandedRowKey:
    'Called with a row’s `rowDimension` value, as a string, the first time a reader opens the row. Add it to `expandedRowKeys` and load `resultsSubRows` for it; closing the row is the table’s own.',

  // Events
  onBarClicked: 'Called with the clicked bar’s dimension value and, on a time axis, its date range. Use it as a filter.',
  onLineClicked: 'Called with the clicked point’s dimension value and date range.',
  onPointClicked: 'Called with the clicked point’s dimension value, date range and measure value.',
  onAreaClicked: 'Called with the clicked area’s `groupBy` value.',
  onPointClick: 'Called with the clicked point’s dimension value and its x and y values.',
  // createPieClickHandler upstream reads the raw row at the slice's index, so the
  // "Other" slice (maxLegendItems) reports the first row it adds up. tests/libraryDefaults.test.tsx holds this to the code.
  onSegmentClick:
    'Called with the clicked segment’s dimension value. Use it as a filter. A click on the “Other” segment reports the first of the rows it adds up, so ignore that one.',
  onCellClicked: 'Called with the clicked cell’s row and column values.',
  onRowClicked: 'Called with the clicked row’s `clickDimension` value.',

  // Axes and scales
  xAxisLabel: 'A title under the x-axis.',
  yAxisLabel: 'A title beside the y-axis.',
  yAxisSecondaryLabel: 'A title beside the right-hand axis.',
  // Bars, lines and areas set Chart.js's `beginAtZero` on the value axis (bars.utils.ts and
  // lines.utils.ts upstream); scatter and bubble charts do not. tests/accuracy.test.tsx draws both.
  xAxisRangeMin: 'Fix the lowest value on the x-axis. When unset, a horizontal bar chart’s axis includes zero, and a scatter or bubble chart’s fits the data.',
  xAxisRangeMax: 'Fix the highest value on the x-axis. When unset, it fits the data.',
  yAxisRangeMin: 'Fix the lowest value on the y-axis. When unset, a bar, line or area chart’s axis includes zero, and a scatter or bubble chart’s fits the data.',
  yAxisRangeMax: 'Fix the highest value on the y-axis. When unset, it fits the data.',
  yAxisSecondaryMin: 'Fix the lowest value on the right-hand axis.',
  yAxisSecondaryMax: 'Fix the highest value on the right-hand axis.',
  xAxisMaxItems: 'Show at most this many x values. The rest are added up into one “Other” value.',
  yAxisMaxItems: 'Show at most this many y values. The rest are added up into one “Other” value.',
  maxLegendItems: 'Show at most this many segments. The rest are added up into one “Other” segment.',
  reverseXAxis: 'Reverse the order of the x-axis.',
  reverseYAxis: 'Reverse the order of the y-axis.',
  showLogarithmicScale: 'Use a logarithmic value axis, for values that span several orders of magnitude.',
  axisOrder: 'The axis values in the order to draw them. Values missing from the list are left out.',
  axisOrderCacheKey:
    'Any string identifying the `resultsAxisOrder` query. Passed back as the second argument of `setAxisOrderAndCacheKey`, which is only called when this is set.',
  setAxisOrderAndCacheKey:
    'Called with the values from `resultsAxisOrder` and `axisOrderCacheKey` once that result has loaded. Store the values and pass them as `axisOrder`.',
  groupOrderCacheKey:
    'Any string identifying the `resultsGroupOrder` query. Passed back as the second argument of `setGroupOrderAndCacheKey`, which is only called when this is set.',
  setGroupOrderAndCacheKey:
    'Called with the values from `resultsGroupOrder` and `groupOrderCacheKey` once that result has loaded. Store them to query only the top groups.',

  // Display
  showLegend: 'Show the legend. Entries wrap onto more lines when they do not fit.',
  showTooltips: 'Show a formatted tooltip on hover.',
  showValueLabels: 'Print each value on the chart.',
  showValueLabelsLine: 'Print the line’s values too.',
  showValueLabelsAsPercentage: 'Label each segment with its share of the total instead of its value.',
  showTotalLabels: 'Print the total at the end of each stack.',
  showPointLabels: 'Label each point with its `pointDimension` value.',
  showValues: 'Print the value in each cell.',
  showSectionLabels: 'Print each step’s name on its bar. With `showValueLabels`, the value follows the name.',
  displayPercentages: 'Label each step with its share of all steps’ total instead of its value.',
  displayNullAs: 'Text shown where a value is null, for example `"–"`.',
  displayChangeAsPercentage: 'Show the change as a percentage instead of a difference.',
  reversePositiveNegativeColors: 'Colour an increase as bad and a decrease as good, for costs or churn.',
  reverseTrendDirection:
    'Point the trend arrow the other way. When unset, the arrow follows `reversePositiveNegativeColors`.',
  percentageDecimalPlaces: 'Decimal places on the percentage change.',
  fontSize: 'Font size of the headline number in pixels. By default it grows and shrinks to fit the card.',
  changeFontSize: 'Font size of the change line in pixels.',
  pointColor: 'One colour for every point, in place of the theme’s.',
  minColor: 'Colour of the lowest values.',
  midColor: 'Colour of the values in the middle of the range.',
  maxColor: 'Colour of the highest values.',
  minThreshold: 'Values at this get `minColor`; values below it fade further towards white. A number as a string (`"100"`), or a percentage of the range such as `"20%"`.',
  maxThreshold: 'Values at this get `maxColor`; values above it darken further. A number as a string, or a percentage of the range such as `"80%"`.',
  startColor: 'Colour of the first step. The steps between blend towards `endColor`.',
  endColor: 'Colour of the last step. With only one of the two set, the other is generated.',
  shrinkAnchor: 'Where each step narrows towards the next. `"none"` draws straight-sided bars.',
  shrinkFraction: 'How much of each step narrows, from 0 (none of it) to 1 (all of it).',
  columnWidth: 'A fixed width for the value columns, in pixels.',
  firstColumnWidth: 'A fixed width for the row-label column, in pixels.',

  // Card
  title: 'The card’s title. A `"key|fallback"` string is looked up in your translations.',
  description: 'Smaller text under the title. Translates like `title`.',
  tooltip: 'Text for an info icon beside the title.',
  hideMenu: 'Hide the card’s header: the title, description and menu.',
  menuOptions: 'Which entries the card menu offers. Pass `[]` for none.',

  // Provider
  theme: 'Deep-partial override of the default theme: styles (CSS variables), charts (Chart.js options per component), formatter, i18n, fonts.',
  timezone: 'IANA timezone used for date display, e.g. "Europe/Berlin".',
  children: 'Your app; every chart inside reads this provider’s theme.',

  // Instrumentation
  componentName: 'A name for this chart, included in the interaction events it dispatches on the DOM, for your analytics.',
  trackingId: 'An id included in the same events, to tell two instances apart.',
};

// Where one component reads a prop differently from the rest.
// A legend with one entry is not drawn (the package's default theme, src/theme.ts):
// said on the charts whose legend lists series.
const SERIES_LEGEND = 'Show the legend. A chart with one series shows none; entries wrap onto more lines when they do not fit.';
const seriesCharts = [
  'BarChart',
  'BarChartHorizontal',
  'BarChartGrouped',
  'BarChartGroupedHorizontal',
  'BarChartStacked',
  'BarChartStackedHorizontal',
  'BarLineChart',
  'LineChart',
  'LineChartGrouped',
  'LineChartComparison',
  'LineChartWithKpiTabs',
  'LineChartComparisonWithKpiTabs',
  'AreaChart',
  'ScatterChart',
  'BubbleChart',
];

const byComponentNotes: Record<string, Record<string, string>> = {
  BubbleChart: { pointColor: 'One colour for every bubble, in place of the theme’s. Only read when `groupByDimension` is not set.' },
  KpiNumberComparison: {
    primaryDateRange: `The dates \`results\` covers: ${TIME_RANGE}. Only read to work out the comparison dates for \`setComparisonDateRange\`.`,
    comparisonDateRange: `The dates \`resultsComparison\` covers: ${TIME_RANGE}. Without it the change is not shown.`,
    setComparisonDateRange:
      'If set, the card works out the comparison dates from `primaryDateRange` and `comparisonPeriod` and calls this with them, so you can query them. When it cannot work them out, it calls this with no range.',
    comparisonPeriod: `Names the comparison under the number (“vs previous period”, translated). One of ${oneOf(COMPARISON_PERIODS)}; any other string leaves the name empty.`,
    measure: 'The number to show and compare. Its `inputs` (`prefix`, `suffix`, `decimalPlaces`) set the formatting.',
  },
  KpiNumber: { measure: 'The number to show. Its `inputs` (`prefix`, `suffix`, `decimalPlaces`) set the formatting.' },

  HeatMap: { measure: 'The number behind each cell’s colour and label.' },
  PivotTable: { measures: 'The numbers shown in the cells. Their `inputs` set the formatting and the row and column totals.' },
  TablePaginated: {
    pageSize:
      'Rows on a page. Left out, the table shows as many rows as fit its height. Either way it reports the number in `state.pageSize`. Give the card room for the rows, about 40 pixels each, or they scroll inside it.',
  },
};

const byComponent: Record<string, Record<string, string>> = { ...byComponentNotes };
for (const name of seriesCharts) byComponent[name] = { ...byComponent[name], showLegend: SERIES_LEGEND };

export const propNote = (prop: string, component?: string): string | undefined =>
  (component ? byComponent[component]?.[prop] : undefined) ?? global[prop];

// Props a component's type declares and its code never reads: inherited from a
// sibling's type, or left over upstream. The reference leaves them out rather
// than describe something that does not happen. tests/accuracy.test.tsx renders
// each one to prove it changes nothing.
const ignored: Record<string, string[]> = {
  BarChartStacked: ['maxLegendItems'],
  AreaChart: ['resultsGroupOrder', 'resultsGroupOther', 'groupOrderCacheKey', 'setGroupOrderAndCacheKey', 'xAxisMaxItems'],
  PieChart: ['showValueLabelsAsPercentage'],
  DonutChart: ['showValueLabelsAsPercentage'],
  DonutLabelChart: ['showValueLabelsAsPercentage'],
  LineChartComparisonWithKpiTabs: ['granularity'],
};

// Defaults the code applies that componentDefaults does not list, read from
// the component sources: the card's header destructures `hideMenu = false`,
// and the grouped and stacked bars read `showTotalLabels &&`. A boolean with
// no entry here and none there is three-state: unset is not `false` (see
// `reverseTrendDirection`). tests/accuracy.test.tsx renders both kinds.
export const codeDefaults: Record<string, unknown> = { hideMenu: false, showTotalLabels: false };

/** The props this component accepts and ignores, which the reference does not list. */
export const ignoredProps = (component: string): string[] => ignored[component] ?? [];
