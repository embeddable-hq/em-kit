import { useCallback, useMemo, useState } from 'react';
import type { Granularity } from '../../src';
import { buildChart, ChartSettings } from '../catalog/build';
import { getComponent } from '../catalog/chartComponents';
import { ChartEntry, TableState } from '../catalog/registry';

export type ChartEvent = { id: number; name: string; payload: unknown; at: string };

export const useChart = (entry: ChartEntry, settings: ChartSettings) => {
  const [granularity, setGranularity] = useState<Granularity>('month');
  const [tableState, setTableState] = useState<TableState>({ page: 0, isLoadingDownloadData: false });
  const [events, setEvents] = useState<ChartEvent[]>([]);
  // A control's value once the reader sets it, for the example it was set on.
  const example = `${entry.id}|${settings.variantId ?? ''}`;
  const [held, setHeld] = useState<{ example: string; value: unknown }>();
  const control = held?.example === example ? held : undefined;
  const setControl = useCallback((value: unknown) => setHeld({ example, value }), [example]);

  const onEvent = useCallback((name: string, payload: unknown) => {
    setEvents((prev) =>
      [{ id: Date.now() + Math.random(), name, payload, at: new Date().toLocaleTimeString() }, ...prev].slice(0, 6),
    );
  }, []);

  const built = useMemo(
    () => buildChart(entry, settings, { granularity, setGranularity, tableState, setTableState, onEvent, control, setControl }),
    [entry, settings, granularity, tableState, onEvent, control, setControl],
  );

  return { built, Component: getComponent(entry), events, clearEvents: () => setEvents([]), granularity, setGranularity };
};
