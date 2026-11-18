import { chartGuidance, renderChartTool } from '../../src/ai';
import { CHART_KINDS } from '../../src/spec';
import { installMarkdown } from '../components/InstallCommand';
import { BRAND, platformMarkdown } from '../config';
import { componentProps, typeDefinitions } from '../generated/props';
import { CLICK_TIME_RANGE_ROW, CLICK_VALUE_ROW, MEASURE_VALUES_HANDLERS, TIME_RANGE_NOTE } from './clickPayloads';
import answerChartSource from '../examples/AnswerChart.tsx?raw';
import appSource from '../examples/App.tsx?raw';
import brandThemeSource from '../examples/BrandTheme.tsx?raw';
import chartStatesSource from '../examples/ChartStates.tsx?raw';
import copyJsonMenuSource from '../examples/CopyJsonMenu.tsx?raw';
import customDownloadsSource from '../examples/CustomDownloads.tsx?raw';
import revenueFromApiSource from '../examples/RevenueFromApi.tsx?raw';
import clientProviderSource from '../examples/app/ClientProvider.tsx?raw';
import revenueByRegionSource from '../examples/RevenueByRegion.tsx?raw';
import revenueByRegionChartJsSource from '../examples/RevenueByRegionChartJs.tsx?raw';
import nextLayoutSource from '../examples/app/layout.tsx?raw';
import nextPageSource from '../examples/app/page.tsx?raw';
import customersTableSource from '../examples/CustomersTable.tsx?raw';
import darkThemeSource from '../examples/DarkTheme.tsx?raw';
import germanChartsSource from '../examples/GermanCharts.tsx?raw';
import ordersOverTimeSource from '../examples/OrdersOverTime.tsx?raw';
import pinnedColoursSource from '../examples/PinnedColours.tsx?raw';
import planChartSource from '../examples/PlanChart.tsx?raw';
import selfHostedFontSource from '../examples/SelfHostedFont.tsx?raw';
import reducedMotionSource from '../examples/ReducedMotion.tsx?raw';
import regionFilterSource from '../examples/RegionFilter.tsx?raw';
import revenueByPlanAndMonthSource from '../examples/RevenueByPlanAndMonth.tsx?raw';
import revenueChartSource from '../examples/RevenueChart.tsx?raw';
import revenueTargetSource from '../examples/RevenueTarget.tsx?raw';
import signupsByWeekSource from '../examples/SignupsByWeek.tsx?raw';
import spanishChartsSource from '../examples/SpanishCharts.tsx?raw';
import themeTypesSource from '../../src/generated/theme/theme.types.ts?raw';
import targetLineChartSource from '../examples/TargetLineChart.tsx?raw';
import translatedChartSource from '../examples/TranslatedChart.tsx?raw';

// Every guide page as data: one source renders the page, its "On this page"
// list, its Markdown twin (/docs/<slug>.md and "Copy page as Markdown") and the search
// index. Prose is Markdown; code is kept apart so it can be highlighted and
// copied on its own; live blocks render a component on the page and a Markdown
// stand-in elsewhere.
//
// Code samples are real files in site/examples, imported as text. They are
// type-checked with the rest of the site, and the ones shown live are the
// same files, so a sample cannot drift from what it renders.

const pkg = BRAND.packageName;
const url = BRAND.url;

export type LiveBlockId =
  | 'install'
  | 'next-steps'
  | 'comparison'
  | 'quick-start-chart'
  | 'plan-chart'
  | 'signups-by-week'
  | 'orders-over-time'
  | 'revenue-by-plan-and-month'
  | 'chart-states'
  | 'region-filter'
  | 'customers-table'
  | 'answer-chart'
  | 'ai-schema'
  | 'target-line-demo';

export type CodeLang = 'tsx' | 'ts' | 'bash' | 'json' | 'md' | 'text';

export type GuideBlock =
  | { h2: string; id?: string }
  | { h3: string }
  | { md: string }
  /** `lang` defaults to tsx. `file` names the file the code belongs in. */
  | { code: string; lang?: CodeLang; file?: string; maxHeight?: number }
  /** A component rendered on the page. `md` stands in for it in Markdown: for a demo, one line on what it draws. */
  | { live: LiveBlockId; md: string }
  /**
   * A closed section of the page, for a path only some readers take (the
   * Next.js files on the quick start). Its summary is a heading in Markdown.
   */
  | { details: string; id: string; blocks: GuideBlock[] };

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

/**
 * The anchor a Markdown reader gives a heading (GitHub's rule: lower case,
 * punctuation dropped, spaces to hyphens). The HTML page keeps its short ids;
 * the Markdown twin links to this.
 */
export const markdownAnchor = (heading: string) => heading.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');

/** A guide's blocks with the ones inside a closed section in their place, in page order. */
export const allBlocks = (blocks: GuideBlock[]): GuideBlock[] =>
  blocks.flatMap((block) => ('details' in block ? [block, ...allBlocks(block.blocks)] : [block]));

/**
 * The places a link can point to on a guide: each h2 and each closed section,
 * by its short id (what the site's own links use) and by its Markdown anchor.
 * The HTML page answers to both; the Markdown twin to the anchor.
 */
export const anchorsOf = (blocks: GuideBlock[]): { id: string; anchor: string }[] =>
  allBlocks(blocks).flatMap((block) => {
    if ('h2' in block) return [{ id: headingId(block), anchor: markdownAnchor(block.h2) }];
    if ('details' in block) return [{ id: block.id, anchor: markdownAnchor(block.details) }];
    return [];
  });

// ---------------------------------------------------------------------------
// Facts read from the library, so the prose cannot drift from it

const listOf = (items: string[], last = 'and') =>
  items.length < 3
    ? items.map((i) => `\`${i}\``).join(` ${last} `)
    : `${items.slice(0, -1).map((i) => `\`${i}\``).join(', ')} ${last} \`${items.at(-1)}\``;

// Every value of the exported `Granularity` type, smallest first.
const granularities = [...(typeDefinitions.Granularity ?? '').matchAll(/"(\w+)"/g)].map((m) => m[1]!);

// Every click handler prop, and the components that have it, from the generated props.
const clickHandlers = (() => {
  const byName = new Map<string, string[]>();
  for (const [component, props] of Object.entries(componentProps)) {
    for (const prop of props) {
      if (/^on[A-Z]\w*Click(ed)?$/.test(prop.name)) byName.set(prop.name, [...(byName.get(prop.name) ?? []), component]);
    }
  }
  return byName;
})();

const takes = (components: string[] = []) => (components.length === 1 ? 'takes' : 'take');

