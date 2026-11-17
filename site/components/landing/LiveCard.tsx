import { useState } from 'react';
import { useCanvas } from '../../state';
import { codeLines, kitComparisonCode, rawComparisonCode, RevenueByRegion } from './comparisonCode';
import { LazyMount } from './LazyMount';
import { regionRows } from './regions';

type CardProps = Parameters<typeof RevenueByRegion>[0];
type ClickPayload = Parameters<NonNullable<CardProps['onBarClicked']>>[0];

const rows = regionRows;

type StateId = 'data' | 'loading' | 'empty' | 'error';

const states: Record<StateId, { label: string; props: CardProps }> = {
  data: { label: 'Data', props: { rows, isLoading: false } },
  loading: { label: 'Loading', props: { isLoading: true } },
  empty: { label: 'Empty', props: { rows: [], isLoading: false } },
  error: { label: 'Error', props: { isLoading: false, error: 'The query timed out after 30 seconds.' } },
};

/** A click payload on one line, exactly as the handler received it. */
export const payloadText = (payload: unknown) => JSON.stringify(payload, null, 1).replace(/\s*\n\s*/g, ' ');

// What the card's onBarClicked last received: the proof that a click reaches
// your code. Announced politely, so a screen reader hears the new payload.
export const ClickLine = ({ payload }: { payload?: unknown }) => (
  <p id="clicks" className="lp-live__click" aria-live="polite">
    {payload === undefined ? (
      <>
        Click a bar: <code>onBarClicked</code> receives its value.
      </>
    ) : (
      <>
        <span>Last click</span> <code>onBarClicked({payloadText(payload)})</code>
      </>
    )}
  </p>
);

// One finished card, live: the buttons change only the props it is given, a
// click on a bar comes back through its handler, and its menu exports. It is
// the file site/examples/RevenueByRegion.tsx, under the same provider as the
// rest of the page. The Why page prints that file beside the chart-library
// version (site/content/guides.ts); here the page says how long each is.
export const LiveCard = () => {
  const [state, setState] = useState<StateId>('data');
  const [click, setClick] = useState<ClickPayload>();
  const canvas = useCanvas();

  return (
    <div id="live-card" className={`lp-live${canvas.dark ? ' is-dark' : ''}`} style={{ background: canvas.background }}>
      <div id="states" className="lp-live__states">
        <span id="lp-live-states">Try each state</span>
        <div className="segmented" role="radiogroup" aria-labelledby="lp-live-states">
          {(Object.keys(states) as StateId[]).map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={state === id}
              className={state === id ? 'is-active' : ''}
              onClick={() => setState(id)}
            >
              {states[id].label}
            </button>
          ))}
        </div>
      </div>
      <LazyMount height={400}>
        <RevenueByRegion {...states[state].props} onBarClicked={setClick} />
      </LazyMount>
      <ClickLine payload={click} />
    </div>
  );
};

/** How long the card's file is, and the same card on a chart library: said on the landing page, printed on the Why page. */
export const cardLines = { kit: codeLines(kitComparisonCode), raw: codeLines(rawComparisonCode) };
