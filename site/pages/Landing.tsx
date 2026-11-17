import { IconArrowDown, IconArrowRight, IconArrowUp } from '@tabler/icons-react';
import { contentTarget } from '../components/DocsLayout';
import { HeroShowcase } from '../components/HeroShowcase';
import { InlineCode } from '../components/InlineCode';
import { InstallCommand } from '../components/InstallCommand';
import { ChartContextBar } from '../components/Switchers';
import { AgentDocs } from '../components/landing/AgentDocs';
import { ChartRange, rangeEntries } from '../components/landing/ChartRange';
import { LiveCard } from '../components/landing/LiveCard';
import { benefits } from '../catalog/benefits';
import { chartEntries } from '../catalog/registry';
import { BRAND } from '../config';

const total = chartEntries.length;

// The landing page: five sections, one job each.
//   1. Hero: what it is, install, a live chart.
//   2. Range: eight components live, under the theme / language / data switcher.
//   3. Done for you: what every component handles, in detail, each item said
//      once and pointing at its proof on this page; then one finished card,
//      live, whose state the visitor can switch.
//   4. Agents: what exists for coding agents and for models.
//   5. Call to action.
// The comparison with a chart library (the table, and the same card as two
// files) is on /docs/why, linked from under the live card.
// One link per destination: the hero's two buttons, the closing quick-start
// button. The guides are linked from the docs, not from the items. The ids
// (#charts, #time-series, #live-card, #states, #clicks) are what the items link to.
// The document title and head tags for "/" come from site/head.ts.
export const Landing = () => {
  return (
    <div className="lp" {...contentTarget}>
      <section className="lp-hero container" aria-labelledby="lp-title">
        <div className="lp-hero__copy">
          <span className="eyebrow">{total} components · MIT licensed</span>
          <h1 id="lp-title">Finished React chart components for teams that already have a data layer.</h1>
          <p className="lede">
            A chart library draws the chart. {BRAND.name} ships the whole card. You bring the rows.
          </p>
          <div className="lp-hero__actions">
            <a className="button button--primary" href="/docs/quick-start">
              Get started
            </a>
            <a className="button" href="/docs/components">
              See the components
            </a>
          </div>
          <div className="lp-hero__install">
            <InstallCommand />
            <p className="muted">Needs react and react-dom 19.1.1 or later.</p>
          </div>
        </div>
        <div className="lp-hero__demo">
          <h2 className="lp-sr">Live example</h2>
          <HeroShowcase />
        </div>
      </section>

      <section id="charts" className="lp-charts" aria-labelledby="lp-charts-title">
        <div className="context-strip lp-strip">
          <div className="container">
            <ChartContextBar compact hint="Change the theme, language or sample data and watch the charts follow." />
          </div>
        </div>
        <div className="container lp-section lp-section--after-strip">
          <div className="lp-head">
            <h2 id="lp-charts-title">Charts, KPIs and tables</h2>
            <p>
              {rangeEntries.length} of the {total} components, live. Hover one, or open its menu to export CSV, Excel
              or PNG.
            </p>
          </div>
          <ChartRange />
        </div>
      </section>

      <section className="container lp-section" aria-labelledby="lp-done-title">
        <div className="lp-head">
          <h2 id="lp-done-title">Done for you in every component</h2>
          <p>
            Every card handles loading, errors, formatting, export and theming the same way, so nothing has to be
            built or reviewed around it.
          </p>
        </div>
        <ul className="lp-benefits">
          {benefits.map(({ title, text, proof, icon: Icon }) => {
            const Arrow = proof.direction === 'above' ? IconArrowUp : IconArrowDown;
            return (
              <li key={title} className="lp-benefit">
                <span className="lp-benefit__icon">
                  <Icon size={18} stroke={1.75} aria-hidden />
                </span>
                <div className="lp-benefit__body">
                  <h3>{title}</h3>
                  <p>
                    <InlineCode>{text}</InlineCode>
                  </p>
                  <a className="lp-benefit__proof" href={proof.href}>
                    {proof.label} <Arrow size={14} aria-hidden />
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
        <h3 id="lp-live-title" className="lp-live-title">
          One finished card
        </h3>
        <LiveCard />
        <p className="lp-more">
          Add another card and it has all of this too, so the tenth is as finished as the first.{' '}
          <a className="text-link" href="/docs/why#when-it-pays-off">
            When that pays off <IconArrowRight size={15} aria-hidden />
          </a>
        </p>
      </section>

      <section className="container lp-section" aria-labelledby="lp-agents-title">
        <div className="lp-head">
          <h2 id="lp-agents-title">Built for coding agents and AI chat</h2>
        </div>
        <AgentDocs />
      </section>

      <section className="container lp-section lp-section--last" aria-labelledby="lp-cta-title">
        <div className="lp-cta">
          <h2 id="lp-cta-title">Render your first chart</h2>
          <p>Install the package, add the provider, pass your rows.</p>
          <a className="button lp-cta__button" href="/docs/quick-start">
            Read the quick start
          </a>
        </div>
      </section>
    </div>
  );
};
