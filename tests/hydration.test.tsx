import { act, type ReactElement } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { Chart } from 'chart.js';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// The Next.js App Router flow, simulated: a 'use client' tree is rendered to
// HTML on the server, with no DOM, and then hydrated in the browser. Each side
// loads its own copy of the package, as the server and client bundles do, so
// anything the package reads at import time is read without a DOM on one side
// and with one on the other. The client side must then hydrate without a
// mismatch and draw each chart on its canvas.

// Node resolves the datalabels plugin's CommonJS build, which requires a second,
// CommonJS copy of chart.js, so its element checks fail and pie labels throw.
// Bundlers, Next.js's included, use its ES module build, as here.
vi.mock('chartjs-plugin-datalabels', () => import('chartjs-plugin-datalabels/dist/chartjs-plugin-datalabels.esm.js' as string));

type Lib = typeof import('../src');
type Tree = (lib: Lib, examples: Examples) => ReactElement;
type Examples = {
  ClientProvider: typeof import('../site/examples/app/ClientProvider').ClientProvider;
  RevenueChart: typeof import('../site/examples/RevenueChart').RevenueChart;
};

const loadSide = async () => {
  vi.resetModules();
  const lib = await import('../src');
  const { ClientProvider } = await import('../site/examples/app/ClientProvider');
  const { RevenueChart } = await import('../site/examples/RevenueChart');
  return { lib, examples: { ClientProvider, RevenueChart } };
};

// What a server has not got. jsdom's globals are removed while the server copy
// loads and renders, then put back.
const browserGlobals = [
  'window', 'self', 'top', 'parent', 'document', 'navigator', 'getComputedStyle',
  'localStorage', 'sessionStorage', 'matchMedia', 'ResizeObserver', 'MutationObserver',
  'IntersectionObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'CSS',
  'Element', 'HTMLElement', 'HTMLCanvasElement', 'Node',
];

const renderOnServer = async (tree: Tree) => {
  const saved = new Map(browserGlobals.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const key of browserGlobals) delete (globalThis as Record<string, unknown>)[key];
  try {
    expect(typeof window).toBe('undefined');
    const { lib, examples } = await loadSide();
    return renderToString(tree(lib, examples));
  } finally {
    for (const [key, descriptor] of saved) if (descriptor) Object.defineProperty(globalThis, key, descriptor);
  }
};

// jsdom has no layout, 2D canvas or ResizeObserver; a browser has all three.
beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 480 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 320 });
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
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

// A KPI sizes its number on the next animation frame, and that frame still
// comes after the component is gone. Let it pass here, while there is a
// window: the next test's server render takes the window away, and a frame
// arriving then fails with "window is not defined".
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

let root: Root | undefined;
afterEach(async () => {
  act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = '';
  await nextFrame();
  await nextFrame();
});

const hydrateOnClient = async (html: string, tree: Tree) => {
  const { lib, examples } = await loadSide();
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.append(container);

  const recoverable: unknown[] = [];
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    await act(async () => {
      root = hydrateRoot(container, tree(lib, examples), { onRecoverableError: (error) => recoverable.push(error) });
    });
    return { container, recoverable, errors: errors.mock.calls.map((call) => call.map(String).join(' ')) };
  } finally {
    errors.mockRestore();
  }
};

const region = { name: 'region', title: 'Region' };
const plan = { name: 'plan', title: 'Plan' };
const revenue = { name: 'revenue', title: 'Revenue', inputs: { currency: 'USD', decimalPlaces: 0 } };
const byPlan = [
  { plan: 'Starter', region: 'Europe', revenue: 18400 },
  { plan: 'Growth', region: 'Europe', revenue: 42900 },
  { plan: 'Starter', region: 'Americas', revenue: 21700 },
];
const month = { name: 'month', title: 'Month', type: 'time' as const, granularity: 'month' as const };
const monthly = [
  { month: '2026-01-01T00:00:00.000', revenue: 48200 },
  { month: '2026-02-01T00:00:00.000', revenue: 51900 },
];

// Every plan in every region, so no heat map cell is empty.
const grid = [...byPlan, { plan: 'Growth', region: 'Americas', revenue: 38100 }];

