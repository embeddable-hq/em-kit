import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { buildChart, ChartRuntime, ChartSettings } from '../catalog/build';
import { ChartEntry, DataState } from '../catalog/registry';
import { cardHeight, exampleHeight, exampleWidth } from '../catalog/sizes';
import { ComponentExample } from '../content/components';
import { useCanvas, useSiteSettings } from '../state';
import { useChart } from './useChart';

// How a live preview is sized and mounted, on component pages and on the
// components index.

type Props = Record<string, unknown>;

// The height held for a table that sizes itself until it mounts.
const AUTO_PLACEHOLDER = 360;

/**
 * How tall a preview is, from the props the example passes.
 *
 * On a component's page it is the height the example code gives its wrapper
 * (`exampleHeight`), so the preview is what the code renders. That depends on
 * the example (a KPI with a comparison is taller than one without, a pivot
 * table as tall as its rows), so without `props` the page height is left to
 * `ChartPreview`, which has them. An index card can be shorter, where the
 * chart still shows everything at a third of a row (`cardHeight`).
 */
export const previewHeight = (entry: ChartEntry, size: 'card' | 'page', props?: Props): number | undefined => {
  if (!props) return undefined;
  return size === 'page' ? (exampleHeight(entry, props) ?? AUTO_PLACEHOLDER) : cardHeight(entry, props);
};

/**
 * Tables, and the charts the registry marks as wide (tabs above the plot, or
 * two value axes), need the width: on the index they take half a row, not a third.
 */
export const isWidePreview = (entry: ChartEntry) => entry.group === 'Tables' || Boolean(entry.wide);

/**
 * A pie or donut is round: on a component's page its card is capped at a width
 * near its height, so the ring is not a quarter of a wide, empty card.
 */
export const isRoundPreview = (entry: ChartEntry) => entry.group === 'Pies';

/**
 * Mounts its children when they are about to scroll into view, holding their
 * height until then, so a page of charts paints its first screen without
 * drawing the rest.
 */
export const LazyMount = ({
  height,
  width,
  grow,
  eager,
  className,
  children,
}: {
  height: number;
  /** A fixed width, centred, for a preview of a small card. */
  width?: number;
  /** Let the content set the height once mounted, for a component that sizes itself. */
  grow?: boolean;
  eager?: boolean;
  className?: string;
  children: ReactNode;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(Boolean(eager));

  useEffect(() => {
    if (mounted) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setMounted(true);
      return;
    }
    const observer = new IntersectionObserver(
      (items) => {
        if (items.some((item) => item.isIntersecting)) setMounted(true);
      },
      { rootMargin: '400px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [mounted]);

  return (
    <div
      ref={ref}
      className={['chart-slot', grow ? 'chart-slot--grow' : '', className ?? ''].filter(Boolean).join(' ')}
      style={{
        ...(grow && mounted ? {} : { height }),
        ...(width ? { width, maxWidth: '100%', marginInline: 'auto' } : {}),
      }}
      // A component that grows can outgrow the page: its preview is a window onto it.
      {...(grow ? { tabIndex: 0, role: 'region', 'aria-label': 'Preview, scrollable' } : {})}
    >
      {mounted ? children : <div className="chart-slot__placeholder" aria-hidden />}
    </div>
  );
};

const idle: ChartRuntime = {
  granularity: 'month',
  setGranularity: () => {},
  tableState: { page: 0, isLoadingDownloadData: false },
  setTableState: () => {},
  onEvent: () => {},
};

/**
 * The live component for one example, following the site-wide theme, language
 * and data set. Its height comes from `previewHeight` unless `height` is given:
 * on a page, the code's height; on an index card (`size="card"`), the card's.
 * Switching the preview to loading, empty or error keeps the height the data
 * needs, so the page does not jump.
 */
export const ChartPreview = ({
  entry,
  example,
  dataState = 'ready',
  height,
  size = 'page',
  eager,
}: {
  entry: ChartEntry;
  example: ComponentExample;
  dataState?: DataState;
  height?: number;
  size?: 'card' | 'page';
  eager?: boolean;
}) => {
  const { themeId, languageId, datasetId } = useSiteSettings();
  const canvas = useCanvas();
  const settings = useMemo<ChartSettings>(
    () => ({
      themeId,
      languageId,
      datasetId,
      dataState,
      variantId: example.variantId,
      overrides: example.overrides,
      toggles: {},
    }),
    [themeId, languageId, datasetId, dataState, example],
  );
  const { built, Component } = useChart(entry, settings);
  // The props with data, for the height: a table's rows decide it.
  const sized = useMemo(
    () => (dataState === 'ready' ? built.props : buildChart(entry, { ...settings, dataState: 'ready' }, idle).props),
    [built, dataState, entry, settings],
  );
  const slotHeight = height ?? previewHeight(entry, size, sized)!;
  const round = size === 'page' && isRoundPreview(entry);
  // A small card (a KPI tile, a preset about one) is drawn that size on a
  // page, and so is a round one; on the index the card is its own size.
  const width = size === 'page' ? exampleWidth(entry, example.variantId) : undefined;
  // The frame is the chart's one border, and its card inside draws none (components.css).
  // A control has no card of its own, so the frame gives it the padding a card would.
  const control = entry.group === 'Controls' ? 'chart-canvas--control' : '';
  const classes = ['chart-canvas', canvas.dark ? 'is-dark' : '', width || round ? 'chart-canvas--fit' : '', control];
  return (
    <div className={classes.filter(Boolean).join(' ')} style={{ background: canvas.background }}>
      <LazyMount
        height={slotHeight}
        width={width}
        eager={eager}
        grow={built.props.heightMode === 'auto'}
        className={round ? 'chart-slot--round' : undefined}
      >
        <Component {...built.props} />
      </LazyMount>
    </div>
  );
};
