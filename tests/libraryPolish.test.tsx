import fs from 'node:fs';
import path from 'node:path';
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Chart, type Scale } from 'chart.js';
import chroma from 'chroma-js';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  BarChart,
  ChartsProvider,
  DonutChart,
  FunnelChart,
  HeatMap,
  KpiNumber,
  LineChart,
  dimension,
  measure,
  results,
  type Theme,
} from '../src';
import { defaultStyles } from '../src/theme';
import { useTheme } from '../src/runtime/react';
import { i18n, i18nSetup } from '../src/generated/theme/i18n/i18n';
import { getCellColor } from '../src/generated-ui/components/charts/tables/HeatMap/HeatMap.utils';
import { getBarChartOptions } from '../src/generated-ui/components/charts/bars/bars.utils';
import { getDatalabelPercentage } from '../src/generated/components/charts/charts.utils';
import { getPieChartProOptions } from '../src/generated/components/charts/pies/pies.utils';
import { getLineChartProData } from '../src/generated/components/charts/lines/LineChartDefaultPro/LineChartDefaultPro.utils';
import { getLineChartGroupedProData } from '../src/generated/components/charts/lines/LineChartGroupedPro/LineChartGroupedPro.utils';
import { getLineChartComparisonProData } from '../src/generated/components/charts/lines/LineChartComparisonDefaultPro/LineChartComparisonDefaultPro.utils';

// Accessibility and polish fixes carried as contentRewrites in scripts/sync.mjs
// (menu and canvas names, heat map text contrast, KPI markup, axis labels,
// percentages, the comparison label, line clipping) and in src/ (palette,
// translations).

// Node resolves the datalabels plugin's CommonJS build, which brings a second
// copy of chart.js whose element checks fail; bundlers use its ES module build.
vi.mock('chartjs-plugin-datalabels', () => import('chartjs-plugin-datalabels/dist/chartjs-plugin-datalabels.esm.js' as string));

// jsdom has no 2D canvas or ResizeObserver. The canvas context records nothing;
// text is 6px a character. Resize observers are kept so a test can fire them.
const observers: { callback: ResizeObserverCallback; target?: Element }[] = [];
beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver = class {
    private entry: (typeof observers)[number];
    constructor(callback: ResizeObserverCallback) {
      this.entry = { callback };
      observers.push(this.entry);
    }
    observe(target: Element) {
      this.entry.target = target;
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 480 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 320 });
  const gradient = { addColorStop() {} };
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
    const canvas = this;
    const state: Record<string | symbol, unknown> = {};
    return new Proxy(state, {
      get: (target, key) => {
        if (key === 'canvas') return canvas;
        if (key in target) return target[key];
        if (key === 'measureText') return (text: string) => ({ width: text.length * 6 });
        if (key === 'getLineDash') return () => [];
        if (key === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
        if (typeof key === 'string' && /^create\w*(Gradient|Pattern)$/.test(key)) return () => gradient;
        return () => {};
      },
      set: (target, key, value) => {
        target[key] = value;
        return true;
      },
    });
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  observers.length = 0;
  document.body.innerHTML = '';
});

const render = (node: ReactElement, theme?: object) => {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root!.render(<ChartsProvider theme={theme}>{node}</ChartsProvider>));
  return container;
};

/** Elements with this role (explicit, or a <button>) and this accessible name. */
const byRole = (container: Element, role: string, name: string) =>
  [...container.querySelectorAll(role === 'button' ? 'button, [role="button"]' : `[role="${role}"]`)].filter(
    (el) => el.getAttribute('aria-label') === name,
  );

const region = dimension({ name: 'region', title: 'Region' });
const revenue = measure({ name: 'revenue', title: 'Revenue', inputs: { currency: 'USD', decimalPlaces: 0 } });
const byRegion = results([
  { region: 'Europe', revenue: 412000 },
  { region: 'Americas', revenue: 318000 },
]);

