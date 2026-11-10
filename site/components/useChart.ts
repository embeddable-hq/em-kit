import { useCallback, useMemo, useState } from 'react';
import type { Granularity } from '../../src';
import { buildChart, ChartSettings } from '../catalog/build';
import { ChartEntry, getComponent, TableState } from '../catalog/registry';

export type ChartEvent = { id: number; name: string; payload: unknown; at: string };

export const useChart = (entry: ChartEntry, settings: ChartSettings) => {
  const [granularity, setGranularity] = useState<Granularity>('month');
  const [tableState, setTableState] = useState<TableState>({ page: 0, isLoadingDownloadData: false });
  const [events, setEvents] = useState<ChartEvent[]>([]);

  const onEvent = useCallback((name: string, payload: unknown) => {
    setEvents((prev) =>
      [{ id: Date.now() + Math.random(), name, payload, at: new Date().toLocaleTimeString() }, ...prev].slice(0, 6),
    );
  }, []);

  const built = useMemo(
    () => buildChart(entry, settings, { granularity, setGranularity, tableState, setTableState, onEvent }),
    [entry, settings, granularity, tableState, onEvent],
  );

  return { built, Component: getComponent(entry), events, clearEvents: () => setEvents([]), granularity, setGranularity };
};
