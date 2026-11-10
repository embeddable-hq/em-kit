import GeneratedTableScrollable, {
  TableScrollableProProps,
} from './generated/components/charts/tables/TableScrollable';

export type { TableScrollableProState as TableScrollableState } from './generated/components/charts/tables/TableScrollable';
export { TABLE_SCROLLABLE_SIZE } from './generated/components/charts/tables/TableScrollable/TableScrollable.utils';

export type TableScrollableProps = Omit<TableScrollableProProps, 'dataset'> & {
  // Identifies the current query (filters, variables, …). When it changes
  // (deep equality), the table scrolls back to the top and re-accumulates
  // from page 0; page changes alone append.
  resetKey?: unknown;
};

// Upstream reads an Embeddable dataset prop purely as a "query changed" signal;
// resetKey is that signal without the Embeddable shape. Serve pages of
// TABLE_SCROLLABLE_SIZE rows: a shorter page means there is no more data.
export const TableScrollable = ({ resetKey, ...props }: TableScrollableProps) => (
  <GeneratedTableScrollable
    {...props}
    dataset={{ embeddableId: '', datasetId: '', inputName: '', variableValues: { resetKey } }}
  />
);
