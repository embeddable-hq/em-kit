// AI entry point: everything a model-facing integration needs to produce a
// ChartSpec (src/spec.ts) and have <ChartFromSpec> render it. Nothing here
// imports React or a provider SDK, so it is safe in a server route.

import { chartSpecSchema, chartSpecToolSchema } from './spec.schema.generated';

export { chartSpecSchema, chartSpecToolSchema };
export type { ToolInputSchema } from './spec.schema.generated';

const TOOL_NAME = 'render_chart';

const TOOL_DESCRIPTION =
  "Render a chart, KPI or table in the user's app from a JSON spec. Set `chart` to the kind, name the row fields to plot " +
  '(a bare row-key string such as "revenue", or { name, title, format }), and pass the data in `rows` as an array of flat ' +
  'objects in long format: one row per category and group combination, using only values you were given. Time values must ' +
  'be zone-less ISO strings such as "2025-03-01T00:00:00.000"; set `granularity` when the category axis is time. Format ' +
  "numbers with a field's `format` ({ prefix, suffix, decimalPlaces }). Options always use vertical orientation: " +
  '`xAxis`/`xAxisLabel` is the category axis even for horizontal bars. One call renders one chart.';

/**
 * Anthropic Messages API tool definition for rendering a chart. `input_schema`
 * is `chartSpecToolSchema`: the spec flattened to a root object, because the
 * API rejects a top-level anyOf. The tool input is a `ChartSpec`.
 *
 * @example
 * const res = await anthropic.messages.create({
 *   model, max_tokens: 4096, system: chartGuidance, messages,
 *   tools: [renderChartTool],
 * });
 * const call = res.content.find((block) => block.type === 'tool_use'); // <ChartFromSpec spec={call.input} />
 */
export const renderChartTool = {
  name: TOOL_NAME,
  description: TOOL_DESCRIPTION,
  input_schema: chartSpecToolSchema,
} as const;

/**
 * The same tool as an OpenAI function-calling definition (Chat Completions
 * `tools`). Not `strict`: the spec has free-form `rows` and `format`, which
 * strict mode cannot express.
 *
 * @example
 * const res = await openai.chat.completions.create({
 *   model, messages: [{ role: 'system', content: chartGuidance }, ...messages],
 *   tools: [renderChartToolOpenAI],
 * });
 * const spec = JSON.parse(res.choices[0].message.tool_calls[0].function.arguments); // <ChartFromSpec spec={spec} />
 */
export const renderChartToolOpenAI = {
  type: 'function',
  function: {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    parameters: chartSpecToolSchema,
  },
} as const;

/**
 * Model-facing guidance: which chart kind to pick and the data rules. About
 * 3 KB of plain text; append it to a system prompt next to the tool.
 *
 * @example
 * const system = `You are a data analyst.\n\n${chartGuidance}`;
 * await anthropic.messages.create({
 *   model, max_tokens: 4096, system, messages,
 *   tools: [renderChartTool],
 * });
 */
export const chartGuidance = `Charts: call ${TOOL_NAME} to show data. One call per chart; pick the kind from the shape of the data.

Choosing \`chart\`:
- bar: one measure (or a few) compared across categories.
- barHorizontal: the same, when labels are long or there are more than ~8 categories.
- barGrouped, barGroupedHorizontal: a measure split by a second category (\`groupBy\`), parts side by side.
- barStacked, barStackedHorizontal: the same split stacked, to show how the parts add up to a total.
- line: a trend over time or another ordered x axis; one line per entry in \`measures\`.
- lineGrouped: one measure drawn as a line per value of \`groupBy\`.
- lineWithKpiTabs: a trend with one KPI tab per measure (the tab shows the measure's total);
  good for dashboards-in-one-chart like "revenue / orders / signups over time".
- lineComparison: this period against a previous one (\`rows\` vs \`comparisonRows\`, aligned by
  position); set \`comparisonLabel\`, e.g. "Previous period".
- lineComparisonWithKpiTabs: the comparison plus KPI tabs; headline numbers are derived from the
  rows unless \`kpiRows\`/\`kpiComparisonRows\` are given.
- area: volume over time; add \`groupBy\` to stack the parts.
- barLine: bars (\`barMeasures\`) plus lines (\`lineMeasures\`) on a second axis, e.g. volume and a rate.
- pie, donut: only shares of a whole: at most 8 slices, non-negative values. Otherwise use a bar chart.
- donutLabel: a donut with a headline number in the center (\`innerLabel\`: { text, value } — the
  value defaults to the sum of the rows).
- scatter: the relationship between two measures, one point per \`pointDimension\`.
- bubble: scatter plus a third measure as point size (\`bubbleSizeMeasure\`).
- kpi: one headline number.
- kpiComparison: a number against another period (\`value\`, \`comparisonValue\`); set
  \`options.reversePositiveNegativeColors\` when lower is better.
- table: row-level detail or exact values; mixed text and number \`columns\`.
- heatmap: one measure across two categories as colour intensity (weekday by hour).
- pivot: the same two-way layout with numbers in the cells, several measures and optional sub-rows.

Data rules:
- \`rows\` is an array of flat objects in long format: one row per category and group combination.
  Never spread groups across columns; name the group field in \`groupBy\` instead.
- Use only values from the data you were given. Omit \`rows\` while data is loading (set \`loading: true\`),
  or set \`error\` to show a message instead.
- A field is a row key as a bare string ("revenue"), or { name, title?, type?, role?, format? } when it
  needs a display title or formatting. \`type\` ('string' | 'number' | 'time' | 'boolean') is inferred from rows.
- Time values are zone-less ISO strings: "2025-03-01T00:00:00.000" ("2025-03-01" is also accepted).
  Never add a Z or a UTC offset.
- When the category axis (\`dimension\` or \`xAxis\`) is a time field, set \`granularity\` on the chart,
  never on the field: second, minute, hour, day, week, month, quarter or year.
  The rows must already be bucketed at that granularity.
- Format numbers with the field's \`format\`: { prefix: "$", suffix: "%", decimalPlaces: 1 }.
  Also available: displayName, displayNullAs, maxCharacters.
- Options are always written in vertical orientation, including for horizontal variants:
  \`options.xAxisLabel\` labels the category axis; \`options.yAxisLabel\`, \`options.yAxisRangeMin\`
  and \`options.yAxisRangeMax\` the value axis. The renderer swaps them.
- \`kpi\` and \`kpiComparison\` accept \`value\` (and \`comparisonValue\`) instead of \`rows\`.
- In \`table\`, set a column's \`role\` ('dimension' | 'measure') only when it is ambiguous.
- Give every chart a short \`title\` that says what it shows.`;