describe('accessible names', () => {
  it.each([
    ['en', 'Chart menu: Revenue by region'],
    ['de', 'Diagrammmenü: Revenue by region'],
    ['fr', 'Menu du graphique : Revenue by region'],
  ])('names the card menu button after the title (%s)', (language, name) => {
    const container = render(
      <BarChart title="Revenue by region" dimension={region} measures={[revenue]} results={byRegion} />,
      { i18n: { language } },
    );
    expect(byRole(container, 'button', name)).toHaveLength(1);
    expect([...container.querySelectorAll('button')].filter((b) => !b.getAttribute('aria-label') && !b.textContent?.trim())).toEqual([]);
  });

  it('names the menu button without a title too', () => {
    const container = render(<BarChart dimension={region} measures={[revenue]} results={byRegion} />);
    expect(byRole(container, 'button', 'Chart menu')).toHaveLength(1);
  });

  it('names the canvas after the title and description', () => {
    const container = render(
      <BarChart title="Revenue by region" description="Last 12 months" dimension={region} measures={[revenue]} results={byRegion} />,
    );
    expect(byRole(container, 'img', 'Revenue by region. Last 12 months')).toHaveLength(1);
    expect(container.querySelectorAll('canvas[role="img"]:not([aria-label])')).toHaveLength(0);
  });

  it('names a canvas that mounts after the card, and follows a new title', async () => {
    const container = render(<DonutChart title="Revenue share" dimension={region} measure={revenue} results={byRegion} />);
    // A donut draws once it knows its size, after the card has rendered.
    expect(container.querySelector('canvas')).toBeNull();
    await act(async () => {
      for (const { callback, target } of observers) {
        callback([{ target, contentRect: { width: 400, height: 300 } } as unknown as ResizeObserverEntry], {} as ResizeObserver);
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    });
    expect(byRole(container, 'img', 'Revenue share')).toHaveLength(1);

    act(() => root!.render(<ChartsProvider><DonutChart title="Revenue by plan" dimension={region} measure={revenue} results={byRegion} /></ChartsProvider>));
    expect(byRole(container, 'img', 'Revenue by plan')).toHaveLength(1);
  });
});

describe('heat map text contrast', () => {
  const ratio = (a: string, b: string) => chroma.contrast(a, b);

  it('uses white only where white reaches 4.5:1', () => {
    expect(getCellColor('#462e7b')).toBe('#FFFFFF'); // the default theme's darkest cell
    expect(ratio('#FFFFFF', '#8b5cf6')).toBeLessThan(4.5); // its mid violet
    expect(getCellColor('#8b5cf6')).not.toBe('#FFFFFF');
    expect(getCellColor('#c5adfa')).toBe('#212129');
  });

  // Every cell colour a heat map can draw with each site theme's first colour
  // (and the #FF5400 fallback): its lightest tint, through the colour itself, to its darkest shade.
  it.each(['#8b5cf6', '#0b6e99', '#2d6a4f', '#a78bfa', '#FF5400'])('keeps every cell at 4.5:1 or more (%s)', (mid) => {
    const scale = chroma.scale([chroma.mix(mid, '#fff', 0.65, 'rgb'), mid, chroma.mix(mid, '#000', 0.85, 'rgb')]).mode('rgb');
    for (let i = 0; i <= 100; i++) {
      const background = scale(i / 100).hex();
      expect(ratio(getCellColor(background), background), background).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('renders cells whose text reaches 4.5:1', () => {
    const month = dimension({ name: 'month', title: 'Month' });
    const rows = ['Jan', 'Feb', 'Mar', 'Apr'].flatMap((m, i) =>
      ['Europe', 'Americas'].map((r, j) => ({ month: m, region: r, revenue: 100 + i * 150 + j * 60 })),
    );
    const container = render(
      <HeatMap title="Revenue" rowDimension={region} columnDimension={month} measure={revenue} results={results(rows)} />,
    );
    const cells = [...container.querySelectorAll<HTMLElement>('tbody td')];
    expect(cells.length).toBe(8);
    for (const cell of cells) {
      expect(ratio(cell.style.color, cell.style.background), cell.style.background).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('takes its default colour from the theme, not the DOM, so a server renders the same cells', () => {
    const month = dimension({ name: 'month', title: 'Month' });
    const rows = [
      { month: 'Jan', region: 'Europe', revenue: 100 },
      { month: 'Feb', region: 'Europe', revenue: 300 },
    ];
    // jsdom does not resolve the theme's CSS variables, so a colour read from
    // the DOM would be the #FF5400 fallback, as on a server.
    const container = render(
      <HeatMap title="Revenue" rowDimension={region} columnDimension={month} measure={revenue} results={results(rows)} />,
      { styles: { '--em-sem-chart-color--1': '#0b6e99' } },
    );
    const backgrounds = [...container.querySelectorAll<HTMLElement>('tbody td')].map((td) => chroma(td.style.background).hex());
    // The lightest and darkest cells are the theme colour mixed half with white and half with black.
    expect(backgrounds).toEqual(['#85b7cc', '#06374d']);
  });
});

describe('KPI and state markup', () => {
  it('renders the KPI number and the empty title as text, not headings', () => {
    const container = render(<KpiNumber title="Total revenue" measure={revenue} results={results([{ revenue: 48200 }])} />);
    expect(container.querySelector('h3')?.textContent).toBe('Total revenue');
    expect(container.querySelectorAll('h1, h2, h4, h5, h6')).toHaveLength(0);
    expect(container.querySelector('[title="$48,200"]')?.tagName).toBe('DIV');

    act(() => root!.render(<ChartsProvider><KpiNumber title="Total revenue" measure={revenue} results={results([])} /></ChartsProvider>));
    expect(container.textContent).toContain('No results.');
    expect(container.querySelectorAll('h1, h2, h4, h5, h6')).toHaveLength(0);
  });

  it('styles them by class, not by h2', () => {
    const css = (file: string) => fs.readFileSync(path.join(process.cwd(), 'src/generated-ui/components', file), 'utf8');
    expect(css('charts/kpis/KpiChart.module.css')).toContain('.kpiChartValueContainer .kpiChartValue {');
    expect(css('shared/Card/CardFeedback/CardFeedback.module.css')).toContain('.feedback .title {');
    expect(css('shared/Card/CardFeedback/CardFeedback.module.css')).toContain('.feedback.error .title,');
    for (const file of ['charts/kpis/KpiChart.module.css', 'shared/Card/CardFeedback/CardFeedback.module.css']) {
      expect(css(file)).not.toMatch(/\bh2\b/);
    }
  });
});

describe('default palette', () => {
  // The colours are upstream's (the "Default" palette on embeddable.com): the
  // package's own defaults style the card and leave the palette alone.
  it('is upstream’s: the package sets no chart colour of its own', () => {
    expect(Object.keys(defaultStyles).filter((key) => key.startsWith('--em-sem-chart-color'))).toEqual([]);
  });
});

describe('horizontal bar labels', () => {
  type FitHook = (scale: Scale) => void;
  const fit = getBarChartOptions({ horizontal: true } as Parameters<typeof getBarChartOptions>[0]).scales!.y!
    .afterTickToLabelConversion as unknown as FitHook;
  const scale = (labels: string[], maxWidth: number) =>
    ({
      options: { ticks: { display: true, padding: 3, font: { size: 12, family: 'Inter' } }, grid: { drawTicks: true, tickLength: 8 }, title: { display: false } },
      ctx: { save() {}, restore() {}, font: '', measureText: (text: string) => ({ width: text.length * 6 }) },
      chart: { options: { font: {} } },
      maxWidth,
      ticks: labels.map((label) => ({ value: 0, label })),
    }) as unknown as Scale;

  it('cuts a label that is wider than the axis allows, with an ellipsis', () => {
    // 100px axis - 8px tick - 2 × 3px padding = 86px for text: 14 characters.
    const s = scale(['Recherche organique', 'Direct'], 100);
    fit(s);
    expect(s.ticks.map((t) => t.label)).toEqual(['Recherche org…', 'Direct']);
    expect((s.ticks[0]!.label as string).length * 6).toBeLessThanOrEqual(86);
  });

  it('leaves labels that fit alone', () => {
    const s = scale(['Recherche organique'], 200);
    fit(s);
    expect(s.ticks[0]!.label).toBe('Recherche organique');
  });
});

describe('percentages', () => {
  it('follow the locale and keep decimalPlaces exactly', () => {
    const nbsp = (s: string) => s.replace(/\s/g, ' ');
    expect(nbsp(getDatalabelPercentage(31.8, [31.8, 68.2], 1, 'de-DE'))).toBe('31,8 %');
    expect(nbsp(getDatalabelPercentage(31.8, [31.8, 68.2], 1, 'fr-FR'))).toBe('31,8 %');
    expect(getDatalabelPercentage(10, [10, 90], 1, 'en-US')).toBe('10.0%');
    expect(getDatalabelPercentage(1, [1, 2], undefined, 'en-US')).toBe('33.33%');
    expect(getDatalabelPercentage(1, [1, 3], undefined, 'en-US')).toBe('25%');
    expect(getDatalabelPercentage(0, [0, 0], undefined, 'en-US')).toBe('0%');
    expect(getDatalabelPercentage(1, [1, 3], undefined, 'not a locale')).toBe('25%');
  });

  it('use the provider locale on pie labels and tooltips', () => {
    const theme = themeOf({ formatter: { locale: 'de-DE' } });
    const share = measure({ name: 'revenue', title: 'Revenue', inputs: { showValueAsPercentage: true, decimalPlaces: 1 } });
    const options = getPieChartProOptions({ measure: share, dimension: region }, theme);
    const context = { dataset: { data: [318, 682] } };
    const label = (options.plugins!.datalabels!.formatter as (v: number, c: unknown) => string)(318, context);
    expect(label.replace(/\s/g, ' ')).toBe('31,8 %');
  });
});

/** The theme ChartsProvider resolves, with i18n set up as a chart would. */
const themeOf = (override?: object): Theme => {
  let theme: Theme | undefined;
  const Grab = () => {
    theme = useTheme() as Theme;
    return null;
  };
  render(<Grab />, override);
  i18nSetup(theme!);
  return theme!;
};

describe('comparison series label', () => {
  const month = dimension({ name: 'month', title: 'Month' });
  const rows = [{ month: 'Jan', customers: 10 }];

  it.each([
    ['en', 'Customers', 'Customers (previous period)'],
    ['de', 'Kunden', 'Kunden (Vorzeitraum)'],
    ['fr', 'Clients', 'Clients (période précédente)'],
  ])('reads as the series name plus the period (%s)', (language, title, expected) => {
    const theme = themeOf({ i18n: { language } });
    const customers = measure({ name: 'customers', title: 'Customers', inputs: { displayName: title } });
    const data = getLineChartComparisonProData(
      { data: rows, dataComparison: rows, dimension: month, measures: [customers], hasMinMaxYAxisRange: false },
      theme,
    );
    expect(data.datasets.map((d) => d.label)).toEqual([title, expected]);
  });
});

describe('lines with a pinned y range', () => {
  const month = dimension({ name: 'month', title: 'Month' });
  const plan = dimension({ name: 'plan', title: 'Plan' });
  const rows = [
    { month: 'Jan', plan: 'Starter', revenue: 120 },
    { month: 'Feb', plan: 'Starter', revenue: 180 },
  ];
  const yOnly = { left: false, right: false, top: 0, bottom: 0 };

  it('clip the top and bottom only, so edge points draw whole', () => {
    const theme = themeOf();
    const props = { data: rows, dimension: month, hasMinMaxYAxisRange: true };
    expect(getLineChartProData({ ...props, measures: [revenue] }, theme).datasets[0]!.clip).toEqual(yOnly);
    expect(getLineChartGroupedProData({ ...props, groupDimension: plan, measure: revenue }, theme).datasets[0]!.clip).toEqual(yOnly);
    const comparison = getLineChartComparisonProData({ ...props, dataComparison: rows, measures: [revenue] }, theme);
    expect(comparison.datasets.map((d) => d.clip)).toEqual([yOnly, yOnly]);
    expect(getLineChartProData({ ...props, hasMinMaxYAxisRange: false, measures: [revenue] }, theme).datasets[0]!.clip).toBe(false);
  });

  it('reach Chart.js as a per-side clip', () => {
    const container = render(<LineChart title="Revenue" xAxis={month} measures={[revenue]} results={results(rows)} yAxisRangeMin={100} />);
    const chart = Chart.getChart(container.querySelector('canvas')!)!;
    expect(chart.getDatasetMeta(0)).toMatchObject({ _clip: { ...yOnly, disabled: false } });
  });
});

describe('funnel width', () => {
  it('ends the value scale at the largest step, so the widest step spans the drawing area', () => {
    const stage = dimension({ name: 'stage', title: 'Stage' });
    const deals = measure({ name: 'deals', title: 'Deals' });
    const rows = [
      { stage: 'Lead', deals: 4820 },
      { stage: 'Won', deals: 903 },
    ];
    const container = render(<FunnelChart title="Deals by stage" sectionDimension={stage} countMeasure={deals} results={results(rows)} />);
    const chart = Chart.getChart(container.querySelector('canvas')!)!;
    // Centred: the scale runs from minus to plus the largest value, not to a round tick (6,000).
    expect([chart.scales.x!.min, chart.scales.x!.max]).toEqual([-4820, 4820]);
  });
});

describe('i18next support notice', () => {
  it('is not printed', () => {
    const theme = themeOf({ i18n: { language: 'de' } });
    delete (globalThis as { __i18next_supportNoticeShown?: boolean }).__i18next_supportNoticeShown;
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      // A language change initialises i18next again, which is when it prints.
      i18nSetup({ ...theme, i18n: { ...theme.i18n, language: 'fr' } });
      expect(i18n.options.showSupportNotice).toBe(false);
      expect(info.mock.calls.flat().join(' ')).not.toMatch(/locize/i);
    } finally {
      info.mockRestore();
    }
  });
});
