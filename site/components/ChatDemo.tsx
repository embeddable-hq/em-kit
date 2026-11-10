import { useCallback, useEffect, useRef, useState } from 'react';
import { ChartFromSpec, intentToPrompt } from '../../src';
import type { ChartIntent, ChartSpec } from '../../src';
import { aiChatWiringCode } from '../catalog/aiSnippets';
import { useCanvas } from '../state';
import { CodeBlock } from './CodeBlock';

// A mock chat that shows the two-way loop: the assistant answers with a chart,
// a click on it becomes a follow-up message, the assistant answers with the
// next chart. There is no model behind it; the replies are computed from the
// tiny dataset below, so everything stays local to this file.

const MONTHS = ['2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01'];

// Monthly revenue, April to September 2026. "Last quarter" is the final three.
const REVENUE: Record<string, number[]> = {
  'North America': [118400, 121900, 126300, 132600, 139800, 148200],
  Europe: [96800, 101200, 104700, 111500, 119900, 128700],
  'Asia Pacific': [61400, 64700, 70100, 76800, 83200, 90500],
  'Latin America': [21200, 22800, 22100, 24900, 27300, 29800],
  'Middle East & Africa': [15600, 16100, 17900, 18400, 20200, 21700],
};

const REGIONS = Object.keys(REVENUE);
const sum = (values: number[]) => values.reduce((a, v) => a + v, 0);
const lastQuarter = (region: string) => sum(REVENUE[region]!.slice(-3));
const total = sum(REGIONS.map(lastQuarter));

