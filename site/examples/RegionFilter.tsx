import { useState } from 'react';
import { BarChart, dimension, measure, results } from '../../src';

const region = dimension({ name: 'region', title: 'Region' });
const plan = dimension({ name: 'plan', title: 'Plan' });
const revenue = measure({ name: 'revenue', title: 'Revenue', inputs: { prefix: '$' } });

const byRegion = [
  { region: 'Americas', revenue: 527900 },
  { region: 'EMEA', revenue: 391500 },
  { region: 'APAC', revenue: 276300 },
];

const byRegionAndPlan = [
  { region: 'Americas', plan: 'Starter', revenue: 96400 },
  { region: 'Americas', plan: 'Growth', revenue: 181200 },
  { region: 'Americas', plan: 'Enterprise', revenue: 250300 },
  { region: 'EMEA', plan: 'Starter', revenue: 88100 },
  { region: 'EMEA', plan: 'Growth', revenue: 142900 },
  { region: 'EMEA', plan: 'Enterprise', revenue: 160500 },
  { region: 'APAC', plan: 'Starter', revenue: 71800 },
  { region: 'APAC', plan: 'Growth', revenue: 109300 },
  { region: 'APAC', plan: 'Enterprise', revenue: 95200 },
];

const grid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gridAutoRows: 320,
  gap: 16,
};

export function RegionFilter() {
  const [selected, setSelected] = useState('EMEA');

  return (
    <div style={grid}>
      <BarChart
        title="Revenue by region"
        dimension={region}
        measures={[revenue]}
        results={results(byRegion)}
        onBarClicked={({ dimensionValue }) => {
          if (dimensionValue != null) setSelected(String(dimensionValue));
        }}
      />
      <BarChart
        title={`${selected} by plan`}
        dimension={plan}
        measures={[revenue]}
        results={results(byRegionAndPlan.filter((row) => row.region === selected))}
      />
    </div>
  );
}
