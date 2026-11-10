import { useCallback, useEffect, useMemo, useState } from 'react';
import { CodeDrawer } from '../components/CodeDrawer';
import { ChartContextBar } from '../components/Switchers';
import { useChart } from '../components/useChart';
import { buildChart, ChartSettings } from '../catalog/build';
import { PERIOD_LABEL } from '../catalog/datasets';
import { chartEntries, chartGroups, ChartEntry, ChartVariant } from '../catalog/registry';
import { href } from '../router';
import { useCanvas, useSiteSettings } from '../state';

const noop = () => {};

const GalleryCard = ({ entry, variant }: { entry: ChartEntry; variant?: ChartVariant }) => {
  const { themeId, languageId, datasetId } = useSiteSettings();
  const canvas = useCanvas();
  const [showCode, setShowCode] = useState(false);

  const settings = useMemo<ChartSettings>(
    () => ({
      themeId,
      languageId,
      datasetId,
      dataState: 'ready',
      variantId: variant?.id,
      toggles: {},
      overrides: { description: PERIOD_LABEL },
    }),
    [themeId, languageId, datasetId, variant?.id],
  );
  // The card drops the download menu to stay calm; the copied code keeps it.
  const previewSettings = useMemo(
    () => ({ ...settings, overrides: { ...settings.overrides, menuOptions: [] } }),
    [settings],
  );
  const { built, Component, granularity } = useChart(entry, previewSettings);

  const code = () =>
    buildChart(entry, settings, {
      granularity,
      setGranularity: noop,
      tableState: { page: 0, isLoadingDownloadData: false },
      setTableState: noop,
      onEvent: noop,
    }).code;

  const name = variant?.name ?? entry.name;
  const path = `/charts/${entry.id}${variant ? `/${variant.id}` : ''}`;
  const closeCode = useCallback(() => setShowCode(false), []);

  // The preset's own notes, then the base chart's, then the row shape.
  const notes = () => {
    const firstRow = built.sampleRows[0]?.rows[0];
    const keys = firstRow ? Object.keys(firstRow).map((k) => `\`${k}\``) : [];
    return [
      ...(variant?.notes ?? []),
      ...(entry.notes ?? []),
      ...(keys.length ? [`Each row in \`${built.sampleRows[0]!.varName}\` has: ${keys.join(', ')}. The Data tab in the playground shows them all.`] : []),
    ];
  };

  return (
    <article
      className={`gallery-card${variant?.wide ?? entry.wide ? ' gallery-card--wide' : ''}`}
      style={{ background: canvas.background }}
    >
      <div className="gallery-card__preview">
        <div className="gallery-card__chart">
          <Component {...built.props} />
        </div>
      </div>
      <div className="gallery-card__meta">
        <a className="gallery-card__name" href={href(path)}>
          {name}
        </a>
        <div className="gallery-card__actions">
          <button
            type="button"
            className="button button--small"
            aria-haspopup="dialog"
            onClick={() => setShowCode(true)}
            aria-label={`View code for ${name}`}
          >
            View code
          </button>
          <a className="text-link gallery-card__customise" href={href(path)} aria-label={`Customise ${name}`}>
            Customise →
          </a>
        </div>
      </div>
      {showCode && (
        <CodeDrawer
          title={name}
          description={variant?.description ?? entry.description}
          notes={notes()}
          code={code()}
          onClose={closeCode}
          footer={
            <a className="text-link" href={href(path)} onClick={closeCode}>
              Open in the playground to change props and data →
            </a>
          }
        />
      )}
    </article>
  );
};

const groupId = (group: string) => `group-${group.toLowerCase()}`;

// Jump links for the chart groups, highlighting the group in view. Plain
// buttons: the site routes on the URL hash, so in-page anchors would navigate.
const GroupNav = () => {
  const [active, setActive] = useState<string>(chartGroups[0]);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (items) => {
        const visible = items.filter((i) => i.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const first = visible[0]?.target.getAttribute('data-group');
        if (first) setActive(first);
      },
      { rootMargin: '-200px 0px -55% 0px' },
    );
    document.querySelectorAll('[data-group]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <nav className="gallery-nav" aria-label="Chart groups">
      {chartGroups.map((group) => {
        const count = chartEntries
          .filter((e) => e.group === group)
          .reduce((n, e) => n + 1 + (e.variants?.length ?? 0), 0);
        return (
          <button
            key={group}
            type="button"
            className={active === group ? 'is-active' : ''}
            aria-current={active === group ? 'true' : undefined}
            onClick={() => {
              setActive(group);
              document.getElementById(groupId(group))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            {group}
            <span className="gallery-nav__count">{count}</span>
          </button>
        );
      })}
    </nav>
  );
};

export const Gallery = () => {
  const canvas = useCanvas();
  return (
    <div className="page">
      <div className="container container--wide page__head">
        <h1>Charts</h1>
        <p className="lede">
          Every component, live, with presets that show what each one can do. Copy any card&rsquo;s code as it stands,
          or open it to change its props and data.
        </p>
      </div>
      <div className="context-strip">
        <div className="container container--wide">
          <ChartContextBar compact leading={<GroupNav />} />
        </div>
      </div>
      <div className="container container--wide">
        {chartGroups.map((group) => {
          const entries = chartEntries.filter((e) => e.group === group);
          return (
            <section key={group} id={groupId(group)} data-group={group} className="gallery-group">
              <h2>{group}</h2>
              <div className={`gallery-grid${canvas.dark ? ' is-dark' : ''}`}>
                {entries.flatMap((entry) => [
                  <GalleryCard key={entry.id} entry={entry} />,
                  ...(entry.variants ?? []).map((variant) => (
                    <GalleryCard key={`${entry.id}/${variant.id}`} entry={entry} variant={variant} />
                  )),
                ])}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
