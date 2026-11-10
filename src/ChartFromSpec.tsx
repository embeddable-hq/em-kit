// Renders a serializable ChartSpec (src/spec.ts) with the real components.
// This is the LLM-facing entry point, so it is deliberately forgiving: it
// normalizes the data shapes producers get wrong (date formats, the
// `name.granularity` dual key, numeric strings), falls back to a table for an
// unknown chart kind, and renders the error card instead of throwing. A bad
// spec must always produce something visible.

import { CSSProperties, ReactNode, useContext, useMemo, useState } from 'react';
import dayjs, { QUnitType } from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import isoWeek from 'dayjs/plugin/isoWeek.js';
import quarterOfYear from 'dayjs/plugin/quarterOfYear.js';
import {
  AreaSpec,
  BarGroupedSpec,
  BarLineSpec,
  BarSpec,
  BubbleSpec,
  ChartSpec,
  DateRangeSpec,
  DonutLabelSpec,
  FieldRef,
  HeatMapSpec,
  KpiComparisonSpec,
  KpiSpec,
  LineComparisonSpec,
  LineComparisonWithKpiTabsSpec,
  LineGroupedSpec,
  LineSpec,
  LineWithKpiTabsSpec,
  PieSpec,
  PivotSpec,
  ScatterSpec,
  SpecField,
  SpecRow,
  TableSpec,
  isChartKind,
} from './spec';
import { ChartIntent, ChartIntentType } from './intents';
import { dimension, measure } from './data';
import {
  DataResponse,
  Dimension,
  DimensionOrMeasure,
  Granularity,
  Measure,
  NativeDataType,
  OrderDirection,
  TimeRange,
} from './runtime/core';
import { ThemeContext } from './runtime/react';
import { Theme } from './generated/theme/theme.types';
import { ChartCard } from './generated/components/charts/shared/ChartCard/ChartCard';
// The exported components, with their builder defaults, under the upstream
// names the renderer was written against.
import {
  BarChart as BarChartDefaultPro,
  BarChartHorizontal as BarChartDefaultHorizontalPro,
  BarChartGrouped as BarChartGroupedPro,
  BarChartGroupedHorizontal as BarChartGroupedHorizontalPro,
  BarChartStacked as BarChartStackedPro,
  BarChartStackedHorizontal as BarChartStackedHorizontalPro,
  BarLineChart as BarLineChartPro,
  LineChart as LineChartDefaultPro,
  LineChartGrouped as LineChartGroupedPro,
  AreaChart as AreaChartPro,
  PieChart as PieChartPro,
  DonutChart as DonutChartPro,
  DonutLabelChart as DonutLabelChartPro,
  LineChartComparison as LineChartComparisonDefaultPro,
  LineChartWithKpiTabs as LineChartWithKpiTabsPro,
  LineChartComparisonWithKpiTabs as LineChartComparisonWithKpiTabsPro,
  ScatterChart as ScatterChartPro,
  BubbleChart as BubbleChartPro,
  KpiNumber as KpiChartNumberPro,
  KpiNumberComparison as KpiChartNumberComparisonPro,
  HeatMap as HeatMapPro,
  PivotTable as PivotTablePro,
  TablePaginated as TableChartPaginated,
} from './components.generated';

dayjs.extend(utc);
dayjs.extend(isoWeek);
dayjs.extend(quarterOfYear);

export type ChartFromSpecProps = {
  /** Usually a parsed LLM tool call; validated at runtime, never trusted. */
  spec: ChartSpec;
  /** Receives one serializable intent per user interaction with the chart. */
  onIntent?: (intent: ChartIntent) => void;
  /**
   * How much card chrome to render — the app's choice, not the model's.
   * 'card' is the full card, 'plain' keeps the header but drops the export
   * menu, 'bare' removes the header and flattens the card for embedding in a
   * chat bubble.
   */
  chrome?: 'card' | 'plain' | 'bare';
  /**
   * Fixed height in px. The card fills its parent, so give the chart a
   * definite height when the parent (e.g. a chat bubble) has none.
   */
  height?: number;
};

// The card's chrome is entirely CSS-variable driven, so bare mode flattens it
// from a wrapper element; the chart canvas itself is unaffected (chart.js
// resolves its colors against :root, not this wrapper).
const BARE_CARD_VARS = {
  '--em-card-padding': '0',
  '--em-card-gap': '0',
  '--em-card-border-radius': '0',
  '--em-card-background': 'transparent',
  '--em-card-border-width': '0',
  '--em-card-shadow-blur': '0',
  '--em-card-shadow-spread': '0',
  '--em-card-shadow-position-x': '0',
  '--em-card-shadow-position-y': '0',
} as const;

