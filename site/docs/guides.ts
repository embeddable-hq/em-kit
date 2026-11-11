import { chartGuidance, renderChartTool } from '../../src/ai';
import { aiParseCode, aiRenderCode, aiToolSetupCode } from '../catalog/aiSnippets';
import { BRAND } from '../config';
import targetLineChartSource from '../examples/TargetLineChart.tsx?raw';

// Every guide page as data: one source renders the page, its "On this page"
// list, its "Copy Markdown" text and the search index. Prose is Markdown;
// code is kept apart so it can be highlighted and copied on its own; live
// blocks render a component on the page and a Markdown stand-in elsewhere.

const pkg = BRAND.packageName;

export type LiveBlockId = 'target-line-demo' | 'ai-schema' | 'component-index' | 'comparison' | 'raw-vs-kit' | 'next-steps';

export type GuideBlock =
  | { h2: string; id?: string }
  | { h3: string }
  | { md: string }
  | { code: string; label?: string; plain?: boolean; maxHeight?: number }
  | { live: LiveBlockId; md: string };

export type GuideSection = 'Getting started' | 'Guides';

export type Guide = {
  slug: string;
  title: string;
  description: string;
  section: GuideSection;
  blocks: GuideBlock[];
};

export const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const headingId = (block: { h2: string; id?: string }) => block.id ?? slugify(block.h2);

// ---------------------------------------------------------------------------
// Code samples

const quickStart = `import { ChartsProvider, LineChart, dimension, measure } from '${pkg}';

const month = dimension({ name: 'month', title: 'Month', type: 'time', granularity: 'month' });
const revenue = measure({ name: 'revenue', title: 'Revenue', inputs: { prefix: '$' } });

export function RevenueTrend() {
  const { data, isLoading, error } = useRevenueByMonth(); // your own data hook

  return (
    <ChartsProvider>
      <div style={{ height: 360 }}>
        <LineChart
          title="Revenue"
          xAxis={month}
          measures={[revenue]}
          results={{ isLoading, error, data }}
        />
      </div>
    </ChartsProvider>
  );
}`;

const fieldsCode = `import { dimension, measure, results } from '${pkg}';

// Dimensions describe how rows are grouped.
const region = dimension({ name: 'region', title: 'Region' });
const signedUp = dimension({ name: 'signed_up', title: 'Signed up', type: 'time', granularity: 'week' });

// Measures describe the numbers. Display options live on \`inputs\`.
const revenue = measure({
  name: 'revenue',
  title: 'Revenue',
  inputs: { prefix: '$', decimalPlaces: 0 },
});

// results() wraps rows in the response shape every chart accepts.
const response = results([
  { region: 'Europe', revenue: 391500 },
  { region: 'Asia Pacific', revenue: 276300 },
]);`;

const responseCode = `type DataResponse = {
  isLoading: boolean;
  data?: Record<string, unknown>[]; // your rows
  error?: string;                   // shown in the card when set
  total?: number;                   // total row count, for paginated tables
};`;

const timeCode = `const orderedAt = dimension({
  name: 'orders.ordered_at',
  title: 'Order date',
  type: 'time',
  granularity,           // 'day' | 'week' | 'month' | 'quarter' | 'year' | …
});

// Time values are ISO strings with no zone suffix.
// Supply them under the field name and under name.granularity:
const rows = [
  {
    'orders.ordered_at': '2026-08-01T00:00:00.000',
    'orders.ordered_at.month': '2026-08-01T00:00:00.000',
    sales: 121400,
  },
];`;

const granularityCode = `const [granularity, setGranularity] = useState<Granularity>('month');
const rows = useSalesOverTime({ granularity }); // re-query when it changes

const orderedAt = dimension({
  name: 'orders.ordered_at',
  title: 'Order date',
  type: 'time',
  granularity,
  inputs: { showGranularityDropdown: true }, // shows the built-in picker
});

<LineChart
  xAxis={orderedAt}
  measures={[sales]}
  results={results(rows)}
  granularity={granularity}
  setGranularity={setGranularity}   // called with the user's choice
/>`;

