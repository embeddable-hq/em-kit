import { useState } from 'react';
import {
  DateRangePicker,
  GranularitySelect,
  LineChartGrouped,
  MultiSelect,
  dateRangePreset,
  dimension,
  measure,
  optionsOf,
  results,
} from '../../src';
import type { Granularity, TimeRange } from '../../src';

const region = dimension({ name: 'region', title: 'Region' });
const signups = measure({ name: 'signups', title: 'Signups' });

// A year of daily signups per region, ending today: a stand-in for your server.
const DAY = 86_400_000;
const today = new Date().setUTCHours(0, 0, 0, 0);
const daily = ['Americas', 'EMEA', 'APAC'].flatMap((name, r) =>
  Array.from({ length: 365 }, (_, i) => ({
    day: today - (364 - i) * DAY,
    region: name,
    signups: Math.round(40 - r * 10 + 12 * Math.sin(i / 9 + r)),
  })),
);

// The start of the period a day falls in, as the chart expects it.
const bucket = (time: number, granularity: Granularity) => {
  const d = new Date(time);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const start = {
    day: time,
    week: time - ((d.getUTCDay() + 6) % 7) * DAY,
    month: Date.UTC(y, m, 1),
    quarter: Date.UTC(y, m - (m % 3), 1),
    year: Date.UTC(y, 0, 1),
  }[granularity as 'day'];
  return new Date(start ?? time).toISOString().slice(0, 23);
};

// What your API would do: filter, then sum by period and region.
const query = (range: TimeRange, granularity: Granularity, regions: string[]) => {
  const sums = new Map<string, { region: string; signups: number; period: string }>();
  for (const row of daily) {
    if (row.day < range!.from!.getTime() || row.day > range!.to!.getTime()) continue;
    if (regions.length && !regions.includes(row.region)) continue;
    const period = bucket(row.day, granularity);
    const key = `${period} ${row.region}`;
    const sum = sums.get(key) ?? { region: row.region, signups: 0, period };
    sum.signups += row.signups;
    sums.set(key, sum);
  }
  return [...sums.values()].map(({ period, ...rest }) => ({ ...rest, day: period }));
};

const bar = { display: 'flex', flexWrap: 'wrap', gap: 16 } as const;

export function SignupsFilters() {
  const [range, setRange] = useState<TimeRange>(dateRangePreset('Last 6 months'));
  const [granularity, setGranularity] = useState<Granularity>('week');
  const [regions, setRegions] = useState<string[]>([]);

  const day = dimension({ name: 'day', title: 'Day', type: 'time', granularity });
  // The picker works out a preset's dates and reports them once it mounts.
  const rows = range?.from && range.to ? query(range, granularity, regions) : undefined;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={bar}>
        <DateRangePicker title="Dates" selectedValue={range} onChange={setRange} />
        <GranularitySelect
          title="Group by"
          granularity={granularity}
          primaryTimeRange={range}
          onChange={setGranularity}
        />
        <MultiSelect
          title="Region"
          dimension={region}
          results={optionsOf(daily, region)}
          selectedValues={regions}
          onChange={setRegions}
        />
      </div>
      <div style={{ height: 320 }}>
        <LineChartGrouped
          title="Signups by region"
          xAxis={day}
          groupBy={region}
          measure={signups}
          results={results(rows)}
          granularity={granularity}
          showValueLabels={false}
        />
      </div>
    </div>
  );
}
