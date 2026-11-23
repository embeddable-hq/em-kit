import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  ChartsProvider,
  FilterBuilder,
  FilterBuilderWithGrouping,
  applyFilters,
  dimension,
  measure,
  optionsOf,
} from '../src';
import type { FilterBuilderClause } from '../src';

// The filter builders without Embeddable: they keep their own state, report a
// clause through onChange, and load each filter's options through loadOptions.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// The builders scroll their row of filters; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const region = dimension({ name: 'region', title: 'Region' });
const plan = dimension({ name: 'plan', title: 'Plan' });
const revenue = measure({ name: 'revenue', title: 'Revenue' });
const fields = [region, plan, revenue];

const rows = [
  { region: 'EMEA', plan: 'Starter', revenue: 100 },
  { region: 'EMEA', plan: 'Growth', revenue: 250 },
  { region: 'APAC', plan: 'Growth', revenue: 180 },
  { region: 'Americas', plan: 'Enterprise', revenue: 400 },
];

const and = (...clauses: FilterBuilderClause[]): FilterBuilderClause => ({ operator: 'and', clauses });
const or = (...clauses: FilterBuilderClause[]): FilterBuilderClause => ({ operator: 'or', clauses });

describe('applyFilters', () => {
  const regions = (clause: FilterBuilderClause | null) => applyFilters(rows, clause).map((r) => `${r.region}/${r.plan}`);

  it('keeps every row with no clause', () => {
    expect(applyFilters(rows, null)).toHaveLength(4);
  });

  it('applies each operator the builder produces', () => {
    expect(regions(and({ property: 'region', operator: 'equals', value: 'EMEA' }))).toEqual(['EMEA/Starter', 'EMEA/Growth']);
    expect(regions(and({ property: 'region', operator: 'notEquals', value: 'EMEA' }))).toEqual(['APAC/Growth', 'Americas/Enterprise']);
    expect(regions(and({ property: 'region', operator: 'contains', value: ['APAC', 'Americas'] }))).toEqual(['APAC/Growth', 'Americas/Enterprise']);
    expect(regions(and({ property: 'region', operator: 'notContains', value: ['APAC', 'Americas'] }))).toEqual(['EMEA/Starter', 'EMEA/Growth']);
    expect(regions(and({ property: 'region', operator: 'contains', value: 'meri' }))).toEqual(['Americas/Enterprise']);
    expect(regions(and({ property: 'revenue', operator: 'gte', value: 250 }))).toEqual(['EMEA/Growth', 'Americas/Enterprise']);
    expect(regions(and({ property: 'revenue', operator: 'lte', value: 180 }))).toEqual(['EMEA/Starter', 'APAC/Growth']);
  });

  it('combines with and, or and nested groups', () => {
    const growth = { property: 'plan', operator: 'equals', value: 'Growth' } as const;
    const emea = { property: 'region', operator: 'equals', value: 'EMEA' } as const;
    expect(regions(and(growth, emea))).toEqual(['EMEA/Growth']);
    expect(regions(or(growth, emea))).toEqual(['EMEA/Starter', 'EMEA/Growth', 'APAC/Growth']);
    expect(regions(and(emea, or(growth, { property: 'revenue', operator: 'lte', value: 100 })))).toEqual([
      'EMEA/Starter',
      'EMEA/Growth',
    ]);
  });
});

describe('optionsOf with a search', () => {
  it('keeps the values that contain it, ignoring case', () => {
    expect(optionsOf(rows, region, 'ME').data).toEqual([{ region: 'EMEA' }, { region: 'Americas' }]);
  });
});

const mount = (node: React.ReactElement) => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(<ChartsProvider>{node}</ChartsProvider>));
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

describe.each([
  ['FilterBuilder', FilterBuilder],
  ['FilterBuilderWithGrouping', FilterBuilderWithGrouping],
] as const)('%s', (_, Builder) => {
  it('renders its title on a server', () => {
    expect(renderToString(<ChartsProvider><Builder title="Filters" dimensionsAndMeasures={fields} /></ChartsProvider>)).toContain(
      'Filters',
    );
  });

  it('starts from value, reports it, and loads the options of its dimension filters', async () => {
    const value = and({ property: 'region', operator: 'equals', value: 'EMEA' });
    const onChange = vi.fn();
    const loadOptions = vi.fn((_field: { name: string }, search: string) => optionsOf(rows, region, search).data!);
    const shown = mount(<Builder dimensionsAndMeasures={fields} value={value} onChange={onChange} loadOptions={loadOptions} />);
    await act(async () => {});

    expect(onChange).toHaveBeenLastCalledWith(value);
    expect(loadOptions).toHaveBeenCalledTimes(1);
    expect(loadOptions.mock.calls[0]![0].name).toBe('region');
    expect(loadOptions.mock.calls[0]![1]).toBe('');
    expect(shown.container.textContent).toContain('Region');

    shown.unmount();
  });

  it('loads once with an inline loadOptions while the app re-renders', async () => {
    let calls = 0;
    const value = and({ property: 'region', operator: 'equals', value: 'EMEA' });
    const Host = () => {
      const [, setRenders] = useState(0);
      return (
        <Builder
          dimensionsAndMeasures={fields}
          value={value}
          onChange={() => setRenders((n) => n + 1)}
          loadOptions={(_field, search) => (calls++, optionsOf(rows, region, search).data!)}
        />
      );
    };
    const shown = mount(<Host />);
    await act(async () => {});
    expect(calls).toBe(1);
    shown.unmount();
  });
});
