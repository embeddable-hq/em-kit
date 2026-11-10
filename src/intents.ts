// Chart interactions, normalized into one serializable shape a chat app can
// hand back to a model. Produced by <ChartFromSpec onIntent={...}>.

import type { ChartKind } from './spec';

export type ChartIntentType =
  | 'bar-click'
  | 'line-click'
  | 'point-click'
  | 'area-click'
  | 'segment-click'
  | 'cell-click'
  | 'row-click';

export type ChartIntent = {
  type: ChartIntentType;
  chart: ChartKind;
  /** The chart's title, when it has one. */
  title?: string;
  /** Row key of the primary dimension the user clicked on. */
  dimension?: string;
  value?: string | number | boolean | null;
  /** Grouping/column dimension, where the chart has one. */
  groupDimension?: string;
  groupValue?: string | number | boolean | null;
  measureValue?: number;
  /** ISO strings, zone-less — covered period when the clicked element is a time bucket. */
  timeRange?: { from?: string; to?: string };
  /** The component's raw click payload with dates serialized to ISO strings. */
  details?: Record<string, unknown>;
};

const quoted = (value: unknown) => (typeof value === 'string' ? `"${value}"` : String(value));

/**
 * One plain-English line describing the interaction, phrased as a follow-up a
 * chat app can send to the model on the user's behalf.
 */
export const intentToPrompt = (intent: ChartIntent): string => {
  const source = intent.title ? ` on the "${intent.title}" chart` : '';
  const period =
    intent.timeRange?.from || intent.timeRange?.to
      ? ` (${intent.timeRange.from ?? '…'} to ${intent.timeRange.to ?? '…'})`
      : '';

  const parts: string[] = [];
  if (intent.dimension && intent.value != null) parts.push(`${intent.dimension} ${quoted(intent.value)}`);
  if (intent.groupDimension && intent.groupValue != null) {
    parts.push(`${intent.groupDimension} ${quoted(intent.groupValue)}`);
  }

  if (parts.length === 0) return `The user clicked${source}${period}. Drill into it.`;
  return `The user clicked ${parts.join(' × ')}${source}${period}. Drill into it.`;
};
