import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek.js';
import quarterOfYear from 'dayjs/plugin/quarterOfYear.js';
// From their own module: the package's index would bring in every component.
import { dimension, measure } from '../../src/data';
import type { Dimension, FieldInputs, Granularity, Measure } from '../../src';

dayjs.extend(isoWeek);
dayjs.extend(quarterOfYear);

export type Row = Record<string, string | number | null>;

export type FieldSpec = {
  varName: string;
  name: string;
  title: string;
  type?: 'string' | 'number' | 'time';
  inputs?: FieldInputs;
};

// Fields beyond the seven every chart can use, so the previews are not all one
// measure over one dimension. Each sample dataset fills the same set.
//   segment   a second breakdown with short values (industry, browser, age group)
//   pair      a two-way split (billing, visitor, customer)
//   activity  a count that moves over time (signups, page views, orders)
//   rate      a percentage where lower is better (churn, bounce, returns)
//   funnel    what a funnel counts at each stage (deals, visitors, shoppers)
//   entity, cluster, x, y, bubble   one point per entity, for scatter and bubble charts
//   ranked    of the entities' measures, one that adds up, for a long tail summed into "Other"
export type ExtraSlot = 'segment' | 'pair' | 'activity' | 'rate' | 'funnel' | 'entity' | 'cluster' | 'x' | 'y' | 'bubble' | 'ranked';

export type ExtraSpec = FieldSpec & { kind: 'dimension' | 'measure' };

// An inclusive window of whole days, as ISO dates (YYYY-MM-DD).
export type DateWindow = { from: string; to: string };

