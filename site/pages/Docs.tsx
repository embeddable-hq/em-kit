import { ReactNode, useEffect, useState } from 'react';
import { CodeBlock } from '../components/CodeBlock';
import { chartEntries, chartGroups } from '../catalog/registry';
import { BRAND } from '../config';
import { href } from '../router';

const pkg = BRAND.packageName;

const sections = [
  { id: 'introduction', title: 'Introduction' },
  { id: 'installation', title: 'Installation' },
  { id: 'quick-start', title: 'Quick start' },
  { id: 'data', title: 'Describing your data' },
  { id: 'time', title: 'Time series' },
  { id: 'states', title: 'Loading, empty and errors' },
  { id: 'events', title: 'Events' },
  { id: 'tables', title: 'Tables' },
  { id: 'theming', title: 'Theming' },
  { id: 'localisation', title: 'Localisation' },
  { id: 'components', title: 'Components' },
];

const Section = ({ id, title, children }: { id: string; title: string; children: ReactNode }) => (
  <section id={id} className="doc-section">
    <h2>{title}</h2>
    {children}
  </section>
);

const quickStart = `import { ChartsProvider, LineChartDefaultPro, dimension, measure, results } from '${pkg}';

const month = dimension({ name: 'month', title: 'Month', type: 'time', granularity: 'month' });
const revenue = measure({ name: 'revenue', title: 'Revenue', inputs: { prefix: '$' } });

export function RevenueTrend() {
  const { data, isLoading, error } = useRevenueByMonth(); // your own data hook

  return (
    <ChartsProvider>
      <div style={{ height: 360 }}>
        <LineChartDefaultPro
          title="Revenue"
          xAxis={month}
          measures={[revenue]}
          results={{ isLoading, error, data }}
          showTooltips
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

<LineChartDefaultPro
  xAxis={orderedAt}
  measures={[sales]}
  results={results(rows)}
  granularity={granularity}
  setGranularity={setGranularity}   // called with the user's choice
/>`;

const statesCode = `<BarChartDefaultPro results={{ isLoading: true }} … />            // skeleton
<BarChartDefaultPro results={results([])} … />                    // empty state
<BarChartDefaultPro results={{ isLoading: false, error: 'Query timed out' }} … />  // error`;

const eventsCode = `<BarChartDefaultPro
  dimension={region}
  measures={[revenue]}
  results={results(rows)}
  onBarClicked={({ dimensionValue }) => setSelectedRegion(dimensionValue)}
/>`;

