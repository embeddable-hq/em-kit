import { dimension, measure, results } from '../../src';
import { TargetLineChart } from './TargetLineChart';

const month = dimension({ name: 'month', title: 'Month', type: 'time', granularity: 'month' });
const revenue = measure({ name: 'revenue', title: 'Revenue', inputs: { prefix: '$' } });

const rows = [
  { month: '2026-01-01T00:00:00.000', revenue: 48200 },
  { month: '2026-02-01T00:00:00.000', revenue: 51900 },
  { month: '2026-03-01T00:00:00.000', revenue: 55400 },
  { month: '2026-04-01T00:00:00.000', revenue: 61300 },
  { month: '2026-05-01T00:00:00.000', revenue: 58700 },
  { month: '2026-06-01T00:00:00.000', revenue: 66100 },
];

export function RevenueTarget() {
  return (
    <div style={{ height: 340 }}>
      <TargetLineChart
        title="Revenue against target"
        description="Monthly, with a flat target line"
        xAxis={month}
        measure={revenue}
        results={results(rows)}
        target={55000}
      />
    </div>
  );
}
