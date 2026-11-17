import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';

Chart.register(BarElement, CategoryScale, Legend, LinearScale, Tooltip);

type Row = { region: string; revenue: number };

type Props = {
  rows?: Row[];
  isLoading: boolean;
  error?: string;
};

const money = new Intl.NumberFormat(navigator.language, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const downloadCsv = (rows: Row[]) => {
  const lines = rows.map((row) => `"${row.region}",${row.revenue}`);
  const csv = ['Region,Revenue', ...lines].join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  link.download = 'revenue-by-region.csv';
  link.click();
};

export function RevenueByRegion({ rows, isLoading, error }: Props) {
  const data = useMemo(
    () => ({
      labels: (rows ?? []).map((row) => row.region),
      datasets: [
        {
          label: 'Revenue',
          data: (rows ?? []).map((row) => row.revenue),
        },
      ],
    }),
    [rows],
  );

  let body = (
    <div className="card__chart">
      <Bar
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            tooltip: {
              callbacks: {
                label: (item) => money.format(Number(item.parsed.y)),
              },
            },
          },
          scales: {
            y: {
              ticks: { callback: (value) => money.format(Number(value)) },
            },
          },
        }}
      />
    </div>
  );
  if (isLoading && !rows) {
    body = <div className="card__skeleton" aria-busy="true" />;
  } else if (error) {
    body = <p className="card__message" role="alert">{error}</p>;
  } else if (!rows?.length) {
    body = <p className="card__message">No results</p>;
  }

  return (
    <section className="card">
      <header className="card__header">
        <h3>Revenue by region</h3>
        <button
          type="button"
          disabled={!rows?.length}
          onClick={() => downloadCsv(rows ?? [])}
        >
          Download CSV
        </button>
      </header>
      {body}
    </section>
  );
}