const tableCode = `const [state, setState] = useState({ page: 0, isLoadingDownloadData: false });
// state.pageSize is measured from the available height; state.sort is set by header clicks.
const { rows, total } = useOrders({ page: state.page, pageSize: state.pageSize, sort: state.sort });

<TableChartPaginatedPro
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
  <BarChartDefaultPro
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

export const Docs = () => {
  const [active, setActive] = useState(sections[0]!.id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (items) => {
        const visible = items.filter((i) => i.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -60% 0px' },
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="container docs">
      <aside className="docs__nav" aria-label="On this page">
        <span className="docs__nav-title">Documentation</span>
        {sections.map((s) => (
          <button key={s.id} type="button" className={active === s.id ? 'is-active' : ''} onClick={() => jump(s.id)}>
            {s.title}
          </button>
        ))}
      </aside>

      <article className="docs__body">
        <Section id="introduction" title="Introduction">
          <p className="lede">
            {BRAND.name} is a set of React chart components for teams that already have a data layer. You query your
            data however you like; the components take care of rendering, formatting, theming, localisation, states and
            export.
          </p>
          <p>
            It deliberately does <strong>not</strong> fetch, cache or aggregate data. Every chart takes the rows you
            give it and renders them. That keeps it compatible with any API, warehouse, ORM or state library, and means
            there is nothing to host.
          </p>
          <div className="callout">
            <strong>What you get with every chart:</strong> a card with title, description and info tooltip; tooltips;
            click events; locale-aware formatting; consistent colours per value; loading, empty and error states; and
            CSV, XLSX and PNG export.
          </div>
        </Section>

        <Section id="installation" title="Installation">
          <CodeBlock code={`npm install ${pkg}`} label="bash" compact />
          <p>
            Requires React 19. Chart.js and the other runtime dependencies install with the package, so there is no
            extra setup.
          </p>
        </Section>

        <Section id="quick-start" title="Quick start">
          <p>
            Wrap your app, or just the part with charts, in <code>ChartsProvider</code> once. Then give each chart a
            size and its data. Charts fill their container, so put them in an element with a height.
          </p>
          <CodeBlock code={quickStart} />
        </Section>

        <Section id="data" title="Describing your data">
          <p>
            Charts don’t guess what your columns mean. You describe each field once as a <strong>dimension</strong>{' '}
            (something you group by) or a <strong>measure</strong> (a number), and reuse those descriptions across
            charts.
          </p>
          <CodeBlock code={fieldsCode} />
          <table className="doc-table">
            <thead>
              <tr>
                <th>Option</th>
                <th>Meaning</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>name</code>
                </td>
                <td>The key the chart reads from each row.</td>
              </tr>
              <tr>
                <td>
                  <code>title</code>
                </td>
                <td>Human label for axes, legends, tooltips and table headers. Defaults to <code>name</code>.</td>
              </tr>
              <tr>
                <td>
                  <code>type</code>
                </td>
                <td>
                  <code>string</code>, <code>number</code>, <code>time</code> or <code>boolean</code>. Measures default
                  to <code>number</code>, which is what turns on number formatting.
                </td>
              </tr>
              <tr>
                <td>
                  <code>inputs</code>
                </td>
                <td>
                  Display options: <code>prefix</code>, <code>suffix</code>, <code>decimalPlaces</code>,{' '}
                  <code>currency</code>, <code>abbreviateLargeNumber</code>, <code>displayName</code>,{' '}
                  <code>displayNullAs</code>, <code>maxCharacters</code>.
                </td>
              </tr>
            </tbody>
          </table>
          <p>
            Every chart’s <code>results</code> prop takes the same response shape, so you can pass your query state
            straight through:
          </p>
          <CodeBlock code={responseCode} />
        </Section>

        <Section id="time" title="Time series">
          <p>
            Give time dimensions <code>type: 'time'</code> and a <code>granularity</code>. Charts fill missing periods
            so gaps show as gaps rather than misleading straight lines.
          </p>
          <CodeBlock code={timeCode} />
          <p>
            To let users change granularity, turn on <code>showGranularityDropdown</code>, keep the granularity in
            state and pass <code>setGranularity</code>. The chart shows a day-to-year picker; you re-query at the new
            granularity.
          </p>
          <CodeBlock code={granularityCode} />
        </Section>

        <Section id="states" title="Loading, empty and errors">
          <p>
            States come from the <code>results</code> prop. Pass <code>isLoading</code> while fetching, an empty array
            when there’s nothing to show, or an <code>error</code> string when something failed. Each has a designed
            state inside the card.
          </p>
          <CodeBlock code={statesCode} />
          <p>
            Try them on any chart in the <a href={href('/charts/bar')}>gallery</a> with the State control.
          </p>
        </Section>

        <Section id="events" title="Events">
          <p>
            Interactive charts call a handler with the clicked value, and a time range when the dimension is a date.
            Use it to filter other charts, open a drill-down or navigate. Open any chart in the gallery and click a
            data point to see the exact payload.
          </p>
          <CodeBlock code={eventsCode} />
        </Section>

        <Section id="tables" title="Tables">
          <p>
            The paginated table is controlled: it tells you the page, page size and sort; you fetch that slice and pass
            it back. Large tables stay fast because only one page is ever in memory.
          </p>
          <CodeBlock code={tableCode} />
        </Section>

        <Section id="theming" title="Theming">
          <p>
            Styling is driven by CSS design tokens, all prefixed <code>--em-</code>. Override any of them through the
            provider’s <code>theme.styles</code>. Semantic tokens such as backgrounds, text and the ten-colour chart
            palette restyle every component at once; component tokens fine-tune one component.
          </p>
          <CodeBlock code={themeCode} />
          <p>A dark theme is a handful of semantic overrides:</p>
          <CodeBlock code={darkCode} />
          <p>
            Pin a colour to a specific value, so it’s the same in every chart. Keys are{' '}
            <code>dimensionName.value</code> for dimension values, or the measure name:
          </p>
          <CodeBlock code={colorMapCode} />
          <div className="callout">
            Tokens are applied to the page root, so one theme is active per page. Use the theme switcher at the top of
            this site to see every chart restyle together.
          </div>
        </Section>

        <Section id="localisation" title="Localisation">
          <p>
            UI text, number formats and date formats are set separately, so you can show German labels with Swiss
            number formatting if you need to. The timezone controls how date ranges and gaps are calculated.
          </p>
          <CodeBlock code={localeCode} />
          <p>
            Your own content translates through the same mechanism. Give a title or description as{' '}
            <code>key|fallback</code>; field titles resolve from <code>measure.&lt;name&gt;</code> and{' '}
            <code>dimension.&lt;name&gt;</code>; dimension values from <code>dimension.&lt;name&gt;.&lt;value&gt;</code>.
            Legends, axes, tooltips and table headers all pick these up.
          </p>
          <CodeBlock code={translationsCode} />
          <p>Add a whole new language by supplying the built-in keys alongside your own:</p>
          <CodeBlock code={newLanguageCode} />
        </Section>

        <Section id="components" title="Components">
          <p>Every component is live in the gallery with its props, sample data and copyable code.</p>
          <div className="component-index">
            {chartGroups.map((group) => (
              <div key={group}>
                <h3>{group}</h3>
                <ul>
                  {chartEntries
                    .filter((e) => e.group === group)
                    .map((e) => (
                      <li key={e.id}>
                        <a href={href(`/charts/${e.id}`)}>{e.name}</a>
                        <code>{String(e.exportName)}</code>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      </article>
    </div>
  );
};