// The `theme.charts` keys that take Chart.js options, from the Theme type.
const chartOptionKeys = [
  ...(themeTypesSource.match(/export type ThemeCharts = \{[\s\S]*?\n\};/)?.[0] ?? '').matchAll(/^ {2}(\w+)\?: \{ options:/gm),
].map((m) => m[1]!);

// What a server render leaves to the browser, beyond drawing on the canvas:
// the scrollable table pages its rows in after it mounts, and the two donuts
// render no canvas until they have measured themselves. tests/ssr.test.tsx
// renders each on a server with no DOM.
export const SERVER_RENDER_EXCEPTIONS =
  'Three components wait for the browser: the scrollable table shows its empty state until it hydrates, and the donut and the donut with total draw their chart after they mount.';

// ---------------------------------------------------------------------------
// Code samples

// The example files import the library by its path in this repository; a
// reader imports the package.
const sample = (source: string) =>
  source
    // site/examples/ (and its app/ folder) import the package from source.
    .replace(/from '(?:\.\.\/)+src\/(\w+)'/g, `from '${pkg}/$1'`)
    .replace(/from '(?:\.\.\/)+src'/g, `from '${pkg}'`)
    .trim();

export const targetLineChartCode = sample(targetLineChartSource);

// One revenue card as two files: on a chart library and on this one. The Why
// page prints both; the landing page runs the second and gives the counts.
const revenueByRegionCode = sample(revenueByRegionSource);
const revenueByRegionChartJsCode = sample(revenueByRegionChartJsSource);
const lineCount = (code: string) => code.split('\n').length;
const revenueCardLines = { kit: lineCount(revenueByRegionCode), raw: lineCount(revenueByRegionChartJsCode) };

// The server half of "Charts from a model". Kept as text because the site
// does not depend on the Anthropic SDK.
const chartServerCode = `import Anthropic from '@anthropic-ai/sdk';
import type { ChartSpec } from '${pkg}';
import { chartGuidance, renderChartTool } from '${pkg}/ai';

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY

// Ask a question about some rows. Returns the spec of the chart that answers
// it, or null when the model replied in text instead.
export async function chartFor(question: string, rows: object[]): Promise<ChartSpec | null> {
  const response = await anthropic.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    system: chartGuidance, // which chart to pick and how to shape the rows
    tools: [renderChartTool], // the JSON Schema of every chart spec
    messages: [{ role: 'user', content: \`\${question}\\n\\n\${JSON.stringify(rows)}\` }],
  });

  for (const block of response.content) {
    if (block.type === 'tool_use' && block.name === renderChartTool.name) {
      return block.input as ChartSpec;
    }
  }
  return null;
}`;

const schemaJson = JSON.stringify(renderChartTool.input_schema, null, 2);
export const aiSchemaJson = schemaJson;

const agentRule = `For charts, KPIs and data tables, use the ${pkg} package (${BRAND.name}). Read ${url}/llms.txt first, then the .md page of each component you use. Fetch them with curl, not WebFetch, which returns a summary: the code and the props table must come through word for word.`;

const cursorRule = `## Charts

Use the ${pkg} package (${BRAND.name}) for charts, KPIs and data tables.
- Index of the docs: ${url}/llms.txt
- One component: ${url}/docs/components/<name>.md, where <name> is the export name in kebab-case: BarChartStacked is bar-chart-stacked.md`;

const chatPrompt = `Read ${url}/llms.txt and ${url}/docs/components/line-chart.md. Using only the ${pkg} components documented there, write a React component that shows monthly revenue as a line chart. Include the imports, sample rows and the provider.`;

// What a chart library leaves to you, and what this library does instead.
// Every row is a capability a production dashboard needs; the middle column
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
    slug: 'quick-start',
    title: 'Quick start',
    section: 'Getting started',
    description: 'From an empty React app to a chart on screen, in three steps.',
    blocks: [
      { md: 'The components take rows you already have, so there is nothing to fetch or configure.' },
      { h2: '1. Install', id: 'install' },
      { live: 'install', md: installMarkdown() },
      { md: 'The only peer dependencies are `react` and `react-dom`, version 19.1.1 or later. Chart.js and the other runtime dependencies install with the package, and there is no stylesheet to import.' },
      { h2: '2. Add the provider', id: 'provider' },
      {
        md: 'Wrap your app in `ChartsProvider` once. Charts read their theme, language and time zone from it: see [Theming](/docs/theming) and [Localisation](/docs/localisation). `RevenueChart` is the file you add in step 3.',
      },
      { code: sample(appSource), file: 'App.tsx' },
      {
        md: 'The provider loads the Inter font from Google Fonts; to serve it yourself or turn it off, see [fonts](/docs/troubleshooting#fonts).',
      },
      {
        details: 'In the Next.js App Router',
        id: 'in-the-nextjs-app-router',
        blocks: [
          {
            md: 'Next.js renders a file on the server unless it starts with `\'use client\'`, and the components use React context. Put the provider in a client file that pins the locale, so the server and the browser format numbers alike, and render it from the root layout.',
          },
          { code: sample(clientProviderSource), file: 'app/ClientProvider.tsx' },
          { code: sample(nextLayoutSource), file: 'app/layout.tsx' },
          { md: 'Start `RevenueChart.tsx` from step 3 with `\'use client\';` as well, and render it from a page.' },
          { code: sample(nextPageSource), file: 'app/page.tsx' },
        ],
      },
      { h2: '3. Render a chart', id: 'chart' },
      {
        md: 'Describe each field once, then pass your rows to `results`. The chart fills its parent, so give the parent a height, and a width it can fill.',
      },
      { code: sample(revenueChartSource), file: 'RevenueChart.tsx' },
      { live: 'quick-start-chart', md: 'Result: a card titled “Revenue by region” with four bars, labelled 48,200, 39,500, 27,800 and 12,100.' },
      {
        md: 'The numbers are formatted for your browser’s locale, and the menu in the card’s corner exports CSV, Excel and PNG.',
      },
      { h2: 'Next steps' },
      {
        md: [
          '- [Describing your data](/docs/describing-your-data): dimensions, measures and field options, such as `currency: \'USD\'` for $48,200',
          '- [Time series](/docs/time-series): dates on the axis, the timestamp format and missing periods',
          '- [Components](/docs/components): every chart, with examples and props',
          '- [Troubleshooting](/docs/troubleshooting): what to check if the chart does not appear or looks wrong',
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
        md: 'A chart library such as Chart.js or Recharts draws the chart. A dashboard also needs formatting, consistent colours, gap-free time series, loading and error states, export and translations around it. That work is the same in every product.',
      },
      {
        md: `${BRAND.name} is that work, done once, behind one API: describe your fields, pass your rows. [The same card written both ways](/docs/why#the-same-card-written-twice) is below.`,
      },
      { h2: 'What you would otherwise build' },
      {
        live: 'comparison',
        md: [
          `| What a dashboard needs | With a chart library | With ${BRAND.name} |`,
          '|---|---|---|',
          ...comparisonRows.map((r) => `| ${r.need} | ${r.library} | ${r.kit} |`),
        ].join('\n'),
      },
      { h2: 'The same card, written twice', id: 'the-same-card-written-twice' },
      {
        md: `One revenue card with loading, empty and error states, formatted values and an export, as two complete files. On a chart library it is ${revenueCardLines.raw} lines before the CSS, with one export format, one language and no click handler. On ${BRAND.name} it is ${revenueCardLines.kit}, and [that file is running on the home page](/#live-card).`,
      },
      { code: revenueByRegionChartJsCode, file: 'RevenueByRegionChartJs.tsx' },
      { code: revenueByRegionCode, file: 'RevenueByRegion.tsx' },
      {
        md: 'Across a whole app the difference in lines is smaller, because fetching, filters and layout are yours either way. What stays different is that every card is finished, and finished the same way.',
      },
      { h2: 'What stays yours' },
      {
        md: [
          `- **Your data layer.** ${BRAND.name} never fetches. Pass rows from any API, warehouse or cache.`,
          '- **Every display option.** Each one is an optional prop that overrides a default.',
          '- **The look.** Design tokens for colour, type and spacing, and Chart.js options per chart type. See [Theming](/docs/theming).',
          '- **Custom charts.** When no component fits, build one from the same toolkit. See [Build your own chart](/docs/build-your-own-chart).',
        ].join('\n'),
      },
      { h2: 'What it adds to your bundle' },
      {
        md: 'About 256 KB of JavaScript, minified and gzipped, with React left out: Chart.js and its plugins are about 86 KB of that. Importing every component costs about 4 KB more than importing one. Spreadsheet and image export (about 167 KB) load only when a reader chooses them from a chart’s menu.',
      },
      { h2: 'When it pays off', id: 'when-it-pays-off' },
      {
        md: `The saving grows with the number of cards. One chart on one page is quick to build on a chart library, by hand or with a coding assistant. ${BRAND.name} earns its place when:`,
      },
      {
        md: [
          '- **You have many cards.** Ten charts and tables that must load, fail, format and export alike. Each new card is a few lines, and none of them needs states or formatting of its own.',
          '- **Customers see them.** Empty and error states, keyboard access to every control, readable axes and phone layouts are done and tested. A hand-built card gets them one bug report at a time.',
          '- **You theme or translate.** One theme restyles every card, dark mode included. One locale changes every number and date, and the built-in text comes in English, German and French.',
          '- **You need tables and export too.** Paginated and pivot tables, heat maps and KPIs take the same fields as the charts, and every card exports CSV, Excel and PNG.',
          '- **A coding assistant writes the code.** It writes less, and you review less: the states, formatting and export are the library’s, already tested, not new code in every pull request.',
        ].join('\n'),
      },
      { h2: 'When to use something else' },
      {
        md: [
          `- **One or two simple charts.** A chart library is lighter: ${BRAND.name} adds about 256 KB however few components you use.`,
          '- **A visualisation no dashboard chart covers**, such as a custom D3 graphic or a map. Use a lower-level library; the [build toolkit](/docs/build-your-own-chart) can still give it the same card, formatting and colours.',
          '- **Control of every pixel.** The components take options, tokens and Chart.js settings, not replacement parts.',
          '- **An app that is not React.** The components need React 19.',
        ].join('\n'),
      },
      { h2: 'If you need the data layer too', id: 'embeddable' },
      { md: BRAND.relation },
      { md: platformMarkdown },
    ],
  },
  {
    slug: 'troubleshooting',
    title: 'Troubleshooting',
    section: 'Getting started',
    description: 'What to check when a chart does not appear or looks wrong, by what you see on screen.',
    blocks: [
      { md: 'Each heading is what you see on screen.' },
      { h2: 'An error says components must be rendered inside ChartsProvider' },
      {
        md: 'The full message is `EmKit components must be rendered inside <ChartsProvider>.` A chart is being rendered outside the provider. Wrap the app in it, as in [step 2 of the quick start](/docs/quick-start#provider).',
      },
      { h2: 'An error says createContext only works in Client Components', id: 'nextjs' },
      {
        md: 'This is Next.js, which renders every file as a Server Component unless it says otherwise, and the components read React context. Render `ChartsProvider` from a client file rendered by `app/layout.tsx`, and put `\'use client\';` on the first line of every file that renders a chart, as in [the quick start](/docs/quick-start#in-the-nextjs-app-router). The package does not add the directive itself.',
      },
      {
        md: `On the server, a chart renders as its card, with its title and an empty \`<canvas>\` that Chart.js draws in the browser; a KPI renders its number and a paginated table its rows. ${SERVER_RENDER_EXCEPTIONS}`,
      },
      { h2: 'Next.js says hydration failed, or that text did not match', id: 'hydration' },
      {
        md: 'The server and the browser formatted a number differently, because their locales differ, and React threw the server’s HTML away. Pin the locale in the provider, `theme={{ formatter: { locale: \'en-US\' } }}`, as in the [client file](/docs/quick-start#in-the-nextjs-app-router), or pass the reader’s locale from the request.',
      },
      { h2: 'A server-rendered heat map has black cells', id: 'heat-map-colours' },
      {
        md: 'A colour you passed as a name, `rgb()` or `var()`, such as `minColor="mediumpurple"`, renders black on the server, and React keeps the server’s colours. Pass hex colours, such as `\'#f4f0ff\'`, for `minColor`, `midColor`, `maxColor` and the theme’s chart colours; the defaults are hex already. Or render the heat map in the browser only, with `next/dynamic(() => import(\'./HeatMapCard\'), { ssr: false })` from a client file.',
      },
      { h2: 'Chart text is in a serif or system font', id: 'fonts' },
      {
        md: 'The provider loads Inter when it mounts: a stylesheet from `fonts.googleapis.com` and the font files from `fonts.gstatic.com`. If a network or a content security policy blocks them, charts draw in the system sans-serif font. A policy needs `https://fonts.googleapis.com` in `style-src` and `https://fonts.gstatic.com` in `font-src`.',
      },
      {
        md: 'To stop the request or serve the font yourself, replace `theme.fonts`: an empty `google` list turns the request off, and `custom` adds an `@font-face` from your own file.',
      },
      { code: sample(selfHostedFontSource), file: 'SelfHostedFont.tsx' },
      { h2: 'The chart is squashed to about 150 pixels tall' },
      {
        md: 'A chart fills its parent, and the parent has no height. Give the parent one, for example `style={{ height: 360 }}`.',
      },
      { h2: 'The chart is squashed to about 300 pixels wide', id: 'width' },
      {
        md: 'A chart fills its parent’s width, and the parent sits in a flex item with no width of its own, for example under `display: flex; place-items: center`. Give the flex item itself a width, such as `#root { width: 100% }`, or remove the centring. A width on the chart’s own wrapper does not help: it is a share of the same shrunken item.',
      },
      { h2: 'The time axis shows raw timestamps' },
      {
        md: 'Labels such as `2026-01-01T00:00:00.000Z` mean a time value has a `Z`, an offset, or is not a full timestamp. Send `YYYY-MM-DDTHH:mm:ss.SSS` with nothing after it. See [time values](/docs/time-series#time-values).',
      },
      { h2: 'A time chart draws its axis but no bars or line' },
      {
        md: 'The time values are not the start of each period, so no row matches a period on the axis. For `month`, send the first day of the month at `00:00:00.000`. See [time values](/docs/time-series#time-values).',
      },
      { h2: 'A time chart shows one empty period' },
      {
        md: 'The rows have no key that matches the dimension’s `name`, so the chart falls back to the current period. Use the same string for the row key and for `name`.',
      },
      { h2: 'A chart grouped by a time field shows no bars' },
      {
        md: 'A time dimension used as `groupBy` is read from the key `name.granularity`, such as `month.month`. Add that key to each row. See [time as the grouping field](/docs/time-series#grouping-by-time).',
      },
      { h2: 'The skeleton never goes away' },
      {
        md: '`results.isLoading` is still `true`, or `results()` was called before the rows arrived. Pass `{ isLoading: false, data: rows }` once they do. See [Loading, empty and errors](/docs/loading-empty-and-errors).',
      },
    ],
  },
  {
    slug: 'describing-your-data',
    title: 'Describing your data',
    section: 'Guides',
    description: 'Dimensions, measures, field options and the one response shape every chart takes.',
    blocks: [
      {
        md: 'Charts do not guess what your columns mean. You describe each one once, as a **dimension** (something you group by) or a **measure** (a number), and reuse the description in every chart.',
      },
      { h2: 'A dimension and a measure', id: 'example' },
      { md: 'This chart groups by one dimension, the plan, and plots one measure, the recurring revenue.' },
      { code: sample(planChartSource), file: 'PlanChart.tsx' },
      { live: 'plan-chart', md: 'Result: three bars, labelled €84K, €214K and €391K.' },
      { h2: 'Field properties', id: 'fields' },
      {
        md: [
          '| Property | What it is |',
          '|---|---|',
          '| `name` | The key the chart reads from each row. |',
          '| `title` | The label on axes, legends, tooltips and table headers. Defaults to `name`. |',
          '| `type` | `string`, `number`, `time` or `boolean`. Dimensions default to `string` and measures to `number`. |',
          `| \`granularity\` | Time dimensions only: ${listOf(granularities, 'or')}. See below. |`,
          '| `inputs` | The field options below. |',
        ].join('\n'),
      },
      {
        md: 'Set `granularity` on the dimension itself, at the top level of `dimension()`. It formats the axis (`month` shows `Jan 2026`) and fills missing periods. See [Time series](/docs/time-series).',
      },
      {
        md: 'A chart’s own `granularity` prop formats and fills nothing. It says which granularity the rows you pass are at now, so a click handler can turn a clicked period into a time range. Left out, it follows the dimension’s.',
      },
      { h2: 'Field options', id: 'field-options' },
      {
        md: 'Field options go in a field’s `inputs` and apply wherever the field is shown: axes, value labels, tooltips, legends and table cells.',
      },
      {
        md: [
          '| Option | For | What it does |',
          '|---|---|---|',
          '| `prefix` | Any field | Text before each value. `prefix: \'$\'` shows `$48,200`. |',
          '| `suffix` | Any field | Text after each value. `suffix: \'%\'` shows `12%`. |',
          '| `decimalPlaces` | Numbers | A fixed number of decimal places. `1` shows `12.5`. |',
          '| `currency` | Numbers | An ISO currency code such as `EUR`. The value is formatted as money in the reader’s locale. |',
          '| `abbreviateLargeNumber` | Numbers | Shortens large numbers: `1,200,000` becomes `1.2M`. |',
          '| `displayName` | Any field | A label shown in place of `title`. |',
          '| `maxCharacters` | Text | Cuts longer text off at this length and adds `...`. |',
          '| `displayNullAs` | Any field | Text shown when a value is missing, such as `n/a`. |',
          '| `showGranularityDropdown` | Time dimensions | Shows a granularity picker in the card. See [Time series](/docs/time-series#granularity-picker). |',
          '| `dateBounds` | Time dimensions | `{ from, to }`: the first and last date on the axis. The default is the range of your rows. |',
          '| `ignoreEmptyDate` | Time dimensions | Leaves out periods with no rows instead of showing them as gaps. |',
          '| `color`, `lineColor` | Measures | A colour for this measure’s bars or line. Bar and line charts only. |',
        ].join('\n'),
      },
      {
        md: 'There is no date format option: dates follow the granularity and the [provider’s locale](/docs/localisation). Options that only one chart reads, such as a dashed line or a pivot total, are listed on that [component’s page](/docs/components).',
      },
      { h2: 'The response shape', id: 'response-shape' },
      {
        md: 'Every component takes its rows through one prop, `results`. `results(rows)` builds it from an array, and counts as loading until `rows` has a value.',
      },
      {
        md: [
          '| Key | Type | What it is |',
          '|---|---|---|',
          '| `isLoading` | `boolean` | Whether a request is in flight. |',
          '| `data` | Array of objects | Your rows. |',
          '| `error` | `string` | A message to show in place of the chart. |',
          '| `total` | `number` | The total row count, for paginated tables. |',
        ].join('\n'),
      },
      { md: '[Loading, empty and errors](/docs/loading-empty-and-errors) shows what each combination draws.' },
    ],
  },
  {
    slug: 'time-series',
    title: 'Time series',
    section: 'Guides',
    description: 'Time dimensions, the timestamp format, missing periods and the granularity picker.',
    blocks: [
      {
        md: 'Give a dimension `type: \'time\'` and set `granularity` on the dimension itself. The chart then formats the dates for that granularity, puts the rows in date order and adds the periods that have no row.',
      },
      { h2: 'A time dimension', id: 'example' },
      { md: 'Four weeks of signups, with one week missing from the rows.' },
      { code: sample(signupsByWeekSource), file: 'SignupsByWeek.tsx' },
      { live: 'signups-by-week', md: 'Result: five weeks on the axis, with no bar for the week of 19 January.' },
      { h2: 'Time values', id: 'time-values' },
      {
        md: [
          'A time value has to be:',
          '',
          '- **A string in the form `YYYY-MM-DDTHH:mm:ss.SSS`**, with no `Z` and no offset. Anything else is shown as raw text.',
          '- **The start of its period**: the first of the month for `month`, the Monday for `week`. A row at any other time is left off the chart.',
          '- **Under the dimension’s `name`** in each row.',
        ].join('\n'),
      },
      {
        md: 'The time zone used to work out date ranges comes from the provider: see [Localisation](/docs/localisation).',
      },
      { h2: 'Missing periods', id: 'missing-periods' },
      {
        md: 'Periods with no row are added between your first and last row, so a gap in the data shows as a gap. Set `dateBounds` to extend the axis past your rows, or `ignoreEmptyDate` to leave empty periods out: both are [field options](/docs/describing-your-data#field-options).',
      },
      { h2: 'Let readers change the granularity', id: 'granularity-picker' },
      {
        md: 'Turn on `showGranularityDropdown`, keep the granularity in state and pass `setGranularity`. The card shows a picker from day to year. The chart does not re-bucket your rows: you query again at the new granularity.',
      },
      { code: sample(ordersOverTimeSource), file: 'OrdersOverTime.tsx' },
      { live: 'orders-over-time', md: 'Result: a line of monthly totals and a picker set to Month. Choosing Week redraws the line with weekly totals.' },
      { h2: 'Time as the grouping field', id: 'grouping-by-time' },
      {
        md: 'One case needs a second key. When a time dimension is the `groupBy` of a stacked or grouped bar chart, or the point or group field of a scatter or bubble chart, the chart reads it from the key `name.granularity`, for example `month.month`.',
      },
      { code: sample(revenueByPlanAndMonthSource), file: 'RevenueByPlanAndMonth.tsx' },
      { live: 'revenue-by-plan-and-month', md: 'Result: one stacked bar per plan, with a segment and a legend entry for each month.' },
    ],
  },
  {
    slug: 'loading-empty-and-errors',
    title: 'Loading, empty and errors',
    section: 'Guides',
    description: 'Four states in every card, all driven by the results prop.',
    blocks: [
      {
        md: 'A card draws one of four states from its `results` prop. There is nothing else to wire: pass the state of your request straight through.',
      },
      { h2: 'The four states', id: 'states' },
      { code: sample(chartStatesSource), file: 'ChartStates.tsx' },
      { live: 'chart-states', md: 'Result: four cards showing a skeleton, a chart with a spinner in its header, “No results.” and “Something went wrong.”' },
      {
        md: [
          '| Value of results | The card shows |',
          '|---|---|',
          '| `{ isLoading: true }` | A skeleton. |',
          '| `{ isLoading: true, data: rows }` | The chart it already has, with a spinner in the header. |',
          '| `{ isLoading: false, data: [] }` | The empty state. |',
          '| `{ isLoading: false, error: \'message\' }` | The error state, with your message. |',
        ].join('\n'),
      },
      {
        md: 'The empty and error headings are translated with the rest of the built-in text: see [Localisation](/docs/localisation).',
      },
      { h2: 'From a request to results', id: 'from-a-request' },
      {
        md: 'The components never fetch, so something has to turn your request into that shape. This hook does it for any function that returns a promise of rows: a skeleton first, the rows when they arrive, and the message of the error if the request fails.',
      },
      { code: sample(revenueFromApiSource), file: 'RevenueFromApi.tsx' },
      {
        md: 'With a data library you already have the three values. For TanStack Query: `results={{ isLoading: query.isPending, data: query.data, error: query.error?.message }}`.',
      },
    ],
  },
  {
    slug: 'events',
    title: 'Events',
    section: 'Guides',
    description: 'Click handlers that give you the clicked value, for cross-filtering and drill-downs.',
    blocks: [
      {
        md: 'A chart calls your handler when a bar, point, slice or row is clicked, and passes the value that was clicked. Use it to filter another chart, open a detail view or navigate.',
      },
      { h2: 'Filter one chart from another', id: 'example' },
      { md: 'Click a region on the left to filter the chart on the right.' },
      { code: sample(regionFilterSource), file: 'RegionFilter.tsx' },
      { live: 'region-filter', md: 'Result: two bar charts. Clicking a region in the first changes the title and the bars of the second.' },
      { h2: 'What the handler receives', id: 'payload' },
      {
        md: [
          '| Key | Value |',
          '|---|---|',
          `| \`dimensionValue\` | ${CLICK_VALUE_ROW} |`,
          `| \`dimensionTimeRange\` | ${CLICK_TIME_RANGE_ROW} |`,
          '| `groupingDimensionValue`, `groupingDimensionTimeRange` | The same pair for the series that was clicked. Stacked and grouped charts only. |',
          `| \`measureValues\` | Each measure’s value at the click, keyed by the measure’s \`name\`. Passed by ${listOf(Object.keys(MEASURE_VALUES_HANDLERS))}, though their payload types leave it out. |`,
        ].join('\n'),
      },
      { md: TIME_RANGE_NOTE },
      { h2: 'Handler names', id: 'handlers' },
      {
        md: 'The prop is named after what is clicked, and the names differ: some end in `Clicked`, some in `Click`. This table is generated from each component’s props.',
      },
      {
        md: [
          '| Handler | Components |',
          '|---|---|',
          ...[...clickHandlers].map(([name, components]) => `| \`${name}\` | ${components.map((c) => `\`${c}\``).join(', ')} |`),
        ].join('\n'),
      },
      {
        md: `${listOf(clickHandlers.get('onPointClicked') ?? [])} ${takes(clickHandlers.get('onPointClicked'))} \`onPointClicked\`; ${listOf(clickHandlers.get('onPointClick') ?? [])} ${takes(clickHandlers.get('onPointClick'))} \`onPointClick\`. Each [component page](/docs/components) has the payload type, and its playground logs the payload as you click.`,
      },
      {
        md: 'Clicks need a pointer. For keyboard users, offer the same action another way: see [Accessibility](/docs/accessibility).',
      },
    ],
  },
  {
    slug: 'tables',
    title: 'Tables',
    section: 'Guides',
    description: 'A paginated table you control: it asks for a page and you fetch it.',
    blocks: [
      {
        md: '`TablePaginated` holds no data of its own. It reports the page, the [page size](/docs/tables#page-size) and the sort. You fetch that slice and pass it back, so one page is in memory at a time.',
      },
      { h2: 'A paginated table', id: 'example' },
      { md: 'Here a local array stands in for the server. Sort a column or change page, and the table asks for the new slice.' },
      { code: sample(customersTableSource), file: 'CustomersTable.tsx' },
      { live: 'customers-table', md: 'Result: a table of five rows with sortable column headers and “Page 1 of 5” under it.' },
      { h2: 'What you pass', id: 'props' },
      {
        md: [
          '| Prop | What it is |',
          '|---|---|',
          '| `state`, `setState` | The table’s state, kept by you: `page`, `pageSize`, `sort` and `isLoadingDownloadData`. |',
          '| `results` | The rows of the current page. |',
          '| `totalResults` | `{ isLoading, total }`: the total row count, which sets the number of pages. |',
          '| `allResults` | Every row, for the CSV and Excel export. `state.isLoadingDownloadData` turns `true` when a reader asks for one, so you can fetch them only then. |',
        ].join('\n'),
      },
      { h2: 'Page size', id: 'page-size' },
      {
        md: 'Left alone, the table shows as many rows as fit its height, so it fills a card of any size and follows it when the card is resized. For a fixed number, pass `pageSize`, for example `pageSize={5}`. Either way the table reports it in `state.pageSize`, so slice your rows by that.',
      },
      {
        md: 'Give a card with a `pageSize` room for its rows: about 40 pixels each, on top of the header row, the pager and the card’s title. Rows that do not fit scroll inside the card.',
      },
      {
        md: '`setState` can be any function that stores the new state, not only the setter from `useState`.',
      },
      { h2: 'Other tables', id: 'other-tables' },
      {
        md: 'The [scrollable table](/docs/components/table-scrollable) loads more rows as the reader scrolls. The [pivot table](/docs/components/pivot-table) and the [heat map](/docs/components/heat-map) take the same fields and the same `results`.',
      },
    ],
  },
  {
    slug: 'theming',
    title: 'Theming',
    section: 'Guides',
    description: 'Design tokens, dark mode, pinned colours and Chart.js options.',
    blocks: [
      {
        md: 'Styling runs on CSS variables that start with `--em-`, and you can override any of them in the provider’s `theme.styles`. The default look is an orange and blue palette on a white card with a hairline border. Semantic tokens, such as the background, the text and the ten chart colours, restyle every component, and component tokens adjust one.',
      },
      { code: sample(brandThemeSource), file: 'BrandCharts.tsx' },
      {
        md: '> The tokens are set on the page root, so one theme is active per page. To see every chart restyle together, use the theme switcher (Default, Cool, Mono or Uluru) above the preview on any [component page](/docs/components).',
      },
      { h2: 'Dark mode', id: 'dark' },
      { md: 'A dark theme is a handful of semantic overrides.' },
      { code: sample(darkThemeSource), file: 'DarkModeCharts.tsx' },
      { h2: 'Pinned colours', id: 'pinned-colours' },
      {
        md: 'Charts give each value a colour and keep it the same in every chart. To choose the colour yourself, map it in `theme.charts.backgroundColorMap`: the key is `dimensionName.value` for a dimension value, or the measure’s name.',
      },
      { code: sample(pinnedColoursSource), file: 'PinnedColours.tsx' },
      { h2: 'Chart.js options', id: 'chart-options' },
      {
        md: `Each chart type takes Chart.js options under \`theme.charts\`, merged over the defaults. The keys are ${listOf(chartOptionKeys)}. This example turns animation off for readers who ask for reduced motion.`,
      },
      { code: sample(reducedMotionSource), file: 'StillCharts.tsx' },
    ],
  },
  {
    slug: 'localisation',
    title: 'Localisation',
    section: 'Guides',
    description: 'Language, number and date formats, time zone and your own translations.',
    blocks: [
      {
        md: 'Three settings, each set on its own: the language of the built-in text, the locale for numbers and dates, and the time zone for date ranges. German labels with Swiss number formats is `language: \'de\'` with `locale: \'de-CH\'`.',
      },
      { code: sample(germanChartsSource), file: 'GermanCharts.tsx' },
      {
        md: 'Without `formatter.locale`, numbers and dates follow the browser’s language. To see every chart switch language, use the EN, DE and FR buttons above the preview on any [component page](/docs/components).',
      },
      { h2: 'Translate your own titles and values', id: 'your-content' },
      {
        md: 'Write a title or description as `key|fallback`. Field titles are looked up at `measure.<name>` and `dimension.<name>`, and dimension values at `dimension.<name>.<value>`.',
      },
      { code: sample(translatedChartSource), file: 'TranslatedChart.tsx' },
      { h2: 'Add a language', id: 'new-language' },
      {
        md: 'Add a bundle under a new language code. Any key you leave out falls back to English, so you can translate in stages. The built-in keys are in `defaultTheme.i18n.translations.en`.',
      },
      { code: sample(spanishChartsSource), file: 'SpanishCharts.tsx' },
    ],
  },
  {
    slug: 'card-menu',
    title: 'Card menu',
    section: 'Guides',
    description: 'Choose the entries in a card’s menu, add your own, and change what the downloads do.',
    blocks: [
      {
        md: 'A chart’s card has a menu behind the ⋮ button in its header: download the data as CSV or XLSX, download the chart as a PNG, or maximize the card. You choose the entries per chart, and you can add your own or change what a built-in one does.',
      },
      { h2: 'Choose the entries for a chart', id: 'per-chart' },
      {
        md: '`menuOptions` lists the entries a chart offers, by `value`. The built-in values are `csv`, `xlsx`, `png` and `maximize`, and each [component page](/docs/components) gives its default: all four for most.',
      },
      {
        md: 'Pass `[]` for no menu at all. `hideMenu` goes further and leaves out the card’s whole header: title, description and menu.',
      },
      { h2: 'Add your own entry', id: 'add' },
      {
        md: 'Entries are defined in the theme, at `defaults.chartMenuOptions`. Add yours to the built-in list, then name its `value` in the `menuOptions` of each chart that should offer it.',
      },
      { code: sample(copyJsonMenuSource), file: 'CopyJsonMenu.tsx' },
      {
        md: 'An override replaces the list, which is why the example starts from `defaultTheme.defaults.chartMenuOptions`. The menu button shows a spinner until `onClick` returns or, when it returns a promise, until that settles.',
      },
      { h2: 'What an entry receives', id: 'receives' },
      {
        md: [
          '| Key | Value |',
          '|---|---|',
          '| `title` | The card’s title, translated. |',
          '| `data` | The chart’s rows. On a table, every row from `allResults`, not the page on screen. |',
          '| `dimensionsAndMeasures` | The fields the chart draws. |',
          '| `containerRef`, `cardRef` | DOM refs to the chart’s body and to the whole card. |',
          '| `theme` | The active theme, with its formatter and translations. |',
          '| `options` | The entry’s own `options`. |',
        ].join('\n'),
      },
      {
        md: 'On a table, an entry waits for `allResults`, as the built-in downloads do: see [Tables](/docs/tables#props).',
      },
      { h2: 'Change a built-in entry', id: 'change' },
      {
        md: 'Map over the built-in list and return a changed copy of the entry. To keep the download and add a step, call the original `onClick` from yours.',
      },
      { code: sample(customDownloadsSource), file: 'CustomDownloads.tsx' },
      {
        md: 'The PNG entry reads two settings from its `options`. `pngBackgroundColor` is any CSS colour, and the image is transparent without it; `captureFullCard` includes the card’s title and description.',
      },
      { h2: 'Labels, icons and order', id: 'details' },
      {
        md: [
          '- **Labels.** `labelKey` is a translation key, and text with no translation is shown as written, so a plain label works. For a translated label, add the key to your [translations](/docs/localisation#new-language) before the first chart renders.',
          '- **Icons.** `iconSrc` is an SVG as a data URL: `data:image/svg+xml,` followed by the URL-encoded markup.',
          '- **Order.** Entries appear in the order of the theme’s list, whatever the order of `menuOptions`.',
          '- **No spinner.** `isInstantAction: true` runs an entry at once, without the spinner.',
          '- **Errors.** An error thrown by `onClick` is not caught. Handle a failure inside it, for example to tell the reader.',
        ].join('\n'),
      },
    ],
  },
  {
    slug: 'accessibility',
    title: 'Accessibility',
    section: 'Guides',
    description: 'What keyboard and screen-reader users get from each component today, and what is left to you.',
    blocks: [
      {
        md: 'KPIs and tables are HTML, so assistive technology can read them as they are. Charts are drawn on a canvas, which holds no data a screen reader can reach, so each chart needs a text alternative from you. This page lists what the components do today, gaps included.',
      },
      { h2: 'Charts', id: 'charts' },
      {
        md: [
          '- **The title and description are text.** The card’s `title` is a heading and its `description` is a paragraph. Both are read aloud.',
          '- **The plot is named, not described.** It is a `<canvas role="img">` named after the card’s title and description. A screen reader hears that name, not the values.',
          '- **The plot needs a pointer.** Tooltips and click handlers work with a mouse or touch. Nothing inside the plot takes keyboard focus.',
          '- **Series differ by colour only.** On line charts, the `dashedLine` field option adds a second cue.',
          '- **Charts animate when they draw**, whatever the reader’s reduced-motion setting. [Chart.js options](/docs/theming#chart-options) shows how to turn that off.',
        ].join('\n'),
      },
      { h2: 'KPIs', id: 'kpis' },
      {
        md: 'The title, the number and the change are all text. The change carries a plus or minus sign as well as a colour and an arrow, so it does not depend on colour.',
      },
      { h2: 'Tables', id: 'tables' },
      {
        md: [
          '- Tables are a real `<table>` with column headers. The pivot table and the heat map add row headers.',
          '- A sortable column header is a button with a spoken label, and its column carries `aria-sort`.',
          '- The pagination buttons are labelled “First page”, “Previous page”, “Next page” and “Last page”.',
          '- An expandable pivot row is a button with `aria-expanded`. Every heat map cell is a button that takes focus, whether or not you pass `onCellClicked`.',
        ].join('\n'),
      },
      {
        md: [
          'Three gaps:',
          '',
          '- The sort and pagination labels are in English, whatever language the provider is set to.',
          '- `onRowClicked` needs a pointer. Rows do not take focus.',
          '- Each body cell holds a copy button, shown on hover and whenever focus is in its cell: a table of many cells is many keyboard stops.',
        ].join('\n'),
      },
      { h2: 'The card: menu, picker and states', id: 'card' },
      {
        md: [
          '- **Export menu.** It works from the keyboard, with the keys below. Its button is named after the chart (“Chart menu: Revenue by region”) in the provider’s language. Its entries are yours to change: see [Card menu](/docs/card-menu).',
          '- **Maximised view.** It opens as a modal dialog named after the chart’s title, with a “Minimize” button. Focus is not put back on the card when it closes.',
          '- **Granularity picker.** A menu button that shows the current value, with the same keys as the export menu.',
          '- **States.** The empty and error states are text. The loading skeleton has none, and a change of state is not announced: the card has no live region.',
          '- **Focus.** Buttons keep the browser’s default focus ring.',
        ].join('\n'),
      },
      { h2: 'Keyboard', id: 'keyboard' },
      {
        md: [
          '| Key | Where | What it does |',
          '|---|---|---|',
          '| `Tab`, `Shift` + `Tab` | Anywhere | Moves between the controls of a card: export menu, granularity picker, column headers, cell copy buttons and pagination. |',
          '| `Enter` or `Space` | Export menu button, granularity picker | Opens the menu and moves focus to its first item. |',
          '| `↓`, `↑` | Open menu | Moves to the next or previous item, wrapping at the ends. |',
          '| `Home`, `End` | Open menu | Moves to the first or last item. |',
          '| `Enter` | Menu item | Chooses it. |',
          '| `Esc` | Open menu | Closes it and returns focus to its button. |',
          '| `Esc` | Maximised view | Closes it. |',
          '| `Enter` or `Space` | Column header | Sorts ascending, then descending, then clears the sort. |',
          '| `Enter` or `Space` | Expandable pivot row | Opens or closes the row. |',
          '| `Enter` or `Space` | Heat map cell | Calls `onCellClicked`, if you passed one. |',
        ].join('\n'),
      },
      { h2: 'What to do in your app', id: 'checklist' },
      {
        md: [
          '1. Give every chart a `title`, and state its main finding in `description`. “Revenue rose 37% from January to June” is read aloud; the bars are not.',
          '2. Offer the numbers as a table near each chart. The same fields and rows work in a [table component](/docs/tables).',
          '3. Never make a click handler the only way to reach something. Add a link, button or filter outside the chart that does the same.',
          '4. Check the contrast of your [theme](/docs/theming): text tokens against their background, and neighbouring chart colours against each other.',
          '5. Turn animation off for readers who ask for reduced motion, as in [Chart.js options](/docs/theming#chart-options).',
        ].join('\n'),
      },
    ],
  },
  {
    slug: 'ai',
    title: 'Use with AI',
    section: 'Guides',
    description: `Point Claude Code, Cursor or ChatGPT at these docs, so the code they write for ${BRAND.name} is correct.`,
    blocks: [
      {
        md: 'These docs are published as Markdown as well as HTML, so a coding assistant can read them without a browser.',
      },
      {
        md: [
          '| URL | What it holds |',
          '|---|---|',
          `| \`${url}/llms.txt\` | Every page with a one-line description and a link to its Markdown. |`,
          // No size typed here: llms-full.txt states its own in its header, and llms.txt repeats it.
          `| \`${url}/llms-full.txt\` | Every page in one file. Its header, and its line in \`llms.txt\`, give its size. |`,
          `| A docs page’s URL plus \`.md\` | That page as Markdown, for example \`${url}/docs/components/bar-chart.md\`. The home page is \`${url}/index.md\`; playgrounds have none. |`,
        ].join('\n'),
      },
      { h2: 'Claude Code', id: 'claude-code' },
      { md: 'Add this to `CLAUDE.md` at the root of your repository.' },
      { code: agentRule, lang: 'text', file: 'CLAUDE.md' },
      { h2: 'Cursor', id: 'cursor' },
      {
        md: `In Cursor’s settings, under Indexing & Docs, add \`${url}/llms-full.txt\` as a doc, every page in one file, and mention it with \`@Docs\`. For a standing rule, add this to \`AGENTS.md\` at the root of your project, or to a rule file under \`.cursor/rules/\`.`,
      },
      { code: cursorRule, lang: 'md', file: 'AGENTS.md' },
      { h2: 'ChatGPT', id: 'chatgpt' },
      {
        md: 'Start your message with the index and the page of the component you need, as below. If your plan cannot open links, paste that page into the chat.',
      },
      { code: chatPrompt, lang: 'text' },
      { h2: 'One component at a time', id: 'copy-buttons' },
      {
        md: 'Every [component page](/docs/components) has a **Copy page as Markdown** button. It copies the page as text an assistant can read: purpose, install, a complete example and the props table.',
      },
      {
        md: 'To let a model in your own product answer with a chart, see [Charts from a model](/docs/charts-from-a-model).',
      },
    ],
  },
  {
    slug: 'charts-from-a-model',
    title: 'Charts from a model',
    section: 'Guides',
    description: 'Let a model choose the chart: it returns JSON, and one component renders it.',
    blocks: [
      {
        md: '`ChartFromSpec` renders a chart from a `ChartSpec`: plain JSON that names the chart kind, the fields and the rows. A model writes that JSON through a tool call, so an assistant in your product can answer with a chart.',
      },
      { h2: '1. Ask the model for a spec', id: 'tool' },
      {
        md: '`renderChartTool` is the tool definition. `chartGuidance` is a system prompt that tells the model which chart to pick and how to shape the rows. Neither imports React, so both can run in a server route.',
      },
      { md: 'The sample uses the Anthropic SDK. Install it in the project that runs your server route.' },
      { code: 'npm install @anthropic-ai/sdk', lang: 'bash' },
      { code: chartServerCode, lang: 'ts', file: 'chartFor.ts' },
      {
        md: 'With OpenAI, pass `renderChartToolOpenAI` as the tool and parse `tool_calls[0].function.arguments`.',
      },
      { h2: '2. Render the spec', id: 'render' },
      {
        md: 'Pass the spec to `ChartFromSpec`. Each click comes back as a serialisable `ChartIntent`, and `intentToPrompt()` turns it into a sentence you can send as the next message.',
      },
      { code: sample(answerChartSource), file: 'AnswerChart.tsx' },
      { live: 'answer-chart', md: 'Result: a bar chart of the four channels. Clicking the “Paid search” bar shows the sentence `The user clicked channel \"Paid search\" on the \"Signups by channel\" chart. Drill into it.`' },
      {
        md: '`chrome` sets how much of the card is drawn: `card`, `plain` (no export menu) or `bare` (no header or background, for a chat bubble).',
      },
      { h2: 'What happens to a bad spec', id: 'bad-specs' },
      {
        md: 'The renderer does not trust its input. Dates and numbers sent as text are converted, an unknown chart kind falls back to a table of the rows, and an invalid spec shows the error card instead of throwing.',
      },
      { h2: 'What the model sees', id: 'schema' },
      {
        md: `The tool is named \`${renderChartTool.name}\`. Its schema is generated from the \`ChartSpec\` type, so it cannot drift from the renderer. To validate a spec on your server, import \`chartSpecSchema\` from \`${pkg}/ai\`.`,
      },
      {
        live: 'ai-schema',
        md: `The full JSON Schema is \`renderChartTool.input_schema\` (${(schemaJson.length / 1024).toFixed(1)} KB). Its \`chart\` field takes one of: ${CHART_KINDS.map((kind) => `\`${kind}\``).join(', ')}.`,
      },
      { md: `The guidance is plain text, about ${Math.round(chartGuidance.length / 1024)} KB:` },
      { code: chartGuidance, lang: 'text', file: 'chartGuidance', maxHeight: 360 },
      { md: '[Try your own specs in the AI chat example](/examples/ai-chat).' },
    ],
  },
  {
    slug: 'build-your-own-chart',
    title: 'Build your own chart',
    section: 'Guides',
    description: 'The toolkit the built-in charts are made from, for the charts you add yourself.',
    blocks: [
      {
        md: `When no component fits, build one from the toolkit the built-in charts use, imported from \`${pkg}/build\`. Your chart then formats values, picks colours, fills time gaps and draws the same states as the rest.`,
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
          '| Data and option builders | `getBarChartProData`, `getBarChartProOptions`, `getLineChartProData`, `getLineChartProOptions`, `getPieChartProData`, `getPieChartProOptions` |',
        ].join('\n'),
      },
      { h2: 'Example: a line with a target', id: 'example' },
      {
        md: 'The built-in line chart plus a dashed target line. Everything except the target dataset comes from the toolkit, which is why it matches the other charts.',
      },
      { code: targetLineChartCode, file: 'TargetLineChart.tsx' },
      { md: 'Use it like any built-in chart:' },
      { code: sample(revenueTargetSource), file: 'RevenueTarget.tsx' },
      { live: 'target-line-demo', md: 'Result: the revenue line with a dashed line at $55,000 and “Target” in the legend.' },
      { h2: 'Rules that keep it consistent', id: 'rules' },
      {
        md: [
          '- Format every value with `getThemeFormatter(theme).data(field, value)`, so the field’s options and the locale apply.',
          '- A `Pro` options builder only formats values. Pass it as `options` to a primitive, which merges it onto its themed base.',
          '- Take data colours from `getChartColors()` and `getDimensionMeasureColor()`, so a value keeps its colour across charts. Read everything else from a theme token with `getStyle()` during render, so it follows theme changes.',
          '- Wrap the chart in `ChartCard` and pass it the filled `results`. It draws the skeleton, the empty and error states and the export menu.',
        ].join('\n'),
      },
    ],
  },
];

