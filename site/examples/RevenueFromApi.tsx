import { useEffect, useState } from 'react';
import { BarChart, dimension, measure, type DataResponse } from '../../src';

// Turns a function that returns a promise of rows into the `results` a card
// takes. `deps` are the values the request depends on, such as filters.
type Rows = DataResponse['data'];

export function useResults(load: () => Promise<Rows>, deps: unknown[]): DataResponse {
  const [state, setState] = useState<DataResponse>({ isLoading: true });

  useEffect(() => {
    let current = true;
    // The rows already on screen stay while the next ones load.
    setState((previous) => ({ isLoading: true, data: previous.data }));
    load().then(
      (data) => current && setState({ isLoading: false, data }),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        if (current) setState({ isLoading: false, error: message });
      },
    );
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}

const plan = dimension({ name: 'plan', title: 'Plan' });
const revenue = measure({
  name: 'revenue',
  title: 'Revenue',
  inputs: { currency: 'USD', decimalPlaces: 0 },
});

// Your data layer: anything that resolves to rows, or rejects with an Error.
// This one stands in for a request that takes a moment.
const rows = [
  { region: 'Europe', plan: 'Starter', revenue: 18400 },
  { region: 'Europe', plan: 'Team', revenue: 42900 },
  { region: 'Americas', plan: 'Starter', revenue: 21700 },
  { region: 'Americas', plan: 'Team', revenue: 38100 },
];
const fetchRevenueByPlan = (region: string) =>
  new Promise<typeof rows>((resolve) => {
    setTimeout(() => resolve(rows.filter((row) => row.region === region)), 600);
  });

export function RevenueFromApi({ region = 'Europe' }: { region?: string }) {
  const results = useResults(() => fetchRevenueByPlan(region), [region]);
  return (
    <BarChart title="Revenue by plan" dimension={plan} measures={[revenue]} results={results} />
  );
}
