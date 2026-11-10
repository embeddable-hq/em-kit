import type { ReactNode } from 'react';
import { datasetList, DatasetId } from '../catalog/datasets';
import { languages, LanguageId, themePresets } from '../catalog/themes';
import { useSiteSettings } from '../state';

export const ThemeSwitcher = ({ showLabels }: { showLabels?: boolean }) => {
  const { themeId, setThemeId } = useSiteSettings();
  return (
    <div className="theme-switcher" role="radiogroup" aria-label="Chart theme">
      {themePresets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          role="radio"
          aria-checked={preset.id === themeId}
          className={`theme-chip${preset.id === themeId ? ' is-active' : ''}`}
          onClick={() => setThemeId(preset.id)}
          title={preset.label}
          aria-label={showLabels ? undefined : preset.label}
        >
          <span className="theme-chip__swatches" style={{ background: preset.dark ? '#18181b' : '#fff' }}>
            {preset.swatches.map((c) => (
              <span key={c} style={{ background: c }} />
            ))}
          </span>
          {showLabels && <span className="theme-chip__label">{preset.label}</span>}
        </button>
      ))}
    </div>
  );
};

export const LanguageSwitcher = () => {
  const { languageId, setLanguageId } = useSiteSettings();
  return (
    <div className="segmented" role="radiogroup" aria-label="Language">
      {languages.map((l) => (
        <button
          key={l.id}
          type="button"
          role="radio"
          aria-checked={l.id === languageId}
          className={l.id === languageId ? 'is-active' : ''}
          onClick={() => setLanguageId(l.id as LanguageId)}
        >
          {l.id.toUpperCase()}
        </button>
      ))}
    </div>
  );
};

// Settings that change how the charts are previewed, not the site itself.
// `compact` is a single row: no labels or theme names, with `leading` (e.g.
// page navigation) on the left.
export const ChartContextBar = ({
  hint,
  compact,
  leading,
}: {
  hint?: string;
  compact?: boolean;
  leading?: ReactNode;
}) => (
  <div className={`context-bar${compact ? ' context-bar--compact' : ''}`} role="group" aria-label="Chart preview settings">
    {hint && <span className="context-bar__hint">{hint}</span>}
    {leading && <div className="context-bar__leading">{leading}</div>}
    <div className="context-bar__controls">
      <div className="context-bar__item">
        {!compact && <span className="context-bar__label">Chart theme</span>}
        <ThemeSwitcher showLabels={!compact} />
      </div>
      <div className="context-bar__item">
        {!compact && <span className="context-bar__label">Chart language</span>}
        <LanguageSwitcher />
      </div>
      <div className="context-bar__item">
        {!compact && <span className="context-bar__label">Sample data</span>}
        <DatasetSelect />
      </div>
    </div>
  </div>
);

export const DatasetSelect = () => {
  const { datasetId, setDatasetId } = useSiteSettings();
  return (
    <select
      className="select"
      aria-label="Sample data"
      value={datasetId}
      onChange={(e) => setDatasetId(e.target.value as DatasetId)}
    >
      {datasetList.map((d) => (
        <option key={d.id} value={d.id}>
          {d.label}
        </option>
      ))}
    </select>
  );
};
