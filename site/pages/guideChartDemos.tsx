import type { ComponentType } from 'react';
import { SiteChartsProvider } from '../charts';
import { AnswerChart } from '../examples/AnswerChart';
import { ChartStates } from '../examples/ChartStates';
import { CustomersTable } from '../examples/CustomersTable';
import { OrdersOverTime } from '../examples/OrdersOverTime';
import { PlanChart } from '../examples/PlanChart';
import { RegionFilter } from '../examples/RegionFilter';
import { RevenueByPlanAndMonth } from '../examples/RevenueByPlanAndMonth';
import { RevenueChart } from '../examples/RevenueChart';
import { RevenueTarget } from '../examples/RevenueTarget';
import { SignupsByWeek } from '../examples/SignupsByWeek';
import type { ChartBlockId } from './guideChunks';

// The examples from site/examples that guides show running, under the code
// that defines them. Each takes the visitor's theme and language. Loaded on
// its own, after a guide's text (see guideChunks.ts).

export type ChartDemos = Record<ChartBlockId, ComponentType>;

const withCharts = (Example: ComponentType) => {
  const Demo = () => (
    <SiteChartsProvider>
      <Example />
    </SiteChartsProvider>
  );
  return Demo;
};

export const chartDemos: ChartDemos = {
  'quick-start-chart': withCharts(RevenueChart),
  'plan-chart': withCharts(PlanChart),
  'signups-by-week': withCharts(SignupsByWeek),
  'orders-over-time': withCharts(OrdersOverTime),
  'revenue-by-plan-and-month': withCharts(RevenueByPlanAndMonth),
  'chart-states': withCharts(ChartStates),
  'region-filter': withCharts(RegionFilter),
  'customers-table': withCharts(CustomersTable),
  'answer-chart': withCharts(AnswerChart),
  'target-line-demo': withCharts(RevenueTarget),
};
