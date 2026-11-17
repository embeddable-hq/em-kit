import fs from 'node:fs';
import path from 'node:path';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { ChartsProvider } from '../src';
import { defaultChartOptions, defaultStyles } from '../src/theme';
import { createPieClickHandler, getPieChartProData } from '../src/generated/components/charts/pies/pies.utils';
import { propNote } from '../site/catalog/propNotes';
import { dimension, measure } from '../src';
import { GranularitySelectField } from '../src/generated/components/editors/shared/GranularitySelectField/GranularitySelectField';

// The package's own defaults for how a chart looks (src/theme.ts) and the
// rewrites in scripts/sync.mjs that go with them.

type Opts = { scales?: Record<string, { ticks?: { maxTicksLimit?: number } }>; plugins?: { legend?: { labels?: { filter?: (item: unknown, data: { datasets: unknown[] }) => boolean } } } };
const optionsOf = (name: keyof typeof defaultChartOptions) => defaultChartOptions[name].options as Opts;

describe('chart defaults', () => {
  it('caps every value axis at six ticks', () => {
    const valueAxes: Record<string, string[]> = {
      barChartDefaultPro: ['y'],
      barChartDefaultHorizontalPro: ['x'],
      barChartStackedHorizontalPro: ['x'],
      lineChartDefaultPro: ['y'],
      areaChartPro: ['y'],
      barLineChartPro: ['y'],
      scatterChartPro: ['x', 'y'],
    };
    for (const [chart, axes] of Object.entries(valueAxes)) {
      for (const axis of axes) expect(optionsOf(chart as keyof typeof defaultChartOptions).scales?.[axis]?.ticks?.maxTicksLimit, `${chart}.${axis}`).toBe(6);
    }
  });

  it('lets date axes and horizontal value axes skip labels rather than tilt them', () => {
    for (const chart of ['lineChartDefaultPro', 'lineChartGroupedPro', 'areaChartPro'] as const) {
      expect((optionsOf(chart).scales?.x?.ticks as { maxRotation?: number })?.maxRotation, chart).toBe(0);
    }
    expect((optionsOf('barChartDefaultHorizontalPro').scales?.x?.ticks as { maxRotation?: number })?.maxRotation).toBe(0);
    // A category axis keeps every label.
    expect(optionsOf('barChartDefaultPro').scales?.x).toBeUndefined();
  });

  it('leaves the combo chart’s right axis to the component, which builds it only when a measure asks', () => {
    expect(optionsOf('barLineChartPro').scales?.y1).toBeUndefined();
  });

  it('hides a legend that would have one entry, and keeps it for two or more', () => {
    const filter = optionsOf('barChartDefaultPro').plugins!.legend!.labels!.filter!;
    expect(filter({}, { datasets: [{}] })).toBe(false);
    expect(filter({}, { datasets: [{}, {}] })).toBe(true);
  });

  it('keeps legends on pies, donuts and funnels, where each entry is a slice', () => {
    for (const chart of Object.keys(defaultChartOptions)) expect(chart).not.toMatch(/pie|donut|funnel/i);
  });

  it('draws inactive KPI tabs at full opacity with the theme’s muted text', () => {
    expect(defaultStyles['--em-charttabs-item-opacity']).toBe('1');
    expect(defaultStyles['--em-charttabs-item-label-color']).toBe('var(--em-sem-text--muted)');
  });

  it('takes a KPI tab’s hover background from the theme, so a dark theme does not get a white tab', () => {
    const hover = defaultStyles['--em-charttabs-item-background--hover'];
    expect(hover).toMatch(/^var\(--em-sem-background/);
    expect(hover).not.toMatch(/#|rgb/);
  });
});

describe('table cell copy buttons', () => {
  it('show whenever keyboard focus is in their cell, not only on hover', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '../src/generated-ui/components/charts/tables/Table/components/TableBody/TableBody.module.css'), 'utf-8');
    expect(css).toMatch(/\.tableBody td:hover \.copyButton,\s*\.tableBody td:focus-within \.copyButton \{\s*opacity: 1;/);
  });
});

// As ChartGranularitySelectField passes them: one array for every render, so
// the field's memo of its options does not recompute on its own.
const GRANULARITIES: ('week' | 'month' | 'quarter')[] = ['week', 'month', 'quarter'];
const noop = () => {};

describe('granularity picker', () => {
  it('relabels its value when the provider’s language changes', () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const tree = (language: string) => (
      <ChartsProvider theme={{ i18n: { language } }}>
        <GranularitySelectField granularity="month" granularities={GRANULARITIES} onChange={noop} />
      </ChartsProvider>
    );
    act(() => root.render(tree('en')));
    expect(container.textContent).toContain('Month');
    act(() => root.render(tree('de')));
    expect(container.textContent).toContain('Monat');
    act(() => root.unmount());
    container.remove();
  });
});

describe('pie and donut clicks', () => {
  // The docs say so on onSegmentClick; if upstream fixes the handler, this fails and the note goes.
  it('report the first bundled row for the “Other” slice, as the prop note says', () => {
    const plan = dimension({ name: 'plan' });
    const seats = measure({ name: 'seats' });
    const rows = ['A', 'B', 'C', 'D', 'E'].map((p, i) => ({ plan: p, seats: 10 - i }));
    const drawn = getPieChartProData({ data: rows, dimension: plan, measure: seats, maxLegendItems: 3 });
    expect(drawn.labels).toHaveLength(3);
    let payload: { dimensionValue?: unknown } | undefined;
    const click = createPieClickHandler({ results: { isLoading: false, data: rows }, dimension: plan, measure: seats, onClicked: (p) => (payload = p) });
    click({ elementAtEvent: [{ index: 2, datasetIndex: 0 }] } as unknown as Parameters<typeof click>[0]);
    expect(payload?.dimensionValue).toBe('C');
    expect(propNote('onSegmentClick')).toContain('“Other” segment reports the first of the rows it adds up');
  });
});
