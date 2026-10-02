import { CodeBlock } from '../components/CodeBlock';
import { LiveChart } from '../components/LiveChart';
import { HeroDashboard } from '../components/HeroDashboard';
import { ChartContextBar } from '../components/Switchers';
import { datasets } from '../catalog/datasets';
import { chartEntries, getEntry } from '../catalog/registry';
import { BRAND } from '../config';
import { href } from '../router';
import { useCanvas, useSiteSettings } from '../state';

const features = [
  {
    title: 'Bring your own data',
    body: 'Pass rows from any API, warehouse or cache. No query engine, no server, no lock-in. The components only render.',
  },
  {
    title: 'Formatting and localisation',
    body: 'Locale-aware numbers, currencies and dates, prefixes and suffixes, English, German and French UI text, and your own titles and values translated the same way.',
  },
  {
    title: 'Themeable to the pixel',
    body: 'Over 700 CSS design tokens. One theme object restyles every chart, from the palette to card corners.',
  },
  {
    title: 'Time series done properly',
    body: 'Missing periods are filled, a granularity switcher is built in, and date handling is timezone-aware.',
  },
  {
    title: 'Every state designed',
    body: 'Loading skeletons, empty results and error messages come styled and consistent, with no extra code.',
  },
  {
    title: 'Chart chrome included',
    body: 'Titles, descriptions, tooltips, click events with typed payloads, and CSV, XLSX and PNG export from every chart.',
  },
];

const longTail = [
  'Null and missing values',
  'Gaps in time series',
  'Locale-aware number and date formats',
  'Stable colours for the same value across charts',
  'Legends that overflow',
  'Axis labels that collide',
  'Loading, empty and error states',
  'CSV, Excel and image export',
  'Resizing to any container',
  'Click payloads you can act on',
];

const installCode = `npm install ${BRAND.packageName}`;

const providerCode = `import { ChartsProvider } from '${BRAND.packageName}';

export function App() {
  return (
    <ChartsProvider>
      <Dashboard />
    </ChartsProvider>
  );
}`;

const chartCode = `import { BarChartDefaultPro, dimension, measure, results } from '${BRAND.packageName}';

const region = dimension({ name: 'region', title: 'Region' });
const revenue = measure({ name: 'revenue', title: 'Revenue', inputs: { prefix: '$' } });

// rows: [{ region: 'Europe', revenue: 391500 }, …] from your own data layer
export function RevenueByRegion({ rows }) {
  return (
    <BarChartDefaultPro
      title="Revenue by region"
      dimension={region}
      measures={[revenue]}
      results={results(rows)}
      showTooltips
    />
  );
}`;

const teaser = ['line-grouped', 'bar-stacked', 'donut-label', 'bubble', 'heatmap', 'kpi-comparison'];

export const Landing = () => {
  const canvas = useCanvas();
  const { datasetId } = useSiteSettings();

  return (
    <>
      <section className="hero container">
        <div className="hero__copy">
          <span className="eyebrow">Open source · MIT · React</span>
          <h1>Charts your users will trust, on data you already have.</h1>
          <p className="lede">
            {chartEntries.length} production-ready chart components with theming, localisation, formatting, loading
            states and export built in. You bring the rows; {BRAND.name} does the rest.
          </p>
          <div className="hero__actions">
            <a className="button button--primary" href={href('/docs')}>
              Get started
            </a>
            <a className="button" href={href('/charts')}>
              Browse charts
            </a>
          </div>
          <div className="hero__install">
            <CodeBlock code={installCode} label="bash" compact />
          </div>
        </div>
      </section>

      <section className="showcase">
        <div className="context-strip">
          <div className="container">
            <ChartContextBar hint="Every chart below is live. See them in another theme, language or dataset." />
          </div>
        </div>
        <div className="container showcase__body">
          <div className={`app-window${canvas.dark ? ' is-dark' : ''}`}>
            <div className="app-window__bar">
              <span className="app-window__dots" aria-hidden>
                <i />
                <i />
                <i />
              </span>
              <span className="app-window__title">your-app.com · {datasets[datasetId].label.toLowerCase()}</span>
              <span className="app-window__live">
                <span className="app-window__pulse" aria-hidden />
                live
              </span>
            </div>
            <div className="app-window__canvas" style={{ background: canvas.background }}>
              <HeroDashboard />
            </div>
          </div>
        </div>
      </section>

      <section className="section container">
        <div className="section__head">
          <h2>Everything a chart needs, already done</h2>
          <p>The long tail of production charting ships in the box, consistent across every component.</p>
        </div>
        <div className="feature-grid">
          {features.map((f) => (
            <article key={f.title} className="feature">
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section section--tinted">
        <div className="container split">
          <div>
            <h2>Charts look easy until they aren’t</h2>
            <p>
              Rendering a bar is an afternoon. Shipping charts people rely on means handling everything on the right,
              for every chart type, in every locale, and keeping it consistent as you grow. That work is already done
              here and hardened in production dashboards.
            </p>
            <a className="button" href={href('/charts')}>
              See it in the gallery
            </a>
          </div>
          <ul className="checklist">
            {longTail.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section container">
        <div className="section__head">
          <h2>Three steps to your first chart</h2>
          <p>No backend changes. Keep your API, your warehouse and your caching exactly as they are.</p>
        </div>
        <ol className="steps">
          <li className="step">
            <div className="step__text">
              <span className="step__num">1</span>
              <h3>Install the package</h3>
              <p>React 19 is the only peer dependency. Chart.js and everything else install with it.</p>
            </div>
            <CodeBlock code={installCode} label="bash" compact />
          </li>
          <li className="step">
            <div className="step__text">
              <span className="step__num">2</span>
              <h3>Wrap your app once</h3>
              <p>The provider applies your theme, language and timezone to every chart inside it.</p>
            </div>
            <CodeBlock code={providerCode} />
          </li>
          <li className="step">
            <div className="step__text">
              <span className="step__num">3</span>
              <h3>Describe your fields and pass your rows</h3>
              <p>
                Tell a chart which keys are dimensions and which are measures, then hand it the rows from your own
                query. Formatting, colours and states follow automatically.
              </p>
              <a className="text-link" href={href('/docs')}>
                Read the data contract →
              </a>
            </div>
            <CodeBlock code={chartCode} />
          </li>
        </ol>
      </section>

      <section className="section container">
        <div className="section__head section__head--row">
          <div>
            <h2>{chartEntries.length} charts and counting</h2>
            <p>Bars, lines, areas, pies, scatter, KPIs, tables, pivots and heat maps.</p>
          </div>
          <a className="button" href={href('/charts')}>
            Open the gallery
          </a>
        </div>
        <div className={`teaser-grid${canvas.dark ? ' is-dark' : ''}`}>
          {teaser.map((id) => {
            const entry = getEntry(id)!;
            return (
              <div key={id} className="teaser" style={{ background: canvas.background }}>
                <LiveChart entry={entry} height={320} overrides={{ toggles: { hideMenu: true } }} />
                <a className="teaser__name" href={href(`/charts/${id}`)}>
                  {entry.name} →
                </a>
              </div>
            );
          })}
        </div>
      </section>

      <section className="section container">
        <div className="cta">
          <h2>Ship your first chart in five minutes</h2>
          <p>Install, wrap, pass rows. Copy any example from the gallery and it runs as-is.</p>
          <div className="hero__actions">
            <a className="button button--primary" href={href('/docs')}>
              Read the docs
            </a>
            <a className="button" href={href('/charts')}>
              Browse charts
            </a>
          </div>
        </div>
      </section>
    </>
  );
};
