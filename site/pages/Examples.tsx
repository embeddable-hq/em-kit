import { ChatDemo } from '../components/ChatDemo';
import { CodeBlock } from '../components/CodeBlock';
import { DemoDashboard } from '../components/DemoDashboard';
import { SpecPlayground } from '../components/SpecPlayground';
import { Breadcrumb, contentTarget } from '../components/DocsLayout';
import { ChartContextBar } from '../components/Switchers';
import { datasets } from '../catalog/datasets';
import { BRAND } from '../config';
import { dashboardSource } from '../content/exampleSources';
import { href, useDocumentTitle } from '../router';
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
// same wiring, with the site's sample datasets replaced by a small in-file
// data layer. It is a real module (site/examples/Dashboard.tsx), so it is
// type-checked and rendered by the tests. Keep the two in step. The source
// printed below is dashboardSource, which the Markdown twin shares.

const dashboardWiring = [
  {
    title: 'One filter, five components',
    body: 'The donut’s onSegmentClick payload carries the clicked dimension value. Storing it in useState and re-querying is the whole cross-filtering implementation. Clicking the same slice again clears the filter.',
  },
  {
    title: 'Granularity is just state',
    body: 'The line chart’s built-in switcher calls setGranularity; the query re-runs and every time bucket, label and tooltip follows.',
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
        <h2 className="sr-only">The running dashboard</h2>
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
            The dashboard above as one file that runs as pasted. A stand-in data layer at the top takes the place
            of your API: swap its rows and queries for your own. Try any chart’s props in its playground, from the{' '}
            <a href={href('/docs/components')}>components</a> pages.
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
          <a href={href('/docs/charts-from-a-model')}>charts from a model</a> guide.
        </p>
      </div>
      <SpecPlayground />
    </section>
  </>
);

export const Examples = ({ example }: { example: ExampleId }) => {
  useDocumentTitle(example === 'dashboard' ? 'Dashboard example' : 'AI chat example', BRAND.name);
  return (
    <div className="page" {...contentTarget}>
      <div className="container page__head">
        <Breadcrumb items={[{ label: 'Examples', href: href('/examples') }, { label: examples.find((e) => e.id === example)!.label }]} />
        <h1>{examples.find((e) => e.id === example)!.label}</h1>
        <nav className="example-tabs" aria-label="Examples">
          {examples.map((e) => (
            <a
              key={e.id}
              href={href(e.path)}
              className={e.id === example ? 'is-active' : ''}
              aria-current={e.id === example ? 'page' : undefined}
            >
              <strong>{e.label}</strong>
              {/* Each card describes its example: the selected one is this page's introduction. */}
              <span>{e.blurb}</span>
            </a>
          ))}
        </nav>
      </div>
      <div className="context-strip">
        <div className="container">
          <ChartContextBar compact hint="This example follows the site-wide theme, language and data." />
        </div>
      </div>
      {example === 'dashboard' ? <DashboardExample /> : <ChatExample />}
    </div>
  );
};
