import { useState } from 'react';
import { LineChart, dimension, measure, results } from '../../src';
import type { Granularity } from '../../src';

const orders = measure({ name: 'orders', title: 'Orders' });

export function OrdersOverTime() {
  const [granularity, setGranularity] = useState<Granularity>('month');

  const orderedAt = dimension({
    name: 'ordered_at',
    title: 'Order date',
    type: 'time',
    granularity,
    inputs: { showGranularityDropdown: true }, // shows the picker
  });

  return (
    <div style={{ height: 400 }}>
      <LineChart
        title="Orders"
        xAxis={orderedAt}
        measures={[orders]}
        results={results(ordersBy(granularity))} // query again at the new granularity
        granularity={granularity} // the granularity of the rows, as on the dimension
        setGranularity={setGranularity} // called with the reader's choice
        showValueLabels={false}
      />
    </div>
  );
}

// Stand-in for your API: a year of daily orders, summed into the
// requested buckets. Each bucket is keyed by the start of its period.
const days = Array.from({ length: 365 }, (_, i) => ({
  date: new Date(Date.UTC(2025, 0, 1 + i)),
  orders: 40 + Math.round(i / 9) + ((i * 37) % 23),
}));

const startOf = (date: Date, granularity: Granularity) => {
  const [y, m, d] = [date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()];
  if (granularity === 'year') return Date.UTC(y, 0, 1);
  if (granularity === 'quarter') return Date.UTC(y, m - (m % 3), 1);
  if (granularity === 'month') return Date.UTC(y, m, 1);
  if (granularity === 'week') return Date.UTC(y, m, d - ((date.getUTCDay() + 6) % 7));
  return Date.UTC(y, m, d);
};

function ordersBy(granularity: Granularity) {
  const totals = new Map<number, number>();
  for (const day of days) {
    const start = startOf(day.date, granularity);
    totals.set(start, (totals.get(start) ?? 0) + day.orders);
  }
  return [...totals].map(([start, total]) => ({
    ordered_at: new Date(start).toISOString().slice(0, 23), // drop the "Z"
    orders: total,
  }));
}
