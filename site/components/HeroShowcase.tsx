import type { Scale } from 'chart.js';
import { useEffect, useMemo, useState } from 'react';
import {
  BarChartStacked,
  ChartFromSpec,
  ChartsProvider,
  KpiNumberComparison,
  KpiNumber,
  dimension,
  intentToPrompt,
  results,
} from '../../src';
import type { ChartSpec } from '../../src';
import { Dataset, datasets } from '../catalog/datasets';
import { buildTheme, getThemePreset, languages } from '../catalog/themes';
import { heroKey } from '../catalog/translations';
import { href } from '../router';
import { useCanvas, useSiteSettings } from '../state';
import { LiveSeries, useLiveSeries } from './useLiveSeries';

const OPEN_RANGE = { from: undefined, to: undefined, relativeTimeString: undefined };

// The home page's one visual: the same components on the two surfaces the
// library is for, fed by the same live series. The dashboard plots it; the
// chat answers a question about it. Full versions live on the Examples page.
export const HeroShowcase = () => {
  const { themeId, languageId, datasetId } = useSiteSettings();
  const canvas = useCanvas();
  const ds = datasets[datasetId];
  const preset = getThemePreset(themeId);
  const live = useLiveSeries(ds);

  // Scoped to the hero: stack colours from one hue, slimmer rounded bars. The
  // colour map also reaches the chat's donut, so a plan is the same colour on
  // both surfaces.
  const theme = useMemo(() => {
    const base = buildTheme(themeId, languageId);
    const locale = languages.find((l) => l.id === languageId)?.locale ?? 'en-US';
    const hourFormat = new Intl.DateTimeFormat(locale, { hour: 'numeric' });
    const dimensionValue = Object.fromEntries(
      live.groups.map((g, i) => [`${ds.specs.group.name}.${g}`, preset.ramp[i % 3]!]),
    );
    return {
      ...base,
      charts: {
        backgroundColorMap: { dimensionValue },
        barChartStackedPro: {
          options: {
            datasets: { bar: { borderRadius: 3, barPercentage: 0.82, categoryPercentage: 0.92 } },
            animation: { duration: 350 },
            scales: {
              x: {
                ticks: {
                  maxRotation: 0,
                  autoSkip: true,
                  maxTicksLimit: 8,
                  // Hour only ("3 PM" / "15 Uhr") rather than the full date on every tick.
                  callback(this: Scale, value: string | number) {
                    const date = new Date(this.getLabelForValue(Number(value)));
                    return Number.isNaN(date.getTime()) ? '' : hourFormat.format(date);
                  },
                },
              },
            },
          },
        },
      },
    };
  }, [themeId, languageId, live.groups, preset, ds]);

  const dark = canvas.dark ? ' is-dark' : '';

  return (
    <ChartsProvider theme={theme}>
      <div className="surfaces">
        <figure className="surface">
          <figcaption className="surface__caption">
            <strong>In your dashboard</strong>
            <a href={href('/examples')}>Dashboard example →</a>
          </figcaption>
          <div className={`app-window surface__frame${dark}`}>
            <div className="app-window__bar">
              <span className="app-window__dots" aria-hidden>
                <i />
                <i />
                <i />
              </span>
              <span className="app-window__title">your-app.com · {ds.label.toLowerCase()}</span>
              <span className="app-window__live">
                <span className="app-window__pulse" aria-hidden />
                live
              </span>
            </div>
            <div className="app-window__canvas surface__canvas" style={{ background: canvas.background }}>
              <LiveDashboard ds={ds} live={live} />
            </div>
          </div>
        </figure>

        <figure className="surface">
          <figcaption className="surface__caption">
            <strong>In your AI chat</strong>
            <a href={href('/examples/ai-chat')}>AI chat example →</a>
          </figcaption>
          <LiveChat ds={ds} live={live} background={canvas.background} dark={canvas.dark} />
        </figure>
      </div>
    </ChartsProvider>
  );
};

