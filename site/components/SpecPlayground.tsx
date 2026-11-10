import { useCallback, useEffect, useRef, useState } from 'react';
import { ChartFromSpec, intentToPrompt } from '../../src';
import type { ChartFromSpecProps, ChartIntent, ChartSpec } from '../../src';
import { aiExamples, toJson } from '../catalog/aiExamples';
import { useCanvas } from '../state';

type Chrome = NonNullable<ChartFromSpecProps['chrome']>;

const chromes: { id: Chrome; hint: string }[] = [
  { id: 'card', hint: 'Full card: header and export menu' },
  { id: 'plain', hint: 'Header, no export menu' },
  { id: 'bare', hint: 'No header, flat: for a chat bubble' },
];

const examples = aiExamples.map((example) => ({ ...example, text: toJson(example.spec) }));
type Example = (typeof examples)[number];

const LOG_LIMIT = 20;
const PARSE_DELAY_MS = 250;

type LoggedIntent = { id: number; at: string; intent: ChartIntent; prompt: string };

// Content-sized charts need less room than a table or a heat map. Derived from
// the parsed spec so editing `chart` in the textarea resizes the preview too.
const previewHeight = (spec: unknown) => {
  const kind = typeof spec === 'object' && spec !== null ? (spec as { chart?: unknown }).chart : undefined;
  if (kind === 'kpi' || kind === 'kpiComparison') return 240;
  if (kind === 'table' || kind === 'pivot' || kind === 'heatmap') return 420;
  // The KPI tab header sits above the line, so these need extra room.
  if (kind === 'lineWithKpiTabs' || kind === 'lineComparisonWithKpiTabs') return 460;
  return 380;
};

// Paste a spec, see what the renderer does with it. Invalid JSON keeps the last
// good spec on screen; a valid but wrong spec shows whatever ChartFromSpec
// makes of it, which is the point.
export const SpecPlayground = () => {
  const canvas = useCanvas();
  const [text, setText] = useState(examples[0]!.text);
  const [spec, setSpec] = useState<unknown>(() => JSON.parse(examples[0]!.text));
  const [error, setError] = useState<string | null>(null);
  const [chrome, setChrome] = useState<Chrome>('card');
  const [chartKey, setChartKey] = useState(0);
  const [log, setLog] = useState<LoggedIntent[]>([]);

  const parsedText = useRef(text);
  const logId = useRef(0);

  // Parse once typing pauses. `parsedText` is the text the current spec/error
  // were derived from, so the first run (and an edit that undoes itself)
  // doesn't re-render the chart for nothing.
  useEffect(() => {
    if (text === parsedText.current) return;
    const timer = window.setTimeout(() => {
      parsedText.current = text;
      try {
        setSpec(JSON.parse(text));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Invalid JSON');
      }
    }, PARSE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [text]);

  const load = (example: Example) => {
    parsedText.current = example.text;
    setText(example.text);
    setSpec(JSON.parse(example.text));
    setError(null);
    setChartKey((k) => k + 1); // fresh table paging and pivot state
  };

  const handleIntent = useCallback((intent: ChartIntent) => {
    const entry = {
      id: logId.current++,
      at: new Date().toLocaleTimeString([], { hour12: false }),
      intent,
      prompt: intentToPrompt(intent),
    };
    setLog((l) => [entry, ...l].slice(0, LOG_LIMIT));
  }, []);

  const activeExample = examples.find((e) => e.text === text)?.id;

  return (
    <div className="ai-playground">
      <div className="context-bar__controls">
        <div className="context-bar__item">
          <span className="context-bar__label">Example specs</span>
          <div className="segmented segmented--wrap" role="group" aria-label="Example specs">
            {examples.map((example) => (
              <button
                key={example.id}
                type="button"
                className={activeExample === example.id ? 'is-active' : ''}
                aria-pressed={activeExample === example.id}
                title={example.hint}
                onClick={() => load(example)}
              >
                {example.label}
              </button>
            ))}
          </div>
        </div>
        <div className="context-bar__item">
          <span className="context-bar__label">chrome</span>
          <div className="segmented" role="radiogroup" aria-label="Chart chrome">
            {chromes.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={chrome === c.id}
                className={chrome === c.id ? 'is-active' : ''}
                title={c.hint}
                onClick={() => setChrome(c.id)}
              >
                {c.id}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="ai-playground__grid">
        <div className="ai-editor">
          <div className="ai-editor__bar">
            <label className="code-block__label" htmlFor="ai-spec-json">
              spec.json
            </label>
            <span className={`ai-editor__status${error ? ' is-error' : ''}`}>{error ? 'Invalid JSON' : 'Valid JSON'}</span>
          </div>
          <textarea
            id="ai-spec-json"
            className="ai-editor__input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            wrap="off"
            aria-describedby="ai-spec-note"
          />
          <p id="ai-spec-note" className={`ai-editor__note${error ? ' is-error' : ''}`} role="status">
            {error
              ? `${error}. Showing the last valid spec.`
              : 'Edit the spec and the chart updates as you type. Try changing "chart" or removing a field.'}
          </p>
        </div>

        <div className="ai-playground__preview">
          <div className={`ai-canvas${canvas.dark ? ' is-dark' : ''}`} style={{ background: canvas.background }}>
            <ChartFromSpec
              key={chartKey}
              spec={spec as ChartSpec}
              chrome={chrome}
              height={previewHeight(spec)}
              onIntent={handleIntent}
            />
          </div>

          <div className="events">
            <div className="events__head">
              <h3>Intent log</h3>
              {log.length > 0 && (
                <button type="button" className="text-button" onClick={() => setLog([])}>
                  Clear
                </button>
              )}
            </div>
            {log.length === 0 ? (
              <p className="muted">
                Click a slice, bar, point or table row. Each click is one <code>ChartIntent</code>, followed by the line{' '}
                <code>intentToPrompt</code> would send to the model.
              </p>
            ) : (
              <ul className="events__list">
                {log.map(({ id, at, intent, prompt }) => (
                  <li key={id}>
                    <span className="events__name">{intent.type}</span>
                    <span className="muted">{at}</span>
                    <pre tabIndex={0}>{JSON.stringify(intent, null, 2)}</pre>
                    <p className="ai-prompt">
                      <span>intentToPrompt(intent)</span>
                      {prompt}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
