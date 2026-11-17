import { act, createElement, useImperativeHandle, type Ref } from 'react';
import { createRoot } from 'react-dom/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { BarChart, BarChartStacked, ChartsProvider, dimension, measure, PieChart, PivotTable, results } from '../src';
import { RevenueByRegion } from '../site/examples/PivotSubRows';
import { getComponent } from '../site/catalog/chartComponents';
import { chartEntries } from '../site/catalog/registry';
import { clickPayloadNote, TIME_RANGE_NOTE } from '../site/content/components';
import { MEASURE_VALUE_UNSET, MEASURE_VALUES_HANDLERS } from '../site/content/clickPayloads';

// What a click handler is really passed, against what the pages say: the
// keys beyond the exported payload type (`measureValues`), and what a
// `TimeRange` holds off and on a time axis. Chart.js is replaced by a canvas
// that reports a click on the second point of the first series.

vi.mock('react-chartjs-2', () => {
  const chart = (props: { ref?: Ref<unknown>; onClick?: (event: unknown) => void }) => {
    useImperativeHandle(props.ref, () => ({}));
    return createElement('canvas', { onClick: props.onClick, 'data-testid': 'chart' });
  };
  const hit = () => [{ index: 1, datasetIndex: 0 }];
  return {
    getElementAtEvent: hit,
    getElementsAtEvent: hit,
    getDatasetAtEvent: hit,
    Bar: chart,
    Line: chart,
    Pie: chart,
    Doughnut: chart,
    Scatter: chart,
    Bubble: chart,
    Chart: chart,
  };
});

const realRect = Element.prototype.getBoundingClientRect;
beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.getBoundingClientRect = () =>
    ({ x: 0, y: 0, left: 0, top: 0, right: 600, bottom: 400, width: 600, height: 400, toJSON: () => ({}) }) as DOMRect;
});
afterAll(() => {
  Element.prototype.getBoundingClientRect = realRect;
});

/** Renders the element, clicks its chart and returns what the handler was called with. */
const click = (element: React.ReactElement, handler: ReturnType<typeof vi.fn>) => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(createElement(ChartsProvider, null, createElement('div', { style: { height: 400 } }, element))));
  const canvas = container.querySelector('canvas');
  expect(canvas, 'a chart was drawn').not.toBeNull();
  act(() => canvas!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  act(() => root.unmount());
  container.remove();
  expect(handler).toHaveBeenCalledTimes(1);
  return handler.mock.calls[0]![0] as Record<string, unknown>;
};

const region = dimension({ name: 'region', title: 'Region' });
const revenue = measure({ name: 'revenue', title: 'Revenue' });
const rows = [
  { region: 'Americas', revenue: 120 },
  { region: 'Europe', revenue: 150 },
  { region: 'Asia', revenue: 90 },
];

