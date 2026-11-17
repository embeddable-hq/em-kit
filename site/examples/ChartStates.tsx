import { BarChart, dimension, measure, results } from '../../src';

const plan = dimension({ name: 'plan', title: 'Plan' });
const customers = measure({ name: 'customers', title: 'Customers' });

const rows = [
  { plan: 'Starter', customers: 1840 },
  { plan: 'Growth', customers: 920 },
  { plan: 'Enterprise', customers: 140 },
];

const grid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
  gridAutoRows: 280,
  gap: 16,
};

export function ChartStates() {
  const fields = { dimension: plan, measures: [customers] };
  return (
    <div style={grid}>
      <BarChart title="Loading" {...fields} results={{ isLoading: true }} />
      <BarChart title="Refreshing" {...fields} results={{ isLoading: true, data: rows }} />
      <BarChart title="Empty" {...fields} results={results([])} />
      <BarChart
        title="Error"
        {...fields}
        results={{ isLoading: false, error: 'The query timed out after 30 seconds.' }}
      />
    </div>
  );
}
