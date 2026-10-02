import { useMemo } from 'react';
import { ChartSettings } from '../catalog/build';
import { ChartEntry } from '../catalog/registry';
import { useSiteSettings } from '../state';
import { useChart } from './useChart';

type LiveChartProps = {
  entry: ChartEntry;
  height: number;
  overrides?: Partial<ChartSettings>;
};

export const LiveChart = ({ entry, height, overrides }: LiveChartProps) => {
  const { themeId, languageId, datasetId } = useSiteSettings();
  const settings = useMemo<ChartSettings>(
    () => ({ themeId, languageId, datasetId, dataState: 'ready', toggles: {}, ...overrides }),
    [themeId, languageId, datasetId, JSON.stringify(overrides)], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const { built, Component } = useChart(entry, settings);
  return (
    <div style={{ height }}>
      <Component {...built.props} />
    </div>
  );
};
