import { ChatDemo } from '../components/ChatDemo';
import { CodeBlock } from '../components/CodeBlock';
import { DemoDashboard } from '../components/DemoDashboard';
import { SpecPlayground } from '../components/SpecPlayground';
import { ChartContextBar } from '../components/Switchers';
import { datasets } from '../catalog/datasets';
import { BRAND } from '../config';
import { href } from '../router';
import { useCanvas, useSiteSettings } from '../state';

const examples = [
  {
    id: 'dashboard',
    path: '/examples',
    label: 'Analytics dashboard',
    blurb: 'Five components cross-filtered by one click, with a granularity switcher and a paginated table.',
  },
  {
    id: 'ai-chat',
    path: '/examples/ai-chat',
    label: 'AI chat assistant',
    blurb: 'A model answers with chart specs; clicks on a chart become the next message.',
  },
] as const;

export type ExampleId = (typeof examples)[number]['id'];

export const isExampleId = (id: string | undefined): id is ExampleId => examples.some((e) => e.id === id);

// The standalone version of DemoDashboard.tsx: same components, same state,
// same wiring, with the site's sample datasets replaced by "your data layer".
// Keep the two in step.
const dashboardSource = `import { useState } from 'react';
import {
  BarChart, ChartsProvider, DonutChart,
  KpiNumberComparison, KpiNumber,
  LineChart, TablePaginated,
  dimension, measure, results,
} from '${BRAND.packageName}';
import type { Granularity } from '${BRAND.packageName}';

const region = dimension({ name: 'region', title: 'Region' });
const plan = dimension({ name: 'plan', title: 'Plan' });
const revenue = measure({ name: 'revenue', title: 'Revenue', inputs: { prefix: '$' } });
const customers = measure({ name: 'customers', title: 'Customers' });

// The windows behind the KPI's current and comparison rows.
const currentRange = { from: new Date('2026-06-01'), to: new Date('2026-06-30'), relativeTimeString: undefined };
const previousRange = { from: new Date('2026-05-02'), to: new Date('2026-05-31'), relativeTimeString: undefined };

export function Dashboard() {
  // Three pieces of state drive the whole page.
  const [granularity, setGranularity] = useState<Granularity>('month');
  const [planFilter, setPlanFilter] = useState<string | null>(null);
  const [state, setState] = useState({ page: 0, isLoadingDownloadData: false });

  const startedAt = dimension({
    name: 'subscriptions.started_at', title: 'Start date', type: 'time',
    granularity, inputs: { showGranularityDropdown: true },
  });

  // Your data layer: re-query whenever the filter, granularity or page changes.
  // kpis: { current: Row, previous: Row, year: Row }  e.g. { revenue: 118200 }
  // trendRows: [{ 'subscriptions.started_at': '2026-06-01T00:00:00.000', revenue: 128400 }, …]
  // regionRows: [{ region: 'Europe', revenue: 391500 }, …]
  // planRows: [{ plan: 'Growth', revenue: 612300 }, …]  (unfiltered: the donut is the filter)
  const { kpis, trendRows, regionRows, planRows, pageRows, total } = useDashboardRows({
    planFilter, granularity,
    page: state.page, pageSize: state.pageSize, sort: state.sort,
  });

  return (
    <ChartsProvider>
      <KpiNumberComparison
        title="Revenue · Last 30 days"
        measure={revenue}
        results={results([kpis.current])}
        resultsComparison={results([kpis.previous])}
        comparisonPeriod="Previous period"
        primaryDateRange={currentRange}
        comparisonDateRange={previousRange}
        displayChangeAsPercentage
      />
      <KpiNumber title="Revenue · Last 12 months" measure={revenue} results={results([kpis.year])} />
      <DonutChart
        title="Share by plan"
        description="Click a segment to filter the whole dashboard"
        dimension={plan}
        measure={revenue}
        results={results(planRows)}
        showLegend
        showTooltips
        onSegmentClick={({ dimensionValue }) =>
          dimensionValue && setPlanFilter((f) => (f === dimensionValue ? null : dimensionValue))
        }
      />
      <LineChart
        title="Revenue · Trend"
        xAxis={startedAt}
        measures={[revenue]}
        results={results(trendRows)}
        granularity={granularity}
        setGranularity={setGranularity}
        showTooltips
      />
      <BarChart
        title="Revenue · By category"
        dimension={region}
        measures={[revenue]}
        results={results(regionRows)}
        showTooltips
      />
      <TablePaginated
        title="Revenue · Breakdown"
        dimensionsAndMeasures={[region, plan, revenue, customers]}
        results={results(pageRows)}
        totalResults={{ isLoading: false, total }}
        state={state}
        setState={setState}
      />
    </ChartsProvider>
  );
}`;