// theme.charts key per chart kind, for scoped chart.js option overrides.
const THEME_CHART_KEYS: Partial<Record<ChartSpec['chart'], string>> = {
  bar: 'barChartDefaultPro',
  barHorizontal: 'barChartDefaultHorizontalPro',
  barGrouped: 'barChartGroupedPro',
  barGroupedHorizontal: 'barChartGroupedHorizontalPro',
  barStacked: 'barChartStackedPro',
  barStackedHorizontal: 'barChartStackedHorizontalPro',
  line: 'lineChartDefaultPro',
  lineGrouped: 'lineChartGroupedPro',
  lineComparison: 'lineChartComparisonDefaultPro',
  area: 'areaChartPro',
  barLine: 'barLineChartPro',
  pie: 'pieChartPro',
  donut: 'donutChartPro',
  donutLabel: 'donutLabelChartPro',
  scatter: 'scatterChartPro',
  bubble: 'bubbleChartPro',
};

// --- field + row normalization -------------------------------------------

const ISO_LIKE = /^\d{4}-\d{2}-\d{2}([T ]|$)/;
const GRANULARITIES: readonly Granularity[] = [
  'second',
  'minute',
  'hour',
  'day',
  'week',
  'month',
  'quarter',
  'year',
];

const toArray = (refs: FieldRef | FieldRef[] | undefined): FieldRef[] =>
  refs === undefined ? [] : Array.isArray(refs) ? refs : [refs];

const asField = (ref: FieldRef): SpecField => (typeof ref === 'string' ? { name: ref } : ref);

const firstValue = (name: string, rows: SpecRow[] | undefined): unknown =>
  rows?.map((r) => r[name]).find((v) => v !== null && v !== undefined);

const inferType = (name: string, rows: SpecRow[] | undefined): NativeDataType => {
  const v = firstValue(name, rows);
  if (typeof v === 'number') return 'number';
  if (typeof v === 'boolean') return 'boolean';
  if (v instanceof Date) return 'time';
  if (typeof v === 'string' && ISO_LIKE.test(v)) return 'time';
  return 'string';
};

// Components read time values as UTC (gap-filling parses rows with dayjs.utc
// and matches bucket-start keys exactly), so: parse as UTC, snap to the
// bucket start when a granularity applies, and strip the trailing Z.
const utcIso = (v: string | number | Date): string | undefined => {
  const d = dayjs.utc(v);
  return d.isValid() ? d.toISOString().slice(0, -1) : undefined;
};

const toUtcIso = (v: unknown, granularity?: Granularity): unknown => {
  if (typeof v !== 'string' && typeof v !== 'number' && !(v instanceof Date)) return v;
  const d = dayjs.utc(v);
  if (!d.isValid()) return v;
  const snapped = granularity ? d.startOf((granularity === 'week' ? 'isoWeek' : granularity) as QUnitType) : d;
  return snapped.toISOString().slice(0, -1);
};

const isRowObject = (row: unknown): row is SpecRow =>
  typeof row === 'object' && row !== null && !Array.isArray(row);

type ResolvedFields = {
  /** Time dimensions whose row values need coercion (+ dual granularity key). */
  time: { name: string; granularity?: Granularity }[];
  /** Measures whose row values are coerced from numeric strings. */
  numeric: string[];
};

const normalizeRows = (rows: SpecRow[], fields: ResolvedFields): SpecRow[] =>
  rows
    .filter(isRowObject)
    .map((row) => {
      const out: SpecRow = { ...row };
      for (const t of fields.time) {
        const v = out[t.name];
        if (v === null || v === undefined) continue;
        const iso = toUtcIso(v, t.granularity);
        out[t.name] = iso;
        if (t.granularity && out[`${t.name}.${t.granularity}`] === undefined) {
          out[`${t.name}.${t.granularity}`] = iso;
        }
      }
      for (const name of fields.numeric) {
        const v = out[name];
        if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) out[name] = Number(v);
      }
      return out;
    });

// One row holding each measure's total — the KPI-tab and donut-label charts
// read their headline numbers from a single-row response.
const sumRows = (rows: SpecRow[] | undefined, measures: Measure[]): SpecRow[] | undefined => {
  if (!rows || rows.length === 0) return undefined;
  return [
    Object.fromEntries(
      measures.map((m) => [
        m.name,
        rows.reduce((total, row) => {
          const v = row[m.name];
          const n = typeof v === 'number' ? v : Number(v);
          return total + (Number.isFinite(n) ? n : 0);
        }, 0),
      ]),
    ),
  ];
};

// Rows are normalized zone-less ISO strings, so lexicographic order is
// chronological; the extent stands in for an explicit date range.
const rangeFromRows = (rows: SpecRow[] | undefined, timeName: string): TimeRange => {
  const values = (rows ?? [])
    .map((row) => row[timeName])
    .filter((v): v is string => typeof v === 'string')
    .sort();
  if (values.length === 0) return undefined;
  return {
    from: dayjs.utc(values[0]).toDate(),
    to: dayjs.utc(values[values.length - 1]).toDate(),
    relativeTimeString: undefined,
  };
};