const statesCode = `<BarChart results={{ isLoading: true }} … />            // skeleton
<BarChart results={results([])} … />                    // empty state
<BarChart results={{ isLoading: false, error: 'Query timed out' }} … />  // error`;

const eventsCode = `<BarChart
  dimension={region}
  measures={[revenue]}
  results={results(rows)}
  onBarClicked={({ dimensionValue }) => setSelectedRegion(dimensionValue)}
/>`;

const tableCode = `const [state, setState] = useState({ page: 0, isLoadingDownloadData: false });
// state.pageSize is measured from the available height; state.sort is set by header clicks.
const { rows, total } = useOrders({ page: state.page, pageSize: state.pageSize, sort: state.sort });

<TablePaginated
  dimensionsAndMeasures={[customer, orders, revenue]}
  results={results(rows)}
  totalResults={{ isLoading: false, total }}
  state={state}
  setState={setState}
/>`;

const themeCode = `<ChartsProvider
  theme={{
    styles: {
      '--em-sem-chart-color--1': '#0b6e99',
      '--em-sem-chart-color--2': '#23a6d5',
      '--em-sem-background': '#ffffff',
      '--em-card-border-radius': '0.5rem',
    },
  }}
>
  <App />
</ChartsProvider>`;

const darkCode = `const dark = {
  styles: {
    '--em-sem-background': '#18181b',
    '--em-sem-background--light': '#27272a',
    '--em-sem-text': '#fafafa',
    '--em-sem-text--muted': '#a1a1aa',
    '--em-sem-text--subtle': '#52525b',
  },
};`;

const colorMapCode = `<ChartsProvider
  theme={{
    charts: {
      backgroundColorMap: {
        dimensionValue: {
          'plan.Starter': '#fbbf24',
          'plan.Growth': '#d97706',
          'plan.Enterprise': '#92400e',
        },
        measure: { revenue: '#0b6e99' },
      },
    },
  }}
>`;

const localeCode = `<ChartsProvider
  timezone="Europe/Berlin"
  theme={{
    i18n: { language: 'de' },          // UI text: 'en', 'de' and 'fr' are built in
    formatter: { locale: 'de-DE' },    // numbers, currencies and dates
  }}
>`;

const translationsCode = `<ChartsProvider
  theme={{
    i18n: {
      language: 'de',
      translations: {
        de: {
          translation: {
            dashboard: { revenue: 'Umsatz nach Region' },     // chart titles
            measure: { revenue: 'Umsatz' },                   // field titles
            dimension: {
              region: 'Region',
              'region.North America': 'Nordamerika',          // dimension values
            },
          },
        },
      },
    },
  }}
>
  <BarChart
    title="dashboard.revenue|Revenue by region"   // key|fallback
    dimension={region}
    measures={[revenue]}
    results={results(rows)}
  />
</ChartsProvider>`;

const newLanguageCode = `<ChartsProvider
  theme={{
    i18n: {
      language: 'es',
      translations: { es: { translation: { /* the keys from the built-in 'en' bundle */ } } },
    },
    formatter: { locale: 'es-ES' },
  }}
>`;

// The example's real source, with the site's relative imports shown as the
// package paths a user would write.
export const targetLineChartCode = targetLineChartSource
  .replace("from '../../src/build'", `from '${pkg}/build'`)
  .replace("from '../../src'", `from '${pkg}'`);

const schemaJson = JSON.stringify(renderChartTool.input_schema, null, 2);
export const aiSchemaJson = schemaJson;

