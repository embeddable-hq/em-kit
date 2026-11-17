import { BarChart, ChartsProvider, dimension, measure, results } from '../../src';

const region = dimension({ name: 'region', title: 'Region' });
const revenue = measure({ name: 'revenue', title: 'Revenue', inputs: { currency: 'EUR' } });

const rows = [
  { region: 'North America', revenue: 527900 },
  { region: 'Europe', revenue: 391500 },
];

const theme = {
  i18n: {
    language: 'de',
    translations: {
      de: {
        translation: {
          dashboard: { revenue: 'Umsatz nach Region' }, // your own key, used by the title
          measure: { revenue: 'Umsatz' }, // field titles
          dimension: {
            region: 'Region',
            'region.North America': 'Nordamerika', // dimension values
            'region.Europe': 'Europa',
          },
        },
      },
    },
  },
  formatter: { locale: 'de-DE' },
};

export function TranslatedChart() {
  return (
    <ChartsProvider theme={theme}>
      <div style={{ height: 320 }}>
        <BarChart
          title="dashboard.revenue|Revenue by region" // key|fallback
          dimension={region}
          measures={[revenue]}
          results={results(rows)}
        />
      </div>
    </ChartsProvider>
  );
}
