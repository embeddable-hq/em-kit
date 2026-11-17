import { useState } from 'react';
import { ChartsProvider, PivotTable, dimension, measure, results } from '../../src';

const region = dimension({ name: 'region', title: 'Region' });
const country = dimension({ name: 'country', title: 'Country' });
const quarter = dimension({ name: 'quarter', title: 'Quarter' });
const revenue = measure({
  name: 'revenue',
  title: 'Revenue',
  inputs: { currency: 'USD', decimalPlaces: 0 },
});

// The table's rows: one per region and quarter.
const rows = [
  { region: 'Americas', quarter: 'Q1', revenue: 182000 },
  { region: 'Americas', quarter: 'Q2', revenue: 197000 },
  { region: 'EMEA', quarter: 'Q1', revenue: 143000 },
  { region: 'EMEA', quarter: 'Q2', revenue: 151000 },
];

// The sub-rows: one per region, country and quarter. Each carries its
// region, so the table can put it under the right row.
const byCountry = [
  { region: 'Americas', country: 'United States', quarter: 'Q1', revenue: 141000 },
  { region: 'Americas', country: 'United States', quarter: 'Q2', revenue: 150000 },
  { region: 'Americas', country: 'Canada', quarter: 'Q1', revenue: 41000 },
  { region: 'Americas', country: 'Canada', quarter: 'Q2', revenue: 47000 },
  { region: 'EMEA', country: 'Germany', quarter: 'Q1', revenue: 79000 },
  { region: 'EMEA', country: 'Germany', quarter: 'Q2', revenue: 83000 },
  { region: 'EMEA', country: 'France', quarter: 'Q1', revenue: 64000 },
  { region: 'EMEA', country: 'France', quarter: 'Q2', revenue: 68000 },
];

export function RevenueByRegion() {
  // The regions opened so far. The table calls setExpandedRowKey with a
  // region the first time a reader opens it; closing it is the table's own.
  const [opened, setOpened] = useState<string[]>([]);
  const open = (key: string) =>
    setOpened((keys) => (keys.includes(key) ? keys : [...keys, key]));

  // Stand-in for your API: the countries of the opened regions only.
  const subRows = byCountry.filter((row) => opened.includes(row.region));

  return (
    <div style={{ height: 300 }}>
      <PivotTable
        title="Revenue by region"
        rowDimension={region}
        subRowDimension={country}
        columnDimension={quarter}
        measures={[revenue]}
        results={results(rows)}
        resultsSubRows={results(subRows)}
        expandedRowKeys={opened}
        setExpandedRowKey={open}
      />
    </div>
  );
}

// In your app, the provider goes once around the part with charts.
export const Example = () => (
  <ChartsProvider>
    <RevenueByRegion />
  </ChartsProvider>
);