const dashboardWiring = [
  {
    title: 'One filter, five components',
    body: 'The donut’s onSegmentClick payload carries the clicked dimension value. Storing it in useState and re-querying is the whole cross-filtering implementation.',
  },
  {
    title: 'Granularity is just state',
    body: 'The line chart’s built-in switcher calls setGranularity; the query re-runs and every time bucket, label and tooltip follows. Clicking the same slice again clears the filter.',
  },
  {
    title: 'The table is controlled',
    body: 'Paging and sorting live in your state, so the table works against a real paginated API: fetch one sorted page at a time and pass the total.',
  },
  {
    title: 'Everything else is the library',
    body: 'Currency formatting, loading and empty states, CSV, XLSX and PNG export in every card menu, theming and translation all come from the components and one provider.',
  },
];

const DashboardExample = () => {
  const canvas = useCanvas();
  const { datasetId } = useSiteSettings();

  return (
    <>
      <div className="container showcase__body">
        <div className={`app-window${canvas.dark ? ' is-dark' : ''}`}>
          <div className="app-window__bar">
            <span className="app-window__dots" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            <span className="app-window__title">your-app.com · {datasets[datasetId].label.toLowerCase()}</span>
          </div>
          <div
            className={`app-window__canvas demo-app__canvas${canvas.dark ? ' is-dark' : ''}`}
            style={{ background: canvas.background }}
          >
            <DemoDashboard />
          </div>
        </div>
      </div>

      <section className="section container">
        <div className="section__head">
          <h2>How it’s wired</h2>
          <p>Everything app-specific fits in one file; everything hard ships with the components.</p>
        </div>
        <div className="feature-grid">
          {dashboardWiring.map((f) => (
            <article key={f.title} className="feature">
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section container">
        <div className="section__head">
          <h2>The source</h2>
          <p>
            The dashboard above, as you would write it: your data hook returns the rows, the components do the rest.
            Layout is an ordinary CSS grid, so it isn’t shown. Every chart’s props are adjustable in the{' '}
            <a href={href('/charts')}>gallery</a> and explained in the <a href={href('/docs')}>docs</a>.
          </p>
        </div>
        <CodeBlock code={dashboardSource} label="Dashboard.tsx" />
      </section>
    </>
  );
};

const ChatExample = () => (
  <>
    <section className="section section--first container">
      <div className="section__head">
        <h2>A conversation, not a screenshot</h2>
        <p>
          A mock chat with no model behind it. Click a slice of the donut and watch the click become the next message,
          then the next chart.
        </p>
      </div>
      <ChatDemo />
    </section>

    <section className="section container">
      <div className="section__head">
        <h2>Try your own spec</h2>
        <p>
          Paste whatever a model might send. Valid specs render with the real components; wrong ones still render
          something visible. The quickest way to test your prompts: copy the tool input from your logs and drop it in.
          Setting up the tool and the system prompt is covered in the{' '}
          <a href={href('/docs')}>docs</a>.
        </p>
      </div>
      <SpecPlayground />
    </section>
  </>
);

export const Examples = ({ example }: { example: ExampleId }) => {
  return (
    <div className="page">
      <div className="container page__head">
        <h1>Examples</h1>
        <p className="lede">
          Two complete apps built on the same components: a dashboard your users explore, and an AI assistant that
          answers in charts.
        </p>
        <nav className="example-tabs" aria-label="Examples">
          {examples.map((e) => (
            <a
              key={e.id}
              href={href(e.path)}
              className={e.id === example ? 'is-active' : ''}
              aria-current={e.id === example ? 'page' : undefined}
            >
              <strong>{e.label}</strong>
              <span>{e.blurb}</span>
            </a>
          ))}
        </nav>
      </div>
      <div className="context-strip">
        <div className="container">
          <ChartContextBar hint="This example follows the site-wide theme, language and data." />
        </div>
      </div>
      {example === 'dashboard' ? <DashboardExample /> : <ChatExample />}
    </div>
  );
};