const money = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n / 1e3)}K`);
const percent = (part: number, whole: number) => Math.round((part / whole) * 100);

const revenueField = {
  name: 'revenue',
  title: 'Revenue',
  format: { prefix: '$', decimalPlaces: 0, abbreviateLargeNumber: true },
};

const donutSpec: ChartSpec = {
  chart: 'donut',
  title: 'Revenue by region',
  dimension: { name: 'region', title: 'Region' },
  measure: revenueField,
  rows: REGIONS.map((region) => ({ region, revenue: lastQuarter(region) })),
  options: { showLegend: true, showTooltips: true },
};

const regionSpec = (region: string): ChartSpec => ({
  chart: 'line',
  title: `${region} revenue by month`,
  xAxis: { name: 'month', title: 'Month' },
  measures: [revenueField],
  granularity: 'month',
  rows: MONTHS.map((month, i) => ({ month, revenue: REVENUE[region]![i] })),
  options: { showTooltips: true },
});

const overview = () => {
  const [top] = [...REGIONS].sort((a, b) => lastQuarter(b) - lastQuarter(a));
  return `${top} led last quarter with ${money(lastQuarter(top!))}, ${percent(lastQuarter(top!), total)}% of ${money(total)}. Click a slice to dig in.`;
};

const regionSummary = (region: string) => {
  const series = REVENUE[region]!;
  const change = percent(series[series.length - 1]! - series[0]!, series[0]!);
  const share = percent(lastQuarter(region), total);
  return `${region} brought in ${money(lastQuarter(region))} last quarter, ${share}% of the total. Monthly revenue is ${change >= 0 ? 'up' : 'down'} ${Math.abs(change)}% since April.`;
};

type Message =
  | { id: number; role: 'user'; text: string; auto?: boolean }
  | { id: number; role: 'assistant'; text: string; spec: ChartSpec; interactive?: boolean };

const firstId = 3;
const initialThread = (): Message[] => [
  { id: 1, role: 'user', text: 'How did revenue split by region last quarter?' },
  { id: 2, role: 'assistant', text: overview(), spec: donutSpec, interactive: true },
];

const REPLY_DELAY_MS = 800;

const wiringCode = aiChatWiringCode;

export const ChatDemo = () => {
  const canvas = useCanvas();
  const [thread, setThread] = useState<Message[]>(initialThread);
  const [pending, setPending] = useState(0);
  const [lastIntent, setLastIntent] = useState<ChartIntent | null>(null);

  const nextId = useRef(firstId);
  const timers = useRef(new Set<number>());
  const threadRef = useRef<HTMLDivElement>(null);
  const seen = useRef({ length: thread.length, pending: 0 });

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current.clear();
    },
    [],
  );

  // Keep the newest bubble in view, but not on first paint or after a reset.
  useEffect(() => {
    const el = threadRef.current;
    const grew = thread.length > seen.current.length || pending > seen.current.pending;
    seen.current = { length: thread.length, pending };
    if (!el || !grew) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
  }, [thread.length, pending]);

  const handleIntent = useCallback((intent: ChartIntent) => {
    setLastIntent(intent);
    const region = typeof intent.value === 'string' ? intent.value : undefined;
    if (intent.type !== 'segment-click' || !region || !(region in REVENUE)) return;

    const userId = nextId.current++;
    const replyId = nextId.current++;
    setThread((t) => [...t, { id: userId, role: 'user', text: intentToPrompt(intent), auto: true }]);
    setPending((n) => n + 1);

    // The "model": answer with the same region as a monthly line.
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      setThread((t) => [...t, { id: replyId, role: 'assistant', text: regionSummary(region), spec: regionSpec(region) }]);
      setPending((n) => n - 1);
    }, REPLY_DELAY_MS);
    timers.current.add(timer);
  }, []);

  const reset = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current.clear();
    nextId.current = firstId;
    setPending(0);
    setLastIntent(null);
    setThread(initialThread());
    threadRef.current?.scrollTo({ top: 0 });
  };

  const isReset = thread.length === 2 && pending === 0;

  return (
    <div className="ai-chat-demo">
      <div className="ai-chat-demo__side">
        <h3>The loop, end to end</h3>
        <ol className="ai-chat-demo__steps">
          <li>
            The assistant answers with a donut spec. <code>ChartFromSpec</code> draws it inside the bubble with{' '}
            <code>chrome=&quot;bare&quot;</code>.
          </li>
          <li>
            A click on a slice calls <code>onIntent</code> with a typed <code>ChartIntent</code>.
          </li>
          <li>
            <code>intentToPrompt</code> turns it into one line. Your app sends it as the next user message and the model
            replies with the next chart.
          </li>
        </ol>
        <CodeBlock code={wiringCode} />
        <div className="ai-intent">
          <div className="ai-intent__head">
            <span className="control__label">Last intent received</span>
          </div>
          {lastIntent ? (
            <pre tabIndex={0}>{JSON.stringify(lastIntent, null, 2)}</pre>
          ) : (
            <p className="muted">Click a slice in the chat to see the object your handler receives.</p>
          )}
        </div>
      </div>

      <div className={`ai-chat${canvas.dark ? ' is-dark' : ''}`} style={{ background: canvas.background }}>
        <div className="ai-chat__head">
          <span className="ai-chat__avatar" aria-hidden />
          <div className="ai-chat__who">
            <strong>Analytics assistant</strong>
            <span>Mock conversation · data is local</span>
          </div>
          <button type="button" className="text-button" onClick={reset} disabled={isReset}>
            Reset
          </button>
        </div>

        <div className="ai-chat__thread" ref={threadRef} role="log" aria-label="Mock chat conversation">
          {thread.map((m) => (
            <div key={m.id} className={`ai-msg ai-msg--${m.role}`}>
              <div className={`ai-bubble${m.role === 'assistant' ? ' ai-bubble--chart' : ''}`}>
                <p>{m.text}</p>
                {m.role === 'assistant' && (
                  <div className="ai-bubble__chart">
                    <ChartFromSpec
                      spec={m.spec}
                      chrome="bare"
                      height={260}
                      onIntent={m.interactive ? handleIntent : undefined}
                    />
                  </div>
                )}
              </div>
              {m.role === 'user' && m.auto && (
                <span className="ai-msg__meta">Sent by your app from onIntent → intentToPrompt()</span>
              )}
            </div>
          ))}
          {pending > 0 && (
            <div className="ai-msg ai-msg--assistant">
              <div className="ai-bubble ai-typing" role="status" aria-label="The assistant is typing">
                <i />
                <i />
                <i />
              </div>
            </div>
          )}
        </div>

        <div className="ai-chat__composer" aria-hidden>
          <span>Ask about your data…</span>
        </div>
      </div>
    </div>
  );
};