export type Dataset = {
  id: DatasetId;
  label: string;
  blurb: string;
  specs: {
    category: FieldSpec;
    group: FieldSpec;
    time: FieldSpec;
    primary: FieldSpec;
    secondary: FieldSpec;
    size: FieldSpec;
    stage: FieldSpec;
  };
  category: Dimension;
  stage: Dimension;
  group: Dimension;
  primary: Measure;
  secondary: Measure;
  size: Measure;
  time: (granularity: Granularity) => Dimension;
  extra: Record<ExtraSlot, ExtraSpec>;
  // One row per category, with every measure: the sample period's totals.
  byCategory: Row[];
  // One row per category × group. Adds up to byCategory.
  byCategoryGroup: Row[];
  // One row per category × pair. Adds up to byCategory.
  byCategoryPair: Row[];
  // One row per group (which also carries the rate measure); one per segment;
  // and their cross-tabs.
  byGroup: Row[];
  bySegment: Row[];
  byGroupSegment: Row[];
  byGroupPair: Row[];
  bySegmentPair: Row[];
  // One point per entity, for scatter and bubble charts: cluster, x, y and bubble size.
  byPoint: Row[];
  byTime: (granularity: Granularity) => Row[];
  byTimeGroup: (granularity: Granularity) => Row[];
  // The same series restricted to a window, for comparison charts. Buckets are
  // aggregated from the days inside the window, and weeks that straddle either
  // edge are dropped, as they are at the edges of the full series.
  byTimeWindow: (granularity: Granularity, window: DateWindow) => Row[];
  byTimeGroupWindow: (granularity: Granularity, window: DateWindow) => Row[];
  // The funnel measure at each step, first step to last.
  byStage: Row[];
  // The last 30 days and the 30 before them: one row each, with every measure.
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
// The sample period: every total, breakdown, table and series covers January
// to June 2026, so figures on different charts agree. The days before it exist
// only for the comparison charts' earlier period. Whole quarters at both ends,
// so no month or quarter bucket is partial.
const HISTORY_START = dayjs('2025-07-01');
const START = dayjs('2026-01-01');
const TODAY = dayjs('2026-06-30');
const DAYS = TODAY.diff(HISTORY_START, 'day') + 1;

// The sample period, for chart subtitles: "Jan – Jun 2026".
export const PERIOD_LABEL = `${START.format('MMM')} – ${TODAY.format('MMM YYYY')}`;

// The windows the previews plot, all inside the sample period except the
// comparison charts' earlier one. A month label carries its year ("Mar 2026"),
// and the charts tilt labels that do not fit before they drop any, so a time
// series on a card a third of a row wide plots the period's last four months.
export const WINDOWS = {
  sample: { from: START.format('YYYY-MM-DD'), to: TODAY.format('YYYY-MM-DD') },
  current: { from: '2026-03-01', to: '2026-06-30' },
  previous: { from: '2025-11-01', to: '2026-02-28' },
  halfYear: { from: '2026-01-01', to: '2026-06-30' },
  last30: { from: '2026-06-01', to: '2026-06-30' },
  previous30: { from: '2026-05-02', to: '2026-05-31' },
} satisfies Record<string, DateWindow>;

const bucketStart = (date: dayjs.Dayjs, granularity: Granularity) =>
  granularity === 'week' ? date.startOf('isoWeek') : date.startOf(granularity as dayjs.OpUnitType);

type Weighted = { name: string; weight: number };

type Story = {
  id: DatasetId;
  label: string;
  blurb: string;
  seed: number;
  specs: Dataset['specs'];
  extra: Dataset['extra'];
  categories: Weighted[];
  // `perPrimary` scales the secondary measure per group (a Starter plan has many
  // customers per dollar, an Enterprise plan few); `trend` tilts its growth.
  groups: (Weighted & { perPrimary: number; trend: number })[];
  segments: string[];
  // Share of each group's secondary measure in each segment: groups × segments.
  affinity: number[][];
  pairs: [string, string];
  // Share of the second pair value, per group and per category.
  pairByGroup: number[];
  pairByCategory: number[];
  pairBySegment: number[];
  // The rate measure in each group, for the bar and line combo.
  rateByGroup: number[];
  // Funnel steps in order; `kept` is the share that reaches it from the step before.
  // The last step keeps at least 17% of the first: a funnel draws each step's
  // label inside it, so "Purchase: 9,130" needs a step about 110px wide on a
  // component page (see the funnel test in chartQuality.test.tsx).
  stages: { name: string; kept: number }[];
  funnelTop: number;
  // Hand-set so the scatter reads as a real relationship: [entity, cluster, x, y, bubble].
  points: [string, string, number, number, number][];
  dailyBase: number;
  secondaryRatio: number;
  activityRatio: number;
  rate: { from: number; to: number };
  growth: number;
  weekendDip: number;
};

const dim = (varName: string, name: string, title: string): ExtraSpec => ({ kind: 'dimension', varName, name, title });
const mea = (varName: string, name: string, title: string, inputs?: FieldInputs): ExtraSpec => ({
  kind: 'measure',
  varName,
  name,
  title,
  ...(inputs ? { inputs } : {}),
});

// Money as a currency, not a "$" prefix, so each locale places the symbol
// itself ("$77,063", "77.063 $"); in whole dollars, as the rows hold them.
const USD: FieldInputs = { currency: 'USD', decimalPlaces: 0 };

const stories: Story[] = [
  {
    id: 'saas',
    label: 'SaaS product',
    blurb: 'Revenue, customers and signups by region and plan',
    seed: 7,
    specs: {
      category: { varName: 'region', name: 'region', title: 'Region' },
      group: { varName: 'plan', name: 'plan', title: 'Plan' },
      time: { varName: 'startDate', name: 'startDate', title: 'Start date', type: 'time', inputs: { showGranularityDropdown: true } },
      primary: { varName: 'revenue', name: 'revenue', title: 'Revenue', inputs: USD },
      secondary: { varName: 'customers', name: 'customers', title: 'Customers' },
      size: { varName: 'seats', name: 'seats', title: 'Seats' },
      stage: { varName: 'dealStage', name: 'deal_stage', title: 'Stage' },
    },
    extra: {
      segment: dim('industry', 'industry', 'Industry'),
      pair: dim('billing', 'billing', 'Billing'),
      activity: mea('signups', 'signups', 'Signups'),
      rate: mea('churnRate', 'churn_rate', 'Churn rate', { suffix: '%', decimalPlaces: 1 }),
      funnel: mea('deals', 'deals', 'Deals'),
      entity: dim('account', 'account', 'Account'),
      cluster: dim('plan', 'plan', 'Plan'),
      x: mea('seats', 'seats', 'Seats'),
      y: mea('revenue', 'revenue', 'Revenue', USD),
      bubble: mea('tickets', 'tickets', 'Tickets'),
      ranked: mea('revenue', 'revenue', 'Revenue', USD),
    },
    stages: [
      { name: 'Lead', kept: 1 },
      { name: 'Qualified', kept: 0.58 },
      { name: 'Proposal', kept: 0.68 },
      { name: 'Negotiation', kept: 0.72 },
      { name: 'Won', kept: 0.66 },
    ],
    funnelTop: 4820,
    categories: [
      { name: 'North America', weight: 0.36 },
      { name: 'Europe', weight: 0.28 },
      { name: 'Asia Pacific', weight: 0.19 },
      { name: 'Latin America', weight: 0.1 },
      { name: 'Middle East', weight: 0.07 },
    ],
    groups: [
      { name: 'Starter', weight: 0.2, perPrimary: 3.1, trend: -0.5 },
      { name: 'Growth', weight: 0.46, perPrimary: 1, trend: 0 },
      { name: 'Enterprise', weight: 0.34, perPrimary: 0.2, trend: 1.1 },
    ],
    // In name order: the heat map and pivot table sort columns that are not already in order.
    segments: ['Health', 'Media', 'Retail', 'Tech'],
    affinity: [
      [0.1, 0.34, 0.36, 0.2],
      [0.2, 0.22, 0.24, 0.34],
      [0.46, 0.1, 0.14, 0.3],
    ],
    pairs: ['Monthly', 'Annual'],
    pairByGroup: [0.18, 0.46, 0.88],
    pairByCategory: [0.58, 0.64, 0.47, 0.33, 0.41],
    pairBySegment: [0.74, 0.34, 0.42, 0.57],
    rateByGroup: [4.8, 2.7, 1.1],
    // Accounts: seats, revenue, open tickets.
    points: [
      ['Alder', 'Starter', 40, 44000, 6],
      ['Birch', 'Starter', 66, 60000, 14],
      ['Cedar', 'Starter', 92, 49000, 9],
      ['Dune', 'Growth', 118, 78000, 22],
      ['Ember', 'Growth', 144, 64000, 12],
      ['Fjord', 'Growth', 170, 96000, 31],
      ['Grove', 'Growth', 196, 84000, 17],
      ['Harbor', 'Enterprise', 226, 131000, 26],
      ['Isle', 'Enterprise', 258, 114000, 48],
      ['Juniper', 'Enterprise', 296, 176000, 35],
      ['Kite', 'Enterprise', 334, 152000, 58],
    ],
    dailyBase: 3600,
    secondaryRatio: 0.0031,
    activityRatio: 0.017,
    rate: { from: 3.6, to: 2.3 },
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
      time: { varName: 'visitDate', name: 'visitDate', title: 'Visit date', type: 'time', inputs: { showGranularityDropdown: true } },
      primary: { varName: 'sessions', name: 'sessions', title: 'Sessions' },
      secondary: { varName: 'conversions', name: 'conversions', title: 'Conversions' },
      size: { varName: 'bounceRate', name: 'bounce_rate', title: 'Bounce rate', inputs: { suffix: '%' } },
      stage: { varName: 'funnelStep', name: 'funnel_step', title: 'Step' },
    },
    extra: {
      segment: dim('browser', 'browser', 'Browser'),
      pair: dim('visitor', 'visitor', 'Visitor'),
      activity: mea('pageViews', 'page_views', 'Page views'),
      rate: mea('bounceRate', 'bounce_rate', 'Bounce rate', { suffix: '%', decimalPlaces: 1 }),
      funnel: mea('visitors', 'visitors', 'Visitors'),
      entity: dim('page', 'page', 'Page'),
      cluster: dim('pageType', 'page_type', 'Page type'),
      x: mea('loadTime', 'load_time', 'Load time', { suffix: ' s', decimalPlaces: 1 }),
      y: mea('bounceRate', 'bounce_rate', 'Bounce rate', { suffix: '%' }),
      bubble: mea('sessions', 'sessions', 'Sessions'),
      ranked: mea('sessions', 'sessions', 'Sessions'),
    },
    stages: [
      { name: 'Landing page', kept: 1 },
      { name: 'Product page', kept: 0.6 },
      { name: 'Add to cart', kept: 0.55 },
      { name: 'Checkout', kept: 0.7 },
      { name: 'Purchase', kept: 0.82 },
    ],
    funnelTop: 48200,
    categories: [
      { name: 'Organic search', weight: 0.34 },
      { name: 'Direct', weight: 0.21 },
      { name: 'Paid search', weight: 0.17 },
      { name: 'Social', weight: 0.13 },
      { name: 'Email', weight: 0.09 },
      { name: 'Referral', weight: 0.06 },
    ],
    groups: [
      { name: 'Mobile', weight: 0.5, perPrimary: 0.7, trend: 0.9 },
      { name: 'Desktop', weight: 0.4, perPrimary: 1.6, trend: -0.6 },
      { name: 'Tablet', weight: 0.1, perPrimary: 0.9, trend: -0.2 },
    ],
    // In name order: the heat map and pivot table sort columns that are not already in order.
    segments: ['Chrome', 'Edge', 'Firefox', 'Safari'],
    affinity: [
      [0.54, 0.03, 0.04, 0.39],
      [0.57, 0.18, 0.11, 0.14],
      [0.32, 0.03, 0.03, 0.62],
    ],
    pairs: ['New', 'Returning'],
    pairByGroup: [0.28, 0.47, 0.36],
    pairByCategory: [0.31, 0.62, 0.18, 0.22, 0.74, 0.35],
    pairBySegment: [0.36, 0.44, 0.52, 0.29],
    rateByGroup: [48.6, 36.2, 42.9],
    // Pages: load time in seconds, bounce rate, sessions.
    points: [
      ['/docs', 'Content', 0.6, 24, 16700],
      ['/pricing', 'Marketing', 0.9, 31, 9400],
      ['/home', 'Marketing', 1.2, 26, 48200],
      ['/signup', 'Product', 1.5, 37, 7900],
      ['/app', 'Product', 1.8, 29, 30500],
      ['/tour', 'Marketing', 2.1, 43, 11800],
      ['/blog', 'Content', 2.4, 36, 24100],
      ['/news', 'Content', 2.7, 52, 5400],
      ['/cases', 'Marketing', 3, 45, 6200],
      ['/reports', 'Product', 3.3, 58, 14800],
      ['/guides', 'Content', 3.6, 64, 9400],
    ],
    dailyBase: 5200,
    secondaryRatio: 0.009,
    activityRatio: 2.6,
    rate: { from: 47.5, to: 40.8 },
    growth: 0.3,
    weekendDip: -0.12,
  },
  {
    id: 'retail',
    label: 'Retail sales',
    blurb: 'Sales, units and orders by product category and store',
    seed: 99,
    specs: {
      category: { varName: 'productCategory', name: 'product_category', title: 'Category' },
      group: { varName: 'store', name: 'store', title: 'Store' },
      time: { varName: 'orderDate', name: 'orderDate', title: 'Order date', type: 'time', inputs: { showGranularityDropdown: true } },
      primary: { varName: 'sales', name: 'sales', title: 'Sales', inputs: USD },
      secondary: { varName: 'units', name: 'units', title: 'Units' },
      size: { varName: 'margin', name: 'margin', title: 'Margin', inputs: { suffix: '%' } },
      stage: { varName: 'orderStage', name: 'order_stage', title: 'Stage' },
    },
    extra: {
      segment: dim('ageGroup', 'age_group', 'Age group'),
      pair: dim('customer', 'customer', 'Customer'),
      activity: mea('orders', 'orders', 'Orders'),
      rate: mea('returnRate', 'return_rate', 'Return rate', { suffix: '%', decimalPlaces: 1 }),
      funnel: mea('shoppers', 'shoppers', 'Shoppers'),
      entity: dim('product', 'product', 'Product'),
      cluster: dim('productCategory', 'product_category', 'Category'),
      x: mea('price', 'price', 'Price', USD),
      y: mea('units', 'units', 'Units'),
      bubble: mea('margin', 'margin', 'Margin', { suffix: '%' }),
      ranked: mea('units', 'units', 'Units'),
    },
    stages: [
      { name: 'Browsed', kept: 1 },
      { name: 'Added to basket', kept: 0.38 },
      { name: 'Checkout', kept: 0.61 },
      { name: 'Paid', kept: 0.83 },
      { name: 'Kept', kept: 0.9 },
    ],
    funnelTop: 26400,
    categories: [
      { name: 'Apparel', weight: 0.31 },
      { name: 'Footwear', weight: 0.24 },
      { name: 'Home', weight: 0.18 },
      { name: 'Accessories', weight: 0.15 },
      { name: 'Beauty', weight: 0.12 },
    ],
    groups: [
      { name: 'Online', weight: 0.42, perPrimary: 1, trend: 0.9 },
      { name: 'Flagship', weight: 0.38, perPrimary: 0.7, trend: -0.6 },
      { name: 'Outlet', weight: 0.2, perPrimary: 1.5, trend: 0.1 },
    ],
    // In name order, like the other datasets' segments.
    segments: ['18–24', '25–34', '35–44', '45+'],
    affinity: [
      [0.3, 0.36, 0.21, 0.13],
      [0.14, 0.27, 0.29, 0.3],
      [0.08, 0.17, 0.27, 0.48],
    ],
    pairs: ['New', 'Returning'],
    pairByGroup: [0.44, 0.58, 0.31],
    pairByCategory: [0.52, 0.41, 0.36, 0.47, 0.63],
    pairBySegment: [0.27, 0.41, 0.52, 0.63],
    rateByGroup: [11.8, 5.4, 7.9],
    // Products: price, units sold, margin.
    points: [
      ['Tote bag', 'Accessories', 24, 1840, 58],
      ['Scarf', 'Accessories', 38, 1410, 54],
      ['Belt', 'Accessories', 52, 1560, 61],
      ['Shirt', 'Apparel', 66, 1180, 47],
      ['Sneaker', 'Footwear', 80, 1320, 39],
      ['Jumper', 'Apparel', 94, 860, 49],
      ['Jacket', 'Apparel', 108, 990, 45],
      ['Runner', 'Footwear', 122, 640, 36],
      ['Raincoat', 'Apparel', 136, 760, 42],
      ['Boot', 'Footwear', 150, 540, 41],
    ],
    dailyBase: 2400,
    secondaryRatio: 0.028,
    activityRatio: 0.012,
    rate: { from: 8.9, to: 7.2 },
    growth: 0.4,
    weekendDip: -0.3,
  },
];

