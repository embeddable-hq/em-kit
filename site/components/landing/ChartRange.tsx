import { useMemo } from 'react';
import { ChartsProvider } from '../../../src';
import type { DataResponse, Dimension, Granularity, Measure } from '../../../src';
import { buildChart, ChartRuntime, ChartSettings } from '../../catalog/build';
import { datasets, WINDOWS } from '../../catalog/datasets';
import { ChartEntry, getEntry } from '../../catalog/registry';
import { codeSettings, componentExamples, exampleCode } from '../../content/components';
import { componentPath } from '../../content/routes';
import { useCanvas, useSiteSettings } from '../../state';
import { CopyButton } from '../CopyButton';
import { LiveChart } from '../LiveChart';
import { useChart } from '../useChart';
import { useLandingTheme } from './landingTheme';
import { LazyMount } from './LazyMount';

// Eight of the components, live, one per kind of chart. Each is the registry's
// own preview, so it matches the component's docs page. `size` is the cell it
// gets: time series and tables take half a row, the compact charts a quarter.
// A height of 'rows' follows the heat map's row count: see useRowsHeight.
type RangeItem = {
  id: string;
  size: 'half' | 'quarter' | 'full';
  height: number | 'rows';
  overrides?: Pick<ChartSettings, 'overrides' | 'fieldOverrides'>;
  /** Leave one period out of the rows: the card that shows a time series filling its own gaps. */
  gap?: boolean;
  /** Show the card's granularity picker; the rows come back at the granularity picked. */
  picker?: boolean;
};

// In a quarter-width card the value axis has room for "$400K", not "$400,000".
const short = { abbreviateLargeNumber: true };

const range: RangeItem[] = [
  // Taller than its neighbour's content needs: the picker takes a row of the card.
  {
    id: 'line-grouped',
    size: 'half',
    height: 320,
    picker: true,
    overrides: { overrides: { showValueLabels: false } },
  },
  // The components' defaults number a table's rows and label every slice and bar,
  // which crowds a card this small: the regions, slices and bars carry it.
  { id: 'table', size: 'half', height: 320, overrides: { overrides: { showIndex: false } } },
  { id: 'donut', size: 'quarter', height: 264, overrides: { overrides: { showValueLabels: false } } },
  // Half a row: the longest label ("Recherche organique" in French) needs the room.
  // One series, named by the title: no legend.
  {
    id: 'bar-horizontal',
    size: 'half',
    height: 264,
    overrides: { overrides: { showLegend: false, showValueLabels: false }, fieldOverrides: { measures: short } },
  },
  // At a quarter of a row a funnel's last steps are narrower than "Won: 449":
  // the steps go in a legend and the counts in the tooltips, as the funnel's
  // "in a small card" preset (registry.tsx) does on the components index.
  {
    id: 'funnel',
    size: 'quarter',
    height: 264,
    overrides: { overrides: { showLegend: true, showSectionLabels: false, showValueLabels: false } },
  },
  // Labels on every point collide in a small card; the tooltip has the values.
  {
    id: 'scatter',
    size: 'half',
    height: 'rows',
    overrides: { overrides: { showValueLabels: false }, fieldOverrides: { xMeasure: short, yMeasure: short } },
  },
  { id: 'area', size: 'half', height: 'rows', gap: true, overrides: { overrides: { showValueLabels: false } } },
  { id: 'heatmap', size: 'full', height: 'rows' },
];

export type RangeEntry = Omit<RangeItem, 'id'> & { entry: ChartEntry };

export const rangeEntries: RangeEntry[] = range.flatMap(({ id, ...rest }) => {
  const entry = getEntry(id);
  return entry ? [{ entry, ...rest }] : [];
});

/** The id of the card that leaves a period out, for links from elsewhere on the page. */
export const GAP_CARD_ID = 'time-series';

type Site = Pick<ChartSettings, 'themeId' | 'languageId' | 'datasetId'>;
type Props = Record<string, unknown>;

const idle: ChartRuntime = {
  granularity: 'month',
  setGranularity: () => {},
  tableState: { page: 0, isLoadingDownloadData: false },
  setTableState: () => {},
  onEvent: () => {},
};

const settingsFor = (site: Site, overrides?: RangeItem['overrides']): ChartSettings => ({
  themeId: site.themeId,
  languageId: site.languageId,
  datasetId: site.datasetId,
  dataState: 'ready',
  toggles: {},
  ...overrides,
});

// ---- The missing period -------------------------------------------------------

const timeFieldOf = (props: Props) =>
  Object.values(props).find((value): value is Dimension => (value as Dimension | null | undefined)?.nativeType === 'time');

/**
 * A time series' props with a middle period taken out of its rows, and which
 * period that was: April of January to June, so there is area on both sides of
 * the gap. With fewer than three periods there is no middle to leave out, so
 * the props come back as they were.
 */
