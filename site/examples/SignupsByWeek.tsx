import { BarChart, dimension, measure, results } from '../../src';

const week = dimension({ name: 'week', title: 'Week', type: 'time', granularity: 'week' });
const signups = measure({ name: 'signups', title: 'Signups' });

// Each value is the start of its week (a Monday). There is no row for the
// week of 19 January, so the chart adds that week itself and leaves it empty.
const rows = [
  { week: '2026-01-05T00:00:00.000', signups: 212 },
  { week: '2026-01-12T00:00:00.000', signups: 248 },
  { week: '2026-01-26T00:00:00.000', signups: 231 },
  { week: '2026-02-02T00:00:00.000', signups: 274 },
];

export function SignupsByWeek() {
  return (
    <div style={{ height: 320 }}>
      <BarChart
        title="Signups per week"
        dimension={week}
        measures={[signups]}
        results={results(rows)}
      />
    </div>
  );
}