const LiveDashboard = ({ ds, live }: { ds: Dataset; live: LiveSeries }) => {
  const time = useMemo(
    () => dimension({ name: ds.specs.time.name, title: 'Hour', type: 'time', granularity: 'hour' }),
    [ds],
  );
  const { primary, group } = ds;

  return (
    <div className="hero-dash">
      <div className="hero-dash__kpi">
        <KpiNumberComparison
          title={heroKey(ds, 'last24')}
          measure={primary}
          results={results([{ [primary.name]: live.last24 }])}
          resultsComparison={results([{ [primary.name]: live.previous24 }])}
          comparisonPeriod="Previous period"
          primaryDateRange={OPEN_RANGE}
          comparisonDateRange={OPEN_RANGE}
          displayChangeAsPercentage
        />
      </div>
      <div className="hero-dash__kpi">
        <KpiNumber title={heroKey(ds, 'thisHour')} measure={primary} results={results([{ [primary.name]: live.thisHour }])} />
      </div>
      <div className="hero-dash__main">
        <BarChartStacked
          title={heroKey(ds, 'main')}
          description={heroKey(ds, 'mainDescription')}
          xAxis={time}
          groupBy={group}
          measure={primary}
          results={results(live.rows)}
          showLegend
          showTooltips
        />
      </div>
    </div>
  );
};

type LiveChatProps = { ds: Dataset; live: LiveSeries; background: string; dark: boolean };

const LiveChat = ({ ds, live, background, dark }: LiveChatProps) => {
  const [followUp, setFollowUp] = useState<string | null>(null);
  useEffect(() => setFollowUp(null), [ds]);

  const groupKey = ds.specs.group.name;
  const valueKey = ds.specs.primary.name;
  const groupTitle = ds.group.title.toLowerCase();
  const leader = [...live.byGroup].sort((a, b) => Number(b[valueKey] ?? 0) - Number(a[valueKey] ?? 0))[0]?.[groupKey];

  const spec: ChartSpec = {
    chart: 'donut',
    title: `${ds.primary.title} by ${groupTitle}, last 24 hours`,
    dimension: { name: groupKey, title: ds.group.title },
    measure: { name: valueKey, title: ds.primary.title, format: ds.primary.inputs },
    rows: live.byGroup,
    options: { showLegend: true, showTooltips: true },
  };

  return (
    <div className={`ai-chat surface__frame surface__chat${dark ? ' is-dark' : ''}`} style={{ background }}>
      <div className="ai-chat__head">
        <span className="ai-chat__avatar" aria-hidden />
        <div className="ai-chat__who">
          <strong>Analytics assistant</strong>
          <span>Answers with live charts</span>
        </div>
      </div>
      <div className="ai-chat__thread surface__thread" role="log" aria-label="Example chat">
        <div className="ai-msg ai-msg--user">
          <div className="ai-bubble">
            <p>
              Which {groupTitle} is driving {ds.primary.title.toLowerCase()} today?
            </p>
          </div>
        </div>
        <div className="ai-msg ai-msg--assistant">
          <div className="ai-bubble surface__answer">
            <p>
              {leader ? `${String(leader)} leads over the last 24 hours. ` : ''}Click a slice to dig in.
            </p>
            <div className="surface__answer-chart">
              <ChartFromSpec
                spec={spec}
                chrome="bare"
                height={230}
                onIntent={(intent) => setFollowUp(intentToPrompt(intent))}
              />
            </div>
          </div>
        </div>
        {followUp && (
          <div className="ai-msg ai-msg--user">
            <div className="ai-bubble">
              <p>{followUp}</p>
            </div>
            <span className="ai-msg__meta">Sent by your app from the click</span>
          </div>
        )}
      </div>
      <div className="ai-chat__composer" aria-hidden>
        <span>Ask about your data…</span>
      </div>
    </div>
  );
};
