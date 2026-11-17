import { ThemeStyles } from './generated/theme/styles/styles.types';

// EmKit's own look, layered over the upstream theme: a white card with a
// hairline border, a faint grid and rounder bars. The colours are upstream's
// (the "Default" palette on embeddable.com), so nothing here sets them. It
// lives here, outside the generated sources, so a sync from upstream cannot
// undo it, and a `theme.styles` passed to ChartsProvider still overrides any of it.

// Charts draw their text on a canvas, which cannot wait for a web font the way
// HTML text does. Upstream names Inter alone, so a chart drawn before the font
// arrives (or when it never does) would use the browser's serif. With the
// stack it uses the system font instead.
export const fontStack = "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";

export const defaultStyles: Partial<ThemeStyles> = {
  '--em-core-font-family--base': fontStack,
  '--em-sem-background': '#ffffff',
  // 4.6:1 on the success background; upstream's green is 3.3:1.
  '--em-sem-status-success-text': '#0a7a48',
  '--em-card-border-radius': '0.75rem',
  '--em-card-border-width': '0.0625rem',
  '--em-card-border-color': '#e4e4e7',
  '--em-card-title-font-weight': '600',
  '--em-barchart-border-radius': '0.5rem',
  '--em-chart-grid-line-color--light': '#f4f4f5',
  // Axis labels: 4.8:1 on white.
  '--em-chart-grid-label-color': '#71717a',
  '--em-chart-grid-label-color--muted': '#71717a',
  // KPI tabs: an inactive tab was faded to half opacity (3.2:1 text, 2.0:1 on
  // its change badge). Full opacity, with the theme's muted text for the label
  // (so a dark theme's muted colour applies); the active tab keeps its border.
  '--em-charttabs-item-opacity': '1',
  '--em-charttabs-item-label-color': 'var(--em-sem-text--muted)',
  // Upstream's hover background for a tab is a fixed light grey, which on a
  // dark theme put white text on a near-white tab. The theme's light
  // background follows whatever theme is set.
  '--em-charttabs-item-background--hover': 'var(--em-sem-background--light)',
  // The KPI number sizes itself to its box, which in a tall card means very
  // large: cap it at a headline size.
  '--em-kpichart-number-font-size--max': '3.5rem',
};

// Chart.js options per chart type, merged after each component's own (so they
// win over the component, and a `theme.charts` passed to ChartsProvider wins
// over them). Two defaults the upstream charts lack:
// - At most six ticks on a value axis, so a short card is not ruled every few
//   pixels (the combo chart drew eight).
// - No legend when it would have one entry: a single series is named by the
//   chart's title and tooltip, and a one-swatch legend only takes space. Pies,
//   donuts and funnels keep theirs, where each entry is a slice.
type Options = { options: Record<string, unknown> };

// Every axis and every chart gets objects of its own. The components merge
// these with mergician, which treats one object reached twice as the same
// thing: an axis object shared by x and y made a scatter chart's y-axis take
// its x-axis's title, range and format.
const fewTicks = () => ({ ticks: { maxTicksLimit: 6 } });
// Axes where dropping every other label loses nothing: dates in sequence, and
// a value scale. They skip labels instead of tilting them. Category axes
// (regions, plans) keep every label, tilted if they must.
const flat = () => ({ ticks: { maxRotation: 0, autoSkip: true } });
const fewFlatTicks = () => ({ ticks: { maxTicksLimit: 6, maxRotation: 0, autoSkip: true } });
const legendOnlyForSeveral = () => ({
  legend: { labels: { filter: (_item: unknown, data: { datasets: unknown[] }) => data.datasets.length > 1 } },
});
const vertical = (): Options => ({ options: { scales: { y: fewTicks() }, plugins: legendOnlyForSeveral() } });
const overTime = (): Options => ({ options: { scales: { x: flat(), y: fewTicks() }, plugins: legendOnlyForSeveral() } });
const horizontal = (): Options => ({ options: { scales: { x: fewFlatTicks() }, plugins: legendOnlyForSeveral() } });
const both = (): Options => ({ options: { scales: { x: fewTicks(), y: fewTicks() }, plugins: legendOnlyForSeveral() } });

export const defaultChartOptions = {
  barChartDefaultPro: vertical(),
  barChartGroupedPro: vertical(),
  barChartStackedPro: vertical(),
  barChartDefaultHorizontalPro: horizontal(),
  barChartGroupedHorizontalPro: horizontal(),
  barChartStackedHorizontalPro: horizontal(),
  lineChartDefaultPro: overTime(),
  lineChartGroupedPro: overTime(),
  lineChartComparisonDefaultPro: overTime(),
  areaChartPro: overTime(),
  // Only the left axis: the right one (y1) is built by the component when a
  // measure asks for it, and an override here would create it on the left.
  barLineChartPro: vertical(),
  scatterChartPro: both(),
  bubbleChartPro: both(),
};