const toTimeRange = (range?: DateRangeSpec): TimeRange =>
  range && (range.from || range.to)
    ? {
        from: range.from ? dayjs(range.from).toDate() : undefined,
        to: range.to ? dayjs(range.to).toDate() : undefined,
        relativeTimeString: undefined,
      }
    : undefined;

// --- spec validation -------------------------------------------------------

const REQUIRED: Record<ChartSpec['chart'], string[]> = {
  bar: ['dimension', 'measures'],
  barHorizontal: ['dimension', 'measures'],
  barGrouped: ['xAxis', 'groupBy', 'measure'],
  barGroupedHorizontal: ['xAxis', 'groupBy', 'measure'],
  barStacked: ['xAxis', 'groupBy', 'measure'],
  barStackedHorizontal: ['xAxis', 'groupBy', 'measure'],
  line: ['xAxis', 'measures'],
  lineGrouped: ['xAxis', 'groupBy', 'measure'],
  lineWithKpiTabs: ['xAxis', 'measures'],
  lineComparison: ['xAxis', 'measures'],
  lineComparisonWithKpiTabs: ['xAxis', 'measures'],
  area: ['xAxis', 'measure'],
  barLine: ['dimension', 'barMeasures'],
  pie: ['dimension', 'measure'],
  donut: ['dimension', 'measure'],
  donutLabel: ['dimension', 'measure'],
  scatter: ['xMeasure', 'yMeasure', 'pointDimension'],
  bubble: ['xMeasure', 'yMeasure', 'bubbleSizeMeasure', 'pointDimension'],
  kpi: ['measure'],
  kpiComparison: ['measure'],
  table: ['columns'],
  heatmap: ['rowDimension', 'columnDimension', 'measure'],
  pivot: ['rowDimension', 'columnDimension', 'measures'],
};

const specProblems = (spec: ChartSpec): string[] => {
  const problems: string[] = [];
  for (const key of REQUIRED[spec.chart]) {
    const value = (spec as unknown as Record<string, unknown>)[key];
    if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) {
      problems.push(`missing "${key}"`);
    }
  }
  if (spec.rows !== undefined && !Array.isArray(spec.rows)) problems.push('"rows" must be an array of objects');
  return problems;
};

// --- intents ---------------------------------------------------------------

const serializeValue = (v: unknown): unknown => {
  if (v instanceof Date) return utcIso(v) ?? v;
  if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
    return Object.fromEntries(Object.entries(v).map(([k, inner]) => [k, serializeValue(inner)]));
  }
  return v;
};

const intentTimeRange = (tr: unknown): ChartIntent['timeRange'] => {
  if (typeof tr !== 'object' || tr === null) return undefined;
  const { from, to } = tr as { from?: unknown; to?: unknown };
  if (!from && !to) return undefined;
  return {
    from: from ? utcIso(from as Date | string) : undefined,
    to: to ? utcIso(to as Date | string) : undefined,
  };
};

type PayloadMap = {
  value?: string;
  group?: string;
  measureValue?: string;
  timeRange?: string;
};

// Components report clicks with per-chart payload shapes; this flattens the
// named keys into one ChartIntent and keeps the whole payload under details.
const makeIntentHandler = (
  onIntent: ((intent: ChartIntent) => void) | undefined,
  base: Omit<ChartIntent, 'value' | 'groupValue' | 'measureValue' | 'timeRange' | 'details'>,
  map: PayloadMap,
) => {
  if (!onIntent) return undefined;
  return (payload: unknown) => {
    const record = (typeof payload === 'object' && payload !== null ? payload : {}) as Record<string, unknown>;
    const value = map.value ? record[map.value] : undefined;
    const groupValue = map.group ? record[map.group] : undefined;
    const measureValue = map.measureValue ? record[map.measureValue] : undefined;
    onIntent({
      ...base,
      value: value as ChartIntent['value'],
      groupValue: groupValue as ChartIntent['groupValue'],
      measureValue: typeof measureValue === 'number' ? measureValue : undefined,
      timeRange: map.timeRange ? intentTimeRange(record[map.timeRange]) : undefined,
      details: serializeValue(record) as Record<string, unknown>,
    });
  };
};

// --- rendering -------------------------------------------------------------

type TableState = {
  page: number;
  pageSize?: number;
  sort?: { id: string; direction: OrderDirection };
  isLoadingDownloadData: boolean;
};

const sortRows = (rows: SpecRow[], sort: TableState['sort']): SpecRow[] => {
  if (!sort) return rows;
  const factor = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[sort.id] as string | number | null | undefined;
    const bv = b[sort.id] as string | number | null | undefined;
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    return (av < bv ? -1 : av > bv ? 1 : 0) * factor;
  });
};

