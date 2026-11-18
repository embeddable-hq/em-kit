import { BarChart, ChartsProvider, defaultTheme, dimension, measure, results } from '../../src';
import type { ChartCardMenuOption } from '../../src';

const copyJson: ChartCardMenuOption = {
  value: 'json',
  labelKey: 'Copy as JSON',
  onClick: ({ data }) => navigator.clipboard.writeText(JSON.stringify(data, null, 2)),
};

const theme = {
  defaults: { chartMenuOptions: [...defaultTheme.defaults.chartMenuOptions, copyJson] },
};

const region = dimension({ name: 'region', title: 'Region' });
const revenue = measure({ name: 'revenue', title: 'Revenue', inputs: { prefix: '$' } });

const rows = [
  { region: 'Americas', revenue: 527900 },
  { region: 'EMEA', revenue: 391500 },
  { region: 'APAC', revenue: 276300 },
];

export function CopyJsonMenu() {
  return (
    <ChartsProvider theme={theme}>
      <div style={{ height: 320 }}>
        <BarChart
          title="Revenue by region"
          dimension={region}
          measures={[revenue]}
          results={results(rows)}
          menuOptions={['csv', 'png', 'json']}
        />
      </div>
    </ChartsProvider>
  );
}