export const withoutPeriod = (props: Props): { props: Props; missing?: string } => {
  const key = timeFieldOf(props)?.name;
  const results = props.results as DataResponse | undefined;
  const data = results?.data ?? [];
  const periods = key ? [...new Set(data.map((row) => String(row[key])))].sort() : [];
  const missing = periods.length >= 3 ? periods[Math.floor(periods.length / 2)] : undefined;
  if (!key || !results || !missing) return { props };
  return { props: { ...props, results: { ...results, data: data.filter((row) => String(row[key]) !== missing) } }, missing };
};

/** A period as the caption names it: "April", "the week of 6 April", "2026". Site text, so always English. */
export const periodLabel = (period: string, granularity: Granularity) => {
  const date = new Date(period);
  const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', options).format(date);
  if (granularity === 'year') return format({ year: 'numeric' });
  if (granularity === 'quarter') return `the quarter from ${format({ month: 'long' })}`;
  if (granularity === 'month') return format({ month: 'long' });
  if (granularity === 'week') return `the week of ${format({ day: 'numeric', month: 'long' })}`;
  if (granularity === 'day') return format({ day: 'numeric', month: 'long' });
  return format({ day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });
};

const NOTE_HEIGHT = 30;

/** The props with their rows replaced by the card's own: January to June at a granularity. */
export const rowsProps = (props: Props, datasetId: Site['datasetId'], granularity: Granularity): Props => ({
  ...props,
  results: rowsAt(props, datasetId, granularity),
});

// The picker offers week, month and quarter. The rows come from the dataset at
// the granularity picked (useChart holds it and buildChart asks for it), so a
// pick redraws the chart from real rows at that granularity.
// Bounds that give 1 to 100 periods at week, month and quarter: the picker
// offers those three, and not the day or hour, which the rows do not cover.
// January to June: two whole quarters, so the quarter view is not a half-empty
// first bar and a full second one.
const pickerBounds = { from: new Date(WINDOWS.halfYear.from), to: new Date(WINDOWS.halfYear.to), relativeTimeString: '' };

/** The props with the card's granularity picker switched on, on whichever field is the time field. */
const withPicker = (props: Props): Props => {
  const key = Object.keys(props).find((k) => (props[k] as Dimension | null | undefined)?.nativeType === 'time');
  if (!key) return props;
  const field = props[key] as Dimension;
  return { ...props, [key]: { ...field, inputs: { ...field.inputs, showGranularityDropdown: true, dateBounds: pickerBounds } } };
};

// ---- Rows at the granularity picked ---------------------------------------------

/** The first day of the week (Monday), month or quarter a day falls in, as a zone-less ISO string. */
const periodStart = (day: string, granularity: Granularity) => {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  let start = Date.UTC(y, m - 1, 1);
  if (granularity === 'quarter') start = Date.UTC(y, m - 1 - ((m - 1) % 3), 1);
  if (granularity === 'week') start = Date.UTC(y, m - 1, d - ((date.getUTCDay() + 6) % 7));
  if (granularity === 'day') start = date.getTime();
  return new Date(start).toISOString().slice(0, 23);
};

/**
 * The card's rows at a granularity: the dataset's daily rows, summed per week,
 * month or quarter (and per group), each keyed by its first day. This is the
 * query a real app would run; here it is a sum over sample rows.
 */
export const rowsAt = (props: Props, datasetId: Site['datasetId'], granularity: Granularity): DataResponse | undefined => {
  const time = timeFieldOf(props)?.name;
  const group = (props.groupBy as Dimension | undefined)?.name;
  const measure = (props.measure as Measure | undefined)?.name;
  const results = props.results as DataResponse | undefined;
  if (!time || !measure || !results) return results;
  const sums = new Map<string, { key: string; group?: unknown; value: number }>();
  for (const row of datasets[datasetId].byTimeGroupWindow('day', WINDOWS.halfYear)) {
    const key = periodStart(String(row[time]), granularity);
    const g = group ? row[group] : undefined;
    const id = `${key}|${String(g)}`;
    const sum = sums.get(id) ?? { key, group: g, value: 0 };
    sum.value += Number(row[measure] ?? 0);
    sums.set(id, sum);
  }
  // A week that starts before the window or ends after it is not a whole week: leave it out, as the dataset does.
  const whole = ({ key }: { key: string }) =>
    granularity !== 'week' ||
    (key.slice(0, 10) >= WINDOWS.halfYear.from &&
      new Date(Date.parse(`${key}Z`) + 6 * 864e5).toISOString().slice(0, 10) <= WINDOWS.halfYear.to);
  const data = [...sums.values()].filter(whole).map(({ key, group: g, value }) => ({
    [time]: key,
    ...(group ? { [group]: g } : {}),
    [measure]: value,
  }));
  return { ...results, data };
};

const sentenceCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// The card whose rows skip a period at its default granularity, and whose
// picker works: pick a week or a quarter and the rows come back whole. The
// caption is outside the lazy mount, so it is in the page before the chart is.
const GapChart = ({ item, height }: { item: RangeEntry; height: number }) => {
  const { themeId, languageId, datasetId } = useSiteSettings();
  const settings = useMemo(
    () => settingsFor({ themeId, languageId, datasetId }, item.overrides),
    [themeId, languageId, datasetId, item.overrides],
  );
  const { built, Component, granularity } = useChart(item.entry, settings);
  const { props, missing } = useMemo(() => {
    // The month view leaves a period out; the other granularities show the rows whole.
    const base = item.picker || item.gap ? rowsProps(built.props, datasetId, granularity) : built.props;
    const out = item.gap && granularity === 'month' ? withoutPeriod(base) : { props: base };
    return item.picker ? { ...out, props: withPicker(out.props) } : out;
  }, [built, item.picker, item.gap, granularity, datasetId]);

  // The note sits under the chart, inside the card's own cell; the chart gives up its height.
  const chartHeight = item.gap ? height - NOTE_HEIGHT : height;
  return (
    <>
      <LazyMount height={chartHeight}>
        <div style={{ height: chartHeight }}>
          <Component {...props} />
        </div>
      </LazyMount>
      {missing && (
        <p className="lp-range__note" style={{ height: NOTE_HEIGHT - 8 }}>
          <strong>{sentenceCase(periodLabel(missing, granularity))} has no rows.</strong> The chart adds it and shows a gap.
        </p>
      )}
    </>
  );
};

// ---- Copy code ----------------------------------------------------------------

/**
 * The code a card's Copy button gives: the component's usage example, as on
 * its docs page, with this card's own options and, for the card with the gap,
 * its rows. So the code draws the chart on the card.
 */
export const rangeCode = ({ entry, overrides, gap, picker }: RangeEntry, site: Site) => {
  const examples = componentExamples(entry);
  const usage = (picker && examples.find((e) => e.variantId === 'granularity-picker')) || examples[0]!;
  const results = gap ? withoutPeriod(rowsProps(buildChart(entry, settingsFor(site, overrides), idle).props, site.datasetId, 'month')).props.results : undefined;
  const example = { ...usage, overrides: { ...overrides?.overrides, ...(results ? { results } : {}) } };
  // exampleCode passes its settings on to the builder, field options included.
  const settings = { ...codeSettings(site), fieldOverrides: overrides?.fieldOverrides };
  return exampleCode(entry, example, settings);
};

// ---- The grid -----------------------------------------------------------------

// The heat map is a grid of fixed-height rows, one per value of its row
// dimension, and the sample datasets differ in how many they have. Its card
// (and the chart beside it) is made as tall as those rows need: no clipped
// last row, no empty band under it.
const useRowsHeight = () => {
  const { themeId, languageId, datasetId } = useSiteSettings();
  return useMemo(() => {
    const entry = getEntry('heatmap');
    if (!entry) return 264;
    const { props } = buildChart(entry, settingsFor({ themeId, languageId, datasetId }), idle);
    const key = (props.rowDimension as { name?: string } | undefined)?.name;
    const data = (props.results as { data?: Record<string, unknown>[] } | undefined)?.data ?? [];
    const rows = key ? new Set(data.map((row) => row[key])).size : 3;
    return Math.max(264, 128 + 40 * Math.min(rows, 8));
  }, [themeId, languageId, datasetId]);
};

const Card = ({ item, height }: { item: RangeEntry; height: number }) => {
  const { themeId, languageId, datasetId } = useSiteSettings();
  const { entry, size, overrides, gap, picker } = item;
  return (
    <li id={gap ? GAP_CARD_ID : undefined} className={`lp-range__item lp-range__item--${size}`}>
      {gap || picker ? (
        <GapChart item={item} height={height} />
      ) : (
        <LazyMount height={height}>
          <LiveChart entry={entry} height={height} overrides={overrides} />
        </LazyMount>
      )}
      <div className="lp-range__meta">
        <a className="lp-range__link" href={componentPath(entry.id)}>
          <span>{entry.name}</span>
          <code>{`<${String(entry.exportName)} />`}</code>
        </a>
        <CopyButton
          kind="code"
          label="Copy code"
          title={`Copy the code for this ${entry.name}`}
          getText={() => rangeCode(item, { themeId, languageId, datasetId })}
        />
      </div>
    </li>
  );
};

export const ChartRange = () => {
  const canvas = useCanvas();
  const theme = useLandingTheme();
  const rowsHeight = useRowsHeight();

  return (
    <ChartsProvider theme={theme}>
      <ul className={`lp-range${canvas.dark ? ' is-dark' : ''}`} style={{ background: canvas.background }}>
        {rangeEntries.map((item) => (
          <Card key={item.entry.id} item={item} height={item.height === 'rows' ? rowsHeight : item.height} />
        ))}
      </ul>
    </ChartsProvider>
  );
};
