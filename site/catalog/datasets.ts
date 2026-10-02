import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek.js';
import quarterOfYear from 'dayjs/plugin/quarterOfYear.js';
import { dimension, measure } from '../../src';
import type { Dimension, Granularity, Measure } from '../../src';

dayjs.extend(isoWeek);
dayjs.extend(quarterOfYear);

export type Row = Record<string, string | number | null>;

export type FieldSpec = {
  varName: string;
  name: string;
  title: string;
  type?: 'string' | 'number' | 'time';
  inputs?: Record<string, unknown>;
};

export type Dataset = {
  id: DatasetId;
  label: string;
  blurb: string;
  specs: { category: FieldSpec; group: FieldSpec; time: FieldSpec; primary: FieldSpec; secondary: FieldSpec; size: FieldSpec };
  category: Dimension;
  group: Dimension;
  primary: Measure;
  secondary: Measure;
  size: Measure;
  time: (granularity: Granularity) => Dimension;
  byCategory: Row[];
  byCategoryGroup: Row[];
  byTime: (granularity: Granularity) => Row[];
  byTimeGroup: (granularity: Granularity) => Row[];
  total: Row;
  previousTotal: Row;
};

export type DatasetId = 'saas' | 'web' | 'retail';

const mulberry32 = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const ISO = 'YYYY-MM-DDTHH:mm:ss.SSS';
// Whole quarters, so month and quarter buckets at the edges aren't partial.
const START = dayjs('2025-07-01');
const TODAY = dayjs('2026-06-30');
const DAYS = TODAY.diff(START, 'day') + 1;

const bucketStart = (date: dayjs.Dayjs, granularity: Granularity) =>
  granularity === 'week' ? date.startOf('isoWeek') : date.startOf(granularity as dayjs.OpUnitType);

type Story = {
  id: DatasetId;
  label: string;
  blurb: string;
  seed: number;
  specs: Dataset['specs'];
  categories: { name: string; weight: number }[];
  groups: { name: string; weight: number }[];
  dailyBase: number;
  secondaryRatio: number;
  sizeRange: [number, number];
  growth: number;
  weekendDip: number;
};

const stories: Story[] = [
  {
    id: 'saas',
    label: 'SaaS revenue',
    blurb: 'Subscription revenue by region and plan',
    seed: 7,
    specs: {
      category: { varName: 'region', name: 'region', title: 'Region' },
      group: { varName: 'plan', name: 'plan', title: 'Plan' },
      time: { varName: 'startedAt', name: 'subscriptions.started_at', title: 'Start date', type: 'time', inputs: { showGranularityDropdown: true } },
      primary: { varName: 'revenue', name: 'revenue', title: 'Revenue', inputs: { prefix: '$' } },
      secondary: { varName: 'customers', name: 'customers', title: 'Customers' },
      size: { varName: 'seats', name: 'seats', title: 'Seats' },
    },
    categories: [
      { name: 'North America', weight: 0.36 },
      { name: 'Europe', weight: 0.28 },
      { name: 'Asia Pacific', weight: 0.19 },
      { name: 'Latin America', weight: 0.1 },
      { name: 'Middle East', weight: 0.07 },
    ],
    groups: [
      { name: 'Starter', weight: 0.22 },
      { name: 'Growth', weight: 0.41 },
      { name: 'Enterprise', weight: 0.37 },
    ],
    dailyBase: 3600,
    secondaryRatio: 0.021,
    sizeRange: [40, 900],
    growth: 0.55,
    weekendDip: 0.35,
  },
  {
    id: 'web',
    label: 'Web analytics',
    blurb: 'Sessions and conversions by channel and device',
    seed: 21,
    specs: {
      category: { varName: 'channel', name: 'channel', title: 'Channel' },
      group: { varName: 'device', name: 'device', title: 'Device' },
      time: { varName: 'visitedAt', name: 'sessions.visited_at', title: 'Visit date', type: 'time', inputs: { showGranularityDropdown: true } },
      primary: { varName: 'sessions', name: 'sessions', title: 'Sessions' },
      secondary: { varName: 'conversions', name: 'conversions', title: 'Conversions' },
      size: { varName: 'bounceRate', name: 'bounce_rate', title: 'Bounce rate', inputs: { suffix: '%' } },
    },
    categories: [
      { name: 'Organic search', weight: 0.34 },
      { name: 'Direct', weight: 0.21 },
      { name: 'Paid search', weight: 0.17 },
      { name: 'Social', weight: 0.13 },
      { name: 'Email', weight: 0.09 },
      { name: 'Referral', weight: 0.06 },
    ],
    groups: [
      { name: 'Mobile', weight: 0.58 },
      { name: 'Desktop', weight: 0.36 },
      { name: 'Tablet', weight: 0.06 },
    ],
    dailyBase: 5200,
    secondaryRatio: 0.034,
    sizeRange: [24, 71],
    growth: 0.3,
    weekendDip: -0.12,
  },
  {
    id: 'retail',
    label: 'Retail sales',
    blurb: 'Sales and units by product category and store',
    seed: 99,
    specs: {
      category: { varName: 'productCategory', name: 'product_category', title: 'Category' },
      group: { varName: 'store', name: 'store', title: 'Store' },
      time: { varName: 'orderedAt', name: 'orders.ordered_at', title: 'Order date', type: 'time', inputs: { showGranularityDropdown: true } },
      primary: { varName: 'sales', name: 'sales', title: 'Sales', inputs: { prefix: '$' } },
      secondary: { varName: 'units', name: 'units', title: 'Units' },
      size: { varName: 'margin', name: 'margin', title: 'Margin', inputs: { suffix: '%' } },
    },
    categories: [
      { name: 'Apparel', weight: 0.31 },
      { name: 'Footwear', weight: 0.24 },
      { name: 'Home', weight: 0.18 },
      { name: 'Accessories', weight: 0.15 },
      { name: 'Beauty', weight: 0.12 },
    ],
    groups: [
      { name: 'Online', weight: 0.47 },
      { name: 'Flagship', weight: 0.33 },
      { name: 'Outlet', weight: 0.2 },
    ],
    dailyBase: 2400,
    secondaryRatio: 0.028,
    sizeRange: [18, 62],
    growth: 0.4,
    weekendDip: -0.3,
  },
];

