import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import type { Dataset, Row } from '../catalog/datasets';

const HOURS = 48;
const TICK_MS = 1100;
const ISO = 'YYYY-MM-DDTHH:mm:ss.SSS';

type Bucket = { time: dayjs.Dayjs; values: number[]; targets: number[] };

// Business-hours shaped curve: quiet overnight, peak mid-afternoon.
const hourCurve = (hour: number) => 0.35 + 0.65 * Math.max(0, Math.sin(((hour - 5) / 19) * Math.PI));

const groupNames = (ds: Dataset) => [
  ...new Set(ds.byCategoryGroup.map((r) => String(r[ds.specs.group.name]))),
];

const baseline = (ds: Dataset, groups: string[]) => {
  const recentDays = ds.byTimeGroup('day').slice(-7 * groups.length);
  return groups.map((g) => {
    const rows = recentDays.filter((r) => r[ds.specs.group.name] === g);
    const avg = rows.reduce((s, r) => s + Number(r[ds.specs.primary.name] ?? 0), 0) / Math.max(1, rows.length);
    return avg / 24;
  });
};

// Scaled up from the daily sample so the hero reads like a busy production app.
const HERO_SCALE = 14;

const makeTargets = (time: dayjs.Dayjs, base: number[]) =>
  base.map((b) => b * HERO_SCALE * hourCurve(time.hour()) * 2.1 * (0.85 + Math.random() * 0.3));

const initialBuckets = (base: number[]): Bucket[] => {
  const now = dayjs().startOf('hour');
  return Array.from({ length: HOURS }, (_, i) => {
    const time = now.subtract(HOURS - 1 - i, 'hour');
    const targets = makeTargets(time, base);
    const isCurrent = i === HOURS - 1;
    return { time, targets, values: isCurrent ? targets.map((t) => t * 0.35) : targets };
  });
};

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export type LiveSeries = {
  rows: Row[];
  groups: string[];
  thisHour: number;
  last24: number;
  previous24: number;
  peakHour: number;
  byGroup: Row[];
};

// Simulates a query result that keeps updating: the current hour fills up,
// then rolls over into a new one.
export const useLiveSeries = (ds: Dataset): LiveSeries => {
  const groups = useMemo(() => groupNames(ds), [ds]);
  const base = useMemo(() => baseline(ds, groups), [ds, groups]);
  const [buckets, setBuckets] = useState<Bucket[]>(() => initialBuckets(base));

  useEffect(() => setBuckets(initialBuckets(base)), [base]);

  useEffect(() => {
    if (reducedMotion()) return;
    const id = window.setInterval(() => {
      setBuckets((prev) => {
        const last = prev[prev.length - 1]!;
        const values = last.values.map((v, i) => v + last.targets[i]! * (0.025 + Math.random() * 0.04));
        if (values.every((v, i) => v >= last.targets[i]!)) {
          const time = last.time.add(1, 'hour');
          const targets = makeTargets(time, base);
          return [...prev.slice(1, -1), { ...last, values: last.targets }, { time, targets, values: targets.map((t) => t * 0.06) }];
        }
        return [...prev.slice(0, -1), { ...last, values }];
      });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [base]);

  return useMemo(() => {
    const { specs } = ds;
    const timeKey = specs.time.name;
    const rows = buckets.flatMap((b) => {
      const iso = b.time.format(ISO);
      return groups.map((g, i) => ({
        [timeKey]: iso,
        [`${timeKey}.hour`]: iso,
        [specs.group.name]: g,
        [specs.primary.name]: Math.round(b.values[i]!),
      }));
    });
    const totals = buckets.map((b) => b.values.reduce((a, v) => a + v, 0));
    const sum = (xs: number[]) => Math.round(xs.reduce((a, v) => a + v, 0));
    return {
      rows,
      groups,
      thisHour: Math.round(totals[totals.length - 1] ?? 0),
      last24: sum(totals.slice(-24)),
      previous24: sum(totals.slice(0, -24)),
      peakHour: Math.round(Math.max(...totals)),
      byGroup: groups.map((g, i) => ({
        [specs.group.name]: g,
        [specs.primary.name]: sum(buckets.slice(-24).map((b) => b.values[i]!)),
      })),
    };
  }, [buckets, ds, groups]);
};
