import { useState } from 'react';
import { TablePaginated, dimension, measure, results } from '../../src';
import type { TablePaginatedProps } from '../../src';

type TableState = NonNullable<TablePaginatedProps['state']>;
type Customer = { customer: string; orders: number; revenue: number };

const customer = dimension({ name: 'customer', title: 'Customer' });
const orders = measure({ name: 'orders', title: 'Orders' });
const revenue = measure({
  name: 'revenue',
  title: 'Revenue',
  inputs: { currency: 'USD', decimalPlaces: 0 },
});

export function CustomersTable() {
  const [state, setState] = useState<TableState>({ page: 0, isLoadingDownloadData: false });

  // The table reports the page, the page size that fits its height, and the sort.
  const { rows, total } = fetchCustomers(state);

  return (
    <div style={{ height: 420 }}>
      <TablePaginated
        title="Customers"
        dimensionsAndMeasures={[customer, orders, revenue]}
        results={results(rows)}
        totalResults={{ isLoading: false, total }}
        allResults={results(customers)} // every row, for the export menu
        state={state}
        setState={setState}
      />
    </div>
  );
}

// Stand-in for your API: sort, then return one page and the total row count.
const names = [
  'Alder & Finch', 'Brightwater', 'Cobalt Freight', 'Dunmore Labs', 'Eastgate Foods',
  'Fernhill', 'Granite Works', 'Harbour Lane', 'Ironbridge', 'Juniper Health',
  'Kestrel Air', 'Larkspur Media', 'Marlow & Reed', 'Northgate', 'Oakfield Dairy',
  'Pinecrest', 'Quayside Books', 'Redwater', 'Saltmarsh', 'Thornbury',
  'Umber Clay', 'Vale Cycles', 'Westbrook', 'Yarrow Tea',
];
const customers: Customer[] = names.map((customer, i) => ({
  customer,
  orders: 12 + ((i * i * 29) % 61),
  revenue: 1800 + ((i * i * 7919) % 42000),
}));

function fetchCustomers({ page, pageSize = 10, sort }: TableState) {
  const sorted = [...customers];
  if (sort) {
    const key = sort.id as keyof Customer;
    const sign = sort.direction === 'desc' ? -1 : 1;
    sorted.sort((a, b) => (a[key] > b[key] ? sign : a[key] < b[key] ? -sign : 0));
  }
  return {
    rows: sorted.slice(page * pageSize, (page + 1) * pageSize),
    total: customers.length,
  };
}
