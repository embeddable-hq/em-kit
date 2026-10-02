import { useMemo, useState } from 'react';
import { CodeBlock } from '../components/CodeBlock';
import { DatasetSelect, LanguageSwitcher, ThemeSwitcher } from '../components/Switchers';
import { useChart } from '../components/useChart';
import { ChartSettings } from '../catalog/build';
import { chartEntries, ChartEntry, DataState } from '../catalog/registry';
import { href } from '../router';
import { useCanvas, useSiteSettings } from '../state';

const dataStates: { id: DataState; label: string }[] = [
  { id: 'ready', label: 'Data' },
  { id: 'loading', label: 'Loading' },
  { id: 'empty', label: 'Empty' },
  { id: 'error', label: 'Error' },
];

type Tab = 'preview' | 'code' | 'data';

const safeStringify = (value: unknown) => {
  const seen = new WeakSet();
  return JSON.stringify(
    value,
    (_key, v) => {
      if (typeof v === 'object' && v !== null) {
        if (seen.has(v)) return '[Circular]';
        seen.add(v);
      }
      return v;
    },
    2,
  );
};

const Playground = ({ entry }: { entry: ChartEntry }) => {
  const { themeId, languageId, datasetId } = useSiteSettings();
  const canvas = useCanvas();
  const [tab, setTab] = useState<Tab>('preview');
  const [dataState, setDataState] = useState<DataState>('ready');
  const [title, setTitle] = useState<string | undefined>(undefined);
  const [toggles, setToggles] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(entry.toggles.map((t) => [t.key, t.default])),
  );

  const settings = useMemo<ChartSettings>(
    () => ({ themeId, languageId, datasetId, dataState, toggles, title }),
    [themeId, languageId, datasetId, dataState, toggles, title],
  );
  const { built, Component, events, clearEvents } = useChart(entry, settings);
  // Titles are "key|fallback" translation strings; edit the readable part.
  const effectiveTitle = String(built.props.title ?? '').split('|').pop() ?? '';

  return (
    <div className="playground">
      <div className="playground__main">
        <div className="tabs" role="tablist" aria-label="View">
          {(['preview', 'code', 'data'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={tab === t ? 'is-active' : ''}
              onClick={() => setTab(t)}
            >
              {t === 'preview' ? 'Preview' : t === 'code' ? 'Code' : 'Data'}
            </button>
          ))}
        </div>

        {tab === 'preview' && (
          <>
            <div className={`playground__canvas${canvas.dark ? ' is-dark' : ''}`} style={{ background: canvas.background }}>
              <div style={{ height: 480 }}>
                <Component {...built.props} />
              </div>
            </div>
            <div className="events">
              <div className="events__head">
                <h3>Events</h3>
                {events.length > 0 && (
                  <button type="button" className="text-button" onClick={clearEvents}>
                    Clear
                  </button>
                )}
              </div>
              {events.length === 0 ? (
                <p className="muted">Click a data point to see the payload your handler receives.</p>
              ) : (
                <ul className="events__list">
                  {events.map((e) => (
                    <li key={e.id}>
                      <span className="events__name">{e.name}</span>
                      <span className="muted">{e.at}</span>
                      <pre>{safeStringify(e.payload)}</pre>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {tab === 'code' && (
          <div className="playground__panel">
            <p className="muted">
              Generated from the current settings. Replace the sample rows with your own query and it runs as-is.
            </p>
            <CodeBlock code={built.code} />
          </div>
        )}

        {tab === 'data' && (
          <div className="playground__panel">
            <p className="muted">
              The rows passed to the chart. One object per row; keys match each field’s <code>name</code>. Time values
              are ISO strings, keyed by both the field name and <code>name.granularity</code>.
            </p>
            {built.sampleRows.length === 0 ? (
              <p className="muted">No rows in the “{dataState}” state.</p>
            ) : (
              built.sampleRows.map(({ varName, rows }) => (
                <CodeBlock
                  key={varName}
                  label={`${varName} · ${rows.length} rows`}
                  code={safeStringify(rows.slice(0, 12)) + (rows.length > 12 ? `\n// … ${rows.length - 12} more` : '')}
                />
              ))
            )}
          </div>
        )}
      </div>

      <aside className="controls" aria-label="Chart settings">
        <div className="controls__group-head">
          <h3>Preview context</h3>
          <p>How this chart looks in your app.</p>
        </div>
        <div className="control">
          <span className="control__label">Chart theme</span>
          <ThemeSwitcher showLabels />
        </div>
        <div className="control">
          <span className="control__label">Chart language</span>
          <LanguageSwitcher />
        </div>
        <div className="control">
          <span className="control__label">Sample data</span>
          <DatasetSelect />
        </div>
        <div className="control">
          <span className="control__label">Data state</span>
          <div className="segmented segmented--wrap" role="radiogroup" aria-label="Data state">
            {dataStates.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={dataState === s.id}
                className={dataState === s.id ? 'is-active' : ''}
                onClick={() => setDataState(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="controls__group-head controls__group-head--divided">
          <h3>Props</h3>
          <p>Passed to the component; reflected in the code.</p>
        </div>
        <div className="control">
          <label className="control__label" htmlFor="chart-title">
            Title
          </label>
          <input
            id="chart-title"
            className="input"
            value={effectiveTitle}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        {entry.toggles.length > 0 && (
          <div className="control">
            <span className="control__label">Options</span>
            <div className="switches">
              {entry.toggles.map((t) => (
                <label key={t.key} className="switch">
                  <input
                    type="checkbox"
                    checked={toggles[t.key] ?? t.default}
                    onChange={(e) => setToggles((prev) => ({ ...prev, [t.key]: e.target.checked }))}
                  />
                  <span className="switch__track" aria-hidden />
                  <span>{t.label}</span>
                  <code className="switch__prop">{t.key}</code>
                </label>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};

export const ChartPage = ({ entry }: { entry: ChartEntry }) => {
  const index = chartEntries.indexOf(entry);
  const prev = chartEntries[index - 1];
  const next = chartEntries[index + 1];

  return (
    <div className="container page">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <a href={href('/charts')}>Charts</a>
        <span aria-hidden>/</span>
        <span>{entry.group}</span>
      </nav>
      <div className="page__head">
        <h1>{entry.name}</h1>
        <p className="lede">{entry.description}</p>
        <code className="badge">{`<${String(entry.exportName)} />`}</code>
      </div>
      <Playground key={entry.id} entry={entry} />
      <nav className="pager" aria-label="More charts">
        {prev ? (
          <a href={href(`/charts/${prev.id}`)}>← {prev.name}</a>
        ) : (
          <span />
        )}
        {next && <a href={href(`/charts/${next.id}`)}>{next.name} →</a>}
      </nav>
    </div>
  );
};
