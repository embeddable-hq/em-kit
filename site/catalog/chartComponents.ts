import type { ComponentType } from 'react';
import * as Charts from '../../src';
import type { ChartEntry } from './registry';

// The component a registry entry renders. A module of its own, so the registry,
// which the sidebar, search and routes read on every page, does not import
// the chart library: only pages that draw charts import this.
export const getComponent = (entry: ChartEntry) =>
  Charts[entry.exportName] as unknown as ComponentType<Record<string, unknown>>;