describe('click payloads', () => {
  const entries = chartEntries.filter((e) => String(e.exportName) in MEASURE_VALUES_HANDLERS);

  it('the list names real components and handlers', () => {
    expect(entries.map((e) => String(e.exportName)).sort()).toEqual(Object.keys(MEASURE_VALUES_HANDLERS).sort());
  });

  it.each(entries.map((e) => [String(e.exportName), e] as const))('%s passes measureValues, as its page says', (name, entry) => {
    const handler = vi.fn();
    const props: Record<string, unknown> = {
      dimension: region,
      xAxis: region,
      measures: [revenue],
      results: results(rows),
      resultsKpis: results([{ revenue: 360 }]),
      [MEASURE_VALUES_HANDLERS[name]!]: handler,
    };
    const payload = click(createElement(getComponent(entry), props), handler);
    expect(payload.measureValues).toEqual({ revenue: 150 });
    expect(payload.dimensionValue).toBe('Europe');
    // Off a time axis there is no range.
    expect(payload.dimensionTimeRange).toBeUndefined();
    expect('measureValue' in payload && payload.measureValue !== undefined).toBe(false);
    expect(MEASURE_VALUE_UNSET.includes(name)).toBe(name.startsWith('Line'));
    expect(clickPayloadNote(entry)).toContain(`\`${MEASURE_VALUES_HANDLERS[name]}\` is also passed \`measureValues\``);
  });

  it('on a time axis, the range is the clicked period and relativeTimeString is undefined, as the TimeRange note says', () => {
    const month = dimension({ name: 'month', title: 'Month', type: 'time', granularity: 'month' });
    const handler = vi.fn();
    const monthly = [
      { month: '2026-01-01T00:00:00.000', revenue: 120 },
      { month: '2026-02-01T00:00:00.000', revenue: 150 },
      { month: '2026-03-01T00:00:00.000', revenue: 90 },
    ];
    const payload = click(<BarChart dimension={month} measures={[revenue]} results={results(monthly)} onBarClicked={handler} />, handler);
    const range = payload.dimensionTimeRange as { from: Date; to: Date; relativeTimeString: unknown };
    expect(Object.keys(range).sort()).toEqual(['from', 'relativeTimeString', 'to']);
    expect(range.from.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(range.to.toISOString().slice(0, 10)).toBe('2026-02-28');
    expect(range.relativeTimeString).toBeUndefined();
    expect(payload.dimensionValue).toBeUndefined();
    expect(TIME_RANGE_NOTE).toContain('its `relativeTimeString` is always `undefined`');
  });

  it('the stacked bars and the pie pass only what their types declare', () => {
    const plan = dimension({ name: 'plan', title: 'Plan' });
    const stacked = vi.fn();
    const stackedPayload = click(
      <BarChartStacked
        xAxis={region}
        groupBy={plan}
        measure={revenue}
        results={results(rows.map((row) => ({ ...row, plan: 'Growth' })))}
        onBarClicked={stacked}
      />,
      stacked,
    );
    expect(Object.keys(stackedPayload).sort()).toEqual(['dimensionTimeRange', 'dimensionValue', 'groupingDimensionTimeRange', 'groupingDimensionValue']);
    const pie = vi.fn();
    const piePayload = click(<PieChart dimension={region} measure={revenue} results={results(rows)} onSegmentClick={pie} />, pie);
    expect(Object.keys(piePayload).sort()).toEqual(['dimensionTimeRange', 'dimensionValue']);
    for (const entry of chartEntries.filter((e) => !(String(e.exportName) in MEASURE_VALUES_HANDLERS))) expect(clickPayloadNote(entry)).toBe('');
  });
});

// The pivot table's sub-rows, as the hand-written example on its page wires
// them: setExpandedRowKey gets the row's value once, the example adds it to
// expandedRowKeys and passes that row's sub-rows, and the table shows them
// under it, closing and reopening without another call.
describe('pivot sub-rows', () => {
  it('open on the first click, from one call, and close and reopen on their own', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    act(() => root.render(<ChartsProvider><RevenueByRegion /></ChartsProvider>));
    const header = () => container.querySelector<HTMLElement>('th[role="button"][aria-label="Expand Americas"], th[role="button"][aria-label="Collapse Americas"]')!;
    expect(header()).not.toBeNull();
    expect(container.textContent).not.toContain('Canada');
    act(() => header().click());
    expect(header().getAttribute('aria-expanded')).toBe('true');
    expect(container.textContent).toContain('United States');
    expect(container.textContent).toContain('Canada');
    expect(container.textContent).not.toContain('Germany');
    act(() => header().click());
    expect(container.textContent).not.toContain('Canada');
    act(() => header().click());
    expect(container.textContent).toContain('Canada');
    act(() => root.unmount());
    container.remove();
  });

  it('calls setExpandedRowKey once per row, with the row’s value as a string', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const setExpandedRowKey = vi.fn();
    const region = dimension({ name: 'region', title: 'Region' });
    const country = dimension({ name: 'country', title: 'Country' });
    const quarter = dimension({ name: 'quarter', title: 'Quarter' });
    const table = (keys: string[], sub: object[]) => (
      <ChartsProvider>
        <PivotTable
          rowDimension={region}
          subRowDimension={country}
          columnDimension={quarter}
          measures={[revenue]}
          results={results([{ region: 'EMEA', quarter: 'Q1', revenue: 1 }])}
          resultsSubRows={results(sub)}
          expandedRowKeys={keys}
          setExpandedRowKey={setExpandedRowKey}
        />
      </ChartsProvider>
    );
    act(() => root.render(table([], [])));
    const header = () => container.querySelector<HTMLElement>('th[role="button"]')!;
    act(() => header().click());
    expect(setExpandedRowKey).toHaveBeenCalledWith('EMEA');
    // The caller adds the key and loads its sub-rows; the table shows them, and closing calls nothing.
    act(() => root.render(table(['EMEA'], [{ region: 'EMEA', country: 'France', quarter: 'Q1', revenue: 1 }])));
    expect(container.textContent).toContain('France');
    act(() => header().click());
    act(() => header().click());
    expect(setExpandedRowKey).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    container.remove();
  });
});