// Each tree is the 'use client' part of a page: the provider from a client
// file, with charts inside it. The heat map takes its default colours from the
// theme object, not from CSS variables a server cannot read, so its cells are
// the same on both sides (jsdom cannot read the variables either: see
// libraryPolish.test.tsx for the colours themselves).
const trees: Record<string, { tree: Tree; text: string[]; canvases: number }> = {
  'the quick start chart': {
    tree: (_, { ClientProvider, RevenueChart }) => (
      <ClientProvider>
        <RevenueChart />
      </ClientProvider>
    ),
    text: ['Revenue by region'],
    canvases: 1,
  },
  'a KPI number': {
    tree: ({ measure, results, KpiNumber }, { ClientProvider }) => (
      <ClientProvider>
        <KpiNumber title="Total revenue" measure={measure(revenue)} results={results([{ revenue: 48200 }])} />
      </ClientProvider>
    ),
    text: ['Total revenue', '$48,200'],
    canvases: 0,
  },
  'a line chart': {
    tree: ({ dimension, measure, results, LineChart }, { ClientProvider }) => (
      <ClientProvider>
        <LineChart title="Revenue over time" xAxis={dimension(month)} measures={[measure(revenue)]} results={results(monthly)} />
      </ClientProvider>
    ),
    text: ['Revenue over time'],
    canvases: 1,
  },
  'a pie chart': {
    tree: ({ dimension, measure, results, PieChart }, { ClientProvider }) => (
      <ClientProvider>
        <PieChart title="Revenue share" dimension={dimension(plan)} measure={measure(revenue)} results={results(byPlan)} />
      </ClientProvider>
    ),
    text: ['Revenue share'],
    canvases: 1,
  },
  'a funnel chart': {
    tree: ({ dimension, measure, results, FunnelChart }, { ClientProvider }) => (
      <ClientProvider>
        <FunnelChart title="Pipeline" sectionDimension={dimension(plan)} countMeasure={measure(revenue)} results={results(byPlan)} />
      </ClientProvider>
    ),
    text: ['Pipeline'],
    canvases: 1,
  },
  'a paginated table': {
    tree: ({ dimension, measure, results, TablePaginated }, { ClientProvider }) => (
      <ClientProvider>
        <TablePaginated
          title="Plans"
          dimensionsAndMeasures={[dimension(plan), measure(revenue)]}
          results={results(byPlan)}
          state={{ page: 0, isLoadingDownloadData: false }}
          setState={() => {}}
        />
      </ClientProvider>
    ),
    text: ['Plans', 'Growth', '$42,900'],
    canvases: 0,
  },
  'a pivot table': {
    tree: ({ dimension, measure, results, PivotTable }, { ClientProvider }) => (
      <ClientProvider>
        <PivotTable
          title="Revenue by plan and region"
          rowDimension={dimension(plan)}
          columnDimension={dimension(region)}
          measures={[measure(revenue)]}
          results={results(byPlan)}
          expandedRowKeys={[]}
          setExpandedRowKey={() => {}}
        />
      </ClientProvider>
    ),
    text: ['Revenue by plan and region', 'Americas', '$21,700'],
    canvases: 0,
  },
  'a heat map': {
    tree: ({ dimension, measure, results, HeatMap }, { ClientProvider }) => (
      <ClientProvider>
        <HeatMap
          title="Revenue heat map"
          rowDimension={dimension(plan)}
          columnDimension={dimension(region)}
          measure={measure(revenue)}
          results={results(grid)}
        />
      </ClientProvider>
    ),
    text: ['Revenue heat map', 'Growth', '$38,100'],
    canvases: 0,
  },
};

// Each case renders on the server, then hydrates and waits for Chart.js to
// draw: a few seconds under a full, parallel test run, so the default 5 s is
// not enough there.
vi.setConfig({ testTimeout: 30_000 });

describe.each(Object.entries(trees))('server render, then hydrate: %s', (_, { tree, text, canvases }) => {
  it('hydrates without a mismatch and draws its charts', async () => {
    const html = await renderOnServer(tree);
    for (const expected of text) expect(html).toContain(expected);

    const { container, recoverable, errors } = await hydrateOnClient(html, tree);
    expect(recoverable).toEqual([]);
    expect(errors).toEqual([]);
    for (const expected of text) expect(container.textContent).toContain(expected);

    const drawn = [...container.querySelectorAll('canvas')].filter((canvas) => Chart.getChart(canvas));
    expect(drawn).toHaveLength(canvases);
  });
});

// Numbers are formatted in theme.formatter.locale, which defaults to the
// runtime's navigator.language: the server's on the server, the visitor's in
// the browser. When they differ, React throws the server HTML away and renders
// on the client, so a server-rendered page pins the locale.
describe('a visitor whose browser language differs from the server', () => {
  const pinned: Tree = ({ ChartsProvider, KpiNumber, measure, results }) => (
    <ChartsProvider theme={{ formatter: { locale: 'en-US' } }}>
      <KpiNumber title="Total revenue" measure={measure(revenue)} results={results([{ revenue: 48200 }])} />
    </ChartsProvider>
  );

  it('hydrates when the provider pins the locale', async () => {
    const html = await renderOnServer(pinned);
    const language = Object.getOwnPropertyDescriptor(window.navigator, 'language');
    Object.defineProperty(window.navigator, 'language', { value: 'de-DE', configurable: true });
    try {
      const { container, recoverable, errors } = await hydrateOnClient(html, pinned);
      expect(recoverable).toEqual([]);
      expect(errors).toEqual([]);
      expect(container.textContent).toContain('$48,200');
    } finally {
      if (language) Object.defineProperty(window.navigator, 'language', language);
      else delete (window.navigator as { language?: string }).language;
    }
  });
});