const toDimension = (spec: FieldSpec, granularity?: Granularity) =>
  dimension({ name: spec.name, title: spec.title, type: spec.type ?? 'string', inputs: spec.inputs, granularity });

const toMeasure = (spec: FieldSpec) => measure({ name: spec.name, title: spec.title, inputs: spec.inputs });

const round = (value: number) => Math.round(value);

const buildDataset = (story: Story): Dataset => {
  const random = mulberry32(story.seed);
  const { specs } = story;

  // One seeded value per day per group; every view aggregates from this.
  const daily = Array.from({ length: DAYS }, (_, i) => {
    const date = TODAY.subtract(DAYS - 1 - i, 'day');
    const trend = 1 + story.growth * (i / DAYS);
    const season = 1 + 0.12 * Math.sin((i / DAYS) * Math.PI * 2);
    const weekend = date.day() === 0 || date.day() === 6 ? 1 - story.weekendDip : 1;
    const total = story.dailyBase * trend * season * weekend * (0.85 + random() * 0.3);
    return { date, byGroup: story.groups.map((g) => total * g.weight * (0.9 + random() * 0.2)) };
  });

  // The built-in picker offers day to year, so there is no sub-day series.
  const timeRows = (granularity: Granularity, grouped: boolean): Row[] => {
    const buckets = new Map<string, number[]>();
    for (const day of daily) {
      if (granularity === 'week') {
        const weekStart = day.date.startOf('isoWeek');
        if (weekStart.isBefore(START) || weekStart.add(6, 'day').isAfter(TODAY)) continue;
      }
      const key = bucketStart(day.date, granularity).format(ISO);
      const current = buckets.get(key) ?? story.groups.map(() => 0);
      day.byGroup.forEach((v, i) => (current[i]! += v));
      buckets.set(key, current);
    }
    return [...buckets.entries()].flatMap(([key, groupValues]) => {
      const timeKeys = { [specs.time.name]: key, [`${specs.time.name}.${granularity}`]: key };
      if (grouped) {
        return story.groups.map((g, i) => ({
          ...timeKeys,
          [specs.group.name]: g.name,
          [specs.primary.name]: round(groupValues[i]!),
        }));
      }
      const total = groupValues.reduce((a, b) => a + b, 0);
      return [{ ...timeKeys, [specs.primary.name]: round(total), [specs.secondary.name]: round(total * story.secondaryRatio) }];
    });
  };

  const yearTotal = daily.reduce((sum, d) => sum + d.byGroup.reduce((a, b) => a + b, 0), 0);
  const [sizeMin, sizeMax] = story.sizeRange;

  const byCategory = story.categories.map((c) => {
    const value = yearTotal * c.weight * (0.92 + random() * 0.16);
    return {
      [specs.category.name]: c.name,
      [specs.primary.name]: round(value),
      [specs.secondary.name]: round(value * story.secondaryRatio * (0.7 + random() * 0.6)),
      [specs.size.name]: round(sizeMin + random() * (sizeMax - sizeMin)),
    };
  });

  const byCategoryGroup = story.categories.flatMap((c) =>
    story.groups.map((g) => {
      const value = yearTotal * c.weight * g.weight * (0.7 + random() * 0.6);
      return {
        [specs.category.name]: c.name,
        [specs.group.name]: g.name,
        [specs.primary.name]: round(value),
        [specs.secondary.name]: round(value * story.secondaryRatio),
      };
    }),
  );

  const last30 = daily.slice(-30).reduce((sum, d) => sum + d.byGroup.reduce((a, b) => a + b, 0), 0);
  const prior30 = daily.slice(-60, -30).reduce((sum, d) => sum + d.byGroup.reduce((a, b) => a + b, 0), 0);

  const cache = new Map<string, Row[]>();
  const memo = (key: string, build: () => Row[]) => {
    if (!cache.has(key)) cache.set(key, build());
    return cache.get(key)!;
  };

  return {
    id: story.id,
    label: story.label,
    blurb: story.blurb,
    specs,
    category: toDimension(specs.category),
    group: toDimension(specs.group),
    primary: toMeasure(specs.primary),
    secondary: toMeasure(specs.secondary),
    size: toMeasure(specs.size),
    time: (granularity) => toDimension(specs.time, granularity),
    byCategory,
    byCategoryGroup,
    byTime: (granularity) => memo(`t:${granularity}`, () => timeRows(granularity, false)),
    byTimeGroup: (granularity) => memo(`tg:${granularity}`, () => timeRows(granularity, true)),
    total: { [specs.primary.name]: round(last30) },
    previousTotal: { [specs.primary.name]: round(prior30) },
  };
};

export const datasets: Record<DatasetId, Dataset> = Object.fromEntries(
  stories.map((s) => [s.id, buildDataset(s)]),
) as Record<DatasetId, Dataset>;

export const datasetList = Object.values(datasets);