const toDimension = (spec: FieldSpec, granularity?: Granularity) =>
  dimension({ name: spec.name, title: spec.title, type: spec.type ?? 'string', inputs: spec.inputs, granularity });

const toMeasure = (spec: FieldSpec) => measure({ name: spec.name, title: spec.title, inputs: spec.inputs });

const round = (value: number) => Math.round(value);
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

// Shares that add up to one, each nudged by up to ±spread.
const jittered = (weights: number[], random: () => number, spread: number) => {
  const raw = weights.map((w) => w * (1 - spread + random() * spread * 2));
  const total = sum(raw);
  return raw.map((w) => w / total);
};

type Day = {
  date: dayjs.Dayjs;
  primary: number[];
  secondary: number[];
  activity: number;
  rate: number;
};

const buildDataset = (story: Story): Dataset => {
  const random = mulberry32(story.seed);
  const { specs, extra, groups } = story;
  const names = {
    category: specs.category.name,
    group: specs.group.name,
    primary: specs.primary.name,
    secondary: specs.secondary.name,
    size: specs.size.name,
    time: specs.time.name,
    segment: extra.segment.name,
    pair: extra.pair.name,
    activity: extra.activity.name,
    rate: extra.rate.name,
  };

  // Good and bad months, one factor per month and series, so a monthly line
  // has a shape of its own rather than tracing the trend.
  const monthRandom = mulberry32(story.seed + 31);
  const swing = (spread: number) => Array.from({ length: 12 }, () => 1 - spread + monthRandom() * spread * 2);
  const primarySwing = groups.map(() => swing(0.05));
  const secondarySwing = groups.map(() => swing(0.14));
  const activitySwing = swing(0.16);

  // One seeded value per day per group; every view aggregates from this.
  const daily: Day[] = Array.from({ length: DAYS }, (_, i) => {
    const date = TODAY.subtract(DAYS - 1 - i, 'day');
    const t = i / (DAYS - 1);
    const month = date.diff(HISTORY_START, 'month');
    const trend = 1 + story.growth * t;
    const season = 1 + 0.1 * Math.sin(t * Math.PI * 2);
    const weekend = date.day() === 0 || date.day() === 6 ? 1 - story.weekendDip : 1;
    const base = story.dailyBase * trend * season * weekend;
    const primary = groups.map(
      (g, gi) => base * g.weight * (1 + g.trend * (t - 0.5)) * primarySwing[gi]![month]! * (0.86 + random() * 0.28),
    );
    const secondary = primary.map(
      (p, gi) =>
        (p / primarySwing[gi]![month]!) *
        story.secondaryRatio *
        groups[gi]!.perPrimary *
        secondarySwing[gi]![month]! *
        (0.8 + random() * 0.4),
    );
    // Its own shape: a slow start, then a climb.
    const lift = 1 + 0.8 * t * t;
    const activity =
      story.dailyBase * story.activityRatio * lift * weekend * activitySwing[month]! * (0.82 + random() * 0.36);
    const rate =
      (story.rate.from + (story.rate.to - story.rate.from) * t) * (0.93 + random() * 0.14) + 0.35 * Math.sin(t * Math.PI * 5);
    return { date, primary, secondary, activity, rate };
  });

  const inWindow = (window?: DateWindow) => {
    const lo = window ? dayjs(window.from) : START;
    const hi = window ? dayjs(window.to) : TODAY;
    return daily.filter((d) => !d.date.isBefore(lo) && !d.date.isAfter(hi));
  };

  // The built-in picker offers day to year, so there is no sub-day series.
  const timeRows = (granularity: Granularity, grouped: boolean, window?: DateWindow): Row[] => {
    const lo = window ? dayjs(window.from) : START;
    const hi = window ? dayjs(window.to) : TODAY;
    const buckets = new Map<string, Day[]>();
    for (const day of inWindow(window)) {
      if (granularity === 'week') {
        const weekStart = day.date.startOf('isoWeek');
        if (weekStart.isBefore(lo) || weekStart.add(6, 'day').isAfter(hi)) continue;
      }
      const key = bucketStart(day.date, granularity).format(ISO);
      const bucket = buckets.get(key);
      if (bucket) bucket.push(day);
      else buckets.set(key, [day]);
    }
    return [...buckets.entries()].flatMap(([key, days]) => {
      const timeKeys = { [names.time]: key, [`${names.time}.${granularity}`]: key };
      if (grouped) {
        return groups.map((g, gi) => ({
          ...timeKeys,
          [names.group]: g.name,
          [names.primary]: round(sum(days.map((d) => d.primary[gi]!))),
          [names.secondary]: round(sum(days.map((d) => d.secondary[gi]!))),
        }));
      }
      return [
        {
          ...timeKeys,
          [names.primary]: round(sum(days.map((d) => sum(d.primary)))),
          [names.secondary]: round(sum(days.map((d) => sum(d.secondary)))),
          [names.activity]: round(sum(days.map((d) => d.activity))),
          [names.rate]: Math.round((sum(days.map((d) => d.rate)) / days.length) * 10) / 10,
        },
      ];
    });
  };

  const totalsRow = (days: Day[]): Row => ({
    [names.primary]: round(sum(days.map((d) => sum(d.primary)))),
    [names.secondary]: round(sum(days.map((d) => sum(d.secondary)))),
    [names.activity]: round(sum(days.map((d) => d.activity))),
    [names.rate]: Math.round((sum(days.map((d) => d.rate)) / days.length) * 10) / 10,
  });

  // The sample period's totals per group, then split across the other
  // dimensions so every breakdown of a measure adds up to the same figure.
  const period = inWindow();
  const groupPrimary = groups.map((_, gi) => sum(period.map((d) => d.primary[gi]!)));
  const groupSecondary = groups.map((_, gi) => sum(period.map((d) => d.secondary[gi]!)));
  const activityTotal = sum(period.map((d) => d.activity));
  const [sizeMin, sizeMax] = story.id === 'saas' ? [40, 900] : [22, 68];

  const categoryShares = groups.map(() => jittered(story.categories.map((c) => c.weight), random, 0.22));
  const byCategoryGroup: Row[] = story.categories.flatMap((c, ci) =>
    groups.map((g, gi) => ({
      [names.category]: c.name,
      [names.group]: g.name,
      [names.primary]: round(groupPrimary[gi]! * categoryShares[gi]![ci]!),
      [names.secondary]: round(groupSecondary[gi]! * categoryShares[gi]![ci]!),
    })),
  );

  const total = (rows: Row[], key: string) => sum(rows.map((r) => Number(r[key] ?? 0)));
  const activityShares = jittered(story.categories.map((c) => c.weight), random, 0.3);
  const byCategory: Row[] = story.categories.map((c, ci) => {
    const rows = byCategoryGroup.filter((r) => r[names.category] === c.name);
    return {
      [names.category]: c.name,
      [names.primary]: total(rows, names.primary),
      [names.secondary]: total(rows, names.secondary),
      [names.activity]: round(activityTotal * activityShares[ci]!),
      [names.size]: round(sizeMin + random() * (sizeMax - sizeMin)),
    };
  });

  const byCategoryPair: Row[] = byCategory.flatMap((row, ci) => {
    const second = story.pairByCategory[ci]! * (0.94 + random() * 0.12);
    return story.pairs.map((pair, pi) => {
      const share = pi === 0 ? 1 - second : second;
      return {
        [names.category]: row[names.category]!,
        [names.pair]: pair,
        [names.primary]: round(Number(row[names.primary]) * share),
        [names.secondary]: round(Number(row[names.secondary]) * share),
      };
    });
  });

  const byGroup: Row[] = groups.map((g, gi) => ({
    [names.group]: g.name,
    [names.primary]: round(groupPrimary[gi]!),
    [names.secondary]: round(groupSecondary[gi]!),
    [names.rate]: story.rateByGroup[gi]!,
  }));

  const byGroupSegment: Row[] = groups.flatMap((g, gi) => {
    const shares = jittered(story.affinity[gi]!, random, 0.1);
    return story.segments.map((segment, si) => ({
      [names.group]: g.name,
      [names.segment]: segment,
      [names.primary]: round(groupPrimary[gi]! * shares[si]!),
      [names.secondary]: round(groupSecondary[gi]! * shares[si]!),
    }));
  });

  const bySegment: Row[] = story.segments.map((segment) => {
    const rows = byGroupSegment.filter((r) => r[names.segment] === segment);
    return {
      [names.segment]: segment,
      [names.primary]: total(rows, names.primary),
      [names.secondary]: total(rows, names.secondary),
    };
  });

  const bySegmentPair: Row[] = bySegment.flatMap((row, si) =>
    story.pairs.map((pair, pi) => {
      const second = story.pairBySegment[si]!;
      const share = pi === 0 ? 1 - second : second;
      return {
        [names.segment]: row[names.segment]!,
        [names.pair]: pair,
        [names.primary]: round(Number(row[names.primary]) * share),
        [names.secondary]: round(Number(row[names.secondary]) * share),
      };
    }),
  );

  const byGroupPair: Row[] = groups.flatMap((g, gi) =>
    story.pairs.map((pair, pi) => {
      const second = story.pairByGroup[gi]!;
      const share = pi === 0 ? 1 - second : second;
      return {
        [names.group]: g.name,
        [names.pair]: pair,
        [names.primary]: round(groupPrimary[gi]! * share),
        [names.secondary]: round(groupSecondary[gi]! * share),
      };
    }),
  );

  const byPoint: Row[] = story.points.map(([entity, cluster, x, y, bubble]) => ({
    [extra.entity.name]: entity,
    [extra.cluster.name]: cluster,
    [extra.x.name]: x,
    [extra.y.name]: y,
    [extra.bubble.name]: bubble,
  }));

  let reached = story.funnelTop;
  const byStage: Row[] = story.stages.map((stage, i) => {
    if (i > 0) reached *= stage.kept;
    return { [specs.stage.name]: stage.name, [extra.funnel.name]: round(reached) };
  });

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
    extra,
    category: toDimension(specs.category),
    stage: toDimension(specs.stage),
    group: toDimension(specs.group),
    primary: toMeasure(specs.primary),
    secondary: toMeasure(specs.secondary),
    size: toMeasure(specs.size),
    time: (granularity) => toDimension(specs.time, granularity),
    byCategory,
    byCategoryGroup,
    byCategoryPair,
    byGroup,
    bySegment,
    byGroupSegment,
    byGroupPair,
    bySegmentPair,
    byPoint,
    byTime: (granularity) => memo(`t:${granularity}`, () => timeRows(granularity, false)),
    byTimeGroup: (granularity) => memo(`tg:${granularity}`, () => timeRows(granularity, true)),
    byTimeWindow: (granularity, window) =>
      memo(`tw:${granularity}:${window.from}:${window.to}`, () => timeRows(granularity, false, window)),
    byTimeGroupWindow: (granularity, window) =>
      memo(`tgw:${granularity}:${window.from}:${window.to}`, () => timeRows(granularity, true, window)),
    byStage,
    total: totalsRow(inWindow(WINDOWS.last30)),
    previousTotal: totalsRow(inWindow(WINDOWS.previous30)),
  };
};

