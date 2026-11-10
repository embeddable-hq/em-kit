import GeneratedTableScrollable, {
  TableScrollableProProps,
} from './generated/components/charts/tables/TableScrollable';
import { HeightMode, LayoutContext } from './runtime/react';

export type { TableScrollableProState as TableScrollableState } from './generated/components/charts/tables/TableScrollable';
export { TABLE_SCROLLABLE_SIZE } from './generated/components/charts/tables/TableScrollable/TableScrollable.utils';

export type TableScrollableProps = Omit<TableScrollableProProps, 'dataset'> & {
  // Identifies the current query (filters, variables, …). When it changes
  // (deep equality), the table scrolls back to the top and re-accumulates
  // from page 0; page changes alone append.
  resetKey?: unknown;
  // 'fixed' (default): the table scrolls inside its card and pages in as the
  // user scrolls. 'auto': the card grows to fit every row, with no scroll box;
  // pass all rows at once (up to your own cap) with `results.total`, and the
  // table notes when rows were left out.
  heightMode?: HeightMode;
};

// Upstream reads an Embeddable dataset prop purely as a "query changed" signal;
// resetKey is that signal without the Embeddable shape. Serve pages of
// TABLE_SCROLLABLE_SIZE rows: a shorter page means there is no more data.
export const TableScrollable = ({ resetKey, heightMode, ...props }: TableScrollableProps) => (
  <LayoutContext.Provider value={{ heightMode }}>
    <GeneratedTableScrollable
      {...props}
      dataset={{ embeddableId: '', datasetId: '', inputName: '', variableValues: { resetKey } }}
    />
  </LayoutContext.Provider>
);
