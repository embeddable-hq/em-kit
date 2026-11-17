import type { ChartSpec } from '../../../src';

// One regional dataset for the whole landing page: the SaaS sample's revenue by
// region, the same rows as the table and the horizontal bar chart in the range
// above, so the comparison card and the model's donut show numbers the visitor
// has already seen.
export const regionRows = [
  { region: 'North America', revenue: 586975 },
  { region: 'Europe', revenue: 403173 },
  { region: 'Asia Pacific', revenue: 267726 },
  { region: 'Latin America', revenue: 151307 },
  { region: 'Middle East', revenue: 111295 },
];

// A chart spec exactly as a model returns it from a render_chart tool call.
// The page prints this string and renders the parsed value, so what is shown
// is what is drawn.
export const regionSpecJson = `{
  "chart": "donut",
  "title": "Revenue by region",
  "dimension": { "name": "region", "title": "Region" },
  "measure": {
    "name": "revenue",
    "title": "Revenue",
    "format": { "prefix": "$" }
  },
  "rows": [
${regionRows.map((row) => `    ${JSON.stringify(row).replace(/":/g, '": ').replace(/,"/g, ', "').replace(/^{/, '{ ').replace(/}$/, ' }')}`).join(',\n')}
  ]
}`;

export const regionSpec = JSON.parse(regionSpecJson) as ChartSpec;
