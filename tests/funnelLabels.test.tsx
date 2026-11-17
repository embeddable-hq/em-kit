import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ChartsProvider, FunnelChart, dimension, measure, results } from '../src';
import type { FunnelChartProps } from '../src';

// Funnel value labels format the measure as its tooltip does: prefix,
// currency, decimal places and the provider's locale. They used to print
// value.toLocaleString(), so "$1,300.00" in the tooltip was "1,300" on the chart.

type Options = {
  plugins: {
    datalabels: { formatter: (value: number, context: unknown) => string };
    tooltip: { callbacks: { label: (context: { raw: number }) => string } };
  };
};
const drawn: { data: { labels: string[]; datasets: { data: number[] }[] }; options: Options }[] = [];
vi.mock('react-chartjs-2', () => ({
  Chart: (props: (typeof drawn)[number]) => {
    drawn.push(props);
    return null;
  },
}));

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const stage = dimension({ name: 'stage', title: 'Stage' });
const rows = [
  { stage: 'Leads', deals: 1300 },
  { stage: 'Won', deals: 300 },
];

/** The value labels and tooltip labels the funnel hands Chart.js. */
const labelsOf = (props: Partial<FunnelChartProps> & Pick<FunnelChartProps, 'countMeasure'>, theme?: object) => {
  drawn.length = 0;
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() =>
    root.render(
      <ChartsProvider theme={theme}>
        <FunnelChart title="Pipeline" sectionDimension={stage} results={results(rows)} {...props} />
      </ChartsProvider>,
    ),
  );
  act(() => root.unmount());
  const { data, options } = drawn.at(-1)!;
  const values = data.datasets[0]!.data;
  const context = (dataIndex: number) => ({ chart: { data }, dataIndex, datasetIndex: 0 });
  return {
    labels: values.map((value, i) => options.plugins.datalabels.formatter(value, context(i))),
    tooltips: values.map((raw) => options.plugins.tooltip.callbacks.label({ raw })),
  };
};

describe('funnel value labels', () => {
  it('use the prefix and decimal places, like the tooltip', () => {
    const deals = measure({ name: 'deals', title: 'Deals', inputs: { prefix: '$', decimalPlaces: 2 } });
    const { labels, tooltips } = labelsOf({ countMeasure: deals });
    expect(labels).toEqual(['$1,300.00', '$300.00']);
    expect(tooltips).toEqual(['Deals: $1,300.00', 'Deals: $300.00']);
  });

  it('use the currency and the provider locale', () => {
    const deals = measure({ name: 'deals', title: 'Deals', inputs: { currency: 'EUR', decimalPlaces: 0 } });
    const { labels } = labelsOf({ countMeasure: deals }, { formatter: { locale: 'de-DE' } });
    // Intl puts a no-break space before the symbol.
    expect(labels.map((label) => label.replace(/\s/g, ' '))).toEqual(['1.300 €', '300 €']);
  });

  it('keep the section name in front when section labels are on', () => {
    const deals = measure({ name: 'deals', title: 'Deals', inputs: { prefix: '$' } });
    const { labels } = labelsOf({ countMeasure: deals, showSectionLabels: true });
    expect(labels).toEqual(['Leads: $1,300', 'Won: $300']);
  });

  it('still print shares when percentages are on', () => {
    const deals = measure({ name: 'deals', title: 'Deals', inputs: { prefix: '$' } });
    expect(labelsOf({ countMeasure: deals, displayPercentages: true }).labels).toEqual(['81.3%', '18.8%']);
    expect(labelsOf({ countMeasure: deals, displayPercentages: true, showSectionLabels: true }).labels).toEqual([
      'Leads: 81.3%',
      'Won: 18.8%',
    ]);
  });
});
