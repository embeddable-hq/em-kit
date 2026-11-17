import { ChartsProvider } from '../../src';
import { RevenueChart } from './RevenueChart';

export default function App() {
  return (
    <ChartsProvider>
      <RevenueChart />
    </ChartsProvider>
  );
}