export const datasets: Record<DatasetId, Dataset> = Object.fromEntries(
  stories.map((s) => [s.id, buildDataset(s)]),
) as Record<DatasetId, Dataset>;

export const datasetList = Object.values(datasets);

/**
 * The inputs that shorten a field's large numbers ("$1.5M"). A currency also
 * loses its whole-dollar `decimalPlaces`: the shortened figure takes its
 * decimals from it too, so `0` would round $1.5M to $2M.
 */
export const shortenInputs = (inputs?: FieldInputs): FieldInputs => ({
  abbreviateLargeNumber: true,
  ...(inputs?.currency && inputs.decimalPlaces === 0 ? { decimalPlaces: undefined } : {}),
});

const fieldCache = new Map<string, Dimension | Measure>();
const cached = <T extends Dimension | Measure>(key: string, build: () => T): T => {
  if (!fieldCache.has(key)) fieldCache.set(key, build());
  return fieldCache.get(key) as T;
};

/** The field behind an extra slot, as the components take it. The same object every time. */
export const extraField = (ds: Dataset, slot: ExtraSlot): Dimension | Measure => {
  const spec = ds.extra[slot];
  return cached(`${ds.id}:${slot}`, () => (spec.kind === 'dimension' ? toDimension(spec) : toMeasure(spec)));
};

/** The time dimension at one granularity with no picker, for a chart that plots fixed periods. */
export const fixedTime = (ds: Dataset, granularity: Granularity): Dimension => {
  const { name, title } = ds.specs.time;
  return cached(`${ds.id}:time:${granularity}`, () => dimension({ name, title, type: 'time', granularity }));
};
