import type { DataResponse } from '../../src';
import { getVariant } from './registry';
import type { ChartEntry } from './registry';

// How tall each chart is: the height the example code gives its wrapper, and
// the height of its card on the components index. One module, so the preview
// on a component's page and the code under it cannot drift apart: the page
// preview is exactly `exampleHeight`.

type Props = Record<string, unknown>;
type Field = { name?: string; inputs?: Record<string, unknown> };

const isResponse = (value: unknown): value is DataResponse =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && typeof (value as DataResponse).isLoading === 'boolean';

const rowsOf = (value: unknown): Record<string, unknown>[] => (isResponse(value) ? (value.data ?? []) : []);

/** How many different values a dimension prop takes in the chart's rows. */
const distinctValues = (props: Props, dimensionProp: string): number => {
  const name = (props[dimensionProp] as Field | undefined)?.name;
  return name ? new Set(rowsOf(props.results).map((row) => row[name])).size : 0;
};

/** How many total rows a pivot table adds under its rows: one per statistic named in any measure's `columnAggregation`. */
const aggregationRows = (props: Props): number => {
  const measures = Array.isArray(props.measures) ? (props.measures as Field[]) : [];
  const kinds = new Set(measures.flatMap((m) => (m.inputs?.columnAggregation as string[] | undefined) ?? []));
  return kinds.size;
};

// The default card (src/theme.ts): 2rem padding top and bottom, a title row,
// a 2rem gap, and a 1px border round the table: 117px measured. A table row is 2.5rem.
const CARD_CHROME = 120;
// The same card on the components index, with 18px padding and a 14px gap: 69px measured.
const INDEX_CARD_CHROME = 80;
const TABLE_ROW = 40;
// The paginated table's pager is 3rem.
const PAGER = 48;
// A control: its title, the card's gap and a 40px field, 91px measured.
const CONTROL_HEIGHT = 100;
const roundUp = (px: number) => Math.ceil(px / 10) * 10;

/**
 * Rows on a page of a paginated table. The table fits as many whole rows as
 * its height allows and pages the rest, so the height sets the page size: four
 * rows, fewer than any sample dataset has (five or six), so the pager has a
 * second page to turn to.
 */
export const TABLE_PAGE_ROWS = 4;
const pageRows = (props: Props): number => {
  const total = (props.totalResults as { total?: number } | undefined)?.total ?? rowsOf(props.results).length;
  return Math.max(1, Math.min(total, TABLE_PAGE_ROWS));
};

/** A header row, the first page's rows and the pager. */
const paginatedTable = (props: Props) => TABLE_ROW * (1 + pageRows(props)) + PAGER;

/**
 * Table rows a grid draws, header included, for the components that draw every
 * row at a fixed height and scroll the rest: the pivot table (two header rows,
 * one per row value, one per total) and the heat map (one header row).
 */
export const tableRows = (entry: ChartEntry, props: Props): number | undefined => {
  if (entry.exportName === 'PivotTable') return 2 + distinctValues(props, 'rowDimension') + aggregationRows(props);
  if (entry.exportName === 'HeatMap') return 1 + distinctValues(props, 'rowDimension');
  return undefined;
};

/** Charts with KPI tabs above the plot: the tabs, picker and legend take 220 to 260px before the plot gets any. */
export const hasKpiTabs = (entry: ChartEntry) => String(entry.exportName).includes('KpiTabs');

/**
 * The height the example code gives the chart's container, in pixels: a chart
 * fills its container, so the container needs one. Undefined for a table that
 * sizes itself.
 *
 * - A KPI card is short, and a comparison adds a line to it.
 * - KPI tabs leave the plot at least 200px.
 * - A pie or donut is as wide as it is tall, so its card is taller than a bar
 *   chart's: the ring is big enough that a centre total clears it.
 * - A pivot table or heat map shows every row and its totals without scrolling.
 */
export const exampleHeight = (entry: ChartEntry, props: Props): number | undefined => {
  if (props.heightMode === 'auto') return undefined;
  if (entry.group === 'KPIs') return 120 + 40 * Object.values(props).filter(isResponse).length;
  // A control is a title over one field.
  if (entry.group === 'Controls') return CONTROL_HEIGHT;
  if (hasKpiTabs(entry)) return 460;
  // A centre total is drawn at up to 38px and shrinks to touch the ring when the
  // hole is narrower than it: "$1,5 Mio." in German needs a ring about 330px across.
  if (entry.exportName === 'DonutLabelChart') return 480;
  if (entry.group === 'Pies') return 440;
  if (entry.exportName === 'TablePaginated') return roundUp(CARD_CHROME + paginatedTable(props));
  // A grid of every row, with no band under it.
  const rows = tableRows(entry, props);
  if (rows) return roundUp(CARD_CHROME + TABLE_ROW * rows);
  return 360;
};

/**
 * The width the example code gives the chart's container, for a card that is
 * small by nature (a KPI tile) or a preset about one (the funnel's): undefined
 * for the rest, which fill the column.
 */
export const exampleWidth = (entry: ChartEntry, variantId?: string): number | undefined =>
  getVariant(entry, variantId)?.width ?? entry.width;

/** The playground's preview: 480px tall and the column's width, or for a small-card preset the size its code prints. */
export const playgroundFrame = (entry: ChartEntry, variantId: string | undefined, props: Props) => {
  const width = exampleWidth(entry, variantId);
  if (!width) return { height: 480 };
  return { width, height: exampleHeight(entry, props) ?? 480, maxWidth: '100%', marginInline: 'auto' };
};

/**
 * The height of a component's card on the components index: shorter than its
 * code where the chart still shows everything at a third of a row, and never
 * where it would not. The card's own padding is smaller there (components.css).
 */
export const cardHeight = (entry: ChartEntry, props: Props): number => {
  // Both KPIs fit 160px at a third of a row (the comparison line included), and share a row.
  if (entry.group === 'KPIs') return 160;
  if (entry.group === 'Controls') return CONTROL_HEIGHT;
  if (hasKpiTabs(entry)) return 400;
  // A ring 250px across, so an English centre total clears it.
  if (entry.group === 'Pies') return 390;
  // Every row of the first page, and the pager.
  if (entry.exportName === 'TablePaginated') return roundUp(INDEX_CARD_CHROME + paginatedTable(props));
  // As tall as the paginated table's card beside it, a page of rows and a
  // pager: the rows past the fold, cut part way, say the table scrolls.
  if (entry.exportName === 'TableScrollable') return roundUp(INDEX_CARD_CHROME + TABLE_ROW * (1 + TABLE_PAGE_ROWS) + PAGER);
  // Every row and the totals, under a title and an 18px padding, with no band under them.
  const rows = tableRows(entry, props);
  if (rows) return roundUp(INDEX_CARD_CHROME + TABLE_ROW * rows);
  return 300;
};