const SpecError = ({
  title,
  message,
  chrome,
}: {
  title?: string;
  message: string;
  chrome?: 'card' | 'plain' | 'bare';
}) => (
  <ChartCard
    data={{ isLoading: false }}
    errorMessage={message}
    title={title}
    hideMenu={chrome === 'bare'}
    menuOptions={chrome === 'plain' ? [] : undefined}
  >
    {null}
  </ChartCard>
);

export const ChartFromSpec = ({ spec, onIntent, chrome = 'card', height }: ChartFromSpecProps) => {
  const [tableState, setTableState] = useState<TableState>({ page: 0, isLoadingDownloadData: false });
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);

  const node = useMemo<ReactNode>(() => {
    const render = (): ReactNode => {
      if (typeof spec !== 'object' || spec === null) {
        return <SpecError chrome={chrome} message="The chart spec must be an object." />;
      }
      try {
        if (!isChartKind(spec.chart)) {
          // Unknown kind: the data is still worth showing — degrade to a table
          // over every row key, or explain when there are no rows either.
          const rows = Array.isArray(spec.rows) ? spec.rows.filter(isRowObject) : [];
          if (rows.length > 0) {
            const fallback: TableSpec = {
              chart: 'table',
              title: spec.title,
              description: spec.description,
              rows,
              loading: spec.loading,
              error: spec.error,
              columns: Object.keys(rows[0]!),
            };
            return renderSpec(fallback);
          }
          return (
            <SpecError
              chrome={chrome}
              title={spec.title}
              message={`Unknown chart kind "${String((spec as { chart?: unknown }).chart)}" and no rows to fall back to.`}
            />
          );
        }
        const problems = specProblems(spec);
        if (problems.length > 0) {
          return <SpecError chrome={chrome} title={spec.title} message={`Invalid "${spec.chart}" spec: ${problems.join(', ')}.`} />;
        }
        return renderSpec(spec);
      } catch (error) {
        return <SpecError chrome={chrome} title={spec.title} message={error instanceof Error ? error.message : String(error)} />;
      }
    };

    const renderSpec = (valid: ChartSpec): ReactNode => {
      const granularity =
        'granularity' in valid && valid.granularity && GRANULARITIES.includes(valid.granularity)
          ? valid.granularity
          : undefined;
      const rawRows = Array.isArray(valid.rows) ? valid.rows.filter(isRowObject) : undefined;

      // A field that carries the chart's granularity is a time field by
      // definition; anything else falls back to its declared/inferred type.
      const fieldType = (f: SpecField, isAxis: boolean): NativeDataType =>
        f.type ?? (isAxis && granularity ? 'time' : inferType(f.name, rawRows));

      const toDimension = (ref: FieldRef, isAxis = false): Dimension => {
        const f = asField(ref);
        return dimension({
          name: f.name,
          title: f.title,
          type: fieldType(f, isAxis),
          inputs: f.format,
          granularity: isAxis ? granularity : undefined,
        });
      };

      const toMeasure = (ref: FieldRef): Measure => {
        const f = asField(ref);
        return measure({ name: f.name, title: f.title, type: f.type ?? 'number', inputs: f.format });
      };

      const prepareRows = (rows: SpecRow[] | undefined, dims: Dimension[], meas: Measure[]) =>
        rows === undefined
          ? undefined
          : normalizeRows(rows, {
              time: dims
                .filter((d) => d.nativeType === 'time')
                .map((d) => ({ name: d.name, granularity: d.inputs?.granularity })),
              numeric: meas.filter((m) => m.nativeType === 'number').map((m) => m.name),
            });

      const toResponse = (rows: SpecRow[] | undefined): DataResponse => {
        if (valid.error) return { isLoading: false, error: valid.error };
        if (rows === undefined) return { isLoading: true };
        // loading + rows = streaming: ChartCard draws the chart and shows the
        // header spinner instead of the skeleton.
        return { isLoading: Boolean(valid.loading), data: rows };
      };

      const header = {
        title: valid.title,
        description: valid.description,
        ...(chrome === 'plain' ? { menuOptions: [] } : {}),
        ...(chrome === 'bare' ? { hideMenu: true } : {}),
      };
      const intent = (type: ChartIntentType, dims: { dimension?: string; groupDimension?: string }, map: PayloadMap) =>
        makeIntentHandler(onIntent, { type, chart: valid.chart, title: valid.title, ...dims }, map);

      switch (valid.chart) {
        case 'bar':
        case 'barHorizontal': {
          const s = valid as BarSpec;
          const dim = toDimension(s.dimension, true);
          const meas = toArray(s.measures).map(toMeasure);
          const results = toResponse(prepareRows(rawRows, [dim], meas));
          const onBarClicked = intent('bar-click', { dimension: dim.name }, { value: 'dimensionValue', timeRange: 'dimensionTimeRange' });
          const o = s.options ?? {};
          if (valid.chart === 'barHorizontal') {
            const { xAxisLabel, yAxisLabel, yAxisRangeMin, yAxisRangeMax, reverseXAxis, xAxisMaxItems, ...rest } = o;
            return (
              <BarChartDefaultHorizontalPro
                {...header}
                {...rest}
                dimension={dim}
                measures={meas}
                results={results}
                granularity={granularity}
                xAxisLabel={yAxisLabel}
                yAxisLabel={xAxisLabel}
                xAxisRangeMin={yAxisRangeMin}
                xAxisRangeMax={yAxisRangeMax}
                reverseYAxis={reverseXAxis}
                yAxisMaxItems={xAxisMaxItems}
                onBarClicked={onBarClicked}
              />
            );
          }
          return (
            <BarChartDefaultPro
              {...header}
              {...o}
              dimension={dim}
              measures={meas}
              results={results}
              granularity={granularity}
              onBarClicked={onBarClicked}
            />
          );
        }

        case 'barGrouped':
        case 'barGroupedHorizontal':
        case 'barStacked':
        case 'barStackedHorizontal': {
          const s = valid as BarGroupedSpec;
          const axis = toDimension(s.xAxis, true);
          const group = toDimension(s.groupBy);
          const meas = toMeasure(s.measure);
          const results = toResponse(prepareRows(rawRows, [axis, group], [meas]));
          const onBarClicked = intent(
            'bar-click',
            { dimension: axis.name, groupDimension: group.name },
            { value: 'dimensionValue', group: 'groupingDimensionValue', timeRange: 'dimensionTimeRange' },
          );
          const shared = { ...header, groupBy: group, measure: meas, results, granularity, onBarClicked };
          const o = s.options ?? {};
          const horizontal = valid.chart === 'barGroupedHorizontal' || valid.chart === 'barStackedHorizontal';
          if (horizontal) {
            const { xAxisLabel, yAxisLabel, yAxisRangeMin, yAxisRangeMax, reverseXAxis, xAxisMaxItems, ...rest } = o;
            void xAxisMaxItems;
            const props = {
              ...shared,
              ...rest,
              yAxis: axis,
              xAxisLabel: yAxisLabel,
              yAxisLabel: xAxisLabel,
              xAxisRangeMin: yAxisRangeMin,
              xAxisRangeMax: yAxisRangeMax,
              reverseYAxis: reverseXAxis,
            };
            return valid.chart === 'barGroupedHorizontal' ? (
              <BarChartGroupedHorizontalPro {...props} />
            ) : (
              <BarChartStackedHorizontalPro {...props} />
            );
          }
          const props = { ...shared, ...o, xAxis: axis };
          return valid.chart === 'barGrouped' ? <BarChartGroupedPro {...props} /> : <BarChartStackedPro {...props} />;
        }

        case 'line': {
          const s = valid as LineSpec;
          const axis = toDimension(s.xAxis, true);
          const meas = toArray(s.measures).map(toMeasure);
          return (
            <LineChartDefaultPro
              {...header}
              {...(s.options ?? {})}
              xAxis={axis}
              measures={meas}
              results={toResponse(prepareRows(rawRows, [axis], meas))}
              granularity={granularity}
              onLineClicked={intent(
                'line-click',
                { dimension: axis.name },
                { value: 'dimensionValue', measureValue: 'measureValue', timeRange: 'dimensionTimeRange' },
              )}
            />
          );
        }

        case 'lineGrouped': {
          const s = valid as LineGroupedSpec;
          const axis = toDimension(s.xAxis, true);
          const group = toDimension(s.groupBy);
          const meas = toMeasure(s.measure);
          return (
            <LineChartGroupedPro
              {...header}
              {...(s.options ?? {})}
              xAxis={axis}
              groupBy={group}
              measure={meas}
              results={toResponse(prepareRows(rawRows, [axis, group], [meas]))}
              granularity={granularity}
              onLineClicked={intent(
                'line-click',
                { dimension: axis.name, groupDimension: group.name },
                { value: 'dimensionValue', group: 'groupingDimensionValue', timeRange: 'dimensionTimeRange' },
              )}
            />
          );
        }

        case 'lineWithKpiTabs': {
          const s = valid as LineWithKpiTabsSpec;
          const axis = toDimension(s.xAxis, true);
          const meas = toArray(s.measures).map(toMeasure);
          const rows = prepareRows(rawRows, [axis], meas);
          const kpiRows = s.kpiRows ?? sumRows(rows, meas);
          return (
            <LineChartWithKpiTabsPro
              {...header}
              {...(s.options ?? {})}
              xAxis={axis}
              measures={meas}
              results={toResponse(rows)}
              resultsKpis={
                kpiRows ? { isLoading: false, data: prepareRows(kpiRows, [], meas) } : { isLoading: true }
              }
              granularity={granularity}
              onLineClicked={intent(
                'line-click',
                { dimension: axis.name },
                { value: 'dimensionValue', measureValue: 'measureValue', timeRange: 'dimensionTimeRange' },
              )}
            />
          );
        }

        case 'lineComparison':
        case 'lineComparisonWithKpiTabs': {
          const s = valid as LineComparisonSpec | LineComparisonWithKpiTabsSpec;
          const axis = toDimension(s.xAxis, true);
          const meas = toArray(s.measures).map(toMeasure);
          const rows = prepareRows(rawRows, [axis], meas);
          const comparisonRows = Array.isArray(s.comparisonRows)
            ? prepareRows(s.comparisonRows, [axis], meas)
            : undefined;
          const shared = {
            ...header,
            ...(s.options ?? {}),
            xAxis: axis,
            measures: meas,
            results: toResponse(rows),
            resultsComparison: comparisonRows ? { isLoading: false, data: comparisonRows } : undefined,
            comparisonPeriod: s.comparisonLabel,
            primaryDateRange: toTimeRange(s.dateRange) ?? rangeFromRows(rows, axis.name),
            comparisonDateRange: toTimeRange(s.comparisonDateRange) ?? rangeFromRows(comparisonRows, axis.name),
            granularity,
            onLineClicked: intent(
              'line-click',
              { dimension: axis.name },
              { value: 'dimensionValue', measureValue: 'measureValue', timeRange: 'dimensionTimeRange' },
            ),
          };
          if (valid.chart === 'lineComparison') return <LineChartComparisonDefaultPro {...shared} />;
          const t = valid as LineComparisonWithKpiTabsSpec;
          const kpiRows = t.kpiRows ?? sumRows(rows, meas);
          const kpiComparisonRows = t.kpiComparisonRows ?? sumRows(comparisonRows, meas);
          return (
            <LineChartComparisonWithKpiTabsPro
              {...shared}
              resultsKpis={
                kpiRows ? { isLoading: false, data: prepareRows(kpiRows, [], meas) } : { isLoading: true }
              }
              resultsKpisComparison={
                kpiComparisonRows
                  ? { isLoading: false, data: prepareRows(kpiComparisonRows, [], meas) }
                  : undefined
              }
            />
          );
        }

        case 'area': {
          const s = valid as AreaSpec;
          const axis = toDimension(s.xAxis, true);
          const meas = toMeasure(s.measure);
          // The component requires a stacking dimension; a single-series area
          // gets a constant synthesized group named after the measure.
          const group = s.groupBy ? toDimension(s.groupBy) : dimension({ name: '__series', title: meas.title });
          let rows = prepareRows(rawRows, [axis, group], [meas]);
          if (!s.groupBy && rows) rows = rows.map((row) => ({ ...row, __series: meas.title }));
          return (
            <AreaChartPro
              {...header}
              {...(s.options ?? {})}
              xAxis={axis}
              groupBy={group}
              measure={meas}
              results={toResponse(rows)}
              granularity={granularity}
              onPointClicked={intent(
                'point-click',
                { dimension: axis.name, groupDimension: s.groupBy ? group.name : undefined },
                { value: 'dimensionValue', measureValue: 'measureValue', timeRange: 'dimensionTimeRange' },
              )}
              onAreaClicked={
                s.groupBy
                  ? intent('area-click', { groupDimension: group.name }, { group: 'groupingDimensionValue' })
                  : undefined
              }
            />
          );
        }

        case 'barLine': {
          const s = valid as BarLineSpec;
          const dim = toDimension(s.dimension, true);
          const bars = toArray(s.barMeasures).map(toMeasure);
          const lines = toArray(s.lineMeasures).map(toMeasure);
          const results = toResponse(prepareRows(rawRows, [dim], [...bars, ...lines]));
          const map: PayloadMap = { value: 'dimensionValue', timeRange: 'dimensionTimeRange' };
          return (
            <BarLineChartPro
              {...header}
              {...(s.options ?? {})}
              dimension={dim}
              measures={bars}
              lineMeasures={lines.length > 0 ? lines : undefined}
              results={results}
              granularity={granularity}
              onBarClicked={intent('bar-click', { dimension: dim.name }, map)}
              onLineClicked={intent('line-click', { dimension: dim.name }, map)}
            />
          );
        }

        case 'pie':
        case 'donut': {
          const s = valid as PieSpec;
          const dim = toDimension(s.dimension);
          const meas = toMeasure(s.measure);
          const props = {
            ...header,
            ...(s.options ?? {}),
            dimension: dim,
            measure: meas,
            results: toResponse(prepareRows(rawRows, [dim], [meas])),
            onSegmentClick: intent(
              'segment-click',
              { dimension: dim.name },
              { value: 'dimensionValue', timeRange: 'dimensionTimeRange' },
            ),
          };
          return valid.chart === 'pie' ? <PieChartPro {...props} /> : <DonutChartPro {...props} />;
        }

        case 'donutLabel': {
          const s = valid as DonutLabelSpec;
          const dim = toDimension(s.dimension);
          const meas = toMeasure(s.measure);
          const innerMeasure = s.innerLabel?.measure ? toMeasure(s.innerLabel.measure) : meas;
          const rows = prepareRows(rawRows, [dim], [meas]);
          const innerRows =
            s.innerLabel?.value !== undefined
              ? [{ [innerMeasure.name]: s.innerLabel.value }]
              : sumRows(rows, [innerMeasure]);
          return (
            <DonutLabelChartPro
              {...header}
              {...(s.options ?? {})}
              dimension={dim}
              measure={meas}
              results={toResponse(rows)}
              innerLabelMeasure={innerMeasure}
              innerLabelText={s.innerLabel?.text}
              resultsInnerLabel={
                innerRows
                  ? { isLoading: false, data: prepareRows(innerRows, [], [innerMeasure]) }
                  : { isLoading: true }
              }
              onSegmentClick={intent(
                'segment-click',
                { dimension: dim.name },
                { value: 'dimensionValue', timeRange: 'dimensionTimeRange' },
              )}
            />
          );
        }

        case 'scatter':
        case 'bubble': {
          const s = valid as ScatterSpec;
          const point = toDimension(s.pointDimension);
          const group = s.groupByDimension ? toDimension(s.groupByDimension) : undefined;
          const x = toMeasure(s.xMeasure);
          const y = toMeasure(s.yMeasure);
          const size = valid.chart === 'bubble' ? toMeasure((valid as BubbleSpec).bubbleSizeMeasure) : undefined;
          const meas = [x, y, ...(size ? [size] : [])];
          const props = {
            ...header,
            ...(s.options ?? {}),
            xMeasure: x,
            yMeasure: y,
            pointDimension: point,
            groupByDimension: group,
            results: toResponse(prepareRows(rawRows, [point, ...(group ? [group] : [])], meas)),
            onPointClick: intent(
              'point-click',
              { dimension: point.name, groupDimension: group?.name },
              { value: 'pointDimensionValue', group: 'groupByDimensionValue' },
            ),
          };
          return valid.chart === 'scatter' ? (
            <ScatterChartPro {...props} />
          ) : (
            <BubbleChartPro {...props} bubbleSizeMeasure={size!} />
          );
        }

        case 'kpi': {
          const s = valid as KpiSpec;
          const meas = toMeasure(s.measure);
          const rows = rawRows ?? (s.value !== undefined ? [{ [meas.name]: s.value }] : undefined);
          return (
            <KpiChartNumberPro
              {...header}
              {...(s.options ?? {})}
              measure={meas}
              results={toResponse(prepareRows(rows, [], [meas]))}
            />
          );
        }

        case 'kpiComparison': {
          const s = valid as KpiComparisonSpec;
          const meas = toMeasure(s.measure);
          const rows = rawRows ?? (s.value !== undefined ? [{ [meas.name]: s.value }] : undefined);
          const comparisonRows =
            s.comparisonRows ?? (s.comparisonValue !== undefined ? [{ [meas.name]: s.comparisonValue }] : undefined);
          // The component only shows the change badge when comparisonDateRange
          // is truthy, so comparison data without explicit dates gets an
          // empty-but-truthy range.
          const comparisonDateRange =
            toTimeRange(s.comparisonDateRange) ??
            (comparisonRows && comparisonRows.length > 0
              ? { from: undefined, to: undefined, relativeTimeString: undefined }
              : undefined);
          return (
            <KpiChartNumberComparisonPro
              {...header}
              {...(s.options ?? {})}
              measure={meas}
              results={toResponse(prepareRows(rows, [], [meas]))}
              resultsComparison={comparisonRows ? toResponse(prepareRows(comparisonRows, [], [meas])) : undefined}
              comparisonPeriod={s.comparisonLabel}
              primaryDateRange={toTimeRange(s.dateRange)}
              comparisonDateRange={comparisonDateRange}
            />
          );
        }

        case 'table': {
          const s = valid as TableSpec;
          const columns: DimensionOrMeasure[] = s.columns.map((ref) => {
            const f = asField(ref);
            const type = f.type ?? inferType(f.name, rawRows);
            const role = f.role ?? (type === 'number' ? 'measure' : 'dimension');
            return role === 'measure' ? toMeasure(ref) : toDimension(ref);
          });
          const dims = columns.filter((c): c is Dimension => c.__type__ === 'dimension');
          const meas = columns.filter((c): c is Measure => c.__type__ === 'measure');
          const allRows = prepareRows(rawRows, dims, meas);
          const pageSize = tableState.pageSize ?? 10;
          const pageRows = allRows
            ? sortRows(allRows, tableState.sort).slice(tableState.page * pageSize, (tableState.page + 1) * pageSize)
            : undefined;
          const clickDimension = dims[0];
          return (
            <TableChartPaginated
              {...header}
              {...(s.options ?? {})}
              dimensionsAndMeasures={columns}
              results={toResponse(pageRows)}
              totalResults={allRows ? { isLoading: false, total: allRows.length } : { isLoading: true }}
              state={tableState}
              setState={setTableState}
              clickDimension={clickDimension}
              onRowClicked={
                clickDimension
                  ? intent(
                      'row-click',
                      { dimension: clickDimension.name },
                      { value: 'dimensionValue', timeRange: 'dimensionTimeRange' },
                    )
                  : undefined
              }
            />
          );
        }

        case 'heatmap': {
          const s = valid as HeatMapSpec;
          const row = toDimension(s.rowDimension, true);
          const column = toDimension(s.columnDimension);
          const meas = toMeasure(s.measure);
          return (
            <HeatMapPro
              {...header}
              {...(s.options ?? {})}
              rowDimension={row}
              columnDimension={column}
              measure={meas}
              results={toResponse(prepareRows(rawRows, [row, column], [meas]))}
              onCellClicked={intent(
                'cell-click',
                { dimension: row.name, groupDimension: column.name },
                { value: 'rowDimensionValue', group: 'columnDimensionValue', timeRange: 'rowDimensionTimeRange' },
              )}
            />
          );
        }

        case 'pivot': {
          const s = valid as PivotSpec;
          const row = toDimension(s.rowDimension);
          const column = toDimension(s.columnDimension);
          const subRow = s.subRowDimension ? toDimension(s.subRowDimension) : undefined;
          const meas = toArray(s.measures).map(toMeasure);
          const dims = [row, column, ...(subRow ? [subRow] : [])];
          return (
            <PivotTablePro
              {...header}
              {...(s.options ?? {})}
              rowDimension={row}
              columnDimension={column}
              subRowDimension={subRow}
              measures={meas}
              results={toResponse(prepareRows(rawRows, dims, meas))}
              resultsSubRows={
                s.subRows && Array.isArray(s.subRows)
                  ? toResponse(prepareRows(s.subRows, dims, meas))
                  : undefined
              }
              expandedRowKeys={expandedRowKeys}
              setExpandedRowKey={(key: string) =>
                setExpandedRowKeys((keys) =>
                  keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key],
                )
              }
            />
          );
        }
      }
      // Exhaustive switch; TypeScript narrows `valid.chart` to never here.
      return null;
    };

    return render();
  }, [spec, onIntent, chrome, tableState, expandedRowKeys]);

  // While streaming (loading with rows already present), shorten the chart.js
  // tween for this chart only, so each batch glides instead of restarting the
  // ~1s intro animation. Scoped via ThemeContext so the outer theme is kept.
  const outerTheme = useContext(ThemeContext) as Theme | null;
  const themeKey =
    typeof spec === 'object' && spec !== null && isChartKind(spec.chart) ? THEME_CHART_KEYS[spec.chart] : undefined;
  const streaming =
    typeof spec === 'object' && spec !== null && Boolean(spec.loading) && Array.isArray(spec.rows) && spec.rows.length > 0;
  // Free-form comparison labels only render if they resolve through
  // theme.defaults.comparisonPeriodsOptions, so unknown labels are added as
  // an option scoped to this one chart.
  const comparisonLabel =
    typeof spec === 'object' &&
    spec !== null &&
    (spec.chart === 'kpiComparison' || spec.chart === 'lineComparison' || spec.chart === 'lineComparisonWithKpiTabs')
      ? spec.comparisonLabel
      : undefined;

  const patchedTheme = useMemo<Theme | undefined>(() => {
    if (!outerTheme) return undefined;
    let theme = outerTheme;
    if (streaming && themeKey) {
      const charts = theme.charts as unknown as Record<string, { options?: Record<string, unknown> } | undefined>;
      const existing = charts?.[themeKey];
      theme = {
        ...theme,
        charts: {
          ...theme.charts,
          [themeKey]: {
            ...existing,
            options: { animation: { duration: 300 }, ...existing?.options },
          },
        },
      } as Theme;
    }
    const periods = theme.defaults?.comparisonPeriodsOptions ?? [];
    if (comparisonLabel && !periods.some((option) => option.value === comparisonLabel)) {
      theme = {
        ...theme,
        defaults: {
          ...theme.defaults,
          comparisonPeriodsOptions: [
            ...periods,
            { value: comparisonLabel, label: comparisonLabel, dateFormat: 'MMM D, YYYY', getRange: () => undefined },
          ],
        },
      } as Theme;
    }
    return theme === outerTheme ? undefined : theme;
  }, [outerTheme, streaming, themeKey, comparisonLabel]);

  const content = patchedTheme ? (
    <ThemeContext.Provider value={patchedTheme}>{node}</ThemeContext.Provider>
  ) : (
    node
  );

  if (chrome === 'bare' || height !== undefined) {
    const style = {
      ...(height !== undefined ? { height } : {}),
      ...(chrome === 'bare' ? BARE_CARD_VARS : {}),
    } as CSSProperties;
    return <div style={style}>{content}</div>;
  }
  return <>{content}</>;
};
