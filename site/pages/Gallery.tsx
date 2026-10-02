import { LiveChart } from '../components/LiveChart';
import { ChartContextBar } from '../components/Switchers';
import { chartEntries, chartGroups } from '../catalog/registry';
import { href } from '../router';
import { useCanvas } from '../state';

export const Gallery = () => {
  const canvas = useCanvas();
  return (
    <div className="page">
      <div className="container page__head">
        <h1>Charts</h1>
        <p className="lede">
          Every component, live. Switch the theme, language or sample data and the whole gallery follows. Open a chart
          to change its props, inspect its data and copy the code.
        </p>
      </div>
      <div className="context-strip">
        <div className="container">
          <ChartContextBar hint="Preview every chart in a different theme, language or dataset." />
        </div>
      </div>
      <div className="container">
        {chartGroups.map((group) => {
          const entries = chartEntries.filter((e) => e.group === group);
          return (
            <section key={group} className="gallery-group">
              <h2>{group}</h2>
              <div className={`gallery-grid${canvas.dark ? ' is-dark' : ''}`}>
                {entries.map((entry) => (
                  <article key={entry.id} className="gallery-card">
                    <div className="gallery-card__preview" style={{ background: canvas.background }}>
                      <LiveChart entry={entry} height={330} overrides={{ toggles: { hideMenu: true } }} />
                    </div>
                    <div className="gallery-card__meta">
                      <a className="gallery-card__name" href={href(`/charts/${entry.id}`)}>
                        {entry.name}
                      </a>
                      <span className="gallery-card__desc">{entry.description}</span>
                      <a className="text-link" href={href(`/charts/${entry.id}`)} aria-label={`Customise ${entry.name}`}>
                        Customise and copy code →
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
