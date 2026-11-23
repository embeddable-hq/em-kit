import { useEffect, useRef, useState, type ComponentType } from 'react';
import GeneratedFilterBuilder, {
  type FilterBuilderProProps,
  type FilterBuilderState,
} from './generated/components/editors/filters/FilterBuilderPro';
import GeneratedFilterBuilderWithGrouping, {
  type FilterBuilderWithGroupingProProps,
} from './generated/components/editors/filters/FilterBuilderWithGroupingPro';
import {
  type FilterBuilderGroupingState,
  getFilterNodes,
  isFilterBuilderGroup,
} from './generated/components/editors/filters/FilterBuilderWithGroupingPro/FilterBuilderWithGroupingPro.utils';
import {
  type FilterBuilderClause,
  type FilterBuilderFilter,
  filterBuilderAndOrOperator,
  filtersToClause,
} from './generated/components/editors/filters/filters.utils';
import { componentDefaults } from './componentDefaults.generated';
import { type DataResponse, type Dimension, isDimension } from './runtime/core';
import { withDefaults } from './withDefaults';

export type { FilterBuilderClause };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

/**
 * The values a filter on `field` can pick from: rows holding `field.name`,
 * matching `search` when it is set. `otherFilters` are the reader's other
 * filters, for options that narrow as the reader filters.
 */
export type LoadFilterOptions = (
  field: Dimension,
  search: string,
  otherFilters: FilterBuilderClause | null,
) => Record<string, unknown>[] | Promise<Record<string, unknown>[]>;

type WrapperProps = {
  /** The filters the builder starts with. With `syncDefaultFilters`, later changes replace the reader's. */
  value?: FilterBuilderClause | null;
  /** Called with the filters as a clause tree, or `null` when there are none. */
  onChange?: (value: FilterBuilderClause | null) => void;
  loadOptions?: LoadFilterOptions;
};

type Internal = 'embeddableState' | 'setEmbeddableState' | 'defaultFilters' | 'onChange' | 'componentName';
export type FilterBuilderProps = Omit<FilterBuilderProProps, Internal> & WrapperProps;
export type FilterBuilderWithGroupingProps = Omit<FilterBuilderWithGroupingProProps, Internal> & WrapperProps;

// Upstream reads each dimension filter's options from a `filterResults<id>`
// prop that Embeddable loads; here loadOptions loads them, once per filter,
// field, search and other filters.
const useFilterResults = (filters: FilterBuilderFilter[], loadOptions?: LoadFilterOptions) => {
  const [loaded, setLoaded] = useState<Record<string, DataResponse>>({});
  const started = useRef(new Set<string>());

  const requests = filters.flatMap((filter) => {
    const field = filter.dimensionOrMeasure ?? undefined;
    if (!isDimension(field) || !filter.operator) return [];
    const others = filtersToClause(
      filterBuilderAndOrOperator.AND,
      filters.filter((other) => other.id !== filter.id),
    );
    const key = JSON.stringify([filter.id, field.name, filter.search, others]);
    return [{ id: filter.id, field, search: filter.search, others, key }];
  });

  useEffect(() => {
    if (!loadOptions) return;
    for (const { field, search, others, key } of requests) {
      if (started.current.has(key)) continue;
      started.current.add(key);
      Promise.resolve()
        .then(() => loadOptions(field, search, others))
        .then(
          (data) => setLoaded((prev) => ({ ...prev, [key]: { isLoading: false, data } })),
          (error: unknown) => setLoaded((prev) => ({ ...prev, [key]: { isLoading: false, error: String(error) } })),
        );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests.map((r) => r.key).join('\n'), loadOptions]);

  return Object.fromEntries(
    requests.map(({ id, key }) => [`filterResults${id}`, loaded[key] ?? { isLoading: Boolean(loadOptions) }]),
  );
};

const DefaultedFilterBuilder = withDefaults(
  GeneratedFilterBuilder as ComponentType<FilterBuilderProProps>,
  componentDefaults.FilterBuilder,
  'FilterBuilderBase',
);
const DefaultedFilterBuilderWithGrouping = withDefaults(
  GeneratedFilterBuilderWithGrouping as ComponentType<FilterBuilderWithGroupingProProps>,
  componentDefaults.FilterBuilderWithGrouping,
  'FilterBuilderWithGroupingBase',
);

export const FilterBuilder = ({ value, onChange, loadOptions, ...props }: FilterBuilderProps) => {
  const [state, setState] = useState<FilterBuilderState>();
  const results = useFilterResults(state?.filters ?? [], loadOptions);
  return (
    <DefaultedFilterBuilder
      {...props}
      {...results}
      defaultFilters={value ?? undefined}
      onChange={onChange as (value: unknown) => void}
      embeddableState={state}
      setEmbeddableState={setState as FilterBuilderProProps['setEmbeddableState']}
    />
  );
};

export const FilterBuilderWithGrouping = ({ value, onChange, loadOptions, ...props }: FilterBuilderWithGroupingProps) => {
  const [state, setState] = useState<FilterBuilderGroupingState>();
  const filters = getFilterNodes(state).flatMap((node) => (isFilterBuilderGroup(node) ? node.filters : [node]));
  const results = useFilterResults(filters, loadOptions);
  return (
    <DefaultedFilterBuilderWithGrouping
      {...props}
      {...results}
      defaultFilters={value ?? undefined}
      onChange={onChange as (value: unknown) => void}
      embeddableState={state}
      setEmbeddableState={setState as FilterBuilderWithGroupingProProps['setEmbeddableState']}
    />
  );
};

const matches = (row: Row, clause: FilterBuilderClause): boolean => {
  if ('clauses' in clause) {
    const test = (c: FilterBuilderClause) => matches(row, c);
    return clause.operator === filterBuilderAndOrOperator.OR ? clause.clauses.some(test) : clause.clauses.every(test);
  }
  const actual = row[clause.property];
  const { value } = clause;
  const same = (v: unknown) => String(v) === String(actual);
  const text = String(actual ?? '').toLowerCase();
  switch (clause.operator) {
    case 'equals':
      return Array.isArray(value) ? value.some(same) : same(value);
    case 'notEquals':
      return Array.isArray(value) ? !value.some(same) : !same(value);
    case 'contains':
      return Array.isArray(value) ? value.some(same) : text.includes(String(value).toLowerCase());
    case 'notContains':
      return Array.isArray(value) ? !value.some(same) : !text.includes(String(value).toLowerCase());
    case 'gt':
      return Number(actual) > Number(value);
    case 'gte':
      return Number(actual) >= Number(value);
    case 'lt':
      return Number(actual) < Number(value);
    case 'lte':
      return Number(actual) <= Number(value);
    default:
      return true;
  }
};

/** The rows a filter builder's clause keeps, for data held in memory. A `null` clause keeps every row. */
export const applyFilters = <T extends Row>(rows: T[], clause: FilterBuilderClause | null | undefined): T[] =>
  clause ? rows.filter((row) => matches(row, clause)) : rows;
