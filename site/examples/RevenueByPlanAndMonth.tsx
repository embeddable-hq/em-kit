import { BarChartStacked, dimension, measure, results } from '../../src';

const plan = dimension({ name: 'plan', title: 'Plan' });
const month = dimension({ name: 'month', title: 'Month', type: 'time', granularity: 'month' });
const revenue = measure({ name: 'revenue', title: 'Revenue', inputs: { prefix: '$' } });

const january = '2026-01-01T00:00:00.000';
const february = '2026-02-01T00:00:00.000';

// The month is the grouping field, so each row also has it under "month.month".
const rows = [
  { plan: 'Starter', month: january, 'month.month': january, revenue: 18400 },
  { plan: 'Starter', month: february, 'month.month': february, revenue: 21700 },
  { plan: 'Growth', month: january, 'month.month': january, revenue: 42900 },
  { plan: 'Growth', month: february, 'month.month': february, revenue: 47300 },
];

export function RevenueByPlanAndMonth() {
  return (
    <div style={{ height: 320 }}>
      <BarChartStacked
        title="Revenue by plan, split by month"
        xAxis={plan}
        groupBy={month}
        measure={revenue}
        results={results(rows)}
      />
    </div>
  );
}
