import { BarChart, dimension, measure } from '../../src';
import type { BarChartOptionsClickArg } from '../../src';

type Props = {
  rows?: { region: string; revenue: number }[];
  isLoading: boolean;
  error?: string;
  onBarClicked?: (bar: BarChartOptionsClickArg) => void;
};

const region = dimension({ name: 'region', title: 'Region' });
const revenue = measure({
  name: 'revenue',
  title: 'Revenue',
  inputs: { prefix: '$' },
});

export function RevenueByRegion(props: Props) {
  const { rows, isLoading, error, onBarClicked } = props;
  return (
    <BarChart
      title="Revenue by region"
      dimension={region}
      measures={[revenue]}
      results={{ isLoading, error, data: rows }}
      onBarClicked={onBarClicked}
    />
  );
}