// The "same chart, two ways" comparison on the Why page. The raw version is a
// real react-chartjs-2 component, trimmed only where noted, so the comparison
// is fair: it's what you'd write for a production card without this library.
export const rawChartCode = `import { useMemo, useRef } from 'react';
import { Bar } from 'react-chartjs-2';
import { BarElement, CategoryScale, Chart, Legend, LinearScale, Tooltip } from 'chart.js';

Chart.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

// A colour per region that stays the same across charts and refreshes.
const palette = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4'];
const colourFor = (value: string) => {
  const stored = JSON.parse(sessionStorage.getItem('colours') ?? '{}');
  stored[value] ??= palette[Object.keys(stored).length % palette.length];
  sessionStorage.setItem('colours', JSON.stringify(stored));
  return stored[value];
};

const money = new Intl.NumberFormat(navigator.language, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function RevenueByRegion({ rows, isLoading, error }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const data = useMemo(() => ({
    labels: rows?.map((r) => r.region),
    datasets: [{
      label: 'Revenue',
      data: rows?.map((r) => r.revenue),
      backgroundColor: rows?.map((r) => colourFor(r.region)),
    }],
  }), [rows]);

  const downloadCsv = () => {
    const csv = ['Region,Revenue', ...rows!.map((r) => \`"\${r.region}",\${r.revenue}\`)].join('\\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = 'revenue-by-region.csv';
    link.click();
  };

  return (
    <section className="card" ref={ref}>
      <header className="card__header">
        <h3>Revenue by region</h3>
        <button onClick={downloadCsv} disabled={!rows?.length}>Download CSV</button>
      </header>
      {isLoading && !rows ? <Skeleton /> : error ? <ErrorState message={error} />
        : !rows?.length ? <EmptyState /> : (
        <Bar
          data={data}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: (c) => money.format(c.parsed.y) } },
            },
            scales: { y: { ticks: { callback: (v) => money.format(Number(v)) } } },
          }}
        />
      )}
    </section>
  );
}
// …plus Skeleton, ErrorState and EmptyState components, card CSS,
// XLSX and PNG export, translations, and the same again for every chart.`;

export const kitChartCode = `import { BarChart, dimension, measure } from '${pkg}';

const region = dimension({ name: 'region', title: 'Region' });
const revenue = measure({ name: 'revenue', title: 'Revenue', inputs: { prefix: '$' } });

export function RevenueByRegion({ rows, isLoading, error }: Props) {
  return (
    <BarChart
      title="Revenue by region"
      dimension={region}
      measures={[revenue]}
      results={{ isLoading, error, data: rows }}
    />
  );
}`;

// What a chart library leaves to you, and what this library does instead.
// Every row is a capability a production dashboard needs; the left column
// says what you write without it. Kept factual: no claims about other
// libraries beyond "you build it".
export const comparisonRows: { need: string; library: string; kit: string }[] = [
  {
    need: 'Number, currency and date formatting',
    library: 'Write formatters for ticks, tooltips and labels, per chart and per locale',
    kit: 'Per field: prefix, suffix, decimals, currency, compact numbers, in the reader’s locale',
  },
  {
    need: 'One colour per value across the dashboard',
    library: 'Keep your own colour map and pass it to every chart',
    kit: 'Automatic, shared by every chart, kept across refreshes; pin any value',
  },
  {
    need: 'Missing time periods',
    library: 'Lines join straight across gaps unless you fill them yourself',
    kit: 'Filled per granularity and time zone, including ISO weeks and quarters',
  },
  {
    need: 'Changing granularity',
    library: 'Build a picker and re-bucket the data',
    kit: 'Picker in the card header; you re-query at the chosen granularity',
  },
  {
    need: 'Comparison periods',
    library: 'Work out the previous range and overlay a second series',
    kit: 'Comparison lines and KPI deltas from a second result set',
  },
  {
    need: 'Loading, empty and error states',
    library: 'Design and wire three states for every chart',
    kit: 'Designed states in every card, driven by the same results prop',
  },
  {
    need: 'Card, title and info tooltip',
    library: 'Build the card around the canvas',
    kit: 'Every chart is a finished card',
  },
  {
    need: 'CSV, Excel and PNG export',
    library: 'Write the export code',
    kit: 'In every card’s menu, with a maximize view',
  },
  {
    need: 'Translations',
    library: 'Thread i18n through titles, axes, legends and tooltips',
    kit: 'Titles, field names and values translate; English, German and French built in',
  },
  {
    need: 'Click events',
    library: 'Map canvas hit-tests back to your rows',
    kit: 'Typed payloads with the clicked value and its time range',
  },
  {
    need: 'Tables, pivots and heat maps',
    library: 'A separate table library with its own data shape and styling',
    kit: 'Same field descriptions, same response shape, same theme',
  },
  {
    need: 'Charts chosen by an AI model',
    library: 'Design a schema, validate the model’s output, map it to charts',
    kit: 'A tool definition and a renderer that repairs common model mistakes',
  },
];

