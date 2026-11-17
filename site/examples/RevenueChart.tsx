import { BarChart, dimension, measure, results } from '../../src';

const region = dimension({ name: 'region', title: 'Region' });
const revenue = measure({ name: 'revenue', title: 'Revenue' });

// One row per bar. Each key is the `name` of a field above.
const rows = [
  { region: 'North America', revenue: 48200 },
  { region: 'Europe', revenue: 39500 },
  { region: 'Asia Pacific', revenue: 27800 },
  { region: 'Latin America', revenue: 12100 },
];

export function RevenueChart() {
  return (
    <div style={{ height: 360 }}>
      <BarChart
        title="Revenue by region"
        dimension={region}
        measures={[revenue]}
        results={results(rows)}
      />
    </div>
  );
}
