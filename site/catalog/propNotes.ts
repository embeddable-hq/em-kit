// One-line descriptions for the props reference, keyed by prop name. The prop
// list itself is generated from the types (site/generated/props.ts); these
// notes are the human layer on top. Props without a note still get listed.

const global: Record<string, string> = {
  // Data
  results: 'The rows from your own query, as { isLoading, data?, error?, total? }. Use results(rows) to build it.',
  resultsComparison: 'Rows for the comparison period, same measure and shape as results.',
  resultsInnerLabel: 'A one-row result whose value is shown in the donut’s centre.',
  resultsKpis: 'One row per measure for the KPI tabs above the chart; clicking a tab switches the plotted measure.',
  resultsKpisComparison: 'Comparison-period row for each KPI tab, to show the change per tab.',
  resultsSubRows: 'Rows for the expanded sub-level, loaded when a row is expanded.',
  resultsAxisOrder: 'A separate result used only to derive the axis order, e.g. ordered by a measure.',
  allResults: 'The full unpaged result, loaded on demand for the CSV/XLSX download of a paged table.',
  totalResults: 'A result carrying only total: the overall row count behind the paging.',

  // Fields
  dimension: 'The field whose values label the axis or segments; name is the row key.',
  measure: 'The numeric field to plot; its inputs (prefix, suffix, decimalPlaces, …) drive formatting. See Field options below.',
  measures: 'The numeric fields to plot, one series each.',
  lineMeasures: 'Measures drawn as lines on the secondary axis, over the bars.',
  dimensionsAndMeasures: 'The table columns, in order; dimensions render as text, measures formatted.',
  xAxis: 'The dimension along the x-axis; a time dimension gets gap filling and date formatting.',
  yAxis: 'The dimension along the y-axis of a horizontal chart.',
  groupBy: 'A second dimension that splits each x value into a series (stack, group or line).',
  groupByDimension: 'An optional dimension that colours the points by group.',
  pointDimension: 'The dimension identifying each point; its value labels the point.',
  xMeasure: 'The measure plotted on the x-axis.',
  yMeasure: 'The measure plotted on the y-axis.',
  bubbleSizeMeasure: 'A third measure encoded as bubble area.',
  bubbleRadiusMin: 'Radius in px for the smallest bubbleSizeMeasure value.',
  bubbleRadiusMax: 'Radius in px for the largest bubbleSizeMeasure value.',
  rowDimension: 'The dimension down the side of the grid.',
  columnDimension: 'The dimension across the top of the grid.',
  subRowDimension: 'A second row dimension revealed when a row is expanded.',
  innerLabelMeasure: 'The measure formatting the centre label.',
  innerLabelText: 'The caption under the centre value.',
  clickDimension: 'The dimension whose value is reported when a row is clicked; enables onRowClicked.',

  // Time
  granularity: 'The current time bucket (day, week, month, …). Controlled: pair it with setGranularity.',
  setGranularity: 'Called by the built-in granularity dropdown; re-query and pass the new rows.',
  primaryDateRange: 'The date window behind results, shown and used to derive the comparison window.',
  comparisonDateRange: 'The date window behind resultsComparison.',
  setComparisonDateRange: 'If set, the component computes the comparison window from comparisonPeriod and reports it here, so you can query it.',
  comparisonPeriod: 'Which period to compare against, e.g. "Previous period" or "Previous year"; the label is localised.',
  showComparisonAxis: 'Show a second x-axis with the comparison period’s dates.',

  // Controlled tables
  state: 'Controlled paging and sorting; keep it in useState and derive your query from it.',
  setState: 'The table’s updates to page, pageSize (measured from the height), sort and download state.',
  showIndex: 'Number the rows.',
  resetKey: 'Any value identifying the current query; when it changes the table resets to the first page.',

  // Events
  onBarClicked: 'Fires with the clicked bar’s dimension value(s) and measure value; the payload is ready to use as a filter.',
  onLineClicked: 'Fires with the clicked point’s dimension value and time range.',
  onPointClicked: 'Fires with the clicked point’s dimension value and measure values.',
  onAreaClicked: 'Fires with the clicked area’s series value.',
  onPointClick: 'Fires with the clicked point’s dimension value and the x/y (and size) measure values.',
  onSegmentClick: 'Fires with the clicked segment’s dimension value — one useState away from cross-filtering.',
  onCellClicked: 'Fires with the clicked cell’s row and column values and the measure value.',
  onRowClicked: 'Fires with the clicked row’s clickDimension value.',

  // Axes and scales
  xAxisLabel: 'Caption under the x-axis.',
  yAxisLabel: 'Caption beside the y-axis.',
  yAxisSecondaryLabel: 'Caption beside the secondary (line) axis.',
  xAxisRangeMin: 'Pin the x-axis minimum instead of auto-scaling.',
  xAxisRangeMax: 'Pin the x-axis maximum instead of auto-scaling.',
  yAxisRangeMin: 'Pin the y-axis minimum instead of auto-scaling.',
  yAxisRangeMax: 'Pin the y-axis maximum instead of auto-scaling.',
  yAxisSecondaryMin: 'Pin the secondary axis minimum.',
  yAxisSecondaryMax: 'Pin the secondary axis maximum.',
  xAxisMaxItems: 'Cap the number of x categories; the rest collapse into an "Other" bucket.',
  yAxisMaxItems: 'Cap the number of y categories; the rest collapse into an "Other" bucket.',
  maxLegendItems: 'Cap the legend length; the rest collapse into an overflow entry.',
  reverseXAxis: 'Flip the x-axis direction.',
  reverseYAxis: 'Flip the y-axis direction.',
  showLogarithmicScale: 'Logarithmic value axis, for series spanning orders of magnitude.',
  axisOrder: 'Controlled ordering of the category axis values.',
  axisOrderCacheKey: 'Cache key for the controlled axis order, so live updates don’t reshuffle categories.',
  setAxisOrderAndCacheKey: 'Reports the derived axis order and its cache key back to you to persist.',

  // Display
  showLegend: 'Show the legend; it paginates when it overflows.',
  showTooltips: 'Formatted tooltips on hover.',
  showValueLabels: 'Print each value on the chart.',
  showValueLabelsLine: 'Print values on the line series too.',
  showValueLabelsAsPercentage: 'Label segments with their share instead of the value.',
  showTotalLabels: 'Print the total above each stack.',
  showPointLabels: 'Label each point with its dimension value.',
  showValues: 'Print the value in each cell.',
  displayNullAs: 'Text shown for null values, e.g. "–".',
  displayChangeAsPercentage: 'Show the change as a percentage instead of an absolute difference.',
  reversePositiveNegativeColors: 'Treat an increase as bad (red) and a decrease as good, e.g. for costs.',
  percentageDecimalPlaces: 'Decimal places on the change percentage.',
  fontSize: 'Font size of the headline value in px; it auto-fits by default.',
  changeFontSize: 'Font size of the change indicator in px.',
  pointColor: 'Override the point colour.',
  minColor: 'Colour of the scale’s low end.',
  midColor: 'Colour of the scale’s midpoint.',
  maxColor: 'Colour of the scale’s high end.',
  minThreshold: 'Values at or below this get the full minColor.',
  maxThreshold: 'Values at or above this get the full maxColor.',
  columnWidth: 'Fixed column width, e.g. "120px".',
  firstColumnWidth: 'Fixed width for the row-label column.',
  expandedRowKeys: 'Controlled list of expanded row keys.',
  setExpandedRowKey: 'Called when a row is expanded or collapsed; load resultsSubRows accordingly.',

  // Card
  title: 'Card title. With i18n configured, "key|fallback" strings resolve through your translations.',
  description: 'Smaller text under the title; translates like title.',
  tooltip: 'An info icon next to the title with this text.',
  hideMenu: 'Hide the card header, including the export menu.',
  menuOptions: 'Restrict the card menu to these options (CSV, XLSX, PNG, …); the default shows all.',

  // Provider
  theme: 'Deep-partial override of the default theme: styles (CSS variables), charts (Chart.js options per component), formatter, i18n, fonts.',
  timezone: 'IANA timezone used for date display, e.g. "Europe/Berlin".',
  children: 'Your app; every chart inside reads this provider’s theme.',

  // Instrumentation
  componentName: 'Included in the DOM user-interaction events the charts dispatch, for your own analytics.',
  trackingId: 'Included in the DOM user-interaction events, to tell instances apart.',
};

export const propNote = (prop: string): string | undefined => global[prop];