// ---------------------------------------------------------------------------
// Pages

export const guides: Guide[] = [
  {
    slug: 'introduction',
    title: 'Introduction',
    section: 'Getting started',
    description: `${BRAND.name} is a set of finished React chart components for teams that already have a data layer.`,
    blocks: [
      {
        md: `You query your data however you like. ${BRAND.name} takes the rows and does everything after that: rendering, formatting, colour, time handling, theming, translation, loading, empty and error states, and export. Each chart arrives as a finished card.`,
      },
      {
        md: "It deliberately does **not** fetch, cache or aggregate data. That keeps it compatible with any API, warehouse, ORM or state library, and means there is nothing to host.",
      },
      { h2: 'What every chart includes' },
      {
        md: [
          '- A card with title, description and info tooltip',
          '- Locale-aware formatting from each field’s options (prefix, suffix, decimals, currency, compact numbers)',
          '- One colour per value, shared by every chart on the page',
          '- Missing time periods filled, with a built-in granularity picker',
          '- Designed loading, empty and error states',
          '- Typed click events carrying the clicked value and time range',
          '- CSV, Excel and PNG export, and a maximize view',
          '- English, German and French built in, and your own translations',
        ].join('\n'),
      },
      { h2: 'Next steps' },
      {
        live: 'next-steps',
        md: [
          '- [Why use it instead of a chart library](/docs/why)',
          '- [Installation](/docs/installation)',
          '- [Quick start](/docs/quick-start)',
          '- [Browse the components](/docs/components)',
        ].join('\n'),
      },
    ],
  },
  {
    slug: 'why',
    title: `Why ${BRAND.name}`,
    section: 'Getting started',
    description: 'What a chart library leaves to you, and what these components do instead.',
    blocks: [
      {
        md: "A chart library such as Chart.js or Recharts draws a chart. A production dashboard needs much more around it: formatting in the reader’s locale, consistent colours, gap-free time series, states, export, translations and events. That work is the same in every product, and it’s where most charting time goes.",
      },
      {
        md: `${BRAND.name} is that work, done once and tested, behind one small API: describe your fields, pass your rows. The components are the same ones that run in Embeddable’s production dashboards, released standalone.`,
      },
      { h2: 'The same chart, two ways' },
      {
        md: 'A revenue-by-region bar chart in a card, with currency formatting, consistent colours, loading, empty and error states, and CSV export.',
      },
      {
        live: 'raw-vs-kit',
        md: `With a chart library (react-chartjs-2):\n\n\`\`\`tsx\n${rawChartCode}\n\`\`\`\n\nWith ${BRAND.name}, which also gives you Excel and PNG export, tooltips formatted like the axes, translations and click events:\n\n\`\`\`tsx\n${kitChartCode}\n\`\`\``,
      },
      { h2: 'What you would otherwise build' },
      {
        live: 'comparison',
        md: [
          `| Need | With a chart library | With ${BRAND.name} |`,
          '|---|---|---|',
          ...comparisonRows.map((r) => `| ${r.need} | ${r.library} | ${r.kit} |`),
        ].join('\n'),
      },
      { h2: 'Still yours to control' },
      {
        md: [
          `- **Your data layer.** ${BRAND.name} never fetches. Pass rows from any API, warehouse or cache.`,
          '- **Every display option.** All display props are optional and override the defaults.',
          `- **Every pixel.** Hundreds of design tokens, plus Chart.js option overrides per chart. See [Theming](/docs/theming).`,
          `- **Custom charts.** When nothing fits, build one from the same toolkit, so it formats, colours and handles states like the rest. See [Build your own chart](/docs/build).`,
        ].join('\n'),
      },
      { h2: 'When to use something else' },
      {
        md: "If you need a bespoke visualisation that no dashboard chart covers, such as a custom D3 graphic or a map, a lower-level library is the right tool. You can still use the build toolkit for its formatting, colours and states, and keep the rest of the dashboard on these components.",
      },
    ],
  },
  {
    slug: 'installation',
    title: 'Installation',
    section: 'Getting started',
    description: 'One package; React 19 is the only peer dependency.',
    blocks: [
      { code: `npm install ${pkg}`, label: 'bash' },
      {
        md: 'Chart.js and the other runtime dependencies install with the package, so there is no extra setup, plugin registration or CSS import.',
      },
      { h2: 'Add the provider' },
      {
        md: 'Wrap your app, or just the part with charts, in `ChartsProvider` once. It applies the theme, fonts and translations every chart reads.',
      },
      {
        code: `import { ChartsProvider } from '${pkg}';\n\nexport function App() {\n  return (\n    <ChartsProvider>\n      <Dashboard />\n    </ChartsProvider>\n  );\n}`,
      },
    ],
  },
  {
    slug: 'quick-start',
    title: 'Quick start',
    section: 'Getting started',
    description: 'Your first chart: describe the fields, pass the rows.',
    blocks: [
      {
        md: 'Charts fill their container, so put them in an element with a height. Describe each field once, then pass your query’s state straight to `results`.',
      },
      { code: quickStart },
      {
        md: 'That chart already formats revenue as currency in the reader’s locale, fills missing months, colours the series consistently with every other chart, shows a skeleton while loading, and offers CSV, Excel and PNG export.',
      },
      { h2: 'Next' },
      {
        md: [
          '- [Describing your data](/docs/data): dimensions, measures and field options',
          '- [Browse the components](/docs/components): every chart with examples and props',
          '- [Theming](/docs/theming): make it look like your product',
        ].join('\n'),
      },
    ],
  },
  {
    slug: 'data',
    title: 'Describing your data',
    section: 'Guides',
    description: 'Dimensions, measures, field options and the one response shape every chart takes.',
    blocks: [
      {
        md: 'Charts don’t guess what your columns mean. You describe each field once as a **dimension** (something you group by) or a **measure** (a number), and reuse those descriptions across charts.',
      },
      { code: fieldsCode },
      { h2: 'Field options' },
      {
        md: [
          '| Option | Meaning |',
          '|---|---|',
          '| `name` | The key the chart reads from each row. |',
          '| `title` | Human label for axes, legends, tooltips and table headers. Defaults to `name`. |',
          '| `type` | `string`, `number`, `time` or `boolean`. Measures default to `number`, which is what turns on number formatting. |',
          '| `inputs` | Per-field options. Formatting works everywhere: `prefix`, `suffix`, `decimalPlaces`, `currency`, `abbreviateLargeNumber`, `displayName`, `displayNullAs`, `maxCharacters`. Others are chart-specific, such as a line’s `dashedLine` or a pivot table’s `columnAggregation`. Each component page lists the options it reads, and the `FieldInputs` type covers them all. |',
        ].join('\n'),
      },
      { h2: 'The response shape' },
      { md: 'Every chart’s `results` prop takes the same shape, so you can pass your query state straight through:' },
      { code: responseCode },
    ],
  },
  {
    slug: 'time',
    title: 'Time series',
    section: 'Guides',
    description: 'Time dimensions, gap filling and the built-in granularity picker.',
    blocks: [
      {
        md: 'Give time dimensions `type: \'time\'` and a `granularity`. Charts fill missing periods so gaps show as gaps rather than misleading straight lines.',
      },
      { code: timeCode },
      { h2: 'Letting users change granularity' },
      {
        md: 'Turn on `showGranularityDropdown`, keep the granularity in state and pass `setGranularity`. The chart shows a day-to-year picker; you re-query at the new granularity.',
      },
      { code: granularityCode },
    ],
  },
  {
    slug: 'states',
    title: 'Loading, empty and errors',
    section: 'Guides',
    description: 'Designed states for every chart, driven by the results prop.',
    blocks: [
      {
        md: 'States come from the `results` prop. Pass `isLoading` while fetching, an empty array when there’s nothing to show, or an `error` string when something failed. Each has a designed state inside the card, and a chart that already has rows stays on screen while it refetches.',
      },
      { code: statesCode },
      { md: 'Every [component page](/docs/components) shows its loading, empty and error states as examples.' },
    ],
  },
  {
    slug: 'events',
    title: 'Events',
    section: 'Guides',
    description: 'Typed click events for cross-filtering and drill-downs.',
    blocks: [
      {
        md: 'Interactive charts call a handler with the clicked value, and a time range when the dimension is a date. Use it to filter other charts, open a drill-down or navigate. Open any chart in the [playground](/charts) and click a data point to see the exact payload.',
      },
      { code: eventsCode },
    ],
  },
  {
    slug: 'tables',
    title: 'Tables',
    section: 'Guides',
    description: 'Controlled pagination and sorting against your own API.',
    blocks: [
      {
        md: 'The paginated table is controlled: it tells you the page, page size and sort; you fetch that slice and pass it back. Large tables stay fast because only one page is ever in memory.',
      },
      { code: tableCode },
    ],
  },
  {
    slug: 'theming',
    title: 'Theming',
    section: 'Guides',
    description: 'Design tokens, dark mode and pinned colours.',
    blocks: [
      {
        md: 'Styling is driven by CSS design tokens, all prefixed `--em-`. Override any of them through the provider’s `theme.styles`. Semantic tokens such as backgrounds, text and the ten-colour chart palette restyle every component at once; component tokens fine-tune one component.',
      },
      { code: themeCode },
      { h2: 'Dark mode', id: 'dark' },
      { md: 'A dark theme is a handful of semantic overrides:' },
      { code: darkCode },
      { h2: 'Pinned colours' },
      {
        md: 'Pin a colour to a specific value, so it’s the same in every chart. Keys are `dimensionName.value` for dimension values, or the measure name:',
      },
      { code: colorMapCode },
      {
        md: '> Tokens are applied to the page root, so one theme is active per page. Use the theme switcher on any component page to see every chart restyle together.',
      },
    ],
  },
  {
    slug: 'localisation',
    title: 'Localisation',
    section: 'Guides',
    description: 'Languages, number and date formats, time zones and your own translations.',
    blocks: [
      {
        md: 'UI text, number formats and date formats are set separately, so you can show German labels with Swiss number formatting if you need to. The time zone controls how date ranges and gaps are calculated.',
      },
      { code: localeCode },
      { h2: 'Your own content' },
      {
        md: 'Your own content translates through the same mechanism. Give a title or description as `key|fallback`; field titles resolve from `measure.<name>` and `dimension.<name>`; dimension values from `dimension.<name>.<value>`. Legends, axes, tooltips and table headers all pick these up.',
      },
      { code: translationsCode },
      { h2: 'A new language' },
      { md: 'Add a whole new language by supplying the built-in keys alongside your own:' },
      { code: newLanguageCode },
    ],
  },
  {
    slug: 'ai',
    title: 'Use with AI',
    section: 'Guides',
    description: 'Let a model choose the chart; the same components render it.',
    blocks: [
      {
        md: 'Every chart can also be driven by a model. `ChartFromSpec` renders a JSON `ChartSpec` (the chart kind, the fields and the rows) with the same themed, localised components, and it never trusts its input: dates, row keys and types are normalised, an unknown chart kind falls back to a table, and a malformed spec renders the error card instead of crashing.',
      },
      { h2: '1. Give the model the tool', id: 'tool' },
      {
        md: '`renderChartTool` is the JSON Schema of every chart spec; `chartGuidance` is a short system-prompt snippet that tells the model which chart to pick and how to shape the rows. Neither imports React, so both are safe in a server route.',
      },
      { code: aiToolSetupCode },
      { h2: '2. Read the tool call', id: 'tool-call' },
      {
        md: 'The model answers with a `render_chart` call whose input is the spec. Using OpenAI? Pass `renderChartToolOpenAI` and `JSON.parse(toolCall.function.arguments)` instead.',
      },
      { code: aiParseCode },
      { h2: '3. Render it, and listen', id: 'render' },
      {
        md: 'Every click comes back as a serialisable `ChartIntent` that `intentToPrompt()` turns into the next user message, so the chart becomes part of the conversation. `chrome` sets how much card to draw: `card`, `plain` (no export menu) or `bare` (no header, no card background, for a chat bubble).',
      },
      { code: aiRenderCode },
      { h2: 'What the model sees' },
      {
        md: `The tool definition and the guidance below are everything that goes to the model. The schema is generated from the same types as \`ChartSpec\`, so it stays in step with the renderer. To validate a spec on your server, import \`chartSpecSchema\` (the full union) from the same entry point.\n\n**\`${renderChartTool.name}\`**: ${renderChartTool.description}`,
      },
      { live: 'ai-schema', md: `\`\`\`json\n${schemaJson}\n\`\`\`` },
      { code: chartGuidance, label: 'chartGuidance', plain: true, maxHeight: 360 },
      { md: '[See it in the AI chat example, with a playground for your own specs](/examples/ai-chat)' },
    ],
  },
  {
    slug: 'build',
    title: 'Build your own chart',
    section: 'Guides',
    description: 'The toolkit the built-in charts use, for the charts you add yourself.',
    blocks: [
      {
        md: `When no component fits, build one from the same toolkit the built-in charts use, imported from \`${pkg}/build\`. Your chart then formats values, picks colours, fills time gaps and shows loading, empty and error states exactly like the rest, and follows the theme and language.`,
      },
      {
        md: [
          '| For | Use |',
          '|---|---|',
          '| Theme and translations | `useChartsTheme`, `i18nSetup`, `resolveI18nProps` |',
          '| Formatting every value | `getThemeFormatter(theme).data(field, value)` |',
          '| Time series | `useFillGaps`, `getDimensionWithGranularity`, `getTimeRangeFromDimensionValue` |',
          '| Comparison periods | `defaultComparisonPeriodOptions`, `getComparisonPeriodDateRange` |',
          '| Series colours | `getChartColors`, `getDimensionMeasureColor` |',
          '| Theme tokens | `getStyle`, `getStyleNumber` |',
          '| Card, states and menu | `ChartCard`, `EditorCard` |',
          '| Chart.js primitives | `BarChart`, `LineChart`, `PieChart`, `DonutChart`, `KpiChart` |',
          '| Data and option builders | `getLineChartProData`, `getLineChartProOptions`, `getBarChartProData`, … |',
        ].join('\n'),
      },
      { h2: 'Example: a line with a target' },
      {
        md: 'The built-in line chart plus a dashed target line. Everything except the target dataset comes from the toolkit, which is why it matches the other charts. Switch the theme or language and it follows.',
      },
      { live: 'target-line-demo', md: '' },
      { code: targetLineChartCode },
      { h2: 'Rules that keep it consistent' },
      {
        md: [
          '- Format every value with `getThemeFormatter(theme).data(field, value)`, so a field’s prefix, suffix, decimals and locale apply.',
          '- A `…Pro…Options` builder only formats values. Pass it as `options` to a primitive, which merges it onto its themed base, or merge it onto `get…ChartOptions()` yourself; on its own it has no legend or tooltip styling.',
          '- Colours that stand for data come from `getChartColors()` and `getDimensionMeasureColor()`, so a value keeps its colour across charts. Everything else (text, lines, accents) reads a theme token with `getStyle()`, called during render so it follows theme changes.',
          '- Wrap the chart in `ChartCard` and pass it the filled `results`: it shows the skeleton, empty and error states and the download menu for you.',
        ].join('\n'),
      },
    ],
  },
];

export const getGuide = (slug: string) => guides.find((g) => g.slug === slug);

// The page as Markdown, for "Copy Markdown" and, later, llms.txt.
export const guideMarkdown = (guide: Guide) =>
  [
    `# ${guide.title}`,
    guide.description,
    ...guide.blocks.map((block) => {
      if ('h2' in block) return `## ${block.h2}`;
      if ('h3' in block) return `### ${block.h3}`;
      if ('md' in block && !('live' in block)) return block.md;
      if ('code' in block) return `\`\`\`${block.label === 'bash' ? 'bash' : block.plain ? '' : 'tsx'}\n${block.code}\n\`\`\``;
      return block.md;
    }),
  ]
    .filter(Boolean)
    .join('\n\n');
