import { act, type ReactElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Chart } from 'chart.js';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ChartsProvider } from '../src';
import { remarkableTheme } from '../src/generated/theme/theme.constants';
import { ThemeContext, useTheme } from '../src/runtime/react';
import { defaultChartOptions } from '../src/theme';
import { buildChart, type ChartRuntime, type ChartSettings } from '../site/catalog/build';
import { getComponent } from '../site/catalog/chartComponents';
import { chartEntries } from '../site/catalog/registry';

// The package's chart defaults (src/theme.ts) may change how many ticks an
// axis has, whether its labels tilt, and whether a one-entry legend shows.
// Nothing else. Each chart on the site is drawn twice, with the defaults and
// with upstream's chart options, and everything else about its axes and
// legend must come out the same: an axis keeps its own title, range, format
// and stacking. (Two bugs this would have caught: a stacked area chart that
// stopped stacking, and a scatter chart whose y-axis took its x-axis's options.)

// Node resolves the datalabels plugin's CommonJS build, which brings a second
// copy of chart.js whose element checks fail; bundlers use its ES module build.
vi.mock('chartjs-plugin-datalabels', () => import('chartjs-plugin-datalabels/dist/chartjs-plugin-datalabels.esm.js' as string));

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver = class {
    observe() {}
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
  document.body.innerHTML = '';
});

/** The provider's theme with upstream's chart options in place of the package's defaults. */
const UpstreamChartOptions = ({ children }: { children: ReactNode }) => {
  const theme = useTheme() as { charts: object };
  return <ThemeContext.Provider value={{ ...theme, charts: remarkableTheme.charts }}>{children}</ThemeContext.Provider>;
};

type Options = { scales?: Record<string, Record<string, unknown>>; plugins?: { legend?: Record<string, unknown> } };

/**
 * The options the component handed Chart.js for the first chart it drew, or
 * undefined when it draws no canvas. `overflowed` is set when Chart.js could
 * not lay the chart out here: the combo chart's tick fonts recurse on jsdom's
 * stand-in canvas (it draws in a browser), but the chart is created, with its
 * options, before that.
 */
const optionsOf = (node: ReactElement): { options?: Options; overflowed: boolean } => {
  const container = document.createElement('div');
  document.body.append(container);
  const before = new Set(Object.keys(Chart.instances));
  let overflowed = false;
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  root = createRoot(container);
  try {
    act(() => root!.render(node));
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    overflowed = true;
  }
  const chart = Object.entries(Chart.instances).find(([id]) => !before.has(id))?.[1];
  const options = chart ? (chart.config.options as Options) : undefined;
  try {
    act(() => root!.unmount());
  } catch {
    // Already torn down by the error above.
  }
  for (const [id, instance] of Object.entries(Chart.instances)) if (!before.has(id)) instance.destroy();
  errors.mockRestore();
  root = undefined;
  container.remove();
  return { options, overflowed };
};

// What the defaults are allowed to set.
const TICK_KEYS = ['maxTicksLimit', 'maxRotation', 'autoSkip'];

/** A plain, comparable copy: functions by their source, the allowed keys left out. */
const comparable = (value: unknown, path: string[] = [], seen = new Set<unknown>()): unknown => {
  if (typeof value === 'function') return `fn:${value.toString()}`;
  if (value && typeof value === 'object') {
    // The combo chart's options hold a reference back to themselves.
    if (seen.has(value)) return '[seen]';
    seen = new Set(seen).add(value);
  }
  if (Array.isArray(value)) return value.map((v, i) => comparable(v, [...path, String(i)], seen));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      if (path.at(-1) === 'ticks' && TICK_KEYS.includes(key)) continue;
      if (path.join('.') === 'legend.labels' && key === 'filter') continue;
      const copy = comparable(v, [...path, key], seen);
      // A key holding nothing is the same as no key.
      if (copy && typeof copy === 'object' && !Array.isArray(copy) && !Object.keys(copy).length) continue;
      out[key] = copy;
    }
    return out;
  }
  return value;
};

const runtime: ChartRuntime = {
  granularity: 'month',
  setGranularity: () => {},
  tableState: { page: 0, isLoadingDownloadData: false },
  setTableState: () => {},
  onEvent: () => {},
};
const settings = (variantId?: string): ChartSettings => ({ datasetId: 'saas', variantId, dataState: 'ready', toggles: {}, themeId: 'default', languageId: 'en' });

const cases = chartEntries.flatMap((entry) => [undefined, ...(entry.variants ?? [])].map((variant) => [`${entry.id}${variant ? ` / ${variant.id}` : ''}`, entry, variant?.id] as const));

describe('chart defaults change ticks and one-entry legends, nothing else', () => {
  let drawn = 0;

  it.each(cases)('%s', (_, entry, variantId) => {
    const Component = getComponent(entry);
    const { props } = buildChart(entry, settings(variantId), runtime);
    const chart = (
      <div style={{ height: 320 }}>
        <Component {...props} />
      </div>
    );
    const ours = optionsOf(<ChartsProvider>{chart}</ChartsProvider>);
    const theirs = optionsOf(
      <ChartsProvider>
        <UpstreamChartOptions>{chart}</UpstreamChartOptions>
      </ChartsProvider>,
    );
    // The defaults never make a chart fail to lay out that upstream's options lay out.
    expect(ours.overflowed).toBe(theirs.overflowed);
    const withDefaults = ours.options;
    const upstream = theirs.options;
    expect(Boolean(withDefaults)).toBe(Boolean(upstream));
    if (!withDefaults || !upstream) return; // a KPI or a table: no canvas
    drawn++;

    // Every axis upstream has is still there, with its own options.
    expect(Object.keys(withDefaults.scales ?? {}).sort()).toEqual(Object.keys(upstream.scales ?? {}).sort());
    for (const [id, scale] of Object.entries(upstream.scales ?? {})) {
      expect(comparable(withDefaults.scales![id], [id]), `scale ${id}`).toEqual(comparable(scale, [id]));
    }
    const axes = Object.values(withDefaults.scales ?? {});
    expect(new Set(axes).size, 'two axes share one options object').toBe(axes.length);
    expect(comparable(withDefaults.plugins?.legend, ['legend']), 'legend').toEqual(comparable(upstream.plugins?.legend, ['legend']));
  });

  it('drew a canvas chart for every chart type that has defaults', () => {
    expect(drawn).toBeGreaterThanOrEqual(Object.keys(defaultChartOptions).length);
  });
});