// Slugs from earlier versions of the site; `/docs/<old>` redirects to the new one.
export const guideAliases: Record<string, string> = {
  introduction: 'quick-start',
  installation: 'quick-start',
  data: 'describing-your-data',
  time: 'time-series',
  states: 'loading-empty-and-errors',
  build: 'build-your-own-chart',
  'ai-charts': 'charts-from-a-model',
};

export const getGuide = (slug: string) => guides.find((g) => g.slug === slug);

const fence = (code: string, lang: CodeLang, file?: string) =>
  `\`\`\`${lang}${file && /\.\w+$/.test(file) ? ` title="${file}"` : ''}\n${code}\n\`\`\``;

/**
 * A docs path, with or without a fragment, as its Markdown twin's URL: the
 * fragment becomes the anchor of the target heading in the twin, and one with
 * no heading there is dropped.
 */
export const markdownLink = (href: string) => {
  const [path, hash] = href.split('#') as [string, string | undefined];
  const target = hash ? anchorsOf(getGuide(path.replace(/^\/docs\//, ''))?.blocks ?? []).find((a) => a.id === hash || a.anchor === hash) : undefined;
  return `${path}.md${target ? `#${target.anchor}` : ''}`;
};

// In Markdown, a link to another docs page goes to that page's Markdown twin.
const toMarkdownLinks = (text: string) =>
  text
    .replace(/\]\((\/(?:docs|examples)[\w/-]*(?:#[\w-]+)?)\)/g, (_, href: string) => `](${markdownLink(href)})`)
    .replace(/\]\(\/(#[\w-]+)?\)/g, '](/index.md)');

// Guides whose samples show a chart but no provider: they say once where it comes from.
export const providerNote = (guide: Guide) =>
  guide.slug !== 'quick-start' &&
  allBlocks(guide.blocks).some((b) => 'code' in b && (b.lang ?? 'tsx') === 'tsx' && /results=\{/.test(b.code) && !b.code.includes('ChartsProvider'))
    ? 'The samples assume the `ChartsProvider` from [step 2 of the quick start](/docs/quick-start#provider).'
    : undefined;

const blockMarkdown = (block: GuideBlock): string[] => {
  if ('h2' in block) return [`## ${block.h2}`];
  if ('h3' in block) return [`### ${block.h3}`];
  // A closed section is open in Markdown, under a heading of its own.
  if ('details' in block) return [`### ${block.details}`, ...block.blocks.flatMap(blockMarkdown)];
  if ('code' in block) return [fence(block.code, block.lang ?? 'tsx', block.file)];
  return [toMarkdownLinks(block.md)];
};

/**
 * The page as self-contained Markdown: served at /docs/<slug>.md and copied by
 * "Copy page as Markdown". A live block is represented by the code block before it, or
 * by its own Markdown stand-in.
 */
export const guideMarkdown = (guide: Guide) =>
  [`# ${guide.title}`, guide.description, providerNote(guide) && toMarkdownLinks(providerNote(guide)!), ...guide.blocks.flatMap(blockMarkdown)]
    .filter(Boolean)
    .join('\n\n');
