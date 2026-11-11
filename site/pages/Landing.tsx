import { IconCheck } from "@tabler/icons-react";
import { CodeBlock } from "../components/CodeBlock";
import { RawVsKit } from "./DocPage";
import { HeroShowcase } from "../components/HeroShowcase";
import { ChartContextBar } from "../components/Switchers";
import { aiLandingCode } from "../catalog/aiSnippets";
import { benefitGroups } from "../catalog/benefits";
import { chartEntries } from "../catalog/registry";
import { BRAND } from "../config";
import { href, useDocumentTitle } from "../router";

const Checklist = ({ points }: { points: string[] }) => (
  <ul className="benefit__points">
    {points.map((point) => (
      <li key={point}>
        <IconCheck size={16} stroke={2.5} aria-hidden />
        {point}
      </li>
    ))}
  </ul>
);

const installCode = `npm install ${BRAND.packageName}`;

const dashboardCode = `import { BarChart, dimension, measure, results } from '${BRAND.packageName}';

const region = dimension({ name: 'region', title: 'Region' });
const revenue = measure({ name: 'revenue', title: 'Revenue', inputs: { prefix: '$' } });

// rows: [{ region: 'Europe', revenue: 391500 }, …] from your own data layer
<BarChart
  title="Revenue by region"
  dimension={region}
  measures={[revenue]}
  results={results(rows)}
  onBarClicked={({ dimensionValue }) => setRegion(dimensionValue)}
/>`;

const waysIn = [
  {
    title: "In a dashboard: one component per chart",
    caption: "A complete chart: its fields, your rows and a click handler.",
    code: dashboardCode,
    link: { label: "See the dashboard example", path: "/examples" },
  },
  {
    title: "In AI chat: one tool call per chart",
    caption:
      "What the model sends back, and the one component that renders it.",
    code: aiLandingCode,
    link: { label: "See the AI chat example", path: "/examples/ai-chat" },
  },
];

export const Landing = () => {
  useDocumentTitle(undefined, BRAND.name);
  return (
    <>
      <section className="hero container">
        <div className="hero__copy">
          <span className="eyebrow">Open source · MIT · React</span>
          <h1>Charts your users will trust, on data you already have.</h1>
          <p className="lede">
            {chartEntries.length} finished chart components for dashboards and
            AI chat. Not just the drawing: formatting, colours, time series,
            states, export and translations are done. You bring the rows.
          </p>
          <div className="hero__actions">
            <a
              className="button button--primary"
              href={href("/docs/quick-start")}
            >
              Get started
            </a>
            <a className="button" href={href("/docs/components")}>
              Browse components
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
            <ChartContextBar hint="Both surfaces are live. See them in another theme, language or dataset." />
          </div>
        </div>
        <div className="container showcase__body">
          <HeroShowcase />
        </div>
      </section>

      <section className="section container">
        <div className="section__head">
          <h2>Everything a chart needs, already done</h2>
          <p>
            The long tail of production charting ships in the box, consistent
            across every component.
          </p>
        </div>
        <div className="benefit-grid">
          {benefitGroups.map(({ title, lead, icon: Icon, points, wide }) => (
            <article
              key={title}
              className={`benefit${wide ? " benefit--wide" : ""}`}
            >
              <span className="benefit__icon">
                <Icon size={20} stroke={1.75} aria-hidden />
              </span>
              <h3>{title}</h3>
              <p>{lead}</p>
              <Checklist points={points} />
            </article>
          ))}
        </div>
      </section>

      <section className="section section--tinted">
        <div className="container">
          <div className="section__head">
            <h2>Skip the code a chart library leaves to you</h2>
            <p>
              The same production card twice. A chart library draws the bars;
              everything around them is yours to write, for every chart. Here
              it&rsquo;s already done.
            </p>
          </div>
          <RawVsKit />
          <p className="section__more">
            <a className="text-link" href="/docs/why">
              See everything you&rsquo;d otherwise build →
            </a>
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section__head">
            <h2>Same components, two ways in</h2>
            <p>
              Whether your code places the chart or a model chooses it, it
              renders the same themed, localised card.
            </p>
          </div>
          <div className="ways-in">
            {waysIn.map((way) => (
              <article key={way.title} className="ways-in__item">
                <h3>{way.title}</h3>
                <p>{way.caption}</p>
                <CodeBlock code={way.code} />
                <a className="text-link" href={href(way.link.path)}>
                  {way.link.label} →
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section container">
        <div className="cta">
          <h2>Ship your first chart in five minutes</h2>
          <p>
            Install, wrap your app in the provider, pass rows. Every example in
            the gallery runs as-is.
          </p>
          <div className="hero__actions">
            <a
              className="button button--primary"
              href={href("/docs/quick-start")}
            >
              Read the quick start
            </a>
            <a className="button" href={href("/docs/components")}>
              Browse components
            </a>
            <a className="button" href={href("/examples")}>
              See the examples
            </a>
          </div>
        </div>
      </section>
    </>
  );
};
