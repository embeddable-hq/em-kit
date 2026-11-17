import { BarChart, dimension, measure, results } from '../../src';

// A dimension is something you group by.
const plan = dimension({ name: 'plan', title: 'Plan' });

// A measure is a number. Display options go on `inputs`.
const mrr = measure({
  name: 'mrr',
  title: 'Monthly recurring revenue',
  inputs: { currency: 'EUR', abbreviateLargeNumber: true },
});

// Each row has one key per field name.
const rows = [
  { plan: 'Starter', mrr: 84200 },
  { plan: 'Growth', mrr: 213500 },
  { plan: 'Enterprise', mrr: 391000 },
];

export function PlanChart() {
  return (
    <div style={{ height: 320 }}>
      <BarChart
        title="Recurring revenue by plan"
        dimension={plan}
        measures={[mrr]}
        results={results(rows)}
      />
    </div>
  );
}
